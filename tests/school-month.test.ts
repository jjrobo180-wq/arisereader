import test from "node:test";
import assert from "node:assert/strict";
import { monthEndMs, monthLabel, monthStartMs, nextYearMonth, previousYearMonth, recentSchoolMonths, schoolYearMonth, timeLeft } from "../shared/schoolMonth";
import * as serverTime from "../server/schoolTime";

test("the school's month turns over at midnight Mountain Time, not UTC", () => {
  // 11:30 pm on Oct 31 in Denver (MDT, UTC-6) is already Nov 1 in UTC
  assert.equal(schoolYearMonth(Date.UTC(2026, 10, 1, 5, 30)), "2026-10");
  // 12:00:01 am Nov 1 in Denver (now MDT until Nov 1 2am)
  assert.equal(schoolYearMonth(Date.UTC(2026, 10, 1, 6, 0, 1)), "2026-11");
  // in winter Denver is UTC-7
  assert.equal(schoolYearMonth(Date.UTC(2027, 0, 1, 6, 59)), "2026-12");
  assert.equal(schoolYearMonth(Date.UTC(2027, 0, 1, 7, 0)), "2027-01");
});

test("a month ends exactly when the next one starts", () => {
  assert.equal(monthEndMs("2026-10"), Date.UTC(2026, 10, 1, 6, 0));
  assert.equal(monthEndMs("2026-12"), monthStartMs("2027-01"));
  assert.equal(monthEndMs("2026-12"), Date.UTC(2027, 0, 1, 7, 0));
  assert.equal(schoolYearMonth(monthEndMs("2026-10") - 1), "2026-10");
  assert.equal(schoolYearMonth(monthEndMs("2026-10")), "2026-11");
});

test("month names and lists", () => {
  assert.equal(monthLabel("2026-10"), "October 2026");
  assert.equal(nextYearMonth("2026-12"), "2027-01");
  assert.equal(previousYearMonth("2027-01"), "2026-12");
  assert.deepEqual(recentSchoolMonths(3, Date.UTC(2027, 0, 15)), ["2027-01", "2026-12", "2026-11"]);
});

test("the countdown splits time left into days, hours, minutes and seconds", () => {
  assert.deepEqual(timeLeft(((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000), { days: 2, hours: 3, minutes: 4, seconds: 5 });
  assert.deepEqual(timeLeft(-5000), { days: 0, hours: 0, minutes: 0, seconds: 0 });
});

test("the server keeps using the same month rules", () => {
  assert.equal(serverTime.monthStartMs, monthStartMs);
  assert.equal(serverTime.nextYearMonth("2026-10"), "2026-11");
});
