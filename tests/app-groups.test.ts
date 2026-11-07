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
  const on = ["home", "tasks", "pills", "mood", "grocery", "recipes", "bible"];
  assert.deepEqual(collapseGroups(on, on), ["home", "tasks", "pills", "grocery", "bible"]);
  assert.equal(leadOf("mood", on), "pills");
  assert.equal(groupLabel("pills", on, "Medications"), "Health");
  assert.deepEqual(groupMembers("recipes", on), ["grocery", "recipes"]);
});
test("a lone app in a group stays a plain app", () => {
  const on = ["home", "bible"];
  assert.deepEqual(collapseGroups(on, on), on);
  assert.equal(groupLabel("bible", on, "Bible"), "Bible");
  assert.equal(leadOf("bible", on), "bible");
});
