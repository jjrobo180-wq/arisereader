// Incident reports: what happened, then check-ins with the student, their classes and parents on the days the
// teacher picks, until a date. Today's check-ins, missed ones, and the student's profile.
// Run with: npx tsx --test tests/hub-incidents.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checksDue, checksOn, cleanIncidents, incidentsFor, missedChecks, nextCheckDay, planWords, type Incident } from "../shared/hubIncidents";
import { studentProfile } from "../shared/hubStudentProfile";
import { HUB_GROUPS } from "../shared/hubTabGroups";
import { PLUGINS } from "../shared/pluginStore";
import { normalizeWorkspace } from "../shared/teacherHub";

const base: Incident = {
  id: "i1", student: "Jorge Ramirez", date: "2026-11-16", time: "", type: "Bullying", severity: "high", where: "Lunch",
  summary: "Other students took his lunch and teased him.", others: "", actions: "Talked with him; told the counselor.", reportedTo: "Counselor",
  parentContacted: true, status: "open", checkWith: ["Student", "Math 7", "Parent/guardian"], checkDays: [1, 3, 5], checkUntil: "2026-11-30", checkIns: [], notes: [], createdAt: "", updatedAt: "",
};

test("check-ins fall on the picked days, from the report's day to its end, and not once it's closed", () => {
  assert.equal(checksOn(base, "2026-11-18"), true, "Wednesday");
  assert.equal(checksOn(base, "2026-11-19"), false, "Thursday");
  assert.equal(checksOn(base, "2026-11-13"), false, "before the report");
  assert.equal(checksOn(base, "2026-12-02"), false, "after the end");
  assert.equal(checksOn({ ...base, status: "closed" }, "2026-11-18"), false);
  assert.equal(checksOn({ ...base, status: "monitoring" }, "2026-11-18"), true);
});

test("today's list has each person on the plan, with what was logged; missed days are found", () => {
  const i = { ...base, checkIns: [{ id: "c1", date: "2026-11-18", with: "student", result: "good" as const, note: "Ate lunch with friends" }, { id: "c2", date: "2026-11-16", with: "Student", result: "okay" as const, note: "" }] };
  const due = checksDue([i], "2026-11-18");
  assert.deepEqual(due.map((d) => [d.with, d.done?.result ?? null]), [["Math 7", null], ["Parent/guardian", null], ["Student", "good"]]);
  assert.deepEqual(missedChecks(i, "2026-11-18"), [{ date: "2026-11-16", with: "Math 7" }, { date: "2026-11-16", with: "Parent/guardian" }]);
  assert.equal(nextCheckDay(i, "2026-11-19"), "2026-11-20");
  assert.equal(nextCheckDay({ ...i, checkUntil: "2026-11-19" }, "2026-11-19"), "");
  assert.equal(planWords(i), "Check in with Student, Math 7 and Parent/guardian on Mon, Wed, Fri until Nov 30");
  assert.equal(planWords({ ...i, checkDays: [1, 2, 3, 4, 5], checkWith: ["Student"], checkUntil: "" }), "Check in with Student every school day");
});

test("saved reports are cleaned: bad rows dropped, days and people tidied, unknown values made safe", () => {
  const out = cleanIncidents([
    { ...base, checkDays: [5, 1, 3, 9, 1], checkWith: ["Student", "Student", "", "Math 7"], severity: "extreme", status: "??", checkIns: [{ id: "c", date: "nope" }, { id: "d", date: "2026-11-18", with: "Student", result: "great" }] },
    { ...base, id: "i1" }, { id: "x", student: "", date: "2026-11-16" }, "junk",
  ]);
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].checkDays, out[0].checkWith, out[0].severity, out[0].status], [[1, 3, 5], ["Student", "Math 7"], "medium", "open"]);
  assert.deepEqual(out[0].checkIns.map((c) => [c.id, c.result]), [["d", "okay"]]);
});

test("reports show on the student's profile, and not on anyone else's", () => {
  const ws = normalizeWorkspace({ students: [{ id: "s1", name: "Jorge Ramirez" }, { id: "s2", name: "Ava Kim" }], incidents: [base, { ...base, id: "i2", student: "Ava Kim" }] } as any);
  assert.deepEqual(studentProfile(ws, "s1", "2026-11-18")!.incidents.map((i) => i.id), ["i1"]);
  assert.deepEqual(incidentsFor(cleanIncidents(ws.incidents), "ava kim").map((i) => i.id), ["i2"]);
});

test("Incident reports is a WorkHub plugin with its own page, linked from the profile", () => {
  const p = PLUGINS.find((x) => x.id === "work-incidents");
  assert.ok(p && p.target.kind === "tab" && p.target.tab === "incidents");
  assert.ok(HUB_GROUPS.some((g) => g.id === "incidents"));
  const hub = readFileSync(new URL("../client/src/pages/TeacherHub.tsx", import.meta.url), "utf8");
  assert.match(hub, /\{tab === "incidents" && <HubIncidents /);
  const profile = readFileSync(new URL("../client/src/components/teacher-hub/HubStudentProfile.tsx", import.meta.url), "utf8");
  assert.match(profile, /<Part title="Incident reports" count=\{profile\.incidents\.length\} tab="incidents"/);
  const page = readFileSync(new URL("../client/src/components/teacher-hub/HubIncidents.tsx", import.meta.url), "utf8");
  assert.match(page, /repeat: "Days", days: i\.checkDays/, "the check-ins go on the calendar with its certain-days repeat");
});

test("reports keep running notes, and every check-in (missed or logged) takes a note", () => {
  const out = cleanIncidents([{ ...base, notes: [{ id: "n1", at: "2026-11-18T17:00:00Z", text: "Called mom; she'll talk with him tonight." }, { id: "", text: "x" }, { id: "n2", text: "" }] }]);
  assert.deepEqual(out[0].notes.map((n) => n.id), ["n1"]);
  assert.deepEqual(cleanIncidents([{ ...base, notes: undefined }])[0].notes, [], "older reports without notes still load");
  const page = readFileSync(new URL("../client/src/components/teacher-hub/HubIncidents.tsx", import.meta.url), "utf8");
  for (const t of ['data-testid="incident-missed"', 'data-testid="incident-check-note"', 'data-testid="incident-note-new"', "const editCheckNote = "]) assert.ok(page.includes(t), t);
});
