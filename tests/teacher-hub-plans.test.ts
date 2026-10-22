// Arise WorkHub / LifeHub (A.R.I.S.E. To-Do): free for every teacher and parent since Oct 11, 2026.
// Premium is still paid from day one, and the two stay separate.
// Run with: npx tsx --test tests/teacher-hub-plans.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { registerPlanRoutes } from "../server/plans";

const LATE = "2026-10-03T15:00:00Z";
// A fixed day, so the tests read the same on any date.
const NOW = Date.parse("2026-12-01T18:00:00Z");
const DAY = 86_400_000;
const USERS: Record<number, any> = {
  1: { id: 1, role: "student", isAdmin: true },
  50: { id: 50, displayName: "Ms. New", role: "teacher", createdAt: LATE, school_id: 3, email: "new@school.org" },
  51: { id: 51, displayName: "Mr. Two", role: "teacher", createdAt: LATE, school_id: 3 },
  60: { id: 60, displayName: "Ms. Home", role: "teacher", createdAt: LATE, school_id: 7 },
};
const SCHOOLS: Record<number, string> = { 3: "Lincoln Middle", 7: "CGMS" };

function setup(opts: { enforced?: boolean; hubStudents?: number; now?: number } = {}) {
  const clock = { now: opts.now ?? NOW };
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
  const auth = (req: any, res: any, next: any) => { req.user = USERS[Number(req.headers.authorization)]; return next(); };
  const admin = (_req: any, _res: any, next: any) => next();
  const fetchStub: any = async (url: string, init: any) => {
    const form = new URLSearchParams(init?.body || "");
    calls.push({ url, method: init.method, form });
    if (url.endsWith("/checkout/sessions")) return { ok: true, json: async () => ({ id: "cs_test_abcdefgh123", url: "https://checkout.stripe.com/x" }) };
    if (url.includes("/checkout/sessions/cs_test_paid")) return { ok: true, json: async () => ({
      id: "cs_test_paid", status: "complete", payment_status: "paid", metadata: { kind: "hub_school", ownerId: "3", buyerId: "51" },
      subscription: { id: "sub_abc", status: "active", customer: "cus_1", metadata: { kind: "hub_school", ownerId: "3", buyerId: "51" }, items: { data: [{ id: "si_1", quantity: 1, current_period_end: Math.floor(clock.now / 1000) + 300 * 86400 }] } },
    }) };
    return { ok: false, json: async () => ({}) };
  };
  const plans = registerPlanRoutes(app, auth as any, admin as any, {
    getSetting: async (k) => settings.get(k) ?? "",
    upsertSetting: async (k, v) => { settings.set(k, v); },
    userForToken: async (t) => USERS[Number(t)] ?? null,
    getUser: async (id) => USERS[id] ?? null,
    countTeacherStudents: async () => 30,
    countSchoolStudents: async () => 240,
    countHubStudents: async () => opts.hubStudents ?? 12,
    schoolName: async (id) => SCHOOLS[id] ?? "",
    schools: async () => Object.entries(SCHOOLS).map(([id, name]) => ({ id: Number(id), name })),
    envStripeKey: () => "sk_test_abcdefghijk",
    fetch: fetchStub,
    now: () => clock.now,
  });
  const call = async (method: string, path: string, who: number, body: any = {}) => {
    const req: any = { headers: { authorization: String(who), origin: "https://arisereader.com" }, body, originalUrl: path };
    let out: any = { status: 200, body: null };
    const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; }, set() { return res; } };
    const chain = routes[`${method} ${path}`];
    assert.ok(chain, "no route " + path);
    let i = 0;
    const next = async () => { const h = chain[i++]; if (h) await h(req, res, next); };
    await next();
    return out;
  };
  const gate = async (path: string, who: number) => {
    let passed = false; let status = 0;
    const res: any = { status(c: number) { status = c; return res; }, json() { return res; } };
    await uses[0]({ headers: { authorization: `Bearer ${who}` }, originalUrl: path }, res, () => { passed = true; });
    return { passed, status };
  };
  return { plans, call, calls, gate, settings, clock };
}

test("every teacher and parent has the hubs free, with plan rules on or off; students don't", async () => {
  for (const enforced of [false, true]) {
    const { plans } = setup({ enforced });
    for (const id of [50, 51, 60]) {
      const h = await plans.hubAccess(USERS[id]);
      assert.deepEqual([h.access, h.via, h.endsAt], [true, "free", null], `teacher ${id}, rules ${enforced}`);
    }
    assert.equal((await plans.hubAccess({ id: 8, role: "parent", createdAt: LATE } as any)).access, true, "parent");
    assert.equal((await plans.hubAccess({ id: 9, role: "student", createdAt: LATE } as any)).access, false, "student");
    assert.equal((await plans.hubAccess(USERS[1])).access, true, "admin");
  }
});

test("the plan page says the hub is free", async () => {
  const { call } = setup();
  const r = await call("GET", "/api/plan", 50);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.hub.access, true);
  assert.equal(r.body.hub.via, "free");
});

test("nobody can be charged for the hubs: both hub checkouts are refused before Stripe", async () => {
  const { call, calls } = setup();
  for (const kind of ["hub_teacher", "hub_school"]) {
    const r = await call("POST", "/api/billing/checkout", 50, { kind, blocks: 2 });
    assert.equal(r.status, 409, kind);
    assert.match(r.body.message, /free/);
  }
  assert.equal(calls.length, 0, "Stripe never called");
});

test("a Premium plan and the free hub don't affect each other", async () => {
  const { plans, call } = setup({ enforced: true });
  await call("POST", "/api/admin/plans/grant", 1, { kind: "teacher", ownerId: 50, months: 12, blocks: 1 });
  assert.equal((await plans.entitlement(USERS[50])).premium, true);
  assert.equal((await plans.hubAccess(USERS[50])).access, true);
  // an old WorkHub grant (from when it was sold) gives no Premium
  await call("POST", "/api/admin/plans/grant", 1, { kind: "hub_teacher", ownerId: 51, months: 12, blocks: 1 });
  assert.equal((await plans.entitlement(USERS[51])).premium, false);
});

test("Premium has no free trial: a brand-new teacher is locked out of Premium calls until they pay", async () => {
  const signedUp = Date.parse("2026-12-20T16:00:00.000Z");
  USERS[70] = { id: 70, displayName: "Ms. Brand New", role: "teacher", createdAt: new Date(signedUp).toISOString(), school_id: 3 };
  try {
    const { plans, gate } = setup({ enforced: true, now: signedUp + 60_000 });
    assert.equal((await plans.entitlement(USERS[70])).premium, false);
    assert.deepEqual(await gate("/api/teacher/students", 70), { passed: false, status: 402 });
    assert.deepEqual(await gate("/api/teacher-hub/workspace", 70), { passed: true, status: 0 }, "the hub still opens");
  } finally { delete USERS[70]; }
});

test("Teacher Hub calls pass the Premium lock, so a Hub-only teacher can use it", async () => {
  const { gate } = setup({ enforced: true });
  assert.deepEqual(await gate("/api/teacher-hub/workspace", 50), { passed: true, status: 0 });
  assert.deepEqual(await gate("/api/teacher/students", 50), { passed: false, status: 402 });
});

test("Premium checkout is unchanged", async () => {
  const { call, calls } = setup({ enforced: true });
  const t = await call("POST", "/api/billing/checkout", 50, { kind: "teacher", blocks: 3 });
  assert.equal(t.status, 200, JSON.stringify(t.body));
  let f = calls[0].form;
  assert.deepEqual([f.get("line_items[0][quantity]"), f.get("line_items[0][price_data][unit_amount]"), f.get("metadata[kind]")], ["3", "1000", "teacher"]);
  assert.match(f.get("line_items[0][price_data][product_data][name]")!, /Premium for a teacher/);
  const s = await call("POST", "/api/billing/checkout", 51, { kind: "school" });
  assert.equal(s.status, 200, JSON.stringify(s.body));
  f = calls[1].form;
  assert.deepEqual([f.get("line_items[0][quantity]"), f.get("line_items[0][price_data][unit_amount]"), f.get("line_items[0][price_data][recurring][interval]")], ["1", "70000", "year"]);
  const none = await call("POST", "/api/billing/checkout", 50, {});
  assert.equal(none.status, 200);
  assert.equal(calls.filter((c) => c.method === "POST").at(-1).form.get("metadata[kind]"), "teacher");
});
