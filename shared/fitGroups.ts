// Health & Fitness inside Arise To Do (Nov 25, 2026): a few tabs, each a page of related parts with a switcher at the
// top, in place of one tab per part. Daily holds the everyday trackers; Food holds the diary, meal prep, the grocery
// list, recipes and eating out; Training, Yoga, Progress and Friends hold the rest. Every tab and every part can be
// switched off (Period starts off unless you'd added it) and the tabs put in order; saved with the person's fitness
// data (FitApps.groups), so it's the same on every device. The screens are in client/src/pages/fit/FitGroupPage.tsx.
import type { FitAppId } from "./fitApps";

/** A part of a tab: one of Cooked's apps, or a Food screen that isn't an app of its own (meal prep, grocery list). */
export type FitPartId = FitAppId | "prep" | "grocery";
export type FitGroupId = "g-daily" | "g-food" | "g-train" | "g-yoga" | "g-progress" | "g-friends";
export type FitPart = { id: FitPartId; label: string; icon: string; detail: string; plus?: boolean };
export type FitGroup = { id: FitGroupId; label: string; icon: string; detail: string; parts: FitPart[] };

export const FIT_GROUPS: FitGroup[] = [
  { id: "g-daily", label: "Daily", icon: "HeartPulse", detail: "Water, medicine, period, breathing, sleep and fasting", parts: [
    { id: "water", label: "Water", icon: "Droplets", detail: "Glasses and bottles toward your goal" },
    { id: "meds", label: "Medicine", icon: "Pill", detail: "Today's doses and refills" },
    { id: "period", label: "Period", icon: "CalendarHeart", detail: "Your cycle, symptoms and what's next" },
    { id: "mind", label: "Breathe", icon: "Wind", detail: "Breathing and meditation" },
    { id: "sleep", label: "Sleep", icon: "Moon", detail: "Last night and your sleep score" },
    { id: "fast", label: "Fasting", icon: "Timer", detail: "Your fasting timer and streak" },
    { id: "sounds", label: "Sleep sounds", icon: "Waves", detail: "Rain, ocean and fan on a timer", plus: true },
    { id: "pillow", label: "Pillow tracking", icon: "Bed", detail: "Smart alarm from your sleep", plus: true },
    { id: "counter", label: "Counter", icon: "CircleDot", detail: "Count breaths or rounds, or a quiet timer" },
  ] },
  { id: "g-food", label: "Food", icon: "Apple", detail: "Food diary, meal prep, grocery list, recipes and eating out", parts: [
    { id: "food", label: "Diary", icon: "Apple", detail: "What you've eaten today" },
    { id: "prep", label: "Meal prep", icon: "CalendarRange", detail: "Plan the week's meals" },
    { id: "grocery", label: "Grocery list", icon: "ShoppingCart", detail: "What to buy for your plan" },
    { id: "recipes", label: "Recipes", icon: "ChefHat", detail: "Meals that fit what's left today" },
    { id: "eat", label: "Eat out", icon: "Utensils", detail: "What to order to stay on plan", plus: true },
  ] },
  { id: "g-train", label: "Training", icon: "Dumbbell", detail: "Workouts, templates, maxes, intervals, 5K and runs", parts: [
    { id: "train", label: "Workouts", icon: "Dumbbell", detail: "Programs, routines and the exercise library" },
    { id: "templates", label: "Templates", icon: "ClipboardList", detail: "Your own workouts, ready to start" },
    { id: "maxes", label: "Maxes", icon: "Trophy", detail: "Your best on every lift" },
    { id: "hiit", label: "Intervals", icon: "Zap", detail: "HIIT and an interval timer" },
    { id: "c25k", label: "Couch to 5K", icon: "Medal", detail: "Nine weeks to 30 minutes" },
    { id: "run", label: "Run", icon: "Route", detail: "GPS runs, walks and trails" },
    { id: "form", label: "Form check", icon: "ScanFace", detail: "The camera coaches each rep" },
    { id: "scan", label: "Scan a machine", icon: "ScanLine", detail: "Learn any gym machine" },
    { id: "gyms", label: "Gyms near me", icon: "MapPin", detail: "Prices and how busy", plus: true },
    { id: "travel", label: "Travel mode", icon: "Plane", detail: "Train and eat around a trip" },
  ] },
  { id: "g-yoga", label: "Yoga", icon: "Flower2", detail: "Yoga flows and mobility stretches", parts: [
    { id: "yoga", label: "Yoga", icon: "Flower2", detail: "Guided flows with a pose for every step" },
    { id: "mobility", label: "Mobility", icon: "PersonStanding", detail: "Stretches for hips, back and desk days" },
  ] },
  { id: "g-progress", label: "Progress", icon: "BarChart3", detail: "Stats, recovery and steps", parts: [
    { id: "progress", label: "Stats", icon: "BarChart3", detail: "Volume, records, calories and weight" },
    { id: "recovery", label: "Recovery", icon: "HeartPulse", detail: "Today's readiness and fresh muscles" },
    { id: "steps", label: "Steps", icon: "Footprints", detail: "Daily steps and your week" },
  ] },
  { id: "g-friends", label: "Friends", icon: "Users", detail: "Your workout circle, buddy and coach", parts: [
    { id: "friends", label: "Friends", icon: "Users", detail: "Your circle and workout buddy" },
    { id: "coach", label: "Coach", icon: "UserCheck", detail: "Plans and check-ins with a trainer" },
  ] },
];
export const FIT_GROUP_BY_ID = new Map(FIT_GROUPS.map((g) => [g.id, g]));
const GROUP_IDS = new Set<string>(FIT_GROUPS.map((g) => g.id));
const PART_IDS = new Set<string>(FIT_GROUPS.flatMap((g) => g.parts.map((p) => p.id)));

/** Parts shown as a page inside their tab; the rest (camera, sounds, coach...) open over it from the tab's tools row. */
export const INLINE_PARTS = new Set<FitPartId>(["water", "meds", "period", "mind", "sleep", "fast", "food", "prep", "grocery", "recipes", "eat",
  "train", "templates", "maxes", "hiit", "c25k", "run", "yoga", "mobility", "progress", "recovery", "steps", "friends"]);

/** Which tab a part lives in. */
export function groupOf(part: string): FitGroupId | null {
  for (const g of FIT_GROUPS) if (g.parts.some((p) => p.id === part)) return g.id;
  return null;
}
export const isGroupId = (x: string): x is FitGroupId => GROUP_IDS.has(x);

export type FitGroupPrefs = { order: FitGroupId[]; off: FitGroupId[]; partsOff: FitPartId[] };
/** New: every tab on in the order above; Period off unless the person had added it. */
export function defaultGroupPrefs(added?: FitAppId[]): FitGroupPrefs {
  return { order: FIT_GROUPS.map((g) => g.id), off: [], partsOff: added?.includes("period") ? [] : ["period"] };
}
export function cleanGroupPrefs(raw: any): FitGroupPrefs | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const ids = (v: unknown, ok: Set<string>) => [...new Set((Array.isArray(v) ? v : []).map(String).filter((x) => ok.has(x)))];
  const order = ids(raw.order, GROUP_IDS) as FitGroupId[];
  for (const g of FIT_GROUPS) if (!order.includes(g.id)) order.push(g.id);
  return { order, off: ids(raw.off, GROUP_IDS) as FitGroupId[], partsOff: ids(raw.partsOff, PART_IDS) as FitPartId[] };
}
export const groupPrefsOf = (p: FitGroupPrefs | undefined, added?: FitAppId[]) => p ?? defaultGroupPrefs(added);

/** The tabs that are on, in order. */
export function groupsOn(p: FitGroupPrefs): FitGroup[] {
  return p.order.filter((id) => !p.off.includes(id)).map((id) => FIT_GROUP_BY_ID.get(id)!).filter((g) => partsOn(p, g).length > 0);
}
/** A tab's parts that are on. */
export const partsOn = (p: FitGroupPrefs, g: FitGroup): FitPart[] => g.parts.filter((x) => !p.partsOff.includes(x.id));

export function setGroupOn(p: FitGroupPrefs, id: FitGroupId, on: boolean): FitGroupPrefs {
  return { ...p, off: on ? p.off.filter((x) => x !== id) : [...new Set([...p.off, id])] };
}
export function setPartOn(p: FitGroupPrefs, id: FitPartId, on: boolean): FitGroupPrefs {
  return { ...p, partsOff: on ? p.partsOff.filter((x) => x !== id) : [...new Set([...p.partsOff, id])] };
}
/** Moves a tab one place earlier (-1) or later (+1) among the tabs that are on. */
export function moveGroup(p: FitGroupPrefs, id: FitGroupId, by: -1 | 1): FitGroupPrefs {
  const on = p.order.filter((x) => !p.off.includes(x));
  const i = on.indexOf(id), j = i + by;
  if (i < 0 || j < 0 || j >= on.length) return p;
  const swap = on[j];
  return { ...p, order: p.order.map((x) => (x === id ? swap : x === swap ? id : x)) };
}
