// Tiny synthesized sound effects (no audio files to download).
let ctx: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem("arcade_muted") === "1"; } catch { /* storage may be blocked */ }

export function isMuted() { return muted; }
export function setMuted(value: boolean) {
  muted = value;
  try { localStorage.setItem("arcade_muted", value ? "1" : "0"); } catch { /* ignore */ }
}

type Kind = "tap" | "place" | "good" | "bad" | "win" | "lose" | "turn" | "flip";
const PLANS: Record<Kind, { notes: number[]; type: OscillatorType; gap: number; len: number; vol: number }> = {
  tap: { notes: [520], type: "triangle", gap: 0.05, len: 0.06, vol: 0.05 },
  place: { notes: [330, 220], type: "triangle", gap: 0.05, len: 0.08, vol: 0.08 },
  flip: { notes: [600, 760], type: "sine", gap: 0.04, len: 0.07, vol: 0.05 },
  good: { notes: [660, 880], type: "triangle", gap: 0.09, len: 0.14, vol: 0.09 },
  bad: { notes: [240, 170], type: "sawtooth", gap: 0.1, len: 0.14, vol: 0.05 },
  turn: { notes: [523, 784], type: "sine", gap: 0.08, len: 0.12, vol: 0.06 },
  win: { notes: [523, 659, 784, 1046], type: "triangle", gap: 0.11, len: 0.18, vol: 0.1 },
  lose: { notes: [392, 330, 262], type: "sine", gap: 0.13, len: 0.2, vol: 0.08 },
};

export function sfx(kind: Kind) {
  if (muted) return;
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    ctx = ctx || new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const plan = PLANS[kind];
    plan.notes.forEach((freq, i) => {
      const osc = ctx!.createOscillator(), gain = ctx!.createGain(), t = ctx!.currentTime + i * plan.gap;
      osc.type = plan.type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(plan.vol, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + plan.len);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + plan.len + 0.02);
    });
  } catch { /* sound is optional */ }
}
