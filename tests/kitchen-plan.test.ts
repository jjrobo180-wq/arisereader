// The Kitchen planner (November 2026): real products and package sizes, each person's own portion, exact math (the same
// plan always gives the same total), shared ingredients, bulk savings, takeout, and King Soopers prices.
// Run with: npx tsx --test tests/kitchen-plan.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { K_DISHES, K_SLOTS, PRODUCTS, WEEK, addMeal, amountText, bestBuy, cleanKitchen, clearMeals, countMeals, deleteOwnDish, duplicateCount, emptyKitchen, groupOf, removeDuplicates, setCells, setKeep, setStock, shoppingLines, stockUp, tips, totals, useUp, type Kitchen } from "../shared/kitchen";
import { GROUPS, parseSize } from "../shared/kitchenProducts";
import { mapKrogerLocation, mapKrogerProduct } from "../server/kroger";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const family = (): Kitchen => ({ ...emptyKitchen(), setup: true, people: [{ id: "j", name: "Jermaine", portion: 1 }, { id: "w", name: "Wife", portion: 1 }, { id: "d", name: "Daughter", portion: 0.5 }] });
const line = (k: Kitchen, g: string) => shoppingLines(k).find((l) => l.group.id === g)!;

test("the shelf is whole: every dish ingredient has products, every product a size and price", () => {
  for (const d of K_DISHES) for (const p of d.parts) assert.ok(groupOf(p.group), `${d.id}: ${p.group}`);
  for (const g of GROUPS) assert.ok(PRODUCTS.some((p) => p.group === g.id), g.id);
  for (const p of PRODUCTS) assert.ok(p.size > 0 && p.price > 0 && p.label, p.id);
  for (const s of K_SLOTS) assert.ok(K_DISHES.filter((d) => d.slot === s.id).length >= 15, s.id);
  assert.ok(PRODUCTS.some((p) => p.brand === "Nestlé Toll House" && p.size === 24));
});

test("the math is exact and the same every time", () => {
  let k = family();
  k = addMeal(k, "mon", "dessert", "cookies", [], "a");
  const l = line(k, "cookie-dough");
  assert.equal(l.need, 2 + 2 + 1); // two cookies each, a half portion for the daughter
  assert.equal(l.packs, 1);
  assert.equal(l.left, 24 - 5);
  assert.deepEqual(totals(k), totals(k));
});

test("one person can have their own amount (4 cookies a day) and eat something else entirely", () => {
  let k = family();
  for (const d of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const) k = addMeal(k, d, "dessert", "cookies", ["d"], `c-${d}`);
  k = { ...k, servings: { d: { "cookies:cookie-dough": 4 } } };
  assert.equal(line(k, "cookie-dough").need, 28);
  assert.equal(line(k, "cookie-dough").packs > 0, true);
  k = addMeal(k, "mon", "dinner", "tacos", ["j", "w"], "t");
  k = addMeal(k, "mon", "dinner", "mac", ["d"], "m");
  const t = totals(k);
  assert.ok(t.share.d > 0 && t.share.j > 0);
  assert.ok(!line(k, "ground-beef").uses.some((u) => u.person.id === "d"), "the daughter's mac has no beef");
});

test("the cheapest mix of package sizes is bought, and your own pick is respected", () => {
  const k = family();
  const buy = bestBuy(k, "ground-beef", 54);
  assert.equal(buy.reduce((a, b) => a + b.packs * b.product.size, 0) >= 54, true);
  assert.ok(buy.some((b) => b.product.id === "beef-3lb"), "a family pack beats four 1 lb packs");
  const mine = bestBuy({ ...k, choice: { "ground-beef": "beef-1lb" } }, "ground-beef", 54);
  assert.deepEqual(mine.map((b) => [b.product.id, b.packs]), [["beef-1lb", 4]]);
});

test("ways to save: switch back to the best value, share one package, use up leftovers", () => {
  let k = family();
  k = addMeal(k, "mon", "dinner", "tacos", ["j"], "a");
  k = addMeal(k, "tue", "dinner", "spaghetti", [], "b");
  k = { ...k, choice: { "pasta-sauce": "rao-24" } };
  const all = tips(k);
  assert.ok(all.some((x) => x.kind === "bulk" && x.group === "pasta-sauce" && x.product === null && x.save > 0));
  assert.ok(all.some((x) => x.kind === "shared" && /ground beef/i.test(x.text)));
});

test("staples start at home, takeout costs per person and buys nothing", () => {
  let k = family();
  k = addMeal(k, "mon", "dinner", "spaghetti", [], "a");
  assert.equal(line(k, "garlic").have, true);
  k = { ...k, have: { garlic: false } };
  assert.equal(line(k, "garlic").have, false);
  k = { ...k, edits: { spaghetti: { takeout: { place: "Olive Garden", perPerson: 18 } } } };
  assert.equal(shoppingLines(k).length, 0);
  assert.equal(totals(k).takeout, 54);
});

test("your own dish can be deleted, and it leaves every day it was on", () => {
  let k = family();
  k = { ...k, own: [{ id: "own-1", slot: "dinner", name: "Oops", kcal: 0, minutes: 0, tags: [], pop: 0, parts: [{ group: "rice", per: 2 }], own: true }] };
  k = addMeal(k, "mon", "dinner", "own-1", [], "x");
  k = addMeal(k, "tue", "dinner", "own-1", [], "y");
  k = deleteOwnDish(k, "own-1");
  assert.equal(k.own.length, 0);
  assert.deepEqual(k.week, {});
});

test("the plan saves with the family and survives a round trip", () => {
  let k = family();
  k = addMeal(k, "mon", "dinner", "tacos", ["j"], "a");
  k = { ...k, choice: { "cookie-dough": "tollhouse-24" }, prices: { "tollhouse-24": { price: 5.29, source: "you", at: "2026-11-07" } }, servings: { d: { "cookies:cookie-dough": 4 } } };
  assert.deepEqual(cleanKitchen(JSON.parse(JSON.stringify(k))), k);
  assert.deepEqual(cleanKitchen({ week: { "mon:dinner": [{ id: "z", dish: "not-a-dish", people: [] }] } }).week, {});
});

test("store sizes are read in the right unit", () => {
  assert.equal(parseSize("16.5 oz", "oz"), 16.5);
  assert.equal(parseSize("2 lb", "oz"), 32);
  assert.equal(parseSize("1/2 gal", "floz"), 64);
  assert.equal(parseSize("24 ct", "ct"), 24);
  assert.equal(parseSize("16.5 oz", "ct"), null);
  assert.equal(amountText(28, groupOf("cookie-dough")!), "28 cookies");
  assert.equal(amountText(54, groupOf("ground-beef")!), "3.4 lb");
});

test("King Soopers products and stores are read from Kroger's API, sale prices included", () => {
  const p = mapKrogerProduct({ productId: "0001", upc: "0001", brand: "Nestlé Toll House", description: "Chocolate Chip Cookie Dough", items: [{ size: "16.5 oz", price: { regular: 5.49, promo: 4.49 } }], images: [{ perspective: "front", sizes: [{ size: "medium", url: "https://x/img.jpg" }] }] });
  assert.deepEqual(p && { price: p.price, regular: p.regular, sale: p.sale, label: p.label }, { price: 4.49, regular: 5.49, sale: true, label: "16.5 oz" });
  assert.equal(mapKrogerProduct({ productId: "1", items: [{ size: "1 lb" }] }), null, "no price at that store");
  assert.equal(mapKrogerLocation({ locationId: "62000006", name: "King Soopers - Aurora", address: { addressLine1: "1 Main", city: "Aurora", state: "CO", zipCode: "80014" } })?.zip, "80014");
});

test("the screens: setup asks who's eating, prices come from the store with your sign-in, no AI guessing", () => {
  const ui = read("client/src/components/family-hub/KitchenPlan.tsx");
  assert.match(ui, /Who are you cooking for\?/);
  assert.match(ui, /Ways to save/);
  assert.match(read("client/src/lib/kitchenStore.ts"), /Authorization: `Bearer \$\{token\}`/);
  assert.match(read("server/routes.ts"), /registerKrogerRoutes\(app, authMiddleware\)/);
  assert.doesNotMatch(read("server/routes.ts"), /mealCost/);
  for (const f of ["KitchenPlan.tsx", "kitchen/DishEditor.tsx", "kitchen/WeekPlanner.tsx", "kitchen/ClearMeals.tsx", "kitchen/Inventory.tsx", "kitchen/ProductChooser.tsx", "kitchen/kit.tsx"]) assert.doesNotMatch(read(`client/src/components/family-hub/${f}`), /\p{Extended_Pictographic}/u, f);
});

test("the week planner sets each meal for each day in one popup, and saving twice never doubles", () => {
  const ui = read("client/src/components/family-hub/kitchen/WeekPlanner.tsx");
  assert.match(ui, /setK\(\(x\) => setCells\(x, draft\)\)/);
  assert.match(ui, /Copy to every day/);
  assert.doesNotMatch(ui, /for \(const id of picked\)[\s\S]{0,200}for \(const d of days\)/, "no dish x day cross product");
  let k = family();
  const draft = { "mon:breakfast": [{ id: "1", dish: "pancakes", people: [] }], "mon:dinner": [{ id: "2", dish: "tacos", people: [] }], "tue:dinner": [{ id: "3", dish: "spaghetti", people: [] }] };
  k = setCells(k, draft);
  k = setCells(k, draft);
  assert.equal(countMeals(k), 3);
  k = setCells(k, { "mon:dinner": [{ id: "4", dish: "tacos", people: [] }, { id: "5", dish: "tacos", people: [] }] });
  assert.equal(k.week["mon:dinner"].length, 1, "the same dish twice in one meal is kept once");
  k = setCells(k, { "tue:dinner": [] });
  assert.equal(k.week["tue:dinner"], undefined);
});

test("bulk delete: the whole week, some days, or one kind of meal; extras added by mistake are found and removed", () => {
  let k = family();
  for (const d of WEEK) for (const dish of ["tacos", "spaghetti"]) k = addMeal(k, d, "dinner", dish, [], `${d}-${dish}`);
  k = addMeal(k, "mon", "breakfast", "pancakes", [], "p");
  assert.equal(countMeals(k), 15);
  assert.equal(countMeals(clearMeals(k, { days: ["mon"] })), 12);
  assert.equal(countMeals(clearMeals(k, { slots: ["dinner"] })), 1);
  assert.equal(countMeals(clearMeals(k, { days: ["mon", "tue"], slots: ["dinner"] })), 11);
  assert.deepEqual(clearMeals(k).week, {});
  // The old picker's mistake: four dishes on four days, so every day got all four.
  let oops = family();
  for (let i = 0; i < 4; i++) for (const d of ["mon", "tue", "wed", "thu"] as const) oops = addMeal(oops, d, "dinner", "tacos", [], `${d}-${i}`);
  assert.equal(duplicateCount(oops), 12);
  oops = removeDuplicates(oops);
  assert.equal(duplicateCount(oops), 0);
  assert.equal(countMeals(oops), 4);
  const own = addMeal(addMeal(family(), "mon", "dinner", "tacos", ["j"], "a"), "mon", "dinner", "tacos", ["d"], "b");
  assert.equal(duplicateCount(own), 0, "the same dish for different people is not a duplicate");
});

test("inventory: the list buys only what's missing, tops up 'keep at least', and fills from shopping", () => {
  let k = family();
  k = addMeal(k, "mon", "dinner", "tacos", [], "a");
  const need = shoppingLines(k).find((l) => l.group.id === "ground-beef")!.need;
  assert.equal(line(k, "ground-beef").tracked, false);
  k = setStock(k, "ground-beef", need);
  assert.equal(line(k, "ground-beef").have, true, "enough on hand, nothing to buy");
  assert.equal(line(k, "ground-beef").cost, 0);
  k = setStock(k, "ground-beef", need - 4);
  assert.equal(line(k, "ground-beef").short, 4);
  assert.equal(line(k, "ground-beef").have, false);
  // Keep at least a gallon of milk, no meal needed.
  k = setStock(setKeep(k, "milk", 128), "milk", 32);
  assert.equal(line(k, "milk").short, 96);
  assert.equal(line(k, "milk").uses.length, 0);
  // Bought it all: the inventory has it, the list is clear.
  const after = stockUp(k);
  assert.ok(shoppingLines(after).every((l) => l.have || !l.tracked));
  assert.ok(after.stock.milk >= 128);
  // Cooked Monday: what it used comes out of the counted items.
  const cooked = useUp(after, { days: ["mon"] });
  assert.equal(Math.round((after.stock["ground-beef"] - cooked.stock["ground-beef"]) * 100) / 100, Math.round(need * 100) / 100);
  // Stop counting: back to the usual list.
  assert.equal(line(setStock(k, "ground-beef", null), "ground-beef").tracked, false);
  // Saved safely with the family.
  assert.deepEqual(cleanKitchen(JSON.parse(JSON.stringify(k))), k);
  assert.deepEqual(cleanKitchen({ stock: { milk: -3, "not-a-thing": 4, eggs: "x" }, keep: { eggs: 0 } }).stock, {});
});

test("the plan screen: plan the week, clear meals with undo, inventory tab", () => {
  const ui = read("client/src/components/family-hub/KitchenPlan.tsx");
  for (const t of ["Plan the week", "Clear meals", "Undo", "Inventory", "Remove extras"]) assert.match(ui, new RegExp(t), t);
  assert.doesNotMatch(ui, /DishPicker/);
});

test("the same person twice is merged, and their meals go with them", () => {
  const k = cleanKitchen({ setup: true, people: [{ id: "a", name: "Me", portion: 1 }, { id: "b", name: "Vanessa", portion: 1 }, { id: "c", name: "vanessa ", portion: 1 }], week: { "mon:dinner": [{ id: "x", dish: "tacos", people: ["a", "c"] }] } });
  assert.deepEqual(k.people.map((p) => p.name), ["Me", "Vanessa"]);
  assert.deepEqual(k.week["mon:dinner"][0].people, ["a", "b"]);
});
