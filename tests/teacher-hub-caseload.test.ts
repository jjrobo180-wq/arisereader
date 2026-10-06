// Teacher Hub: changing a student who is already on the caseload.
// Run with: npx tsx --test tests/teacher-hub-caseload.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STUDENT_LISTS, normalizeWorkspace, updateStudent, type Student, type Workspace } from "../shared/teacherHub";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

const jordan: Student = { id: "s1", name: "Jordan Lee", grade: "6", accommodations: "Extra time", iepDate: "2026-11-03", reevalDate: "", readingLevel: "4.2", mathLevel: "5", notes: "" };
const maya: Student = { id: "s2", name: "Maya Torres", grade: "7", accommodations: "", iepDate: "", reevalDate: "", readingLevel: "", mathLevel: "", notes: "" };
const details = (student: Student, change: Partial<Student> = {}) => { const { id: _id, ...rest } = { ...student, ...change }; return rest; };

function hub(): Workspace {
  return normalizeWorkspace({
    students: [jordan, maya],
    meetings: [{ id: "m1", student: "Jordan Lee", type: "Annual IEP", date: "2026-11-03", notes: "", done: false }, { id: "m2", student: "Maya Torres", type: "Other", date: "", notes: "", done: false }],
    notes: [{ id: "n1", student: "jordan  lee", type: "Check-in", body: "Good week", date: "2026-10-01" }, { id: "n2", student: "", type: "Teacher note", body: "General", date: "2026-10-01" }],
    ariseRecords: [{ id: "r1", student: "Jordan Lee", book: "Hatchet", score: "9", points: "5", date: "2026-10-02" }],
    behavior: [{ id: "b1", student: "Jordan Lee", points: 2, reason: "", date: "2026-10-02" }, { id: "b2", student: "Whole group", points: 1, reason: "", date: "2026-10-02" }],
    attendance: [{ id: "a1", student: "Jordan Lee", date: "2026-10-02", status: "Present", className: "" }],
    assignments: [{ id: "q1", title: "Quiz 1", category: "Quiz", points: 10, date: "2026-10-01" }],
    gradeScores: [{ id: "g1", assignmentId: "q1", student: "Jordan Lee", score: 9, missing: false, excused: false }, { id: "g2", assignmentId: "q1", student: "Maya Torres", score: 8, missing: false, excused: false }],
    parentLogs: [{ id: "p1", student: "Jordan Lee", guardian: "Ms. Lee", message: "Called", status: "Called", date: "2026-10-02" }],
    schedules: [{ id: "c1", student: "Jordan Lee", day: "Monday", start: "08:00", end: "08:30", label: "Reading" }],
  });
}

test("a student's details can be changed after they are added", () => {
  const start = hub();
  const result = updateStudent(start, "s1", details(jordan, { grade: "7", iepDate: "2026-12-01", accommodations: "Extra time, small group", notes: "Moved up a grade" }));
  assert.ok(result.ok);
  assert.deepEqual(result.workspace.students[0], { ...jordan, grade: "7", iepDate: "2026-12-01", accommodations: "Extra time, small group", notes: "Moved up a grade" });
  assert.equal(result.workspace.students[0].id, "s1", "the same student, not a new one");
  assert.equal(result.workspace.students.length, 2, "the caseload does not grow, so the plan's count is untouched");
  assert.equal(result.workspace.students[1], start.students[1], "nobody else is touched");
  assert.equal(result.moved, 0);
  for (const list of STUDENT_LISTS) assert.equal(result.workspace[list], start[list], `${list} is left alone when the name is the same`);
  assert.equal(start.students[0].grade, "6", "the workspace handed in is not changed");
});

test("a new name is carried to everything filed under the old one", () => {
  const start = hub();
  const result = updateStudent(start, "s1", details(jordan, { name: "  Jordan   Lee-Park " }));
  assert.ok(result.ok);
  const w = result.workspace;
  assert.equal(w.students[0].name, "Jordan Lee-Park");
  assert.equal(result.moved, 8, "one row in each tab that names a student");
  for (const list of STUDENT_LISTS) {
    const names = (w[list] as Array<{ student: string }>).map((row) => row.student);
    assert.ok(names.includes("Jordan Lee-Park"), list);
    assert.ok(!names.some((n) => /^jordan\s+lee$/i.test(n)), `${list} has nothing left under the old name`);
  }
  assert.equal(w.notes[0].student, "Jordan Lee-Park", "a row typed a little differently (jordan  lee) follows too");
  assert.equal(w.notes[1].student, "", "a general note stays general");
  assert.equal(w.behavior[1].student, "Whole group");
  assert.deepEqual(w.gradeScores.map((g) => [g.id, g.student, g.score]), [["g1", "Jordan Lee-Park", 9], ["g2", "Maya Torres", 8]], "other students keep their own rows");
  assert.equal(start.meetings[0].student, "Jordan Lee", "the workspace handed in is not changed");
  // only fixing the capitals still tidies the rows
  const capitals = updateStudent(start, "s1", details(jordan, { name: "Jordan LEE" }));
  assert.ok(capitals.ok);
  assert.equal(capitals.workspace.meetings[0].student, "Jordan LEE");
});

test("a change that would lose or mix up a student is refused", () => {
  const start = hub();
  assert.deepEqual(updateStudent(start, "s1", details(jordan, { name: "   " })), { ok: false, message: "A student needs a name." });
  assert.deepEqual(updateStudent(start, "s1", details(jordan, { name: "maya  torres" })), { ok: false, message: "Maya Torres is already on your caseload." }, "two students can't share a name");
  assert.deepEqual(updateStudent(start, "gone", details(jordan)), { ok: false, message: "That student is no longer on your caseload." });
});

test("when two students already share a name, renaming one leaves the shared rows where they are", () => {
  const twin: Student = { ...jordan, id: "s3" };
  const start = { ...hub(), students: [jordan, maya, twin] };
  const same = updateStudent(start, "s3", details(twin, { grade: "8" }));
  assert.ok(same.ok, "their other details can still be changed");
  const result = updateStudent(start, "s3", details(twin, { name: "Jordan Lee Jr." }));
  assert.ok(result.ok);
  assert.equal(result.moved, 0);
  assert.equal(result.workspace.meetings[0].student, "Jordan Lee");
  assert.deepEqual(result.workspace.students.map((s) => s.name), ["Jordan Lee", "Maya Torres", "Jordan Lee Jr."]);
});

test("the caseload screen lets a teacher edit a student", () => {
  const page = read("client/src/pages/TeacherHub.tsx");
  for (const part of ['data-testid="hub-student-edit"', 'data-testid="hub-student-edit-form"', "updateStudent(workspace, editing.id, editing.form)", "Save changes"]) assert.ok(page.includes(part), part);
});
