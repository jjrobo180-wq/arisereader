// A student's profile holds everything: besides the caseload records, the Minutes class notes, the lessons
// and their marks, worksheets and files, IEP drafts, and the to-dos, events and emails about the student.
// Run with: npx tsx --test tests/student-profile-everything.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { studentProfile } from "../shared/hubStudentProfile";
import { normalizeWorkspace } from "../shared/teacherHub";

const T = "2026-11-17";
const now = "2026-11-17T00:00:00Z";
const ws = () => normalizeWorkspace({
  students: [{ id: "s1", name: "Nolan Kyle Framel" }, { id: "s2", name: "Ava Kim" }],
  pushInNotes: [
    { id: "n1", date: "2026-11-16", block: "", subject: "Math", title: "Ratios", taught: "Unit rates", createdAt: now, updatedAt: now,
      materials: [{ id: "m1", kind: "worksheet", name: "Scaffolded: Ratios", text: "Frames and a word bank" }, { id: "m2", kind: "other", name: "Not for Nolan" }],
      students: [{ student: "nolan kyle framel", status: "good", participation: "great", behavior: "ok", note: "Tried hard", materialIds: ["m1"] }, { student: "Ava Kim", status: "mastered" }] },
    { id: "n2", date: "2026-11-15", block: "", subject: "Math", title: "Only Ava", taught: "", createdAt: now, updatedAt: now, materials: [], students: [{ student: "Ava Kim", note: "x" }] },
  ],
  lessonClasses: [{ id: "c1", name: "Math lab", block: "", subject: "Math", grade: "7", color: "teal", days: [], room: "", students: ["Nolan Kyle Framel", "Ava Kim"] }],
  lessons: [
    { id: "l1", classId: "c1", title: "Fractions", subject: "Math", group: "", date: "2026-11-17", objective: "Add fractions", materials: "", files: [{ id: "f1", kind: "slides", name: "Fractions slides", url: "https://example.com/s" }], marks: { "Nolan Kyle Framel": { status: "mastered", score: "9/10", behavior: "great" } } },
    { id: "l2", title: "Someone else's", subject: "Math", group: "", date: "2026-11-17", objective: "", materials: "", marks: { "Ava Kim": { status: "good" } } },
  ],
  iepDrafts: [{ id: "d1", student: "Nolan Kyle Framel", createdAt: now, updatedAt: now, a: {}, m: {}, needs: [], prior: [] }],
  tasks: [
    { id: "t1", title: "Call Nolan Kyle Framel's mom", dueDate: "2026-11-18", recurring: "", done: false },
    { id: "t2", title: "Copy worksheets", dueDate: "", recurring: "", done: false, links: [{ kind: "student", id: "s1" }] },
    { id: "t3", title: "Nolan from another class", dueDate: "", recurring: "", done: false },
  ],
  events: [{ id: "e1", title: "Parent conference", date: "2026-11-12", start: "15:00", end: "", location: "", notes: "", students: ["Nolan Kyle Framel"] }],
  emails: [{ id: "x1", from: "Ms. Kast", subject: "About Nolan Kyle Framel", body: "", action: "", draft: "", date: "2026-11-10" }, { id: "x2", from: "a", subject: "Other", body: "", action: "", draft: "", date: "2026-11-10" }],
} as any);

test("the profile gathers class notes, lessons, files, drafts, to-dos, events and emails for the student", () => {
  const p = studentProfile(ws(), "s1", T)!;
  assert.deepEqual(p.classNotes.map((x) => [x.note.id, x.entry.participation, x.entry.behavior]), [["n1", "great", "ok"]]);
  assert.deepEqual(p.lessons.map((x) => [x.lesson.id, x.mark?.score ?? null, x.className]), [["l1", "9/10", "Math lab"]]);
  assert.deepEqual(p.files.map((f) => [f.material.name, f.given]), [["Scaffolded: Ratios", true], ["Fractions slides", false]]);
  assert.deepEqual(p.iepDrafts.map((d) => d.id), ["d1"]);
  assert.deepEqual(p.tasks.map((t) => t.id).sort(), ["t1", "t2"], "named in full or linked; a first name alone is not enough");
  assert.deepEqual(p.events.map((e) => e.id), ["e1"]);
  assert.deepEqual(p.emails.map((e) => e.id), ["x1"]);
  assert.ok(p.records >= 9);
});

test("another student's profile does not pick up Nolan's things", () => {
  const p = studentProfile(ws(), "s2", T)!;
  assert.deepEqual(p.classNotes.map((x) => x.note.id), ["n1", "n2"]);
  assert.deepEqual(p.lessons.map((x) => x.lesson.id).sort(), ["l1", "l2"], "in l1's class, and marked on l2");
  assert.equal(p.files.some((f) => f.material.id === "m1"), false, "a worksheet given to Nolan is not Ava's");
  assert.deepEqual([p.iepDrafts.length, p.tasks.length, p.events.length, p.emails.length], [0, 0, 0, 0]);
});

test("tapping a student on the caseload opens their whole profile", () => {
  const page = readFileSync(new URL("../client/src/pages/TeacherHub.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("onClick={() => setProfileId(s.id)} aria-label={`Open everything for ${s.name}`}"));
  const view = readFileSync(new URL("../client/src/components/teacher-hub/HubStudentProfile.tsx", import.meta.url), "utf8");
  for (const part of ["Class notes (Minutes)", 'title="Lessons"', "Worksheets & files", "IEP drafts", 'title="To-dos"', 'title="Calendar"', 'title="Emails"']) assert.ok(view.includes(part), part);
});
