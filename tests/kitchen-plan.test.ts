// Kitchen planner: pick dishes, match to days, shopping list with a total, plan from a budget (November 2026).
// Run with: npx tsx --test tests/kitchen-plan.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DISHES, SLOTS, WEEK_DAYS, autoFill, cellKey, dishesFor, planForBudget, shoppingFrom, takeoutFrom, takeoutTotal, totalOf } from "../shared/mealCatalog";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("every meal type has plenty of dishes with unique ids", () => {
  assert.equal(new Set(DISHES.map((d) => d.id)).size, DISHES.length);
  for (const s of SLOTS) assert.ok(DISHES.filter((d) => d.slot === s.id).length >= 15, s.id);
});

test("dishes sort by popularity, health, calories, speed and price", () => {
  assert.equal(dishesFor("dinner", "popular")[0].pop, 10);
  const kc = dishesFor("lunch", "calories").map((d) => d.kcal);
  assert.deepEqual(kc, [...kc].sort((a, b) => a - b));
  assert.ok(dishesFor("dinner", "quick").every((d) => d.minutes <= 20));
  assert.ok(dishesFor("breakfast", "healthy")[0].tags.includes("healthy"));
});

test("a week becomes one shopping list: repeated ingredients are one line, and the total adds up", () => {
  const week = autoFill({ "d-tacos": 4, "d-spag": 3 });
  assert.equal(Object.keys(week).length, 7);
  const lines = shoppingFrom(week, 4);
  assert.equal(lines.filter((l) => l.name === "Ground beef").length, 1);
  assert.ok(lines.find((l) => l.name === "Ground beef")!.meals === 7);
  assert.ok(totalOf(lines) > 0);
  assert.ok(totalOf(shoppingFrom(week, 8)) > totalOf(shoppingFrom(week, 2)));
});

test("one dish can be on several days, and days left over stay empty", () => {
  const week = autoFill({ "d-pizza": 3 });
  assert.deepEqual(Object.values(week), ["d-pizza", "d-pizza", "d-pizza"]);
  assert.equal(Object.keys(autoFill({ "d-pizza": 9 })).length, 7);
});

test("no emojis in the planner", () => {
  const src = read("client/src/components/family-hub/KitchenPlan.tsx") + read("shared/mealCatalog.ts");
  assert.doesNotMatch(src, /\p{Extended_Pictographic}/u);
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
  assert.match(read("client/src/components/family-hub/KitchenPlan.tsx"), /plan from a weekly budget/);
});

test("a dish can have its own ingredients, a brand, or be takeout instead", () => {
  const week = autoFill({ "d-spag": 2 });
  const plain = shoppingFrom(week, 4);
  assert.ok(plain.some((l) => l.name === "Spaghetti"));
  const custom = { "d-spag": { items: [["Gluten-free spaghetti", "1 box", 4.5, "Barilla"], ["Ground turkey", "1 lb", 4.5]] as [string, string, number, string?][] } };
  const own = shoppingFrom(week, 4, { custom });
  assert.ok(own.some((l) => l.name === "Gluten-free spaghetti" && l.brand === "Barilla"));
  assert.ok(!own.some((l) => l.name === "Ground beef"));
  const out = { "d-spag": { takeout: { place: "Olive Garden", price: 48 } } };
  assert.deepEqual(shoppingFrom(week, 4, { custom: out }), []);
  const t = takeoutFrom(week, { custom: out });
  assert.equal(t.length, 1);
  assert.equal(t[0].meals, 2);
  assert.equal(takeoutTotal(t), 96);
});

test("a person's own dish works in the week and the list", () => {
  const extra = [{ id: "u-1", slot: "dinner" as const, name: "Grandma's stew", kcal: 0, minutes: 0, tags: [], pop: 0, items: [] }];
  const custom = { "u-1": { items: [["Beef chuck", "2 lb", 14]] as [string, string, number][] } };
  const lines = shoppingFrom({ "mon:dinner": "u-1" }, 4, { custom, extra });
  assert.deepEqual(lines.map((l) => [l.name, l.price]), [["Beef chuck", 14]]);
});

test("the AI price check sends the person's sign-in, which was why it failed before", () => {
  const ui = read("client/src/components/family-hub/KitchenPlan.tsx");
  assert.match(ui, /Authorization: `Bearer \$\{token\}`/);
  assert.match(ui, /body\?\.message \|\|/);
});

test("the Kitchen tabs and the plan's steps read differently, so the menu isn't confusing", () => {
  assert.match(read("client/src/components/family-hub/BundleApp.tsx"), /"Shopping list"/);
  assert.match(read("client/src/components/family-hub/KitchenPlan.tsx"), /Step \{step\} of 3/);
});
