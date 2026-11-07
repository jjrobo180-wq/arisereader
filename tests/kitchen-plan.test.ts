// Kitchen planner: pick dishes, match to days, shopping list with a total, plan from a budget (November 2026).
// Run with: npx tsx --test tests/kitchen-plan.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DISHES, SLOTS, WEEK_DAYS, autoFill, cellKey, dishesFor, planForBudget, shoppingFrom, totalOf } from "../shared/mealCatalog";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("every meal type has plenty of dishes with unique ids", () => {
  assert.equal(new Set(DISHES.map((d) => d.id)).size, DISHES.length);
  for (const s of SLOTS) assert.ok(DISHES.filter((d) => d.slot === s.id).length >= 7, s.id);
});

test("dishes sort by popularity, health, calories, speed and price", () => {
  assert.equal(dishesFor("dinner", "popular")[0].pop, 10);
  const kc = dishesFor("lunch", "calories").map((d) => d.kcal);
  assert.deepEqual(kc, [...kc].sort((a, b) => a - b));
  assert.ok(dishesFor("dinner", "quick").every((d) => d.minutes <= 20));
  assert.ok(dishesFor("breakfast", "healthy")[0].tags.includes("healthy"));
});

test("a week becomes one shopping list: repeated ingredients are one line, and the total adds up", () => {
  const week = autoFill({ breakfast: [], lunch: [], dinner: ["d-tacos", "d-spag"], snack: [], dessert: [] });
  assert.equal(Object.keys(week).length, 7);
  const lines = shoppingFrom(week, 4);
  assert.equal(lines.filter((l) => l.name === "Ground beef").length, 1);
  assert.ok(lines.find((l) => l.name === "Ground beef")!.meals === 7);
  assert.ok(totalOf(lines) > 0);
  assert.ok(totalOf(shoppingFrom(week, 8)) > totalOf(shoppingFrom(week, 2)));
});

test("working backwards from a weekly total stays under it when it can", () => {
  for (const budget of [120, 180, 300]) {
    const week = planForBudget(budget, ["breakfast", "lunch", "dinner"], 4);
    assert.equal(Object.keys(week).length, 21);
    assert.ok(totalOf(shoppingFrom(week, 4)) <= budget, `${budget}`);
  }
  const tiny = planForBudget(10, ["dinner"], 4);
  assert.ok(tiny[cellKey(WEEK_DAYS[0], "dinner")]);
});

test("the Plan page is the wizard and the AI price check has its own route", () => {
  assert.match(read("client/src/components/family-hub/BundleApp.tsx"), /id === "meals"\) return <KitchenPlan/);
  assert.match(read("server/mealCost.ts"), /app\.post\("\/api\/arise-todo\/meal\/price", authMiddleware/);
  assert.match(read("server/routes.ts"), /registerMealCostRoutes\(app, authMiddleware\)/);
  assert.match(read("client/src/components/family-hub/KitchenPlan.tsx"), /Start from a budget/);
});
