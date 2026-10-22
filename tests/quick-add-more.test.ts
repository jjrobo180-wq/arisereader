import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { saveTask } from "../shared/hubTasks";

const hub = readFileSync(new URL("../client/src/pages/TeacherHub.tsx", import.meta.url), "utf8");

test("both WorkHub quick adds have a More button that opens the full form with what was typed", () => {
  assert.match(hub, /onClick=\{\(\) => setHomeTask\(NEW_TASK\)\}[^\n]*data-testid="home-task-more"/);
  assert.match(hub, /onClick=\{\(\) => setEditing\(\{ id: null \}\)\}[^\n]*data-testid="tasks-quick-more"/);
  assert.match(hub, /homeTask === NEW_TASK && <TaskModal task=\{null\} startTitle=\{homeQuick\}/);
  // Saving a new one from More clears the box it was typed in.
  assert.match(hub, /if \(!editing\.id\) setQuick\(""\)/);
});

test("the full form keeps due date, time, notes, repeat and importance", () => {
  let n = 0;
  const [t] = saveTask([], null, { title: " Call Ms. Diaz ", dueDate: "2026-10-20", dueTime: "15:30", recurring: "weekly", priority: true, notes: "About the field trip" }, () => `t${++n}`);
  assert.deepEqual({ ...t }, { id: "t1", title: "Call Ms. Diaz", dueDate: "2026-10-20", dueTime: "15:30", recurring: "weekly", priority: "high", notes: "About the field trip", done: false });
});
