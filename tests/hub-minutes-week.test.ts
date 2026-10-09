// Teacher Hub: service minutes sectioned off by the blocks (periods) of the school day.
// Run with: npx tsx --test tests/hub-minutes-week.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BLOCKS_MAX, blockName, cleanBlocks, defaultBlocks, schoolBlocks } from "../shared/hubBlocks";
import { blockLogs, minutesWeek, monthDay, openDay, sessionBlockName, setPlanBlock, updateLog, type MinutesWeek } from "../shared/hubMinutesWeek";
import { serviceStatus } from "../shared/hubProgress";
import { normalizeWorkspace, type ServiceLog, type ServicePlan } from "../shared/teacherHub";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
// Wednesday Oct 7, 2026. The week runs Mon Oct 5 to Sun Oct 11.
const TODAY = "2026-10-07";
const BLOCKS = defaultBlocks(); // Block 1 to Block 5, ids b1 to b5
const jordan: ServicePlan = { id: "j", student: "Jordan Lee", kind: "Push-in", minutesPerWeek: 60, since: "2026-09-07", days: { Mon: 20, Tue: 20, Thu: 20 }, block: "b2" };
const dennis: ServicePlan = { id: "d", student: "Dennis Flores", kind: "Push-in", minutesPerWeek: 60, since: "2026-09-07", days: { Mon: 20, Tue: 20, Thu: 20 }, block: "b2" };
const sam: ServicePlan = { id: "s", student: "Sam Ortiz", kind: "Pull-out", minutesPerWeek: 60, since: "2026-09-07", days: { Wed: 30, Fri: 30 }, block: "b4" };
const maya: ServicePlan = { id: "m", student: "Maya Torres", kind: "Consult", minutesPerWeek: 90, since: "2026-09-07" };
const plans = [jordan, dennis, sam, maya];
let n = 0;
const log = (student: string, kind: string, date: string, minutes: number, extra: Partial<ServiceLog> = {}): ServiceLog => ({ id: `l${++n}`, student, date, kind, minutes, note: "", ...extra });
/** A week as short lines, one per day: "Mon 20/40 short | Block 2: Dennis Flores 20 missed, Jordan Lee 20 logged". Empty blocks are left out. */
const lines = (week: MinutesWeek) => week.days.map((d) => {
  const cells = d.cells.map((c, i) => (c.items.length ? `${week.rows[i].name}: ${c.items.map((x) => `${x.student} ${x.minutes} ${x.state}`).join(", ")}` : "")).filter(Boolean);
  return `${d.day} ${d.done}/${d.planned} ${d.state}${cells.length ? " | " : ""}${cells.join(" ; ")}`;
});

test("each day is sectioned off by block, with the students due in each", () => {
  const logs = [
    log("Jordan Lee", "Push-in", "2026-10-05", 20),
    log("Jordan Lee", "Push-in", "2026-10-06", 20),
    log("Dennis Flores", "Push-in", "2026-10-06", 20),
    log("Maya Torres", "Consult", "2026-10-06", 15, { note: "with Ms. Lee" }),
    log("Jordan Lee", "Push-in", "2026-09-30", 20), // another week: not here
  ];
  const week = minutesWeek(plans, logs, BLOCKS, TODAY, TODAY);
  assert.deepEqual([week.start, week.end, week.planned, week.done], ["2026-10-05", "2026-10-11", 60 + 60 + 60 + 90, 75]);
  assert.deepEqual(week.rows.map((r) => r.name), ["Block 1", "Block 2", "Block 3", "Block 4", "Block 5", "No block"], "every block is a row, and Maya (in no block) gets a row of her own");
  assert.ok(week.days.every((d) => d.cells.length === week.rows.length && d.cells.every((c, i) => c.id === week.rows[i].id)), "every day has every row, in order");
  assert.deepEqual(lines(week), [
    "Mon 20/40 short | Block 2: Dennis Flores 20 missed, Jordan Lee 20 logged",
    "Tue 55/40 done | Block 2: Dennis Flores 20 logged, Jordan Lee 20 logged ; No block: Maya Torres 15 logged",
    "Wed 0/30 today | Block 4: Sam Ortiz 30 today",
    "Thu 0/40 ahead | Block 2: Dennis Flores 20 planned, Jordan Lee 20 planned",
    "Fri 0/30 ahead | Block 4: Sam Ortiz 30 planned",
  ], "Monday to Friday, with Saturday and Sunday left out while they are empty");
  const cell = (day: number, block: string) => week.days[day].cells.find((c) => c.id === block)!;
  assert.deepEqual([cell(0, "b2").todo, cell(0, "b2").done], [1, 20], "the missed one can be logged with a tap");
  assert.equal(cell(3, "b2").todo, 0, "a day still to come has nothing to log yet");
  assert.equal(cell(1, "").items[0].note, "with Ms. Lee");
  // A plan counted by the week that is in no block sits under the grid.
  assert.deepEqual(week.anyDay, [{ planId: "m", student: "Maya Torres", kind: "Consult", required: 90, done: 15, remaining: 75 }]);
  // Any day in the week gives the same week, and the week opens on today.
  assert.deepEqual(minutesWeek(plans, logs, BLOCKS, "2026-10-11", TODAY), week);
  assert.equal(openDay(week, TODAY), TODAY);
  // With nothing outside a block, there is no "No block" row.
  assert.deepEqual(minutesWeek([jordan, sam], [], BLOCKS, TODAY, TODAY).rows.map((r) => r.id), ["b1", "b2", "b3", "b4", "b5"]);
});

test("a new day starts fresh, and an earlier day can still be filled in", () => {
  // Thursday morning: nothing logged this week yet.
  const thursday = minutesWeek([jordan, dennis, sam], [], BLOCKS, "2026-10-08", "2026-10-08");
  assert.deepEqual(lines(thursday).slice(0, 4), [
    "Mon 0/40 short | Block 2: Dennis Flores 20 missed, Jordan Lee 20 missed",
    "Tue 0/40 short | Block 2: Dennis Flores 20 missed, Jordan Lee 20 missed",
    "Wed 0/30 short | Block 4: Sam Ortiz 30 missed",
    "Thu 0/40 today | Block 2: Dennis Flores 20 today, Jordan Lee 20 today",
  ]);
  // Going back to Monday and logging both with one tap: each goes in its block, on Monday.
  const monday = thursday.days[0].cells.find((c) => c.id === "b2")!;
  const made = blockLogs(monday.items);
  assert.deepEqual(made, [
    { student: "Dennis Flores", date: "2026-10-05", kind: "Push-in", minutes: 20, note: "", block: "b2" },
    { student: "Jordan Lee", date: "2026-10-05", kind: "Push-in", minutes: 20, note: "", block: "b2" },
  ]);
  const after = minutesWeek([jordan, dennis, sam], made.map((s, i) => ({ id: `new${i}`, ...s })), BLOCKS, "2026-10-08", "2026-10-08");
  assert.equal(lines(after)[0], "Mon 40/40 done | Block 2: Dennis Flores 20 logged, Jordan Lee 20 logged");
  assert.equal(lines(after)[3], "Thu 0/40 today | Block 2: Dennis Flores 20 today, Jordan Lee 20 today", "today is untouched");
  assert.deepEqual(blockLogs(thursday.days[4].cells.flatMap((c) => c.items)), [], "Friday has not come yet");
  // A week that is over can be opened and filled in the same way.
  const last = minutesWeek([jordan], [], BLOCKS, "2026-09-29", "2026-10-08");
  assert.deepEqual(lines(last), ["Mon 0/20 short | Block 2: Jordan Lee 20 missed", "Tue 0/20 short | Block 2: Jordan Lee 20 missed", "Wed 0/0 empty", "Thu 0/20 short | Block 2: Jordan Lee 20 missed", "Fri 0/0 empty"]);
  assert.equal(openDay(last, "2026-10-08"), "2026-09-28", "a week without today opens on its first day with something on it");
});

test("where a session goes: the block it was logged in, or else its plan's. A clock time plays no part", () => {
  const periods = [{ id: "b1", name: "Period 1" }, { id: "b2", name: "Period 2" }, { id: "b3", name: "Period 3" }];
  const ava: ServicePlan = { id: "a", student: "Ava Kim", kind: "Pull-out", minutesPerWeek: 20, since: "2026-09-07", days: { Wed: 20 }, block: "b2", start: "09:10", end: "09:30" }; // an old plan that still has a time saved
  const ben: ServicePlan = { id: "b", student: "Ben Cole", kind: "Push-in", minutesPerWeek: 20, since: "2026-09-07", days: { Wed: 20 }, block: "b1" };
  const gone: ServicePlan = { id: "g", student: "Gus Hale", kind: "Push-in", minutesPerWeek: 20, since: "2026-09-07", days: { Wed: 20 }, block: "removed" }; // its block was taken away
  const logs = [
    log("Ben Cole", "Push-in", TODAY, 10, { block: "b3" }), // given in Period 3 this once
    log("Zed Park", "Other", TODAY, 10, { start: "08:15", end: "08:25" }), // no plan and no block: an old time does not place it
    log("Yan Wu", "Other", TODAY, 5, { block: "b2" }), // no plan, logged in Period 2
  ];
  const week = minutesWeek([ava, ben, gone], logs, periods, TODAY, TODAY);
  assert.equal(lines(week)[2], "Wed 25/60 today | Period 1: Ben Cole 10 today ; Period 2: Ava Kim 20 today, Yan Wu 5 logged ; Period 3: Ben Cole 10 logged ; No block: Gus Hale 20 today, Zed Park 10 logged");
  // A one-tap log carries the block and the minutes, and never a clock time.
  assert.deepEqual(blockLogs(week.days[2].cells.flatMap((c) => c.items)), [
    { student: "Ben Cole", date: TODAY, kind: "Push-in", minutes: 10, note: "", block: "b1" },
    { student: "Ava Kim", date: TODAY, kind: "Pull-out", minutes: 20, note: "", block: "b2" },
    { student: "Gus Hale", date: TODAY, kind: "Push-in", minutes: 20, note: "" },
  ]);
  assert.ok(week.days.every((d) => d.cells.every((c) => c.items.every((x) => !("start" in x) && !("end" in x)))), "nothing in the grid has a time");
  // The block's name, for the lists that show a session.
  assert.deepEqual(logs.map((l) => sessionBlockName(l, [ava, ben, gone], periods)), ["Period 3", "", "Period 2"]);
  assert.equal(sessionBlockName(log("Ben Cole", "Push-in", TODAY, 10), [ben], periods), "Period 1", "its plan's block when it has none of its own");
  assert.deepEqual([blockName(periods, "b2"), blockName(periods, "removed"), blockName(periods, undefined)], ["Period 2", "", ""]);
});

test("an extra day counts and is marked extra; a short day that the week covers is made up", () => {
  const logs = [log("Jordan Lee", "Push-in", "2026-10-05", 20), log("Jordan Lee", "Push-in", "2026-10-07", 20), log("Jordan Lee", "Push-in", "2026-10-08", 20)];
  const week = minutesWeek([jordan], logs, BLOCKS, "2026-10-09", "2026-10-09");
  assert.deepEqual(lines(week), [
    "Mon 20/20 done | Block 2: Jordan Lee 20 logged",
    "Tue 0/20 done | Block 2: Jordan Lee 20 made up",
    "Wed 20/0 done | Block 2: Jordan Lee 20 extra",
    "Thu 20/20 done | Block 2: Jordan Lee 20 logged",
    "Fri 0/0 empty",
  ]);
  assert.equal(week.days[1].cells[1].todo, 0, "nothing is asked for on a day that was made up");
  // It agrees with the by-student card for the same week.
  const card = serviceStatus(jordan, logs, "2026-10-09");
  assert.deepEqual([card.thisWeek, card.remaining, card.extra], [week.done, 0, 20]);
  // The week after, the extra Wednesday is not there at all.
  assert.equal(lines(minutesWeek([jordan], logs, BLOCKS, "2026-10-14", "2026-10-14"))[2], "Wed 0/0 empty");
  // A Saturday session brings Saturday in.
  const sat = minutesWeek([jordan], [log("Jordan Lee", "Push-in", "2026-10-10", 25)], BLOCKS, TODAY, TODAY);
  assert.deepEqual(sat.days.map((d) => d.day), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  assert.equal(sat.days[5].cells[1].items[0].state, "extra");
  // A session given in part leaves the rest to log; more than asked leaves nothing.
  assert.equal(lines(minutesWeek([sam], [log("Sam Ortiz", "Pull-out", TODAY, 20)], BLOCKS, TODAY, TODAY))[2], "Wed 20/30 today | Block 4: Sam Ortiz 20 logged, Sam Ortiz 10 today");
  assert.equal(lines(minutesWeek([sam], [log("Sam Ortiz", "Pull-out", TODAY, 45)], BLOCKS, TODAY, TODAY))[2], "Wed 45/30 done | Block 4: Sam Ortiz 45 logged");
});

test("a plan counted by the week sits in its block every school day until the week is given", () => {
  const inBlock = { ...maya, block: "b5" };
  const week = minutesWeek([inBlock], [log("Maya Torres", "Consult", "2026-10-06", 30)], BLOCKS, TODAY, TODAY);
  assert.deepEqual(lines(week), [
    "Mon 0/0 empty | Block 5: Maya Torres 60 any day",
    "Tue 30/0 done | Block 5: Maya Torres 30 logged",
    "Wed 0/0 empty | Block 5: Maya Torres 60 any day",
    "Thu 0/0 empty | Block 5: Maya Torres 60 any day",
    "Fri 0/0 empty | Block 5: Maya Torres 60 any day",
  ], "never missed: it can be given on any day");
  assert.deepEqual([week.anyDay, week.days[0].cells[4].todo], [[], 0], "it is in the grid now, and needs its minutes typed");
  const given = minutesWeek([inBlock], [log("Maya Torres", "Consult", "2026-10-06", 90)], BLOCKS, TODAY, TODAY);
  assert.equal(lines(given)[2], "Wed 0/0 empty", "once the week is given it is not asked for again");
});

test("other weeks: nothing is asked for before a plan started, and a week to come is all planned", () => {
  const before = minutesWeek([jordan], [], BLOCKS, "2026-08-31", TODAY);
  assert.deepEqual([before.planned, before.days.every((d) => d.state === "empty")], [0, true], "the week before the plan started counting");
  const ahead = minutesWeek([jordan, maya], [], BLOCKS, "2026-10-14", TODAY);
  assert.deepEqual(ahead.days.map((d) => d.state), ["ahead", "ahead", "empty", "ahead", "empty"]);
  assert.equal(ahead.anyDay[0].remaining, 90);
  // An older plan with no start day asks for nothing in past weeks, the same as the make-up owed.
  const { since: _since, ...old } = jordan;
  assert.equal(minutesWeek([old], [], BLOCKS, "2026-09-28", TODAY).planned, 0);
  assert.equal(minutesWeek([old], [], BLOCKS, TODAY, TODAY).planned, 60);
  assert.equal(openDay(minutesWeek([], [], BLOCKS, "2026-09-28", TODAY), TODAY), "2026-09-28", "an empty week opens on Monday");
});

test("the blocks: five to start with, and the teacher's own are kept safe", () => {
  assert.deepEqual(defaultBlocks().map((b) => [b.id, b.name]), [["b1", "Block 1"], ["b2", "Block 2"], ["b3", "Block 3"], ["b4", "Block 4"], ["b5", "Block 5"]]);
  assert.deepEqual(defaultBlocks("Period", 2), [{ id: "b1", name: "Period 1" }, { id: "b2", name: "Period 2" }]);
  assert.deepEqual(schoolBlocks({}), defaultBlocks());
  assert.deepEqual(schoolBlocks({ minuteBlocks: [] }), defaultBlocks(), "an empty list is not a day with no blocks");
  assert.deepEqual(cleanBlocks([
    { id: "b1", name: "  Period   1 ", start: "08:00", end: "08:50" },
    { id: "b1", name: "Twice" }, { id: "", name: "No id" }, { id: "x", name: "   " }, null, "junk",
    { id: "b2", name: "Lunch" }, { id: "b4", name: "x".repeat(80) },
  ]), [{ id: "b1", name: "Period 1" }, { id: "b2", name: "Lunch" }, { id: "b4", name: "x".repeat(30) }], "a block is a name; a time is not kept");
  assert.equal(cleanBlocks(Array.from({ length: 40 }, (_, i) => ({ id: `k${i}`, name: `B${i}` })))!.length, BLOCKS_MAX);
  assert.equal(cleanBlocks("nope"), null);
  // They are saved with the workspace, and a workspace without them stays without.
  const saved = normalizeWorkspace(JSON.parse(JSON.stringify({ minuteBlocks: [{ id: "b1", name: "Period 1" }, { id: "p2", name: "Period 2" }], services: [{ ...jordan }], serviceLogs: [{ id: "a", student: "Jordan Lee", date: TODAY, kind: "Push-in", minutes: 20, note: "", block: "p2" }] })));
  assert.deepEqual(saved.minuteBlocks, [{ id: "b1", name: "Period 1" }, { id: "p2", name: "Period 2" }]);
  assert.deepEqual([saved.services[0].block, saved.serviceLogs[0].block], ["b2", "p2"], "a plan's and a session's block survive a save and load");
  assert.equal("minuteBlocks" in normalizeWorkspace({}), false);
  assert.equal("minuteBlocks" in normalizeWorkspace({ minuteBlocks: [{ name: "no id" }] }), false);
});

test("a student is put in a block, and a logged session is changed in place", () => {
  const moved = setPlanBlock(plans, "m", "b3");
  assert.deepEqual(moved.map((p) => p.block), ["b2", "b2", "b4", "b3"]);
  assert.equal(plans[3].block, undefined, "the list handed in is not changed");
  assert.equal("block" in setPlanBlock(moved, "m", "")[3], false, "and taken out again");
  const logs: ServiceLog[] = [{ id: "a", student: "Jordan Lee", date: TODAY, kind: "Push-in", minutes: 20, note: "", start: "10:00", end: "10:20", block: "b2" }, { id: "b", student: "Sam Ortiz", date: TODAY, kind: "Pull-out", minutes: 30, note: "" }];
  const changed = updateLog(logs, "a", { student: "Jordan Lee", date: "2026-10-06", kind: "Push-in", minutes: 25, note: "ran long", start: "10:05", end: "10:30", block: "b3" });
  assert.deepEqual(changed, [{ id: "a", student: "Jordan Lee", date: "2026-10-06", kind: "Push-in", minutes: 25, note: "ran long", start: "10:05", end: "10:30", block: "b3" }, logs[1]], "moved to another day and block");
  assert.deepEqual(updateLog(logs, "a", { student: "Jordan Lee", date: TODAY, kind: "Push-in", minutes: 20, note: "" })[0], { id: "a", student: "Jordan Lee", date: TODAY, kind: "Push-in", minutes: 20, note: "" }, "its time and block can be taken off");
  assert.equal(updateLog(logs, "a", null), logs, "nothing changes while it can't be saved");
  assert.equal(logs[0].minutes, 20);
  assert.deepEqual([monthDay("2026-10-05"), monthDay("2026-01-31"), monthDay("soon")], ["Oct 5", "Jan 31", ""]);
});

test("the Minutes screen opens on the blocks and still has the by-student cards", () => {
  const screen = read("client/src/components/teacher-hub/HubProgress.tsx"), week = read("client/src/components/teacher-hub/HubMinutesWeek.tsx");
  for (const part of ['data-testid="minutes-look"', '["week", "By block"], ["students", "By student"]', "<MinutesWeekView workspace={workspace} today={today}", "onBlocks={() => setSettingBlocks(true)}", "setPlanBlock(w.services, planId, block)", "<BlocksModal blocks={blocks}", "minuteBlocks: next", 'look === "students" &&', '"arise-hub-minutes-look"', '"Change session"', "updateLog(w.serviceLogs, id, session)", "blockLogs(items)", 'aria-label="Block"']) assert.ok(screen.includes(part), part);
  // A block takes the place of a clock time: no time box is left on the Minutes screens.
  for (const gone of ['type="time"', 'aria-label="From"', "Usual start", "clock12"]) { assert.ok(!screen.slice(screen.indexOf("export function MinutesTab")).includes(gone), gone); assert.ok(!week.includes(gone), gone); }
  assert.equal(screen.split('aria-label="Block"').length - 1, 2, "a block can be chosen for a plan and for a session");
  for (const part of ['data-testid="minutes-week"', 'data-testid="minutes-day-strip"', 'data-testid="minutes-row"', 'data-testid="minutes-cell"', 'data-testid="minutes-log-all"', 'data-testid="minutes-move"', 'data-testid="minutes-blocks-setup"', 'data-testid="blocks-form"', "Set up blocks", "Put in a block…", "Week before", "Week after", "hidden lg:block", "minutesWeek(workspace.services, workspace.serviceLogs, blocks, weekOf, today, optional)", "Forgot a day? Go back to it and add the minutes"]) assert.ok(week.includes(part), part);
});
