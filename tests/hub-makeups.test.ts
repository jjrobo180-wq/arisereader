// Makeup tests: several students, calendar, to-dos, notes to Notes, attachments, profiles, and the old list.
// Run with: npx tsx --test tests/hub-makeups.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accommodationsOf, cleanMakeups, fromKitRecords, makeupTitle, makeupsFor, overdue, type Makeup } from "../shared/hubMakeups";
import { studentProfile } from "../shared/hubStudentProfile";
import { PLUGINS } from "../shared/pluginStore";
import { normalizeWorkspace } from "../shared/teacherHub";

const mk = (id: string, extra: Partial<Makeup> = {}): Makeup => ({ id, students: ["Nolan Framel", "Ava Kim"], test: "Unit 3 test", subject: "Math 7", missedOn: "2026-11-10", reason: "Absent", date: "2026-11-20", start: "08:00", end: "08:45", where: "Rm 214", proctor: "", accommodations: "", status: "scheduled", scores: {}, notes: "", links: [], createdAt: "", updatedAt: "", ...extra });

test("saved makeups are cleaned: students kept once, scores only for its students, real links only", () => {
  const out = cleanMakeups([mk("a", { students: ["Nolan Framel", "Nolan Framel", ""], scores: { "Nolan Framel": "88%", Ghost: "1" }, links: [{ kind: "file", id: "f1" }, { kind: "nope" as any, id: "x" }], status: "weird" as any }), mk("a"), { id: "b", students: [] }]);
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].students, out[0].scores, out[0].links, out[0].status], [["Nolan Framel"], { "Nolan Framel": "88%" }, [{ kind: "file", id: "f1" }], "to-schedule"]);
});

test("past due, a student's makeups, accommodations from profiles, and the title", () => {
  assert.equal(overdue(mk("a", { date: "2026-11-17" }), "2026-11-18"), true);
  assert.equal(overdue(mk("a", { date: "2026-11-17", status: "done" }), "2026-11-18"), false);
  assert.equal(overdue(mk("a", { date: "", missedOn: "2026-11-05" }), "2026-11-18"), true, "no day a week after missing it");
  assert.deepEqual(makeupsFor([mk("a", { status: "done" }), mk("b"), mk("c", { students: ["Kai"] })], "ava kim").map((m) => m.id), ["b", "a"]);
  assert.equal(accommodationsOf(["Nolan Framel", "Ava Kim"], [{ name: "Nolan Framel", accommodations: "Extended time, small group" }, { name: "Ava Kim", accommodations: "" }]), "Nolan Framel: Extended time, small group");
  assert.equal(makeupTitle({ test: "Quiz", students: ["A", "B", "C", "D", "E"] }), "Makeup: Quiz (A, B, C +2)");
});

test("rows from the old Makeup tests list come over", () => {
  const out = fromKitRecords([{ id: "r", plugin: "makeup-tests", date: "", data: { student: "Kai", test: "Quiz 4", date: "2026-11-21", where: "Lunch", status: "Done" } }, { id: "z", plugin: "other", date: "", data: { student: "X" } }], () => "n1", "now");
  assert.deepEqual(out.map((m) => [m.students, m.test, m.date, m.where, m.status]), [[["Kai"], "Quiz 4", "2026-11-21", "Lunch", "done"]]);
});

test("each student's profile shows the makeup", () => {
  const ws = normalizeWorkspace({ students: [{ id: "s1", name: "Nolan Framel" }, { id: "s2", name: "Ava Kim" }], makeups: [mk("a")] } as any);
  assert.deepEqual(studentProfile(ws, "s1", "2026-11-18")!.makeups.map((m) => m.id), ["a"]);
  assert.deepEqual(studentProfile(ws, "s2", "2026-11-18")!.makeups.map((m) => m.id), ["a"]);
});

test("the plugin replaces the old list in the gallery; the page reaches calendar, to-dos, Notes and attachments", () => {
  assert.ok(PLUGINS.some((p) => p.id === "work-makeups" && p.target.kind === "tab" && p.target.tab === "makeups"));
  assert.ok(!PLUGINS.some((p) => p.target.kind === "kit" && (p.target as any).id === "makeup-tests"));
  const page = readFileSync(new URL("../client/src/components/teacher-hub/HubMakeups.tsx", import.meta.url), "utf8");
  for (const t of ["events = [...events, { id: next.eventId", "tasks = [{ id: next.taskId", 'type: "Makeup test"', "<LinkEditor workspace={workspace} links={m.links}", "supplementary: true", "fromKitRecords("]) assert.ok(page.includes(t), t);
  assert.match(readFileSync(new URL("../client/src/pages/TeacherHub.tsx", import.meta.url), "utf8"), /\{tab === "makeups" && <HubMakeups /);
});
