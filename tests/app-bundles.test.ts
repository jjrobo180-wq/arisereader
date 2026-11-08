// Health Lite, Journal & Inspiration and Kitchen: one plugin each, old plugins inside as pages (November 2026).
// Run with: npx tsx --test tests/app-bundles.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BUNDLES, parentOf } from "../shared/appBundles";
import { emptyFamily, isOn } from "../shared/familyHub";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("every bundle page belongs to exactly one bundle", () => {
  const seen = new Set<string>();
  for (const b of BUNDLES) for (const id of [...b.fixed, ...b.groups.flatMap((g) => g.members.map((m) => m.id))]) { assert.ok(!seen.has(id), id); seen.add(id); assert.equal(parentOf(id), b.id); }
});

test("a bundle is on when added, or when any of its old pages was already on", () => {
  const f = emptyFamily();
  assert.equal(isOn("healthlite", f), false);
  assert.equal(isOn("healthlite", { sections: { ...f.sections, healthlite: true } }), true);
  assert.equal(isOn("healthlite", { sections: { ...f.sections, cycle: true } }), true);
  assert.equal(isOn("healthlite", { sections: { ...f.sections, healthlite: false, cycle: true } }), false);
});

test("Health Lite promotes Arise Fit and the picker opens on first use", () => {
  const hl = BUNDLES.find((b) => b.id === "healthlite")!;
  assert.match(hl.promo!.cta, /Arise Fit/);
  const ui = read("client/src/components/family-hub/BundleApp.tsx");
  assert.match(ui, /data-testid="bundle-promo"/);
  assert.match(ui, /useState\(!asked && bundle\.fixed\.length === 0\)/);
  assert.match(read("client/src/pages/AriseTodo.tsx"), /!parentOf\(id\) && isOn\(id, family\)/);
});
