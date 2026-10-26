// Getting back into an account without a teacher or the admin:
// - sign in with the email on the account instead of the username (when it's unambiguous)
// - "Forgot your username or password?": an email listing every username on that address,
//   each with a single-use link (1 hour) to choose a new password
// Pure logic over a small set of dependencies so it can be tested.
import { createHash, randomBytes } from "node:crypto";
import type { Express } from "express";
import { clientAddress, createAttemptLimiter, waitWords } from "./attemptLimiter";

export type RecoveryAccount = { id: number; username: string; displayName: string; email: string | null; role: string | null; password: string };

export type RecoveryDeps = {
  /** Accounts (not archived) whose email matches, ignoring case. */
  accountsByEmail(email: string): Promise<RecoveryAccount[]>;
  saveToken(row: { tokenHash: string; userId: number; expiresAt: Date }): Promise<void>;
  /** The token's row, if it exists. */
  loadToken(tokenHash: string): Promise<{ userId: number; expiresAt: Date; usedAt: Date | null } | null>;
  /** Marks the token used; false if it was already used (so a link works once). */
  useToken(tokenHash: string): Promise<boolean>;
  getAccount(id: number): Promise<RecoveryAccount | null>;
  setPassword(userId: number, password: string): Promise<void>;
  /** Signs the account out on every device (after a password change). */
  signOutEverywhere(userId: number): Promise<void>;
  sendEmail(to: string, subject: string, html: string): Promise<{ sent: boolean; error?: string }>;
  siteUrl: string;
  now?: () => number;
};

export const RESET_TTL_MS = 60 * 60_000;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const esc = (t: string) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

/**
 * Sign-in by email: the account whose password matches among the accounts on that email.
 * "none" = no account has this email / wrong password; "ambiguous" = the password fits more than one.
 */
export async function accountForEmailSignIn(
  deps: Pick<RecoveryDeps, "accountsByEmail">,
  email: string,
  password: string,
  check: (password: string, hashed: string) => Promise<boolean>,
): Promise<{ account: RecoveryAccount } | { account: null; reason: "none" | "ambiguous" }> {
  const accounts = await deps.accountsByEmail(email.trim());
  const matches: RecoveryAccount[] = [];
  for (const a of accounts) if (a.password && (await check(password, a.password))) matches.push(a);
  if (matches.length === 1) return { account: matches[0] };
  return { account: null, reason: matches.length > 1 ? "ambiguous" : "none" };
}

function recoveryEmail(site: string, links: { username: string; displayName: string; url: string }[]): string {
  const rows = links.map((l) => `
    <tr><td style="padding:14px 16px;border:1px solid #e3e6f0;border-radius:12px;">
      <p style="margin:0 0 4px;color:#5d6478;font-size:13px;">${esc(l.displayName)}</p>
      <p style="margin:0 0 10px;font-size:18px;font-weight:700;color:#17213b;">Username: ${esc(l.username)}</p>
      <a href="${esc(l.url)}" style="display:inline-block;background:#665ae6;color:#ffffff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:10px;">Choose a new password</a>
    </td></tr><tr><td style="height:10px;"></td></tr>`).join("");
  return `
  <h2 style="margin:0 0 12px;color:#17213b;">Your A.R.I.S.E. sign-in</h2>
  <p style="margin:0 0 16px;color:#3b4256;font-size:15px;line-height:1.6;">Someone asked for the sign-in details for this email address. ${links.length > 1 ? "These accounts use it:" : "This account uses it:"}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;">${rows}</table>
  <p style="margin:8px 0 0;color:#5d6478;font-size:13px;line-height:1.6;">You can sign in with your username or this email. The password links work once and expire in 1 hour. If you didn't ask for this, you can ignore this email; nothing has changed.</p>
  <p style="margin:8px 0 0;color:#5d6478;font-size:13px;">Sign in at <a href="${esc(site)}/#/signin">${esc(site.replace(/^https?:\/\//, ""))}</a></p>`;
}

/** Sends the recovery email. Always resolves the same way, so nobody learns which emails have accounts. */
export async function sendRecovery(deps: RecoveryDeps, email: string): Promise<{ sentTo: number }> {
  const accounts = (await deps.accountsByEmail(email.trim())).filter((a) => a.email);
  if (!accounts.length) return { sentTo: 0 };
  const now = deps.now?.() ?? Date.now();
  const site = deps.siteUrl.replace(/\/+$/, "");
  const links: { username: string; displayName: string; url: string }[] = [];
  for (const a of accounts) {
    const token = randomBytes(24).toString("hex");
    await deps.saveToken({ tokenHash: hash(token), userId: a.id, expiresAt: new Date(now + RESET_TTL_MS) });
    links.push({ username: a.username, displayName: a.displayName || a.username, url: `${site}/#/reset-password?token=${token}` });
  }
  const result = await deps.sendEmail(accounts[0].email!, "Your A.R.I.S.E. username and password", recoveryEmail(site, links));
  if (!result.sent) throw new Error(result.error || "The email could not be sent.");
  return { sentTo: accounts.length };
}

/** Checks a reset link: the account it's for, or why it can't be used. */
export async function checkResetToken(deps: RecoveryDeps, token: string): Promise<{ account: RecoveryAccount } | { error: string }> {
  if (!/^[a-f0-9]{48}$/.test(String(token || ""))) return { error: "This link isn't complete. Copy the whole link from the email, or ask for a new one." };
  const row = await deps.loadToken(hash(token));
  const now = deps.now?.() ?? Date.now();
  if (!row) return { error: "This link isn't valid. Ask for a new one." };
  if (row.usedAt) return { error: "This link was already used. Ask for a new one if you need to change your password again." };
  if (row.expiresAt.getTime() <= now) return { error: "This link has expired. Ask for a new one; they last 1 hour." };
  const account = await deps.getAccount(row.userId);
  if (!account) return { error: "This account can't be found." };
  return { account };
}

export async function resetPassword(deps: RecoveryDeps, token: string, newHashedPassword: string): Promise<{ username: string } | { error: string }> {
  const checked = await checkResetToken(deps, token);
  if ("error" in checked) return checked;
  if (!(await deps.useToken(hash(token)))) return { error: "This link was already used. Ask for a new one." };
  await deps.setPassword(checked.account.id, newHashedPassword);
  await deps.signOutEverywhere(checked.account.id);
  return { username: checked.account.username };
}

export function registerAccountRecoveryRoutes(app: Express, deps: RecoveryDeps & { hashPassword: (p: string) => string }) {
  const byEmail = createAttemptLimiter({ max: 3, windowMs: 60 * 60_000 });
  const byAddress = createAttemptLimiter({ max: 20, windowMs: 60 * 60_000 });
  const SAME_ANSWER = "If an account uses that email, we just sent its username and a link to choose a new password. Check your inbox (and spam folder).";

  app.post("/api/auth/forgot", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!looksLikeEmail(email)) return res.status(400).json({ message: "Enter the email address on your account." });
    const wait = Math.max(byEmail.retryAfter(email), byAddress.retryAfter(clientAddress(req)));
    if (wait > 0) return res.status(429).json({ message: `We've already sent a few emails. Check your inbox, or try again in ${waitWords(wait)}.` });
    byEmail.fail(email); byAddress.fail(clientAddress(req));
    try {
      await sendRecovery(deps, email);
    } catch (e: any) {
      console.error("[account-recovery] send failed:", e?.message);
      return res.status(503).json({ message: "We couldn't send the email just now. Please try again in a few minutes." });
    }
    res.json({ success: true, message: SAME_ANSWER });
  });

  app.get("/api/auth/reset-password", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const checked = await checkResetToken(deps, String(req.query.token || ""));
    if ("error" in checked) return res.status(400).json({ message: checked.error });
    res.json({ username: checked.account.username, displayName: checked.account.displayName });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, password } = req.body || {};
    if (typeof password !== "string" || password.length < 6) return res.status(400).json({ message: "Choose a password with at least 6 characters." });
    const result = await resetPassword(deps, String(token || ""), deps.hashPassword(password));
    if ("error" in result) return res.status(400).json({ message: result.error });
    res.json({ success: true, username: result.username, message: `Your password is changed. Sign in as ${result.username} with your new password.` });
  });
}
