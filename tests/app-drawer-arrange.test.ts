import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { arrangeDrawer, cleanLayout, moveKey, orderFromKeys } from "../shared/hubLayout.ts";
import { cleanLifeLayout } from "../shared/lifeLayout.ts";

const apps = ["home", "tasks", "notes", "kit-a", "store"].map((id) => ({ id }));

test("the drawer keeps the saved order, leaves out removed apps, and puts new apps last", () => {
  assert.deepEqual(arrangeDrawer(apps, ["notes", "home", "tasks"], ["kit-a"]).map((a) => a.id), ["notes", "home", "tasks", "store"]);
  assert.deepEqual(arrangeDrawer(apps).map((a) => a.id), ["home", "tasks", "notes", "kit-a", "store"]);
});

test("dragging an app onto another's place, and a folder bringing its apps along", () => {
  assert.deepEqual(moveKey(["a", "b", "c", "d"], "d", "b"), ["a", "d", "b", "c"]);
  assert.deepEqual(moveKey(["a", "b", "c"], "a", "c"), ["b", "c", "a"]);
  assert.deepEqual(orderFromKeys(["c", "folder:f1", "a"], [{ id: "f1", name: "F", items: ["x", "y"] }], ["a", "x", "y", "c", "gone"]), ["c", "x", "y", "a", "gone"]);
});

test("both hubs keep the drawer's order and removed apps", () => {
  const w = cleanLayout({ drawerOrder: ["b", "a", "a", 5], drawerHidden: ["kit-x"] });
  assert.deepEqual(w.drawerOrder, ["b", "a"]);
  assert.deepEqual(w.drawerHidden, ["kit-x"]);
  assert.equal(cleanLayout({}).drawerOrder, undefined);
  const l = cleanLifeLayout({ drawerOrder: ["notes"], drawerHidden: ["tasks"] } as any);
  assert.deepEqual([l.drawerOrder, l.drawerHidden], [["notes"], ["tasks"]]);
});

test("WorkHub's drawer arranges like LifeHub's: a longer hold, drag, ✕ to remove", () => {
  const grid = readFileSync("client/src/components/family-hub/AppDrawerGrid.tsx", "utf8");
  assert.match(grid, /export const HOLD_MS = 750;/);
  assert.match(grid, /aria-label=\{`Remove \$\{entry\.item\.label\}`\}/);
  assert.match(readFileSync("client/src/pages/TeacherHub.tsx", "utf8"), /<AppDrawerGrid items=\{drawerItems\}/);
  assert.match(readFileSync("client/src/components/family-hub/PhoneMenu.tsx", "utf8"), /<AppDrawerGrid items=/);
});
