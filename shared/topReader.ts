// The Top Reader Challenge: after the Advisory Challenge, students race one by one. Every student
// starts at zero on the first day, and the two students who earn the most reading points by the end
// of the last day each win a $5 gift card or snacks. Points are the same points as everywhere else
// (a passed book quiz adds the book's points, plus points a teacher gives), counted only inside the
// challenge's days. Days are the school's days (Mountain Time), like the Advisory Challenge's.
import { advisoriesForSchool } from "./advisories";
import { dayLabel, dayStartMs, nextDay } from "./advisoryChallenge";

export type TopReaderChallenge = {
  id: string;
  title: string;
  /** The first day: points earned from midnight count ("YYYY-MM-DD"). */
  starts: string;
  /** The last day points count; it ends at midnight after it. */
  lastDay: string;
  /** The day the winners get their prizes. */
  prizeDay: string;
  /** The winners are still shown through the end of this day, then it goes away. */
  showUntil: string;
  /** How many students win. */
  winners: number;
  prize: string;
};

/** Conservatory Green Middle School, Monday Nov 23 to Monday Nov 30, 2026. */
export const CGMS_TOP_READER_NOV_2026: TopReaderChallenge = {
  id: "cgms-top-reader-nov-2026",
  title: "Top Reader Challenge",
  starts: "2026-11-23",
  lastDay: "2026-11-30",
  prizeDay: "2026-12-01",
  showUntil: "2026-12-04",
  winners: 2,
  prize: "a $5 gift card or snacks (chips, candy and a drink)",
};

/** The Top Reader Challenge at a school (found by its name), if any: the schools with advisories. */
export function topReaderForSchool(schoolName: string): TopReaderChallenge | null {
  return advisoriesForSchool(schoolName).length ? CGMS_TOP_READER_NOV_2026 : null;
}

export type TopReaderPhase = "soon" | "live" | "over" | "done";

/** When points count: from midnight on the first day to midnight after the last. */
export function topReaderWindow(c: TopReaderChallenge) {
  return { fromMs: dayStartMs(c.starts), endMs: dayStartMs(nextDay(c.lastDay)), fromDay: c.starts, endDayExclusive: nextDay(c.lastDay) };
}

/** Before it starts, while it runs, after it ends (winners shown through `showUntil`), and after that. */
export function topReaderPhase(c: TopReaderChallenge, now = Date.now()): TopReaderPhase {
  const w = topReaderWindow(c);
  if (now < w.fromMs) return "soon";
  if (now < w.endMs) return "live";
  if (now < dayStartMs(nextDay(c.showUntil))) return "over";
  return "done";
}

/** Whole days left after today (0 on the last day). */
export function topReaderDaysLeft(c: TopReaderChallenge, now = Date.now()): number {
  return Math.max(0, Math.ceil((topReaderWindow(c).endMs - now) / 86_400_000) - 1);
}

/** The first day: whether `now` is on it (for "starts today!"). */
export function isFirstDay(c: TopReaderChallenge, now = Date.now()): boolean {
  return now >= dayStartMs(c.starts) && now < dayStartMs(nextDay(c.starts));
}

export type Racer = { id: number; name: string; grade: string; points: number; passed: number };
export type RacerRow = Omit<Racer, "id"> & { rank: number; id?: number };

/** Students with points, most first. Students with the same points share a place; the board only
 *  lists students who have scored. */
export function rankRacers(racers: readonly Racer[]): Array<Racer & { rank: number }> {
  const rows = racers
    .map((r) => ({ ...r, points: Math.round((r.points || 0) * 10) / 10 }))
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name) || a.id - b.id);
  let rank = 0;
  return rows.map((r, i) => {
    if (i === 0 || r.points !== rows[i - 1].points) rank = i + 1;
    return { ...r, rank };
  });
}

/** The students in a winning place (rank 1 to `winners`). More than `winners` when there's a tie for the last prize. */
export function topReaderWinners<T extends { rank: number; points: number }>(rows: readonly T[], winners: number): T[] {
  return rows.filter((r) => r.rank <= winners && r.points > 0);
}

/** "Monday, November 23 to Monday, November 30" in short form: "Nov 23 – Nov 30". */
export function topReaderDates(c: TopReaderChallenge): string {
  return `${dayLabel(c.starts, true)} – ${dayLabel(c.lastDay, true)}`;
}

/** What GET /api/top-reader sends. `standings` holds the top of the board (all of it for staff). */
export type TopReaderView = {
  challenge: (TopReaderChallenge & { phase: TopReaderPhase; daysLeft: number; firstDay: boolean; endMs: number }) | null;
  standings: RacerRow[];
  /** How many students at the school have scored. */
  racers: number;
  /** The viewer's own place (students), or their child's (parents). */
  mine: { name: string; rank: number | null; points: number; passed: number } | null;
};

/** How it works, in one or two sentences, for the phase it's in. */
export function topReaderText(v: TopReaderView, now = Date.now()): string {
  const c = v.challenge;
  if (!c) return "";
  const rule = `The ${c.winners} students with the most reading points each win ${c.prize}. Every quiz you pass adds the book's points.`;
  if (c.phase === "soon") return `Starts ${dayLabel(c.starts)}. Everyone starts at 0. ${rule}`;
  if (c.phase === "live") {
    const left = c.daysLeft === 0 ? "Last day! It ends tonight at midnight." : `${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left. Ends ${dayLabel(c.lastDay)} at midnight.`;
    return `${c.firstDay ? `Starts today! Everyone is at 0 until ${dayLabel(c.lastDay)}. ` : ""}${left} ${rule}`;
  }
  const won = topReaderWinners(v.standings, c.winners);
  if (!won.length) return "The challenge is over. No one scored, so there are no winners.";
  const names = won.map((w) => w.name);
  const list = names.length < 2 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  const tie = won.length > c.winners ? " (a tie for a prize)" : "";
  const when = now < dayStartMs(nextDay(c.prizeDay)) && now >= dayStartMs(c.prizeDay) ? "today" : now < dayStartMs(c.prizeDay) ? `on ${dayLabel(c.prizeDay)}` : "";
  return `The challenge is over. ${list} won${tie}! Prizes: ${c.prize}${when ? `, given out ${when}` : ""}.`;
}
