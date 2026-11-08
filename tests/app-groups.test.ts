import test from "node:test";
import assert from "node:assert/strict";
import { APP_GROUPS, collapseGroups, groupLabel, groupMembers, leadOf } from "../shared/appGroups";
import { FAMILY_SECTIONS } from "../shared/familyHub";

test("every grouped id is a real section and in only one group", () => {
  const seen = new Set<string>();
  for (const g of APP_GROUPS) for (const m of g.members) {
    assert.ok((FAMILY_SECTIONS as readonly string[]).includes(m), m);
    assert.ok(!seen.has(m), `${m} twice`); seen.add(m);
  }
});
test("a group collapses to one tile at its first app that is on", () => {
  const on = ["home", "tasks", "subscriptions", "money", "history", "news"];
  assert.deepEqual(collapseGroups(on, on), ["home", "tasks", "money", "news"]);
  assert.equal(leadOf("money", on), "money");
  assert.equal(groupLabel("money", on, "Budget & bills"), "Money");
  assert.deepEqual(groupMembers("history", on), ["news", "history"]);
});
test("a lone app in a group stays a plain app", () => {
  const on = ["home", "history"];
  assert.deepEqual(collapseGroups(on, on), on);
  assert.equal(groupLabel("history", on, "Today in history"), "Today in history");
  assert.equal(leadOf("history", on), "history");
});
