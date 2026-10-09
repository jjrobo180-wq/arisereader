import test from "node:test";
import assert from "node:assert/strict";
import { cleanFamily, emptyFamily, type Pill } from "../shared/familyHub";
import { adherence, daysOfSupply, dosesOn, markDose, needsRefill, scheduledOn } from "../shared/pills";
import { DISCHARGE, PHASE_GUIDE, READINGS, dailyInsight } from "../shared/cycleGuide";
import { cleanNotify, defaultNotify } from "../shared/todoNotify";
import { dueTodoReminders } from "../shared/todoReminders";

const TODAY = "2026-10-09"; // a Friday
const ZONE = "America/Denver";
const at = (hm: string, date = TODAY) => Date.parse(`${date}T${hm}:00-06:00`);
const pill = (over: Partial<Pill> = {}): Pill => ({ id: "p1", memberId: "me", name: "Vitamin D", dose: "1 tablet", times: ["08:00", "20:00"], days: [0, 1, 2, 3, 4, 5, 6], start: "2026-10-01", end: "", supply: 10, perDose: 1, refillAt: 7, notes: "", color: "#7566e8", active: true, ...over });

test("cycle logs keep discharge, pain, energy, temperature and ovulation tests; junk is dropped", () => {
  const f = cleanFamily({ cycleLogs: [
    { id: "me:2026-10-01", memberId: "me", date: "2026-10-01", flow: "none", symptoms: [], note: "", discharge: "eggwhite", pain: 2, energy: "high", temp: 97.84, ovTest: "positive" },
    { id: "me:2026-10-02", memberId: "me", date: "2026-10-02", flow: "none", symptoms: [], note: "", discharge: "glitter", pain: 9, temp: 50 },
    { id: "me:2026-10-03", memberId: "me", date: "2026-10-03", flow: "none", symptoms: [], note: "" },
  ] });
  assert.equal(f.cycleLogs.length, 2);
  assert.deepEqual({ ...f.cycleLogs.find((l) => l.date === "2026-10-01") }, { id: "me:2026-10-01", memberId: "me", date: "2026-10-01", flow: "none", symptoms: [], note: "", discharge: "eggwhite", pain: 2, energy: "high", temp: 97.84, ovTest: "positive" });
  const odd = f.cycleLogs.find((l) => l.date === "2026-10-02")!;
  assert.equal(odd.discharge, undefined);
  assert.equal(odd.pain, 3);
  assert.equal(odd.temp, undefined);
});

test("the guide has a daily insight for every phase day, foods, tips and readings", () => {
  for (const p of Object.values(PHASE_GUIDE)) {
    assert.ok(p.tips.length && p.eat.length && p.limit.length && p.move, p.id);
    for (let d = 1; d <= 20; d++) assert.ok(dailyInsight(p.id, d).length > 20);
  }
  assert.equal(READINGS[0].id, "cycle-vs-period");
  assert.ok(DISCHARGE.some((d) => d.id === "unusual" && /doctor/.test(d.means)));
});

test("pills: doses on a day, taking one uses the supply, undo gives it back, refill warning", () => {
  const fam = { ...emptyFamily(), pills: [pill(), pill({ id: "p2", name: "Iron", times: ["12:00"], days: [1, 3, 5] })] };
  assert.deepEqual(dosesOn(fam, TODAY).map((d) => `${d.time} ${d.pill.name}`), ["08:00 Vitamin D", "12:00 Iron", "20:00 Vitamin D"]);
  assert.equal(scheduledOn(fam.pills[1], "2026-10-10"), false); // Saturday
  assert.equal(scheduledOn(pill({ start: "2026-10-20" }), TODAY), false);
  let f = markDose(fam, "p1", TODAY, "08:00", "taken", "2026-10-09T14:00:00Z");
  assert.equal(f.pills[0].supply, 9);
  assert.equal(dosesOn(f, TODAY)[0].status, "taken");
  f = markDose(f, "p1", TODAY, "08:00", "taken", "x"); // same again changes nothing
  assert.equal(f.pills[0].supply, 9);
  f = markDose(f, "p1", TODAY, "08:00", "skipped", "x");
  assert.equal(f.pills[0].supply, 10, "switching to skipped gives the pill back");
  f = markDose(f, "p1", TODAY, "08:00", null, "x");
  assert.equal(f.pillDoses.length, 0);
  assert.equal(needsRefill(pill({ supply: 7 })), true);
  assert.equal(needsRefill(pill({ supply: null })), false);
  assert.equal(daysOfSupply(pill({ supply: 14 })), 7);
  const a = adherence(markDose(fam, "p1", TODAY, "08:00", "taken", "x"), fam.pills[0], TODAY, 1, "12:00");
  assert.deepEqual(a, { taken: 1, due: 1 }, "the 20:00 dose hasn't come yet");
});

test("pills and cycle clean up and old workspaces get empty lists and default settings", () => {
  const f = cleanFamily({ pills: [{ id: "x", memberId: "me", name: "  ", times: ["08:00"] }, { id: "y", memberId: "me", name: "Allergy", times: ["25:00", "07:30", "07:30"], days: [9] }] });
  assert.equal(f.pills.length, 1);
  assert.deepEqual(f.pills[0].times, ["07:30"]);
  assert.deepEqual(f.pills[0].days, [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(cleanFamily({}).pillDoses, []);
  assert.deepEqual(cleanNotify({}).pills, { on: true, loud: true, refill: true });
  assert.deepEqual(cleanNotify({ period: { on: true, daysBefore: 30 } }).period, { on: true, daysBefore: 7 });
});

test("reminders: pill doses at their time (even in quiet hours), refills in the morning, period heads-up", () => {
  const family = emptyFamily();
  family.pills = [pill({ supply: 5 })];
  family.notify = { ...defaultNotify(), morning: { on: false, time: "07:00" }, quiet: { on: true, from: "19:00", until: "07:00" }, period: { on: true, daysBefore: 2 } };
  // Periods on Sept 13 and Oct 11 → 28-day cycle, next expected Oct 11 (2 days from Oct 9).
  family.cycleLogs = ["2026-09-13", "2026-09-14", "2026-09-15", "2026-08-16", "2026-08-17"].map((d) => ({ id: `me:${d}`, memberId: "me", date: d, flow: "medium" as const, symptoms: [], note: "" }));
  const ws = { version: 2, lists: [], tasks: [], family };
  const morning = dueTodoReminders(ws, at("08:05"), ZONE, {});
  assert.ok(morning.some((r) => r.key === `todo:pill:p1:${TODAY}:08:00` && /Vitamin D/.test(r.title)));
  assert.ok(morning.some((r) => r.key === `todo:refill:p1:${TODAY}` && /5 left/.test(r.body)));
  assert.ok(morning.some((r) => r.key === "todo:period:me:2026-10-11"), morning.map((r) => r.key).join(","));
  const evening = dueTodoReminders(ws, at("20:10"), ZONE, {});
  assert.deepEqual(evening.map((r) => r.key), [`todo:pill:p1:${TODAY}:20:00`], "pills come through quiet hours, nothing else does");
  family.notify = { ...family.notify, pills: { on: true, loud: false, refill: true } };
  assert.deepEqual(dueTodoReminders(ws, at("20:10"), ZONE, {}), []);
  family.pillDoses = [{ id: `p1:${TODAY}:08:00`, pillId: "p1", date: TODAY, time: "08:00", status: "taken", at: "" }];
  assert.ok(!dueTodoReminders(ws, at("08:05"), ZONE, {}).some((r) => r.key.startsWith("todo:pill:")), "no reminder for a dose already taken");
});
