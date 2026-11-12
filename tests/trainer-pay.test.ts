// Paying trainers in Arise (Stripe Connect, 1% to Arise). Run with: npx tsx --test tests/trainer-pay.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMemoryCoachStore, registerCoachRoutes } from "../server/coach";
import { createMemoryKv } from "../server/fitKv";
import { emptyFit } from "../shared/fit";
import { cleanTrainer, emptyTrainer } from "../shared/coach";
import { feeCents, trainerGets, totals } from "../shared/coachPay";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the fee math is small and clear", () => {
  assert.equal(feeCents(15000), 150); assert.equal(trainerGets(15000), 15000 - 150 - (435 + 30));
  assert.deepEqual(totals([{ id: "a", at: "2026-11-02", cents: 10000, fee: 100, label: "", kind: "once", status: "paid" }, { id: "b", at: "2026-10-01", cents: 5000, fee: 50, label: "", kind: "once", status: "paid" }], "2026-11-01"), { cents: 10000, fee: 100, count: 1, net: trainerGets(10000) });
});

test("set up payouts, a client pays by card, the trainer sees it; money goes to the trainer with a 1% fee", async () => {
  const store = createMemoryCoachStore(); const sent: any[] = []; const stripeCalls: { method: string; path: string; body: string }[] = [];
  const sessions = new Map<string, any>(); let account = { charges_enabled: false, payouts_enabled: false };
  const fakeFetch = (async (url: string, init: any) => {
    const path = url.replace("https://api.stripe.com/v1", ""); const method = init?.method ?? "GET"; const body = String(init?.body ?? "");
    stripeCalls.push({ method, path, body });
    const ok = (b: any) => new Response(JSON.stringify(b), { status: 200 });
    if (method === "POST" && path === "/accounts") return ok({ id: "acct_123" });
    if (method === "POST" && path === "/account_links") return ok({ url: "https://connect.stripe.test/onboard" });
    if (method === "GET" && path === "/accounts/acct_123") return ok(account);
    if (method === "POST" && path === "/checkout/sessions") { const id = `cs_test_${sessions.size + 1}abcdefgh`; const meta = Object.fromEntries([...new URLSearchParams(body)].filter(([k]) => k.startsWith("metadata[")).map(([k, v]) => [k.slice(9, -1), v])); sessions.set(id, { id, status: "open", payment_status: "unpaid", metadata: meta, mode: new URLSearchParams(body).get("mode"), amount_total: Number(new URLSearchParams(body).get("line_items[0][price_data][unit_amount]")) }); return ok({ id, url: `https://checkout.stripe.test/${id}` }); }
    const m = /^\/checkout\/sessions\/([^?]+)/.exec(path); if (m && sessions.has(decodeURIComponent(m[1]))) return ok(sessions.get(decodeURIComponent(m[1])));
    return new Response("{}", { status: 404 });
  }) as any;
  const routes = new Map<string, any[]>();
  const add = (m: string) => (path: string, ...h: any[]) => routes.set(`${m} ${path}`, h);
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT") };
  const call = async (m: string, path: string, user: number, body: any = {}) => {
    for (const [k, h] of routes) { const [km, kp] = k.split(" "); if (km !== m) continue; const names: string[] = []; const hit = path.match(new RegExp("^" + kp.replace(/:([a-z]+)/g, (_s, n) => { names.push(n); return "([^/?]+)"; }) + "$")); if (!hit) continue;
      const req: any = { params: Object.fromEntries(names.map((n, i) => [n, hit[i + 1]])), body, query: {}, user: { id: user, email: `u${user}@x.com` }, headers: {} };
      let status = 200, out: any; const res: any = { headersSent: false, status(s: number) { status = s; return res; }, json(b: any) { out = b; res.headersSent = true; return res; } };
      for (const fn of h) { let next = false; await fn(req, res, () => { next = true; }); if (!next) break; } return { status, body: out }; }
    throw new Error(`no route ${m} ${path}`);
  };
  registerCoachRoutes(app, (_q: any, _r: any, next: any) => next(), { store, kv: createMemoryKv(), fetch: fakeFetch, stripeKey: async () => "sk_test_x", fitData: async () => emptyFit(), nameOf: async (id) => ({ 101: "Vanessa" } as any)[id] ?? "X", notify: async (u, m) => { sent.push([u, m.title, m.body]); }, inviteSecret: "t", appUrl: "https://arisetodo.com" });
  await call("PUT", "/api/coach/trainer/profile", 7, { profile: cleanTrainer({ ...emptyTrainer("Mike"), name: "Coach Mike", prices: [{ id: "p1", label: "Online coaching", mode: "remote", cents: 15000, per: "month" }, { id: "p2", label: "1-on-1", mode: "inPerson", cents: 8000, per: "session" }, { id: "p3", label: "Free consult", mode: "remote", cents: 0, per: "session" }] }) });
  const inv = (await call("GET", "/api/coach/trainer/invite", 7)).body;
  await call("POST", `/api/coach/invite/${inv.code}/join`, 101, { consent: {} });
  const link = (await call("GET", "/api/coach/trainer", 7)).body.clients[0].id;

  // Before payouts are set up, the client can't pay by card.
  let opts = (await call("GET", `/api/coach/links/${link}/pay`, 101)).body;
  assert.equal(opts.ready, false); assert.deepEqual(opts.prices.map((p: any) => p.id), ["p1", "p2"], "a $0 price isn't payable");
  const setup = (await call("POST", "/api/coach/trainer/payouts/setup", 7, { returnTo: "https://arisetodo.com/" })).body;
  assert.equal(setup.url, "https://connect.stripe.test/onboard");
  assert.match(stripeCalls.find((c) => c.path === "/accounts")!.body, /type=express/);
  assert.equal((await call("POST", `/api/coach/links/${link}/pay`, 101, { priceId: "p2" })).status, 409, "onboarding not finished");
  account = { charges_enabled: true, payouts_enabled: true };
  assert.equal((await call("GET", "/api/coach/trainer/payouts", 7)).body.ready, true);

  // A session (one-time): destination charge with a 1% application fee.
  const once = (await call("POST", `/api/coach/links/${link}/pay`, 101, { priceId: "p2", returnTo: "https://evil.example/" })).body;
  const body = new URLSearchParams(stripeCalls.filter((c) => c.path === "/checkout/sessions").at(-1)!.body);
  assert.equal(body.get("mode"), "payment"); assert.equal(body.get("payment_intent_data[application_fee_amount]"), "80");
  assert.equal(body.get("payment_intent_data[transfer_data][destination]"), "acct_123");
  assert.match(body.get("success_url")!, /^https:\/\/arisetodo\.com\/#\/fit\?paid=/, "the return address can't be pointed elsewhere");
  // Monthly: a subscription with a 1% fee.
  await call("POST", `/api/coach/links/${link}/pay`, 101, { priceId: "p1" });
  const sub = new URLSearchParams(stripeCalls.filter((c) => c.path === "/checkout/sessions").at(-1)!.body);
  assert.equal(sub.get("mode"), "subscription"); assert.equal(sub.get("subscription_data[application_fee_percent]"), "1"); assert.equal(sub.get("line_items[0][price_data][recurring][interval]"), "month");
  assert.equal((await call("POST", `/api/coach/links/${link}/pay`, 7, { priceId: "p1" })).status, 404, "trainers can't pay themselves");
  assert.equal((await call("POST", `/api/coach/links/${link}/pay`, 101, { priceId: "p3" })).status, 400);

  // Paid in Safari (no return to the app): the next look records it, once, and tells the trainer.
  const sid = once.url.split("/").pop();
  Object.assign(sessions.get(sid), { status: "complete", payment_status: "paid" });
  opts = (await call("GET", `/api/coach/links/${link}/pay`, 101)).body;
  assert.equal(opts.payments.length, 1); assert.equal(opts.payments[0].cents, 8000); assert.equal(opts.payments[0].fee, 80);
  assert.deepEqual(sent.filter((x) => x[1] === "Payment received").map((x) => x[2]), ["Vanessa paid $80.00 for 1-on-1."]);
  assert.equal((await call("POST", "/api/coach/pay/confirm", 101, { session: sid })).body.payment.id, sid, "confirming again is fine");
  assert.equal(sent.filter((x) => x[1] === "Payment received").length, 1, "and doesn't notify twice");
  assert.equal((await call("POST", "/api/coach/pay/confirm", 555, { session: sid })).status, 403);
  const p = (await call("GET", "/api/coach/trainer/payouts", 7)).body;
  assert.equal(p.all.cents, 8000); assert.equal(p.recent[0].client, "Vanessa");
});

test("payments are in both apps, and the old 'no cut' line is gone", () => {
  assert.match(read("client/src/pages/fit/FitCoach.tsx"), /<PayTrainer token=\{token\} linkId=\{link\.id\}/);
  assert.doesNotMatch(read("client/src/pages/fit/FitCoach.tsx"), /doesn't take a cut/);
  assert.match(read("client/src/pages/trainer/TrainerApp.tsx"), /<PayoutsCard token=\{token\}/);
  assert.match(read("client/src/pages/fit/FitApp.tsx"), /\/api\/coach\/pay\/confirm/);
});
