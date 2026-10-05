// The 6-digit code that proves a new teacher owns the school email they typed.
//
// Sign-up emails the code to the address. Typing it back turns the account on at
// once, so no teacher waits for the admin. Without the code a teacher account
// stays off, exactly as it did while it waited for approval, and the admin can
// still turn it on by hand.
//
// Only a scrambled copy of each code is kept, and only for half an hour. The
// codes live in one settings row, so nothing new has to be added to the database.
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { checkSchoolEmail } from "../shared/schoolEmail";

export type TeacherEmailCodeDeps = {
  /** Reads a setting. Must throw when the database can't be reached: "" has to mean "no codes", not "couldn't look". */
  readSetting(key: string): Promise<string>;
  upsertSetting(key: string, value: string): Promise<void>;
  now?: () => number;
  /** Six digits. Only replaced in tests. */
  makeCode?: () => string;
};

type Waiting = {
  /** The code, scrambled together with the account's id. */
  hash: string;
  expires: number;
  /** Wrong guesses at this code. */
  tries: number;
  /** Codes sent since `since`. */
  sends: number;
  since: number;
  lastSent: number;
};

const KEY = "teacher_email_codes";
export const CODE_MINUTES = 30;
const CODE_MS = CODE_MINUTES * 60_000;
/** Wrong guesses allowed at one code. After that a new code has to be sent. */
export const MAX_TRIES = 5;
/** Codes one account may be sent in a day. Keeps the form from being used to flood an inbox. */
export const MAX_SENDS_PER_DAY = 5;
const DAY_MS = 24 * 3_600_000;
/** Seconds between two codes to the same account. */
export const RESEND_WAIT_SECONDS = 60;

export type IssueResult =
  | { ok: true; code: string }
  | { ok: false; why: "wait"; waitSeconds: number }
  | { ok: false; why: "limit" };
export type CheckResult = "ok" | "wrong" | "expired" | "locked" | "none";

const scramble = (userId: number, code: string) => createHash("sha256").update(`${userId}:${code}`).digest();

export function createTeacherEmailCodes(deps: TeacherEmailCodeDeps) {
  const now = () => (deps.now ? deps.now() : Date.now());
  const makeCode = deps.makeCode ?? (() => String(randomInt(0, 1_000_000)).padStart(6, "0"));

  const readAll = async (): Promise<Record<string, Waiting>> => {
    const raw = await deps.readSetting(KEY);
    if (!raw) return {};
    try {
      const all = JSON.parse(raw);
      return all && typeof all === "object" && !Array.isArray(all) ? all : {};
    } catch { return {}; }
  };
  const writeAll = async (all: Record<string, Waiting>) => {
    // forget accounts that have had no code sent for a week
    const cutoff = now() - 7 * DAY_MS;
    for (const [id, w] of Object.entries(all)) if (!w || !(Number(w.lastSent) > cutoff)) delete all[id];
    await deps.upsertSetting(KEY, JSON.stringify(all));
  };

  // one change at a time, so two requests can't both spend the same guess
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T,>(job: () => Promise<T>): Promise<T> => { const run = chain.then(job, job); chain = run.catch(() => {}); return run; };

  /** Makes a new code for this account, replacing any older one. The caller emails it. */
  const issue = (userId: number) => serial(async (): Promise<IssueResult> => {
    const all = await readAll();
    const t = now();
    const had = all[String(userId)];
    let sends = 0;
    let since = t;
    if (had) {
      const waitMs = RESEND_WAIT_SECONDS * 1000 - (t - Number(had.lastSent));
      if (waitMs > 0) return { ok: false, why: "wait", waitSeconds: Math.ceil(waitMs / 1000) };
      // the day's count starts over a day after its first code
      if (t - Number(had.since) < DAY_MS) {
        if (Number(had.sends) >= MAX_SENDS_PER_DAY) return { ok: false, why: "limit" };
        sends = Number(had.sends) || 0;
        since = Number(had.since);
      }
    }
    const code = makeCode();
    all[String(userId)] = { hash: scramble(userId, code).toString("hex"), expires: t + CODE_MS, tries: 0, sends: sends + 1, since, lastSent: t };
    await writeAll(all);
    return { ok: true, code };
  });

  /** Is the typed code the one this account was sent? A right answer uses the code up. */
  const check = (userId: number, typed: unknown) => serial(async (): Promise<CheckResult> => {
    const all = await readAll();
    const w = all[String(userId)];
    if (!w || !w.hash) return "none";
    if (now() > Number(w.expires)) return "expired";
    if (Number(w.tries) >= MAX_TRIES) return "locked";
    const code = String(typed ?? "").replace(/\D/g, "");
    const kept = Buffer.from(String(w.hash), "hex");
    const mine = scramble(userId, code);
    const right = code.length === 6 && kept.length === mine.length && timingSafeEqual(mine, kept);
    if (right) {
      delete all[String(userId)];
      await writeAll(all);
      return "ok";
    }
    // the guess is written down before the answer goes back, so it can't be tried again for free
    all[String(userId)] = { ...w, tries: Number(w.tries) + 1 };
    await writeAll(all);
    return Number(w.tries) + 1 >= MAX_TRIES ? "locked" : "wrong";
  });

  /** Has this account been sent a code it hasn't used? True even if that code has run out: a new one can be sent. */
  const waiting = async (userId: number): Promise<boolean> => !!(await readAll())[String(userId)];

  /** Drops the account's code, for when the email could not be sent after all. */
  const forget = (userId: number) => serial(async () => {
    const all = await readAll();
    if (!all[String(userId)]) return;
    delete all[String(userId)];
    await writeAll(all);
  });

  return { issue, check, waiting, forget };
}

export type TeacherEmailCodes = ReturnType<typeof createTeacherEmailCodes>;

// ─── Confirming the code, and sending another ────────────────────────────────
// Kept apart from the web server so the rules can be tested on their own.

export type TeacherAccount = {
  id: number;
  username: string;
  displayName?: string | null;
  role?: string | null;
  accountApproved?: boolean;
  email?: string | null;
  archivedAt?: unknown;
};

export type TeacherConfirmDeps = {
  codes: TeacherEmailCodes;
  findUser(username: string): Promise<TeacherAccount | null | undefined>;
  /** Turns the teacher account on. */
  turnOn(userId: number): Promise<void>;
  /** Emails a code. Answers false when the email could not be sent. */
  sendCode(account: TeacherAccount, code: string): Promise<boolean>;
  /** Runs once the account is on: the welcome email, and telling the admin. */
  joined(account: TeacherAccount): Promise<void> | void;
};

export type Reply = { status: number; body: Record<string, unknown> };

const NOT_FOUND: Reply = { status: 400, body: { message: "We couldn't find a teacher sign-up with that username. Please check it and try again." } };
const pendingTeacher = async (deps: TeacherConfirmDeps, username: unknown): Promise<TeacherAccount | null> => {
  const name = String(username ?? "").trim().toLowerCase();
  if (!name || name.length > 80) return null;
  const user = await deps.findUser(name);
  return user && user.role === "teacher" && !user.archivedAt ? user : null;
};

/** The teacher typed the code from their school email. A right code turns the account on at once. */
export async function confirmTeacherEmail(deps: TeacherConfirmDeps, body: any): Promise<Reply> {
  const user = await pendingTeacher(deps, body?.username);
  if (!user) return NOT_FOUND;
  if (user.accountApproved !== false) return { status: 200, body: { success: true, alreadyOn: true, message: "Your account is ready. You can log in." } };
  const result = await deps.codes.check(Number(user.id), body?.code);
  if (result === "wrong") return { status: 400, body: { message: "That code isn't right. Check the email and try again." } };
  if (result === "expired") return { status: 400, body: { message: "That code has run out. Tap “Send a new code” to get another." } };
  if (result === "locked") return { status: 429, body: { message: "Too many wrong tries. Tap “Send a new code” to get another." } };
  if (result === "none") return { status: 400, body: { message: "There is no code waiting for this account. Tap “Send a new code” to get one." } };
  await deps.turnOn(Number(user.id));
  // the account is on; a failed welcome email must not make the sign-up look failed
  try { await deps.joined(user); } catch (e: any) { console.error("[teacher-signup] could not send the welcome:", e?.message); }
  return { status: 200, body: { success: true, message: "Your school email is confirmed and your account is ready." } };
}

/** The teacher asked for another code. */
export async function resendTeacherCode(deps: TeacherConfirmDeps, body: any): Promise<Reply> {
  const user = await pendingTeacher(deps, body?.username);
  if (!user) return NOT_FOUND;
  if (user.accountApproved !== false) return { status: 200, body: { success: true, alreadyOn: true, message: "Your account is ready. You can log in." } };
  // an account made before school emails were required still waits for the admin
  if (!checkSchoolEmail(user.email).ok) return { status: 400, body: { message: "This account is waiting for the site admin to approve it." } };
  const issued = await deps.codes.issue(Number(user.id));
  if (!issued.ok) {
    if (issued.why === "wait") return { status: 429, body: { message: `Please wait ${issued.waitSeconds} seconds before asking for another code.` } };
    return { status: 429, body: { message: "That's the most codes we can send in one day. Try again tomorrow, or ask the site admin to turn your account on." } };
  }
  if (!(await deps.sendCode(user, issued.code))) {
    // nothing went out, so this try doesn't count against the wait or the day's limit
    await deps.codes.forget(Number(user.id)).catch(() => {});
    return { status: 503, body: { message: "We couldn't send the email just now. Please try again in a few minutes." } };
  }
  return { status: 200, body: { success: true, message: "A new code is on its way to your school email." } };
}

// ─── The emails ──────────────────────────────────────────────────────────────

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (text: unknown) => String(text ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
const frame = (inner: string) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a1a; color: #fff; padding: 40px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #FF5900; font-size: 28px; margin: 0;">A.R.I.S.E Reader</h1>
        <p style="color: #999; margin: 5px 0 0 0;">Read a book. Take a quiz. Earn points.</p>
      </div>${inner}
    </div>
  `;
const P = 'style="color: #ccc; font-size: 16px; line-height: 1.6;"';

/** To the teacher: the code that proves the school email is theirs. */
export function teacherEmailCodeEmail(displayName: string, code: string): string {
  return frame(`
      <h2 style="color: #FF5900; font-size: 22px;">Confirm your school email</h2>
      <p ${P}>Hi ${esc(displayName)},</p>
      <p ${P}>Type this code on the teacher sign-up page to turn on your A.R.I.S.E Reader teacher account:</p>
      <div style="background: #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
        <p style="color: #FF5900; font-size: 34px; letter-spacing: 8px; margin: 0; font-weight: bold;">${esc(code)}</p>
      </div>
      <p ${P}>The code works for ${CODE_MINUTES} minutes. As soon as you enter it you can log in. There is no wait for approval.</p>
      <p style="color: #666; font-size: 14px; margin-top: 30px;">If you didn't ask for a teacher account, you can ignore this email.</p>`);
}

/** To the teacher, once the account is on. */
export function teacherWelcomeEmail(displayName: string, username: string, appUrl: string): string {
  return frame(`
      <h2 style="color: #FF5900; font-size: 22px;">Your Teacher Account is Ready!</h2>
      <p ${P}>Hi ${esc(displayName)},</p>
      <p ${P}>Your school email is confirmed and your teacher account on A.R.I.S.E Reader is on. You can log in and start setting up your class right now.</p>
      <div style="background: #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p style="color: #999; margin: 0 0 5px 0; font-size: 14px;">Your username:</p>
        <p style="color: #FF5900; font-size: 18px; margin: 0; font-weight: bold;">${esc(username)}</p>
      </div>
      <a href="${esc(appUrl)}" style="display: inline-block; background: #FF5900; color: #fff; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: bold; margin: 20px 0;">Log In Now</a>`);
}

/** To the admin: a teacher got in with a confirmed school email. Nothing to do; it is for their information. */
export function teacherJoinedNotifyEmail(displayName: string, username: string, email: string, appUrl: string): string {
  return frame(`
      <h2 style="color: #FF5900; font-size: 22px;">A New Teacher Joined</h2>
      <p ${P}>This teacher confirmed their school email, so their account is already on. You don't need to do anything.</p>
      <div style="background: #2a2a2a; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <p style="color: #999; margin: 0 0 5px 0; font-size: 14px;">Name: <span style="color: #fff;">${esc(displayName)}</span></p>
        <p style="color: #999; margin: 0 0 5px 0; font-size: 14px;">Username: <span style="color: #fff;">${esc(username)}</span></p>
        <p style="color: #999; margin: 0; font-size: 14px;">School email: <span style="color: #fff;">${esc(email)}</span></p>
      </div>
      <p style="color: #999; font-size: 14px;">If this doesn't look like a real teacher, you can remove the account under Teachers in the admin dashboard.</p>
      <a href="${esc(appUrl)}" style="display: inline-block; background: #FF5900; color: #fff; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-size: 16px; font-weight: bold;">Open the Admin Dashboard</a>`);
}
