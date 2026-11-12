// Cooked "Finish your day" checklist: a short list built from a person's own goals (calories, training,
// water, steps, weigh-ins, sleep, fasting, medicines). Each item ticks itself when the thing was tracked,
// and can be ticked by hand when it was done another way. A day is finished when every item is ticked.
// The card is client/src/pages/fit/FitChecklist.tsx; the hand ticks are kept in FitData.checks (shared/fit.ts).

import { dayKey, type FitData, type Meal } from "./fit";
import type { FitAppId } from "./fitApps";

export type CheckIcon = "food" | "workout" | "water" | "steps" | "weight" | "sleep" | "fast" | "meds";
export type CheckItem = {
  id: string; icon: CheckIcon; label: string; detail: string;
  /** Ticked because it was tracked. */
  auto: boolean;
  /** Ticked by hand. */
  hand: boolean;
  done: boolean;
  /** The Cooked app where it gets tracked. */
  app: FitAppId;
};
export type DayChecklist = { date: string; items: CheckItem[]; done: number; total: number; complete: boolean };

export const CHECKS_LIMIT = { days: 400, perDay: 12 };
const MEALS: Meal[] = ["breakfast", "lunch", "dinner"];
const isWorkout = (w: FitData["workouts"][number]) => w.programId !== "session-meditation";
const keyOf = (d: Date) => dayKey(d);
const addDays = (date: string, n: number) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + n); return keyOf(d); };
const dow = (date: string) => new Date(`${date}T12:00:00`).getDay();
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** The checklist for one day. `steps` is that day's step count when Apple Health is connected (null = not connected). */
export function dayChecklist(data: FitData, date: string, steps: number | null = null): DayChecklist {
  const hand = new Set(data.checks?.[date] ?? []);
  const items: CheckItem[] = [];
  const add = (id: string, icon: CheckItem["icon"], label: string, detail: string, auto: boolean, app: FitAppId) => {
    const byHand = hand.has(id);
    items.push({ id, icon, label, detail, auto, hand: byHand, done: auto || byHand, app });
  };
  const p = data.profile;

  // Food: breakfast, lunch and dinner (two when they fast), worded by what the goal is.
  const foods = data.foods.filter((f) => f.date === date);
  const meals = MEALS.filter((m) => foods.some((f) => f.meal === m)).length;
  const kcal = Math.round(foods.reduce((n, f) => n + f.kcal * f.servings, 0));
  const fasts = !!(data.fasting && (data.fasting.start || data.fasting.log.length));
  const need = fasts ? 2 : 3;
  const goalWord = p.goal === "lose" ? "Log your food and stay near your calorie goal" : p.goal === "gain" ? "Log your meals and reach your calorie goal" : "Log your meals";
  const kcalText = p.kcalGoal ? ` · ${fmt(kcal)} of ${fmt(p.kcalGoal)} cal` : kcal ? ` · ${fmt(kcal)} cal` : "";
  add("food", "food", goalWord, `${Math.min(meals, 3)} of ${need} meals logged${kcalText}`, meals >= need, "food");

  // Training: when they follow a program or have trained lately.
  const trainedToday = data.workouts.some((w) => isWorkout(w) && keyOf(new Date(w.date)) === date);
  const since = addDays(date, -14);
  const lately = data.workouts.some((w) => isWorkout(w) && keyOf(new Date(w.date)) >= since && keyOf(new Date(w.date)) <= date);
  if (data.program || lately || trainedToday) add("workout", "workout", "Train, or log a rest day", trainedToday ? "Workout logged" : "Tick it if today is a rest day", trainedToday, "train");

  // Water
  const water = data.water[date] ?? 0;
  add("water", "water", "Reach your water goal", `${fmt(water)} of ${fmt(p.waterGoalMl)} ml`, water >= p.waterGoalMl, "water");

  // Steps: only with Apple Health connected, which is where the count comes from.
  if (steps != null) add("steps", "steps", `Hit ${fmt(p.stepsGoal)} steps`, `${fmt(steps)} so far`, steps >= p.stepsGoal, "steps");

  // Weigh-in: with a goal weight, until they have weighed in this week.
  if (p.goalKg) {
    const weighedToday = data.weights.some((w) => w.date === date);
    const lastWeek = data.weights.some((w) => w.date >= addDays(date, -6) && w.date <= date);
    if (weighedToday || !lastWeek) add("weight", "weight", "Weigh in", weighedToday ? "Weight logged" : "Not weighed in for a week", weighedToday, "food");
  }

  // Sleep: when they track it, last night's counts (a night is kept under the day they woke up).
  if (data.sleep) {
    const slept = data.sleep.nights.some((n) => n.date === date);
    add("sleep", "sleep", "Log last night's sleep", slept ? "Sleep logged" : "Not logged yet", slept, "sleep");
  }

  // Fasting: when they use it, a fast that ended today and reached its goal.
  if (fasts) {
    const done = (data.fasting?.log ?? []).some((f) => keyOf(new Date(f.end)) === date && new Date(f.end).getTime() - new Date(f.start).getTime() >= f.goalH * 3_600_000 - 60_000);
    add("fast", "fast", "Finish your fast", done ? "Fast completed" : data.fasting?.start ? "Fast in progress" : "No fast logged", done, "fast");
  }

  // Medicines: every dose due that day taken or skipped.
  const due = (data.meds?.list ?? []).filter((m) => m.days.includes(dow(date))).flatMap((m) => m.times.map((t) => `${m.id}@${t}`));
  if (due.length) {
    const log = data.meds?.log[date] ?? {};
    const handled = due.filter((k) => log[k]).length;
    add("meds", "meds", "Take your medicines", `${handled} of ${due.length} doses`, handled >= due.length, "meds");
  }

  const done = items.filter((i) => i.done).length;
  return { date, items, done, total: items.length, complete: items.length > 0 && done === items.length };
}

/** Days in a row, ending today (or yesterday while today is unfinished), where every item was ticked. Past days
 *  are judged without steps, which are only known for today. */
export function checklistStreak(data: FitData, today: string, todayComplete: boolean): number {
  let n = todayComplete ? 1 : 0;
  for (let i = 1; i <= 60; i++) {
    if (!dayChecklist(data, addDays(today, -i)).complete) break;
    n++;
  }
  return n;
}

/** Hand ticks, cleaned for keeping: real days, short ids, a year of days at most. */
export function cleanChecks(raw: unknown): Record<string, string[]> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Record<string, string[]> = {};
  const days = Object.keys(raw as object).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort().slice(-CHECKS_LIMIT.days);
  for (const k of days) {
    const v = (raw as Record<string, unknown>)[k];
    const ids = [...new Set((Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string" && /^[a-z]{2,12}$/.test(x)))].slice(0, CHECKS_LIMIT.perDay);
    if (ids.length) out[k] = ids;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Ticks or unticks one item by hand for a day. */
export function toggleCheck(data: FitData, date: string, id: string): FitData {
  const mine = new Set(data.checks?.[date] ?? []);
  if (mine.has(id)) mine.delete(id); else mine.add(id);
  const checks = { ...(data.checks ?? {}) };
  if (mine.size) checks[date] = [...mine]; else delete checks[date];
  return { ...data, checks: cleanChecks(checks) };
}
