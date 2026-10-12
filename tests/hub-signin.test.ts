// Run with: npx tsx --test tests/hub-signin.test.ts
// One sign-in for adults: teachers, parents, LifeHub accounts and the administrator who sign in on
// arisereader.com are carried into their hub on arisetodo.com. Students are not. Plus crash reports.
import test from "node:test";
import assert from "node:assert/strict";
import { isHubAccount, registerAdminHandoffRoutes } from "../server/adminHandoff";
import { registerClientErrorRoutes } from "../server/clientErrors";

const users: Record<string, any> = {
  teacherTok: { id: 1, role: "teacher", isAdmin: false },
  parentTok: { id: 2, role: "parent", isAdmin: false },
  todoTok: { id: 3, role: "todo", isAdmin: false },
  adminTok: { id: 4, role: "teacher", isAdmin: true },
  studentTok: { id: 5, role: "student", isAdmin: false },
};

function setup() {
  const routes: Record<string, Function[]> = {};
  const app: any = { post: (path: string, ...h: Function[]) => { routes[path] = h; } };
  let clock = 1_000_000;
  const sessions = { ...users };
  const auth = (req: any, res: any, next: any) => {
    const tok = String(req.headers.authorization || "").replace("Bearer ", "");
    const u = (sessions as any)[tok];
    if (!u) return res.status(401).json({ message: "no" });
    req.realUser = u; req.user = u; req.sessionToken = tok; next();
  };
  registerAdminHandoffRoutes(app, auth, { getSession: async (t) => ((sessions as any)[t] ? { user: (sessions as any)[t] } : null), now: () => clock });
  const call = async (path: string, host: string, opts: { token?: string; body?: any } = {}) => {
    let status = 200, out: any = null;
    const res: any = { setHeader() {}, status(c: number) { status = c; return res; }, json(b: any) { out = b; return res; } };
    const req: any = { headers: { host, authorization: opts.token ? `Bearer ${opts.token}` : "" }, body: opts.body || {} };
    const hs = routes[path]; let i = 0;
    const next = async () => { const h = hs[i++]; if (h) await h(req, res, next); };
    await next();
    return { status, body: out };
  };
  return { call, sessions, tick: (ms: number) => { clock += ms; } };
}

test("who counts as a hub account", () => {
  assert.ok(isHubAccount(users.teacherTok) && isHubAccount(users.parentTok) && isHubAccount(users.todoTok) && isHubAccount(users.adminTok));
  assert.ok(!isHubAccount(users.studentTok) && !isHubAccount(null));
});

test("teachers, parents, LifeHub accounts and the administrator carry their sign-in to arisetodo.com", async () => {
  const { call } = setup();
  for (const tok of ["teacherTok", "parentTok", "todoTok", "adminTok"]) {
    const start = await call("/api/auth/admin-handoff/start", "www.arisereader.com", { token: tok });
    assert.equal(start.status, 200, tok);
    assert.match(start.body.code, /^[a-f0-9]{64}$/);
    const done = await call("/api/auth/admin-handoff/consume", "arisetodo.com", { body: { code: start.body.code } });
    assert.equal(done.status, 200, tok);
    assert.equal(done.body.token, tok);
    assert.equal(done.body.user.id, users[tok].id);
    const again = await call("/api/auth/admin-handoff/consume", "arisetodo.com", { body: { code: start.body.code } });
    assert.equal(again.status, 401, "a code works once");
  }
});

test("students, wrong sites and old codes are refused", async () => {
  const { call, tick, sessions } = setup();
  assert.equal((await call("/api/auth/admin-handoff/start", "arisereader.com", { token: "studentTok" })).status, 403);
  assert.equal((await call("/api/auth/admin-handoff/start", "arisetodo.com", { token: "teacherTok" })).status, 403, "started on Reader only");
  const s = await call("/api/auth/admin-handoff/start", "arisereader.com", { token: "parentTok" });
  assert.equal((await call("/api/auth/admin-handoff/consume", "arisereader.com", { body: { code: s.body.code } })).status, 403, "redeemed on arisetodo.com only");
  assert.equal((await call("/api/auth/admin-handoff/consume", "arisetodo.com", { body: { code: "nope" } })).status, 400);
  const late = await call("/api/auth/admin-handoff/start", "arisereader.com", { token: "teacherTok" });
  tick(61_000);
  assert.equal((await call("/api/auth/admin-handoff/consume", "arisetodo.com", { body: { code: late.body.code } })).status, 401, "codes expire after a minute");
  const gone = await call("/api/auth/admin-handoff/start", "arisereader.com", { token: "teacherTok" });
  delete (sessions as any).teacherTok;
  assert.equal((await call("/api/auth/admin-handoff/consume", "arisetodo.com", { body: { code: gone.body.code } })).status, 401, "a signed-out session can't be carried over");
});

test("crash reports are logged briefly, without codes, and rate limited", async () => {
  const lines: string[] = [];
  let handler: Function = () => {};
  registerClientErrorRoutes({ post: (_p: string, h: Function) => { handler = h; } } as any, { log: (l) => lines.push(l) });
  const send = (body: any) => { let status = 0; const res: any = { status(c: number) { status = c; return res; }, end() { return res; } }; handler({ headers: { "x-forwarded-for": "1.2.3.4" }, socket: {}, body }, res); return status; };
  assert.equal(send({ host: "arisetodo.com", route: "#/admin-handoff?code=abc123", role: "teacher", name: "TypeError", message: "x is undefined", where: "at TeacherHub" }), 204);
  assert.match(lines[0], /\[client-error\] arisetodo\.com#\/admin-handoff role=teacher TypeError: x is undefined @ at TeacherHub/);
  assert.ok(!lines[0].includes("abc123"));
  for (let i = 0; i < 40; i++) send({ message: "spam" });
  assert.equal(lines.length, 30);
});
