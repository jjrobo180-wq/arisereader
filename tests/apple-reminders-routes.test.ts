// Run with: npx tsx --test tests/apple-reminders-routes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { appleToken, checkAppleToken, registerAppleReminderRoutes } from "../server/appleReminders";

const key = Buffer.alloc(32, 7);
function setup() {
  const routes: Record<string, Function> = {};
  const add = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h[h.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST") };
  const settings = new Map<string, string>();
  registerAppleReminderRoutes(app, ((_q: any, _s: any, n: any) => n()) as any, {
    gate: async () => ({}), getSetting: async (k) => settings.get(k) || "", upsertSetting: async (k, v) => { settings.set(k, v); },
    key: () => key, textBody: ((_q: any, _s: any, n: any) => n()) as any, appUrl: "https://www.arisereader.com/",
  });
  const call = async (k: string, req: any = {}) => {
    let code = 200; let body: any;
    const res: any = { set() { return res; }, status(c: number) { code = c; return res; }, json(d: any) { body = d; return res; } };
    await routes[k]({ body: {}, params: {}, headers: {}, user: { id: 7 }, ...req }, res);
    return { code, body };
  };
  return { call };
}
const tokenFrom = (url: string) => url.split("/").pop()!;

test("a private link carries the teacher, and a forged or old one is refused", async () => {
  const t = setup();
  const { body } = await t.call("GET /api/teacher-hub/apple-reminders");
  assert.match(body.url, /^https:\/\/www\.arisereader\.com\/api\/apple-reminders\/7\.1\./);
  assert.deepEqual(checkAppleToken(key, tokenFrom(body.url)), { userId: 7, version: 1 });
  assert.equal(checkAppleToken(key, "8.1." + tokenFrom(body.url).split(".")[2]), null);
  assert.equal((await t.call("POST /api/apple-reminders/:token", { params: { token: "7.1." + "x".repeat(32) }, body: { reminders: [{ title: "x" }] } })).code, 404);
});

test("reminders wait in an inbox until the Hub takes them in", async () => {
  const t = setup();
  const token = tokenFrom((await t.call("GET /api/teacher-hub/apple-reminders")).body.url);
  const sent = await t.call("POST /api/apple-reminders/:token", { params: { token }, body: { reminders: [{ title: "Copy packets", due: "2026-10-09", id: "r1" }, { title: "Book room" }] } });
  assert.deepEqual([sent.code, sent.body.received], [200, 2]);
  assert.equal((await t.call("POST /api/apple-reminders/:token", { params: { token }, body: "Call Ms. Lee | 2026-10-12" })).code, 200);
  const inbox = (await t.call("GET /api/teacher-hub/apple-reminders/inbox")).body.items;
  assert.deepEqual(inbox.map((r: any) => r.title), ["Copy packets", "Book room", "Call Ms. Lee"]);
  assert.equal((await t.call("POST /api/apple-reminders/:token", { params: { token }, body: {} })).code, 400);
  await t.call("POST /api/teacher-hub/apple-reminders/ack", { body: { keys: inbox.slice(0, 2).map((r: any) => r.key) } });
  assert.equal((await t.call("GET /api/teacher-hub/apple-reminders/inbox")).body.items.length, 1);
});

test("making a new link stops the old one", async () => {
  const t = setup();
  const old = tokenFrom((await t.call("GET /api/teacher-hub/apple-reminders")).body.url);
  const fresh = tokenFrom((await t.call("POST /api/teacher-hub/apple-reminders/reset")).body.url);
  assert.notEqual(old, fresh);
  assert.equal((await t.call("POST /api/apple-reminders/:token", { params: { token: old }, body: { title: "x" } })).code, 410);
  assert.equal((await t.call("POST /api/apple-reminders/:token", { params: { token: fresh }, body: { title: "x" } })).code, 200);
});
