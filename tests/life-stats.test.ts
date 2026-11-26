import { test } from "node:test";
import assert from "node:assert/strict";
import { lifeStats, correlate, buildSeries, type StatsInput } from "../shared/lifeStats.ts";
import { emptyLifeScore, lifeInputFrom, lifeScore, plusDays, cleanLifeScore } from "../shared/lifeScore.ts";
import { scoreScale, le8, adaRisk, vo2Read } from "../shared/lifeScales.ts";

const T = "2026-11-26";
const d = (i: number) => plusDays(T, -i);

function rich(): StatsInput {
  const ls = emptyLifeScore();
  ls.settings.birthYear = 1985; ls.settings.sex = "male"; ls.settings.heightIn = 70; ls.settings.assets = 50000; ls.settings.debts = 10000;
  for (let i = 0; i < 40; i++) {
    ls.health[d(i)] = { steps: 6000 + (i % 7) * 800, sleep: 6 + (i % 3), rhr: 60 + (i % 4), hrv: 40 + (i % 5), deep: 60, rem: 90, core: 200, awake: 20, bed: 270, wake: 390, vo2: 40, km: 5, flights: 8, active: 500, basal: 1700 };
    ls.days[d(i)] = { happy: 5 + (i % 3), stress: 4, energy: 6, screen: 3, outdoors: 30, produce: 4, together: i % 2 === 0, faith: true, connect: 7 };
  }
  ls.scales = { who5: [{ date: T, answers: [4, 4, 3, 3, 4] }], phq2: [{ date: T, answers: [0, 1] }] };
  ls.labs = [{ date: T, sys: 118, dia: 76, total: 190, hdl: 55, a1c: 5.4 }];
  const family = {
    moods: Array.from({ length: 20 }, (_, i) => ({ memberId: "", date: d(i), mood: 3 + (i % 3), tags: i % 2 ? ["Exercise"] : ["Work"], note: "" })),
    journal: [{ date: T, title: "A good day", body: "Grateful for family and the walk", mood: "", createdAt: T }],
    gratitude: [{ date: T, items: ["family", "coffee"] }],
    habits: [{ id: "h", name: "Read", emoji: "📖", color: "#000", days: [T, d(1), d(2)] }],
    goals: [{ title: "Run a 5K", done: false, kind: "number", target: 10, current: 4, unit: "km", milestones: [], due: plusDays(T, 30) }],
    expenses: [{ date: T, amount: 40, categoryId: "f", note: "Groceries" }, { date: d(40), amount: 100, categoryId: "f", note: "" }],
    budget: [{ id: "f", name: "Food", limit: 600 }],
    subscriptions: [{ name: "Music", amount: 10, cycle: "monthly" }],
    health: { food: [{ date: T, meal: "lunch", name: "Chicken salad", servings: 1, calories: 500, protein: 40, carbs: 20, fat: 25 }] },
    birthdays: [{ name: "Mom", month: 12, day: 25, year: 1960, kind: "birthday" }],
    events: [{ title: "Dentist", date: plusDays(T, 2), time: "09:00" }],
  };
  const fit = { profile: { kcalGoal: 2200, units: "lb" }, foods: Array.from({ length: 10 }, (_, i) => ({ date: d(i), meal: "dinner", name: "Rice bowl", kcal: 700, p: 35, c: 90, f: 20, servings: 1 })), water: { [T]: 2000 }, weights: [{ date: d(60), kg: 90 }, { date: T, kg: 88 }], workouts: [{ date: T, secs: 3600, exercises: [{ name: "Bench press", sets: [{ reps: 5, weight: 185, done: true }] }] }] };
  const tasks = [
    { title: "Pay rent", due: T, done: true, createdAt: `${d(2)}T09:00:00Z`, completedAt: `${T}T15:00:00Z`, list: "Home", hub: "LifeHub" as const },
    { title: "Grade essays", due: d(3), done: false, hub: "WorkHub" as const },
    { title: "Call plumber", due: d(1), done: false, list: "Home", hub: "LifeHub" as const },
  ];
  const input = { today: T, family: { ...family, lifeScore: ls }, tasks, fit, ls, work: { students: [{}, {}], meetings: [{ date: plusDays(T, 1) }], lessons: [{ date: T }] } } as StatsInput;
  input.score = lifeScore(lifeInputFrom(input.family, []), T);
  return input;
}

test("every part of life gets a section, with numbers and charts", () => {
  const r = lifeStats(rich());
  const ids = r.sections.map((s) => s.id);
  for (const id of ["you", "tasks", "food", "activity", "sleep", "heart", "body", "mind", "measures", "people", "growth", "money", "time", "home", "work", "scores"]) assert.ok(ids.includes(id), id);
  const sec = (id: string) => r.sections.find((s) => s.id === id)!;
  for (const id of ["you", "tasks", "food", "activity", "sleep", "heart", "mind", "money"]) assert.ok(sec(id).stats.length >= 4 && sec(id).charts.length >= 1, `${id}: ${sec(id).stats.length} stats`);
  const stat = (id: string, label: string) => sec(id).stats.find((s) => s.label === label)?.value;
  assert.equal(stat("tasks", "Done today"), "1");
  assert.equal(stat("tasks", "Open now"), "2");
  assert.equal(stat("food", "Calories today"), "1,200"); // Cooked 700 + LifeHub diary 500
  assert.equal(stat("money", "Net worth"), "$40,000");
  assert.match(stat("heart", "Fitness age")!, /^\d+$/);
  assert.ok(sec("tasks").charts.some((c) => c.kind === "donut"), "LifeHub vs WorkHub");
  assert.ok(r.records.length >= 5);
  const total = r.sections.reduce((a, s) => a + s.stats.length + s.charts.length, 0);
  assert.ok(total >= 120, `only ${total} stats and charts`);
});

test("nothing tracked: sections say how to fill them, nothing invented", () => {
  const ls = emptyLifeScore();
  const r = lifeStats({ today: T, family: {}, tasks: [], ls });
  assert.ok(r.sections.every((s) => s.stats.length || s.empty !== undefined || s.id === "you" || s.id === "scores"));
  assert.equal(r.series.length, 0);
});

test("the Explorer compares any two days-series", () => {
  const s = buildSeries(rich());
  assert.ok(s.length >= 25, `${s.length} series`);
  const a = { id: "a", name: "A", unit: "", group: "", values: {} as Record<string, number> }, b = { ...a, id: "b", name: "B", values: {} as Record<string, number> };
  for (let i = 0; i < 10; i++) { a.values[d(i)] = i; b.values[d(i)] = i * 2 + 1; }
  assert.equal(correlate(a, b).r, 1);
  assert.equal(correlate(a, { ...b, values: {} }).r, null);
});

test("validated measures and health scores", () => {
  assert.equal(scoreScale("who5", [5, 5, 5, 5, 5]).score, 100);
  assert.equal(scoreScale("who5", [1, 1, 1, 1, 1]).tone, "alert");
  assert.equal(scoreScale("phq2", [2, 1]).tone, "alert");
  assert.equal(scoreScale("pss4", [4, 0, 0, 4]).score, 16); // two reversed
  assert.equal(scoreScale("ladder", [8, 9]).label, "Thriving");
  const l = le8({ activityMin: 150, nicotine: "never", sleepH: 7.5, bmi: 23, nonHdl: 120, a1c: 5.2, sys: 115, dia: 75, dietApprox: 80 });
  assert.equal(l.score, 98);
  assert.equal(le8({ sys: 135, dia: 70 }).parts.find((p) => p.id === "bp")!.score, 50);
  assert.equal(adaRisk({ age: 52, sex: "male", active: false, bmi: 31 })!.points, 6);
  assert.equal(adaRisk({ age: 30, sex: "female", active: true, bmi: 22 })!.high, false);
  const v = vo2Read(48, 45, "male");
  assert.ok(v.fitAge < 45 && /Excellent|Superior/.test(v.band), JSON.stringify(v));
});

test("the extra Apple Health readings, questionnaires and labs are kept", () => {
  const c = cleanLifeScore({ health: { [T]: { deep: 70, vo2: 41.27, woKinds: ["Running", 4], spo2: 140 } }, scales: { who5: [{ date: T, answers: [9, 2] }] }, labs: [{ date: T, sys: 120, dia: 80, junk: 1 }], settings: { nicotine: "never", heightIn: 70 } })!;
  assert.deepEqual(c.health[T], { deep: 70, vo2: 41.3, woKinds: ["Running"], spo2: 100 });
  assert.deepEqual(c.scales!.who5![0].answers, [5, 2, 0, 0, 0]);
  assert.deepEqual(c.labs, [{ date: T, sys: 120, dia: 80 }]);
  assert.equal(c.settings.nicotine, "never");
});

test("Life Score reads every hub, the food diary and all of Apple Health, and says so in the permission sentence", async () => {
  const { readFileSync } = await import("node:fs");
  const todo = readFileSync("client/src/pages/AriseTodo.tsx", "utf8");
  assert.match(todo, /shown === "lifescore" \? <LifeScoreApp \{\.\.\.appProps\} token=\{token\} lifeTasks=\{data\.tasks\} lists=\{data\.lists\} familySpace=\{familySpace\} \/>/);
  const app = readFileSync("client/src/components/family-hub/LifeScoreApp.tsx", "utf8");
  for (const p of ["/api/fit/data", "/api/teacher-hub/workspace", "/api/family-space/workspace", "/api/arise-todo/workspace"]) assert.ok(app.includes(p), p);
  for (const t of ["Score", "Stats", "Explore", "Records", "Check in"]) assert.ok(app.includes(`label: "${t}"`), t);
  const reads = readFileSync("client/src/lib/lifeScoreHealth.ts", "utf8");
  for (const k of ["vo2Max", "oxygenSaturation", "bloodPressure", "dietaryEnergyConsumed", "dietaryWater", "flightsClimbed", "exerciseTime", "appleStandHour", "queryWorkouts", "appleSleepingWristTemperature"]) assert.ok(reads.includes(k), k);
  assert.match(reads, /write: \[\]/);
  const plist = readFileSync("arisetodo/ios-app/configure-ios.py", "utf8");
  for (const w of ["VO2 max", "blood pressure", "blood oxygen", "workouts", "Life Score"]) assert.ok(plist.includes(w), w);
});

test("food from the Health & Fitness diary counts in the Nutrition score", () => {
  const ls = emptyLifeScore();
  const input = { ...lifeInputFrom({ lifeScore: ls }, []), fit: { profile: { kcalGoal: 2000 }, weights: [{ date: T, kg: 80 }], foods: [{ date: T, kcal: 2000, p: 80, c: 0, f: 0, servings: 1 }] } };
  const r = lifeScore(input, T);
  assert.equal(r.metrics.find((m) => m.id === "nutrition")!.score, 100);
});
