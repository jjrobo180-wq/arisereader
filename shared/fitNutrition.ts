// Arise Fit nutrition plans, Arise Points and intermittent fasting (shared by the app and tests).
// Arise Points are Arise Fit's own formula (not any other company's): calories count, fat counts a
// little extra and protein earns some back, on a scale where a typical day is about 20 to 40 points.

export type DietPlan = { id: string; name: string; blurb: string; split: { p: number; c: number; f: number }; carbCap?: number; tips: string[] };

export const DIET_PLANS: DietPlan[] = [
  { id: "balanced", name: "Balanced", blurb: "Even split for steady energy, training and recovery.", split: { p: 30, c: 40, f: 30 }, tips: ["Protein at every meal.", "Carbs around your training.", "Plenty of vegetables and water."] },
  { id: "high-protein", name: "High protein", blurb: "Built to hold and build muscle, and keep you full.", split: { p: 40, c: 35, f: 25 }, tips: ["Aim for about 1 g of protein per lb of goal body weight.", "Lean meats, eggs, Greek yogurt, whey.", "Spread protein over 3–5 meals."] },
  { id: "shred", name: "Shred", blurb: "Cutting phase: high protein, lower carbs, lean out without losing muscle.", split: { p: 45, c: 25, f: 30 }, tips: ["Pair it with a lose-fat goal.", "Keep lifting heavy to hold muscle.", "Fibrous vegetables fill you up."] },
  { id: "mass", name: "Mass builder", blurb: "Bulking phase: big carbs and protein to fuel growth.", split: { p: 25, c: 50, f: 25 }, tips: ["Pair it with a build-muscle goal.", "Rice, oats, potatoes, pasta around training.", "Add a shake if you can't eat enough."] },
  { id: "low-carb", name: "Low carb", blurb: "Carbs kept under about 100 g a day; more protein and fat.", split: { p: 35, c: 20, f: 45 }, carbCap: 100, tips: ["Meat, fish, eggs, vegetables, nuts.", "Skip bread, sugar and sweet drinks.", "Keep some carbs before hard workouts."] },
  { id: "keto", name: "Keto", blurb: "Very low carb (about 25 g net) so the body runs on fat.", split: { p: 25, c: 5, f: 70 }, carbCap: 30, tips: ["Expect a few low-energy days at the start.", "Salt and water matter more.", "Watch hidden carbs in sauces."] },
  { id: "carnivore", name: "Carnivore", blurb: "Animal foods only: meat, fish, eggs. Zero carbs.", split: { p: 35, c: 0, f: 65 }, carbCap: 10, tips: ["Fattier cuts keep energy up.", "Organ meats cover vitamins.", "Check with a doctor if you have health conditions."] },
  { id: "paleo", name: "Paleo", blurb: "Whole foods: meat, fish, vegetables, fruit, nuts. No grains or dairy.", split: { p: 30, c: 30, f: 40 }, tips: ["Cook from whole ingredients.", "Fruit and sweet potato for carbs.", "Skip processed food."] },
  { id: "mediterranean", name: "Mediterranean", blurb: "Fish, olive oil, vegetables, beans and whole grains. Heart-healthy.", split: { p: 20, c: 45, f: 35 }, tips: ["Fish twice a week.", "Olive oil as your main fat.", "Beans, lentils and whole grains."] },
  { id: "plant", name: "Plant power", blurb: "Vegetarian or vegan, with enough protein to train hard.", split: { p: 25, c: 50, f: 25 }, tips: ["Tofu, tempeh, seitan, lentils, beans.", "Combine sources over the day.", "Consider B12 and a plant protein powder."] },
];
export const DIET_BY_ID = new Map(DIET_PLANS.map((d) => [d.id, d]));

type Macros = { kcal: number; p: number; c: number; f: number };

/** Arise Points for a food or a day's total. */
export function pointsOf(m: Macros): number {
  const raw = m.kcal / 70 + m.f / 30 - m.p / 30;
  return Math.max(0, Math.round(raw));
}

/** The daily Arise Points budget that matches a calorie and macro goal (never under 18). */
export const pointsBudget = (g: Macros) => Math.max(18, pointsOf(g));

// ——— Intermittent fasting ——————————————————————————————————————————————————————————————————————

export type FastingProtocol = { id: string; name: string; hours: number; blurb: string };
export const FASTING_PROTOCOLS: FastingProtocol[] = [
  { id: "12:12", name: "12:12", hours: 12, blurb: "Easy start: overnight plus a little." },
  { id: "14:10", name: "14:10", hours: 14, blurb: "A step up; skip late snacks." },
  { id: "16:8", name: "16:8", hours: 16, blurb: "The classic: an 8-hour eating window." },
  { id: "18:6", name: "18:6", hours: 18, blurb: "Tighter window, deeper fast." },
  { id: "20:4", name: "Warrior 20:4", hours: 20, blurb: "One big meal window of 4 hours." },
  { id: "omad", name: "OMAD 23:1", hours: 23, blurb: "One meal a day." },
  { id: "36h", name: "Monk 36h", hours: 36, blurb: "A full day and a half. Not for beginners." },
];
export const FASTING_BY_ID = new Map(FASTING_PROTOCOLS.map((p) => [p.id, p]));

export type Fasting = { protocol: string; start?: string; log: { start: string; end: string; goalH: number }[] };
export const emptyFasting = (): Fasting => ({ protocol: "16:8", log: [] });

/** Where a fast stands right now. */
export function fastingStatus(f: Fasting | undefined, now = Date.now()) {
  const goalH = FASTING_BY_ID.get(f?.protocol || "16:8")?.hours ?? 16;
  const goalMs = goalH * 3_600_000;
  if (!f?.start) return { active: false as const, goalH, goalMs, elapsedMs: 0, pct: 0, endsAt: 0, done: false };
  const startMs = Date.parse(f.start);
  const elapsedMs = Math.max(0, now - startMs);
  return { active: true as const, goalH, goalMs, elapsedMs, pct: Math.min(1, elapsedMs / goalMs), endsAt: startMs + goalMs, done: elapsedMs >= goalMs };
}

/** The body's rough fasting stages, for the timer's "what's happening now" line. */
export function fastingStage(hours: number): { name: string; text: string } {
  if (hours < 4) return { name: "Digesting", text: "Blood sugar rising and falling after your last meal." };
  if (hours < 12) return { name: "Burning sugar", text: "Insulin falls; your body uses stored glycogen." };
  if (hours < 16) return { name: "Fat-burning", text: "Glycogen is running low; fat becomes the main fuel." };
  if (hours < 24) return { name: "Ketosis", text: "Ketones rise as fat breakdown ramps up." };
  return { name: "Deep fast", text: "Extended fasting. Stay hydrated; break it gently." };
}

/** Completed fasts in a row (each at least its goal), ending with the latest. */
export function fastingStreak(f: Fasting | undefined): number {
  let n = 0;
  for (const x of [...(f?.log ?? [])].reverse()) {
    if (Date.parse(x.end) - Date.parse(x.start) >= x.goalH * 3_600_000) n++; else break;
  }
  return n;
}

/** Whatever was saved, made safe: known protocol, real dates, at most 400 fasts kept. */
export function cleanFasting(raw: any): Fasting | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const date = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v.slice(0, 30) : "");
  const protocol = FASTING_BY_ID.has(String(raw.protocol)) ? String(raw.protocol) : "16:8";
  const log = (Array.isArray(raw.log) ? raw.log : []).slice(-400)
    .map((x: any) => ({ start: date(x?.start), end: date(x?.end), goalH: Math.min(72, Math.max(1, Number(x?.goalH) || 16)) }))
    .filter((x: { start: string; end: string }) => x.start && x.end && Date.parse(x.end) > Date.parse(x.start));
  const start = date(raw.start);
  return { protocol, log, ...(start ? { start } : {}) };
}
