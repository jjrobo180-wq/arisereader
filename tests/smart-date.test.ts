import test from "node:test";
import assert from "node:assert/strict";
import { smartDate, smartLabel } from "../shared/smartDate";

// Friday, October 30, 2026, 10:00 in the morning.
const NOW = new Date(2026, 9, 30, 10, 0);
const r = (s: string) => smartDate(s, NOW);

test("smart dates: days", () => {
  assert.deepEqual(r("dentist tomorrow 3pm"), { title: "dentist", date: "2026-10-31", time: "15:00", matched: "tomorrow 3pm" });
  assert.equal(r("call mom today")?.date, "2026-10-30");
  assert.equal(r("pay rent day after tomorrow")?.date, "2026-11-01");
  assert.equal(r("gym in 2 days")?.date, "2026-11-01");
  assert.equal(r("trip in 2 weeks")?.date, "2026-11-13");
  assert.equal(r("lunch monday")?.date, "2026-11-02");
  assert.equal(r("review friday")?.date, "2026-11-06", "today is Friday: the next one");
  assert.equal(r("review this friday")?.date, "2026-10-30");
  assert.equal(r("meeting next tuesday")?.date, "2026-11-03", "Tuesday is in next week already");
  assert.equal(r("report due 11/5")?.date, "2026-11-05");
  assert.equal(r("taxes 4/15")?.date, "2027-04-15", "a past day this year means next year");
  assert.equal(r("party on Nov 21st")?.date, "2026-11-21");
  assert.equal(r("party 21 November 2026")?.date, "2026-11-21");
  assert.equal(r("bills on the 1st")?.date, "2026-11-01");
  assert.equal(r("dinner tonight")?.time, "20:00");
});

test("smart dates: times, and words taken off the title", () => {
  assert.deepEqual(r("call mom friday at noon"), { title: "call mom", date: "2026-11-06", time: "12:00", matched: "friday at noon" });
  assert.equal(r("standup at 9:30am")?.time, "09:30");
  assert.equal(r("standup at 11:30am")?.date, "2026-10-30", "a time still to come today means today");
  assert.equal(r("pick up kids at 3")?.time, "15:00");
  assert.equal(r("wake at 7am")?.date, "2026-10-31", "a time already gone today means tomorrow");
  assert.equal(r("meeting 12am")?.time, "00:00");
  assert.equal(r("meeting 12pm")?.time, "12:00");
  assert.equal(r("submit report by tomorrow, 5pm")?.title, "submit report");
});

test("smart dates: nothing guessed from plain numbers or words", () => {
  for (const s of ["buy 3 apples", "read chapter 12", "call Sunny", "fix the monitor", "maybe"]) assert.equal(r(s), null, s);
  assert.equal(smartLabel({ title: "x", date: "2026-10-31", time: "15:00", matched: "" }, NOW), "Tomorrow at 3:00 PM");
  assert.equal(smartLabel({ title: "x", date: "2026-11-04", time: "", matched: "" }, NOW), "Wed, Nov 4");
});
