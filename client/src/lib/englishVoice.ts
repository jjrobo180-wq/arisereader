// English Explorer's voice on the page: the premium AI voice from /api/english/voice (each clip is fetched
// once and kept for the visit), with the general AI voice (lib/aiVoice.ts) as the backup — never the robot voice.
// Also the little game sounds (made with Web Audio, no files) and the microphone for "Say it".
import { API_BASE } from "@/lib/queryClient";
import { preloadAiVoice } from "@/lib/aiVoice";

type Lang = "en" | "es";
const clips = new Map<string, Promise<string | null>>();
let current: HTMLAudioElement | null = null;
let playId = 0;
let token: string | null = null;
let aiVoiceWorks = true;

export function setVoiceToken(t: string | null) { token = t; }
const keyOf = (text: string, lang: Lang, slow: boolean) => `${lang}|${slow ? 1 : 0}|${text}`;

function fetchClip(text: string, lang: Lang, slow: boolean): Promise<string | null> {
  const k = keyOf(text, lang, slow);
  let p = clips.get(k);
  if (!p) {
    p = fetch(`${API_BASE}/api/english/voice`, {
      method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ text, lang, slow }),
    }).then(async (r) => (r.ok ? URL.createObjectURL(await r.blob()) : null)).catch(() => null);
    p.then((url) => { if (!url) clips.delete(k); });
    clips.set(k, p);
  }
  return p;
}
/** Starts loading clips so they play instantly later. */
export function preload(texts: { text: string; lang?: Lang; slow?: boolean }[]) {
  for (const t of texts.slice(0, 40)) if (t.text) void fetchClip(t.text, t.lang || "en", !!t.slow);
}

export function stopVoice() {
  playId++; seq++;
  if (current) { current.pause(); current = null; }
}

/** The premium voice couldn't answer: the same words in the general AI voice (lib/aiVoice.ts),
 *  never the browser's robot voice. */
async function backupSay(text: string, slow: boolean, id: number): Promise<void> {
  let blob: Blob;
  try { blob = await preloadAiVoice(text, "hannah"); } catch { return; }
  if (id !== playId) return;
  const url = URL.createObjectURL(blob);
  await new Promise<void>((resolve) => {
    const a = new Audio(url);
    a.playbackRate = slow ? 0.75 : 0.95;
    current = a;
    const done = () => { if (current === a) current = null; URL.revokeObjectURL(url); resolve(); };
    a.onended = done; a.onerror = done;
    a.play().catch(done);
  });
}

let seq = 0;
/** Says something; resolves when it has finished (or was stopped by the next thing said). */
export function say(text: string, opts: { lang?: Lang; slow?: boolean } = {}): Promise<void> { seq++; return sayOne(text, opts); }
async function sayOne(text: string, opts: { lang?: Lang; slow?: boolean } = {}): Promise<void> {
  const lang = opts.lang || "en", slow = !!opts.slow;
  playId++;
  if (current) { current.pause(); current = null; }
  const id = playId;
  if (!text) return;
  const url = aiVoiceWorks ? await fetchClip(text, lang, slow) : null;
  if (id !== playId) return;
  if (!url) return backupSay(text, slow, id);
  await new Promise<void>((resolve) => {
    const a = new Audio(url);
    current = a;
    a.onended = () => resolve(); a.onerror = () => { aiVoiceWorks = false; void backupSay(text, slow, id).then(resolve); };
    a.play().catch(() => resolve());
  });
}
/** Says several things one after another (a word, then its sentence). */
export async function sayAll(parts: { text: string; lang?: Lang; slow?: boolean }[]) {
  const mine = ++seq;
  for (const p of parts) {
    if (seq !== mine) return;
    await sayOne(p.text, p);
    await new Promise((r) => setTimeout(r, 250));
  }
}

/* ---------- game sounds */
let ctx: AudioContext | null = null;
let soundsOn = true;
export function setSounds(on: boolean) { soundsOn = on; }
function tone(freqs: number[], dur = 0.12, type: OscillatorType = "sine", gap = 0.09, vol = 0.18) {
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
  right: () => tone([660, 880], 0.16, "triangle"),
  combo: () => tone([660, 880, 1175], 0.16, "triangle", 0.08),
  miss: () => tone([330, 262], 0.18, "sine", 0.12, 0.12),
  tap: () => tone([520], 0.05, "square", 0, 0.05),
  win: () => tone([523, 659, 784, 1047, 1319], 0.22, "triangle", 0.11, 0.2),
  star: () => tone([988, 1319], 0.12, "sine", 0.07, 0.15),
};

/* ---------- the microphone */
export const canRecord = () => typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof (window as any).MediaRecorder !== "undefined";
/** Records up to `ms` milliseconds (stops early on silence after speech). */
export async function record(ms = 3500): Promise<Blob> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => (window as any).MediaRecorder.isTypeSupported?.(t)) || "";
  const rec: MediaRecorder = new (window as any).MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const parts: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  const done = new Promise<Blob>((resolve) => { rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); resolve(new Blob(parts, { type: rec.mimeType || type || "audio/webm" })); }; });
  rec.start();
  // Stop after a pause once the child has spoken, or at the time limit.
  try {
    const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
    const src = ac.createMediaStreamSource(stream); const an = ac.createAnalyser(); an.fftSize = 512; src.connect(an);
    const buf = new Uint8Array(an.fftSize); let spoke = false, quietSince = 0; const start = performance.now();
    const tick = () => {
      if (rec.state !== "recording") { void ac.close(); return; }
      an.getByteTimeDomainData(buf);
      let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
      const nowT = performance.now();
      if (peak > 18) { spoke = true; quietSince = 0; } else if (spoke && !quietSince) quietSince = nowT;
      if ((spoke && quietSince && nowT - quietSince > 700) || nowT - start > ms) { rec.stop(); void ac.close(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } catch { setTimeout(() => rec.state === "recording" && rec.stop(), ms); }
  return done;
}
