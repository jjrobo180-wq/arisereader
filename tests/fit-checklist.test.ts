// Cooked's "Finish your day" checklist (shared/fitChecklist.ts): built from goals, ticks itself from what was tracked.
import test from "node:test";
import assert from "node:assert/strict";
import { checklistStreak, cleanChecks, dayChecklist, toggleCheck } from "../shared/fitChecklist";
import { cleanFit, emptyFit, type FitData, type FoodEntry } from "../shared/fit";

const DAY = "2026-11-10";
const food = (meal: FoodEntry["meal"], kcal = 500, date = DAY): FoodEntry => ({ id: `${meal}${date}`, date, meal, name: meal, kcal, p: 20, c: 50, f: 10, servings: 1 });
const ids = (d: FitData, date = DAY, steps: number | null = null) => dayChecklist(d, date, steps).items.map((i) => i.id);

test("a new person gets food and water, nothing they don't use", () => {
  assert.deepEqual(ids(emptyFit()), ["food", "water"]);
});

test("food ticks itself once breakfast, lunch and dinner are logged, with the goal in the wording", () => {
  const d = emptyFit(); d.profile.goal = "lose"; d.profile.kcalGoal = 1800;
  assert.match(dayChecklist(d, DAY).items[0].label, /stay near your calorie goal/);
  d.foods = [food("breakfast"), food("lunch")];
  let f = dayChecklist(d, DAY).items[0];
  assert.equal(f.done, false); assert.match(f.detail, /2 of 3 meals/); assert.match(f.detail, /1,000 of 1,800 cal/);
  d.foods.push(food("dinner")); d.foods.push(food("snack"));
  f = dayChecklist(d, DAY).items[0];
  assert.equal(f.auto, true); assert.equal(f.done, true);
  d.profile.goal = "gain";
  assert.match(dayChecklist(d, DAY).items[0].label, /reach your calorie goal/);
});

test("people who fast only need two meals", () => {
  const d = emptyFit(); d.foods = [food("lunch"), food("dinner")];
  d.fasting = { protocol: "16:8", log: [] }; // a plan picked but never used: still three meals
  assert.equal(dayChecklist(d, DAY).items[0].done, false);
  d.fasting = { protocol: "16:8", log: [{ start: "2026-11-08T20:00:00", end: "2026-11-09T12:00:00", goalH: 16 }] };
  assert.equal(dayChecklist(d, DAY).items[0].done, true);
});

test("water ticks at the goal", () => {
  const d = emptyFit(); d.water[DAY] = 2499;
  assert.equal(dayChecklist(d, DAY).items.find((i) => i.id === "water")!.done, false);
  d.water[DAY] = 2500;
  assert.equal(dayChecklist(d, DAY).items.find((i) => i.id === "water")!.done, true);
});

test("training shows for program followers and recent trainers, and a workout today ticks it", () => {
  const d = emptyFit();
  assert.equal(ids(d).includes("workout"), false);
  d.workouts = [{ id: "w1", date: `${DAY}T09:00:00`, name: "Push", secs: 3000, exercises: [] }];
  const w = dayChecklist(d, DAY).items.find((i) => i.id === "workout")!;
  assert.equal(w.auto, true);
  // meditation sessions are not workouts
  d.workouts = [{ id: "m1", date: `${DAY}T09:00:00`, name: "Calm", programId: "session-meditation", secs: 300, exercises: [] }];
  assert.equal(ids(d).includes("workout"), false);
  d.program = { id: "any", started: DAY, done: [] };
  assert.equal(dayChecklist(d, DAY).items.find((i) => i.id === "workout")!.done, false);
});

test("steps only appear with Apple Health, and tick at the goal", () => {
  const d = emptyFit();
  assert.equal(ids(d).includes("steps"), false);
  assert.equal(dayChecklist(d, DAY, 3000).items.find((i) => i.id === "steps")!.done, false);
  assert.equal(dayChecklist(d, DAY, 8000).items.find((i) => i.id === "steps")!.done, true);
});

test("weigh-in shows with a goal weight until they weigh in that week", () => {
  const d = emptyFit(); d.profile.goalKg = 80;
  assert.equal(ids(d).includes("weight"), true);
  d.weights = [{ date: "2026-11-07", kg: 85 }];
  assert.equal(ids(d).includes("weight"), false);
  d.weights = [{ date: DAY, kg: 85 }];
  assert.equal(dayChecklist(d, DAY).items.find((i) => i.id === "weight")!.done, true);
});

test("sleep, fasting and medicines appear only when used, and tick from their logs", () => {
  const d = emptyFit();
  d.sleep = { goalH: 8, nights: [{ date: DAY, bed: 1, wake: 2 }] };
  d.fasting = { protocol: "16:8", log: [{ start: "2026-11-09T20:00:00", end: "2026-11-10T12:00:00", goalH: 16 }] };
  d.meds = { list: [{ id: "m", name: "Vit D", dose: "1", times: ["08:00", "20:00"], days: [0, 1, 2, 3, 4, 5, 6], note: "", supply: null, refillDays: 7, remind: false, color: "#fff" }], log: { [DAY]: { "m@08:00": "taken" } } };
  const by = (id: string) => dayChecklist(d, DAY).items.find((i) => i.id === id)!;
  assert.equal(by("sleep").done, true);
  assert.equal(by("fast").done, true);
  assert.equal(by("meds").done, false); assert.match(by("meds").detail, /1 of 2/);
  d.meds.log[DAY]["m@20:00"] = "skipped";
  assert.equal(by("meds").done, true);
});

test("ticking by hand toggles an item, can't hurt an auto tick, and is kept per day", () => {
  let d = emptyFit();
  d = toggleCheck(d, DAY, "food");
  assert.deepEqual(d.checks, { [DAY]: ["food"] });
  assert.equal(dayChecklist(d, DAY).items[0].hand, true);
  assert.equal(dayChecklist(d, "2026-11-11").items[0].done, false);
  d = toggleCheck(d, DAY, "food");
  assert.equal(d.checks, undefined);
});

test("the day is finished when every item is ticked, and finished days make a streak", () => {
  const d = emptyFit();
  const finish = (date: string) => { d.foods.push(food("breakfast", 400, date), food("lunch", 400, date), food("dinner", 400, date)); d.water[date] = 3000; };
  finish("2026-11-08"); finish("2026-11-09");
  assert.equal(dayChecklist(d, "2026-11-09").complete, true);
  assert.equal(checklistStreak(d, DAY, false), 2);
  assert.equal(checklistStreak(d, DAY, true), 3);
  assert.equal(checklistStreak(emptyFit(), DAY, false), 0);
});

test("hand ticks are cleaned for keeping, and survive cleanFit", () => {
  assert.equal(cleanChecks("nope"), undefined);
  assert.deepEqual(cleanChecks({ [DAY]: ["food", "food", "BAD ID", 5], "not-a-day": ["food"], "2026-11-11": [] }), { [DAY]: ["food"] });
  assert.deepEqual(cleanFit({ checks: { [DAY]: ["water"] } }).checks, { [DAY]: ["water"] });
  assert.equal(cleanFit({}).checks, undefined);
});

test("the checklist sits on Today in every layout", async () => {
  const { readFileSync } = await import("node:fs");
  const app = readFileSync("client/src/pages/fit/FitApp.tsx", "utf8");
  assert.equal((app.match(/\{logFood\}\{dayCard\}/g) || []).length, 6);
  assert.match(app, /import FitChecklist from "\.\/FitChecklist"/);
});
