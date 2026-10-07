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

// ─── Service minutes: a time for a session, a day guide, and sessions on other days ───
import { cleanDayGuide, guideDays, minutesBetween, planFields, planText, sessionLog, weeklyMinutes } from "../shared/hubProgress";
import { readFileSync } from "node:fs";

test("a session is logged with a time or with just the minutes", () => {
  assert.equal(minutesBetween("10:00", "10:20"), 20);
  assert.equal(minutesBetween("09:45", "11:00"), 75);
  for (const [a, b] of [["10:20", "10:00"], ["10:00", "10:00"], ["", "10:20"], ["10:00", ""], ["25:00", "26:00"], ["ten", "eleven"]]) assert.equal(minutesBetween(a, b), null, `${a}-${b}`);
  const base = { student: "Jordan", kind: "Push-in", date: "2026-10-07" };
  assert.deepEqual(sessionLog({ ...base, minutes: "", start: "10:00", end: "10:20", note: " Fluency " }), { student: "Jordan", date: "2026-10-07", kind: "Push-in", minutes: 20, note: "Fluency", start: "10:00", end: "10:20" }, "the minutes come from the time");
  assert.deepEqual(sessionLog({ ...base, minutes: "25" }), { student: "Jordan", date: "2026-10-07", kind: "Push-in", minutes: 25, note: "" }, "or just the minutes, with no time at all");
  assert.deepEqual(sessionLog({ ...base, minutes: "15", start: "10:00", end: "10:20" }), { student: "Jordan", date: "2026-10-07", kind: "Push-in", minutes: 15, note: "", start: "10:00", end: "10:15" }, "typed minutes win, and the end follows them");
  assert.deepEqual(sessionLog({ ...base, minutes: 20, start: "9:05" })?.end, "09:25");
  assert.equal(sessionLog({ ...base, minutes: "", start: "10:20", end: "10:00" }), null, "an end before the start is no session");
  for (const bad of ["", "0", "-5", "abc", "601"]) assert.equal(sessionLog({ ...base, minutes: bad }), null, `"${bad}" minutes`);
  assert.equal(sessionLog({ ...base, student: "", minutes: "20" }), null);
});

test("a plan can be a day guide: these days, this many minutes", () => {
  const made = planFields({ student: "Jordan", kind: "Push-in", perWeek: "", days: ["Thu", "Mon", "Tue"], perDay: "", start: "10:00", end: "10:20" });
  assert.deepEqual(made, { student: "Jordan", kind: "Push-in", minutesPerWeek: 60, days: { Mon: 20, Tue: 20, Thu: 20 }, start: "10:00", end: "10:20" }, "minutes from the usual time; the week is the days added up");
  assert.deepEqual(planFields({ student: "Jordan", kind: "Push-in", perWeek: "", days: ["Mon", "Wed"], perDay: "30" }), { student: "Jordan", kind: "Push-in", minutesPerWeek: 60, days: { Mon: 30, Wed: 30 } }, "or typed minutes and no time");
  assert.deepEqual(planFields({ student: "Jordan", kind: "Pull-out", perWeek: "90", days: [], perDay: "" }), { student: "Jordan", kind: "Pull-out", minutesPerWeek: 90 }, "no days picked: counted by the week, as before");
  assert.equal(planFields({ student: "Jordan", kind: "Push-in", perWeek: "", days: ["Mon"], perDay: "" }), null);
  assert.equal(planFields({ student: "", kind: "Push-in", perWeek: "60", days: [], perDay: "" }), null);
  assert.equal(planFields({ student: "Jordan", kind: "Push-in", perWeek: "0", days: [], perDay: "" }), null);
  assert.equal(planText(made!), "Mon, Tue, Thu · 20 min each · 10:00–10:20");
  assert.equal(planText({ minutesPerWeek: 30, days: { Wed: 30 } }), "Wed · 30 min");
  assert.equal(planText({ minutesPerWeek: 50, days: { Mon: 20, Wed: 30 } }), "Mon 20, Wed 30 min");
  assert.equal(planText({ minutesPerWeek: 90 }), "90 min a week");
  assert.deepEqual([weeklyMinutes(made!), weeklyMinutes({ minutesPerWeek: 90 }), weeklyMinutes({ minutesPerWeek: 5, days: { Mon: 20, Fri: 25 } })], [60, 90, 45], "a guide's total is what the week asks for");
  assert.deepEqual(cleanDayGuide({ Mon: "20", Tue: 0, Wed: -5, Thu: 20.4, Funday: 30, Fri: "x" }), { Mon: 20, Thu: 20 });
  assert.deepEqual([cleanDayGuide(null), cleanDayGuide([20]), guideDays({ days: { Thu: 20, Mon: 20 } }), guideDays({})], [{}, {}, ["Mon", "Thu"], []]);
  assert.deepEqual(normalizeWorkspace(JSON.parse(JSON.stringify({ services: [{ id: "p", ...made, since: "2026-10-05" }] }))).services[0], { id: "p", ...made, since: "2026-10-05" }, "it survives a save and load");
});

test("the week is shown day by day, and a session on another day is a bonus, never a debt", () => {
  // Mon, Tue and Thu, 20 minutes. Today is Wednesday Oct 7, 2026.
  const plan = { id: "p", student: "Jordan", kind: "Push-in", minutesPerWeek: 60, days: { Mon: 20, Tue: 20, Thu: 20 }, since: "2026-09-07" };
  const log = (date: string, minutes: number) => ({ id: date + minutes, student: "Jordan", date, kind: "Push-in", minutes, note: "" });
  const lastWeeks = [log("2026-09-28", 20), log("2026-09-29", 20), log("2026-10-01", 20), log("2026-09-21", 20), log("2026-09-22", 20), log("2026-09-24", 20), log("2026-09-14", 60), log("2026-09-07", 60)];
  const days = (s: ReturnType<typeof serviceStatus>) => s.days.map((d) => `${d.day} ${d.done}/${d.planned} ${d.state}`);

  const onTrack = serviceStatus(plan, [...lastWeeks, log("2026-10-05", 20), log("2026-10-06", 20)], "2026-10-07");
  assert.deepEqual([onTrack.required, onTrack.thisWeek, onTrack.remaining, onTrack.owed, onTrack.extra, onTrack.plannedToday], [60, 40, 20, 0, 0, 0], "Wednesday is not one of its days, so nothing is asked for today");
  assert.deepEqual(days(onTrack), ["Mon 20/20 done", "Tue 20/20 done", "Thu 0/20 ahead"], "Wednesday is not listed at all");

  // A random Wednesday push-in: it counts toward the week and shows as extra.
  const withWed = serviceStatus(plan, [...lastWeeks, log("2026-10-05", 20), log("2026-10-06", 20), log("2026-10-07", 20)], "2026-10-07");
  assert.deepEqual([withWed.thisWeek, withWed.remaining, withWed.percent, withWed.extra], [60, 0, 100, 20]);
  assert.deepEqual(days(withWed), ["Mon 20/20 done", "Tue 20/20 done", "Wed 20/0 extra", "Thu 0/20 ahead"]);

  // The week after, with no Wednesday session: nothing is owed for it and Wednesday is not on the list.
  const nextWeek = serviceStatus(plan, [...lastWeeks, log("2026-10-05", 20), log("2026-10-06", 20), log("2026-10-07", 20), log("2026-10-08", 20), log("2026-10-12", 20), log("2026-10-13", 20)], "2026-10-14");
  assert.deepEqual([nextWeek.required, nextWeek.owed, nextWeek.extra], [60, 0, 0], "last week's extra never raised what a week asks for");
  assert.deepEqual(days(nextWeek), ["Mon 20/20 done", "Tue 20/20 done", "Thu 0/20 ahead"]);

  // A missed Tuesday shows as short; a Wednesday session then makes the week whole.
  const missed = serviceStatus(plan, [...lastWeeks, log("2026-10-05", 20)], "2026-10-07");
  assert.deepEqual(days(missed), ["Mon 20/20 done", "Tue 0/20 short", "Thu 0/20 ahead"]);
  const madeUp = serviceStatus(plan, [...lastWeeks, log("2026-10-05", 20), log("2026-10-07", 20), log("2026-10-08", 20)], "2026-10-09");
  assert.deepEqual(days(madeUp), ["Mon 20/20 done", "Tue 0/20 made up", "Wed 20/0 extra", "Thu 20/20 done"]);
  assert.deepEqual([madeUp.remaining, madeUp.extra], [0, 20]);
  // Today is one of its days.
  const thursday = serviceStatus(plan, [...lastWeeks, log("2026-10-05", 20), log("2026-10-06", 20)], "2026-10-08");
  assert.deepEqual([thursday.plannedToday, days(thursday)[2]], [20, "Thu 0/20 today"]);
  // A past week that came up short is still owed, guide or not; one covered by an extra day is not.
  const shortWeek = serviceStatus(plan, [log("2026-09-28", 20), log("2026-09-30", 20), log("2026-10-01", 20), log("2026-09-21", 20)], "2026-10-07");
  assert.equal(shortWeek.owed, 0 + 40 + 60 + 60, "last week was covered by its Wednesday; the three before were short");
  // A plan counted by the week has no day list.
  const weekly = serviceStatus({ id: "w", student: "Jordan", kind: "Push-in", minutesPerWeek: 60, since: "2026-09-07" }, [log("2026-10-07", 20)], "2026-10-07");
  assert.deepEqual([weekly.days, weekly.extra, weekly.plannedToday, weekly.thisWeek], [[], 0, 0, 20]);
});

test("the Minutes screen offers the time, the day guide and the day-by-day week", () => {
  const screen = readFileSync(new URL("../client/src/components/teacher-hub/HubProgress.tsx", import.meta.url), "utf8");
  for (const part of ['aria-label="From"', 'aria-label="To"', 'data-testid="plan-mode"', '"By the day"', '"By the week"', 'data-testid="minutes-days"', 'data-testid="minutes-today"', 'data-testid="minutes-other"', "never expected", "sessionLog({", "planFields({"]) assert.ok(screen.includes(part), part);
});
