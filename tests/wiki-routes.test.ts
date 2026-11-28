import test from "node:test";
import assert from "node:assert/strict";
import { registerWikiRoutes } from "../server/wikiFeed";
import { learn, newProfile } from "../shared/wikiFeed";

function fakeApp() {
  const routes = new Map<string, any[]>();
  const add = (method: string) => (path: any, ...handlers: any[]) => { routes.set(`${method} ${path}`, handlers); };
  const app: any = new Proxy({}, { get: (_t, prop: string) => (["get", "post", "put", "delete"].includes(prop) ? add(prop.toUpperCase()) : () => app) });
  const run = async (method: string, path: string, o: { params?: any; query?: any; body?: any; user: any }) => {
    const res: any = { code: 200, body: null, set: () => res, status: (c: number) => { res.code = c; return res; }, json: (b: any) => { res.body = b; return res; } };
    const req: any = { params: o.params ?? {}, query: o.query ?? {}, body: o.body, user: o.user };
    for (const h of routes.get(`${method} ${path}`)!) { let next = false; await h(req, res, () => { next = true; }); if (!next) break; }
    return res;
  };
  return { app, run };
}

test("Arise Wiki keeps taste and saves on the account, counts likes, and takes comments (not from students)", async () => {
  const settings = new Map<string, string>();
  const { app, run } = fakeApp();
  registerWikiRoutes(app, ((_q: any, _s: any, n: any) => n()) as any, { getSetting: async (k) => settings.get(k) ?? null, upsertSetting: async (k, v) => { settings.set(k, v); } });
  const mom = { id: 7, role: "parent", displayName: "Jordan Banks" }, kid = { id: 8, role: "student", displayName: "Ava Banks" };

  // Phone and laptop each learned something: the account keeps both.
  const phone = learn(newProfile(["space"], 100), { title: "Black hole", lane: "topic", from: "space" }, "like", 200);
  await run("PUT", "/api/wiki/profile", { body: { profile: phone }, user: mom });
  const laptop = { ...newProfile(["music"], 300), seen: ["Jazz"], updatedAt: 300 };
  const r = await run("PUT", "/api/wiki/profile", { body: { profile: laptop }, user: mom });
  assert.deepEqual([...r.body.profile.seen].sort(), ["Jazz"]);
  assert.equal((await run("GET", "/api/wiki/profile", { user: mom })).body.profile.updatedAt, 300);
  assert.equal((await run("GET", "/api/wiki/profile", { user: kid })).body.profile, null, "each person has their own");

  await run("POST", "/api/wiki/react", { body: { title: "Octopus", kind: "like" }, user: mom });
  await run("POST", "/api/wiki/react", { body: { title: "Octopus", kind: "share" }, user: kid });
  let s = await run("GET", "/api/wiki/stats", { query: { titles: "Octopus|Squid" }, user: kid });
  assert.deepEqual(s.body.stats.Octopus, { likes: 1, comments: 0, shares: 1 });
  assert.deepEqual(s.body.stats.Squid, { likes: 0, comments: 0, shares: 0 });

  assert.equal((await run("POST", "/api/wiki/comments", { body: { title: "Octopus", text: "Three hearts!" }, user: kid })).code, 403);
  assert.equal((await run("POST", "/api/wiki/comments", { body: { title: "Octopus", text: "see www.spam.com" }, user: mom })).code, 400);
  const c = await run("POST", "/api/wiki/comments", { body: { title: "Octopus", text: "Three hearts and blue blood!" }, user: mom });
  assert.equal(c.code, 200);
  assert.equal(c.body.comment.author, "Jordan B.");
  const seen = await run("GET", "/api/wiki/comments", { query: { title: "Octopus" }, user: kid });
  assert.equal(seen.body.canPost, false);
  assert.equal(seen.body.comments[0].text, "Three hearts and blue blood!");
  assert.equal(seen.body.comments[0].mine, false);
  s = await run("GET", "/api/wiki/stats", { query: { titles: "Octopus" }, user: kid });
  assert.equal(s.body.stats.Octopus.comments, 1);
  assert.equal((await run("DELETE", "/api/wiki/comments/:id", { params: { id: c.body.comment.id }, query: { title: "Octopus" }, user: kid })).code, 404, "not yours to delete");
  assert.equal((await run("DELETE", "/api/wiki/comments/:id", { params: { id: c.body.comment.id }, query: { title: "Octopus" }, user: mom })).code, 200);
  assert.equal((await run("GET", "/api/wiki/comments", { query: { title: "Octopus" }, user: kid })).body.comments.length, 0);
});
