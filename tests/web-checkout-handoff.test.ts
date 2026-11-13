// "Get it on arisetodo.com" from Cooked, Notes and Podster: Safari opens that app's own All Access page,
// already signed in, once. And a deleted account's email can make a new account straight away.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import express from "express";
import http from "node:http";
import { ALL_ACCESS_APPS, allAccessLink } from "../shared/allAccess";
import { issueEmailHandoff, registerAdminHandoffRoutes } from "../server/adminHandoff";

const read = (f: string) => readFileSync(f, "utf8");
const CODE = "a".repeat(64);

test("each app's link opens its own page, signed in when there's a code", () => {
  assert.equal(allAccessLink("fit", CODE), `https://arisetodo.com/app?signin=${CODE}&for=fit#/all-access`);
  assert.equal(allAccessLink("notes"), "https://arisetodo.com/app?for=notes#/all-access");
  assert.equal(allAccessLink("podster", "bad"), "https://arisetodo.com/app?for=podster#/all-access");
  assert.equal(allAccessLink(), "https://arisetodo.com/app#/all-access");
  for (const a of ["fit", "notes", "podster", "todo"] as const) assert.ok(ALL_ACCESS_APPS[a].name && ALL_ACCESS_APPS[a].from);
});

test("the iPhone apps hand the link to Safari once (a second open spent the one-use code)", () => {
  const lib = read("client/src/lib/nativeApp.ts");
  assert.match(lib, /export function openOutside\(url: string\): void \{\s*if \(isNativeApp\(\)\) \{ try \{ window\.open\(url, "_blank"\); \} catch \{[^}]*\} return; \}/);
  const offer = read("client/src/components/AllAccessOffer.tsx");
  assert.match(offer, /openOutside\(allAccessLink\(app, code\)\);/);
  assert.doesNotMatch(offer, /window\.location\.href = url/);
  assert.doesNotMatch(read("client/src/pages/ReaderSubscribe.tsx"), /window\.location\.href = url;/);
  for (const [f, app] of [["client/src/pages/fit/FitPlus.tsx", "fit"], ["client/src/components/arise-notes/SettingsScreen.tsx", "notes"], ["client/src/pages/fit/FitApp.tsx", "fit"], ["client/src/components/arise-notes/NotesApp.tsx", "notes"]] as const) assert.ok(read(f).includes(`app="${app}"`), f);
  const pod = read("podscroll/main.tsx");
  assert.match(pod, /app="podster" handoff=\{podsterHandoff\} isMember=\{podsterMember\}/);
  assert.match(pod, /api\("\/api\/earshot\/account\/web-handoff", \{ method: "POST" \}\)/);
});

test("the page wears the app's colors, and its sign-in is the app's own, with the app's link winning over an old session", () => {
  const app = read("client/src/App.tsx");
  assert.match(app, /\{readHandoffCode\(\) \? <WebHandoff app=\{allAccessFor\(\)\} \/> : user \? <AllAccess \/> : <AllAccessSignIn app=\{allAccessFor\(\)\} \/>\}/);
  assert.match(app, /app === "fit" \|\| app === "notes"[\s\S]{0,200}<NativeSignIn flavor=\{app\} \/>/);
  assert.match(read("client/src/pages/AllAccess.tsx"), /data-testid="all-access-brand" data-app=\{app\}/);
});

async function serve(emailAccount?: (e: string) => Promise<any>) {
  const app = express(); app.use(express.json());
  registerAdminHandoffRoutes(app, (_req: any, _res: any, next: any) => next(), { getSession: async () => null, emailAccount });
  const srv = app.listen(0); await new Promise((r) => srv.once("listening", r));
  const port = (srv.address() as any).port;
  // Sent as arisetodo.com (fetch can't set Host, so a plain request).
  const consume = (code: string) => new Promise<{ status: number; json: () => Promise<any> }>((resolve, reject) => {
    const body = JSON.stringify({ code });
    const req = http.request({ host: "127.0.0.1", port, path: "/api/auth/web-handoff/consume", method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body), host: "arisetodo.com" } }, (res) => {
      let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve({ status: res.statusCode || 0, json: async () => JSON.parse(d || "{}") }));
    });
    req.on("error", reject); req.end(body);
  });
  return { srv, consume };
}

test("a Podster code signs in the Arise account for that email, and survives a double open (not a third minute later)", async () => {
  const seen: string[] = [];
  const { srv, consume } = await serve(async (e) => { seen.push(e); return { user: { id: 7, role: "todo" }, token: "tok" }; });
  try {
    const code = issueEmailHandoff("Pat@Example.com")!;
    const a = await consume(code); assert.equal(a.status, 200); assert.equal((await a.json()).token, "tok");
    const b = await consume(code); assert.equal(b.status, 200, "Safari can be handed the link twice");
    assert.deepEqual(seen, ["pat@example.com"], "the account is looked up once");
    const c = await consume(code); assert.equal(c.status, 200);
    const d = await consume(code); assert.equal(d.status, 401, "at most three times");
    assert.equal((await consume("b".repeat(64))).status, 401);
  } finally { srv.close(); }
});

test("a deleted account's email is free at once; one email, one account for app sign-ups", () => {
  const routes = read("server/routes.ts");
  assert.match(routes, /await archiveProfile\(userId, true, userId\)[^\n]*\n[^\n]*\n\s*await getAdminSupabase\(\)\.from\("users"\)\.update\(\{ email: null, username: `deleted-\$\{userId\}/);
  const todo = read("server/ariseTodo.ts");
  assert.match(todo, /code: "EMAIL_HAS_ACCOUNT"/);
  assert.match(todo, /u\.role === "todo" && u\.account_approved === false\) await getAdminSupabase\(\)\.from\("users"\)\.delete\(\)/);
  assert.match(todo, /const signupLimits = createAttemptLimiter\(\{ max: 30,/);
  assert.match(read("server/podcastAccounts.ts"), /app\.post\(`\$\{P\}\/web-handoff`, gate/);
});
