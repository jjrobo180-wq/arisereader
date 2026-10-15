// Weekly free times. A teacher or staff member saves the times they are usually free,
// and meeting polls compare the offered times against them.
import type { PollAnswer, PollOption } from "./meetingPoll";

export type FreeWindow = { day: number; start: string; end: string };
export const AVAILABILITY_LIMIT = 40;
export const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

/** Saved free times made safe: real days, real times, start before end, no more than the limit. */
export function cleanWeekly(raw: unknown): FreeWindow[] {
  if (!Array.isArray(raw)) return [];
  const out: FreeWindow[] = [];
  for (const w of raw) {
    const day = Number((w as any)?.day), start = String((w as any)?.start ?? ""), end = String((w as any)?.end ?? "");
    if (!Number.isInteger(day) || day < 0 || day > 6 || !TIME.test(start) || !TIME.test(end) || minutes(start) >= minutes(end)) continue;
    out.push({ day, start, end });
    if (out.length >= AVAILABILITY_LIMIT) break;
  }
  return out.sort((a, b) => a.day - b.day || minutes(a.start) - minutes(b.start));
}

export type Fit = "free" | "partly" | "busy" | "unknown";

/** Is someone with these weekly free times free for this offered time? */
export function fitOption(weekly: FreeWindow[], option: Pick<PollOption, "date" | "start" | "end">): Fit {
  if (!weekly.length || !TIME.test(option.start || "")) return "unknown";
  const d = new Date(`${option.date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "unknown";
  const from = minutes(option.start);
  const to = TIME.test(option.end || "") && minutes(option.end) > from ? minutes(option.end) : from + 60;
  const today = weekly.filter((w) => w.day === d.getUTCDay());
  if (today.some((w) => minutes(w.start) <= from && minutes(w.end) >= to)) return "free";
  return today.some((w) => minutes(w.start) < to && minutes(w.end) > from) ? "partly" : "busy";
}

/** How someone's weekly availability fits a time, in the words the page uses. */
export const FIT_WORDS: Record<Exclude<Fit, "unknown">, string> = { free: "Usually available", partly: "Partly available", busy: "Usually busy" };

/** A starting set of answers from the weekly times: free is yes, partly free is maybe, busy is no. */
export function suggestAnswers(weekly: FreeWindow[], options: PollOption[]): Record<string, PollAnswer> {
  const out: Record<string, PollAnswer> = {};
  for (const o of options) {
    const fit = fitOption(weekly, o);
    if (fit !== "unknown") out[o.id] = fit === "free" ? "yes" : fit === "partly" ? "maybe" : "no";
  }
  return out;
}

// ─── Suggesting times from my free times ────────────────────────────────────

export type TimeSlot = { date: string; start: string; end: string };
type Busy = { date: string; start: string; end?: string };

const pad = (n: number) => String(n).padStart(2, "0");
const clock = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const nextDay = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Meeting times start on the hour or half hour (9:00, 9:30), never 8:50 or 9:15. */
export const TIME_STEP = 30;
/** Several times on the same day follow one another, so a short free window still offers more than one. */
const SAME_DAY_GAP = 0;
const snapUp = (m: number) => Math.ceil(m / TIME_STEP) * TIME_STEP;

/**
 * Times to offer in a poll, taken from the weekly free times, starting on the hour or half hour and skipping
 * anything that overlaps something already on the calendar. `perDay` (default 1) offers several different
 * times on the same day, so one day can have a morning and an afternoon choice. `through`
 * (inclusive) and `until` (exclusive, an IEP deadline) end the search; `count` is how many to return. With
 * `before` (a meeting date), days before it come first. `skip` moves on to the next set.
 */
export function suggestTimes(weekly: FreeWindow[], opts: { from: string; count?: number; minutes?: number; before?: string; busy?: Busy[]; skip?: number; until?: string; through?: string; perDay?: number }): TimeSlot[] {
  const free = cleanWeekly(weekly);
  const count = Math.max(1, Math.min(20, opts.count ?? 3));
  const perDay = Math.max(1, Math.min(6, opts.perDay ?? 1));
  const length = Math.max(15, Math.min(480, opts.minutes ?? 60));
  if (!free.length || Number.isNaN(Date.parse(`${opts.from}T12:00:00Z`))) return [];
  const found: TimeSlot[] = [];
  for (let i = 0; i < 120; i++) {
    const date = nextDay(opts.from, i);
    if (opts.through && date > opts.through) break;
    if (opts.until && date >= opts.until) break;
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    const taken = (opts.busy || []).filter((b) => b.date === date && TIME.test(b.start || "")).map((b) => [minutes(b.start), b.end && TIME.test(b.end) && minutes(b.end) > minutes(b.start) ? minutes(b.end) : minutes(b.start) + 60] as const);
    const today: TimeSlot[] = [];
    let nextFree = 0; // the earliest the next time that day may start
    for (const w of free.filter((x) => x.day === dow).sort((x, y) => minutes(x.start) - minutes(y.start))) {
      for (let s = snapUp(Math.max(minutes(w.start), nextFree)); s + length <= minutes(w.end) && today.length < perDay; s += TIME_STEP) {
        if (taken.some(([from, to]) => s < to && from < s + length)) continue;
        today.push({ date, start: clock(s), end: clock(s + length) });
        nextFree = s + length + SAME_DAY_GAP;
        s = snapUp(nextFree) - TIME_STEP; // the loop adds the step back
      }
    }
    found.push(...today);
    if (i >= 56 && found.length >= (opts.skip ?? 0) * count + count) break; // far enough ahead
  }
  const open = found;
  const ordered = opts.before ? [...open.filter((s) => s.date < opts.before!), ...open.filter((s) => s.date >= opts.before!)] : open;
  const from = (opts.skip ?? 0) * count;
  return ordered.slice(from, from + count);
}

/**
 * Every open time in the weekly free times, for a pick list: each day with all the hour and half-hour starts
 * that fit the meeting and don't overlap anything on the calendar. Same limits as suggestTimes
 * (`from`, `through` inclusive, `until` exclusive), up to `limit` times.
 */
export function openTimes(weekly: FreeWindow[], opts: { from: string; minutes?: number; busy?: Busy[]; until?: string; through?: string; days?: number; limit?: number }): TimeSlot[] {
  const free = cleanWeekly(weekly);
  const length = Math.max(15, Math.min(480, opts.minutes ?? 60));
  const limit = Math.max(1, Math.min(400, opts.limit ?? 150));
  if (!free.length || Number.isNaN(Date.parse(`${opts.from}T12:00:00Z`))) return [];
  const out: TimeSlot[] = [];
  for (let i = 0; i < (opts.days ?? 42) && out.length < limit; i++) {
    const date = nextDay(opts.from, i);
    if (opts.through && date > opts.through) break;
    if (opts.until && date >= opts.until) break;
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    const taken = (opts.busy || []).filter((b) => b.date === date && TIME.test(b.start || "")).map((b) => [minutes(b.start), b.end && TIME.test(b.end) && minutes(b.end) > minutes(b.start) ? minutes(b.end) : minutes(b.start) + 60] as const);
    const seen = new Set<number>();
    for (const w of free.filter((x) => x.day === dow).sort((x, y) => minutes(x.start) - minutes(y.start))) {
      for (let s = snapUp(minutes(w.start)); s + length <= minutes(w.end); s += TIME_STEP) {
        if (seen.has(s) || taken.some(([from, to]) => s < to && from < s + length)) continue;
        seen.add(s);
        out.push({ date, start: clock(s), end: clock(s + length) });
      }
    }
  }
  return out.slice(0, limit);
}
