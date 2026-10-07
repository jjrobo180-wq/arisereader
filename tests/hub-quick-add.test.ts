// Teacher Hub: the quick "add" pop-up adds an event, a reminder, or both.
// Run with: npx tsx --test tests/hub-quick-add.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeWorkspace } from "../shared/teacherHub";
import { dueHubReminders } from "../shared/hubReminders";
import { arrangeTasks } from "../shared/hubTasks";
import { QUICK_TITLE_MAX, addQuickItems, quickAddedMessage, quickItems, type QuickForm } from "../shared/hubQuickAdd";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const form = (change: Partial<QuickForm> = {}): QuickForm => ({ kind: "event", title: "Staff meeting", date: "2026-10-08", start: "", end: "", location: "", alsoRemind: false, ...change });
const ids = () => { let n = 0; return () => `id${++n}`; };

test("an event is still added the way it was", () => {
  assert.deepEqual(quickItems(form({ title: "  Staff meeting ", start: "14:30", end: "15:15", location: " Library " })), {
    event: { title: "Staff meeting", date: "2026-10-08", start: "14:30", end: "15:15", location: "Library", notes: "" },
  });
  assert.deepEqual(quickItems(form({ end: "15:15" }))?.event, { title: "Staff meeting", date: "2026-10-08", start: "", end: "", location: "", notes: "" }, "no start time means all day, so the end is dropped");
  assert.equal(quickItems(form({ title: "   " })), null, "it needs a name");
  assert.equal(quickItems(form({ date: "" })), null, "an event needs a day");
  assert.equal(quickItems(form({ date: "next week" })), null);
});

test("a reminder goes to Reminders & to-dos, with or without a due date", () => {
  assert.deepEqual(quickItems(form({ kind: "reminder", title: " Call Maya's mom ", start: "09:00", location: "Room 4", alsoRemind: true })), {
    task: { title: "Call Maya's mom", dueDate: "2026-10-08", recurring: "", done: false },
  }, "the event boxes are left out, and nothing goes on the calendar");
  assert.deepEqual(quickItems(form({ kind: "reminder", date: "" })), { task: { title: "Staff meeting", dueDate: "", recurring: "", done: false } }, "no date is fine for a reminder");
  assert.equal(quickItems(form({ kind: "reminder", title: "" })), null);
  assert.equal(quickItems(form({ kind: "reminder", title: "x".repeat(QUICK_TITLE_MAX + 50) }))?.task?.title.length, QUICK_TITLE_MAX);
});

test("an event can be added to reminders as well", () => {
  assert.deepEqual(quickItems(form({ alsoRemind: true })), {
    event: { title: "Staff meeting", date: "2026-10-08", start: "", end: "", location: "", notes: "" },
    task: { title: "Staff meeting", dueDate: "2026-10-08", recurring: "", done: false },
  });
  const timed = quickItems(form({ alsoRemind: true, start: "14:30", end: "15:15" }));
  assert.equal(timed?.event?.title, "Staff meeting");
  assert.equal(timed?.task?.title, "Staff meeting (2:30 PM)", "a to-do has no time of its own, so the time rides in its name");
  assert.equal(timed?.task?.dueDate, "2026-10-08");
});

test("what was added lands in the workspace, and nothing else moves", () => {
  const start = normalizeWorkspace({
    events: [{ id: "e1", title: "Assembly", date: "2026-10-07", start: "", end: "", location: "", notes: "" }],
    tasks: [{ id: "t1", title: "Order markers", dueDate: "", recurring: "", done: false }],
  });
  const both = addQuickItems(start, quickItems(form({ alsoRemind: true, start: "14:30" }))!, ids());
  assert.deepEqual(both.events.map((e) => [e.id, e.title, e.date, e.start]), [["e1", "Assembly", "2026-10-07", ""], ["id1", "Staff meeting", "2026-10-08", "14:30"]]);
  assert.deepEqual(both.tasks.map((t) => [t.id, t.title, t.dueDate, t.done]), [["t1", "Order markers", "", false], ["id2", "Staff meeting (2:30 PM)", "2026-10-08", false]]);
  assert.equal(start.events.length, 1, "the workspace handed in is not changed");
  assert.equal(start.tasks.length, 1);

  const onlyReminder = addQuickItems(start, quickItems(form({ kind: "reminder" }))!, ids());
  assert.equal(onlyReminder.events, start.events, "a reminder puts nothing on the calendar");
  assert.deepEqual(onlyReminder.tasks[1], { id: "id1", title: "Staff meeting", dueDate: "2026-10-08", recurring: "", done: false });
  const onlyEvent = addQuickItems(start, quickItems(form())!, ids());
  assert.equal(onlyEvent.tasks, start.tasks, "an event alone leaves the to-dos alone");
  assert.equal(onlyEvent.students, start.students);

  // The reminder behaves like any other to-do: it survives a save and load, sorts by its due date, and is in the morning summary.
  const saved = normalizeWorkspace(JSON.parse(JSON.stringify(onlyReminder)));
  assert.deepEqual(saved.tasks[1], onlyReminder.tasks[1]);
  assert.deepEqual(arrangeTasks(saved.tasks, "open", "due").map((t) => t.title), ["Staff meeting", "Order markers"]);
  const morning = dueHubReminders(saved, Date.parse("2026-10-08T15:00:00Z"), "America/Denver");
  assert.deepEqual(morning.map((r) => r.body), ["1 task."]);
});

test("the teacher is told where it went", () => {
  assert.equal(quickAddedMessage({ task: { title: "A", dueDate: "", recurring: "", done: false } }), "Added to Reminders & to-dos.");
  assert.equal(quickAddedMessage(quickItems(form({ alsoRemind: true }))!), "Added to your calendar and to Reminders & to-dos.");
  assert.equal(quickAddedMessage(quickItems(form())!), "Added to your calendar.");
});

test("the pop-up on every screen offers the reminder", () => {
  const popUp = read("client/src/components/teacher-hub/HubCalendar.tsx"), page = read("client/src/pages/TeacherHub.tsx");
  for (const part of ['data-testid="quick-add-kind"', '["reminder", "Reminder", Bell]', 'data-testid="quick-add-also-remind"', "Also add it to Reminders & to-dos", "quickItems(form)", "onAdd={addQuick}"]) assert.ok(popUp.includes(part), part);
  for (const part of ['data-testid="quick-add-event"', "addQuickItems(p, items, id)", 'run: () => setTab("tasks")', "onReminderAdded={reminderAdded}"]) assert.ok(page.includes(part), part);
  assert.equal(page.split("onReminderAdded={reminderAdded}").length - 1, 2, "the calendar on Home and on the Calendar tab both say where a reminder went");
});
