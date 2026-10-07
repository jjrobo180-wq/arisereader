// Run with: npx tsx --test tests/hub-calendar.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { agendaDays, dayTimeline, isPast, monthGrid, openRanges, stillAhead, weekOf } from "../shared/hubCalendar";

const ev = (date: string, start = "", end = "") => ({ date, start, end });

test("events leave the list when they are over", () => {
  const now = { date: "2026-10-07", minutes: 10 * 60 + 30 };
  assert.equal(isPast(ev("2026-10-06", "15:00", "16:00"), now), true);
  assert.equal(isPast(ev("2026-10-07", "09:00", "10:00"), now), true);
  assert.equal(isPast(ev("2026-10-07", "10:00", "11:00"), now), false);
  assert.equal(isPast(ev("2026-10-07", "09:00"), now), true);
  assert.equal(isPast(ev("2026-10-07", "10:00"), now), false);
  assert.equal(isPast(ev("2026-10-07"), now), false);
  assert.equal(isPast(ev("2026-10-08", "07:00", "08:00"), now), false);
  assert.equal(stillAhead([ev("2026-10-06"), ev("2026-10-09")], now).length, 1);
});

test("week and month grids start on Sunday", () => {
  assert.deepEqual(weekOf("2026-10-07")[0], "2026-10-04");
  assert.equal(weekOf("2026-10-07")[6], "2026-10-10");
  const grid = monthGrid("2026-10-15");
  assert.equal(grid[0][0], "2026-09-27");
  assert.equal(grid[grid.length - 1][6], "2026-10-31");
  assert.ok(grid.every((w) => w.length === 7));
});

test("open time is free time minus events and the part of today that has passed", () => {
  const weekly = [{ day: 3, start: "08:00", end: "12:00" }];
  assert.deepEqual(openRanges(weekly, [], "2026-10-07"), [{ start: "08:00", end: "12:00" }]);
  assert.deepEqual(openRanges(weekly, [ev("2026-10-07", "09:00", "10:00")], "2026-10-07"), [{ start: "08:00", end: "09:00" }, { start: "10:00", end: "12:00" }]);
  assert.deepEqual(openRanges(weekly, [], "2026-10-07", { date: "2026-10-07", minutes: 10 * 60 + 5 }), [{ start: "10:15", end: "12:00" }]);
  assert.deepEqual(openRanges(weekly, [], "2026-10-07", { date: "2026-10-07", minutes: 11 * 60 + 50 }), []);
  assert.deepEqual(openRanges(weekly, [], "2026-10-06"), []);
  assert.deepEqual(openRanges(weekly, [ev("2026-10-07")], "2026-10-07"), [{ start: "08:00", end: "12:00" }]);
});

test("the agenda on Home is today's agenda and nothing else", () => {
  const sorted = [ev("2026-10-07", "09:00"), ev("2026-10-07", "13:00"), ev("2026-10-08", "08:00"), ev("2026-10-12")];
  assert.deepEqual(agendaDays(sorted).map((d) => [d.date, d.events.length]), [["2026-10-07", 2], ["2026-10-08", 1], ["2026-10-12", 1]], "the Calendar tab still lists every day ahead");
  assert.deepEqual(agendaDays(sorted, "2026-10-07"), [{ date: "2026-10-07", events: [sorted[0], sorted[1]] }]);
  assert.deepEqual(agendaDays(sorted, "2026-10-09"), [], "a day with nothing on it is empty, not filled from other days");
  const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
  const page = read("client/src/pages/TeacherHub.tsx"), panel = read("client/src/components/teacher-hub/HubCalendar.tsx");
  assert.ok(page.includes('title="Your calendar" onReminderAdded={reminderAdded} agendaToday />'), "Home asks for the one-day agenda");
  assert.ok(!/<HubCalendarTab[^>]*agendaToday/.test(page) && panel.includes("makeId={makeId} onReminderAdded={onReminderAdded} />"), "the Calendar tab keeps the full agenda");
  assert.ok(panel.includes("agendaDays(sorted, agendaToday ? today : undefined)"));
});

test("the day timeline lays the day out against the clock", () => {
  const D = "2026-10-07";
  const day = { from: "07:30", to: "16:00" };
  const e = (id: string, start = "", end = "", date = D) => ({ id, date, start, end });
  const events = [e("pic"), e("am", "08:00", "08:30"), e("staff", "14:30", "15:15"), e("call", "10:00"), e("blip", "12:00", "12:05"), e("other", "09:00", "10:00", "2026-10-08")];
  const t = dayTimeline(events, D, day);
  assert.deepEqual([t.from, t.to], [7 * 60, 16 * 60], "the teacher's day, stretched to whole hours");
  assert.deepEqual(t.allDay.map((x) => x.id), ["pic"], "all-day events sit above the clock");
  assert.deepEqual(t.blocks.map((b) => [b.event.id, b.start, b.end, b.lane, b.lanes]), [
    ["am", 480, 510, 0, 1],
    ["call", 600, 660, 0, 1],   // no end time: drawn as an hour
    ["blip", 720, 750, 0, 1],   // five minutes: drawn as half an hour so it can be read
    ["staff", 870, 915, 0, 1],
  ], "in time order, and nothing from another day");
  // Something early or late stretches the day to fit it.
  const wide = dayTimeline([e("dawn", "05:45", "06:15"), e("night", "19:00", "20:30")], D, day);
  assert.deepEqual([wide.from, wide.to], [5 * 60, 21 * 60]);
  assert.deepEqual([dayTimeline([e("late", "23:30")], D, day).to], [1440], "never past midnight");
  // A day with nothing on it still shows the hours, so there is somewhere to tap.
  assert.deepEqual(dayTimeline([], D, day), { from: 420, to: 960, allDay: [], blocks: [] });
  assert.deepEqual([dayTimeline([], D, { from: "16:00", to: "08:00" }).from, dayTimeline([], D, { from: "", to: "" }).to], [420, 960], "bad hours fall back to a school day");
});

test("events at the same time sit side by side on the timeline", () => {
  const D = "2026-10-07";
  const e = (id: string, start: string, end: string) => ({ id, date: D, start, end });
  const t = dayTimeline([e("a", "09:00", "10:00"), e("b", "09:30", "10:30"), e("c", "10:00", "11:00"), e("d", "13:00", "14:00"), e("e", "14:00", "15:00")], D, { from: "08:00", to: "15:00" });
  const lane = Object.fromEntries(t.blocks.map((b) => [b.event.id, [b.lane, b.lanes]]));
  assert.deepEqual(lane, { a: [0, 2], b: [1, 2], c: [0, 2], d: [0, 1], e: [0, 1] }, "a and b overlap; c reuses a's column; back-to-back events keep the full width");
  for (const x of t.blocks) for (const y of t.blocks) if (x !== y && x.lane === y.lane) assert.ok(x.end <= y.start || y.end <= x.start, `${x.event.id} and ${y.event.id} do not cover each other`);
  const three = dayTimeline([e("a", "09:00", "11:00"), e("b", "09:00", "10:00"), e("c", "09:15", "09:45")], D, { from: "08:00", to: "12:00" });
  assert.deepEqual(three.blocks.map((b) => [b.event.id, b.lane, b.lanes]), [["a", 0, 3], ["b", 1, 3], ["c", 2, 3]]);
});

test("Home's one-day agenda can be switched to the timeline", () => {
  const panel = readFileSync(new URL("../client/src/components/teacher-hub/HubCalendar.tsx", import.meta.url), "utf8");
  for (const part of ['data-testid="day-look"', '["timeline", "Timeline", Clock]', 'data-testid="day-timeline"', 'const timeline = oneDay && dayLook === "timeline";', 'localStorage.setItem("arise-hub-day-look", v)', "{timeline && <DayTimelineView"]) assert.ok(panel.includes(part), part);
});
