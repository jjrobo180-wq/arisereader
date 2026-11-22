// Arise Reader's rewards have their own menu: /rewards. Run with: npx tsx --test tests/reader-rewards-menu.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the student menu has Rewards on its own, next to Progress", () => {
  const lib = read("client/src/pages/Library.tsx");
  assert.match(lib, /data-testid="menu-rewards" onClick=\{\(\) => \{ navigate\("\/rewards"\);/);
  assert.match(lib, /<span className="block text-xs font-black">Rewards<\/span>/);
  assert.doesNotMatch(lib, /Progress & Rewards/);
});

test("/rewards: the Reward Store page for a student, the family's Rewards for a parent", () => {
  const app = read("client/src/App.tsx");
  assert.match(app, /<Route path="\/rewards">\s*\{user\?\.role === "parent" \? <Redirect to="\/reader\?view=rewards" replace \/> : <ProtectedRoute><StudentProgress view="rewards" \/><\/ProtectedRoute>\}/);
  const progress = read("client/src/pages/StudentProgress.tsx");
  assert.match(progress, /export default function StudentProgress\(\{ view \}: \{ view\?: "rewards" \} = \{\}\)/);
  assert.match(progress, /t === "rewards" && view !== "rewards" \? navigate\("\/rewards"\)/, "the old Rewards tab opens the new menu");
  assert.match(progress, /\{tab === "rewards" && <RewardStore token=\{authToken\} \/>\}/);
  assert.match(read("client/src/components/family-hub/Reader.tsx"), /get\("view"\) === "rewards" \? "prizes" : "progress"/);
});
