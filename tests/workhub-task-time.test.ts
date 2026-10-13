// WorkHub to-do due-time support and backwards compatibility.
// Run with npx tsx --test tests/workhub-task-time.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { arrangeTasks, saveTask, toggleTask, undoTask } from "../shared/hubTasks";
import type { Task } from "../shared/teacherHub";

const base: Task[] = [{ id: "old", title: "Existing no-time task", dueDate: "2026-10-16", recurring: "", done: false }];

test("saves a due time for a newly created task and preserves it through edits", () => {
  const created = saveTask(base, null, { title: "Call parent", dueDate: "2026-10-16", dueTime: "14:30", recurring: "", priority: false }, () => "new");
  assert.equal(created[0].dueTime, undefined);
  assert.equal(created[1].dueTime, "14:30");
  const edited = saveTask(created, "new", { title: "Call parent again", dueDate: "2026-10-16", dueTime: "15:05", recurring: "", priority: true }, () => "never");
  assert.equal(edited[1].dueTime, "15:05");
  assert.equal(edited[1].priority, "high");
});

test("clearing a due date removes its time; invalid times cannot be persisted", () => {
  const t = saveTask(base, null, { title: "Meeting prep", dueDate: "2026-10-16", dueTime: "09:00", recurring: "", priority: false }, () => "one");
  const clear = saveTask(t, "one", { title: "Meeting prep", dueDate: "", dueTime: "09:00", recurring: "", priority: false }, () => "never");
  assert.equal(clear[1].dueTime, undefined);
  const bad = saveTask(t, "one", { title: "Meeting prep", dueDate: "2026-10-16", dueTime: "25:99", recurring: "", priority: false }, () => "never");
  assert.equal(bad[1].dueTime, undefined);
});

test("due-date sorting uses the optional time, with tasks without times after timed tasks", () => {
  const tasks: Task[] = [
    ...base,
    { id: "later", title: "Later", dueDate: "2026-10-16", dueTime: "16:45", recurring: "", done: false },
    { id: "early", title: "Earlier", dueDate: "2026-10-16", dueTime: "08:15", recurring: "", done: false },
  ];
  assert.deepEqual(arrangeTasks(tasks, "all", "due").map((t) => t.id), ["early", "later", "old"]);
});

test("repeating to-dos keep their time and undo restores the prior date", () => {
  const task: Task = { id: "repeat", title: "Daily review", dueDate: "2026-10-12", dueTime: "10:00", recurring: "Daily", done: false };
  const rolled = toggleTask([task], "repeat", "2026-10-13", "2026-10-13T10:00:00Z");
  assert.equal(rolled.tasks[0].dueTime, "10:00");
  assert.equal(rolled.tasks[0].dueDate, "2026-10-14");
  const undone = undoTask(rolled.tasks, "repeat", Date.parse("2026-10-13T10:01:00Z"));
  assert.equal(undone[0].dueDate, "2026-10-12");
  assert.equal(undone[0].dueTime, "10:00");
});
