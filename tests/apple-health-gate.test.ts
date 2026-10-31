// The iPhone app and Shortcuts send Apple Health with the diary's private key, not a sign-in, so the
// LifeHub gate in front of /api/arise-todo must let the sync through (it was answering 401).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the LifeHub gate leaves the Apple Health sync open to its own key check", () => {
  const src = readFileSync("server/routes.ts", "utf8");
  const gate = src.slice(src.indexOf('app.use("/api/arise-todo", addonGate('), src.indexOf('"todo_required"'));
  assert.match(gate, /path === "\/api\/arise-todo\/apple-health\/sync"/);
  const health = readFileSync("server/appleHealth.ts", "utf8");
  assert.match(health, /app\.post\("\/api\/arise-todo\/apple-health\/sync", async/, "the sync route itself takes no sign-in");
});
