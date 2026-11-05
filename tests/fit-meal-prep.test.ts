import test from "node:test";
import assert from "node:assert/strict";
import { aisleOf, groceryForPlan, groceryFromPrep, groceryText, prepSummary, weekDays } from "../shared/fitMealPrep";
import { cleanFit, emptyFit } from "../shared/fit";

test("a week from the start date", () => {
  const w = weekDays("2026-11-04");
  assert.equal(w.length, 7); assert.equal(w[0], "2026-11-04"); assert.equal(w[6], "2026-11-10");
});

test("prep totals per day and the week's average over planned days", () => {
  const e = (date: string, kcal: number, servings = 1) => ({ id: date + kcal, date, meal: "lunch" as const, name: "Chicken and rice", kcal, p: 40, c: 50, f: 10, servings });
  const s = prepSummary({ start: "2026-11-04", foods: [e("2026-11-04", 500, 2), e("2026-11-05", 600)] });
  assert.equal(s.days[0].totals.kcal, 1000);
  assert.equal(s.planned, 2);
  assert.equal(s.avg.kcal, 800);
});

test("grocery list from a plan is sized to calories and sorted by aisle", () => {
  const keto = groceryForPlan("keto", 2000);
  assert.ok(keto.some((i) => i.name === "Avocado" && i.qty === "7"));
  assert.ok(!keto.some((i) => /rice|oats|bread/i.test(i.name)));
  const big = groceryForPlan("keto", 3000);
  assert.ok(Number(big.find((i) => i.name === "Avocado")!.qty) > 7);
  assert.deepEqual(keto.map((i) => i.aisle), [...keto.map((i) => i.aisle)].sort());
  assert.equal(aisleOf("Salmon fillet"), "Meat & fish");
});

test("grocery list from meal prep adds up repeated foods; text export; data survives cleaning", () => {
  const f = (id: string) => ({ id, date: "2026-11-04", meal: "lunch" as const, name: "Greek yogurt", kcal: 100, p: 17, c: 6, f: 0, servings: 1, serving: "1 cup" });
  const g = groceryFromPrep([f("a"), f("b"), { ...f("c"), servings: 0.5 }]);
  assert.equal(g.length, 1); assert.equal(g[0].qty, "2½ × 1 cup");
  assert.match(groceryText(g), /Dairy & eggs\n☐ Greek yogurt/);
  const d = cleanFit({ ...emptyFit(), grocery: { made: "x", from: "keto", items: g }, prep: { start: "2026-11-04", foods: [f("a")] }, favFoods: [{ name: "Oats", kcal: 150, p: 5, c: 27, f: 3, servings: 1 }], foodNotes: { "2026-11-04": "Felt great" }, foods: [{ ...f("z"), note: "post-workout" }] });
  assert.equal(d.grocery!.items.length, 1); assert.equal(d.prep!.foods.length, 1); assert.equal(d.favFoods!.length, 1);
  assert.equal(d.foodNotes!["2026-11-04"], "Felt great"); assert.equal(d.foods[0].note, "post-workout");
});
