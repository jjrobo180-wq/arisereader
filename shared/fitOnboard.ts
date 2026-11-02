// The numbers behind Arise Fit's first-open setup: feet and inches, how fast to reach a goal weight, and
// what that means in calories. Pure, so it's tested.
import { goals, type Profile } from "./fit";
import { pointsBudget } from "./fitNutrition";

export const IN_PER_CM = 1 / 2.54;
/** 5 ft 9 in → cm. */
export const ftInToCm = (ft: number, inch: number) => Math.round((Math.max(0, ft) * 12 + Math.max(0, inch)) * 2.54);
/** cm → { ft, inch } (inches rounded; 12 rolls into a foot). */
export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const total = Math.round(cm / 2.54);
  return { ft: Math.floor(total / 12), inch: total % 12 };
}

export type Pace = { id: string; name: string; kgPerWeek: number; blurb: string };
export const PACES: Record<"lose" | "gain", Pace[]> = {
  lose: [
    { id: "easy", name: "Easy", kgPerWeek: 0.25, blurb: "About ½ lb a week. Gentle and easy to keep up." },
    { id: "steady", name: "Steady", kgPerWeek: 0.5, blurb: "About 1 lb a week. The sweet spot for most people." },
    { id: "fast", name: "Faster", kgPerWeek: 0.75, blurb: "About 1½ lb a week. Takes real discipline." },
    { id: "max", name: "Aggressive", kgPerWeek: 1, blurb: "About 2 lb a week. Short stretches only." },
  ],
  gain: [
    { id: "lean", name: "Lean bulk", kgPerWeek: 0.25, blurb: "About ½ lb a week. Mostly muscle, little fat." },
    { id: "steady", name: "Steady", kgPerWeek: 0.5, blurb: "About 1 lb a week. Faster growth with some fat." },
  ],
};
export const defaultPace = (goal: "lose" | "gain") => PACES[goal][1].kgPerWeek;

/** Whole weeks to get from `fromKg` to `toKg` at `pace` kg a week (null when it doesn't apply). */
export function weeksToGoal(fromKg: number, toKg: number, pace: number): number | null {
  if (!(fromKg > 0) || !(toKg > 0) || !(pace > 0)) return null;
  return Math.max(0, Math.ceil(Math.abs(fromKg - toKg) / pace));
}
/** The date that lands on (today + weeks). */
export const finishDate = (weeks: number, today = new Date()) => { const d = new Date(today); d.setDate(d.getDate() + weeks * 7); return d; };

/** Does the chosen goal weight point the way the goal says (lose → lower, gain → higher)? */
export function goalWeightFits(goal: Profile["goal"], fromKg: number, toKg: number): boolean {
  if (goal === "maintain") return true;
  return goal === "lose" ? toKg < fromKg : toKg > fromKg;
}

/** The plan a finished setup gives: calories, macros and the Arise Points budget. */
export function planFor(p: Profile, kg: number | undefined, today = new Date()) {
  const g = goals(p, kg, today);
  return { ...g, points: pointsBudget(g) };
}
