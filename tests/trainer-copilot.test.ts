// Coach Copilot and plan tools (November 2026). Run with: npx tsx --test tests/trainer-copilot.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMemoryCoachStore, registerCoachRoutes } from "../server/coach";
import { createMemoryKv } from "../server/fitKv";
import { emptyFit, type FitData, type Workout } from "../shared/fit";
import { emptyClientSide, emptyCoaching, type Assigned, type Coaching } from "../shared/coach";
import { clientFacts, draftFor, flags, newPRs, progress, reflow } from "../shared/coachCopilot";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const NOW = new Date("2026-11-12T15:00:00"); // a Thursday
const d = (n: number) => { const x = new Date(NOW); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const item = (exId: string, name: string, sets = 3, reps = "8-10") => ({ exId, name, sets, reps, rest: 90 });
const asg = (id: string, date: string, items = [item("bench-press", "Bench press")], done?: string): Assigned => ({ id, name: `Workout ${id}`, items, date, ...(done ? { done } : {}) });
const lift = (date: string, exId: string, name: string, kg: number, reps: number[], extra: Partial<Workout> = {}): Workout => ({ id: `w-${date}-${exId}`, date, name: "Session", secs: 3000, exercises: [{ exId, name, sets: reps.map((r) => ({ reps: r, weight: kg, done: true })) }], ...extra });

test("facts and flags: who needs the coach, who's slipping, who gets a shout-out", () => {
  const c: Coaching = { ...emptyCoaching(), assigned: [asg("a", d(-5)), asg("b", d(-3)), asg("c", d(-1)), asg("n", d(2))], habits: [{ id: "h", name: "Walk", days: [] }] };
  const fit: FitData = { ...emptyFit(), workouts: [lift(d(-12), "bench-press", "Bench press", 60, [8, 8, 8])] };
  const f = clientFacts({ name: "Vanessa Cruz", coaching: c, side: emptyClientSide(), fit, unread: 1 }, NOW);
  assert.equal(f.missed, 3); assert.equal(f.daysSinceWorkout, 12); assert.equal(f.habitsDue, 7); assert.equal(f.upcoming, 1);
  const fl = flags(f);
  assert.deepEqual(fl.slice(0, 2).map((x) => x.kind), ["unread", "quiet"]);
  assert.ok(fl.some((x) => x.kind === "missed")); assert.ok(fl.some((x) => x.kind === "habits"));
  assert.match(draftFor(f, fl), /^Hey Vanessa, sorry for the wait/);
  // A perfect week with a new best.
  const done: Coaching = { ...emptyCoaching(), assigned: [asg("a", d(-4), undefined, d(-4)), asg("b", d(-2), undefined, d(-2)), asg("n", d(3))] };
  const fit2: FitData = { ...emptyFit(), workouts: [lift(d(-20), "squat", "Back squat", 100, [5, 5, 5]), lift(d(-2), "squat", "Back squat", 105, [5, 5, 5])] };
  const g = clientFacts({ name: "Sam", coaching: done, side: emptyClientSide(), fit: fit2, unread: 0 }, NOW);
  assert.deepEqual(newPRs(fit2.workouts, NOW), ["Back squat"]);
  const gl = flags(g);
  assert.deepEqual(gl.map((x) => x.level), ["win", "win"]);
  assert.match(draftFor(g, gl), /every workout this week/);
});

test("reflow moves missed workouts to the next free days, one a day, in order", () => {
  const c: Coaching = { ...emptyCoaching(), assigned: [asg("a", d(-6)), asg("b", d(-4), undefined, d(-4)), asg("c", d(-2)), asg("t", d(0)), asg("x", d(2)), asg("old", d(-20))] };
  const r = reflow(c, [], NOW);
  assert.deepEqual(r.moves.map((m) => [m.id, m.to]), [["a", d(1)], ["c", d(3)]], "today and day+2 are taken");
  assert.equal(r.assigned.find((a) => a.id === "old")!.date, d(-20), "older than a week stays put");
  assert.equal(r.assigned.find((a) => a.id === "b")!.date, d(-4), "done workouts stay");
  // Only on the client's training days (Mon/Wed/Fri).
  const r2 = reflow(c, [], NOW, { days: [1, 3, 5] });
  for (const m of r2.moves) assert.ok([1, 3, 5].includes(new Date(`${m.to}T12:00:00`).getDay()));
  // A workout logged in Arise Fit for that plan day counts as done.
  const logged = reflow(c, [{ ...lift(d(-6), "bench-press", "Bench press", 60, [8]), programId: "coach", dayId: "a" }], NOW);
  assert.deepEqual(logged.moves.map((m) => m.id), ["c"]);
});

test("progress sets next targets from what they actually lifted", () => {
  const c: Coaching = { ...emptyCoaching(), assigned: [asg("n1", d(1), [item("bench-press", "Bench press", 3, "8-10"), item("row", "Row", 3, "8-10"), item("ohp", "Overhead press", 3, "6-8"), item("new", "New move")])] };
  const workouts = [lift(d(-3), "bench-press", "Bench press", 61.235, [10, 10, 10]), lift(d(-3), "row", "Row", 50, [9, 8, 8]), lift(d(-3), "ohp", "Overhead press", 40, [6, 5, 6])];
  const r = progress(c, workouts, "lb", NOW);
  const notes = Object.fromEntries(r.assigned[0].items.map((i) => [i.exId, i.note ?? ""]));
  assert.match(notes["bench-press"], /^Target 140 lb \(last time 135 lb × 10, 10, 10\)/, "top of range hit: add weight");
  assert.match(notes["row"], /^Target 110 lb, one more rep/);
  assert.match(notes["ohp"], /^Target 90 lb again/, "missed the bottom: repeat");
  assert.equal(notes["new"], "", "never done: left alone");
  assert.equal(r.bumps.length, 3);
  // Running it again changes nothing.
  assert.equal(progress({ ...c, assigned: r.assigned }, workouts, "lb", NOW).bumps.length, 0);
  // kg users get kg steps.
  assert.match(progress(c, workouts, "kg", NOW).assigned[0].items[0].note!, /^Target 62\.5 kg/);
});

test("the copilot route ranks clients, respects what they share, and plan tools preview then apply", async () => {
  const store = createMemoryCoachStore(); const sent: any[] = [];
  const routes = new Map<string, any[]>();
  const add = (m: string) => (path: string, ...h: any[]) => routes.set(`${m} ${path}`, h);
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT") };
  const call = async (m: string, path: string, user: number, body: any = {}) => {
    const [p, qs] = path.split("?");
    for (const [k, h] of routes) { const [km, kp] = k.split(" "); if (km !== m) continue; const names: string[] = []; const hit = p.match(new RegExp("^" + kp.replace(/:([a-z]+)/g, (_s, n) => { names.push(n); return "([^/?]+)"; }) + "$")); if (!hit) continue;
      const req: any = { params: Object.fromEntries(names.map((n, i) => [n, hit[i + 1]])), body, query: Object.fromEntries(new URLSearchParams(qs ?? "")), user: { id: user }, headers: {} };
      let status = 200, out: any; const res: any = { headersSent: false, status(s: number) { status = s; return res; }, json(b: any) { out = b; res.headersSent = true; return res; } };
      for (const fn of h) { let next = false; await fn(req, res, () => { next = true; }); if (!next) break; } return { status, body: out }; }
    throw new Error(`no route ${m} ${path}`);
  };
  const fits: Record<number, FitData> = { 101: { ...emptyFit(), workouts: [lift(d(-15), "bench-press", "Bench press", 60, [10, 10, 10])] }, 102: { ...emptyFit(), workouts: [lift(d(-1), "bench-press", "Bench press", 60, [10, 10, 10])] } };
  let aiPrompt = "";
  registerCoachRoutes(app, (_q: any, _r: any, next: any) => next(), { store, kv: createMemoryKv(), now: () => NOW.getTime(), fitData: async (id) => fits[id] ?? emptyFit(), nameOf: async (id) => ({ 101: "Vanessa", 102: "Jermaine" } as any)[id] ?? "X", notify: async (u, m) => { sent.push([u, m.title]); }, inviteSecret: "t",
    ai: async (s, u) => { aiPrompt = s + u; const ids = JSON.parse(u).map((x: any) => x.linkId); return JSON.stringify({ clients: ids.map((id: string) => ({ linkId: id, summary: "Quiet for two weeks.", draft: "Hey, miss you in the gym! What's getting in the way?" })) }); } });
  await call("PUT", "/api/coach/trainer/profile", 7, { profile: { name: "Coach Mike" } });
  const inv = (await call("GET", "/api/coach/trainer/invite", 7)).body;
  await call("POST", `/api/coach/invite/${inv.code}/join`, 101, { consent: { workouts: true } });
  await call("POST", `/api/coach/invite/${inv.code}/join`, 102, { consent: {} }); // shares nothing
  const home = (await call("GET", "/api/coach/trainer", 7)).body;
  const lv = home.clients.find((c: any) => c.clientId === 101).id, lj = home.clients.find((c: any) => c.clientId === 102).id;
  const plan = { ...emptyCoaching(), assigned: [asg("a", d(-5)), asg("b", d(-2)), asg("n", d(3))] };
  await call("PUT", `/api/coach/links/${lv}/coaching`, 7, { coaching: plan, notify: false });
  await call("PUT", `/api/coach/links/${lj}/coaching`, 7, { coaching: plan, notify: false });

  const cp = (await call("GET", "/api/coach/trainer/copilot", 7)).body;
  assert.equal(cp.items[0].name, "Vanessa", "the quiet client comes first");
  assert.ok(cp.items[0].flags.some((f: any) => f.kind === "quiet"));
  const j = cp.items.find((x: any) => x.name === "Jermaine");
  assert.equal(j.facts.daysSinceWorkout, null, "workouts not shared, so not read");
  assert.equal(cp.ai, false);
  const withAi = (await call("GET", "/api/coach/trainer/copilot?ai=1", 7)).body;
  assert.equal(withAi.ai, true); assert.equal(withAi.items[0].summary, "Quiet for two weeks.");
  assert.doesNotMatch(aiPrompt, /101|102/, "no user ids sent to the AI");
  assert.equal((await call("GET", "/api/coach/trainer/copilot", 101)).body.items.length, 0, "a client sees no one");

  // Plan tools: preview changes nothing, apply saves and tells the client.
  const pv = (await call("POST", `/api/coach/links/${lv}/reflow`, 7, {})).body;
  assert.equal(pv.changes.length, 2); assert.equal(pv.applied, false);
  assert.equal((await call("POST", `/api/coach/links/${lv}/reflow`, 101, { apply: true })).status, 404, "clients can't run it");
  const ap = (await call("POST", `/api/coach/links/${lv}/reflow`, 7, { apply: true })).body;
  assert.equal(ap.applied, true); assert.deepEqual(sent.at(-1), [101, "Your plan was updated"]);
  assert.equal((await call("POST", `/api/coach/links/${lv}/reflow`, 7, {})).body.changes.length, 0, "nothing left to move");
  const pr = (await call("POST", `/api/coach/links/${lv}/progress`, 7, { apply: true })).body;
  assert.ok(pr.changes.length >= 1); assert.match(pr.assigned.find((a: any) => a.date >= d(0)).items[0].note, /^Target/);
  assert.equal((await call("POST", `/api/coach/links/${lj}/progress`, 7, {})).body.changes.length, 0, "no shared workouts, no targets");
});

test("Copilot and plan tools are in Arise Trainer", () => {
  const ui = read("client/src/pages/trainer/TrainerCopilot.tsx");
  for (const t of ["tr-copilot", "tr-cp-send", "tr-reflow", "tr-progress"]) assert.ok(ui.includes(t), t);
  assert.match(read("client/src/pages/trainer/TrainerApp.tsx"), /<CopilotCard /);
  assert.match(read("client/src/pages/trainer/TrainerClient.tsx"), /<PlanTools /);
});
