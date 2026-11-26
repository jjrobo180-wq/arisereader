import test from "node:test";
import assert from "node:assert/strict";
import { registerPlanRoutes } from "../server/plans";

/** A stand-in for Express: keeps each route's handlers so they can be run in order without a server. */
function fakeApp() {
  const routes = new Map<string, any[]>();
  const add = (method: string) => (path: any, ...handlers: any[]) => { if (typeof path === "string") routes.set(`${method} ${path}`, handlers); };
  const app: any = new Proxy({}, { get: (_t, prop: string) => (["get", "post", "put", "delete", "patch"].includes(prop) ? add(prop.toUpperCase()) : () => app) });
  const run = async (method: string, path: string, params: Record<string, string>, body: any, user: any) => {
    const key = [...routes.keys()].find((k) => k === `${method} ${path}`)!;
    const res: any = { code: 200, body: null, set: () => res, status: (c: number) => { res.code = c; return res; }, json: (b: any) => { res.body = b; return res; } };
    const req: any = { params, body, user, headers: {}, ip: String(body?.email || "1.2.3.4") };
    for (const h of routes.get(key)!) { let next = false; await h(req, res, () => { next = true; }); if (!next) break; }
    return res;
  };
  return { app, run };
}

test("approving a family scholarship gives the family plan and emails them, once", async () => {
  const settings = new Map<string, string>();
  const emails: { to: string; subject: string; html: string }[] = [];
  const { app, run } = fakeApp();
  const admin = { id: 1, isAdmin: true, role: "student" };
  registerPlanRoutes(app, ((req: any, _res: any, next: any) => next()) as any, ((req: any, res: any, next: any) => (req.user?.isAdmin ? next() : res.status(403).json({}))) as any, {
    getSetting: async (k) => settings.get(k) ?? "",
    upsertSetting: async (k, v) => { settings.set(k, v); },
    readSetting: async (k) => settings.get(k) ?? "",
    userForToken: async () => null,
    getUser: async (id) => (id === 80 ? { id: 80, role: "parent", createdAt: "2026-11-21T00:00:00Z" } : null),
    findParentByEmail: async (email) => (email.toLowerCase() === "fam@x.org" ? { id: 80 } : null),
    sendEmail: async (to, subject, html) => { emails.push({ to, subject, html }); return { sent: true }; },
    countTeacherStudents: async () => 0, countSchoolStudents: async () => 0, schoolName: async () => "", schools: async () => [],
    envStripeKey: () => "", envWebhookSecret: () => "", appUrl: "https://www.arisereader.com",
  } as any);
  const apply = (email: string, name: string) => run("POST", "/api/reader-scholarship", {}, { who: "family", name, email, reason: "Four homeschooled children who love to read." }, null);
  assert.equal((await apply("fam@x.org", "Kelley Olsen")).code, 200);
  const id = JSON.parse(settings.get("reader_scholarships")!)[0].id;
  let r = await run("POST", "/api/admin/reader-scholarships/:id", { id }, { status: "approved" }, admin);
  assert.equal(r.code, 200, JSON.stringify(r.body));
  assert.match(r.body.message, /Family plan given for 12 months\. Email sent to fam@x\.org\./);
  const grant = JSON.parse(settings.get("plan_bundle_family_80")!);
  assert.equal(grant.status, "active");
  assert.equal(grant.note, "Reader scholarship");
  assert.equal(emails.length, 1);
  assert.match(emails[0].subject, /scholarship is approved/);
  assert.match(emails[0].html, /Hi Kelley,[\s\S]*arisereader\.com/);
  const saved = JSON.parse(settings.get("reader_scholarships")!)[0];
  assert.ok(saved.grantedAt && saved.emailedAt && saved.grantedTo === 80);
  // Approving again doesn't email twice.
  r = await run("POST", "/api/admin/reader-scholarships/:id", { id }, { status: "approved" }, admin);
  assert.equal(emails.length, 1);
  assert.match(r.body.message, /already emailed/);

  // No parent account with that email yet: nothing given, nothing sent, and it says so.
  assert.equal((await apply("nobody@x.org", "Ash")).code, 200);
  const id2 = JSON.parse(settings.get("reader_scholarships")!)[0].id;
  r = await run("POST", "/api/admin/reader-scholarships/:id", { id: id2 }, { status: "approved" }, admin);
  assert.match(r.body.message, /No parent account uses nobody@x\.org yet/);
  assert.equal(emails.length, 1);
});
