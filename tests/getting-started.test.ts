import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GUIDES, guideFor, startingRole } from "../shared/gettingStarted";
import { TOGGLEABLE, ADD_ON_SECTIONS, isOn, emptyFamily, cleanSectionOrder } from "../shared/familyHub";
import { WORK_BUILT_IN_TABS, isTabOn, emptyWorkspace } from "../shared/teacherHub";
import { visibleGroups } from "../shared/hubTabGroups";
import { PLUGINS } from "../shared/pluginStore";

test("a guide for each kind of person, each with steps, features, customizing and tips", () => {
  assert.deepEqual(GUIDES.map((g) => g.role), ["parent", "teacher", "student", "personal"]);
  for (const g of GUIDES) {
    assert.ok(g.steps.length >= 3 && g.topics.length >= 3 && g.customize.length >= 1 && g.tips.length >= 2, g.role);
    const ids = [...g.steps, ...g.topics, ...g.customize].map((x) => x.id);
    assert.equal(new Set(g.steps.map((s) => s.id)).size, g.steps.length, `${g.role}: step ids unique`);
    assert.ok(ids.every(Boolean));
  }
  assert.equal(startingRole({ role: "teacher" }, "life"), "teacher");
  assert.equal(startingRole({ role: "parent" }, "life"), "parent");
  assert.equal(startingRole({ role: "todo" }, "life"), "personal");
  assert.equal(startingRole({ isAdmin: true }, "work"), "teacher");
  assert.equal(guideFor("student").label, "Student");
});

test("it's in both menus from the start, at the top, and can be removed and added back", () => {
  assert.ok(TOGGLEABLE.includes("start") && !ADD_ON_SECTIONS.includes("start"));
  assert.equal(isOn("start", emptyFamily()), true);
  assert.equal(isOn("start", { sections: { start: false } }), false);
  assert.equal(cleanSectionOrder(["notes", "goals"])[0], "start");
  assert.ok(WORK_BUILT_IN_TABS.includes("start"));
  const v = emptyWorkspace().visibleTabs;
  assert.equal(isTabOn("start", v), true);
  assert.equal(isTabOn("start", { ...v, start: false }), false);
  assert.equal(visibleGroups(v)[1].id, "start");
  assert.ok(PLUGINS.some((p) => p.id === "life-start") && PLUGINS.some((p) => p.id === "work-start"));
});

test("the page has the picker, checklist, features, customizing and a remove button", () => {
  const src = readFileSync(new URL("../client/src/components/GettingStarted.tsx", import.meta.url), "utf8");
  for (const part of ['data-testid="gs-remove"', "gs-role-", "Your first few minutes", "What's here", "Make it yours", "Good to know"]) assert.ok(src.includes(part), part);
  for (const page of ["../client/src/pages/AriseTodo.tsx", "../client/src/pages/TeacherHub.tsx"]) assert.match(readFileSync(new URL(page, import.meta.url), "utf8"), /<GettingStarted hub="(life|work)"/);
});
