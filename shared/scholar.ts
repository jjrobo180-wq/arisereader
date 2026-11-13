// AriseScholar: an academic leaderboard. Teachers tap to give a student a point for finished work,
// participation or staying focused; students race on one board for their school. It counts
// academics and participation only, never behavior, and it never takes points away.
import { SCHOOL_TIME_ZONE } from "./schoolMonth";

export type ScholarCategory = { id: string; label: string; short: string; emoji: string };
export const SCHOLAR_CATEGORIES: readonly ScholarCategory[] = [
  { id: "work", label: "Work completed", short: "Work", emoji: "📘" },
  { id: "participation", label: "Participation", short: "Participated", emoji: "🙋" },
  { id: "focused", label: "Focused", short: "Focused", emoji: "🎯" },
];
export const categoryById = (id: string) => SCHOLAR_CATEGORIES.find((c) => c.id === id) || null;

/** Each tap is one point. */
export const POINTS_PER_TAP = 1;
/** One teacher can give one student the same kind of point at most this many times a day. */
export const MAX_SAME_PER_DAY = 5;
/** A teacher can take back their own tap for this long. */
export const UNDO_MS = 24 * 3_600_000;

export type ScholarPeriod = "week" | "month" | "year";
export const PERIODS: readonly { id: ScholarPeriod; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
];

export type ScholarEvent = { id: string; teacher_id: number; student_id: number; school_id: number; category: string; points: number; created_at: string };
export type BoardRow = { rank: number; studentId: number; name: string; points: number; work: number; participation: number; focused: number };

/** The school-day parts of a moment, in the school's time zone. */
function schoolParts(ms: number, timeZone = SCHOOL_TIME_ZONE) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
    .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(String(p.weekday)) };
}
const pad = (n: number) => String(n).padStart(2, "0");
const dayString = (y: number, m: number, d: number) => { const t = new Date(Date.UTC(y, m - 1, d)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };

/** The school day ("YYYY-MM-DD") a moment falls on. */
export function schoolDay(ms: number, timeZone = SCHOOL_TIME_ZONE): string {
  const { y, m, d } = schoolParts(ms, timeZone);
  return dayString(y, m, d);
}

/** The first school day counted in a period: the week starts Monday, the school year August 1. */
export function periodStartDay(period: ScholarPeriod, ms: number, timeZone = SCHOOL_TIME_ZONE): string {
  const { y, m, d, wd } = schoolParts(ms, timeZone);
  if (period === "week") return dayString(y, m, d - ((wd + 6) % 7));
  if (period === "month") return dayString(y, m, 1);
  return dayString(m >= 8 ? y : y - 1, 8, 1);
}

/** First name and last initial, so the board never shows full names. */
export function boardName(full: string): string {
  const p = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "Student";
  return p.length > 1 ? `${p[0]} ${p[p.length - 1][0].toUpperCase()}.` : p[0];
}

/** Rank students by points (ties share a rank; fewer points, lower). Students with no points are left off. */
export function buildBoard(events: ScholarEvent[], names: Map<number, string>): BoardRow[] {
  const by = new Map<number, BoardRow>();
  for (const e of events) {
    if (!names.has(e.student_id)) continue;
    const r = by.get(e.student_id) ?? { rank: 0, studentId: e.student_id, name: boardName(names.get(e.student_id) || ""), points: 0, work: 0, participation: 0, focused: 0 };
    r.points += e.points;
    if (e.category === "work" || e.category === "participation" || e.category === "focused") r[e.category] += e.points;
    by.set(e.student_id, r);
  }
  const rows = [...by.values()].filter((r) => r.points > 0).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  rows.forEach((r, i) => { r.rank = i > 0 && rows[i - 1].points === r.points ? rows[i - 1].rank : i + 1; });
  return rows;
}
