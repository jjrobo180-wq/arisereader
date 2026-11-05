import test from "node:test";
import assert from "node:assert/strict";
import { computeInsights, digestForAi, slope } from "../shared/fitInsights";
import { dayKey, emptyFit, type FitData } from "../shared/fit";

const NOW = new Date("2026-11-04T12:00:00");
const dayAgo = (n: number) => { const d = new Date(NOW); d.setDate(d.getDate() - n); return d; };
function sample(): FitData {
  const d = emptyFit();
  d.profile.units = "lb"; d.profile.goal = "lose"; d.profile.goalKg = 80; d.profile.heightCm = 180;
  d.workouts = [0, 2, 4, 7, 9, 14, 21].map((n, i) => ({ id: `w${i}`, date: dayAgo(n).toISOString(), name: "Push", secs: 3000, exercises: [{ exId: "barbell-bench-press", name: "Bench Press", sets: [{ reps: 8, weight: 135 + (7 - i) * 0 + (6 - i) * 5, done: true }, { reps: 5, weight: 100, done: true, warm: true }] }] }));
  d.workouts.push({ id: "y", date: dayAgo(1).toISOString(), name: "Yoga", secs: 1800, programId: "session-yoga", exercises: [] });
  d.weights = [{ date: dayKey(dayAgo(30)), kg: 92 }, { date: dayKey(dayAgo(15)), kg: 91 }, { date: dayKey(dayAgo(7)), kg: 90.4 }, { date: dayKey(dayAgo(0)), kg: 89.8 }];
  d.water[dayKey(NOW)] = 1500;
  d.foods = [{ id: "f", date: dayKey(NOW), meal: "lunch", name: "Chicken", kcal: 400, p: 40, c: 0, f: 10, servings: 2 }];
  return d;
}

test("slope is the straight-line trend", () => {
  assert.equal(slope([1, 2, 3, 4]), 1);
  assert.equal(slope([5]), 0);
});

test("insights count strength workouts apart from yoga sessions and never divide by zero", () => {
  const i = computeInsights(sample(), NOW);
  assert.equal(i.train.total, 7);
  assert.equal(i.train.sessionsTotal, 1);
  assert.equal(i.train.week, 2); // Wed Nov 4 and Mon Nov 2
});

test("weights, trends and forecast", () => {
  const i = computeInsights(sample(), NOW);
  assert.ok(i.body.change30! < 0);
  assert.ok(i.body.weeklyKg! < 0);
  assert.ok(i.forecast.weightIn4w! < i.body.kg! * 2.20462);
  assert.equal(i.forecast.onPace, true);
  assert.ok(i.strength.lifts[0].e1rm > 0);
  assert.equal(i.food.today.kcal, 800);
  assert.equal(i.food.today.p, 80);
  assert.equal(i.water.todayMl, 1500);
});

test("empty data gives zeros, not NaN", () => {
  const i = computeInsights(emptyFit(), NOW);
  assert.equal(i.train.total, 0);
  assert.equal(i.train.restDays, null);
  assert.equal(i.body.kg, null);
  assert.ok(!JSON.stringify(i).includes("null,null,NaN") && !JSON.stringify(i).includes("NaN"));
  assert.ok(digestForAi(emptyFit(), NOW).includes("TRAINING"));
});

test("the AI digest carries lifts and stays a sensible size", () => {
  const t = digestForAi(sample(), NOW);
  assert.match(t, /Bench Press/);
  assert.match(t, /FORECAST/);
  assert.ok(t.length < 9001);
});
