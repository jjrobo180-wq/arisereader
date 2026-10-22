// WorkHub's to-do screen, laid out like LifeHub's: lists, views (All, Today, Upcoming, Completed,
// Archived) and archiving. Plus: the sort, view and list picked are remembered, and the phone's
// app drawer lists every added app.
// Run with: npx tsx --test tests/hub-todo-lists.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { archiveTask, cleanTaskLists, removeTaskList, saveTask, taskCounts, viewCounts, viewTasks } from "../shared/hubTasks";
import type { Task } from "../shared/teacherHub";

const T = "2026-10-13";
const tasks: Task[] = [
  { id: "a", title: "Copies for P2", dueDate: "2026-10-12", recurring: "", done: false, listId: "copies" },
  { id: "b", title: "IEP draft", dueDate: "2026-10-13", recurring: "", done: false, listId: "iep" },
  { id: "c", title: "Field trip forms", dueDate: "2026-10-20", recurring: "", done: false },
  { id: "d", title: "Grades", dueDate: "", recurring: "", done: true, listId: "iep" },
  { id: "e", title: "Old thing", dueDate: "", recurring: "", done: false, archived: true },
];

test("views work like LifeHub's, and archived to-dos only show under Archived", () => {
  assert.deepEqual(viewTasks(tasks, "all", "all", "due", T).map((t) => t.id), ["a", "b", "c"]);
  assert.deepEqual(viewTasks(tasks, "today", "all", "due", T).map((t) => t.id), ["a", "b"]);
  assert.deepEqual(viewTasks(tasks, "upcoming", "all", "due", T).map((t) => t.id), ["c"]);
  assert.deepEqual(viewTasks(tasks, "completed", "all", "due", T).map((t) => t.id), ["d"]);
  assert.deepEqual(viewTasks(tasks, "archived", "all", "due", T).map((t) => t.id), ["e"]);
  assert.deepEqual(viewTasks(tasks, "all", "iep", "due", T).map((t) => t.id), ["b"]);
  assert.deepEqual(viewCounts(tasks, "all", T), { all: 3, today: 2, upcoming: 1, completed: 1, archived: 1 });
  assert.equal(taskCounts(tasks, T).open, 3);
  assert.deepEqual(viewTasks(tasks, "all", "all", "name", T, "forms").map((t) => t.id), ["c"]);
});

test("archiving, lists and the list a to-do is saved on", () => {
  const archived = archiveTask(tasks, "a", true);
  assert.equal(archived.find((t) => t.id === "a")!.archived, true);
  assert.equal("archived" in archiveTask(archived, "a", false).find((t) => t.id === "a")!, false);
  const ws = removeTaskList({ tasks, taskLists: [{ id: "iep", name: "IEP", color: "#7566e8" }] }, "iep");
  assert.equal(ws.taskLists!.length, 0);
  assert.equal(ws.tasks.find((t) => t.id === "b")!.listId, undefined);
  assert.deepEqual(cleanTaskLists([{ id: "x", name: " Copies " }, { id: "x", name: "dup" }, { id: "", name: "no id" }]).map((l) => l.name), ["Copies"]);
  const made = saveTask([], null, { title: "New", dueDate: "", recurring: "", priority: false, listId: "copies" }, () => "n");
  assert.equal(made[0].listId, "copies");
  const kept = saveTask(made, "n", { title: "Renamed", dueDate: "", recurring: "", priority: false }, () => "x");
  assert.equal(kept[0].listId, "copies", "editing from elsewhere keeps its list");
  const moved = saveTask(made, "n", { title: "New", dueDate: "", recurring: "", priority: false, listId: "" }, () => "x");
  assert.equal(moved[0].listId, undefined);
});

test("sorts, views and lists are remembered, and the phone app drawer has every added app", () => {
  const page = readFileSync("client/src/pages/TeacherHub.tsx", "utf8");
  for (const key of ['"hub-tasks-sort"', '"hub-tasks-view"', '"hub-tasks-list"', '"hub-email-filter"']) assert.ok(page.includes(key), key);
  assert.ok(readFileSync("client/src/components/teacher-hub/HubBehavior.tsx", "utf8").includes('"hub-behavior-sort"'));
  assert.ok(readFileSync("client/src/pages/Library.tsx", "utf8").includes('"library-sort"'));
  assert.ok(readFileSync("client/src/pages/AriseTodo.tsx", "utf8").includes('"life-todo-view"'));
  const drawer = page.slice(page.indexOf('aria-label="All sections"'), page.indexOf("hubEntries.map((entry)"));
  for (const part of ["mySheetsApps.map", "drivePlugin ?", "dropPlugin ?", "myKits.filter", "myNotesApps.filter"]) assert.ok(drawer.includes(part), part);
});
