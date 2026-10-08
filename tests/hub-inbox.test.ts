// Teacher Hub: work emails forwarded to a teacher's private address land in the Hub, flagged and on the to-do list.
// Run with: npx tsx --test tests/hub-inbox.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { addInboxItems, addressOf, senderLabel, cleanBody, cleanSenders, cleanSubject, htmlToText, inboxAddress, newInboxToken, originalSender, readInbox, tokenFor, INBOX_BODY_MAX, type InboxItem } from "../shared/hubInbox";
import { INBOX_CONFIG_KEY, INBOX_TOKENS_KEY, inboxItemsKey, inboxSendersKey, newAddress, readConfig, receiveWebhook, registerHubInboxRoutes, verifyWebhook, type HubInboxDeps, type ReceivedEmail } from "../server/hubInbox";
import { normalizeWorkspace } from "../shared/teacherHub";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const DOMAIN = "abc123.resend.app";
const SECRET = "whsec_" + Buffer.from("a-very-secret-signing-key-123456").toString("base64");
const NOW = Date.parse("2026-10-08T17:00:00Z");

/** Signs a call the way the email service does. */
function sign(body: string, at = NOW, id = "msg_1", secret = SECRET) {
  const ts = String(Math.floor(at / 1000));
  const sig = createHmac("sha256", Buffer.from(secret.slice(6), "base64")).update(`${id}.${ts}.${body}`).digest("base64");
  return { "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${sig}` };
}
const event = (over: Record<string, unknown> = {}) => JSON.stringify({ type: "email.received", created_at: "2026-10-08T17:00:00Z", data: { email_id: "em_1", from: "Jermaine Robinson <JRobinson@school.org>", to: [`hub-k7m2p9q4rs@${DOMAIN}`], subject: "Fwd: IEP meeting Friday", received_for: [], ...over } });
const FORWARDED = "Please handle.\n\n---------- Forwarded message ---------\nFrom: Ana Rivera <rivera@school.org>\nDate: Wed, Oct 7\nSubject: IEP meeting Friday\n\nCan you bring Dennis's progress data to Friday's IEP meeting?";

function site(start: { email?: ReceivedEmail | null; senders?: unknown; tokens?: Record<string, number>; config?: unknown } = {}) {
  const settings = new Map<string, string>([
    [INBOX_CONFIG_KEY, JSON.stringify(start.config ?? { domain: DOMAIN, secret: SECRET })],
    [INBOX_TOKENS_KEY, JSON.stringify(start.tokens ?? { k7m2p9q4rs: 7 })],
  ]);
  if (start.senders !== undefined) settings.set(inboxSendersKey(7), JSON.stringify(start.senders));
  let fetched = 0;
  const deps: HubInboxDeps = {
    getSetting: async (k) => settings.get(k) ?? "",
    saveSetting: async (k, v) => { settings.set(k, v); },
    fetchReceived: async () => { fetched++; return start.email === undefined ? { from: "Jermaine Robinson <jrobinson@school.org>", subject: "Fwd: IEP meeting Friday", text: FORWARDED, html: null, authentication: { spf: "pass", dkim: "pass", dmarc: "pass" } } : start.email; },
    accountEmail: async (id) => (id === 7 ? "jrobinson@school.org" : null),
    now: () => NOW,
    random: (n) => Uint8Array.from({ length: n }, (_, i) => i * 7 + 3),
  };
  return { deps, settings, items: (id = 7) => readInbox(settings.get(inboxItemsKey(id))), fetched: () => fetched };
}

test("addresses: a private token on the site's receiving domain", () => {
  const token = newInboxToken((n) => Uint8Array.from({ length: n }, (_, i) => i));
  assert.equal(token, "abcdefghjk");
  assert.equal(inboxAddress(token, DOMAIN), `hub-abcdefghjk@${DOMAIN}`);
  assert.equal(tokenFor(`Hub <HUB-K7M2P9Q4RS@ABC123.resend.app>`, DOMAIN), "k7m2p9q4rs");
  for (const other of [`hub-k7m2p9q4rs@other.resend.app`, `k7m2p9q4rs@${DOMAIN}`, `hub-ab@${DOMAIN}`, `hub-k7m2!9q4rs@${DOMAIN}`, "", null]) assert.equal(tokenFor(other, DOMAIN), null, String(other));
  assert.equal(addressOf("Jermaine Robinson <JRobinson@School.org>"), "jrobinson@school.org");
  assert.equal(addressOf("plain@x.org"), "plain@x.org");
  assert.equal(addressOf("no address here"), "");
  assert.deepEqual(cleanSenders(" Me@School.org, me@gmail.com;  me@school.org nope "), ["me@school.org", "me@gmail.com"]);
  assert.deepEqual(readConfig({ domain: " @ABC123.Resend.App ", secret: SECRET }), { domain: DOMAIN, secret: SECRET });
  assert.deepEqual(readConfig({ domain: "not a domain", secret: "nope" }), { domain: "", secret: "" });
  assert.equal(readConfig({ domain: "<anything>@xaaelkeana.resend.app", secret: SECRET }).domain, "xaaelkeana.resend.app");
  assert.equal(readConfig({ domain: "mailto:hi@ABC123.resend.app.", secret: SECRET }).domain, "abc123.resend.app");
});

test("the email is tidied: forwarding marks off the subject, words from HTML, the original sender found", () => {
  assert.equal(cleanSubject("Fwd: FW: Re: IEP meeting"), "Re: IEP meeting");
  assert.equal(cleanSubject("   "), "(no subject)");
  assert.equal(htmlToText('<style>p{}</style><p>Hi&nbsp;there &amp; you</p><ul><li>One</li><li>Two</li></ul><br>Bye'), "Hi there & you\n- One\n- Two\n\nBye");
  assert.equal(cleanBody("", "<p>From HTML</p>"), "From HTML");
  assert.ok(cleanBody("x".repeat(INBOX_BODY_MAX + 50), null).endsWith("(The rest of the email was cut off.)"));
  assert.equal(originalSender(FORWARDED), "Ana Rivera <rivera@school.org>", "Gmail");
  assert.equal(originalSender("FYI\n\n________________________________\nFrom: Rivera, Ana [mailto:rivera@school.org]\nSent: Wednesday"), "Rivera, Ana", "Outlook");
  assert.equal(originalSender("Begin forwarded message:\n\nFrom: Ana Rivera <rivera@school.org>\n"), "Ana Rivera <rivera@school.org>", "Apple Mail");
  assert.equal(originalSender("Just a note, nothing forwarded."), null);
  assert.deepEqual([senderLabel("Ana Rivera <rivera@school.org>"), senderLabel('"Rivera, Ana" <rivera@school.org>'), senderLabel("rivera@school.org"), senderLabel("<rivera@school.org>")], ["Ana Rivera", "Rivera, Ana", "rivera@school.org", "rivera@school.org"]);
});

test("forwarded emails go into Emails, flagged, and onto the to-do list, once", () => {
  const items: InboxItem[] = readInbox(JSON.stringify([
    { id: "fwd-2", from: "Ana Rivera <rivera@school.org>", subject: "IEP meeting Friday", body: "Bring data", receivedAt: "2026-10-08T17:00:00Z" },
    { id: "fwd-1", from: "Office", subject: "Field trip forms", body: "Due Monday", receivedAt: "2026-10-08T15:00:00Z" },
    { id: "bad id!", from: "x", subject: "x", body: "x", receivedAt: "2026-10-08T15:00:00Z" },
  ]));
  assert.deepEqual(items.map((x) => x.id), ["fwd-2", "fwd-1"]);
  let ids = 0;
  const start = normalizeWorkspace({ emails: [{ id: "old", from: "a", subject: "b", body: "", action: "", draft: "", date: "2026-10-01" }] });
  const first = addInboxItems(start, items, () => `t${++ids}`, "2026-10-08");
  assert.equal(first.added, 2);
  assert.deepEqual(first.workspace.emails.map((e) => [e.id, e.flagged]), [["fwd-2", true], ["fwd-1", true], ["old", undefined]], "newest on top, both flagged");
  assert.deepEqual(first.workspace.tasks.map((t) => [t.title, t.dueDate, t.emailId]), [["Reply to Office: Field trip forms", "2026-10-08", "fwd-1"], ["Reply to Ana Rivera <rivera@school.org>: IEP meeting Friday", "2026-10-08", "fwd-2"]]);
  const again = addInboxItems(first.workspace, items, () => `t${++ids}`, "2026-10-08");
  assert.deepEqual([again.added, again.workspace.emails.length, again.workspace.tasks.length], [0, 3, 2], "a second open Hub adds nothing twice");
  assert.equal(start.emails.length, 1, "the workspace handed in is not changed");
});

test("only a call really signed by the email service is accepted", () => {
  const body = event();
  assert.equal(verifyWebhook(SECRET, sign(body), body, NOW), true);
  assert.equal(verifyWebhook(SECRET, { ...sign(body), "svix-signature": `v1,bad v1,${sign(body)["svix-signature"].slice(3)}` }, body, NOW), true, "one good signature in the list is enough");
  assert.equal(verifyWebhook(SECRET, sign(body), body + " ", NOW), false, "body changed");
  assert.equal(verifyWebhook(SECRET, sign(body, NOW - 10 * 60_000), body, NOW), false, "too old to trust");
  assert.equal(verifyWebhook(SECRET, sign(body, NOW, "msg_1", "whsec_" + Buffer.from("another-secret-key-0000000000").toString("base64")), body, NOW), false, "another secret");
  assert.equal(verifyWebhook(SECRET, {}, body, NOW), false);
  assert.equal(verifyWebhook("", sign(body), body, NOW), false);
});

test("an email forwarded from the teacher's own address is kept for their Hub, with the original sender", async () => {
  const s = site();
  const body = event();
  const r = await receiveWebhook(s.deps, sign(body), body);
  assert.deepEqual(r, { status: 200, kept: 1, note: "kept" });
  assert.deepEqual(s.items(), [{ id: "fwd-em_1", from: "Ana Rivera", subject: "IEP meeting Friday", body: FORWARDED, receivedAt: new Date(NOW).toISOString() }]);
  // The email service sends the same call again: nothing doubles.
  assert.equal((await receiveWebhook(s.deps, sign(body, NOW, "msg_2"), body)).kept, 0);
  assert.equal(s.items().length, 1);
});

test("what is refused or dropped", async () => {
  const body = event();
  assert.equal((await receiveWebhook(site({ config: {} }).deps, sign(body), body)).status, 503, "not set up");
  assert.equal((await receiveWebhook(site().deps, { ...sign(body), "svix-signature": "v1,AAAA" }, body)).status, 401, "a stranger calling the webhook");
  assert.equal((await receiveWebhook(site().deps, sign(body), undefined)).status, 401);
  const other = JSON.stringify({ type: "email.sent", data: {} });
  assert.deepEqual(await receiveWebhook(site().deps, sign(other), other), { status: 200, kept: 0, note: "ignored" });
  const elsewhere = event({ to: [`someone@${DOMAIN}`] });
  assert.deepEqual(await receiveWebhook(site().deps, sign(elsewhere), elsewhere), { status: 200, kept: 0, note: "not a hub address" });
  const revoked = event({ to: [`hub-oldtoken99@${DOMAIN}`] });
  assert.equal((await receiveWebhook(site().deps, sign(revoked), revoked)).note, "not a hub address", "an address that was replaced stops working");
  // From someone the teacher doesn't accept: dropped, and the email isn't even fetched.
  const stranger = event({ from: "spam@elsewhere.com" });
  const s1 = site();
  assert.deepEqual(await receiveWebhook(s1.deps, sign(stranger), stranger), { status: 200, kept: 0, note: "sender not accepted" });
  assert.equal(s1.fetched(), 0);
  // Pretending to be the teacher: the email checks fail.
  const s2 = site({ email: { from: "jrobinson@school.org", subject: "x", text: "x", authentication: { dmarc: "fail" } } });
  assert.equal((await receiveWebhook(s2.deps, sign(body), body)).kept, 0);
  // The email service can't hand over the email: asked to try again later.
  assert.equal((await receiveWebhook(site({ email: null }).deps, sign(body), body)).status, 502);
});

test("the teacher chooses who forwards are accepted from", async () => {
  const gmail = event({ from: "me@gmail.com" });
  const listed = site({ senders: { senders: ["me@gmail.com"], anyone: false } });
  assert.equal((await receiveWebhook(listed.deps, sign(gmail), gmail)).kept, 1);
  const own = event();
  assert.equal((await receiveWebhook(listed.deps, sign(own), own)).kept, 0, "once they set a list, it is that list");
  const anyone = site({ senders: { senders: [], anyone: true } });
  const auto = event({ from: "principal@school.org" });
  assert.equal((await receiveWebhook(anyone.deps, sign(auto), auto)).kept, 1, "an automatic forwarding rule keeps the original sender");
  // One email to two teachers' addresses goes to both.
  const both = site({ tokens: { k7m2p9q4rs: 7, zz9yy8xx7w: 8 }, senders: { senders: [], anyone: true } });
  both.settings.set(inboxSendersKey(8), JSON.stringify({ senders: [], anyone: true }));
  const two = event({ to: [`hub-k7m2p9q4rs@${DOMAIN}`], received_for: [`hub-zz9yy8xx7w@${DOMAIN}`] });
  assert.equal((await receiveWebhook(both.deps, sign(two), two)).kept, 2);
  assert.equal(both.fetched(), 1, "fetched once");
  assert.deepEqual([both.items(7).length, both.items(8).length], [1, 1]);
});

test("the routes: a new address replaces the old, the senders save, taken emails stop being offered, and the admin's setup", async () => {
  const s = site();
  const routes: Record<string, any> = {};
  const app: any = { get: (p: string, ...h: any[]) => { routes[`GET ${p}`] = h.at(-1); }, put: (p: string, ...h: any[]) => { routes[`PUT ${p}`] = h.at(-1); }, post: (p: string, ...h: any[]) => { routes[`POST ${p}`] = h.at(-1); } };
  let allowed = true;
  registerHubInboxRoutes(app, (() => {}) as any, { ...s.deps, gate: async (_req, res) => { if (!allowed) res.status(403).json({ message: "Hub needed" }); return allowed; } });
  const call = async (key: string, req: any) => { const out: any = { status: 200 }; const res: any = { status: (n: number) => { out.status = n; return res; }, set: () => res, json: (b: unknown) => { out.body = b; return res; } }; await routes[key]({ headers: {}, ...req }, res); return out; };
  const teacher = { user: { id: 7 } };
  const first = await call("GET /api/teacher-hub/inbox", teacher);
  assert.deepEqual(first.body, { ready: true, address: `hub-k7m2p9q4rs@${DOMAIN}`, senders: ["jrobinson@school.org"], anyone: false, waiting: [] }, "until they choose, their own account email is accepted");
  const made = await call("POST /api/teacher-hub/inbox/address", teacher);
  assert.match(made.body.address, new RegExp(`^hub-[a-z2-9]{10}@${DOMAIN.replace(/\./g, "\\.")}$`));
  assert.notEqual(made.body.address, first.body.address);
  assert.equal(Object.values(JSON.parse(s.settings.get(INBOX_TOKENS_KEY)!)).filter((id) => id === 7).length, 1, "one address per teacher");
  const saved = await call("PUT /api/teacher-hub/inbox/senders", { ...teacher, body: { senders: "Me@School.org, me@gmail.com", anyone: false } });
  assert.deepEqual(saved.body, { senders: ["me@school.org", "me@gmail.com"], anyone: false });
  // Waiting emails, then taken.
  s.settings.set(inboxItemsKey(7), JSON.stringify([{ id: "fwd-a", from: "x", subject: "s", body: "b", receivedAt: "2026-10-08T17:00:00Z" }, { id: "fwd-b", from: "y", subject: "t", body: "c", receivedAt: "2026-10-08T16:00:00Z" }]));
  assert.deepEqual((await call("GET /api/teacher-hub/inbox", teacher)).body.waiting.map((x: any) => x.id), ["fwd-a", "fwd-b"]);
  await call("POST /api/teacher-hub/inbox/taken", { ...teacher, body: { ids: ["fwd-a"] } });
  assert.deepEqual((await call("GET /api/teacher-hub/inbox", teacher)).body.waiting.map((x: any) => x.id), ["fwd-b"]);
  assert.equal(s.items().length, 2, "kept a while, marked taken");
  allowed = false;
  assert.equal((await call("GET /api/teacher-hub/inbox", teacher)).status, 403, "only Hub teachers");
  // The admin's setup: checked, and the secret is never sent back.
  assert.equal((await call("GET /api/admin/hub-inbox", teacher)).status, 403);
  const admin = { user: { id: 1, isAdmin: true } };
  assert.deepEqual((await call("GET /api/admin/hub-inbox", admin)).body, { domain: DOMAIN, secretSet: true });
  assert.equal((await call("PUT /api/admin/hub-inbox", { ...admin, body: { domain: "nope", secret: "" } })).status, 400);
  assert.equal((await call("PUT /api/admin/hub-inbox", { ...admin, body: { domain: "", secret: "abc" } })).status, 400);
  const changed = await call("PUT /api/admin/hub-inbox", { ...admin, body: { domain: "xyz789.resend.app", secret: "" } });
  assert.deepEqual([changed.body.domain, changed.body.secretSet], ["xyz789.resend.app", true], "leaving the secret empty keeps the saved one");
  assert.ok(!JSON.stringify(changed.body).includes("whsec_"));
  // The webhook answers.
  const body = event({ to: [`hub-k7m2p9q4rs@xyz789.resend.app`] });
  assert.equal((await call("POST /api/hub-inbox/webhook", { headers: sign(body), rawBody: Buffer.from(body) })).body.note, "not a hub address", "that token was replaced earlier");
});

test("the pieces are connected", () => {
  const hub = read("client/src/pages/TeacherHub.tsx"), routes = read("server/routes.ts"), box = read("client/src/components/teacher-hub/HubInbox.tsx");
  for (const part of ["useHubInbox(loaded && !loadError && !needsPlan && canUseHub, token, workspace, setWorkspace, id, TODAY,", '{tab === "email" && <ForwardingCard token={token} isAdmin={!!user?.isAdmin} />}']) assert.ok(hub.includes(part), part);
  for (const part of ["registerHubInboxRoutes(app, authMiddleware, {", "gate: hubGate,", "/emails/receiving/${encodeURIComponent(emailId)}"]) assert.ok(routes.includes(part), part);
  for (const part of ["https://resend.com/emails", "https://resend.com/webhooks", "/api/hub-inbox/webhook", "Get my forwarding address", "Accept forwards from", "INBOX_CHECK_MS"]) assert.ok(box.includes(part), part);
  assert.ok(read("server/index.ts").includes("req.rawBody = buf;"), "the webhook can check the signature on the exact bytes sent");
});
