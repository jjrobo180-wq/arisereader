// A family starts with a parent account, pays, then adds their child. A new parent never gets the
// Reader free, and tapping a plan never leads to making a second account.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readerAccessFor } from "../shared/plans";

const app = readFileSync("client/src/App.tsx", "utf8");
const read = (f: string) => readFileSync(f, "utf8");
const NEW = "2026-11-09T03:33:06Z", NOW = Date.parse("2026-11-09T04:00:00Z");

test("a brand-new parent has no Reader until the family plan is paid", () => {
  assert.equal(readerAccessFor({ id: 838, role: "parent", createdAt: NEW }, { now: NOW }).access, false);
  const paid = { kind: "bundle_family", ownerId: 838, source: "stripe", status: "active", seats: 3, endsAt: "2026-12-09T00:00:00Z", updatedAt: NEW } as any;
  assert.equal(readerAccessFor({ id: 838, role: "parent", createdAt: NEW }, { now: NOW, familyGrants: [paid] }).via, "family-plan");
});

test("the parent and teacher Reader checks the plan first", () => {
  assert.match(app, /<ReaderPlanGate><AriseReader \/><\/ReaderPlanGate>/);
  const gate = app.slice(app.indexOf("function ReaderPlanGate"), app.indexOf("function ProtectedRoute"));
  assert.match(gate, /readerLocked\(plan\)\) return <Redirect to="\/subscribe"/);
});

test("signed out on the plan page: sign in with the same account, never a new one", () => {
  const route = app.slice(app.indexOf('<Route path="/subscribe">'), app.indexOf("</Route>", app.indexOf('<Route path="/subscribe">')));
  assert.match(route, /<SignIn \/>/);
  assert.doesNotMatch(route, /parent-signup/);
  assert.doesNotMatch(read("client/src/pages/Pricing.tsx"), /#\/parent-signup/);
  assert.match(read("client/src/pages/ReaderSubscribe.tsx"), /const SITE = "https:\/\/www\.arisereader\.com\/#\/subscribe"/);
});

test("new home readers start with a parent account", () => {
  assert.match(read("client/src/pages/NativeSignIn.tsx"), /flavor === "reader" \? navigate\("\/parent-signup"\)/);
  assert.match(app, /<Route path="\/register-independent">[\s\S]{0,600}<Redirect to="\/parent-signup" replace \/>/);
  for (const f of ["client/src/pages/SignIn.tsx", "client/src/pages/Login.tsx", "client/src/pages/Register.tsx"]) assert.doesNotMatch(read(f), /navigate\("\/register-independent"\)|path: "\/register-independent"/, f);
});

test("the plan lock runs before every page, including the Reader's own page", () => {
  const routes = app.slice(app.indexOf("function AppRoutes"));
  const lock = routes.indexOf("if (readerPlanLocked");
  assert.ok(lock > 0 && lock < routes.indexOf("if (isReaderPage())"), "checked before /reader is drawn");
  assert.match(routes, /readerLockOn = !!user && !user\.isAdmin && onReaderDomain && !eyeGazerApp/);
});

test("sign-up asks only for name, email and password; Safari opens signed in from the plan button", () => {
  const parent = read("client/src/pages/ParentSignup.tsx");
  assert.doesNotMatch(parent, /parent-username|How would you like to start/);
  assert.match(read("server/routes.ts"), /make one from the email/);
  assert.match(read("server/ariseTodo.ts"), /one is made from the\s*\n?\s*\/\/ email|one is made from the/);
  const nat = read("client/src/pages/NativeSignIn.tsx");
  assert.match(nat, /\(!signingUp \|\| eyeGazer\) && <Field label="Username"/);
  const sub = read("client/src/pages/ReaderSubscribe.tsx");
  assert.match(sub, /\/api\/auth\/web-handoff\/start/);
  assert.match(sub, /\?signin=\$\{d\.code\}/);
  const hand = read("server/adminHandoff.ts");
  assert.match(hand, /web-handoff\/consume[\s\S]{0,200}readerHosts\.has\(host\(req\)\)/, "redeemed on arisereader.com only");
  assert.match(hand, /payTickets\.delete\(code\)/, "one use");
});
