// The Tasks page's looks (shared/taskLooks.ts, components/teacher-hub/TaskLooks.tsx): List, Today, Lists,
// Minimal, Board and Notes, plus the Original, switched with one tap at the top of Tasks.
// Run with: npx tsx --test tests/task-looks.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TASK_LOOKS, TASK_LOOK_INFO, boardColumns, dayGroups, listTiles, noteTilt, textOn, tint, todayProgress } from "../shared/taskLooks";

const T = (id: string, title: string, dueDate = "", more: Record<string, unknown> = {}) => ({ id, title, dueDate, done: false, recurring: "", ...more }) as any;
const today = "2026-11-23";
const lists = [{ id: "p", name: "Personal", color: "#7566e8" }, { id: "w", name: "Work", color: "#f59e72" }, { id: "f", name: "Family", color: "#36b6a5" }];
const tasks = [
  T("1", "Pay the water bill", "2026-11-21", { listId: "p" }),
  T("2", "Pick up Maya", today, { listId: "f", dueTime: "15:15" }),
  T("3", "Send the IEP minutes", "2026-11-24", { listId: "w" }),
  T("4", "Order school pictures", "2026-11-27", { listId: "f" }),
  T("5", "Call the dentist", today, { listId: "p", done: true, doneAt: "2026-11-23T15:00:00Z" }),
  T("6", "Clean the garage"),
  T("7", "Old thing", "2026-11-01", { archived: true }),
  T("8", "Plan trip", "2026-12-20", { listId: "p" }),
];

test("the six looks picked from the prototypes, plus the Original, in order", () => {
  assert.deepEqual([...TASK_LOOKS], ["calm", "today", "tiles", "minimal", "board", "notes", "classic"]);
  assert.deepEqual(TASK_LOOKS.map((l) => TASK_LOOK_INFO[l].name), ["List", "Today", "Lists", "Minimal", "Board", "Notes", "Original"]);
});

test("Today: late, today, this week, no date and done today; archived never shows", () => {
  const g = dayGroups(tasks, today);
  assert.deepEqual(g.overdue.map((t) => t.id), ["1"]);
  assert.deepEqual(g.today.map((t) => t.id), ["2"]);
  assert.deepEqual(g.soon.map((t) => t.id), ["3", "4"], "the coming week, soonest first; Dec 20 is later");
  assert.deepEqual(g.someday.map((t) => t.id), ["6"]);
  assert.deepEqual(g.doneToday.map((t) => t.id), ["5"]);
  assert.deepEqual(todayProgress(tasks, today), { done: 1, total: 3 });
  assert.deepEqual(dayGroups(tasks, today, "f").today.map((t) => t.id), ["2"], "one list");
  assert.deepEqual(todayProgress([], today), { done: 0, total: 0 });
});

test("Lists: a tile for Today and each list, with what's next, and No list when needed", () => {
  const tiles = listTiles(tasks, lists, today);
  assert.deepEqual(tiles.map((t) => [t.name, t.count, t.late]), [["Today", 2, 1], ["Personal", 2, 1], ["Work", 1, 0], ["Family", 2, 0], ["No list", 1, 0]]);
  assert.equal(tiles[3].next!.title, "Pick up Maya");
  assert.equal(listTiles(tasks.filter((t) => t.listId), lists, today).some((t) => t.name === "No list"), false);
});

test("Board: a column for each list in order, open to-dos only, soonest first", () => {
  const cols = boardColumns(tasks, lists);
  assert.deepEqual(cols.map((c) => [c.name, c.tasks.map((t) => t.id)]), [["Personal", ["1", "8"]], ["Work", ["3"]], ["Family", ["2", "4"]], ["No list", ["6"]]]);
});

test("Notes and tiles use the lists' own colors, light enough to read on", () => {
  assert.equal(tint("#7566e8", 0.72), "#d8d4f9");
  assert.equal(tint("not a color"), "#f1f5f9");
  assert.equal(textOn("#ffd75e"), "#12111c");
  assert.equal(textOn("#12111c"), "#ffffff");
  assert.equal(noteTilt("abc"), noteTilt("abc"), "the same note always leans the same way");
});

test("the switcher is at the top of Tasks; LifeHub starts on List, WorkHub on the Original", () => {
  const page = readFileSync("client/src/components/teacher-hub/HubTasks.tsx", "utf8");
  // Today is the standard look for every account, old and new (Nov 23, 2026): new keys, one default.
  assert.match(page, /useSavedChoice<TaskLook>\(plain \? "life-tasks-look-v2" : "hub-tasks-look-v2", "today", TASK_LOOKS\)/);
  // One "Customize" button opens the looks in a menu (not a row of buttons), beside each look's own buttons.
  assert.match(page, /\{!looked && <div className="flex justify-end">\{lookMenu\(\)\}<\/div>\}/);
  assert.match(page, /empty=\{emptyText\} customize=\{lookMenu\} daily=\{daily\} \/>/);
  // The daily check-in card (components/daily/Rise.tsx) sits above the look.
  assert.match(page, /looked \? <>\s*\{daily && \(view === "all" \|\| view === "today"\) && !search\.trim\(\) && <RiseCard d=\{daily\} \/>\}\s*<TaskLookView look=/);
  // The edit pop-up is shared by every look.
  assert.equal(page.match(/<TaskModal /g)?.length, 1);
  const looks = readFileSync("client/src/components/teacher-hub/TaskLooks.tsx", "utf8");
  for (const l of ["look-calm", "look-today", "look-tiles", "look-minimal", "look-board", "look-notes"]) assert.ok(looks.includes(`data-testid="${l}"`), l);
  assert.match(looks, /role="menu" aria-label="How Tasks looks"/);
  assert.match(looks, /role="menuitemradio" aria-checked=\{look === l\}/);
  assert.match(looks, /<SlidersHorizontal className="h-4 w-4" \/><span>Customize<\/span>/);
  assert.ok(!/data-testid="look-today"[^>]*overflow-hidden|overflow-hidden[^"]*" data-testid="look-today"/.test(looks), "the menu isn't cut off in the Today look");
  assert.match(looks, /type="checkbox"[^>]*aria-label=\{`Done: \$\{task\.title\}`\}/, "check-offs are real checkboxes");
});

test("Tasks has no big page title, and the Today look's Arise button stays on one line", () => {
  const hub = readFileSync(new URL("../client/src/pages/TeacherHub.tsx", import.meta.url), "utf8");
  assert.match(hub, /&& tab !== "tasks" && tab !== "behavior"[^\n]*\(\s*<HubPageHead/);
  const looks = readFileSync(new URL("../client/src/components/teacher-hub/TaskLooks.tsx", import.meta.url), "utf8");
  const today = looks.slice(looks.indexOf('data-testid="look-today"'));
  assert.match(today.slice(0, 2500), /whitespace-nowrap[^"]*"[^>]*data-testid="task-look-arise"/);
  assert.doesNotMatch(today.slice(0, 2500), /Arise\{p\.newAsks \? ` · /, "no more 'Arise · 1' text that wraps");
});
