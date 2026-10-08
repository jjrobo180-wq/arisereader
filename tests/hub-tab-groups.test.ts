// Teacher Hub: tabs that go together share one place in the menu.
// Run: npx tsx --test tests/hub-tab-groups.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { HUB_GROUPS, SUB_LABELS, groupLabel, groupOf, groupTabs, openGroup, visibleGroups } from "../shared/hubTabGroups";
import { HUB_TABS } from "../shared/teacherHub";

const all = Object.fromEntries(HUB_TABS.map((t) => [t, true]));

test("every tab is in exactly one group, and the meeting steps hold the guide", () => {
  const listed = HUB_GROUPS.flatMap((g) => g.tabs);
  assert.deepEqual([...listed].sort(), [...HUB_TABS].sort());
  assert.equal(new Set(listed).size, listed.length);
  assert.deepEqual(groupOf("iep").tabs, ["iep"]);
  assert.equal(groupOf("iep").label, "IEP & Meetings");
  assert.ok(HUB_GROUPS.length <= 10, "fewer places in the menu than the 17 tabs");
  for (const g of HUB_GROUPS) if (g.tabs.length > 1) for (const t of g.tabs) assert.ok(SUB_LABELS[t], `${t} has a button label`);
});

test("hidden tabs drop out; a group with every tab hidden leaves the menu", () => {
  assert.equal(visibleGroups(all).length, HUB_GROUPS.length);
  const hide = { ...all, notes: false };
  assert.deepEqual(groupTabs("tasks", hide), ["tasks"]);
  assert.equal(groupLabel("tasks", hide), "Tasks");
  assert.equal(groupLabel("tasks", all), "Tasks & Notes");
  assert.equal(groupLabel("iep", all), "IEP & Meetings");
  const none = { ...all, parents: false, email: false };
  assert.equal(visibleGroups(none).some((g) => g.id === "family"), false);
  assert.ok(visibleGroups({ ...all, overview: false }).some((g) => g.id === "home"), "Home always shows");
});

test("tapping a group opens the tab used last in it", () => {
  assert.equal(openGroup("iep", all, {}), "iep");
  assert.equal(openGroup("tasks", all, { tasks: "notes" }), "notes");
  assert.equal(openGroup("tasks", { ...all, notes: false }, { tasks: "notes" }), "tasks", "unless it was hidden since");
  assert.equal(openGroup("home", all, {}), "overview");
});
