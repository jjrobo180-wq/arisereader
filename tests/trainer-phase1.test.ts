// Arise Trainer, phase 1 (November 2026): invite clients by link (no listing, no client limit), ready-made templates,
// and the AI builder that may only use Cooked's exercise catalog.
// Run with: npx tsx --test tests/trainer-phase1.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMemoryCoachStore, registerCoachRoutes } from "../server/coach";
import { emptyFit, CATALOG } from "../shared/fit";
import { cleanLibrary, cleanPlanWorkout, expandProgram } from "../shared/coach";
import { TEMPLATE_PROGRAMS, TEMPLATE_WORKOUTS } from "../shared/coachTemplates";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
function fakeApp() {
  const routes = new Map<string, any[]>();
  const add = (m: string) => (path: string, ...h: any[]) => routes.set(`${m} ${path}`, h);
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT") };
  const call = async (m: string, path: string, user: number | null, body: any = {}) => {
    for (const [k, h] of routes) {
      const [km, kp] = k.split(" "); if (km !== m) continue;
      const names: string[] = []; const re = new RegExp("^" + kp.replace(/:([a-z]+)/g, (_s, n) => { names.push(n); return "([^/?]+)"; }) + "(?:\\?.*)?$");
      const hit = path.match(re); if (!hit) continue;
      const req: any = { params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(hit[i + 1])])), body, query: {}, user: user ? { id: user } : null, headers: {} };
      let status = 200, out: any;
      const res: any = { headersSent: false, status(s: number) { status = s; return res; }, json(b: any) { out = b; res.headersSent = true; return res; } };
      for (const fn of h) { let next = false; await fn(req, res, () => { next = true; }); if (!next) break; }
      return { status, body: out };
    }
    throw new Error(`no route ${m} ${path}`);
  };
  return { app, call };
}
const setup = (ai?: (s: string, u: string) => Promise<string>) => {
  const store = createMemoryCoachStore(); const sent: any[] = []; const { app, call } = fakeApp();
  registerCoachRoutes(app, (_q: any, _r: any, next: any) => next(), { store, fitData: async () => emptyFit(), nameOf: async (id) => (id === 7 ? "Coach Mike" : `Client ${id}`), notify: async (u, m) => { sent.push([u, m.title]); }, inviteSecret: "test", ai });
  return { store, sent, call };
};

test("a trainer invites clients by link: no listing needed, connected at once, no client limit", async () => {
  const { call, sent } = setup();
  const inv = (await call("GET", "/api/coach/trainer/invite", 7)).body;
  assert.match(inv.url, /#\/fit\?coach=/);
  assert.equal((await call("GET", `/api/coach/invite/${inv.code}`, null)).body.trainer.name, "Coach Mike");
  // A changed or made-up code is refused (it can't be pointed at another trainer).
  assert.equal((await call("GET", `/api/coach/invite/8-${inv.code.split("-")[1]}`, null)).status, 404);
  assert.equal((await call("POST", `/api/coach/invite/${inv.code}/join`, 7)).status, 400);
  for (let c = 100; c < 160; c++) assert.equal((await call("POST", `/api/coach/invite/${inv.code}/join`, c, { consent: { workouts: true, food: true } })).body.status, "active");
  const home = (await call("GET", "/api/coach/trainer", 7)).body;
  assert.equal(home.clients.filter((c: any) => c.status === "active").length, 60);
  assert.equal(home.listed, false, "no listing was needed");
  assert.deepEqual(sent.at(-1), [7, "New client"]);
  // Joining twice is the same connection.
  const again = await call("POST", `/api/coach/invite/${inv.code}/join`, 100);
  assert.equal(again.body.status, "active");
  assert.equal((await call("GET", "/api/coach/trainer", 7)).body.clients.length, 60);
});

test("the AI builder only keeps catalog exercises, and refuses an empty draft", async () => {
  const drafts = [
    JSON.stringify({ name: "Push power", note: "Go heavy.", mins: 45, items: [{ exId: "bench-press", sets: 4, reps: "5", rest: 150 }, { exId: "made-up-move", sets: 3, reps: "10", rest: 60 }, { exId: "ohp", sets: 3, reps: "8", rest: 90, note: "Brace" }] }),
    JSON.stringify({ items: [] }),
    JSON.stringify({ name: "Strength base", note: "Add weight weekly.", workouts: [{ name: "A", items: [{ exId: "back-squat", sets: 3, reps: "5", rest: 180 }, { exId: "bench-press", sets: 3, reps: "5", rest: 150 }] }, { name: "B", items: [{ exId: "deadlift", sets: 1, reps: "5", rest: 180 }, { exId: "pull-up", sets: 3, reps: "8", rest: 120 }] }], week: [{ weekday: 1, workout: 0 }, { weekday: 3, workout: 1 }, { weekday: 5, workout: 0 }] }),
  ];
  const prompts: string[] = [];
  const { call } = setup(async (s, u) => { prompts.push(s + u); return drafts.shift()!; });
  const w = (await call("POST", "/api/coach/trainer/ai/workout", 7, { goal: "strength", equip: "gym", minutes: 45 })).body.workout;
  assert.deepEqual(w.items.map((i: any) => i.exId), ["bench-press", "ohp"]);
  assert.equal(w.items[0].name, CATALOG.find((e) => e.id === "bench-press")!.name);
  assert.ok(cleanPlanWorkout(w));
  assert.equal((await call("POST", "/api/coach/trainer/ai/workout", 7, { goal: "x" })).status, 502);
  const p = (await call("POST", "/api/coach/trainer/ai/program", 7, { goal: "strength", perWeek: 3, weeks: 4 })).body;
  assert.equal(p.program.weeks, 4);
  assert.equal(p.program.days.length, 12);
  const lib = cleanLibrary({ workouts: p.workouts, programs: [p.program] });
  assert.equal(expandProgram(lib.programs[0], lib, "2026-11-09").length, 12);
  // Home workouts only offer home equipment to the AI.
  await call("POST", "/api/coach/trainer/ai/workout", 7, { equip: "home" }).catch(() => null);
  assert.doesNotMatch(prompts.at(-1)!, /bench-press:/);
});

test("templates: every workout and program survives the library's cleaning and lands on a calendar", () => {
  assert.ok(TEMPLATE_WORKOUTS.length >= 20 && TEMPLATE_PROGRAMS.length >= 7);
  for (const w of TEMPLATE_WORKOUTS) { const c = cleanPlanWorkout(w)!; assert.equal(c.items.length, w.items.length, w.id); for (const i of c.items) assert.ok(Number.isFinite(i.rest) && i.sets > 0, `${w.id} ${i.exId}`); }
  for (const p of TEMPLATE_PROGRAMS) {
    const lib = cleanLibrary({ workouts: p.workouts, programs: [p.program] });
    assert.equal(expandProgram(lib.programs[0], lib, "2026-11-09").length, p.perWeek * p.program.weeks, p.program.id);
  }
});

test("the trainer app offers invites, templates and the AI builder", () => {
  const app = read("client/src/pages/trainer/TrainerApp.tsx");
  assert.match(app, /testId="tr-invite"/);
  assert.match(app, /No client limit/);
  assert.match(read("client/src/pages/trainer/TrainerTemplates.tsx"), /TEMPLATE_PROGRAMS/);
  assert.match(read("client/src/pages/trainer/TrainerTemplates.tsx"), /\/trainer\/ai\/program/);
});
