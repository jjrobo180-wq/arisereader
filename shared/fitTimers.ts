// Cooked interval timers: work, rest and rounds that turn into a guided session (shared/fitSessions.ts),
// for any workout (HIIT, boxing, jump rope, circuits, EMOM). Presets are built in; your own are saved
// with your Cooked data.
import type { Phase, Session } from "./fitSessions";

export type IntervalTimer = { id: string; name: string; warm: number; work: number; rest: number; rounds: number; sets: number; setRest: number; cool: number };
const n = (v: unknown, lo: number, hi: number, d: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };

export function cleanTimer(t: any): IntervalTimer | null {
  if (!t || typeof t !== "object" || !t.id) return null;
  return { id: String(t.id).slice(0, 40), name: String(t.name || "My timer").slice(0, 40), warm: n(t.warm, 0, 1800, 0), work: n(t.work, 5, 3600, 30), rest: n(t.rest, 0, 1800, 30),
    rounds: n(t.rounds, 1, 100, 8), sets: n(t.sets, 1, 10, 1), setRest: n(t.setRest, 0, 900, 60), cool: n(t.cool, 0, 1800, 0) };
}
export const cleanTimers = (raw: unknown): IntervalTimer[] => (Array.isArray(raw) ? raw : []).map(cleanTimer).filter((t): t is IntervalTimer => !!t).slice(0, 30);

export const TIMER_PRESETS: IntervalTimer[] = [
  { id: "preset-tabata", name: "Tabata", warm: 120, work: 20, rest: 10, rounds: 8, sets: 1, setRest: 0, cool: 60 },
  { id: "preset-30-30", name: "30 on, 30 off", warm: 120, work: 30, rest: 30, rounds: 10, sets: 1, setRest: 0, cool: 60 },
  { id: "preset-emom", name: "EMOM, 12 minutes", warm: 0, work: 60, rest: 0, rounds: 12, sets: 1, setRest: 0, cool: 0 },
  { id: "preset-40-20", name: "40/20 circuit", warm: 120, work: 40, rest: 20, rounds: 6, sets: 3, setRest: 90, cool: 120 },
  { id: "preset-boxing", name: "Boxing rounds", warm: 180, work: 180, rest: 60, rounds: 6, sets: 1, setRest: 0, cool: 120 },
  { id: "preset-rope", name: "Jump rope ladder", warm: 60, work: 60, rest: 30, rounds: 8, sets: 1, setRest: 0, cool: 60 },
];

export const timerSecs = (t: IntervalTimer) => t.warm + t.cool + t.sets * (t.rounds * t.work + (t.rounds - 1) * t.rest) + (t.sets - 1) * t.setRest;

/** The timer as a guided session the player can run. */
export function timerSession(t: IntervalTimer): Session {
  const phases: Phase[] = [];
  if (t.warm) phases.push({ name: "Warm up", secs: t.warm, kind: "warm", cue: "Easy pace. Get loose." });
  for (let s = 0; s < t.sets; s++) {
    for (let r = 0; r < t.rounds; r++) {
      phases.push({ name: t.sets > 1 ? `Set ${s + 1} · Round ${r + 1} of ${t.rounds}` : `Round ${r + 1} of ${t.rounds}`, secs: t.work, kind: "work", cue: r === t.rounds - 1 && s === t.sets - 1 ? "Last one. Empty the tank." : "Go." });
      if (t.rest && r < t.rounds - 1) phases.push({ name: "Rest", secs: t.rest, kind: "rest" });
    }
    if (s < t.sets - 1 && t.setRest) phases.push({ name: "Rest between sets", secs: t.setRest, kind: "rest", cue: "Shake it out. Breathe." });
  }
  if (t.cool) phases.push({ name: "Cool down", secs: t.cool, kind: "cool", cue: "Slow it down." });
  return { id: `timer-${t.id}`, name: t.name, category: "hiit", level: "Intermediate", equipment: "Any", blurb: "", phases };
}
