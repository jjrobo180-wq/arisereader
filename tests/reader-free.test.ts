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

test("a brand-new student and parent with no plan read free", () => {
  for (const role of ["student", "parent"] as const) {
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

test("teachers: a school or district license; every teacher signed up before the change keeps their account", () => {
  const before = { id: 1, role: "teacher", createdAt: "2026-11-20T00:00:00Z", username: "t1" } as any;
  const after = { id: 2, role: "teacher", createdAt: "2026-11-24T00:00:00Z", username: "t2" } as any;
  const later = Date.parse("2026-12-01T00:00:00Z");
  assert.deepEqual(readerAccessFor(before, { now: later, freeForAll: true }), { access: true, via: "existing" });
  assert.deepEqual(readerAccessFor(after, { now: later, freeForAll: true }), { access: false, via: null }, "free for all doesn't cover new teachers");
  const grant = { startsAt: "2026-11-01T00:00:00Z", endsAt: "2027-11-01T00:00:00Z" } as any;
  assert.equal(readerAccessFor(after, { now: later, freeForAll: true, schoolGrant: grant }).via, "school-plan");
  assert.equal(readerAccessFor({ ...after, createdAt: null }, { now: later }).access, true, "no sign-up date on record: an old account");
});

test("the teacher pages sell school and district licenses, not one-teacher plans", () => {
  const billing = readFileSync(join(new URL("..", import.meta.url).pathname, "client/src/pages/Billing.tsx"), "utf8");
  assert.doesNotMatch(billing, /data-testid="billing-buy-teacher"/, "no one-teacher Reader plan for sale");
  assert.match(billing, /data-testid="billing-district"/);
  assert.match(billing, /Teacher accounts come with a school license/);
  const sub = readFileSync(join(new URL("..", import.meta.url).pathname, "client/src/pages/ReaderSubscribe.tsx"), "utf8");
  assert.match(sub, /\{ who: "Students & parents", price: "Free"/);
  assert.match(sub, /\{ who: "Districts", price: "Ask"/);
  assert.doesNotMatch(sub, /who: "Teachers"/);
});
