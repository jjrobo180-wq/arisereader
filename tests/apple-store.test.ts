// Arise All Access bought in an iPhone app: Apple-signed purchases are checked (server/appleStore.ts)
// and turn into the account's All Access plan; Apple's renewal and refund notices keep it right.
// The chain in tests/fixtures is made up (shaped like Apple's); Apple's real root is pinned by fingerprint.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createPrivateKey, sign, X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { APPLE_ROOT_G3_SHA256, AppleVerifyError, allAccessProductOf, isAllAccessProduct, verifyAppleJws } from "../server/appleStore";
import { registerPlanRoutes } from "../server/plans";
import { grantLive } from "../shared/plans";

const CHAIN = JSON.parse(readFileSync("tests/fixtures/apple-test-chain.json", "utf8"));
const ROOT = createHash("sha256").update(new X509Certificate(Buffer.from(CHAIN.x5c[2], "base64")).raw).digest("hex").toUpperCase();
const KEY = createPrivateKey(CHAIN.leafKey);
const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jws(payload: unknown, x5c: string[] = CHAIN.x5c) {
  const head = enc({ alg: "ES256", x5c });
  const body = enc(payload);
  return `${head}.${body}.${sign("sha256", Buffer.from(`${head}.${body}`), { key: KEY, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}
const NOW = Date.parse("2026-12-01T18:00:00Z"); // after the test chain was made
const DAY = 86_400_000;
const BUNDLE = "com.arisereader.arisetodo";
const tx = (o: any = {}) => ({ bundleId: BUNDLE, productId: allAccessProductOf(BUNDLE), originalTransactionId: "2000000111", transactionId: "2000000111", purchaseDate: NOW, signedDate: NOW, expiresDate: NOW + 30 * DAY, environment: "Sandbox", ...o });

test("Apple's root is pinned, and only a properly signed chain is believed", () => {
  assert.equal(APPLE_ROOT_G3_SHA256.length, 64);
  const t = tx();
  assert.deepEqual(verifyAppleJws(jws(t), { now: NOW, rootSha256: ROOT }), t);
  // Not Apple's root (the real pin):
  assert.throws(() => verifyAppleJws(jws(t), { now: NOW }), AppleVerifyError);
  // A changed payload:
  const [h, , s] = jws(t).split(".");
  assert.throws(() => verifyAppleJws(`${h}.${enc({ ...t, expiresDate: NOW + 900 * DAY })}.${s}`, { now: NOW, rootSha256: ROOT }), AppleVerifyError);
  // A chain in the wrong order, and junk:
  assert.throws(() => verifyAppleJws(jws(t, [CHAIN.x5c[1], CHAIN.x5c[0], CHAIN.x5c[2]]), { now: NOW, rootSha256: ROOT }), AppleVerifyError);
  assert.throws(() => verifyAppleJws("a.b.c", { now: NOW, rootSha256: ROOT }), AppleVerifyError);
  assert.throws(() => verifyAppleJws(null), AppleVerifyError);
  assert.equal(isAllAccessProduct(BUNDLE, `${BUNDLE}.allaccess.monthly`), true);
  assert.equal(isAllAccessProduct("com.someone.else", "com.someone.else.allaccess.monthly"), false);
});

function setup() {
  const settings = new Map<string, string>();
  let clock = NOW;
  const routes: Record<string, Function[]> = {};
  const app: any = { get: (p: string, ...h: Function[]) => { routes["GET " + p] = h; }, post: (p: string, ...h: Function[]) => { routes["POST " + p] = h; }, use: () => {} };
  const USERS: Record<number, any> = { 1: { id: 1, role: "student", isAdmin: true }, 90: { id: 90, role: "todo" }, 91: { id: 91, role: "todo" } };
  const auth = (req: any, _res: any, next: any) => { req.user = USERS[Number(req.headers.authorization)]; return next(); };
  const plans = registerPlanRoutes(app, auth as any, ((_q: any, _s: any, n: any) => n()) as any, {
    appleVerify: { rootSha256: ROOT },
    getSetting: async (k) => settings.get(k) ?? "", upsertSetting: async (k, v) => { settings.set(k, v); },
    userForToken: async (t) => USERS[Number(t)] ?? null, getUser: async (id) => USERS[id] ?? null,
    countTeacherStudents: async () => 0, countSchoolStudents: async () => 0, parentChildIds: async () => [], studentParentIds: async () => [], teacherStudentIds: async () => [],
    schoolName: async () => "", envStripeKey: () => "", fetch: (async () => ({ ok: false, json: async () => ({}) })) as any, now: () => clock,
  } as any);
  const call = async (method: string, path: string, who: number | null, body: any = {}) => {
    const req: any = { headers: { authorization: who === null ? "" : String(who) }, body, originalUrl: path };
    const out: any = { status: 200, body: null };
    const res: any = { status(c: number) { out.status = c; return res; }, json(b: any) { out.body = b; return res; }, set() { return res; } };
    const chain = routes[`${method} ${path}`]; assert.ok(chain, "no route " + path);
    let i = 0; const next = async () => { const h = chain[i++]; if (h) await h(req, res, next); }; await next();
    return out;
  };
  return { plans, call, users: USERS, tick: (ms: number) => { clock += ms; } };
}

test("buying in the app turns on All Access for that account, and Apple's notices keep it right", async () => {
  const s = setup();
  const token = (await s.call("GET", "/api/all-access/apple-token", 90)).body.token as string;
  assert.match(token, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal((await s.call("GET", "/api/all-access/apple-token", 90)).body.token, token, "the same token every time");
  assert.equal((await s.call("GET", "/api/all-access/apple-token", 1)).status, 403, "students ask a grown-up (the admin account is a student here)");

  const bought = await s.call("POST", "/api/all-access/apple", 90, { transaction: jws(tx({ appAccountToken: token.toUpperCase() })) });
  assert.equal(bought.status, 200); assert.equal(bought.body.live, true);
  assert.equal((await s.plans.todoUnlimited(s.users[90])).via, "all-access", "To Duo Unlimited comes with it");
  assert.equal((await s.plans.fitPlusOwn(90, s.users[90]))?.plus ?? (await s.plans.allAccess(90, s.users[90])).live, true);

  // Someone else can't use it.
  assert.equal((await s.call("POST", "/api/all-access/apple", 91, { transaction: jws(tx({ appAccountToken: token })) })).status, 403);
  assert.equal((await s.call("POST", "/api/all-access/apple", 91, { transaction: jws(tx()) })).status, 403, "the purchase is already tied to account 90");
  // Not ours, or not signed by Apple.
  assert.equal((await s.call("POST", "/api/all-access/apple", 90, { transaction: jws(tx({ productId: "com.arisereader.arisetodo.other" })) })).status, 400);
  assert.equal((await s.call("POST", "/api/all-access/apple", 90, { transaction: "x.y.z" })).status, 400);

  // A renewal from Apple, then a refund.
  const notice = (t: any, type: string) => ({ signedPayload: jws({ notificationType: type, data: { bundleId: BUNDLE, signedTransactionInfo: jws(t) } }) });
  s.tick(31 * DAY);
  assert.equal((await s.plans.allAccess(90, s.users[90])).live, false, "Apple plans end on time, with no extra days");
  assert.equal((await s.call("POST", "/api/apple/notifications", null, notice(tx({ transactionId: "2000000222", signedDate: NOW + 31 * DAY, expiresDate: NOW + 61 * DAY }), "DID_RENEW"))).status, 200);
  assert.equal((await s.plans.allAccess(90, s.users[90])).live, true, "renewed");
  await s.call("POST", "/api/apple/notifications", null, notice(tx({ transactionId: "2000000222", signedDate: NOW + 32 * DAY, expiresDate: NOW + 61 * DAY, revocationDate: NOW + 32 * DAY }), "REFUND"));
  const g = (await s.plans.allAccess(90, s.users[90])).grant;
  assert.equal(g?.source, "apple"); assert.equal(grantLive(g, NOW + 33 * DAY), false, "refunded: ended");
  // Fake notices are turned away.
  assert.equal((await s.call("POST", "/api/apple/notifications", null, { signedPayload: "nope" })).status, 400);
});
