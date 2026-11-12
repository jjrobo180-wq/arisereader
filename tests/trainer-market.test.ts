// The Arise marketplace (November 2026): clients post, trainers reply, the client hires.
// Run with: npx tsx --test tests/trainer-market.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMemoryCoachStore, registerCoachRoutes } from "../server/coach";
import { createMemoryKv } from "../server/fitKv";
import { emptyFit } from "../shared/fit";
import { cleanTrainer, emptyTrainer } from "../shared/coach";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NOW = Date.parse("2026-11-10T15:00:00Z");

test("post, get the right trainers told, reply, hire", async () => {
  const store = createMemoryCoachStore(); const sent: any[] = []; let clock = NOW;
  const routes = new Map<string, any[]>();
  const add = (m: string) => (path: string, ...h: any[]) => routes.set(`${m} ${path}`, h);
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT") };
  const call = async (m: string, path: string, user: number, body: any = {}) => {
    for (const [k, h] of routes) { const [km, kp] = k.split(" "); if (km !== m) continue; const names: string[] = []; const hit = path.match(new RegExp("^" + kp.replace(/:([a-z]+)/g, (_s, n) => { names.push(n); return "([^/?]+)"; }) + "$")); if (!hit) continue;
      const req: any = { params: Object.fromEntries(names.map((n, i) => [n, hit[i + 1]])), body, query: {}, user: { id: user }, headers: {} };
      let status = 200, out: any; const res: any = { headersSent: false, status(s: number) { status = s; return res; }, json(b: any) { out = b; res.headersSent = true; return res; } };
      for (const fn of h) { let next = false; await fn(req, res, () => { next = true; }); if (!next) break; } return { status, body: out }; }
    throw new Error(`no route ${m} ${path}`);
  };
  registerCoachRoutes(app, (_q: any, _r: any, next: any) => next(), { store, kv: createMemoryKv(), now: () => clock, fitData: async () => emptyFit(), nameOf: async (id) => ({ 101: "Vanessa Cruz" } as any)[id] ?? `T${id}`, notify: async (u, m) => { sent.push([u, m.title, m.body]); }, inviteSecret: "t" });
  const list = async (id: number, p: any) => store.saveTrainer({ userId: id, profile: cleanTrainer({ ...emptyTrainer(`Coach ${id}`), name: `Coach ${id}`, headline: "Strength and fat loss coach", bio: "I have coached hundreds of busy people to get strong and lean.", email: `c${id}@x.com`, accepting: true, ...p }), paidUntil: new Date(NOW + 30 * 864e5).toISOString(), stripeCustomer: null, stripeSub: null, createdAt: new Date(NOW).toISOString() });
  await list(7, { specialties: ["Fat loss"], modes: ["remote"], prices: [{ id: "a", label: "Online", mode: "remote", cents: 15000, per: "month" }] });
  await list(8, { specialties: ["Running"], modes: ["inPerson"], city: "Austin", state: "TX", prices: [{ id: "a", label: "Session", mode: "inPerson", cents: 8000, per: "session" }] });
  await list(9, { specialties: ["Fat loss"], modes: ["remote"], prices: [{ id: "a", label: "Online", mode: "remote", cents: 9000, per: "month" }] });
  await store.saveTrainer({ userId: 10, profile: cleanTrainer({ ...emptyTrainer("Unlisted"), name: "Unlisted", headline: "x", modes: ["remote"] }), paidUntil: null, stripeCustomer: null, stripeSub: null, createdAt: "" });

  const need = { goal: "Fat loss", modes: ["remote"], budgetCents: 20000, state: "CO", zip: "80205", level: "new", notes: "Mornings only" };
  assert.equal((await call("POST", "/api/coach/market", 101, { need: { modes: ["remote"] } })).status, 400);
  const posted = (await call("POST", "/api/coach/market", 101, { need })).body;
  assert.equal(posted.told, 2);
  const told = sent.filter((x) => x[1] === "New client request").map((x) => x[0]).sort();
  assert.deepEqual(told, [7, 9], "the in-person Austin running coach and the unlisted trainer aren't told");
  assert.match(sent.find((x) => x[0] === 7)[2], /Vanessa is looking for: Fat loss · Online coaching/);
  const rid = posted.request.id;

  // Trainers: who sees it, what they see, replying.
  const seen7 = (await call("GET", "/api/coach/trainer/market", 7)).body.requests;
  assert.equal(seen7.length, 1); assert.equal(seen7[0].name, "Vanessa"); assert.equal(seen7[0].need.zip, "802xx", "no exact ZIP");
  assert.equal(seen7[0].clientId, undefined, "no account id");
  assert.equal((await call("GET", "/api/coach/trainer/market", 8)).body.requests.length, 0);
  assert.match((await call("GET", "/api/coach/trainer/market", 10)).body.problem, /Get listed/);
  assert.equal((await call("POST", `/api/coach/trainer/market/${rid}/reply`, 8, { message: "I can help you run!" })).status, 404, "not a fit");
  assert.equal((await call("POST", `/api/coach/trainer/market/${rid}/reply`, 7, { message: "hi" })).status, 400);
  await call("POST", `/api/coach/trainer/market/${rid}/reply`, 7, { message: "I coach busy parents online, mornings are my specialty.", price: "$150/month" });
  await call("POST", `/api/coach/trainer/market/${rid}/reply`, 9, { message: "Happy to help you lose fat with simple home workouts.", price: "$90/month" });
  const edit = (await call("POST", `/api/coach/trainer/market/${rid}/reply`, 7, { message: "Updated: first week free, then $150/month.", price: "$150/month" })).body.request;
  assert.equal(edit.replies, 2, "editing doesn't add a reply"); assert.match(edit.mine.message, /^Updated/);
  assert.equal(sent.filter((x) => x[0] === 101 && x[1] === "A trainer replied").length, 2, "one note per trainer");

  // Client: sees replies with each trainer's public profile; hires one; the request closes for others.
  const mine = (await call("GET", "/api/coach/market/mine", 101)).body.requests[0];
  assert.deepEqual(mine.replies.map((x: any) => x.trainer.name), ["Coach 7", "Coach 9"]);
  assert.equal(mine.replies[0].trainer.email !== undefined, true);
  assert.equal((await call("POST", `/api/coach/market/${rid}/hire`, 101, { trainerId: 8 })).status, 400, "only someone who replied");
  assert.equal((await call("POST", `/api/coach/market/${rid}/hire`, 555, { trainerId: 9 })).status, 404, "only the person who posted");
  const hired = (await call("POST", `/api/coach/market/${rid}/hire`, 101, { trainerId: 9, consent: { workouts: true } })).body;
  assert.equal(hired.status, "active");
  assert.deepEqual(sent.at(-1).slice(0, 2), [9, "You were hired"]);
  const home9 = (await call("GET", "/api/coach/trainer", 9)).body;
  assert.equal(home9.clients[0].status, "active"); assert.equal(home9.clients[0].consent.workouts, true);
  assert.equal((await call("POST", `/api/coach/trainer/market/${rid}/reply`, 7, { message: "Still interested if things change!" })).status, 404, "closed after hiring");
  assert.equal((await call("GET", "/api/coach/trainer/market", 9)).body.requests[0].hiredMe, true);

  // Limits and expiry.
  for (let i = 0; i < 3; i++) await call("POST", "/api/coach/market", 101, { need });
  assert.equal((await call("POST", "/api/coach/market", 101, { need })).status, 400, "3 open at a time");
  clock = NOW + 15 * 864e5;
  assert.equal((await call("GET", "/api/coach/trainer/market", 7)).body.requests.filter((r: any) => r.status === "open" && !r.mine).length, 0, "expired after 14 days");
});

test("the marketplace is in both apps", () => {
  const ui = read("client/src/pages/coach/Market.tsx");
  for (const t of ["market-post", "market-hire", "market-reply", "market-send"]) assert.ok(ui.includes(t), t);
  assert.match(read("client/src/pages/trainer/TrainerApp.tsx"), /<MarketCard /);
  assert.match(read("client/src/pages/coach/Match.tsx"), /<PostRequest /);
});
