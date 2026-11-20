import test from "node:test";
import assert from "node:assert/strict";
import type { KitRecord } from "../shared/pluginKit";
import { cleanKit } from "../shared/pluginKit";
import {
  addDays, addTask, applyTemplate, carryOffer, carryUnfinished, clearWeek, copyWeek, editTask, mondayOf, moveTask,
  saveTemplate, skipOffer, tasksOn, templates, weekCounts, weekDays,
} from "../shared/weekPlanner";

let n = 0;
const id = () => `id${++n}`;
const titles = (all: KitRecord[], day: string) => tasksOn(all, day).map((r) => r.data.t);
const MON = "2026-11-16";

test("weeks run Monday to Friday; weekends look ahead", () => {
  assert.equal(mondayOf("2026-11-19"), MON);
  assert.equal(mondayOf(MON), MON);
  assert.equal(mondayOf("2026-11-21"), "2026-11-23"); // Saturday
  assert.equal(mondayOf("2026-11-22"), "2026-11-23"); // Sunday
  assert.deepEqual(weekDays(MON), ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("tasks are added in order, ticked off, and dragged to another day or spot", () => {
  let all: KitRecord[] = [];
  all = addTask(all, MON, "Grade quizzes", id);
  all = addTask(all, MON, "Email parents", id);
  all = addTask(all, "2026-11-17", "IEP meeting", id);
  assert.deepEqual(titles(all, MON), ["Grade quizzes", "Email parents"]);
  const email = tasksOn(all, MON)[1].id;
  all = moveTask(all, email, "2026-11-17", tasksOn(all, "2026-11-17")[0].id);
  assert.deepEqual(titles(all, "2026-11-17"), ["Email parents", "IEP meeting"]);
  assert.deepEqual(titles(all, MON), ["Grade quizzes"]);
  all = editTask(all, tasksOn(all, MON)[0].id, { done: true });
  assert.deepEqual(weekCounts(all, MON), { total: 3, done: 1 });
  assert.equal(addTask(all, MON, "   ", id), all);
});

test("each week starts empty; unfinished work is carried or copied only when asked", () => {
  let all: KitRecord[] = [];
  all = addTask(all, MON, "Done thing", id);
  all = addTask(all, "2026-11-18", "Left over", id);
  all = editTask(all, tasksOn(all, MON)[0].id, { done: true });
  const next = addDays(MON, 7);
  assert.equal(weekCounts(all, next).total, 0);
  assert.equal(carryOffer(all, next), 1);
  assert.equal(carryOffer(skipOffer(all, next, id), next), 0);

  const carried = carryUnfinished(all, MON, next);
  assert.equal(carried.moved, 1);
  assert.deepEqual(titles(carried.records, "2026-11-25"), ["Left over"]);
  assert.equal(weekCounts(carried.records, MON).total, 1);

  const copied = copyWeek(all, MON, next, id);
  assert.equal(copied.copied, 2);
  assert.equal(weekCounts(copied.records, next).done, 0);
  assert.equal(weekCounts(copied.records, MON).total, 2);
  assert.equal(weekCounts(clearWeek(all, MON), MON).total, 0);
});

test("a week saved as a template can be put into any week", () => {
  let all: KitRecord[] = [];
  all = addTask(all, MON, "Lesson plans", id);
  all = addTask(all, "2026-11-20", "Data meeting", id);
  all = saveTemplate(all, "Normal week", MON, id);
  assert.deepEqual(templates(all), [{ name: "Normal week", count: 2 }]);
  all = saveTemplate(all, "Normal week", MON, id); // saving again replaces it
  assert.deepEqual(templates(all), [{ name: "Normal week", count: 2 }]);
  const later = "2026-12-07";
  const r = applyTemplate(all, "Normal week", later, id);
  assert.equal(r.added, 2);
  assert.deepEqual(titles(r.records, "2026-12-11"), ["Data meeting"]);
  // Everything survives the hub's cleaning when it is saved.
  assert.equal(cleanKit(r.records).length, r.records.length);
});
