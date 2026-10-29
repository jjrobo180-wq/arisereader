// A.R.I.S.E. Beginners' voice and ears on the page.
// - say(): the premium AI voice from /api/beginners/voice (each clip fetched once per visit), with the browser's own
//   voice as a fallback. It reports how far along the clip is, so Ari's mouth can follow the words.
// - the microphone: short recordings that stop by themselves after the child speaks (one word), long ones the child
//   stops (reading a story), and a live loudness level for the voice bar.
// - little game sounds made with Web Audio (no files).
import { API_BASE } from "@/lib/queryClient";

let token: string | null = null;
export function setBeginnersToken(t: string | null) { token = t; }

const clips = new Map<string, Promise<string | null>>();
let aiWorks = true;
const keyOf = (text: string, slow: boolean) => `${slow ? 1 : 0}|${text}`;

function fetchClip(text: string, slow: boolean): Promise<string | null> {
  const k = keyOf(text, slow);
  let p = clips.get(k);
  if (!p) {
    p = fetch(`${API_BASE}/api/beginners/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ text, slow }),
    }).then(async (r) => (r.ok ? URL.createObjectURL(await r.blob()) : null)).catch(() => null);
    p.then((url) => { if (!url) clips.delete(k); });
    clips.set(k, p);
  }
  return p;
}
/** Starts loading clips so they play the moment they're needed. */
export function preload(texts: string[], slow = false) {
  for (const t of texts.slice(0, 40)) if (t) void fetchClip(t, slow);
}

export type Speaking = {
  /** 0–1 through the clip, or null when nothing is playing. */
  progress(): number | null;
};
let current: HTMLAudioElement | null = null;
let playId = 0;
let browserStart = 0, browserLength = 0, browserOn = false;
/** How far along the current speech is (0–1), or null. */
export function speakingProgress(): number | null {
  if (current && !current.paused && current.duration && Number.isFinite(current.duration)) return Math.min(1, current.currentTime / current.duration);
  if (browserOn) return Math.min(1, (performance.now() - browserStart) / Math.max(1, browserLength));
  return null;
}
export function stopVoice() {
  playId++;
  if (current) { current.pause(); current = null; }
  browserOn = false;
  try { window.speechSynthesis?.cancel(); } catch { /* none */ }
}

function browserSay(text: string, slow: boolean, id: number): Promise<void> {
  return new Promise((resolve) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth || id !== playId) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = slow ? 0.55 : 0.82;
      const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
      const nice = voices.find((v) => /natural|google us|samantha|aria|jenny/i.test(v.name)) || voices[0];
      if (nice) u.voice = nice;
      // The browser doesn't say how long it will take; a guess keeps the mouth moving about right.
      browserLength = (text.length * 62 + 300) / (slow ? 0.55 : 0.82);
      browserStart = performance.now();
      u.onstart = () => { browserStart = performance.now(); browserOn = true; };
      let finished = false;
      const end = () => { if (finished) return; finished = true; browserOn = false; resolve(); };
      u.onend = end; u.onerror = end;
      synth.speak(u);
      // Some browsers never fire onend; don't let a lesson wait forever.
      setTimeout(end, browserLength + 4000);
    } catch { resolve(); }
  });
}

/** Says something; resolves when it has finished (or was stopped by the next thing said). */
export async function say(text: string, opts: { slow?: boolean } = {}): Promise<void> {
  const slow = !!opts.slow;
  stopVoice();
  const id = playId;
  if (!text) return;
  const url = aiWorks ? await fetchClip(text, slow) : null;
  if (id !== playId) return;
  if (!url) return browserSay(text, slow, id);
  await new Promise<void>((resolve) => {
    const a = new Audio(url);
    current = a;
    a.onended = () => { if (current === a) current = null; resolve(); };
    a.onerror = () => { aiWorks = false; if (current === a) current = null; void browserSay(text, slow, id).then(resolve); };
    a.play().catch(() => { if (current === a) current = null; resolve(); });
  });
}
/** Says several things one after another, with a short pause between them. Stops if something else is said. */
export async function sayAll(parts: { text: string; slow?: boolean }[], onEach?: (i: number) => void) {
  const mine = ++seqId;
  for (let i = 0; i < parts.length; i++) {
    if (seqId !== mine) return;
    onEach?.(i);
    await say(parts[i].text, parts[i]);
    if (seqId !== mine) return;
    await new Promise((r) => setTimeout(r, 220));
  }
}
let seqId = 0;
/** Stops a sayAll that's under way. */
export function stopAll() { seqId++; stopVoice(); }

/* ---------- game sounds */
let ctx: AudioContext | null = null;
let soundsOn = true;
export function setSounds(on: boolean) { soundsOn = on; }
function tone(freqs: number[], dur = 0.12, type: OscillatorType = "sine", gap = 0.09, vol = 0.16) {
  if (!soundsOn) return;
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    const t0 = ctx.currentTime + 0.01;
    freqs.forEach((f, i) => {
      const o = ctx!.createOscillator(), g = ctx!.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + i * gap); g.gain.linearRampToValueAtTime(vol, t0 + i * gap + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t0 + i * gap + dur);
      o.connect(g).connect(ctx!.destination); o.start(t0 + i * gap); o.stop(t0 + i * gap + dur + 0.05);
    });
  } catch { /* no sound */ }
}
export const sounds = {
  tap: () => tone([620], 0.05, "triangle", 0, 0.07),
  snap: () => tone([440, 660], 0.07, "triangle", 0.05, 0.12),
  right: () => tone([660, 880], 0.16, "triangle"),
  miss: () => tone([330, 262], 0.18, "sine", 0.12, 0.1),
  star: () => tone([988, 1319], 0.12, "sine", 0.07, 0.14),
  win: () => tone([523, 659, 784, 1047, 1319], 0.22, "triangle", 0.11, 0.18),
};

/* ---------- the microphone */
export const canRecord = () => typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof (window as any).MediaRecorder !== "undefined";

export type Recording = {
  /** Stops now and hands back the recording. */
  stop(): void;
  done: Promise<{ blob: Blob; seconds: number; spoke: boolean }>;
};
/**
 * Starts recording. `level` gets the loudness (0–1) many times a second. With `autoStop`, it stops by itself
 * 0.8 s after the child stops talking; it always stops at `maxMs`.
 */
export async function startRecording(o: { maxMs: number; autoStop?: boolean; level?: (v: number) => void }): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => (window as any).MediaRecorder.isTypeSupported?.(t)) || "";
  const rec: MediaRecorder = new (window as any).MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const parts: BlobPart[] = [];
  const started = performance.now();
  let spoke = false;
  rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  let ac: AudioContext | null = null;
  const done = new Promise<{ blob: Blob; seconds: number; spoke: boolean }>((resolve) => {
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      void ac?.close().catch(() => {});
      o.level?.(0);
      resolve({ blob: new Blob(parts, { type: (rec.mimeType || type || "audio/webm").split(";")[0] }), seconds: (performance.now() - started) / 1000, spoke });
    };
  });
  rec.start(250);
  const stop = () => { if (rec.state === "recording") rec.stop(); };
  try {
    ac = new (window.AudioContext || (window as any).webkitAudioContext)();
    const src = ac.createMediaStreamSource(stream);
    const an = ac.createAnalyser();
    an.fftSize = 1024;
    src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    let quietSince = 0;
    const tick = () => {
      if (rec.state !== "recording") return;
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) { const d = (v - 128) / 128; sum += d * d; }
      const rms = Math.sqrt(sum / buf.length);
      const level = Math.min(1, rms * 6);
      o.level?.(level);
      const t = performance.now();
      if (level > 0.12) { spoke = true; quietSince = 0; } else if (spoke && !quietSince) quietSince = t;
      if ((o.autoStop && spoke && quietSince && t - quietSince > 800) || t - started > o.maxMs) { stop(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } catch {
    spoke = true;
    setTimeout(stop, o.maxMs);
  }
  return { stop, done };
}

/** Sends a recording to the server and returns its JSON answer. */
export async function sendAudio(path: string, blob: Blob): Promise<any> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": blob.type || "audio/webm", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: blob,
    cache: "no-store",
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e: any = new Error(data.message || "I couldn't listen that time. Please try again."); e.status = r.status; throw e; }
  return data;
}
