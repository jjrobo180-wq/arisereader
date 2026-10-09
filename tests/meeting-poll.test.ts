// Run with: npx tsx --test tests/meeting-poll.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { cleanAnswers, cleanEmail, cleanPollInput, describeOption, tallyPoll } from "../shared/meetingPoll";

const good = () => ({
  title: "IEP meeting for Jordan", location: "Room 4", message: "Please pick what works.",
  options: [{ date: "2026-10-13", start: "3:30 PM", end: "4:30 PM" }, { date: "2026-10-14", start: "08:15", end: "" }],
  invitees: [{ name: "Ms. Lee", email: " Lee@Example.com ", role: "Parent or guardian" }, { name: "", email: "coach@school.org", role: "Social worker" }],
});

test("a good poll is cleaned up", () => {
  const r = cleanPollInput(good(), "2026-10-06");
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.poll.options, [{ id: "o1", date: "2026-10-13", start: "15:30", end: "16:30" }, { id: "o2", date: "2026-10-14", start: "08:15", end: "" }]);
  assert.deepEqual(r.poll.invitees.map((i) => [i.name, i.email, i.role]), [["Ms. Lee", "lee@example.com", "Parent or guardian"], ["coach", "coach@school.org", "Social worker"]]);
});

test("mistakes come back as one plain sentence", () => {
  const err = (change: (p: any) => void) => { const p = good(); change(p); const r = cleanPollInput(p, "2026-10-06"); assert.ok(!r.ok); return r.ok ? "" : r.error; };
  assert.match(err((p) => { p.title = "  "; }), /name/);
  assert.match(err((p) => { p.options = p.options.slice(0, 1); }), /at least two/);
  assert.match(err((p) => { p.options[0].date = "2026-10-01"; }), /past/);
  assert.match(err((p) => { p.options[0].end = "3:00 PM"; }), /ends before/);
  assert.match(err((p) => { p.options[0].start = ""; }), /start time/);
  assert.match(err((p) => { p.invitees[0].email = "nope"; }), /not a working email/);
  assert.match(err((p) => { p.invitees = []; }), /at least one person/);
  assert.match(err((p) => { p.invitees = Array.from({ length: 21 }, (_, i) => ({ email: `a${i}@x.org` })); }), /20 people/);
});

test("repeats are dropped, and tags are stripped from text", () => {
  const p: any = good();
  p.options.push({ date: "2026-10-13", start: "15:30" });
  p.invitees.push({ name: "Again", email: "LEE@example.com" });
  p.title = "IEP <b>meeting</b>";
  const r = cleanPollInput(p, "2026-10-06");
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.poll.options.length, 2);
  assert.equal(r.poll.invitees.length, 2);
  assert.equal(r.poll.title, "IEP meeting");
});

test("emails and answers", () => {
  assert.equal(cleanEmail("a@b.co"), "a@b.co");
  assert.equal(cleanEmail("a b@c.com"), "");
  assert.equal(cleanEmail("a@b"), "");
  const options = [{ id: "o1", date: "2026-10-13", start: "15:30", end: "" }, { id: "o2", date: "2026-10-14", start: "09:00", end: "" }];
  assert.deepEqual(cleanAnswers({ o1: "yes", o2: "banana", o9: "no" }, options), { o1: "yes" });
});

test("times read in plain words", () => {
  assert.equal(describeOption({ date: "2026-10-13", start: "15:30", end: "16:30" }), "Tuesday, Oct 13 · 3:30 PM – 4:30 PM");
  assert.equal(describeOption({ date: "2026-10-14", start: "08:15", end: "" }), "Wednesday, Oct 14 · 8:15 AM");
});

test("the tally counts everyone and picks the best time", () => {
  const options = [{ id: "o1", date: "2026-10-13", start: "15:30", end: "" }, { id: "o2", date: "2026-10-14", start: "09:00", end: "" }, { id: "o3", date: "2026-10-15", start: "09:00", end: "" }];
  const people = [
    { name: "A", respondedAt: "x", answers: { o1: "yes", o2: "yes", o3: "no" } as any },
    { name: "B", respondedAt: "x", answers: { o1: "no", o2: "yes", o3: "maybe" } as any },
    { name: "C", respondedAt: null, answers: {} },
  ];
  const t = tallyPoll(options, people);
  assert.deepEqual(t.options.map((o) => [o.yes, o.maybe, o.no, o.waiting]), [[1, 0, 1, 1], [2, 0, 0, 1], [0, 1, 1, 1]]);
  assert.equal(t.best, "o2");
  assert.equal(t.options[1].everyone, false);
  assert.equal(tallyPoll(options, [{ name: "A", respondedAt: "x", answers: { o1: "yes", o2: "yes", o3: "yes" } as any }]).options[0].everyone, true);
  assert.equal(tallyPoll(options, []).best, null);
  assert.equal(tallyPoll(options, [people[2]]).best, null);
});

test("any team role can be asked, and a blank role becomes Other", () => {
  const p: any = good();
  p.invitees = [{ email: "a@x.org", role: "Gen ed teacher" }, { email: "b@x.org", role: "OT" }, { email: "c@x.org", role: "" }, { email: "d@x.org", role: "x".repeat(80) }];
  const r = cleanPollInput(p, "2026-10-06");
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.poll.invitees.map((i) => i.role.length > 40 ? "long" : i.role), ["Gen ed teacher", "OT", "Other", "x".repeat(40)]);
});

test("the sender's name and reply address are cleaned and checked", () => {
  const p: any = good();
  p.senderName = ' Ms. "Rivera" <boss@x.org> '; p.replyTo = " Rivera@School.org ";
  const r = cleanPollInput(p, "2026-10-06");
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.poll.senderName, "Ms. Rivera");
  assert.equal(r.poll.replyTo, "rivera@school.org");
  const none = cleanPollInput(good(), "2026-10-06");
  assert.ok(none.ok && none.poll.senderName === "" && none.poll.replyTo === "");
  const bad = cleanPollInput({ ...good(), replyTo: "not an email" }, "2026-10-06");
  assert.ok(!bad.ok && /replies/.test(bad.error));
});
