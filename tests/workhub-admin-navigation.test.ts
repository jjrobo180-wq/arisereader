// Regression: admins see every WorkHub app even without installing it.
// Run: npx tsx --test tests/workhub-admin-navigation.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { groupTabs, openGroup, visibleGroups } from "../shared/hubTabGroups";
import { HUB_TABS } from "../shared/teacherHub";

// (Goals is a standard screen since October 2026, so it is on by default like Calendar and Notes.)
const defaultWorkspace = Object.fromEntries(HUB_TABS.map((tab) => [tab, ![
  "caseload", "minutes", "iep", "lessons", "arise", "behavior",
  "attendance", "gradebook", "parents", "schedules", "email",
].includes(tab)])) as Record<(typeof HUB_TABS)[number], boolean>;

test("admin sidebar and opened tab use the same visibility rules", () => {
  const visible = { ...defaultWorkspace, admin: true };
  const groups = visibleGroups(visible, undefined, true);
  for (const group of groups) {
    const target = openGroup(group.id, visible, {}, true);
    assert.ok(groupTabs(group.id, visible, true).includes(target), `${group.id} opens an allowed tab`);
    if (group.id !== "home") assert.notEqual(target, "overview", `${group.id} must not silently return Home`);
  }
});

test("admin opens Caseload and Meetings even when those app flags are false", () => {
  const visible = { ...defaultWorkspace, admin: true, caseload: false, iep: false };
  assert.equal(openGroup("caseload", visible, {}, true), "caseload");
  assert.equal(openGroup("iep", visible, {}, true), "iep");
  assert.equal(openGroup("goals", visible, {}, true), "goals");
  assert.equal(openGroup("admin", visible, {}, true), "admin");
});

test("regular teacher still cannot navigate to apps they have not installed", () => {
  const visible = { ...defaultWorkspace, admin: false };
  assert.equal(openGroup("caseload", visible, {}, false), "overview");
  assert.equal(openGroup("iep", visible, {}, false), "overview");
  assert.equal(openGroup("tasks", visible, {}, false), "tasks");
});
