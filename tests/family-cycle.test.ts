import test from "node:test";
import assert from "node:assert/strict";
import { cycleSummary, periodsOf, predictedDays } from "../shared/familyCycle";
import type { CycleLog } from "../shared/familyHub";

const flow = (date: string, f: CycleLog["flow"] = "medium"): CycleLog => ({ id: `me:${date}`, memberId: "me", date, flow: f, symptoms: [], note: "" });
const period = (start: string, days: number) => Array.from({ length: days }, (_, i) => { const d = new Date(`${start}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + i); return flow(d.toISOString().slice(0, 10)); });

test("flow days group into periods; spotting and a one-day gap don't split or start one", () => {
  const logs = [...period("2026-08-01", 3), flow("2026-08-05"), flow("2026-08-20", "spotting"), ...period("2026-08-29", 5)];
  assert.deepEqual(periodsOf(logs, "me").map((p) => [p.start, p.end, p.days]), [["2026-08-01", "2026-08-05", 5], ["2026-08-29", "2026-09-02", 5]]);
});

test("averages and predictions from history", () => {
  const logs = [...period("2026-07-04", 5), ...period("2026-08-01", 5), ...period("2026-08-29", 4), ...period("2026-09-27", 5)];
  const s = cycleSummary(logs, "me", "2026-10-09");
  assert.equal(s.cycleLength, 28); // 28, 28, 29 → 28.3
  assert.equal(s.periodLength, 5);
  assert.equal(s.regular, true);
  assert.equal(s.dayOfCycle, 13);
  assert.equal(s.nextStart, "2026-10-25");
  assert.equal(s.daysUntil, 16);
  assert.equal(s.ovulation, "2026-10-11");
  assert.deepEqual([s.fertileStart, s.fertileEnd, s.phase], ["2026-10-06", "2026-10-12", "fertile"]);
  assert.ok(predictedDays(s).period.has("2026-10-25"));
});

test("a late period, one period only, and nothing logged", () => {
  const late = cycleSummary(period("2026-09-01", 5), "me", "2026-10-03");
  assert.equal(late.cycleLength, 28);
  assert.equal(late.fromHistory, false);
  assert.equal(late.late, 4);
  assert.equal(late.nextStart, "2026-10-03");
  assert.equal(cycleSummary([], "me", "2026-10-03").nextStart, null);
  assert.equal(cycleSummary(period("2026-10-01", 3), "me", "2026-10-02").phase, "period");
});
