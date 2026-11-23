import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyFamily } from "../shared/familyHub.ts";
import { pendingMoves } from "../shared/familyTransfer.ts";

test("what I share with someone moves to FamilyHub even before they join it (a family of one)", () => {
  const hook = readFileSync("client/src/lib/useFamilyTransfer.ts", "utf8");
  assert.match(hook, /return ids\.length >= 1 \? ids : null;/);
  assert.equal((hook.match(/pendingMoves\(links\.mine, withEveryone\(ids, links\.mine\)/g) || []).length, 2);
  // The real case: only me in the family; Potty, Accountability and Kitchen shared with Vanessa (814).
  const mine: any[] = [{ id: "x", ownerId: 1, viewerId: 814, nickname: "Vanessa", viewerName: "", status: "active", grants: { "together:accountability": "edit", "app:potty": "edit", "life:meals": "edit" } }];
  const everyone = [1, 814];
  const m = pendingMoves(mine, everyone, 1, emptyFamily());
  assert.deepEqual([...m.ids].sort(), ["app:potty", "life:meals", "together:accountability"]);
  assert.ok(m.items.length >= 3);
});

test("one thing highlighted in the menu, and each hub keeps its own open app", () => {
  const todo = readFileSync("client/src/pages/AriseTodo.tsx", "utf8");
  assert.match(todo, /useStayOnRefresh<string \| null>\(familySpace \? "family-kit" : "life-kit", null\)/);
  assert.match(todo, /active: !notesAppOpen && !kitOpen && !sheetsAppOpen && leadOf\(shown/);
  assert.match(todo, /\$\{!kitOpen && !notesAppOpen && !sheetsAppOpen && shown === id \? "bg-\[#292446\]/);
});
