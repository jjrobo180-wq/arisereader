// Teacher Hub calendar: checking events off, snoozing them, and "Did these happen?".
// Run with: npx tsx --test tests/hub-event-status.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeWorkspace, replaceCalendarEvents, type HubEvent, type Workspace } from "../shared/teacherHub";
import { needsCheck, setEventDone, setEventsDone, snoozeEvent, snoozedTo, snoozesFor } from "../shared/hubEventStatus";
import { updateEvent } from "../shared/hubQuickAdd";
import { dueHubReminders } from "../shared/hubReminders";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const ev = (id: string, title: string, date: string, start = "", end = "", more: Partial<HubEvent> = {}): HubEvent => ({ id, title, date, start, end, location: "", notes: "", ...more });
// Wednesday Oct 7, 2026 at 10:30 in the morning.
const now = { date: "2026-10-07", minutes: 10 * 60 + 30 };

function hub(): Workspace {
  return normalizeWorkspace({
    events: [
      ev("old", "Field trip forms", "2026-09-20"),
      ev("mon", "Parent call", "2026-10-05", "15:00", "15:30"),
      ev("am", "Duty", "2026-10-07", "08:00", "08:30"),
      ev("pm", "Staff meeting", "2026-10-07", "14:30", "15:15"),
      ev("allday", "Picture day", "2026-10-07"),
      ev("g1", "Period 1", "2026-10-06", "08:00", "09:00", { calendarId: "cal1" }),
      ev("fri", "Assembly", "2026-10-09", "09:00"),
    ],
    calendars: [{ id: "cal1", name: "Work", url: "https://example.com/a.ics", syncedAt: "2026-10-07T00:00:00.000Z" }],
    pins: [{ id: "p1", kind: "event", refId: "pm", color: "#0f766e", label: "", snap: { title: "Staff meeting", date: "2026-10-07", start: "14:30" } }],
  });
}

test("an event can be checked off, and the check mark taken back", () => {
  const start = hub();
  const done = setEventDone(start, "pm", true);
  assert.equal(done.events[3].done, true);
  assert.equal(done.events[2], start.events[2], "nothing else changes");
  assert.equal(start.events[3].done, undefined, "the workspace handed in is not changed");
  assert.equal("done" in setEventDone(done, "pm", false).events[3], false);
  assert.equal(setEventDone(start, "gone", true), start);
  assert.equal(setEventDone(start, "g1", true).events[5].done, true, "a connected calendar's event can be checked off too");
  assert.deepEqual(normalizeWorkspace(JSON.parse(JSON.stringify(done))).events[3], done.events[3], "it survives a save and load");
});

test("Did these happen: the teacher's own events that are over and not checked off", () => {
  const start = hub();
  assert.deepEqual(needsCheck(start.events, now).map((e) => e.id), ["mon", "am"], "not the old one, not today's later ones, not the connected calendar's, not the all-day event that is still on");
  assert.deepEqual(needsCheck(setEventDone(start, "mon", true).events, now).map((e) => e.id), ["am"], "Done takes it off the list");
  assert.deepEqual(needsCheck(setEventsDone(start, ["mon", "am"]).events, now), [], "Mark all done clears it");
  assert.deepEqual(needsCheck(start.events, { date: "2026-10-08", minutes: 0 }).map((e) => e.id), ["mon", "allday", "am", "pm"], "the next morning, today's are asked about (all-day first)");
  // Rescheduling to a time ahead takes it off the list as well.
  const moved = updateEvent(start, "mon", { title: "Parent call", date: "2026-10-12", start: "15:00", end: "15:30", location: "", notes: "" });
  assert.deepEqual(needsCheck(moved.events, now).map((e) => e.id), ["am"]);
});

test("snooze pushes an event back and never into the past", () => {
  const pm = hub().events[3];
  assert.deepEqual(snoozedTo(pm, "hour", now), { date: "2026-10-07", start: "15:30", end: "16:15" }, "an hour later, same length");
  assert.deepEqual(snoozedTo(pm, "tomorrow", now), { date: "2026-10-08", start: "14:30", end: "15:15" });
  assert.deepEqual(snoozedTo(pm, "week", now), { date: "2026-10-14", start: "14:30", end: "15:15" });
  // Already over: counted from now, not from when it was.
  const mon = hub().events[1];
  assert.deepEqual(snoozedTo(mon, "tomorrow", now), { date: "2026-10-08", start: "15:00", end: "15:30" });
  assert.deepEqual(snoozedTo(mon, "week", now), { date: "2026-10-14", start: "15:00", end: "15:30" });
  assert.deepEqual(snoozedTo(mon, "hour", now), { date: "2026-10-07", start: "11:30", end: "12:00" }, "an hour from now");
  assert.deepEqual(snoozedTo(hub().events[2], "hour", { date: "2026-10-07", minutes: 8 * 60 + 12 }), { date: "2026-10-07", start: "09:15", end: "09:45" }, "one already under way: an hour from now, on a tidy five minutes");
  // Late at night it rolls into tomorrow.
  assert.deepEqual(snoozedTo(ev("x", "Late", "2026-10-07", "23:30", "23:50"), "hour", now), { date: "2026-10-08", start: "00:30", end: "00:50" });
  // An all-day event has no hour to push.
  assert.equal(snoozedTo(hub().events[4], "hour", now), null);
  assert.deepEqual(snoozesFor(hub().events[4]).map((s) => s.label), ["Tomorrow", "Next week"]);
  assert.deepEqual(snoozesFor(pm).map((s) => s.label), ["1 hour", "Tomorrow", "Next week"]);
  assert.deepEqual(snoozedTo(hub().events[6], "hour", now), { date: "2026-10-09", start: "10:00", end: "" }, "no end time stays that way");
});

test("a snoozed event is the same event, moved; a pin follows and a check mark comes off", () => {
  const start = setEventDone(hub(), "pm", true);
  const next = snoozeEvent(start, "pm", "tomorrow", now);
  assert.deepEqual(next.events[3], { id: "pm", title: "Staff meeting", date: "2026-10-08", start: "14:30", end: "15:15", location: "", notes: "" });
  assert.equal(next.events.length, start.events.length);
  assert.deepEqual(next.pins[0].snap, { title: "Staff meeting", date: "2026-10-08", start: "14:30" });
  assert.equal(start.events[3].date, "2026-10-07", "the workspace handed in is not changed");
  assert.equal(snoozeEvent(start, "g1", "tomorrow", now), start, "a connected calendar's event is moved in that calendar, not here");
  assert.equal(snoozeEvent(start, "allday", "hour", now), start);
  assert.equal(snoozeEvent(start, "gone", "week", now), start);
});

test("editing keeps a check mark unless the day or time changes", () => {
  const start = setEventDone(hub(), "mon", true);
  const same = { title: "Parent call (Maya)", date: "2026-10-05", start: "15:00", end: "15:45", location: "Phone", notes: "" };
  assert.equal(updateEvent(start, "mon", same).events[1].done, true, "a new name or place is still the same done event");
  assert.equal("done" in updateEvent(start, "mon", { ...same, date: "2026-10-12" }).events[1], false);
  assert.equal("done" in updateEvent(start, "mon", { ...same, start: "16:00" }).events[1], false);
});

test("a connected calendar's check marks survive its next read", () => {
  const start = setEventDone(hub(), "g1", true);
  let n = 0;
  const fresh = replaceCalendarEvents(start, start.calendars[0], [
    { title: "Period 1", date: "2026-10-06", start: "08:00", end: "09:00", location: "", notes: "" },
    { title: "Period 1", date: "2026-10-07", start: "08:00", end: "09:00", location: "", notes: "" },
  ], () => `fresh${++n}`);
  const mine = fresh.events.filter((e) => e.calendarId === "cal1");
  assert.deepEqual(mine.map((e) => [e.id, e.date, e.done]), [["fresh1", "2026-10-06", true], ["fresh2", "2026-10-07", undefined]]);
  assert.equal(fresh.events.filter((e) => !e.calendarId).length, 6, "the teacher's own events are untouched");
});

test("no heads-up is sent for an event already checked off", () => {
  const at = Date.parse("2026-10-07T20:20:00Z"); // 2:20 PM in Denver, ten minutes before the staff meeting
  assert.deepEqual(dueHubReminders(hub(), at, "America/Denver").map((r) => r.title), ["Staff meeting"]);
  assert.deepEqual(dueHubReminders(setEventDone(hub(), "pm", true), at, "America/Denver"), []);
});

test("the calendar offers Mark done, Snooze and the check list", () => {
  const cal = read("client/src/components/teacher-hub/HubCalendar.tsx");
  for (const part of ['data-testid="event-done"', 'data-testid="event-snooze"', 'data-testid="event-check"', 'data-testid="event-check-all"', 'data-testid="event-moved"', "Mark done", "Reschedule", "snoozeEvent(p, event.id, how, now)", "needsCheck(events, now)", "onSnooze={snooze}"]) assert.ok(cal.includes(part), part);
});
