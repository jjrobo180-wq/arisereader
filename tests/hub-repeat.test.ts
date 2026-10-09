// Teacher Hub calendar: repeating events, hiding events that are not the teacher's, and the to-do extras.
// Run with: npx tsx --test tests/hub-repeat.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeWorkspace, type HubEvent, type Task, type Workspace } from "../shared/teacherHub";
import { expandEvents, moveOccurrence, occurrenceId, occurrenceOf, repeatDates, repeatText, savedEvent, setOccurrenceDone, skipOccurrence, unskipOccurrence } from "../shared/hubRepeat";
import { calendarEvents, hideEvent, isHidden, showAgain } from "../shared/hubHidden";
import { needsCheck, setEventDone, snoozeEvent } from "../shared/hubEventStatus";
import { eventEdit, quickItems, updateEvent } from "../shared/hubQuickAdd";
import { dueHubReminders } from "../shared/hubReminders";
import { clearDone, restoreTasks, saveTask } from "../shared/hubTasks";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const ev = (id: string, title: string, date: string, start = "", end = "", more: Partial<HubEvent> = {}): HubEvent => ({ id, title, date, start, end, location: "", notes: "", ...more });
const rep = (repeat: string, date: string, more: Partial<HubEvent> = {}) => ({ date, repeat, ...more });
const ids = () => { let n = 0; return () => `new${++n}`; };
// Wednesday Oct 7, 2026, 10:30 in the morning.
const now = { date: "2026-10-07", minutes: 630 };

test("a repeating event falls on the right days", () => {
  assert.deepEqual(repeatDates(rep("Daily", "2026-10-05"), "2026-10-07", "2026-10-10"), ["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"]);
  assert.deepEqual(repeatDates(rep("Weekdays", "2026-10-07"), "2026-10-07", "2026-10-13"), ["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-12", "2026-10-13"], "no Saturday or Sunday");
  assert.deepEqual(repeatDates(rep("Weekly", "2026-09-02"), "2026-10-01", "2026-10-31"), ["2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28"], "every Wednesday, counted from its first day");
  assert.deepEqual(repeatDates(rep("Every 2 weeks", "2026-09-02"), "2026-10-01", "2026-11-15"), ["2026-10-14", "2026-10-28", "2026-11-11"]);
  assert.deepEqual(repeatDates(rep("Monthly", "2026-08-31"), "2026-09-01", "2026-12-31"), ["2026-09-30", "2026-10-31", "2026-11-30", "2026-12-31"], "the 31st, or the last day of a shorter month");
  assert.deepEqual(repeatDates(rep("Yearly", "2024-02-29"), "2025-01-01", "2028-12-31"), ["2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]);
  // It does not start before its first day, stops at "until", and leaves out skipped days.
  assert.deepEqual(repeatDates(rep("Daily", "2026-10-09"), "2026-10-07", "2026-10-10"), ["2026-10-09", "2026-10-10"]);
  assert.deepEqual(repeatDates(rep("Weekly", "2026-10-07", { until: "2026-10-21" }), "2026-10-01", "2026-12-31"), ["2026-10-07", "2026-10-14", "2026-10-21"]);
  assert.deepEqual(repeatDates(rep("Daily", "2026-10-07", { skip: ["2026-10-08"] }), "2026-10-07", "2026-10-09"), ["2026-10-07", "2026-10-09"]);
  // Not repeating, or a rhythm the Hub does not know: nothing.
  assert.deepEqual(repeatDates({ date: "2026-10-07" }, "2026-10-01", "2026-10-31"), []);
  assert.deepEqual(repeatDates(rep("Fortnightly-ish", "2026-10-07"), "2026-10-01", "2026-10-31"), []);
  // Years of a daily event are worked out only for the window asked for.
  assert.deepEqual(repeatDates(rep("Daily", "2015-01-01"), "2026-10-07", "2026-10-08"), ["2026-10-07", "2026-10-08"]);
  assert.equal(repeatText(rep("Weekly", "2026-10-07")), "Every week");
  assert.match(repeatText(rep("Weekdays", "2026-10-07", { until: "2026-12-18" })), /^Every weekday until /);
});

test("on the calendar a repeating event is one event per day, each with its own check mark", () => {
  const events = [ev("one", "Assembly", "2026-10-09", "09:00"), ev("wk", "Staff meeting", "2026-09-02", "14:30", "15:15", { repeat: "Weekly", doneOn: ["2026-10-07"], skip: ["2026-10-14"] })];
  const drawn = expandEvents(events, "2026-10-01", "2026-10-31");
  assert.equal(drawn[0], events[0], "a plain event is passed through untouched");
  assert.deepEqual(drawn.slice(1).map((e) => [e.id, e.date, e.done, e.seriesId]), [
    ["wk~2026-10-07", "2026-10-07", true, "wk"],
    ["wk~2026-10-21", "2026-10-21", undefined, "wk"],
    ["wk~2026-10-28", "2026-10-28", undefined, "wk"],
  ]);
  assert.deepEqual([drawn[1].title, drawn[1].start, drawn[1].end, drawn[1].repeat, "skip" in drawn[1], "doneOn" in drawn[1]], ["Staff meeting", "14:30", "15:15", "Weekly", false, false]);
  assert.deepEqual(occurrenceOf("wk~2026-10-07"), { eventId: "wk", date: "2026-10-07" });
  assert.deepEqual(occurrenceOf("plain-id"), { eventId: "plain-id", date: "" });
  assert.equal(occurrenceId("wk", "2026-10-07"), "wk~2026-10-07");
  assert.equal(savedEvent({ events }, drawn[1]), events[1]);
  assert.equal(savedEvent({ events }, events[0]), events[0]);
});

test("one day of a repeating event can be checked off, removed or moved without touching the rest", () => {
  const start = normalizeWorkspace({ events: [ev("wk", "Staff meeting", "2026-10-07", "14:30", "15:15", { repeat: "Weekly", location: "Library" })] });
  // Done: through the same call the calendar uses for any event.
  const done = setEventDone(start, "wk~2026-10-14", true);
  assert.deepEqual(done.events[0].doneOn, ["2026-10-14"]);
  assert.equal(expandEvents(done.events, "2026-10-07", "2026-10-21").map((e) => !!e.done).join(), "false,true,false");
  assert.equal("doneOn" in setEventDone(done, "wk~2026-10-14", false).events[0], false);
  assert.equal(setOccurrenceDone(start, "gone", "2026-10-14", true), start);
  // Delete just this one, and put it back.
  const skipped = skipOccurrence(start, "wk", "2026-10-14");
  assert.deepEqual(expandEvents(skipped.events, "2026-10-07", "2026-10-21").map((e) => e.date), ["2026-10-07", "2026-10-21"]);
  assert.deepEqual(unskipOccurrence(skipped, "wk", "2026-10-14").events, start.events);
  // Snooze just this one: it becomes a one-time event, and the rhythm carries on without that day.
  const day = expandEvents(start.events, "2026-10-07", "2026-10-07")[0];
  const moved = snoozeEvent(start, day.id, "tomorrow", now, { event: day, makeId: ids() });
  assert.deepEqual(moved.events[0].skip, ["2026-10-07"]);
  assert.deepEqual(moved.events[1], { id: "new1", title: "Staff meeting", date: "2026-10-08", start: "14:30", end: "15:15", location: "Library", notes: "" });
  assert.deepEqual(expandEvents(moved.events, "2026-10-07", "2026-10-14").map((e) => [e.title, e.date].join(" ")), ["Staff meeting 2026-10-14", "Staff meeting 2026-10-08"]);
  assert.equal(moveOccurrence(start, "gone", "2026-10-07", { date: "2026-10-08", start: "", end: "" }, ids()).newId, null);
  assert.equal(start.events.length, 1, "the workspace handed in is not changed");
});

test("the pop-up sets how an event repeats, and an edit changes every one", () => {
  const form = { kind: "event" as const, title: "Staff meeting", date: "2026-10-07", start: "14:30", end: "15:15", location: "", alsoRemind: false };
  assert.deepEqual(quickItems({ ...form, repeat: "Weekly", until: "2026-12-16" })?.event, { title: "Staff meeting", date: "2026-10-07", start: "14:30", end: "15:15", location: "", notes: "", repeat: "Weekly", until: "2026-12-16" });
  assert.equal("repeat" in quickItems({ ...form, repeat: "" })!.event!, false);
  assert.equal("repeat" in quickItems({ ...form, repeat: "Hourly" })!.event!, false, "only rhythms the Hub knows");
  assert.equal("until" in quickItems({ ...form, repeat: "Weekly", until: "2026-10-01" })!.event!, false, "an end before the start is dropped");
  assert.equal("until" in quickItems({ ...form, repeat: "", until: "2026-12-16" })!.event!, false);
  assert.equal(quickItems({ ...form, repeat: "Weekly", alsoRemind: true })?.task?.title, "Staff meeting (2:30 PM)");

  const start = normalizeWorkspace({ events: [ev("wk", "Staff meeting", "2026-10-07", "14:30", "15:15", { repeat: "Weekly", skip: ["2026-10-14"], doneOn: ["2026-10-07"] })] });
  const edit = { title: "Team meeting", date: "2026-10-07", start: "15:00", end: "15:45", location: "Room 4", notes: "", repeat: "Weekly", until: "" };
  const renamed = updateEvent(start, "wk", edit).events[0];
  assert.deepEqual(renamed, { id: "wk", title: "Team meeting", date: "2026-10-07", start: "15:00", end: "15:45", location: "Room 4", notes: "", repeat: "Weekly", skip: ["2026-10-14"], doneOn: ["2026-10-07"] }, "same first day: its skipped and done days are kept");
  const shifted = updateEvent(start, "wk", { ...edit, date: "2026-10-08" }).events[0];
  assert.equal("skip" in shifted || "doneOn" in shifted, false, "a new first day starts it fresh");
  const once = updateEvent(start, "wk", { ...edit, repeat: "" }).events[0];
  assert.deepEqual(once, { id: "wk", title: "Team meeting", date: "2026-10-07", start: "15:00", end: "15:45", location: "Room 4", notes: "" }, "Does not repeat: one plain event again");
  const made = updateEvent(normalizeWorkspace({ events: [ev("a", "Duty", "2026-10-07", "07:45", "", { done: true })] }), "a", { title: "Duty", date: "2026-10-07", start: "07:45", end: "", location: "", notes: "", repeat: "Weekdays", until: "2026-10-30" }).events[0];
  assert.deepEqual(made, { id: "a", title: "Duty", date: "2026-10-07", start: "07:45", end: "", location: "", notes: "", repeat: "Weekdays", until: "2026-10-30" }, "a plain event can be made to repeat; its own check mark gives way to per-day ones");
  assert.equal(eventEdit({ ...edit, title: " " }), null);
});

test("repeating events get reminders but are not asked about", () => {
  const ws = normalizeWorkspace({ events: [ev("wk", "Staff meeting", "2026-09-30", "14:30", "15:15", { repeat: "Weekly" }), ev("old", "Parent call", "2026-10-05", "15:00")] });
  const at = Date.parse("2026-10-07T20:20:00Z"); // 2:20 PM in Denver on a Wednesday
  assert.deepEqual(dueHubReminders(ws, at, "America/Denver").map((r) => [r.key, r.title]), [["event:wk~2026-10-07:2026-10-07:14:30", "Staff meeting"]]);
  assert.deepEqual(dueHubReminders(ws, at + 86_400_000, "America/Denver"), [], "not on Thursday");
  assert.deepEqual(dueHubReminders(setEventDone(ws, "wk~2026-10-07", true), at, "America/Denver"), [], "not once that day is checked off");
  assert.deepEqual(needsCheck(calendarEvents(ws, "2026-09-23", "2026-10-21"), now).map((e) => e.id), ["old"], "a weekly routine is not turned into a list of questions");
});

test("an event that is not the teacher's can be hidden, one day or every one, and shown again", () => {
  const start = normalizeWorkspace({
    events: [
      ev("a1", "Ari: parallel play", "2026-10-07", "10:00", "11:00", { calendarId: "home" }),
      ev("a2", "ari:  Parallel Play", "2026-10-14", "10:00", "11:00", { calendarId: "home" }),
      ev("d", "Dentist", "2026-10-07", "16:00", "", { calendarId: "home" }),
      ev("wk", "Staff meeting", "2026-10-07", "14:30", "15:15", { repeat: "Weekly" }),
    ],
    calendars: [{ id: "home", name: "Family", url: "https://example.com/f.ics", syncedAt: "2026-10-07T00:00:00.000Z" }],
  });
  const shown = (w: Workspace) => calendarEvents(w, "2026-10-07", "2026-10-14").map((e) => e.id);
  assert.deepEqual(shown(start), ["a1", "a2", "d", "wk~2026-10-07", "wk~2026-10-14"]);
  const one = hideEvent(start, start.events[0], "one", ids());
  assert.deepEqual(one.workspace.hiddenEvents, [{ id: "new1", title: "Ari: parallel play", date: "2026-10-07", start: "10:00" }]);
  assert.deepEqual(shown(one.workspace), ["a2", "d", "wk~2026-10-07", "wk~2026-10-14"], "just that day");
  const all = hideEvent(one.workspace, start.events[0], "all", ids());
  assert.deepEqual(all.workspace.hiddenEvents, [{ id: "new1", title: "Ari: parallel play", date: "", start: "" }], "every one replaces the single-day rule");
  assert.deepEqual(shown(all.workspace), ["d", "wk~2026-10-07", "wk~2026-10-14"], "by name, whatever the capitals and spaces, and it will still match after the calendar is read again");
  assert.equal(all.workspace.events, start.events, "nothing is deleted");
  assert.equal(hideEvent(all.workspace, start.events[1], "all", ids()).workspace, all.workspace, "hiding it twice adds nothing");
  // One day of a repeating event can be hidden too.
  const day = hideEvent(start, { title: "Staff meeting", date: "2026-10-14", start: "14:30" }, "one", ids()).workspace;
  assert.deepEqual(shown(day), ["a1", "a2", "d", "wk~2026-10-07"]);
  // Hidden events send no reminder and are not in the morning count.
  const hidDentist = hideEvent(start, start.events[2], "all", ids()).workspace;
  const beforeDentist = Date.parse("2026-10-07T21:50:00Z"); // 3:50 PM in Denver
  assert.deepEqual(dueHubReminders(start, beforeDentist, "America/Denver").map((r) => r.title), ["Dentist"]);
  assert.deepEqual(dueHubReminders(hidDentist, beforeDentist, "America/Denver"), []);
  const morning = (w: Workspace) => dueHubReminders(w, Date.parse("2026-10-07T14:00:00Z"), "America/Denver")[0].body;
  assert.match(morning(start), /^3 events\./); assert.match(morning(all.workspace), /^2 events\./);
  // Shown again, and saved with the workspace.
  assert.deepEqual(shown(showAgain(all.workspace, "new1")), shown(start));
  assert.equal(showAgain(start, "nope"), start);
  assert.deepEqual(normalizeWorkspace(JSON.parse(JSON.stringify(all.workspace))).hiddenEvents, all.workspace.hiddenEvents);
  assert.deepEqual(normalizeWorkspace({ hiddenEvents: [{ id: "x" }, null, "junk", { id: "y", title: "Ok" }] }).hiddenEvents, [{ id: "y", title: "Ok", date: "", start: "" }], "a damaged list is cleaned up");
  assert.equal(isHidden({ title: "Anything", date: "2026-10-07", start: "" }, undefined), false);
});

test("to-dos: notes, and clearing finished ones with a way back", () => {
  const t = (id: string, title: string, more: Partial<Task> = {}): Task => ({ id, title, dueDate: "", recurring: "", done: false, ...more });
  const start = [t("a", "Open one"), t("b", "Done one", { done: true }), t("c", "Another open"), t("d", "Done two", { done: true, priority: "high" })];
  const noted = saveTask(start, "a", { title: "Open one", dueDate: "", recurring: "", priority: false, notes: "  Ask for the blue forms\n555-0100 " }, ids());
  assert.equal(noted[0].notes, "Ask for the blue forms\n555-0100");
  assert.equal("notes" in saveTask(noted, "a", { title: "Open one", dueDate: "", recurring: "", priority: false, notes: "  " }, ids())[0], false, "emptied notes are removed");
  assert.equal(saveTask(start, null, { title: "New", dueDate: "", recurring: "", priority: false, notes: "x".repeat(1500) }, ids())[4].notes?.length, 1000);
  const cleared = clearDone(start);
  assert.deepEqual(cleared.tasks.map((x) => x.id), ["a", "c"]);
  assert.deepEqual(cleared.cleared.map((x) => [x.task.id, x.index]), [["b", 1], ["d", 3]]);
  assert.deepEqual(restoreTasks(cleared.tasks, cleared.cleared), start, "Undo puts them back where they were");
  assert.deepEqual(restoreTasks([...cleared.tasks, t("e", "Added since")], cleared.cleared).map((x) => x.id), ["a", "b", "c", "d", "e"]);
  assert.equal(restoreTasks(start, cleared.cleared), start, "ones already back are left alone");
  const none = [t("a", "Open one")];
  assert.equal(clearDone(none).tasks, none);
});

test("the screens carry all of it, Home included", () => {
  const cal = read("client/src/components/teacher-hub/HubCalendar.tsx"), page = read("client/src/pages/TeacherHub.tsx"), modal = read("client/src/components/teacher-hub/HubTaskEdit.tsx"), poll = read("client/src/components/teacher-hub/HubMeetingPoll.tsx");
  for (const part of ['data-testid="event-repeat"', "EVENT_REPEATS.map", 'data-testid="event-hide"', 'data-testid="hidden-events"', "Every one with this name", "Just this one", "All of them", "calendarEvents(workspace, span.from, span.to)", 'aria-label="Previous day"', 'aria-label="Next day"', "moveOccurrence(p, seriesId, date, to, () => newId)"]) assert.ok(cal.includes(part), part);
  assert.ok(!/openRanges\(workday, workspace\.events/.test(cal), "free time is worked out without hidden events and with repeating ones");
  assert.ok(poll.includes("calendarEvents(workspace, today, addDays(today, 120))"), "meeting suggestions too");
  for (const part of ['data-testid="home-task-add"', 'data-testid="home-tasks-all"', 'data-testid="clear-done"', "function TaskRow(", "onToggle={checkTask}", "restoreTasks(p.tasks, cleared)"]) assert.ok(page.includes(part), part);
  assert.equal(page.split("<TaskRow ").length - 1, 2, "the same to-do row on Home and in Reminders & to-dos");
  for (const part of ['data-testid="task-delete"', 'label="Notes"']) assert.ok(modal.includes(part), part);
});
