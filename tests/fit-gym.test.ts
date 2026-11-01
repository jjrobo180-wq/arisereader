// Arise Fit: My gym (workouts only from your equipment), reading machine QR codes, the photo endpoint,
// swapping, camera reps and the after-workout debrief.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CATALOG, cleanFit, emptyFit, type Workout } from "../shared/fit";
import { GEAR, GEAR_BY_ID, GYM_TYPES, canDo, cleanGearIds, cleanGym, exercisesOn, gearFromText, needsOf } from "../shared/fitGym";
import { alternatives, generateWorkout } from "../shared/fitRecovery";
import { debrief, SUPPLEMENTS } from "../shared/fitDebrief";
import { formLiftFor } from "../shared/fitForm";
import { registerFitRoutes } from "../server/fit";

const PF = GYM_TYPES.find((g) => g.id === "planet-fitness")!.gear;

test("every exercise's equipment is real gear, and most gear has exercises", () => {
  for (const e of CATALOG) for (const way of needsOf(e.id)) for (const g of way) assert.ok(GEAR_BY_ID.has(g), `${e.id} needs ${g}`);
  assert.ok(GEAR.filter((g) => exercisesOn(g.id).length).length >= GEAR.length - 2);
  assert.equal(new Set(GEAR.map((g) => g.id)).size, GEAR.length);
  for (const g of GEAR) assert.ok(g.how.length >= 2 && g.avoid.length >= 1, g.id);
});

test("what a gym can do", () => {
  assert.equal(canDo("leg-press", PF), true);
  assert.equal(canDo("deadlift", PF), false, "Planet Fitness usually has no barbells");
  assert.equal(canDo("bench-press", PF), true, "on the Smith machine");
  assert.equal(canDo("push-up", []), true);
  assert.equal(canDo("lunge", []), true, "lunges work without weights");
  assert.equal(canDo("leg-press", ["dumbbells"]), false);
  assert.equal(canDo("lat-pulldown", ["cable-station"]), true);
});

test("built-for-you workouts use only my gym's equipment", () => {
  const data = { ...emptyFit(), profile: { ...emptyFit().profile, goal: "gain" as const } };
  for (const [gear, label] of [[PF, "Planet Fitness"], [["dumbbells", "bench"], "home"], [[], "nothing"]] as const) {
    for (const focus of ["push", "pull", "legs", "full"] as const) {
      const w = generateWorkout(data, { equip: "mygym", gear: [...gear], mins: 45, goal: "gain", focus, seed: 7 });
      for (const it of w.items) assert.ok(canDo(it.exId, gear), `${label} ${focus}: ${it.exId}`);
      if (label !== "nothing") assert.ok(w.items.length >= 3, `${label} ${focus} has a workout`);
    }
  }
  const alts = alternatives("leg-press", "mygym", [], [], ["dumbbells"]);
  assert.ok(alts.length && alts.every((a) => canDo(a.id, ["dumbbells"])));
});

test("reading machine QR codes and labels", () => {
  assert.equal(gearFromText("https://example-gym.com/app/equipment/leg-press?club=12")?.id, "leg-press");
  assert.equal(gearFromText("SEATED_LEG_CURL")?.id, "leg-curl-seated");
  assert.equal(gearFromText("https://x.co/m?machine=Lat%20Pulldown")?.id, "lat-pulldown");
  assert.equal(gearFromText("arisefit:gear:rower")?.id, "rower");
  assert.equal(gearFromText("Smith Machine #3")?.id, "smith-machine");
  assert.equal(gearFromText("https://example.com/welcome"), null);
  assert.equal(gearFromText("press"), null, "too vague to guess");
});

test("a saved gym is cleaned, and kept with the profile", () => {
  assert.deepEqual(cleanGym({ type: "home", gear: ["dumbbells", "nonsense", "dumbbells"], name: "Garage" }), { type: "home", name: "Garage", gear: ["dumbbells"] });
  assert.equal(cleanGym({ type: "made-up", gear: [] }), undefined);
  const d = cleanFit({ profile: { goal: "gain", gym: { type: "planet-fitness", gear: ["leg-press", "x"] } } });
  assert.deepEqual(d.profile.gym, { type: "planet-fitness", gear: ["leg-press"] });
  assert.deepEqual(cleanGearIds(["Leg-Press", "rower", 5, "rower"]), ["leg-press", "rower"]);
});

test("the photo endpoint: one machine or a whole room, photos never kept", async () => {
  const routes: Record<string, Function> = {};
  const add = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h[h.length - 1]; };
  const seen: string[] = [];
  registerFitRoutes({ get: add("GET"), post: add("POST"), put: add("PUT") } as any, (_q: any, _s: any, n: any) => n(), {
    store: { get: async () => null, set: async () => {} },
    identify: async (_img, mode) => { seen.push(mode); return mode === "gym" ? { gear: ["dumbbells", "bench"], name: "", note: "" } : { gear: ["leg-press"], name: "Leg press", note: "" }; },
  });
  const call = async (body: any) => {
    let status = 200, json: any = null;
    const res: any = { set() { return res; }, status(c: number) { status = c; return res; }, json(v: any) { json = v; return res; } };
    await routes["POST /api/fit/identify"]({ user: { id: 1 }, body }, res);
    return { status, json };
  };
  const img = "data:image/jpeg;base64,AAAA";
  assert.equal((await call({ image: img })).json.gear[0], "leg-press");
  assert.deepEqual((await call({ image: img, mode: "gym" })).json.gear, ["dumbbells", "bench"]);
  assert.equal((await call({ image: "not a photo" })).status, 400);
  assert.deepEqual(seen, ["machine", "gym"]);
});

test("after a workout: soreness, refuel, water", () => {
  const now = Date.parse("2026-11-01T18:00:00Z");
  const set = { reps: 10, weight: 100, done: true };
  const w: Workout = { id: "w1", date: new Date(now).toISOString(), name: "Legs", secs: 3600, exercises: [
    { exId: "back-squat", name: "Back Squat", sets: [set, set, set, set, set] },
    { exId: "leg-press", name: "Leg Press", sets: [set, set, set, set] },
    { exId: "leg-curl", name: "Leg Curl", sets: [set, set, set] },
  ] };
  const d = debrief(w, { workouts: [], profile: { ...emptyFit().profile, goal: "gain" }, weights: [{ date: "2026-10-30", kg: 80 }] }, now);
  assert.equal(d.sore[0].muscle, "Quads");
  assert.equal(d.sore[0].level, "strong");
  assert.ok(d.sore[0].isNew);
  assert.deepEqual(d.protein, { lo: 20, hi: 32 });
  assert.ok(d.carbs && d.carbs.lo === 64 && d.carbs.hi === 96);
  assert.equal(d.eatBy, now + 2 * 3600_000);
  assert.ok(d.waterMl >= 400 && d.waterMl <= 1500);
  assert.equal(SUPPLEMENTS.length, 2);
  assert.ok(SUPPLEMENTS[0].points.some((p) => /3 to 5 g/.test(p)));
});

test("the camera counts reps for the lifts it can see", () => {
  assert.equal(formLiftFor("back-squat"), "squat");
  assert.equal(formLiftFor("db-curl"), "curl");
  assert.equal(formLiftFor("leg-press"), null);
});

test("wired in: My gym and Scan on Train, swap and camera in a workout, debrief after, the paused screen is readable", () => {
  const train = readFileSync(new URL("../client/src/pages/fit/FitTrain.tsx", import.meta.url), "utf8");
  for (const id of ["fit-my-gym", "fit-scan-machine", "fit-live-swap-", "fit-live-cam-", "fit-live-scan"]) assert.ok(train.includes(id), id);
  assert.match(train, /<Debrief w=\{done\.w\}/);
  // The paused screen is dark in every theme, so its text must not use the theme's (dark in Light) text color.
  const paused = train.slice(train.indexOf('data-testid="fit-paused"') - 400, train.indexOf('data-testid="fit-paused-finish"'));
  assert.ok(!/color: C\.(text|dim|steel)/.test(paused), "paused screen uses light text");
  assert.match(paused, /color: "#ffffff"/);
});
