// Teacher Hub: notes that are not about a student, and one student's whole picture.
// Run with: npx tsx --test tests/hub-notes-profile.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeWorkspace, updateStudent, type Workspace } from "../shared/teacherHub";
import { GENERAL_NOTE_KINDS, STUDENT_NOTE_KINDS, arrangeNotes, cleanNote, noteCounts, noteFields, noteHeading, noteScope, saveNote, type NoteFields } from "../shared/hubNotes";
import { dueWords, studentProfile } from "../shared/hubStudentProfile";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const ids = () => { let n = 0; return () => `new${++n}`; };
const T = "2026-10-07"; // a Wednesday
const fields = (change: Partial<NoteFields> = {}): NoteFields => ({ scope: "general", student: "", type: "Staff meeting", title: "Staff meeting", date: T, body: "New duty schedule starts Monday.", ...change });

test("a note does not have to be about a student", () => {
  assert.deepEqual(cleanNote(fields({ title: "  Staff   meeting ", body: " New duty schedule starts Monday. " })), { student: "", type: "Staff meeting", body: "New duty schedule starts Monday.", date: T, title: "Staff meeting" });
  assert.deepEqual(cleanNote(fields({ scope: "general", student: "Jordan Lee" }))?.student, "", "a meeting note carries no student, whatever was picked before");
  assert.equal(cleanNote(fields({ title: "" }))?.title, undefined, "a title is optional");
  assert.equal(cleanNote(fields({ type: "Check-in" }))?.type, "General note", "a student kind is not a meeting kind");
  assert.equal(cleanNote(fields({ body: "   " })), null, "it needs something written");
  // A student note still needs its student.
  assert.equal(cleanNote(fields({ scope: "student", type: "Concern" })), null);
  assert.deepEqual(cleanNote(fields({ scope: "student", student: "Jordan Lee", type: "Concern", title: "" })), { student: "Jordan Lee", type: "Concern", body: "New duty schedule starts Monday.", date: T });
  assert.equal(cleanNote(fields({ scope: "student", student: "Jordan Lee", type: "Staff meeting" }))?.type, "Teacher note");
  assert.ok(GENERAL_NOTE_KINDS.includes("Staff meeting") && GENERAL_NOTE_KINDS.includes("Training") && STUDENT_NOTE_KINDS.includes("Check-in"));
});

test("notes are added on top, changed in place, sorted into students and meetings, and searched", () => {
  const start = normalizeWorkspace({ notes: [
    { id: "n1", student: "Jordan Lee", type: "Check-in", body: "Good week in reading.", date: "2026-10-06" },
    { id: "n2", student: "", type: "Teacher note", body: "Order new timers.", date: "2026-10-05" },
  ] });
  const added = saveNote(start, null, fields({ title: "PLC", type: "Team meeting", body: "Agreed on the new fluency probe." }), ids());
  assert.deepEqual(added.notes[0], { id: "new1", student: "", type: "Team meeting", body: "Agreed on the new fluency probe.", date: T, title: "PLC" });
  assert.equal(added.notes.length, 3);
  assert.equal(start.notes.length, 2, "the workspace handed in is not changed");
  assert.equal(saveNote(start, null, fields({ body: "" }), ids()), start);
  // An older note with no student was always a general note; it still is.
  assert.deepEqual(added.notes.map(noteScope), ["general", "student", "general"]);
  assert.deepEqual(noteCounts(added.notes), { all: 3, student: 1, general: 2 });
  assert.deepEqual(arrangeNotes(added.notes, "general").map((n) => n.id), ["new1", "n2"]);
  assert.deepEqual(arrangeNotes(added.notes, "student").map((n) => n.id), ["n1"]);
  assert.deepEqual(arrangeNotes(added.notes, "all", "FLUENCY").map((n) => n.id), ["new1"], "by words in the note");
  assert.deepEqual(arrangeNotes(added.notes, "all", "plc").map((n) => n.id), ["new1"], "by title");
  assert.deepEqual(arrangeNotes(added.notes, "all", "jordan").map((n) => n.id), ["n1"], "by student");
  assert.deepEqual(arrangeNotes(added.notes, "general", "jordan"), []);
  assert.deepEqual([noteHeading(added.notes[0]), noteHeading(added.notes[1]), noteHeading(added.notes[2])], ["PLC", "Jordan Lee · Check-in", "Teacher note"]);
  // Editing keeps the note where it is; it can even change from one sort to the other.
  const edited = saveNote(added, "n1", { ...noteFields(added.notes[1]), body: "Great week in reading.", title: "Reading check" }, ids());
  assert.deepEqual(edited.notes[1], { id: "n1", student: "Jordan Lee", type: "Check-in", body: "Great week in reading.", date: "2026-10-06", title: "Reading check" });
  const moved = saveNote(added, "n2", { ...noteFields(added.notes[2]), scope: "student", student: "Maya Torres", type: "Concern" }, ids());
  assert.deepEqual([moved.notes[2].student, moved.notes[2].type], ["Maya Torres", "Concern"]);
  assert.equal(saveNote(added, "gone", fields(), ids()), added);
  assert.deepEqual(normalizeWorkspace(JSON.parse(JSON.stringify(edited))).notes, edited.notes, "titles survive a save and load");
});

function hub(): Workspace {
  return normalizeWorkspace({
    students: [
      { id: "s1", name: "Jordan Lee", grade: "6", accommodations: "Extra time", iepDate: "2026-10-19", reevalDate: "2026-09-30", readingLevel: "4.2", mathLevel: "5", notes: "Likes graphic novels" },
      { id: "s2", name: "Maya Torres", grade: "7", accommodations: "", iepDate: "", reevalDate: "", readingLevel: "", mathLevel: "", notes: "" },
    ],
    meetings: [
      { id: "m1", student: "Jordan Lee", type: "Annual IEP", date: "2026-10-19", time: "14:30", notes: "", done: false },
      { id: "m2", student: "jordan  lee", type: "Parent meeting", date: "2026-09-15", notes: "Went well", done: true },
      { id: "m3", student: "Maya Torres", type: "Other", date: "2026-10-20", notes: "", done: false },
    ],
    notes: [
      { id: "n1", student: "Jordan Lee", type: "Check-in", body: "Good week", date: "2026-10-01" },
      { id: "n2", student: "", type: "Staff meeting", body: "General", date: "2026-10-06", title: "Staff meeting" },
      { id: "n3", student: "Jordan Lee", type: "Concern", body: "Missed two days", date: "2026-10-06" },
      { id: "n4", student: "Maya Torres", type: "Check-in", body: "Hers", date: "2026-10-06" },
    ],
    ariseRecords: [{ id: "r1", student: "Jordan Lee", book: "Hatchet", score: "9", points: "15", date: "2026-10-02" }],
    behavior: [{ id: "b1", student: "Jordan Lee", points: 2, reason: "Helped a friend", date: "2026-10-02" }, { id: "b2", student: "Jordan Lee", points: -1, reason: "", date: "2026-10-05" }, { id: "b3", student: "Whole group", points: 5, reason: "", date: "2026-10-02" }],
    attendance: [{ id: "a1", student: "Jordan Lee", date: "2026-10-02", status: "Present", className: "" }, { id: "a2", student: "Jordan Lee", date: "2026-10-05", status: "Absent", className: "Reading" }, { id: "a3", student: "Jordan Lee", date: "2026-10-06", status: "Tardy", className: "" }],
    assignments: [{ id: "q1", title: "Quiz 1", category: "Quiz", points: 10, date: "2026-10-01" }, { id: "q2", title: "Essay", category: "Project", points: 20, date: "2026-10-05" }, { id: "q3", title: "Homework 3", category: "Homework", points: 5, date: "2026-10-06" }],
    gradeScores: [
      { id: "g1", assignmentId: "q1", student: "Jordan Lee", score: 9, missing: false, excused: false },
      { id: "g2", assignmentId: "q2", student: "Jordan Lee", score: 15, missing: false, excused: false },
      { id: "g3", assignmentId: "q3", student: "Jordan Lee", score: null, missing: true, excused: false },
      { id: "g4", assignmentId: "q1", student: "Maya Torres", score: 8, missing: false, excused: false },
    ],
    parentLogs: [{ id: "p1", student: "Jordan Lee", guardian: "Ms. Lee", message: "Called about absences", status: "Called", date: "2026-10-06" }],
    schedules: [{ id: "c2", student: "Jordan Lee", day: "Wednesday", start: "10:00", end: "10:30", label: "Speech" }, { id: "c1", student: "Jordan Lee", day: "Monday", start: "08:00", end: "08:30", label: "Reading" }],
    guides: [{ id: "i1", student: "Jordan Lee", kind: "IEP meeting", sections: [{ id: "x", title: "Before", steps: [{ id: "a", text: "Send notice", done: true, note: "" }, { id: "b", text: "Draft", done: false, note: "" }] }], team: {} }],
    goals: [{ id: "o1", student: "Jordan Lee", area: "Reading", text: "Read 60 wpm", baseline: 20, target: 60, unit: "wpm", direction: "up", startDate: "2026-09-01", targetDate: "2027-05-28", points: [{ id: "pt1", date: "2026-10-01", value: 40, note: "" }] }],
    services: [{ id: "v1", student: "Jordan Lee", kind: "Push-in", minutesPerWeek: 60 }],
    serviceLogs: [{ id: "l1", student: "Jordan Lee", date: "2026-10-06", kind: "Push-in", minutes: 30, note: "" }, { id: "l2", student: "Maya Torres", date: "2026-10-06", kind: "Push-in", minutes: 30, note: "" }],
  });
}

test("a student's profile gathers everything under their name, and nobody else's", () => {
  const p = studentProfile(hub(), "s1", T)!;
  assert.equal(p.student.name, "Jordan Lee");
  assert.deepEqual([p.iep, p.reeval], [{ date: "2026-10-19", days: 12 }, { date: "2026-09-30", days: -7 }]);
  assert.deepEqual([dueWords(p.iep), dueWords(p.reeval), dueWords({ date: T, days: 0 }), dueWords({ date: "", days: null }), dueWords({ date: "x", days: 1 }), dueWords({ date: "x", days: -1 })], ["in 12 days", "7 days ago", "today", "", "in 1 day", "1 day ago"]);
  assert.deepEqual(p.goals.map((g) => [g.goal.id, g.latest, g.percent]), [["o1", 40, 50]]);
  assert.deepEqual(p.services.map((s) => [s.plan.kind, s.status.thisWeek, s.status.required, s.status.remaining]), [["Push-in", 30, 60, 30]]);
  assert.deepEqual(p.serviceLogs.map((l) => l.id), ["l1"]);
  assert.deepEqual([p.meetings.upcoming.map((m) => m.id), p.meetings.past.map((m) => m.id)], [["m1"], ["m2"]], "a name typed a little differently (jordan  lee) is still theirs");
  assert.deepEqual(p.guides.map((g) => [g.guide.id, g.done, g.total]), [["i1", 1, 2]]);
  assert.deepEqual(p.notes.map((n) => n.id), ["n3", "n1"], "their notes, newest first; not the staff meeting, not Maya's");
  assert.deepEqual(p.parentLogs.map((l) => l.id), ["p1"]);
  assert.deepEqual([p.behavior.total, p.behavior.entries.map((b) => b.id)], [1, ["b2", "b1"]]);
  assert.deepEqual([p.attendance.counts, p.attendance.entries.map((a) => a.id)], [{ Present: 1, Absent: 1, Tardy: 1, Excused: 0 }, ["a3", "a2", "a1"]]);
  assert.deepEqual(p.grades.rows.map((g) => [g.assignment?.title, g.score, g.missing]), [["Homework 3", null, true], ["Essay", 15, false], ["Quiz 1", 9, false]]);
  assert.deepEqual([p.grades.average, p.grades.missing], [80, 1], "24 of 30 on the scored work, the same sum the gradebook does");
  assert.deepEqual(p.schedule.map((c) => c.id), ["c1", "c2"], "Monday before Wednesday");
  assert.deepEqual(p.reading.map((r) => r.book), ["Hatchet"]);
  assert.equal(p.records, 1 + 1 + 1 + 2 + 1 + 2 + 1 + 2 + 3 + 3 + 2 + 1);
});

test("a student with nothing recorded, a renamed student, and one who is gone", () => {
  const start = hub();
  const maya = studentProfile(start, "s2", T)!;
  assert.deepEqual([maya.goals, maya.services, maya.behavior, maya.grades.average, maya.iep, maya.notes.map((n) => n.id)], [[], [], { total: 0, entries: [] }, 80, { date: "", days: null }, ["n4"]]);
  const empty = studentProfile(normalizeWorkspace({ students: [{ id: "s9", name: "New Student", grade: "", accommodations: "", iepDate: "", reevalDate: "", readingLevel: "", mathLevel: "", notes: "" }] }), "s9", T)!;
  assert.equal(empty.records, 0);
  assert.deepEqual([empty.meetings, empty.attendance.counts, empty.grades], [{ upcoming: [], past: [] }, { Present: 0, Absent: 0, Tardy: 0, Excused: 0 }, { rows: [], average: null, missing: 0 }]);
  assert.equal(studentProfile(start, "nope", T), null);
  // A new name takes the whole profile with it.
  const renamed = updateStudent(start, "s1", { ...start.students[0], name: "Jordan Lee-Park" } as any);
  assert.ok(renamed.ok);
  assert.equal(studentProfile(renamed.workspace, "s1", T)!.records, studentProfile(start, "s1", T)!.records);
});

test("the Notes tab and the Caseload carry the new screens", () => {
  const page = read("client/src/pages/TeacherHub.tsx"), notes = read("client/src/components/teacher-hub/HubNotes.tsx"), profile = read("client/src/components/teacher-hub/HubStudentProfile.tsx");
  for (const part of ['{tab === "notes" && <HubNotes workspace={workspace} setWorkspace={setWorkspace} remove={remove} makeId={id} />}', 'data-testid="hub-student-profile"', "<StudentProfileView workspace={workspace}", "profileId={profileStudent} setProfileId={setProfileStudent} openTab={setTab}"]) assert.ok(page.includes(part), part);
  assert.ok(!page.includes("function Notes("), "the old student-only notes screen is gone");
  for (const part of ['data-testid="note-scope"', '"Meeting or general"', 'data-testid="note-edit"', "Search notes", "Meetings &amp; general"]) assert.ok(notes.includes(part), part);
  for (const part of ['data-testid="student-profile"', "IEP goals", "Service minutes", "Meetings", "Parent contact", "Behavior", "Attendance", "Grades", "Schedule", "A.R.I.S.E. reading", "Add a note", 'aria-label="Switch student"']) assert.ok(profile.includes(part), part);
});
