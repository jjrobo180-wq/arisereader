// The Kitchen planner (November 2026): real products and package sizes, each person's own portion, exact math (the same
// plan always gives the same total), shared ingredients, bulk savings, takeout, and King Soopers prices.
// Run with: npx tsx --test tests/kitchen-plan.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addDays, cell, dateOf, hiddenMeals, mondayOf, moveMeal, nWeeks, planStart, K_DISHES, K_SLOTS, PRODUCTS, WEEK, SKIP, addDish, addMeal, amountText, bestBuy, cleanKitchen, clearMeals, countMeals, deleteOwnDish, dayProgress, dropPerson, duplicateCount, emptyKitchen, foodCount, groupOf, normPeople, planDish, planProgress, removeDuplicates, setCells, setKeep, setStock, shoppingLines, stockUp, tips, totals, useUp, useUpPast, type Kitchen } from "../shared/kitchen";
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
  for (const f of ["KitchenPlan.tsx", "kitchen/DishEditor.tsx", "kitchen/WeekPlanner.tsx", "kitchen/PlanProgress.tsx", "kitchen/ClearMeals.tsx", "kitchen/PlanCalendar.tsx", "kitchen/DaySheet.tsx", "kitchen/Inventory.tsx", "kitchen/ProductChooser.tsx", "kitchen/kit.tsx"]) assert.doesNotMatch(read(`client/src/components/family-hub/${f}`), /\p{Extended_Pictographic}/u, f);
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

test("every person can have their own menu, or share a meal, and each person's planning shows a percentage", () => {
  const all = ["j", "w", "d"];
  let list = addDish([], "tacos", ["j"], all, "a");
  list = addDish(list, "tacos", ["w"], all, "b");
  assert.deepEqual(list.map((m) => [m.dish, m.people]), [["tacos", ["j", "w"]]], "the same dish for two people is one shared meal");
  list = addDish(list, "tacos", ["d"], all, "c");
  assert.deepEqual(list[0].people, [], "all three means everyone");
  list = addDish(list, "mac", ["d"], all, "m");
  assert.equal(list.length, 2);
  assert.deepEqual(dropPerson(list, "w", all).map((m) => [m.dish, m.people]), [["tacos", ["j", "d"]], ["mac", ["d"]]], "taking one person off keeps it for the others");
  assert.deepEqual(dropPerson(list, "d", all, "m").map((m) => m.dish), ["tacos"], "their own meal goes");
  assert.deepEqual(normPeople(["j", "w", "d"], all), []);
  // Progress: breakfast for everyone all week, lunch for Jermaine only.
  let k = family();
  for (const d of WEEK) { k = addMeal(k, d, "breakfast", "pancakes", [], `b-${d}`); k = addMeal(k, d, "lunch", "pbj", ["j"], `l-${d}`); }
  const p = planProgress(k.people, k.week);
  assert.deepEqual([p.by.j.pct, p.by.w.pct, p.by.d.pct], [67, 33, 33]);
  assert.equal(p.all.pct, 44);
  assert.equal(planProgress(k.people, {}).all.pct, 0);
  k = addMeal(k, "mon", "dinner", "tacos", [], "t");
  assert.deepEqual(dayProgress(k.people, k.week, "mon", null), { done: 2, of: 3 }, "lunch isn't set for everyone yet");
  assert.deepEqual(dayProgress(k.people, k.week, "mon", "j"), { done: 3, of: 3 });
  // Snacks and desserts don't hold the bar back.
  k = addMeal(k, "mon", "snack", "apple-pb", [], "s");
  assert.equal(planProgress(k.people, k.week).by.w.done, 8);
});

test("the planner shows a menu per person with a progress bar, and snacks and desserts are always there", () => {
  const ui = read("client/src/components/family-hub/kitchen/WeekPlanner.tsx");
  assert.match(ui, /Who's eating/);
  assert.match(ui, /dropPerson\(/);
  assert.match(ui, /<PlanProgress /);
  assert.doesNotMatch(ui, /Add snacks & desserts|setExtras/);
  assert.match(read("client/src/components/family-hub/KitchenPlan.tsx"), /<PlanProgress /);
});

test("skipping a meal counts as planned, buys nothing, and never sits alongside real food for the same person", () => {
  const all = ["j", "w", "d"];
  // Wife skips lunch: she's off the shared lunch and on a skip.
  let list = planDish([], "pbj", [], all, "a");
  list = planDish(list, SKIP, ["w"], all, "b");
  assert.deepEqual(list.map((m) => [m.dish, m.people]), [["pbj", ["j", "d"]], [SKIP, ["w"]]]);
  // Changing her mind puts her back on real food and takes her off skipping.
  list = planDish(list, "pbj", ["w"], all, "c");
  assert.deepEqual(list.map((m) => [m.dish, m.people]), [["pbj", []]]);
  // Everyone skipping clears the food.
  assert.deepEqual(planDish(list, SKIP, [], all, "z").map((m) => [m.dish, m.people]), [[SKIP, []]]);
  // Progress and shopping.
  let k = family();
  for (const d of WEEK) { k = addMeal(k, d, "breakfast", "pancakes", [], `b-${d}`); k = addMeal(k, d, "lunch", SKIP, ["w"], `s-${d}`); k = addMeal(k, d, "lunch", "pbj", ["j", "d"], `l-${d}`); }
  const p = planProgress(k.people, k.week);
  assert.deepEqual([p.by.j.pct, p.by.w.pct, p.by.d.pct], [67, 67, 67], "a skipped lunch counts as planned");
  assert.equal(line(k, "bread").need, 7 * (2 + 1), "pb&j bread for Jermaine and the daughter only (2 and a half-portion 1); the wife's skipped lunch buys nothing");
  assert.equal(foodCount(k.week), 7 * 2, "skips aren't counted as meals");
  assert.equal(totals(k).groceries > 0, true);
  // Saved safely.
  assert.deepEqual(cleanKitchen(JSON.parse(JSON.stringify(k))), k);
  // The screens.
  const ui = read("client/src/components/family-hub/kitchen/WeekPlanner.tsx");
  assert.match(ui, /Skipping this meal/);
  assert.match(read("client/src/components/family-hub/KitchenPlan.tsx"), /dishName\(k, m\.dish\)/);
});

test("the grocery list shows an Edit button on every item, and the edit sheet leads to the dishes' amounts", () => {
  const ui = read("client/src/components/family-hub/KitchenPlan.tsx");
  assert.match(ui, /data-testid=\{`edit-\$\{l\.group\.id\}`\}[^>]*>Edit<\/button>/);
  assert.match(ui, /I have this/);
  assert.match(ui, /onDish=\{\(id\) => \{ setProduct\(null\); setEditing\(id\); \}\}/);
  const sheet = read("client/src/components/family-hub/kitchen/ProductChooser.tsx");
  assert.match(sheet, /Edit amount/);
  assert.match(sheet, /How much you need/);
});

test("two-week and monthly plans: weeks count, clear by week, hidden weeks are kept but ignored", () => {
  let k = { ...family(), weeks: 2 as const };
  k = addMeal(k, "mon", "dinner", "cookies", [], "a", 0);
  k = addMeal(k, "mon", "dinner", "cookies", [], "b", 1);
  assert.equal(nWeeks(k), 2);
  assert.equal(countMeals(k, {}), 2);
  assert.equal(countMeals(k, { wks: [1] }), 1);
  assert.equal(Object.keys(clearMeals(k, { wks: [1] }).week).join(), cell("mon", "dinner", 0));
  const one = { ...k, weeks: 1 as const };
  assert.equal(hiddenMeals(one), 1);
  assert.equal(countMeals(one, {}), 1);
  assert.equal(Object.keys(one.week).length, 2); // nothing lost
  assert.equal(cleanKitchen(JSON.parse(JSON.stringify(k))).week[cell("mon", "dinner", 1)].length, 1);
});

test("calendar dates, moving and copying meals, and saved plan settings", () => {
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(mondayOf("2026-11-08"), "2026-11-02");
  assert.equal(dateOf("2026-11-02", 1, "mon"), "2026-11-09");
  assert.equal(planStart({ ...emptyKitchen(), start: "" }, "2026-11-08"), "2026-11-02");
  let k = addMeal(family(), "mon", "dinner", "cookies", [], "a");
  const to = cell("wed", "dinner", 0);
  const copied = moveMeal(k, cell("mon", "dinner"), "a", to, true, "n1");
  assert.equal(countMeals(copied, {}), 2);
  const moved = moveMeal(k, cell("mon", "dinner"), "a", to, false, "n2");
  assert.equal(countMeals(moved, {}), 1);
  assert.ok(moved.week[to] && !moved.week[cell("mon", "dinner")]);
  assert.equal(countMeals(moveMeal(copied, cell("mon", "dinner"), "a", to, true, "n3"), {}), 2); // merges, never doubles
  const c = cleanKitchen({ ...k, weeks: 4, start: "2026-11-02" });
  assert.equal(c.weeks, 4); assert.equal(c.start, "2026-11-02");
  assert.equal(cleanKitchen({ ...k, weeks: 3, start: "nope" }).start, "");
});

test("calendar and plan length controls exist", () => {
  assert.match(read("client/src/components/family-hub/kitchen/PlanCalendar.tsx"), /draggable/);
  assert.match(read("client/src/components/family-hub/kitchen/PlanCalendar.tsx"), /onDrop/);
  const ui = read("client/src/components/family-hub/KitchenPlan.tsx");
  assert.match(ui, /Calendar/); assert.match(ui, /PLAN_LENGTHS/); assert.match(ui, /meal-move/);
});

test("food bought with 'Bought it all' gets used up as days pass, so it goes back on the list", () => {
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]; const week: Record<string, unknown[]> = {};
  ["bagel", "coffee", "oatmeal", "eggs-toast"].forEach((dish, i) => { for (const d of days) (week[`${d}:breakfast`] ??= []).push({ id: `${dish}-${d}-${i}`, dish, people: [] }); });
  const k = cleanKitchen({ setup: true, people: [{ id: "a", name: "A", portion: 1 }], week });
  const sent = (x: Kitchen, today: string) => shoppingLines(useUpPast(x, today)).filter((l) => !l.have && l.packs > 0).map((l) => l.group.id);
  const mon = "2026-11-09";
  assert.ok(sent(k, mon).includes("bagels") && sent(k, mon).includes("coffee"), "bagels and coffee are on the list");
  const bought = stockUp(k, undefined, mon);
  assert.deepEqual(sent(bought, mon), [], "just bought: nothing to buy");
  const nextWeek = sent(bought, addDays(mon, 7));
  assert.ok(nextWeek.includes("bagels"), "a week of bagels was eaten, so bagels are back");
  // A kitchen saved before this was tracked (stuck with everything "at home") fixes itself.
  const stuck = cleanKitchen({ ...stockUp(k), usedThrough: undefined });
  assert.ok(sent(stuck, mon).includes("bagels"));
  assert.equal(cleanKitchen(JSON.parse(JSON.stringify(bought))).usedThrough, "2026-11-08");
});

test("never again: every ingredient a plan needs lands on the shopping list, shows on screen, and survives the save", async () => {
  const { planToList } = await import("../shared/kitchen");
  const { cleanFamily, emptyFamily } = await import("../shared/familyHub");
  const { AISLES, aisleOf } = await import("../shared/lifePlugins");
  // Every built-in dish, all in one plan.
  const week: Record<string, unknown[]> = {};
  K_DISHES.forEach((d, i) => { (week[`${WEEK[i % 7]}:${d.slot}`] ??= []).push({ id: `m${i}`, dish: d.id, people: [] }); });
  const k = cleanKitchen({ setup: true, people: [{ id: "a", name: "A", portion: 1 }], week: Object.fromEntries(Object.entries(week).map(([c, ms]) => [c, ms.slice(0, 8)])) });
  const lines = shoppingLines(k).filter((l) => !l.have && l.packs > 0);
  const needed = new Set(Object.values(k.week).flat().flatMap((m) => K_DISHES.find((d) => d.id === m.dish)!.parts.map((p) => p.group)).filter((g) => !groupOf(g)!.staple));
  for (const g of needed) assert.ok(lines.some((l) => l.group.id === g), `${g} is on the list`);
  let n = 0;
  const list = planToList([{ id: "mine", name: "Paper towels", qty: "", aisle: "Bread & bakery", checked: false }], lines, () => String(n++ % 3)); // ids that repeat
  // Through the same cleaning the save does: nothing dropped, every item has a unique id and a visible aisle.
  const saved = cleanFamily({ ...emptyFamily(), groceries: list }).groceries;
  assert.equal(saved.length, lines.length + 1, "the save keeps every item");
  assert.equal(new Set(saved.map((g) => g.id)).size, saved.length);
  for (const g of saved) assert.ok(AISLES.includes(aisleOf(g)), `${g.name} shows on screen`);
  assert.equal(aisleOf({ aisle: "Bread & bakery" }), "Other");
});

test("your own dishes with no ingredients (Bagel, Coffee) go on the shopping list as themselves", async () => {
  const { planToListAll, plainLines } = await import("../shared/kitchen");
  const k = cleanKitchen({ setup: true, people: [{ id: "a", name: "A", portion: 1 }], own: [{ id: "own-b", slot: "breakfast", name: "Bagel", parts: [] }, { id: "own-c", slot: "breakfast", name: "Coffee", parts: [] }],
    week: { "mon:breakfast": [{ id: "1", dish: "own-b", people: [] }, { id: "2", dish: "own-c", people: [] }], "tue:breakfast": [{ id: "3", dish: "own-c", people: [] }] } });
  assert.deepEqual(plainLines(k).map((p) => `${p.dish.name}:${p.servings}`), ["Bagel:1", "Coffee:2"]);
  let n = 0; const list = planToListAll([], k, shoppingLines(k).filter((l) => !l.have && l.packs > 0), () => String(n++));
  assert.ok(list.some((g) => g.name === "Bagel") && list.some((g) => g.name === "Coffee"));
});
