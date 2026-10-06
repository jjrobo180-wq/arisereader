// Run with: npx tsx --test tests/meeting-poll-routes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryPollStore, pollBookedEmail, pollInviteEmail, registerMeetingPollRoutes } from "../server/meetingPoll";

type Sent = { to: string; subject: string; html: string; replyTo?: string };

function setup(opts: { allow?: boolean; failEmailTo?: string } = {}) {
  const routes: Record<string, Function> = {};
  const add = (method: string) => (path: string, ...handlers: Function[]) => { routes[`${method} ${path}`] = handlers[handlers.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST"), delete: add("DELETE") };
  const sent: Sent[] = [];
  const fromNames: string[] = [];
  let clock = Date.parse("2026-10-06T18:00:00Z");
  const store = createMemoryPollStore();
  registerMeetingPollRoutes(app, ((_q: any, _s: any, n: any) => n()) as any, {
    gate: async (_req, res) => (opts.allow === false ? (res.status(402).json({ message: "Teacher Hub needed" }), null) : {}),
    sendEmail: async (to, subject, html, options) => {
      fromNames.push(String(options?.fromName));
      if (to === opts.failEmailTo) return { sent: false, error: "bounced" };
      sent.push({ to, subject, html, replyTo: options?.replyTo });
      return { sent: true };
    },
    appUrl: "https://www.arisereader.com/", store, now: () => clock,
  });
  const call = async (key: string, req: any) => {
    let code = 200; let payload: any;
    const res: any = { set() { return res; }, status(c: number) { code = c; return res; }, json(d: any) { payload = d; return res; } };
    await routes[key]({ body: {}, params: {}, headers: {}, user: { id: 7, displayName: "Ms. Rivera", email: "rivera@school.org" }, ...req }, res);
    return { code, body: payload };
  };
  return { call, sent, fromNames, store, tick: (ms: number) => { clock += ms; } };
}

const poll = () => ({
  title: "IEP meeting for Jordan", location: "Room 4", message: "Thank you!",
  options: [{ date: "2026-10-13", start: "15:30", end: "16:30" }, { date: "2026-10-14", start: "08:15" }],
  invitees: [{ name: "Ms. Lee", email: "lee@example.com", role: "Parent or guardian" }, { name: "Coach", email: "coach@school.org", role: "Staff" }],
});
const tokenOf = (html: string) => /#\/meet\/([\w-]+)/.exec(html)![1];

test("creating a poll emails each person their own private link, replies go to the teacher", async () => {
  const t = setup();
  const r = await t.call("POST /api/teacher-hub/polls", { body: poll() });
  assert.equal(r.code, 201);
  assert.equal(r.body.notSent, 0);
  assert.equal(t.sent.length, 2);
  assert.deepEqual(t.sent.map((s) => s.to).sort(), ["coach@school.org", "lee@example.com"]);
  assert.ok(t.sent.every((s) => s.replyTo === "rivera@school.org"));
  assert.notEqual(tokenOf(t.sent[0].html), tokenOf(t.sent[1].html));
  assert.match(t.sent[0].html, /Tuesday, Oct 13 · 3:30 PM – 4:30 PM/);
  assert.match(t.sent[0].html, /https:\/\/www\.arisereader\.com\/#\/meet\//);
  assert.match(t.sent[0].subject, /Which times work for IEP meeting for Jordan/);
  assert.equal(r.body.poll.invitees[0].token, undefined); // the teacher's view never carries the private links
});

test("a person who can't be emailed is reported, and bad input is refused", async () => {
  const t = setup({ failEmailTo: "coach@school.org" });
  const r = await t.call("POST /api/teacher-hub/polls", { body: poll() });
  assert.equal(r.body.notSent, 1);
  assert.equal(r.body.poll.invitees.find((i: any) => i.email === "coach@school.org").emailSent, false);
  const bad = await t.call("POST /api/teacher-hub/polls", { body: { ...poll(), options: [] } });
  assert.equal(bad.code, 400);
  const no = setup({ allow: false });
  assert.equal((await no.call("POST /api/teacher-hub/polls", { body: poll() })).code, 402);
  assert.equal(no.sent.length, 0);
});

test("a guest sees only the meeting and their own answers, and can change them", async () => {
  const t = setup();
  await t.call("POST /api/teacher-hub/polls", { body: poll() });
  const token = tokenOf(t.sent.find((s) => s.to === "lee@example.com")!.html);
  const seen = await t.call("GET /api/meeting-poll/:token", { params: { token } });
  assert.equal(seen.code, 200);
  assert.deepEqual(Object.keys(seen.body).sort(), ["answered", "answers", "chosen", "comment", "guest", "location", "message", "options", "status", "title"]);
  assert.equal(seen.body.guest, "Ms. Lee");
  assert.equal(seen.body.answered, false);
  const saved = await t.call("POST /api/meeting-poll/:token", { params: { token }, body: { answers: { o1: "yes", o2: "no", o9: "yes" }, comment: "Mornings are hard." } });
  assert.equal(saved.code, 200);
  const again = await t.call("GET /api/meeting-poll/:token", { params: { token } });
  assert.deepEqual(again.body.answers, { o1: "yes", o2: "no" });
  assert.equal(again.body.answered, true);
  assert.equal((await t.call("POST /api/meeting-poll/:token", { params: { token }, body: { answers: { o9: "yes" } } })).code, 400);
  const mine = await t.call("GET /api/teacher-hub/polls", {});
  assert.equal(mine.body.polls[0].invitees.find((i: any) => i.name === "Ms. Lee").answers.o1, "yes");
  assert.equal(mine.body.polls[0].best, "o1");
});

test("wrong links get a plain refusal and are slowed down", async () => {
  const t = setup();
  const miss = await t.call("GET /api/meeting-poll/:token", { params: { token: "x".repeat(32) } });
  assert.equal(miss.code, 404);
  assert.equal((await t.call("GET /api/meeting-poll/:token", { params: { token: "short" } })).code, 404);
  for (let i = 0; i < 30; i++) await t.call("GET /api/meeting-poll/:token", { params: { token: "y".repeat(30) } });
  assert.equal((await t.call("GET /api/meeting-poll/:token", { params: { token: "z".repeat(30) } })).code, 429);
});

test("reminders go only to people who haven't answered, a few times a day", async () => {
  const t = setup();
  const made = await t.call("POST /api/teacher-hub/polls", { body: poll() });
  const lee = tokenOf(t.sent.find((s) => s.to === "lee@example.com")!.html);
  await t.call("POST /api/meeting-poll/:token", { params: { token: lee }, body: { answers: { o1: "yes" } } });
  t.sent.length = 0;
  const r = await t.call("POST /api/teacher-hub/polls/:id/remind", { params: { id: made.body.poll.id } });
  assert.deepEqual(r.body, { sent: 1, failed: 0 });
  assert.deepEqual(t.sent.map((s) => s.to), ["coach@school.org"]);
  assert.match(t.sent[0].subject, /^Reminder:/);
  await t.call("POST /api/teacher-hub/polls/:id/remind", { params: { id: made.body.poll.id } });
  await t.call("POST /api/teacher-hub/polls/:id/remind", { params: { id: made.body.poll.id } });
  assert.equal((await t.call("POST /api/teacher-hub/polls/:id/remind", { params: { id: made.body.poll.id } })).code, 429);
});

test("choosing a time closes the poll and tells everyone", async () => {
  const t = setup();
  const made = await t.call("POST /api/teacher-hub/polls", { body: { ...poll(), hubMeetingId: "m1" } });
  const lee = tokenOf(t.sent.find((s) => s.to === "lee@example.com")!.html);
  t.sent.length = 0;
  assert.equal((await t.call("POST /api/teacher-hub/polls/:id/choose", { params: { id: made.body.poll.id }, body: { optionId: "o7" } })).code, 400);
  const r = await t.call("POST /api/teacher-hub/polls/:id/choose", { params: { id: made.body.poll.id }, body: { optionId: "o2", notify: true } });
  assert.equal(r.code, 200);
  assert.equal(r.body.told, 2);
  assert.equal(r.body.hubMeetingId, "m1");
  assert.equal(r.body.option.label, "Wednesday, Oct 14 · 8:15 AM");
  assert.match(t.sent[0].html, /Wednesday, Oct 14 · 8:15 AM/);
  const page = await t.call("GET /api/meeting-poll/:token", { params: { token: lee } });
  assert.equal(page.body.status, "booked");
  assert.equal(page.body.chosen, "Wednesday, Oct 14 · 8:15 AM");
  assert.equal((await t.call("POST /api/meeting-poll/:token", { params: { token: lee }, body: { answers: { o1: "yes" } } })).code, 409);
});

test("a teacher can choose without emailing, and can only touch their own polls", async () => {
  const t = setup();
  const made = await t.call("POST /api/teacher-hub/polls", { body: poll() });
  t.sent.length = 0;
  const r = await t.call("POST /api/teacher-hub/polls/:id/choose", { params: { id: made.body.poll.id }, body: { optionId: "o1", notify: false } });
  assert.equal(r.body.told, 0);
  assert.equal(t.sent.length, 0);
  const other = { user: { id: 99, displayName: "Other" } };
  assert.equal((await t.call("POST /api/teacher-hub/polls/:id/choose", { ...other, params: { id: made.body.poll.id }, body: { optionId: "o1" } })).code, 404);
  assert.equal((await t.call("GET /api/teacher-hub/polls", other)).body.polls.length, 0);
  await t.call("DELETE /api/teacher-hub/polls/:id", { ...other, params: { id: made.body.poll.id } });
  assert.equal((await t.call("GET /api/teacher-hub/polls", {})).body.polls.length, 1);
  await t.call("DELETE /api/teacher-hub/polls/:id", { params: { id: made.body.poll.id } });
  assert.equal((await t.call("GET /api/teacher-hub/polls", {})).body.polls.length, 0);
});

test("a teacher can't send an endless number of emails in a day", async () => {
  const t = setup();
  const many = (n: number) => ({ ...poll(), invitees: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, email: `p${i}-${Math.random().toString(36).slice(2)}@x.org` })) });
  for (let i = 0; i < 4; i++) assert.equal((await t.call("POST /api/teacher-hub/polls", { body: many(20) })).code, 201);
  assert.equal((await t.call("POST /api/teacher-hub/polls", { body: many(2) })).code, 429);
  t.tick(25 * 3600_000);
  assert.equal((await t.call("POST /api/teacher-hub/polls", { body: many(2) })).code, 201);
});

test("emails escape what people typed", () => {
  const html = pollInviteEmail({ guest: "<b>Al</b>", teacher: "T & Co", title: "A \"B\"", location: "", message: "<script>x</script>", options: [{ id: "o1", date: "2026-10-13", start: "09:00", end: "" }], link: "https://x.y/#/meet/abc" });
  assert.ok(!html.includes("<script>") && !html.includes("<b>Al"));
  assert.match(html, /T &amp; Co/);
  assert.match(pollBookedEmail({ guest: "G", teacher: "T", title: "<i>", location: "Room", when: "Tue" }), /&lt;i&gt;/);
});

test("the teacher can choose the name and reply address; reminders and the final email use them too", async () => {
  const t = setup();
  const made = await t.call("POST /api/teacher-hub/polls", { body: { ...poll(), senderName: "Maria R., 4th grade", replyTo: "maria.personal@example.com" } });
  assert.equal(made.code, 201);
  assert.ok(t.sent.every((s) => s.replyTo === "maria.personal@example.com"));
  assert.ok(t.fromNames.every((n) => n === "Maria R., 4th grade"));
  assert.match(t.sent[0].html, /Maria R\., 4th grade is trying/);
  assert.equal(made.body.poll.replyTo, "maria.personal@example.com");
  t.sent.length = 0; t.fromNames.length = 0;
  await t.call("POST /api/teacher-hub/polls/:id/remind", { params: { id: made.body.poll.id } });
  await t.call("POST /api/teacher-hub/polls/:id/choose", { params: { id: made.body.poll.id }, body: { optionId: "o1" } });
  assert.equal(t.sent.length, 4);
  assert.ok(t.sent.every((s) => s.replyTo === "maria.personal@example.com"));
  assert.ok(t.fromNames.every((n) => n === "Maria R., 4th grade"));
  const bad = await t.call("POST /api/teacher-hub/polls", { body: { ...poll(), replyTo: "nope" } });
  assert.equal(bad.code, 400);
});
