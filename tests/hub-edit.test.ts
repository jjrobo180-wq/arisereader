// Teacher Hub: changing an event or a to-do that is already there, without deleting it.
// Run with: npx tsx --test tests/hub-edit.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeWorkspace, type Workspace } from "../shared/teacherHub";
import { eventEdit, updateEvent, type EventEdit } from "../shared/hubQuickAdd";
import { resolvePins } from "../shared/hubPins";
import { saveTask, toggleTask } from "../shared/hubTasks";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const ids = () => { let n = 0; return () => `new${++n}`; };

function hub(): Workspace {
  return normalizeWorkspace({
    events: [
      { id: "e1", title: "Staff meeting", date: "2026-10-08", start: "14:30", end: "15:15", location: "Library", notes: "Bring laptop" },
      { id: "e2", title: "Assembly", date: "2026-10-09", start: "", end: "", location: "", notes: "" },
      { id: "g1", title: "District PD", date: "2026-10-10", start: "08:00", end: "", location: "", notes: "", calendarId: "cal1" },
    ],
    calendars: [{ id: "cal1", name: "Work", url: "https://example.com/a.ics", syncedAt: "2026-10-07T00:00:00.000Z" }],
    tasks: [
      { id: "t1", title: "Order markers", dueDate: "2026-10-08", recurring: "Weekly", done: false, priority: "high", lastDone: "2026-10-01" },
      { id: "t2", title: "Call Maya's mom", dueDate: "", recurring: "", done: true },
    ],
    pins: [{ id: "p1", kind: "event", refId: "e1", color: "#0f766e", label: "", snap: { title: "Staff meeting", date: "2026-10-08", start: "14:30" } }],
  });
}
const edit = (change: Partial<EventEdit> = {}): EventEdit => ({ title: "Staff meeting", date: "2026-10-08", start: "14:30", end: "15:15", location: "Library", notes: "Bring laptop", ...change });

test("an event is changed in place", () => {
  const start = hub();
  const next = updateEvent(start, "e1", edit({ title: "  Staff meeting (moved) ", date: "2026-10-12", start: "15:00", end: "15:45", location: " Room 4 ", notes: " Bring laptop and charger " }));
  assert.deepEqual(next.events[0], { id: "e1", title: "Staff meeting (moved)", date: "2026-10-12", start: "15:00", end: "15:45", location: "Room 4", notes: "Bring laptop and charger" });
  assert.equal(next.events.length, 3, "nothing is added or removed");
  assert.equal(next.events[1], start.events[1], "other events are untouched");
  assert.equal(next.tasks, start.tasks);
  assert.equal(start.events[0].title, "Staff meeting", "the workspace handed in is not changed");
  // Taking the time off makes it an all-day event.
  assert.deepEqual(updateEvent(start, "e1", edit({ start: "", end: "15:15" })).events[0], { ...start.events[0], start: "", end: "" });
});

test("a pinned event stays pinned after it is changed", () => {
  const next = updateEvent(hub(), "e1", edit({ title: "Team meeting", date: "2026-10-12", start: "15:00" }));
  assert.deepEqual(next.pins[0].snap, { title: "Team meeting", date: "2026-10-12", start: "15:00" });
  const shown = resolvePins(next);
  assert.equal(shown.length, 1);
  assert.equal(shown[0].title, "Team meeting");
});

test("an edit that would lose the event is not saved", () => {
  const start = hub();
  assert.equal(eventEdit(edit({ title: "   " })), null);
  assert.equal(eventEdit(edit({ date: "" })), null);
  assert.equal(updateEvent(start, "e1", edit({ title: "" })), start, "no name: nothing changes");
  assert.equal(updateEvent(start, "e1", edit({ date: "" })), start, "no day: nothing changes");
  assert.equal(updateEvent(start, "gone", edit()), start);
  assert.equal(updateEvent(start, "g1", edit({ title: "Mine now" })), start, "a connected calendar's event is changed in that calendar, not here");
});

test("a to-do is changed in place and keeps its history", () => {
  const start = hub().tasks;
  const next = saveTask(start, "t1", { title: " Order markers and paper ", dueDate: "2026-10-15", recurring: "Monthly", priority: false }, ids());
  assert.deepEqual(next[0], { id: "t1", title: "Order markers and paper", dueDate: "2026-10-15", recurring: "Monthly", done: false, lastDone: "2026-10-01" }, "same to-do, and taking Important off removes the flag");
  assert.equal(next[1], start[1]);
  assert.equal(next.length, 2);
  const done = saveTask(start, "t2", { title: "Call Maya's mom back", dueDate: "2026-10-09", recurring: "", priority: true }, ids());
  assert.deepEqual(done[1], { id: "t2", title: "Call Maya's mom back", dueDate: "2026-10-09", recurring: "", done: true, priority: "high" }, "a finished to-do stays finished");
  assert.equal(start[0].title, "Order markers", "the list handed in is not changed");
  // It is still the same to-do afterwards: checking it off works as before.
  assert.equal(toggleTask(done, "t2", "2026-10-07").tasks[1].done, false);
});

test("a to-do edit with no name, or for a to-do that is gone, changes nothing; a new one is added at the end", () => {
  const start = hub().tasks;
  assert.equal(saveTask(start, "t1", { title: "  ", dueDate: "", recurring: "", priority: false }, ids()), start);
  assert.equal(saveTask(start, "gone", { title: "X", dueDate: "", recurring: "", priority: false }, ids()), start);
  assert.deepEqual(saveTask(start, null, { title: "New one", dueDate: "", recurring: "", priority: false }, ids())[2], { id: "new1", title: "New one", dueDate: "", recurring: "", done: false });
});

test("the screens offer Edit on events and to-dos", () => {
  const cal = read("client/src/components/teacher-hub/HubCalendar.tsx"), page = read("client/src/pages/TeacherHub.tsx"), modal = read("client/src/components/teacher-hub/HubTaskEdit.tsx");
  for (const part of ['data-testid="event-edit"', '"edit-event-form"', "updateEvent(p, editing.event.id, changes)", "Save changes", "onEdit={setEditing}"]) assert.ok(cal.includes(part), part);
  assert.equal(cal.split("onEdit={setEditing}").length - 1, 3, "the agenda, the month's day list and the timeline");
  for (const part of ['data-testid="task-edit"', 'data-testid="home-task-edit"', "saveTask(p.tasks, editing.id, fields, id)", "saveTask(p.tasks, homeTask, fields, id)"]) assert.ok(page.includes(part), part);
  for (const part of ['"Edit to-do"', "Save changes", "Mark as important"]) assert.ok(modal.includes(part), part);
});
