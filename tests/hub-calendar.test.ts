// Run with: npx tsx --test tests/hub-calendar.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { agendaDays, isPast, monthGrid, openRanges, stillAhead, weekOf } from "../shared/hubCalendar";

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
