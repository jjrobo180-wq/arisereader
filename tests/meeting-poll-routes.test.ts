// Run with: npx tsx --test tests/meeting-poll-routes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createMemoryPollStore, pollBookedEmail, pollInviteEmail, registerMeetingPollRoutes } from "../server/meetingPoll";

type Sent = { to: string; subject: string; html: string; replyTo?: string };

function setup(opts: { allow?: boolean; failEmailTo?: string; mailbox?: "ok" | "revoked" | "none"; text?: boolean; teacher?: boolean } = {}) {
  const routes: Record<string, Function> = {};
  const add = (method: string) => (path: string, ...handlers: Function[]) => { routes[`${method} ${path}`] = handlers[handlers.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE") };
  const sent: Sent[] = [];
  const fromNames: string[] = [];
  let clock = Date.parse("2026-10-06T18:00:00Z");
  const store = createMemoryPollStore();
  const viaMailbox: { to: string; subject: string; fromName?: string }[] = [];
  const texts: { to: string; body: string }[] = [];
  const pushes: { id: number; title: string; body: string }[] = [];
  const teacher = opts.teacher ? { contact: async () => ({ email: "rivera@school.org", name: "Ms. Rivera" }), notify: async (id: number, m: any) => { pushes.push({ id, title: m.title, body: m.body }); return 1; } } : undefined;
  const text = opts.text ? { send: async (to: string, body: string) => { texts.push({ to, body }); return { sent: true }; } } : undefined;
  const mailbox = opts.mailbox ? {
    status: async () => (opts.mailbox === "none" ? null : { email: "maria@school.org", needsReconnect: false }),
    send: async (_id: number, m: any) => { if (opts.mailbox === "revoked") return { sent: false, error: "revoked", reconnect: true }; viaMailbox.push({ to: m.to, subject: m.subject, fromName: m.fromName }); return { sent: true }; },
  } : undefined;
  registerMeetingPollRoutes(app, ((_q: any, _s: any, n: any) => n()) as any, {
    gate: async (_req, res) => (opts.allow === false ? (res.status(402).json({ message: "Teacher Hub needed" }), null) : {}),
    sendEmail: async (to, subject, html, options) => {
      fromNames.push(String(options?.fromName));
      if (to === opts.failEmailTo) return { sent: false, error: "bounced" };
      sent.push({ to, subject, html, replyTo: options?.replyTo });
      return { sent: true };
    },
    appUrl: "https://www.arisereader.com/", store, now: () => clock, mailbox, text, teacher,
  });
  const call = async (key: string, req: any) => {
    let code = 200; let payload: any;
    const res: any = { set() { return res; }, status(c: number) { code = c; return res; }, json(d: any) { payload = d; return res; } };
    await routes[key]({ body: {}, params: {}, headers: {}, user: { id: 7, displayName: "Ms. Rivera", email: "rivera@school.org" }, ...req }, res);
    return { code, body: payload };
  };
  return { call, routes, sent, texts, pushes, viaMailbox, fromNames, store, tick: (ms: number) => { clock += ms; } };
}

const poll = () => ({
  title: "IEP meeting for Jordan", location: "Room 4", message: "Thank you!",
  options: [{ date: "2026-10-13", start: "15:30", end: "16:30" }, { date: "2026-10-14", start: "08:15" }],
  invitees: [{ name: "Ms. Lee", email: "lee@example.com", role: "Parent or guardian" }, { name: "Coach", email: "coach@school.org", role: "Staff" }],
});
const tokenOf = (html: string) => /\/meet\/([\w-]+)/.exec(html)![1];

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
  assert.match(t.sent[0].html, /https:\/\/www\.arisereader\.com\/meet\//);
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

test("when the database can't answer, a guest is told to try again and the link is not blamed", async () => {
  const t = setup();
  await t.call("POST /api/teacher-hub/polls", { body: poll() });
  const token = tokenOf(t.sent[0].html);
  const working = t.store.byToken.bind(t.store);
  t.store.byToken = async () => { throw new Error("connection refused"); };
  for (let i = 0; i < 40; i++) {
    const r = await t.call("GET /api/meeting-poll/:token", { params: { token } });
    assert.equal(r.code, 503);
    assert.match(r.body.message, /try the same link again/i);
  }
  t.store.byToken = working;
  assert.equal((await t.call("GET /api/meeting-poll/:token", { params: { token } })).code, 200, "40 outage tries did not lock this person out");
});

test("reminders go only to people who haven't answered, a few times a day", async () => {
  const t = setup();
  const made = await t.call("POST /api/teacher-hub/polls", { body: poll() });
  const lee = tokenOf(t.sent.find((s) => s.to === "lee@example.com")!.html);
  await t.call("POST /api/meeting-poll/:token", { params: { token: lee }, body: { answers: { o1: "yes" } } });
  t.sent.length = 0;
  const r = await t.call("POST /api/teacher-hub/polls/:id/remind", { params: { id: made.body.poll.id } });
  assert.deepEqual([r.body.sent, r.body.failed, r.body.mailboxProblem], [1, 0, null]);
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

test("sending from the teacher's own mailbox: needs a connection, skips the site's sender, covers reminders and the final email", async () => {
  const none = setup({ mailbox: "none" });
  const refused = await none.call("POST /api/teacher-hub/polls", { body: { ...poll(), sendVia: "mailbox" } });
  assert.equal(refused.code, 400);
  assert.match(refused.body.message, /Connect your Gmail or Outlook/);
  assert.equal(none.sent.length + none.viaMailbox.length, 0);

  const t = setup({ mailbox: "ok" });
  const made = await t.call("POST /api/teacher-hub/polls", { body: { ...poll(), sendVia: "mailbox", senderName: "Maria R." } });
  assert.equal(made.code, 201);
  assert.equal(made.body.poll.sendVia, "mailbox");
  assert.equal(made.body.mailboxProblem, null);
  assert.equal(t.sent.length, 0);
  assert.deepEqual(t.viaMailbox.map((m) => m.to).sort(), ["coach@school.org", "lee@example.com"]);
  assert.ok(t.viaMailbox.every((m) => m.fromName === "Maria R."));
  await t.call("POST /api/teacher-hub/polls/:id/remind", { params: { id: made.body.poll.id } });
  await t.call("POST /api/teacher-hub/polls/:id/choose", { params: { id: made.body.poll.id }, body: { optionId: "o1" } });
  assert.equal(t.viaMailbox.length, 6);
  assert.equal(t.sent.length, 0);
  // the normal way is unchanged
  const plain = await t.call("POST /api/teacher-hub/polls", { body: poll() });
  assert.equal(plain.body.poll.sendVia, "site");
  assert.equal(t.sent.length, 2);
});

test("if the connected mailbox stops working, the emails still go out from the site and the teacher is told", async () => {
  const t = setup({ mailbox: "revoked" });
  const made = await t.call("POST /api/teacher-hub/polls", { body: { ...poll(), sendVia: "mailbox" } });
  assert.equal(made.code, 201);
  assert.equal(made.body.mailboxProblem, "reconnect");
  assert.equal(made.body.notSent, 0);
  assert.equal(t.sent.length, 2);
  assert.ok(t.sent.every((s) => s.replyTo === "rivera@school.org"));
});

test("send it yourself: nothing is sent, the teacher gets each person's own link, and can mark who they've sent it to", async () => {
  const t = setup({ text: true });
  const made = await t.call("POST /api/teacher-hub/polls", { body: { ...poll(), sendVia: "self", sendText: true, invitees: [{ name: "Ms. Lee", phone: "(303) 555-0142", role: "Parent or guardian" }, { name: "Mr. Park" }, { name: "Coach", email: "coach@school.org" }] } });
  assert.equal(made.code, 201);
  assert.equal(made.body.notSent, 0);
  assert.equal(t.sent.length + t.texts.length, 0);
  const people = made.body.poll.invitees;
  assert.equal(made.body.poll.sendVia, "self");
  assert.ok(people.every((p: any) => /^https:\/\/www\.arisereader\.com\/meet\/[\w-]{20,}$/.test(p.link) && p.emailSent === false));
  assert.equal(new Set(people.map((p: any) => p.link)).size, 3);
  assert.equal(people[0].phone, "+13035550142");
  // each person's link works
  const token = people[1].link.split("/meet/")[1];
  assert.equal((await t.call("GET /api/meeting-poll/:token", { params: { token } })).body.guest, "Mr. Park");
  // reminders from the server are refused; marking works
  assert.equal((await t.call("POST /api/teacher-hub/polls/:id/remind", { params: { id: made.body.poll.id } })).code, 409);
  assert.equal((await t.call("POST /api/teacher-hub/polls/:id/sent", { params: { id: made.body.poll.id }, body: { inviteeId: people[0].id } })).code, 200);
  assert.equal((await t.call("POST /api/teacher-hub/polls/:id/sent", { params: { id: made.body.poll.id }, body: { inviteeId: "nobody" } })).code, 404);
  assert.equal((await t.call("POST /api/teacher-hub/polls/:id/sent", { user: { id: 99 }, params: { id: made.body.poll.id }, body: { inviteeId: people[0].id } })).code, 404);
  const listed = (await t.call("GET /api/teacher-hub/polls", {})).body;
  assert.deepEqual(listed.polls[0].invitees.map((p: any) => p.emailSent), [true, false, false]);
  assert.equal(listed.textAvailable, true);
  // booking doesn't email anyone either; the teacher tells people themselves
  const booked = await t.call("POST /api/teacher-hub/polls/:id/choose", { params: { id: made.body.poll.id }, body: { optionId: "o1", notify: true } });
  assert.deepEqual([booked.body.told, booked.body.selfSend], [0, true]);
  assert.equal(t.sent.length + t.texts.length, 0);
});

test("texting: people with a phone get a text (alongside email if they have one), reminders and the final time too", async () => {
  const t = setup({ text: true });
  const body = { ...poll(), sendText: true, textConsent: true, senderName: "Maria R.", invitees: [{ name: "Ms. Lee", email: "lee@example.com", phone: "303-555-0142" }, { name: "Dad", phone: "303-555-0199" }, { name: "Coach", email: "coach@school.org" }] };
  const made = await t.call("POST /api/teacher-hub/polls", { body });
  assert.equal(made.code, 201);
  assert.equal(made.body.notSent, 0);
  assert.deepEqual(t.sent.map((s) => s.to).sort(), ["coach@school.org", "lee@example.com"]);
  assert.deepEqual(t.texts.map((x) => x.to).sort(), ["+13035550142", "+13035550199"]);
  assert.match(t.texts[0].body, /^Hi (Ms\. Lee|Dad)! Maria R\. asks: which times work for IEP meeting for Jordan\? Tap to answer \(1 minute, no account\): https:\/\/www\.arisereader\.com\/meet\//);
  t.sent.length = 0; t.texts.length = 0;
  await t.call("POST /api/teacher-hub/polls/:id/remind", { params: { id: made.body.poll.id } });
  assert.equal(t.texts.length, 2);
  assert.ok(t.texts.every((x) => x.body.startsWith("Reminder: ")));
  t.texts.length = 0;
  const booked = await t.call("POST /api/teacher-hub/polls/:id/choose", { params: { id: made.body.poll.id }, body: { optionId: "o2" } });
  assert.equal(booked.body.told, 3);
  assert.deepEqual(t.texts.map((x) => x.to).sort(), ["+13035550142", "+13035550199"]);
  assert.match(t.texts[0].body, /IEP meeting for Jordan is set for Wednesday, Oct 14 · 8:15 AM \(Room 4\)/);
  // a person with no way to be reached is flagged
  const none = setup({ text: true });
  const m2 = await none.call("POST /api/teacher-hub/polls", { body: { ...poll(), invitees: [{ name: "Ms. Lee", email: "lee@example.com" }] } });
  assert.equal(none.texts.length, 0);
  assert.equal(m2.body.notSent, 0);
});

test("texting needs the site to have it, the teacher's OK, and has a daily limit", async () => {
  const off = setup();
  const r = await off.call("POST /api/teacher-hub/polls", { body: { ...poll(), sendText: true, textConsent: true, invitees: [{ name: "Dad", phone: "303-555-0199" }] } });
  assert.equal(r.code, 400);
  assert.match(r.body.message, /Texting isn't set up/);
  assert.equal((await off.call("GET /api/teacher-hub/polls", {})).body.textAvailable, false);
  const t = setup({ text: true });
  const noOk = await t.call("POST /api/teacher-hub/polls", { body: { ...poll(), sendText: true, invitees: [{ name: "Dad", phone: "303-555-0199" }] } });
  assert.equal(noOk.code, 400);
  const phones = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `P${i}`, phone: `303-555-${String(1000 + i).padStart(4, "0")}` }));
  for (let i = 0; i < 3; i++) assert.equal((await t.call("POST /api/teacher-hub/polls", { body: { ...poll(), sendText: true, textConsent: true, invitees: phones(20) } })).code, 201);
  assert.equal(t.texts.length, 60);
  assert.equal((await t.call("POST /api/teacher-hub/polls", { body: { ...poll(), sendText: true, textConsent: true, invitees: phones(2) } })).code, 429);
});

test("the link in emails and texts opens a bare page (no logo or site blurb for link previews) that forwards to the reply page", async () => {
  const t = setup();
  const bare: any = {}; let sent = "";
  const res: any = { set(h: any) { Object.assign(bare, h); return res; }, type() { return res; }, send(b: string) { sent = b; return res; }, status() { return res; }, json() { return res; } };
  const token = "A".repeat(24);
  await (t as any).routes["GET /meet/:token"]({ params: { token } }, res);
  assert.match(sent, /<title>Meeting times<\/title>/);
  assert.doesNotMatch(sent, /og:image|og:title|description/i);
  assert.ok(sent.includes(`location.replace("/#/meet/${token}")`));
  assert.equal(bare["X-Robots-Tag"], "noindex, nofollow");
  sent = "";
  await (t as any).routes["GET /meet/:token"]({ params: { token: "<script>" } }, res);
  assert.ok(sent.includes('location.replace("/")'));
});

test("the teacher is emailed and notified when a person answers, with one email per person", async () => {
  const t = setup({ teacher: true });
  await t.call("POST /api/teacher-hub/polls", { body: poll() });
  const mails = () => t.sent.filter((s) => s.to === "rivera@school.org");
  const token = tokenOf(t.sent.find((s) => s.to === "lee@example.com")!.html);
  const idle = () => new Promise((r) => setTimeout(r, 25));
  await t.call("POST /api/meeting-poll/:token", { params: { token }, body: { answers: { o1: "yes", o2: "no" }, comment: "Mornings are hard." } });
  await idle();
  assert.equal(mails().length, 1);
  assert.match(mails()[0].html, /Ms\. Lee answered your poll/);
  assert.match(mails()[0].html, /1 of 2 people have answered/);
  assert.match(mails()[0].html, /Mornings are hard/);
  assert.equal(t.pushes.length, 1);
  assert.equal(t.pushes[0].id, 7);
  // Changing an answer pushes again but doesn't send a second email.
  await t.call("POST /api/meeting-poll/:token", { params: { token }, body: { answers: { o1: "maybe" } } });
  await idle();
  assert.equal(mails().length, 1);
  assert.equal(t.pushes.length, 2);
});
