// Automatic family emails: a weekly progress update for each parent about their child, and a friendly
// "time to read" nudge when a child hasn't passed a quiz in a few days.
//
// Students have no email addresses on the site, so both go to the parent, with a short note
// written to the child ("Read this to Dennis!").
//
// The admin turns them on and off, and sets the day and time. They start off.
import { SCHOOL_TIME_ZONE } from "./schoolMonth";
import { inviteBrandHtml, inviteInlineHtml } from "./inviteRich";

export const FAMILY_EMAIL_SETTINGS_KEY = "family_email_settings";
export const FAMILY_EMAIL_STATE_KEY = "family_email_state";
export const FAMILY_EMAIL_OPTOUT_KEY = "family_email_optout";
const DAY_MS = 24 * 60 * 60 * 1000;
/** A child gets at most one nudge in this long. */
export const NUDGE_GAP_MS = 7 * DAY_MS;
/** The most emails one pass sends, so a large school's Sunday goes out over a few passes instead of all at once. */
export const SENDS_PER_PASS = 120;

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type FamilyEmailSettings = {
  /** The main switch. Nothing is sent while it is off. */
  enabled: boolean;
  /** The weekly progress update: which day (0 is Sunday) and from what hour (Mountain Time). */
  weekly: { on: boolean; day: number; hour: number };
  /** The nudge: after how many days without a passed quiz, and from what hour. */
  nudge: { on: boolean; afterDays: number; hour: number };
  /** Mention the prizes and the competitions that are on. */
  competitions: boolean;
};

export const DEFAULT_FAMILY_EMAIL_SETTINGS: FamilyEmailSettings = {
  enabled: false,
  weekly: { on: true, day: 0, hour: 17 },
  nudge: { on: true, afterDays: 4, hour: 16 },
  competitions: true,
};

const int = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

/** Saved settings made safe to use. Anything missing or odd falls back to the default (and the main switch to off). */
export function cleanFamilyEmailSettings(raw: unknown): FamilyEmailSettings {
  let data: any = raw;
  if (typeof raw === "string") { try { data = JSON.parse(raw); } catch { data = null; } }
  const d = DEFAULT_FAMILY_EMAIL_SETTINGS;
  if (!data || typeof data !== "object") return { ...d, weekly: { ...d.weekly }, nudge: { ...d.nudge } };
  return {
    enabled: data.enabled === true,
    weekly: { on: data.weekly?.on !== false, day: int(data.weekly?.day, 0, 6, d.weekly.day), hour: int(data.weekly?.hour, 0, 23, d.weekly.hour) },
    nudge: { on: data.nudge?.on !== false, afterDays: int(data.nudge?.afterDays, 2, 14, d.nudge.afterDays), hour: int(data.nudge?.hour, 0, 23, d.nudge.hour) },
    competitions: data.competitions !== false,
  };
}

/** "5:00 PM" for 17. */
export const hourText = (hour: number) => `${hour % 12 || 12}:00 ${hour < 12 ? "AM" : "PM"}`;

/** The day, weekday and hour at a moment, on the school's clock. */
export function schoolClock(ms: number, timeZone = SCHOOL_TIME_ZONE): { day: string; weekday: number; hour: number } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday), hour: Number(parts.hour) % 24 };
}

/** Is it time for this week's progress updates? (The right day, at or after the hour.) */
export function weeklyDue(settings: FamilyEmailSettings, nowMs: number, timeZone = SCHOOL_TIME_ZONE): boolean {
  const c = schoolClock(nowMs, timeZone);
  return settings.enabled && settings.weekly.on && c.weekday === settings.weekly.day && c.hour >= settings.weekly.hour;
}

/** Is it time to look for children to nudge today? Never on the weekly update's day, so no one gets two emails in a day. */
export function nudgeDue(settings: FamilyEmailSettings, nowMs: number, timeZone = SCHOOL_TIME_ZONE): boolean {
  const c = schoolClock(nowMs, timeZone);
  return settings.enabled && settings.nudge.on && c.hour >= settings.nudge.hour && !(settings.weekly.on && c.weekday === settings.weekly.day);
}

/** Does this child need a nudge? No passed quiz for the set number of days, and no nudge in the last week. */
export function needsNudge(child: Pick<ChildProgress, "lastPassedAt">, settings: FamilyEmailSettings, nowMs: number, lastNudgeMs: number | null): boolean {
  if (lastNudgeMs !== null && nowMs - lastNudgeMs < NUDGE_GAP_MS) return false;
  return child.lastPassedAt === null || nowMs - child.lastPassedAt >= settings.nudge.afterDays * DAY_MS;
}

/** Each parent and child pair has its own record of what was sent, so a parent of two hears about each. */
export const pairKey = (parentId: number, childId: number) => `${parentId}:${childId}`;

export type FamilyEmailState = {
  /** The school day each pair's last weekly update went out. */
  weekly: Record<string, string>;
  /** When each pair's last nudge went out. */
  nudge: Record<string, number>;
  /** What the last pass did, for the admin page. */
  lastRun?: { at: number; weekly: number; nudges: number; failed: number; note?: string };
};

export function readFamilyEmailState(raw: unknown): FamilyEmailState {
  let data: any = raw;
  if (typeof raw === "string") { try { data = JSON.parse(raw); } catch { data = null; } }
  const weekly: Record<string, string> = {}, nudge: Record<string, number> = {};
  if (data?.weekly && typeof data.weekly === "object") for (const [k, v] of Object.entries(data.weekly)) if (/^\d+:\d+$/.test(k) && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) weekly[k] = String(v);
  if (data?.nudge && typeof data.nudge === "object") for (const [k, v] of Object.entries(data.nudge)) if (/^\d+:\d+$/.test(k) && Number.isFinite(Number(v))) nudge[k] = Number(v);
  const lastRun = data?.lastRun && Number.isFinite(Number(data.lastRun.at)) ? { at: Number(data.lastRun.at), weekly: Number(data.lastRun.weekly) || 0, nudges: Number(data.lastRun.nudges) || 0, failed: Number(data.lastRun.failed) || 0, ...(data.lastRun.note ? { note: String(data.lastRun.note).slice(0, 200) } : {}) } : undefined;
  return { weekly, nudge, ...(lastRun ? { lastRun } : {}) };
}

/** Parents who used the "stop these emails" link. */
export function readOptOuts(raw: unknown): number[] {
  let data: any = raw;
  if (typeof raw === "string") { try { data = JSON.parse(raw); } catch { data = null; } }
  return Array.isArray(data?.parentIds) ? Array.from(new Set(data.parentIds.map(Number).filter((n: number) => Number.isSafeInteger(n) && n > 0))) : [];
}

// ─── What an email says ─────────────────────────────────────────────────────

/** One child's reading, for their parent's email. */
export type ChildProgress = {
  childId: number;
  name: string;
  /** Quizzes passed and points earned in the last seven days. */
  weekPassed: number;
  weekPoints: number;
  /** Book titles passed in the last seven days (a few). */
  weekBooks: string[];
  totalPoints: number;
  /** This month's place among readers in the same grade band (or everyone, without a grade). null with no points this month. */
  monthRank: number | null;
  monthPoints: number;
  /** Points to pass the reader just above. null at the top, or with no rank. */
  pointsToNext: number | null;
  /** "6-8" when known. */
  band: string | null;
  /** When the child last passed a quiz. null for never. */
  lastPassedAt: number | null;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const firstName = (name: string) => String(name || "").trim().split(/\s+/)[0] || "your child";
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const pts = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
/** The same child and week always get the same wording; a new week brings a different line. */
const pick = <T,>(list: readonly T[], seed: number) => list[Math.abs(Math.floor(seed)) % list.length];

/** Where the child stands this month, in one encouraging sentence. */
export function standingText(c: ChildProgress): string {
  const first = firstName(c.name);
  const group = c.band ? ` in the ${c.band} grade band` : "";
  if (c.monthRank === null) return `${first} hasn't earned points this month yet. One book and one passed quiz puts ${first} on the leaderboard!`;
  if (c.monthRank === 1) return `${first} is #1${group} this month! 🏆 Keep it up to stay on top.`;
  const gap = c.pointsToNext !== null ? ` Just ${plural(c.pointsToNext, "more point", "more points")} to move up to #${c.monthRank - 1}!` : "";
  return `${first} is #${c.monthRank}${group} this month with ${pts(c.monthPoints)} points.${gap}`;
}

const KID_CHEERS_GOOD = [
  (f: string) => `Awesome reading this week, ${f}! Every quiz you pass puts points on the board. What will you read next? 📚`,
  (f: string) => `${f}, you're on a roll! Keep reading and watch your points climb. ⭐`,
  (f: string) => `Great job, ${f}! Pick your next book and go for another quiz. You've got this! 💪`,
];
const KID_CHEERS_START = [
  (f: string) => `Hey ${f}! Your next book is waiting. Read it, pass the quiz, and watch your points climb! 📖⭐`,
  (f: string) => `${f}, the leaderboard is moving! One book and one quiz is all it takes to jump in. 🚀`,
  (f: string) => `Hi ${f}! Grab a book you like, then show what you know on the quiz. Points are waiting! 🎯`,
];

type EmailParts = { siteUrl: string; stopUrl: string; prizes?: string[]; seed?: number };
export type BuiltEmail = { subject: string; html: string };

const P = "margin:0 0 12px;line-height:1.6;color:#cbd5e1;font-size:16px;";
const H2 = "margin:26px 0 10px;color:#f8fafc;font-size:18px;";
const LI = "margin:0 0 8px;line-height:1.55;color:#cbd5e1;font-size:16px;";

function shell(siteUrl: string, heading: string, body: string, stopUrl: string, childFirst: string): string {
  const site = siteUrl.replace(/\/+$/, "");
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;background-color:#0b0a16;color:#f8fafc;padding:32px;border-radius:20px;">
  ${inviteBrandHtml(site, "dark")}
  <h2 style="margin:24px 0 10px;color:#f8fafc;font-size:22px;">${heading}</h2>
${body}
  <p style="margin:24px 0 0;"><a href="${escapeHtml(site)}/" style="display:inline-block;background-color:#7c3aed;background-image:linear-gradient(90deg,#7c3aed,#c026d3,#06b6d4);color:#ffffff;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:12px;">Open A.R.I.S.E. Reader</a></p>
  <p style="color:#94a3b8;font-size:13px;margin-top:24px;line-height:1.6;">You get this because your parent account is connected to ${escapeHtml(childFirst)}. <a href="${escapeHtml(stopUrl)}" style="color:#94a3b8;">Stop these emails</a>.</p>
</div>`;
}

function kidBox(childFirst: string, words: string): string {
  return `  <div style="margin:18px 0;padding:14px 16px;border-left:4px solid #fbbf24;background-color:#1f1a2e;border-radius:10px;">
    <div style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#fbbf24;">Read this to ${escapeHtml(childFirst)}!</div>
    <div style="line-height:1.6;color:#f8fafc;font-size:17px;">${escapeHtml(words)}</div>
  </div>
`;
}

function prizesBlock(prizes: string[] | undefined): string {
  const lines = (prizes || []).filter(Boolean);
  if (!lines.length) return "";
  return `  <h2 style="${H2}">🏆 Prizes and competitions</h2>
  <ul style="margin:0;padding-left:22px;">
    ${lines.map((line) => `<li style="${LI}">${inviteInlineHtml(line, "#c4b5fd")}</li>`).join("\n    ")}
  </ul>
`;
}

function tile(label: string, value: string): string {
  return `<td width="33%" align="center" valign="top" style="padding:0 4px;"><div style="background-color:#1a1730;border-radius:12px;padding:12px 6px;"><div style="font-size:26px;font-weight:bold;color:#c4b5fd;">${escapeHtml(value)}</div><div style="margin-top:2px;font-size:13px;color:#cbd5e1;">${escapeHtml(label)}</div></div></td>`;
}

/** The weekly progress update for one child. */
export function weeklyProgressEmail(c: ChildProgress, parts: EmailParts): BuiltEmail {
  const first = firstName(c.name);
  const f = escapeHtml(first);
  const seed = parts.seed ?? 0;
  const good = c.weekPassed > 0;
  const subject = good
    ? `📚 ${first}'s reading week: ${plural(c.weekPassed, "quiz", "quizzes")} passed, ${pts(c.weekPoints)} points!`
    : `📚 ${first}'s reading week, and a fresh start`;
  const books = c.weekBooks.slice(0, 3);
  const body = `  <p style="${P}">${good ? `${f} had a reading week to be proud of. Here's how it went:` : `${f} didn't pass a quiz this week, and that's okay. A new week is a fresh start, and one book is all it takes.`}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0 14px;"><tr>${tile("quizzes passed this week", String(c.weekPassed))}${tile("points this week", pts(c.weekPoints))}${tile("points in all", pts(c.totalPoints))}</tr></table>
${books.length ? `  <p style="${P}"><strong style="color:#ffffff;">Books ${f} finished this week:</strong> ${books.map((b) => escapeHtml(b)).join(", ")}${c.weekBooks.length > books.length ? ` and ${c.weekBooks.length - books.length} more` : ""}.</p>\n` : ""}  <h2 style="${H2}">📊 On the leaderboard</h2>
  <p style="${P}">${escapeHtml(standingText(c))}</p>
${kidBox(first, pick(good ? KID_CHEERS_GOOD : KID_CHEERS_START, seed)(first))}${prizesBlock(parts.prizes)}`;
  return { subject, html: shell(parts.siteUrl, good ? `${f}'s reading week ⭐` : `${f}'s reading week`, body, parts.stopUrl, first) };
}

/** The friendly nudge when a child hasn't passed a quiz in a while. */
export function readingNudgeEmail(c: ChildProgress, parts: EmailParts & { nowMs: number }): BuiltEmail {
  const first = firstName(c.name);
  const f = escapeHtml(first);
  const seed = parts.seed ?? 0;
  const days = c.lastPassedAt === null ? null : Math.max(1, Math.floor((parts.nowMs - c.lastPassedAt) / DAY_MS));
  const close = c.monthRank !== null && c.monthRank > 1 && c.pointsToNext !== null && c.pointsToNext <= 30;
  const subject = close
    ? `⭐ ${first} is ${plural(c.pointsToNext!, "point", "points")} from moving up!`
    : pick([`📖 ${first}'s next book is waiting!`, `🚀 Time to read, ${first}!`, `🎯 A quick quiz for ${first}?`], seed);
  const opener = days === null
    ? `${f} hasn't taken a quiz on A.R.I.S.E. Reader yet. Tonight is a great night to start: read a book, then take its quiz to earn its points.`
    : `It's been ${plural(days, "day", "days")} since ${f}'s last passed quiz, and the leaderboard keeps moving! A book and a quiz this week would get ${f} back in it.`;
  const body = `  <p style="${P}">${opener}</p>
  <p style="${P}">${escapeHtml(standingText(c))}</p>
${kidBox(first, pick(KID_CHEERS_START, seed + 1)(first))}  <p style="${P}">A little encouragement from you goes a long way. Ten minutes of reading tonight counts!</p>
${prizesBlock(parts.prizes)}`;
  return { subject, html: shell(parts.siteUrl, `${f}, your next book is waiting! 📖`, body, parts.stopUrl, first) };
}

/** A made-up child, for a preview when no real one is picked. */
export const SAMPLE_CHILD: ChildProgress = { childId: 0, name: "Jordan Lee", weekPassed: 3, weekPoints: 45, weekBooks: ["Wonder", "Holes", "Frindle"], totalPoints: 320, monthRank: 3, monthPoints: 85, pointsToNext: 15, band: "6-8", lastPassedAt: null };

/**
 * A child's place on this month's leaderboard, among readers in the same grade band (everyone, when the
 * child has no grade). `entries` is the month's leaderboard, most points first.
 */
export function monthStanding(entries: { id: number; totalPoints: number }[], childId: number, bandOf: (id: number) => string | null): Pick<ChildProgress, "monthRank" | "monthPoints" | "pointsToNext" | "band"> {
  const band = bandOf(childId);
  const group = entries.filter((e) => Number(e.totalPoints) > 0 && (!band || bandOf(e.id) === band)).sort((a, b) => b.totalPoints - a.totalPoints);
  const at = group.findIndex((e) => e.id === childId);
  if (at < 0) return { monthRank: null, monthPoints: 0, pointsToNext: null, band };
  const mine = group[at].totalPoints;
  // Readers with the same points share a place.
  const rank = group.findIndex((e) => e.totalPoints === mine) + 1;
  const above = group.slice(0, rank - 1).reverse().find((e) => e.totalPoints > mine);
  return { monthRank: rank, monthPoints: mine, pointsToNext: above ? Math.round((above.totalPoints - mine + 1) * 10) / 10 : null, band };
}
