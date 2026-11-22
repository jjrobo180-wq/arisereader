// Arise Reader is 100% free for everyone until the owner sets a cap (READER_FREE_FOR_ALL in shared/plans.ts).
// Run with: npx tsx --test tests/reader-free.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { READER_FREE_FOR_ALL, readerAccessFor } from "../shared/plans";

const NEW = "2026-11-20T00:00:00Z"; // after the paid plans started: these accounts were locked before
const now = Date.parse("2026-11-22T00:00:00Z");

test("the switch is on", () => assert.equal(READER_FREE_FOR_ALL, true));

test("a brand-new student, parent and teacher with no plan all read free", () => {
  for (const role of ["student", "parent", "teacher"] as const) {
    const p = { id: 9, role, createdAt: NEW, username: "newkid" } as any;
    assert.deepEqual(readerAccessFor(p, { now }), { access: false, via: null }, `${role}: locked without the switch`);
    assert.deepEqual(readerAccessFor(p, { now, freeForAll: true }), { access: true, via: "free" }, `${role}: free with it`);
  }
});

test("a family that pays still counts as paying (their paid rewards keep working)", () => {
  const grant = { startsAt: "2026-11-01T00:00:00Z", endsAt: "2027-11-01T00:00:00Z" } as any;
  const kid = { id: 3, role: "student", createdAt: NEW, username: "kid" } as any;
  assert.equal(readerAccessFor(kid, { now, freeForAll: true, familyGrants: [grant] }).via, "family-plan");
});

test("the server turns it on after the plan lookups, and the paid-rewards check still asks for a real family plan", () => {
  const server = readFileSync(join(new URL("..", import.meta.url).pathname, "server/plans.ts"), "utf8");
  assert.match(server, /value = readerAccessFor\(p, \{ \.\.\.facts, freeForAll: READER_FREE_FOR_ALL \}\);/);
  const routes = readFileSync(join(new URL("..", import.meta.url).pathname, "server/routes.ts"), "utf8");
  assert.match(routes, /a\.via === "family-plan" \|\| a\.via === "admin"/);
});
