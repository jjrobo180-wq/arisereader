// Arise To Do ↔ Google (Classroom, Docs, Calendar, Gmail). Run with: npx tsx --test tests/google-connect.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FEATURE_SCOPES, OFFERED_FEATURES, attachDoc, calendarEvent, classroomItem, driveQuery, eventForTask, featuresFromScopes, googleAuthUrl,
  mailItem, mergeClassroom, taskFromMail,
} from "../shared/googleConnect";
import { makeState, readState, registerGoogleRoutes, safeReturn, seal, unseal } from "../server/googleConnect";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const KEY = Buffer.alloc(32, 7);

test("each part asks Google only for its own permissions, added to what was already allowed", () => {
  const url = new URL(googleAuthUrl({ clientId: "cid", redirectUri: "https://example.test/api/google/callback", feature: "classroom", state: "s" }));
  const scopes = url.searchParams.get("scope")!.split(" ");
  assert.ok(scopes.includes(FEATURE_SCOPES.classroom[0]));
  assert.ok(!scopes.some((s) => /gmail|drive|calendar/.test(s)), "Classroom never asks for email, Drive or Calendar");
  assert.equal(url.searchParams.get("include_granted_scopes"), "true");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.deepEqual(featuresFromScopes([...FEATURE_SCOPES.classroom, ...FEATURE_SCOPES.gmail, FEATURE_SCOPES.classroomPost[0]]), ["classroom", "gmail"], "a part counts only when all of it is allowed");
  // Nothing offered needs Google's restricted-scope security review (Gmail read, all of Drive).
  for (const f of OFFERED_FEATURES) assert.ok(!FEATURE_SCOPES[f].some((s) => /gmail|drive\.readonly|auth\/drive$/.test(s)), f);
  assert.ok(!OFFERED_FEATURES.includes("gmail"));
});

test("a Classroom assignment: due moment in UTC, due day without a time, turned in = done", () => {
  const course = { id: "c1", name: "Biology" };
  const a = classroomItem(course, { id: "w1", title: "Lab report", dueDate: { year: 2026, month: 11, day: 24 }, dueTime: { hours: 6, minutes: 59 }, alternateLink: "https://classroom.google.com/x" }, { state: "TURNED_IN" })!;
  assert.equal(a.key, "classroom:c1:w1");
  assert.equal(a.dueAt, "2026-11-24T06:59:00.000Z");
  assert.equal(a.done, true);
  const b = classroomItem(course, { id: "w2", title: "Read ch. 4", dueDate: { year: 2026, month: 12, day: 1 } }, { state: "CREATED" })!;
  assert.equal(b.dueDay, "2026-12-01"); assert.equal(b.dueAt, ""); assert.equal(b.done, false);
  assert.equal(classroomItem(course, { id: "w3", title: "" }), null);
});

test("assignments merge into the to-dos once, follow Classroom, and turned-in ones check off", () => {
  let n = 0; const makeId = () => `t${++n}`;
  const items = [
    { key: "classroom:c:1", title: "Essay", course: "English", link: "https://l/1", dueAt: "", dueDay: "2026-11-30", done: false, notes: "500 words" },
    { key: "classroom:c:2", title: "Old quiz", course: "English", link: "", dueAt: "", dueDay: "", done: true, notes: "" },
  ];
  const first = mergeClassroom([], items, makeId);
  assert.equal(first.added, 1, "one already turned in before it was ever brought in is skipped");
  assert.equal(first.tasks[0].title, "Essay (English)");
  assert.equal(first.tasks[0].dueDate, "2026-11-30");
  assert.match(first.tasks[0].notes!, /500 words[\s\S]*https:\/\/l\/1/);
  const again = mergeClassroom(first.tasks, items, makeId);
  assert.equal(again.added + again.updated, 0, "nothing twice");
  const turnedIn = mergeClassroom(first.tasks, [{ ...items[0], done: true, dueDay: "2026-12-02" }], makeId, new Date("2026-11-29T10:00:00Z"));
  assert.equal(turnedIn.tasks[0].done, true);
  assert.equal(turnedIn.tasks[0].doneAt, "2026-11-29T10:00:00.000Z");
  assert.equal(turnedIn.tasks[0].dueDate, "2026-12-02");
  const kept = mergeClassroom([{ ...first.tasks[0], done: true }], items, makeId);
  assert.equal(kept.tasks[0].done, true, "checked off here stays checked off");
});

test("Docs: the Drive search is escaped, and a Doc attaches to a to-do once", () => {
  assert.match(driveQuery("Mom's \\ plan"), /name contains 'Mom\\'s \\\\ plan'$/);
  assert.doesNotMatch(driveQuery(""), /name contains/);
  const file = { name: "Plan", link: "https://docs.google.com/document/d/abc/edit" };
  const once = attachDoc("Bring snacks", file);
  assert.equal(once, "Bring snacks\nPlan: https://docs.google.com/document/d/abc/edit");
  assert.equal(attachDoc(once, file), once);
  assert.equal(attachDoc(undefined, file), "Plan: https://docs.google.com/document/d/abc/edit");
});

test("Calendar: a timed to-do is 30 minutes in its time zone; one without a time is all day", () => {
  const timed = eventForTask({ title: "Call Ms. Lee", dueDate: "2026-11-24", dueTime: "15:45" }, "America/Denver");
  assert.deepEqual(timed.start, { dateTime: "2026-11-24T15:45:00", timeZone: "America/Denver" });
  assert.deepEqual(timed.end, { dateTime: "2026-11-24T16:15:00", timeZone: "America/Denver" });
  const late = eventForTask({ title: "x", dueDate: "2026-11-24", dueTime: "23:50" }, "UTC");
  assert.equal((late.end as any).dateTime, "2026-11-24T23:59:00");
  const allDay = eventForTask({ title: "Field trip", dueDate: "2026-12-31" }, "UTC");
  assert.deepEqual(allDay.start, { date: "2026-12-31" });
  assert.deepEqual(allDay.end, { date: "2027-01-01" });
  assert.throws(() => eventForTask({ title: "x", dueDate: "" }, "UTC"), /date first/);
  assert.equal(calendarEvent({ id: "e", start: { date: "2026-11-24" }, end: { date: "2026-11-25" } }).allDay, true);
});

test("Gmail: an email becomes a to-do with who sent it and a link back", () => {
  const m = mailItem({ id: "m1", snippet: "Please sign the form", payload: { headers: [{ name: "Subject", value: "Permission slip" }, { name: "From", value: "\"School Office\" <office@school.test>" }] } });
  assert.equal(m.subject, "Permission slip");
  assert.equal(m.from, "School Office");
  const t = taskFromMail(m);
  assert.equal(t.title, "Permission slip");
  assert.match(t.notes, /From School Office[\s\S]*sign the form[\s\S]*mail\.google\.com/);
});

test("the sign-in round trip is signed, expires, and only ever returns to our own site", () => {
  const s = makeState(KEY, 42, "docs", 1_000_000, true, "/to-do?tab=tasks");
  assert.deepEqual(readState(KEY, s, 1_000_001), { userId: 42, feature: "docs", app: true, returnTo: "/to-do?tab=tasks" });
  assert.equal(readState(KEY, s, 1_000_000 + 16 * 60_000), null, "expired");
  assert.equal(readState(Buffer.alloc(32, 8), s, 1_000_001), null, "another key");
  assert.equal(readState(KEY, s.replace(/^42\./, "43."), 1_000_001), null, "tampered");
  assert.equal(safeReturn("https://evil.test/"), "/");
  assert.equal(safeReturn("//evil.test"), "/");
});

test("the saved Google sign-in is encrypted, and can't be read with another key", () => {
  const sealed = seal(KEY, { refresh: "r!secret", scope: "a b", email: "x" });
  assert.doesNotMatch(sealed, /r!secret/);
  assert.equal(unseal(KEY, sealed)!.refresh, "r!secret");
  assert.equal(unseal(Buffer.alloc(32, 9), sealed), null);
  assert.equal(unseal(KEY, ""), null);
});

function fakeApp(opts: { configured?: boolean; google?: (url: string, init: any) => any } = {}) {
  const routes: Record<string, Function> = {};
  const store = new Map<string, string>();
  const app: any = { get: (p: string, ...h: Function[]) => { routes[`GET ${p}`] = h[h.length - 1]; }, post: (p: string, ...h: Function[]) => { routes[`POST ${p}`] = h[h.length - 1]; } };
  const calls: string[] = [];
  const fetchFn: any = async (url: string, init: any) => {
    calls.push(`${init?.method || "GET"} ${url}`);
    const body = opts.google ? opts.google(url, init) : {};
    return { ok: body?.__status ? body.__status < 400 : true, status: body?.__status || 200, json: async () => body };
  };
  registerGoogleRoutes(app, (_q: any, _s: any, n: any) => n(), {
    gate: async (req) => req.user, getSetting: async (k) => store.get(k) || "", upsertSetting: async (k, v) => { store.set(k, v); }, key: () => KEY,
    clientId: opts.configured === false ? undefined : "cid", clientSecret: opts.configured === false ? undefined : "secret",
    redirectUri: "https://example.test/api/google/callback", siteUrl: "https://example.test", fetch: fetchFn, now: () => 1_000_000,
  });
  const call = async (key: string, req: any = {}) => {
    let body: any, status = 200, redirect = "";
    const res: any = { headersSent: false, set: () => res, type: () => res, status: (s: number) => { status = s; return res; }, json: (b: any) => { body = b; res.headersSent = true; return res; }, send: (b: any) => { body = b; res.headersSent = true; return res; }, redirect: (s: number, u: string) => { status = s; redirect = u; res.headersSent = true; } };
    await routes[key]({ user: { id: 5 }, body: {}, query: {}, params: {}, ...req }, res);
    return { status, body, redirect };
  };
  return { call, store, calls };
}

test("until the site has Google keys, every part says so instead of breaking", async () => {
  const { call } = fakeApp({ configured: false });
  assert.deepEqual((await call("GET /api/google/status")).body, { configured: false, connected: false, email: "", features: [] });
  const c = await call("POST /api/google/connect", { body: { feature: "classroom" } });
  assert.equal(c.status, 503);
  assert.match(c.body.message, /isn't set up/);
});

test("connecting: Google's code is swapped for a lasting sign-in, saved encrypted, and the website goes back where it was", async () => {
  const idToken = `x.${Buffer.from(JSON.stringify({ email: "kid@school.test" })).toString("base64url")}.y`;
  const { call, store } = fakeApp({ google: (url) => (url.includes("/token") ? { access_token: "a1", refresh_token: "r1!lasting", expires_in: 3600, scope: FEATURE_SCOPES.classroom.join(" "), id_token: idToken } : {}) });
  const start = await call("POST /api/google/connect", { body: { feature: "classroom", returnTo: "/to-do" } });
  const state = new URL(start.body.url).searchParams.get("state")!;
  const back = await call("GET /api/google/callback", { query: { state, code: "abc" } });
  assert.equal(back.status, 302);
  assert.equal(back.redirect, "https://example.test/to-do?google=connected");
  assert.doesNotMatch(store.get("google_connect_5")!, /r1!lasting/, "stored encrypted");
  const status = (await call("GET /api/google/status")).body;
  assert.equal(status.connected, true); assert.deepEqual(status.features, ["classroom"]); assert.equal(status.email, "kid@school.test");
  const docs = await call("GET /api/google/drive/files", { query: {} });
  assert.equal(docs.status, 409, "Docs wasn't allowed: connect it first");
});

test("Classroom assignments: her classes' work with her own turned-in state", async () => {
  const { call, store } = fakeApp({ google: (url) => {
    if (url.includes("/token")) return { access_token: "a2", expires_in: 3600 };
    if (url.includes("studentId=me")) return { courses: [{ id: "c1", name: "Math" }] };
    if (url.includes("teacherId=me")) return { courses: [] };
    if (url.includes("/studentSubmissions")) return { studentSubmissions: [{ courseWorkId: "w1", state: "RETURNED" }] };
    if (url.includes("/courseWork")) return { courseWork: [{ id: "w1", title: "Worksheet", dueDate: { year: 2026, month: 11, day: 25 } }, { id: "w2", title: "Project" }] };
    return {};
  } });
  store.set("google_connect_5", seal(KEY, { refresh: "r", scope: FEATURE_SCOPES.classroom.join(" "), email: "" }));
  const r = await call("GET /api/google/classroom/assignments");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.items.map((i: any) => [i.title, i.done, i.dueDay]), [["Worksheet", true, "2026-11-25"], ["Project", false, ""]]);
});

test("To Do shows it: the Google box under Tasks, recent Docs on Home, the store entries, the server routes", () => {
  const hub = read("client/src/pages/TeacherHub.tsx");
  assert.match(hub, /<GoogleCard token=\{token\}/);
  assert.match(hub, /tab === "overview" && <GoogleRecentDocs/);
  assert.match(hub, /useClassroomSync\(/);
  const store = read("shared/pluginStore.ts");
  for (const id of ["work-google-classroom", "work-google-docs", "work-google-calendar", "work-gmail"]) assert.ok(store.includes(`id: "${id}"`), id);
  const routes = read("server/routes.ts");
  assert.match(routes, /registerGoogleRoutes\(app, authMiddleware, \{/);
  assert.match(routes, /clientId: process\.env\.GOOGLE_CLIENT_ID, clientSecret: process\.env\.GOOGLE_CLIENT_SECRET/);
});

test("Google is a plugin in every hub, and works with the hub it's opened from (Nov 25, 2026)", async () => {
  const { readFileSync } = await import("node:fs");
  const { pluginsFor } = await import("../shared/pluginStore");
  for (const hub of ["work", "life"] as const) {
    const g = pluginsFor(hub, { teacher: true, arise: true }).find((p) => p.id === `${hub}-google`);
    assert.ok(g && (g.target as any).href === "#/pro?app=google", hub);
  }
  for (const id of ["work-google-classroom", "work-google-docs", "work-google-calendar"])
    assert.equal((pluginsFor("work", { teacher: true, arise: true }).find((p) => p.id === id)!.target as any).href, "#/pro?app=google", id);
  assert.match(readFileSync("client/src/pages/ProApps.tsx", "utf8"), /if \(id === "google"\) return/);
  assert.match(readFileSync("client/src/pages/TeacherHub.tsx", "utf8"), /<HubTasksContext\.Provider value=\{tasksBridge\}>/);
  assert.match(readFileSync("client/src/pages/AriseTodo.tsx", "utf8"), /hub: familySpace \? "family" : "life",/);
});

test("Adding Google opens it right away in LifeHub and WorkHub, and Connections sits near the top of LifeHub's gallery (Nov 25, 2026)", async () => {
  const fs = await import("node:fs");
  const life = fs.readFileSync("client/src/pages/AriseTodo.tsx", "utf8");
  const work = fs.readFileSync("client/src/pages/TeacherHub.tsx", "utf8");
  assert.match(life, /proNow\) \{ setStore\(false\); closeApps\(\); setKitOpen\(`pro:\$\{proNow\}`\)/);
  assert.match(work, /inHubNow\) \{ setStore\(false\); closeApps\(\); setKitOpen\(inHubNow\)/);
  const { MINI_SHELVES } = await import("../shared/pluginStore");
  assert.ok(MINI_SHELVES.life.indexOf("Connections") <= 2, "Google is easy to find in LifeHub");
});

test("A page left open across an update reloads itself instead of showing Something went wrong (Nov 26, 2026)", async () => {
  const fs = await import("node:fs");
  // Now any crash reloads once (client/src/lib/crashReload.ts; tests/error-recovery.test.ts has the details).
  const src = fs.readFileSync("client/src/components/ErrorBoundary.tsx", "utf8");
  assert.match(src, /shouldAutoReload\(location\.hash \|\| location\.pathname, Date\.now\(\)\)/);
});

test("The iPhone app's loading screen and page title say Arise To Do, never To Duo (App Review 5.2.5)", async () => {
  const fs = await import("node:fs");
  for (const f of ["client/todo-loading.html", "client/index.html", "client/public/privacy/index.html", "client/public/terms/index.html"]) {
    assert.ok(!/To Duo/.test(fs.readFileSync(f, "utf8")), f);
  }
});

test("Google Calendar connects from the Calendar page itself, and its events show in the calendar (Nov 26, 2026)", async () => {
  const { googleEventsForCalendar } = await import("../shared/googleConnect");
  const at = new Date(2026, 11, 8, 9, 30), end = new Date(2026, 11, 8, 10, 15);
  const got = googleEventsForCalendar([
    { id: "1", title: "Birthday", start: "2026-12-08", end: "2026-12-09", allDay: true, link: "https://g/1" },
    { id: "2", title: "Meeting", start: at.toISOString(), end: end.toISOString(), allDay: false, link: "" },
    { id: "3", title: "Broken", start: "", end: "", allDay: false, link: "" },
  ]);
  assert.deepEqual(got.map((e) => [e.title, e.date, e.start, e.end]), [["Birthday", "2026-12-08", "", ""], ["Meeting", "2026-12-08", "09:30", "10:15"]]);
  const fs = await import("node:fs");
  const cal = fs.readFileSync("client/src/components/family-hub/FamilyCalendar.tsx", "utf8");
  assert.match(cal, /data-testid="calendar-google"/);
  assert.match(cal, /connectGoogle\(token, "calendar"/);
  const server = fs.readFileSync("server/googleConnect.ts", "utf8");
  assert.match(server, /arisetodo:\/\/open\?s=calendar/, "Safari's Connected page goes straight back to the app");
  const card = fs.readFileSync("client/src/components/teacher-hub/HubGoogle.tsx", "utf8");
  assert.match(card, /\/Safari\/\.test\(n\) \? "" : n/, "'Finish in Safari' goes away once connected");
});

test("every Google card is given its hub's to-dos (WorkHub's Tasks page broke without them)", () => {

  const files = ["client/src/pages/TeacherHub.tsx", "client/src/components/duo/GooglePlugin.tsx"];
  for (const f of files) for (const m of readFileSync(f, "utf8").matchAll(/<GoogleCard [^>]*\/>/g)) assert.match(m[0], /bridge=\{/, f);
  assert.match(readFileSync("client/src/components/teacher-hub/HubGoogle.tsx", "utf8"), /if \(!status \|\| !bridge\) return null;/);
});
