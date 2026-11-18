// WorkHub's menu: every Plugin Gallery app under My plugins can be removed (Office apps like Résumé Builder
// and Math Lessons had no Remove), and an Arise chip on a to-do sits on its own line under the title.
// Run with: npx tsx --test tests/hub-menu-remove.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const hub = readFileSync(new URL("../client/src/pages/TeacherHub.tsx", import.meta.url), "utf8");
const tasks = readFileSync(new URL("../client/src/components/teacher-hub/HubTasks.tsx", import.meta.url), "utf8");

test("every My plugins item has Remove, done the way the Plugin Gallery does it", () => {
  for (const k of ["office:${a.id}", "notes:${p.id}", "sheets:${a.id}"]) assert.ok(hub.includes(`key: \`${k}\`, label: `) && hub.includes(`remove: () => removeWorkApp(`), k);
  assert.match(hub, /key: "drive", label: drivePlugin\.name, remove: \(\) => removeWorkApp\(drivePlugin\)/);
  assert.match(hub, /key: "drop", label: dropPlugin\.name, remove: \(\) => removeWorkApp\(dropPlugin\)/);
  assert.match(hub, /onToggle=\{toggleWorkPlugin\}/);
  assert.match(hub, /data-testid=\{`hub-remove-\$\{x\.key\}`\}/);
});

test("the Arise chip on a to-do has its own line, so the title is not squeezed", () => {
  assert.match(tasks, /<div className="order-last basis-full pl-9"><button type="button" onClick=\{\(\) => openAsk\(ariseAsk\.id\)\}/);
  assert.doesNotMatch(tasks, /sm:basis-auto \$\{ariseAsk/);
});
