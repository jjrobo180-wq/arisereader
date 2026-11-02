// Arise Coaching: the trainer directory, consent-based sharing, the coaching plan and the listing fee.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALL_CONSENT, cleanCoaching, cleanConsent, cleanTrainer, cleanUrl, compliance, emptyClientSide, emptyCoaching, expandProgram, filterTrainers, forClient,
  listingProblems, snapshot, sortTrainers, type PublicTrainer,
} from "../shared/coach";
import { emptyFit } from "../shared/fit";
import { createMemoryCoachStore, registerCoachRoutes } from "../server/coach";

const T = (o: Partial<PublicTrainer>): PublicTrainer => ({ ...cleanTrainer({ name: "T", headline: "Strength coach", bio: "x".repeat(50), prices: [{ mode: "remote", cents: 10000, per: "month" }] }), id: 1, rating: 0, reviews: 0, since: "2026-01-01", fromCents: 10000, clients: 0, ...o });

test("listings are cleaned: links are https only, prices set the modes, state codes are real", () => {
  const t = cleanTrainer({ name: " Mike ", website: "javascript:alert(1)", bookingUrl: "calendly.com/mike", state: "zz", prices: [{ mode: "inPerson", cents: 8000, per: "session" }, { mode: "bogus", cents: 1 }], photo: "data:text/html;base64,AAAA" });
  assert.equal(t.name, "Mike");
  assert.equal(t.website, "");
  assert.equal(t.bookingUrl, "https://calendly.com/mike");
  assert.equal(t.state, "");
  assert.deepEqual(t.modes, ["inPerson"]);
  assert.equal(t.prices.length, 1);
  assert.equal(t.photo, "");
  assert.equal(cleanUrl("http://x.com"), "https://x.com/");
  assert.ok(listingProblems(t).includes("Add your city and state for in-person training"));
});

test("directory: filters by mode, state, price, rating; online trainers show in every state", () => {
  const list = [T({ id: 1, name: "Local", modes: ["inPerson"], state: "TX", fromCents: 6000, rating: 4.9, reviews: 20 }), T({ id: 2, name: "Online", modes: ["remote"], state: "CA", fromCents: 15000, rating: 5, reviews: 1 }), T({ id: 3, name: "Far", modes: ["inPerson"], state: "NY", fromCents: 9000 })];
  assert.deepEqual(filterTrainers(list, { state: "TX" }).map((t) => t.name), ["Local", "Online"]);
  assert.deepEqual(filterTrainers(list, { state: "TX", mode: "inPerson" }).map((t) => t.name), ["Local"]);
  assert.deepEqual(filterTrainers(list, { maxCents: 10000 }).map((t) => t.name), ["Local", "Far"]);
  assert.deepEqual(sortTrainers(list, "priceLow").map((t) => t.name), ["Local", "Far", "Online"]);
  // One 5-star review doesn't beat twenty 4.9s.
  assert.equal(sortTrainers(list, "rating")[0].name, "Local");
});

test("sharing: the trainer sees only what the client allowed", () => {
  const fit = { ...emptyFit(), weights: [{ date: "2026-10-01", kg: 90 }], foods: [{ id: "a", date: "2026-10-30", meal: "lunch" as const, name: "Rice", kcal: 200, p: 4, c: 44, f: 1, servings: 2 }] };
  const none = snapshot(fit, cleanConsent({ profile: false }), "Sam", "2026-10-01", new Date("2026-10-31T12:00:00"));
  assert.equal(none.profile, undefined); assert.equal(none.weights, undefined); assert.equal(none.food, undefined);
  const all = snapshot(fit, ALL_CONSENT, "Sam", "2026-10-01", new Date("2026-10-31T12:00:00"));
  assert.equal(all.weights?.length, 1);
  assert.equal(all.food?.[0].kcal, 400);
});

test("coaching: private notes never reach the client; programs land on the calendar; compliance counts", () => {
  const c = cleanCoaching({ notes: "bad knee", tags: ["vip"], habits: [{ id: "h1", name: "Water", days: [] }], assigned: [{ id: "a1", name: "Upper", date: "2026-10-30", items: [{ exId: "bench-press", name: "Bench", sets: 3, reps: "5", rest: 120 }] }] });
  assert.equal((forClient(c) as any).notes, undefined);
  assert.equal((forClient(c) as any).tags, undefined);
  const lib = { workouts: [{ id: "w1", name: "A", items: [] }], exercises: [], programs: [], forms: [], quickReplies: [] };
  const a = expandProgram({ id: "p", name: "P", weeks: 1, days: [{ day: 0, workoutId: "w1" }, { day: 2, workoutId: "w1" }] }, lib, "2026-11-02");
  assert.deepEqual(a.map((x) => x.date), ["2026-11-02", "2026-11-04"]);
  const side = { ...emptyClientSide(), habitLog: { "2026-10-30": ["h1"] } };
  const r = compliance(c, side, [{ id: "w", date: "2026-10-30T10:00:00Z", name: "Upper", programId: "coach", dayId: "a1", secs: 60, exercises: [] }], new Date("2026-10-31T12:00:00"));
  assert.deepEqual(r.workouts, [1, 1]);
  assert.deepEqual(r.habits, [1, 7]);
});

// A tiny stand-in for Express: records the routes so the test can call them.
function fakeApp() {
  const routes = new Map<string, any[]>();
  const add = (m: string) => (path: string, ...h: any[]) => routes.set(`${m} ${path}`, h);
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT") };
  const call = async (m: string, path: string, user: number | null, body: any = {}) => {
    for (const [k, h] of routes) {
      const [km, kp] = k.split(" "); if (km !== m) continue;
      const names: string[] = []; const re = new RegExp("^" + kp.replace(/:([a-z]+)/g, (_s, n) => { names.push(n); return "([^/?]+)"; }) + "(?:\\?.*)?$");
      const hit = path.match(re); if (!hit) continue;
      const q = Object.fromEntries(new URLSearchParams(path.split("?")[1] || ""));
      const req: any = { params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(hit[i + 1])])), body, query: q, user: user ? { id: user } : null, headers: {} };
      let status = 200, out: any;
      const res: any = { headersSent: false, status(s: number) { status = s; return res; }, json(b: any) { out = b; res.headersSent = true; return res; } };
      for (const fn of h) { let next = false; await fn(req, res, () => { next = true; }); if (!next) break; }
      return { status, body: out };
    }
    throw new Error(`no route ${m} ${path}`);
  };
  return { app, call };
}

test("server: listing → request with consent → accept → plan → messages → review", async () => {
  const store = createMemoryCoachStore();
  const fit = { ...emptyFit(), weights: [{ date: "2026-10-01", kg: 90 }] };
  const sent: any[] = [];
  const { app, call } = fakeApp();
  let now = Date.parse("2026-10-31T12:00:00Z");
  registerCoachRoutes(app, (_req: any, _res: any, next: any) => next(), { store, fitData: async () => fit, nameOf: async (id) => (id === 7 ? "Coach" : "Sam"), notify: async (u, m) => { sent.push([u, m.title]); }, now: () => now, isAdmin: (req) => req.user?.id === 99 });
  const TRAINER = 7, CLIENT = 8;
  // A trainer fills in a listing; it isn't public until it's paid (or comped).
  await call("PUT", "/api/coach/trainer/profile", TRAINER, { profile: { name: "Coach Mike", headline: "Strength for busy men", bio: "I coach strength and fat loss for people with busy lives and jobs.", email: "mike@gym.com", prices: [{ mode: "remote", cents: 15000, per: "month" }] } });
  assert.equal((await call("GET", "/api/coach/trainers", null)).body.trainers.length, 0);
  assert.equal((await call("POST", "/api/coach/admin/comp", 8, { userId: TRAINER, days: 30 })).status, 403);
  await call("POST", "/api/coach/admin/comp", 99, { userId: TRAINER, days: 30 });
  const list = (await call("GET", "/api/coach/trainers", null)).body.trainers;
  assert.equal(list.length, 1); assert.equal(list[0].fromCents, 15000);
  // A client asks, sharing only body weight.
  const r = await call("POST", "/api/coach/request", CLIENT, { trainerId: TRAINER, consent: { profile: false, body: true }, message: "Help me lose 20 lb" });
  const id = r.body.id;
  assert.deepEqual(sent.at(-1), [TRAINER, "New client request"]);
  // A stranger can't see the connection; the client can't accept for the trainer.
  assert.equal((await call("GET", `/api/coach/links/${id}/client`, 50)).status, 404);
  assert.equal((await call("POST", `/api/coach/links/${id}/accept`, CLIENT)).status, 404);
  await call("POST", `/api/coach/links/${id}/accept`, TRAINER);
  const detail = (await call("GET", `/api/coach/links/${id}/client`, TRAINER)).body;
  assert.equal(detail.snapshot.weights.length, 1);
  assert.equal(detail.snapshot.profile, undefined);
  // The plan: the client sees workouts but never the private notes.
  await call("PUT", `/api/coach/links/${id}/coaching`, TRAINER, { coaching: { ...emptyCoaching(), notes: "watch the knee", assigned: [{ id: "a1", name: "Day 1", date: "2026-10-31", items: [{ exId: "bench-press", name: "Bench", sets: 3, reps: "5", rest: 90 }] }] } });
  const mine = (await call("GET", "/api/coach/me", CLIENT)).body.links[0];
  assert.equal(mine.coaching.assigned.length, 1); assert.equal(mine.coaching.notes, undefined);
  await call("POST", `/api/coach/links/${id}/done/a1`, CLIENT);
  // Saving the plan again keeps what the client finished.
  await call("PUT", `/api/coach/links/${id}/coaching`, TRAINER, { coaching: { ...emptyCoaching(), assigned: [{ id: "a1", name: "Day 1", date: "2026-10-31", items: [] }] } });
  assert.ok((await call("GET", `/api/coach/links/${id}/client`, TRAINER)).body.coaching.assigned[0].done);
  // Messages both ways; the trainer reads the request message.
  const msgs = (await call("GET", `/api/coach/links/${id}/messages`, TRAINER)).body.messages;
  assert.equal(msgs[0].body, "Help me lose 20 lb");
  await call("POST", `/api/coach/links/${id}/messages`, TRAINER, { body: "Let's go" });
  assert.equal((await call("GET", "/api/coach/me", CLIENT)).body.links[0].unread, 1);
  // Only coached clients can review; a review shows on the listing.
  assert.equal((await call("POST", `/api/coach/trainers/${TRAINER}/review`, 55, { stars: 5 })).status, 403);
  await call("POST", `/api/coach/trainers/${TRAINER}/review`, CLIENT, { stars: 5, text: "Great coach" });
  const page = (await call("GET", `/api/coach/trainers/${TRAINER}`, null)).body;
  assert.equal(page.trainer.rating, 5); assert.equal(page.reviews[0].text, "Great coach");
  // Ending coaching stops sharing at once.
  await call("POST", `/api/coach/links/${id}/end`, CLIENT);
  assert.equal((await call("GET", `/api/coach/links/${id}/client`, TRAINER)).body.snapshot.weights, undefined);
  // The comped listing runs out on its own.
  now += 40 * 864e5;
  assert.equal((await call("GET", `/api/coach/trainers/${TRAINER}`, null)).status, 404);
});

test("wiring: routes, the trainer app, notifications and the iPhone build", () => {
  const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
  assert.match(read("server/routes.ts"), /registerCoachRoutes\(app, authMiddleware/);
  assert.match(read("client/src/App.tsx"), /isTrainerApp\(\)/);
  assert.match(read("client/src/App.tsx"), /path="\/trainers"/);
  assert.match(read("server/applePush.ts"), /trainer: "com\.arisereader\.trainer"/);
  assert.match(read(".github/workflows/trainer-ios.yml"), /PRODUCT_BUNDLE_IDENTIFIER=com\.arisereader\.trainer/);
  assert.match(read(".github/workflows/trainer-ios.yml"), /APPLE_ID_AUTH PUSH_NOTIFICATIONS/);
  assert.match(read(".github/workflows/fit-ios.yml"), /HEALTHKIT APPLE_ID_AUTH PUSH_NOTIFICATIONS/);
  assert.match(read("server/ota.ts"), /"trainer"/);
  assert.match(read("migrations/coach.sql"), /create table if not exists public\.coach_links/);
  assert.match(read("client/src/pages/fit/FitApp.tsx"), /<CoachCard/);
});
