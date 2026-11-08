// Arise Fit: vacation mode. Plan a trip and the app plans around it: what to do about workouts while
// you're away (keep them short, use the hotel gym, or rest) and how to make up what you miss with
// slightly longer workouts before you leave and after you're back; and the food side: eat a little less
// in the days before so the trip doesn't set you back, then ease back after if you went over.
//
// Everything is gentle on purpose: calories never drop more than 15% a day, never below a safe floor,
// and the trip budget is only what was actually banked.
import { dayKey, goals, type FitData, type FitExercise, type Profile } from "./fit";
import { cleanGym, type MyGym } from "./fitGym";

export type Commit = "train" | "light" | "rest";
export type Vacation = {
  start: string; end: string; place?: string;
  /** Where you'll train on the trip (a hotel gym, a bodyweight routine, ...). */
  gym?: MyGym;
  /** "train": keep close to your normal week; "light": short sessions; "rest": a proper break. */
  commit: Commit;
  /** Length of a trip workout, in minutes. */
  mins: number;
  /** Trip workouts per week. */
  perWeek: number;
  /** Longer workouts before you leave and after you're back, to cover what the trip skips. */
  makeUp: boolean;
  leadDays: number;
  backDays: number;
  food: { bank: boolean; extra: number };
};

const DAY = 86_400_000;
const num = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d; };
const day = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : "";
const at = (k: string) => new Date(`${k}T12:00:00`);
const addDays = (k: string, n: number) => { const d = at(k); d.setDate(d.getDate() + n); return dayKey(d); };
const between = (a: string, b: string) => Math.round((at(b).getTime() - at(a).getTime()) / DAY);

export const DEFAULT_VACATION = (start: string, end: string): Vacation => ({ start, end, commit: "light", mins: 25, perWeek: 3, makeUp: true, leadDays: 7, backDays: 7, food: { bank: true, extra: 400 } });

export function cleanVacation(raw: any): Vacation | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const start = day(raw.start), end = day(raw.end);
  if (!start || !end || end < start || between(start, end) > 120) return undefined;
  const gym = cleanGym(raw.gym);
  return {
    start, end, ...(raw.place ? { place: String(raw.place).slice(0, 60) } : {}), ...(gym ? { gym } : {}),
    commit: raw.commit === "train" || raw.commit === "rest" ? raw.commit : "light",
    mins: num(raw.mins, 5, 90, 25), perWeek: num(raw.perWeek, 0, 7, 3), makeUp: raw.makeUp !== false,
    leadDays: num(raw.leadDays, 1, 14, 7), backDays: num(raw.backDays, 1, 14, 7),
    food: { bank: raw.food?.bank !== false, extra: num(raw.food?.extra, 0, 1500, 400) },
  };
}

export const tripDays = (v: Vacation) => between(v.start, v.end) + 1;

export type Phase = { phase: "none" | "before" | "during" | "after"; /** days until the trip starts (before), or day of the trip (during), or days since it ended (after) */ n: number };
export function vacationPhase(v: Vacation | undefined, today = dayKey()): Phase {
  if (!v) return { phase: "none", n: 0 };
  if (today >= v.start && today <= v.end) return { phase: "during", n: between(v.start, today) + 1 };
  if (today < v.start && today >= addDays(v.start, -v.leadDays)) return { phase: "before", n: between(today, v.start) };
  if (today > v.end && today <= addDays(v.end, v.backDays)) return { phase: "after", n: between(v.end, today) };
  return { phase: "none", n: 0 };
}
/** True once the trip and the days after it are over, so the plan can be put away. */
export const vacationOver = (v: Vacation, today = dayKey()) => today > addDays(v.end, v.backDays);

/** Workouts in a normal week: the program's, or what the last four weeks looked like. */
export function normalPerWeek(data: Pick<FitData, "workouts" | "program">, programDays?: number, now = Date.now()): number {
  if (programDays) return programDays;
  const since = now - 28 * DAY;
  const n = data.workouts.filter((w) => Date.parse(w.date) >= since).length;
  return Math.min(6, Math.max(2, Math.round(n / 4) || 3));
}

export type Plan = {
  days: number; normal: number; planned: number; missed: number;
  /** Extra minutes added to each normal workout in the days before and after. 0 when the trip costs nothing. */
  extraMins: number; sessionsBefore: number; sessionsAfter: number;
};
export function workoutPlan(v: Vacation, normal: number, baseMins = 45): Plan {
  const days = tripDays(v);
  const planned = v.commit === "rest" ? 0 : Math.round((v.perWeek * days) / 7);
  const missed = Math.max(0, Math.round((normal * days) / 7) - planned);
  const sessionsBefore = Math.max(0, Math.round((normal * v.leadDays) / 7)), sessionsAfter = Math.max(0, Math.round((normal * v.backDays) / 7));
  const sessions = sessionsBefore + sessionsAfter;
  // Make up about 60% of the lost time: the rest is a well-earned break.
  const extraMins = v.makeUp && missed > 0 && sessions > 0 ? Math.min(20, Math.max(5, Math.round(((missed * baseMins * 0.6) / sessions) / 5) * 5)) : 0;
  return { days, normal, planned, missed, extraMins, sessionsBefore, sessionsAfter };
}

// ——— Food ————————————————————————————————————————————————————————————————————

const floorKcal = (p: Pick<Profile, "sex">) => (p.sex === "m" ? 1500 : p.sex === "f" ? 1200 : 1300);
export type FoodPlan = { base: number; cutPerDay: number; banked: number; tripPerDay: number; wanted: number; capped: boolean };
/** Before: a small cut each day. During: the banked calories shared across the trip. */
export function foodPlan(v: Vacation, base: number, p: Pick<Profile, "sex">): FoodPlan {
  const days = tripDays(v);
  const wanted = v.food.bank ? v.food.extra * days : 0;
  const room = Math.max(0, Math.min(base * 0.15, base - floorKcal(p)));
  const cutPerDay = v.food.bank ? Math.round(Math.min(wanted / v.leadDays, room)) : 0;
  const banked = cutPerDay * v.leadDays;
  return { base, cutPerDay, banked, tripPerDay: days ? Math.round(banked / days) : 0, wanted, capped: banked + 1 < wanted };
}

/** How far over the trip budget the logged days went (calories). */
export function tripOverage(data: Pick<FitData, "foods">, v: Vacation, budgetPerDay: number): number {
  let over = 0;
  for (let i = 0; i < tripDays(v); i++) {
    const k = addDays(v.start, i);
    const eaten = data.foods.filter((f) => f.date === k).reduce((t, f) => t + f.kcal * f.servings, 0);
    if (eaten > 0) over += Math.max(0, eaten - budgetPerDay);
  }
  return Math.round(over);
}

/** The day's goals with the vacation plan applied (a small cut before, the banked budget on the trip, an easing back after). */
export function dayGoals(data: FitData, kg: number | undefined, date = new Date()) {
  const g = goals(data.profile, kg, date);
  const v = data.vacation;
  const out = { ...g, adj: 0, note: "" };
  if (!v || !v.food.bank) return out;
  const { phase } = vacationPhase(v, dayKey(date));
  if (phase === "none") return out;
  const fp = foodPlan(v, g.kcal, data.profile);
  let adj = 0, note = "";
  if (phase === "before") { adj = -fp.cutPerDay; note = adj ? `Trip prep: ${adj} cal a day so you can enjoy the trip` : ""; }
  else if (phase === "during") { adj = fp.tripPerDay; note = adj ? `Vacation budget: +${adj} cal a day, banked before you left` : "On vacation"; }
  else {
    const over = tripOverage(data, v, g.kcal + fp.tripPerDay);
    const room = Math.max(0, Math.min(g.kcal * 0.1, g.kcal - floorKcal(data.profile)));
    adj = -Math.round(Math.min(over / v.backDays, room));
    note = adj ? `Easing back: ${adj} cal a day for ${v.backDays} days` : "";
  }
  if (!adj) return { ...out, note };
  const kcal = g.kcal + adj, r = kcal / g.kcal;
  // Protein stays put; carbs and fat take the change.
  return { ...g, kcal, c: Math.round(g.c * r), f: Math.round(g.f * r), adj, note };
}

// ——— Splitting a workout across the day ————————————————————————————————————————

/** What's left of a workout saved part-way, to finish later. */
export type SplitLeft = { name: string; programId?: string; dayId?: string; part: number; date: string; exercises: FitExercise[] };
export function cleanSplit(raw: any): SplitLeft | undefined {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.exercises) || !raw.exercises.length) return undefined;
  const ex = raw.exercises.slice(0, 30).map((e: any): FitExercise => ({
    exId: String(e?.exId ?? "").slice(0, 80), name: String(e?.name ?? "").slice(0, 80),
    sets: (Array.isArray(e?.sets) ? e.sets : []).slice(0, 30).map((s: any) => ({ reps: num(s?.reps, 0, 1000, 0), weight: Math.min(2000, Math.max(0, Number(s?.weight) || 0)), done: false, ...(s?.warm ? { warm: true } : {}) })),
    ...(e?.rest ? { rest: num(e.rest, 0, 900, 90) } : {}), ...(e?.target ? { target: String(e.target).slice(0, 12) } : {}),
  })).filter((e: FitExercise) => e.exId && e.sets.length);
  if (!ex.length) return undefined;
  return { name: String(raw.name ?? "Workout").slice(0, 60), ...(raw.programId ? { programId: String(raw.programId).slice(0, 40), dayId: String(raw.dayId ?? "").slice(0, 40) } : {}), part: num(raw.part, 2, 20, 2), date: day(raw.date) || dayKey(), exercises: ex };
}
