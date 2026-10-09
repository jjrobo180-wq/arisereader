// Teacher Hub: taking back a checked-off to-do (for a day) and a deleted calendar event (for a few seconds).
// Run with: npx tsx --test tests/hub-undo.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeWorkspace, type Task } from "../shared/teacherHub";
import { UNDO_TASK_MS, recentlyDone, saveTask, toggleTask, undoTask } from "../shared/hubTasks";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const task = (id: string, title: string, more: Partial<Task> = {}): Task => ({ id, title, dueDate: "", recurring: "", done: false, ...more });
const T = "2026-10-07";
const AT = "2026-10-07T15:48:00.000Z";
const ms = Date.parse(AT);
const HOUR = 60 * 60 * 1000;

test("a checked-off to-do remembers when, and can be undone for a day", () => {
  const start = [task("a", "Order markers", { dueDate: "2026-10-08", priority: "high" }), task("b", "Call Maya's mom")];
  const done = toggleTask(start, "a", T, AT).tasks;
  assert.deepEqual(done[0], { id: "a", title: "Order markers", dueDate: "2026-10-08", recurring: "", done: true, priority: "high", doneAt: AT });
  assert.equal(done[1], start[1]);
  assert.deepEqual(recentlyDone(done, ms + 10_000).map((t) => t.id), ["a"]);
  assert.deepEqual(recentlyDone(done, ms + 23 * HOUR).map((t) => t.id), ["a"], "still offered late the same day");
  assert.deepEqual(recentlyDone(done, ms + UNDO_TASK_MS), [], "after a day it is no longer offered");
  const back = undoTask(done, "a", ms + 23 * HOUR);
  assert.deepEqual(back[0], start[0], "exactly as it was: open, same due date, still important");
  assert.deepEqual(recentlyDone(back, ms + 10_000), []);
  assert.equal(start[0].done, false, "the list handed in is not changed");
  // Unchecking the box does the same thing.
  assert.deepEqual(toggleTask(done, "a", T, AT).tasks[0], start[0]);
  // Past the day it has left the "done in the last day" list, but it is not lost: it is in Done, and unchecking it works.
  assert.deepEqual(undoTask(done, "a", ms + 3 * UNDO_TASK_MS)[0], start[0]);
});

test("the newest check-off is listed first, and old or unstamped ones are not listed", () => {
  const tasks = [
    task("old", "Last week", { done: true, doneAt: "2026-09-30T15:00:00.000Z" }),
    task("plain", "Done before this existed", { done: true }),
    task("first", "First", { done: true, doneAt: "2026-10-07T09:00:00.000Z" }),
    task("second", "Second", { done: true, doneAt: "2026-10-07T15:00:00.000Z" }),
    task("open", "Still open", { doneAt: "2026-10-07T15:00:00.000Z" }),
    task("odd", "Bad stamp", { done: true, doneAt: "yesterday" }),
  ];
  assert.deepEqual(recentlyDone(tasks, ms).map((t) => t.id), ["second", "first"]);
  assert.deepEqual(normalizeWorkspace(JSON.parse(JSON.stringify({ tasks }))).tasks, tasks, "the stamps survive a save and load");
});

test("a repeating to-do that moved on can be put back for a day", () => {
  const start = [task("w", "Weekly report", { dueDate: "2026-10-05", recurring: "Weekly", lastDone: "2026-09-28" })];
  const rolled = toggleTask(start, "w", T, AT);
  assert.equal(rolled.rolledTo, "2026-10-12");
  assert.deepEqual(rolled.tasks[0], { id: "w", title: "Weekly report", dueDate: "2026-10-12", recurring: "Weekly", done: false, lastDone: T, rolled: { dueDate: "2026-10-05", lastDone: "2026-09-28", at: AT } });
  assert.deepEqual(recentlyDone(rolled.tasks, ms + HOUR).map((t) => t.id), ["w"]);
  assert.deepEqual(undoTask(rolled.tasks, "w", ms + HOUR), start, "back to the due date and last-done day it had");
  assert.equal(undoTask(rolled.tasks, "w", ms + UNDO_TASK_MS + 1), rolled.tasks, "after a day it stays on its new date");
  assert.deepEqual(recentlyDone(rolled.tasks, ms + UNDO_TASK_MS + 1), []);
  // One that had never been done before goes back without a last-done day.
  const fresh = [task("d", "Daily check", { recurring: "Daily" })];
  assert.deepEqual(undoTask(toggleTask(fresh, "d", T, AT).tasks, "d", ms + 1000), fresh);
  // Checking it off again replaces what it remembers.
  const twice = toggleTask(rolled.tasks, "w", "2026-10-12", "2026-10-12T15:00:00.000Z").tasks[0];
  assert.deepEqual(twice.rolled, { dueDate: "2026-10-12", lastDone: T, at: "2026-10-12T15:00:00.000Z" });
  // Editing its due date makes the old spot meaningless, so there is nothing to undo; a new name alone keeps it.
  const edited = saveTask(rolled.tasks, "w", { title: "Weekly report", dueDate: "2026-10-20", recurring: "Weekly", priority: false }, () => "x");
  assert.equal("rolled" in edited[0], false);
  const renamed = saveTask(rolled.tasks, "w", { title: "Weekly report (Mr. Lee)", dueDate: "2026-10-12", recurring: "Weekly", priority: false }, () => "x");
  assert.deepEqual(renamed[0].rolled, rolled.tasks[0].rolled);
});

test("undo leaves everything else alone", () => {
  const tasks = [task("a", "Open one"), task("b", "Done one", { done: true, doneAt: AT })];
  assert.equal(undoTask(tasks, "a", ms), tasks, "an open to-do has nothing to undo");
  assert.equal(undoTask(tasks, "gone", ms), tasks);
  assert.equal(undoTask(tasks, "b", ms + 1000)[0], tasks[0]);
  // Without a moment handed in (older callers), checking off still works; it just isn't listed.
  const plain = toggleTask(tasks, "a", T).tasks[0];
  assert.deepEqual(plain, { ...tasks[0], done: true });
});

test("the screens offer the undo", () => {
  const page = read("client/src/pages/TeacherHub.tsx"), parts = read("client/src/components/teacher-hub/HubTaskEdit.tsx"), cal = read("client/src/components/teacher-hub/HubCalendar.tsx");
  for (const part of ["onToggle={checkTask}", "<RecentlyDone tasks={workspace.tasks} onUndo={undoCheck} limit={4} />", "const toggle = taskChecker(() => workspace.tasks, setWorkspace, toast);", 'filter === "open" && !search.trim() && <RecentlyDone']) assert.ok(page.includes(part), part);
  for (const part of ['data-testid="recently-done"', 'data-testid="task-undo"', "Done in the last day", 'Checked off "${task.title}".', "toggleTask(p.tasks, task.id, today, at)"]) assert.ok(parts.includes(part), part);
  for (const part of ["export const UNDO_SECONDS = 10;", 'gone.repeat ? `Deleted every "${gone.title}".` : `Deleted "${gone.title}".`', "window.setTimeout(() => setMoved(null), UNDO_SECONDS * 1000)"]) assert.ok(cal.includes(part), part);
  assert.ok(/toasts\.show\(text, actions, records \? 15_000 : 10_000\)/.test(page), "other deletes keep their ten-second Undo");
});
