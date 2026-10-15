import test from "node:test";
import assert from "node:assert/strict";
import { blankChild, cleanData, drinkTypeOf, type Entry } from "../shared/pro/potty/model";
import { agendaText, buildAgenda, intakeOf, peaks, planSits, usualTimes } from "../shared/pro/potty/agenda";

const at = (day: string, hh: number, mm = 0) => { const [y, m, d] = day.split("-").map(Number); return new Date(y, m - 1, d, hh, mm).getTime(); };
let n = 0;
const E = (day: string, hh: number, mm: number, kind: Entry["kind"], extra: Partial<Entry> = {}): Entry => ({ id: `a${n++}`, kid: "k", at: at(day, hh, mm), kind, ...extra });
const kid = () => ({ ...blankChild("k"), name: "Ari", birth: "2024-01" });
const DAY = "2026-10-14";

test("bottle and juice are kept as drink types; older notes still read as a type", () => {
  const d = cleanData({ kids: [{ id: "k", name: "Ari" }], cur: "k", logs: [
    { id: "1", kid: "k", at: 1, kind: "drink", ml: 118, drink: "bottle" }, { id: "2", kid: "k", at: 2, kind: "drink", ml: 118, drink: "bogus" },
    { id: "3", kid: "k", at: 3, kind: "pee", drink: "juice" }] });
  assert.equal(d.logs[0].drink, "bottle"); assert.equal(d.logs[1].drink, undefined); assert.equal(d.logs[2].drink, undefined, "only drinks carry a type");
  assert.equal(drinkTypeOf({ kind: "drink", note: "Juice, Water" }), "juice");
  assert.equal(drinkTypeOf({ kind: "food" }), undefined);
});

test("a drink plans a pee sit and a meal plans a poop sit, with the reason", () => {
  const now = at(DAY, 9, 0);
  const logs = [E(DAY, 8, 30, "drink", { ml: 118, drink: "juice" }), E(DAY, 8, 40, "food", { size: "meal" })];
  const sits = planSits(logs, kid(), now);
  const pee = sits.find((s) => s.wants.includes("pee"))!, poop = sits.find((s) => s.wants.includes("poop"))!;
  assert.ok(pee && poop);
  assert.match(pee.why, /juice at 8:30 AM/); assert.match(poop.why, /meal at 8:40 AM/);
  assert.ok(pee.at > at(DAY, 8, 30) && pee.at <= at(DAY, 9, 45));
  assert.ok(poop.at >= at(DAY, 8, 50) && poop.at <= at(DAY, 9, 15));
  assert.ok(sits.every((s) => s.state === "upcoming" || s.state === "due"));
});

test("the sit is marked worked, nothing, accident or missed from what happened", () => {
  const drink = E(DAY, 8, 0, "drink", { ml: 118, drink: "bottle" });
  const planned = planSits([drink], kid(), at(DAY, 8, 5))[0].at;
  const hh = (ms: number) => ({ h: new Date(ms).getHours(), m: new Date(ms).getMinutes() });
  const t = hh(planned);
  const later = at(DAY, 12, 0);
  assert.equal(planSits([drink, E(DAY, t.h, Math.min(59, t.m + 5), "pee")], kid(), later)[0].state, "worked");
  const s1 = planSits([drink, E(DAY, t.h, t.m, "try")], kid(), later)[0]; assert.equal(s1.state, "nothing");
  const s2 = planSits([drink, E(DAY, t.h, t.m, "acc-pee")], kid(), later)[0]; assert.equal(s2.state, "accident");
  const s3 = planSits([drink], kid(), later)[0]; assert.equal(s3.state, "missed");
  const s4 = planSits([drink], kid(), planned)[0]; assert.equal(s4.state, "due");
});

test("a pee before the sit time means the drink is already dealt with", () => {
  const logs = [E(DAY, 8, 0, "drink", { ml: 118 }), E(DAY, 8, 30, "pee")];
  assert.equal(planSits(logs, kid(), at(DAY, 9, 0)).filter((s) => s.wants.includes("pee") && s.why.includes("8:00")).length, 0);
});

test("a worked sit shows once, as the pee, in the agenda", () => {
  const drink = E(DAY, 8, 0, "drink", { ml: 118, drink: "juice" });
  const sit0 = planSits([drink], kid(), at(DAY, 8, 5))[0];
  const m = new Date(sit0.at);
  const logs = [drink, E(DAY, m.getHours(), m.getMinutes(), "pee")];
  const a = buildAgenda(logs, kid(), "oz", at(DAY, 12, 0));
  assert.equal(a.lines.filter((l) => l.entry?.kind === "pee").length, 1);
  assert.match(a.lines.find((l) => l.entry?.kind === "pee")!.text, /planned sit/);
  assert.equal(a.sits.filter((s) => s.state === "worked").length, 1);
  assert.match(a.lines[0].text, /Drank juice · 4 oz/);
});

test("intake totals separate bottles and juice", () => {
  const logs = [E(DAY, 7, 0, "drink", { ml: 118, drink: "bottle" }), E(DAY, 10, 0, "drink", { ml: 118, drink: "bottle" }), E(DAY, 11, 0, "drink", { ml: 90, drink: "juice" }), E(DAY, 8, 0, "food", { size: "snack" }), E(DAY, 12, 0, "food", { size: "meal" })];
  const i = intakeOf(logs, "k", DAY);
  assert.deepEqual([i.bottles, i.bottleMl, i.juiceMl, i.totalMl, i.meals, i.snacks], [2, 236, 90, 326, 1, 1]);
});

test("usual times: peaks, learning message, and the child's own timing once there is data", () => {
  assert.deepEqual(peaks(Array(24).fill(0)), []);
  const by = Array(24).fill(0); by[8] = 5; by[9] = 4; by[14] = 3; by[3] = 1;
  assert.deepEqual(peaks(by).map((p) => [p.from, p.to]), [[8, 10], [14, 15]]);
  const fresh = usualTimes([E(DAY, 8, 0, "pee")], kid(), at(DAY, 12, 0));
  assert.equal(fresh.learning, true); assert.match(fresh.lines[0], /still learning/);
  const logs: Entry[] = [];
  for (const d of ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13"]) {
    logs.push(E(d, 7, 40, "drink", { ml: 118, drink: "bottle" }), E(d, 8, 25, "pee"), E(d, 7, 0, "food", { size: "meal" }), E(d, 7, 25, "poop"), E(d, 13, 0, "drink", { ml: 118 }), E(d, 13, 45, "pee"));
  }
  const u = usualTimes(logs, kid(), at(DAY, 12, 0));
  assert.equal(u.learning, false);
  assert.match(u.lines.join("\n"), /pees around 8:00 AM–9:00 AM/); assert.match(u.lines.join("\n"), /poops around 7:00 AM–8:00 AM/);
  assert.match(u.lines.join("\n"), /After a drink, a pee usually comes in about 45 minutes/); assert.match(u.lines.join("\n"), /After eating, a poop usually comes in about 25 minutes/);
  // And the plan uses it: a bottle at 7:40 today → sit before ~8:25.
  const today = [...logs, E(DAY, 7, 40, "drink", { ml: 118, drink: "bottle" })];
  const sit = planSits(today, kid(), at(DAY, 7, 45)).find((s) => s.wants.includes("pee") && s.why.includes("bottle"))!;
  assert.equal(new Date(sit.at).getHours() * 60 + new Date(sit.at).getMinutes(), 8 * 60 + 15);
});

test("the agenda copies out as plain text", () => {
  const logs = [E(DAY, 8, 0, "drink", { ml: 118, drink: "bottle" })];
  const a = buildAgenda(logs, kid(), "oz", at(DAY, 8, 5));
  const t = agendaText(a, kid(), "oz", usualTimes(logs, kid(), at(DAY, 8, 5)).lines);
  assert.match(t, /^Ari's agenda/); assert.match(t, /8:00 AM {2}Drank a bottle · 4 oz/); assert.match(t, /Sit on the toilet at/); assert.match(t, /Drinks today: 4 oz to drink, 1 bottle \(4 oz\)/);
});
