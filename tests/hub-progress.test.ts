import test from "node:test";
import assert from "node:assert/strict";
import { goalProgress, serviceStatus, weekStart, withPoint } from "../shared/hubProgress";
import { emptyWorkspace, normalizeWorkspace, type Goal } from "../shared/teacherHub";
import { deleteStudentRecords } from "../shared/hubDelete";

const goal = (extra: Partial<Goal> = {}): Goal => ({ id: "g", student: "Jordan", area: "Reading", text: "Read 60 wpm", baseline: 20, target: 60, unit: "wpm", direction: "up", startDate: "2026-09-01", targetDate: "2026-12-01", points: [], ...extra });
const pt = (date: string, value: number) => ({ id: date, date, value, note: "" });

test("goal status: no data, on track, close, behind, met", () => {
  const T = "2026-10-16"; // about half way
  assert.equal(goalProgress(goal(), T).status, "no data");
  assert.equal(goalProgress(goal({ points: [pt("2026-10-10", 42)] }), T).status, "on track");
  assert.equal(goalProgress(goal({ points: [pt("2026-10-10", 34)] }), T).status, "close");
  assert.equal(goalProgress(goal({ points: [pt("2026-10-10", 22)] }), T).status, "behind");
  const met = goalProgress(goal({ points: [pt("2026-10-10", 61)] }), T);
  assert.deepEqual([met.status, met.percent], ["met", 100]);
});

test("a goal where lower is better (outbursts a week)", () => {
  const g = goal({ baseline: 10, target: 2, direction: "down", points: [pt("2026-10-10", 4)] });
  assert.equal(goalProgress(g, "2026-10-16").percent, 75);
});

test("points stay in date order", () => {
  const g = withPoint(goal({ points: [pt("2026-10-10", 30)] }), { id: "x", date: "2026-10-01", value: 25 });
  assert.deepEqual(g.points.map((p) => p.date), ["2026-10-01", "2026-10-10"]);
});

test("service minutes: this week and the make-up owed", () => {
  assert.equal(weekStart("2026-10-07"), "2026-10-05");
  assert.equal(weekStart("2026-10-11"), "2026-10-05");
  assert.equal(weekStart("2026-10-12"), "2026-10-12");
  const plan = { id: "p", student: "Jordan", kind: "Push-in", minutesPerWeek: 60, since: "2026-09-01" };
  const log = (date: string, minutes: number, kind = "Push-in") => ({ id: date + minutes + kind, student: "Jordan", date, kind, minutes, note: "" });
  const s = serviceStatus(plan, [log("2026-10-05", 30), log("2026-10-06", 15), log("2026-09-29", 60), log("2026-09-22", 20), log("2026-10-01", 99, "Pull-out")], "2026-10-07");
  assert.deepEqual([s.thisWeek, s.remaining, s.percent, s.owed], [45, 15, 75, 40 + 60 + 60]);
  assert.equal(serviceStatus({ ...plan, since: "2026-10-06" }, [], "2026-10-07").owed, 0, "weeks before the plan began are not owed");
  assert.equal(serviceStatus({ ...plan, since: "" }, [], "2026-10-07").owed, 0);
});

test("new lists exist in a saved workspace, and go with a deleted student", () => {
  assert.deepEqual(normalizeWorkspace({}).goals, []);
  const ws = { ...emptyWorkspace(), students: [{ id: "s", name: "Jordan", grade: "", accommodations: "", iepDate: "", reevalDate: "", readingLevel: "", mathLevel: "", notes: "" }], goals: [goal()], serviceLogs: [{ id: "l", student: "Jordan", date: "2026-10-01", kind: "Push-in", minutes: 30, note: "" }] };
  const r = deleteStudentRecords({ ...ws, students: [] }, "Jordan")!;
  assert.equal(r.workspace.goals.length + r.workspace.serviceLogs.length, 0);
});
