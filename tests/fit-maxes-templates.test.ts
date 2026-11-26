// Cooked: My maxes (entered and updated by hand, with history) and workout templates people build.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanFit, emptyFit, toKg, type FitData, type Workout } from "../shared/fit";
import { cleanMaxes, enteredOneRm, loggedOnly, maxRows, percentOf, strength, workingWeight, type MaxEntry } from "../shared/fitMaxes";
import { FIT_APP_BY_ID, defaultApps } from "../shared/fitApps";
import { superAppOf } from "../shared/superApps";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const bench = (kg: number, reps: number, date: string, id = date): MaxEntry => ({ id, exId: "bench", name: "Bench press", kg, reps, date });

test("maxes are kept as a history, cleaned, and the best one wins", () => {
  const raw = [bench(100, 1, "2026-01-02", "a"), bench(90, 5, "2026-03-01", "b"), { id: "x", exId: "squat", name: "Squat", kg: 0, reps: 0, date: "2026-01-01" }, { id: "y", exId: "plank", name: "Plank", kg: 0, reps: 0, secs: 150, date: "2026-02-02" }, { nope: 1 }];
  const list = cleanMaxes(raw);
  assert.deepEqual(list.map((m) => m.id), ["a", "b", "y"], "an empty max and junk are dropped");
  const d = cleanFit({ ...emptyFit(), maxes: raw });
  assert.equal(d.maxes?.length, 3);
  assert.equal(cleanFit(emptyFit()).maxes, undefined, "no maxes, no field");
  const rows = maxRows(list, [], "kg");
  const b = rows.find((r) => r.exId === "bench")!;
  assert.equal(b.latest!.id, "b", "newest entry");
  assert.equal(b.best!.id, "b", "90 × 5 (about 105 for one) beats 100 × 1");
  assert.equal(Math.round(b.oneRm), 105);
  assert.equal(b.history.length, 2);
  assert.equal(strength({ kg: 0, reps: 0, secs: 150 }), 150);
});

test("a max stays the same when switching lb and kg, and gives weights to train at", () => {
  const list = [bench(toKg(225, "lb"), 1, "2026-01-02")];
  assert.equal(Math.round(enteredOneRm(list, "bench", "lb")), 225);
  assert.equal(Math.round(enteredOneRm(list, "bench", "kg")), 102);
  assert.equal(percentOf(225, 70, "lb"), 160, "70% rounded to 5 lb");
  assert.equal(workingWeight(225, 8, "lb"), 160, "about 8 reps at 90% effort");
  assert.equal(workingWeight(0, 8, "lb"), 0);
});

test("logged workouts count, and their best sets can be kept as a max in one tap", () => {
  const w: Workout = { id: "w", date: "2026-04-01T10:00:00Z", name: "Push", secs: 1800, exercises: [{ exId: "bench", name: "Bench press", sets: [{ reps: 3, weight: 110, done: true }] }, { exId: "ohp", name: "Overhead press", sets: [{ reps: 5, weight: 50, done: true }] }] };
  const rows = maxRows([bench(100, 1, "2026-01-02")], [w], "kg");
  assert.ok(rows[0].oneRm > 110, "a heavier logged set beats the entered max");
  assert.deepEqual(loggedOnly([bench(100, 1, "2026-01-02")], [w]).map((x) => x.exId), ["ohp"]);
});

test("templates keep their weights and notes, and new workouts start from a template's weight or the max", () => {
  const d = cleanFit({ ...emptyFit(), routines: [{ id: "t", name: "Push day", note: "Superset the last two", used: "2026-05-01", uses: 3, exercises: [{ exId: "bench", name: "Bench press", sets: 4, reps: "5", rest: 120, weight: 185, note: "pause" }, { exId: "fly", name: "Fly", sets: 3, reps: "12", rest: 60 }] }] });
  const t = d.routines[0];
  assert.equal(t.note, "Superset the last two"); assert.equal(t.uses, 3); assert.equal(t.used, "2026-05-01");
  assert.equal(t.exercises[0].weight, 185); assert.equal(t.exercises[0].note, "pause"); assert.equal(t.exercises[1].weight, undefined);
  const train = read("client/src/pages/fit/FitTrain.tsx");
  assert.match(train, /const weight = it\.weight && it\.weight > 0 \? it\.weight : sug\?\.weight \?\? fromMax;/);
  assert.match(train, /setRoutine\(templateFrom\(past\)\)/, "a past workout can be saved as a template");
  const ui = read("client/src/pages/fit/FitMaxes.tsx");
  assert.match(ui, /export function templateFrom\(w: Workout\): Routine/);
  assert.match(ui, /data-testid=\{`fit-template-weight-\$\{i\}`\}/);
});

test("My maxes and Workout templates are Cooked plugins, on the Train tab, and pages in To Do", () => {
  for (const id of ["maxes", "templates"] as const) assert.ok(FIT_APP_BY_ID.get(id)?.tab, id);
  assert.ok(defaultApps().added.includes("maxes") && defaultApps().added.includes("templates"), "new people start with them");
  const app = read("client/src/pages/fit/FitApp.tsx");
  assert.match(app, /case "maxes": return <MaxesApp /);
  assert.match(app, /case "templates": return <TemplatesApp /);
  assert.match(app, /onMaxes=\{\(\) => openApp\("maxes"\)\} onTemplates=\{\(\) => openApp\("templates"\)\}/);
  const pages = superAppOf("cooked")!.pages.map((p) => p.id);
  assert.ok(pages.includes("maxes") && pages.includes("templates"));
  const _d: FitData = emptyFit(); void _d;
});

// ——— Refined: maxes come from logged workouts by themselves, with a chart; templates follow workouts and merge cleanly. ———
import { templateAfterWorkout } from "../shared/fit";
import { maxTimeline } from "../shared/fitMaxes";
import { merge3 } from "../shared/mergeJson";

const sess = (date: string, weight: number, reps: number, exId = "bench"): Workout => ({ id: date, date: `${date}T10:00:00Z`, name: "Push", secs: 1200, exercises: [{ exId, name: exId === "bench" ? "Bench press" : "Squat", sets: [{ reps: 5, weight: 45, done: true, warm: true }, { reps, weight, done: true }, { reps: 8, weight: 999, done: false }] }] });

test("every lift logged shows on My maxes by itself, the newest first, and a heavier logged set wins over an entered max", () => {
  const rows = maxRows([bench(80, 1, "2026-01-01")], [sess("2026-02-01", 100, 3), sess("2026-03-01", 140, 5, "squat")], "kg");
  assert.deepEqual(rows.map((r) => [r.exId, r.source]), [["squat", "logged"], ["bench", "logged"]]);
  assert.equal(rows[1].date, "2026-02-01");
  const entered = maxRows([bench(120, 1, "2026-02-05")], [sess("2026-02-01", 100, 3)], "kg")[0];
  assert.equal(entered.source, "entered", "an entered max that's stronger is the one shown");
  assert.equal(entered.oneRm, 120);
});

test("the max chart: best per day from workouts and entered maxes, the best so far only goes up, and the gain", () => {
  const t = maxTimeline("bench", [bench(90, 1, "2026-01-05")], [sess("2026-01-01", 80, 1), sess("2026-01-10", 85, 1), sess("2026-01-20", 95, 1)], "kg");
  assert.deepEqual(t.points.map((p) => [p.date, p.day, p.best]), [["2026-01-01", 80, 80], ["2026-01-05", 90, 90], ["2026-01-10", 85, 90], ["2026-01-20", 95, 95]]);
  assert.equal(t.gain, 15);
  assert.ok(!t.points.some((p) => p.day >= 999), "unchecked sets don't count");
  assert.deepEqual(maxTimeline("bench", [], [], "kg"), { points: [], gain: 0 });
});

test("finishing a workout from a template moves the template's own weights to today's top set; auto stays auto", () => {
  const r = { id: "t", name: "Push", exercises: [{ id: "a", exId: "bench", name: "Bench press", sets: 3, reps: "5", rest: 120, weight: 90 }, { id: "b", exId: "squat", name: "Squat", sets: 3, reps: "5", rest: 120 }] };
  const w: Workout = { id: "w", date: "2026-02-01T10:00:00Z", name: "Push", routineId: "t", secs: 1, exercises: [sess("x", 95, 5).exercises[0], sess("x", 140, 5, "squat").exercises[0]] };
  const next = templateAfterWorkout(r, w)!;
  assert.equal(next.exercises[0].weight, 95);
  assert.equal(next.exercises[1].weight, undefined, "auto stays auto");
  assert.equal(templateAfterWorkout({ ...r, exercises: [{ ...r.exercises[0], weight: 95 }] }, w), null, "nothing changed: no save");
  assert.equal(cleanFit({ ...emptyFit(), workouts: [w] }).workouts[0].routineId, "t", "the workout remembers its template");
});

test("templates sync between phones exercise by exercise: every exercise has an id, the same on every device", () => {
  const raw = { ...emptyFit(), routines: [{ id: "t", name: "Push", exercises: [{ exId: "bench", name: "Bench", sets: 3, reps: "5", rest: 90, weight: 100 }, { exId: "fly", name: "Fly", sets: 3, reps: "12", rest: 60 }] }] };
  const base = cleanFit(raw), again = cleanFit(raw);
  assert.deepEqual(base.routines[0].exercises.map((e) => e.id), ["t-0", "t-1"]);
  assert.deepEqual(again.routines[0].exercises.map((e) => e.id), ["t-0", "t-1"]);
  // Phone A changes the bench weight; phone B changes the fly reps at the same time.
  const a = structuredClone(base); a.routines[0].exercises[0].weight = 105;
  const b = structuredClone(base); b.routines[0].exercises[1].reps = "15";
  const merged = cleanFit(merge3(base, a, b));
  assert.equal(merged.routines[0].exercises.length, 2, "no doubled exercises");
  assert.equal(merged.routines[0].exercises[0].weight, 105);
  assert.equal(merged.routines[0].exercises[1].reps, "15");
  assert.equal(cleanFit({ ...emptyFit(), routines: [{ name: "No id", exercises: [] }] }).routines[0].id, "routine-0", "a template always has an id");
});

test("the screens: My maxes lists logged lifts with a chart, the button counts them, templates start with their id and sync after", () => {
  const ui = read("client/src/pages/fit/FitMaxes.tsx");
  assert.match(ui, /<Title>Max over time<\/Title>/);
  assert.match(ui, /maxTimeline\(row\.exId, data\.maxes \?\? \[\], data\.workouts, units\)/);
  assert.match(ui, /startWorkout\(\{ name: r\.name, routineId: r\.id, exercises: planned\(data, r\.exercises, list\) \}\)/);
  const train = read("client/src/pages/fit/FitTrain.tsx");
  assert.match(train, /\{maxSummary\(data\)\}/);
  assert.match(train, /templateAfterWorkout\(r, w\) \?\? r/);
  assert.match(train, /updated with today's weights/);
});
