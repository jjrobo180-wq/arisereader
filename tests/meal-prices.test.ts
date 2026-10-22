import test from "node:test";
import assert from "node:assert/strict";
import { PRICE_LIST, emptyDays, ideaCost, MEAL_IDEAS, mealsFrom, perMeal, priceItem, searchPrices, unitsFor } from "../shared/mealPrices";
import { cleanFamily } from "../shared/familyHub";

test("what you buy turns into meals for the family", () => {
  const beef = priceItem("beef")!;
  assert.deepEqual(mealsFrom(beef, 1, 3), { meals: 1, total: 4, left: 1, short: 0 });
  assert.equal(mealsFrom(beef, 3, 4).meals, 3);
  assert.equal(mealsFrom(beef, 1, 6).short, 2, "1 lb for 6 is 2 servings short");
  assert.equal(perMeal([1, 1, 0.5, 0.5, 0]), 3);
  assert.equal(unitsFor(beef, 1, 6), 2);
  assert.deepEqual(emptyDays(["a", "b", "c"], "dinner", [{ date: "b", slot: "dinner" }, { date: "c", slot: "lunch" }]), ["a", "c"]);
});

test("search forgives spelling, every price and idea is sane, and prices survive saving", () => {
  assert.equal(searchPrices("burger")[0].id, "beef");
  assert.ok(searchPrices("chiken").some((p) => p.id === "chicken"));
  assert.equal(new Set(PRICE_LIST.map((p) => p.id)).size, PRICE_LIST.length);
  for (const p of PRICE_LIST) assert.ok(p.price > 0 && p.serves > 0, p.id);
  for (const idea of MEAL_IDEAS) { const c = ideaCost(idea, 4); assert.equal(c.lines.length, idea.items.length, idea.title); assert.ok(c.cost > 0 && c.cost < 80, idea.title); }
  const f = cleanFamily({ groceries: [{ id: "g1", name: "Beef", price: 5.499, qty: "1" }], meals: [{ id: "m1", date: "2026-10-12", slot: "dinner", text: "Tacos", cost: 12.3, serves: 3 }] } as any);
  assert.equal(f.groceries[0].price, 5.5);
  assert.equal(f.meals[0].cost, 12.3);
  assert.equal(f.meals[0].serves, 3);
});
