// 1-on-1 meetings and the Student profiles shortcut, and admins being able to remove menu pages.
// Run with: npx tsx --test tests/hub-oneonone.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanOneOnOnes, meetingsFor, needsWrapUp, openStepsBefore, runDates, upcoming, type OneOnOne } from "../shared/hubOneOnOne";
import { studentProfile } from "../shared/hubStudentProfile";
import { HUB_GROUPS } from "../shared/hubTabGroups";
import { PLUGINS } from "../shared/pluginStore";
import { normalizeWorkspace } from "../shared/teacherHub";

const m = (id: string, date: string, extra: Partial<OneOnOne> = {}): OneOnOne => ({ id, student: "Nolan Framel", date, time: "10:00", minutes: 20, where: "", focus: "Check-in", agenda: [], notes: "", studentSaid: "", feeling: 0, nextSteps: [], status: "scheduled", createdAt: "", updatedAt: "", ...extra });

test("a run of meetings falls on the right days, until the end, at most 40", () => {
  assert.deepEqual(runDates("2026-11-18", { kind: "none", days: [], until: "" }), ["2026-11-18"]);
  assert.deepEqual(runDates("2026-11-18", { kind: "weekly", days: [], until: "2026-12-09" }), ["2026-11-18", "2026-11-25", "2026-12-02", "2026-12-09"]);
  assert.deepEqual(runDates("2026-11-18", { kind: "biweekly", days: [], until: "2026-12-16" }), ["2026-11-18", "2026-12-02", "2026-12-16"]);
  assert.deepEqual(runDates("2026-11-16", { kind: "days", days: [1, 4], until: "2026-11-26" }), ["2026-11-16", "2026-11-19", "2026-11-23", "2026-11-26"]);
  assert.equal(runDates("2026-01-01", { kind: "days", days: [1, 2, 3, 4, 5], until: "2027-01-01" }).length, 40);
});

test("last time's open next steps, what's coming up, and what needs notes", () => {
  const list = [
    m("a", "2026-11-11", { status: "done", nextSteps: [{ id: "s1", text: "Turn in lab", who: "student", due: "", done: false }, { id: "s2", text: "Email Ms. Kast", who: "teacher", due: "", done: true }] }),
    m("b", "2026-11-17"), m("c", "2026-11-18"), m("d", "2026-11-25"), m("e", "2026-11-10", { student: "Ava" }),
  ];
  assert.deepEqual(openStepsBefore(list, "nolan framel", "2026-11-18").map((x) => x.step.text), ["Turn in lab"]);
  assert.deepEqual(upcoming(list, "2026-11-18").map((x) => x.id), ["c", "d"]);
  assert.deepEqual(needsWrapUp(list, "2026-11-18").map((x) => x.id), ["b", "e"]);
  assert.deepEqual(meetingsFor(list, "Nolan Framel").map((x) => x.id), ["d", "c", "b", "a"]);
});

test("saved meetings are cleaned, and show on the student's profile", () => {
  const out = cleanOneOnOnes([m("a", "2026-11-18", { feeling: 9 as any, focus: "Nope" as any, nextSteps: [{ id: "", text: "x" } as any, { id: "s", text: "Call home", who: "boss" as any, due: "x", done: false }] }), m("a", "2026-11-19"), { id: "z", student: "", date: "2026-11-18" }]);
  assert.equal(out.length, 1);
  assert.deepEqual([out[0].feeling, out[0].focus, out[0].nextSteps], [0, "Check-in", [{ id: "s", text: "Call home", who: "student", due: "", done: false }]]);
  const ws = normalizeWorkspace({ students: [{ id: "s1", name: "Nolan Framel" }], oneOnOnes: [m("a", "2026-11-18")] } as any);
  assert.deepEqual(studentProfile(ws, "s1", "2026-11-18")!.oneOnOnes.map((x) => x.id), ["a"]);
});

test("both are WorkHub plugins with pages; the meeting page fills to-dos linked to the student", () => {
  for (const [id, tab] of [["work-oneonone", "oneonone"], ["work-profiles", "profiles"]]) {
    const p = PLUGINS.find((x) => x.id === id);
    assert.ok(p && p.target.kind === "tab" && p.target.tab === tab, id);
    assert.ok(HUB_GROUPS.some((g) => g.id === tab), tab);
  }
  const page = readFileSync(new URL("../client/src/components/teacher-hub/HubOneOnOne.tsx", import.meta.url), "utf8");
  assert.match(page, /links: \[\{ kind: "student", id: sid \}\]/);
  assert.match(page, /extra: \{ tasks: \[\.\.\.steps\.map/);
  const hub = readFileSync(new URL("../client/src/pages/TeacherHub.tsx", import.meta.url), "utf8");
  assert.match(hub, /\{tab === "oneonone" && <HubOneOnOne /);
  assert.match(hub, /\{tab === "profiles" && <HubProfiles /);
});

test("an admin can remove menu pages: the menu keeps to their choice once they make one", () => {
  const hub = readFileSync(new URL("../client/src/pages/TeacherHub.tsx", import.meta.url), "utf8");
  assert.match(hub, /const seeAll = !!user\.isAdmin && \(workspace as any\)\.adminPicksTabs !== true;/);
  assert.match(hub, /const menu = visibleGroups\(visible, workspace\.groupOrder, seeAll\);/);
  assert.match(hub, /setWorkspace\(\(prev\) => pickTabs\(prev, Object\.fromEntries\(item\.tabs\.map\(\(t\) => \[t, false\]\)\)\)\);/);
  assert.doesNotMatch(hub, /visible, !!user\.isAdmin\)/);
});
