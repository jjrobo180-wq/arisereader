// Arise To Duo on Apple Watch: Life and Work on one watch, every app the family uses, and what's done on
// the watch applied back. Run with: npx tsx --test tests/watch-duo.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyFamily, type Family } from "../shared/familyHub";
import { emptyWorkspace } from "../shared/teacherHub";
import { actionHub, applyLifeWatch, applyWorkWatch, lifeWatchPart, watchPayload, workWatchPart } from "../shared/watchDuo";
import { shrink } from "../client/src/lib/watch";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const today = "2026-11-09";
let n = 0;
const makeId = () => `id${++n}`;
const family = (): Family => ({
  ...emptyFamily(),
  sections: { calendar: true, chores: true, grocery: true, habits: true, pills: true, money: true, countdowns: true, notes: true },
  members: [{ id: "m1", name: "Ava", emoji: "", color: "#000", role: "kid" } as any],
  groceries: [{ id: "g1", name: "Milk", qty: "1 gal", aisle: "Dairy", checked: false }],
  habits: [{ id: "h1", name: "Read", emoji: "", color: "#000", days: ["2026-11-07", "2026-11-08"] }],
  countdowns: [{ id: "c1", title: "Trip", date: "2026-11-19", emoji: "", color: "#000" }],
  notes: [{ id: "n1", title: "Wifi", body: "password is cats", color: "", pinned: true, updatedAt: "2026-11-01" }, { id: "n2", title: "Secret", body: "x", color: "", pinned: false, updatedAt: "2026-11-02", locked: true }],
  bills: [{ id: "b1", name: "Phone", amount: 60, dueDay: 20, category: "", autopay: false, paid: [] }],
});

test("the Life side has every app that's on, and nothing that's off", () => {
  const p = lifeWatchPart(family(), [{ id: "t1", title: "Call mom", due: today, listId: "l", done: false }], [{ id: "l", name: "Home" }], today);
  assert.deepEqual(p.features, ["calendar", "chores", "grocery", "habits", "pills", "money", "countdowns", "notes"]);
  assert.equal((p.tasks as any[])[0].list, "Home");
  assert.equal((p.groceries as any[])[0].name, "Milk");
  assert.equal((p.habits as any[])[0].streak, 2);
  assert.equal((p.countdowns as any[])[0].days, 10);
  assert.equal((p.notes as any[]).length, 1, "locked notes stay off the watch");
  assert.equal((p.bills as any[])[0].left, 60);
  assert.ok((p.money as any).label);
  const off = lifeWatchPart({ ...family(), sections: { calendar: false, notes: false } }, [], [], today);
  assert.ok(!(off.features as string[]).includes("grocery"));
  assert.equal(off.groceries, undefined);
});

test("what's done on the watch: groceries, habits, chores, medicine and bills", () => {
  let f = family();
  f = applyLifeWatch(f, [{ type: "grocery", id: "g1" }, { type: "grocery-add", name: "Eggs" }, { type: "habit", id: "h1" }, { type: "bill", id: "b1" }], today, makeId);
  assert.equal(f.groceries[0].checked, true);
  assert.equal(f.groceries[1].name, "Eggs");
  assert.ok(f.habits[0].days.includes(today));
  assert.equal(lifeWatchPart(f, [], [], today).bills && (lifeWatchPart(f, [], [], today).bills as any[])[0].left, 0);
  f = applyLifeWatch(f, [{ type: "grocery-add", name: "eggs" }], today, makeId);
  assert.equal(f.groceries.length, 2, "the same item isn't added twice");
  f = applyLifeWatch(f, [{ type: "grocery-clear" }], today, makeId);
  assert.deepEqual(f.groceries.map((g) => g.name), ["Eggs"]);
});

test("the Work side: to-dos and the week, checked off and added from the watch", () => {
  const w = { ...emptyWorkspace(), tasks: [{ id: "w1", title: "Grade quizzes", dueDate: today, recurring: "", done: false }] } as any;
  const part = workWatchPart(w, today);
  assert.equal((part.tasks as any[])[0].title, "Grade quizzes");
  const next = applyWorkWatch(w, [{ type: "toggle", id: "w1" }, { type: "add", title: "Email parents", due: today }], today, makeId);
  assert.equal(next.tasks[0].done, true);
  assert.equal(next.tasks[1].title, "Email parents");
});

test("one payload with both hubs, actions sorted by hub, and always under Apple's size limit", () => {
  const p = watchPayload({ life: { tasks: [1] }, work: { tasks: [2] } }, today, "Jo") as any;
  assert.deepEqual(p.hubs.work.tasks, [2]);
  assert.deepEqual(p.tasks, [1], "older watch apps still read Life at the top");
  assert.equal(actionHub({ type: "toggle" }), "life");
  assert.equal(actionHub({ type: "toggle", hub: "work" }), "work");
  const big = { hubs: { life: { notes: Array.from({ length: 400 }, (_, i) => ({ id: String(i), text: "x".repeat(400) })) } } };
  assert.ok(JSON.stringify(shrink(big)).length <= 60_000);
});

test("the watch app has the Life / Work switch and every Life app", () => {
  const swift = read("native/duo-watch/DuoWatchApp.swift");
  assert.match(swift, /"Life"/);
  assert.match(swift, /"Work"/);
  for (const f of ["grocery", "habits", "pills", "money", "meals", "countdowns", "notes", "calendar", "chores"]) assert.match(swift, new RegExp(`"${f}"`), f);
  assert.match(swift, /"hub"/);
  assert.match(read("client/src/pages/TeacherHub.tsx"), /publishWatchPart\("work"/);
  assert.match(read("client/src/pages/AriseTodo.tsx"), /publishWatchPart\("life"/);
});
