import test from "node:test";
import assert from "node:assert/strict";
import { cleanCoverage, coverageAsks, coverageRequest, genEdMessage, meetingSpan, needingCoverage } from "../shared/genEdCoverage";

const meeting: any = { id: "m1", student: "Sam Lee", type: "Annual IEP", date: "2026-10-13", time: "09:00", end: "10:00", room: "Room 12", notes: "", done: false };
const ws: any = {
  spedContacts: [{ id: "c1", name: "Ms. Lopez", role: "Gen ed teacher", email: "lopez@school.org" }],
  students: [{ name: "Sam Lee", team: { genEd: "c1" } }], guides: [], meetings: [meeting],
};

test("the gen ed teacher is the one on the student's team, with the meeting time to start", () => {
  const asks = coverageAsks(ws, meeting);
  assert.deepEqual(asks.map((a) => [a.teacher, a.email, a.needs, a.from, a.to]), [["Ms. Lopez", "lopez@school.org", "", "09:00", "10:00"]]);
});

test("saved answers win over the team", () => {
  const saved = { ...meeting, coverage: [{ id: "x", teacher: "Mr. Kim", email: "", needs: "yes", from: "10:00", to: "11:00" }] };
  assert.deepEqual(coverageAsks(ws, saved).map((a) => a.teacher), ["Mr. Kim"]);
});

test("the message to the gen ed teacher has the student, day, time, place and both coverage questions", () => {
  const m = genEdMessage({ teacher: "Ms. Lopez", student: "Sam Lee", meeting, sender: "Mrs. Rivera" });
  assert.match(m.subject, /Sam Lee/);
  assert.match(m.subject, /Tuesday, Oct 13/);
  assert.match(m.body, /^Hi Ms\. Lopez,/);
  assert.match(m.body, /an IEP meeting for Sam Lee on Tuesday, Oct 13 from 9:00 AM to 10:00 AM/);
  assert.match(m.body, /Room 12/);
  assert.match(m.body, /need coverage for your class/);
  assert.match(m.body, /from what time to what time/);
  assert.match(m.body, /Mrs\. Rivera$/);
  assert.doesNotMatch(m.body, /\bpoll\b/i);
});

test("the coverage request lists each teacher and time, in order, and leaves the student out", () => {
  const asks = cleanCoverage([
    { id: "b", teacher: "Mr. Kim", needs: "yes", from: "10:00", to: "11:00" },
    { id: "a", teacher: "Ms. Lopez", needs: "yes", from: "09:00", to: "10:00" },
    { id: "c", teacher: "Ms. Ruiz", needs: "no", from: "09:00", to: "10:00" },
    { id: "d", teacher: "Mr. Pat", needs: "", from: "", to: "" },
    { id: "e", teacher: "Bad Times", needs: "yes", from: "11:00", to: "10:00" },
  ]);
  const r = coverageRequest({ asks, meeting, sender: "Mrs. Rivera", to: "Dana" })!;
  assert.equal(r.count, 2);
  assert.match(r.subject, /Coverage needed Tuesday, Oct 13 for 2 teachers/);
  assert.ok(r.body.indexOf("Ms. Lopez: 9:00 AM to 10:00 AM") < r.body.indexOf("Mr. Kim: 10:00 AM to 11:00 AM"));
  assert.ok(!/Ruiz|Pat|Bad Times|Sam|Lee/.test(r.body));
  assert.match(r.body, /^Hi Dana,/);
  const one = coverageRequest({ asks: asks.slice(0, 1), meeting, sender: "" })!;
  assert.match(one.subject, /Mr\. Kim, 10:00 AM to 11:00 AM/);
  assert.equal(coverageRequest({ asks: asks.filter((a) => a.needs !== "yes"), meeting, sender: "x" }), null);
});

test("coverage lists are cleaned", () => {
  assert.equal(needingCoverage(cleanCoverage([{ id: "a", teacher: "T", needs: "yes", from: "9:00", to: "10:00" }])).length, 1);
  assert.deepEqual(cleanCoverage([{ id: "a", teacher: "" }, { id: "a", teacher: "T" }, { id: "a", teacher: "Dup" }]).map((a) => a.teacher), ["T"]);
  assert.deepEqual(meetingSpan({ time: "", end: "" }), { from: "", to: "" });
  assert.deepEqual(meetingSpan({ time: "13:30", end: "" }), { from: "13:30", to: "14:30" });
});
