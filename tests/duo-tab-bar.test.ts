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
  // WorkHub has the same default and the same one-time move.
  assert.equal(cleanLayout(undefined).menuSide, "tabs");
  assert.equal(cleanLayout({ menuSide: "left" }).menuSide, "tabs");
  assert.equal(cleanLayout({ menuSide: "left", menuV: 2 }).menuSide, "left");
  assert.equal(cleanLayout({ menuSide: "bottom" }).menuSide, "bottom");
});

test("the tab bar has Home, Tasks, Add, Apps and You, and You holds the account and settings", () => {
  const bar = read("client/src/components/family-hub/PhoneTabBar.tsx");
  for (const id of ["tab-home", "tab-tasks", "tab-add", "tab-apps", "tab-you"]) assert.ok(bar.includes(`data-testid={id("${id}")}`), id);
  assert.match(bar, /work \? "md:hidden" : "lg:hidden"/, "phones only");
  const page = read("client/src/pages/AriseTodo.tsx");
  for (const id of ["privacy", "notifications", "family", "customize", "lock", "night", "gallery", "signout"]) assert.ok(page.includes(`{ id: "${id}", label:`), id);
  // One floating Add on a phone: the + in the bar. The round Add button stays for computers and the split screen.
  assert.match(page, /tabBar \? "max-lg:hidden" : ""\} inline-flex h-14/);
  // Apps opens the same app drawer, with no second round button.
  const menu = read("client/src/components/family-hub/PhoneMenu.tsx");
  assert.match(menu, /addEventListener\(OPEN_APPS_EVENT/);
  assert.match(menu, /!hideLauncher && side !== "tabs"/);
  // WorkHub has it too, with its own You sheet and one Add button on a phone.
  const work = read("client/src/pages/TeacherHub.tsx");
  assert.match(work, /<PhoneTabBar hub="work"/);
  assert.match(work, /tabBar \? "max-md:hidden" : ""\} inline-flex h-14/);
  assert.match(work, /addEventListener\(OPEN_APPS_EVENT/);
});
