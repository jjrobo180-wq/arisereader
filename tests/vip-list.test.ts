// The admin's VIP list: people who get To-Do Unlimited with no payment.
// Run with: npx tsx --test tests/vip-list.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { registerPlanRoutes } from "../server/plans";
import { cleanVipList, onVipList, todoUnlimitedFor } from "../shared/plans";

const USERS: Record<number, any> = {
  1: { id: 1, role: "student", isAdmin: true, username: "boss" },
  10: { id: 10, role: "todo", username: "mia", email: "Mia@Example.com", accountApproved: true },
  11: { id: 11, role: "todo", username: "unconfirmed", email: "mia@example.com", accountApproved: false },
  12: { id: 12, role: "parent", username: "pat", email: "mia@example.com" },
  13: { id: 13, role: "parent", username: "dana", email: "dana@example.com" },
  14: { id: 14, role: "teacher", username: "ms.t", email: "t@school.org", accountApproved: true },
  15: { id: 15, role: "todo", username: "other", email: "other@example.com", accountApproved: true },
};

function setup() {
  const settings = new Map<string, string>();
  const routes: Record<string, Function[]> = {};
  const app: any = {
    get: (p: string, ...h: Function[]) => { routes["GET " + p] = h; },
    post: (p: string, ...h: Function[]) => { routes["POST " + p] = h; },
    use: () => {},
  };
  const auth = (req: any, _res: any, next: any) => { req.user = USERS[Number(req.headers.authorization)]; return next(); };
  const admin = (req: any, res: any, next: any) => (req.user?.isAdmin ? next() : res.status(403).json({ message: "no" }));
  const plans = registerPlanRoutes(app, auth as any, admin as any, {
    getSetting: async (k) => settings.get(k) ?? "",
    upsertSetting: async (k, v) => { settings.set(k, v); },
    userForToken: async (t) => USERS[Number(t)] ?? null,
    getUser: async (id) => USERS[id] ?? null,
    findUserByUsername: async (u) => Object.values(USERS).find((x) => x.username === u) ?? null,
    countTeacherStudents: async () => 0, countSchoolStudents: async () => 0, schoolName: async () => "",
  });
  const call = async (method: string, path: string, who: number, body: any = {}) => {
    const req: any = { headers: { authorization: String(who) }, body, originalUrl: path };
    const out: any = { status: 200, body: null };
    const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; }, set() { return res; } };
    const chain = routes[`${method} ${path}`];
    assert.ok(chain, "no route " + method + " " + path);
    let i = 0;
    const next = async () => { const h = chain[i++]; if (h) await h(req, res, next); };
    await next();
    return out;
  };
  const unlimited = async (id: number) => (await plans.todoUnlimited(USERS[id])).unlimited;
  return { plans, call, unlimited, settings };
}

test("an email on the list gives Unlimited the moment a confirmed account has that email", async () => {
  const s = setup();
  assert.equal(await s.unlimited(10), false);
  const add = await s.call("POST", "/api/admin/plans/vip", 1, { who: "  MIA@example.com ", label: "Mia" });
  assert.equal(add.status, 200);
  assert.equal(await s.unlimited(10), true); // case does not matter
  const plan = await s.plans.todoUnlimited(USERS[10]);
  assert.equal(plan.via, "vip");
  assert.equal(plan.endsAt, null);
  assert.equal(await s.unlimited(15), false); // someone else is untouched
});

test("an email alone never helps an unconfirmed account or a parent account", async () => {
  const s = setup();
  await s.call("POST", "/api/admin/plans/vip", 1, { who: "mia@example.com" });
  assert.equal(await s.unlimited(11), false); // not switched on yet
  assert.equal(await s.unlimited(12), false); // a parent's email is never checked
});

test("a username puts an existing account on the list, whatever kind it is", async () => {
  const s = setup();
  assert.equal(await s.unlimited(13), false);
  const add = await s.call("POST", "/api/admin/plans/vip", 1, { who: "@Dana" });
  assert.equal(add.status, 200);
  assert.equal(await s.unlimited(13), true);
  assert.equal(add.body.vip[0].account.username, "dana");
  const unknown = await s.call("POST", "/api/admin/plans/vip", 1, { who: "nobody" });
  assert.equal(unknown.status, 400);
});

test("a teacher account with a confirmed school email can be added by email", async () => {
  const s = setup();
  await s.call("POST", "/api/admin/plans/vip", 1, { who: "t@school.org" });
  assert.equal(await s.unlimited(14), true);
});

test("taking someone off turns it off again, and doubles are refused", async () => {
  const s = setup();
  await s.call("POST", "/api/admin/plans/vip", 1, { who: "mia@example.com" });
  assert.equal((await s.call("POST", "/api/admin/plans/vip", 1, { who: "MIA@example.com" })).status, 409);
  assert.equal((await s.call("GET", "/api/admin/plans/vip", 1)).body.vip.length, 1);
  assert.equal((await s.call("POST", "/api/admin/plans/vip/remove", 1, { email: "mia@example.com" })).status, 200);
  s.settings.set("todo_vip", s.settings.get("todo_vip")!); // the saved list is what counts
  assert.equal(await s.unlimited(10), false);
  assert.equal((await s.call("POST", "/api/admin/plans/vip/remove", 1, { email: "mia@example.com" })).status, 404);
});

test("only the admin can change the list, and bad input is refused", async () => {
  const s = setup();
  assert.equal((await s.call("POST", "/api/admin/plans/vip", 10, { who: "mia@example.com" })).status, 403);
  assert.equal((await s.call("POST", "/api/admin/plans/vip", 1, { who: "" })).status, 400);
  assert.equal((await s.call("POST", "/api/admin/plans/vip", 1, { who: "not an@email" })).status, 400);
  assert.equal(await s.unlimited(10), false);
});

test("a damaged saved list is harmless", async () => {
  const s = setup();
  s.settings.set("todo_vip", "{{not json");
  assert.equal(await s.unlimited(10), false);
  assert.deepEqual(cleanVipList([null, 5, {}, { email: "bad" }, { email: "A@b.co" }, { email: "a@B.co" }, { userId: 7 }, { userId: -1 }]).map((e) => e.email || e.userId), ["a@b.co", 7]);
});

test("the rules: admin and paid plans still work, and the list is checked alongside them", () => {
  const person = { id: 10, role: "todo", username: "mia" } as any;
  assert.deepEqual(todoUnlimitedFor(person, {}), { unlimited: false, via: null, endsAt: null });
  assert.equal(todoUnlimitedFor(person, { vip: true }).via, "vip");
  assert.equal(todoUnlimitedFor({ id: 1, role: "admin" } as any, { vip: true }).via, "admin");
  assert.equal(onVipList([], USERS[10]), false);
});
