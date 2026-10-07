// Teacher Hub: dates the way a person says them ("Today", "Tomorrow", "Mon, Oct 12").
// All days are YYYY-MM-DD and are compared as calendar days, so a time zone never shifts them.

const DAY = 86_400_000;
const parse = (date: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date || "");
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const format = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Whole days from `from` to `to` (negative when `to` is earlier). null if either is not a day. */
export function daysBetween(from: string, to: string): number | null {
  const a = parse(from), b = parse(to);
  return a === null || b === null ? null : Math.round((b - a) / DAY);
}

export function addDays(date: string, days: number): string {
  const t = parse(date);
  return t === null ? "" : format(t + days * DAY);
}

/** Adds months, keeping to the end of a short month (Jan 31 + 1 month = Feb 28). */
export function addMonths(date: string, months: number): string {
  const t = parse(date);
  if (t === null) return "";
  const d = new Date(t);
  const target = d.getUTCMonth() + months;
  const last = new Date(Date.UTC(d.getUTCFullYear(), target + 1, 0)).getUTCDate();
  return format(Date.UTC(d.getUTCFullYear(), target, Math.min(d.getUTCDate(), last)));
}

/** "Today", "Tomorrow", "Yesterday", "Mon, Oct 12" (with the year when it is not this year). "" for no date. */
export function friendlyDate(date: string, today: string): string {
  const diff = daysBetween(today, date);
  if (diff === null) return "";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const d = new Date(parse(date)!);
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return d.toLocaleDateString("en-US", { weekday: diff > -7 && diff < 7 ? "long" : "short", month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
}

export type DueState = "none" | "overdue" | "today" | "soon" | "later";

/** How urgent a due date is: overdue, today, within the next 3 days (soon), or later. */
export function dueState(date: string, today: string): DueState {
  const diff = daysBetween(today, date);
  if (diff === null) return "none";
  return diff < 0 ? "overdue" : diff === 0 ? "today" : diff <= 3 ? "soon" : "later";
}

/** "3 days late", "in 5 days". */
export function relativeDays(date: string, today: string): string {
  const diff = daysBetween(today, date);
  if (diff === null) return "";
  if (diff === 0) return "today";
  const n = Math.abs(diff);
  const words = n >= 60 ? `${Math.round(n / 30)} months` : n >= 14 ? `${Math.round(n / 7)} weeks` : `${n} ${n === 1 ? "day" : "days"}`;
  return diff < 0 ? `${words} ago` : `in ${words}`;
}
