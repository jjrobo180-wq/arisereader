// IEP → Prep: the planning-period checklist (shared/hubPrep.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanPrepChecks, prepDueOn, prepForDay, prepMissed, prepNextDue, prepRepeatWords, togglePrep, type PrepCheck } from "../shared/hubPrep";

const job = (p: Partial<PrepCheck>): PrepCheck => cleanPrepChecks([{ id: "a", title: "Collect unmodified paper", start: "2026-11-02", repeat: "days", days: [1, 3], ...p }])[0];
// Nov 2 2026 is a Monday.

test("days I pick: only on those weekdays (planning periods)", () => {
  const c = job({});
  assert.deepEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-09"].map((d) => prepDueOn(c, d)), [true, false, true, true]);
  assert.equal(prepDueOn(c, "2026-11-01"), false, "not before it starts");
  assert.equal(prepRepeatWords(c), "Mon, Wed");
});

test("every school day skips weekends; every 2 weeks skips the off week; monthly keeps the date", () => {
  const school = job({ repeat: "schooldays" });
  assert.deepEqual(["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"].map((d) => prepDueOn(school, d)), [true, false, false, true]);
  const two = job({ repeat: "biweekly", days: [5] });
  assert.deepEqual(["2026-11-06", "2026-11-13", "2026-11-20"].map((d) => prepDueOn(two, d)), [true, false, true]);
  const month = job({ repeat: "monthly", start: "2026-10-31" });
  assert.deepEqual(["2026-11-30", "2026-12-31", "2026-11-29"].map((d) => prepDueOn(month, d)), [true, true, false], "the 31st falls on the 30th in November");
  const once = job({ repeat: "once", start: "2026-11-05" });
  assert.deepEqual(["2026-11-05", "2026-11-12"].map((d) => prepDueOn(once, d)), [true, false]);
});

test("ends, pauses, check-offs and what was missed", () => {
  assert.equal(prepDueOn(job({ until: "2026-11-03" }), "2026-11-04"), false);
  assert.equal(prepDueOn(job({ paused: true }), "2026-11-02"), false);
  const c = togglePrep(job({}), "2026-11-02");
  assert.deepEqual(prepForDay([c], "2026-11-02").map((i) => i.done), [true]);
  assert.deepEqual(togglePrep(c, "2026-11-02").done, [], "tapping again takes the check away");
  assert.deepEqual(prepMissed([c], "2026-11-06").map((i) => i.date), ["2026-11-04"], "Monday was done, Wednesday wasn't");
  assert.deepEqual(prepMissed([job({ repeat: "once", start: "2026-10-01" })], "2026-11-06").map((i) => i.date), ["2026-10-01"], "a one-time job stays until done");
  assert.equal(prepNextDue(job({}), "2026-11-05"), "2026-11-09");
});

test("bad saved data is cleaned, not trusted", () => {
  const list = cleanPrepChecks([null, { id: "x" }, { id: "b", title: "Make worksheets", start: "2026-11-02", repeat: "weird", kind: "zzz", days: [9, "x"], done: ["bad", "2026-11-02", "2026-11-02"] }]);
  assert.equal(list.length, 1);
  assert.deepEqual([list[0].repeat, list[0].kind, list[0].done], ["once", "other", ["2026-11-02"]]);
  assert.deepEqual(job({ days: [] }).days, [1], "days I pick with none picked: the start's weekday");
});

test("the IEP folder has a Prep tile", () => {
  const page = readFileSync("client/src/components/teacher-hub/HubIep.tsx", "utf8");
  for (const t of ['| "prep"', 'key: "prep", label: "Prep"', "<PrepChecklist"]) assert.ok(page.includes(t), t);
  assert.match(readFileSync("shared/teacherHub.ts", "utf8"), /prepChecks\?: import\("\.\/hubPrep"\)\.PrepCheck\[\];/);
});
