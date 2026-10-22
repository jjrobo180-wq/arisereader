// Health Nudges: motivation, science, tips and tiny challenges for your health goals, at a tone you choose.
// The same pure functions run in the app (to show today's feed) and on the server (to send the phone
// notification), so what the phone says is exactly what the app shows, with nothing stored per message.
//
// How it avoids repeating: each goal has its own pool of lines per kind plus a shared pool (healthNudgesUniversal).
// Messages walk through a pool in a scrambled but fixed order and only come back to a line after using all the
// others. On top of that every line is wrapped in a lead-in and a closer from the chosen level, so the same
// line reads differently each time it returns.

import { GOALS, type Goal } from "./healthNudgesContent";
import { UNIVERSAL } from "./healthNudgesUniversal";
import { LEVELS, VOICE, type Level } from "./healthNudgesVoice";
import { localParts } from "./hubReminders";
import { spreadTimes, toMinutes } from "./todoNotify";

export { GOALS, LEVELS };
export type { Goal, Level };
export type NudgeKind = "core" | "tip" | "fact" | "act";
export const KIND_LABEL: Record<NudgeKind, string> = { core: "Motivation", tip: "Tip", fact: "Science", act: "Challenge" };
export const KINDS: NudgeKind[] = ["core", "tip", "fact", "act"];

export type NudgeData = {
  goals: string[];
  level: Level;
  perDay: number;
  from: string;
  until: string;
  days: number[]; // 0 = Sunday … 6 = Saturday
  kinds: Record<NudgeKind, boolean>;
  paused: boolean;
  push: boolean; // also send to this account's phones
  seed: number; // so two people with the same goals don't get the same order
  seen: Record<string, number>; // day -> how many of that day's nudges were opened (for the little streak)
};

export const NUDGE_URL = "/#/pro?app=health-nudges";
export const MIN_GAP_MINUTES = 30;
export const NUDGE_WINDOW_MINUTES = 20;
export const MAX_PER_DAY = 12;
export const MAX_GOALS = 8;

export const DEFAULT_NUDGES: NudgeData = {
  goals: [], level: 2, perDay: 4, from: "08:00", until: "20:00", days: [0, 1, 2, 3, 4, 5, 6],
  kinds: { core: true, tip: true, fact: true, act: true }, paused: false, push: false, seed: 0, seen: {},
};

const GOAL_IDS = new Set(GOALS.map((g) => g.id));
const HM = /^([01]?\d|2[0-3]):[0-5]\d$/;
const pad = (n: number) => String(n).padStart(2, "0");
const normHM = (v: unknown, fallback: string) => {
  const s = String(v ?? "");
  if (!HM.test(s)) return fallback;
  const [h, m] = s.split(":");
  return `${pad(Number(h))}:${m}`;
};

/** How many a day fit between two times with at least MIN_GAP_MINUTES between them. */
export function maxPerDay(from: string, until: string): number {
  const span = toMinutes(until) - toMinutes(from);
  return Math.max(1, Math.min(MAX_PER_DAY, span > 0 ? Math.floor(span / MIN_GAP_MINUTES) + 1 : 1));
}

/** Anything saved or typed, made safe. Unknown goals drop out, times are fixed, counts are limited. */
export function cleanNudgeData(raw: unknown): NudgeData {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, any>;
  const goals = Array.from(new Set((Array.isArray(r.goals) ? r.goals : []).map(String).filter((id) => GOAL_IDS.has(id)))).slice(0, MAX_GOALS);
  const level = ([1, 2, 3, 4, 5] as Level[]).includes(Number(r.level) as Level) ? (Number(r.level) as Level) : DEFAULT_NUDGES.level;
  let from = normHM(r.from, DEFAULT_NUDGES.from);
  let until = normHM(r.until, DEFAULT_NUDGES.until);
  if (toMinutes(until) <= toMinutes(from)) { from = DEFAULT_NUDGES.from; until = DEFAULT_NUDGES.until; }
  const perDay = Math.max(1, Math.min(maxPerDay(from, until), Math.round(Number(r.perDay)) || DEFAULT_NUDGES.perDay));
  const days = Array.from(new Set((Array.isArray(r.days) ? r.days : DEFAULT_NUDGES.days).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort();
  const kinds = { ...DEFAULT_NUDGES.kinds };
  for (const k of KINDS) if (r.kinds && typeof r.kinds[k] === "boolean") kinds[k] = r.kinds[k];
  if (!KINDS.some((k) => kinds[k])) kinds.core = true;
  const seen: Record<string, number> = {};
  if (r.seen && typeof r.seen === "object") for (const [day, n] of Object.entries(r.seen).slice(-120)) if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Number(n))) seen[day] = Math.max(0, Math.min(MAX_PER_DAY, Math.round(Number(n))));
  return { goals, level, perDay, from, until, days, kinds, paused: r.paused === true, push: r.push === true, seed: Math.abs(Math.round(Number(r.seed))) % 100000 || 0, seen };
}

// ─── The picker ───────────────────────────────────────────────────────────────────────────────

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/** A step through 0..n-1 that visits every position before repeating (it shares no factor with n). */
const stepFor = (n: number, seed: number) => { if (n <= 2) return 1; let s = (seed % (n - 1)) + 1; while (gcd(s, n) !== 1) s = (s % (n - 1)) + 1; return s; };
/** The nth pick from a pool: a fixed scrambled walk through all of it, so a line is only used again after every
 *  other line has been. `shift` moves the walk on at each lap so what's paired with a line changes when it returns. */
function pick<T>(pool: T[], n: number, key: string, shift = 0): T {
  const N = pool.length;
  return pool[(hash(key) % N + (n % N) * stepFor(N, hash(`${key}:step`)) + shift) % N];
}

// What a goal's messages look like in order: mostly motivation, with a tip, a fact and a challenge between.
const CYCLE: NudgeKind[] = ["core", "tip", "core", "fact", "core", "act"];

function poolOf(goal: Goal, kind: NudgeKind): string[] { return [...goal[kind], ...UNIVERSAL[kind]]; }

export type Nudge = { goal: string; kind: NudgeKind; title: string; body: string; text: string };

/** The nth nudge for a goal, in a level's voice. `n` counts that goal's own messages. */
export function composeNudge(goal: Goal, level: Level, n: number, kinds: Record<NudgeKind, boolean> = DEFAULT_NUDGES.kinds): Nudge {
  const cycle = CYCLE.filter((k) => kinds[k]);
  const order = cycle.length ? cycle : (["core"] as NudgeKind[]);
  const kind = order[n % order.length];
  // How many of this kind came before, so each kind walks its own pool one line at a time.
  const lapIdx = Math.floor(n / order.length), perLap = order.filter((k) => k === kind).length;
  const before = order.slice(0, n % order.length).filter((k) => k === kind).length;
  const m = lapIdx * perLap + before;

  const voice = VOICE[level];
  const lines = poolOf(goal, kind);
  const lap = Math.floor(m / lines.length);
  const line = pick(lines, m, `${goal.id}:${kind}:line`);
  const lead = pick(kind === "core" ? voice.open : voice[kind], m, `${goal.id}:${kind}:${level}:lead`, lap * 3);
  const closeWanted = kind === "core" || kind === "act" || (m + lap) % 2 === 0;
  const close = closeWanted ? pick(voice.close, m, `${goal.id}:${kind}:${level}:close`, lap * 5 + 1) : "";
  const body = [lead, line, close].filter(Boolean).join(" ");
  return { goal: goal.id, kind, title: `${goal.emoji} ${goal.label} · ${KIND_LABEL[kind]}`, body, text: body };
}

// ─── The day ──────────────────────────────────────────────────────────────────────────────────

const dayNumber = (date: string) => { const [y, m, d] = date.split("-").map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000); };
const weekdayOf = (date: string) => (dayNumber(date) + 4) % 7; // 1970-01-01 was a Thursday

/** Times of day the nudges go out, spread across the active hours. */
export function slotTimes(data: NudgeData): string[] {
  const n = Math.max(1, Math.min(data.perDay, maxPerDay(data.from, data.until)));
  return spreadTimes(data.from, data.until, n);
}

export type DayNudge = Nudge & { slot: number; time: string; key: string };

/** Everything planned for one date (YYYY-MM-DD), whether or not its time has come. Empty when paused,
 *  on a day that's switched off, or with no goals picked. */
export function nudgesOn(data: NudgeData, date: string): DayNudge[] {
  const goals = data.goals.map((id) => GOALS.find((g) => g.id === id)).filter((g): g is Goal => !!g);
  if (data.paused || !goals.length || !data.days.includes(weekdayOf(date))) return [];
  const times = slotTimes(data);
  const base = dayNumber(date) * times.length + data.seed;
  return times.map((time, slot) => {
    const c = base + slot;
    const goal = goals[c % goals.length];
    const nudge = composeNudge(goal, data.level, Math.floor(c / goals.length), data.kinds);
    return { ...nudge, slot, time, key: `nudge:${date}:${slot}` };
  });
}

export type DueNudge = { key: string; title: string; body: string; url: string };

/** What to send to a phone right now. A slot is due for NUDGE_WINDOW_MINUTES after its time and is only sent once. */
export function dueNudges(rawData: unknown, nowMs: number, timeZone: string, sent: Record<string, number> = {}): DueNudge[] {
  const data = cleanNudgeData(rawData);
  if (!data.push || data.paused) return [];
  const { date, minutes } = localParts(nowMs, timeZone);
  return nudgesOn(data, date)
    .filter((n) => !sent[n.key] && minutes >= toMinutes(n.time) && minutes < toMinutes(n.time) + NUDGE_WINDOW_MINUTES)
    .slice(0, 1)
    .map((n) => ({ key: n.key, title: n.title, body: n.body, url: NUDGE_URL }));
}

/** One-line description of how often, for the screen. */
export function describeSchedule(data: NudgeData): string {
  const t = (hm: string) => { const [h, m] = hm.split(":").map(Number); return `${h % 12 || 12}${m ? `:${pad(m)}` : ""} ${h >= 12 ? "PM" : "AM"}`; };
  return `${data.perDay} a day · ${t(data.from)} to ${t(data.until)}`;
}
