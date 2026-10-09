// Run with: npx tsx --test tests/apple-reminders.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { cleanReminders, mergeReminders, parseDue } from "../shared/appleReminders";

test("dates come in however a Shortcut writes them", () => {
  assert.equal(parseDue("2026-10-12T09:00:00-06:00"), "2026-10-12");
  assert.equal(parseDue("10/12/2026, 9:00 AM"), "2026-10-12");
  assert.equal(parseDue("Oct 12, 2026 at 9:00 AM"), "2026-10-12");
  assert.equal(parseDue("12 October 2026"), "2026-10-12");
  assert.equal(parseDue("2026-02-31"), "");
  assert.equal(parseDue("someday"), "");
});

test("a send can be JSON, a bare list, or lines of text; bad rows are dropped", () => {
  assert.equal(cleanReminders({ reminders: [{ title: "Call Ms. Lee", due: "2026-10-12", id: "a1" }, { title: "" }, { title: "Call Ms. Lee", id: "a1" }] }).length, 1);
  assert.equal(cleanReminders([{ title: "One" }, { name: "Two" }]).length, 2);
  const lines = cleanReminders("Copy packets | 2026-10-09\nBook room\n\n");
  assert.deepEqual(lines.map((r) => [r.title, r.due]), [["Copy packets", "2026-10-09"], ["Book room", ""]]);
  assert.equal(cleanReminders("Pick up forms | 10/09/2026 | Yes")[0].done, true);
  assert.equal(cleanReminders("Pick up forms | 10/09/2026 | No")[0].done, false);
  assert.equal(cleanReminders(null).length, 0);
  assert.equal(cleanReminders({ title: "Single" }).length, 1);
  assert.equal(cleanReminders({ reminders: [{ title: "Done one", completed: "true" }] })[0].done, true);
});

test("new reminders are added once; later sends update them and check them off", () => {
  let n = 0; const id = () => `t${++n}`;
  const first = mergeReminders([], cleanReminders({ reminders: [{ title: "Copy packets", due: "2026-10-09", id: "r1" }] }), id, "2026-10-08");
  assert.equal(first.added, 1);
  assert.equal(first.tasks[0].dueDate, "2026-10-09");
  const again = mergeReminders(first.tasks, cleanReminders({ reminders: [{ title: "Copy packets", due: "2026-10-09", id: "r1" }] }), id, "2026-10-08");
  assert.deepEqual([again.added, again.updated, again.tasks.length], [0, 0, 1]);
  const moved = mergeReminders(first.tasks, cleanReminders({ reminders: [{ title: "Copy packets (red folder)", due: "2026-10-12", id: "r1", completed: true }] }), id, "2026-10-08");
  assert.equal(moved.updated, 1);
  assert.deepEqual([moved.tasks[0].title, moved.tasks[0].dueDate, moved.tasks[0].done], ["Copy packets (red folder)", "2026-10-12", true]);
});
