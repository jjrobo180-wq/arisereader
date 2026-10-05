// "Independent Reader" comes off the school list, and the students who picked it become independent students.
// Run with: npx tsx --test tests/independent-transfer.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { isIndependentSchoolName } from "../shared/independent";
import { TRANSFER_LOG_KEY, transferIndependentStudents, type TransferStudent } from "../server/independentTransfer";

test("the old school-list entry is recognised however it was typed, and real schools are not", () => {
  for (const name of ["Independent Reader", "independent readers", "Independent Student", "INDEPENDENT STUDENTS", "Independent Learner", "Independent", " Independent  Reader (no school) ", "Independent-Reader"]) {
    assert.equal(isIndependentSchoolName(name), true, name);
  }
  for (const name of ["", null, "CGMS", "Lakeside Independent School", "Independence High", "Independent School District 12", "Independent Day School", "Reader Independent", "Homeschool"]) {
    assert.equal(isIndependentSchoolName(name), false, String(name));
  }
});

const NOW = Date.parse("2026-10-05T18:00:00Z");
const student = (id: number, over: Partial<TransferStudent> = {}): TransferStudent => ({
  id, username: `kid${id}`, displayName: `Kid ${id}`, teacherId: null, classId: null, approvedByTeacher: true, ...over,
});

function world() {
  const schools = [{ id: 3, name: "CGMS" }, { id: 9, name: "Independent Reader" }];
  // 10: picked the entry and "my teacher isn't listed". 11: picked it and a "teacher" listed under it, still waiting for approval.
  // 12: picked it, but has since been put in a real CGMS class. 13: a real CGMS student.
  const at: Record<number, TransferStudent[]> = {
    9: [student(10), student(11, { teacherId: 70, classId: 4, approvedByTeacher: false }), student(12, { teacherId: 50 })],
    3: [student(13, { teacherId: 50 })],
  };
  const teacherSchools: Record<number, number | null> = { 50: 3, 70: 9 };
  const settings = new Map<string, string>([
    ["student_signup_types", JSON.stringify({ 10: "teacher_not_listed", 11: "school", 13: "school", 99: "independent" })],
    ["teacher_students", JSON.stringify({ 70: [11, 44], 50: [12, 13] })],
    ["unlisted_signup_requests", JSON.stringify([
      { userId: 10, schoolId: 9, teacherName: "Mom", resolved: false },
      { userId: 77, schoolName: "Oak Hill", resolved: false },
    ])],
  ]);
  const detached: number[] = [];
  const notes: Array<{ title: string; message: string }> = [];
  const down = { db: false };
  const deps = {
    schools: async () => schools,
    studentsAtSchool: async (id: number) => { if (down.db) throw new Error("database unreachable"); return (at[id] || []).filter((s) => !detached.includes(s.id)); },
    teacherSchoolId: async (id: number) => teacherSchools[id] ?? null,
    detach: async (id: number) => { detached.push(id); },
    getSetting: async (k: string) => settings.get(k) ?? "",
    upsertSetting: async (k: string, v: string) => { settings.set(k, v); },
    notifyAdmins: async (title: string, message: string) => { notes.push({ title, message }); },
    now: () => NOW,
  };
  const json = (k: string) => JSON.parse(settings.get(k) || "null");
  return { deps, settings, detached, notes, json, down, schools };
}

test("students who picked Independent Reader become independent students", async () => {
  const w = world();
  const result = await transferIndependentStudents(w.deps);
  assert.deepEqual(result, { moved: 2, kept: 1, schools: ["Independent Reader"] });
  // school, teacher and class cleared for the two who are really independent
  assert.deepEqual(w.detached, [10, 11]);
  // recorded the same way as someone who used the independent sign-up; nobody else is touched
  assert.deepEqual(w.json("student_signup_types"), { 10: "independent", 11: "independent", 13: "school", 99: "independent" });
  // off the list of the "teacher" they had picked; other rosters are as they were
  assert.deepEqual(w.json("teacher_students"), { 70: [44], 50: [12, 13] });
  // no longer waiting for the admin to find them a teacher; the Oak Hill student still is
  assert.deepEqual(w.json("unlisted_signup_requests").map((r: any) => [r.userId, r.resolved]), [[10, true], [77, false]]);
});

test("a student who is in a real school's class is left alone", async () => {
  const w = world();
  await transferIndependentStudents(w.deps);
  assert.ok(!w.detached.includes(12), "in a CGMS teacher's class");
  assert.ok(!w.detached.includes(13), "a CGMS student");
  assert.equal(w.json("student_signup_types")[12], undefined);
});

test("what each student had before is written down, so the move can be undone", async () => {
  const w = world();
  await transferIndependentStudents(w.deps);
  assert.deepEqual(w.json(TRANSFER_LOG_KEY), [
    { userId: 10, username: "kid10", fromSchoolId: 9, fromSchoolName: "Independent Reader", fromTeacherId: null, fromClassId: null, wasApproved: true, at: "2026-10-05T18:00:00.000Z" },
    { userId: 11, username: "kid11", fromSchoolId: 9, fromSchoolName: "Independent Reader", fromTeacherId: 70, fromClassId: 4, wasApproved: false, at: "2026-10-05T18:00:00.000Z" },
  ]);
});

test("the admin is told once, and running it again does nothing", async () => {
  const w = world();
  await transferIndependentStudents(w.deps);
  assert.equal(w.notes.length, 1);
  assert.equal(w.notes[0].title, "Students moved to independent accounts");
  assert.equal(w.notes[0].message, "2 students who picked “Independent Reader” at sign-up are now independent students: no school and no teacher. 1 student was left alone because they are in a class at another school.");

  const again = await transferIndependentStudents(w.deps);
  assert.deepEqual([again.moved, again.kept], [0, 1]);
  assert.equal(w.notes.length, 1, "no second notice");
  assert.equal(w.json(TRANSFER_LOG_KEY).length, 2, "nothing logged twice");
});

test("with no Independent Reader entry, or a database hiccup, nothing is changed", async () => {
  const none = world();
  none.schools.pop();
  assert.deepEqual(await transferIndependentStudents(none.deps), { moved: 0, kept: 0, schools: [] });
  assert.deepEqual(none.detached, []);
  assert.equal(none.settings.has(TRANSFER_LOG_KEY), false);

  const hiccup = world();
  hiccup.down.db = true;
  await assert.rejects(() => transferIndependentStudents(hiccup.deps), /database unreachable/);
  assert.deepEqual(hiccup.detached, []);
  assert.equal(hiccup.json("student_signup_types")[10], "teacher_not_listed");
});

test("a student whose move fails is not marked independent, and is picked up next time", async () => {
  const w = world();
  let failOnce = true;
  const detach = w.deps.detach;
  w.deps.detach = async (id: number) => { if (id === 11 && failOnce) { failOnce = false; throw new Error("write failed"); } return detach(id); };
  const first = await transferIndependentStudents(w.deps);
  assert.equal(first.moved, 1);
  assert.deepEqual(w.json("student_signup_types")[11], "school");
  assert.deepEqual(w.json("teacher_students")[70], [11, 44]);
  const second = await transferIndependentStudents(w.deps);
  assert.equal(second.moved, 1);
  assert.equal(w.json("student_signup_types")[11], "independent");
});
