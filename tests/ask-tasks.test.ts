import test from "node:test";
import assert from "node:assert/strict";
import { openTasks, tasksFacts, wantsTasks } from "../shared/askTasks.ts";

test("@arise task questions are spotted", () => {
  assert.ok(wantsTasks("what tasks do i have left"));
  assert.ok(wantsTasks("what tasks do i have left on my task list"));
  assert.ok(wantsTasks("whats on my to do list"));
  assert.ok(!wantsTasks("what's the weather tomorrow"));
});

test("@arise lists the real unfinished To Do and WorkHub tasks", () => {
  const life = { lists: [{ id: "personal", name: "Personal" }], tasks: [
    { title: "Call mom", listId: "personal", due: "2026-11-23", time: "", done: false },
    { title: "Old thing", listId: "personal", due: "", done: true },
    { title: "Hidden", listId: "personal", due: "", done: false, archived: true },
  ] };
  const work = { tasks: [{ title: "Grade quizzes", dueDate: "2026-11-20", done: false }] };
  const t = openTasks(life, work);
  assert.deepEqual(t.map((x) => x.title), ["Grade quizzes", "Call mom"]);
  const f = tasksFacts(t, "2026-11-22");
  assert.match(f, /Grade quizzes \(due 2026-11-20, overdue\)/);
  assert.match(f, /Call mom \(due 2026-11-23\) \[Personal\]/);
  assert.match(tasksFacts([], "2026-11-22"), /caught up/);
});

test("the chat route adds the task lists when asked about tasks", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync("server/undercover.ts", "utf8");
  assert.match(src, /wantsTasks\(question\) && deps\.hubs/);
  assert.match(readFileSync("server/routes.ts", "utf8"), /registerUndercoverRoutes\(app, authMiddleware, \{\s*hubs:/);
});
