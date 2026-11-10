import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { didYouMean, distance } from "../shared/didYouMean";

test("Did you mean: common grocery typos are fixed, right words are left alone", () => {
  const cases: [string, string | null][] = [
    ["tortila chps", "tortilla chips"], ["Cofee", "Coffee"], ["bagles", "bagels"], ["brocoli", "broccoli"], ["spagetti", "spaghetti"],
    ["milk, egs, bred", "milk, eggs, bread"], ["gold fsh", "gold fish"], ["teriyki sauce", "teriyaki sauce"], ["paper towls", "paper towels"],
    ["Chicken", null], ["Nutrigrain bar", null], ["milk, eggs, bread", null], ["xyzzy", null], ["ok", null],
  ];
  for (const [typed, want] of cases) assert.equal(didYouMean(typed), want, typed);
  assert.equal(didYouMean("Grandmas casarole", ["Grandmas casserole"]), "Grandmas casserole", "your own dish names count too");
  assert.equal(distance("teh", "the"), 1, "two letters swapped is one slip");
});

test("Did you mean shows under every box where food is typed", () => {
  const r = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  for (const f of ["KitchenShop.tsx", "Grocery.tsx", "kitchen/WeekPlanner.tsx", "kitchen/DishEditor.tsx"]) assert.match(r(`client/src/components/family-hub/${f}`), /<DidYouMean /, f);
});
