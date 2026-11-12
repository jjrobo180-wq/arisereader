// A username saved with a space after it could never sign in, because sign-in trims what's typed.
// Run with: npx tsx --test tests/login-username-spaces.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

test("looking up a username also finds an older account saved with a space after it, exact match first", () => {
  const body = read("server/storage.ts").split("async getUserByUsername(username: string) {")[1].split("async createUser(")[0];
  const exact = body.indexOf('.eq("username", username)');
  const spaced = body.indexOf('.eq("username", `${username} `)');
  assert.ok(exact > -1 && spaced > exact);
  assert.match(body, /if \(data\) return mapUser\(data\)/);
});

test("student and teacher sign-ups save the username without surrounding spaces", () => {
  const routes = read("server/routes.ts");
  for (const route of ['app.post("/api/register"', 'const { password, displayName, email, schoolId, gradeLevel, gradesTaught } = req.body;']) {
    const after = routes.slice(routes.indexOf(route), routes.indexOf(route) + 400);
    assert.match(after, /const username = typeof req\.body\.username === "string" \? req\.body\.username\.trim\(\) : req\.body\.username;/, route);
  }
});
