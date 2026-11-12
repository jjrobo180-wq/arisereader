// Arise WorkHub, IEP: the Prep checklist. The jobs a case manager does in planning periods, as a list
// that comes back on its own: collect the unmodified work from a teacher, make the modified version of
// a lesson, make worksheets for Math Lab A and B, put in data. Each job repeats (every school day, on
// the days picked, every 2 weeks, every month) or is once, and is checked off day by day.
// Saved in the workspace as `prepChecks` (see shared/teacherHub.ts).
import { addDays, addMonths } from "./hubDates";

export const PREP_REPEATS = ["schooldays", "days", "biweekly", "monthly", "once"] as const;
export type PrepRepeat = (typeof PREP_REPEATS)[number];
export const PREP_REPEAT_LABELS: Record<PrepRepeat, string> = {
  schooldays: "Every school day",
  days: "Days I pick",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
  once: "Just once",
};

export const PREP_KINDS = ["collect", "modify", "make", "input", "other"] as const;
export type PrepKind = (typeof PREP_KINDS)[number];
export const PREP_KIND_LABELS: Record<PrepKind, string> = {
  collect: "Collect", modify: "Modify", make: "Make", input: "Input", other: "Other",
};

/** Mon=1 … Fri=5 (Sat=6, Sun=0), like Date.getUTCDay. */
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type PrepCheck = {
  id: string;
  title: string;
  kind: PrepKind;
  /** Whose class or paper it's for ("Ms. Kast", "Math Lab A"). */
  who: string;
  note: string;
  repeat: PrepRepeat;
  /** For "days" and "biweekly": the weekdays (0–6). */
  days: number[];
  /** First day it's due (YYYY-MM-DD). For "monthly", its day of the month is the one each month. */
  start: string;
  /** Optional last day. */
  until: string;
  /** The days it was checked off. */
  done: string[];
  /** Turned off for now, without deleting it. */
  paused: boolean;
  createdAt: string;
};

/** Quick starts that match the work: tap one, change the teacher or class, save. */
export const PREP_TEMPLATES: { title: string; kind: PrepKind; who: string; repeat: PrepRepeat; days?: number[] }[] = [
  { title: "Collect unmodified paper", kind: "collect", who: "", repeat: "days", days: [1, 3] },
  { title: "Make the modified version of the lesson", kind: "modify", who: "", repeat: "days", days: [2, 4] },
  { title: "Create worksheets for Math Lab A", kind: "make", who: "Math Lab A", repeat: "days", days: [5] },
  { title: "Create worksheets for Math Lab B", kind: "make", who: "Math Lab B", repeat: "days", days: [5] },
  { title: "Input grades and progress data", kind: "input", who: "", repeat: "days", days: [5] },
  { title: "Print accommodations for teachers", kind: "other", who: "", repeat: "monthly" },
];

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DONE = 400;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const isSchoolDay = (date: string) => { const d = weekdayOf(date); return d >= 1 && d <= 5; };

/** A saved list, made safe: bad entries dropped, every field the right shape. */
export function cleanPrepChecks(raw: unknown): PrepCheck[] {
  if (!Array.isArray(raw)) return [];
  const out: PrepCheck[] = [];
  const seen = new Set<string>();
  for (const r of raw.slice(0, 300)) {
    if (!r || typeof r !== "object") continue;
    const id = str((r as any).id, 80);
    const title = str((r as any).title, 160);
    const start = str((r as any).start, 10);
    if (!id || seen.has(id) || !title || !DAY.test(start)) continue;
    seen.add(id);
    const repeat = (PREP_REPEATS as readonly string[]).includes((r as any).repeat) ? (r as any).repeat as PrepRepeat : "once";
    const kind = (PREP_KINDS as readonly string[]).includes((r as any).kind) ? (r as any).kind as PrepKind : "other";
    const days = Array.isArray((r as any).days) ? [...new Set(((r as any).days as unknown[]).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [];
    const until = str((r as any).until, 10);
    const done = Array.isArray((r as any).done) ? [...new Set(((r as any).done as unknown[]).filter((d): d is string => typeof d === "string" && DAY.test(d)))].sort().slice(-MAX_DONE) : [];
    out.push({
      id, title, kind, repeat, start, done,
      who: str((r as any).who, 80), note: str((r as any).note, 600),
      days: (repeat === "days" || repeat === "biweekly") && !days.length ? [weekdayOf(start)] : days,
      until: DAY.test(until) ? until : "",
      paused: (r as any).paused === true,
      createdAt: str((r as any).createdAt, 40),
    });
  }
  return out;
}

/** Is this job due on this day? */
export function prepDueOn(c: PrepCheck, date: string): boolean {
  if (c.paused || !DAY.test(date) || date < c.start || (c.until && date > c.until)) return false;
  switch (c.repeat) {
    case "once": return date === c.start;
    case "schooldays": return isSchoolDay(date);
    case "days": return c.days.includes(weekdayOf(date));
    case "biweekly": {
      if (!c.days.includes(weekdayOf(date))) return false;
      // Weeks counted from the Monday of the start week: due in weeks 0, 2, 4…
      const monday = (d: string) => addDays(d, -((weekdayOf(d) + 6) % 7));
      const weeks = Math.round((Date.parse(`${monday(date)}T12:00:00Z`) - Date.parse(`${monday(c.start)}T12:00:00Z`)) / (7 * 86_400_000));
      return weeks % 2 === 0;
    }
    case "monthly": {
      // The start's day of the month; the last day in shorter months (the 31st falls on the 30th in November).
      const months = (Number(date.slice(0, 4)) - Number(c.start.slice(0, 4))) * 12 + (Number(date.slice(5, 7)) - Number(c.start.slice(5, 7)));
      return months >= 0 && addMonths(c.start, months) === date;
    }
  }
}

export const prepDone = (c: PrepCheck, date: string) => c.done.includes(date);

/** Checks the job off on that day, or takes the check away. */
export function togglePrep(c: PrepCheck, date: string): PrepCheck {
  const done = c.done.includes(date) ? c.done.filter((d) => d !== date) : [...c.done, date].sort().slice(-MAX_DONE);
  return { ...c, done };
}

export type PrepItem = { check: PrepCheck; date: string; done: boolean };

/** Everything due on one day, not done first, in the order they were made. */
export function prepForDay(list: PrepCheck[], date: string): PrepItem[] {
  return list.filter((c) => prepDueOn(c, date)).map((check) => ({ check, date, done: prepDone(check, date) }))
    .sort((a, b) => Number(a.done) - Number(b.done));
}

/** Jobs from the last `days` days (today not included) that were never checked off. A one-time job stays until it's done. */
export function prepMissed(list: PrepCheck[], today: string, days = 7): PrepItem[] {
  const out: PrepItem[] = [];
  for (const c of list) {
    if (c.paused) continue;
    if (c.repeat === "once") { if (c.start < today && !prepDone(c, c.start)) out.push({ check: c, date: c.start, done: false }); continue; }
    for (let n = days; n >= 1; n--) {
      const date = addDays(today, -n);
      if (prepDueOn(c, date) && !prepDone(c, date)) out.push({ check: c, date, done: false });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** The next day it's due, from `from` on (included), within a year. "" when none. */
export function prepNextDue(c: PrepCheck, from: string): string {
  for (let n = 0; n < 370; n++) { const d = addDays(from, n); if (c.until && d > c.until) return ""; if (prepDueOn(c, d)) return d; }
  return "";
}

/** "Mon, Wed", "Every school day", "Every month on the 12th"… */
export function prepRepeatWords(c: PrepCheck): string {
  const days = c.days.map((d) => WEEKDAY_SHORT[d]).join(", ");
  switch (c.repeat) {
    case "schooldays": return "Every school day";
    case "days": return days || "Days I pick";
    case "biweekly": return `Every 2 weeks · ${days}`;
    case "monthly": { const n = Number(c.start.slice(8, 10)); const th = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"; return `Every month on the ${n}${th}`; }
    case "once": return "Once";
  }
}

/** Done out of due over the last 5 school days, for a small "this week" count. */
export function prepWeekScore(list: PrepCheck[], today: string): { done: number; due: number } {
  let done = 0, due = 0;
  for (let n = 0; n < 7; n++) {
    const date = addDays(today, -n);
    for (const c of list) if (prepDueOn(c, date)) { due++; if (prepDone(c, date)) done++; }
  }
  return { done, due };
}
