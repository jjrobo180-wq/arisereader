// Plan rules: prices, who is grandfathered, and who gets Premium.
// Run with: npx tsx --test tests/plans.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  PLANS, usd, blocksFor, seatsFor, teacherMonthlyCents, clampBlocks, grantLive, grandfathered, isDemoAccount,
  entitlementFor, parentCanLink, isFreeSchoolName, type PlanGrant,
} from "../shared/plans";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-15T18:00:00Z");
const EARLY = "2026-09-10T15:00:00Z";  // signed up before October 1, 2026
const LATE = "2026-10-03T15:00:00Z";   // signed up after
const grant = (over: Partial<PlanGrant> = {}): PlanGrant => ({
  kind: "teacher", ownerId: 50, source: "stripe", status: "active", seats: 100,
  endsAt: new Date(NOW + 20 * DAY).toISOString(), updatedAt: new Date(NOW).toISOString(), ...over,
});
const on = { enforced: true, now: NOW };

test("the prices are the ones on the pricing page", () => {
  assert.equal(usd(PLANS.teacher.monthlyCents), "$10");
  assert.equal(PLANS.teacher.studentsPerBlock, 100);
  assert.equal(usd(PLANS.school.yearlyCents), "$700");
  assert.equal(PLANS.school.studentCap, 1000);
  assert.equal(PLANS.parentMaxChildren, 5);
  assert.equal(usd(1250), "$12.50");
});

test("a teacher pays for one block of 100 students, then one more per extra 100", () => {
  assert.equal(blocksFor(0), 1);
  assert.equal(blocksFor(1), 1);
  assert.equal(blocksFor(100), 1);
  assert.equal(blocksFor(101), 2);
  assert.equal(blocksFor(250), 3);
  assert.equal(blocksFor(-5), 1);
  assert.equal(blocksFor(1e9), PLANS.teacher.maxBlocks);
  assert.equal(seatsFor(3), 300);
  assert.equal(teacherMonthlyCents(3), 3000);
  assert.equal(clampBlocks("2"), 2);
  assert.equal(clampBlocks("abc"), 1);
  assert.equal(clampBlocks(0), 1);
  assert.equal(clampBlocks(999), PLANS.teacher.maxBlocks);
});

test("a plan is live until it ends, plus a short grace period", () => {
  assert.equal(grantLive(null, NOW), false);
  assert.equal(grantLive(grant(), NOW), true);
  assert.equal(grantLive(grant({ endsAt: null, source: "admin" }), NOW), true, "no end date");
  assert.equal(grantLive(grant({ status: "canceled" }), NOW), false);
  assert.equal(grantLive(grant({ status: "past_due" }), NOW), true);
  assert.equal(grantLive(grant({ endsAt: new Date(NOW - 1 * DAY).toISOString() }), NOW), true, "inside the grace period");
  assert.equal(grantLive(grant({ endsAt: new Date(NOW - (PLANS.graceDays + 1) * DAY).toISOString() }), NOW), false);
  assert.equal(grantLive(grant({ endsAt: "not a date" }), NOW), false);
});

test("sign-ups before October 1, 2026 are grandfathered until the school year ends", () => {
  assert.equal(grandfathered(EARLY, NOW), true);
  assert.equal(grandfathered(LATE, NOW), false);
  // the cutoff is midnight Mountain time
  assert.equal(grandfathered("2026-10-01T05:59:59Z", NOW), true);
  assert.equal(grandfathered("2026-10-01T06:00:00Z", NOW), false);
  assert.equal(grandfathered(new Date(EARLY), NOW), true);
  assert.equal(grandfathered(Date.parse(EARLY), NOW), true);
  // an account with no sign-up date on record is an old one
  assert.equal(grandfathered(null, NOW), true);
  assert.equal(grandfathered("", NOW), true);
  // the free year runs out
  assert.equal(grandfathered(EARLY, Date.parse("2027-06-30T12:00:00Z")), true);
  assert.equal(grandfathered(EARLY, Date.parse("2027-07-01T06:00:00Z")), false);
  assert.equal(grandfathered(null, Date.parse("2027-09-01T00:00:00Z")), false);
});

test("nothing is locked until the admin turns plan rules on", () => {
  for (const role of ["teacher", "student", "parent"]) {
    const e = entitlementFor({ id: 7, role, createdAt: LATE }, { enforced: false, now: NOW });
    assert.deepEqual([e.premium, e.via], [true, "rules-off"], role);
  }
  assert.equal(entitlementFor(null, { enforced: false }).premium, false);
});

test("admins and the sample accounts always have Premium", () => {
  assert.equal(entitlementFor({ id: 1, role: "student", isAdmin: true, createdAt: LATE }, on).via, "admin");
  assert.equal(entitlementFor({ id: 1, role: "admin", createdAt: LATE }, on).via, "admin");
  assert.equal(entitlementFor({ id: 9, role: "student", username: "sample", createdAt: LATE }, on).via, "demo");
  assert.equal(entitlementFor({ id: 9, role: "parent", username: "sample-parent", createdAt: LATE }, on).via, "demo");
  assert.equal(isDemoAccount("Tutorial-Eye"), true);
  assert.equal(isDemoAccount("samantha"), false);
  // exact names only: nobody gets Premium by choosing a username that starts with "sample"
  assert.equal(isDemoAccount("samplesmith"), false);
  assert.equal(entitlementFor({ id: 60, role: "teacher", username: "sample_teacher", createdAt: LATE }, on).premium, false);
});

test("a teacher has Premium through their own plan, their school's plan, or an early sign-up", () => {
  const teacher = { id: 50, role: "teacher", createdAt: LATE, schoolId: 3 };
  assert.deepEqual(entitlementFor(teacher, on), { premium: false, via: null, seats: null, endsAt: null });

  const own = entitlementFor(teacher, { ...on, teacherGrant: grant({ seats: 200 }) });
  assert.deepEqual([own.premium, own.via, own.seats], [true, "teacher-plan", 200]);

  const school = entitlementFor(teacher, { ...on, schoolGrant: grant({ kind: "school", ownerId: 3, seats: 1000 }) });
  assert.deepEqual([school.premium, school.via, school.seats], [true, "school-plan", 1000]);

  // their own plan is named first when they have both
  assert.equal(entitlementFor(teacher, { ...on, teacherGrant: grant(), schoolGrant: grant({ kind: "school" }) }).via, "teacher-plan");
  // a plan that ran out does not count
  assert.equal(entitlementFor(teacher, { ...on, teacherGrant: grant({ status: "canceled" }) }).premium, false);

  const old = entitlementFor({ ...teacher, createdAt: EARLY }, on);
  assert.deepEqual([old.premium, old.via, old.endsAt], [true, "grandfathered", PLANS.grandfatherUntil]);
  assert.equal(entitlementFor({ ...teacher, createdAt: EARLY }, { enforced: true, now: Date.parse("2027-08-01T00:00:00Z") }).premium, false);
});

test("a student gets the Premium extras through the teacher who approved them", () => {
  const student = { id: 10, role: "student", createdAt: LATE, teacherId: 50, schoolId: 3 };
  const teacher = { id: 50, role: "teacher", createdAt: LATE, schoolId: 3 };

  assert.equal(entitlementFor(student, { ...on, classTeacher: teacher }).premium, false, "teacher has no plan");
  assert.equal(entitlementFor(student, { ...on, classTeacher: teacher, classTeacherGrant: grant() }).via, "class");
  assert.equal(entitlementFor(student, { ...on, classTeacher: teacher, classTeacherSchoolGrant: grant({ kind: "school" }) }).via, "class");
  assert.equal(entitlementFor(student, { ...on, classTeacher: { ...teacher, createdAt: EARLY } }).via, "class", "teacher signed up early");
  assert.equal(entitlementFor(student, { ...on, classTeacher: { ...teacher, accountApproved: false }, classTeacherGrant: grant() }).premium, false, "teacher not approved yet");
  // the teacher has to have approved the student into the class
  assert.equal(entitlementFor({ ...student, approvedByTeacher: false }, { ...on, classTeacher: teacher, classTeacherGrant: grant() }).premium, false, "student still waiting for approval");
  // naming a paying school at sign-up is not enough: the extras come through a teacher there
  assert.equal(entitlementFor({ id: 13, role: "student", createdAt: LATE, schoolId: 3 }, { ...on, schoolGrant: grant({ kind: "school", ownerId: 3 }) }).premium, false);

  // a school student who signed up early keeps what they had
  assert.equal(entitlementFor({ ...student, createdAt: EARLY }, on).via, "grandfathered");
  assert.equal(entitlementFor({ id: 11, role: "student", createdAt: EARLY, schoolId: 3 }, on).via, "grandfathered");
  // a reader with no school is on the Free plan, early or not
  assert.equal(entitlementFor({ id: 12, role: "student", createdAt: EARLY }, on).premium, false);
  assert.equal(entitlementFor({ id: 12, createdAt: LATE }, on).premium, false, "no role means student");
});

test("parents are free, and a profile follows up to five children", () => {
  assert.equal(entitlementFor({ id: 80, role: "parent", createdAt: EARLY }, on).premium, false);
  assert.equal(parentCanLink(0, { enforced: true }), true);
  assert.equal(parentCanLink(4, { enforced: true }), true);
  assert.equal(parentCanLink(5, { enforced: true }), false);
  assert.equal(parentCanLink(9, { enforced: false }), true, "rules off");
  assert.equal(parentCanLink(9, { enforced: true, premiumFamily: true }), true, "a family in a Premium class");
});

test("CGMS is recognised by its short name or its full name, and other schools are not", () => {
  for (const name of ["CGMS", "cgms", "CGMS Tigers", "C.G.M.S.", "Cedar Grove Middle School", "Cedar Grove Middle", "cedar-grove middle school"]) {
    assert.equal(isFreeSchoolName(name), true, name);
  }
  for (const name of ["", null, "Lincoln Middle", "CGMSX Academy", "Cedar Grove Elementary", "Central High School", "Middle", "Cedar Grove"]) {
    assert.equal(isFreeSchoolName(name), false, String(name));
  }
});

test("an always-free school has no student limit and no end date", () => {
  const teacher = { id: 60, role: "teacher", createdAt: LATE, schoolId: 7 };
  const free = grant({ kind: "school", ownerId: 7, source: "admin", seats: 1000, endsAt: null, free: true });
  assert.deepEqual(entitlementFor(teacher, { ...on, schoolGrant: free }), { premium: true, via: "school-plan", seats: null, endsAt: null });
  // and the students in that teacher's class come along
  const student = { id: 20, role: "student", createdAt: LATE, teacherId: 60, schoolId: 7 };
  assert.equal(entitlementFor(student, { ...on, classTeacher: teacher, classTeacherSchoolGrant: free }).via, "class");
});
