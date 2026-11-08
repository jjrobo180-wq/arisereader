// Arise Fit's muscle recovery and smart workouts (the way Fitbod works): every hard set you log tires
// the muscles it works; each muscle recovers over the next few days (big muscles slower than small
// ones). Today's workout trains the freshest group (push, pull or legs), with the equipment and the
// time you have, picks exercises you know when it can, and sets sets, reps and rest for your goal.
// Pure functions: the app, the server and the tests share them.
import { CATALOG, CATALOG_BY_ID, type CatalogExercise, type Equipment, type FitData, type Goal, type Workout } from "./fit";
import { canDo } from "./fitGym";

export type BodyPart = "chest" | "back" | "shoulders" | "biceps" | "triceps" | "forearms" | "abs" | "quads" | "hamstrings" | "glutes" | "calves";
export const BODY_PARTS: BodyPart[] = ["chest", "shoulders", "back", "biceps", "triceps", "forearms", "abs", "quads", "hamstrings", "glutes", "calves"];
export const PART_NAME: Record<BodyPart, string> = { chest: "Chest", back: "Back", shoulders: "Shoulders", biceps: "Biceps", triceps: "Triceps", forearms: "Forearms", abs: "Abs", quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves" };
const isPart = (m: string): m is BodyPart => (BODY_PARTS as string[]).includes(m);

/** Hours for a muscle's tiredness to fall to about a third (big muscles take longer). */
const TAU: Record<BodyPart, number> = { chest: 30, back: 30, quads: 32, hamstrings: 30, glutes: 30, shoulders: 24, abs: 20, calves: 20, biceps: 22, triceps: 22, forearms: 18 };

export type MuscleState = { pct: number; last?: string; sets7: number };
export type Recovery = Record<BodyPart, MuscleState>;
type Lookup = (exId: string) => Pick<CatalogExercise, "muscle" | "also" | "timed"> | undefined;
const fromCatalog: Lookup = (id) => CATALOG_BY_ID.get(id);

/** How recovered each muscle is (0–100%), when it was last worked and its hard sets this week. */
export function recovery(workouts: Workout[], now = new Date(), lookup: Lookup = fromCatalog): Recovery {
  const fatigue = Object.fromEntries(BODY_PARTS.map((p) => [p, 0])) as Record<BodyPart, number>;
  const out = Object.fromEntries(BODY_PARTS.map((p) => [p, { pct: 100, sets7: 0 } as MuscleState])) as Recovery;
  const t = now.getTime();
  for (const w of workouts) {
    const at = Date.parse(w.date) + (w.secs || 0) * 1000;
    const hours = (t - at) / 3_600_000;
    if (!(hours >= 0) || hours > 24 * 7) continue;
    for (const e of w.exercises) {
      const ex = lookup(e.exId);
      if (!ex || ex.timed) continue;
      const hard = e.sets.filter((s) => s.done !== false && !s.warm).length;
      if (!hard) continue;
      const parts: [BodyPart, number][] = [];
      if (isPart(ex.muscle)) parts.push([ex.muscle, 1]);
      for (const m of ex.also) if (isPart(m)) parts.push([m, 0.5]);
      for (const [p, weight] of parts) {
        fatigue[p] += hard * weight * Math.exp(-hours / TAU[p]);
        out[p].sets7 += weight === 1 ? hard : 0;
        if (!out[p].last || w.date > out[p].last!) out[p].last = w.date;
      }
    }
  }
  for (const p of BODY_PARTS) out[p].pct = Math.max(0, Math.min(100, Math.round(100 * Math.exp(-fatigue[p] / 6))));
  return out;
}

/** Fresh (ready to train), recovering, or sore. */
export const recoveryLevel = (pct: number): "fresh" | "recovering" | "sore" => (pct >= 85 ? "fresh" : pct >= 55 ? "recovering" : "sore");

// ——— Smart workouts ——————————————————————————————————————————————————————————————————————————————

/** "mygym": only what the person's own gym has (shared/fitGym.ts), passed as `gear`. */
export type Equip = "gym" | "dumbbells" | "bodyweight" | "mygym";
export const EQUIP_LABEL: Record<Equip, string> = { gym: "Full gym", dumbbells: "Dumbbells", bodyweight: "No equipment", mygym: "My gym" };
export type Focus = "push" | "pull" | "legs" | "upper" | "full";
export const FOCUS_LABEL: Record<Focus, string> = { push: "Push", pull: "Pull", legs: "Legs", upper: "Upper body", full: "Full body" };
const GROUP_NAME: Record<Focus, string> = { push: "push muscles", pull: "pull muscles", legs: "legs", upper: "upper-body muscles", full: "muscles" };
export const FOCUS_MUSCLES: Record<Focus, BodyPart[]> = {
  push: ["chest", "shoulders", "triceps", "chest", "shoulders", "triceps", "chest"],
  pull: ["back", "biceps", "back", "shoulders", "biceps", "back", "forearms"],
  legs: ["quads", "hamstrings", "glutes", "quads", "calves", "hamstrings", "glutes"],
  upper: ["chest", "back", "shoulders", "biceps", "triceps", "back", "chest"],
  full: ["quads", "chest", "back", "hamstrings", "shoulders", "glutes", "biceps"],
};
const ALLOWED: Record<Equip, Set<Equipment>> = {
  gym: new Set<Equipment>(["barbell", "dumbbell", "machine", "cable", "bodyweight", "kettlebell", "band", "bench", "pull-up bar", "other"]),
  dumbbells: new Set<Equipment>(["dumbbell", "bodyweight", "bench", "kettlebell", "band"]),
  bodyweight: new Set<Equipment>(["bodyweight"]),
  mygym: new Set<Equipment>(),
};
/** Stretches, holds and cardio aren't strength picks. */
const SKIP = new Set(["cat-cow", "childs-pose", "hamstring-stretch", "hip-flexor-stretch", "worlds-greatest", "wall-sit", "farmer-carry", "box-jump", "burpee"]);
/** Moves done without weights too (no equipment). */
const BODYWEIGHT_OK = new Set(["lunge", "bulgarian-split-squat", "step-up", "jump-squat"]);
/** The lifts most programs are built on: picked first when they fit. */
const STAPLE = new Set(["bench-press", "db-bench", "incline-bench", "db-incline", "push-up", "dip", "ohp", "db-shoulder-press", "lateral-raise", "face-pull", "pull-up", "chin-up", "lat-pulldown", "barbell-row", "db-row", "seated-cable-row", "inverted-row",
  "back-squat", "front-squat", "goblet-squat", "leg-press", "bulgarian-split-squat", "lunge", "bodyweight-squat", "rdl", "db-rdl", "leg-curl", "hip-thrust", "glute-bridge", "calf-raise", "single-calf",
  "barbell-curl", "db-curl", "hammer-curl", "triceps-pushdown", "overhead-triceps", "skull-crusher", "plank", "hanging-leg-raise", "dead-bug", "cable-crunch", "deadlift"]);
const allowed = (equip: Equip, e: CatalogExercise, gear?: string[]) => equip === "mygym" ? canDo(e.id, gear ?? []) : ALLOWED[equip].has(e.equipment) || (equip === "bodyweight" && BODYWEIGHT_OK.has(e.id));
/** Bodyweight moves worth doing even in a gym. */
const BW_KEEP = new Set(["pull-up", "chin-up", "dip", "hanging-leg-raise", "inverted-row"]);
/** With weights to hand, loaded lifts come before bodyweight versions. */
const equipBonus = (equip: Equip, e: CatalogExercise) => (e.equipment !== "bodyweight" || BW_KEEP.has(e.id) ? 0 : equip === "gym" || equip === "mygym" ? -4 : equip === "dumbbells" ? -3 : 0);
/** Lifts that belong to one kind of day (a deadlift on a full-body day doubles up on the squat and RDL). */
const ONLY_ON: Record<string, Focus[]> = { deadlift: ["pull"], "rack-pull": ["pull"], "sumo-deadlift": ["legs", "pull"], "good-morning": ["legs"], "back-extension": ["pull", "legs"] };
/** On some days a muscle is trained a particular way: rear delts on pull day, presses on push day. */
const PREFER: Partial<Record<Focus, Partial<Record<BodyPart, string[]>>>> = {
  pull: { shoulders: ["face-pull", "rear-delt-fly", "band-pull-apart"] },
  push: { shoulders: ["ohp", "db-shoulder-press", "arnold-press", "lateral-raise", "cable-lateral", "pike-push-up"] },
};
export type GenOptions = { equip: Equip; mins: number; goal: Goal; focus?: Focus | "auto"; seed?: number; gear?: string[] };
export type GenItem = { exId: string; name: string; sets: number; reps: string; rest: number; muscle: BodyPart };
export type GenWorkout = { focus: Focus; title: string; muscles: BodyPart[]; items: GenItem[]; mins: number; why: string };

const rand = (seed: number) => { let x = (seed >>> 0) || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; };
const avg = (r: Recovery, ps: BodyPart[]) => ps.reduce((t, p) => t + r[p].pct, 0) / ps.length;
const uniq = <T,>(a: T[]) => [...new Set(a)];

/** The group to train today: the freshest of push, pull and legs (or the one rested longest when all are fresh). */
export function chooseFocus(r: Recovery, now = new Date()): Focus {
  const groups: Focus[] = ["legs", "push", "pull"];
  const score = (f: Focus) => {
    const ps = uniq(FOCUS_MUSCLES[f]);
    const lastMs = Math.max(0, ...ps.map((p) => (r[p].last ? Date.parse(r[p].last!) : 0)));
    const restedDays = lastMs ? (now.getTime() - lastMs) / 864e5 : 30;
    return avg(r, ps) + Math.min(10, restedDays * 2);
  };
  return [...groups].sort((a, b) => score(b) - score(a))[0];
}

const SMALL = new Set<string>(["biceps", "triceps", "forearms", "calves", "abs"]);
/** A compound works several muscles; it goes first and gets heavier sets. */
const compound = (e: CatalogExercise) => e.also.filter((m) => m !== "cardio").length >= 1 && e.equipment !== "cable" && e.equipment !== "machine" ? e.also.length + 1 : e.also.length;

/** Sets, reps and rest for the goal. */
export function prescription(goal: Goal, e: CatalogExercise, first: boolean): { sets: number; reps: string; rest: number } {
  if (e.timed) return { sets: 3, reps: "45s", rest: 45 };
  // Heavy, low-rep sets for the first big lift of a muscle; small muscles (curls, calf raises) stay light
  // unless the lift is a true compound (a close-grip bench, a chin-up).
  const big = first && (compound(e) >= 3 || (compound(e) >= 2 && !SMALL.has(e.muscle)));
  if (e.equipment === "bodyweight" && !big) return { sets: 3, reps: goal === "gain" ? "8-15" : "12-20", rest: 60 };
  if (goal === "gain") return big ? { sets: 4, reps: "6-10", rest: 120 } : { sets: 3, reps: "10-12", rest: 75 };
  if (goal === "lose") return big ? { sets: 3, reps: "8-12", rest: 75 } : { sets: 3, reps: "12-15", rest: 45 };
  return big ? { sets: 3, reps: "6-10", rest: 105 } : { sets: 3, reps: "10-12", rest: 60 };
}

/** Exercises that can stand in for one (same muscle, allowed equipment), best first. */
export function alternatives(exId: string, equip: Equip, exclude: string[] = [], history: Workout[] = [], gear?: string[]): CatalogExercise[] {
  const ex = CATALOG_BY_ID.get(exId); if (!ex) return [];
  const done = new Set(history.flatMap((w) => w.exercises.map((e) => e.exId)));
  return CATALOG.filter((e) => e.id !== exId && e.muscle === ex.muscle && allowed(equip, e, gear) && !SKIP.has(e.id) && !exclude.includes(e.id) && (!e.timed || ex.timed))
    .sort((a, b) => Number(done.has(b.id)) - Number(done.has(a.id)) || Math.abs(compound(a) - compound(ex)) - Math.abs(compound(b) - compound(ex)));
}

/** Today's workout. */
export function generateWorkout(data: Pick<FitData, "workouts" | "profile">, o: GenOptions, now = new Date()): GenWorkout {
  const r = recovery(data.workouts, now);
  const focus: Focus = !o.focus || o.focus === "auto" ? chooseFocus(r, now) : o.focus;
  // Exercises are added until the workout fills the time chosen (at most eight).
  const est = (list: GenItem[]) => list.reduce((t, i) => t + i.sets * (45 + i.rest), 0) / 60;
  const next = rand(o.seed ?? Number(now.toISOString().slice(0, 10).replace(/-/g, "")));
  const done = new Map<string, number>();
  for (const w of data.workouts.slice(-60)) for (const e of w.exercises) done.set(e.exId, (done.get(e.exId) ?? 0) + 1);
  const used = new Set<string>();
  const seenMuscle = new Map<BodyPart, number>();
  const items: GenItem[] = [];
  // Muscles still sore get skipped when there's anything else to train.
  const plan = FOCUS_MUSCLES[focus].filter((p) => r[p].pct >= 40 || FOCUS_MUSCLES[focus].every((q) => r[q].pct < 40));
  // A core finisher when there's time and the abs are fresh: its place (and about 5 minutes) is kept for it.
  const core = o.mins >= 40 && r.abs.pct >= 60 && focus !== "full";
  for (const m of [...plan, ...plan]) {
    if (items.length >= (core ? 7 : 8) || est(items) >= o.mins - 6 - (core ? 5 : 0)) break;
    const nth = seenMuscle.get(m) ?? 0;
    const all = CATALOG.filter((e) => e.muscle === m && allowed(o.equip, e, o.gear) && !SKIP.has(e.id) && !e.timed && !used.has(e.id) && (!ONLY_ON[e.id] || ONLY_ON[e.id].includes(focus)));
    const preferred = PREFER[focus]?.[m];
    // When a day wants a muscle trained a particular way and that isn't possible, it's left out.
    const pool = preferred ? all.filter((e) => preferred.includes(e.id)) : all;
    if (!pool.length) continue;
    // First pick for a muscle: the biggest compound. Later picks: isolation work. Staples and
    // exercises you already do come first; a little chance keeps days from all looking the same.
    const score = (e: CatalogExercise) => (nth === 0 ? compound(e) * 2 : -compound(e) * 1.5) + (STAPLE.has(e.id) ? 3 : 0) + (done.has(e.id) ? 2 : 0) + equipBonus(o.equip, e) + next() * 1.5;
    const pick = [...pool].sort((a, b) => score(b) - score(a))[0];
    used.add(pick.id); seenMuscle.set(m, nth + 1);
    items.push({ exId: pick.id, name: pick.name, muscle: m, ...prescription(o.goal, pick, nth === 0) });
  }
  if (core) {
    const abs = CATALOG.filter((e) => e.muscle === "abs" && allowed(o.equip, e, o.gear) && !used.has(e.id) && !SKIP.has(e.id) && e.id !== "mountain-climber");
    const pick = abs.map((e) => ({ e, k: (STAPLE.has(e.id) ? 2 : 0) + (done.has(e.id) ? 1 : 0) + next() })).sort((a, b) => b.k - a.k)[0]?.e;
    if (pick) items.push({ exId: pick.id, name: pick.name, muscle: "abs", ...prescription(o.goal, pick, false) });
  }
  // Longer workouts than eight exercises fill get more sets (the main lifts first, up to 5 and 4).
  for (let guard = 0; guard < 24 && items.length && est(items) < o.mins - 4; guard++) {
    const i = items.findIndex((x, k) => x.muscle !== "abs" && x.sets < (k === 0 ? 5 : 4) && items.every((y, j) => j === k || y.muscle === "abs" || y.sets >= x.sets || y.sets >= (j === 0 ? 5 : 4)));
    if (i < 0) break;
    items[i] = { ...items[i], sets: items[i].sets + 1 };
  }
  const muscles = uniq(items.map((i) => i.muscle));
  const mins = Math.round(items.reduce((t, i) => t + i.sets * (45 + i.rest), 0) / 60);
  // Why this workout: the group's main muscles and how recovered they are.
  const main = uniq(FOCUS_MUSCLES[focus]).filter((p) => muscles.includes(p)).slice(0, 3);
  const pcts = main.map((p) => `${PART_NAME[p].toLowerCase()} ${r[p].pct}%`).join(", ");
  const resting = uniq(FOCUS_MUSCLES[focus]).filter((p) => !plan.includes(p));
  const why = !main.length ? "" : (!o.focus || o.focus === "auto" ? `Your ${GROUP_NAME[focus]} are the most recovered: ${pcts}.` : `Recovered: ${pcts}.`)
    + (resting.length ? ` Resting ${resting.map((p) => PART_NAME[p].toLowerCase()).join(" and ")}.` : "");
  return { focus, title: `${FOCUS_LABEL[focus]} day`, muscles, items, mins, why };
}
