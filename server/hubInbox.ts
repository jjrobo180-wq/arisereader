// Teacher Hub: emails forwarded in (shared/hubInbox.ts).
//
// The email service (Resend) receives mail for the site's receiving domain and calls the webhook below
// for each one. The webhook checks the call really came from Resend, finds whose Hub address it was sent
// to, checks the sender is one the teacher accepts, fetches the email's words, and keeps it waiting for
// that teacher's Hub to pick up.
import type { Express, RequestHandler } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { addressOf, cleanBody, senderLabel, cleanSenders, cleanSubject, inboxAddress, newInboxToken, originalSender, readInbox, tokenFor, type InboxItem } from "../shared/hubInbox";

export const INBOX_CONFIG_KEY = "hub_inbox_config";
export const INBOX_TOKENS_KEY = "hub_inbox_tokens";
export const inboxItemsKey = (teacherId: number) => `hub_inbox_items_${teacherId}`;
export const inboxSendersKey = (teacherId: number) => `hub_inbox_senders_${teacherId}`;

/** apiKey: a Resend key allowed to read received emails ("Full access"). Without it, the site's own email key is used. */
export type InboxConfig = { domain: string; secret: string; apiKey?: string };
export type ReceivedEmail = { from?: string; subject?: string; text?: string | null; html?: string | null; authentication?: { spf?: string; dkim?: string; dmarc?: string } | null };

export type HubInboxDeps = {
  getSetting(key: string): Promise<string | null | undefined>;
  saveSetting(key: string, value: string): Promise<unknown>;
  /** The email's words, from the email service (the webhook only says that an email came). Throws with the reason when it can't. */
  fetchReceived(emailId: string, apiKey?: string): Promise<ReceivedEmail | null>;
  /** A teacher's account email, the first sender they accept. */
  accountEmail(teacherId: number): Promise<string | null>;
  now(): number;
  random?(n: number): Uint8Array;
};

const DOMAIN = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const API_KEY = /^re_[A-Za-z0-9_-]{10,200}$/;
export function readConfig(raw: unknown): InboxConfig {
  let data: any = raw;
  if (typeof raw === "string") { try { data = JSON.parse(raw); } catch { data = null; } }
  // Resend shows the receiving address as "<anything>@abc123.resend.app": whatever was pasted, the domain is the part after the last "@".
  const domain = String(data?.domain || "").trim().toLowerCase().replace(/^mailto:/, "").split("@").pop()!.replace(/[<>\s"'/]+/g, "").replace(/\.+$/, "");
  const secret = String(data?.secret || "").trim();
  const apiKey = String(data?.apiKey || "").trim();
  return { domain: DOMAIN.test(domain) ? domain : "", secret: /^whsec_[A-Za-z0-9+/=]{16,}$/.test(secret) ? secret : "", ...(API_KEY.test(apiKey) ? { apiKey } : {}) };
}

// ─── Is the call really from the email service? ────────────────────────────
// Resend signs its webhook calls the Svix way: an HMAC-SHA256 of "id.timestamp.body", keyed with the
// base64 part of the "whsec_..." secret, sent as "v1,<base64>" (several may be listed, space-separated).

export const SIGNATURE_TOLERANCE_S = 5 * 60;
export function verifyWebhook(secret: string, headers: Record<string, unknown>, rawBody: Buffer | string, nowMs: number): boolean {
  const id = String(headers["svix-id"] ?? ""), timestamp = String(headers["svix-timestamp"] ?? ""), signatures = String(headers["svix-signature"] ?? "");
  if (!secret.startsWith("whsec_") || !id || !/^\d{1,12}$/.test(timestamp) || !signatures) return false;
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > SIGNATURE_TOLERANCE_S) return false;
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.`).update(typeof rawBody === "string" ? Buffer.from(rawBody) : rawBody).digest();
  return signatures.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

// ─── Addresses ─────────────────────────────────────────────────────────────

type Tokens = Record<string, number>;
async function readTokens(deps: HubInboxDeps): Promise<Tokens> {
  try {
    const data = JSON.parse((await deps.getSetting(INBOX_TOKENS_KEY)) || "{}");
    return Object.fromEntries(Object.entries(data).filter(([t, id]) => /^[a-z0-9]{6,32}$/.test(t) && Number.isSafeInteger(Number(id)) && Number(id) > 0).map(([t, id]) => [t, Number(id)]));
  } catch { return {}; }
}
const tokenOf = (tokens: Tokens, teacherId: number) => Object.entries(tokens).find(([, id]) => id === teacherId)?.[0] || null;

/** Gives a teacher a new address. The old one stops working at once. */
export async function newAddress(deps: HubInboxDeps, teacherId: number): Promise<string> {
  const tokens = await readTokens(deps);
  for (const [t, id] of Object.entries(tokens)) if (id === teacherId) delete tokens[t];
  let token = "";
  do token = newInboxToken(deps.random ?? ((n) => randomBytes(n))); while (tokens[token]);
  tokens[token] = teacherId;
  await deps.saveSetting(INBOX_TOKENS_KEY, JSON.stringify(tokens));
  return token;
}

type Senders = { senders: string[]; anyone: boolean };
async function readSenders(deps: HubInboxDeps, teacherId: number): Promise<Senders> {
  let data: any = null;
  try { data = JSON.parse((await deps.getSetting(inboxSendersKey(teacherId))) || "null"); } catch { data = null; }
  if (data && Array.isArray(data.senders)) return { senders: cleanSenders(data.senders), anyone: data.anyone === true };
  // Until the teacher sets them, mail is accepted from their own account email.
  const own = addressOf(await deps.accountEmail(teacherId));
  return { senders: own ? [own] : [], anyone: false };
}

// ─── The webhook ───────────────────────────────────────────────────────────

export type WebhookResult = { status: number; kept: number; note: string };

/**
 * Handles one "email.received" call. Anything that isn't for a Hub address, is from a sender the teacher
 * doesn't accept, or fails the sender checks is dropped, but still answered with 200, so the email service
 * doesn't keep retrying it. A bad signature is refused.
 */
export async function receiveWebhook(deps: HubInboxDeps, headers: Record<string, unknown>, rawBody: Buffer | string | undefined): Promise<WebhookResult> {
  const config = readConfig(await deps.getSetting(INBOX_CONFIG_KEY));
  if (!config.domain || !config.secret) return { status: 503, kept: 0, note: "not set up" };
  if (!rawBody || !verifyWebhook(config.secret, headers, rawBody, deps.now())) return { status: 401, kept: 0, note: "bad signature" };
  let event: any;
  try { event = JSON.parse(String(rawBody)); } catch { return { status: 400, kept: 0, note: "not json" }; }
  if (event?.type !== "email.received") return { status: 200, kept: 0, note: "ignored" };
  const data = event.data || {};
  const emailId = String(data.email_id || data.id || "");
  if (!/^[\w-]{1,80}$/.test(emailId)) return { status: 200, kept: 0, note: "no id" };
  const recipients = [...(Array.isArray(data.to) ? data.to : [data.to]), ...(Array.isArray(data.received_for) ? data.received_for : [])];
  const tokens = await readTokens(deps);
  const teachers = Array.from(new Set(recipients.map((r) => tokenFor(r, config.domain)).filter((t): t is string => !!t).map((t) => tokens[t]).filter((id): id is number => !!id)));
  if (!teachers.length) return { status: 200, kept: 0, note: "not a hub address" };

  const from = addressOf(data.from);
  let mail: ReceivedEmail | null = null;
  let kept = 0;
  for (const teacherId of teachers) {
    const allowed = await readSenders(deps, teacherId);
    if (!allowed.anyone && !allowed.senders.includes(from)) continue;
    if (!mail) {
      let why = "";
      try { mail = await deps.fetchReceived(emailId, config.apiKey); } catch (error: any) { why = String(error?.message || "").slice(0, 300); }
      // The email service will try again, so once the reason is fixed the email still arrives.
      if (!mail) return { status: 502, kept, note: `could not fetch the email${why ? `: ${why}` : ""}` };
    }
    // A sender that fails the email checks may be someone pretending to be the teacher.
    if (String(mail.authentication?.dmarc || "").toLowerCase() === "fail") continue;
    const body = cleanBody(mail.text, mail.html);
    const item: InboxItem = { id: `fwd-${emailId}`, from: senderLabel(originalSender(body) || mail.from || data.from || from), subject: cleanSubject(mail.subject ?? data.subject), body, receivedAt: new Date(deps.now()).toISOString() };
    const list = readInbox(await deps.getSetting(inboxItemsKey(teacherId)));
    if (list.some((x) => x.id === item.id)) continue;
    await deps.saveSetting(inboxItemsKey(teacherId), JSON.stringify(readInbox(JSON.stringify([item, ...list]))));
    kept++;
  }
  return { status: 200, kept, note: kept ? "kept" : "sender not accepted" };
}

// ─── Routes ────────────────────────────────────────────────────────────────

export type Gate = (req: any, res: any) => Promise<boolean>;

export function registerHubInboxRoutes(app: Express, auth: RequestHandler, deps: HubInboxDeps & { gate: Gate }): void {
  const fail = (res: any, error: any) => { console.error("[hub-inbox] failed:", error?.message); res.status(500).json({ message: "That did not work. Please try again." }); };

  app.post("/api/hub-inbox/webhook", async (req: any, res) => {
    try {
      const r = await receiveWebhook(deps, req.headers || {}, req.rawBody);
      if (r.kept) console.log(`[hub-inbox] kept ${r.kept} forwarded email(s)`);
      res.status(r.status).json({ ok: r.status === 200, note: r.note });
    } catch (error) { fail(res, error); }
  });

  /** The teacher's address, who they accept mail from, and the forwarded emails waiting for their Hub. */
  app.get("/api/teacher-hub/inbox", auth, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    try {
      const teacherId = Number(req.user.id);
      const config = readConfig(await deps.getSetting(INBOX_CONFIG_KEY));
      const token = tokenOf(await readTokens(deps), teacherId);
      const allowed = await readSenders(deps, teacherId);
      const waiting = readInbox(await deps.getSetting(inboxItemsKey(teacherId))).filter((x) => !x.taken);
      res.set("Cache-Control", "no-store").json({ ready: !!(config.domain && config.secret), address: config.domain && token ? inboxAddress(token, config.domain) : null, ...allowed, waiting });
    } catch (error) { fail(res, error); }
  });

  app.post("/api/teacher-hub/inbox/address", auth, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    try {
      const config = readConfig(await deps.getSetting(INBOX_CONFIG_KEY));
      if (!config.domain) return res.status(503).json({ message: "Forwarding isn't set up on the site yet." });
      const token = await newAddress(deps, Number(req.user.id));
      res.json({ address: inboxAddress(token, config.domain) });
    } catch (error) { fail(res, error); }
  });

  app.put("/api/teacher-hub/inbox/senders", auth, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    try {
      const value = { senders: cleanSenders(req.body?.senders), anyone: req.body?.anyone === true };
      await deps.saveSetting(inboxSendersKey(Number(req.user.id)), JSON.stringify(value));
      res.json(value);
    } catch (error) { fail(res, error); }
  });

  /** The Hub took these into the workspace: they stop being offered. They are kept a while, marked taken. */
  app.post("/api/teacher-hub/inbox/taken", auth, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    try {
      const ids = new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(String));
      const key = inboxItemsKey(Number(req.user.id));
      const list = readInbox(await deps.getSetting(key)).map((x) => (ids.has(x.id) ? { ...x, taken: true } : x));
      await deps.saveSetting(key, JSON.stringify(list));
      res.json({ ok: true });
    } catch (error) { fail(res, error); }
  });

  // The admin sets the receiving domain and the webhook's signing secret once. The secret is never sent back.
  app.get("/api/admin/hub-inbox", auth, async (req: any, res) => {
    if (!req.user?.isAdmin) return res.status(403).json({ message: "Admin access required." });
    try {
      const config = readConfig(await deps.getSetting(INBOX_CONFIG_KEY));
      res.set("Cache-Control", "no-store").json({ domain: config.domain, secretSet: !!config.secret, apiKeySet: !!config.apiKey });
    } catch (error) { fail(res, error); }
  });
  app.put("/api/admin/hub-inbox", auth, async (req: any, res) => {
    if (!req.user?.isAdmin) return res.status(403).json({ message: "Admin access required." });
    try {
      const old = readConfig(await deps.getSetting(INBOX_CONFIG_KEY));
      const typed = readConfig({ domain: req.body?.domain, secret: req.body?.secret, apiKey: req.body?.apiKey });
      if (String(req.body?.domain || "").trim() && !typed.domain) return res.status(400).json({ message: "That doesn't look like a domain. It looks like abc123.resend.app." });
      if (String(req.body?.secret || "").trim() && !typed.secret) return res.status(400).json({ message: "That doesn't look like a webhook signing secret. It starts with whsec_." });
      if (String(req.body?.apiKey || "").trim() && !typed.apiKey) return res.status(400).json({ message: "That doesn't look like a Resend API key. It starts with re_." });
      const apiKey = typed.apiKey || old.apiKey;
      const next = { domain: typed.domain || old.domain, secret: typed.secret || old.secret, ...(apiKey ? { apiKey } : {}) };
      await deps.saveSetting(INBOX_CONFIG_KEY, JSON.stringify(next));
      res.json({ domain: next.domain, secretSet: !!next.secret, apiKeySet: !!apiKey, message: next.domain && next.secret ? "Saved. Teachers can now get their forwarding address in the Hub." : "Saved." });
    } catch (error) { fail(res, error); }
  });
}
