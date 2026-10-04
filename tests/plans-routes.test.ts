// Plans and billing, end to end over HTTP with a stand-in for Stripe.
// Run with: npx tsx --test tests/plans-routes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import express from "express";
import { registerPlanRoutes, stripeForm, verifyStripeSignature } from "../server/plans";
import { PLANS } from "../shared/plans";

const NOW = Date.parse("2026-11-15T18:00:00Z");
const DAY = 86_400_000;
const EARLY = "2026-09-10T15:00:00Z", LATE = "2026-10-03T15:00:00Z";
const WHSEC = "whsec_testsecret1234567890";

const USERS: Record<number, any> = {
  1: { id: 1, displayName: "Admin", role: "student", isAdmin: true, createdAt: EARLY },
  50: { id: 50, displayName: "Ms. New", role: "teacher", createdAt: LATE, school_id: 3, email: "new@school.org" },
  51: { id: 51, displayName: "Mr. Early", role: "teacher", createdAt: EARLY, school_id: 3 },
  52: { id: 52, displayName: "Ms. Solo", role: "teacher", createdAt: LATE, school_id: null },
  53: { id: 53, displayName: "Mr. Waiting", role: "teacher", createdAt: LATE, school_id: 3, accountApproved: false },
  10: { id: 10, displayName: "Ada", role: "student", createdAt: LATE, teacherId: 50, school_id: 3 },
  11: { id: 11, displayName: "Ben", role: "student", createdAt: LATE },
  12: { id: 12, displayName: "Cy", role: "student", createdAt: EARLY, teacherId: 51, school_id: 3 },
  80: { id: 80, displayName: "Parent", role: "parent", createdAt: LATE },
  90: { id: 90, username: "sample", displayName: "Sample", role: "student", createdAt: LATE },
};

type Call = { method: string; url: string; auth: string; form: URLSearchParams };

async function setup(t: any, opts: { enforced?: boolean; stripeKey?: string; stripe?: (c: Call) => any; students?: number } = {}) {
  const clock = { now: NOW };
  const settings = new Map<string, string>();
  if (opts.enforced !== false) settings.set("plans_enforced", "1");
  const calls: Call[] = [];
  const app = express();
  app.use(express.json());
  const auth = (req: any, res: any, next: any) => {
    const user = USERS[Number(String(req.headers.authorization || "").replace("Bearer ", ""))];
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    req.user = user; next();
  };
  const admin = (req: any, res: any, next: any) => (req.user?.isAdmin ? next() : res.status(403).json({ message: "Admin access required" }));
  const plans = registerPlanRoutes(app, auth, admin, {
    getSetting: async (k) => settings.get(k) ?? "",
    upsertSetting: async (k, v) => { settings.set(k, v); },
    userForToken: async (token) => USERS[Number(token)] ?? null,
    getUser: async (id) => USERS[id] ?? null,
    countTeacherStudents: async () => opts.students ?? 30,
    countSchoolStudents: async () => 240,
    schoolName: async (id) => (id === 3 ? "Cedar Grove Middle" : ""),
    envStripeKey: () => opts.stripeKey ?? "",
    envWebhookSecret: () => WHSEC,
    now: () => clock.now,
    fetch: (async (url: any, init: any) => {
      const call: Call = { method: init?.method || "GET", url: String(url), auth: init?.headers?.Authorization || "", form: new URLSearchParams(init?.body || "") };
      calls.push(call);
      const out = opts.stripe ? opts.stripe(call) : {};
      const status = out?.__status ?? 200;
      return new Response(JSON.stringify(out), { status, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch,
  });
  // stand-ins for the rest of the site
  app.get("/api/teacher/students", auth, (_req: any, res: any) => res.json({ ok: true }));
  app.get("/api/library", auth, (_req: any, res: any) => res.json({ ok: true }));
  app.post("/api/student/iarise-quiz", auth, async (req: any, res: any) => { if (await plans.blockFreeStudent(req, res)) return; res.json({ ok: true }); });

  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const call = async (user: number | null, method: string, path: string, body?: any, headers: Record<string, string> = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https", ...(user ? { Authorization: `Bearer ${user}` } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
  };
  const hook = (event: any, over: { secret?: string; at?: number; tamper?: boolean } = {}) => {
    const payload = JSON.stringify(event);
    const time = Math.floor((over.at ?? clock.now) / 1000);
    const sig = createHmac("sha256", over.secret ?? WHSEC).update(`${time}.${payload}`).digest("hex");
    return call(null, "POST", "/api/billing/webhook", over.tamper ? payload.replace("active", "actlve") : payload, { "Stripe-Signature": `t=${time},v1=${sig}` });
  };
  return { call, hook, plans, settings, calls, clock };
}

const subscription = (over: any = {}) => ({
  id: "sub_123", customer: "cus_123", status: "active", current_period_end: Math.floor((NOW + 30 * DAY) / 1000),
  metadata: { kind: "teacher", ownerId: "50", buyerId: "50" },
  items: { data: [{ id: "si_1", quantity: 2 }] }, ...over,
});
const event = (type: string, object: any, createdMs = NOW) => ({ id: "evt_" + type, type, created: Math.floor(createdMs / 1000), data: { object } });

test("with plan rules off, nothing is locked", async (t) => {
  const { call } = await setup(t, { enforced: false });
  assert.equal((await call(50, "GET", "/api/teacher/students")).status, 200);
  assert.equal((await call(11, "POST", "/api/student/iarise-quiz", {})).status, 200);
  const plan = (await call(50, "GET", "/api/plan")).body;
  assert.deepEqual([plan.enforced, plan.premium, plan.via], [false, true, "rules-off"]);
});

test("with plan rules on, a teacher account needs Premium", async (t) => {
  const { call } = await setup(t);
  const locked = await call(50, "GET", "/api/teacher/students");
  assert.equal(locked.status, 402);
  assert.equal(locked.body.code, "premium_required");
  assert.equal((await call(50, "GET", "/api/library")).status, 402, "every teacher request stops, not only teacher tools");

  // the locked teacher can still see their plan
  const plan = await call(50, "GET", "/api/plan");
  assert.equal(plan.status, 200);
  assert.deepEqual([plan.body.premium, plan.body.via, plan.body.students, plan.body.school.name], [false, null, 30, "Cedar Grove Middle"]);
  assert.equal(plan.body.prices.teacherMonthlyCents, 1000);

  // signed up before October 1: free this school year
  assert.equal((await call(51, "GET", "/api/teacher/students")).status, 200);
  assert.equal((await call(51, "GET", "/api/plan")).body.via, "grandfathered");
  // admins, students, parents and the sample accounts are never stopped by the teacher check
  for (const who of [1, 10, 11, 80, 90]) assert.equal((await call(who, "GET", "/api/library")).status, 200, `user ${who}`);
  // not signed in: the route's own sign-in check answers
  assert.equal((await call(null, "GET", "/api/library")).status, 401);
});

test("student extras follow the teacher's plan", async (t) => {
  const { call, hook } = await setup(t);
  assert.equal((await call(11, "POST", "/api/student/iarise-quiz", {})).status, 402, "reader with no school");
  assert.equal((await call(10, "POST", "/api/student/iarise-quiz", {})).status, 402, "teacher has no plan");
  assert.equal((await call(12, "POST", "/api/student/iarise-quiz", {})).status, 200, "teacher signed up early");
  assert.equal((await call(90, "POST", "/api/student/iarise-quiz", {})).status, 200, "sample account");
  assert.equal((await call(1, "POST", "/api/student/iarise-quiz", {})).status, 200, "admin");

  assert.equal((await hook(event("customer.subscription.created", subscription()))).status, 200);
  assert.equal((await call(10, "GET", "/api/plan")).body.via, "class");
  assert.equal((await call(10, "POST", "/api/student/iarise-quiz", {})).status, 200, "teacher now has Premium");
});

test("a parent profile follows up to five children on Free", async (t) => {
  const { plans } = await setup(t);
  assert.deepEqual(await plans.parentLinkAllowed([11], 11), { ok: true });
  assert.equal((await plans.parentLinkAllowed([11, 21, 22, 23], 24)).ok, true, "the fifth child");
  const full = await plans.parentLinkAllowed([11, 21, 22, 23, 24], 25);
  assert.equal(full.ok, false);
  assert.match(full.message!, /up to 5 children/);
  assert.equal((await plans.parentLinkAllowed([11, 21, 22, 23, 24], 12)).ok, true, "a child in a Premium class lifts the limit");

  const off = await setup(t, { enforced: false });
  assert.equal((await off.plans.parentLinkAllowed([11, 21, 22, 23, 24, 25], 26)).ok, true);
});

test("a paid teacher plan covers a set number of students", async (t) => {
  const { plans, hook } = await setup(t, { students: 200 });
  await hook(event("customer.subscription.created", subscription()));           // 2 blocks = 200 students
  const full = await plans.seatCheck(USERS[50]);
  assert.equal(full.ok, false);
  assert.match(full.message!, /covers 200 students/);
  assert.equal((await plans.seatCheck(USERS[51])).ok, true, "a grandfathered teacher has no seat limit");
  assert.equal((await plans.seatCheck(USERS[1])).ok, true);
});

test("the webhook only accepts messages signed by Stripe", async (t) => {
  const { call, hook } = await setup(t);
  const sub = event("customer.subscription.created", subscription());
  assert.equal((await hook(sub, { secret: "whsec_someoneelse000000" })).status, 400);
  assert.equal((await hook(sub, { tamper: true })).status, 400);
  assert.equal((await hook(sub, { at: NOW - 3_600_000 })).status, 400, "an hour-old message is a replay");
  assert.equal((await call(null, "POST", "/api/billing/webhook", sub)).status, 400, "no signature");
  assert.equal((await call(50, "GET", "/api/plan")).body.premium, false, "nothing was switched on");

  assert.equal((await hook(sub)).status, 200);
  const plan = (await call(50, "GET", "/api/plan")).body;
  assert.deepEqual([plan.premium, plan.via, plan.seats, plan.teacherPlan.paidOnline], [true, "teacher-plan", 200, true]);
  assert.equal((await call(50, "GET", "/api/teacher/students")).status, 200);
});

test("verifyStripeSignature", () => {
  const payload = '{"id":"evt_1"}', time = Math.floor(NOW / 1000);
  const sig = createHmac("sha256", WHSEC).update(`${time}.${payload}`).digest("hex");
  assert.equal(verifyStripeSignature(payload, `t=${time},v1=${sig}`, WHSEC, NOW), true);
  assert.equal(verifyStripeSignature(Buffer.from(payload), `t=${time},v1=${"0".repeat(64)},v1=${sig}`, WHSEC, NOW), true, "any matching v1");
  assert.equal(verifyStripeSignature(payload + " ", `t=${time},v1=${sig}`, WHSEC, NOW), false);
  assert.equal(verifyStripeSignature(payload, `t=${time + 1},v1=${sig}`, WHSEC, NOW), false, "time is part of what is signed");
  assert.equal(verifyStripeSignature(payload, `t=${time},v1=${sig}`, WHSEC, NOW + 301_000), false);
  assert.equal(verifyStripeSignature(payload, `t=${time},v1=${sig}`, "", NOW), false);
  assert.equal(verifyStripeSignature(payload, `t=${time},v1=short`, WHSEC, NOW), false);
  assert.equal(verifyStripeSignature(payload, undefined, WHSEC, NOW), false);
  assert.equal(verifyStripeSignature(payload, "v1=" + sig, WHSEC, NOW), false);
});

test("renewals, missed payments and cancellations change the plan", async (t) => {
  const { call, hook, clock } = await setup(t);
  await hook(event("customer.subscription.created", subscription()));
  const premium = async () => (await call(50, "GET", "/api/plan")).body.premium;
  assert.equal(await premium(), true);

  // an older event that arrives late is ignored
  await hook(event("customer.subscription.updated", subscription({ status: "canceled" }), NOW - 60_000));
  assert.equal(await premium(), true);

  // a missed payment keeps the class running for a week, then stops
  clock.now = NOW + 31 * DAY;
  await hook(event("customer.subscription.updated", subscription({ status: "past_due", current_period_end: Math.floor((NOW + 60 * DAY) / 1000) }), clock.now), { at: clock.now });
  assert.equal(await premium(), true);
  clock.now += 11 * DAY;
  assert.equal(await premium(), false);

  // paying again switches it back on; cancelling switches it off
  await hook(event("customer.subscription.updated", subscription({ current_period_end: Math.floor((clock.now + 30 * DAY) / 1000) }), clock.now), { at: clock.now });
  assert.equal(await premium(), true);
  clock.now += DAY;
  await hook(event("customer.subscription.deleted", subscription({ status: "canceled" }), clock.now), { at: clock.now });
  assert.equal(await premium(), false);
  assert.equal((await call(50, "GET", "/api/teacher/students")).status, 402);

  // events without our details, or of other kinds, are accepted and change nothing
  assert.equal((await hook(event("customer.subscription.updated", subscription({ metadata: {} }), clock.now), { at: clock.now })).status, 200);
  assert.equal((await hook(event("invoice.paid", { id: "in_1" }, clock.now), { at: clock.now })).status, 200);
  assert.equal(await premium(), false);
});

test("a school plan covers every teacher at the school and their students", async (t) => {
  const { call, hook } = await setup(t);
  await hook(event("customer.subscription.created", subscription({ id: "sub_school", metadata: { kind: "school", ownerId: "3", buyerId: "50" }, items: { data: [{ id: "si_2", quantity: 1 }] }, current_period_end: Math.floor((NOW + 365 * DAY) / 1000) })));
  const plan = (await call(50, "GET", "/api/plan")).body;
  assert.deepEqual([plan.premium, plan.via, plan.seats], [true, "school-plan", PLANS.school.studentCap]);
  assert.equal((await call(10, "GET", "/api/plan")).body.premium, true);
  assert.equal((await call(52, "GET", "/api/plan")).body.premium, false, "a teacher at no school");
  // the school is covered, so a teacher there is not sold a second plan
  const again = await call(50, "POST", "/api/billing/checkout", { kind: "teacher" });
  assert.equal(again.status, 409);
});

test("checkout builds the right Stripe order", async (t) => {
  const none = await setup(t);
  const noKey = await none.call(50, "POST", "/api/billing/checkout", { kind: "teacher", blocks: 2 });
  assert.equal(noKey.status, 409);
  assert.match(noKey.body.message, /not set up/);
  assert.equal((await none.call(50, "GET", "/api/plan")).body.payment, false);

  const { call, calls } = await setup(t, { stripeKey: "sk_test_abcdefghijklmnop", stripe: () => ({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" }) });
  assert.equal((await call(50, "GET", "/api/plan")).body.payment, true);

  const teacher = await call(50, "POST", "/api/billing/checkout", { kind: "teacher", blocks: 3 });
  assert.deepEqual(teacher.body, { url: "https://checkout.stripe.com/c/pay/cs_test_1" });
  let f = calls.at(-1)!;
  assert.equal(f.url, "https://api.stripe.com/v1/checkout/sessions");
  assert.equal(f.auth, "Bearer sk_test_abcdefghijklmnop");
  assert.equal(f.form.get("mode"), "subscription");
  assert.equal(f.form.get("line_items[0][quantity]"), "3");
  assert.equal(f.form.get("line_items[0][price_data][unit_amount]"), "1000");
  assert.equal(f.form.get("line_items[0][price_data][currency]"), "usd");
  assert.equal(f.form.get("line_items[0][price_data][recurring][interval]"), "month");
  assert.equal(f.form.get("metadata[kind]"), "teacher");
  assert.equal(f.form.get("metadata[ownerId]"), "50");
  assert.equal(f.form.get("subscription_data[metadata][buyerId]"), "50");
  assert.equal(f.form.get("customer_email"), "new@school.org");
  // the buyer comes back to the site they started from
  assert.match(f.form.get("success_url")!, /^https:\/\/127\.0\.0\.1:\d+\/#\/billing\?paid=\{CHECKOUT_SESSION_ID\}$/);
  assert.match(f.form.get("cancel_url")!, /^https:\/\/127\.0\.0\.1:\d+\/#\/billing$/);

  await call(50, "POST", "/api/billing/checkout", { kind: "school", blocks: 40 });
  f = calls.at(-1)!;
  assert.equal(f.form.get("line_items[0][quantity]"), "1");
  assert.equal(f.form.get("line_items[0][price_data][unit_amount]"), "70000");
  assert.equal(f.form.get("line_items[0][price_data][recurring][interval]"), "year");
  assert.equal(f.form.get("metadata[kind]"), "school");
  assert.equal(f.form.get("metadata[ownerId]"), "3", "the buyer's own school, never one named in the request");

  // who can buy
  assert.equal((await call(52, "POST", "/api/billing/checkout", { kind: "school" })).status, 409, "no school on the account");
  assert.equal((await call(53, "POST", "/api/billing/checkout", { kind: "teacher" })).status, 403, "teacher not approved yet");
  for (const who of [10, 80, 1]) assert.equal((await call(who, "POST", "/api/billing/checkout", { kind: "teacher" })).status, 403, `user ${who}`);
  assert.equal((await call(null, "POST", "/api/billing/checkout", { kind: "teacher" })).status, 401);
  // a block count from the browser is kept in range
  await call(50, "POST", "/api/billing/checkout", { kind: "teacher", blocks: -4 });
  assert.equal(calls.at(-1)!.form.get("line_items[0][quantity]"), "1");
  await call(50, "POST", "/api/billing/checkout", { kind: "teacher", blocks: 99999 });
  assert.equal(calls.at(-1)!.form.get("line_items[0][quantity]"), String(PLANS.teacher.maxBlocks));
});

test("a Stripe failure is reported plainly and switches nothing on", async (t) => {
  const { call } = await setup(t, { stripeKey: "sk_test_abcdefghijklmnop", stripe: () => ({ __status: 402, error: { type: "card_error", message: "secret detail" } }) });
  const res = await call(50, "POST", "/api/billing/checkout", { kind: "teacher" });
  assert.equal(res.status, 502);
  assert.doesNotMatch(res.body.message, /secret detail/);
  const odd = await setup(t, { stripeKey: "sk_test_abcdefghijklmnop", stripe: () => ({ url: "javascript:alert(1)" }) });
  assert.equal((await odd.call(50, "POST", "/api/billing/checkout", { kind: "teacher" })).status, 502, "only an https payment page is passed on");
});

test("coming back from paying switches Premium on for the buyer only", async (t) => {
  const session = { id: "cs_test_abcdefgh", status: "complete", payment_status: "paid", metadata: { kind: "teacher", ownerId: "50", buyerId: "50", blocks: "2" }, subscription: subscription() };
  const { call, calls } = await setup(t, { stripeKey: "sk_test_abcdefghijklmnop", stripe: () => session });
  assert.equal((await call(51, "POST", "/api/billing/confirm", { sessionId: "cs_test_abcdefgh" })).status, 403, "someone else's payment");
  assert.equal((await call(50, "POST", "/api/billing/confirm", { sessionId: "../../v1/customers" })).status, 400);
  assert.equal((await call(50, "GET", "/api/plan")).body.premium, false);

  const ok = await call(50, "POST", "/api/billing/confirm", { sessionId: "cs_test_abcdefgh" });
  assert.equal(ok.status, 200);
  assert.match(calls.at(-1)!.url, /\/v1\/checkout\/sessions\/cs_test_abcdefgh\?expand%5B%5D=subscription$/);
  assert.equal((await call(50, "GET", "/api/plan")).body.via, "teacher-plan");

  const unpaid = await setup(t, { stripeKey: "sk_test_abcdefghijklmnop", stripe: () => ({ ...session, status: "open", payment_status: "unpaid" }) });
  assert.equal((await unpaid.call(50, "POST", "/api/billing/confirm", { sessionId: "cs_test_abcdefgh" })).status, 409);
  assert.equal((await unpaid.call(50, "GET", "/api/plan")).body.premium, false);
});

test("a teacher can add blocks and open billing, for their own plan only", async (t) => {
  const { call, hook, calls } = await setup(t, {
    stripeKey: "sk_test_abcdefghijklmnop", students: 150,
    stripe: (c) => (c.url.includes("/billing_portal/") ? { url: "https://billing.stripe.com/p/session/1" } : subscription({ items: { data: [{ id: "si_1", quantity: Number(c.form.get("items[0][quantity]")) }] } })),
  });
  assert.equal((await call(50, "POST", "/api/billing/blocks", { blocks: 3 })).status, 409, "no plan yet");
  await hook(event("customer.subscription.created", subscription()));

  const tooFew = await call(50, "POST", "/api/billing/blocks", { blocks: 1 });
  assert.equal(tooFew.status, 409);
  assert.match(tooFew.body.message, /150 students/);

  const more = await call(50, "POST", "/api/billing/blocks", { blocks: 4 });
  assert.equal(more.status, 200);
  const f = calls.at(-1)!;
  assert.equal(f.url, "https://api.stripe.com/v1/subscriptions/sub_123");
  assert.equal(f.form.get("items[0][id]"), "si_1");
  assert.equal(f.form.get("items[0][quantity]"), "4");
  assert.equal((await call(50, "GET", "/api/plan")).body.seats, 400);

  const portal = await call(50, "POST", "/api/billing/portal", { kind: "teacher" });
  assert.deepEqual(portal.body, { url: "https://billing.stripe.com/p/session/1" });
  assert.equal(calls.at(-1)!.form.get("customer"), "cus_123");
  assert.match(calls.at(-1)!.form.get("return_url")!, /^https:\/\/127\.0\.0\.1:\d+\/#\/billing$/);
  assert.equal((await call(51, "POST", "/api/billing/portal", { kind: "teacher" })).status, 409, "another teacher has no plan to manage");
});

test("with no webhook, a plan that reaches its end date is checked with Stripe before it stops", async (t) => {
  let periodEnd = NOW + 30 * DAY, status = "active";
  const { call, calls, clock } = await setup(t, {
    stripeKey: "sk_test_abcdefghijklmnop",
    stripe: (c) => (c.url.includes("/checkout/sessions/")
      ? { id: "cs_test_abcdefgh", status: "complete", payment_status: "paid", metadata: { kind: "teacher", ownerId: "50", buyerId: "50" }, subscription: subscription({ current_period_end: Math.floor(periodEnd / 1000) }) }
      : subscription({ status, current_period_end: Math.floor(periodEnd / 1000) })),
  });
  await call(50, "POST", "/api/billing/confirm", { sessionId: "cs_test_abcdefgh" });
  const premium = async () => (await call(50, "GET", "/api/plan")).body.premium;
  assert.equal(await premium(), true);
  const before = calls.length;
  clock.now = NOW + 20 * DAY;
  assert.equal(await premium(), true);
  assert.equal(calls.length, before, "no Stripe call while the paid period is running");

  // the card was charged again: Stripe now reports the next period
  clock.now = NOW + 30 * DAY + 3_600_000;
  periodEnd = NOW + 60 * DAY;
  assert.equal(await premium(), true);
  assert.equal(calls.at(-1)!.url, "https://api.stripe.com/v1/subscriptions/sub_123");
  assert.ok(Date.parse((await call(50, "GET", "/api/plan")).body.endsAt) > clock.now + 25 * DAY, "the new end date was saved");

  // it was cancelled: the next check finds that out
  clock.now = NOW + 60 * DAY + 3_600_000;
  status = "canceled";
  assert.equal(await premium(), false);
  assert.equal((await call(50, "GET", "/api/teacher/students")).status, 402);
});

test("the admin switches rules on, grants plans by hand and stores keys safely", async (t) => {
  const { call, settings } = await setup(t, { enforced: false });
  for (const path of ["/api/admin/plans/enforce", "/api/admin/plans/grant", "/api/admin/plans/revoke", "/api/admin/plans/stripe"]) {
    assert.equal((await call(50, "POST", path, {})).status, 403, path);
  }
  assert.equal((await call(50, "GET", "/api/admin/plans")).status, 403);

  assert.equal((await call(1, "POST", "/api/admin/plans/enforce", { enforced: true })).body.enforced, true);
  assert.equal((await call(50, "GET", "/api/teacher/students")).status, 402);

  // a plan given by hand, with no end date
  assert.equal((await call(1, "POST", "/api/admin/plans/grant", { kind: "teacher", ownerId: 10 })).status, 400, "not a teacher");
  assert.equal((await call(1, "POST", "/api/admin/plans/grant", { kind: "school", ownerId: 99 })).status, 400, "no such school");
  assert.equal((await call(1, "POST", "/api/admin/plans/grant", { kind: "teacher", ownerId: 50, blocks: 2, note: "Pilot class" })).status, 200);
  assert.equal((await call(50, "GET", "/api/teacher/students")).status, 200);
  let list = (await call(1, "GET", "/api/admin/plans")).body;
  assert.equal(list.enforced, true);
  assert.deepEqual(list.plans.map((p: any) => [p.kind, p.name, p.source, p.seats, p.endsAt, p.live, p.note]), [["teacher", "Ms. New", "admin", 200, null, true, "Pilot class"]]);

  assert.equal((await call(1, "POST", "/api/admin/plans/revoke", { kind: "teacher", ownerId: 50 })).status, 200);
  assert.equal((await call(50, "GET", "/api/teacher/students")).status, 402);
  assert.equal((await call(1, "POST", "/api/admin/plans/revoke", { kind: "school", ownerId: 3 })).status, 404);

  // a school plan for twelve months
  await call(1, "POST", "/api/admin/plans/grant", { kind: "school", ownerId: 3, months: 12 });
  list = (await call(1, "GET", "/api/admin/plans")).body;
  const school = list.plans.find((p: any) => p.kind === "school");
  assert.deepEqual([school.name, school.seats, school.students], ["Cedar Grove Middle", 1000, 240]);
  assert.ok(Math.abs(Date.parse(school.endsAt) - (NOW + 365.25 * DAY)) < DAY);

  // keys are checked, stored, and never sent back whole
  assert.equal((await call(1, "POST", "/api/admin/plans/stripe", { secretKey: "pk_live_notasecretkey123" })).status, 400);
  assert.equal((await call(1, "POST", "/api/admin/plans/stripe", { webhookSecret: "nope" })).status, 400);
  assert.equal((await call(1, "POST", "/api/admin/plans/stripe", {})).status, 400);
  assert.equal((await call(1, "POST", "/api/admin/plans/stripe", { secretKey: "sk_live_ABCDEFGHIJKLMNOP1234" })).status, 200);
  assert.equal(settings.get("stripe_secret_key"), "sk_live_ABCDEFGHIJKLMNOP1234");
  list = (await call(1, "GET", "/api/admin/plans")).body;
  assert.deepEqual([list.stripe.keySet, list.stripe.keyPreview], [true, "sk_live...1234"]);
  assert.doesNotMatch(JSON.stringify(list), /ABCDEFGHIJKLMNOP/);
  assert.equal((await call(50, "GET", "/api/plan")).body.payment, true);
});

test("a plan given by hand is not switched off by an old Stripe cancellation", async (t) => {
  const { call, hook } = await setup(t);
  await call(1, "POST", "/api/admin/plans/grant", { kind: "teacher", ownerId: 50 });
  await hook(event("customer.subscription.deleted", subscription({ status: "canceled" })));
  assert.equal((await call(50, "GET", "/api/plan")).body.premium, true);
  // and a paid plan cannot be revoked by hand, so the card is not left being charged
  const paid = await setup(t);
  await paid.hook(event("customer.subscription.created", subscription()));
  assert.equal((await paid.call(1, "POST", "/api/admin/plans/revoke", { kind: "teacher", ownerId: 50 })).status, 409);
  assert.equal((await paid.call(1, "POST", "/api/admin/plans/grant", { kind: "teacher", ownerId: 50 })).status, 409);
});

test("stripeForm writes nested fields the way Stripe reads them", () => {
  const form = new URLSearchParams(stripeForm({ mode: "subscription", line_items: [{ quantity: 2, price_data: { currency: "usd", recurring: { interval: "month" } } }], metadata: { kind: "teacher" }, skip: undefined, none: null }));
  assert.deepEqual([...form.entries()], [
    ["mode", "subscription"], ["line_items[0][quantity]", "2"], ["line_items[0][price_data][currency]", "usd"],
    ["line_items[0][price_data][recurring][interval]", "month"], ["metadata[kind]", "teacher"],
  ]);
  assert.equal(stripeForm({ note: "a&b=c d" }), "note=a%26b%3Dc%20d");
});
