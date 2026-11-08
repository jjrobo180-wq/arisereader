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

function setup(onActive?: (link: any) => Promise<void>) {
  const settings = new Map<string, string>();
  const files = new Map<string, string>();
  const routes: Record<string, Function> = {};
  const add = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h[h.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE") };
  const auth = ((_q: any, _s: any, n: any) => n()) as any;
  const life = { family: { calendars: [], events: [{ id: "e1", title: "Swim lesson", date: "2026-10-19", time: "16:00" }] } };
  const links = registerProfileLinkRoutes(app, auth, {
    getSetting: async (k) => settings.get(k) ?? "", upsertSetting: async (k, v) => { settings.set(k, v); },
    getUser: async (id) => USERS[id] ?? null, lifeHub: async () => life, onActive,
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
  assert.equal(shareCatalog().find((c) => c.kind === "app")!.id, "app:potty");
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

test("ask to see theirs: the person who keeps the data approves, and only then can the asker open (and log in) their copy", async () => {
  const { call } = setup();
  // Grandma (2) keeps Potty Training on her own phone; Jordan (1) asks to see it.
  await call("PUT", "/api/app-data/:app", 2, { params: { app: "pro-potty" }, body: { data: { kids: ["Mia"] } } });
  assert.equal((await call("POST", "/api/profile-links/ask", 1, { body: { email: "grandma@example.com", nickname: "Mom", grants: {} } })).status, 400, "ask for something");
  assert.equal((await call("POST", "/api/profile-links/ask", 1, { body: { email: "jordan@example.com", grants: { "app:potty": "edit" } } })).status, 400, "not yourself");
  assert.equal((await call("POST", "/api/profile-links/ask", 1, { body: { email: "GRANDMA@example.com", nickname: "Mom", grants: { "app:potty": "edit", "app:not-real": "edit", "life:calendar": "edit" } } })).status, 200);
  // Nothing opens before she answers.
  assert.equal((await call("GET", "/api/app-data/:app", 1, { params: { app: "pro-potty" }, query: { owner: "2" } })).status, 403);
  const theirs = await call("GET", "/api/profile-links", 2);
  assert.equal(theirs.body.requests.length, 1);
  assert.equal(theirs.body.requests[0].fromName, "Jordan Rivera");
  assert.deepEqual(theirs.body.requests[0].grants, { "app:potty": "edit", "life:calendar": "view" });
  assert.equal((await call("GET", "/api/profile-links", 3)).body.requests.length, 0, "a stranger sees no one's requests");
  assert.equal((await call("POST", "/api/profile-links/requests/:id/approve", 3, { params: { id: theirs.body.requests[0].id } })).status, 404, "only the person it was sent to can answer");
  // She shares just Potty Training, and only to view: the approver can narrow what was asked, never widen it.
  const ok = await call("POST", "/api/profile-links/requests/:id/approve", 2, { params: { id: theirs.body.requests[0].id }, body: { grants: { "app:potty": "view", "app:water": "edit" } } });
  assert.equal(ok.status, 200);
  assert.equal((await call("GET", "/api/profile-links", 2)).body.requests.length, 0);
  const mine = await call("GET", "/api/profile-links", 2);
  assert.deepEqual(mine.body.mine[0].grants, { "app:potty": "view" });
  assert.equal(mine.body.mine[0].status, "active");
  assert.equal((await call("GET", "/api/app-data/:app", 1, { params: { app: "pro-potty" }, query: { owner: "2" } })).status, 200);
  assert.equal((await call("PUT", "/api/app-data/:app", 1, { params: { app: "pro-potty" }, query: { owner: "2" }, body: { data: { kids: ["x"] } } })).status, 403, "view only until she allows edit");
  const link = mine.body.mine[0];
  await call("PUT", "/api/profile-links/:id", 2, { params: { id: link.id }, body: { grants: { "app:potty": "edit" } } });
  assert.equal((await call("PUT", "/api/app-data/:app", 1, { params: { app: "pro-potty" }, query: { owner: "2" }, body: { data: { kids: ["Mia", "log"] } } })).status, 200);
  // Declining removes the request.
  await call("POST", "/api/profile-links/ask", 3, { body: { email: "grandma@example.com", grants: { "app:potty": "view" } } });
  const r2 = (await call("GET", "/api/profile-links", 2)).body.requests[0];
  assert.equal((await call("POST", "/api/profile-links/requests/:id/decline", 2, { params: { id: r2.id } })).status, 200);
  assert.equal((await call("GET", "/api/profile-links", 2)).body.requests.length, 0);
});

test("the people picker can show every app that can be shared", () => {
  const ui = readFileSync("client/src/components/family-hub/LinkedProfiles.tsx", "utf8");
  assert.match(ui, /Show all \{apps\.length\} apps/); assert.match(ui, /tab\("ask", "See theirs", Eye\)/);
});

test("fullGrants shares every app for editing and every life page as view-only", async () => {
  const { fullGrants, isJoinLinkEmail, JOIN_LINK_EMAIL } = await import("../shared/profileLinks");
  const g = fullGrants();
  assert.ok(Object.keys(g).length > 0);
  assert.ok(Object.values(g).every((v) => v === "view" || v === "edit"));
  assert.ok(Object.values(g).some((v) => v === "edit"));
  assert.equal(isJoinLinkEmail(`join-1${JOIN_LINK_EMAIL}`), true);
  assert.equal(isJoinLinkEmail("a@b.com"), false);
});

test("one link: owner makes it, wife joins once, gets Potty Training; stranger and owner can't reuse it", async () => {
  const { call } = setup();
  await call("PUT", "/api/app-data/:app", 1, { params: { app: "pro-potty" }, body: { data: { kids: ["Mia"] } } });
  const made = await call("POST", "/api/profile-links/link", 1, { body: { nickname: "Wife" } });
  assert.equal(made.status, 200);
  const t = made.body.token as string;
  assert.match(t, /^[a-f0-9]{44}$/);
  // Before joining: no access.
  assert.equal((await call("GET", "/api/app-data/:app", 2, { params: { app: "pro-potty" }, query: { owner: "1" } })).status, 403);
  // The owner can't join their own link.
  assert.notEqual((await call("POST", "/api/profile-links/join/:token", 1, { params: { token: t } })).status, 200);
  const peek = await call("GET", "/api/profile-links/join/:token", 2, { params: { token: t } });
  assert.equal(peek.status, 200);
  assert.equal(peek.body.ownerName, "Jordan Rivera");
  assert.equal((await call("POST", "/api/profile-links/join/:token", 2, { params: { token: t } })).status, 200);
  const got = await call("GET", "/api/app-data/:app", 2, { params: { app: "pro-potty" }, query: { owner: "1" } });
  assert.equal(got.status, 200);
  // The link is spent.
  assert.equal((await call("POST", "/api/profile-links/join/:token", 3, { params: { token: t } })).status, 404);
  assert.equal((await call("GET", "/api/profile-links/join/:token", 3, { params: { token: "nope" } })).status, 404);
});

test("everything that can be shared is in the list: Accountability first (done together), and the meal plan", async () => {
  const { ACCOUNTABILITY_SHARE, fullGrants } = await import("../shared/profileLinks");
  const cat = shareCatalog();
  assert.equal(cat[0].id, ACCOUNTABILITY_SHARE); assert.equal(cat[0].kind, "together"); assert.equal(cat[0].label, "Accountability");
  assert.ok(cat.some((c) => c.id === "life:meals"));
  // Every page a linked person can be shown (shared/todoShare.ts) is offered.
  for (const id of ["life:calendar", "life:tasks", "life:chores", "life:goals", "life:bills", "life:trips", "life:links", "life:meals"]) assert.ok(cat.some((c) => c.id === id), id);
  assert.deepEqual(cleanGrants({ [ACCOUNTABILITY_SHARE]: "view" }), { [ACCOUNTABILITY_SHARE]: "edit" }, "together is all or nothing");
  assert.equal(fullGrants()[ACCOUNTABILITY_SHARE], "edit");
});

test("a link in use tells the server so things done together are set up: accept, join, approve and changes", async () => {
  const { ACCOUNTABILITY_SHARE } = await import("../shared/profileLinks");
  const seen: any[] = [];
  const { call } = setup(async (l) => { seen.push([l.ownerId, l.viewerId, !!l.grants[ACCOUNTABILITY_SHARE]]); });
  const inv = await call("POST", "/api/profile-links", 1, { body: { email: "grandma@example.com", grants: { [ACCOUNTABILITY_SHARE]: "edit" } } });
  assert.equal(seen.length, 0, "nothing before they accept");
  await call("PUT", "/api/profile-links/:id", 1, { params: { id: inv.body.link.id }, body: { grants: { [ACCOUNTABILITY_SHARE]: "edit", "app:potty": "view" } } });
  assert.equal(seen.length, 0, "still pending");
  await call("POST", "/api/profile-links/from/:owner/:id/accept", 2, { params: { owner: "1", id: inv.body.link.id } });
  assert.deepEqual(seen, [[1, 2, true]]);
  await call("PUT", "/api/profile-links/:id", 1, { params: { id: inv.body.link.id }, body: { grants: { "app:potty": "view" } } });
  assert.deepEqual(seen[1], [1, 2, false]);
  const made = await call("POST", "/api/profile-links/link", 1, { body: { nickname: "Wife", grants: { [ACCOUNTABILITY_SHARE]: "edit" } } });
  await call("POST", "/api/profile-links/join/:token", 3, { params: { token: made.body.token } });
  assert.deepEqual(seen[2], [1, 3, true]);
});

test("sharing is one page (Settings → Sharing): people from links and Accountability, one Add someone, and the links", () => {
  const read = (f: string) => readFileSync(f, "utf8");
  const page = read("client/src/components/family-hub/LinkedProfiles.tsx");
  assert.match(page, /export function LinkSomeoneModal/);
  assert.match(page, /title="Links anyone can open"/, "the no-account links are on the same page");
  assert.match(page, /for \(const s of acct\?\.spaces \?\? \[\]\) for \(const m of s\.members\)/, "people in an Accountability space with you are listed");
  assert.doesNotMatch(page, /function InviteModal|function AskModal|function MySharing/);
  // Nowhere else shares: Accountability's Invite and Family & settings point to the Sharing page.
  const acct = read("client/src/components/family-hub/Accountability.tsx");
  assert.match(acct, /#\/lifehub\?go=linked&add=accountability/); assert.doesNotMatch(acct, /LinkSomeoneModal|function InviteSheet/);
  const members = read("client/src/components/family-hub/Members.tsx");
  assert.match(members, /href="#\/lifehub\?go=linked"/); assert.doesNotMatch(members, /SharedLinks|LinkSomeoneModal|setSharing/);
  const todo = read("client/src/pages/AriseTodo.tsx");
  assert.match(todo, /id: "sharing", label: "Sharing"/); assert.match(todo, /!ADD_ON_SECTIONS\.includes\(id\) && id !== "linked"/);
  // The button bar covers the bottom of the sheet, so the list never shows below it.
  assert.match(read("client/src/components/family-hub/ui.tsx"), /export const stickyFoot = "sticky -bottom-/);
});

test("share with someone you're already together with (an Accountability space), without an email; strangers can't", async () => {
  const { ACCOUNTABILITY_SHARE } = await import("../shared/profileLinks");
  const settings = new Map<string, string>(); const routes: Record<string, Function> = {};
  const add = (m: string) => (path: string, ...h: Function[]) => { routes[`${m} ${path}`] = h[h.length - 1]; };
  const app: any = { get: add("GET"), post: add("POST"), put: add("PUT"), delete: add("DELETE") };
  const active: any[] = [];
  registerProfileLinkRoutes(app, ((_q: any, _s: any, n: any) => n()) as any, {
    getSetting: async (k) => settings.get(k) ?? "", upsertSetting: async (k, v) => { settings.set(k, v); },
    getUser: async (id) => USERS[id] ?? null, lifeHub: async () => null,
    knows: async (a, b) => (a === 1 && b === 2) || (a === 2 && b === 1), onActive: async (l) => { active.push(l); },
  });
  const call = async (m: string, path: string, who: number, body: any = {}, params: any = {}) => {
    let status = 200, out: any = null;
    const res: any = { status(c: number) { status = c; return res; }, json(b: any) { out = b; return res; }, set() { return res; } };
    await routes[`${m} ${path}`]({ user: USERS[who], body, params, query: {} }, res);
    return { status, body: out };
  };
  const r = await call("POST", "/api/profile-links/person", 1, { userId: 2, grants: { "app:potty": "edit", [ACCOUNTABILITY_SHARE]: "edit" } });
  assert.equal(r.status, 200); assert.equal(r.body.link.status, "active");
  assert.equal(active.length, 1);
  const theirs = await call("GET", "/api/profile-links", 2);
  assert.equal(theirs.body.withMe[0].status, "active"); assert.equal(theirs.body.withMe[0].grants["app:potty"], "edit");
  const mine = await call("GET", "/api/profile-links", 1);
  assert.equal(mine.body.mine.length, 1, "changing it again keeps one link"); assert.equal(mine.body.mine[0].viewerId, 2);
  await call("POST", "/api/profile-links/person", 1, { userId: 2, grants: { "app:potty": "view" } });
  assert.equal((await call("GET", "/api/profile-links", 1)).body.mine.length, 1);
  assert.equal((await call("POST", "/api/profile-links/person", 1, { userId: 3, grants: { "app:potty": "edit" } })).status, 403, "not someone you know here");
});
