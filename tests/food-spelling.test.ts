// LifeHub food search forgives spelling: misspelled and half-typed foods still find what was meant.
// Run with: npx tsx --test tests/food-spelling.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { COMMON_FOODS } from "../shared/familyHealth";
import { editDistance, fixFoodSpelling, foodScore, searchByName } from "../shared/foodSpelling";

const first = (q: string) => searchByName(COMMON_FOODS, q, 3)[0]?.name.toLowerCase() ?? "";

test("misspelled and half-typed foods are found", () => {
  assert.match(first("chiken"), /chicken/);
  assert.match(first("bananna"), /banana/);
  assert.match(first("brocoli"), /broccoli/);
  assert.match(first("oatmel"), /oatmeal/);
  assert.match(first("scrambeled eggs"), /scrambled eggs/);
  assert.match(first("yog"), /yogurt/);
  assert.equal(searchByName(COMMON_FOODS, "xyzq", 5).length, 0);
});

test("exact matches come before close ones, and short words must be right", () => {
  assert.ok(foodScore("White rice, cooked", "rice") > foodScore("Vanilla ice cream", "rice"));
  assert.equal(foodScore("Ham sandwich", "jam"), 0);
  assert.equal(editDistance("chiken", "chicken"), 1);
  assert.equal(editDistance("sandwhich", "sandwich"), 1);
});

test("a search is fixed before it goes to the food databases", () => {
  assert.equal(fixFoodSpelling("chiken nugets"), "chicken nuggets");
  assert.equal(fixFoodSpelling("strawbery yogurt"), "strawberry yogurt");
  assert.equal(fixFoodSpelling("chicken nuggets"), null);
  assert.equal(fixFoodSpelling("big mac"), null);
});
