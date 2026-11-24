// "Set up your family" shows on FamilyHub's Home only, not LifeHub's (Nov 23, 2026).
// Run: npx tsx --test tests/family-setup-banner.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the Set up your family banner and tile need setupFamily, which only FamilyHub passes", () => {
  const home = read("client/src/components/family-hub/FamilyHome.tsx");
  assert.match(home, /setupFamily = false/);
  assert.match(home, /setupFamily && !family\.members\.length \? \[\{ id: "setup-family"/);
  assert.match(home, /\{setupFamily && !family\.members\.length && !tileMode && <section/);
  assert.match(read("client/src/pages/AriseTodo.tsx"), /<FamilyHome \{\.\.\.common\} setupFamily=\{familySpace\}/);
});
