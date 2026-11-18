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
  assert.equal(isOn("inspire", f), false);
  assert.equal(isOn("inspire", { sections: { ...f.sections, inspire: true } }), true);
  assert.equal(isOn("inspire", { sections: { ...f.sections, journal: true } }), true);
  assert.equal(isOn("inspire", { sections: { ...f.sections, inspire: false, journal: true } }), false);
});

test("Health Lite is gone everywhere (Nov 15, 2026); the health tools someone picked stay on, in the menu", () => {
  const f = emptyFamily();
  assert.equal(isOn("healthlite", { sections: { ...f.sections, healthlite: true, cycle: true } }), false);
  assert.ok(!BUNDLES.some((b) => b.id === "healthlite"));
  for (const id of ["health", "cycle", "pills", "mood", "sleep", "medical"]) assert.equal(parentOf(id), undefined, `${id} is its own plugin, shown in the menu`);
  // Nov 17, 2026: the health & fitness plugins were retired too (Cooked covers fitness and food).
  assert.equal(isOn("cycle", { sections: { ...f.sections, healthlite: true, cycle: true } }), false);
  assert.ok(!read("client/src/components/family-hub/lifeApps.tsx").includes('bundleId="healthlite"'));
  assert.ok(!read("client/src/components/family-hub/Members.tsx").includes('"Health Lite"'));
});

test("the picker opens on first use", () => {
  const ui = read("client/src/components/family-hub/BundleApp.tsx");
  assert.match(ui, /data-testid="bundle-promo"/);
  assert.match(ui, /useState\(!asked && bundle\.fixed\.length === 0\)/);
  assert.match(read("client/src/pages/AriseTodo.tsx"), /!parentOf\(id\) && isOn\(id, family\)/);
});
