// iPhone Calendar events (client/src/lib/nativeCalendar.ts) in the Hub's shape.
import test from "node:test";
import assert from "node:assert/strict";
import { isIphoneCalendar, toPhoneEvents } from "../client/src/lib/nativeCalendar";

const at = (iso: string) => new Date(iso).getTime();

test("timed, all-day and several-day events become one Hub event per day", () => {
  const got = toPhoneEvents([
    { title: "IEP meeting", startDate: at("2026-11-03T09:30:00"), endDate: at("2026-11-03T10:15:00"), isAllDay: false, location: "Room 4", description: "Bring data" },
    { title: "No school", startDate: at("2026-11-11T00:00:00"), endDate: at("2026-11-12T00:00:00"), isAllDay: true },
    { title: "Conference", startDate: at("2026-11-05T15:00:00"), endDate: at("2026-11-07T11:00:00"), isAllDay: false },
    { title: "Late show", startDate: at("2026-11-08T22:00:00"), endDate: at("2026-11-09T00:00:00"), isAllDay: false },
  ]);
  assert.deepEqual(got.map((e) => `${e.date} ${e.start}-${e.end} ${e.title}`), [
    "2026-11-03 09:30-10:15 IEP meeting",
    "2026-11-05 15:00-23:59 Conference",
    "2026-11-06 - Conference",
    "2026-11-07 00:00-11:00 Conference",
    "2026-11-08 22:00-00:00 Late show",
    "2026-11-11 - No school",
  ]);
  assert.equal(got[0].location, "Room 4");
  assert.equal(got[0].notes, "Bring data");
});

test("bad rows are skipped and a missing title reads Busy", () => {
  assert.deepEqual(toPhoneEvents(null), []);
  const got = toPhoneEvents([{ startDate: "nope" }, { startDate: at("2026-11-03T08:00:00"), endDate: at("2026-11-03T09:00:00") }]);
  assert.equal(got.length, 1);
  assert.equal(got[0].title, "Busy");
});

test("the iPhone's own calendar is told apart from calendar links", () => {
  assert.equal(isIphoneCalendar("iphone:calendar"), true);
  assert.equal(isIphoneCalendar("https://calendar.google.com/x.ics"), false);
  assert.equal(isIphoneCalendar(undefined), false);
});
