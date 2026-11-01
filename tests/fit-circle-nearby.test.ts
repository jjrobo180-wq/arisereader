// Arise Fit: workout buddies (guests), gyms and healthy food near you, recipes, and Siri links.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyFit, type FitData, type Workout } from "../shared/fit";
import { MAX_GUESTS, buddyStats, cleanCode, inviteLink, makeCode, newWorkouts } from "../shared/fitBuddy";
import { createBuddies, createMemoryKv } from "../server/fitBuddies";
import { registerFitRoutes, createMemoryFitStore } from "../server/fit";
import { CHAIN_BY_ID, FOOD_CHAINS, GYM_CHAINS, busyCurve, busyLevel, crowdNow, foodChainOf, foodQuery, gymChainOf, gymTypeFor, gymsQuery, nearbyCell, parsePlaces, quietTimes } from "../shared/fitNearby";
import { GYM_BY_ID } from "../shared/fitGym";
import { RECIPES, cleanRecipe, pickRecipes } from "../shared/fitRecipes";
import { SIRI_ACTIONS, readLink } from "../shared/fitLinks";

const day = 864e5;
const set = (weight: number, reps = 8) => ({ reps, weight, done: true });
const workout = (id: string, date: string, weight = 100): Workout => ({ id, date, name: "Push", secs: 2700, exercises: [{ exId: "bench-press", name: "Bench Press", sets: [set(weight), set(weight), set(weight)] }] });
const withWorkouts = (ws: Workout[]): FitData => ({ ...emptyFit(), workouts: ws });

function setup() {
  const data = new Map<number, unknown>();
  const sent: { to: number; title: string; body: string }[] = [];
  const names: Record<number, string> = { 1: "Ava", 2: "Ben", 3: "Cam", 4: "Dee", 5: "Eli", 6: "Fay", 7: "Gus", 8: "Hal" };
  const b = createBuddies({ kv: createMemoryKv(), getData: async (id) => data.get(id) ?? null, nameOf: async (id) => names[id] ?? "", notify: async (to, m) => { sent.push({ to, title: m.title, body: m.body }); } });
  return { b, data, sent };
}

test("invite codes: easy to read aloud, cleaned when typed, and a link that opens Arise Fit", () => {
  for (let i = 0; i < 50; i++) { const c = makeCode(); assert.equal(c.length, 6); assert.doesNotMatch(c, /[01ILO]/); assert.equal(cleanCode(c.toLowerCase().replace(/(...)/, "$1-")), c); }
  assert.equal(cleanCode("ABC12"), null);
  assert.equal(cleanCode("ABCDE0"), null, "0 is never in a code");
  assert.equal(inviteLink("https://arisetodo.com/app", "ABCDEF"), "https://arisetodo.com/app#/fit?buddy=ABCDEF");
});

test("buddies: a friend joins with my code; guests can't invite guests; the group is capped", async () => {
  const { b, sent } = setup();
  const { code } = await b.invite(1) as { code: string };
  assert.equal((await b.view(1)).role, "none", "no group until someone joins");
  assert.equal((await b.join(1, code) as any).error, 400, "your own code");
  assert.deepEqual(await b.join(2, code.toLowerCase()), { ok: true });
  assert.equal(sent.at(-1)?.to, 1); assert.match(sent.at(-1)!.body, /Ben joined/);
  const host = await b.view(1), guest = await b.view(2);
  assert.equal(host.role, "host"); assert.equal(host.code, code);
  assert.equal(guest.role, "guest"); assert.equal(guest.code, null); assert.equal(guest.canInvite, false);
  assert.deepEqual(guest.buddies.map((x) => [x.name, x.role, x.me]), [["Ava", "host", false], ["Ben", "guest", true]]);
  // A guest has everything except adding guests.
  assert.equal((await b.invite(2) as any).error, 403);
  for (const id of [3, 4, 5, 6]) assert.deepEqual(await b.join(id, code), { ok: true });
  assert.equal((await b.view(1)).buddies.length, 1 + MAX_GUESTS);
  assert.equal((await b.join(7, code) as any).error, 409, "full");
  // Someone hosting their own group can't also be a guest.
  const other = await b.invite(8) as { code: string };
  await b.join(7, other.code);
  assert.equal((await b.join(8, code) as any).error, 409);
  assert.match((await b.join(7, code) as any).message, /already in Hal's group/);
  // A new code: the old one stops working, people already in stay.
  const fresh = await b.invite(1, true) as { code: string };
  assert.notEqual(fresh.code, code);
  await b.remove(1, 6);
  assert.equal((await b.join(6, code) as any).error, 404);
  assert.deepEqual(await b.join(6, fresh.code), { ok: true });
});

test("buddies: cheers, leaving, removing, ending the group", async () => {
  const { b, sent } = setup();
  const { code } = await b.invite(1) as { code: string };
  await b.join(2, code); await b.join(3, code);
  assert.deepEqual(await b.cheer(2, 3, "fire"), { ok: true }, "guests can cheer each other");
  assert.match(sent.at(-1)!.body, /Ben says you're on fire/);
  assert.equal((await b.view(3)).cheers[0].kind, "fire");
  assert.equal((await b.cheer(2, 2, "cheer") as any).error, 404, "not yourself");
  assert.equal((await b.cheer(2, 99, "cheer") as any).error, 404, "only your group");
  assert.equal((await b.remove(2, 3) as any).error, 404, "only the host removes");
  await b.leave(3);
  assert.equal((await b.view(3)).role, "none");
  assert.equal((await b.view(1)).buddies.length, 2);
  await b.leave(1); // the host ends it
  assert.equal((await b.view(2)).role, "none");
  assert.equal((await b.join(4, code) as any).error, 404, "an ended group's code is gone");
});

test("what buddies see: training only, this week, new records", () => {
  const now = Date.parse("2026-11-01T18:00:00Z");
  const iso = (daysAgo: number) => new Date(now - daysAgo * day).toISOString();
  const d = { ...withWorkouts([workout("a", iso(20), 100), workout("b", iso(2), 120), workout("c", iso(0.1), 110)]), foods: [{ id: "f", date: "2026-11-01", meal: "lunch" as const, name: "Secret pizza", kcal: 900, p: 30, c: 90, f: 40, servings: 1 }], weights: [{ date: "2026-11-01", kg: 90 }] };
  const s = buddyStats(d, now);
  assert.equal(s.week, 2);
  assert.equal(s.sets7, 6);
  assert.equal(s.minutes7, 90);
  assert.equal(s.last?.date, iso(0.1));
  assert.deepEqual(s.prs.map((p) => [p.name, p.weight]), [["Bench Press", 120]]);
  assert.ok(!JSON.stringify(s).includes("pizza") && !("weights" in s) && !("foods" in s), "no food or weight");
  assert.equal(newWorkouts(withWorkouts([workout("a", iso(1))]), withWorkouts([workout("a", iso(1)), workout("z", iso(0.05))]), now).length, 1);
  assert.equal(newWorkouts(null, withWorkouts([workout("old", iso(3))]), now).length, 0, "an old workout synced from another phone isn't news");
});

test("saving a new workout tells your buddies; saving when you're in no group tells nobody", async () => {
  const routes: Record<string, Function> = {};
  const add = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h[h.length - 1]; };
  const sent: { to: number; title: string }[] = [];
  const kv = createMemoryKv();
  registerFitRoutes({ get: add("GET"), post: add("POST"), put: add("PUT") } as any, (_q: any, _s: any, n: any) => n(), {
    store: createMemoryFitStore(), kv, nameOf: async (id) => ["", "Ava", "Ben", "Cam"][id] ?? "", notify: async (to, m) => { sent.push({ to, title: m.title }); },
    overpass: async () => ({ elements: [] }),
  });
  const call = async (key: string, user: number, body: any = {}, query: any = {}) => {
    let status = 200, json: any = null;
    const res: any = { set() { return res; }, status(c: number) { status = c; return res; }, json(v: any) { json = v; return res; } };
    await routes[key]({ user: { id: user }, body, query }, res);
    await new Promise((r) => setTimeout(r, 5));
    return { status, json };
  };
  const code = (await call("POST /api/fit/buddies/invite", 1)).json.code;
  assert.equal((await call("POST /api/fit/buddies/join", 2, { code })).status, 200);
  assert.equal((await call("POST /api/fit/buddies/join", 1, { code: "ZZZZZZ" })).status, 404);
  sent.length = 0;
  await call("PUT /api/fit/data", 2, { data: withWorkouts([workout("w1", new Date().toISOString())]) });
  assert.deepEqual(sent, [{ to: 1, title: "Ben just trained 💪" }]);
  await call("PUT /api/fit/data", 2, { data: withWorkouts([workout("w1", new Date().toISOString())]) });
  assert.equal(sent.length, 1, "the same workout saved again isn't news");
  await call("PUT /api/fit/data", 3, { data: withWorkouts([workout("w9", new Date().toISOString())]) });
  assert.equal(sent.length, 1, "Cam isn't in a group");
  const view = (await call("GET /api/fit/buddies", 1)).json;
  assert.equal(view.buddies.find((x: any) => x.name === "Ben").stats.week, 1);
  assert.equal((await call("POST /api/fit/buddies/cheer", 1, { to: 2, kind: "nudge" })).status, 200);
  assert.equal(sent.at(-1)?.to, 2);
});

test("gym chains: matched by name, priced, and set as My gym", () => {
  assert.equal(gymChainOf("Planet Fitness")?.id, "planet-fitness");
  assert.equal(gymChainOf("Gym", "Planet Fitness")?.id, "planet-fitness");
  assert.equal(gymChainOf("LA Fitness Signature Club")?.id, "la-fitness");
  assert.equal(gymChainOf("Gold's Gym Denver")?.id, "golds");
  assert.equal(gymChainOf("YMCA of Metro Denver")?.id, "ymca");
  assert.equal(gymChainOf("Crunch Fitness - Aurora")?.id, "crunch");
  assert.equal(gymChainOf("Iron Temple Barbell"), null);
  for (const c of GYM_CHAINS) if (c.gymType) assert.ok(GYM_BY_ID.has(c.gymType), c.id);
  assert.match(CHAIN_BY_ID.get("planet-fitness")!.price!.plans[0][1], /\$10/);
  assert.equal(gymTypeFor({ chain: "planet-fitness", name: "PF" }), "planet-fitness");
  assert.equal(gymTypeFor({ chain: null, name: "Iron Temple" }), "other-gym");
  assert.equal(gymTypeFor({ chain: "eos", name: "EoS" }), "other-gym");
});

test("busy times: after work is packed, late night is quiet, weekends peak in the morning", () => {
  const mon = busyCurve(1), sat = busyCurve(6), fri = busyCurve(5);
  assert.equal(busyLevel(mon[18]), "packed");
  assert.equal(busyLevel(mon[2]), "quiet");
  assert.ok(sat[10] > sat[18], "Saturday morning beats Saturday evening");
  assert.ok(fri[18] < mon[18], "Friday evening is lighter than Monday's");
  assert.ok(quietTimes(1).every((h) => h >= 6 && h < 22 && mon[h] < 40));
  const now = 1_000_000_000;
  assert.equal(crowdNow([], now), null);
  assert.deepEqual(crowdNow([{ level: "packed", at: now - 5 * 60_000 }, { level: "busy", at: now - 10 * 60_000 }], now), { level: "packed", n: 2, mins: 5 });
  assert.equal(crowdNow([{ level: "packed", at: now - 3 * 3600_000 }], now), null, "old reports drop off");
});

test("places from OpenStreetMap: named, near first, healthy food only, no duplicates", () => {
  const from: [number, number] = [39.74, -104.99];
  const gyms = parsePlaces({ elements: [
    { type: "node", id: 1, lat: 39.75, lon: -104.99, tags: { name: "Planet Fitness", leisure: "fitness_centre", "addr:housenumber": "100", "addr:street": "Main St", "addr:city": "Denver", opening_hours: "24/7", website: "https://planetfitness.com" } },
    { type: "way", id: 2, center: { lat: 39.741, lon: -104.991 }, tags: { name: "Iron Temple", leisure: "fitness_centre" } },
    { type: "node", id: 3, lat: 39.741, lon: -104.991, tags: { leisure: "fitness_centre" } },
    { type: "node", id: 4, lat: 39.75, lon: -104.99, tags: { name: "Planet Fitness", leisure: "fitness_centre" } },
    { type: "node", id: 5, lat: 41, lon: -104.99, tags: { name: "Far Gym" } },
  ] }, "gyms", from);
  assert.deepEqual(gyms.map((g) => g.name), ["Iron Temple", "Planet Fitness"]);
  assert.equal(gyms[1].chain, "planet-fitness"); assert.equal(gyms[1].address, "100 Main St, Denver"); assert.equal(gyms[0].id, "w2");
  const food = parsePlaces({ elements: [
    { type: "node", id: 10, lat: 39.742, lon: -104.99, tags: { name: "Chipotle Mexican Grill", amenity: "fast_food" } },
    { type: "node", id: 11, lat: 39.742, lon: -104.99, tags: { name: "Joe's Burgers", amenity: "fast_food", cuisine: "burger" } },
    { type: "node", id: 12, lat: 39.743, lon: -104.99, tags: { name: "Poke Bar", amenity: "restaurant", cuisine: "poke" } },
    { type: "node", id: 13, lat: 39.743, lon: -104.99, tags: { name: "Cavallo Pizza", amenity: "restaurant", cuisine: "pizza" } },
  ] }, "food", from);
  assert.deepEqual(food.map((f) => [f.name, f.chain]), [["Chipotle Mexican Grill", "chipotle"], ["Poke Bar", null]]);
  assert.equal(foodChainOf("McDonald's")?.id, "mcdonalds");
  assert.equal(foodChainOf("Chick-fil-A")?.id, "chick-fil-a");
  assert.match(gymsQuery(39.7, -105), /fitness_centre/);
  assert.match(foodQuery(39.7, -105), /Chipotle/);
  assert.doesNotMatch(foodQuery(39.7, -105), /\\b|\\s/, "Overpass regexes can't use \\b or \\s");
  assert.deepEqual(nearbyCell("food", 39.7432, -104.9876), [39.75, -105]);
  for (const c of FOOD_CHAINS) for (const p of c.picks) { const cal = p.p * 4 + p.c * 4 + p.f * 9; assert.ok(Math.abs(cal - p.kcal) / p.kcal < 0.25, `${c.name}: ${p.name} adds up (${cal} vs ${p.kcal})`); }
});

test("the nearby endpoint: one fetch per area, and people's crowd reports", async () => {
  const routes: Record<string, Function> = {};
  const add = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h[h.length - 1]; };
  const asked: string[] = [];
  registerFitRoutes({ get: add("GET"), post: add("POST"), put: add("PUT") } as any, (_q: any, _s: any, n: any) => n(), {
    store: createMemoryFitStore(), kv: createMemoryKv(),
    overpass: async (q) => { asked.push(q); return { elements: [{ type: "node", id: 7, lat: 39.75, lon: -104.99, tags: { name: "Planet Fitness" } }] }; },
  });
  const call = async (key: string, user: number, query: any = {}, body: any = {}) => {
    let status = 200, json: any = null;
    const res: any = { set() { return res; }, status(c: number) { status = c; return res; }, json(v: any) { json = v; return res; } };
    await routes[key]({ user: { id: user }, query, body }, res);
    return { status, json };
  };
  const a = await call("GET /api/fit/nearby", 1, { kind: "gyms", lat: "39.741", lng: "-104.99" });
  assert.equal(a.json.elements.length, 1);
  await call("GET /api/fit/nearby", 2, { kind: "gyms", lat: "39.744", lng: "-104.98" });
  assert.equal(asked.length, 1, "nearby people share one fetch");
  assert.equal((await call("GET /api/fit/nearby", 1, { kind: "pizza", lat: "1", lng: "1" })).status, 400);
  assert.equal((await call("POST /api/fit/busy", 1, {}, { place: "n7", level: "packed" })).json.crowd.level, "packed");
  await call("POST /api/fit/busy", 1, {}, { place: "n7", level: "quiet" });
  assert.equal((await call("POST /api/fit/busy", 1, {}, { place: "n7; drop", level: "quiet" })).status, 400);
  const b = await call("GET /api/fit/nearby", 3, { kind: "gyms", lat: "39.741", lng: "-104.99" });
  assert.deepEqual(b.json.crowd.n7 && [b.json.crowd.n7.level, b.json.crowd.n7.n], ["quiet", 1], "one report per person counts");
});

test("recipes: numbers add up, best fits first, AI recipes cleaned", async () => {
  for (const r of RECIPES) {
    const cal = r.p * 4 + r.c * 4 + r.f * 9;
    assert.ok(Math.abs(cal - r.kcal) / r.kcal < 0.12, `${r.name}: ${cal} vs ${r.kcal}`);
    assert.ok(r.ingredients.length && r.steps.length && r.tags.length, r.id);
  }
  assert.equal(new Set(RECIPES.map((r) => r.id)).size, RECIPES.length);
  const morning = pickRecipes({ kcal: 2000, p: 120 }, { hour: 7 });
  assert.ok(morning.slice(0, 3).every((r) => r.tags.includes("breakfast")));
  const tight = pickRecipes({ kcal: 300, p: 40 }, { hour: 19 });
  assert.ok(tight[0].kcal <= 300);
  assert.ok(pickRecipes({ kcal: 2000, p: 0 }, { tag: "vegetarian" }).every((r) => r.tags.includes("vegetarian")));
  assert.equal(cleanRecipe({ name: "x" }), null);
  const ok = cleanRecipe({ name: "Egg fried rice", kcal: "450", p: 22, c: 60, f: 12, ingredients: ["rice", "eggs"], steps: ["Cook"], tags: ["dinner", "made-up"] });
  assert.ok(ok && ok.kcal === 450 && ok.id.startsWith("ai-") && ok.tags.join() === "dinner");

  const routes: Record<string, Function> = {};
  const add = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h[h.length - 1]; };
  let asked: any = null;
  registerFitRoutes({ get: add("GET"), post: add("POST"), put: add("PUT") } as any, (_q: any, _s: any, n: any) => n(), {
    store: createMemoryFitStore(), kv: createMemoryKv(), recipe: async (ask) => { asked = ask; return ok; },
  });
  const call = async (body: any) => { let status = 200, json: any = null; const res: any = { set() { return res; }, status(c: number) { status = c; return res; }, json(v: any) { json = v; return res; } }; await routes["POST /api/fit/recipe"]({ user: { id: 1 }, body }, res); return { status, json }; };
  assert.equal((await call({ have: "" })).status, 400);
  assert.equal((await call({ have: "chicken, rice", goal: "gain", left: { kcal: 900, p: 70 } })).json.recipe.name, "Egg fried rice");
  assert.deepEqual(asked, { have: "chicken, rice", goal: "build muscle", left: { kcal: 900, p: 70 } });
});

test("Siri and links: actions and invites, in the app and on the website", () => {
  assert.deepEqual(readLink("arisefit://do/workout"), { action: "workout" });
  assert.deepEqual(readLink("https://arisetodo.com/app#/fit?do=fast-start"), { action: "fast-start" });
  assert.deepEqual(readLink("https://arisetodo.com/app#/fit?buddy=abcdef"), { buddy: "ABCDEF" });
  assert.deepEqual(readLink("arisefit://buddy/K7M2PQ"), { buddy: "K7M2PQ" });
  assert.deepEqual(readLink("arisefit://do/delete-everything"), {});
  assert.equal(new Set(SIRI_ACTIONS.map((a) => a.phrase)).size, SIRI_ACTIONS.length);
  const plist = readFileSync(new URL("../.github/scripts/configure_fit_app.py", import.meta.url), "utf8");
  assert.match(plist, /CFBundleURLSchemes": \["arisefit"\]/);
});

test("wired in: buddies, near me and recipes on Today, Siri in Settings, eat out in Food, gyms in Train", () => {
  const read = (f: string) => readFileSync(new URL(`../client/src/pages/fit/${f}`, import.meta.url), "utf8");
  const app = read("FitApp.tsx");
  for (const s of ["<BuddyCard", "<BuddySheet", "<NearbyGyms", "<EatOut", "<RecipesSheet", "<SiriSheet", "useDeepLinks(", "fit-open-siri", "smartWorkoutNow("]) assert.ok(app.includes(s), s);
  assert.ok(read("FitFood.tsx").includes("fit-food-eat-out"));
  assert.ok(read("FitTrain.tsx").includes("fit-train-gyms"));
});
