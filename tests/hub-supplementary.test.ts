// Supplementary students: not on the IEP caseload, but with a full profile and in every student list.
// Run with: npx tsx --test tests/hub-supplementary.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addSupplementary, caseloadOnly, studentsWithoutProfiles } from "../shared/hubSupplementary";
import { studentProfile } from "../shared/hubStudentProfile";
import { normalizeWorkspace } from "../shared/teacherHub";

const now = "2026-11-18T00:00:00Z";
const ws = () => normalizeWorkspace({
  students: [{ id: "s1", name: "Jorge Ramirez" }],
  pushInNotes: [{ id: "n1", date: "2026-11-17", block: "", subject: "Math", title: "Ratios", taught: "", materials: [], createdAt: now, updatedAt: now,
    students: [{ student: "Jorge Ramirez", status: "good" }, { student: "Kieth Cockrell", status: "reteach", note: "Late" }, { student: "kieth cockrell", status: "good" }] }],
  schedules: [{ id: "x", student: "Ava Kim", day: "Monday", start: "08:00", end: "08:50", label: "Math 7" }],
  behavior: [{ id: "b", student: "Whole group", points: 1, reason: "", date: "2026-11-17" }],
  lessonClasses: [{ id: "c1", name: "Math 7", block: "", subject: "Math", grade: "7", color: "teal", days: [], room: "", students: ["Ava Kim", "Diego Ortiz"] }],
} as any);

test("students in the teacher's tabs without a profile are found, each once, not group words", () => {
  assert.deepEqual(studentsWithoutProfiles(ws()), ["Ava Kim", "Diego Ortiz", "Kieth Cockrell"]);
});

test("they're added as supplementary students with full profiles, and kept off the caseload-only list", () => {
  let n = 0;
  const r = addSupplementary(ws(), ["Kieth Cockrell", "Jorge Ramirez", "Ava Kim"], () => `id${++n}`, null);
  assert.equal(r.added, 2, "Jorge already has a profile");
  const kieth = r.workspace.students.find((s) => s.name === "Kieth Cockrell")!;
  assert.equal(kieth.supplementary, true);
  assert.deepEqual(caseloadOnly(r.workspace.students).map((s) => s.name), ["Jorge Ramirez"]);
  const p = studentProfile(r.workspace, kieth.id, "2026-11-18")!;
  assert.deepEqual(p.classNotes.map((c) => c.entry.note ?? ""), ["Late"], "the profile has everything about him");
  assert.deepEqual(studentsWithoutProfiles(r.workspace), ["Diego Ortiz"]);
});

test("the plan's seats still apply", () => {
  const r = addSupplementary(ws(), ["Ava Kim", "Diego Ortiz"], () => "z" + Math.random(), 2);
  assert.deepEqual([r.added, r.full], [1, true]);
});

test("the Caseload page, the forms, the pickers, the profile and the IEP page know about supplementary students", () => {
  const hub = readFileSync(new URL("../client/src/pages/TeacherHub.tsx", import.meta.url), "utf8");
  for (const t of ['data-testid="caseload-from-classes"', 'data-testid="student-supplementary"', 'data-testid="caseload-kind-supplementary"', '{student.supplementary ? " (supplementary)" : ""}', "addSupplementary(p, names, id, seats)"]) assert.ok(hub.includes(t), t);
  const profile = readFileSync(new URL("../client/src/components/teacher-hub/HubStudentProfile.tsx", import.meta.url), "utf8");
  assert.ok(profile.includes('data-testid="profile-toggle-supplementary"') && profile.includes('data-testid="profile-supplementary"'));
  const iep = readFileSync(new URL("../client/src/components/teacher-hub/HubIep.tsx", import.meta.url), "utf8");
  assert.ok(iep.includes("workspace.students.filter((s) => !s.supplementary)"));
});

test("Add a student (supplementary to start) is on Student profiles, Student schedules and the schedule photo box", () => {
  const quick = readFileSync(new URL("../client/src/components/teacher-hub/HubQuickAddStudent.tsx", import.meta.url), "utf8");
  assert.ok(quick.includes("export function AddStudentButton(") && quick.includes('data-testid="quick-add-supplementary"') && quick.includes("supplementary onCancel="));
  const profiles = readFileSync(new URL("../client/src/components/teacher-hub/HubProfiles.tsx", import.meta.url), "utf8");
  assert.ok(profiles.includes("<AddStudentButton "));
  const photo = readFileSync(new URL("../client/src/components/teacher-hub/HubSchedulePhoto.tsx", import.meta.url), "utf8");
  assert.ok(photo.includes("<AddStudentButton "));
  const hub = readFileSync(new URL("../client/src/pages/TeacherHub.tsx", import.meta.url), "utf8");
  assert.ok(hub.includes("onAdded={(name) => setForm((f) => ({ ...f, student: name }))}"), "the Add schedule form");
});
