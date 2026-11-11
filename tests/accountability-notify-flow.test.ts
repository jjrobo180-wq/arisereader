// Accountability notifications, end to end through the real routes (server/accountability.ts) with two
// partners and an in-memory stand-in for the database: who hears what, their own settings, the test button.
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { ensureSharedSpace, registerAccountabilityRoutes } from "../server/accountability";

/** Enough of the Supabase query builder for these routes: select/eq/neq/in/gte/order/limit/maybeSingle, insert/update/upsert/delete. */
function fakeDb() {
  const tables: Record<string, any[]> = {};
  const keyOf: Record<string, string[]> = { acct_members: ["space_id", "user_id"], acct_nudges: ["task_id", "day"], acct_alerts: ["task_id", "day", "kind"] };
  const from = (name: string) => {
    tables[name] ??= [];
    const filters: ((r: any) => boolean)[] = [];
    let op: "select" | "update" | "delete" = "select", patch: any = null, single = false, head = false;
    const rows = () => tables[name].filter((r) => filters.every((f) => f(r)));
    const chain: any = {
      select: (_c?: string, o?: any) => { if (o?.head) head = true; return chain; },
      eq: (k: string, v: any) => { filters.push((r) => r[k] === v); return chain; },
      neq: (k: string, v: any) => { filters.push((r) => r[k] !== v); return chain; },
      in: (k: string, v: any[]) => { filters.push((r) => v.includes(r[k])); return chain; },
      gte: (k: string, v: any) => { filters.push((r) => String(r[k]) >= String(v)); return chain; },
      order: () => chain, limit: () => chain,
      maybeSingle: () => { single = true; return chain; },
      update: (p: any) => { op = "update"; patch = p; return chain; },
      delete: () => { op = "delete"; return chain; },
      insert: async (r: any) => { tables[name].push(...(Array.isArray(r) ? r : [r]).map((x) => ({ notify: name === "acct_members" ? {} : undefined, created_at: new Date().toISOString(), ...x }))); return { error: null }; },
      upsert: async (r: any) => { const k = keyOf[name] || ["id"]; tables[name] = tables[name].filter((x) => !k.every((c) => x[c] === r[c])).concat(r); return { error: null }; },
      then: (resolve: any) => {
        const hit = rows();
        if (op === "update") hit.forEach((r) => Object.assign(r, patch));
        if (op === "delete") tables[name] = tables[name].filter((r) => !hit.includes(r));
        resolve(head ? { count: hit.length, error: null } : { data: single ? hit[0] ?? null : hit, error: null });
      },
    };
    return chain;
  };
  return { tables, db: { from, storage: { from: () => ({}), createBucket: async () => ({}) } } };
}

async function setup() {
  const { db, tables } = fakeDb();
  const pushes: { to: number; title: string; body: string; tag?: string }[] = [];
  const app = express(); app.use(express.json());
  const auth = (req: any, _res: any, next: any) => { req.user = { id: Number(req.headers["x-user"]) }; next(); };
  registerAccountabilityRoutes(app, auth as any, {
    db: () => db as any,
    push: async (to, m) => { pushes.push({ to, ...m }); return to === 1 ? 1 : 2; },
    nameOf: async (id) => (id === 1 ? "Jake" : "Sam"),
    devices: async (id) => (id === 1 ? { apple: 1, web: 0 } : { apple: 1, web: 1 }),
  });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/accountability`;
  const call = async (user: number, method: string, path: string, body?: unknown) => {
    const r = await fetch(base + path, { method, headers: { "x-user": String(user), "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  const settle = () => new Promise((r) => setTimeout(r, 20));
  return { call, pushes, tables, settle, close: () => server.close() };
}

test("two partners: each hears what the other does, and nobody hears their own actions", async () => {
  const { call, pushes, settle, close } = await setup();
  try {
    const space = (await call(1, "POST", "/spaces", { name: "Us", myName: "Jake", tz: "America/Denver" })).body;
    const code = space.code;
    assert.equal((await call(2, "POST", "/join", { code, myName: "Sam", tz: "America/Denver" })).status, 200);
    await settle();
    assert.deepEqual(pushes.map((p) => [p.to, p.title]), [[1, "Sam joined Us"]]);

    pushes.length = 0;
    const task = { title: "Fold laundry", assignee: 2, repeat: { every: "daily" }, due: "18:00", nag: 60, proof: "none", review: true };
    const made = (await call(1, "POST", "/tasks", { spaceId: space.id, task })).body;
    await settle();
    assert.deepEqual(pushes.map((p) => [p.to, p.title]), [[2, "Jake asked: Fold laundry"]]);

    pushes.length = 0;
    await call(1, "PUT", `/tasks/${made.id}`, { task: { ...task, title: "Fold and put away laundry" } });
    await settle();
    assert.equal(pushes.length, 1); assert.equal(pushes[0].to, 2); assert.match(pushes[0].title, /Jake changed: Fold and put away laundry/);

    pushes.length = 0;
    await call(1, "POST", `/tasks/${made.id}/poke`, {});
    assert.equal(pushes[0].to, 2); assert.match(pushes[0].title, /👋 Jake/);

    pushes.length = 0;
    const done = (await call(2, "POST", "/checkins", { taskId: made.id, day: "2026-11-07", note: "" })).body;
    await settle();
    assert.equal(done.status, "done");
    assert.deepEqual(pushes.map((p) => [p.to, p.title]), [[1, "✓ Sam did it: Fold and put away laundry"]]);

    pushes.length = 0;
    await call(1, "POST", `/checkins/${done.id}/review`, { status: "approved", feedback: "Thanks!" });
    await settle();
    assert.deepEqual(pushes.map((p) => [p.to, p.title, p.body]), [[2, "⭐ Jake approved: Fold and put away laundry", "Thanks!"]]);

    pushes.length = 0;
    await call(2, "DELETE", `/tasks/${made.id}`);
    await settle();
    assert.equal(pushes[0].to, 1); assert.match(pushes[0].title, /Sam removed/);

    pushes.length = 0;
    await call(2, "POST", `/spaces/${space.id}/leave`);
    await settle();
    assert.deepEqual(pushes.map((p) => [p.to, p.title]), [[1, "Sam left the space"]]);
  } finally { close(); }
});

test("each partner's own settings decide what reaches them", async () => {
  const { call, pushes, settle, close } = await setup();
  try {
    const space = (await call(1, "POST", "/spaces", { name: "Us", myName: "Jake" })).body;
    await call(2, "POST", "/join", { code: space.code, myName: "Sam" });
    const saved = (await call(2, "PUT", `/spaces/${space.id}/notify`, { notify: { asked: false, pokes: false } })).body;
    assert.equal(saved.notify.asked, false); assert.equal(saved.notify.done, true);
    const mine = (await call(2, "GET", "")).body;
    assert.equal(mine.myNotify[space.id].asked, false);
    assert.equal(mine.spaces[0].members.some((m: any) => "notify" in m), false, "settings aren't shown to the others");

    pushes.length = 0;
    const made = (await call(1, "POST", "/tasks", { spaceId: space.id, task: { title: "Dishes", assignee: 2, due: "18:00" } })).body;
    const poke = (await call(1, "POST", `/tasks/${made.id}/poke`, {})).body;
    await settle();
    assert.equal(pushes.length, 0); assert.equal(poke.off, true);

    const status = (await call(1, "GET", `/spaces/${space.id}/notify-status`)).body.people;
    const sam = status.find((p: any) => p.userId === 2);
    assert.deepEqual([sam.apple, sam.web, sam.off.sort()], [1, 1, ["asked", "pokes"]]);
  } finally { close(); }
});

test("the test button reaches everyone in the space and says how many devices each", async () => {
  const { call, pushes, close } = await setup();
  try {
    const space = (await call(1, "POST", "/spaces", { name: "Us", myName: "Jake" })).body;
    await call(2, "POST", "/join", { code: space.code, myName: "Sam" });
    pushes.length = 0;
    const r = (await call(1, "POST", `/spaces/${space.id}/test`, {})).body;
    assert.deepEqual(r.results.map((x: any) => [x.userId, x.delivered]), [[1, 1], [2, 2]]);
    assert.deepEqual(pushes.map((p) => p.title), ["🔔 Accountability test", "🔔 Test from Jake"]);
    assert.equal((await call(3, "POST", `/spaces/${space.id}/test`, {})).status, 404, "only people in the space");
  } finally { close(); }
});

test("linking with Accountability on: one shared space, reusing yours when it's just you, never a second one", async () => {
  const { db, tables } = fakeDb();
  const pushes: any[] = [];
  const deps = { db: () => db as any, push: async (to: number, m: any) => { pushes.push({ to, ...m }); return 1; }, nameOf: async (id: number) => (id === 1 ? "Jake" : id === 2 ? "Sam" : "Ana") };
  // Jake has a space with only himself in it: Sam is added to it.
  tables.acct_spaces = [{ id: "solo", name: "My to-dos", code: "ABC123", created_by: 1 }];
  tables.acct_members = [{ space_id: "solo", user_id: 1, name: "Jake", role: "owner", tz: "" }];
  const a = await ensureSharedSpace(deps, 1, 2);
  assert.deepEqual(a, { spaceId: "solo", changed: true });
  assert.deepEqual(tables.acct_members.filter((m) => m.space_id === "solo").map((m) => m.user_id).sort(), [1, 2]);
  assert.ok(pushes.some((p) => p.to === 2 && /Jake shared Accountability with you/.test(p.title)));
  // Again (they already share one, like a couple who joined with a code): nothing changes.
  pushes.length = 0;
  assert.deepEqual(await ensureSharedSpace(deps, 1, 2), { spaceId: "solo", changed: false });
  assert.deepEqual(await ensureSharedSpace(deps, 2, 1), { spaceId: "solo", changed: false }, "either way round");
  assert.equal(pushes.length, 0);
  // Jake and Ana: Jake's only space is shared now, so a new one for the two of them is made.
  const b = await ensureSharedSpace(deps, 1, 3);
  assert.equal(b.changed, true); assert.notEqual(b.spaceId, "solo");
  assert.equal(tables.acct_spaces.find((s) => s.id === b.spaceId)?.name, "Jake & Ana");
  assert.deepEqual(tables.acct_members.filter((m) => m.space_id === b.spaceId).map((m) => [m.user_id, m.role]).sort(), [[1, "owner"], [3, "member"]]);
});
