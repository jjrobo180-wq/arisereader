// Arise Fit: training and nutrition in one app (client/src/pages/fit/). Everything here is shared by
// the app and the server: the data saved for each person, the built-in exercise catalog and
// programs (written for Arise Fit), and the math (estimated one-rep max, plates, progression,
// calorie and macro goals). Exercise photos come from wger's open library (server/fit.ts).

export type Units = "lb" | "kg";
export type Goal = "lose" | "maintain" | "gain";
export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export type FitSet = { reps: number; weight: number; done: boolean; warm?: boolean; rpe?: number };
export type FitExercise = { exId: string; name: string; sets: FitSet[]; rest?: number; target?: string; note?: string };
export type Workout = { id: string; date: string; name: string; programId?: string; dayId?: string; secs: number; exercises: FitExercise[]; note?: string };
export type Routine = { id: string; name: string; exercises: { exId: string; name: string; sets: number; reps: string; rest: number }[] };
export type FoodEntry = { id: string; date: string; meal: Meal; name: string; kcal: number; p: number; c: number; f: number; servings: number; serving?: string };
export type Profile = { sex?: "m" | "f"; birthYear?: number; heightCm?: number; goal: Goal; activity: number; units: Units; kcalGoal?: number; macroSplit?: { p: number; c: number; f: number }; waterGoalMl: number; stepsGoal: number;
  /** A diet plan from fitNutrition.ts (it sets macroSplit) and whether food is counted in calories or Arise Points. */
  dietPlan?: string; trackMode?: "calories" | "points" };
export type FitData = {
  v: 1;
  profile: Profile;
  workouts: Workout[];
  routines: Routine[];
  program?: { id: string; started: string; done: string[] };
  foods: FoodEntry[];
  recentFoods: Omit<FoodEntry, "id" | "date" | "meal">[];
  water: Record<string, number>;
  weights: { date: string; kg: number }[];
  onboarded?: boolean;
  /** Intermittent fasting: the chosen protocol, a fast in progress and past fasts. */
  fasting?: Fasting;
};

import { DIET_BY_ID, cleanFasting, type Fasting } from "./fitNutrition";

export const LIMITS = { workouts: 3000, foods: 20000, routines: 60, weights: 3000, recent: 60, bytes: 2_500_000 };

export function emptyFit(): FitData {
  return { v: 1, profile: { goal: "maintain", activity: 1.45, units: "lb", waterGoalMl: 2500, stepsGoal: 8000 }, workouts: [], routines: [], foods: [], recentFoods: [], water: {}, weights: [] };
}

const num = (v: unknown, lo: number, hi: number, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);
const day = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : "";
const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

/** Whatever was sent, made safe to keep: known fields only, numbers in range, lists capped. */
export function cleanFit(raw: any): FitData {
  const d = emptyFit();
  if (!raw || typeof raw !== "object") return d;
  const p = raw.profile || {};
  d.profile = {
    sex: p.sex === "m" || p.sex === "f" ? p.sex : undefined,
    birthYear: p.birthYear ? num(p.birthYear, 1900, 2030) : undefined,
    heightCm: p.heightCm ? num(p.heightCm, 90, 250) : undefined,
    goal: ["lose", "maintain", "gain"].includes(p.goal) ? p.goal : "maintain",
    activity: num(p.activity, 1.2, 1.95, 1.45),
    units: p.units === "kg" ? "kg" : "lb",
    kcalGoal: p.kcalGoal ? num(p.kcalGoal, 900, 6000) : undefined,
    macroSplit: p.macroSplit ? { p: num(p.macroSplit.p, 5, 70), c: num(p.macroSplit.c, 5, 75), f: num(p.macroSplit.f, 10, 70) } : undefined,
    waterGoalMl: num(p.waterGoalMl, 500, 8000, 2500),
    stepsGoal: num(p.stepsGoal, 1000, 50000, 8000),
    ...(DIET_BY_ID.has(String(p.dietPlan)) ? { dietPlan: String(p.dietPlan) } : {}),
    ...(p.trackMode === "points" ? { trackMode: "points" as const } : {}),
  };
  const set = (s: any): FitSet => ({ reps: num(s?.reps, 0, 1000), weight: num(s?.weight, 0, 2000), done: !!s?.done, ...(s?.warm ? { warm: true } : {}), ...(s?.rpe ? { rpe: num(s.rpe, 1, 10) } : {}) });
  const ex = (e: any): FitExercise => ({ exId: str(e?.exId, 80), name: str(e?.name, 80), sets: (Array.isArray(e?.sets) ? e.sets : []).slice(0, 30).map(set), ...(e?.rest ? { rest: num(e.rest, 0, 900) } : {}), ...(e?.target ? { target: str(e.target, 20) } : {}), ...(e?.note ? { note: str(e.note, 300) } : {}) });
  d.workouts = (Array.isArray(raw.workouts) ? raw.workouts : []).slice(-LIMITS.workouts).filter((w: any) => w && w.id && w.date).map((w: any): Workout => ({
    id: str(w.id, 40), date: str(w.date, 30), name: str(w.name, 80) || "Workout", ...(w.programId ? { programId: str(w.programId, 40) } : {}), ...(w.dayId ? { dayId: str(w.dayId, 40) } : {}),
    secs: num(w.secs, 0, 86400), exercises: (Array.isArray(w.exercises) ? w.exercises : []).slice(0, 40).map(ex), ...(w.note ? { note: str(w.note, 500) } : {}),
  }));
  d.routines = (Array.isArray(raw.routines) ? raw.routines : []).slice(0, LIMITS.routines).map((r: any): Routine => ({ id: str(r?.id, 40), name: str(r?.name, 60) || "Routine",
    exercises: (Array.isArray(r?.exercises) ? r.exercises : []).slice(0, 30).map((e: any) => ({ exId: str(e?.exId, 80), name: str(e?.name, 80), sets: num(e?.sets, 1, 20, 3), reps: str(e?.reps, 12) || "8-12", rest: num(e?.rest, 0, 900, 90) })) }));
  if (raw.program?.id) d.program = { id: str(raw.program.id, 40), started: str(raw.program.started, 30), done: (Array.isArray(raw.program.done) ? raw.program.done : []).slice(-500).map((x: unknown) => str(x, 60)) };
  const food = (f: any) => ({ name: str(f?.name, 120) || "Food", kcal: num(f?.kcal, 0, 10000), p: num(f?.p, 0, 1000), c: num(f?.c, 0, 1500), f: num(f?.f, 0, 1000), servings: num(f?.servings, 0.05, 50, 1), ...(f?.serving ? { serving: str(f.serving, 60) } : {}) });
  d.foods = (Array.isArray(raw.foods) ? raw.foods : []).slice(-LIMITS.foods).filter((f: any) => f?.id && day(f?.date)).map((f: any) => ({ id: str(f.id, 40), date: day(f.date), meal: MEALS.includes(f.meal) ? f.meal : "snack", ...food(f) }));
  d.recentFoods = (Array.isArray(raw.recentFoods) ? raw.recentFoods : []).slice(0, LIMITS.recent).map(food);
  for (const [k, v] of Object.entries(raw.water && typeof raw.water === "object" ? raw.water : {})) if (day(k)) d.water[k] = num(v, 0, 20000);
  d.weights = (Array.isArray(raw.weights) ? raw.weights : []).slice(-LIMITS.weights).filter((w: any) => day(w?.date)).map((w: any) => ({ date: day(w.date), kg: num(w.kg, 20, 400) }));
  if (raw.onboarded) d.onboarded = true;
  const fasting = cleanFasting(raw.fasting);
  if (fasting) d.fasting = fasting;
  return d;
}

// ——— Units and math ———————————————————————————————————————————————————————————————————————————

export const LB = 2.20462;
export const toKg = (w: number, u: Units) => (u === "kg" ? w : w / LB);
export const fromKg = (kg: number, u: Units) => (u === "kg" ? kg : kg * LB);
export const round = (n: number, step = 1) => Math.round(n / step) * step;

/** Estimated one-rep max (Epley), for sets of 1–12 reps; heavier reps say more than lighter ones. */
export const e1rm = (weight: number, reps: number) => (reps <= 0 || weight <= 0 ? 0 : reps === 1 ? weight : reps > 12 ? 0 : weight * (1 + reps / 30));

/** Plates for one side of the bar, biggest first. */
export function plates(total: number, units: Units, bar = units === "kg" ? 20 : 45): { plates: number[]; left: number } {
  const sizes = units === "kg" ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5];
  let side = (total - bar) / 2; const out: number[] = [];
  if (side <= 0) return { plates: [], left: Math.max(0, total - bar) };
  for (const s of sizes) while (side >= s - 1e-9) { out.push(s); side -= s; }
  return { plates: out, left: Math.round(side * 2 * 100) / 100 };
}

/** The work sets of an exercise, done ones only. */
const workSets = (e: FitExercise) => e.sets.filter((s) => s.done && !s.warm && s.reps > 0);

export type Best = { e1rm: number; weight: number; reps: number; volume: number; date: string };
/** Each exercise's records across every workout. */
export function records(workouts: Workout[]): Map<string, Best> {
  const best = new Map<string, Best>();
  for (const w of workouts) for (const e of w.exercises) {
    const sets = workSets(e); if (!sets.length) continue;
    const b = best.get(e.exId) ?? { e1rm: 0, weight: 0, reps: 0, volume: 0, date: w.date };
    const vol = sets.reduce((t, s) => t + s.reps * s.weight, 0);
    for (const s of sets) {
      const est = e1rm(s.weight, s.reps);
      if (est > b.e1rm) { b.e1rm = est; b.date = w.date; }
      if (s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps)) { b.weight = s.weight; b.reps = s.reps; }
    }
    if (vol > b.volume) b.volume = vol;
    best.set(e.exId, b);
  }
  return best;
}

/** New records set in this workout, compared with everything before it. */
export function newRecords(before: Workout[], w: Workout): { exId: string; name: string; kind: "e1rm" | "weight" | "volume"; value: number }[] {
  const old = records(before); const out: { exId: string; name: string; kind: "e1rm" | "weight" | "volume"; value: number }[] = [];
  for (const e of w.exercises) {
    const sets = workSets(e); if (!sets.length) continue;
    const prev = old.get(e.exId); if (!prev) continue; // a first time isn't a record
    const est = Math.max(...sets.map((s) => e1rm(s.weight, s.reps)));
    const top = Math.max(...sets.map((s) => s.weight));
    const vol = sets.reduce((t, s) => t + s.reps * s.weight, 0);
    if (est > prev.e1rm + 0.01) out.push({ exId: e.exId, name: e.name, kind: "e1rm", value: est });
    else if (top > prev.weight) out.push({ exId: e.exId, name: e.name, kind: "weight", value: top });
    else if (vol > prev.volume) out.push({ exId: e.exId, name: e.name, kind: "volume", value: vol });
  }
  return out;
}

/** "8-12" → { lo: 8, hi: 12 }; "5" → { lo: 5, hi: 5 }; "AMRAP" → { lo: 1, hi: 99 }; "30s" → time. */
export function repRange(reps: string): { lo: number; hi: number; secs?: number } {
  const t = String(reps).trim().toLowerCase();
  const sec = /^(\d+)\s*s(ec)?$/.exec(t); if (sec) return { lo: 1, hi: 1, secs: Number(sec[1]) };
  if (/amrap|max/.test(t)) return { lo: 1, hi: 99 };
  const m = /^(\d+)\s*[-–]\s*(\d+)$/.exec(t); if (m) return { lo: Number(m[1]), hi: Number(m[2]) };
  const n = Number(t); return Number.isFinite(n) && n > 0 ? { lo: n, hi: n } : { lo: 8, hi: 12 };
}

/** What to lift next time: add weight once every work set reached the top of the range, else the
 *  same weight for more reps. Lower-body lifts go up twice as much. */
export function nextTime(last: FitExercise | undefined, reps: string, units: Units, lower: boolean): { weight: number; why: string } | null {
  if (!last) return null;
  const sets = workSets(last); if (!sets.length) return null;
  const top = Math.max(...sets.map((s) => s.weight)); if (top <= 0) return null;
  const { hi } = repRange(reps);
  const step = units === "kg" ? (lower ? 5 : 2.5) : (lower ? 10 : 5);
  const atTop = sets.filter((s) => s.weight === top).every((s) => s.reps >= hi);
  return atTop ? { weight: top + step, why: `You hit ${hi} reps on every set: add ${step} ${units}.` } : { weight: top, why: `Same weight; aim for ${hi} reps on every set.` };
}

/** The last time an exercise was done (newest first list in, or any order). */
export function lastTime(workouts: Workout[], exId: string): FitExercise | undefined {
  for (let i = workouts.length - 1; i >= 0; i--) { const e = workouts[i].exercises.find((x) => x.exId === exId && workSets(x).length); if (e) return e; }
  return undefined;
}

/** Calories and macros for the day: Mifflin–St Jeor × activity, ±20% for losing or gaining. */
export function goals(p: Profile, kg: number | undefined, today = new Date()): { kcal: number; p: number; c: number; f: number; tdee: number } {
  let tdee = 2200;
  if (kg && p.heightCm && p.birthYear && p.sex) {
    const age = today.getFullYear() - p.birthYear;
    const bmr = 10 * kg + 6.25 * p.heightCm - 5 * age + (p.sex === "m" ? 5 : -161);
    tdee = bmr * p.activity;
  }
  const kcal = Math.round(p.kcalGoal ?? (p.goal === "lose" ? tdee * 0.8 : p.goal === "gain" ? tdee * 1.1 : tdee));
  const split = p.macroSplit ?? (p.goal === "lose" ? { p: 35, c: 35, f: 30 } : p.goal === "gain" ? { p: 25, c: 50, f: 25 } : { p: 30, c: 40, f: 30 });
  return { kcal, tdee: Math.round(tdee), p: Math.round((kcal * split.p) / 100 / 4), c: Math.round((kcal * split.c) / 100 / 4), f: Math.round((kcal * split.f) / 100 / 9) };
}

export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Days in a row with a workout or food logged, ending today (or yesterday). */
export function streak(d: FitData, today = new Date()): number {
  const active = new Set<string>([...d.workouts.map((w) => w.date.slice(0, 10)), ...d.foods.map((f) => f.date)]);
  let n = 0; const t = new Date(today);
  if (!active.has(dayKey(t))) t.setDate(t.getDate() - 1);
  while (active.has(dayKey(t))) { n++; t.setDate(t.getDate() - 1); }
  return n;
}

/** Work sets per muscle this week (Monday on), for the balance chart. */
export function weeklySets(workouts: Workout[], muscleOf: (exId: string) => string, today = new Date()): Record<string, number> {
  const start = new Date(today); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const out: Record<string, number> = {};
  for (const w of workouts) if (new Date(w.date) >= start) for (const e of w.exercises) { const m = muscleOf(e.exId) || "other"; out[m] = (out[m] || 0) + workSets(e).length; }
  return out;
}

// ——— The built-in exercise catalog (written for Arise Fit) ———————————————————————————————————————

export type Muscle = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "forearms" | "abs" | "quads" | "hamstrings" | "glutes" | "calves" | "full body" | "cardio";
export type Equipment = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "kettlebell" | "band" | "bench" | "pull-up bar" | "cardio machine" | "other";
export type CatalogExercise = { id: string; name: string; muscle: Muscle; also: Muscle[]; equipment: Equipment; level: 1 | 2 | 3; lower?: boolean; timed?: boolean; cues: string[] };

const X = (id: string, name: string, muscle: Muscle, also: Muscle[], equipment: Equipment, level: 1 | 2 | 3, cues: string[], extra: Partial<CatalogExercise> = {}): CatalogExercise =>
  ({ id, name, muscle, also, equipment, level, cues, ...(["quads", "hamstrings", "glutes", "calves"].includes(muscle) ? { lower: true } : {}), ...extra });

export const CATALOG: CatalogExercise[] = [
  // Chest
  X("bench-press", "Bench Press", "chest", ["triceps", "shoulders"], "barbell", 2, ["Eyes under the bar, feet planted, shoulder blades pinched.", "Lower to mid-chest with elbows about 45° from your body.", "Press up and slightly back over your shoulders."]),
  X("incline-bench", "Incline Bench Press", "chest", ["shoulders", "triceps"], "barbell", 2, ["Bench at 30–45°.", "Lower to the top of your chest.", "Drive straight up, wrists stacked over elbows."]),
  X("db-bench", "Dumbbell Bench Press", "chest", ["triceps", "shoulders"], "dumbbell", 1, ["Kick the dumbbells up from your knees as you lie back.", "Lower until you feel a stretch across your chest.", "Press up, bringing the dumbbells close at the top."]),
  X("db-incline", "Incline Dumbbell Press", "chest", ["shoulders"], "dumbbell", 1, ["Bench at 30°.", "Elbows slightly tucked.", "Press up and in over your upper chest."]),
  X("db-fly", "Dumbbell Fly", "chest", [], "dumbbell", 1, ["Slight bend in the elbows, kept fixed.", "Open wide until your chest stretches.", "Hug the dumbbells back together."]),
  X("cable-fly", "Cable Fly", "chest", [], "cable", 1, ["Step forward with a staggered stance.", "Sweep your hands together in an arc.", "Squeeze, then let the cables pull you back slowly."]),
  X("push-up", "Push-Up", "chest", ["triceps", "shoulders", "abs"], "bodyweight", 1, ["Hands just wider than shoulders, body in a straight line.", "Lower until your chest nearly touches the floor.", "Push the floor away; don't let your hips sag."]),
  X("incline-push-up", "Incline Push-Up", "chest", ["triceps"], "bodyweight", 1, ["Hands on a bench or counter.", "Body straight from head to heels.", "Lower your chest to the edge, then push away."]),
  X("dip", "Dip", "chest", ["triceps", "shoulders"], "bodyweight", 2, ["Lean slightly forward for chest.", "Lower until your upper arms are parallel to the floor.", "Press up to straight arms."]),
  X("machine-chest-press", "Machine Chest Press", "chest", ["triceps"], "machine", 1, ["Handles at mid-chest height.", "Press out without locking hard.", "Return slowly until you feel the stretch."]),
  X("pec-deck", "Pec Deck", "chest", [], "machine", 1, ["Back flat against the pad.", "Bring the handles together in front of you.", "Open slowly under control."]),
  // Back
  X("deadlift", "Deadlift", "back", ["hamstrings", "glutes", "forearms"], "barbell", 3, ["Bar over mid-foot, shins close.", "Flat back, chest up, take the slack out of the bar.", "Push the floor away and stand tall; lower the same way."], { lower: true }),
  X("pull-up", "Pull-Up", "back", ["biceps"], "pull-up bar", 2, ["Overhand grip, a little wider than shoulders.", "Pull your elbows down to your sides until your chin clears the bar.", "Lower all the way to straight arms."]),
  X("chin-up", "Chin-Up", "back", ["biceps"], "pull-up bar", 2, ["Underhand grip, shoulder width.", "Drive elbows down and back.", "Chin over the bar, then lower fully."]),
  X("lat-pulldown", "Lat Pulldown", "back", ["biceps"], "cable", 1, ["Thighs under the pads, slight lean back.", "Pull the bar to your upper chest.", "Let it rise until your arms are straight."]),
  X("barbell-row", "Barbell Row", "back", ["biceps", "forearms"], "barbell", 2, ["Hinge forward to about 45°, back flat.", "Row the bar to your lower ribs.", "Lower under control without standing up."]),
  X("db-row", "One-Arm Dumbbell Row", "back", ["biceps"], "dumbbell", 1, ["Hand and knee on a bench, back flat.", "Pull the dumbbell to your hip.", "Lower until your arm is straight."]),
  X("seated-cable-row", "Seated Cable Row", "back", ["biceps"], "cable", 1, ["Sit tall, slight bend in the knees.", "Pull the handle to your belly, shoulders back.", "Reach forward slowly."]),
  X("t-bar-row", "T-Bar Row", "back", ["biceps"], "barbell", 2, ["Straddle the bar, hinge with a flat back.", "Pull the handle to your chest.", "Lower under control."]),
  X("inverted-row", "Inverted Row", "back", ["biceps"], "bodyweight", 1, ["Hang under a bar or table, body straight.", "Pull your chest to the bar.", "Lower to straight arms."]),
  X("face-pull", "Face Pull", "shoulders", ["back"], "cable", 1, ["Rope at face height.", "Pull toward your forehead, hands apart.", "Finish with elbows high and shoulders squeezed."]),
  X("back-extension", "Back Extension", "back", ["glutes", "hamstrings"], "bench", 1, ["Hips on the pad, ankles locked.", "Lower with a flat back.", "Rise until your body is straight, not past it."]),
  X("rack-pull", "Rack Pull", "back", ["glutes"], "barbell", 2, ["Bar on safeties at knee height.", "Brace and pull to standing.", "Lower to the pins without bouncing."]),
  // Shoulders
  X("ohp", "Overhead Press", "shoulders", ["triceps"], "barbell", 2, ["Bar on your front shoulders, elbows slightly forward.", "Squeeze glutes, press straight up past your face.", "Lock out with the bar over your mid-foot."]),
  X("db-shoulder-press", "Dumbbell Shoulder Press", "shoulders", ["triceps"], "dumbbell", 1, ["Seated or standing, dumbbells at ear level.", "Press up until arms are straight.", "Lower back to ear level."]),
  X("arnold-press", "Arnold Press", "shoulders", ["triceps"], "dumbbell", 2, ["Start palms facing you at chin height.", "Rotate palms out as you press up.", "Reverse on the way down."]),
  X("lateral-raise", "Lateral Raise", "shoulders", [], "dumbbell", 1, ["Slight bend in the elbows.", "Raise out to the sides to shoulder height.", "Lower slowly; don't swing."]),
  X("cable-lateral", "Cable Lateral Raise", "shoulders", [], "cable", 1, ["Cable at the bottom, across your body.", "Raise out to shoulder height.", "Lower slowly."]),
  X("rear-delt-fly", "Rear Delt Fly", "shoulders", ["back"], "dumbbell", 1, ["Hinge forward, chest near your thighs.", "Raise the dumbbells out to the sides.", "Squeeze your upper back, then lower."]),
  X("upright-row", "Upright Row", "shoulders", ["back"], "barbell", 2, ["Hands shoulder width.", "Pull to mid-chest, elbows leading.", "Lower slowly."]),
  X("pike-push-up", "Pike Push-Up", "shoulders", ["triceps"], "bodyweight", 2, ["Hips high, body in an upside-down V.", "Lower your head toward the floor between your hands.", "Press back up."]),
  X("shrug", "Shrug", "back", ["forearms"], "dumbbell", 1, ["Arms straight, dumbbells at your sides.", "Lift your shoulders to your ears.", "Pause, then lower."]),
  // Arms
  X("barbell-curl", "Barbell Curl", "biceps", ["forearms"], "barbell", 1, ["Elbows pinned to your sides.", "Curl the bar to your shoulders.", "Lower all the way."]),
  X("db-curl", "Dumbbell Curl", "biceps", ["forearms"], "dumbbell", 1, ["Palms forward.", "Curl up without swinging.", "Lower slowly."]),
  X("hammer-curl", "Hammer Curl", "biceps", ["forearms"], "dumbbell", 1, ["Palms facing each other.", "Curl to your shoulders.", "Lower under control."]),
  X("preacher-curl", "Preacher Curl", "biceps", [], "machine", 1, ["Upper arms flat on the pad.", "Curl up.", "Lower until your arms are almost straight."]),
  X("cable-curl", "Cable Curl", "biceps", [], "cable", 1, ["Elbows still.", "Curl the bar up.", "Lower against the pull of the cable."]),
  X("incline-curl", "Incline Dumbbell Curl", "biceps", [], "dumbbell", 2, ["Lie back on a 45° bench, arms hanging.", "Curl without moving your elbows forward.", "Lower to a full stretch."]),
  X("triceps-pushdown", "Triceps Pushdown", "triceps", [], "cable", 1, ["Elbows tucked at your sides.", "Push the bar down to straight arms.", "Let it rise to chest height."]),
  X("skull-crusher", "Skull Crusher", "triceps", [], "barbell", 2, ["Lying on a bench, arms straight up.", "Bend at the elbows, lowering toward your forehead.", "Straighten your arms."]),
  X("overhead-triceps", "Overhead Triceps Extension", "triceps", [], "dumbbell", 1, ["One dumbbell held overhead with both hands.", "Lower it behind your head.", "Straighten your arms."]),
  X("close-grip-bench", "Close-Grip Bench Press", "triceps", ["chest"], "barbell", 2, ["Hands shoulder width.", "Elbows close to your body.", "Lower to your lower chest and press."]),
  X("bench-dip", "Bench Dip", "triceps", ["chest"], "bench", 1, ["Hands on a bench behind you.", "Lower until elbows are at 90°.", "Push back up."]),
  X("wrist-curl", "Wrist Curl", "forearms", [], "dumbbell", 1, ["Forearms on your thighs, palms up.", "Curl your wrists up.", "Lower slowly."]),
  X("farmer-carry", "Farmer's Carry", "forearms", ["back", "abs"], "dumbbell", 1, ["Heavy dumbbells at your sides.", "Stand tall and walk with short steps.", "Keep your shoulders back."], { timed: true }),
  // Legs
  X("back-squat", "Back Squat", "quads", ["glutes", "hamstrings"], "barbell", 2, ["Bar on your upper back, feet shoulder width.", "Sit down between your heels until your hips are below your knees.", "Drive up, knees tracking over your toes."]),
  X("front-squat", "Front Squat", "quads", ["glutes", "abs"], "barbell", 3, ["Bar on your front shoulders, elbows high.", "Sit straight down, chest up.", "Stand up tall."]),
  X("goblet-squat", "Goblet Squat", "quads", ["glutes"], "dumbbell", 1, ["Hold a dumbbell at your chest.", "Squat down, elbows inside your knees.", "Stand up through your whole foot."]),
  X("bodyweight-squat", "Bodyweight Squat", "quads", ["glutes"], "bodyweight", 1, ["Feet shoulder width, arms forward.", "Sit back and down.", "Stand up tall."]),
  X("leg-press", "Leg Press", "quads", ["glutes"], "machine", 1, ["Feet mid-platform, shoulder width.", "Lower until your knees are near your chest.", "Press without locking your knees."]),
  X("hack-squat", "Hack Squat", "quads", ["glutes"], "machine", 2, ["Back flat on the pad.", "Lower deep under control.", "Drive up through your heels."]),
  X("bulgarian-split-squat", "Bulgarian Split Squat", "quads", ["glutes"], "dumbbell", 2, ["Back foot on a bench.", "Drop your back knee toward the floor.", "Drive up through your front foot."]),
  X("lunge", "Walking Lunge", "quads", ["glutes"], "dumbbell", 1, ["Long step forward.", "Lower your back knee near the floor.", "Push off and step through."]),
  X("step-up", "Step-Up", "quads", ["glutes"], "dumbbell", 1, ["Whole foot on a box or bench.", "Stand up on it without pushing off the back foot.", "Step down slowly."]),
  X("leg-extension", "Leg Extension", "quads", [], "machine", 1, ["Pad on your lower shins.", "Straighten your legs.", "Lower slowly."]),
  X("rdl", "Romanian Deadlift", "hamstrings", ["glutes", "back"], "barbell", 2, ["Soft knees, bar against your thighs.", "Push your hips back until you feel your hamstrings stretch.", "Squeeze your glutes to stand."]),
  X("db-rdl", "Dumbbell Romanian Deadlift", "hamstrings", ["glutes"], "dumbbell", 1, ["Dumbbells in front of your thighs.", "Hinge at the hips with a flat back.", "Stand tall."]),
  X("leg-curl", "Lying Leg Curl", "hamstrings", [], "machine", 1, ["Pad just above your heels.", "Curl your heels to your glutes.", "Lower slowly."]),
  X("seated-leg-curl", "Seated Leg Curl", "hamstrings", [], "machine", 1, ["Thigh pad snug.", "Curl down and back.", "Return slowly."]),
  X("good-morning", "Good Morning", "hamstrings", ["back"], "barbell", 3, ["Bar on your upper back, soft knees.", "Hinge forward with a flat back.", "Stand back up."]),
  X("hip-thrust", "Hip Thrust", "glutes", ["hamstrings"], "barbell", 1, ["Upper back on a bench, bar over your hips.", "Drive your hips up until your body is flat.", "Squeeze, then lower."]),
  X("glute-bridge", "Glute Bridge", "glutes", ["hamstrings"], "bodyweight", 1, ["Lie on your back, knees bent.", "Push your hips up.", "Squeeze at the top, then lower."]),
  X("cable-kickback", "Cable Glute Kickback", "glutes", [], "cable", 1, ["Ankle strap on.", "Kick back and up without arching your back.", "Return slowly."]),
  X("hip-abduction", "Hip Abduction", "glutes", [], "machine", 1, ["Sit tall, pads outside your knees.", "Press your knees apart.", "Return slowly."]),
  X("sumo-deadlift", "Sumo Deadlift", "glutes", ["quads", "back"], "barbell", 3, ["Wide stance, toes out, hands inside your knees.", "Chest up, push your knees out.", "Stand up with the bar close."]),
  X("kb-swing", "Kettlebell Swing", "glutes", ["hamstrings", "back"], "kettlebell", 2, ["Hike the kettlebell back between your legs.", "Snap your hips forward to float it to chest height.", "Let it fall back and hinge again."]),
  X("calf-raise", "Standing Calf Raise", "calves", [], "machine", 1, ["Balls of your feet on the edge.", "Rise as high as you can.", "Lower to a full stretch."]),
  X("seated-calf", "Seated Calf Raise", "calves", [], "machine", 1, ["Pad on your lower thighs.", "Rise up on your toes.", "Lower slowly."]),
  X("single-calf", "Single-Leg Calf Raise", "calves", [], "bodyweight", 1, ["One foot on a step.", "Rise all the way up.", "Lower below the step."]),
  // Core
  X("plank", "Plank", "abs", ["shoulders"], "bodyweight", 1, ["Forearms under your shoulders.", "Body straight; squeeze glutes and abs.", "Breathe and hold."], { timed: true }),
  X("side-plank", "Side Plank", "abs", [], "bodyweight", 1, ["Elbow under your shoulder.", "Lift your hips into a straight line.", "Hold, then switch sides."], { timed: true }),
  X("crunch", "Crunch", "abs", [], "bodyweight", 1, ["Knees bent, hands by your head.", "Curl your shoulders off the floor.", "Lower slowly."]),
  X("hanging-leg-raise", "Hanging Leg Raise", "abs", [], "pull-up bar", 2, ["Hang from a bar.", "Raise your legs up without swinging.", "Lower under control."]),
  X("cable-crunch", "Cable Crunch", "abs", [], "cable", 1, ["Kneel, rope at your head.", "Crunch down, ribs to hips.", "Return slowly."]),
  X("ab-wheel", "Ab Wheel Rollout", "abs", ["shoulders"], "other", 2, ["Kneel holding the wheel.", "Roll forward as far as you can with a flat back.", "Pull back with your abs."]),
  X("russian-twist", "Russian Twist", "abs", [], "bodyweight", 1, ["Sit leaning back, feet up or down.", "Turn your shoulders side to side.", "Keep your chest up."]),
  X("dead-bug", "Dead Bug", "abs", [], "bodyweight", 1, ["Lie on your back, arms and knees up.", "Lower the opposite arm and leg slowly.", "Keep your low back flat."]),
  X("mountain-climber", "Mountain Climber", "abs", ["cardio"], "bodyweight", 1, ["High plank.", "Drive your knees toward your chest one at a time.", "Keep your hips low."], { timed: true }),
  X("bicycle-crunch", "Bicycle Crunch", "abs", [], "bodyweight", 1, ["Hands by your head.", "Bring elbow toward the opposite knee.", "Switch sides smoothly."]),
  // Full body, conditioning and cardio
  X("burpee", "Burpee", "full body", ["cardio"], "bodyweight", 2, ["Squat, hands down, jump your feet back.", "Chest to the floor, then jump your feet in.", "Jump up with arms overhead."]),
  X("thruster", "Thruster", "full body", ["quads", "shoulders"], "dumbbell", 2, ["Dumbbells at your shoulders.", "Squat, then drive up into a press.", "Lower back to your shoulders."]),
  X("clean-press", "Clean and Press", "full body", ["shoulders", "glutes"], "barbell", 3, ["Pull the bar from the floor to your shoulders in one move.", "Press it overhead.", "Lower back to your shoulders and the floor."]),
  X("power-clean", "Power Clean", "full body", ["glutes", "back"], "barbell", 3, ["Start like a deadlift.", "Explode up and pull yourself under the bar.", "Catch it on your front shoulders."]),
  X("kb-goblet-squat", "Kettlebell Goblet Squat", "quads", ["glutes"], "kettlebell", 1, ["Hold the kettlebell by the horns.", "Squat deep, chest up.", "Stand tall."]),
  X("kb-clean", "Kettlebell Clean", "full body", ["glutes"], "kettlebell", 2, ["Swing between your legs.", "Pull it up close to your body.", "Catch it softly at your shoulder."]),
  X("jump-squat", "Jump Squat", "quads", ["cardio"], "bodyweight", 1, ["Squat down.", "Jump as high as you can.", "Land softly and go again."]),
  X("box-jump", "Box Jump", "quads", ["cardio"], "other", 2, ["Stand in front of a box.", "Swing your arms and jump on.", "Step down."]),
  X("jumping-jack", "Jumping Jack", "cardio", [], "bodyweight", 1, ["Jump your feet out and arms up.", "Jump back in.", "Keep a steady pace."], { timed: true }),
  X("high-knees", "High Knees", "cardio", [], "bodyweight", 1, ["Run in place.", "Drive your knees to hip height.", "Pump your arms."], { timed: true }),
  X("jump-rope", "Jump Rope", "cardio", ["calves"], "other", 1, ["Small jumps on the balls of your feet.", "Turn the rope with your wrists.", "Stay relaxed."], { timed: true }),
  X("run", "Run", "cardio", [], "cardio machine", 1, ["Easy pace you could talk at.", "Land under your hips.", "Relaxed shoulders."], { timed: true }),
  X("walk-incline", "Incline Walk", "cardio", ["calves", "glutes"], "cardio machine", 1, ["Treadmill at a steady incline.", "Don't hold the rails.", "Long, steady strides."], { timed: true }),
  X("bike", "Bike", "cardio", ["quads"], "cardio machine", 1, ["Seat at hip height.", "Steady cadence.", "Push and pull through the pedals."], { timed: true }),
  X("rower", "Rowing Machine", "cardio", ["back", "quads"], "cardio machine", 1, ["Legs, then lean back, then pull.", "Arms, lean forward, then legs on the way back.", "Smooth and steady."], { timed: true }),
  X("elliptical", "Elliptical", "cardio", [], "cardio machine", 1, ["Upright posture.", "Push and pull the handles.", "Steady pace."], { timed: true }),
  X("stairs", "Stair Climber", "cardio", ["glutes", "quads"], "cardio machine", 1, ["Whole foot on each step.", "Stand tall.", "Steady pace."], { timed: true }),
  // Bands and home
  X("band-pull-apart", "Band Pull-Apart", "shoulders", ["back"], "band", 1, ["Arms straight in front, band taut.", "Pull it apart to your chest.", "Return slowly."]),
  X("band-row", "Band Row", "back", ["biceps"], "band", 1, ["Band anchored at chest height.", "Row to your ribs.", "Return slowly."]),
  X("band-squat", "Banded Squat", "quads", ["glutes"], "band", 1, ["Band under your feet, over your shoulders.", "Squat down.", "Stand tall against the band."]),
  X("superman", "Superman", "back", ["glutes"], "bodyweight", 1, ["Lie face down.", "Lift your arms and legs.", "Hold, then lower."]),
  X("wall-sit", "Wall Sit", "quads", [], "bodyweight", 1, ["Back against a wall.", "Slide down until your knees are at 90°.", "Hold."], { timed: true }),
  // Mobility
  X("hip-flexor-stretch", "Hip Flexor Stretch", "glutes", [], "bodyweight", 1, ["Half-kneel, back knee down.", "Tuck your hips and lean forward gently.", "Hold, then switch."], { timed: true }),
  X("hamstring-stretch", "Hamstring Stretch", "hamstrings", [], "bodyweight", 1, ["One leg out straight.", "Hinge forward with a flat back.", "Hold, then switch."], { timed: true }),
  X("cat-cow", "Cat-Cow", "back", [], "bodyweight", 1, ["On hands and knees.", "Round your back up, then let it sag.", "Move slowly with your breath."], { timed: true }),
  X("worlds-greatest", "World's Greatest Stretch", "full body", [], "bodyweight", 1, ["Lunge forward, hand down inside your foot.", "Reach the same arm to the sky.", "Switch sides."], { timed: true }),
  X("childs-pose", "Child's Pose", "back", [], "bodyweight", 1, ["Kneel, sit back on your heels.", "Reach your arms forward on the floor.", "Breathe and hold."], { timed: true }),
];
export const CATALOG_BY_ID = new Map(CATALOG.map((e) => [e.id, e]));

// ——— Programs (written for Arise Fit; standard training structures) ————————————————————————

export type ProgramDay = { id: string; name: string; items: { exId: string; sets: number; reps: string; rest: number }[] };
export type Program = { id: string; name: string; blurb: string; level: "Beginner" | "Intermediate" | "Advanced"; goal: string; daysPerWeek: number; weeks: number; equipment: string; premium?: boolean; days: ProgramDay[] };
const I = (exId: string, sets: number, reps: string, rest = 90) => ({ exId, sets, reps, rest });

export const PROGRAMS: Program[] = [
  { id: "iron-progression", name: "Iron Progression", blurb: "A 12-week gradual-increase plan. Every lift has a rep range: hit the top of it on every set and the app adds weight next time; miss and you repeat until you own it. Four days, upper and lower.", level: "Beginner", goal: "Strength & size", daysPerWeek: 4, weeks: 12, equipment: "Barbell, dumbbells, cables",
    days: [
      { id: "u1", name: "Upper · Heavy", items: [I("bench-press", 4, "5-8", 150), I("barbell-row", 4, "6-10", 120), I("ohp", 3, "6-10", 120), I("lat-pulldown", 3, "8-12", 90), I("triceps-pushdown", 3, "10-15", 60), I("db-curl", 3, "10-15", 60)] },
      { id: "l1", name: "Lower · Heavy", items: [I("back-squat", 4, "5-8", 180), I("rdl", 3, "6-10", 150), I("leg-press", 3, "10-15", 120), I("leg-curl", 3, "10-15", 75), I("calf-raise", 4, "10-15", 60), I("plank", 3, "45s", 45)] },
      { id: "u2", name: "Upper · Volume", items: [I("db-incline", 4, "8-12", 90), I("seated-cable-row", 4, "8-12", 90), I("db-shoulder-press", 3, "8-12", 90), I("pull-up", 3, "AMRAP", 120), I("lateral-raise", 3, "12-15", 60), I("hammer-curl", 3, "10-12", 60)] },
      { id: "l2", name: "Lower · Volume", items: [I("deadlift", 3, "3-6", 210), I("bulgarian-split-squat", 3, "8-12", 90), I("hip-thrust", 3, "8-12", 90), I("leg-extension", 3, "12-15", 60), I("seated-calf", 3, "12-20", 45), I("hanging-leg-raise", 3, "10-15", 60)] },
    ] },
  { id: "starter-strength", name: "Starter Strength", blurb: "Three full-body days a week built on the big lifts. Add a little weight every session while it keeps going up.", level: "Beginner", goal: "Strength", daysPerWeek: 3, weeks: 12, equipment: "Barbell gym",
    days: [
      { id: "a", name: "Day A", items: [I("back-squat", 3, "5", 180), I("bench-press", 3, "5", 180), I("barbell-row", 3, "5", 150), I("plank", 3, "30s", 60)] },
      { id: "b", name: "Day B", items: [I("back-squat", 3, "5", 180), I("ohp", 3, "5", 180), I("deadlift", 1, "5", 240), I("chin-up", 3, "AMRAP", 120)] },
    ] },
  { id: "five-by-five", name: "5×5 Strength", blurb: "Five sets of five on the main lifts, alternating two workouts. Simple, heavy and proven.", level: "Beginner", goal: "Strength", daysPerWeek: 3, weeks: 12, equipment: "Barbell gym",
    days: [
      { id: "a", name: "Workout A", items: [I("back-squat", 5, "5", 180), I("bench-press", 5, "5", 180), I("barbell-row", 5, "5", 150)] },
      { id: "b", name: "Workout B", items: [I("back-squat", 5, "5", 180), I("ohp", 5, "5", 180), I("deadlift", 1, "5", 240)] },
    ] },
  { id: "ppl", name: "Push Pull Legs", blurb: "Six days, each muscle twice a week. The classic split for building size and strength.", level: "Intermediate", goal: "Muscle", daysPerWeek: 6, weeks: 10, equipment: "Full gym",
    days: [
      { id: "push", name: "Push", items: [I("bench-press", 4, "6-8", 150), I("ohp", 3, "8-10", 120), I("db-incline", 3, "10-12"), I("lateral-raise", 4, "12-15", 60), I("triceps-pushdown", 3, "10-12", 60), I("overhead-triceps", 3, "12-15", 60)] },
      { id: "pull", name: "Pull", items: [I("deadlift", 3, "5", 180), I("pull-up", 3, "6-10", 120), I("seated-cable-row", 3, "10-12"), I("face-pull", 3, "15", 60), I("barbell-curl", 3, "8-12", 60), I("hammer-curl", 3, "10-12", 60)] },
      { id: "legs", name: "Legs", items: [I("back-squat", 4, "6-8", 180), I("rdl", 3, "8-10", 150), I("leg-press", 3, "10-12", 120), I("leg-curl", 3, "10-12", 60), I("calf-raise", 4, "12-15", 60), I("hanging-leg-raise", 3, "10-15", 60)] },
    ] },
  { id: "upper-lower", name: "Upper / Lower", blurb: "Four days: two upper, two lower. Great balance of strength and muscle with recovery built in.", level: "Intermediate", goal: "Muscle + strength", daysPerWeek: 4, weeks: 10, equipment: "Full gym",
    days: [
      { id: "u1", name: "Upper 1 (strength)", items: [I("bench-press", 4, "5", 180), I("barbell-row", 4, "5", 150), I("ohp", 3, "6-8", 120), I("lat-pulldown", 3, "8-10"), I("db-curl", 3, "10-12", 60)] },
      { id: "l1", name: "Lower 1 (strength)", items: [I("back-squat", 4, "5", 180), I("rdl", 3, "6-8", 150), I("leg-press", 3, "8-10", 120), I("calf-raise", 4, "10-12", 60), I("plank", 3, "45s", 60)] },
      { id: "u2", name: "Upper 2 (volume)", items: [I("db-incline", 4, "8-12"), I("seated-cable-row", 4, "10-12"), I("db-shoulder-press", 3, "10-12"), I("cable-fly", 3, "12-15", 60), I("lateral-raise", 3, "15", 60), I("triceps-pushdown", 3, "12", 60)] },
      { id: "l2", name: "Lower 2 (volume)", items: [I("deadlift", 3, "5", 180), I("bulgarian-split-squat", 3, "8-10"), I("leg-curl", 3, "10-12", 60), I("hip-thrust", 3, "10-12"), I("seated-calf", 3, "15", 60)] },
    ] },
  { id: "hypertrophy-4", name: "Build Muscle 4-Day", blurb: "A body-part split with lots of volume and pump work, for growing muscle.", level: "Intermediate", goal: "Muscle", daysPerWeek: 4, weeks: 8, equipment: "Full gym", premium: true,
    days: [
      { id: "chest-tri", name: "Chest & Triceps", items: [I("bench-press", 4, "8-10", 120), I("db-incline", 3, "10-12"), I("cable-fly", 3, "12-15", 60), I("dip", 3, "AMRAP", 90), I("skull-crusher", 3, "10-12", 60)] },
      { id: "back-bi", name: "Back & Biceps", items: [I("pull-up", 4, "6-10", 120), I("barbell-row", 3, "8-10"), I("lat-pulldown", 3, "10-12"), I("incline-curl", 3, "10-12", 60), I("hammer-curl", 3, "12", 60)] },
      { id: "legs", name: "Legs", items: [I("back-squat", 4, "8-10", 150), I("leg-press", 3, "12", 120), I("rdl", 3, "10", 120), I("leg-extension", 3, "15", 60), I("leg-curl", 3, "15", 60), I("calf-raise", 4, "15", 60)] },
      { id: "shoulders-abs", name: "Shoulders & Abs", items: [I("ohp", 4, "8-10", 120), I("lateral-raise", 4, "15", 60), I("rear-delt-fly", 3, "15", 60), I("shrug", 3, "12", 60), I("cable-crunch", 3, "15", 60), I("hanging-leg-raise", 3, "12", 60)] },
    ] },
  { id: "dumbbell-only", name: "Dumbbells Only", blurb: "Full-body strength with just a pair of dumbbells and a bench. Perfect for home or a hotel gym.", level: "Beginner", goal: "Strength + muscle", daysPerWeek: 3, weeks: 8, equipment: "Dumbbells",
    days: [
      { id: "a", name: "Full Body A", items: [I("goblet-squat", 3, "10-12"), I("db-bench", 3, "8-12"), I("db-row", 3, "10-12"), I("db-shoulder-press", 3, "10-12"), I("db-curl", 2, "12", 60)] },
      { id: "b", name: "Full Body B", items: [I("db-rdl", 3, "10-12"), I("db-incline", 3, "10-12"), I("bulgarian-split-squat", 3, "8-10"), I("lateral-raise", 3, "15", 60), I("overhead-triceps", 2, "12", 60)] },
    ] },
  { id: "home-bodyweight", name: "Home Bodyweight", blurb: "No equipment, no excuses. Three short full-body sessions that get harder as you do.", level: "Beginner", goal: "Fitness", daysPerWeek: 3, weeks: 6, equipment: "None",
    days: [
      { id: "a", name: "Session A", items: [I("bodyweight-squat", 3, "15-20", 60), I("push-up", 3, "AMRAP", 75), I("inverted-row", 3, "8-12", 75), I("glute-bridge", 3, "15", 60), I("plank", 3, "40s", 45)] },
      { id: "b", name: "Session B", items: [I("lunge", 3, "10-12", 60), I("pike-push-up", 3, "6-10", 75), I("superman", 3, "12", 45), I("wall-sit", 3, "40s", 45), I("mountain-climber", 3, "30s", 45)] },
      { id: "c", name: "Session C", items: [I("jump-squat", 3, "10", 60), I("incline-push-up", 3, "12-15", 60), I("dead-bug", 3, "10", 45), I("side-plank", 2, "30s", 30), I("burpee", 3, "8", 60)] },
    ] },
  { id: "glutes-legs", name: "Glutes & Legs", blurb: "Four days with two lower-body days focused on glutes, plus two upper days for balance.", level: "Intermediate", goal: "Glutes", daysPerWeek: 4, weeks: 10, equipment: "Full gym", premium: true,
    days: [
      { id: "g1", name: "Glutes & Hamstrings", items: [I("hip-thrust", 4, "8-10", 120), I("rdl", 3, "8-10", 120), I("cable-kickback", 3, "12-15", 60), I("leg-curl", 3, "12", 60), I("hip-abduction", 3, "15-20", 45)] },
      { id: "u1", name: "Upper", items: [I("lat-pulldown", 3, "10-12"), I("db-shoulder-press", 3, "10-12"), I("seated-cable-row", 3, "12"), I("lateral-raise", 3, "15", 60), I("triceps-pushdown", 3, "12", 60)] },
      { id: "g2", name: "Glutes & Quads", items: [I("back-squat", 4, "6-8", 150), I("bulgarian-split-squat", 3, "10", 90), I("glute-bridge", 3, "15", 60), I("step-up", 3, "10", 60), I("calf-raise", 3, "15", 45)] },
      { id: "u2", name: "Upper & Core", items: [I("db-bench", 3, "10-12"), I("db-row", 3, "10-12"), I("face-pull", 3, "15", 60), I("db-curl", 3, "12", 60), I("cable-crunch", 3, "15", 45)] },
    ] },
  { id: "powerbuilding", name: "Powerbuilding", blurb: "Heavy main lifts first, then bodybuilding work. Get stronger and bigger at the same time.", level: "Advanced", goal: "Strength + muscle", daysPerWeek: 4, weeks: 12, equipment: "Full gym", premium: true,
    days: [
      { id: "squat", name: "Squat Day", items: [I("back-squat", 5, "3-5", 210), I("front-squat", 3, "6-8", 150), I("leg-press", 3, "10-12", 120), I("leg-curl", 3, "12", 60), I("hanging-leg-raise", 3, "12", 60)] },
      { id: "bench", name: "Bench Day", items: [I("bench-press", 5, "3-5", 210), I("close-grip-bench", 3, "6-8", 150), I("db-incline", 3, "10-12"), I("lateral-raise", 3, "15", 60), I("triceps-pushdown", 3, "12", 60)] },
      { id: "dead", name: "Deadlift Day", items: [I("deadlift", 5, "3", 240), I("barbell-row", 4, "6-8", 150), I("pull-up", 3, "AMRAP", 120), I("face-pull", 3, "15", 60), I("barbell-curl", 3, "10", 60)] },
      { id: "press", name: "Press Day", items: [I("ohp", 5, "3-5", 180), I("incline-bench", 3, "6-8", 150), I("dip", 3, "8-12", 90), I("rear-delt-fly", 3, "15", 60), I("skull-crusher", 3, "10", 60)] },
    ] },
  { id: "kettlebell", name: "Kettlebell Conditioning", blurb: "Strength and cardio in one with a single kettlebell. Short, sweaty, effective.", level: "Beginner", goal: "Conditioning", daysPerWeek: 3, weeks: 6, equipment: "Kettlebell",
    days: [
      { id: "a", name: "Swing Day", items: [I("kb-swing", 5, "15", 60), I("kb-goblet-squat", 3, "12", 60), I("push-up", 3, "AMRAP", 60), I("plank", 3, "40s", 45)] },
      { id: "b", name: "Clean Day", items: [I("kb-clean", 4, "8", 60), I("lunge", 3, "10", 60), I("band-row", 3, "15", 45), I("russian-twist", 3, "20", 45)] },
    ] },
  { id: "run-5k", name: "First 5K", blurb: "From walking to running 5 km in 9 weeks: three short sessions a week that build up gently.", level: "Beginner", goal: "Cardio", daysPerWeek: 3, weeks: 9, equipment: "None",
    days: [
      { id: "run", name: "Run / walk intervals", items: [I("walk-incline", 1, "300s", 0), I("run", 6, "60s", 90), I("walk-incline", 1, "300s", 0)] },
      { id: "long", name: "Longer steady run", items: [I("walk-incline", 1, "300s", 0), I("run", 1, "900s", 0), I("hamstring-stretch", 2, "30s", 15)] },
    ] },
  { id: "core-mobility", name: "Core & Mobility", blurb: "Twenty minutes, three times a week: a stronger core and hips and a back that feels better.", level: "Beginner", goal: "Mobility", daysPerWeek: 3, weeks: 6, equipment: "None",
    days: [
      { id: "a", name: "Core", items: [I("dead-bug", 3, "10", 45), I("side-plank", 3, "30s", 30), I("bicycle-crunch", 3, "20", 45), I("plank", 3, "45s", 45)] },
      { id: "b", name: "Mobility", items: [I("cat-cow", 2, "45s", 15), I("worlds-greatest", 2, "60s", 15), I("hip-flexor-stretch", 2, "45s", 15), I("hamstring-stretch", 2, "45s", 15), I("childs-pose", 1, "60s", 0)] },
    ] },
];
export const PROGRAM_BY_ID = new Map(PROGRAMS.map((p) => [p.id, p]));

/** The next day to do in a program: the one after the last finished day, round and round. */
export function nextProgramDay(p: Program, done: string[]): { day: ProgramDay; index: number; week: number } {
  const n = done.length;
  return { day: p.days[n % p.days.length], index: n, week: Math.floor(n / p.daysPerWeek) + 1 };
}

/** A YouTube search for how to do an exercise (opens YouTube; nothing is downloaded or embedded). */
export const howToVideo = (name: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`how to ${name} proper form`)}`;
