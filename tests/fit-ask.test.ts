import test from "node:test";
import assert from "node:assert/strict";
import { registerFitRoutes, createMemoryFitStore } from "../server/fit";
import { createMemoryKv } from "../server/fitKv";
import { emptyFit } from "../shared/fit";

function setup(plus: boolean) {
  const routes: Record<string, Function[]> = {};
  const add = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h; };
  const store = createMemoryFitStore();
  let seen: { digest: string; q: string; history: any[] } | null = null;
  registerFitRoutes({ get: add("GET"), post: add("POST"), put: add("PUT") } as any, (_q: any, _s: any, n: any) => n(), {
    store, kv: createMemoryKv(), ownPlus: async () => ({ live: plus }),
    ask: async (digest, q, history) => { seen = { digest, q, history }; return "You trained 3 times this week."; },
  });
  const call = async (body: any, user = 1) => {
    let status = 200, json: any = null; const res: any = { set() { return res; }, status(c: number) { status = c; return res; }, json(v: any) { json = v; return res; } };
    for (const h of routes["POST /api/fit/ask"]) { let next = false; await h({ user: { id: user }, query: {}, body }, res, () => { next = true; }); if (!next) break; }
    return { status, json };
  };
  return { call, store, seen: () => seen };
}

test("Ask Fit answers from the saved data, not from the request, and needs Fit+", async () => {
  const s = setup(true);
  const d = emptyFit(); d.workouts = [{ id: "a", date: new Date().toISOString(), name: "Leg day", secs: 3000, exercises: [{ exId: "x", name: "Back Squat", sets: [{ reps: 5, weight: 225, done: true }] }] }];
  await s.store.set(1, d);
  const r = await s.call({ question: "How was my week?", history: [{ role: "user", text: "hi" }], digest: "FAKE" });
  assert.equal(r.status, 200);
  assert.equal(r.json.answer, "You trained 3 times this week.");
  assert.match(s.seen()!.digest, /Back Squat/);
  assert.ok(!s.seen()!.digest.includes("FAKE"));
  assert.equal(s.seen()!.history.length, 1);
  assert.equal((await s.call({ question: "" })).status, 400);
  assert.notEqual((await setup(false).call({ question: "How was my week?" })).status, 200);
});
