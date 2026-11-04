// Sound and touch for the interactive looks (play.tsx). Every sound is made on the spot with the Web
// Audio API (no audio files), quiet, and only after a tap (browsers allow sound only then). Taps on
// the iPhone use the Taptic Engine through Capacitor's Haptics plugin; elsewhere, vibration where
// the device has it. Both can be turned off, and are remembered on this device.
import { useEffect, useState } from "react";
import { hasNativePlugin, isNativeApp, nativeCall } from "@/lib/nativeApp";

const SOUND = "arise-play-sound", BUZZ = "arise-play-haptics";
const on = (k: string) => { try { return localStorage.getItem(k) !== "0"; } catch { return true; } };
const listeners = new Set<() => void>();
export function setFeel(kind: "sound" | "haptics", value: boolean) { try { localStorage.setItem(kind === "sound" ? SOUND : BUZZ, value ? "1" : "0"); } catch { /* not kept */ } listeners.forEach((f) => f()); }
export function useFeel(): { sound: boolean; haptics: boolean } {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  return { sound: on(SOUND), haptics: on(BUZZ) };
}
export const reducedMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

// ─── Touch ───
let lastBuzz = 0;
/** A tap you can feel: "tick" for a detent or a click, "light"/"medium"/"heavy" for bumps, "success" when something's done. */
export function buzz(kind: "tick" | "light" | "medium" | "heavy" | "success" = "light") {
  if (!on(BUZZ)) return;
  const now = performance.now();
  if (kind === "tick" && now - lastBuzz < 28) return; // the Taptic Engine can't keep up with more
  lastBuzz = now;
  if (isNativeApp() && hasNativePlugin(/haptics/i)) {
    const call = kind === "success" ? nativeCall(/haptics/i, "Haptics", "notification", { type: "SUCCESS" })
      : kind === "tick" ? nativeCall(/haptics/i, "Haptics", "impact", { style: "LIGHT" })
      : nativeCall(/haptics/i, "Haptics", "impact", { style: kind.toUpperCase() });
    void call.catch(() => {});
    return;
  }
  try { navigator.vibrate?.(kind === "tick" ? 4 : kind === "light" ? 10 : kind === "medium" ? 18 : kind === "heavy" ? 30 : [12, 40, 22]); } catch { /* none */ }
}

// ─── Sound ───
let ctx: AudioContext | null = null, master: GainNode | null = null;
function audio(): AudioContext | null {
  if (!on(SOUND)) return null;
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    if (!master) { master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); }
    return ctx;
  } catch { return null; }
}
type Tone = { f: number; to?: number; t?: number; type?: OscillatorType; g?: number; at?: number };
function tone({ f, to, t = 0.08, type = "sine", g = 0.12, at = 0 }: Tone) {
  const a = audio(); if (!a || !master) return;
  const s = a.currentTime + at, o = a.createOscillator(), v = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, s); if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), s + t);
  v.gain.setValueAtTime(0.0001, s); v.gain.exponentialRampToValueAtTime(g, s + 0.005); v.gain.exponentialRampToValueAtTime(0.0001, s + t);
  o.connect(v); v.connect(master); o.start(s); o.stop(s + t + 0.02);
}
function noise({ t = 0.12, g = 0.08, from = 2000, to = 400, q = 1.2, at = 0 }: { t?: number; g?: number; from?: number; to?: number; q?: number; at?: number }) {
  const a = audio(); if (!a || !master) return;
  const s = a.currentTime + at, len = Math.ceil(a.sampleRate * t), b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), v = a.createGain();
  src.buffer = b; f.type = "bandpass"; f.Q.value = q; f.frequency.setValueAtTime(from, s); f.frequency.exponentialRampToValueAtTime(to, s + t);
  v.gain.setValueAtTime(g, s); v.gain.exponentialRampToValueAtTime(0.0001, s + t);
  src.connect(f); f.connect(v); v.connect(master); src.start(s);
}
let lastTick = 0;
const PENTA = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880];
/** The interactive looks' sounds. */
export const play = {
  tick: (pitch = 1) => { const n = performance.now(); if (n - lastTick < 22) return; lastTick = n; tone({ f: 2400 * pitch, t: 0.018, type: "square", g: 0.035 }); },
  click: () => { tone({ f: 1100, to: 700, t: 0.03, type: "triangle", g: 0.08 }); },
  clack: (v = 1) => { const n = performance.now(); if (n - lastTick < 35) return; lastTick = n; tone({ f: 1500 + Math.random() * 900, t: 0.025, type: "triangle", g: 0.03 + 0.05 * Math.min(1, v) }); },
  pop: () => { noise({ t: 0.05, g: 0.16, from: 3000, to: 900, q: 0.8 }); tone({ f: 520, to: 160, t: 0.07, g: 0.1 }); },
  boing: (pitch = 1) => { tone({ f: 180 * pitch, to: 420 * pitch, t: 0.16, g: 0.12 }); tone({ f: 420 * pitch, to: 260 * pitch, t: 0.22, g: 0.06, at: 0.12 }); },
  whoosh: (v = 1) => { noise({ t: 0.35, g: 0.05 + 0.06 * Math.min(1, v), from: 300, to: 2400, q: 0.7 }); },
  bubble: () => { tone({ f: 280 + Math.random() * 200, to: 900 + Math.random() * 400, t: 0.09, g: 0.06 }); },
  chime: () => { tone({ f: 880, t: 0.6, g: 0.07 }); tone({ f: 1318.5, t: 0.8, g: 0.05, at: 0.08 }); tone({ f: 1760, t: 0.9, g: 0.035, at: 0.16 }); },
  ding: () => { [1568, 2093, 2637].forEach((f, i) => tone({ f, t: 0.5, g: 0.07, type: "triangle", at: i * 0.09 })); },
  note: (i: number) => { const f = PENTA[((i % PENTA.length) + PENTA.length) % PENTA.length]; tone({ f, t: 0.5, type: "sawtooth", g: 0.05 }); tone({ f: f * 2, t: 0.35, type: "sine", g: 0.04 }); },
  chord: () => { [0, 2, 4, 7].forEach((n, i) => tone({ f: PENTA[n % PENTA.length] * (n >= PENTA.length ? 2 : 1), t: 0.7, type: "triangle", g: 0.05, at: i * 0.07 })); },
  hum: (v: number) => { tone({ f: 70 + v * 60, t: 0.12, type: "sine", g: 0.02 + v * 0.03 }); },
};
