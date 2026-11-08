// A.R.I.S.E. Reader is paid from November 9, 2026: $7 a family, $20 per 99 students, $100 a school.
// Every account made before then keeps it free.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLANS, priceOf, readerAccessFor } from "../shared/plans";

const OLD = "2026-10-15T00:00:00Z", NEW = "2026-11-10T00:00:00Z", NOW = Date.parse("2026-11-12T00:00:00Z");
const live = { kind: "teacher", ownerId: 1, source: "stripe", status: "active", seats: 99, endsAt: "2026-12-12T00:00:00Z", updatedAt: NEW } as any;

test("the new prices", () => {
  assert.equal(PLANS.bundle.familyMonthlyCents, 700);
  assert.equal(PLANS.teacher.monthlyCents, 2000);
  assert.equal(PLANS.teacher.studentsPerBlock, 99);
  assert.deepEqual([priceOf("school").cents, priceOf("school").interval], [10000, "month"]);
  assert.equal(priceOf("teacher").seats(1), 99);
});

test("every account made before November 9 keeps Reader free", () => {
  for (const role of ["student", "teacher", "parent"]) assert.deepEqual(readerAccessFor({ id: 1, role, createdAt: OLD }, { now: NOW }), { access: true, via: "existing" });
  assert.equal(readerAccessFor({ id: 1, role: "student" }, { now: NOW }).access, true, "no sign-up date on record: an old account");
});

test("new accounts need a plan", () => {
  for (const role of ["student", "teacher", "parent"]) assert.equal(readerAccessFor({ id: 1, role, createdAt: NEW }, { now: NOW }).access, false, role);
  assert.equal(readerAccessFor({ id: 1, role: "teacher", createdAt: NEW }, { now: NOW, teacherGrant: live }).via, "teacher-plan");
  assert.equal(readerAccessFor({ id: 1, role: "teacher", createdAt: NEW }, { now: NOW, schoolGrant: { ...live, kind: "school" } }).via, "school-plan");
  assert.equal(readerAccessFor({ id: 1, role: "parent", createdAt: NEW }, { now: NOW, familyGrants: [{ ...live, kind: "bundle_family" }] }).via, "family-plan");
  assert.equal(readerAccessFor({ id: 2, role: "student", createdAt: NEW }, { now: NOW, familyGrants: [null, { ...live, kind: "bundle_family" }] }).via, "family-plan");
  assert.equal(readerAccessFor({ id: 2, role: "student", createdAt: NEW }, { now: NOW, classTeacherAccess: true }).via, "class");
  assert.equal(readerAccessFor({ id: 2, role: "student", createdAt: NEW, approvedByTeacher: false }, { now: NOW, classTeacherAccess: true }).access, false, "not yet approved into the class");
  assert.equal(readerAccessFor({ id: 1, role: "parent", createdAt: NEW }, { now: NOW, familyGrants: [{ ...live, status: "canceled" }] }).access, false, "a canceled plan");
});

test("the admin, sample accounts and non-Reader accounts are never locked", () => {
  assert.equal(readerAccessFor({ id: 1, role: "student", isAdmin: true, createdAt: NEW }, { now: NOW }).access, true);
  assert.equal(readerAccessFor({ id: 1, role: "student", username: "sample-appreview", createdAt: NEW }, { now: NOW }).via, "sample");
  assert.equal(readerAccessFor({ id: 1, role: "todo", createdAt: NEW }, { now: NOW }).via, "not-reader");
});

test("the Reader is locked only on arisereader.com and in the Reader apps, with a subscribe page", () => {
  const app = readFileSync("client/src/App.tsx", "utf8");
  assert.match(app, /const onReader = !!user && !user\.isAdmin && isReaderHost\(\) && nativeFlavor\(\) !== "eyegaze"/);
  assert.match(app, /readerLocked\(plan\)[^\n]*<Redirect to="\/subscribe"/);
  const page = readFileSync("client/src/pages/ReaderSubscribe.tsx", "utf8");
  assert.match(page, /Subscribe on arisereader\.com/, "the iPhone app sends buyers to the website");
  assert.match(page, /product: "bundle"/);
});
