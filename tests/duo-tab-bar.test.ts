import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanLifeLayout } from "../shared/lifeLayout";
import { cleanLayout } from "../shared/hubLayout";

const read = (p: string) => readFileSync(p, "utf8");

test("Arise To Duo starts with the tab bar; an old default side rail moves to it once", () => {
  assert.equal(cleanLifeLayout(undefined).menuSide, "tabs");
  assert.equal(cleanLifeLayout({ menuSide: "left", menuClose: "button" }).menuSide, "tabs");
  // A menu picked on purpose (anything but the old default) is kept.
  assert.equal(cleanLifeLayout({ menuSide: "top" }).menuSide, "top");
  assert.equal(cleanLifeLayout({ menuSide: "drawer" }).menuSide, "drawer");
  // After the move, choosing the side rail again sticks.
  const moved = cleanLifeLayout({ menuSide: "left" });
  assert.equal(cleanLifeLayout({ ...moved, menuSide: "left" }).menuSide, "left");
  // WorkHub keeps its side rail.
  assert.equal(cleanLayout(undefined).menuSide, "left");
});

test("the tab bar has Home, Tasks, Add, Apps and You, and You holds the account and settings", () => {
  const bar = read("client/src/components/family-hub/PhoneTabBar.tsx");
  for (const id of ["life-tab-home", "life-tab-tasks", "life-tab-add", "life-tab-apps", "life-tab-you"]) assert.ok(bar.includes(`data-testid="${id}"`), id);
  assert.match(bar, /lg:hidden/, "phones only");
  const page = read("client/src/pages/AriseTodo.tsx");
  for (const id of ["privacy", "notifications", "family", "customize", "lock", "night", "gallery", "signout"]) assert.ok(page.includes(`{ id: "${id}", label:`), id);
  // One floating Add on a phone: the + in the bar. The round Add button stays for computers and the split screen.
  assert.match(page, /tabBar \? "max-lg:hidden" : ""\} inline-flex h-14/);
  // Apps opens the same app drawer, with no second round button.
  const menu = read("client/src/components/family-hub/PhoneMenu.tsx");
  assert.match(menu, /addEventListener\(OPEN_APPS_EVENT/);
  assert.match(menu, /!hideLauncher && side !== "tabs"/);
  // WorkHub doesn't offer it.
  assert.match(read("client/src/pages/TeacherHub.tsx"), /MENU_SIDES\.filter\(\(o\) => o\.id !== "tabs"\)/);
});
