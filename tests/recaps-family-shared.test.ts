import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyFamily, cleanFamily } from "../shared/familyHub.ts";
import { buildRecaps, cleanRecaps, recapRange } from "../shared/recaps.ts";
import { familyHasAccountability, familyInvites, familyShares } from "../shared/familyShared.ts";

const today = "2026-11-22";

test("recaps: yesterday or the last 7 days, per app that's on, each one switchable", () => {
  const f: any = emptyFamily();
  f.sections = { ...f.sections, chores: true, habits: true, sleep: true };
  f.members = [{ id: "m1", name: "Ava" }];
  f.chores = [{ id: "c1" }];
  f.choreDone = [{ id: "d1", choreId: "c1", date: "2026-11-21", memberId: "m1", points: 1 }, { id: "d2", choreId: "c1", date: "2026-11-17", memberId: "m1", points: 1 }];
  f.habits = [{ id: "h1", name: "Read", emoji: "📚", color: "#000", days: ["2026-11-21", "2026-11-19"] }];
  f.sleep = [{ id: "s1", date: "2026-11-21", bed: "22:00", wake: "06:30", quality: 4 }];
  const tasks = [{ title: "Call mom", done: true, completedAt: "2026-11-21T15:00:00Z" }, { title: "Old", done: true, completedAt: "2026-11-10T15:00:00Z" }];
  const y = buildRecaps(f, tasks, today, { on: true, period: "yesterday", off: [] });
  assert.deepEqual(y.map((r) => r.id), ["tasks", "chores", "habits", "sleep"]);
  assert.match(y[0].lines[0], /1 task checked off: Call mom/);
  assert.match(y[1].lines.join(" "), /1 chore done/);
  assert.match(y[3].lines[0], /8h 30m/);
  const w = buildRecaps(f, tasks, today, { on: true, period: "week", off: ["sleep"] });
  assert.match(w.find((r) => r.id === "chores")!.lines[0], /2 chores done/);
  assert.match(w.find((r) => r.id === "habits")!.lines[0], /2 of 7 days/);
  assert.ok(!w.some((r) => r.id === "sleep"), "a recap switched off is left out");
  assert.deepEqual(buildRecaps(f, tasks, today, { on: false, period: "week", off: [] }), []);
  assert.equal(recapRange(today, "week").from, "2026-11-15");
});

test("recap settings are kept safely with the hub", () => {
  assert.deepEqual(cleanRecaps({ on: false, period: "week", off: ["sleep", "sleep", 4, "<x>"] }), { on: false, period: "week", off: ["sleep"] });
  assert.deepEqual(cleanRecaps(null), { on: true, period: "yesterday", off: [] });
  const kept = cleanFamily({ ...emptyFamily(), recaps: { on: true, period: "week", off: ["money"] } } as any);
  assert.deepEqual(kept.recaps, { on: true, period: "week", off: ["money"] });
});

test("FamilyHub picks up what family members share: invites accepted, Potty Training first, Accountability turned on", () => {
  const withMe: any[] = [
    { id: "a", ownerId: 2, ownerName: "Mike", status: "active", grants: { "life:calendar": "view", "app:potty": "edit", "together:accountability": "edit" } },
    { id: "b", ownerId: 3, ownerName: "Grandma", status: "pending", grants: { "app:water": "view" } },
    { id: "c", ownerId: 9, ownerName: "Not family", status: "active", grants: { "app:potty": "edit" } },
  ];
  const fam = [1, 2, 3];
  assert.deepEqual(familyInvites(withMe, fam, 1).map((l) => l.id), ["b"]);
  const rows = familyShares(withMe, fam, 1);
  assert.deepEqual(rows.map((r) => r.id), ["app:potty", "together:accountability", "life:calendar"]);
  assert.ok(familyHasAccountability(rows));
  assert.ok(!rows.some((r) => r.ownerId === 9));
});

test("Home shows the recaps everywhere and the family shares in FamilyHub", () => {
  const src = readFileSync("client/src/pages/AriseTodo.tsx", "utf8");
  assert.match(src, /shown === "home" && <Recaps /);
  assert.match(src, /familySpace && shown === "home" && <FamilyShared /);
});
