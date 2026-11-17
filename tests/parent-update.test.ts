// The weekly parent update: written from the Minutes page (push-in notes, logged minutes) and the Lessons page
// (each lesson's marks), with the new Participation and Behavior marks.
// Run with: npx tsx --test tests/parent-update.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PARTS, gatherWeek, isEmptyWeek, listWords, updateStudents, weekOf, writeUpdate } from "../shared/parentUpdate";
import { cleanLessons } from "../shared/lessonPlanner";
import { cleanPushInNote, withEntry, withMaterials, type PushInNote } from "../shared/pushIn";
import type { ServiceLog } from "../shared/teacherHub";

const NOW = "2026-11-17T16:00:00.000Z";
const note = (id: string, date: string, title: string, students: any[]): PushInNote =>
  ({ id, date, block: "", subject: "Math", title, taught: "", materials: [], students, createdAt: NOW, updatedAt: NOW });

const pushInNotes = [
  note("n1", "2026-11-16", "Adding fractions", [{ student: "Jorge Ramirez", status: "mastered", participation: "great", behavior: "great", note: "Only student to raise his hand and solve problems on the board, all correct" }]),
  note("n2", "2026-11-18", "Ratios", [{ student: "Jorge Ramirez", status: "good", participation: "great", behavior: "ok" }, { student: "Kai", status: "reteach" }]),
  note("n3", "2026-11-10", "Last week", [{ student: "Jorge Ramirez", status: "reteach", note: "old note" }]),
];
const lessons = [
  { id: "l1", title: "Math lab: fraction review", subject: "Math", group: "", date: "2026-11-17", objective: "", materials: "", marks: { "jorge ramirez": { status: "good", score: "9/10", participation: "great", behavior: "great" } } },
  { id: "l2", title: "Next week", subject: "Math", group: "", date: "2026-11-24", objective: "", materials: "", marks: { "Jorge Ramirez": { status: "mastered" } } },
];
const serviceLogs = [
  { id: "s1", student: "Jorge Ramirez", date: "2026-11-16", kind: "Math", minutes: 30, note: "Focused the whole session" },
  { id: "s2", student: "Jorge Ramirez", date: "2026-11-17", kind: "Math", minutes: 30, note: "" },
  { id: "s3", student: "Jorge Ramirez", date: "2026-11-19", kind: "Math", minutes: 0, note: "Absent", notMet: true },
] as ServiceLog[];

test("participation and behavior are kept on push-in notes and lesson marks, and junk is dropped", () => {
  const n = cleanPushInNote(note("x", "2026-11-16", "T", [{ student: "A", participation: "great", behavior: "rough" }, { student: "B", participation: "loud", behavior: 3 }]))!;
  assert.deepEqual(n.students, [{ student: "A", participation: "great", behavior: "rough" }]);
  const l = cleanLessons([{ id: "l", title: "T", date: "2026-11-16", marks: { A: { behavior: "ok" }, B: { participation: "nope" } } }])[0];
  assert.deepEqual(l.marks, { A: { behavior: "ok" } });
});

test("a student marked only for participation stays; clearing it takes them off the note", () => {
  let n = note("x", "2026-11-16", "T", []);
  n = withEntry(n, "Ava", { participation: "some" }, NOW);
  assert.deepEqual(n.students, [{ student: "Ava", participation: "some" }]);
  n = withMaterials(n, [], NOW);
  assert.equal(n.students.length, 1, "changing materials keeps a participation-only entry");
  n = withEntry(n, "Ava", { participation: undefined }, NOW);
  assert.deepEqual(n.students, []);
});

test("a week gathers both pages for one student, only that week, by name in any case", () => {
  const { from, to } = weekOf("2026-11-17");
  assert.deepEqual([from, to], ["2026-11-16", "2026-11-20"]);
  const f = gatherWeek("Jorge Ramirez", from, to, { pushInNotes, lessons, serviceLogs });
  assert.deepEqual(f.entries.map((e) => [e.date, e.source, e.title]), [
    ["2026-11-16", "class", "Adding fractions"], ["2026-11-17", "lesson", "Math lab: fraction review"], ["2026-11-18", "class", "Ratios"],
  ]);
  assert.equal(f.minutes, 60);
  assert.equal(f.sessions, 2, "a missed session is not counted");
  assert.deepEqual(f.logNotes, [{ date: "2026-11-16", note: "Focused the whole session" }]);
  assert.ok(isEmptyWeek(gatherWeek("Nobody", from, to, { pushInNotes, lessons, serviceLogs })));
});

test("the email has a subject, the lessons, how it went, participation, behavior and the notes", () => {
  const f = gatherWeek("Jorge Ramirez", "2026-11-16", "2026-11-20", { pushInNotes, lessons, serviceLogs });
  const { subject, body } = writeUpdate(f, { format: "email", parts: DEFAULT_PARTS, teacher: "Mr. J", role: "math lab teacher", guardian: "Ms. Ramirez" });
  assert.equal(subject, "Jorge's weekly update – week of Nov 16");
  assert.match(body, /^Hi Ms\. Ramirez,/);
  assert.match(body, /This is Mr\. J, Jorge's math lab teacher\./);
  assert.match(body, /week of Nov 16–20\./);
  assert.match(body, /This week we worked on: Adding fractions, Math lab: fraction review and Ratios\./);
  assert.match(body, /Jorge showed mastery on Adding fractions\./);
  assert.match(body, /Jorge did well on Math lab: fraction review and Ratios\./);
  assert.match(body, /Scores: Math lab: fraction review \(9\/10\)\./);
  assert.match(body, /Jorge participated actively in class all week/);
  assert.match(body, /Jorge's behavior was great on most days\./);
  assert.match(body, /Mon, Nov 16 \(Adding fractions\): Only student to raise his hand and solve problems on the board, all correct\./);
  assert.match(body, /Focused the whole session\./);
  assert.doesNotMatch(body, /minutes of support/, "minutes are off by default");
  assert.doesNotMatch(body, /old note/, "last week is not in it");
  assert.match(body, /Mr\. J$/);
});

test("the text is one short paragraph with no subject, and parts can be left out", () => {
  const f = gatherWeek("Jorge Ramirez", "2026-11-16", "2026-11-20", { pushInNotes, lessons, serviceLogs });
  const { subject, body } = writeUpdate(f, { format: "text", parts: { ...DEFAULT_PARTS, behavior: false, minutes: true }, teacher: "Mr. J" });
  assert.equal(subject, "");
  assert.ok(!body.includes("\n"));
  assert.match(body, /^Hi there, this is Mr\. J, with Jorge's update for this week\./);
  assert.doesNotMatch(body, /behavior/);
  assert.match(body, /Jorge received 60 minutes of support across 2 sessions this week\./);
  assert.match(body, /Thank you for your support at home!$/);
});

test("an empty week leaves a place to add a highlight", () => {
  const f = gatherWeek("Nobody", "2026-11-16", "2026-11-20", {});
  assert.match(writeUpdate(f, { format: "email", parts: DEFAULT_PARTS, teacher: "" }).body, /\[Add a highlight from this week\.\]/);
});

test("rough weeks are worded kindly, and the student list comes from every page once each", () => {
  const f = gatherWeek("Kai", "2026-11-16", "2026-11-20", { pushInNotes: [note("k", "2026-11-16", "T", [{ student: "Kai", participation: "little", behavior: "rough" }])] });
  const { body } = writeUpdate(f, { format: "text", parts: DEFAULT_PARTS, teacher: "Mr. J" });
  assert.match(body, /Kai was on the quiet side/);
  assert.match(body, /tough moments with behavior/);
  assert.deepEqual(updateStudents({ students: [{ name: "Ava" }], pushInNotes, lessons, serviceLogs }), ["Ava", "Jorge Ramirez", "Kai"]);
  assert.equal(listWords(["a", "b", "a", "c"]), "a, b and c");
});

test("behavior points and attendance count toward the week and are written in", () => {
  const f = gatherWeek("Nolan Framel", "2026-11-16", "2026-11-20", {
    behavior: [{ id: "b1", student: "Nolan Framel", points: 2, reason: "Helping a classmate", date: "2026-11-17" }, { id: "b2", student: "Nolan Framel", points: 1, reason: "On task", date: "2026-11-18" }, { id: "b3", student: "Nolan Framel", points: 5, reason: "old", date: "2026-11-02" }],
    attendance: [{ id: "a1", student: "nolan framel", date: "2026-11-19", status: "Tardy", className: "Math" }, { id: "a2", student: "Nolan Framel", date: "2026-11-18", status: "Present", className: "Math" }],
  });
  assert.equal(isEmptyWeek(f), false);
  assert.equal(f.points.length, 2);
  const { body } = writeUpdate(f, { format: "text", parts: DEFAULT_PARTS, teacher: "Mr. J" });
  assert.match(body, /Nolan earned 3 behavior points this week for helping a classmate and on task\./);
  assert.match(body, /Nolan was late once this week\./);
  assert.doesNotMatch(body, /\[Add a highlight/);
});
