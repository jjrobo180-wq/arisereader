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
