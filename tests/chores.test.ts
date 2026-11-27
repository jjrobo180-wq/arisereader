import test from "node:test";
import assert from "node:assert/strict";
import { choreDueOn, choreWindow, cleanFamily, emptyFamily, type Chore, type ChoreDone } from "../shared/familyHub";
import { CHORE_CATALOG, CHORE_PACKS, FREQ_CODES, catalogById, choreFromCatalog, freqLabel } from "../shared/choreCatalog";
import { badges, freshness, levelOf, quickQueue, streak, totalXp } from "../shared/choreGame";

const base: Chore = { id: "c", title: "Chore", memberId: "", rotation: [], days: [], points: 1 };
const done = (date: string, choreId = "c"): ChoreDone => ({ id: `${choreId}${date}`, choreId, date, memberId: "", points: 1 });

test("an old chore is still daily or set days", () => {
  assert.equal(choreDueOn(base, "2026-11-27"), true);
  assert.equal(choreDueOn({ ...base, days: [1] }, "2026-11-30"), true); // Monday
  assert.equal(choreDueOn({ ...base, days: [1] }, "2026-11-27"), false);
});

test("every 3 days counts from the start", () => {
  const c = { ...base, unit: "day" as const, every: 3, start: "2026-11-01" };
  assert.deepEqual(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"].map((d) => choreDueOn(c, d)), [true, false, false, true]);
  assert.equal(choreDueOn(c, "2026-10-29"), false);
});

test("monthly on a set day, short months use their last day", () => {
  const c = { ...base, unit: "month" as const, start: "2026-01-31" };
  assert.equal(choreDueOn(c, "2026-02-28"), true);
  assert.equal(choreDueOn(c, "2026-03-31"), true);
  assert.equal(choreDueOn(c, "2026-03-30"), false);
  const q = { ...c, every: 3 };
  assert.equal(choreDueOn(q, "2026-04-30"), true);
  assert.equal(choreDueOn(q, "2026-02-28"), false);
});

test("an any-day weekly chore stays until done, then drops off for the week", () => {
  const c = { ...base, flex: true, start: "2026-11-01" };
  assert.deepEqual(choreWindow(c, "2026-11-27"), { from: "2026-11-22", to: "2026-11-28" });
  const list = [done("2026-11-25")];
  assert.equal(choreDueOn(c, "2026-11-24", list), false);
  assert.equal(choreDueOn(c, "2026-11-25", list), true);
  assert.equal(choreDueOn(c, "2026-11-26", list), false);
  assert.equal(choreDueOn(c, "2026-11-29", list), true);
  assert.equal(choreDueOn(c, "2026-11-26", []), true);
});

test("every 2 weeks and monthly any-day windows", () => {
  const c = { ...base, unit: "week" as const, every: 2, flex: true, start: "2026-11-01" };
  assert.deepEqual(choreWindow(c, "2026-11-12"), { from: "2026-11-01", to: "2026-11-14" });
  assert.deepEqual(choreWindow(c, "2026-11-20"), { from: "2026-11-15", to: "2026-11-28" });
  const m = { ...base, unit: "month" as const, every: 6, flex: true, start: "2026-03-10" };
  assert.deepEqual(choreWindow(m, "2026-11-02"), { from: "2026-09-01", to: "2027-02-28" });
});

test("the new fields survive cleaning and bad ones are dropped", () => {
  const f = cleanFamily({ ...emptyFamily(), chores: [{ ...base, unit: "month", every: 3, start: "2026-11-27", flex: true, cat: "kitchen", icon: "🍳", mins: 20 }, { ...base, id: "x", unit: "year", every: -4, start: "nope" }] });
  assert.deepEqual(f.chores[0], { ...base, unit: "month", every: 3, start: "2026-11-27", flex: true, cat: "kitchen", icon: "🍳", mins: 20 });
  assert.deepEqual(f.chores[1], { ...base, id: "x" });
});

test("the catalog is big, unique, and every pack points at real chores", () => {
  assert.ok(CHORE_CATALOG.length >= 250);
  assert.equal(new Set(CHORE_CATALOG.map((c) => c.id)).size, CHORE_CATALOG.length);
  for (const c of CHORE_CATALOG) assert.ok(FREQ_CODES[c.freq], c.id);
  for (const p of CHORE_PACKS) for (const id of p.chores) assert.ok(catalogById.has(id), `${p.id}: ${id}`);
});

test("adding from the catalog and the frequency labels", () => {
  const item = catalogById.get("kitchen:clean-the-oven")!;
  const c = choreFromCatalog(item, FREQ_CODES["3m"], "o", "2026-11-27");
  assert.equal(c.unit, "month"); assert.equal(c.every, 3); assert.equal(c.flex, true); assert.equal(c.cat, "kitchen");
  assert.equal(freqLabel(c), "Every 3 months · any day");
  assert.equal(freqLabel(base), "Every day");
  assert.equal(freqLabel({ ...base, days: [1, 2, 3, 4, 5] }), "Weekdays");
  assert.equal(freqLabel({ ...base, unit: "month", start: "2026-11-02" }), "Monthly on the 2nd");
});

test("xp, levels and streaks", () => {
  const chores = [{ ...base, mins: 20 }];
  const d = { chores, choreDone: [done("2026-11-25"), done("2026-11-26"), done("2026-11-27")] };
  assert.equal(totalXp(d), 90);
  assert.deepEqual(levelOf(0), { level: 1, title: "Fresh Start", into: 0, need: 100, next: 100 });
  assert.equal(levelOf(250).level, 3);
  assert.deepEqual(streak(d, "2026-11-27"), { days: 3, aliveToday: true });
  assert.deepEqual(streak(d, "2026-11-28"), { days: 3, aliveToday: false });
  assert.deepEqual(streak(d, "2026-11-29"), { days: 0, aliveToday: false });
  // A weekly chore's off days don't break the streak.
  const weekly = { chores: [{ ...base, flex: true, start: "2026-11-01" }], choreDone: [done("2026-11-16"), done("2026-11-23")] };
  assert.equal(streak(weekly, "2026-11-27").days, 2);
});

test("freshness, quick session and badges", () => {
  const c = { ...base, flex: true, start: "2026-11-01", mins: 10 };
  assert.equal(freshness({ chores: [c], choreDone: [done("2026-11-20")] }, c, "2026-11-27"), 1);
  assert.ok(freshness({ chores: [c], choreDone: [done("2026-11-01")] }, c, "2026-11-27") < 1);
  const a = { ...base, id: "a", mins: 5 }, b = { ...base, id: "b", mins: 30 };
  assert.deepEqual(quickQueue({ chores: [a, b], choreDone: [] }, "2026-11-27", 10).map((x) => x.id), ["a"]);
  assert.deepEqual(quickQueue({ chores: [b], choreDone: [] }, "2026-11-27", 10).map((x) => x.id), ["b"]);
  const list = badges({ chores: [a], choreDone: [done("2026-11-27", "a")] }, "2026-11-27");
  assert.equal(list.find((x) => x.id === "first")?.earned, true);
  assert.equal(list.find((x) => x.id === "perfect1")?.earned, true);
  assert.equal(list.find((x) => x.id === "ten")?.have, 1);
});
