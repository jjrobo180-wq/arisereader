import test from "node:test";
import assert from "node:assert/strict";
import { groupLabel, groupNotes } from "../client/src/components/arise-notes/pages/pagesGroups";

const now = new Date(2026, 10, 1, 22, 0);
const at = (daysAgo: number) => new Date(2026, 10, 1 - daysAgo, 9, 0).toISOString();
const n = (id: string, daysAgo: number, pinned = false) => ({ id, pinned, updatedAt: at(daysAgo), createdAt: at(daysAgo) });

test("notes list groups label days the way Apple Notes does", () => {
  assert.equal(groupLabel(at(0), now), "Today");
  assert.equal(groupLabel(at(1), now), "Yesterday");
  assert.equal(groupLabel(at(4), now), "Previous 7 Days");
  assert.equal(groupLabel(at(20), now), "Previous 30 Days");
  assert.equal(groupLabel(new Date(2026, 5, 3).toISOString(), now), "June");
  assert.equal(groupLabel(new Date(2025, 5, 3).toISOString(), now), "June 2025");
  assert.equal(groupLabel("nonsense", now), "Earlier");
});

test("pinned notes come first and each group keeps the incoming order", () => {
  const g = groupNotes([n("a", 0), n("b", 0, true), n("c", 1), n("d", 9)], "updatedAt", now);
  assert.deepEqual(g.map((s) => s.label), ["Pinned", "Today", "Yesterday", "Previous 30 Days"]);
  assert.deepEqual(g[0].items.map((m) => m.id), ["b"]);
  assert.deepEqual(g[1].items.map((m) => m.id), ["a"]);
});
