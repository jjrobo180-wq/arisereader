// The leaderboard of a short competition (shared/timedCompetitions.ts): who earned the most points
// between its start and its end. Anyone can open it, signed in or not, the same as the monthly
// competition page, so it only ever shows a display name, points and quizzes passed.
import type { Express } from "express";
import { isSampleAccount } from "../shared/sampleAccounts";
import {
  competitionPhase, competitionStandings, competitionWindow, timedCompetition, whenText,
  type AwardRow, type EyeGazeRow, type QuizRow, type TimedCompetition,
} from "../shared/timedCompetitions";

export type CompetitionStudent = { id: number; username?: string | null; displayName?: string | null; role?: string | null; isAdmin?: boolean; archived?: boolean; isEyeGazeUser?: boolean };

export type TimedCompetitionDeps = {
  /** Everything that could count: quizzes and awards from around the competition's dates. What is outside its hours is dropped here. */
  loadRows(competition: TimedCompetition): Promise<{ quizzes: QuizRow[]; eyeGaze: EyeGazeRow[]; awards: AwardRow[] }>;
  loadStudents(ids: number[]): Promise<CompetitionStudent[]>;
  now(): number;
};

export type BoardEntry = { rank: number; tied: boolean; displayName: string; points: number; quizzesPassed: number; isEyeGazeUser: boolean };
export type CompetitionBoard = {
  competition: { slug: string; title: string; prize: string; startsAt: string; endsAt: string; startText: string; endText: string };
  phase: "soon" | "live" | "over";
  entries: BoardEntry[];
  updatedAt: string;
};

/** The competition's leaderboard right now, or null when there is no competition by that name. */
export async function competitionBoard(deps: TimedCompetitionDeps, slug: unknown): Promise<CompetitionBoard | null> {
  const c = timedCompetition(slug);
  if (!c) return null;
  const now = deps.now();
  const phase = competitionPhase(c, now);
  const { startMs, endMs } = competitionWindow(c);
  let entries: BoardEntry[] = [];
  if (phase !== "soon") {
    const all = competitionStandings(c, await deps.loadRows(c));
    const students = new Map((await deps.loadStudents(all.map((s) => s.userId))).map((u) => [u.id, u]));
    // Only real, current students: no staff, no parents, no archived or sample accounts.
    const real = all.filter((s) => { const u = students.get(s.userId); return !!u && !u.isAdmin && !u.archived && (!u.role || u.role === "student") && !isSampleAccount(u); });
    entries = real.map((s) => {
      const rank = real.findIndex((x) => x.points === s.points) + 1;
      return { rank, tied: real.filter((x) => x.points === s.points).length > 1, displayName: String(students.get(s.userId)!.displayName || "A reader"), points: s.points, quizzesPassed: s.quizzesPassed, isEyeGazeUser: !!students.get(s.userId)!.isEyeGazeUser };
    });
  }
  return {
    competition: { slug: c.slug, title: c.title, prize: c.prize, startsAt: new Date(startMs).toISOString(), endsAt: new Date(endMs).toISOString(), startText: whenText(c.start), endText: whenText(c.end) },
    phase, entries, updatedAt: new Date(now).toISOString(),
  };
}

/** How long one answer is reused, so a class refreshing the page together asks the database once. */
export const BOARD_FRESH_MS = 30_000;

export function registerTimedCompetitionRoutes(app: Express, deps: TimedCompetitionDeps): void {
  const kept = new Map<string, { at: number; board: CompetitionBoard }>();
  app.get("/api/competitions/:slug", async (req: any, res) => {
    try {
      const slug = String(req.params.slug || "");
      const had = kept.get(slug);
      // Once it is over the list can still change (a teacher fixing points), so it is never kept for good.
      if (had && deps.now() - had.at < BOARD_FRESH_MS) return res.set("Cache-Control", "no-store").json(had.board);
      const board = await competitionBoard(deps, slug);
      if (!board) return res.status(404).json({ message: "There is no competition by that name." });
      kept.set(slug, { at: deps.now(), board });
      res.set("Cache-Control", "no-store").json(board);
    } catch (error: any) {
      console.error("[timed-competition] failed:", error?.message);
      res.status(500).json({ message: "The leaderboard could not be loaded. Please try again." });
    }
  });
}
