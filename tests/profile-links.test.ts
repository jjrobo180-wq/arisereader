import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerProfileLinkRoutes } from "../server/profileLinks";
import { registerUserDocRoutes, type DocStore } from "../server/userDocs";
import { accessFor, allows, appIdFromKey, cleanGrants, shareCatalog } from "../shared/profileLinks";

const USERS: Record<number, { id: number; displayName: string; email: string }> = {
  1: { id: 1, displayName: "Jordan Rivera", email: "jordan@example.com" },
  2: { id: 2, displayName: "Grandma Lee", email: "grandma@example.com" },
  3: { id: 3, displayName: "Stranger", email: "stranger@example.com" },
};

function setup() {
  const settings = new Map<string, string>();
  const files = new Map<string, string>();
  const routes: Record<string, Function> = {};
  const add = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h[h.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE") };
  const auth = ((_q: any, _s: any, n: any) => n()) as any;
  const life = { family: { calendars: [], events: [{ id: "e1", title: "Swim lesson", date: "2026-10-19", time: "16:00" }] } };
  const links = registerProfileLinkRoutes(app, auth, {
    getSetting: async (k) => settings.get(k) ?? "", upsertSetting: async (k, v) => { settings.set(k, v); },
    getUser: async (id) => USERS[id] ?? null, lifeHub: async () => life,
  });
  const store: DocStore = { read: async (p) => files.get(p) ?? null, write: async (p, b) => { files.set(p, b); }, remove: async () => {}, list: async () => [] };
  registerUserDocRoutes(app, auth, store, undefined, links.canUseApp);
  const call = async (m: string, path: string, who: number, opts: { body?: any; params?: any; query?: any } = {}) => {
    let status = 200, out: any = null;
    const res: any = { status(c: number) { status = c; return res; }, json(b: any) { out = b; return res; }, set() { return res; }, type() { return res; }, send(b: string) { out = JSON.parse(b); return res; } };
    await routes[`${m} ${path}`]({ user: USERS[who], body: opts.body ?? {}, params: opts.params ?? {}, query: opts.query ?? {} }, res);
    return { status, body: out };
  };
  return { call, files, settings };
}

test("only known things can be shared, and LifeHub pages are never more than View", () => {
  assert.deepEqual(cleanGrants({ "app:potty": "edit", "app:not-real": "edit", "life:calendar": "edit", "life:health:me": "view", junk: "view", "app:water": "owner" }), { "app:potty": "edit", "life:calendar": "view", "life:health:me": "view" });
  assert.equal(appIdFromKey("pro-potty"), "potty");
  assert.equal(appIdFromKey("premium-studio-v1"), null);
  assert.equal(shareCatalog()[0].id, "app:potty");
  assert.ok(shareCatalog([{ id: "me", name: "Me" }]).some((c) => c.id === "life:health:me" && !c.editable));
  assert.equal(allows("edit", "view"), true);
  assert.equal(allows("view", "edit"), false);
  assert.equal(allows(null, "view"), false);
  assert.equal(accessFor([{ id: "x".repeat(8), ownerId: 1, email: "a@b.co", viewerId: 2, nickname: "", status: "pending", grants: { "app:potty": "edit" }, createdAt: "", updatedAt: "" }], 2, "app:potty"), null);
});

test("invite → accept → the other person can open Potty Training; nothing before accepting", async () => {
  const { call } = setup();
  await call("PUT", "/api/app-data/:app", 1, { params: { app: "pro-potty" }, body: { data: { kids: ["Mia"] } } });
  const inv = await call("POST", "/api/profile-links", 1, { body: { email: "Grandma@Example.com", nickname: "Grandma", grants: { "app:potty": "view", "life:calendar": "view" } } });
  assert.equal(inv.status, 200);
  assert.equal(inv.body.link.status, "pending");
  // Not accepted yet: no access.
  assert.equal((await call("GET", "/api/app-data/:app", 2, { params: { app: "pro-potty" }, query: { owner: "1" } })).status, 403);
  const theirs = await call("GET", "/api/profile-links", 2);
  assert.equal(theirs.body.withMe.length, 1);
  assert.equal(theirs.body.withMe[0].ownerName, "Jordan Rivera");
  assert.equal(theirs.body.withMe[0].status, "pending");
  assert.equal((await call("POST", "/api/profile-links/from/:owner/:id/accept", 2, { params: { owner: "1", id: inv.body.link.id } })).status, 200);
  const read = await call("GET", "/api/app-data/:app", 2, { params: { app: "pro-potty" }, query: { owner: "1" } });
  assert.equal(read.status, 200);
  assert.deepEqual(read.body.data, { kids: ["Mia"] });
  // A stranger, or an app that isn't shared, gets nothing.
  assert.equal((await call("GET", "/api/app-data/:app", 3, { params: { app: "pro-potty" }, query: { owner: "1" } })).status, 403);
  assert.equal((await call("GET", "/api/app-data/:app", 2, { params: { app: "pro-water" }, query: { owner: "1" } })).status, 403);
  assert.equal((await call("GET", "/api/profile-links", 3)).body.withMe.length, 0);
});

test("View can't save; switching to Edit lets them log; stopping sharing cuts it off at once", async () => {
  const { call, files } = setup();
  const inv = await call("POST", "/api/profile-links", 1, { body: { email: "grandma@example.com", grants: { "app:potty": "view" } } });
  await call("POST", "/api/profile-links/from/:owner/:id/accept", 2, { params: { owner: "1", id: inv.body.link.id } });
  assert.equal((await call("PUT", "/api/app-data/:app", 2, { params: { app: "pro-potty" }, query: { owner: "1" }, body: { data: { x: 1 } } })).status, 403);
  assert.equal(files.has("1/apps/pro-potty.json"), false);
  await call("PUT", "/api/profile-links/:id", 1, { params: { id: inv.body.link.id }, body: { grants: { "app:potty": "edit" } } });
  assert.equal((await call("PUT", "/api/app-data/:app", 2, { params: { app: "pro-potty" }, query: { owner: "1" }, body: { data: { logged: "pee" } } })).status, 200);
  assert.deepEqual(JSON.parse(files.get("1/apps/pro-potty.json")!).data, { logged: "pee" }); // saved to the OWNER's file
  assert.equal(files.has("2/apps/pro-potty.json"), false);
  // Only the owner can change what's shared.
  assert.equal((await call("PUT", "/api/profile-links/:id", 2, { params: { id: inv.body.link.id }, body: { grants: { "app:water": "edit" } } })).status, 404);
  await call("DELETE", "/api/profile-links/:id", 1, { params: { id: inv.body.link.id } });
  assert.equal((await call("GET", "/api/app-data/:app", 2, { params: { app: "pro-potty" }, query: { owner: "1" } })).status, 403);
  assert.equal((await call("GET", "/api/profile-links", 2)).body.withMe.length, 0);
});

test("shared LifeHub pages are view only and only what was turned on", async () => {
  const { call } = setup();
  const inv = await call("POST", "/api/profile-links", 1, { body: { email: "grandma@example.com", grants: { "life:calendar": "view" } } });
  await call("POST", "/api/profile-links/from/:owner/:id/accept", 2, { params: { owner: "1", id: inv.body.link.id } });
  const cal = await call("GET", "/api/profile-links/from/:owner/life/:item", 2, { params: { owner: "1", item: "calendar" }, query: { today: "2026-10-19" } });
  assert.equal(cal.status, 200);
  assert.equal(cal.body.view.kind, "calendar");
  assert.equal((await call("GET", "/api/profile-links/from/:owner/life/:item", 2, { params: { owner: "1", item: "bills" } })).status, 403);
  assert.equal((await call("GET", "/api/profile-links/from/:owner/life/:item", 3, { params: { owner: "1", item: "calendar" } })).status, 403);
});

test("no inviting yourself, no duplicates, leaving works, and an invite never reveals whether an email has an account", async () => {
  const { call } = setup();
  assert.equal((await call("POST", "/api/profile-links", 1, { body: { email: "jordan@example.com" } })).status, 400);
  assert.equal((await call("POST", "/api/profile-links", 1, { body: { email: "not an email" } })).status, 400);
  const nobody = await call("POST", "/api/profile-links", 1, { body: { email: "no-account@example.com", grants: { "app:potty": "view" } } });
  assert.equal(nobody.status, 200); // same answer whether or not the email has an account
  assert.equal((await call("POST", "/api/profile-links", 1, { body: { email: "no-account@example.com" } })).status, 409);
  const inv = await call("POST", "/api/profile-links", 1, { body: { email: "grandma@example.com", grants: { "app:potty": "view" } } });
  await call("POST", "/api/profile-links/from/:owner/:id/accept", 2, { params: { owner: "1", id: inv.body.link.id } });
  assert.equal((await call("POST", "/api/profile-links/from/:owner/:id/leave", 2, { params: { owner: "1", id: inv.body.link.id } })).status, 200);
  assert.equal((await call("GET", "/api/app-data/:app", 2, { params: { app: "pro-potty" }, query: { owner: "1" } })).status, 403);
  // Someone else can't accept an invite meant for another email.
  const inv2 = await call("POST", "/api/profile-links", 1, { body: { email: "grandma@example.com", grants: { "app:potty": "view" } } });
  assert.equal((await call("POST", "/api/profile-links/from/:owner/:id/accept", 3, { params: { owner: "1", id: inv2.body.link.id } })).status, 404);
});

test("your own app data is unchanged, and the app shows a clear banner and never saves when View only", async () => {
  const { call, files } = setup();
  assert.equal((await call("PUT", "/api/app-data/:app", 1, { params: { app: "pro-water" }, body: { data: { cups: 3 } } })).status, 200);
  assert.ok(files.has("1/apps/pro-water.json"));
  assert.equal((await call("GET", "/api/app-data/:app", 1, { params: { app: "pro-water" } })).body.data.cups, 3);
  const docs = readFileSync(new URL("../client/src/lib/cloudDocs.ts", import.meta.url), "utf8");
  assert.match(docs, /if \(readOnly\) \{ try \{ window\.dispatchEvent\(new Event\(READ_ONLY_EVENT\)\)/);
  assert.match(docs, /`\/api\/app-data\/\$\{app\}\$\{ownerQ\}`/);
  const pro = readFileSync(new URL("../client/src/pages/ProApps.tsx", import.meta.url), "utf8");
  assert.match(pro, /<SharedOwnerContext\.Provider value=\{shared\}>/);
});
