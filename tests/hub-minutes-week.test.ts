// Teacher Hub: service minutes as a week calendar of time blocks.
// Run with: npx tsx --test tests/hub-minutes-week.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { blockLogs, minutesWeek, monthDay, openDay, updateLog, type MinutesWeek } from "../shared/hubMinutesWeek";
import { serviceStatus } from "../shared/hubProgress";
import type { ServiceLog, ServicePlan } from "../shared/teacherHub";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
// Wednesday Oct 7, 2026. The week runs Mon Oct 5 to Sun Oct 11.
const TODAY = "2026-10-07";
const jordan: ServicePlan = { id: "j", student: "Jordan Lee", kind: "Push-in", minutesPerWeek: 60, since: "2026-09-07", days: { Mon: 20, Tue: 20, Thu: 20 }, start: "10:00", end: "10:20" };
const dennis: ServicePlan = { id: "d", student: "Dennis Flores", kind: "Push-in", minutesPerWeek: 60, since: "2026-09-07", days: { Mon: 20, Tue: 20, Thu: 20 }, start: "10:00", end: "10:20" };
const sam: ServicePlan = { id: "s", student: "Sam Ortiz", kind: "Pull-out", minutesPerWeek: 60, since: "2026-09-07", days: { Wed: 30, Fri: 30 }, start: "13:00", end: "13:30" };
const maya: ServicePlan = { id: "m", student: "Maya Torres", kind: "Consult", minutesPerWeek: 90, since: "2026-09-07" };
const plans = [jordan, dennis, sam, maya];
let n = 0;
const log = (student: string, kind: string, date: string, minutes: number, start = "", end = "", note = ""): ServiceLog => ({ id: `l${++n}`, student, date, kind, minutes, note, ...(start ? { start, end } : {}) });
/** A week as short lines, one per day: "Mon 20/40 short | 10:00-10:20: Dennis Flores 20 missed, Jordan Lee 20 logged". */
const lines = (week: MinutesWeek) => week.days.map((d) => `${d.day} ${d.done}/${d.planned} ${d.state}${d.blocks.length ? " | " : ""}${d.blocks.map((b) => `${b.start ? `${b.start}-${b.end}` : "no time"}: ${b.items.map((i) => `${i.student} ${i.minutes} ${i.state}`).join(", ")}`).join(" ; ")}`);

test("the week is laid out by day, and students at the same time share a block", () => {
  const logs = [
    log("Jordan Lee", "Push-in", "2026-10-05", 20, "10:00", "10:20"),
    log("Jordan Lee", "Push-in", "2026-10-06", 20, "10:00", "10:20"),
    log("Dennis Flores", "Push-in", "2026-10-06", 20, "10:00", "10:20"),
    log("Maya Torres", "Consult", "2026-10-06", 15, "", "", "with Ms. Lee"),
    log("Jordan Lee", "Push-in", "2026-09-30", 20), // another week: not here
  ];
  const week = minutesWeek(plans, logs, TODAY, TODAY);
  assert.deepEqual([week.start, week.end, week.planned, week.done], ["2026-10-05", "2026-10-11", 60 + 60 + 60 + 90, 75]);
  assert.deepEqual(lines(week), [
    "Mon 20/40 short | 10:00-10:20: Dennis Flores 20 missed, Jordan Lee 20 logged",
    "Tue 55/40 done | 10:00-10:20: Dennis Flores 20 logged, Jordan Lee 20 logged ; no time: Maya Torres 15 logged",
    "Wed 0/30 today | 13:00-13:30: Sam Ortiz 30 today",
    "Thu 0/40 ahead | 10:00-10:20: Dennis Flores 20 planned, Jordan Lee 20 planned",
    "Fri 0/30 ahead | 13:00-13:30: Sam Ortiz 30 planned",
  ], "Monday to Friday, with Saturday and Sunday left out while they are empty");
  assert.deepEqual(week.days[0].blocks[0].todo, 1, "the missed one can be logged with a tap");
  assert.equal(week.days[3].blocks[0].todo, 0, "a day still to come has nothing to log yet");
  assert.equal(week.days[1].blocks[1].items[0].note, "with Ms. Lee");
  // A plan counted by the week has no day of its own.
  assert.deepEqual(week.anyDay, [{ planId: "m", student: "Maya Torres", kind: "Consult", required: 90, done: 15, remaining: 75 }]);
  // Any day in the week gives the same week.
  assert.deepEqual(minutesWeek(plans, logs, "2026-10-11", TODAY), week);
  assert.equal(openDay(week, TODAY), TODAY);
});

test("blocks are in time order, with the sessions that have no time last", () => {
  const early: ServicePlan = { id: "e", student: "Ava Kim", kind: "Pull-out", minutesPerWeek: 15, since: "2026-09-07", days: { Wed: 15 }, start: "08:15", end: "08:30" };
  const untimed: ServicePlan = { id: "u", student: "Ben Cole", kind: "Push-in", minutesPerWeek: 20, since: "2026-09-07", days: { Wed: 20 } };
  const week = minutesWeek([sam, untimed, early], [log("Zed Park", "Other", TODAY, 10, "09:00", "09:10"), log("Ava Kim", "Other", TODAY, 5)], TODAY, TODAY);
  const wed = week.days.find((d) => d.day === "Wed")!;
  assert.deepEqual(wed.blocks.map((b) => [b.start, b.end, b.items.map((i) => i.student).join("+")]), [["08:15", "08:30", "Ava Kim"], ["09:00", "09:10", "Zed Park"], ["13:00", "13:30", "Sam Ortiz"], ["", "", "Ava Kim+Ben Cole"]]);
  assert.equal(wed.blocks[1].items[0].state, "logged", "a student with no plan is just logged");
});

test("an extra day counts and is marked extra; a short day that the week covers is made up", () => {
  const logs = [log("Jordan Lee", "Push-in", "2026-10-05", 20, "10:00", "10:20"), log("Jordan Lee", "Push-in", "2026-10-07", 20, "11:00", "11:20"), log("Jordan Lee", "Push-in", "2026-10-08", 20, "10:00", "10:20")];
  const week = minutesWeek([jordan], logs, "2026-10-09", "2026-10-09");
  assert.deepEqual(lines(week), [
    "Mon 20/20 done | 10:00-10:20: Jordan Lee 20 logged",
    "Tue 0/20 done | 10:00-10:20: Jordan Lee 20 made up",
    "Wed 20/0 done | 11:00-11:20: Jordan Lee 20 extra",
    "Thu 20/20 done | 10:00-10:20: Jordan Lee 20 logged",
    "Fri 0/0 empty",
  ]);
  assert.equal(week.days[1].blocks[0].todo, 0, "nothing is asked for on a day that was made up");
  // It agrees with the by-student card for the same week.
  const card = serviceStatus(jordan, logs, "2026-10-09");
  assert.deepEqual([card.thisWeek, card.remaining, card.extra], [week.done, 0, 20]);
  // The week after, the extra Wednesday is not on the calendar at all.
  const next = minutesWeek([jordan], logs, "2026-10-14", "2026-10-14");
  assert.deepEqual(lines(next), ["Mon 0/20 short | 10:00-10:20: Jordan Lee 20 missed", "Tue 0/20 short | 10:00-10:20: Jordan Lee 20 missed", "Wed 0/0 empty", "Thu 0/20 ahead | 10:00-10:20: Jordan Lee 20 planned", "Fri 0/0 empty"]);
  // A Saturday session brings Saturday onto the calendar.
  const sat = minutesWeek([jordan], [log("Jordan Lee", "Push-in", "2026-10-10", 25)], TODAY, TODAY);
  assert.deepEqual(sat.days.map((d) => d.day), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  assert.equal(sat.days[5].blocks[0].items[0].state, "extra");
});

test("a session given in part leaves the rest to log, with no time of its own", () => {
  const week = minutesWeek([sam], [log("Sam Ortiz", "Pull-out", TODAY, 20, "13:00", "13:20")], TODAY, TODAY);
  assert.deepEqual(lines(week)[2], "Wed 20/30 today | 13:00-13:20: Sam Ortiz 20 logged ; no time: Sam Ortiz 10 today");
  // More than the day asks for: nothing is left, and nothing is "extra" on one of its own days.
  const over = minutesWeek([sam], [log("Sam Ortiz", "Pull-out", TODAY, 45, "13:00", "13:45")], TODAY, TODAY);
  assert.deepEqual(lines(over)[2], "Wed 45/30 done | 13:00-13:45: Sam Ortiz 45 logged");
});

test("other weeks: nothing is asked for before a plan started, and a week to come is all planned", () => {
  const before = minutesWeek([jordan], [], "2026-08-31", TODAY);
  assert.deepEqual([before.planned, before.days.every((d) => d.state === "empty")], [0, true], "the week before the plan started counting");
  const first = minutesWeek([jordan], [], "2026-09-07", TODAY);
  assert.deepEqual(first.days.map((d) => d.state), ["short", "short", "empty", "short", "empty"]);
  assert.equal(openDay(first, TODAY), "2026-09-07", "a week without today opens on its first day with something on it");
  const ahead = minutesWeek([jordan, maya], [], "2026-10-14", TODAY);
  assert.deepEqual(ahead.days.map((d) => d.state), ["ahead", "ahead", "empty", "ahead", "empty"]);
  assert.equal(ahead.anyDay[0].remaining, 90);
  // An older plan with no start day asks for nothing in past weeks, the same as the make-up owed.
  const { since: _since, ...old } = jordan;
  assert.equal(minutesWeek([old], [], "2026-09-28", TODAY).planned, 0);
  assert.equal(minutesWeek([old], [], TODAY, TODAY).planned, 60);
  assert.equal(openDay(minutesWeek([], [], "2026-09-28", TODAY), TODAY), "2026-09-28", "an empty week opens on Monday");
});

test("one tap logs a block: only what is due or missed, each with the usual time", () => {
  const week = minutesWeek(plans, [log("Jordan Lee", "Push-in", "2026-10-05", 20, "10:00", "10:20")], TODAY, TODAY);
  const monday = week.days[0].blocks[0];
  assert.deepEqual(blockLogs(monday.items), [{ student: "Dennis Flores", date: "2026-10-05", kind: "Push-in", minutes: 20, note: "", start: "10:00", end: "10:20" }], "Jordan is already logged");
  assert.deepEqual(blockLogs(week.days[2].blocks[0].items), [{ student: "Sam Ortiz", date: TODAY, kind: "Pull-out", minutes: 30, note: "", start: "13:00", end: "13:30" }]);
  assert.deepEqual(blockLogs(week.days[3].blocks[0].items), [], "Thursday has not come yet");
  // Logged, the block is done and nothing is left to tap.
  const after = minutesWeek(plans, [log("Jordan Lee", "Push-in", "2026-10-05", 20, "10:00", "10:20"), ...blockLogs(monday.items).map((s, i) => ({ id: `new${i}`, ...s }))], TODAY, TODAY);
  assert.deepEqual([after.days[0].state, after.days[0].blocks[0].todo, after.days[0].blocks.length], ["done", 0, 1]);
});

test("a logged session can be changed in place", () => {
  const logs: ServiceLog[] = [{ id: "a", student: "Jordan Lee", date: TODAY, kind: "Push-in", minutes: 20, note: "", start: "10:00", end: "10:20" }, { id: "b", student: "Sam Ortiz", date: TODAY, kind: "Pull-out", minutes: 30, note: "" }];
  const moved = updateLog(logs, "a", { student: "Jordan Lee", date: "2026-10-08", kind: "Push-in", minutes: 25, note: "ran long", start: "10:05", end: "10:30" });
  assert.deepEqual(moved, [{ id: "a", student: "Jordan Lee", date: "2026-10-08", kind: "Push-in", minutes: 25, note: "ran long", start: "10:05", end: "10:30" }, logs[1]]);
  assert.deepEqual(updateLog(logs, "a", { student: "Jordan Lee", date: TODAY, kind: "Push-in", minutes: 20, note: "" })[0], { id: "a", student: "Jordan Lee", date: TODAY, kind: "Push-in", minutes: 20, note: "" }, "its time can be taken off");
  assert.equal(updateLog(logs, "a", null), logs, "nothing changes while it can't be saved");
  assert.equal(logs[0].minutes, 20, "the list handed in is not changed");
  assert.deepEqual([monthDay("2026-10-05"), monthDay("2026-01-31"), monthDay("soon")], ["Oct 5", "Jan 31", ""]);
});

test("the Minutes screen opens on the week calendar and still has the by-student cards", () => {
  const screen = read("client/src/components/teacher-hub/HubProgress.tsx"), week = read("client/src/components/teacher-hub/HubMinutesWeek.tsx");
  for (const part of ['data-testid="minutes-look"', '["week", "Week"], ["students", "By student"]', "<MinutesWeekView workspace={workspace} today={today} onLog={logItems} onEdit={editLog} onAdd={logFrom} />", 'look === "students" &&', '"arise-hub-minutes-look"', '"Change session"', "updateLog(w.serviceLogs, id, logReady)", "blockLogs(items)"]) assert.ok(screen.includes(part), part);
  for (const part of ['data-testid="minutes-week"', 'data-testid="minutes-day-strip"', 'data-testid="minutes-block"', 'data-testid="minutes-log-all"', 'data-testid="minutes-any-day"', "Week before", "Week after", "This week", "No time set", "hidden lg:block", "minutesWeek(workspace.services, workspace.serviceLogs, weekOf, today)"]) assert.ok(week.includes(part), part);
});
