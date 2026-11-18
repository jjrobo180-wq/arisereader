// To Duo's menu: removing a plugin asks in the page (window.confirm can be silently blocked, which made the
// plugin stay), and every kind of plugin in "My plugins" has a remove button.
// Run with: npx tsx --test tests/todo-menu-remove.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../client/src/pages/AriseTodo.tsx", import.meta.url), "utf8");

test("removing from the menu does not use window.confirm", () => {
  const fn = page.slice(page.indexOf("const removeFromMenu = "), page.indexOf("const removeApp = "));
  assert.ok(fn.length > 0);
  assert.doesNotMatch(fn, /window\.confirm/);
  assert.match(page, /data-testid="life-remove-confirm"/);
  assert.match(page, /data-testid="life-remove-yes"/);
});

test("every kind of plugin in My plugins can be removed, the same way the gallery removes it", () => {
  for (const id of ["lifehub-remove-notes-app-", "lifehub-remove-office-app-", "lifehub-remove-sheets-app-", "lifehub-remove-drive-app", "lifehub-remove-drop-app", "lifehub-remove-kit-"]) assert.ok(page.includes(id), id);
  assert.match(page, /onToggle=\{togglePlugin\}/);
  assert.match(page, /const removeApp = \(p: Plugin\) => setRemoving\(\{ label: p\.name, run: \(\) => togglePlugin\(p, false\) \}\)/);
});
