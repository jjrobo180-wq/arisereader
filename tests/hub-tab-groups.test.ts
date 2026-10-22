// WorkHub menu: since Oct 12–13, 2026 each screen has its own place in the menu, and the Reader
// tools live on their own page (A.R.I.S.E. Reader) rather than in the hub menu.
// Run: npx tsx --test tests/hub-tab-groups.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { HUB_GROUPS, SUB_LABELS, groupLabel, groupOf, groupTabs, openGroup, visibleGroups } from "../shared/hubTabGroups";
import { HUB_TABS } from "../shared/teacherHub";
import { ALWAYS_SHOWN } from "../shared/hubTabGroups";

const all = Object.fromEntries(HUB_TABS.map((t) => [t, true]));

const isReaderTool = (t: string) => t.startsWith("reader") && t !== "reader";

test("every hub screen is in exactly one menu place; the Reader tools are on the Reader page instead", () => {
  const listed = HUB_GROUPS.flatMap((g) => g.tabs);
  assert.deepEqual([...listed].sort(), HUB_TABS.filter((t) => !isReaderTool(t)).sort());
  assert.equal(new Set(listed).size, listed.length);
  assert.deepEqual(groupOf("iep").tabs, ["iep"]);
  assert.equal(groupOf("iep").label, "Meetings");
  assert.equal(groupOf("reader").id, "arise", "one way out to the Reader page");
  for (const g of HUB_GROUPS) if (g.tabs.length > 1) for (const t of g.tabs) assert.ok(SUB_LABELS[t], `${t} has a button label`);
});

test("hidden screens leave the menu; Home always shows", () => {
  assert.equal(visibleGroups(all).length, HUB_GROUPS.length);
  const hide = { ...all, notes: false };
  assert.deepEqual(groupTabs("tasks", hide), ["tasks"]);
  assert.equal(visibleGroups(hide).some((g) => g.id === "notes"), false);
  assert.equal(groupLabel("tasks", all), "Tasks");
  assert.equal(groupLabel("iep", all), "Meetings");
  assert.equal(visibleGroups({ ...all, parents: false }).some((g) => g.id === "parents"), false);
  assert.ok(visibleGroups({ ...all, overview: false }).some((g) => g.id === "home"), "Home always shows");
  assert.ok(ALWAYS_SHOWN.includes("overview"));
});

test("tapping a menu place opens its screen; an admin's opens even if not added", () => {
  assert.equal(openGroup("iep", all, {}), "iep");
  assert.equal(openGroup("notes", all, {}), "notes");
  assert.equal(openGroup("home", all, {}), "overview");
  assert.equal(openGroup("gradebook", { ...all, gradebook: false }, {}), "overview", "a screen that isn't added falls back to Home");
  assert.equal(openGroup("gradebook", { ...all, gradebook: false }, {}, true), "gradebook", "admins see every screen");
});
