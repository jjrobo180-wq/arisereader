import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Tasks: no second set of count cards, and the add box is the first thing in the list", () => {
  const src = readFileSync("client/src/components/teacher-hub/HubTasks.tsx", "utf8");
  assert.doesNotMatch(src, /task-alerts/, "the Open/Due today/Overdue/Completed cards repeated the top row");
  assert.match(src, /data-testid="tasks-overdue"/, "overdue still shows, as one small chip");
  const add = src.indexOf('data-testid="tasks-quick-add"');
  const title = src.indexOf("{VIEW_INFO[view].title}</h2>");
  assert.ok(add > 0 && add < title, "the add box sits above the list title");
});
