import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyFamily, cleanFamily } from "../shared/familyHub.ts";
import { hideFromLife, moveIntoFamily, pendingMoves } from "../shared/familyTransfer.ts";
import { sharedAppById } from "../shared/sharedApps.ts";

test("what I share with family moves to FamilyHub and leaves LifeHub, once", () => {
  const mine: any[] = [
    { id: "x", viewerId: 2, viewerName: "Mike", nickname: "", status: "active", grants: { "life:meals": "edit", "app:potty": "edit", "together:accountability": "edit" } },
    { id: "z", viewerId: 9, viewerName: "Coworker", nickname: "", status: "active", grants: { "life:calendar": "view" } },
  ];
  const m = pendingMoves(mine, [1, 2], 1);
  assert.deepEqual(m.ids.sort(), ["app:potty", "life:meals", "together:accountability"]);
  const kitchen = sharedAppById("life:meals")!.section;
  assert.ok(m.sections.includes(kitchen) && m.sections.includes("accountability" as any));
  assert.deepEqual(m.apps, ["life-pro-potty"]);

  const life: any = { ...emptyFamily(), sections: { ...emptyFamily().sections, [kitchen]: true, accountability: true }, sheetsInstalled: ["life-pro-potty", "life-pro-water"] };
  const fam = moveIntoFamily(emptyFamily(), life, m);
  assert.equal(fam.sections[kitchen], true);
  assert.equal((fam.sections as any).accountability, true);
  assert.ok(fam.sheetsInstalled.includes("life-pro-potty"));

  const after = cleanFamily(hideFromLife(life, m) as any);
  assert.equal(after.sections[kitchen], false);
  assert.deepEqual(after.sheetsInstalled, ["life-pro-water"]);
  assert.deepEqual([...after.movedToFamily!].sort(), m.ids.sort());
  assert.equal(pendingMoves(mine, [1, 2], 1, after.movedToFamily).ids.length, 0, "moves only once");
});

test("FamilyHub opens instantly like WorkHub ⇄ LifeHub", () => {
  const app = readFileSync("client/src/App.tsx", "utf8");
  assert.match(app, /FamilyHub\.preload\(\)/);
  assert.match(app, /prefetchFamilyHub\(hubUserId, token\)/);
  assert.match(app, /prefetchFamilyInfo\(hubUserId, token\)/);
  assert.match(readFileSync("client/src/pages/FamilyHub.tsx", "utf8"), /useState<FamilyInfo \| null \| undefined>\(\(\) => readInfo\(user\?\.id\)\)/);
  assert.match(readFileSync("client/src/pages/AriseTodo.tsx", "utf8"), /useFamilyTransfer\(\{ on: !familySpace/);
});
