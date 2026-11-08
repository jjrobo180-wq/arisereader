import test from "node:test";
import assert from "node:assert/strict";
import { checkInTips, readyPlan, warmupFor } from "../shared/fitReadyMode";
import { emptyFit, type FitExercise } from "../shared/fit";

const plan = (): FitExercise[] => [
  { exId: "back-squat", name: "Back Squat", sets: [1, 2, 3, 4].map(() => ({ reps: 5, weight: 225, done: false })), rest: 120 },
  { exId: "rdl", name: "RDL", sets: [1, 2, 3].map(() => ({ reps: 8, weight: 135, done: false })), rest: 90 },
];
const NOW = new Date("2026-11-04T17:00:00");

test("a poorly slept, sore day gets lighter and every change is explained", () => {
  const d = emptyFit();
  d.sleep = { goalH: 8, nights: [{ date: "2026-11-04", bed: Date.parse("2026-11-04T03:00:00"), wake: Date.parse("2026-11-04T07:00:00") }] } as any;
  d.workouts = [0, 1, 2].map((n) => ({ id: `w${n}`, date: new Date(NOW.getTime() - (n + 0.3) * 864e5).toISOString(), name: "Legs", secs: 3600, exercises: plan().map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: true })) })) }));
  const p = readyPlan(d, plan(), NOW);
  assert.ok(p.score < 60, String(p.score));
  assert.ok(p.exercises[0].sets.length < 4);
  assert.ok(p.exercises[0].sets[0].weight < 225);
  assert.ok(p.changes.length > 0 && p.why.some((w) => /slept 4\.0 h/.test(w)), JSON.stringify(p));
});

test("a fresh day keeps or pushes the plan; done sets are never touched", () => {
  const d = emptyFit();
  const ex = plan(); ex[0].sets[0].done = true;
  const p = readyPlan(d, ex, NOW);
  assert.ok(p.level === "push" || p.level === "train");
  assert.equal(p.exercises[0].sets[0].weight, 225);
  assert.equal(p.exercises[0].sets.length, 4);
});

test("check-in tips and warm-up pick", () => {
  assert.ok(checkInTips({ food: "fasted", stim: "preworkout" }, 18).length >= 3);
  assert.equal(warmupFor(plan()), "mob-hips");
});
