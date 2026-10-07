import test from "node:test";
import assert from "node:assert/strict";
import { addMonths, dueState, friendlyDate, relativeDays } from "../shared/hubDates";
import { arrangeTasks, nextDue, toggleTask } from "../shared/hubTasks";
import { bookMeeting, cleanSenderName, POLL_EVENT_NOTE } from "../shared/hubMeetings";
import { deleteRow, undoDelete } from "../shared/hubDelete";
import { emptyWorkspace, type Task } from "../shared/teacherHub";

const T = "2026-10-07";
const task = (id: string, title: string, dueDate = "", extra: Partial<Task> = {}): Task => ({ id, title, dueDate, recurring: "", done: false, ...extra });

test("friendly dates", () => {
  assert.equal(friendlyDate("2026-10-07", T), "Today");
  assert.equal(friendlyDate("2026-10-08", T), "Tomorrow");
  assert.equal(friendlyDate("2026-10-06", T), "Yesterday");
  assert.match(friendlyDate("2026-10-12", T), /Monday, Oct 12/);
  assert.match(friendlyDate("2026-12-25", T), /Fri, Dec 25/);
  assert.match(friendlyDate("2027-01-04", T), /2027/);
  assert.equal(dueState("2026-10-01", T), "overdue");
  assert.equal(dueState("2026-10-09", T), "soon");
  assert.equal(dueState("", T), "none");
  assert.equal(relativeDays("2026-10-12", T), "in 5 days");
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
});

test("to-dos sort by due date, importance, newest and name; done sinks", () => {
  const list = [task("a", "Zed", "2026-10-20"), task("b", "Alpha", "", { priority: "high" }), task("c", "Mid", "2026-10-08"), task("d", "Old", "2026-10-01", { done: true })];
  assert.deepEqual(arrangeTasks(list, "open", "due").map((t) => t.id), ["c", "a", "b"]);
  assert.deepEqual(arrangeTasks(list, "open", "priority").map((t) => t.id), ["b", "c", "a"]);
  assert.deepEqual(arrangeTasks(list, "open", "newest").map((t) => t.id), ["c", "b", "a"]);
  assert.deepEqual(arrangeTasks(list, "open", "name").map((t) => t.id), ["b", "c", "a"]);
  assert.deepEqual(arrangeTasks(list, "done", "due").map((t) => t.id), ["d"]);
  assert.deepEqual(arrangeTasks(list, "all", "due").map((t) => t.id), ["c", "a", "b", "d"]);
  assert.deepEqual(arrangeTasks(list, "all", "due", "al").map((t) => t.id), ["b"]);
});

test("a repeating to-do rolls forward instead of finishing", () => {
  assert.equal(nextDue("2026-10-05", "Weekly", T), "2026-10-12");
  assert.equal(nextDue("2026-10-01", "Daily", T), "2026-10-08");
  assert.equal(nextDue("", "Monthly", T), "2026-11-07");
  assert.equal(nextDue("2026-10-05", "", T), "");
  const rolled = toggleTask([task("w", "Weekly report", "2026-10-05", { recurring: "Weekly" })], "w", T);
  assert.equal(rolled.rolledTo, "2026-10-12");
  assert.equal(rolled.tasks[0].done, false);
  assert.equal(rolled.tasks[0].lastDone, T);
  const once = toggleTask([task("o", "One")], "o", T);
  assert.equal(once.rolledTo, null);
  assert.equal(once.tasks[0].done, true);
  assert.equal(toggleTask(once.tasks, "o", T).tasks[0].done, false);
});

test("booking a time keeps ONE calendar event, even when switched", () => {
  let n = 0;
  const id = () => `id${++n}`;
  let ws = emptyWorkspace();
  ws = { ...ws, meetings: [{ id: "m1", student: "Jordan", type: "Annual IEP", date: "", notes: "", done: false }], guides: [{ id: "g", student: "Jordan", kind: "IEP meeting", planningDate: "", meetingDate: "", meetingTime: "", room: "", parent1: "", parent1Phone: "", parent2: "", parent2Phone: "", team: {}, sections: [] }],
    events: [{ id: "old", title: "Annual IEP for Jordan", date: "2026-10-01", start: "09:00", end: "", location: "", notes: POLL_EVENT_NOTE }, { id: "mine", title: "Staff meeting", date: "2026-10-20", start: "", end: "", location: "", notes: "" }] };
  ws = bookMeeting(ws, "m1", { title: "Annual IEP for Jordan", location: "Room 4" }, { date: "2026-10-20", start: "10:00", end: "11:00" }, id);
  ws = bookMeeting(ws, "m1", { title: "Annual IEP for Jordan", location: "Room 4" }, { date: "2026-10-22", start: "13:00", end: "14:00" }, id);
  const linked = ws.events.filter((e) => e.meetingId === "m1");
  assert.equal(linked.length, 1);
  assert.equal(linked[0].date, "2026-10-22");
  assert.equal(ws.events.filter((e) => e.title === "Annual IEP for Jordan").length, 1);
  assert.ok(ws.events.some((e) => e.id === "mine"));
  assert.deepEqual([ws.meetings[0].date, ws.meetings[0].time, ws.meetings[0].room], ["2026-10-22", "13:00", "Room 4"]);
  assert.deepEqual([ws.guides[0].meetingDate, ws.guides[0].meetingTime, ws.guides[0].room], ["2026-10-22", "13:00", "Room 4"]);
  assert.deepEqual(ws.meetings[0].plan?.done, [2, 3]);
});

test("deleting a meeting takes its calendar event, and undo brings both back", () => {
  let ws = emptyWorkspace();
  ws = { ...ws, meetings: [{ id: "m1", student: "A", type: "IEP", date: "2026-10-20", notes: "", done: false }], events: [{ id: "e1", title: "x", date: "2026-10-20", start: "", end: "", location: "", notes: "", meetingId: "m1" }, { id: "e2", title: "y", date: "2026-10-20", start: "", end: "", location: "", notes: "" }] };
  const r = deleteRow(ws, "meetings", "m1")!;
  assert.deepEqual(r.workspace.events.map((e) => e.id), ["e2"]);
  assert.deepEqual(undoDelete(r.workspace, r.deleted).events.map((e) => e.id).sort(), ["e1", "e2"]);
});

test("the sender name drops (Admin)", () => {
  assert.equal(cleanSenderName("Jermaine Robinson (Admin)"), "Jermaine Robinson");
  assert.equal(cleanSenderName("Pat Lee"), "Pat Lee");
});
