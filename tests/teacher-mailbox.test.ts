// Run with: npx tsx --test tests/teacher-mailbox.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  MailboxError, buildMime, createMailboxService, createMemoryMailboxStore, decryptSecret, encryptSecret, registerMailboxRoutes,
  secretKey, signState, verifyState, authorizeUrl, configFromEnv,
} from "../server/teacherMailbox";

const key = secretKey({ MAILBOX_ENCRYPTION_KEY: "a-long-test-secret" });
const config = { google: { clientId: "gid", clientSecret: "gsecret" }, microsoft: { clientId: "mid", clientSecret: "msecret" } };
const APP = "https://www.arisereader.com";

type Call = { url: string; init: any };
/** A pretend internet: answers by address, and remembers what was asked. */
function internet(answers: Record<string, (init: any) => { status?: number; body?: any }>) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: any, init: any = {}) => {
    calls.push({ url: String(url), init });
    const handler = Object.entries(answers).find(([prefix]) => String(url).startsWith(prefix))?.[1];
    if (!handler) return new Response("{}", { status: 404 });
    const r = handler(init);
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

test("saved tokens are locked and can only be opened with the key", () => {
  const locked = encryptSecret("refresh-123", key);
  assert.ok(locked.startsWith("v1.") && !locked.includes("refresh-123"));
  assert.equal(decryptSecret(locked, key), "refresh-123");
  assert.throws(() => decryptSecret(locked, secretKey({ MAILBOX_ENCRYPTION_KEY: "other" })));
  assert.throws(() => secretKey({}));
  assert.notEqual(encryptSecret("refresh-123", key), locked); // fresh randomness each time
});

test("the state note is signed, expires, and can't be edited", () => {
  const state = signState({ teacherId: 7, provider: "google" }, key, 1_000);
  assert.deepEqual(verifyState(state, key, 2_000), { teacherId: 7, provider: "google" });
  assert.equal(verifyState(state, key, 1_000 + 16 * 60_000), null);
  const [body, mac] = state.split(".");
  const forged = Buffer.from(JSON.stringify({ t: 8, p: "google", e: 9e15, n: "x" })).toString("base64url");
  assert.equal(verifyState(`${forged}.${mac}`, key, 2_000), null);
  assert.equal(verifyState(`${body}.`, key, 2_000), null);
  assert.equal(verifyState(state, secretKey({ MAILBOX_ENCRYPTION_KEY: "other" }), 2_000), null);
  assert.equal(verifyState("junk", key), null);
});

test("sign-in addresses ask only to send mail", () => {
  const g = new URL(authorizeUrl("google", config.google, APP, "S"));
  assert.equal(g.origin + g.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(g.searchParams.get("redirect_uri"), `${APP}/api/mailbox/callback/google`);
  assert.equal(g.searchParams.get("scope"), "openid email profile https://www.googleapis.com/auth/gmail.send");
  assert.equal(g.searchParams.get("access_type"), "offline");
  const m = new URL(authorizeUrl("microsoft", config.microsoft, APP + "/", "S"));
  assert.equal(m.searchParams.get("redirect_uri"), `${APP}/api/mailbox/callback/microsoft`);
  assert.match(m.searchParams.get("scope")!, /Mail\.Send/);
  assert.doesNotMatch(m.searchParams.get("scope")! + g.searchParams.get("scope")!, /readonly|Mail\.Read|modify/i);
  assert.deepEqual(Object.keys(configFromEnv({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b", MICROSOFT_CLIENT_ID: "c" })), ["google"]);
});

test("the email message is built correctly, with a plain-text twin and safe headers", () => {
  const mime = buildMime({ fromName: 'Ms. "Rivera"\r\nBcc: x@y.z', fromEmail: "maria@school.org", to: "lee@example.com", subject: "Which times work for Jordan’s meeting?", html: '<p>Hi <b>Lee</b></p><a href="https://x.y/#/meet/abc">Open</a>' });
  const [head] = mime.split("\r\n\r\n");
  assert.match(head, /^From: "Ms\. RiveraBcc: x@y\.z" <maria@school\.org>/);
  assert.ok(!/^Bcc:/m.test(mime));
  assert.match(head, /Subject: =\?UTF-8\?B\?/);
  assert.match(head, /Content-Type: multipart\/alternative/);
  const parts = [...mime.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--/g)].map((m) => Buffer.from(m[1].replace(/\r\n/g, ""), "base64").toString());
  assert.match(parts[0], /Hi Lee/);
  assert.match(parts[0], /Open \(https:\/\/x\.y\/#\/meet\/abc\)/);
  assert.match(parts[1], /<b>Lee<\/b>/);
});

async function connected(fetchImpl: typeof fetch, provider: "google" | "microsoft" = "google") {
  const store = createMemoryMailboxStore();
  let clock = 1_000_000;
  const service = createMailboxService({ store, config, appUrl: APP, key, fetch: fetchImpl, now: () => clock });
  const state = new URL(service.startUrl(7, provider)!).searchParams.get("state")!;
  await service.finish(state, "the-code", provider);
  return { store, service, tick: (ms: number) => { clock += ms; } };
}

test("connecting Google keeps only an encrypted refresh token, and reads whose mailbox it is", async () => {
  const net = internet({
    "https://oauth2.googleapis.com/token": () => ({ body: { access_token: "AT", refresh_token: "RT", expires_in: 3600 } }),
    "https://openidconnect.googleapis.com": () => ({ body: { email: "Maria@School.org", email_verified: true, name: "Maria Rivera" } }),
  });
  const { store, service } = await connected(net.fetchImpl);
  const row = store.rows.get(7)!;
  assert.equal(row.email, "maria@school.org");
  assert.equal(row.display_name, "Maria Rivera");
  assert.ok(row.refresh_token.startsWith("v1.") && !row.refresh_token.includes("RT"));
  assert.equal(decryptSecret(row.refresh_token, key), "RT");
  const body = new URLSearchParams(net.calls[0].init.body);
  assert.equal(body.get("code"), "the-code");
  assert.equal(body.get("redirect_uri"), `${APP}/api/mailbox/callback/google`);
  assert.deepEqual(await service.status(7), { provider: "google", email: "maria@school.org", name: "Maria Rivera", needsReconnect: false });
  assert.equal(await service.status(8), null);
});

test("a sign-in with a wrong state, wrong provider, or no refresh token is refused", async () => {
  const net = internet({
    "https://oauth2.googleapis.com/token": () => ({ body: { access_token: "AT", expires_in: 3600 } }),
    "https://openidconnect.googleapis.com": () => ({ body: { email: "m@s.org" } }),
  });
  const service = createMailboxService({ store: createMemoryMailboxStore(), config, appUrl: APP, key, fetch: net.fetchImpl });
  await assert.rejects(service.finish("forged.state", "c"), MailboxError);
  const state = new URL(service.startUrl(7, "google")!).searchParams.get("state")!;
  await assert.rejects(service.finish(state, "c", "microsoft"), /took too long/);
  await assert.rejects(service.finish(state, "c", "google"), /keep sending/);
  assert.equal(createMailboxService({ store: createMemoryMailboxStore(), config: {}, appUrl: APP, key }).startUrl(7, "google"), null);
});

test("sending through Gmail: the message goes out as the teacher, and the pass is reused", async () => {
  let sends = 0, refreshes = 0;
  const net = internet({
    "https://oauth2.googleapis.com/token": (init) => (new URLSearchParams(init.body).get("grant_type") === "refresh_token" ? (refreshes++, { body: { access_token: "AT2", expires_in: 3600 } }) : { body: { access_token: "AT", refresh_token: "RT", expires_in: 3600 } }),
    "https://openidconnect.googleapis.com": () => ({ body: { email: "maria@school.org", name: "Maria Rivera" } }),
    "https://gmail.googleapis.com": () => (sends++, { body: { id: "m1" } }),
  });
  const { service, tick } = await connected(net.fetchImpl);
  assert.deepEqual(await service.send(7, { to: "lee@example.com", subject: "Hello", html: "<p>Hi</p>", fromName: "Ms. Rivera" }), { sent: true });
  await service.send(7, { to: "b@example.com", subject: "Hello", html: "<p>Hi</p>" });
  assert.equal(refreshes, 1);
  tick(3_600_000);
  await service.send(7, { to: "c@example.com", subject: "Hello", html: "<p>Hi</p>" });
  assert.equal(refreshes, 2);
  const send = net.calls.find((c) => c.url.includes("gmail.googleapis.com"))!;
  assert.equal(send.init.headers.Authorization, "Bearer AT2");
  const mime = Buffer.from(JSON.parse(send.init.body).raw, "base64url").toString();
  assert.match(mime, /^From: "Ms\. Rivera" <maria@school\.org>/);
  assert.match(mime, /To: lee@example\.com/);
  assert.equal(sends, 3);
});

test("sending through Outlook uses Microsoft Graph and keeps a rotated refresh token", async () => {
  let payload: any;
  const net = internet({
    "https://login.microsoftonline.com": (init) => (new URLSearchParams(init.body).get("grant_type") === "refresh_token" ? { body: { access_token: "MAT", refresh_token: "RT-NEW", expires_in: 3600 } } : { body: { access_token: "AT", refresh_token: "RT", expires_in: 3600 } }),
    "https://graph.microsoft.com/v1.0/me/sendMail": (init) => { payload = JSON.parse(init.body); return { status: 202 }; },
    "https://graph.microsoft.com/v1.0/me": () => ({ body: { mail: null, userPrincipalName: "maria@district.k12.us", displayName: "Maria Rivera" } }),
  });
  const { store, service } = await connected(net.fetchImpl, "microsoft");
  assert.equal(store.rows.get(7)!.email, "maria@district.k12.us");
  assert.deepEqual(await service.send(7, { to: "lee@example.com", subject: "Hi", html: "<p>Hi</p>" }), { sent: true });
  assert.equal(payload.message.toRecipients[0].emailAddress.address, "lee@example.com");
  assert.equal(payload.message.body.contentType, "HTML");
  assert.equal(payload.saveToSentItems, true);
  assert.equal(decryptSecret(store.rows.get(7)!.refresh_token, key), "RT-NEW");
});

test("a revoked mailbox is flagged for reconnecting instead of failing silently", async () => {
  let revoked = false;
  const net = internet({
    "https://oauth2.googleapis.com/token": (init) => (new URLSearchParams(init.body).get("grant_type") === "refresh_token" && revoked ? { status: 400, body: { error: "invalid_grant" } } : { body: { access_token: "AT", refresh_token: "RT", expires_in: 3600 } }),
    "https://openidconnect.googleapis.com": () => ({ body: { email: "m@s.org" } }),
  });
  const { service, store } = await connected(net.fetchImpl);
  revoked = true;
  const r = await service.send(7, { to: "a@b.co", subject: "s", html: "<p>x</p>" });
  assert.equal(r.sent, false);
  assert.equal(r.reconnect, true);
  assert.equal((await service.status(7))!.needsReconnect, true);
  assert.equal((await service.send(99, { to: "a@b.co", subject: "s", html: "x" })).reconnect, true);
  assert.ok(store.rows.has(7));
});

test("disconnecting forgets the mailbox and tells Google", async () => {
  const net = internet({
    "https://oauth2.googleapis.com/token": () => ({ body: { access_token: "AT", refresh_token: "RT", expires_in: 3600 } }),
    "https://openidconnect.googleapis.com": () => ({ body: { email: "m@s.org" } }),
    "https://oauth2.googleapis.com/revoke": () => ({}),
  });
  const { service, store } = await connected(net.fetchImpl);
  await service.disconnect(7);
  assert.equal(store.rows.size, 0);
  assert.equal(new URLSearchParams(net.calls.at(-1)!.init.body).get("token"), "RT");
});

test("routes: start, callback back to the Hub, and disconnect", async () => {
  const routes: Record<string, Function> = {};
  const add = (m: string) => (p: string, ...h: Function[]) => { routes[`${m} ${p}`] = h[h.length - 1]; };
  const net = internet({
    "https://oauth2.googleapis.com/token": () => ({ body: { access_token: "AT", refresh_token: "RT", expires_in: 3600 } }),
    "https://openidconnect.googleapis.com": () => ({ body: { email: "m@s.org" } }),
    "https://oauth2.googleapis.com/revoke": () => ({}),
  });
  const service = createMailboxService({ store: createMemoryMailboxStore(), config: { google: config.google }, appUrl: APP, key, fetch: net.fetchImpl });
  registerMailboxRoutes({ get: add("GET"), post: add("POST") } as any, ((_a: any, _b: any, n: any) => n()) as any, { gate: async () => ({}), service, appUrl: APP });
  const call = async (k: string, req: any) => { let code = 200, body: any, redirect = ""; const res: any = { set() { return res; }, status(c: number) { code = c; return res; }, json(d: any) { body = d; return res; }, redirect(u: string) { redirect = u; return res; } }; await routes[k]({ body: {}, query: {}, user: { id: 7 }, ...req }, res); return { code, body, redirect }; };

  assert.deepEqual((await call("GET /api/teacher-hub/mailbox", {})).body, { connected: null, available: { google: true, microsoft: false } });
  assert.equal((await call("POST /api/teacher-hub/mailbox/start", { body: { provider: "microsoft" } })).code, 503);
  assert.equal((await call("POST /api/teacher-hub/mailbox/start", { body: { provider: "yahoo" } })).code, 400);
  const start = await call("POST /api/teacher-hub/mailbox/start", { body: { provider: "google" } });
  const state = new URL(start.body.url).searchParams.get("state")!;
  assert.equal((await call("GET /api/mailbox/callback/google", { query: { state: "bad", code: "c" } })).redirect.startsWith(`${APP}/?mailbox=failed`), true);
  assert.equal((await call("GET /api/mailbox/callback/google", { query: { error: "access_denied" } })).redirect, `${APP}/?mailbox=cancelled#/workhub`);
  assert.equal((await call("GET /api/mailbox/callback/google", { query: { state, code: "c" } })).redirect, `${APP}/?mailbox=connected#/workhub`);
  assert.equal((await call("GET /api/teacher-hub/mailbox", {})).body.connected.email, "m@s.org");
  assert.equal((await call("POST /api/teacher-hub/mailbox/disconnect", {})).code, 200);
  assert.equal((await call("GET /api/teacher-hub/mailbox", {})).body.connected, null);
});
