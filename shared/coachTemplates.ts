// Arise Trainer's ready-made templates (November 2026): workouts and multi-week programs a trainer can add to their
// library in one tap and then change however they like. Built only from Cooked's exercise catalog (shared/fit
// CATALOG), so every move has its name, muscle and demo video in the client's app.
import { CATALOG } from "./fit";
import type { CoachProgram, PlanItem, PlanWorkout } from "./coach";

export type Equip = "gym" | "dumbbells" | "home";
export type Level = "beginner" | "intermediate" | "advanced";
export type TemplateWorkout = PlanWorkout & { tags: string[]; level: Level; equip: Equip };
export type TemplateProgram = { program: CoachProgram; workouts: TemplateWorkout[]; level: Level; equip: Equip; goal: string; blurb: string; perWeek: number };

const NAME = new Map(CATALOG.map((e) => [e.id, e.name]));
/** "bench-press 4x6-8 120" → a plan item (sets × reps, rest in seconds), with the catalog's name. */
const it = (s: string, note?: string): PlanItem => {
  const parts = s.split(" ");
  const exId = parts[0], rest = parts[parts.length - 1], sr = parts.slice(1, -1).join(" ");
  const x = sr.indexOf("x");
  const sets = sr.slice(0, x), reps = sr.slice(x + 1);
  if (!(Number(sets) > 0) || !reps || !Number.isFinite(Number(rest))) throw new Error(`Template item doesn't read right: ${s}`);
  const name = NAME.get(exId);
  if (!name) throw new Error(`Template uses an exercise that isn't in the catalog: ${exId}`);
  return { exId, name, sets: Number(sets), reps, rest: Number(rest), ...(note ? { note } : {}) };
};
const W = (id: string, name: string, level: Level, equip: Equip, mins: number, tags: string, note: string, items: string[]): TemplateWorkout =>
  ({ id: `tpl-${id}`, name, level, equip, mins, tags: tags.split(" "), note, items: items.map((x) => it(x)) });

export const TEMPLATE_WORKOUTS: TemplateWorkout[] = [
  // Full body
  W("fb-beginner-a", "Full body A (beginner)", "beginner", "gym", 45, "full-body strength", "Leave 2-3 reps in the tank on every set. Add a little weight when all sets feel smooth.",
    ["goblet-squat 3x10 90", "db-bench 3x10 90", "lat-pulldown 3x10 90", "db-rdl 3x10 90", "plank 3x30s 45"]),
  W("fb-beginner-b", "Full body B (beginner)", "beginner", "gym", 45, "full-body strength", "Same idea as A: smooth reps, steady breathing, rest when you need it.",
    ["leg-press 3x12 90", "db-shoulder-press 3x10 90", "seated-cable-row 3x12 90", "glute-bridge 3x12 60", "dead-bug 3x10 45"]),
  W("fb-dumbbell", "Full body with dumbbells", "beginner", "dumbbells", 40, "full-body strength home", "Pick a weight you could lift 2-3 more times at the end of each set.",
    ["goblet-squat 3x12 75", "db-bench 3x10 75", "db-row 3x10 75", "db-rdl 3x10 75", "db-shoulder-press 3x10 75", "russian-twist 3x16 45"]),
  W("fb-bodyweight", "Full body, no equipment", "beginner", "home", 30, "full-body home conditioning", "Move with control. Rest 45 seconds between rounds of each move.",
    ["bodyweight-squat 3x15 45", "push-up 3x10 45", "inverted-row 3x8 45", "glute-bridge 3x15 45", "plank 3x40s 45", "mountain-climber 3x30s 45"]),
  // Upper / lower
  W("upper-a", "Upper A: strength", "intermediate", "gym", 60, "upper strength", "First two moves heavy (RPE 8). The rest moderate, chasing good reps.",
    ["bench-press 4x5-6 150", "barbell-row 4x6-8 120", "ohp 3x6-8 120", "lat-pulldown 3x10 90", "barbell-curl 3x10 60", "triceps-pushdown 3x12 60"]),
  W("lower-a", "Lower A: strength", "intermediate", "gym", 60, "lower strength", "Squat heavy (RPE 8), then build the hamstrings and glutes.",
    ["back-squat 4x5-6 180", "rdl 3x8 120", "bulgarian-split-squat 3x8 90", "leg-curl 3x12 75", "calf-raise 4x12 60", "hanging-leg-raise 3x10 60"]),
  W("upper-b", "Upper B: muscle", "intermediate", "gym", 60, "upper hypertrophy", "Moderate weight, slow lowering (3 seconds), last set of each close to failure.",
    ["db-incline 4x8-10 90", "seated-cable-row 4x10-12 90", "db-shoulder-press 3x10 90", "cable-fly 3x12-15 60", "lateral-raise 3x15 45", "hammer-curl 3x12 60", "overhead-triceps 3x12 60"]),
  W("lower-b", "Lower B: muscle", "intermediate", "gym", 60, "lower hypertrophy", "Control every rep. Hip thrusts: pause one second at the top.",
    ["front-squat 3x8 120", "hip-thrust 4x10 90", "leg-press 3x12 90", "seated-leg-curl 3x12 75", "leg-extension 3x15 60", "seated-calf 3x15 45"]),
  // Push / pull / legs
  W("push", "Push", "intermediate", "gym", 60, "push hypertrophy", "Chest, shoulders and triceps. Keep shoulder blades pinned on presses.",
    ["bench-press 4x6-8 120", "db-incline 3x10 90", "ohp 3x8 90", "lateral-raise 4x15 45", "dip 3x8-12 90", "skull-crusher 3x12 60"]),
  W("pull", "Pull", "intermediate", "gym", 60, "pull hypertrophy", "Back and biceps. Drive elbows, not hands.",
    ["deadlift 3x5 180", "pull-up 4x6-10 120", "t-bar-row 3x10 90", "face-pull 3x15 60", "barbell-curl 3x10 60", "preacher-curl 3x12 60"]),
  W("legs", "Legs", "intermediate", "gym", 60, "legs hypertrophy", "Quads, hamstrings, glutes, calves. Full range on every rep.",
    ["back-squat 4x6-8 150", "rdl 3x8-10 120", "hack-squat 3x10 90", "leg-curl 3x12 75", "walk-incline 1x10 min 0", "calf-raise 4x12 60"]),
  // Advanced strength
  W("power-day", "Power day (advanced)", "advanced", "gym", 75, "strength power", "Explosive first. Cleans and jumps fresh, full rest between sets.",
    ["power-clean 5x3 150", "box-jump 4x4 90", "back-squat 5x3 180", "bench-press 5x3 180", "pull-up 4x6 120"]),
  // Fat loss and conditioning
  W("hiit-20", "20-minute HIIT", "intermediate", "home", 20, "conditioning fat-loss hiit", "40 seconds on, 20 seconds off. 4 rounds of the 5 moves.",
    ["burpee 4x40s 20", "jump-squat 4x40s 20", "mountain-climber 4x40s 20", "high-knees 4x40s 20", "plank 4x40s 20"]),
  W("metcon-db", "Dumbbell metcon", "intermediate", "dumbbells", 30, "conditioning fat-loss", "As many rounds as possible in 20 minutes. Write down your rounds.",
    ["thruster 5x10 30", "db-row 5x10 30", "lunge 5x12 30", "burpee 5x8 30"]),
  W("cardio-zone2", "Zone 2 cardio", "beginner", "gym", 40, "cardio endurance", "Easy pace you can talk at (about 60-70% of max heart rate).",
    ["bike 1x20 min 0", "walk-incline 1x15 min 0", "plank 2x45s 45"]),
  W("rower-intervals", "Rower intervals", "intermediate", "gym", 30, "conditioning cardio", "Hard 500 m, easy 2 minutes. 5 rounds.",
    ["rower 5x500 m 120", "ab-wheel 3x10 60"]),
  // Glutes, core, mobility
  W("glutes", "Glute builder", "intermediate", "gym", 50, "glutes hypertrophy", "Squeeze at the top of every rep. Hips square on kickbacks.",
    ["hip-thrust 4x8-10 90", "sumo-deadlift 3x8 120", "bulgarian-split-squat 3x10 90", "cable-kickback 3x12 45", "hip-abduction 3x15 45"]),
  W("core", "Core 15", "beginner", "home", 15, "core", "Slow and controlled. Ribs down, low back flat.",
    ["dead-bug 3x10 30", "side-plank 3x30s 30", "bicycle-crunch 3x20 30", "plank 3x45s 30"]),
  W("mobility", "Mobility reset", "beginner", "home", 20, "mobility recovery", "Breathe slowly. Never stretch into pain.",
    ["worlds-greatest 2x6 20", "cat-cow 2x10 20", "hip-flexor-stretch 2x45s 20", "hamstring-stretch 2x45s 20", "childs-pose 2x60s 20", "band-pull-apart 2x15 20"]),
  W("seniors", "Strong and steady (seniors)", "beginner", "home", 30, "seniors balance strength", "Hold a counter or chair for balance any time. Stop if anything hurts.",
    ["bodyweight-squat 2x10 60", "incline-push-up 2x8 60", "band-row 2x12 60", "step-up 2x8 60", "single-calf 2x10 45", "wall-sit 2x20s 45"]),
];

const T = new Map(TEMPLATE_WORKOUTS.map((w) => [w.id, w]));
const byIds = (...ids: string[]) => ids.map((id) => { const w = T.get(`tpl-${id}`); if (!w) throw new Error(`No template ${id}`); return w; });
/** A program from a weekly pattern: day numbers 0-6 within the week → template workout, repeated for `weeks`. */
const P = (id: string, name: string, weeks: number, level: Level, equip: Equip, goal: string, blurb: string, week: [number, string][]): TemplateProgram => {
  const workouts = byIds(...[...new Set(week.map(([, w]) => w))]);
  const days = Array.from({ length: weeks }, (_, k) => week.map(([d, w]) => ({ day: k * 7 + d, workoutId: `tpl-${w}` }))).flat();
  return { program: { id: `tplp-${id}`, name, weeks, note: blurb, days }, workouts, level, equip, goal, blurb, perWeek: week.length };
};

export const TEMPLATE_PROGRAMS: TemplateProgram[] = [
  P("start-strong", "Start strong: 6-week beginner", 6, "beginner", "gym", "Get started", "Two alternating full-body workouts, three days a week. The best first program for someone new to the gym.",
    [[1, "fb-beginner-a"], [3, "fb-beginner-b"], [5, "fb-beginner-a"]]),
  P("home-6", "Home strong: 6 weeks", 6, "beginner", "home", "Get started", "No equipment needed. Three full-body days and one core day each week.",
    [[1, "fb-bodyweight"], [2, "core"], [3, "fb-bodyweight"], [5, "fb-bodyweight"]]),
  P("upper-lower-8", "Upper / lower: 8 weeks", 8, "intermediate", "gym", "Build muscle and strength", "Four days: two strength-focused, two muscle-focused. Add weight when you hit the top of the rep range.",
    [[1, "upper-a"], [2, "lower-a"], [4, "upper-b"], [5, "lower-b"]]),
  P("ppl-6", "Push / pull / legs: 6 weeks", 6, "intermediate", "gym", "Build muscle", "Six days for experienced lifters, or run it three days a week by doing each once.",
    [[1, "push"], [2, "pull"], [3, "legs"], [4, "push"], [5, "pull"], [6, "legs"]]),
  P("lean-8", "Lean out: 8 weeks", 8, "intermediate", "dumbbells", "Lose fat", "Strength keeps the muscle, conditioning and zone 2 burn the fat. Pair with a calorie target.",
    [[1, "fb-dumbbell"], [2, "hiit-20"], [3, "metcon-db"], [5, "fb-dumbbell"], [6, "cardio-zone2"]]),
  P("glute-6", "Glute focus: 6 weeks", 6, "intermediate", "gym", "Build glutes", "Two glute days, one lower strength day and one upper day.",
    [[1, "glutes"], [3, "upper-b"], [4, "lower-a"], [6, "glutes"]]),
  P("steady-8", "Strong and steady: 8 weeks (seniors)", 8, "beginner", "home", "Stay strong and balanced", "Gentle strength and balance three days a week, plus mobility.",
    [[1, "seniors"], [3, "mobility"], [5, "seniors"]]),
];

export const ALL_TEMPLATE_IDS = new Set([...TEMPLATE_WORKOUTS.map((w) => w.id), ...TEMPLATE_PROGRAMS.map((p) => p.program.id)]);
