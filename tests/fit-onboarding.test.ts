import test from "node:test";
import assert from "node:assert/strict";
import { cleanFit, emptyFit, goals, paceKcal } from "../shared/fit";
import { PACES, cmToFtIn, defaultPace, finishDate, ftInToCm, goalWeightFits, planFor, weeksToGoal } from "../shared/fitOnboard";
import { amountText } from "../shared/fitNutrition";

test("feet and inches convert both ways", () => {
  assert.equal(ftInToCm(5, 9), 175);
  assert.equal(ftInToCm(6, 0), 183);
  assert.deepEqual(cmToFtIn(175), { ft: 5, inch: 9 });
  assert.deepEqual(cmToFtIn(182.9), { ft: 6, inch: 0 });
  assert.deepEqual(cmToFtIn(ftInToCm(5, 11)), { ft: 5, inch: 11 });
});

test("weeks to a goal weight and the date it lands on", () => {
  assert.equal(weeksToGoal(90, 80, 0.5), 20);
  assert.equal(weeksToGoal(80, 80, 0.5), 0);
  assert.equal(weeksToGoal(0, 80, 0.5), null);
  assert.equal(weeksToGoal(90, 80, 0), null);
  assert.equal(finishDate(2, new Date(2026, 10, 1)).getDate(), 15);
  assert.equal(goalWeightFits("lose", 90, 80), true);
  assert.equal(goalWeightFits("lose", 80, 90), false);
  assert.equal(goalWeightFits("gain", 70, 75), true);
  assert.equal(goalWeightFits("maintain", 70, 90), true);
  assert.ok(PACES.lose.length >= 3 && PACES.gain.length >= 2);
  assert.equal(defaultPace("lose"), 0.5);
});

test("a faster pace means fewer calories, but never under a safe floor", () => {
  const base = { goal: "lose" as const, activity: 1.45, units: "lb" as const, waterGoalMl: 2500, stepsGoal: 8000, sex: "m" as const, birthYear: 1995, heightCm: 180 };
  const easy = goals({ ...base, pace: 0.25 }, 90).kcal, steady = goals({ ...base, pace: 0.5 }, 90).kcal, fast = goals({ ...base, pace: 1 }, 90).kcal;
  assert.ok(easy > steady && steady > fast, `${easy} ${steady} ${fast}`);
  assert.ok(fast >= 1500);
  assert.equal(paceKcal({ goal: "lose", sex: "f", pace: 1 }, 1100), 1100); // never above maintenance
  assert.equal(paceKcal({ goal: "lose", sex: "f", pace: 1 }, 2000), 1200);
  assert.equal(paceKcal({ goal: "maintain", pace: 1 }, 2200), 2200);
  assert.equal(paceKcal({ goal: "gain", pace: 0.5 }, 2400), 2950);
  assert.equal(paceKcal({ goal: "gain", pace: 1.5 }, 2400), 3100); // the surplus is capped
  assert.equal(paceKcal({ goal: "lose" }, 2000), 1600);
  assert.equal(paceKcal({ goal: "gain" }, 2000), 2200);
  assert.equal(goals({ ...base, pace: 0.5, kcalGoal: 2100 }, 90).kcal, 2100); // an explicit goal still wins
});

test("the plan has calories, macros and an Arise Points budget", () => {
  const p = { goal: "lose" as const, activity: 1.45, units: "lb" as const, waterGoalMl: 2500, stepsGoal: 8000, sex: "f" as const, birthYear: 1990, heightCm: 165, pace: 0.5 };
  const plan = planFor(p, 75);
  assert.ok(plan.kcal > 1200 && plan.points >= 18 && plan.p > 0);
});

test("goal weight and pace are kept and cleaned", () => {
  const d = cleanFit({ profile: { goalKg: 72.5, pace: 0.5 } });
  assert.equal(d.profile.goalKg, 72.5);
  assert.equal(d.profile.pace, 0.5);
  const bad = cleanFit({ profile: { goalKg: 9999, pace: -4 } });
  assert.ok(bad.profile.goalKg === undefined || bad.profile.goalKg <= 350);
  assert.ok(bad.profile.pace === undefined || bad.profile.pace >= 0.1);
  assert.equal(emptyFit().profile.goalKg, undefined);
});

test("food amounts read in the unit the person tracks", () => {
  const m = { kcal: 700, p: 10, c: 80, f: 30 };
  assert.equal(amountText(m, "calories"), "700 cal");
  assert.equal(amountText(m), "700 cal");
  assert.match(amountText(m, "points"), /^\d+ pts$/);
});
