// Cooked maxes: the most someone has lifted (or done) on an exercise, entered and updated by hand (a
// tested max, a max from before Cooked, a gym test day), kept as a history so they can see it go up.
// Workouts they log count too: an exercise's max is the better of what they entered and what they've
// logged (shared/fit.ts records). Weights are kept in kilograms so changing lb/kg never changes a max.
// A max also fills in the weight for an exercise they haven't done in Cooked yet (FitTrain planned()).
import { CATALOG_BY_ID, e1rm, fromKg, records, round, type Units, type Workout } from "./fit";

/** One max, as entered. reps 1 is a true one-rep max; more reps is "this weight for this many reps".
 *  kg 0 with reps is a bodyweight max (most push-ups, pull-ups). secs is a timed max (longest plank). */
export type MaxEntry = { id: string; exId: string; name: string; kg: number; reps: number; secs?: number; date: string; note?: string };

const str = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const num = (v: unknown, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const MAX_LIMIT = 600;

export function cleanMaxes(raw: unknown): MaxEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((m: any) => m && m.id && m.exId && DAY.test(String(m.date))).slice(-MAX_LIMIT).map((m: any): MaxEntry => ({
    id: str(m.id, 40), exId: str(m.exId, 80), name: str(m.name, 80) || str(m.exId, 80), kg: num(m.kg, 0, 1000), reps: Math.round(num(m.reps, 0, 1000)),
    ...(m.secs ? { secs: Math.round(num(m.secs, 1, 36000)) } : {}), date: String(m.date), ...(m.note ? { note: str(m.note, 200) } : {}),
  })).filter((m) => m.kg > 0 || m.reps > 0 || (m.secs ?? 0) > 0);
}

/** How strong an entry is, to compare entries for the same exercise: estimated one-rep max for weights,
 *  reps for bodyweight, seconds for timed. */
export const strength = (m: Pick<MaxEntry, "kg" | "reps" | "secs">) => (m.secs ? m.secs : m.kg > 0 ? (m.reps <= 1 ? m.kg : e1rm(m.kg, Math.min(m.reps, 12)) || m.kg) : m.reps);

export type MaxRow = {
  exId: string; name: string;
  /** Where the max shown comes from: one they entered, or their best set in a logged workout. */
  source: "entered" | "logged";
  /** The day the max shown was set (entered, or the workout it came from). */
  date: string;
  /** Their newest entry, and the best they've entered. */
  latest?: MaxEntry; best?: MaxEntry;
  /** Their best from logged workouts (in their units, like the workouts), if any. */
  logged?: { weight: number; reps: number; e1rm: number; date: string };
  /** The estimated one-rep max to train from, in their units (0 for bodyweight or timed). */
  oneRm: number;
  history: MaxEntry[];
};

/** Every exercise they have a max for, from what they entered and from every workout they've logged
 *  (nothing to copy over by hand), the most recently changed first. */
export function maxRows(entries: MaxEntry[], workouts: Workout[], units: Units): MaxRow[] {
  const byEx = new Map<string, MaxEntry[]>();
  for (const m of entries) byEx.set(m.exId, [...(byEx.get(m.exId) ?? []), m]);
  const logged = records(workouts);
  const names = new Map<string, string>();
  for (const w of workouts) for (const e of w.exercises) names.set(e.exId, e.name);
  const rows: MaxRow[] = [];
  for (const exId of new Set([...byEx.keys(), ...[...logged].filter(([, b]) => b.weight > 0).map(([id]) => id)])) {
    const list = byEx.get(exId) ?? [];
    const history = [...list].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const best = list.length ? [...list].sort((a, b) => strength(b) - strength(a))[0] : undefined;
    const l = logged.get(exId);
    const entered = best && best.kg > 0 ? fromKg(strength(best), units) : 0;
    const fromLog = !!l && l.e1rm > 0 && (!best || (best.kg > 0 && l.e1rm > entered + 0.01));
    rows.push({
      exId, name: history[0]?.name || names.get(exId) || CATALOG_BY_ID.get(exId)?.name || exId,
      source: fromLog ? "logged" : "entered",
      date: (fromLog ? l!.date : history[0]?.date || l?.date || "").slice(0, 10),
      latest: history[0], best, history,
      ...(l && l.e1rm > 0 ? { logged: { weight: l.weight, reps: l.reps, e1rm: l.e1rm, date: l.date } } : {}),
      oneRm: Math.max(entered, l?.e1rm ?? 0),
    });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

/** "Max over time" for one exercise: for every day it was logged or a max was entered, the best estimated
 *  one-rep max that day (`day`) and the best so far (`best`, which only goes up), in their units. Bodyweight
 *  and timed maxes count reps and seconds. `gain` is how far the best has gone up since the first point. */
export function maxTimeline(exId: string, entries: MaxEntry[], workouts: Workout[], units: Units): { points: { date: string; day: number; best: number }[]; gain: number } {
  const byDay = new Map<string, number>();
  const put = (date: string, v: number) => { const d = date.slice(0, 10); if (v > 0 && /^\d{4}-\d{2}-\d{2}$/.test(d)) byDay.set(d, Math.max(byDay.get(d) ?? 0, v)); };
  for (const m of entries) if (m.exId === exId) put(m.date, m.kg > 0 ? fromKg(strength(m), units) : strength(m));
  for (const w of workouts) for (const e of w.exercises) {
    if (e.exId !== exId) continue;
    for (const s of e.sets) if (s.done && !s.warm && s.reps > 0 && s.weight > 0) put(w.date, e1rm(s.weight, s.reps) || s.weight);
  }
  let best = 0;
  const points = [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([date, day]) => { best = Math.max(best, day); return { date, day: round(day, 0.1), best: round(best, 0.1) }; });
  return { points, gain: points.length > 1 ? round(points[points.length - 1].best - points[0].best, 0.1) : 0 };
}

/** Exercises they've logged a best on but haven't entered a max for: one tap adds it. */
export function loggedOnly(entries: MaxEntry[], workouts: Workout[]): { exId: string; name: string; weight: number; reps: number; date: string }[] {
  const have = new Set(entries.map((m) => m.exId));
  const names = new Map<string, string>();
  for (const w of workouts) for (const e of w.exercises) names.set(e.exId, e.name);
  return [...records(workouts)].filter(([id, b]) => !have.has(id) && b.weight > 0).map(([exId, b]) => ({ exId, name: names.get(exId) || CATALOG_BY_ID.get(exId)?.name || exId, weight: b.weight, reps: b.reps, date: b.date }))
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
}

/** The best one-rep max (their units) for an exercise from what they entered, or 0. */
export function enteredOneRm(entries: MaxEntry[], exId: string, units: Units): number {
  const kgs = entries.filter((m) => m.exId === exId && m.kg > 0).map(strength);
  return kgs.length ? fromKg(Math.max(...kgs), units) : 0;
}

/** A working weight for a number of reps from a one-rep max (Epley, the other way round), at 90% so
 *  the last rep is hard but clean, rounded to what the plates make. */
export function workingWeight(oneRm: number, reps: number, units: Units): number {
  if (oneRm <= 0) return 0;
  const r = Math.max(1, Math.min(reps, 15));
  const w = r === 1 ? oneRm * 0.9 : (oneRm / (1 + r / 30)) * 0.9;
  return round(w, units === "kg" ? 2.5 : 5);
}

/** A percent of a max, rounded to the plates ("70% of your max"). */
export const percentOf = (oneRm: number, pct: number, units: Units) => round((oneRm * pct) / 100, units === "kg" ? 2.5 : 5);
