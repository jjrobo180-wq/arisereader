// Pod+ creator sign-in: an email and a 6-digit code. Listening never needs it; publishing episodes,
// Studio and going live do. An account remembers the device id its profile was made on, so signing
// in on another phone brings the same profile, posts and followers (server/earshot.ts swaps the
// device for the account's on every request that carries the session).
import type { Express, RequestHandler } from "express";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { CODE_MINUTES, CODE_TRIES, CODE_WAIT_SECS, CODES_PER_DAY, cleanEmail } from "../shared/earshotCreators";

export type Account = { id: number; email: string; device: string };
type SendEmail = (to: string, subject: string, html: string) => Promise<{ sent: boolean; error?: string }>;

const pepper = () => process.env.SESSION_SECRET || process.env.PODCAST_ACCOUNT_SECRET || "pod+";
const hash = (s: string) => createHash("sha256").update(`${pepper()}:${s}`).digest("hex");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export const SESSION = /^[A-Za-z0-9_-]{40,60}$/;

/** Who a session belongs to, remembered for a few minutes so every request isn't a database read. */
export function accountSessions(getDb: () => any) {
  const cache = new Map<string, { account: Account | null; at: number }>();
  async function lookup(token: string): Promise<Account | null> {
    if (!SESSION.test(token)) return null;
    const hit = cache.get(token);
    if (hit && Date.now() - hit.at < 5 * 60_000) return hit.account;
    const { data, error } = await getDb().from("podcast_account_sessions").select("account_id, seen_at, podcast_accounts(id,email,device)").eq("token_hash", hash(token)).maybeSingle();
    if (error) throw error;
    const a: any = data?.podcast_accounts;
    const account = a ? { id: Number(a.id), email: a.email, device: a.device } : null;
    if (cache.size > 5000) cache.clear();
    cache.set(token, { account, at: Date.now() });
    if (account && Date.now() - Date.parse(data.seen_at) > 6 * 3600_000) void getDb().from("podcast_account_sessions").update({ seen_at: new Date().toISOString() }).eq("token_hash", hash(token)).then(() => {}, () => {});
    return account;
  }
  return { lookup, forget: (token: string) => cache.delete(token) };
}

const codeEmail = (code: string) => `
  <h1 style="margin:0 0 8px;font-size:22px">Your Pod+ sign-in code</h1>
  <p style="margin:0 0 18px;color:#555">Type this code in Pod+ to sign in. It works for ${CODE_MINUTES} minutes.</p>
  <p style="margin:0 0 18px;font-size:34px;font-weight:800;letter-spacing:8px">${code}</p>
  <p style="margin:0;color:#888;font-size:13px">If you didn't ask for this, you can ignore this email. Nobody can sign in without the code.</p>`;

export function registerPodscrollAccountRoutes(app: Express, gate: RequestHandler, o: { getDb: () => any; sendEmail?: SendEmail; sessions: ReturnType<typeof accountSessions> }) {
  const P = "/api/podscroll/account";
  const db = () => o.getDb();
  const asks = createAttemptLimiter({ max: 10, windowMs: 60 * 60_000 });
  const guesses = createAttemptLimiter({ max: 30, windowMs: 60 * 60_000 });
  const device = (req: any) => String(req.headers["x-podscroll-device"] || "");
  const tooMany = (lim: ReturnType<typeof createAttemptLimiter>, key: string, res: any) => {
    const wait = lim.retryAfter(key);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); res.status(429).json({ message: `Too many tries. Try again in ${waitWords(wait)}.` }); return true; }
    lim.fail(key); return false;
  };

  /** Signed in or not, and as whom. */
  app.get(P, gate, (req: any, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ signedIn: !!req.creator, email: req.creator?.email ?? null });
  });

  /** Sends a code to an email. */
  app.post(`${P}/code`, gate, async (req: any, res) => {
    const email = cleanEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: "Enter a real email address." });
    if (!o.sendEmail) return res.status(503).json({ message: "Sign-in email isn't set up yet. Try again later." });
    if (tooMany(asks, device(req), res)) return;
    try {
      const { data: row, error } = await db().from("podcast_account_codes").select("sent_day,sent_today,sent_at").eq("email", email).maybeSingle();
      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);
      const sentToday = row && row.sent_day === today ? row.sent_today : 0;
      if (row && Date.now() - Date.parse(row.sent_at) < CODE_WAIT_SECS * 1000) return res.status(429).json({ message: "A code is on its way. Give it a moment, then check your spam folder." });
      if (sentToday >= CODES_PER_DAY) return res.status(429).json({ message: "That's the most codes for today. Try again tomorrow." });
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const { error: e2 } = await db().from("podcast_account_codes").upsert({
        email, code_hash: hash(`${email}:${code}`), expires_at: new Date(Date.now() + CODE_MINUTES * 60_000).toISOString(),
        tries: 0, sent_day: today, sent_today: sentToday + 1, sent_at: new Date().toISOString(),
      }, { onConflict: "email" });
      if (e2) throw e2;
      const sent = await o.sendEmail(email, `${code} is your Pod+ code`, codeEmail(code));
      if (!sent.sent) {
        await db().from("podcast_account_codes").delete().eq("email", email);
        return res.status(503).json({ message: "We couldn't send the email just now. Try again in a few minutes." });
      }
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[podscroll] account code:", e?.message || e);
      res.status(500).json({ message: "That didn't work. Try again." });
    }
  });

  /** Checks a code. A first sign-in makes the account and keeps this device's profile as yours. */
  app.post(`${P}/verify`, gate, async (req: any, res) => {
    const email = cleanEmail(req.body?.email), code = String(req.body?.code ?? "").replace(/\D/g, "");
    if (!email || code.length !== 6) return res.status(400).json({ message: "Enter the 6-digit code from the email." });
    if (tooMany(guesses, device(req), res)) return;
    try {
      const { data: row, error } = await db().from("podcast_account_codes").select("code_hash,expires_at,tries").eq("email", email).maybeSingle();
      if (error) throw error;
      if (!row) return res.status(400).json({ message: "Ask for a code first." });
      if (Date.parse(row.expires_at) < Date.now()) return res.status(400).json({ message: "That code has run out. Ask for a new one." });
      if (row.tries >= CODE_TRIES) return res.status(429).json({ message: "Too many wrong tries. Ask for a new code." });
      if (!same(row.code_hash, hash(`${email}:${code}`))) {
        await db().from("podcast_account_codes").update({ tries: row.tries + 1 }).eq("email", email);
        return res.status(400).json({ message: "That code isn't right. Check the email and try again." });
      }
      await db().from("podcast_account_codes").delete().eq("email", email);
      let { data: acct, error: e2 } = await db().from("podcast_accounts").select("id,email,device").eq("email", email).maybeSingle();
      if (e2) throw e2;
      if (!acct) {
        const made = await db().from("podcast_accounts").insert({ email, device: device(req) }).select("id,email,device").single();
        if (made.error) throw made.error;
        acct = made.data;
      }
      const token = randomBytes(33).toString("base64url");
      const { error: e3 } = await db().from("podcast_account_sessions").insert({ token_hash: hash(token), account_id: acct.id });
      if (e3) throw e3;
      res.json({ token, email: acct.email, sameDevice: acct.device === device(req) });
    } catch (e: any) {
      console.error("[podscroll] account verify:", e?.message || e);
      res.status(500).json({ message: "That didn't work. Try again." });
    }
  });

  app.post(`${P}/signout`, gate, async (req: any, res) => {
    const token = String(req.headers["x-podscroll-session"] || "");
    if (SESSION.test(token)) {
      o.sessions.forget(token);
      await db().from("podcast_account_sessions").delete().eq("token_hash", hash(token)).then(() => {}, () => {});
    }
    res.json({ ok: true });
  });
}
