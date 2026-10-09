// Teacher Hub, the paid add-on: who can open it and how it is bought.
// Run with: npx tsx --test tests/teacher-hub-plans.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { registerPlanRoutes } from "../server/plans";

const LATE = "2026-10-03T15:00:00Z";
// A fixed day after these teachers' free month, so the tests read the same on any date.
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

test("no teacher has Teacher Hub without paying once the free month is over, even with rules off or at a free school", async () => {
  const { plans, call } = setup();
  assert.equal((await plans.hubAccess(USERS[50])).access, false);
  assert.equal((await plans.hubAccess(USERS[60])).access, false, "CGMS teacher");
  assert.equal((await plans.hubAccess(USERS[1])).access, true, "admin");
  const r = await call("GET", "/api/plan", 50);
  assert.equal(r.body.premium, true, "Premium still open while rules are off");
  assert.equal(r.body.hub.access, false);
  assert.equal(r.body.hub.prices.monthlyCents, 1000);
  assert.equal(r.body.hub.prices.schoolYearlyCents, 70000);
});

test("admin can switch Teacher Hub on for a teacher, with seats", async () => {
  const { plans, call } = setup();
  const g = await call("POST", "/api/admin/plans/grant", 1, { kind: "hub_teacher", ownerId: 50, months: 12, blocks: 2 });
  assert.equal(g.status, 200, JSON.stringify(g.body));
  const h = await plans.hubAccess(USERS[50]);
  assert.deepEqual([h.access, h.via, h.seats], [true, "hub-teacher-plan", 200]);
  assert.equal((await plans.entitlement(USERS[50])).via, "rules-off", "Premium untouched");
  const list = await call("GET", "/api/admin/plans", 1);
  assert.equal(list.body.plans[0].kind, "hub_teacher");
  assert.equal(list.body.plans[0].students, 12);
});

test("a Premium plan does not give Teacher Hub, and a Hub plan does not give Premium", async () => {
  const { plans, call } = setup({ enforced: true });
  await call("POST", "/api/admin/plans/grant", 1, { kind: "teacher", ownerId: 50, months: 12, blocks: 1 });
  assert.equal((await plans.entitlement(USERS[50])).premium, true);
  assert.equal((await plans.hubAccess(USERS[50])).access, false);
  await call("POST", "/api/admin/plans/grant", 1, { kind: "hub_teacher", ownerId: 51, months: 12, blocks: 1 });
  assert.equal((await plans.hubAccess(USERS[51])).access, true);
  assert.equal((await plans.entitlement(USERS[51])).premium, false);
});

test("Teacher Hub calls pass the Premium lock, so a Hub-only teacher can use it", async () => {
  const { gate } = setup({ enforced: true });
  assert.deepEqual(await gate("/api/teacher-hub/workspace", 50), { passed: true, status: 0 });
  assert.deepEqual(await gate("/api/teacher/students", 50), { passed: false, status: 402 });
});

test("checkout for a Teacher Hub teacher plan: $10 a month per 100 students", async () => {
  const { call, calls } = setup();
  const r = await call("POST", "/api/billing/checkout", 50, { kind: "hub_teacher", blocks: 2 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const f = calls[0].form;
  assert.equal(f.get("line_items[0][quantity]"), "2");
  assert.equal(f.get("line_items[0][price_data][unit_amount]"), "1000");
  assert.equal(f.get("line_items[0][price_data][recurring][interval]"), "month");
  assert.match(f.get("line_items[0][price_data][product_data][name]")!, /Teacher Hub for a teacher/);
  assert.equal(f.get("metadata[kind]"), "hub_teacher");
});

test("checkout for a Teacher Hub school plan: $700 a year, and a CGMS teacher can buy too", async () => {
  const { call, calls } = setup();
  const r = await call("POST", "/api/billing/checkout", 60, { kind: "hub_school" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const f = calls[0].form;
  assert.equal(f.get("line_items[0][quantity]"), "1");
  assert.equal(f.get("line_items[0][price_data][unit_amount]"), "70000");
  assert.equal(f.get("line_items[0][price_data][recurring][interval]"), "year");
  assert.equal(f.get("metadata[ownerId]"), "7");
  // and the Premium school plan at CGMS is still refused, because it's free there
  const p = await call("POST", "/api/billing/checkout", 60, { kind: "school" });
  assert.equal(p.status, 409);
});

test("a teacher plan can't be smaller than the Hub caseload", async () => {
  const { call } = setup({ hubStudents: 150 });
  const r = await call("POST", "/api/billing/checkout", 50, { kind: "hub_teacher", blocks: 1 });
  assert.equal(r.status, 409);
  assert.match(r.body.message, /150 students/);
});

test("a paid school Hub plan gives every teacher at the school Teacher Hub", async () => {
  const { plans, call } = setup();
  const c = await call("POST", "/api/billing/confirm", 51, { sessionId: "cs_test_paid" });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  for (const id of [50, 51]) {
    const h = await plans.hubAccess(USERS[id]);
    assert.deepEqual([h.access, h.via, h.seats], [true, "hub-school-plan", 1000]);
  }
  assert.equal((await plans.hubAccess(USERS[60])).access, false, "another school");
  const again = await call("POST", "/api/billing/checkout", 50, { kind: "hub_teacher", blocks: 1 });
  assert.equal(again.status, 409, "no own plan needed");
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

// ─── A teacher's free first month ─────────────────────────────────────────────
const FREE_FROM = Date.parse("2026-10-09T02:36:00.000Z");

test("every teacher who already had an account gets Teacher Hub free for a month from the start date", async () => {
  const { plans, call, clock } = setup({ now: FREE_FROM + 60_000 });
  for (const id of [50, 51, 60]) {
    const h = await plans.hubAccess(USERS[id]);
    assert.deepEqual([h.access, h.via, h.seats, h.endsAt], [true, "free-month", null, "2026-11-09T02:36:00.000Z"], `teacher ${id}`);
  }
  const r = await call("GET", "/api/plan", 50);
  assert.equal(r.body.hub.access, true);
  assert.equal(r.body.hub.via, "free-month");
  assert.equal(r.body.freeMonthEndsAt, "2026-11-09T02:36:00.000Z");
  // the last minute of the month is still free; the month's end is not
  clock.now = Date.parse("2026-11-09T02:35:00.000Z");
  plans.forget();
  assert.equal((await plans.hubAccess(USERS[50])).access, true);
  clock.now = Date.parse("2026-11-09T02:36:00.000Z");
  plans.forget();
  assert.equal((await plans.hubAccess(USERS[50])).access, false);
});

test("a new teacher's free month of Teacher Hub starts the day they make their account", async () => {
  const signedUp = Date.parse("2026-12-20T16:00:00.000Z");
  USERS[70] = { id: 70, displayName: "Ms. Brand New", role: "teacher", createdAt: new Date(signedUp).toISOString(), school_id: 3 };
  try {
    const { plans, clock } = setup({ now: signedUp + 5 * 60_000 });
    const h = await plans.hubAccess(USERS[70]);
    assert.deepEqual([h.access, h.via, h.endsAt], [true, "free-month", "2027-01-20T16:00:00.000Z"]);
    assert.equal((await plans.hubAccess(USERS[50])).access, false, "an older teacher's month is already over");
    clock.now = signedUp + 20 * DAY;
    plans.forget();
    assert.equal((await plans.hubAccess(USERS[70])).access, true, "day 20");
    clock.now = signedUp + 32 * DAY;
    plans.forget();
    assert.equal((await plans.hubAccess(USERS[70])).access, false, "day 32");
  } finally { delete USERS[70]; }
});

test("in the free month a teacher passes the Premium lock, and a paid Hub plan still counts first", async () => {
  const { plans, call, gate } = setup({ enforced: true, now: FREE_FROM + DAY });
  assert.deepEqual(await gate("/api/teacher/students", 50), { passed: true, status: 0 });
  assert.deepEqual(await gate("/api/math/me", 50), { passed: true, status: 0 });
  const e = await plans.entitlement(USERS[50]);
  assert.deepEqual([e.premium, e.via, e.endsAt], [true, "free-month", "2026-11-09T02:36:00.000Z"]);
  await call("POST", "/api/admin/plans/grant", 1, { kind: "hub_teacher", ownerId: 50, months: 12, blocks: 2 });
  const h = await plans.hubAccess(USERS[50]);
  assert.deepEqual([h.access, h.via, h.seats], [true, "hub-teacher-plan", 200]);
  // students, parents and people who aren't teachers get no Teacher Hub from it
  assert.equal((await plans.hubAccess({ id: 9, role: "student", createdAt: LATE } as any)).access, false);
  assert.equal((await plans.hubAccess({ id: 8, role: "parent", createdAt: LATE } as any)).access, false);
});
