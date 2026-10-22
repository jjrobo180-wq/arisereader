// LifeHub tasks: delete, edit and archive (including recurring tasks), reachable straight from the
// list, and the "Add a new task" modal fits on a short screen.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("a task can be archived and restored, and archive hides it from every other view", () => {
  const life = read("client/src/pages/AriseTodo.tsx");
  // The data shape and backup sanitizer both carry the new flag.
  assert.match(life, /archived\?: boolean;/);
  assert.match(life, /archived: item\.archived === true,/);
  // Archiving and restoring don't delete the task, just flip the flag.
  assert.match(life, /const archiveTask = \(task: Task\) => \{[\s\S]{0,200}archived: true/);
  assert.match(life, /const unarchiveTask = \(task: Task\) => \{[\s\S]{0,200}archived: false/);
  // Every other view (all/today/upcoming/completed) excludes archived tasks; only "archived" shows them.
  assert.match(life, /view === "archived"[\s\S]{0,40}if \(!task\.archived\) return false/);
  assert.match(life, /if \(task\.archived\) return false;/);
  assert.match(life, /active = data\.tasks\.filter\(task => !task\.done && !task\.archived\)/);
});

test("the task list has a direct delete, edit and archive action on every row, not just inside the editor", () => {
  const life = read("client/src/pages/AriseTodo.tsx");
  const row = life.slice(life.indexOf("filtered.map(task =>"), life.indexOf("filtered.length"));
  assert.match(row, /onClick=\{\(\) => setEditing\(\{ \.\.\.task \}\)\}.*aria-label=\{`Edit \$\{task\.title\}`\}/, "edit");
  assert.match(row, /onClick=\{\(\) => archiveTask\(task\)\}.*aria-label=\{`Archive \$\{task\.title\}`\}/, "archive");
  assert.match(row, /onClick=\{\(\) => unarchiveTask\(task\)\}.*aria-label=\{`Restore \$\{task\.title\} from archive`\}/, "unarchive");
  assert.match(row, /onClick=\{\(\) => removeTask\(task\)\}.*aria-label=\{`Delete \$\{task\.title\}`\}/, "delete");
});

test("an \"Archived\" tab sits alongside All/Today/Upcoming/Completed", () => {
  const life = read("client/src/pages/AriseTodo.tsx");
  assert.match(life, /\{ id: "archived", title: "Archived", icon: Archive, count: archivedCount \}/);
});

test("recurring tasks still spawn their next occurrence on completion, independent of archiving", () => {
  const life = read("client/src/pages/AriseTodo.tsx");
  assert.match(life, /if \(finished && task\.repeat !== "none" && task\.due\) \{/);
  assert.match(life, /const next = nextDate\(task\.due, task\.repeat\);/);
});

test("the \"Add a new task\" modal is shorter: tighter spacing and a taller scroll ceiling so it fits a short screen", () => {
  const life = read("client/src/pages/AriseTodo.tsx");
  const modal = life.slice(life.indexOf('{editing && <div className="fixed inset-0'), life.indexOf("</form>\n      </div>\n    </div>}"));
  assert.match(modal, /max-h-\[96dvh\]/, "taller ceiling than before (94dvh)");
  assert.match(modal, /overscroll-contain/);
  assert.match(modal, /className="space-y-3"/, "tighter form spacing than the old space-y-4");
  assert.match(modal, /p-4 shadow-2xl sm:max-w-lg sm:rounded-\[1\.5rem\] sm:p-6/, "tighter padding than the old p-5/sm:p-7");
});
