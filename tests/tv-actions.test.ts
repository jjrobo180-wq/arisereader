// Arise Duo on Apple TV: to-dos checked off (and back on) and added from the TV, and chores checked off,
// for LifeHub and WorkHub. Run with: npx tsx --test tests/tv-actions.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyLifeTv, applyWorkTv, nextRepeat, readTvAction } from "../shared/tvActions";
import { emptyFamily } from "../shared/familyHub";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const day = "2026-11-08", now = "2026-11-08T20:00:00.000Z";
let n = 0;
const id = () => `n${++n}`;
const life = () => ({ version: 2, lists: [{ id: "l1", name: "Home" }], tasks: [
  { id: "t1", title: "Call the dentist", listId: "l1", due: day, repeat: "none", done: false },
  { id: "t2", title: "Water plants", listId: "l1", due: day, repeat: "weekly", done: false },
], family: { ...emptyFamily(), sections: { chores: true }, chores: [{ id: "c1", title: "Dishes", points: 2, memberIds: [], repeat: "daily", days: [], start: "2026-11-01" }] } });

test("only real actions get through", () => {
  assert.deepEqual(readTvAction({ action: "toggle", id: "t1" }), { action: "toggle", id: "t1" });
  assert.deepEqual(readTvAction({ action: "add", title: "  Buy   milk ", due: "nope" }), { action: "add", title: "Buy milk", due: "" });
  assert.equal(readTvAction({ action: "delete", id: "t1" }), null);
  assert.equal(readTvAction({ action: "add", title: "   " }), null);
});

test("LifeHub: check off, undo, a repeating task's next one, add", () => {
  let r = applyLifeTv(life(), { action: "toggle", id: "t1" }, day, now, id);
  assert.ok(!("error" in r));
  if ("error" in r) return;
  assert.equal(r.workspace.tasks[0].done, true);
  assert.equal(r.message, "Done: Call the dentist");
  r = applyLifeTv(r.workspace, { action: "toggle", id: "t1" }, day, now, id);
  if ("error" in r) return assert.fail();
  assert.equal(r.workspace.tasks[0].done, false);
  const rep = applyLifeTv(life(), { action: "toggle", id: "t2" }, day, now, id);
  if ("error" in rep) return assert.fail();
  const copy = rep.workspace.tasks.find((t: any) => t.id === rep.created);
  assert.equal(copy.due, "2026-11-15");
  const undo = applyLifeTv(rep.workspace, { action: "toggle", id: "t2", undoCreated: rep.created }, day, now, id);
  if ("error" in undo) return assert.fail();
  assert.equal(undo.workspace.tasks.length, 2, "undo takes the next copy away again");
  const add = applyLifeTv(life(), { action: "add", title: "Buy milk", due: day }, day, now, id);
  if ("error" in add) return assert.fail();
  assert.deepEqual([add.workspace.tasks[2].title, add.workspace.tasks[2].listId, add.workspace.tasks[2].due], ["Buy milk", "l1", day]);
  assert.ok("error" in applyLifeTv(life(), { action: "toggle", id: "gone" }, day, now, id));
});

test("monthly repeats land on a real day", () => {
  assert.equal(nextRepeat("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(nextRepeat("2026-12-15", "monthly"), "2027-01-15");
  assert.equal(nextRepeat("2026-11-08", "daily"), "2026-11-09");
});

test("WorkHub: check off and add", () => {
  const ws = { tasks: [{ id: "w1", title: "Grade quizzes", dueDate: day, recurring: "", done: false }] };
  const r = applyWorkTv(ws, { action: "toggle", id: "w1" }, day, now, id);
  if ("error" in r) return assert.fail();
  assert.equal(r.workspace.tasks[0].done, true);
  const a = applyWorkTv(ws, { action: "add", title: "Email parents", due: day }, day, now, id);
  if ("error" in a) return assert.fail();
  assert.equal(a.workspace.tasks.length, 2);
});

test("the TV app's buttons do something now", () => {
  const tv = read("native/duo-tv/DuoTVApp.swift");
  assert.match(tv, /Button \{ Task \{ await model\.toggle\(t\) \} \}/);
  assert.match(tv, /Button \{ Task \{ await model\.chore\(c\) \} \}/);
  assert.match(tv, /DuoTVAdd\(\)/);
  assert.match(tv, /\/api\/arise-todo\/tv\/act/);
  assert.match(tv, /\/api\/tv\/work\/act/);
  assert.match(read("server/tvLink.ts"), /act\("\/api\/arise-todo\/tv\/act", "changeLife"/);
  assert.match(read("server/routes.ts"), /changeLife: async/);
});
