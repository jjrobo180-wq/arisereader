// Add-ons: the family Learning Bundle (Arise History, Math and Social), a teacher's Class plan
// (which now includes Math, History and Connect/Social together — there is no per-app class
// add-on to buy any more), Arise To Duo, and refunds when a child's teacher's Class plan
// takes over from a family's plan. No part of the site has a free trial — everything needs a
// plan from day one.
// Run with: npx tsx --test tests/addon-plans.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { registerPlanRoutes } from "../server/plans";

const OLD = "2026-09-01T00:00:00Z"; // an account that's been around a while
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
  // Mx. New (52) is the only teacher in this cast who isn't grandfathered (signed up after the
  // cutoff) and never buys a plan, so Robin is the one student with a genuinely plan-less teacher.
  95: { id: 95, displayName: "Robin New", role: "student", teacherId: 52, school_id: 3, createdAt: OLD },
  100: { id: 100, displayName: "Jo Park", role: "parent", createdAt: OLD },
};
const CHILDREN: Record<number, number[]> = { 70: [71, 72], 80: [81], 100: [95] };
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

test("nobody gets Math, History or Social for free — no trial, no card on file means no access", async () => {
  // Plan rules must be enforced for "no access" to mean anything — otherwise everyone passes via
  // "rules-off" (see the next test, which exercises that path on purpose). Users 50 and 51 (Ms.
  // Rivera and Mr. Delgado) are both grandfathered (signed up before the cutoff), so their classes
  // — and Dana (70), whose children are in those classes — are excluded here; their Class plans
  // legitimately include every app for free, enforced or not. Mx. New (52) signed up after the
  // cutoff and has no plan; Robin (95), one of Mx. New's students, and Jo Park (100), Robin's
  // parent, have no coverage either — clean "really has nothing" cases.
  const t = setup({ enforced: true });
  for (const id of [52, 100, 95]) for (const app of ["math", "history", "social"] as const) {
    const s = await t.plans.appStatus(USERS[id], app);
    assert.deepEqual([s.access, s.via], [false, null], `user ${id} ${app}`);
  }
  const view = await t.call("GET", "/api/addons", 100);
  assert.equal(view.body.apps.math.via, null);
  assert.equal(view.body.todo.via, "free", "Arise To Duo is free for a parent regardless");
  const later = setup({ clock: AFTER, enforced: true });
  for (const id of [52, 100, 95]) assert.equal(await later.plans.appAccess(USERS[id], "math"), false, `user ${id}, no plan`);
  assert.equal((await later.plans.todoStatus(USERS[100])).access, true, "To-Do stays free for a parent");
  assert.equal((await later.plans.todoStatus(USERS[90])).access, true, "personal To-Do accounts are unchanged");
  assert.equal(await later.plans.appAccess(USERS[1], "history"), true, "admin");
});

test("before plan rules are enforced, everyone passes through — including a teacher's class", async () => {
  const t = setup(); // enforced defaults to off
  for (const app of ["math", "history", "social"] as const) {
    assert.equal(await t.plans.appAccess(USERS[52], app), true, `teacher, rules off, ${app}`);
    assert.equal((await t.plans.appStatus(USERS[52], app)).via, "class-plan", `teacher, rules off, ${app}`);
  }
});

test("parents: $10 a month covers all three apps for the whole family; Arise To Duo is free, no checkout", async () => {
  const t = setup({ clock: AFTER, enforced: true });
  // Jo Park (100) is Robin's (95) parent, and Robin's teacher (Mx. New, 52) isn't grandfathered
  // and has no Class plan — a genuinely uncovered family, so buying the bundle actually goes
  // through (unlike Dana's family below, where it's refused up front).
  const r = await t.call("POST", "/api/billing/addon-checkout", 100, { product: "bundle", returnPath: "/math/" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const f = t.calls.at(-1)!.form;
  assert.equal(f.get("line_items[0][price_data][unit_amount]"), "1000");
  assert.equal(f.get("metadata[kind]"), "bundle_family");
  assert.equal(f.get("success_url"), "https://www.arisereader.com/math/?paid={CHECKOUT_SESSION_ID}");
  assert.equal((await t.pay("bundle_family", 100)).status, 200);
  for (const app of ["math", "history", "social"] as const) assert.equal((await t.plans.appStatus(USERS[95], app)).via, "family-plan", `Robin ${app}`);
  // Ava (71), Max (72) and Kai (81) are all in a grandfathered teacher's class (Rivera or
  // Delgado), so they see their access through the class instead — real coverage, just checked
  // ahead of any family plan. That's also why Dana's family (70, parent of Ava and Max) can't
  // buy the bundle at all: every one of her children is already covered.
  for (const id of [71, 72, 81]) for (const app of ["math", "history", "social"] as const) assert.equal((await t.plans.appStatus(USERS[id], app)).via, "class-plan", `user ${id} ${app}`);
  const blocked = await t.call("POST", "/api/billing/addon-checkout", 70, { product: "bundle" });
  assert.equal(blocked.status, 409, "Dana's kids are already covered by their classes");
  assert.equal((await t.call("POST", "/api/billing/addon-checkout", 100, { product: "math" })).status, 400, "families buy the bundle, not one app");
  // Arise To Duo is free for every parent — there's no checkout for it any more.
  const todo = await t.call("POST", "/api/billing/addon-checkout", 100, { product: "todo" });
  assert.equal(todo.status, 409);
  assert.match(todo.body.message, /free/i);
  assert.equal((await t.plans.todoStatus(USERS[100])).access, true, "To-Do is already on, free, no purchase needed");
});

test("a teacher's Class plan includes Math, History and Connect for their whole class — nothing to buy separately", async () => {
  const locked = setup({ clock: AFTER, enforced: true });
  // Mx. New (user 52) has no Class plan yet: every app is refused with the same message.
  for (const app of ["math", "history", "social"]) {
    const no = await locked.call("POST", "/api/billing/addon-checkout", 52, { product: app });
    assert.equal(no.status, 409, app);
    assert.match(no.body.message, /included with the Class plan/, app);
  }
  // Ms. Rivera (user 50) has the Class plan (grandfathered): every app is already included, so
  // there's nothing left to buy, and the checkout says so instead of opening Stripe.
  const t = setup({ clock: AFTER, enforced: true });
  for (const app of ["math", "history", "social"] as const) {
    assert.equal((await t.plans.appStatus(USERS[50], app)).via, "class-plan", app);
    const r = await t.call("POST", "/api/billing/addon-checkout", 50, { product: app });
    assert.equal(r.status, 409, app);
    assert.match(r.body.message, /already includes/, app);
  }
  assert.equal((await t.call("POST", "/api/billing/addon-checkout", 50, { product: "bundle" })).status, 400, "no all-three class plan any more");
  assert.equal((await t.call("POST", "/api/billing/addon-checkout", 50, { product: "todo" })).status, 409, "To-Do is part of Teacher Hub");
  assert.equal((await t.call("POST", "/api/billing/addon-checkout", 71, { product: "math" })).status, 403, "students can't pay");
  // Arise To Duo (Arise WorkHub/LifeHub) is unconditionally free for every teacher, via
  // "free" — not tied to the Class plan or any grant.
  const early = setup({ clock: DURING, enforced: true });
  assert.equal((await early.plans.todoStatus(USERS[50])).via, "free");
});

test("a leftover per-app grant (from before apps were combined) still opens only its own app for a teacher without the Class plan", async () => {
  // Mx. New (user 52) isn't grandfathered and has no Class plan — a clean case to check an old,
  // standalone math_class grant by itself, with no classPremium boost from Premium.
  const t = setup({ clock: AFTER, enforced: true });
  assert.equal((await t.pay("math_class", 52)).status, 200);
  assert.equal((await t.plans.appStatus(USERS[52], "math")).via, "class-plan", "math, from the old grant");
  assert.equal(await t.plans.appAccess(USERS[52], "history"), false, "history: no old grant, no Class plan");
  assert.equal(await t.plans.appAccess(USERS[52], "social"), false, "social: no old grant, no Class plan");
  const view = await t.call("GET", "/api/addons", 52);
  assert.equal(view.body.apps.math.plan.live, true);
  assert.equal(view.body.apps.history.access, false);
});

test("a family is refunded once their child's teacher's Class plan covers every app", async () => {
  // Ms. Rivera (Kai's teacher, user 50) is grandfathered, so she already has the Class plan — and
  // the Class plan now includes Math, History and Connect together. Jo Park's family (Robin's
  // teacher, Mx. New) has no Class plan at all, so that bundle just stays on. The refund only
  // actually fires once the family's /api/addons view is loaded (creditFamilyIfCovered runs
  // there, not at payment time), so both families need that GET before refunds can be checked.
  const t = setup({ clock: AFTER, enforced: true });
  assert.equal((await t.pay("bundle_family", 100)).status, 200);
  assert.equal((await t.pay("bundle_family", 80)).status, 200);
  await t.call("GET", "/api/addons", 100);
  const lee = await t.call("GET", "/api/addons", 80);
  assert.equal(t.subs.sub_bundlefamily100.status, "active", "Robin's teacher (Mx. New) has no Class plan, so Jo's bundle stays on");
  const refunds = t.calls.filter((c) => c.url.endsWith("/refunds"));
  assert.equal(refunds.length, 1, "Kai's family: his teacher's Class plan already covers everything");
  assert.equal(refunds[0].form.get("payment_intent"), "pi_80");
  assert.equal(t.subs.sub_bundlefamily80.status, "canceled");
  assert.equal(lee.body.refund.toCard, true);
  assert.equal(lee.body.apps.history.via, "child-in-class", "the parent keeps their view through the child's class");
  assert.deepEqual(lee.body.children[0].coveredApps, ["math", "history", "social"]);
  // Jo's family still has Robin in Mx. New's class, who has no Class plan, so her plan keeps going.
  assert.equal(t.subs.sub_bundlefamily100.status, "active");
  assert.equal((await t.plans.appStatus(USERS[95], "math")).via, "family-plan");
});

test("the old all-three class plan (bundle_teacher) still covers every app on its own, even without classPremium", async () => {
  // Mx. New (user 52) has no Class plan and isn't grandfathered, so this isolates the legacy
  // bundle_teacher grant from the new classPremium path.
  const student: any = { id: 95, displayName: "Robin New", role: "student", teacherId: 52, school_id: 3, createdAt: OLD };
  USERS[95] = student;
  const t = setup({ clock: AFTER, enforced: true });
  await t.call("POST", "/api/admin/plans/grant", 1, { kind: "bundle_teacher", ownerId: 52, months: 1 });
  for (const app of ["math", "history", "social"] as const) assert.equal((await t.plans.appStatus(student, app)).via, "class-plan", app);
  assert.equal((await t.call("POST", "/api/billing/addon-checkout", 52, { product: "social" })).status, 409, "already included");
});

test("the add-on pages stay open to teachers without Class; the old checkout won't sell add-ons", async () => {
  const t = setup({ clock: AFTER, enforced: true });
  assert.equal(await t.gate("/api/addons", 50), true);
  assert.equal(await t.gate("/api/billing/addon-checkout", 50), true);
  assert.equal((await t.call("POST", "/api/billing/checkout", 50, { kind: "math_class" })).status, 400);
});

test("the admin settings page: every program is open to the admin, free, with plan rules on and no trial anywhere", async () => {
  const t = setup({ clock: AFTER, enforced: true });
  const r = await t.call("GET", "/api/admin/programs", 1);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.programs.map((p: any) => p.id), ["reader", "hub", "todo", "math", "history", "social"]);
  for (const p of r.body.programs) assert.equal(p.access, true, p.name);
  // The teacher gate never stops the admin, and the add-ons card says "admin", not a trial.
  assert.equal(await t.gate("/api/teacher/anything", 1), true);
  const card = await t.call("GET", "/api/addons", 1);
  assert.deepEqual([card.body.bundle.via, card.body.todo.via], ["admin", "admin"]);
  // A teacher with no plan is the contrast: nothing is open, since there's no trial to fall back on.
  const teacher = await Promise.all((["math", "history", "social"] as const).map((app) => t.plans.appStatus(USERS[52], app)));
  assert.deepEqual(teacher.map((a) => a.access), [false, false, false]);
});
