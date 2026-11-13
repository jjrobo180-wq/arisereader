// Cooked apps: the parts of Cooked you choose, like the apps in Arise To Duo. Each person keeps a
// list of the apps they've added (they show on the Apps tab) and up to three of them on the tab bar,
// next to Today and Apps. Saved with the rest of their Cooked data (shared/fit.ts), so it's the
// same on every device. The screens are in client/src/pages/fit/FitApps.tsx.

export type FitAppId =
  | "train" | "food" | "fast" | "run" | "sleep" | "yoga" | "mind" | "hiit" | "c25k" | "mobility" | "water" | "steps"
  | "recovery" | "progress" | "coach" | "friends" | "gyms" | "recipes" | "eat" | "travel" | "form" | "scan" | "sounds" | "counter" | "pillow" | "meds" | "period";
export type FitAppCategory = "train" | "mind" | "nutrition" | "health" | "out" | "social";
export type FitApp = {
  id: FitAppId; name: string; blurb: string; category: FitAppCategory;
  /** A lucide icon name (client/src/pages/fit/FitApps.tsx maps it). */
  icon: string;
  /** The tile's two colors, top-left to bottom-right. */
  tile: [string, string];
  /** Can sit on the tab bar (it has a full screen of its own). */
  tab: boolean;
  plus?: boolean;
};

export const FIT_APP_CATEGORIES: { id: FitAppCategory; name: string }[] = [
  { id: "train", name: "Training" },
  { id: "mind", name: "Mind & body" },
  { id: "nutrition", name: "Nutrition" },
  { id: "health", name: "Health" },
  { id: "out", name: "Out & about" },
  { id: "social", name: "Together" },
];

export const FIT_APPS: FitApp[] = [
  { id: "train", name: "Train", blurb: "Strength programs, routines, the exercise library and live workouts.", category: "train", icon: "Dumbbell", tile: ["#ff7a3d", "#c2410c"], tab: true },
  { id: "hiit", name: "Intervals", blurb: "HIIT treadmill sessions and a custom interval timer for any workout.", category: "train", icon: "Zap", tile: ["#fb7185", "#be123c"], tab: true },
  { id: "c25k", name: "Couch to 5K", blurb: "Nine weeks from zero to running 30 minutes, three short runs a week.", category: "train", icon: "Medal", tile: ["#fbbf24", "#d97706"], tab: true },
  { id: "form", name: "Form check", blurb: "The camera watches your squat, push-up or lunge and coaches each rep.", category: "train", icon: "ScanFace", tile: ["#a78bfa", "#6d28d9"], tab: false },
  { id: "scan", name: "Scan a machine", blurb: "Point the camera at gym equipment to learn how to use it.", category: "train", icon: "ScanLine", tile: ["#94a3b8", "#475569"], tab: false },
  { id: "yoga", name: "Yoga", blurb: "Guided flows for mornings, recovery, flexibility and bedtime, with a pose for every step.", category: "mind", icon: "Flower2", tile: ["#c084fc", "#7e22ce"], tab: true },
  { id: "mind", name: "Breathe", blurb: "Box breathing, 4-7-8, calm-down and focus sessions, plus guided meditation.", category: "mind", icon: "Wind", tile: ["#5eead4", "#0f766e"], tab: true },
  { id: "mobility", name: "Mobility", blurb: "Stretch routines for hips, back, shoulders and desk days, timed for you.", category: "mind", icon: "PersonStanding", tile: ["#86efac", "#15803d"], tab: true },
  { id: "pillow", name: "Pillow tracking", blurb: "Phone under your pillow measures your sleep and wakes you in your lightest moment.", category: "health", icon: "Bed", tile: ["#a5b4fc", "#4338ca"], tab: false, plus: true },
  { id: "sounds", name: "Sleep sounds", blurb: "Rain, ocean, fan and noise that fade out on a timer.", category: "health", icon: "Waves", tile: ["#7dd3fc", "#1e3a8a"], tab: false, plus: true },
  { id: "counter", name: "Counter & timer", blurb: "Tap to count breaths, rounds or mantras, or sit with a quiet timer and bell.", category: "mind", icon: "CircleDot", tile: ["#fda4af", "#9f1239"], tab: false },
  { id: "sleep", name: "Sleep", blurb: "Tracked from Apple Health, your bedtime schedule or one tap, with a nightly sleep score.", category: "health", icon: "Moon", tile: ["#818cf8", "#3730a3"], tab: true },
  { id: "meds", name: "Medicine tracker", blurb: "Medicines and vitamins with dose reminders, today's doses to tick off and a heads-up before they run out.", category: "health", icon: "Pill", tile: ["#2dd4bf", "#0f766e"], tab: true },
  { id: "period", name: "Period tracker", blurb: "Log your period and symptoms, see your cycle day and when the next period and fertile window are likely.", category: "health", icon: "CalendarHeart", tile: ["#f472b6", "#be185d"], tab: true },
  { id: "recovery", name: "Recovery", blurb: "Today's readiness from your sleep and training, and a map of which muscles are fresh.", category: "health", icon: "HeartPulse", tile: ["#f87171", "#b91c1c"], tab: true },
  { id: "steps", name: "Steps", blurb: "Daily steps from Apple Health, your goal and your week.", category: "health", icon: "Footprints", tile: ["#4ade80", "#166534"], tab: true },
  { id: "water", name: "Water", blurb: "Log glasses and bottles in a tap and see how close you are to your goal.", category: "health", icon: "Droplets", tile: ["#60a5fa", "#1d4ed8"], tab: true },
  { id: "progress", name: "Progress", blurb: "Volume, sets per muscle, calories, records and weight over time.", category: "health", icon: "BarChart3", tile: ["#38bdf8", "#0369a1"], tab: true },
  { id: "food", name: "Food", blurb: "Calories or Arise Points, macros, meal photos and barcode scans.", category: "nutrition", icon: "Apple", tile: ["#a3e635", "#4d7c0f"], tab: true },
  { id: "fast", name: "Fasting", blurb: "Intermittent fasting timers with your plan, streaks and history.", category: "nutrition", icon: "Timer", tile: ["#fdba74", "#c2410c"], tab: true },
  { id: "recipes", name: "Recipes", blurb: "Meals that fit what you have left to eat today.", category: "nutrition", icon: "ChefHat", tile: ["#fca5a5", "#dc2626"], tab: false },
  { id: "eat", name: "Eat out", blurb: "What to order at restaurants near you to stay on plan.", category: "nutrition", icon: "Utensils", tile: ["#f9a8d4", "#be185d"], tab: false, plus: true },
  { id: "run", name: "Run", blurb: "GPS runs, walks and hikes, and trails near you.", category: "out", icon: "Route", tile: ["#fb923c", "#9a3412"], tab: true },
  { id: "gyms", name: "Gyms near me", blurb: "Gyms around you with prices and how busy they are.", category: "out", icon: "MapPin", tile: ["#67e8f9", "#0e7490"], tab: false, plus: true },
  { id: "travel", name: "Travel mode", blurb: "Plan training and eating around a trip.", category: "out", icon: "Plane", tile: ["#7dd3fc", "#0284c7"], tab: false },
  { id: "coach", name: "Coach", blurb: "Work with a personal trainer: plans, check-ins and messages.", category: "social", icon: "UserCheck", tile: ["#fde047", "#a16207"], tab: false },
  { id: "friends", name: "Friends", blurb: "Your workout circle and your workout buddy.", category: "social", icon: "Users", tile: ["#f0abfc", "#a21caf"], tab: true },
];
export const FIT_APP_BY_ID = new Map(FIT_APPS.map((a) => [a.id, a]));
const IDS = new Set<string>(FIT_APPS.map((a) => a.id));

export type FitApps = { added: FitAppId[]; tabs: FitAppId[] };
export const TAB_MAX = 3;
/** What a new person starts with: the main parts of Cooked, and Train, Food and Run on the tab bar. */
export const defaultApps = (): FitApps => ({ added: ["train", "food", "run", "fast", "sleep", "recovery", "yoga", "mind", "water", "progress", "recipes", "friends"], tabs: ["train", "food", "run"] });

/** Known apps only, no repeats; tabs must be added and able to be tabs. */
export function cleanApps(raw: any): FitApps | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const list = (v: unknown) => [...new Set((Array.isArray(v) ? v : []).map(String).filter((x) => IDS.has(x)))] as FitAppId[];
  const added = list(raw.added).slice(0, FIT_APPS.length);
  const tabs = list(raw.tabs).filter((t) => added.includes(t) && FIT_APP_BY_ID.get(t)!.tab).slice(0, TAB_MAX);
  return { added, tabs };
}
export const appsOf = (a: FitApps | undefined): FitApps => a ?? defaultApps();

export function addApp(a: FitApps | undefined, id: FitAppId): FitApps {
  const x = appsOf(a);
  return x.added.includes(id) ? x : { ...x, added: [...x.added, id] };
}
/** Removing an app also takes it off the tab bar. */
export function removeApp(a: FitApps | undefined, id: FitAppId): FitApps {
  const x = appsOf(a);
  return { added: x.added.filter((y) => y !== id), tabs: x.tabs.filter((y) => y !== id) };
}
/** Puts an app on the tab bar (adding it if needed) or takes it off. A full tab bar swaps out its last tab. */
export function toggleTab(a: FitApps | undefined, id: FitAppId): FitApps {
  const x = addApp(a, id);
  if (!FIT_APP_BY_ID.get(id)?.tab) return x;
  if (x.tabs.includes(id)) return { ...x, tabs: x.tabs.filter((y) => y !== id) };
  const tabs = x.tabs.length >= TAB_MAX ? [...x.tabs.slice(0, TAB_MAX - 1), id] : [...x.tabs, id];
  return { ...x, tabs };
}
/** Moves a tab one place left (-1) or right (+1). */
export function moveTab(a: FitApps | undefined, id: FitAppId, by: -1 | 1): FitApps {
  const x = appsOf(a), i = x.tabs.indexOf(id), j = i + by;
  if (i < 0 || j < 0 || j >= x.tabs.length) return x;
  const tabs = [...x.tabs]; [tabs[i], tabs[j]] = [tabs[j], tabs[i]];
  return { ...x, tabs };
}
