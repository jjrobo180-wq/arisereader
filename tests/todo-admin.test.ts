// The To-Do admin: the people list, counts, trials, cancelling, refunds and the on/off switch.
// Run with: npx tsx --test tests/todo-admin.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { registerPlanRoutes } from "../server/plans";
import { registerTodoAdminRoutes } from "../server/todoAdmin";
import { createPresenceTracker } from "../server/adminStats";
import { grantLive } from "../shared/plans";
import { cleanTrialDays, matchesPlan, matchesQuery, pageOf, planView, sortPeople, stripeKeyMode, bestInfo, type Person, type PlanInfo } from "../shared/todoAdmin";

const NOW = Date.parse("2026-10-15T18:00:00Z");
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const dayKeyDenver = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/Denver" });

// ─── pure rules ───────────────────────────────────────────────────────────
const info = (over: Partial<PlanInfo> = {}): PlanInfo => ({ kind: "todo_unlimited", source: "stripe", status: "active", live: true, endsAt: iso(NOW + 20 * DAY), trial: false, cancelAtPeriodEnd: false, ...over });

test("plan labels: free, paid, cancelling, failed payment, trial, gift, VIP, ended", () => {
  assert.equal(planView(null, false, NOW).tier, "free");
  const paid = planView(info(), false, NOW);
  assert.equal(paid.tier, "paid"); assert.match(paid.label, /\$5\/month/); assert.match(paid.detail, /Renews/); assert.equal(paid.unlimited, true);
  assert.match(planView(info({ kind: "todo_unlimited_year" }), false, NOW).label, /\$50\/year/);
  const canceling = planView(info({ cancelAtPeriodEnd: true }), false, NOW);
  assert.equal(canceling.canceling, true); assert.match(canceling.detail, /Cancelling/);
  assert.equal(planView(info({ status: "past_due" }), false, NOW).tier, "past_due");
  const trial = planView(info({ source: "admin", trial: true }), false, NOW);
  assert.equal(trial.tier, "trial"); assert.match(trial.detail, /until/);
  assert.equal(planView(info({ source: "admin", trial: true, endsAt: null }), false, NOW).tier, "gift");
  assert.equal(planView(info({ source: "admin", trial: true, live: false }), false, NOW).tier, "ended");
  assert.equal(planView(info({ live: false, status: "canceled" }), false, NOW).unlimited, false);
  assert.equal(planView(info({ live: false }), true, NOW).tier, "vip"); // the list wins
  assert.equal(planView(info({ kind: "todo_family" }), false, NOW).unlimited, false); // the old family plan is not Unlimited
});

test("the best plan record: a running one first, Unlimited before the family plan", () => {
  const family = info({ kind: "todo_family" }), ended = info({ live: false, status: "canceled" }), unlimited = info();
  assert.equal(bestInfo([ended, family, unlimited]), unlimited);
  assert.equal(bestInfo([ended, family]), family);
  assert.equal(bestInfo([]), null);
});

const person = (over: Partial<Person> = {}): Person => ({
  id: 1, name: "Ada Lovelace", username: "ada", email: "ada@example.com", role: "todo", createdAt: "2026-10-01T00:00:00Z", enabled: true, confirmed: true,
  lastActiveAt: null, plan: planView(null, false, NOW), paidCents: 0, refundedCents: 0, ...over,
});

test("search finds names, usernames and emails; filters and sorts behave", () => {
  const ada = person(), bob = person({ id: 2, name: "Bob Ng", username: "bobng", email: "BOB@Mail.com", createdAt: "2026-10-10T00:00:00Z", enabled: false, paidCents: 500 });
  assert.equal(matchesQuery(ada, "lovelace"), true);
  assert.equal(matchesQuery(ada, "ada exam"), true);
  assert.equal(matchesQuery(bob, "bob@mail"), true);
  assert.equal(matchesQuery(bob, "zzz"), false);
  assert.equal(matchesQuery(bob, "   "), true);
  assert.equal(matchesPlan(bob, "off"), true); assert.equal(matchesPlan(ada, "off"), false);
  assert.equal(matchesPlan(ada, "free"), true);
  assert.deepEqual(sortPeople([ada, bob], "newest").map((p) => p.id), [2, 1]);
  assert.deepEqual(sortPeople([ada, bob], "oldest").map((p) => p.id), [1, 2]);
  assert.deepEqual(sortPeople([ada, bob], "name").map((p) => p.id), [1, 2]);
  assert.deepEqual(sortPeople([ada, bob], "paid").map((p) => p.id), [2, 1]);
  assert.equal(matchesPlan(person({ confirmed: false }), "problem"), true);
});

test("paging keeps to the real pages", () => {
  const list = Array.from({ length: 60 }, (_, i) => i);
  assert.deepEqual(pageOf(list, 1, 25).rows.length, 25);
  assert.equal(pageOf(list, 3, 25).rows.length, 10);
  assert.equal(pageOf(list, 99, 25).page, 3); // past the end lands on the last page
  assert.equal(pageOf(list, -4, 25).page, 1);
  assert.equal(pageOf([], 1, 25).pages, 1);
  assert.equal(pageOf(list, 1, 10_000).rows.length, 60); // size is limited to 100
});

test("trial days and Stripe key mode", () => {
  assert.equal(cleanTrialDays(14), 14); assert.equal(cleanTrialDays(0), 0);
  for (const bad of [-1, 1.5, "x", null, undefined, "", true, 99999]) assert.equal(cleanTrialDays(bad), null);
  assert.equal(stripeKeyMode("sk_test_abc"), "test"); assert.equal(stripeKeyMode("sk_live_abc"), "live"); assert.equal(stripeKeyMode(""), "unset");
});

// ─── routes, with the real plans module and a pretend database and Stripe ───
const USERS = [
  { id: 1, username: "boss", display_name: "Boss", role: "student", is_admin: true, email: "boss@x.com", created_at: "2026-01-01T00:00:00Z" },
  { id: 10, username: "mia", display_name: "Mia Park", role: "todo", is_admin: false, email: "mia@example.com", created_at: iso(NOW - 3 * DAY), account_approved: true },
  { id: 11, username: "noah", display_name: "Noah Lee", role: "todo", is_admin: false, email: "noah@example.com", created_at: iso(NOW - 40 * DAY), account_approved: true },
  { id: 12, username: "zed", display_name: "Zed Fox", role: "todo", is_admin: false, email: "zed@example.com", created_at: iso(NOW - 1 * DAY), account_approved: false },
  { id: 13, username: "pat", display_name: "Pat Rowe", role: "parent", is_admin: false, email: "pat@example.com", created_at: iso(NOW - 10 * DAY), account_approved: true },
  { id: 14, username: "ms.t", display_name: "Ms. T", role: "teacher", is_admin: false, email: "t@school.org", created_at: iso(NOW - 100 * DAY), account_approved: true },
  { id: 15, username: "kid", display_name: "Kid", role: "student", is_admin: false, email: null, created_at: iso(NOW - 100 * DAY), account_approved: true },
  { id: 16, username: "sample", display_name: "Sample", role: "teacher", is_admin: false, email: null, created_at: iso(NOW - 100 * DAY), account_approved: true },
  { id: 17, username: "old", display_name: "Old Off", role: "todo", is_admin: false, email: "old@example.com", created_at: iso(NOW - 200 * DAY), account_approved: true, archived_at: iso(NOW - 5 * DAY) },
];

function fakeDb(state: { settings: Map<string, string> }) {
  const query = (rows: any[]) => {
    let list = rows; let lo = 0, hi = 999;
    const q: any = {
      select: () => q, order: () => q, eq: () => q,
      like: (_c: string, pattern: string) => { const pre = pattern.replace(/%$/, ""); list = list.filter((r) => String(r.key).startsWith(pre)); return q; },
      gte: (c: string, v: string) => { list = list.filter((r) => String(r[c]) >= v); return q; },
      range: (a: number, b: number) => { lo = a; hi = b; return q; },
      then: (ok: any, bad: any) => Promise.resolve({ data: list.slice(lo, hi + 1), error: null }).then(ok, bad),
    };
    return q;
  };
  return { from: (table: string) => table === "users" ? query(USERS) : query([...state.settings].map(([key, value]) => ({ key, value }))) };
}

function setup(opts: { stripe?: boolean } = {}) {
  const settings = new Map<string, string>();
  const stripeCalls: { method: string; url: string; body: string }[] = [];
  const subs: Record<string, any> = {};
  const charges: any[] = [];
  const stripeFetch: any = async (url: string, init: any) => {
    const path = url.replace("https://api.stripe.com/v1", "");
    stripeCalls.push({ method: init.method, url: path, body: String(init.body || "") });
    const ok = (body: any) => ({ ok: true, json: async () => body });
    const sub = /^\/subscriptions\/(sub_\w+)/.exec(path);
    if (sub && subs[sub[1]]) {
      const s = subs[sub[1]];
      if (init.method === "DELETE") s.status = "canceled";
      if (init.method === "POST" && /cancel_at_period_end=true/.test(String(init.body))) s.cancel_at_period_end = true;
      if (init.method === "POST" && /cancel_at_period_end=false/.test(String(init.body))) s.cancel_at_period_end = false;
      return ok(s);
    }
    if (path.startsWith("/charges")) {
      const cus = /customer=(cus_\w+)/.exec(path)?.[1];
      const data = charges.filter((c) => !cus || c.customer === cus);
      return ok({ data, has_more: false });
    }
    if (path === "/refunds") { const c = charges.find((x) => `charge=${x.id}` === String(init.body)); if (c) c.amount_refunded = c.amount; return ok({ id: "re_1" }); }
    return { ok: false, json: async () => ({}) };
  };
  const admin = (req: any, res: any, next: any) => (req.user?.isAdmin ? next() : res.status(403).json({ message: "no" }));
  const auth = (req: any, _res: any, next: any) => { req.user = USERS.find((u) => u.id === Number(req.headers.authorization)) && { id: Number(req.headers.authorization), isAdmin: USERS.find((u) => u.id === Number(req.headers.authorization))!.is_admin }; return next(); };
  const routes: Record<string, Function[]> = {};
  const app: any = {
    get: (p: string, ...h: Function[]) => { routes["GET " + p] = h; }, post: (p: string, ...h: Function[]) => { routes["POST " + p] = h; },
    use: () => {},
  };
  const userRow = (id: number) => USERS.find((u) => u.id === id);
  const plans = registerPlanRoutes(app, auth as any, admin as any, {
    getSetting: async (k) => settings.get(k) ?? "", upsertSetting: async (k, v) => { settings.set(k, v); },
    userForToken: async () => null,
    getUser: async (id) => { const u = userRow(id); return u ? { id: u.id, role: u.role, username: u.username, displayName: u.display_name, email: u.email, isAdmin: u.is_admin } : null; },
    countTeacherStudents: async () => 0, countSchoolStudents: async () => 0, schoolName: async () => "",
    envStripeKey: () => (opts.stripe === false ? "" : "sk_live_abcdefghijk"),
    fetch: stripeFetch, now: () => NOW,
  });
  const presence = createPresenceTracker({ readSetting: async () => "", upsertSetting: async () => {}, now: () => NOW });
  const archived: { id: number; archive: boolean }[] = [];
  const confirmed: number[] = [];
  registerTodoAdminRoutes(app, auth as any, admin as any, {
    db: () => fakeDb({ settings }) as any, plans, presence, now: () => NOW,
    setArchived: async (id, archive) => { archived.push({ id, archive }); const u = userRow(id)!; (u as any).archived_at = archive ? iso(NOW) : null; },
    confirm: async (id) => { confirmed.push(id); (userRow(id) as any).account_approved = true; },
  });
  const call = async (method: string, path: string, who: number, body: any = {}, query: any = {}) => {
    const url = path.replace(/\/\d+(?=\/|$)/, "/:id");
    const req: any = { headers: { authorization: String(who) }, body, query, params: { id: /\/(\d+)(?:\/|$)/.exec(path)?.[1] }, originalUrl: path };
    const out: any = { status: 200, body: null };
    const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; }, set() { return res; } };
    const chain = routes[`${method} ${url}`];
    assert.ok(chain, "no route " + method + " " + url);
    let i = 0;
    const next = async () => { const h = chain[i++]; if (h) await h(req, res, next); };
    await next();
    return out;
  };
  const seedPaid = (userId: number, kind: "todo_unlimited" | "todo_unlimited_year", cus: string, sub: string, extra: any = {}) => {
    const grant = { kind, ownerId: userId, source: "stripe", status: "active", seats: 1, endsAt: iso(NOW + 20 * DAY), updatedAt: iso(NOW - DAY), buyerId: userId, stripeCustomerId: cus, stripeSubscriptionId: sub, ...extra };
    settings.set(`plan_${kind}_${userId}`, JSON.stringify(grant));
    const idx = JSON.parse(settings.get("plan_index") || "{}"); idx[kind] = [...(idx[kind] || []), userId]; settings.set("plan_index", JSON.stringify(idx));
    subs[sub] = { id: sub, status: "active", customer: cus, current_period_end: Math.floor((NOW + 20 * DAY) / 1000), cancel_at_period_end: false, metadata: { kind, ownerId: String(userId), buyerId: String(userId) }, items: { data: [{ id: "si_1", quantity: 1 }] } };
  };
  const seedCharge = (id: string, cus: string, amount: number, over: any = {}) => charges.push({ id, customer: cus, amount, amount_refunded: 0, status: "succeeded", paid: true, created: Math.floor((NOW - 5 * DAY) / 1000), description: "Subscription", ...over });
  return { call, settings, archived, confirmed, seedPaid, seedCharge, stripeCalls, presence, plans };
}

test("only the admin can use any of it", async () => {
  const s = setup();
  for (const [m, p] of [["GET", "/api/todo-admin/overview"], ["GET", "/api/todo-admin/people"], ["GET", "/api/todo-admin/people/10"], ["POST", "/api/todo-admin/people/10/active"], ["POST", "/api/todo-admin/people/10/trial"], ["POST", "/api/todo-admin/people/10/cancel"], ["POST", "/api/todo-admin/people/10/refund"], ["POST", "/api/todo-admin/people/10/vip"]] as const) {
    assert.equal((await s.call(m, p, 10)).status, 403, `${m} ${p}`);
  }
});

test("the list shows To-Do sign-ups with names, leaves out admins, students' sample accounts and others unless asked", async () => {
  const s = setup();
  const todo = (await s.call("GET", "/api/todo-admin/people", 1)).body;
  assert.deepEqual(todo.rows.map((r: any) => r.username), ["zed", "mia", "noah", "old"]); // newest first
  assert.equal(todo.total, 4);
  const everyone = (await s.call("GET", "/api/todo-admin/people", 1, {}, { role: "all", size: "100" })).body;
  assert.equal(everyone.total, 7); // not the admin, not "sample"
  assert.ok(!everyone.rows.some((r: any) => ["boss", "sample"].includes(r.username)));
  const search = (await s.call("GET", "/api/todo-admin/people", 1, {}, { q: "park" })).body;
  assert.deepEqual(search.rows.map((r: any) => r.username), ["mia"]);
  const off = (await s.call("GET", "/api/todo-admin/people", 1, {}, { plan: "off" })).body;
  assert.deepEqual(off.rows.map((r: any) => r.username), ["old"]);
  assert.equal(todo.rows.find((r: any) => r.username === "zed").confirmed, false);
  assert.equal(todo.rows.find((r: any) => r.username === "old").enabled, false);
});

test("a free trial turns Unlimited on until the day it ends, and ending it turns it off", async () => {
  const s = setup();
  assert.equal((await s.call("POST", "/api/todo-admin/people/10/trial", 1, { days: 14, note: "beta tester" })).status, 200);
  assert.equal((await s.plans.todoUnlimited({ id: 10, role: "todo", username: "mia", email: "mia@example.com" } as any)).unlimited, true);
  const row = (await s.call("GET", "/api/todo-admin/people", 1)).body.rows.find((r: any) => r.username === "mia");
  assert.equal(row.plan.tier, "trial");
  assert.equal(row.plan.endsAt, iso(NOW + 14 * DAY));
  const detail = (await s.call("GET", "/api/todo-admin/people/10", 1)).body;
  assert.equal(detail.plan.source, "admin"); assert.equal(detail.plan.note, "beta tester");
  assert.equal((await s.call("POST", "/api/todo-admin/people/10/trial/end", 1)).status, 200);
  assert.equal((await s.plans.todoUnlimited({ id: 10, role: "todo", username: "mia", email: "mia@example.com" } as any)).unlimited, false);
  assert.equal((await s.call("POST", "/api/todo-admin/people/10/trial/end", 1)).status, 404);
});

test("a trial with no end date is free access, and bad trial input is refused", async () => {
  const s = setup();
  assert.equal((await s.call("POST", "/api/todo-admin/people/11/trial", 1, { days: 0 })).status, 200);
  assert.equal((await s.call("GET", "/api/todo-admin/people", 1)).body.rows.find((r: any) => r.username === "noah").plan.tier, "gift");
  assert.equal((await s.call("POST", "/api/todo-admin/people/10/trial", 1, { days: "lots" })).status, 400);
  assert.equal((await s.call("POST", "/api/todo-admin/people/15/trial", 1, { days: 7 })).status, 400); // a student
  assert.equal((await s.call("POST", "/api/todo-admin/people/999/trial", 1, { days: 7 })).status, 404);
  assert.equal((await s.call("POST", "/api/todo-admin/people/1/trial", 1, { days: 7 })).status, 404); // an admin is not in the list
});

test("a paying person shows what they paid, and a trial is refused while they are paying", async () => {
  const s = setup();
  s.seedPaid(11, "todo_unlimited", "cus_noah123", "sub_noah123");
  s.seedCharge("ch_1", "cus_noah123", 500); s.seedCharge("ch_2", "cus_noah123", 500, { amount_refunded: 200 });
  s.seedCharge("ch_3", "cus_other123", 5000);
  const row = (await s.call("GET", "/api/todo-admin/people", 1)).body.rows.find((r: any) => r.username === "noah");
  assert.equal(row.plan.tier, "paid"); assert.equal(row.paidCents, 1000); assert.equal(row.refundedCents, 200);
  assert.equal((await s.call("POST", "/api/todo-admin/people/11/trial", 1, { days: 7 })).status, 409);
  const detail = (await s.call("GET", "/api/todo-admin/people/11", 1)).body;
  assert.equal(detail.payments.length, 2); assert.equal(detail.plan.canCancel, true); assert.equal(detail.mode, "live");
});

test("the overview counts people, plans and money", async () => {
  const s = setup();
  s.seedPaid(11, "todo_unlimited", "cus_noah123", "sub_noah123");
  s.seedPaid(10, "todo_unlimited_year", "cus_mia123", "sub_mia123");
  s.seedCharge("ch_1", "cus_noah123", 500); s.seedCharge("ch_2", "cus_mia123", 5000, { amount_refunded: 5000 }); s.seedCharge("ch_3", "cus_stranger", 1000);
  await s.call("POST", "/api/todo-admin/people/13/trial", 1, { days: 30 });
  s.presence.touch({ id: 10, role: "todo", username: "mia" });
  const o = (await s.call("GET", "/api/todo-admin/overview", 1)).body;
  assert.equal(o.accounts.total, 7);
  assert.equal(o.accounts.byRole.todo, 4); assert.equal(o.accounts.byRole.teacher, 1); assert.equal(o.accounts.byRole.parent, 1); assert.equal(o.accounts.byRole.student, 1);
  assert.equal(o.accounts.off, 1); assert.equal(o.accounts.unconfirmed, 1);
  assert.equal(o.newAccounts.all.week, 2); // mia (3 days ago) and zed (yesterday); pat (10 days ago) is only this month
  assert.equal(o.newAccounts.all.month, 3);
  assert.equal(o.newAccounts.todo.week, 2);
  assert.equal(o.plans.paid, 2); assert.equal(o.plans.monthly, 1); assert.equal(o.plans.yearly, 1); assert.equal(o.plans.trials, 1);
  assert.equal(o.money.available, true); assert.equal(o.money.mode, "live");
  assert.equal(o.money.collectedCents, 6500); assert.equal(o.money.refundedCents, 5000);
  assert.equal(o.money.todoCollectedCents, 500); // 500 + (5000 - 5000)
  assert.equal(o.money.monthlyRecurringCents, 500 + Math.round(5000 / 12));
  assert.equal(o.active.now, 1); assert.equal(o.active.all.today, 1);
});

test("cancelling: at the end of the period keeps access, now ends it, and it can be taken back", async () => {
  const s = setup();
  s.seedPaid(11, "todo_unlimited", "cus_noah123", "sub_noah123");
  assert.equal((await s.call("POST", "/api/todo-admin/people/11/cancel", 1, { when: "later" })).status, 400);
  assert.equal((await s.call("POST", "/api/todo-admin/people/11/cancel", 1, { when: "period_end" })).status, 200);
  assert.ok(s.stripeCalls.some((c) => c.method === "POST" && c.url === "/subscriptions/sub_noah123" && /cancel_at_period_end=true/.test(c.body)));
  let row = (await s.call("GET", "/api/todo-admin/people", 1)).body.rows.find((r: any) => r.username === "noah");
  assert.equal(row.plan.canceling, true); assert.equal(row.plan.unlimited, true); // still theirs until it runs out
  assert.equal((await s.call("POST", "/api/todo-admin/people/11/keep", 1)).status, 200);
  row = (await s.call("GET", "/api/todo-admin/people", 1)).body.rows.find((r: any) => r.username === "noah");
  assert.equal(row.plan.canceling, false);
  assert.equal((await s.call("POST", "/api/todo-admin/people/11/keep", 1)).status, 404);
  assert.equal((await s.call("POST", "/api/todo-admin/people/11/cancel", 1, { when: "now" })).status, 200);
  assert.ok(s.stripeCalls.some((c) => c.method === "DELETE" && c.url === "/subscriptions/sub_noah123"));
  row = (await s.call("GET", "/api/todo-admin/people", 1)).body.rows.find((r: any) => r.username === "noah");
  assert.equal(row.plan.unlimited, false);
  assert.equal((await s.call("POST", "/api/todo-admin/people/11/cancel", 1, { when: "now" })).status, 404); // nothing left to cancel
});

test("refunding takes back the last payment that is still whole", async () => {
  const s = setup();
  s.seedPaid(11, "todo_unlimited", "cus_noah123", "sub_noah123");
  s.seedCharge("ch_new", "cus_noah123", 500);
  const r = await s.call("POST", "/api/todo-admin/people/11/refund", 1);
  assert.equal(r.status, 200); assert.equal(r.body.refundedCents, 500);
  assert.equal((await s.call("POST", "/api/todo-admin/people/11/refund", 1)).status, 404); // nothing left
  assert.equal((await s.call("POST", "/api/todo-admin/people/10/refund", 1)).status, 404); // never paid
});

test("switching an account off and on, and not your own", async () => {
  const s = setup();
  assert.equal((await s.call("POST", "/api/todo-admin/people/10/active", 1, { active: false })).status, 200);
  assert.deepEqual(s.archived, [{ id: 10, archive: true }]);
  assert.equal((await s.call("GET", "/api/todo-admin/people", 1, {}, { plan: "off" })).body.total, 2);
  assert.equal((await s.call("POST", "/api/todo-admin/people/10/active", 1, { active: true })).status, 200);
  assert.equal((await s.call("POST", "/api/todo-admin/people/10/active", 1, { active: "yes" })).status, 400);
  assert.equal((await s.call("POST", "/api/todo-admin/people/1/active", 1, { active: false })).status, 404);
});

test("confirming an email by hand, and the VIP switch", async () => {
  const s = setup();
  assert.equal((await s.call("POST", "/api/todo-admin/people/12/confirm", 1)).status, 200);
  assert.deepEqual(s.confirmed, [12]);
  assert.equal((await s.call("POST", "/api/todo-admin/people/12/confirm", 1)).status, 409);
  assert.equal((await s.call("POST", "/api/todo-admin/people/10/vip", 1, { on: true })).status, 200);
  assert.equal((await s.call("GET", "/api/todo-admin/people", 1)).body.rows.find((r: any) => r.username === "mia").plan.tier, "vip");
  assert.equal((await s.call("POST", "/api/todo-admin/people/10/vip", 1, { on: false })).status, 200);
  assert.equal((await s.call("GET", "/api/todo-admin/people", 1)).body.rows.find((r: any) => r.username === "mia").plan.tier, "free");
  assert.equal((await s.call("POST", "/api/todo-admin/people/15/vip", 1, { on: true })).status, 400); // a student
});

test("with no Stripe key the list still works and says why amounts are missing", async () => {
  const s = setup({ stripe: false });
  const list = (await s.call("GET", "/api/todo-admin/people", 1)).body;
  assert.equal(list.moneyAvailable, false);
  assert.equal(list.rows[0].paidCents, null);
  const o = (await s.call("GET", "/api/todo-admin/overview", 1)).body;
  assert.equal(o.money.available, false); assert.match(o.money.note, /not set up/);
  assert.equal((await s.call("POST", "/api/todo-admin/people/11/cancel", 1, { when: "now" })).status, 404);
  assert.equal(dayKeyDenver(NOW), "2026-10-15");
});

test("a free trial ends on its day, with none of the extra days a paid plan gets", () => {
  const base: any = { kind: "todo_unlimited", ownerId: 1, source: "admin", status: "active", seats: 1, endsAt: iso(NOW + 14 * DAY), updatedAt: iso(NOW) };
  assert.equal(grantLive({ ...base, trial: true }, NOW + 14 * DAY - 1000), true);
  assert.equal(grantLive({ ...base, trial: true }, NOW + 14 * DAY + 1000), false);
  assert.equal(grantLive(base, NOW + 14 * DAY + 1000), true); // other plans keep their days of grace
});
