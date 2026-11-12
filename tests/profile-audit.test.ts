// Account audit, November 2026: things that left real students and parents unable to use what they have.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readerAccessFor } from "../shared/plans";

const NOW = Date.parse("2026-11-20T12:00:00Z");
const NEW = "2026-11-15T12:00:00Z";
const live = { kind: "school" as const, ownerId: 4, source: "admin" as const, status: "active" as const, seats: 0, endsAt: null, updatedAt: NEW };

test("a new student at a school with a school plan or an always-free school can use the Reader", () => {
  // Most students join by advisory name, with no teacher account on file: their school has to count.
  assert.deepEqual(readerAccessFor({ id: 9, role: "student", createdAt: NEW }, { now: NOW, schoolGrant: live }), { access: true, via: "school-plan" });
  assert.equal(readerAccessFor({ id: 9, role: "student", createdAt: NEW }, { now: NOW, schoolGrant: { ...live, status: "canceled" } }).access, false, "a canceled school plan");
  assert.equal(readerAccessFor({ id: 9, role: "student", createdAt: NEW, approvedByTeacher: false }, { now: NOW, schoolGrant: live }).access, false, "not yet approved");
  assert.equal(readerAccessFor({ id: 9, role: "student", createdAt: NEW }, { now: NOW }).access, false, "no school plan: still a plan to buy");
  assert.equal(readerAccessFor({ id: 9, role: "parent", createdAt: NEW }, { now: NOW, schoolGrant: live }).access, false, "a school plan is for its students, not every parent");
});

test("the server looks up a student's school plan (an always-free school's counts)", () => {
  const s = readFileSync("server/plans.ts", "utf8");
  assert.match(s, /facts\.familyGrants = await Promise\.all\(parents\.map[^\n]*\n[^\n]*\n\s*facts\.schoolGrant = await current\("school", schoolOf\(user\)\);/);
});

test("a parent code from a handout follows a merge to the account that stayed", () => {
  const s = readFileSync("server/routes.ts", "utf8");
  assert.match(s, /const studentForParentCode = async \(studentId: number\)[\s\S]{0,500}from\("account_merges"\)\.select\("keep_id"\)/);
  // Both places a parent types a code: signing up, and linking a child later.
  assert.match(s, /student = await storage\.getUser\(await studentForParentCode\(invite\.student_id\)\);/);
  assert.match(s, /const childId = await studentForParentCode\(Number\(invite\.student_id\)\);/);
  const link = s.slice(s.indexOf("const childId = await studentForParentCode"), s.indexOf("const childId = await studentForParentCode") + 700);
  assert.doesNotMatch(link, /Number\(invite\.student_id\)\)\s*\{|ids\.push\(Number\(invite\.student_id\)\)/, "links the resolved account");
});
