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

export const FIT_WORDS: Record<Exclude<Fit, "unknown">, string> = { free: "Usually free", partly: "Partly free", busy: "Usually busy" };

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

/**
 * Times to offer in a poll, taken from the weekly free times: the first open stretch of each free day,
 * skipping anything that overlaps something already on the calendar. One time per day, so the choices are
 * spread out. With `before` (a meeting date), days before it come first. `skip` moves on to the next set.
 */
export function suggestTimes(weekly: FreeWindow[], opts: { from: string; count?: number; minutes?: number; before?: string; busy?: Busy[]; skip?: number }): TimeSlot[] {
  const free = cleanWeekly(weekly);
  const count = opts.count ?? 3;
  const length = Math.max(15, Math.min(480, opts.minutes ?? 60));
  if (!free.length || Number.isNaN(Date.parse(`${opts.from}T12:00:00Z`))) return [];
  const found: TimeSlot[] = [];
  for (let i = 0; i < 56; i++) {
    const date = nextDay(opts.from, i);
    const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
    const taken = (opts.busy || []).filter((b) => b.date === date && TIME.test(b.start || "")).map((b) => [minutes(b.start), b.end && TIME.test(b.end) && minutes(b.end) > minutes(b.start) ? minutes(b.end) : minutes(b.start) + 60] as const);
    let slot: TimeSlot | null = null;
    for (const w of free.filter((x) => x.day === dow)) {
      for (let s = minutes(w.start); s + length <= minutes(w.end) && !slot; s += 15) {
        if (!taken.some(([from, to]) => s < to && from < s + length)) slot = { date, start: clock(s), end: clock(s + length) };
      }
      if (slot) break;
    }
    if (slot) found.push(slot);
  }
  const ordered = opts.before ? [...found.filter((s) => s.date < opts.before!), ...found.filter((s) => s.date >= opts.before!)] : found;
  const from = (opts.skip ?? 0) * count;
  return ordered.slice(from, from + count);
}
