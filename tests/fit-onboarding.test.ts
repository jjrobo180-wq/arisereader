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

import { cleanMenuPicks, menuUserText } from "../shared/fitMenuAi";
import { registerFitRoutes, createMemoryFitStore } from "../server/fit";
import { createMemoryKv } from "../server/fitKv";

test("AI order suggestions are cleaned before they're shown or logged", () => {
  const picks = cleanMenuPicks({ picks: [
    { name: "  Grilled chicken salad ", how: "Dressing on the side", kcal: "420", p: 45, c: 18, f: 20 },
    { name: "", kcal: 300, p: 1, c: 1, f: 1 }, { name: "Nothing", kcal: 5, p: 0, c: 0, f: 0 }, { name: "Bad", kcal: "lots", p: 1, c: 1, f: 1 }, { name: "Absurd", kcal: 90000, p: 1, c: 1, f: 1 },
  ] });
  assert.deepEqual(picks, [{ name: "Grilled chicken salad", how: "Dressing on the side", kcal: 420, p: 45, c: 18, f: 20 }]);
  assert.deepEqual(cleanMenuPicks(null), []);
  assert.equal(cleanMenuPicks({ picks: Array.from({ length: 20 }, (_, i) => ({ name: `x${i}`, kcal: 300, p: 20, c: 20, f: 10 })) }).length, 6);
  assert.match(menuUserText({ place: "Olive Garden", cuisine: "italian", goal: "lose fat", diet: "Balanced", mode: "points", wants: "no dairy", left: { kcal: 800, p: 60, c: 70, f: 25 } }), /Olive Garden \(italian\)[\s\S]*Arise Points[\s\S]*800 calories[\s\S]*no dairy/);
});

test("POST /api/fit/menu asks the AI with what's left of the day", async () => {
  const routes: Record<string, Function> = {};
  const add = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h[h.length - 1]; };
  let asked: any = null;
  registerFitRoutes({ get: add("GET"), post: add("POST"), put: add("PUT") } as any, (_q: any, _s: any, n: any) => n(), {
    store: createMemoryFitStore(), kv: createMemoryKv(), ownPlus: async () => ({ live: true }),
    menu: async (ask) => { asked = ask; return ask.place === "Nowhere" ? [] : [{ name: "Chicken fajitas, no tortilla", how: "Skip the rice", kcal: 480, p: 48, c: 22, f: 20 }]; },
  });
  const call = async (body: any) => { let status = 200, json: any = null; const res: any = { set() { return res; }, status(c: number) { status = c; return res; }, json(v: any) { json = v; return res; } }; await routes["POST /api/fit/menu"]({ user: { id: 7 }, body, query: {}, headers: {} }, res); return { status, json }; };
  assert.equal((await call({ place: "" })).status, 400);
  const ok = await call({ place: "Chili's", cuisine: "american", goal: "lose", mode: "points", wants: "high protein", left: { kcal: 700.4, p: 55, c: 60, f: 20 } });
  assert.equal(ok.json.picks[0].name, "Chicken fajitas, no tortilla");
  assert.deepEqual(asked, { place: "Chili's", cuisine: "american", goal: "lose fat", diet: "balanced", mode: "points", wants: "high protein", left: { kcal: 700, p: 55, c: 60, f: 20 } });
  assert.equal((await call({ place: "Nowhere" })).status, 422);
});
