// The calendar's repeat choices: every day, weekdays, every 2 weeks, certain days of the week, and an end
// day, in both hubs (WorkHub's events go through the same calendar screen, shared/hubSwap.ts).
// Run with: npx tsx --test tests/calendar-repeat-days.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanFamily, occursOn, type FamilyEvent } from "../shared/familyHub";
import { calendarFromFamily, eventsToFamily } from "../shared/hubSwap";
import { repeatDates } from "../shared/hubRepeat";
import { emptyWorkspace, type HubEvent } from "../shared/teacherHub";

const ev = (repeat: FamilyEvent["repeat"], extra: Partial<FamilyEvent> = {}): FamilyEvent =>
  ({ id: "e", title: "Advisory", date: "2026-11-18", time: "08:50", endTime: "09:30", calendarId: "work", memberIds: [], location: "", notes: "", repeat, ...extra });
const week = ["2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28"]; // Sun..Sat
const on = (e: FamilyEvent) => week.filter((d) => occursOn(e, d));

test("each repeat falls on the right days", () => {
  assert.deepEqual(on(ev("daily")), week);
  assert.deepEqual(on(ev("weekdays")), week.slice(1, 6));
  assert.deepEqual(on(ev("weekly")), ["2026-11-25"]);
  assert.deepEqual(on(ev("biweekly")), [], "the week after the first is skipped");
  assert.ok(occursOn(ev("biweekly"), "2026-12-02"));
  assert.deepEqual(on(ev("days", { days: [1, 3, 5] })), ["2026-11-23", "2026-11-25", "2026-11-27"]);
  assert.deepEqual(on(ev("days", { days: [2, 4] })), ["2026-11-24", "2026-11-26"]);
  assert.ok(occursOn(ev("days", { days: [2, 4] }), "2026-11-18"), "the first day always shows");
  assert.equal(occursOn(ev("daily"), "2026-11-17"), false, "nothing before the first day");
});

test("an end day and skipped days are kept to", () => {
  assert.deepEqual(on(ev("daily", { until: "2026-11-24" })), week.slice(0, 3));
  assert.deepEqual(on(ev("weekdays", { skip: ["2026-11-26", "2026-11-27"] })), week.slice(1, 4), "Thanksgiving break skipped");
  assert.equal(occursOn(ev("none"), "2026-11-18"), true);
  assert.equal(occursOn(ev("none"), "2026-11-25"), false);
});

test("saving keeps the new repeats, their days and their end; junk is dropped", () => {
  const f = cleanFamily({ events: [ev("days", { days: [5, 1, 3, 9, 1] as any, until: "2027-06-05" }), { ...ev("bogus" as any), id: "x" }] } as any);
  assert.deepEqual(f.events[0].days, [1, 3, 5]);
  assert.equal(f.events[0].until, "2027-06-05");
  assert.equal(f.events[1].repeat, "none");
});

test("WorkHub events show with their repeat in the calendar, and edits there come back", () => {
  const w = { ...emptyWorkspace(), events: [
    { id: "a", title: "Duty", date: "2026-11-18", start: "", end: "", location: "", notes: "", repeat: "Weekdays" },
    { id: "b", title: "Push-in", date: "2026-11-18", start: "", end: "", location: "", notes: "", repeat: "Every 2 weeks", until: "2027-01-01", skip: ["2026-12-02"] },
  ] as HubEvent[] };
  const fam = eventsToFamily(w);
  assert.equal(fam[0].repeat, "weekdays", "used to show only on the first day");
  assert.deepEqual([fam[1].repeat, fam[1].until, fam[1].skip], ["biweekly", "2027-01-01", ["2026-12-02"]]);
  const edited = fam.map((e) => e.id === "a" ? { ...e, repeat: "days" as const, days: [1, 3, 5], until: "2027-06-05" } : e);
  const back = calendarFromFamily(w, { calendars: [], events: edited }).events;
  const a = back.find((e) => e.id === "a")!, b = back.find((e) => e.id === "b")!;
  assert.deepEqual([a.repeat, a.days, a.until], ["Days", [1, 3, 5], "2027-06-05"]);
  assert.deepEqual([b.repeat, b.until, b.skip], ["Every 2 weeks", "2027-01-01", ["2026-12-02"]], "an untouched repeat keeps its skipped days");
  assert.deepEqual(repeatDates(a, "2026-11-22", "2026-11-28"), ["2026-11-23", "2026-11-25", "2026-11-27"]);
});

test("the editor offers every repeat, the days, an end, and one click opens a picker", () => {
  const cal = readFileSync(new URL("../client/src/components/family-hub/FamilyCalendar.tsx", import.meta.url), "utf8");
  assert.match(cal, /EVENT_REPEAT_VALUES\.map\(\(v\) => <option key=\{v\} value=\{v\}>\{EVENT_REPEAT_LABEL\[v\]\}<\/option>\)/);
  assert.match(cal, /data-testid=\{`event-day-\$\{i\}`\}/);
  assert.match(cal, /<FormRow label="Ends" icon=\{<CalendarDays size=\{15\} \/>\}><PickField type="date" label="Ends" empty="Never"/);
  const ui = readFileSync(new URL("../client/src/components/family-hub/ui.tsx", import.meta.url), "utf8");
  assert.match(ui, /el\.showPicker\?\.\(\)/);
});
