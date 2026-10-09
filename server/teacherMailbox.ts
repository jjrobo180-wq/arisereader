// A teacher's own mailbox (Gmail or Outlook), connected with the provider's normal "Allow this app" screen.
// Poll emails can then go out from the teacher's real address and land in their Sent folder.
//
// The site only asks permission to SEND mail (never to read it). It keeps one long-lived
// "refresh token", encrypted, and trades it for a short-lived pass each time it sends.
import crypto from "node:crypto";
import type { Express, RequestHandler } from "express";
import { emailDocument } from "./emailFormat";

export type Provider = "google" | "microsoft";
export const PROVIDERS: readonly Provider[] = ["google", "microsoft"];
export type MailboxRow = { teacher_id: number; provider: Provider; email: string; display_name: string; refresh_token: string; needs_reconnect: boolean };

export interface MailboxStore {
  get(teacherId: number): Promise<MailboxRow | null>;
  save(row: MailboxRow): Promise<void>;
  setRefresh(teacherId: number, refreshToken: string): Promise<void>;
  flag(teacherId: number, needsReconnect: boolean): Promise<void>;
  remove(teacherId: number): Promise<void>;
}

export function createSupabaseMailboxStore(): MailboxStore {
  const db = async () => (await import("./supabase")).supabase;
  const fail = (error: any) => { if (error) throw error; };
  return {
    async get(teacherId) {
      const r = await (await db()).from("teacher_mailboxes").select("*").eq("teacher_id", teacherId).maybeSingle();
      fail(r.error);
      return (r.data as MailboxRow) ?? null;
    },
    async save(row) { fail((await (await db()).from("teacher_mailboxes").upsert({ ...row, connected_at: new Date().toISOString() }, { onConflict: "teacher_id" })).error); },
    async setRefresh(teacherId, token) { fail((await (await db()).from("teacher_mailboxes").update({ refresh_token: token }).eq("teacher_id", teacherId)).error); },
    async flag(teacherId, needs) { fail((await (await db()).from("teacher_mailboxes").update({ needs_reconnect: needs }).eq("teacher_id", teacherId)).error); },
    async remove(teacherId) { fail((await (await db()).from("teacher_mailboxes").delete().eq("teacher_id", teacherId)).error); },
  };
}

export function createMemoryMailboxStore(): MailboxStore & { rows: Map<number, MailboxRow> } {
  const rows = new Map<number, MailboxRow>();
  return {
    rows,
    async get(id) { const r = rows.get(id); return r ? { ...r } : null; },
    async save(row) { rows.set(row.teacher_id, { ...row }); },
    async setRefresh(id, token) { const r = rows.get(id); if (r) r.refresh_token = token; },
    async flag(id, needs) { const r = rows.get(id); if (r) r.needs_reconnect = needs; },
    async remove(id) { rows.delete(id); },
  };
}

// ---- Secrets -------------------------------------------------------------

/** The key that locks saved tokens: MAILBOX_ENCRYPTION_KEY if set, else one made from a secret the server already has. */
export function secretKey(env: Record<string, string | undefined> = process.env): Buffer {
  const source = env.MAILBOX_ENCRYPTION_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!source) throw new Error("No secret available to protect mailbox tokens");
  return Buffer.from(crypto.hkdfSync("sha256", source, "arise-mailbox", "teacher-mailbox-v1", 32));
}

export function encryptSecret(text: string, key: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return `v1.${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url")}`;
}

export function decryptSecret(value: string, key: Buffer): string {
  if (!value.startsWith("v1.")) throw new Error("Unknown token format");
  const raw = Buffer.from(value.slice(3), "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

/** A signed, expiring note carried through the provider's screen, so the callback knows who is coming back. */
export function signState(payload: { teacherId: number; provider: Provider }, key: Buffer, nowMs = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ t: payload.teacherId, p: payload.provider, e: nowMs + 15 * 60_000, n: crypto.randomBytes(8).toString("hex") })).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", key).update(body).digest("base64url")}`;
}

export function verifyState(state: string, key: Buffer, nowMs = Date.now()): { teacherId: number; provider: Provider } | null {
  const [body, mac] = String(state || "").split(".");
  if (!body || !mac) return null;
  const expected = crypto.createHmac("sha256", key).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!(data.e > nowMs) || !PROVIDERS.includes(data.p) || !Number.isInteger(data.t)) return null;
    return { teacherId: data.t, provider: data.p };
  } catch { return null; }
}

// ---- Providers -------------------------------------------------------------

export type OAuthConfig = { clientId: string; clientSecret: string };
export type MailboxConfig = Partial<Record<Provider, OAuthConfig>>;

export function configFromEnv(env: Record<string, string | undefined> = process.env): MailboxConfig {
  const out: MailboxConfig = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) out.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
  if (env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) out.microsoft = { clientId: env.MICROSOFT_CLIENT_ID, clientSecret: env.MICROSOFT_CLIENT_SECRET };
  return out;
}

const GOOGLE = {
  auth: "https://accounts.google.com/o/oauth2/v2/auth",
  token: "https://oauth2.googleapis.com/token",
  userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
  revoke: "https://oauth2.googleapis.com/revoke",
  send: "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
  scope: "openid email profile https://www.googleapis.com/auth/gmail.send",
};
const MICROSOFT = {
  auth: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  token: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  me: "https://graph.microsoft.com/v1.0/me",
  send: "https://graph.microsoft.com/v1.0/me/sendMail",
  scope: "offline_access openid email profile User.Read Mail.Send",
};

export const redirectUri = (appUrl: string, provider: Provider) => `${appUrl.replace(/\/+$/, "")}/api/mailbox/callback/${provider}`;

export function authorizeUrl(provider: Provider, cfg: OAuthConfig, appUrl: string, state: string): string {
  const params = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: redirectUri(appUrl, provider), response_type: "code", state });
  if (provider === "google") {
    params.set("scope", GOOGLE.scope); params.set("access_type", "offline"); params.set("prompt", "consent");
    return `${GOOGLE.auth}?${params}`;
  }
  params.set("scope", MICROSOFT.scope); params.set("response_mode", "query"); params.set("prompt", "select_account");
  return `${MICROSOFT.auth}?${params}`;
}

export class MailboxError extends Error {
  constructor(message: string, readonly reconnect = false) { super(message); }
}

type Fetch = typeof fetch;
const form = (data: Record<string, string>) => ({ method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(data).toString(), signal: AbortSignal.timeout(15_000) } as const);

async function readJson(res: Response) { return (await res.json().catch(() => ({}))) as any; }

/** Trades the code from the provider's screen for tokens and finds out whose mailbox it is. */
export async function finishConnect(provider: Provider, cfg: OAuthConfig, appUrl: string, code: string, fetchImpl: Fetch = fetch): Promise<{ refreshToken: string; email: string; name: string }> {
  const url = provider === "google" ? GOOGLE.token : MICROSOFT.token;
  const res = await fetchImpl(url, form({ code, client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: redirectUri(appUrl, provider), grant_type: "authorization_code", ...(provider === "microsoft" ? { scope: MICROSOFT.scope } : {}) }));
  const tokens = await readJson(res);
  if (!res.ok || !tokens.access_token) throw new MailboxError(tokens.error_description || tokens.error || "The sign-in did not finish");
  if (!tokens.refresh_token) throw new MailboxError("The mailbox did not allow the site to keep sending. Try connecting again and tick every box.");
  const info = await readJson(await fetchImpl(provider === "google" ? GOOGLE.userinfo : MICROSOFT.me, { headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(15_000) }));
  const email = String(provider === "google" ? info.email : info.mail || info.userPrincipalName || "").trim().toLowerCase();
  if (!email) throw new MailboxError("Could not tell which email address that is");
  if (provider === "google" && info.email_verified === false) throw new MailboxError("That Google address is not verified");
  return { refreshToken: String(tokens.refresh_token), email, name: String((provider === "google" ? info.name : info.displayName) || "").slice(0, 80) };
}

/** A short-lived pass for sending. Microsoft may hand back a newer refresh token, which the caller keeps. */
export async function refreshAccess(provider: Provider, cfg: OAuthConfig, refreshToken: string, fetchImpl: Fetch = fetch): Promise<{ accessToken: string; expiresInSec: number; newRefreshToken?: string }> {
  const res = await fetchImpl(provider === "google" ? GOOGLE.token : MICROSOFT.token, form({ client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token", ...(provider === "microsoft" ? { scope: MICROSOFT.scope } : {}) }));
  const data = await readJson(res);
  if (!res.ok || !data.access_token) {
    const gone = data.error === "invalid_grant" || data.error === "interaction_required" || res.status === 400 || res.status === 401;
    throw new MailboxError(data.error_description || data.error || "Could not reach the mailbox", gone);
  }
  return { accessToken: String(data.access_token), expiresInSec: Number(data.expires_in) || 3000, newRefreshToken: data.refresh_token ? String(data.refresh_token) : undefined };
}

// ---- Building and sending the message --------------------------------------

const mimeWord = (text: string) => (/^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`);
const wrap = (b64: string) => b64.replace(/.{1,76}/g, "$&\r\n").trimEnd();
const stripTags = (html: string) => html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<(br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, "\n").replace(/<li[^>]*>/gi, "• ").replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

/** A complete email message (HTML with a plain-text twin), ready for the Gmail API. */
export function buildMime(m: { fromName: string; fromEmail: string; to: string; subject: string; html: string }): string {
  const boundary = `arise_${crypto.randomBytes(12).toString("hex")}`;
  const name = m.fromName.replace(/["<>\r\n]/g, "").trim();
  const clean = (v: string) => v.replace(/[\r\n]+/g, " ");
  return [
    `From: ${name ? `${mimeWord(name) === name ? `"${name}"` : mimeWord(name)} ` : ""}<${clean(m.fromEmail)}>`,
    `To: ${clean(m.to)}`,
    `Subject: ${mimeWord(clean(m.subject))}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap(Buffer.from(stripTags(m.html), "utf8").toString("base64")),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap(Buffer.from(m.html, "utf8").toString("base64")),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

export type MailboxMessage = { to: string; subject: string; html: string; fromName?: string };
export type MailboxSendResult = { sent: boolean; error?: string; reconnect?: boolean };

export function createMailboxService(deps: { store: MailboxStore; config: MailboxConfig; appUrl: string; key: Buffer; fetch?: Fetch; now?: () => number }) {
  const fetchImpl = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const passes = new Map<number, { token: string; until: number }>();

  async function pass(row: MailboxRow, cfg: OAuthConfig) {
    const cached = passes.get(row.teacher_id);
    if (cached && cached.until > now()) return cached.token;
    const fresh = await refreshAccess(row.provider, cfg, decryptSecret(row.refresh_token, deps.key), fetchImpl);
    if (fresh.newRefreshToken) await deps.store.setRefresh(row.teacher_id, encryptSecret(fresh.newRefreshToken, deps.key));
    passes.set(row.teacher_id, { token: fresh.accessToken, until: now() + Math.max(60, fresh.expiresInSec - 120) * 1000 });
    return fresh.accessToken;
  }

  return {
    config: deps.config,

    async status(teacherId: number) {
      const row = await deps.store.get(teacherId);
      return row ? { provider: row.provider, email: row.email, name: row.display_name, needsReconnect: row.needs_reconnect } : null;
    },

    startUrl(teacherId: number, provider: Provider): string | null {
      const cfg = deps.config[provider];
      return cfg ? authorizeUrl(provider, cfg, deps.appUrl, signState({ teacherId, provider }, deps.key, now())) : null;
    },

    async finish(state: string, code: string, expected?: Provider) {
      const who = verifyState(state, deps.key, now());
      if (!who || (expected && who.provider !== expected)) throw new MailboxError("That sign-in took too long or was not started from the Hub. Please try again.");
      const cfg = deps.config[who.provider];
      if (!cfg) throw new MailboxError("That mailbox type is not set up on the site yet.");
      const done = await finishConnect(who.provider, cfg, deps.appUrl, code, fetchImpl);
      await deps.store.save({ teacher_id: who.teacherId, provider: who.provider, email: done.email, display_name: done.name, refresh_token: encryptSecret(done.refreshToken, deps.key), needs_reconnect: false });
      passes.delete(who.teacherId);
      return { provider: who.provider, email: done.email };
    },

    async disconnect(teacherId: number) {
      const row = await deps.store.get(teacherId);
      await deps.store.remove(teacherId);
      passes.delete(teacherId);
      if (row?.provider === "google") {
        // Tell Google too, so the site disappears from the teacher's "apps with access" list.
        try { await fetchImpl(GOOGLE.revoke, form({ token: decryptSecret(row.refresh_token, deps.key) })); } catch { /* best effort */ }
      }
    },

    /** Sends from the teacher's own mailbox. Never throws: the caller decides what to do when it can't. */
    async send(teacherId: number, message: MailboxMessage): Promise<MailboxSendResult> {
      try {
        const row = await deps.store.get(teacherId);
        if (!row) return { sent: false, error: "No mailbox is connected", reconnect: true };
        const cfg = deps.config[row.provider];
        if (!cfg) return { sent: false, error: "That mailbox type is not set up on the site" };
        const html = emailDocument(message.subject, message.html, deps.appUrl);
        let token: string;
        try { token = await pass(row, cfg); } catch (error: any) {
          if (error instanceof MailboxError && error.reconnect) await deps.store.flag(teacherId, true).catch(() => {});
          return { sent: false, error: error?.message || "Could not reach the mailbox", reconnect: error instanceof MailboxError && error.reconnect };
        }
        const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        const res = row.provider === "google"
          ? await fetchImpl(GOOGLE.send, { method: "POST", headers, body: JSON.stringify({ raw: Buffer.from(buildMime({ fromName: message.fromName || row.display_name, fromEmail: row.email, to: message.to, subject: message.subject, html })).toString("base64url") }), signal: AbortSignal.timeout(20_000) })
          : await fetchImpl(MICROSOFT.send, { method: "POST", headers, body: JSON.stringify({ message: { subject: message.subject, body: { contentType: "HTML", content: html }, toRecipients: [{ emailAddress: { address: message.to } }] }, saveToSentItems: true }), signal: AbortSignal.timeout(20_000) });
        if (res.ok) return { sent: true };
        const detail = await readJson(res);
        if (res.status === 401) { passes.delete(teacherId); }
        const text = String(detail?.error?.message || detail?.error_description || `Mail service answered ${res.status}`).slice(0, 300);
        const reconnect = res.status === 401 || res.status === 403;
        if (reconnect) await deps.store.flag(teacherId, true).catch(() => {});
        return { sent: false, error: text, reconnect };
      } catch (error: any) {
        return { sent: false, error: error?.name === "TimeoutError" ? "The mail service didn't answer in time" : String(error?.message || error) };
      }
    },
  };
}
export type MailboxService = ReturnType<typeof createMailboxService>;

// ---- Routes -------------------------------------------------------------

export function registerMailboxRoutes(app: Express, authMiddleware: RequestHandler, deps: { gate(req: any, res: any): Promise<unknown | null>; service: MailboxService; appUrl: string }) {
  const base = deps.appUrl.replace(/\/+$/, "");
  const back = (result: string) => `${base}/?mailbox=${encodeURIComponent(result)}#/workhub`;

  app.get("/api/teacher-hub/mailbox", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    res.set("Cache-Control", "no-store");
    try {
      res.json({ connected: await deps.service.status(Number(req.user.id)), available: { google: !!deps.service.config.google, microsoft: !!deps.service.config.microsoft } });
    } catch (error: any) {
      console.error("[mailbox] status failed", error?.message);
      res.status(500).json({ message: "Could not check your mailbox." });
    }
  });

  app.post("/api/teacher-hub/mailbox/start", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    const provider = req.body?.provider as Provider;
    if (!PROVIDERS.includes(provider)) return res.status(400).json({ message: "Pick Google or Microsoft." });
    const url = deps.service.startUrl(Number(req.user.id), provider);
    if (!url) return res.status(503).json({ message: `${provider === "google" ? "Gmail" : "Outlook"} is not set up on the site yet.` });
    res.json({ url });
  });

  app.post("/api/teacher-hub/mailbox/disconnect", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    try { await deps.service.disconnect(Number(req.user.id)); res.json({ ok: true }); }
    catch (error: any) { console.error("[mailbox] disconnect failed", error?.message); res.status(500).json({ message: "Could not disconnect. Try again." }); }
  });

  // The provider sends the teacher's browser back here. No login header can come along, so the signed "state" says who it is.
  for (const provider of PROVIDERS) {
    app.get(`/api/mailbox/callback/${provider}`, async (req: any, res) => {
      res.set("Cache-Control", "no-store");
      if (req.query?.error) return res.redirect(back("cancelled"));
      try {
        await deps.service.finish(String(req.query?.state || ""), String(req.query?.code || ""), provider);
        res.redirect(back("connected"));
      } catch (error: any) {
        if (!(error instanceof MailboxError)) console.error("[mailbox] connect failed", error?.message);
        res.redirect(back(error instanceof MailboxError ? `failed:${error.message.slice(0, 120)}` : "failed"));
      }
    });
  }
}
