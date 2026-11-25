// GET /api/top-reader: the viewer's school's Top Reader Challenge board, and (for a student or a
// parent) their own place. The rules (dates, counting, ranking) are in shared/topReader.ts.
import type { Express } from "express";
import {
  isFirstDay, rankRacers, topReaderDaysLeft, topReaderForSchool, topReaderPhase, topReaderWindow, type RacerRow, type TopReaderView,
} from "../shared/topReader";
import { initials } from "../shared/prizeSchool";

export type TopReaderDeps = {
  auth: (req: any, res: any, next: any) => void;
  getSchool(id: number): Promise<{ id: number; name: string } | null>;
  allSchools(): Promise<Array<{ id: number; name: string }>>;
  /** The school's current students (not archived), with the names they go by. */
  schoolStudents(schoolId: number): Promise<Array<{ id: number; name: string }>>;
  /** Each student's grade, by id. */
  grades(): Promise<Record<string, string>>;
  /** Points and quizzes passed in the window, by student id. */
  statsBetween(ids: number[], startMs: number, endMs: number, fromDay: string, endDayExclusive: string): Promise<Map<number, { points: number; quizzesPassed: number }>>;
  /** A parent's children (current ones), with each child's school. */
  parentChildren?(parentId: number): Promise<Array<{ id: number; schoolId: number | null }>>;
  now?: () => number;
};

/** How many places students and parents see (staff see everyone). */
export const BOARD_SIZE = 10;
const EMPTY: TopReaderView = { challenge: null, standings: [], racers: 0, mine: null };

export function registerTopReaderRoutes(app: Express, deps: TopReaderDeps) {
  app.get("/api/top-reader", deps.auth, async (req: any, res) => {
    try {
      const now = deps.now ? deps.now() : Date.now();
      const user = req.user || {};
      const isStudent = !user.isAdmin && (!user.role || user.role === "student");
      const isParent = !user.isAdmin && user.role === "parent";
      const kids = isParent && deps.parentChildren ? await deps.parentChildren(Number(user.id)) : [];
      let school = user.school_id ? await deps.getSchool(Number(user.school_id)) : null;
      if (user.isAdmin && req.query.schoolId) school = await deps.getSchool(Number(req.query.schoolId));
      if (!school && isParent) { const k = kids.find((c) => c.schoolId); if (k) school = await deps.getSchool(Number(k.schoolId)); }
      if (!school && user.isAdmin) school = (await deps.allSchools()).find((s) => topReaderForSchool(s.name)) || null;
      const challenge = school ? topReaderForSchool(school.name) : null;
      if (!school || !challenge) return res.json(EMPTY);
      const phase = topReaderPhase(challenge, now);
      if (phase === "done") return res.json(EMPTY);

      const w = topReaderWindow(challenge);
      const [students, grades] = await Promise.all([deps.schoolStudents(school.id), deps.grades()]);
      const stats = phase === "soon" ? new Map() : await deps.statsBetween(students.map((s) => s.id), w.fromMs, w.endMs, w.fromDay, w.endDayExclusive);
      const ranked = rankRacers(students.map((s) => {
        const st = stats.get(s.id);
        return { id: s.id, name: s.name, grade: String(grades[String(s.id)] || ""), points: Number(st?.points || 0), passed: Number(st?.quizzesPassed || 0) };
      }));
      const staff = !isStudent && !isParent;
      const me = isStudent ? Number(user.id) : isParent ? (kids.find((k) => students.some((s) => s.id === k.id))?.id ?? null) : null;
      // Only the viewer's own row carries its id, so the page can mark "you" without listing everyone's ids.
      // Students and parents see everyone but themselves (or their child) by initials, for safety.
      const row = (r: (typeof ranked)[number]): RacerRow => ({ rank: r.rank, name: staff || r.id === me || kids.some((k) => k.id === r.id) ? r.name : initials(r.name), grade: r.grade, points: r.points, passed: r.passed, ...(r.id === me || staff ? { id: r.id } : {}) });
      let standings = (staff ? ranked : ranked.slice(0, BOARD_SIZE)).map(row);
      const mineRow = me != null ? ranked.find((r) => r.id === me) : undefined;
      if (mineRow && !standings.some((s) => s.id === me)) standings = [...standings, row(mineRow)];
      const meStudent = me != null ? students.find((s) => s.id === me) : undefined;
      const mine: TopReaderView["mine"] = meStudent
        ? { name: meStudent.name, rank: mineRow?.rank ?? null, points: mineRow?.points ?? 0, passed: mineRow?.passed ?? 0 }
        : null;
      const view: TopReaderView = {
        challenge: { ...challenge, phase, daysLeft: topReaderDaysLeft(challenge, now), firstDay: isFirstDay(challenge, now), endMs: w.endMs },
        standings, racers: ranked.length, mine,
      };
      res.json(view);
    } catch (e: any) {
      console.error("Top Reader Challenge error:", e?.message || e);
      res.status(500).json({ message: "The Top Reader Challenge board could not be loaded." });
    }
  });
}
