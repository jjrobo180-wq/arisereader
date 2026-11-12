import test from "node:test";
import assert from "node:assert/strict";
import { findAdditives, findChemicals, gradeFood, gradeOff, gradeProduct, nutriScore } from "../shared/productGrade";

test("Nutri-Score 2023: plain oats score A, cola and candy score low", () => {
  assert.equal(nutriScore({ kcal: 370, sugars: 1, satFat: 1.2, salt: 0.01, protein: 13, fiber: 10 }).letter, "a");
  assert.ok(["d", "e"].includes(nutriScore({ kcal: 540, sugars: 55, satFat: 18, salt: 0.2, protein: 6, fiber: 2 }).letter));
});

test("additives are found by E-number, tag and name", () => {
  assert.deepEqual(findAdditives("water, sugar, E 129, sodium nitrite").map((a) => a.name.split(" ")[0]).sort(), ["Allura", "Sodium"]);
  assert.equal(findAdditives("", ["en:e171", "en:e330"]).length, 1);
  assert.equal(findAdditives("Red 40, Yellow 5")[0].level, "moderate");
});

test("food grade: whole food beats ultra-processed with nitrites and dyes", () => {
  const apple = gradeFood({ per100: { kcal: 52, sugars: 10, fiber: 2.4, fruitVegPct: 100 }, nova: 1, ingredients: "apple" });
  const hotdog = gradeFood({ nutriscore: "e", nova: 4, ingredients: "pork, water, salt, sodium nitrite, red 40" });
  assert.ok(apple.letter === "A", JSON.stringify(apple));
  assert.equal(hotdog.letter, "F");
  assert.ok(hotdog.reasons.some((r) => /cancer/.test(r.text)));
  assert.equal(gradeFood({}).letter, "?");
});

test("household grade: formaldehyde releasers and fragrance count against it; a plain soap does well", () => {
  const bad = gradeProduct({ ingredients: "Water, Sodium Laureth Sulfate, DMDM Hydantoin, Fragrance, Methylisothiazolinone, Triclosan" });
  assert.ok(["D", "F"].includes(bad.letter), bad.letter);
  assert.ok(findChemicals("Fragrance").length === 1);
  const good = gradeProduct({ ingredients: "Water, coconut oil, olive oil, glycerin" });
  assert.equal(good.letter, "A");
  assert.equal(gradeProduct({ ingredients: "" }).letter, "?");
});

test("Open Food Facts products grade with their official Nutri-Score and NOVA", () => {
  const g = gradeOff({ product_name: "Cola", brands: "X", nutriscore_grade: "e", nova_group: 4, additives_tags: ["en:e150d", "en:e338"], categories_tags: ["en:beverages"], nutriments: { "sugars_100g": 10.6, "energy-kcal_100g": 42 } }, "food");
  assert.equal(g.name, "Cola");
  assert.ok(["D", "F"].includes(g.letter));
  assert.ok(g.reasons.some((r) => /sugar/i.test(r.text)));
});
