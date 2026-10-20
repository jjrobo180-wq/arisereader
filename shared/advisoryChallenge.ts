// The Advisory Challenge: a school's advisories race for reading points, and the advisory with the
// most points at the end wins a prize. Points a student earns from the day the challenge starts
// counting (which can be before it officially starts) to the end of its last day are added to their
// advisory's total. Days are the school's days (Mountain Time), like the monthly leaderboard's months.
import { advisoriesForSchool, advisoryName, type Advisory } from "./advisories";
import { SCHOOL_TIME_ZONE } from "./schoolMonth";

export type Challenge = {
  id: string;
  title: string;
  /** Points earned from the start of this day count ("YYYY-MM-DD"). */
  countsFrom: string;
  /** The day the challenge officially starts. */
  starts: string;
  /** The last day points count; the challenge ends at midnight after it. */
  lastDay: string;
  /** The day the winning advisory gets its prize. */
  prizeDay: string;
  prize: string;
};

/** Conservatory Green Middle School's fall challenge. Everyone starts at zero on Oct 20. */
export const CGMS_FALL_2026: Challenge = {
  id: "cgms-fall-2026",
  title: "Advisory Challenge",
  countsFrom: "2026-10-20",
  starts: "2026-10-20",
  lastDay: "2026-11-19",
  prizeDay: "2026-11-20",
  prize: "a pizza party",
};

/** The challenge running at a school (found by its name), if any. */
export function challengeForSchool(schoolName: string): Challenge | null {
  return advisoriesForSchool(schoolName).length ? CGMS_FALL_2026 : null;
}

const offsetMinutes = (ms: number, timeZone: string) => {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
    .formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName")?.value || "GMT";
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0)) : 0;
};

/** Midnight at the start of a day ("YYYY-MM-DD") in the school's time zone. */
export function dayStartMs(day: string, timeZone = SCHOOL_TIME_ZONE): number {
  const [y, m, d] = day.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  // The offset at noon that day: the clocks change at 2 am, so noon has the day's own offset.
  return utcMidnight - offsetMinutes(utcMidnight + 12 * 3_600_000, timeZone) * 60_000;
}

/** The day after "YYYY-MM-DD". */
export function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** When points start and stop counting. */
export function challengeWindow(c: Challenge) {
  return { fromMs: dayStartMs(c.countsFrom), endMs: dayStartMs(nextDay(c.lastDay)), fromDay: c.countsFrom, endDayExclusive: nextDay(c.lastDay) };
}

export type ChallengePhase = "soon" | "live" | "over" | "done";

/** Before it starts, while it runs, after it ends (through the prize day), and after that. */
export function challengePhase(c: Challenge, now = Date.now()): ChallengePhase {
  if (now < dayStartMs(c.starts)) return "soon";
  if (now < challengeWindow(c).endMs) return "live";
  if (now < dayStartMs(nextDay(c.prizeDay))) return "over";
  return "done";
}

/** "Tuesday, October 20" (or "Oct 20" when short). */
export function dayLabel(day: string, short = false): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", short
    ? { timeZone: "UTC", month: "short", day: "numeric" }
    : { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Whole days left until the challenge ends (0 on its last day). */
export function daysLeft(c: Challenge, now = Date.now()): number {
  return Math.max(0, Math.ceil((challengeWindow(c).endMs - now) / 86_400_000) - 1);
}

/** `books`: quizzes the advisory's students took during the challenge ("books read"). */
export type Standing = { rank: number; name: string; grade: string; room: string; students: number; points: number; books: number };

/** Advisories ranked by points, most first. Advisories with the same points share a place. */
export function rankAdvisories(advisories: readonly Advisory[], studentAdvisory: ReadonlyMap<number, string>, points: ReadonlyMap<number, number>, books: ReadonlyMap<number, number> = new Map()): Standing[] {
  const rows = advisories.map((a) => ({ name: advisoryName(a), grade: a.grade || "", room: a.room || "", students: 0, points: 0, books: 0 }));
  const byName = new Map(rows.map((r) => [r.name, r]));
  for (const [studentId, name] of studentAdvisory) {
    const row = byName.get(name);
    if (!row) continue;
    row.students += 1;
    row.points += points.get(studentId) || 0;
    row.books += books.get(studentId) || 0;
  }
  for (const r of rows) r.points = Math.round(r.points * 10) / 10;
  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || r.points !== rows[i - 1].points) rank = i + 1;
    return { rank, ...r };
  });
}

/** "1st", "2nd", "3rd", "11th". */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] || "th"}`;
}

/** What the challenge payload looks like to the site. */
export type ChallengeView = {
  challenge: (Challenge & { phase: ChallengePhase; daysLeft: number }) | null;
  standings: Standing[];
  /** The viewer's advisory and their own points in the challenge (students only). */
  mine: { advisory: string | null; rank: number | null; points: number } | null;
};
