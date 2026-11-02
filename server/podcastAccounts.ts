// Pod+ creator sign-in: an email and a 6-digit code. Listening never needs it; publishing episodes,
// Studio and going live do. An account remembers the device id its profile was made on, so signing
// in on another phone brings the same profile, posts and followers (server/earshot.ts swaps the
// device for the account's on every request that carries the session).
import type { Express, RequestHandler } from "express";
import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { AppleTokenError, PODPLUS_APP, appleRefreshToken, revokeAppleToken, verifyAppleToken } from "./appleSignIn";
import { CODE_MINUTES, CODE_TRIES, CODE_WAIT_SECS, CODES_PER_DAY, cleanEmail } from "../shared/earshotCreators";

export type Account = { id: number; email: string; device: string };
type SendEmail = (to: string, subject: string, html: string) => Promise<{ sent: boolean; error?: string }>;

const pepper = () => process.env.SESSION_SECRET || process.env.PODCAST_ACCOUNT_SECRET || "pod+";
const hash = (s: string) => createHash("sha256").update(`${pepper()}:${s}`).digest("hex");
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export const SESSION = /^[A-Za-z0-9_-]{40,60}$/;

/** Passwords: scrypt with a random salt per account, stored as "s1$salt$hash". */
export const PASSWORD_MIN = 8;
export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("base64url");
  return `s1$${salt}$${scryptSync(pw, salt, 32).toString("base64url")}`;
}
export function checkPassword(pw: string, stored: string | null | undefined): boolean {
  const [v, salt, h] = String(stored || "").split("$");
  if (v !== "s1" || !salt || !h) return false;
  return same(scryptSync(pw, salt, 32).toString("base64url"), h);
}
const cleanPassword = (v: unknown) => (typeof v === "string" && v.length >= PASSWORD_MIN && v.length <= 128 ? v : "");

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

  /** Email and password. */
  app.post(`${P}/login`, gate, async (req: any, res) => {
    const email = cleanEmail(req.body?.email), pw = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email || !pw) return res.status(400).json({ message: "Enter your email and password." });
    if (tooMany(guesses, device(req), res) || tooMany(guesses, `e:${email}`, res)) return;
    try {
      const { data: acct, error } = await db().from("podcast_accounts").select("id,email,device,password_hash").eq("email", email).maybeSingle();
      if (error) throw error;
      if (!acct || !acct.password_hash) return res.status(400).json({ noPassword: true, message: acct ? "This account doesn't have a password yet. Tap Forgot password to set one, or sign in with an email code." : "No account with that email yet. Create one, or sign in with an email code." });
      if (!checkPassword(pw, acct.password_hash)) return res.status(400).json({ message: "That password isn't right. Try again, or tap Forgot password." });
      const token = randomBytes(33).toString("base64url");
      const { error: e3 } = await db().from("podcast_account_sessions").insert({ token_hash: hash(token), account_id: acct.id });
      if (e3) throw e3;
      res.json({ token, email: acct.email, sameDevice: acct.device === device(req) });
    } catch (e: any) {
      console.error("[podscroll] account login:", e?.message || e);
      res.status(500).json({ message: "That didn't work. Try again." });
    }
  });

  /** Checks a code. A first sign-in makes the account and keeps this device's profile as yours.
   *  With a password, it's also how an account sets (sign up) or resets (forgot password) one. */
  app.post(`${P}/verify`, gate, async (req: any, res) => {
    const email = cleanEmail(req.body?.email), code = String(req.body?.code ?? "").replace(/\D/g, "");
    if (!email || code.length !== 6) return res.status(400).json({ message: "Enter the 6-digit code from the email." });
    const newPassword = req.body?.password === undefined ? "" : cleanPassword(req.body.password);
    if (req.body?.password !== undefined && !newPassword) return res.status(400).json({ message: `Use a password of at least ${PASSWORD_MIN} characters.` });
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
      if (newPassword) {
        const { error: ep } = await db().from("podcast_accounts").update({ password_hash: hashPassword(newPassword) }).eq("id", acct.id);
        if (ep) throw ep;
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

  /** Sign in with Apple (the Pod+ iPhone app). The identity token is checked against Apple's keys
   *  (server/appleSignIn.ts); the account is the one with that email (Apple's own or its private relay
   *  address), made now if it's new, keeping this phone's profile like an email-code sign-in does. */
  const apples = createAttemptLimiter({ max: 30, windowMs: 15 * 60_000 });
  app.post(`${P}/apple`, gate, async (req: any, res) => {
    if (tooMany(apples, device(req), res)) return;
    try {
      const claims = await verifyAppleToken(String(req.body?.identityToken || ""), [PODPLUS_APP]);
      const email = cleanEmail(claims.email);
      if (!email) return res.status(400).json({ message: "Apple didn't share an email. In Settings → Apple ID → Sign in with Apple, remove Pod+ and try again." });
      let { data: acct, error } = await db().from("podcast_accounts").select("id,email,device").eq("email", email).maybeSingle();
      if (error) throw error;
      if (!acct) {
        const made = await db().from("podcast_accounts").insert({ email, device: device(req) }).select("id,email,device").single();
        if (made.error) throw made.error;
        acct = made.data;
      }
      const token = randomBytes(33).toString("base64url");
      const { error: e3 } = await db().from("podcast_account_sessions").insert({ token_hash: hash(token), account_id: acct.id });
      if (e3) throw e3;
      // Kept so the Apple sign-in can be revoked if the account is deleted (needs the Sign in with Apple key).
      const refresh = await appleRefreshToken(String(req.body?.authorizationCode || ""), PODPLUS_APP).catch(() => "");
      if (refresh) await db().from("settings").upsert({ key: `podplus_apple_refresh:${acct.id}`, value: refresh }, { onConflict: "key" }).then(() => {}, () => {});
      res.json({ token, email: acct.email, sameDevice: acct.device === device(req) });
    } catch (e: any) {
      if (e instanceof AppleTokenError) return res.status(401).json({ message: e.message });
      console.error("[podscroll] apple sign-in:", e?.message || e);
      res.status(500).json({ message: "Sign in with Apple didn't work just now. Try again." });
    }
  });

  /** Delete my Pod+ account and everything made with it (App Store Guideline 5.1.1(v)). Works signed
   *  in (the account, its profile and this phone's data) or not (this phone's listening data and
   *  profile). Asks for the word DELETE so it's never done by a stray tap. */
  const deletes = createAttemptLimiter({ max: 5, windowMs: 60 * 60_000 });
  app.post(`${P}/delete`, gate, async (req: any, res) => {
    if (String(req.body?.confirm || "") !== "DELETE") return res.status(400).json({ message: "Type DELETE to confirm." });
    if (tooMany(deletes, device(req), res)) return;
    try {
      const voters = Array.from(new Set([`d${req.user?.id || ""}`, `d${device(req)}`].filter((v) => v.length > 17)));
      await deletePodData(db(), voters);
      if (req.creator?.id) {
        // A Sign in with Apple link is revoked with Apple too (when the Sign in with Apple key is set).
        try {
          const key = `podplus_apple_refresh:${req.creator.id}`;
          const { data } = await db().from("settings").select("value").eq("key", key).maybeSingle();
          if (data?.value) { await revokeAppleToken(String(data.value), PODPLUS_APP).catch(() => false); await db().from("settings").delete().eq("key", key); }
        } catch { /* the account still goes */ }
        await db().from("podcast_account_codes").delete().eq("email", req.creator.email).then(() => {}, () => {});
        const { error } = await db().from("podcast_accounts").delete().eq("id", req.creator.id);
        if (error) throw error;
        const token = String(req.headers["x-podscroll-session"] || "");
        if (SESSION.test(token)) o.sessions.forget(token);
      }
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[podscroll] account delete:", e?.message || e);
      res.status(500).json({ message: "That didn't work. Try again, or write to us from the Support page and we'll delete it for you." });
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

/** Everything Pod+ keeps about these people ("d<device>" voters): profile (its posts, comments and
 *  followers go with it), likes, follows, saves, votes, blocks, messages, stories, listens, ad votes,
 *  episode comments and uploaded files. A table that doesn't exist yet is skipped. */
export async function deletePodData(db: any, voters: string[]): Promise<void> {
  const soft = (e: any) => !e || e.code === "42P01" || e.code === "PGRST205" || e.code === "42703" || /does not exist|not find/i.test(String(e.message || ""));
  const run = async (q: any) => { const { error } = await q; if (!soft(error)) throw error; };
  for (const voter of voters) {
    const device = voter.slice(1);
    for (const [table, column] of [
      ["podcast_post_likes", "voter"], ["podcast_post_reports", "voter"], ["podcast_comment_likes", "voter"], ["podcast_poll_votes", "voter"],
      ["podcast_post_saves", "voter"], ["podcast_people_follows", "follower"], ["podcast_people_follows", "followee"], ["podcast_notifications", "voter"],
      ["podcast_notifications", "actor"], ["podcast_blocks", "blocker"], ["podcast_blocks", "blocked"], ["podcast_story_views", "voter"],
      ["podcast_stories", "voter"], ["podcast_dm_threads", "a"], ["podcast_dm_threads", "b"], ["podcast_listens", "voter"],
      ["podcast_ad_votes", "voter"], ["podcast_ad_skips", "voter"], ["podcast_comments", "voter"], ["podcast_posts", "voter"], ["podcast_profiles", "voter"],
    ] as const) await run(db.from(table).delete().eq(column, voter));
    // Episode comments and likes on the Pod+ site are kept by device id.
    for (const table of ["podscroll_comment_reports", "podscroll_comments", "podscroll_likes"]) await run(db.from(table).delete().eq("user_id", device));
    // Photos, videos, episodes and clips they uploaded.
    const folder = voter.replace(/[^A-Za-z0-9_-]/g, "");
    try {
      const bucket = db.storage?.from("podcast-uploads");
      for (const dir of [folder, `clips/${folder}`]) {
        const { data } = (await bucket?.list(dir, { limit: 1000 })) || { data: [] };
        const paths = (data || []).filter((f: any) => f?.name).map((f: any) => `${dir}/${f.name}`);
        if (paths.length) await bucket.remove(paths);
      }
    } catch { /* files without a database row are unreachable once the profile is gone */ }
  }
}
