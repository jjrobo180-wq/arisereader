// One order for a hub's whole side menu (shared/menuOrder.ts): every item moves up and down past any other,
// built-in or plugin, with no line between them (Nov 26, 2026).
// Run with: npx tsx --test tests/menu-order.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dropInMenu, moveInMenu, orderMenu, saveMenuOrder } from "../shared/menuOrder";

test("nothing saved: the menu keeps its usual order; new items land where they would have been", () => {
  assert.deepEqual(orderMenu(["tasks", "calendar", "linkpage", "x:notes:a"], undefined), ["tasks", "calendar", "linkpage", "x:notes:a"]);
  assert.deepEqual(orderMenu(["tasks", "calendar", "linkpage", "x:notes:a"], ["x:notes:a", "tasks"]), ["x:notes:a", "tasks", "calendar", "linkpage"]);
  assert.deepEqual(orderMenu(["tasks"], ["gone", 4, "tasks"]), ["tasks"], "saved keys not in the menu, or not strings, are skipped");
});

test("a built-in app moves down past a plugin, and a plugin moves up past a built-in app", () => {
  const order = ["tasks", "linkpage", "x:kit:iep", "x:notes:a"];
  assert.deepEqual(moveInMenu(order, "linkpage", 1), ["tasks", "x:kit:iep", "linkpage", "x:notes:a"]);
  assert.deepEqual(moveInMenu(order, "x:kit:iep", -1), ["tasks", "x:kit:iep", "linkpage", "x:notes:a"]);
  assert.deepEqual(moveInMenu(order, "x:kit:iep", -1)!.length, 4);
  // From the very bottom all the way to the top.
  let o: string[] = order;
  for (let i = 0; i < 3; i++) o = moveInMenu(o, "x:notes:a", -1)!;
  assert.deepEqual(o, ["x:notes:a", "tasks", "linkpage", "x:kit:iep"]);
  assert.equal(moveInMenu(o, "x:notes:a", -1), null, "already at the top");
  assert.equal(moveInMenu(o, "x:kit:iep", 1), null, "already at the bottom");
});

test("folders: an item in one moves within it; one outside steps past the whole folder", () => {
  const folderOf = (k: string) => (k === "goals" || k === "iep" ? "school" : undefined);
  const order = ["tasks", "goals", "iep", "linkpage"];
  assert.deepEqual(moveInMenu(order, "tasks", 1, folderOf), ["goals", "iep", "tasks", "linkpage"]);
  assert.deepEqual(moveInMenu(order, "linkpage", -1, folderOf), ["tasks", "linkpage", "goals", "iep"]);
  assert.deepEqual(moveInMenu(order, "iep", -1, folderOf), ["tasks", "iep", "goals", "linkpage"]);
  assert.equal(moveInMenu(order, "goals", -1, folderOf), null);
});

test("dragging, and what is saved", () => {
  assert.deepEqual(dropInMenu(["a", "b", "x:c"], "x:c", "a"), ["x:c", "a", "b"]);
  assert.deepEqual(dropInMenu(["a", "b", "x:c"], "a", null), ["b", "x:c", "a"]);
  assert.deepEqual(saveMenuOrder(["b", "a"], ["a", "hidden", "b"]), ["b", "a", "hidden"], "a hidden app keeps a place to come back to");
});

test("WorkHub's menu is one list: Move up / Move down and the arrows cross from built-in apps to plugins", () => {
  const hub = readFileSync(new URL("../client/src/pages/TeacherHub.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(hub, /sectionOf\(/, "no more moving only within a part of the menu");
  assert.doesNotMatch(hub, /data-testid="hub-my-apps-heading"/, "no heading splitting the list");
  assert.match(hub, /const menuOrder = orderMenu\(naturalMenu, \(workspace as any\)\.menuOrder\);/);
  assert.match(hub, /\{ label: "Move up", onPick: \(\) => moveMenuBy\(item\.id, -1\) \}/);
  assert.match(hub, /\{ label: "Move up", onPick: \(\) => moveMenuBy\(k, -1\) \}/);
  assert.match(hub, /foldMenu\(menuOrder\.map\(\(id\) => \(\{ id \}\)\), menuFolders\)/);
  // Every item can be taken off the menu: Remove for a plugin, Hide for a built-in app.
  assert.match(hub, /isStoreGroup\(item\) \? \{ label: "Remove app", danger: true, onPick: \(\) => dropGroup\(item, true\) \} : \{ label: "Hide from menu", onPick: \(\) => dropGroup\(item, false\) \}/);
});

test("LifeHub's computer menu is one list too: plugins have arrows, and the order is saved with the family", () => {
  const page = readFileSync(new URL("../client/src/pages/AriseTodo.tsx", import.meta.url), "utf8");
  assert.match(page, /const lifeOrder = orderMenu\(lifeNatural, family\.menuOrder\);/);
  assert.match(page, /\{renderSectionItems\(lifeMenuKeys\)\}/);
  assert.match(page, /if \(raw\.startsWith\("x:"\)\) return lifeExtraRow\(raw\);/);
  assert.match(page, /\{x\.body\}\{lifeArrows\(key, x\.label\)\}/);
  assert.doesNotMatch(page, /data-testid="lifehub-my-apps"/, "no separate My plugins list");
  for (const id of ["lifehub-remove-notes-app-", "lifehub-remove-office-app-", "lifehub-remove-sheets-app-", "lifehub-remove-drive-app", "lifehub-remove-drop-app", "lifehub-remove-kit-"]) assert.ok(page.includes(id), id);
});

test("the family keeps its menu order through cleaning", async () => {
  const { cleanFamily, emptyFamily } = await import("../shared/familyHub");
  assert.deepEqual(cleanFamily({ ...emptyFamily(), menuOrder: ["x:drive", 3, "notes"] }).menuOrder, ["x:drive", "notes"]);
  assert.equal("menuOrder" in cleanFamily(emptyFamily()), false);
});
