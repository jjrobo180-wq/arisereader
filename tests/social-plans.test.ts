// Arise Social, the $5/month add-on: who has it, who can buy it, and for whom.
// Run with: npx tsx --test tests/social-plans.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { registerPlanRoutes } from "../server/plans";

const USERS: Record<number, any> = {
  1: { id: 1, role: "student", isAdmin: true },
  2: { id: 2, role: "student", username: "sample" },
  50: { id: 50, displayName: "Ms. Rivera", role: "teacher", school_id: 3, email: "rivera@school.org", createdAt: "2026-10-03T15:00:00Z" },
  70: { id: 70, displayName: "Dana Moore", role: "parent", email: "dana@example.com" },
  71: { id: 71, displayName: "Ava Moore", role: "student", teacherId: 50, school_id: 3 },
  72: { id: 72, displayName: "Leo Park", role: "student", teacherId: 50, school_id: 3 },
};
const CHILDREN: Record<number, number[]> = { 70: [71] };
// A fixed day after this teacher's free month, so the tests read the same on any date.
const NOW = Date.parse("2026-12-01T18:00:00Z");
const paidSession = (kind: string, ownerId: number, buyerId: number) => ({
  id: "cs_test_paid", status: "complete", payment_status: "paid", metadata: { kind, ownerId: String(ownerId), buyerId: String(buyerId) },
  subscription: { id: "sub_soc", status: "active", customer: "cus_9", metadata: { kind, ownerId: String(ownerId), buyerId: String(buyerId) }, items: { data: [{ id: "si_9", quantity: 1, current_period_end: Math.floor(NOW / 1000) + 30 * 86400 }] } },
});

function setup(opts: { enforced?: boolean; payment?: boolean; session?: any } = {}) {
  const settings = new Map<string, string>();
  if (opts.enforced) settings.set("plans_enforced", "1");
  const routes: Record<string, Function[]> = {};
  const uses: Function[] = [];
  const app: any = {
    get: (p: string, ...h: Function[]) => { routes["GET " + p] = h; },
    post: (p: string, ...h: Function[]) => { routes["POST " + p] = h; },
    use: (_p: string, h: Function) => { uses.push(h); },
  };
  const calls: any[] = [];
  const auth = (req: any, _res: any, next: any) => { req.user = USERS[Number(req.headers.authorization)]; return next(); };
  const fetchStub: any = async (url: string, init: any) => {
    calls.push({ url, form: new URLSearchParams(init?.body || "") });
    if (url.endsWith("/checkout/sessions")) return { ok: true, json: async () => ({ id: "cs_test_abcdefgh123", url: "https://checkout.stripe.com/x" }) };
    if (url.includes("/checkout/sessions/cs_test_paid") && opts.session) return { ok: true, json: async () => opts.session };
    if (url.endsWith("/billing_portal/sessions")) return { ok: true, json: async () => ({ url: "https://billing.stripe.com/p" }) };
    return { ok: false, json: async () => ({}) };
  };
  const plans = registerPlanRoutes(app, auth as any, ((_q: any, _s: any, n: any) => n()) as any, {
    getSetting: async (k) => settings.get(k) ?? "",
    upsertSetting: async (k, v) => { settings.set(k, v); },
    userForToken: async (t) => USERS[Number(t)] ?? null,
    getUser: async (id) => USERS[id] ?? null,
    countTeacherStudents: async () => 0,
    countSchoolStudents: async () => 0,
    parentChildIds: async (id) => CHILDREN[id] ?? [],
    schoolName: async () => "Lincoln Middle",
    envStripeKey: () => (opts.payment === false ? "" : "sk_test_abcdefghijk"),
    fetch: fetchStub,
    now: () => NOW,
  });
  const call = async (method: string, path: string, who: number, body: any = {}) => {
    const req: any = { headers: { authorization: String(who), origin: "https://www.arisereader.com" }, body, originalUrl: path };
    const out: any = { status: 200, body: null };
    const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; }, set() { return res; } };
    const chain = routes[`${method} ${path}`];
    assert.ok(chain, "no route " + path);
    let i = 0;
    const next = async () => { const h = chain[i++]; if (h) await h(req, res, next); };
    await next();
    return out;
  };
  const gate = async (path: string, who: number) => {
    let passed = false;
    const res: any = { status() { return res; }, json() { return res; } };
    await uses[0]({ headers: { authorization: `Bearer ${who}` }, originalUrl: path }, res, () => { passed = true; });
    return passed;
  };
  return { plans, call, calls, gate, settings };
}

test("nobody has Arise Social without paying, plan rules on or off; admin and sample accounts do", async () => {
  for (const enforced of [false, true]) {
    const { plans } = setup({ enforced });
    for (const id of [50, 70, 71]) assert.equal(await plans.socialAccess(USERS[id]), false, `user ${id}`);
    assert.equal(await plans.socialAccess(USERS[1]), true, "admin");
    assert.equal(await plans.socialAccess(USERS[2]), true, "sample account");
  }
});

test("a teacher or parent buys it for themselves at $5 a month, coming back to /social/", async () => {
  const { call, calls } = setup();
  for (const who of [50, 70]) {
    const r = await call("POST", "/api/billing/social-checkout", who, { returnTo: "https://www.arisereader.com/social/" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
  const f = calls[0].form;
  assert.equal(f.get("line_items[0][price_data][unit_amount]"), "500");
  assert.equal(f.get("line_items[0][price_data][recurring][interval]"), "month");
  assert.equal(f.get("line_items[0][quantity]"), "1");
  assert.equal(f.get("metadata[kind]"), "social");
  assert.equal(f.get("metadata[ownerId]"), "50");
  assert.equal(f.get("success_url"), "https://www.arisereader.com/social/?paid={CHECKOUT_SESSION_ID}");
  assert.equal(f.get("cancel_url"), "https://www.arisereader.com/social/");
});

test("students can't pay; a parent pays for a linked child only", async () => {
  const { call, calls } = setup();
  const kid = await call("POST", "/api/billing/social-checkout", 71, {});
  assert.equal(kid.status, 403);
  assert.match(kid.body.message, /parent or guardian/);
  assert.equal((await call("POST", "/api/billing/social-checkout", 70, { forUserId: 72 })).status, 403, "not their child");
  const ok = await call("POST", "/api/billing/social-checkout", 70, { forUserId: 71 });
  assert.equal(ok.status, 200);
  const f = calls[0].form;
  assert.equal(f.get("metadata[ownerId]"), "71");
  assert.equal(f.get("metadata[buyerId]"), "70");
  assert.match(f.get("line_items[0][price_data][product_data][name]")!, /Arise Social for Ava M\./);
});

test("a parent's payment for a child switches it on for the child only, and only the parent manages it", async () => {
  const { plans, call } = setup({ session: paidSession("social", 71, 70) });
  const c = await call("POST", "/api/billing/confirm", 70, { sessionId: "cs_test_paid" });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.equal(await plans.socialAccess(USERS[71]), true);
  assert.equal(await plans.socialAccess(USERS[70]), false, "the parent still needs their own");
  const view = await call("GET", "/api/social-plan", 70);
  assert.deepEqual(view.body.children.map((k: any) => [k.id, k.access, k.paidByYou]), [[71, true, true]]);
  assert.equal(view.body.monthlyCents, 500);
  assert.equal((await call("POST", "/api/billing/social-checkout", 70, { forUserId: 71 })).status, 409, "already has it");
  assert.equal((await call("POST", "/api/billing/social-portal", 70, { forUserId: 71 })).status, 200);
  assert.equal((await call("POST", "/api/billing/social-portal", 71, {})).status, 403, "the child can't manage the parent's card");
});

test("Arise Social is separate from Premium: a teacher without Premium still reaches it", async () => {
  const { gate } = setup({ enforced: true });
  assert.equal(await gate("/api/plan-something", 50), false, "other teacher tools stay locked");
  assert.equal(await gate("/api/social/feed", 50), true);
  assert.equal(await gate("/api/social-plan", 50), true);
  assert.equal(await gate("/api/billing/social-checkout", 50), true);
});

test("the admin can switch it on by hand for any account; the old checkout won't sell it", async () => {
  const { plans, call } = setup();
  assert.equal((await call("POST", "/api/admin/plans/grant", 1, { kind: "social", ownerId: 72, months: 1 })).status, 200);
  assert.equal(await plans.socialAccess(USERS[72]), true);
  const list = await call("GET", "/api/admin/plans", 1);
  assert.equal(list.body.plans[0].kind, "social");
  assert.equal(list.body.plans[0].name, "Leo Park");
  assert.equal((await call("POST", "/api/billing/checkout", 50, { kind: "social" })).status, 400);
});

test("with no Stripe key, the plan view says payment isn't open", async () => {
  const { call } = setup({ payment: false });
  const r = await call("GET", "/api/social-plan", 50);
  assert.equal(r.body.payment, false);
  assert.equal(r.body.canBuy, true);
});
