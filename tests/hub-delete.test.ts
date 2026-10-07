// Deleting from the Hub and taking it back, and adding students without doubles.
// Run with: npx tsx --test tests/hub-delete.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { addStudent, emptyWorkspace, normalizeWorkspace, type Workspace } from "../shared/teacherHub";
import { deleteRow, deleteStudentRecords, studentRecordCount, undoDelete } from "../shared/hubDelete";

function hub(): Workspace {
  const w = emptyWorkspace();
  w.students = [
    { id: "s1", name: "Maya Lopez", grade: "5", accommodations: "", iepDate: "", reevalDate: "", readingLevel: "", mathLevel: "", notes: "" },
    { id: "s2", name: "Jordan Lee", grade: "6", accommodations: "", iepDate: "", reevalDate: "", readingLevel: "", mathLevel: "", notes: "" },
  ];
  w.notes = [
    { id: "n1", student: "Maya Lopez", type: "Check-in", body: "good day", date: "2026-10-01" },
    { id: "n2", student: "Jordan Lee", type: "Concern", body: "late", date: "2026-10-02" },
    { id: "n3", student: "maya  lopez", type: "Check-in", body: "again", date: "2026-10-03" },
  ];
  w.meetings = [{ id: "m1", student: "Maya Lopez", type: "Annual IEP", date: "2026-11-01", notes: "", done: false }];
  w.assignments = [{ id: "a1", title: "Quiz 1", category: "Quiz", points: 10, date: "2026-10-01" }, { id: "a2", title: "Quiz 2", category: "Quiz", points: 10, date: "2026-10-08" }];
  w.gradeScores = [
    { id: "g1", assignmentId: "a1", student: "Maya Lopez", score: 8, missing: false, excused: false },
    { id: "g2", assignmentId: "a1", student: "Jordan Lee", score: 9, missing: false, excused: false },
    { id: "g3", assignmentId: "a2", student: "Maya Lopez", score: 7, missing: false, excused: false },
  ];
  w.tasks = [{ id: "t1", title: "Call home", dueDate: "", recurring: "", done: false }, { id: "t2", title: "Copy forms", dueDate: "", recurring: "", done: false }, { id: "t3", title: "Email team", dueDate: "", recurring: "", done: false }];
  return w;
}

test("a deleted row comes back exactly where it was", () => {
  const w = hub();
  const gone = deleteRow(w, "tasks", "t2")!;
  assert.deepEqual(gone.workspace.tasks.map((t) => t.id), ["t1", "t3"]);
  assert.equal(gone.deleted.label, "Deleted to-do “Copy forms”");
  const back = undoDelete(gone.workspace, gone.deleted);
  assert.deepEqual(back.tasks.map((t) => t.id), ["t1", "t2", "t3"]);
  assert.deepEqual(back.tasks[1], w.tasks[1]);
});

test("taking it back keeps whatever was done in the meantime", () => {
  const w = hub();
  const gone = deleteRow(w, "tasks", "t1")!;
  const later = { ...gone.workspace, tasks: [...gone.workspace.tasks, { id: "t4", title: "New", dueDate: "", recurring: "", done: false }] };
  const back = undoDelete(later, gone.deleted);
  assert.deepEqual(back.tasks.map((t) => t.id), ["t1", "t2", "t3", "t4"]);
});

test("taking it back twice does not make a double", () => {
  const gone = deleteRow(hub(), "tasks", "t1")!;
  const once = undoDelete(gone.workspace, gone.deleted);
  const twice = undoDelete(once, gone.deleted);
  assert.equal(twice.tasks.length, 3);
});

test("deleting something that is not there does nothing", () => {
  assert.equal(deleteRow(hub(), "tasks", "nope"), null);
  assert.equal(deleteRow(hub(), "students", "nope"), null);
});

test("deleting an assignment takes its scores along, and taking it back returns both", () => {
  const w = hub();
  const gone = deleteRow(w, "assignments", "a1")!;
  assert.deepEqual(gone.workspace.assignments.map((a) => a.id), ["a2"]);
  assert.deepEqual(gone.workspace.gradeScores.map((g) => g.id), ["g3"], "no scores left pointing at a missing assignment");
  assert.match(gone.deleted.label, /Quiz 1.*2 scores/);
  const back = undoDelete(gone.workspace, gone.deleted);
  assert.deepEqual(back.assignments.map((a) => a.id), ["a1", "a2"]);
  assert.deepEqual(back.gradeScores.map((g) => g.id), ["g1", "g2", "g3"]);
});

test("a student's records in other tabs can be counted, even if the name was typed a little differently", () => {
  const w = hub();
  assert.equal(studentRecordCount(w, "Maya Lopez"), 5, "2 notes + 1 meeting + 2 scores");
  assert.equal(studentRecordCount(w, "Nobody"), 0);
});

test("deleting a student leaves their records, and 'delete their records too' clears them, and both can be taken back", () => {
  const w = hub();
  const gone = deleteRow(w, "students", "s1")!;
  assert.equal(gone.workspace.students.length, 1);
  assert.equal(gone.workspace.notes.length, 3, "records stay until the teacher says");
  const records = deleteStudentRecords(gone.workspace, "Maya Lopez")!;
  assert.equal(records.deleted.label, "Deleted 5 records for Maya Lopez");
  assert.deepEqual(records.workspace.notes.map((n) => n.id), ["n2"]);
  assert.equal(records.workspace.meetings.length, 0);
  assert.deepEqual(records.workspace.gradeScores.map((g) => g.id), ["g2"]);
  const backRecords = undoDelete(records.workspace, records.deleted);
  assert.equal(backRecords.notes.length, 3);
  const backAll = undoDelete(backRecords, gone.deleted);
  assert.deepEqual(backAll, w);
});

test("two students with the same name: their records can't be told apart, so none are cleared", () => {
  const w = hub();
  w.students.push({ ...w.students[0], id: "s3" });
  assert.equal(studentRecordCount(w, "Maya Lopez"), 0);
  assert.equal(deleteStudentRecords(w, "Maya Lopez"), null);
});

test("adding a student: a name is needed, doubles are refused, and the plan's limit holds", () => {
  const w = hub();
  const make = () => "new-id";
  const blank = { name: "  ", grade: "", accommodations: "", iepDate: "", reevalDate: "", readingLevel: "", mathLevel: "", notes: "" };
  assert.deepEqual(addStudent(w, blank, make, null), { ok: false, message: "A student needs a name." });
  const double = addStudent(w, { ...blank, name: "maya   LOPEZ" }, make, null);
  assert.deepEqual(double, { ok: false, message: "Maya Lopez is already on your caseload." });
  const full = addStudent(w, { ...blank, name: "Sam Park" }, make, 2);
  assert.equal(full.ok, false);
  assert.match((full as any).message, /plan covers 2 students/);
  const added = addStudent(w, { ...blank, name: "  Sam   Park " }, make, 3);
  assert.equal(added.ok, true);
  assert.deepEqual((added as any).workspace.students.map((s: any) => [s.id, s.name]), [["s1", "Maya Lopez"], ["s2", "Jordan Lee"], ["new-id", "Sam Park"]]);
  assert.equal(w.students.length, 2, "the old workspace is not changed");
});

test("a saved Hub from before still opens", () => {
  assert.equal(normalizeWorkspace(undefined).students.length, 0);
});
