// GET /api/advisory-challenge: the viewer's school's Advisory Challenge standings, and (for a student)
// their advisory's place. The rules (dates, counting, ranking) are in shared/advisoryChallenge.ts.
import type { Express } from "express";
import { advisoriesForSchool } from "../shared/advisories";
import { challengeForSchool, challengePhase, challengeWindow, daysLeft, rankAdvisories, type ChallengeView } from "../shared/advisoryChallenge";
import { schoolYearOf } from "../shared/classTeachers";

export type ChallengeDeps = {
  auth: (req: any, res: any, next: any) => void;
  getSchool(id: number): Promise<{ id: number; name: string } | null>;
  allSchools(): Promise<Array<{ id: number; name: string }>>;
  /** The school's current students (not archived), by id. */
  schoolStudentIds(schoolId: number): Promise<number[]>;
  /** Each student's advisory for the school year: student id -> advisory name. */
  advisoryPicks(schoolId: number, year: string): Promise<Array<{ studentId: number; advisory: string }>>;
  pointsBetween(userIds: number[], startMs: number, endMs: number, fromDay: string, endDayExclusive: string): Promise<Map<number, number>>;
  /** A parent's children (current ones), with each child's school: a parent sees their child's school's challenge. */
  parentChildren?(parentId: number): Promise<Array<{ id: number; schoolId: number | null }>>;
  now?: () => number;
};

const EMPTY: ChallengeView = { challenge: null, standings: [], mine: null };

export function registerAdvisoryChallengeRoutes(app: Express, deps: ChallengeDeps) {
  app.get("/api/advisory-challenge", deps.auth, async (req: any, res) => {
    try {
      const now = deps.now ? deps.now() : Date.now();
      const user = req.user || {};
      const isStudent = !user.isAdmin && (!user.role || user.role === "student");
      const isParent = !user.isAdmin && user.role === "parent";
      const kids = isParent && deps.parentChildren ? await deps.parentChildren(Number(user.id)) : [];
      // Admins without a school (and admins asking about one) see the first school running a challenge.
      let school = user.school_id ? await deps.getSchool(Number(user.school_id)) : null;
      if (user.isAdmin && req.query.schoolId) school = await deps.getSchool(Number(req.query.schoolId));
      if (!school && isParent) { const k = kids.find((c) => c.schoolId); if (k) school = await deps.getSchool(Number(k.schoolId)); }
      if (!school && user.isAdmin) school = (await deps.allSchools()).find((s) => challengeForSchool(s.name)) || null;
      const challenge = school ? challengeForSchool(school.name) : null;
      if (!school || !challenge) return res.json(EMPTY);
      const phase = challengePhase(challenge, now);
      if (phase === "done" && isStudent) return res.json(EMPTY);

      const year = schoolYearOf(new Date(now));
      const [students, picks] = await Promise.all([deps.schoolStudentIds(school.id), deps.advisoryPicks(school.id, year)]);
      const current = new Set(students);
      const studentAdvisory = new Map<number, string>();
      for (const p of picks) if (current.has(p.studentId) && p.advisory) studentAdvisory.set(p.studentId, p.advisory);
      const w = challengeWindow(challenge);
      const points = await deps.pointsBetween([...studentAdvisory.keys(), ...(isStudent ? [Number(user.id)] : []), ...kids.map((k) => k.id)], w.fromMs, w.endMs, w.fromDay, w.endDayExclusive);
      const standings = rankAdvisories(advisoriesForSchool(school.name), studentAdvisory, points);

      let mine: ChallengeView["mine"] = null;
      // A student's own advisory; for a parent, their (first) child's in this school.
      const me = isStudent ? Number(user.id) : isParent ? (kids.find((k) => studentAdvisory.has(k.id))?.id ?? kids[0]?.id ?? null) : null;
      if (me != null) {
        const name = studentAdvisory.get(me) || null;
        const row = name ? standings.find((s) => s.name === name) : undefined;
        mine = { advisory: row ? row.name : null, rank: row ? row.rank : null, points: Math.round((points.get(me) || 0) * 10) / 10 };
      }
      const view: ChallengeView = { challenge: { ...challenge, phase, daysLeft: daysLeft(challenge, now) }, standings, mine };
      res.json(view);
    } catch (e: any) {
      console.error("Advisory challenge error:", e?.message || e);
      res.status(500).json({ message: "The Advisory Challenge standings could not be loaded." });
    }
  });
}
