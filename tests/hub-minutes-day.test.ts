import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { minutesWeek } from "../shared/hubMinutesWeek";
import { completion, daySections, daySheetLogs, dayRows, sharedMinutes, withNotes } from "../shared/hubMinutesDay";
import type { ServiceLog, ServicePlan } from "../shared/teacherHub";

const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const blocks = [{ id: "b1", name: "Block 1" }, { id: "b2", name: "Block 2" }];
const plans: ServicePlan[] = [
  { id: "p1", student: "Ava", kind: "Push-in", minutesPerWeek: 60, days: { Mon: 30, Thu: 30 }, block: "b1", since: "2026-09-01" },
  { id: "p2", student: "Ben", kind: "Push-in", minutesPerWeek: 30, days: { Thu: 30 }, block: "b2", since: "2026-09-01" },
];
const today = "2026-11-05"; // a Thursday

test("the day page shows the day block by block, and the sheet starts with everyone waiting", () => {
  const week = minutesWeek(plans, [], blocks, today, today, ["Wed"]);
  const sections = daySections(week, today);
  assert.deepEqual(sections.map((s) => [s.name, s.items.map((x) => x.student)]), [["Block 1", ["Ava"]], ["Block 2", ["Ben"]]]);
  const rows = dayRows(sections);
  assert.deepEqual(rows.map((r) => [r.student, r.on, r.minutes]), [["Ava", true, "30"], ["Ben", true, "30"]]);
});

test("the sheet saves minutes with each note or the note for everyone, and 'didn't meet' with the reason", () => {
  const week = minutesWeek(plans, [], blocks, today, today, ["Wed"]);
  const rows = dayRows(daySections(week, today));
  rows[0].note = "Read chapter 2";
  rows[1].met = false;
  const logs = daySheetLogs(rows, "Worked on fluency", "Student absent");
  assert.equal(logs.length, 2);
  assert.deepEqual([logs[0].student, logs[0].minutes, logs[0].note, logs[0].block], ["Ava", 30, "Read chapter 2", "b1"]);
  assert.deepEqual([logs[1].student, logs[1].notMet, logs[1].minutes, logs[1].note], ["Ben", true, 0, "Student absent · Worked on fluency"]);
  // Unpicked rows and rows without minutes are not saved.
  assert.equal(daySheetLogs(rows.map((r) => ({ ...r, on: false })), "", "").length, 0);
  assert.equal(daySheetLogs([{ ...rows[0], minutes: "" }], "", "").length, 0);
});

test("notes go on sessions just logged, for all or each one", () => {
  const logs: ServiceLog[] = [{ id: "a", student: "Ava", date: today, kind: "Push-in", minutes: 30, note: "" }, { id: "b", student: "Ben", date: today, kind: "Push-in", minutes: 30, note: "" }, { id: "c", student: "Cy", date: today, kind: "Push-in", minutes: 30, note: "old" }];
  assert.deepEqual(withNotes(logs, { a: "", b: "" }, "Fractions").map((l) => l.note), ["Fractions", "Fractions", "old"]);
  assert.deepEqual(withNotes(logs, { a: "Great day", b: "" }).map((l) => l.note), ["Great day", "", "old"]);
});

test("completion: the day, the week and the four weeks before", () => {
  const logs: ServiceLog[] = [
    { id: "1", student: "Ava", date: "2026-11-02", kind: "Push-in", minutes: 30, note: "" },
    { id: "2", student: "Ava", date: today, kind: "Push-in", minutes: 30, note: "" },
    // Last week: Ava got all 60, Ben none.
    { id: "3", student: "Ava", date: "2026-10-26", kind: "Push-in", minutes: 90, note: "" },
  ];
  const week = minutesWeek(plans, logs, blocks, today, today, ["Wed"]);
  const c = completion(week, today, plans, logs, today, ["Wed"]);
  assert.deepEqual([c.day.done, c.day.planned, c.day.percent], [30, 60, 50]);
  assert.deepEqual([c.week.done, c.week.planned, c.week.percent], [60, 90, 67]);
  assert.deepEqual([c.answered.done, c.answered.total], [1, 2]);
  // Extra minutes for Ava do not hide that Ben got none: capped at 60 of her 60.
  assert.ok(c.month.done <= c.month.planned);
  assert.equal(c.month.done, 60);
});

test("another case manager only sees minutes that were shared, and only the last ten weeks", () => {
  assert.equal(sharedMinutes({ services: plans, serviceLogs: [] }, today), null);
  const shared = sharedMinutes({ minutesShared: true, services: plans, serviceLogs: [{ id: "x", student: "Ava", date: "2025-01-01", kind: "Push-in", minutes: 30, note: "" }, { id: "y", student: "Ava", date: today, kind: "Push-in", minutes: 30, note: "" }], students: [{ name: "secret" }], notes: [{ text: "private" }] }, today)!;
  assert.deepEqual(shared.serviceLogs.map((l) => l.id), ["y"]);
  assert.ok(!("students" in shared) && !("notes" in shared));
});

test("the Minutes page: one page, views, Edit, day sheet, notes after logging, completion, other case managers", () => {
  const tab = read("client/src/components/teacher-hub/HubProgress.tsx"), day = read("client/src/components/teacher-hub/HubMinutesDay.tsx"), server = read("server/teacherHub.ts"), routes = read("server/routes.ts");
  for (const part of ['data-testid="minutes-edit"', 'data-testid="minutes-who"', "<NotesAfterLog", "<MinutesStats", 'data-testid="minutes-share"', "/api/teacher-hub/colleagues/minutes", "const setWorkspace: Setter = readOnly ? () => {} : setOwn;", "readOnly={readOnly}"]) assert.ok(tab.includes(part), part);
  for (const part of ['data-testid="minutes-day-nav"', 'data-testid="log-day-shared"', 'data-testid="log-day-why"', 'data-testid="notes-after-log"', 'data-testid="minutes-rates"', 'type="date"']) assert.ok(day.includes(part), part);
  assert.ok(server.includes('"/api/teacher-hub/colleagues/minutes"') && server.includes("sharedMinutes(row?.workspace, today())"));
  assert.ok(routes.includes('.eq("school_id", schoolId).eq("role", "teacher")'));
});
