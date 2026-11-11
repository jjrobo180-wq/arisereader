// The numbers behind Cooked's first-open setup: feet and inches, how fast to reach a goal weight, and
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

// ─── "What do you want from Cooked?" ──────────────────────────────────────────────────────────
// A multi-select in first-open setup. Each pick adds its apps (shared/fitApps.ts) and the best of them go
// on the tab bar, so the app is set up the way the person said they'd use it.
import { FIT_APP_BY_ID, TAB_MAX, defaultApps, type FitAppId, type FitApps } from "./fitApps";

export type FeatureChoice = { id: string; title: string; sub: string; apps: FitAppId[]; /** The app that earns a tab if the person picks this. */ tab?: FitAppId };
export const FEATURE_CHOICES: FeatureChoice[] = [
  { id: "lift", title: "Workouts & strength", sub: "Programs, a live workout screen and an exercise library with videos.", apps: ["train", "form", "scan", "progress"], tab: "train" },
  { id: "food", title: "Track what I eat", sub: "Calories or points, macros, barcode and photo logging.", apps: ["food", "recipes"], tab: "food" },
  { id: "eatout", title: "Fast food & eating-out ideas", sub: "What to order at restaurants near you and still hit your goal.", apps: ["eat", "recipes", "food"], tab: "food" },
  { id: "sleep", title: "Sleep tracking", sub: "A nightly score, a bedtime plan, and tracking from your pillow or watch.", apps: ["sleep", "recovery"], tab: "sleep" },
  { id: "yoga", title: "Yoga & meditation", sub: "Guided flows, breathing, meditation and a simple counter.", apps: ["yoga", "mind", "mobility"], tab: "yoga" },
  { id: "run", title: "Running, hiking & walking", sub: "GPS runs, trails near you, Couch to 5K and steps.", apps: ["run", "c25k", "steps", "hiit"], tab: "run" },
  { id: "fast", title: "Intermittent fasting", sub: "Timers, streaks and your plan.", apps: ["fast", "water"], tab: "fast" },
  { id: "gyms", title: "Find gyms near me", sub: "Gyms around you with prices and how busy they are.", apps: ["gyms", "travel"] },
  { id: "friends", title: "Friends & a coach", sub: "Workout with a circle, a buddy, or a personal trainer.", apps: ["friends", "coach"], tab: "friends" },
];
const CORE: FitAppId[] = ["recipes", "water", "progress"];

/** The apps and tab bar for the features picked (in the order they were picked). Nothing picked → the usual start. */
export function appsForFeatures(picked: string[]): FitApps {
  const chosen = picked.map((id) => FEATURE_CHOICES.find((f) => f.id === id)).filter((f): f is FeatureChoice => !!f);
  if (!chosen.length) return defaultApps();
  const added = [...new Set<FitAppId>([...chosen.flatMap((f) => f.apps), ...CORE])].filter((id) => FIT_APP_BY_ID.has(id));
  const tabs = [...new Set<FitAppId>(chosen.map((f) => f.tab).filter((t): t is FitAppId => !!t && !!FIT_APP_BY_ID.get(t)?.tab))].slice(0, TAB_MAX);
  // Fewer than three picks that earn a tab: fill with Train and Food, then the rest of the apps that can sit on the bar.
  for (const t of ["train", "food", "run"] as FitAppId[]) if (tabs.length < TAB_MAX && !tabs.includes(t) && added.includes(t)) tabs.push(t);
  return { added, tabs };
}
