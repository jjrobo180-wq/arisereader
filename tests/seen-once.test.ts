// To Duo's setup and walkthrough show once per account, not once per device.
// Run with: npx tsx --test tests/seen-once.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the account remembers setup and the walkthrough", () => {
  const server = read("server/ariseTodo.ts");
  assert.match(server, /app\.get\("\/api\/arise-todo\/seen", authMiddleware/);
  assert.match(server, /app\.post\("\/api\/arise-todo\/seen", authMiddleware/);
  assert.match(server, /`seen:\$\{userId\}`/);
  const setup = read("client/src/components/DuoSetup.tsx");
  assert.match(setup, /markSeen\("setup"\); onClose\(\)/);
  const walk = read("client/src/components/AppWalkthrough.tsx");
  assert.match(walk, /markSeen\("walkthrough"\)/);
  assert.match(walk, /if \(seen\?\.walkthrough\)/);
  const todo = read("client/src/pages/AriseTodo.tsx");
  assert.match(todo, /if \(seen\?\.setup\) rememberDuoSetupDone\(user\.id\); else setSetupOpen\(true\)/);
  assert.match(todo, /!setupOpen && setupChecked && <AppWalkthrough/);
});
