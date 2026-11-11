// Cooked readiness: how ready you are to train today, 0-100, from last night's sleep, the week's sleep
// debt, how recovered your muscles are (shared/fitRecovery.ts) and how hard the last few days were.
// Not a medical measure; a nudge for whether to push or go easy.
import type { FitData } from "./fit";
import { BODY_PARTS, recovery } from "./fitRecovery";
import { sleepScore, sleepStats } from "./fitSleep";

export type Readiness = { score: number; word: string; advice: string; parts: { label: string; got: number; of: number; note: string }[] };
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function readiness(data: FitData, now = new Date()): Readiness {
  const night = data.sleep?.nights.find((n) => n.date === dayKey(now));
  const st = sleepStats(data.sleep, 7);
  // Sleep: last night's score (45), or the week's average when last night wasn't tracked.
  const sleepPart = night ? Math.round((sleepScore(night, data.sleep).score / 100) * 45) : st.n ? Math.round(45 * Math.min(1, st.avg / st.goal) * 0.9) : 30;
  const debtPart = Math.round(15 * Math.max(0, 1 - st.debt / 7));
  const rec = recovery(data.workouts, now);
  const fresh = BODY_PARTS.reduce((a, p) => a + rec[p].pct, 0) / BODY_PARTS.length;
  const musclePart = Math.round(25 * (fresh / 100));
  const recent = data.workouts.filter((w) => now.getTime() - Date.parse(w.date) < 3 * 864e5 && !/session-(meditation|mobility)/.test(w.programId ?? ""));
  const loadPart = Math.round(15 * Math.max(0, 1 - Math.max(0, recent.length - 1) / 3));
  const score = Math.max(5, Math.min(100, sleepPart + debtPart + musclePart + loadPart));
  const word = score >= 80 ? "Ready to push" : score >= 60 ? "Good to train" : score >= 40 ? "Take it easier" : "Rest and recover";
  const advice = score >= 80 ? "You slept well and you're recovered. A great day for a hard session or a new record."
    : score >= 60 ? "Train as planned. Warm up well and listen to your body on the heavy sets."
    : score >= 40 ? "Keep it lighter today: fewer sets, mobility or an easy walk or ride."
    : "Your body needs a break. Try yoga, stretching or a walk, and aim for an early night.";
  return { score, word, advice, parts: [
    { label: "Sleep last night", got: sleepPart, of: 45, note: night ? `${Math.round(sleepScore(night, data.sleep).score)} sleep score` : st.n ? "Not tracked: used your week" : "Not tracked yet" },
    { label: "Sleep debt", got: debtPart, of: 15, note: st.n ? `${st.debt.toFixed(1)} h under your goal this week` : "No nights yet" },
    { label: "Muscles", got: musclePart, of: 25, note: `${Math.round(fresh)}% recovered on average` },
    { label: "Recent training", got: loadPart, of: 15, note: `${recent.length} workout${recent.length === 1 ? "" : "s"} in 3 days` },
  ] };
}
