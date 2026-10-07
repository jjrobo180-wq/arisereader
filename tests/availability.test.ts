// Run with: npx tsx --test tests/availability.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { cleanWeekly, fitOption, suggestAnswers } from "../shared/availability";
import { createMemoryAvailabilityStore, createMemoryPollStore, registerMeetingPollRoutes } from "../server/meetingPoll";

function setup() {
  const routes: Record<string, Function> = {};
  const add = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h[h.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE") };
  const sent: { to: string; html: string }[] = [];
  const store = createMemoryPollStore(); const availability = createMemoryAvailabilityStore();
  registerMeetingPollRoutes(app, ((_q: any, _s: any, n: any) => n()) as any, {
    gate: async () => ({}), sendEmail: async (to, _s, html) => { sent.push({ to, html }); return { sent: true }; },
    appUrl: "https://www.arisereader.com", store, availability, now: () => Date.parse("2026-10-06T18:00:00Z"),
  });
  const call = async (key: string, req: any, user: any = { id: 7, displayName: "Ms. Rivera", email: "r@school.org" }) => {
    let code = 200; let payload: any;
    const res: any = { set() { return res; }, status(c: number) { code = c; return res; }, json(d: any) { payload = d; return res; } };
    await routes[key]({ body: {}, params: {}, headers: {}, user, ...req }, res);
    return { code, body: payload };
  };
  return { call, sent, availability };
}
const tokenOf = (html: string) => /#\/meet\/([\w-]+)/.exec(html)![1];
const poll = () => ({ title: "IEP for Sam", options: [{ date: "2026-10-13", start: "15:30", end: "16:30" }, { date: "2026-10-14", start: "08:15" }], invitees: [{ name: "Ms. Cruz", email: "cruz@school.org", role: "Staff" }] });
const staff = { id: 21, displayName: "Ms. Cruz", email: "cruz@school.org" };

test("free times are cleaned and compared with offered times", () => {
  const weekly = cleanWeekly([{ day: 2, start: "14:00", end: "17:00" }, { day: 9, start: "08:00", end: "09:00" }, { day: 3, start: "10:00", end: "09:00" }, { day: 3, start: "8:00", end: "9:00" }, null]);
  assert.deepEqual(weekly, [{ day: 2, start: "14:00", end: "17:00" }]);
  assert.equal(fitOption(weekly, { date: "2026-10-13", start: "15:30", end: "16:30" }), "free"); // a Tuesday
  assert.equal(fitOption(weekly, { date: "2026-10-13", start: "16:30", end: "17:30" }), "partly");
  assert.equal(fitOption(weekly, { date: "2026-10-14", start: "08:15", end: "" }), "busy");
  assert.equal(fitOption([], { date: "2026-10-14", start: "08:15", end: "" }), "unknown");
  assert.deepEqual(suggestAnswers(weekly, [{ id: "a", date: "2026-10-13", start: "15:30", end: "16:30" }, { id: "b", date: "2026-10-14", start: "08:15", end: "" }]), { a: "yes", b: "no" });
});

test("the teacher can fill in someone's answers for them", async () => {
  const t = setup();
  const made = await t.call("POST /api/teacher-hub/polls", { body: poll() });
  const view = (await t.call("GET /api/teacher-hub/polls", {})).body.polls[0];
  const id = view.invitees[0].id; const o = view.options;
  const bad = await t.call("POST /api/teacher-hub/polls/:id/answer", { params: { id: view.id }, body: { inviteeId: "nope", answers: { [o[0].id]: "yes" } } });
  assert.equal(bad.code, 404);
  const none = await t.call("POST /api/teacher-hub/polls/:id/answer", { params: { id: view.id }, body: { inviteeId: id, answers: {} } });
  assert.equal(none.code, 400);
  const ok = await t.call("POST /api/teacher-hub/polls/:id/answer", { params: { id: view.id }, body: { inviteeId: id, answers: { [o[0].id]: "yes", [o[1].id]: "no", x: "yes" }, comment: "By phone" } });
  assert.equal(ok.code, 200); assert.equal(made.code, 201);
  const after = (await t.call("GET /api/teacher-hub/polls", {})).body.polls[0].invitees[0];
  assert.deepEqual(after.answers, { [o[0].id]: "yes", [o[1].id]: "no" }); assert.equal(after.comment, "By phone"); assert.ok(after.respondedAt);
  // someone else's poll is not theirs to fill in
  const other = await t.call("POST /api/teacher-hub/polls/:id/answer", { params: { id: view.id }, body: { inviteeId: id, answers: { [o[0].id]: "no" } } }, { id: 99 });
  assert.equal(other.code, 404);
});

test("staff link a poll from their private link, answer from their account, and share free times", async () => {
  const t = setup();
  await t.call("POST /api/teacher-hub/polls", { body: poll() });
  const token = tokenOf(t.sent[0].html);
  const link = await t.call("POST /api/meeting-poll/:token/claim", { params: { token } }, staff);
  assert.equal(link.code, 200);
  assert.equal((await t.call("POST /api/meeting-poll/:token/claim", { params: { token } }, { id: 22 })).code, 409);
  assert.equal((await t.call("POST /api/meeting-poll/:token/claim", { params: { token } }, { id: 7 })).code, 400);
  const mine = (await t.call("GET /api/teacher-hub/polls-invited", {}, staff)).body.polls;
  assert.equal(mine.length, 1); assert.equal(mine[0].title, "IEP for Sam");
  assert.equal((await t.call("GET /api/teacher-hub/polls-invited", {}, { id: 22 })).body.polls.length, 0);
  // free times: saved, cleaned, and shown to the teacher for linked people only
  const saved = await t.call("PUT /api/teacher-hub/availability", { body: { weekly: [{ day: 2, start: "15:00", end: "17:00" }, { day: 99, start: "1", end: "2" }] } }, staff);
  assert.deepEqual(saved.body.weekly, [{ day: 2, start: "15:00", end: "17:00" }]);
  assert.deepEqual((await t.call("GET /api/teacher-hub/availability", {}, staff)).body.weekly, saved.body.weekly);
  const teacher = (await t.call("GET /api/teacher-hub/polls", {})).body.polls[0];
  const person = teacher.invitees[0];
  assert.equal(person.linked, true);
  assert.deepEqual(Object.values(person.fit), ["free", "busy"]);
  // answering from the account
  const opts = mine[0].options;
  assert.equal((await t.call("POST /api/teacher-hub/polls-invited/:inviteeId/answer", { params: { inviteeId: mine[0].inviteeId }, body: { answers: { [opts[0].id]: "yes" } } }, { id: 22 })).code, 404);
  assert.equal((await t.call("POST /api/teacher-hub/polls-invited/:inviteeId/answer", { params: { inviteeId: mine[0].inviteeId }, body: { answers: { [opts[0].id]: "yes" } } }, staff)).code, 200);
  assert.ok((await t.call("GET /api/teacher-hub/polls", {})).body.polls[0].invitees[0].respondedAt);
  // removing it from the account stops sharing
  assert.equal((await t.call("DELETE /api/teacher-hub/polls-invited/:inviteeId", { params: { inviteeId: mine[0].inviteeId } }, staff)).code, 200);
  const unlinked = (await t.call("GET /api/teacher-hub/polls", {})).body.polls[0].invitees[0];
  assert.equal(unlinked.linked, false); assert.deepEqual(unlinked.fit, {});
});
