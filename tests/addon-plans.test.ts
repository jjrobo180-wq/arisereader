// Add-ons: the family Learning Bundle (Arise History, Math and Social), a teacher's class add-ons
// (Math $12, History $12, Social $7), A.R.I.S.E. To-Do, the 30-day trial, and refunds when class
// add-ons take over from a family's plan.
// Run with: npx tsx --test tests/addon-plans.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { registerPlanRoutes } from "../server/plans";
import { trialDaysLeft, trialEnd } from "../shared/plans";

const OLD = "2026-09-01T00:00:00Z"; // signed up before the trial began: their 30 days start on October 9
const DURING = Date.parse("2026-10-20T18:00:00Z");
const AFTER = Date.parse("2026-12-01T18:00:00Z");
const USERS: Record<number, any> = {
  1: { id: 1, role: "student", isAdmin: true },
  50: { id: 50, displayName: "Ms. Rivera", role: "teacher", school_id: 3, email: "rivera@school.org", createdAt: OLD },
  51: { id: 51, displayName: "Mr. Delgado", role: "teacher", school_id: 3, createdAt: OLD },
  52: { id: 52, displayName: "Mx. New", role: "teacher", school_id: 3, createdAt: "2026-10-05T00:00:00Z" },
  70: { id: 70, displayName: "Dana Moore", role: "parent", email: "dana@example.com", createdAt: OLD },
  71: { id: 71, displayName: "Ava Moore", role: "student", teacherId: 50, school_id: 3, createdAt: OLD },
  72: { id: 72, displayName: "Max Moore", role: "student", teacherId: 51, school_id: 3, createdAt: OLD },
  80: { id: 80, displayName: "Sam Lee", role: "parent", createdAt: OLD },
  81: { id: 81, displayName: "Kai Lee", role: "student", teacherId: 50, school_id: 3, createdAt: OLD },
  90: { id: 90, displayName: "Personal", role: "todo", createdAt: OLD },
};
const CHILDREN: Record<number, number[]> = { 70: [71, 72], 80: [81] };
const parentsOf = (s: number) => Object.entries(CHILDREN).filter(([, k]) => k.includes(s)).map(([p]) => Number(p));
const sub = (kind: string, ownerId: number, extra: any = {}) => ({
  id: `sub_${kind.replace(/_/g, "")}${ownerId}`, status: "active", customer: `cus_${ownerId}`, metadata: { kind, ownerId: String(ownerId), buyerId: String(ownerId) },
  items: { data: [{ id: "si_1", quantity: 1, current_period_start: Math.floor((AFTER - 15 * 86400_000) / 1000), current_period_end: Math.floor((AFTER + 15 * 86400_000) / 1000) }] },
  ...extra,
});

function setup(opts: { clock?: number; enforced?: boolean } = {}) {
  const settings = new Map<string, string>();
  if (opts.enforced) settings.set("plans_enforced", "1");
  let clock = opts.clock ?? DURING;
  const routes: Record<string, Function[]> = {};
  const uses: Function[] = [];
  const app: any = {
    get: (p: string, ...h: Function[]) => { routes["GET " + p] = h; },
    post: (p: string, ...h: Function[]) => { routes["POST " + p] = h; },
    use: (_p: string, h: Function) => { uses.push(h); },
  };
  const calls: { url: string; method: string; form: URLSearchParams }[] = [];
  const sessions: Record<string, any> = {};
  const subs: Record<string, any> = {};
  const auth = (req: any, _res: any, next: any) => { req.user = USERS[Number(req.headers.authorization)]; return next(); };
  const fetchStub: any = async (url: string, init: any) => {
    calls.push({ url, method: init.method, form: new URLSearchParams(init?.body || "") });
    const ok = (body: any) => ({ ok: true, json: async () => body });
    if (url.endsWith("/checkout/sessions")) return ok({ id: "cs_test_abcdefgh123", url: "https://checkout.stripe.com/x" });
    const cs = /checkout\/sessions\/(cs_\w+)/.exec(url);
    if (cs && sessions[cs[1]]) return ok(sessions[cs[1]]);
    const sb = /subscriptions\/(sub_\w+)/.exec(url);
    if (sb && subs[sb[1]]) { if (init.method === "DELETE") subs[sb[1]].status = "canceled"; return ok(subs[sb[1]]); }
    if (url.endsWith("/refunds")) return ok({ id: "re_1" });
    if (url.endsWith("/billing_portal/sessions")) return ok({ url: "https://billing.stripe.com/p" });
    return { ok: false, json: async () => ({}) };
  };
  const plans = registerPlanRoutes(app, auth as any, ((_q: any, _s: any, n: any) => n()) as any, {
    getSetting: async (k) => settings.get(k) ?? "",
    upsertSetting: async (k, v) => { settings.set(k, v); },
    userForToken: async (t) => USERS[Number(t)] ?? null,
    getUser: async (id) => USERS[id] ?? null,
    countTeacherStudents: async (t) => Object.values(USERS).filter((u) => u.role === "student" && u.teacherId === t).length,
    countSchoolStudents: async () => 0,
    parentChildIds: async (id) => CHILDREN[id] ?? [],
    studentParentIds: async (id) => parentsOf(id),
    teacherStudentIds: async (t) => Object.values(USERS).filter((u) => u.role === "student" && u.teacherId === t).map((u) => u.id),
    schoolName: async () => "Lincoln Middle",
    envStripeKey: () => "sk_test_abcdefghijk",
    fetch: fetchStub,
    now: () => clock,
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
  /** A finished Stripe payment, confirmed by the buyer coming back to the site. */
  const pay = async (kind: string, ownerId: number) => {
    const paid = kind === "math_class" || kind === "history_class" ? 1200 : kind === "social_class" ? 700 : kind === "bundle_teacher" ? 5000 : 1000;
    const s = sub(kind, ownerId, { latest_invoice: { amount_paid: paid, payment_intent: `pi_${ownerId}` } });
    subs[s.id] = s;
    sessions.cs_test_paid000 = { id: "cs_test_paid000", status: "complete", payment_status: "paid", metadata: s.metadata, subscription: s };
    return call("POST", "/api/billing/confirm", ownerId, { sessionId: "cs_test_paid000" });
  };
  const gate = async (path: string, who: number) => {
    let passed = false;
    const res: any = { status() { return res; }, json() { return res; } };
    await uses[0]({ headers: { authorization: `Bearer ${who}` }, originalUrl: path }, res, () => { passed = true; });
    return passed;
  };
  return { plans, call, calls, pay, gate, settings, subs, setClock: (t: number) => { clock = t; } };
}

test("every account gets 30 free days, no card; older accounts count from October 9", async () => {
  assert.equal(trialEnd(OLD), "2026-11-08T06:00:00.000Z");
  assert.equal(trialEnd("2026-10-15T12:00:00Z"), "2026-11-14T12:00:00.000Z");
  assert.equal(trialDaysLeft(OLD, DURING), 19);
  const t = setup();
  for (const id of [50, 70, 71]) for (const app of ["math", "history", "social"] as const) {
    const s = await t.plans.appStatus(USERS[id], app);
    assert.deepEqual([s.access, s.via], [true, "trial"], `user ${id} ${app}`);
  }
  const view = await t.call("GET", "/api/addons", 70);
  assert.equal(view.body.bundle.trialDaysLeft, 19);
  assert.equal(view.body.apps.math.via, "trial");
  assert.equal(view.body.todo.via, "trial");
  const later = setup({ clock: AFTER });
  for (const id of [50, 70, 71]) assert.equal(await later.plans.appAccess(USERS[id], "math"), false, `user ${id} after the trial`);
  assert.equal((await later.plans.todoStatus(USERS[70])).access, false);
  assert.equal((await later.plans.todoStatus(USERS[90])).access, true, "personal To-Do accounts are unchanged");
  assert.equal(await later.plans.appAccess(USERS[1], "history"), true, "admin");
});

test("parents: $10 a month covers all three apps for the whole family; $10 a month for To-Do", async () => {
  const t = setup({ clock: AFTER });
  const r = await t.call("POST", "/api/billing/addon-checkout", 70, { product: "bundle", returnPath: "/math/" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  let f = t.calls.at(-1)!.form;
  assert.equal(f.get("line_items[0][price_data][unit_amount]"), "1000");
  assert.equal(f.get("metadata[kind]"), "bundle_family");
  assert.equal(f.get("success_url"), "https://www.arisereader.com/math/?paid={CHECKOUT_SESSION_ID}");
  assert.equal((await t.pay("bundle_family", 70)).status, 200);
  for (const id of [70, 71, 72]) for (const app of ["math", "history", "social"] as const) assert.equal((await t.plans.appStatus(USERS[id], app)).via, "family-plan", `user ${id} ${app}`);
  assert.equal(await t.plans.appAccess(USERS[81], "math"), false, "another family");
  assert.equal((await t.call("POST", "/api/billing/addon-checkout", 70, { product: "math" })).status, 400, "families buy the bundle, not one app");
  const todo = await t.call("POST", "/api/billing/addon-checkout", 70, { product: "todo" });
  assert.equal(todo.status, 200);
  f = t.calls.at(-1)!.form;
  assert.equal(f.get("line_items[0][price_data][unit_amount]"), "1000");
  assert.equal(f.get("metadata[kind]"), "todo_family");
  assert.equal(f.get("success_url"), "https://www.arisereader.com/?paid={CHECKOUT_SESSION_ID}#/billing");
});

test("teachers add each app for their class: Math $12, History $12, Social $7, on top of Class, up to 100 students", async () => {
  const locked = setup({ clock: AFTER, enforced: true });
  const no = await locked.call("POST", "/api/billing/addon-checkout", 52, { product: "math" });
  assert.equal(no.status, 409);
  assert.match(no.body.message, /on top of the Class plan/);
  const t = setup({ clock: AFTER });
  for (const [app, cents] of [["math", "1200"], ["history", "1200"], ["social", "700"]]) {
    const r = await t.call("POST", "/api/billing/addon-checkout", 50, { product: app });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const f = t.calls.at(-1)!.form;
    assert.equal(f.get("line_items[0][price_data][unit_amount]"), cents, app);
    assert.equal(f.get("line_items[0][price_data][recurring][interval]"), "month");
    assert.equal(f.get("metadata[kind]"), `${app}_class`);
  }
  assert.equal((await t.call("POST", "/api/billing/addon-checkout", 50, { product: "bundle" })).status, 400, "no all-three class plan any more");
  assert.equal((await t.call("POST", "/api/billing/addon-checkout", 50, { product: "todo" })).status, 409, "To-Do is part of Teacher Hub");
  assert.equal((await t.call("POST", "/api/billing/addon-checkout", 71, { product: "math" })).status, 403, "students can't pay");
  const early = setup({ clock: DURING });
  assert.equal((await early.plans.todoStatus(USERS[50])).via, "hub");
});

test("a class add-on opens only its own app, for the teacher and the class", async () => {
  const t = setup({ clock: AFTER });
  assert.equal((await t.pay("math_class", 50)).status, 200);
  for (const id of [50, 71, 81]) {
    assert.equal((await t.plans.appStatus(USERS[id], "math")).via, "class-plan", `user ${id}`);
    assert.equal(await t.plans.appAccess(USERS[id], "history"), false, `user ${id} history`);
    assert.equal(await t.plans.appAccess(USERS[id], "social"), false, `user ${id} social`);
  }
  assert.equal(await t.plans.appAccess(USERS[72], "math"), false, "a student in another class");
  const view = await t.call("GET", "/api/addons", 50);
  assert.equal(view.body.apps.math.plan.live, true);
  assert.equal(view.body.apps.history.access, false);
  assert.deepEqual(view.body.prices.classApps, { math: 1200, history: 1200, social: 700 });
  assert.equal((await t.call("POST", "/api/billing/addon-checkout", 50, { product: "math" })).status, 409, "already has Math");
});

test("a family is refunded once class add-ons cover all three apps for every child", async () => {
  const t = setup({ clock: AFTER });
  assert.equal((await t.pay("bundle_family", 80)).status, 200);
  assert.equal((await t.pay("bundle_family", 70)).status, 200);
  // Ms. Rivera (Ava's and Kai's teacher) adds Math and History: not all three yet, so nothing changes.
  await t.pay("math_class", 50);
  await t.pay("history_class", 50);
  assert.equal(t.calls.filter((c) => c.url.endsWith("/refunds")).length, 0);
  assert.equal(t.subs.sub_bundlefamily80.status, "active");
  // Adding Social completes the set for Kai's family: half the month was unused, so $5 of $10 goes back.
  await t.pay("social_class", 50);
  const refunds = t.calls.filter((c) => c.url.endsWith("/refunds"));
  assert.equal(refunds.length, 1);
  assert.equal(refunds[0].form.get("payment_intent"), "pi_80");
  assert.equal(refunds[0].form.get("amount"), "500");
  assert.equal(t.subs.sub_bundlefamily80.status, "canceled");
  const lee = await t.call("GET", "/api/addons", 80);
  assert.deepEqual([lee.body.refund.cents, lee.body.refund.toCard], [500, true]);
  assert.equal(lee.body.apps.history.via, "child-in-class", "the parent keeps their view through the child's class");
  assert.deepEqual(lee.body.children[0].coveredApps, ["math", "history", "social"]);
  // Dana's family still has Max in a class without the add-ons, so her plan keeps going.
  assert.equal(t.subs.sub_bundlefamily70.status, "active");
  assert.equal((await t.plans.appStatus(USERS[72], "math")).via, "family-plan");
});

test("the old all-three class plan still covers every app", async () => {
  const t = setup({ clock: AFTER });
  await t.call("POST", "/api/admin/plans/grant", 1, { kind: "bundle_teacher", ownerId: 50, months: 1 });
  for (const app of ["math", "history", "social"] as const) assert.equal((await t.plans.appStatus(USERS[71], app)).via, "class-plan", app);
  const r = await t.call("POST", "/api/billing/addon-checkout", 80, { product: "bundle" });
  assert.equal(r.status, 409, "Kai's family is already covered");
  assert.equal((await t.call("POST", "/api/billing/addon-checkout", 50, { product: "social" })).status, 409, "already included");
});

test("the add-on pages stay open to teachers without Class; the old checkout won't sell add-ons", async () => {
  const t = setup({ clock: AFTER, enforced: true });
  assert.equal(await t.gate("/api/addons", 50), true);
  assert.equal(await t.gate("/api/billing/addon-checkout", 50), true);
  assert.equal((await t.call("POST", "/api/billing/checkout", 50, { kind: "math_class" })).status, 400);
});
