import test from "node:test";
import assert from "node:assert/strict";
import { cleanAiFoods, isBarcode, mergeFound, parseFdcFood, parseOffProduct } from "../shared/foodLookup";

const nut = (num: string, value: number, unitName = "G") => ({ nutrientNumber: num, unitName, value });

test("USDA survey food uses its household measure", () => {
  const f = parseFdcFood({
    description: "Banana, raw", dataType: "Survey (FNDDS)",
    foodMeasures: [{ disseminationText: "Quantity not specified", gramWeight: 118 }, { disseminationText: "1 medium (7\" to 7-7/8\" long)", gramWeight: 118 }],
    foodNutrients: [nut("208", 89, "KCAL"), nut("203", 1.09), nut("205", 22.8), nut("204", 0.33)],
  });
  assert.deepEqual(f, { name: "Banana, raw", brand: "", serving: "1 medium (7\" to 7-7/8\" long) (118 g)", calories: 105, protein: 1.3, carbs: 26.9, fat: 0.4, source: "usda" });
});

test("USDA branded food uses its label serving and ignores kJ energy", () => {
  const f = parseFdcFood({
    description: "GREEK YOGURT, VANILLA", brandOwner: "Chobani", servingSize: 150, servingSizeUnit: "g", householdServingFullText: "1 container",
    foodNutrients: [nut("208", 460, "kJ"), nut("208", 93, "KCAL"), nut("203", 8), nut("205", 9.3), nut("204", 0)],
  });
  assert.equal(f?.name, "Greek yogurt, vanilla");
  assert.equal(f?.serving, "1 container");
  assert.equal(f?.calories, 140);
  assert.equal(f?.protein, 12);
});

test("USDA food without calories is skipped; generic food falls back to 100 g", () => {
  assert.equal(parseFdcFood({ description: "Water", foodNutrients: [nut("203", 0)] }), null);
  assert.equal(parseFdcFood({ description: "Rice, white, cooked", foodNutrients: [nut("208", 130, "KCAL")] })?.serving, "100 g");
});

test("Open Food Facts product: per serving when labeled, else per 100 g, kJ converted", () => {
  const perServing = parseOffProduct({ product_name: "Nutella", brands: "Ferrero,Nutella", serving_size: "15 g", nutriments: { "energy-kcal_serving": 80, "energy-kcal_100g": 539, proteins_serving: 0.9, carbohydrates_serving: 8.6, fat_serving: 4.6 } });
  assert.deepEqual(perServing, { name: "Nutella", brand: "Ferrero", serving: "15 g", calories: 80, protein: 0.9, carbs: 8.6, fat: 4.6, source: "off" });
  const per100 = parseOffProduct({ product_name: "Oat drink", nutriments: { "energy-kj_100g": 196, proteins_100g: 1 } });
  assert.equal(per100?.serving, "100 g");
  assert.equal(per100?.calories, 47);
  assert.equal(parseOffProduct({ product_name: "", nutriments: { "energy-kcal_100g": 10 } }), null);
});

test("results from both databases are interleaved without repeats", () => {
  const a = (name: string) => ({ name, brand: "", serving: "", calories: 1, protein: 0, carbs: 0, fat: 0, source: "usda" as const });
  assert.deepEqual(mergeFound([[a("A"), a("B")], [a("a"), a("C"), a("D")]]).map((f) => f.name), ["A", "B", "C", "D"]);
  assert.equal(mergeFound([[a("1"), a("2"), a("3")]], 2).length, 2);
});

test("AI meal estimates are checked and capped", () => {
  const foods = cleanAiFoods({ items: [{ name: "Pepperoni pizza", serving: "2 slices", calories: 620, protein: 26, carbs: 68, fat: 26 }, { name: "", calories: 5 }, { name: "Mystery", calories: "lots" }, { name: "Huge", calories: 99999 }] });
  assert.deepEqual(foods.map((f) => [f.name, f.calories]), [["Pepperoni pizza", 620], ["Huge", 5000]]);
  assert.deepEqual(cleanAiFoods("nope"), []);
  assert.ok(isBarcode("0123456789012") && !isBarcode("12ab") && !isBarcode("1234567"));
});
