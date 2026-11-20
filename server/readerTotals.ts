// GET /api/public/reader-totals: every quiz taken on Arise Reader since it began, and the points those quizzes
// earned. Public (the home page and the sign-in screen show it before anyone signs in), so it is only ever
// two totals and the day the first quiz was taken: no names, no schools, nothing about any one reader.
import type { Express } from "express";

import type { ReaderTotals } from "../shared/readerTotals";
export type { ReaderTotals };

export type TotalsDeps = {
  /** One page of quiz attempts, rows `from` through `to` (inclusive), in a steady order. */
  attemptsPage(from: number, to: number): Promise<Array<{ points_earned: number | string | null; completed_at: string | null }>>;
  now?: () => number;
};

const PAGE = 1000;
/** The totals are worked out at most this often; a reader sees a new quiz counted within minutes. */
export const TOTALS_FRESH_MS = 5 * 60_000;

/** The totals for a set of attempts. */
export function totalAttempts(rows: ReadonlyArray<{ points_earned: number | string | null; completed_at: string | null }>): ReaderTotals {
  let points = 0;
  let first = Infinity;
  for (const r of rows) {
    const p = Number(r.points_earned);
    if (Number.isFinite(p)) points += p;
    const t = r.completed_at ? Date.parse(r.completed_at) : NaN;
    if (Number.isFinite(t) && t < first) first = t;
  }
  return { quizzes: rows.length, points: Math.round(points * 10) / 10, since: Number.isFinite(first) ? new Date(first).toISOString().slice(0, 10) : null };
}

export function registerReaderTotalsRoutes(app: Express, deps: TotalsDeps) {
  let cached: { at: number; totals: ReaderTotals } | null = null;
  let pending: Promise<ReaderTotals> | null = null;
  const load = async (): Promise<ReaderTotals> => {
    const rows: Array<{ points_earned: number | string | null; completed_at: string | null }> = [];
    for (let from = 0; ; from += PAGE) {
      const page = await deps.attemptsPage(from, from + PAGE - 1);
      rows.push(...page);
      if (page.length < PAGE) return totalAttempts(rows);
    }
  };
  app.get("/api/public/reader-totals", async (_req, res) => {
    const now = deps.now ? deps.now() : Date.now();
    try {
      if (!cached || now - cached.at >= TOTALS_FRESH_MS) {
        pending ||= load().finally(() => { pending = null; });
        cached = { at: now, totals: await pending };
      }
    } catch {
      // Keep showing the last totals if the database hiccups; with none yet, say so (the pages show nothing).
      if (!cached) return res.status(503).json({ message: "Totals are temporarily unavailable" });
    }
    res.set("Cache-Control", "public, max-age=300");
    res.json(cached!.totals);
  });
}
