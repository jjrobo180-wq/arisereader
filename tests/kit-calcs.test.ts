// The math behind the Plugin Kit's newer calculators.
// Run with: npx tsx --test tests/kit-calcs.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  attendanceRate, bedtimeFor, clock, finalNeeded, fuelCost, hourlyFromSalary, letterFor, numbersIn, payFromHourly, savingsPlan,
  scoreStats, serviceMinutes, unitPrice, weightedGrade,
} from "../shared/kitCalcs";

test("unit price picks the cheaper option per unit", () => {
  const r = unitPrice(3.99, 12, 5.49, 20)!;
  assert.equal(r.better, "B");
  assert.ok(Math.abs(r.a - 0.3325) < 1e-9 && Math.abs(r.b! - 0.2745) < 1e-9);
  assert.equal(Math.round(r.savePct), 17);
  assert.equal(unitPrice(2, 4, 1, 2)!.better, "same");
  assert.equal(unitPrice(0, 4, 1, 2), null);
  assert.equal(unitPrice(2, 4, 0, 0)!.b, null);
});

test("trip gas cost, one way and round trip, split", () => {
  const one = fuelCost(150, 30, 3.5, false, 1)!;
  assert.deepEqual([one.miles, one.gallons, one.cost], [150, 5, 17.5]);
  const round = fuelCost(150, 30, 3.5, true, 4)!;
  assert.deepEqual([round.miles, round.cost, round.perPerson], [300, 35, 8.75]);
  assert.equal(fuelCost(100, 0, 3, false, 1), null);
});

test("pay: hourly to yearly and back", () => {
  assert.deepEqual(payFromHourly(20, 40, 52), { weekly: 800, monthly: 41600 / 12, yearly: 41600 });
  assert.equal(hourlyFromSalary(41600, 40, 52), 20);
  assert.equal(payFromHourly(0, 40, 52), null);
});

test("savings plan: per week and month, reached, and a past date", () => {
  const r = savingsPlan(1000, 300, "2026-10-11", "2027-01-17")!;
  assert.equal(r.days, 98);
  assert.equal(r.left, 700);
  assert.equal(r.perWeek, 50);
  assert.ok(r.perMonth > 216 && r.perMonth < 218);
  assert.equal(savingsPlan(500, 600, "2026-10-11", "2027-01-01")!.done, true);
  assert.equal(savingsPlan(500, 0, "2026-10-11", "2026-10-01")!.late, true);
  assert.equal(savingsPlan(500, 0, "2026-10-11", "nope"), null);
});

test("bedtime counts back from the wake-up time, across midnight", () => {
  assert.equal(clock(0), "12:00 AM");
  assert.equal(clock(12 * 60), "12:00 PM");
  assert.equal(clock(-30), "11:30 PM");
  const r = bedtimeFor("06:30", 8, 15)!;
  assert.equal(r.bed, "10:15 PM");
  assert.equal(r.wake, "6:30 AM");
  assert.deepEqual(r.options.map((o) => o.bed), ["11:15 PM", "10:15 PM", "9:15 PM", "8:15 PM"]);
  assert.equal(bedtimeFor("25:00", 8, 0), null);
  assert.equal(bedtimeFor("07:00", 0, 0), null);
});

test("score stats: average, median, high, low", () => {
  assert.deepEqual(numbersIn("88, 92\n75\t100%"), [88, 92, 75, 100]);
  assert.deepEqual(scoreStats("88, 92, 75, 100"), { count: 4, mean: 88.75, median: 90, min: 75, max: 100 });
  assert.equal(scoreStats("90 80 70")!.median, 80);
  assert.equal(scoreStats("none here"), null);
});

test("weighted grade from category lines, and weights that don't add to 100", () => {
  const r = weightedGrade("Tests 40 85\nQuizzes, 20, 90\nHomework: 20 100\nClasswork 20 78")!;
  assert.equal(r.rows.length, 4);
  assert.deepEqual(r.rows.map((x) => x.label), ["Tests", "Quizzes", "Homework", "Classwork"]);
  assert.equal(r.weightsAdd, true);
  assert.equal(Math.round(r.grade * 100) / 100, 87.6);
  assert.equal(letterFor(r.grade), "B");
  const off = weightedGrade("Tests 50 80\nHomework 30 100")!;
  assert.equal(off.weightsAdd, false);
  assert.equal(off.grade, 87.5);
  assert.equal(weightedGrade("just words"), null);
});

test("attendance rate and chronic absence at 10%", () => {
  const r = attendanceRate(90, 9)!;
  assert.equal(r.rate, 90);
  assert.equal(r.chronic, true);
  assert.equal(attendanceRate(90, 8)!.chronic, false);
  assert.equal(attendanceRate(10, 11), null);
});

test("service minutes per week, year, and still owed", () => {
  const r = serviceMinutes(30, 2, 36, 10, 500)!;
  assert.deepEqual([r.weekly, r.monthly, r.yearly, r.expected, r.owed], [60, 240, 2160, 600, 100]);
  assert.equal(serviceMinutes(30, 2, 0, 0, -1)!.weeks, 36);
  assert.equal(serviceMinutes(30, 2, 0, 0, -1)!.owed, null);
  assert.equal(serviceMinutes(0, 2, 36, 0, 0), null);
});

test("score needed on the final", () => {
  assert.deepEqual(finalNeeded(85, 20, 90), { needed: 110, possible: false, already: false });
  assert.deepEqual(finalNeeded(88, 25, 85), { needed: 76, possible: true, already: false });
  assert.equal(finalNeeded(95, 20, 70)!.already, true);
  assert.equal(finalNeeded(80, 100, 90), null);
});
