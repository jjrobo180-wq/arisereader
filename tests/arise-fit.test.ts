// Arise Fit (shared/fit.ts, server/fit.ts): the math, what's kept, the programs and the library.
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { CATALOG, CATALOG_BY_ID, PROGRAMS, cleanFit, e1rm, emptyFit, goals, newRecords, nextProgramDay, nextTime, plates, records, repRange, streak, type Workout } from "../shared/fit";
import { createMemoryFitStore, fromWger, mergeLibrary, registerFitRoutes } from "../server/fit";

const w = (id: string, date: string, exId: string, sets: [number, number][]): Workout => ({ id, date, name: "W", secs: 1800, exercises: [{ exId, name: exId, sets: sets.map(([weight, reps]) => ({ weight, reps, done: true })) }] });

test("estimated max, plates and rep ranges", () => {
  assert.equal(Math.round(e1rm(225, 5)), 263);
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(100, 20), 0, "too many reps to estimate");
  assert.deepEqual(plates(225, "lb"), { plates: [45, 45], left: 0 });
  assert.deepEqual(plates(185, "lb").plates, [45, 25]);
  assert.deepEqual(plates(100, "kg").plates, [25, 15]);
  assert.deepEqual(repRange("8-12"), { lo: 8, hi: 12 });
  assert.equal(repRange("45s").secs, 45);
  assert.equal(repRange("AMRAP").hi, 99);
});

test("progression: add weight only when every set hit the top of the range", () => {
  const hit = w("1", "2026-10-01", "bench-press", [[135, 5], [135, 5], [135, 5]]).exercises[0];
  const miss = w("2", "2026-10-03", "bench-press", [[135, 5], [135, 5], [135, 3]]).exercises[0];
  assert.equal(nextTime(hit, "5", "lb", false)?.weight, 140);
  assert.equal(nextTime(hit, "5", "lb", true)?.weight, 145, "lower body jumps more");
  assert.equal(nextTime(miss, "5", "lb", false)?.weight, 135);
  assert.equal(nextTime(hit, "5", "kg", false)?.weight, 137.5);
});

test("records: only a beaten best counts, not a first time", () => {
  const before = [w("1", "2026-10-01", "back-squat", [[225, 5]])];
  assert.equal(records(before).get("back-squat")?.weight, 225);
  assert.deepEqual(newRecords(before, w("2", "2026-10-03", "back-squat", [[235, 5]])).map((r) => r.kind), ["e1rm"]);
  assert.deepEqual(newRecords(before, w("3", "2026-10-03", "deadlift", [[315, 5]])), []);
});

test("calorie and macro goals follow the person and their goal", () => {
  const p = { ...emptyFit().profile, sex: "m" as const, birthYear: 1996, heightCm: 180, activity: 1.55, goal: "maintain" as const };
  const g = goals(p, 80, new Date("2026-10-31"));
  assert.ok(g.tdee > 2600 && g.tdee < 2900, String(g.tdee));
  assert.ok(goals({ ...p, goal: "lose" }, 80, new Date("2026-10-31")).kcal < g.kcal);
  assert.equal(goals({ ...p, kcalGoal: 2000 }, 80).kcal, 2000);
  assert.equal(Math.round((g.p * 4 + g.c * 4 + g.f * 9) / 50), Math.round(g.kcal / 50), "macros add up to the calories");
});

test("what's kept is cleaned: unknown fields dropped, numbers in range, lists capped", () => {
  const d = cleanFit({ profile: { units: "kg", goal: "nope", activity: 9 }, workouts: [{ id: "a", date: "2026-10-01", name: "x".repeat(500), secs: -5, exercises: [{ exId: "bench-press", sets: [{ reps: 5, weight: 99999, done: 1 }] }] }], hacked: true, foods: [{ id: "f", date: "bad", name: "x" }] });
  assert.equal(d.profile.units, "kg"); assert.equal(d.profile.goal, "maintain"); assert.equal(d.profile.activity, 1.95);
  assert.equal(d.workouts[0].name.length, 80); assert.equal(d.workouts[0].secs, 0); assert.equal(d.workouts[0].exercises[0].sets[0].weight, 2000);
  assert.equal((d as any).hacked, undefined); assert.equal(d.foods.length, 0, "a food needs a real date");
});

test("every program's exercises are in the catalog; days rotate and weeks count up", () => {
  for (const p of PROGRAMS) for (const day of p.days) for (const it of day.items) assert.ok(CATALOG_BY_ID.has(it.exId), `${p.id}: ${it.exId}`);
  assert.ok(CATALOG.length >= 100, `catalog has ${CATALOG.length}`);
  assert.equal(new Set(CATALOG.map((e) => e.id)).size, CATALOG.length, "ids are unique");
  const p = PROGRAMS.find((x) => x.id === "starter-strength")!;
  assert.equal(nextProgramDay(p, []).day.id, "a");
  assert.equal(nextProgramDay(p, ["a@1"]).day.id, "b");
  assert.equal(nextProgramDay(p, ["a", "b", "a"]).week, 2);
});

test("streak counts days in a row with something logged", () => {
  const d = { ...emptyFit(), workouts: [w("1", "2026-10-31T10:00:00", "plank", [[0, 1]]), w("2", "2026-10-30T10:00:00", "plank", [[0, 1]])], foods: [{ id: "f", date: "2026-10-29", meal: "lunch" as const, name: "x", kcal: 1, p: 0, c: 0, f: 0, servings: 1 }] };
  assert.equal(streak(d, new Date("2026-10-31T20:00:00")), 3);
});

test("wger exercises: English name, muscles, equipment and credited photos; ours come first", () => {
  const e = fromWger({ id: 73, category: { name: "Chest" }, muscles: [{ name_en: "Chest", name: "Pectoralis major" }], muscles_secondary: [{ name_en: "Triceps" }], equipment: [{ name: "Dumbbell" }],
    images: [{ image: "https://wger.de/media/a.png", is_main: false, license: 2, license_author: "Everkinetic" }, { image: "https://wger.de/media/b.png", is_main: true, license: { id: 1 }, license_author: "Someone" }],
    translations: [{ language: 1, name: "Bankdrücken" }, { language: 2, name: "Dumbbell Fly Variation", description: "<p>Lie on a bench.</p><p>Open your arms wide.</p>" }] })!;
  assert.equal(e.name, "Dumbbell Fly Variation"); assert.equal(e.muscle, "chest"); assert.deepEqual(e.also, ["triceps"]); assert.equal(e.equipment, "dumbbell");
  assert.equal(e.images[0].url, "https://wger.de/media/b.png", "main photo first"); assert.equal(e.images[0].credit, "Someone"); assert.match(e.images[1].license, /CC BY-SA 4.0/);
  assert.deepEqual(e.cues, ["Lie on a bench.", "Open your arms wide."]);
  assert.equal(fromWger({ translations: [{ language: 1, name: "nur Deutsch" }] }), null);
  const lib = mergeLibrary([e, { ...e, id: "wger-1", name: "Bench Press", images: [{ url: "https://wger.de/x.png", credit: "c", license: "CC0" }] }]);
  assert.equal(lib[0].source, "arise");
  assert.equal(lib.find((x) => x.name === "Bench Press")?.images.length, 1, "our Bench Press borrows wger's photo");
  assert.equal(lib.filter((x) => x.name === "Bench Press").length, 1, "no duplicate");
});

test("routes: your data saves and loads, cleaned; the library falls back to ours if wger is down", async () => {
  const app = express(); app.use(express.json({ limit: "4mb" }));
  const auth = (req: any, _res: any, next: any) => { req.user = { id: Number(req.headers["x-user"] || 1) }; next(); };
  registerFitRoutes(app, auth, { store: createMemoryFitStore(), fetchJson: async () => { throw new Error("down"); } });
  const srv = app.listen(0); const base = `http://127.0.0.1:${(srv.address() as any).port}`;
  try {
    assert.deepEqual((await (await fetch(`${base}/api/fit/data`)).json()).data.workouts, []);
    const put = await fetch(`${base}/api/fit/data`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { ...emptyFit(), weights: [{ date: "2026-10-31", kg: 80 }], junk: 1 } }) });
    assert.equal(put.status, 200);
    const got = (await (await fetch(`${base}/api/fit/data`)).json()).data;
    assert.deepEqual(got.weights, [{ date: "2026-10-31", kg: 80 }]); assert.equal(got.junk, undefined);
    assert.deepEqual((await (await fetch(`${base}/api/fit/data`, { headers: { "x-user": "2" } })).json()).data.weights, [], "each person sees only their own");
    const lib = await (await fetch(`${base}/api/fit/exercises`)).json();
    assert.equal(lib.partial, true); assert.equal(lib.exercises.length, CATALOG.length);
  } finally { srv.close(); }
});
