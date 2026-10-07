// A book's point value: who decides it, and what happens to quizzes that were
// already passed when it changes.
//
// The admin's number wins. A value the admin picks (when adding a quiz, or later
// in the Library) is what the book is worth, and AR BookFinder never changes it
// again. Books the admin has not set keep AR's official value.
//
// Server side: server/bookPoints.ts. The quiz itself is all or nothing: 70% or
// higher earns the book's full value (script/enforceQuizPolicy.ts guards that).

/** The most a single book can be worth. */
export const BOOK_POINTS_MAX = 100;

/** The setting that remembers which books the admin set: { "<book id>": points }. */
export const BOOK_POINTS_BY_ADMIN_KEY = "book_points_set_by_admin";

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * A point value an admin may give a book: above 0, at most 100, kept to one
 * decimal. null for anything else. (0 is refused because a 0-point book is
 * hidden from the student library.)
 */
export function cleanBookPoints(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\s*\d+(\.\d+)?\s*$/.test(value)) return null;
  const n = round1(Number(value));
  return Number.isFinite(n) && n > 0 && n <= BOOK_POINTS_MAX ? n : null;
}

/** The books an admin has set, from the saved setting. Anything unreadable is treated as none. */
export function readAdminBookPoints(raw: unknown): Record<string, number> {
  let parsed: unknown;
  try { parsed = typeof raw === "string" && raw ? JSON.parse(raw) : null; } catch { parsed = null; }
  const out: Record<string, number> = {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return out;
  for (const [id, points] of Object.entries(parsed as Record<string, unknown>)) {
    const clean = cleanBookPoints(points);
    if (/^\d+$/.test(id) && clean !== null) out[id] = clean;
  }
  return out;
}

export type SavedAttempt = { id: number; user_id: number; score: number | string | null; total: number | string | null; points_earned: number | string | null };

export type RescorePlan = {
  /** Attempts whose points change, with their new points. */
  attempts: { id: number; points: number }[];
  /** How much each student's total moves (a student id to the difference). */
  students: Map<number, number>;
};

/**
 * Works out what a book's new value means for quizzes already taken.
 *
 * Every student who holds points for the book gets the new value. A student who
 * passed while the book was worth nothing gets it too. An attempt with no points
 * for any other reason (it was failed, or a reviewer took the points away)
 * stays at no points.
 */
export function planRescore(attempts: SavedAttempt[], bookPoints: number, previousBookPoints: number): RescorePlan {
  const plan: RescorePlan = { attempts: [], students: new Map() };
  const worth = round1(Number(bookPoints) || 0);
  for (const attempt of attempts) {
    const had = round1(Number(attempt.points_earned) || 0);
    const total = Number(attempt.total) || 0;
    const passed = total > 0 && (Number(attempt.score) || 0) >= Math.ceil(total * 0.7);
    const holds = had > 0 || (passed && !(Number(previousBookPoints) > 0));
    if (!holds || Math.abs(worth - had) < 0.001) continue;
    plan.attempts.push({ id: attempt.id, points: worth });
    plan.students.set(attempt.user_id, round1((plan.students.get(attempt.user_id) || 0) + worth - had));
  }
  for (const [student, difference] of plan.students) if (Math.abs(difference) < 0.001) plan.students.delete(student);
  return plan;
}

/** A student's new total after a change. It never goes below zero. */
export function movedTotal(current: unknown, difference: number): number {
  return Math.max(0, round1((Number(current) || 0) + difference));
}
