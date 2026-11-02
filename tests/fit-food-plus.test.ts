// Arise Fit food tracking: saved meals are kept and cleaned; the food tab leads with the AI photo.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanFit } from "../shared/fit";

test("saved meals are kept, cleaned and capped", () => {
  const d = cleanFit({ savedMeals: [{ id: "m1", name: "Big breakfast", items: [{ name: "Eggs", kcal: 300, p: 20, c: 2, f: 20, servings: 1, junk: 1 }] }, { id: "m2", name: "Empty", items: [] }, { name: "no id", items: [{ name: "x", kcal: 1 }] }] });
  assert.equal(d.savedMeals?.length, 1); assert.equal(d.savedMeals?.[0].items[0].kcal, 300); assert.equal((d.savedMeals?.[0].items[0] as any).junk, undefined);
  assert.equal(cleanFit({}).savedMeals, undefined);
});

test("the food tab: AI photo first, barcode, copy yesterday, save a meal, weekly report", () => {
  const s = readFileSync("client/src/pages/fit/FitFood.tsx", "utf8");
  for (const id of ["fit-snap-meal", "fit-scan-quick", "fit-copy-", "fit-save-", "fit-open-report", "fit-ai-add-each"]) assert.ok(s.includes(id), id);
  assert.match(s, /items=\{\[\{ id: "ai", label: "AI photo" \}/, "AI photo is the first way to add food");
  assert.match(s, /export function weekStats/);
});
