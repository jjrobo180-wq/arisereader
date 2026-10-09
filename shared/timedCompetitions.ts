// Short competitions with their own leaderboard: only points earned between a start and an end
// time count. Each one has a page of its own at /#/<slug>.
//
// Points are counted the way the monthly leaderboard counts them: a passed book quiz earns that
// book's points, a passed eye-gaze quiz earns 10, and points a teacher awards count too.
import { SCHOOL_TIME_ZONE } from "./schoolMonth";

export type TimedCompetition = {
  /** The page is at /#/<slug>. */
  slug: string;
  title: string;
  /** What the winner gets, in a few words. */
  prize: string;
  /** Wall-clock times in the school's time zone: "2026-10-07" at "08:00". The end is not part of it. */
  start: { date: string; time: string };
  end: { date: string; time: string };
  timeZone: string;
};

export const FALL_BREAK: TimedCompetition = {
  slug: "fall-break",
  title: "Fall Break Competition",
  prize: "$5 cash or gift card",
  start: { date: "2026-10-07", time: "08:00" },
  end: { date: "2026-10-12", time: "08:00" },
  timeZone: SCHOOL_TIME_ZONE,
};

export const TIMED_COMPETITIONS: TimedCompetition[] = [FALL_BREAK];
export const timedCompetition = (slug: unknown): TimedCompetition | null => TIMED_COMPETITIONS.find((c) => c.slug === slug) || null;

/** A clock time in a time zone ("2026-10-07", "08:00", Denver) as a moment in time. */
export function zonedMs(date: string, time: string, timeZone = SCHOOL_TIME_ZONE): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(new Date(asUtc)).find((p) => p.type === "timeZoneName")?.value || "GMT";
  const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  const offsetMin = match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] || 0)) : 0;
  return asUtc - offsetMin * 60_000;
}

export type CompetitionWindow = { startMs: number; endMs: number };
export const competitionWindow = (c: TimedCompetition): CompetitionWindow => ({ startMs: zonedMs(c.start.date, c.start.time, c.timeZone), endMs: zonedMs(c.end.date, c.end.time, c.timeZone) });

/** soon: it has not started. live: points are counting now. over: it has ended, and the list is final. */
export type CompetitionPhase = "soon" | "live" | "over";
export function competitionPhase(c: TimedCompetition, nowMs: number): CompetitionPhase {
  const { startMs, endMs } = competitionWindow(c);
  return nowMs < startMs ? "soon" : nowMs < endMs ? "live" : "over";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** "Wednesday, Oct 7 at 8:00 AM" for a start or end. */
export function whenText(at: { date: string; time: string }): string {
  const [y, m, d] = at.date.split("-").map(Number);
  const [hh, mm] = at.time.split(":").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${MONTHS[m - 1]} ${d} at ${hh % 12 || 12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
}

// ─── Counting the points ────────────────────────────────────────────────────

/** A book quiz that was turned in. */
export type QuizRow = { userId: number; at: unknown; points: unknown; score: unknown; total: unknown; bookId?: unknown };
/** An eye-gaze quiz that was finished. A pass earns 10 points. */
export type EyeGazeRow = { userId: number; at: unknown; score: unknown; total: unknown };
/** Points a teacher awarded: `earnedOn` is the day the teacher gave them for, `at` is when they were entered. */
export type AwardRow = { userId: number; points: unknown; earnedOn: unknown; at: unknown };

export const EYE_GAZE_PASS_POINTS = 10;
const ms = (iso: unknown) => (typeof iso === "string" ? Date.parse(iso) : typeof iso === "number" ? iso : NaN);
const inWindow = (at: unknown, w: CompetitionWindow) => { const t = ms(at); return Number.isFinite(t) && t >= w.startMs && t < w.endMs; };
const passed = (row: { score: unknown; total: unknown }) => Number(row.total) > 0 && Number(row.score) >= Math.ceil(Number(row.total) * 0.7);

/**
 * Does a teacher's award count? It goes by the day the teacher gave it for. A day wholly inside the
 * competition counts. On the first and the last day, only part of the day is in the competition, so the
 * award counts when it was entered inside the competition's hours.
 */
export function awardCounts(award: Pick<AwardRow, "earnedOn" | "at">, c: TimedCompetition): boolean {
  const day = String(award.earnedOn ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < c.start.date || day > c.end.date) return false;
  return day > c.start.date && day < c.end.date ? true : inWindow(award.at, competitionWindow(c));
}

export type Standing = {
  userId: number;
  /** Points earned inside the competition. */
  points: number;
  quizzesPassed: number;
  quizzesTaken: number;
  /** When the student last earned points in it (for telling tied students apart). */
  lastScoredAt: number;
  /** 1 for the leader. Students with the same points share a rank. */
  rank: number;
  tied: boolean;
};

/**
 * Who earned what inside the competition, most points first. Students with no points (or fewer) are left off.
 * With the same points, students share a rank, and the one who got there first is listed first.
 */
export function competitionStandings(c: TimedCompetition, rows: { quizzes: QuizRow[]; eyeGaze: EyeGazeRow[]; awards: AwardRow[] }): Standing[] {
  const w = competitionWindow(c);
  const by = new Map<number, { points: number; quizzesPassed: number; quizzesTaken: number; lastScoredAt: number }>();
  const of = (userId: number) => { let s = by.get(userId); if (!s) { s = { points: 0, quizzesPassed: 0, quizzesTaken: 0, lastScoredAt: 0 }; by.set(userId, s); } return s; };
  const add = (userId: number, points: number, at: unknown, quiz: boolean, pass: boolean) => {
    const s = of(userId);
    if (quiz) { s.quizzesTaken++; if (pass) s.quizzesPassed++; }
    if (points !== 0) s.points = Math.round((s.points + points) * 10) / 10;
    if (points > 0) s.lastScoredAt = Math.max(s.lastScoredAt, ms(at) || 0);
  };
  for (const q of rows.quizzes) if (inWindow(q.at, w) && (q.bookId === undefined || Number(q.bookId) > 0)) add(q.userId, Math.max(0, Number(q.points) || 0), q.at, true, passed(q));
  for (const e of rows.eyeGaze) if (inWindow(e.at, w) && Number(e.total) > 0) add(e.userId, passed(e) ? EYE_GAZE_PASS_POINTS : 0, e.at, true, passed(e));
  // An award can be below zero: a teacher taking points back. It comes off the same as on the monthly leaderboard.
  for (const a of rows.awards) if (awardCounts(a, c)) add(a.userId, Number(a.points) || 0, a.at, false, false);

  const list = [...by.entries()].filter(([, s]) => s.points > 0).map(([userId, s]) => ({ userId, ...s }))
    .sort((a, b) => b.points - a.points || a.lastScoredAt - b.lastScoredAt || a.userId - b.userId);
  return list.map((s) => {
    const rank = list.findIndex((x) => x.points === s.points) + 1;
    return { ...s, rank, tied: list.filter((x) => x.points === s.points).length > 1 };
  });
}
