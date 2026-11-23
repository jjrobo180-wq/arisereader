import test from "node:test";
import assert from "node:assert/strict";
import {
  DAILY_CAP, DEFAULT_CATALOG, balanceOf, canRedeem, cleanCatalog, cleanItem, earnings, monthSpend, pointsFor,
  type RewardRequest, type StoreConfig,
} from "../shared/rewardStore";
import { registerRewardStoreRoutes, type RewardDeps } from "../server/rewardStore";

test("prices: 2,500 points per dollar of cost, 20% on top, rounded up to 500; never below cost", () => {
  assert.equal(pointsFor(500), 15000);
  assert.equal(pointsFor(1000), 30000);
  assert.equal(pointsFor(525), 16000);
  assert.equal(cleanItem({ title: "Cheap", kind: "gift", costCents: 1000, points: 10 })!.points, 30000, "a paid reward can't be priced under cost + 20%");
  assert.equal(cleanItem({ title: "Screen time", points: 2000 }, true)!.costCents, 0, "a parent's perk costs nothing");
  assert.equal(cleanCatalog([{ title: "" }, { title: "No cost", kind: "gift" }]).length, 0);
  assert.ok(DEFAULT_CATALOG.every((x) => x.points >= pointsFor(x.costCents)));
});

test("earning: first pass of each book only, ×40, from the start day, capped per day", () => {
  const a = (bookId: number, pts: number, at: string) => ({ bookId, pointsEarned: pts, completedAt: at });
  const e = earnings([a(1, 10, "2026-11-10T10:00:00Z"), a(1, 10, "2026-11-11T10:00:00Z"), a(2, 0, "2026-11-12T10:00:00Z"), a(3, 30, "2026-11-01T10:00:00Z"),
    a(4, 30, "2026-11-13T09:00:00Z"), a(5, 30, "2026-11-13T10:00:00Z")], [], "2026-11-05");
  assert.deepEqual(e.map((x) => [x.day, x.points]), [["2026-11-10", 400], ["2026-11-13", 1200], ["2026-11-13", DAILY_CAP - 1200]]);
});

test("balance: points held by open requests, back when declined; a year later they're gone", () => {
  const earned = [{ day: "2026-01-01", points: 5000, what: "" }, { day: "2026-11-01", points: 20000, what: "" }];
  const req = (status: RewardRequest["status"], points: number): RewardRequest => ({ id: status, studentId: 1, studentName: "A", itemId: "x", kind: "gift", title: "x", points, costCents: 500, status, at: "2026-11-02T00:00:00Z" });
  assert.equal(balanceOf(earned, [req("waiting", 15000), req("declined", 3000)], "2026-11-18").balance, 10000);
  assert.equal(balanceOf(earned, [], "2027-01-05").balance, 20000, "January's points expired after a year");
});

test("safety: closed at $0, restocking at the budget, a monthly cap per student, a parent and a paid plan required", () => {
  const cfg: StoreConfig = { budgetCents: 1000, studentCapCents: 1000, startedOn: "2026-11-01" };
  const item = DEFAULT_CATALOG.find((x) => x.id === "amazon-5")!;
  const base = { item, balance: 99999, config: cfg, requests: [] as RewardRequest[], studentId: 1, month: "2026-11", paidPlan: true, hasParent: true };
  assert.deepEqual(canRedeem(base), { ok: true });
  assert.deepEqual(canRedeem({ ...base, config: { ...cfg, budgetCents: 0 } }), { ok: false, why: "closed" });
  const spent = (studentId: number, cents: number): RewardRequest => ({ id: `${studentId}`, studentId, studentName: "", itemId: "x", kind: "gift", title: "", points: 1, costCents: cents, status: "sent", at: "2026-11-03T00:00:00Z" });
  assert.deepEqual(canRedeem({ ...base, requests: [spent(2, 600)] }), { ok: false, why: "restocking" });
  assert.deepEqual(canRedeem({ ...base, config: { ...cfg, budgetCents: 5000, studentCapCents: 800 }, requests: [spent(1, 500)] }), { ok: false, why: "cap" });
  assert.deepEqual(canRedeem({ ...base, paidPlan: false }), { ok: false, why: "plan" });
  assert.deepEqual(canRedeem({ ...base, hasParent: false }), { ok: false, why: "parent" });
  assert.deepEqual(canRedeem({ ...base, balance: 100 }), { ok: false, why: "points" });
  assert.equal(monthSpend([spent(1, 500), { ...spent(1, 500), status: "declined" }], "2026-11"), 500);
});

// ── The whole flow on the server, with the settings table in memory ──
function server(over: Partial<RewardDeps> = {}) {
  const settings = new Map<string, string>();
  const routes = new Map<string, Function>();
  const add = (m: string) => (path: string, _auth: unknown, h: Function) => { routes.set(`${m} ${path}`, h); };
  const app = { get: add("GET"), post: add("POST"), put: add("PUT") } as any;
  const users: Record<number, any> = { 1: { id: 1, role: "student", displayName: "Ada" }, 2: { id: 2, role: "parent", displayName: "Mom", email: "mom@example.com" }, 9: { id: 9, role: "admin", isAdmin: true } };
  const notes: string[] = [];
  const deps: RewardDeps = {
    getSetting: async (k) => settings.get(k) || "", upsertSetting: async (k, v) => { settings.set(k, v); },
    getUser: async (id) => users[id], attempts: async () => [{ bookId: 1, pointsEarned: 30, completedAt: "2026-11-10T10:00:00Z" }, { bookId: 2, pointsEarned: 30, completedAt: "2026-11-11T10:00:00Z" }, { bookId: 3, pointsEarned: 30, completedAt: "2026-11-12T10:00:00Z" }, { bookId: 4, pointsEarned: 30, completedAt: "2026-11-13T10:00:00Z" }, { bookId: 5, pointsEarned: 30, completedAt: "2026-11-14T10:00:00Z" }, { bookId: 6, pointsEarned: 30, completedAt: "2026-11-15T10:00:00Z" }, { bookId: 7, pointsEarned: 30, completedAt: "2026-11-16T10:00:00Z" }, { bookId: 8, pointsEarned: 30, completedAt: "2026-11-17T10:00:00Z" }, { bookId: 9, pointsEarned: 30, completedAt: "2026-11-18T10:00:00Z" }, { bookId: 10, pointsEarned: 30, completedAt: "2026-11-09T10:00:00Z" }, { bookId: 11, pointsEarned: 30, completedAt: "2026-11-08T10:00:00Z" }, { bookId: 12, pointsEarned: 30, completedAt: "2026-11-07T10:00:00Z" }, { bookId: 13, pointsEarned: 30, completedAt: "2026-11-06T10:00:00Z" }],
    beginnersPasses: async () => [], parentStudentIds: async (p) => (p === 2 ? [1] : []), studentParentIds: async (s) => (s === 1 ? [2] : []),
    paidFamily: async () => true, paidStoreOpen: true, notify: async (_id, t) => { notes.push(t); }, now: () => Date.parse("2026-11-18T20:00:00Z"), ...over,
  };
  settings.set("reward_store_config", JSON.stringify({ budgetCents: 2000, studentCapCents: 1000, startedOn: "2026-11-01" }));
  registerRewardStoreRoutes(app, (() => {}) as any, deps);
  const call = async (as: number, key: string, body: any = {}, params: any = {}) => {
    let status = 200, out: any;
    const res = { status(c: number) { status = c; return res; }, json(b: any) { out = b; return res; }, set() { return res; } };
    await routes.get(key)!({ user: { id: as }, body, params }, res);
    return { status, body: out };
  };
  return { call, settings, notes };
}

test("a student cashes in, the parent says yes, it goes to the parent's email, the admin marks it sent", async () => {
  const s = server();
  const st = await s.call(1, "GET /api/rewards");
  assert.equal(st.body.balance, 13 * 1200);
  const amazon = st.body.store.find((x: any) => x.id === "amazon-5");
  assert.deepEqual(amazon.availability, { ok: true });
  const r = await s.call(1, "POST /api/rewards/redeem", { itemId: "amazon-5" });
  assert.equal(r.status, 200);
  assert.equal((await s.call(1, "GET /api/rewards")).body.balance, 13 * 1200 - 15000, "points are held while the parent decides");
  assert.ok(s.notes.some((n) => n.includes("Ada wants to cash in")));
  const p = await s.call(2, "GET /api/rewards");
  assert.equal(p.body.waiting.length, 1);
  const yes = await s.call(2, "POST /api/rewards/requests/:id/decide", { yes: true }, { id: r.body.request.id });
  assert.equal(yes.body.request.status, "approved");
  assert.equal(yes.body.request.sendTo, "mom@example.com");
  const admin = await s.call(9, "GET /api/rewards");
  assert.equal(admin.body.queue.length, 1);
  assert.equal(admin.body.summary.spentCents, 500);
  const done = await s.call(9, "POST /api/rewards/requests/:id/sent", { note: "order 1" }, { id: r.body.request.id });
  assert.equal(done.body.request.status, "sent");
  assert.equal((await s.call(1, "POST /api/rewards/redeem", { itemId: "amazon-10" })).status, 400, "the $10 monthly cap is reached ($5 + $10)");
});

test("Tremendous sends it the moment the parent says yes; a no gives the points back", async () => {
  const sent: any[] = [];
  const s = server({ tremendous: async (o) => { sent.push(o); return "ORD1"; } });
  const cat = JSON.parse(JSON.stringify(DEFAULT_CATALOG)); cat[0].tremendousProduct = "AMZN";
  s.settings.set("reward_store_catalog", JSON.stringify(cat));
  const r2 = await s.call(1, "POST /api/rewards/redeem", { itemId: "chickfila-5" });
  await s.call(2, "POST /api/rewards/requests/:id/decide", { yes: false }, { id: r2.body.request.id });
  assert.equal((await s.call(1, "GET /api/rewards")).body.balance, 13 * 1200, "a no gives the points back");
  const r = await s.call(1, "POST /api/rewards/redeem", { itemId: "amazon-5" });
  const yes = await s.call(2, "POST /api/rewards/requests/:id/decide", { yes: true }, { id: r.body.request.id });
  assert.equal(yes.body.request.status, "sent");
  assert.deepEqual(sent[0], { productId: "AMZN", cents: 500, name: "Mom", email: "mom@example.com", ref: r.body.request.id });
});

test("a parent's own rewards: free to give, picked by the child, given by the parent", async () => {
  const s = server({ paidFamily: async () => false });
  await s.call(2, "PUT /api/rewards/perks", { perks: [{ title: "Pick dinner", points: 3000 }] });
  const st = await s.call(1, "GET /api/rewards");
  assert.equal(st.body.perks.length, 1);
  assert.deepEqual(st.body.store.find((x: any) => x.id === "amazon-5").availability, { ok: false, why: "plan" }, "no paid plan: gift cards stay locked");
  const r = await s.call(1, "POST /api/rewards/redeem", { itemId: st.body.perks[0].id });
  assert.equal(r.status, 200);
  await s.call(2, "POST /api/rewards/requests/:id/decide", { yes: true }, { id: r.body.request.id });
  assert.equal((await s.call(2, "GET /api/rewards")).body.toGive.length, 1);
  assert.equal((await s.call(2, "POST /api/rewards/requests/:id/sent", {}, { id: r.body.request.id })).body.request.status, "sent");
  assert.equal((await s.call(1, "PUT /api/rewards/admin", { config: { budgetCents: 999999 } })).status, 403, "only the admin changes the store");
});

test("A.R.I.S.E. pays for no rewards: the gift-card store is closed, and parents (and teachers' class prizes) set the rewards", async () => {
  const { PAID_STORE_OPEN } = await import("../shared/rewardStore");
  assert.equal(PAID_STORE_OPEN, false);
  const s = server({ paidStoreOpen: undefined });
  await s.call(2, "PUT /api/rewards/perks", { perks: [{ title: "Pick dinner", points: 3000 }] });
  const st = await s.call(1, "GET /api/rewards");
  assert.deepEqual(st.body.store, [], "no gift cards, food or money from the site");
  assert.equal(st.body.perks.length, 1, "the parent's own rewards");
  const r = await s.call(1, "POST /api/rewards/redeem", { itemId: "amazon-5" });
  assert.equal(r.status, 404);
});
