import test from "node:test";
import assert from "node:assert/strict";
import { nextDue, renameTaskList, repeatDays, repeatLabel, toggleTask, weekdayRepeat } from "../shared/hubTasks";
import { lifeTasksFromWork, lifeTasksToWork } from "../shared/hubSwap";

test("weekday repeats: encode, read, label", () => {
  assert.equal(weekdayRepeat([5, 1, 3, 3]), "Days:1,3,5");
  assert.deepEqual(repeatDays("Days:1,3,5"), [1, 3, 5]);
  assert.deepEqual(repeatDays("Weekly"), []);
  assert.equal(repeatLabel("Days:1,3,5"), "Mon, Wed, Fri");
  assert.equal(repeatLabel("Days:1,2,3,4,5"), "Weekdays");
  assert.equal(repeatLabel("Daily"), "Daily");
});

test("next due lands on the next chosen weekday after today", () => {
  // 2026-11-16 is a Monday
  assert.equal(nextDue("2026-11-16", "Days:1,3,5", "2026-11-16"), "2026-11-18");
  assert.equal(nextDue("2026-11-18", "Days:1,3,5", "2026-11-18"), "2026-11-20");
  assert.equal(nextDue("2026-11-20", "Days:1,3,5", "2026-11-20"), "2026-11-23");
  assert.equal(nextDue("2026-11-10", "Days:2", "2026-11-16"), "2026-11-17");
});

test("checking off rolls to the next chosen day", () => {
  const r = toggleTask([{ id: "a", title: "x", dueDate: "2026-11-16", recurring: "Days:1,3,5", done: false }], "a", "2026-11-16");
  assert.equal(r.rolledTo, "2026-11-18");
});

test("weekday repeat survives To Duo's own task shape", () => {
  const work = [{ id: "a", title: "x", dueDate: "2026-11-16", recurring: "Days:1,3,5", done: false }];
  const life = lifeTasksFromWork([], work, "l1", "now");
  assert.equal(life[0].repeat, "weekly");
  assert.equal(life[0].repeatDays, "Days:1,3,5");
  assert.equal(lifeTasksToWork(life)[0].recurring, "Days:1,3,5");
});

test("rename a list", () => {
  const w = { taskLists: [{ id: "1", name: "Copies", color: "#fff" }, { id: "2", name: "IEP", color: "#000" }] };
  assert.equal(renameTaskList(w, "1", "Copies & prep").taskLists[0].name, "Copies & prep");
  assert.equal(renameTaskList(w, "1", "iep"), w);
  assert.equal(renameTaskList(w, "1", "  "), w);
});
