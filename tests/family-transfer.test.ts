// Everything shared with the family lives in FamilyHub (shared/familyTransfer.ts), and any app can be moved
// between LifeHub and FamilyHub by hand (shared/hubMove.ts, components/family-hub/MoveBetweenHubs.tsx).
// Run with: npx tsx --test tests/family-transfer.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyFamily, cleanFamily, type Family } from "../shared/familyHub.ts";
import { TRANSFER_VERSION, intoFamily, outOfLife, pendingMoves } from "../shared/familyTransfer.ts";
import { itemForShare, movableItems, moveItem, proPluginId, sharedAppForShare, type HubWorkspace } from "../shared/hubMove.ts";
import { SHARED_APPS, mergeSlices, sharedAppById } from "../shared/sharedApps.ts";
import { emptyKitchen } from "../shared/kitchen.ts";

const ws = (family: Partial<Family>, lists = [{ id: "inbox", name: "Inbox", color: "#6d5ce7" }], tasks: any[] = []): HubWorkspace =>
  ({ version: 2, lists, tasks, family: { ...emptyFamily(), ...family } as Family });
const on = (...s: string[]) => ({ ...emptyFamily().sections, ...Object.fromEntries(s.map((x) => [x, true])) });

const MINE: any[] = [
  { id: "x", viewerId: 2, viewerName: "Mike", nickname: "", status: "active", grants: {
    "life:meals": "edit", "app:potty": "edit", "together:accountability": "edit", "life:calendar": "edit", "life:chores": "view", "life:tasks": "view", "life:health:m1": "view",
  } },
  // Shared with someone who isn't in the family: stays in LifeHub.
  { id: "z", viewerId: 9, viewerName: "Coworker", nickname: "", status: "active", grants: { "life:trips": "view" } },
];

test("Kitchen's share is Kitchen (it took over the old meal plan's id), not the old Meal plan", () => {
  assert.equal(sharedAppById("life:meals")!.section, "meals", "the first one is the old meal plan: the bug");
  assert.equal(sharedAppForShare("life:meals")!.section, "kitchen");
  assert.deepEqual(itemForShare("life:meals"), { kind: "section", section: "kitchen" });
  assert.deepEqual(itemForShare("together:accountability"), { kind: "section", section: "accountability" });
  assert.deepEqual(itemForShare("app:potty"), { kind: "app", app: "life-pro-potty" });
  assert.deepEqual(itemForShare("life:tasks"), { kind: "tasks" });
  assert.equal(itemForShare("life:health:m1"), null, "Food & fitness is part of the retired Health app");
  // A premium app that took over an AI tool keeps that tool's plugin id, the one the Plugin Gallery installs.
  assert.equal(proPluginId("journal"), "life-ai-journal-reflect");
  // Every app that can be shared has a place in a hub.
  for (const a of SHARED_APPS) assert.ok(itemForShare(a.id) || ["health", "cycle", "pills", "mood", "meditate", "habits", "gratitude", "checkups", "sleep", "workouts", "medical"].includes(a.section), a.id);
});

test("everything I share with my family moves to FamilyHub and leaves LifeHub, data and all, once", () => {
  const kitchen = { ...emptyKitchen(), setup: true, choice: { rice: "Jasmine 5 lb" } } as any;
  const life = ws({
    sections: on("kitchen", "accountability", "calendar", "chores", "trips"),
    sheetsInstalled: ["life-pro-potty", "life-pro-water"],
    kitchen, events: [{ id: "e1", title: "Soccer" }] as any, chores: [{ id: "c1", title: "Dishes" }] as any,
  }, [{ id: "inbox", name: "Inbox", color: "#6d5ce7" }, { id: "l2", name: "Groceries", color: "#16a34a" }], [{ id: "t1", listId: "l2", title: "Milk" }]);
  const m = pendingMoves(MINE, [1, 2], 1, life.family);
  assert.deepEqual(m.ids.sort(), ["app:potty", "life:calendar", "life:chores", "life:health:m1", "life:meals", "life:tasks", "together:accountability"]);

  const fam = intoFamily(life, ws({ events: [{ id: "e0", title: "Dinner" }] as any }), m);
  for (const s of ["kitchen", "accountability", "calendar", "chores"] as const) assert.equal(fam.family.sections[s], true, s);
  assert.ok(!fam.family.sections.trips, "Trips is shared with a coworker, not the family");
  assert.deepEqual(fam.family.sheetsInstalled, ["life-pro-potty"]);
  assert.deepEqual(fam.family.events.map((e: any) => e.id), ["e0", "e1"], "merged, nothing replaced");
  assert.equal(fam.family.kitchen.setup, true, "Kitchen's things come along (the empty FamilyHub kitchen used to win)");
  assert.deepEqual(fam.family.kitchen.choice, { rice: "Jasmine 5 lb" });
  assert.deepEqual(fam.lists.map((l) => l.id), ["inbox", "l2"]);
  assert.deepEqual(fam.tasks.map((t) => t.id), ["t1"]);

  const after = outOfLife(life, m);
  const clean = cleanFamily(after.family as any);
  for (const s of ["kitchen", "accountability", "calendar", "chores"] as const) assert.equal(clean.sections[s], false, s);
  assert.equal(clean.sections.trips, true);
  assert.deepEqual(clean.sheetsInstalled, ["life-pro-water"]);
  assert.deepEqual(after.family.kitchen, kitchen, "LifeHub keeps its copy");
  assert.deepEqual(after.tasks.map((t) => t.id), ["t1"], "to-do lists are copied: Tasks is in both hubs");
  assert.equal(clean.familyMoveV, TRANSFER_VERSION);
  assert.equal(pendingMoves(MINE, [1, 2], 1, clean).ids.length, 0, "moves only once");
});

test("what the first version moved (Kitchen as Meal plan) moves again once", () => {
  const v1 = { ...emptyFamily(), movedToFamily: ["life:meals", "app:potty", "together:accountability"] };
  assert.equal(pendingMoves(MINE, [1, 2], 1, v1).ids.length, 7);
  assert.equal(cleanFamily({ ...v1, familyMoveV: 2 } as any).familyMoveV, 2, "the version is saved");
});

test("any app moves by hand, either way, and back", () => {
  const life = ws({ sections: on("kitchen", "goals"), goals: [{ id: "g1", title: "Read" }] as any, sheetsInstalled: ["life-pro-potty"] });
  const items = movableItems(life.family, (s) => (s === "goals" ? "Goals" : undefined));
  assert.deepEqual(items.map((i) => i.name).sort(), ["Goals", "Kitchen", "Potty Training"]);
  const goals = items.find((i) => i.name === "Goals")!.item;
  let { from, to } = moveItem(life, ws({}), goals);
  assert.equal(from.family.sections.goals, false);
  assert.equal(to.family.sections.goals, true);
  assert.deepEqual(to.family.goals.map((g: any) => g.id), ["g1"]);
  ({ from: to, to: from } = moveItem(to, from, goals));
  assert.equal(from.family.sections.goals, true, "moved back");
  assert.deepEqual(from.family.goals.map((g: any) => g.id), ["g1"], "not doubled");
  const potty = moveItem(life, ws({}), items.find((i) => i.name === "Potty Training")!.item);
  assert.deepEqual([potty.from.family.sheetsInstalled, potty.to.family.sheetsInstalled], [[], ["life-pro-potty"]]);
});

test("merging objects: an empty one takes the other's things, a full one keeps its own and gains what's missing", () => {
  const parts = [{ key: "kitchen" as const }];
  assert.deepEqual(mergeSlices({ kitchen: { a: [], b: "" } }, { kitchen: { a: [{ id: 1 }], b: "x" } }, parts), { kitchen: { a: [{ id: 1 }], b: "x" } });
  assert.deepEqual(mergeSlices({ kitchen: { a: [{ id: 1 }], b: "mine" } }, { kitchen: { a: [{ id: 1 }, { id: 2 }], b: "theirs", c: 3 } }, parts), { kitchen: { a: [{ id: 1 }, { id: 2 }], b: "mine", c: 3 } });
});

test("it runs from LifeHub and FamilyHub, and every app page and Family & settings can move things", () => {
  const app = readFileSync("client/src/App.tsx", "utf8");
  assert.match(app, /FamilyHub\.preload\(\)/);
  assert.match(app, /prefetchFamilyHub\(hubUserId, token\)/);
  assert.match(readFileSync("client/src/pages/FamilyHub.tsx", "utf8"), /useState<FamilyInfo \| null \| undefined>\(\(\) => readInfo\(user\?\.id\)\)/);
  const todo = readFileSync("client/src/pages/AriseTodo.tsx", "utf8");
  assert.match(todo, /useFamilyTransfer\(\{ space: familySpace \? "family" : "life", on: sync\.loaded && !sync\.recovery/);
  assert.match(todo, /shown === "family" \? <div className="space-y-6">\{LIFE_VIEWS\.family!\(appProps\)\}\{!familySpace && <HubAutoOpenSettings [^\n]*\/>\}<MoveBetweenHubs /);
  assert.match(todo, /sharedApp\.bar\}\{isSuperApp\(shown\) \? null : moveButton\}/);
  assert.match(todo, /<SuperHeadExtra\.Provider value=\{moveButton\}>/, "a plugin's Move button sits in its heading row");
  assert.match(todo, /banner=\{<>\{moveButton\}/);
  const hook = readFileSync("client/src/lib/useFamilyTransfer.ts", "utf8");
  assert.match(hook, /if \(put\?\.status !== 409\) return "failed";/, "a save that crossed another is tried once more");
  // The other hub is saved before the app is turned off here.
  assert.match(hook, /const done = await changeHub\(otherHub\(space\), token[\s\S]*?if \(done !== "ok"\) return false;\s*setData/);
});
