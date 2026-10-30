// Arise LifeHub · Sleep: the voice that reads stories, Scripture, prayers and relaxations aloud.
//
// A script is read one sentence at a time with a calm pause after each, so it can be heard with
// the eyes closed. With the AI voice, each sentence comes from the server's calm "sleep" voice
// (server/routes.ts, /api/eye-gaze/tts), fetched a couple of sentences ahead so there are no
// gaps, and kept on this phone (Cache Storage) so a story heard once plays again instantly, even
// offline. Signed out, or if the sleep voice can't be reached, the general AI voice says it
// (lib/aiVoice.ts). It is always an AI voice: the phone's robot voice is never used.
//
// Only one HTMLAudioElement is used, and it's started inside the tap that begins the reading:
// iPhones only let audio play that way, and a single reused element stays allowed afterwards.

import { API_BASE } from "@/lib/queryClient";
import { preloadAiVoice } from "@/lib/aiVoice";
import type { ScriptLine } from "@shared/sleepScripts";
import { toSegments, type Pace, type Segment } from "@shared/sleepSpeech";
import { sleepSounds } from "./soundEngine";

export type { Pace };
export type NarratorOptions = {
  title: string;
  voice: "ai" | "device";
  aiVoice: "warm" | "deep";
  deviceVoice: string;
  pace: Pace;
  token: string | null;
  onEnd?: () => void;
};
export type NarratorSnapshot = { state: "idle" | "loading" | "playing" | "paused"; title: string; index: number; total: number; line: string; device: boolean };

const AI_RATE: Record<Pace, number> = { slow: 1, slower: 0.96, slowest: 0.9 };

// ── Voices ──────────────────────────────────────────────────────────────────

/** djb2, for naming cached sentences. */
function hash(s: string) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); }
const CACHE_NAME = "arise-sleep-voice-v1";
const cacheUrl = (voice: string, text: string) => `${typeof location !== "undefined" ? location.origin : ""}/__arise-sleep-voice/${voice}/${hash(text)}-${text.length}`;

class VoiceUnavailable extends Error {}

/** A tiny silent WAV, played inside the first tap to unlock audio on iPhones. */
function silentWav(): string {
  const sr = 8000, n = 80, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

// ── The narrator ────────────────────────────────────────────────────────────

class Narrator {
  private run = 0;
  private segments: Segment[] = [];
  private index = 0;
  private opts: NarratorOptions | null = null;
  private paused = false;
  private resumeWaiters: (() => void)[] = [];
  private audio: HTMLAudioElement | null = null;
  private unlockUrl: string | null = null;
  private finishCurrent: ((r: "done" | "interrupted" | "failed") => void) | null = null;
  private memory = new Map<string, Blob>();
  private inflight = new Map<string, Promise<Blob>>();
  /** The AI voice failed this session; use the phone's voice until the page reloads. */
  aiUnavailable = false;
  private device = false;
  private snapshot: NarratorSnapshot = { state: "idle", title: "", index: 0, total: 0, line: "", device: false };
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined") sleepSounds.onTimerEnd(() => this.stop());
  }

  /** Starts reading a script. Call it straight from a tap. */
  play(lines: readonly ScriptLine[], opts: NarratorOptions) {
    this.stop();
    const run = ++this.run;
    this.opts = opts;
    this.segments = toSegments(lines, opts.pace);
    this.index = 0;
    this.paused = false;
    this.device = false;
    // Unlock the player inside the tap, so it can speak later without one.
    {
      const a = this.element();
      try { this.unlockUrl = this.unlockUrl || silentWav(); a.src = this.unlockUrl; void a.play().catch(() => {}); } catch { /* fine */ }
    }
    sleepSounds.setDucked(true);
    this.setMedia(opts.title);
    this.publish({ state: this.device ? "playing" : "loading", title: opts.title, index: 0, total: this.segments.length, line: "", device: this.device });
    void this.loop(run);
  }

  pause() {
    if (this.snapshot.state === "idle" || this.paused) return;
    this.paused = true;
    this.audio?.pause();
    this.publish({ ...this.snapshot, state: "paused" });
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    if (!this.device && this.audio && this.finishCurrent) void this.audio.play().catch(() => {});
    this.resumeWaiters.splice(0).forEach((fn) => fn());
    this.publish({ ...this.snapshot, state: "playing" });
  }

  stop() {
    this.run++;
    this.paused = false;
    this.resumeWaiters.splice(0).forEach((fn) => fn());
    if (this.audio) { this.audio.pause(); this.audio.onended = null; this.audio.onerror = null; }
    this.finishCurrent?.("interrupted");
    this.finishCurrent = null;
    if (this.snapshot.state !== "idle") {
      sleepSounds.setDucked(false);
      this.publish({ state: "idle", title: "", index: 0, total: 0, line: "", device: this.device });
      try { if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none"; } catch { /* fine */ }
    }
  }

  /** Skips to the next sentence (or back to the previous one). */
  skip(by: 1 | -1) {
    if (this.snapshot.state === "idle") return;
    const opts = this.opts!, at = Math.max(0, Math.min(this.segments.length - 1, this.index + by));
    const segments = this.segments;
    this.stop();
    const run = ++this.run;
    this.opts = opts; this.segments = segments; this.index = at;
    sleepSounds.setDucked(true);
    this.publish({ state: "playing", title: opts.title, index: at, total: segments.length, line: segments[at]?.text || "", device: this.device });
    void this.loop(run);
  }

  private element() {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = "auto";
      this.audio.setAttribute("playsinline", "");
    }
    return this.audio;
  }

  private async loop(run: number) {
    while (run === this.run && this.index < this.segments.length) {
      if (this.paused) { await new Promise<void>((r) => this.resumeWaiters.push(r)); if (run !== this.run) return; }
      const seg = this.segments[this.index];
      if (seg.text) {
        this.publish({ ...this.snapshot, state: this.paused ? "paused" : "playing", index: this.index, line: seg.text, device: this.device });
        if (!this.device) for (let k = 1; k <= 2; k++) { const next = this.segments[this.index + k]; if (next?.text) void this.voice(next.text).catch(() => {}); }
        let result = await this.sayAi(seg.text, run);
        if (run !== this.run) return;
        if (result === "failed") {
          // One more try after a moment (the voice was busy); then on to the next sentence.
          await this.quiet(1500, run);
          if (run !== this.run) return;
          result = await this.sayAi(seg.text, run);
          if (run !== this.run) return;
        }
        if (result === "interrupted" && this.paused) continue; // say this sentence again after resuming
      }
      await this.quiet(seg.pauseMs, run);
      if (run !== this.run) return;
      if (this.paused) { await new Promise<void>((r) => this.resumeWaiters.push(r)); if (run !== this.run) return; }
      this.index++;
    }
    if (run !== this.run) return;
    const done = this.opts?.onEnd;
    this.stop();
    done?.();
  }

  /** Quiet between sentences, cut short if the reading is stopped. */
  private quiet(ms: number, run: number) {
    return new Promise<void>((resolve) => {
      const started = Date.now();
      const tick = () => { if (run !== this.run || Date.now() - started >= ms) resolve(); else setTimeout(tick, Math.min(250, ms)); };
      setTimeout(tick, Math.min(250, ms));
    });
  }

  private async sayAi(text: string, run: number): Promise<"done" | "interrupted" | "failed"> {
    let blob: Blob;
    try { blob = await this.voice(text); } catch { return "failed"; }
    if (run !== this.run) return "interrupted";
    const a = this.element(), opts = this.opts!;
    const url = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      let settled = false;
      const finish = (r: "done" | "interrupted" | "failed") => {
        if (settled) return;
        settled = true;
        a.onended = null; a.onerror = null;
        this.finishCurrent = null;
        URL.revokeObjectURL(url);
        resolve(r);
      };
      this.finishCurrent = finish;
      a.onended = () => finish("done");
      a.onerror = () => finish("failed");
      a.src = url;
      a.defaultPlaybackRate = AI_RATE[opts.pace];
      a.playbackRate = AI_RATE[opts.pace];
      if (this.snapshot.state === "loading") this.publish({ ...this.snapshot, state: "playing" });
      if (this.paused) return; // resume() starts it
      a.play().catch(() => finish("failed"));
    });
  }

  /** One sentence in the calm AI voice: from memory, from this phone's cache, or from the server. */
  private voice(text: string): Promise<Blob> {
    const opts = this.opts!;
    const key = `${opts.aiVoice}|${text}`;
    const have = this.memory.get(key);
    if (have) return Promise.resolve(have);
    const pending = this.inflight.get(key);
    if (pending) return pending;
    const job = (async () => {
      const url = cacheUrl(opts.aiVoice, text);
      try {
        if (typeof caches !== "undefined") {
          const hit = await (await caches.open(CACHE_NAME)).match(url);
          if (hit) return await hit.blob();
        }
      } catch { /* no cache here */ }
      let blob: Blob;
      const r = opts.token ? await fetch(`${API_BASE}/api/eye-gaze/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.token}` },
        body: JSON.stringify({ text, style: "sleep", voice: opts.aiVoice }),
      }).catch(() => null) : null;
      if (r?.ok) blob = await r.blob();
      // The general AI voice in a matching calm voice.
      else blob = await preloadAiVoice(text, opts.aiVoice === "deep" ? "daniel" : "autumn").catch((e) => { throw new VoiceUnavailable(String(e?.message || "")); });
      try { if (typeof caches !== "undefined") await (await caches.open(CACHE_NAME)).put(url, new Response(blob, { headers: { "Content-Type": blob.type || "audio/mpeg" } })); } catch { /* storage full or blocked */ }
      return blob;
    })();
    this.inflight.set(key, job);
    return job.then((b) => { this.memory.set(key, b); if (this.memory.size > 150) this.memory.delete(this.memory.keys().next().value!); return b; })
      .finally(() => this.inflight.delete(key));
  }

  /** The lock screen shows what's playing, with pause and play. */
  private setMedia(title: string) {
    try {
      if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist: "Arise LifeHub · Sleep" });
      navigator.mediaSession.playbackState = "playing";
      navigator.mediaSession.setActionHandler("pause", () => this.pause());
      navigator.mediaSession.setActionHandler("play", () => this.resume());
      navigator.mediaSession.setActionHandler("stop", () => this.stop());
    } catch { /* not on this browser */ }
  }

  // ── For React ──
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.snapshot;
  private publish(next: NarratorSnapshot) { this.snapshot = next; this.listeners.forEach((fn) => fn()); }
}

export const narrator = new Narrator();
