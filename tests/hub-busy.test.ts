import test from "node:test";
import assert from "node:assert/strict";
import { bookedOn, bookedTimes, clashes } from "../shared/hubBusy";
import { suggestTimes } from "../shared/availability";

const ev = (over: any) => ({ id: over.id || "e", title: "Event", date: "2026-10-13", start: "", end: "", location: "", notes: "", ...over });
const ws: any = {
  events: [
    ev({ id: "a", title: "Staff lunch", start: "12:00", end: "13:00" }),
    ev({ id: "b", title: "Parent call", start: "09:00" }),
    ev({ id: "c", title: "Spirit week", start: "" }),
    ev({ id: "d", title: "IEP for Sam", start: "14:00", end: "15:00", meetingId: "m-booked" }),
    ev({ id: "h", title: "Hidden thing", start: "10:00", end: "11:00" }),
  ],
  hiddenEvents: [{ id: "r", title: "Hidden thing", date: "", start: "" }],
  meetings: [
    { id: "m-booked", student: "Sam", type: "IEP", date: "2026-10-13", time: "14:00", end: "15:00", notes: "", done: false },
    { id: "m-plain", student: "Ari", type: "Annual review", date: "2026-10-13", time: "10:30", end: "11:30", notes: "", done: false },
    { id: "m-done", student: "Old", type: "IEP", date: "2026-10-13", time: "08:00", notes: "", done: true },
    { id: "m-notime", student: "Lee", type: "IEP", date: "2026-10-13", time: "", notes: "", done: false },
    { id: "m-self", student: "Me", type: "IEP", date: "2026-10-13", time: "13:00", notes: "", done: false },
  ],
};

test("booked times include calendar events and meetings that have no calendar event", () => {
  const list = bookedTimes(ws, "2026-10-07", "2026-11-30", "m-self");
  assert.deepEqual(list.map((b) => `${b.start} ${b.title}`), ["09:00 Parent call", "10:30 Annual review for Ari", "12:00 Staff lunch", "14:00 IEP for Sam"]);
  assert.ok(list.find((b) => b.title.startsWith("Annual"))!.meeting);
  assert.ok(!list.find((b) => b.title === "Staff lunch")!.meeting);
  assert.equal(list.filter((b) => b.title.includes("Sam")).length, 1, "a meeting with its calendar event is counted once");
});

test("the meeting being scheduled never clashes with itself", () => {
  assert.ok(!bookedTimes(ws, "2026-10-07", "2026-11-30", "m-booked").some((b) => b.title.includes("Sam")));
});

test("clashes and the day's bookings", () => {
  const list = bookedTimes(ws, "2026-10-07", "2026-11-30");
  assert.equal(bookedOn(list, "2026-10-13").length, 5);
  assert.deepEqual(clashes(list, { date: "2026-10-13", start: "10:00", end: "11:00" }).map((b) => b.title), ["Annual review for Ari"]);
  assert.deepEqual(clashes(list, { date: "2026-10-13", start: "11:30", end: "12:00" }), []);
  assert.deepEqual(clashes(list, { date: "2026-10-13", start: "08:30", end: "09:30" }).map((b) => b.title), ["Parent call"], "a booking with no end is an hour");
  assert.deepEqual(clashes(list, { date: "2026-10-14", start: "09:00" }), []);
});

test("suggested times stay off everything booked", () => {
  const busy = bookedTimes(ws, "2026-10-07", "2026-11-30");
  const tue = [{ day: 2, start: "08:00", end: "16:00" }];
  const starts = suggestTimes(tue, { from: "2026-10-07", minutes: 60, perDay: 8, count: 8, busy, through: "2026-10-13" }).map((t) => t.start);
  assert.deepEqual(starts, ["08:00", "15:00"]); // 13:00 is another meeting (m-self)
  assert.ok(!starts.includes("09:00") && !starts.includes("10:30") && !starts.includes("12:00") && !starts.includes("14:00"));
});
