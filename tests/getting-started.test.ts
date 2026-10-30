import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GUIDES, guideFor, startingRole } from "../shared/gettingStarted";
import { TOGGLEABLE, ADD_ON_SECTIONS, isOn, emptyFamily, cleanSectionOrder } from "../shared/familyHub";
import { WORK_BUILT_IN_TABS, isTabOn, emptyWorkspace, normalizeWorkspace } from "../shared/teacherHub";
import { visibleGroups } from "../shared/hubTabGroups";
import { PLUGINS, pluginsFor } from "../shared/pluginStore";

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

test("Getting started is replaced by the first-run walkthrough in both hubs (October 2026)", () => {
  const v = emptyWorkspace().visibleTabs;
  assert.equal(isTabOn("start", v), false);
  assert.equal(normalizeWorkspace({ visibleTabs: { start: true } }).visibleTabs.start, false);
  assert.ok(!pluginsFor("life", { teacher: false }).some((p) => p.name === "Getting started"));
  assert.ok(!pluginsFor("work", { teacher: true }).some((p) => p.name === "Getting started"));
  for (const page of ["../client/src/pages/AriseTodo.tsx", "../client/src/pages/TeacherHub.tsx"]) assert.match(readFileSync(new URL(page, import.meta.url), "utf8"), /<AppWalkthrough userId=\{user\.id\} hub="(life|work)"/);
  const w = readFileSync(new URL("../client/src/components/AppWalkthrough.tsx", import.meta.url), "utf8");
  for (const part of ["Getting around", "Add anything with +", "Only the apps you want", "Make it yours", "Bring in your iPhone", "Reminders on your phone", "split screen", "looksLikeDuoInner"]) assert.ok(w.includes(part), part);
});

test("the page has the picker, checklist, features, customizing and a remove button", () => {
  const src = readFileSync(new URL("../client/src/components/GettingStarted.tsx", import.meta.url), "utf8");
  for (const part of ['data-testid="gs-remove"', "gs-role-", "Your first few minutes", "What's here", "Make it yours", "Good to know"]) assert.ok(src.includes(part), part);
});
