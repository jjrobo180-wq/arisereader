// Ready Mode: an optional switch that fits today's workout to how ready your body is. It reads your
// readiness score (sleep, sleep debt, muscle recovery and recent load: shared/fitReadiness.ts), last
// night's sleep and how recovered each muscle is (shared/fitRecovery.ts), then changes weights, sets and
// rest, and says why for every change. Off by default; nothing changes unless it's on.
// Also the pre-workout check-in: what you ate, pre-workout or caffeine, and tips that follow from it.
import type { FitData, FitExercise } from "./fit";
import { CATALOG_BY_ID, round } from "./fit";
import { readiness } from "./fitReadiness";
import { recovery, PART_NAME, type BodyPart } from "./fitRecovery";
import { nightHours } from "./fitSleep";

export type ReadyPlan = { score: number; word: string; level: "push" | "train" | "easy" | "rest";
  exercises: FitExercise[]; changes: string[]; why: string[]; headline: string };

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const step = (u: "lb" | "kg") => (u === "kg" ? 1.25 : 2.5);

/** The workout fitted to today. `exercises` is the plan as it would be with Ready Mode on. */
export function readyPlan(data: FitData, exercises: FitExercise[], now = new Date()): ReadyPlan {
  const r = readiness(data, now);
  const u = data.profile.units;
  const level: ReadyPlan["level"] = r.score >= 80 ? "push" : r.score >= 60 ? "train" : r.score >= 40 ? "easy" : "rest";
  const rec = recovery(data.workouts, now);
  const night = data.sleep?.nights.find((n) => n.date === dayKey(now));
  const slept = night ? nightHours(night) : null;
  const why: string[] = [];
  if (slept != null) why.push(slept < 6 ? `You slept ${slept.toFixed(1)} h last night; short sleep lowers strength and raises injury risk.` : slept >= 7.5 ? `You slept ${slept.toFixed(1)} h last night. Good recovery.` : `You slept ${slept.toFixed(1)} h last night.`);
  for (const p of r.parts) if (p.got / p.of < 0.5) why.push(`${p.label}: ${p.note}.`);
  const changes: string[] = [];
  const pct = level === "push" ? 1.025 : level === "easy" ? 0.9 : level === "rest" ? 0.8 : 1;
  const maxSets = level === "easy" ? (n: number) => Math.max(2, n - 1) : level === "rest" ? (n: number) => Math.min(2, n) : (n: number) => n;
  const extraRest = level === "easy" ? 30 : level === "rest" ? 45 : 0;
  let out = exercises.map((e) => {
    const muscle = CATALOG_BY_ID.get(e.exId)?.muscle as BodyPart | undefined;
    const fresh = muscle && rec[muscle] ? rec[muscle].pct : 100;
    // A muscle still recovering gets lighter weight on its own, whatever the overall score.
    const mp = fresh < 50 ? Math.min(pct, 0.85) : fresh < 70 ? Math.min(pct, 0.93) : pct;
    if (fresh < 70 && muscle) { const line = `${PART_NAME[muscle]} is ${Math.round(fresh)}% recovered, so ${e.name} is lighter.`; if (!changes.includes(line)) changes.push(line); }
    const todo = e.sets.filter((s) => !s.done);
    const keep = maxSets(todo.length);
    const sets = [...e.sets.filter((s) => s.done), ...todo.slice(0, keep).map((s) => ({ ...s, weight: s.weight > 0 && mp !== 1 ? Math.max(0, round(s.weight * mp, step(u))) : s.weight }))];
    return { ...e, sets, ...(extraRest ? { rest: (e.rest ?? 90) + extraRest } : {}) };
  });
  if (level === "rest" && out.length > 4) { changes.push(`Cut to your first 4 exercises (from ${out.length}).`); out = out.slice(0, 4); }
  if (pct !== 1) changes.unshift(level === "push" ? `Weights up about 2.5%: you're fresh, a good day to chase a record.` : `Weights down about ${Math.round((1 - pct) * 100)}%.`);
  if (level === "easy" || level === "rest") changes.push(level === "rest" ? "Up to 2 sets per exercise." : "One set fewer per exercise (at least 2).");
  if (extraRest) changes.push(`${extraRest} s more rest between sets.`);
  const headline = level === "push" ? "Ready to push: go for it today" : level === "train" ? "Good to train: your plan stays as it is" : level === "easy" ? "Take it easier: a lighter version of your plan" : "Recovery day: a short, light session";
  if (level === "train" && !changes.length) changes.push("No changes needed today.");
  return { score: r.score, word: r.word, level, exercises: out, changes, why: why.length ? why : [r.advice], headline };
}

// ── Pre-workout check-in ───────────────────────────────────────────────────────────────────────────
export type Fueled = "meal" | "snack" | "fasted";
export type Stim = "none" | "coffee" | "preworkout";
export type CheckIn = { food: Fueled; stim: Stim; stretched: boolean; ready: number; adapted: boolean };

/** Plain tips from what they said, for before the first set. */
export function checkInTips(c: Pick<CheckIn, "food" | "stim">, hour = new Date().getHours()): string[] {
  const t: string[] = [];
  if (c.food === "fasted") t.push("Training on an empty stomach is fine for most people, but if you feel light-headed, have a banana or a few dates.");
  if (c.food === "meal") t.push("A full meal in the last hour or two can feel heavy on hard sets; start lighter and build up.");
  if (c.stim === "preworkout") t.push("Pre-workout: drink water with it, and don't stack more caffeine today. Most have 150–300 mg.");
  if (c.stim !== "none" && hour >= 16) t.push("Caffeine this late can keep you up tonight; it lasts 5–6 hours in the body.");
  if (!t.length) t.push("Sip water between sets.");
  return t;
}

/** The warm-up to suggest: matched to the muscles in today's workout. */
export function warmupFor(exercises: FitExercise[]): "mob-hips" | "mob-shoulders" | "mob-back" {
  const ms = exercises.map((e) => CATALOG_BY_ID.get(e.exId)?.muscle ?? "");
  const lower = ms.filter((m) => ["quads", "hamstrings", "glutes", "calves"].includes(m)).length;
  const upper = ms.filter((m) => ["chest", "shoulders", "triceps", "biceps", "back"].includes(m)).length;
  return lower >= upper && lower > 0 ? "mob-hips" : upper > 0 ? "mob-shoulders" : "mob-back";
}
