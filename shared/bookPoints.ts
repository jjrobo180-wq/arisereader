// A.R.I.S.E.'s own book points.
//
// Every book quiz is worth 5, 10, 15, 20, 25 or 30 points. The site works the
// number out itself from how long the book is and what grades it is for, and the
// admin can set any book to another of the six values, which then stays.
//
//   Pages       up to 60   61-150   151-260   261-340   341-480   over 480
//   Points          5        10        15        20        25        30
//
//   A K-2 book is worth one step less, a 9-12 book one step more.
//   When the page count isn't known the grade band decides alone:
//   K-2 = 5, 3-5 = 10, 6-8 = 15, 9-12 = 20.
//
// Nothing here asks any outside service for points. (The site used to copy
// Accelerated Reader's values; convertedPoints() is the one-time switch from
// those to the six steps.)
//
// Server side: server/bookPoints.ts. The quiz itself is all or nothing: 70% or
// higher earns the book's full value (script/enforceQuizPolicy.ts guards that).

/** The six values a book can be worth. */
export const ARISE_POINTS = [5, 10, 15, 20, 25, 30] as const;

export const GRADE_BANDS = ["K-2", "3-5", "6-8", "9-12"] as const;
export type GradeBand = (typeof GRADE_BANDS)[number];

/** The setting that remembers which books the admin set: { "<book id>": points }. */
export const BOOK_POINTS_BY_ADMIN_KEY = "book_points_set_by_admin";

const round1 = (n: number) => Math.round(n * 10) / 10;
const step = (index: number) => ARISE_POINTS[Math.max(0, Math.min(ARISE_POINTS.length - 1, index))];

/** The longest book, in pages, that still earns each step (the last step has no top). */
const PAGE_STEPS = [60, 150, 260, 340, 480];
const BAND_ALONE: Record<GradeBand, number> = { "K-2": 5, "3-5": 10, "6-8": 15, "9-12": 20 };

/**
 * The grade band a label means. The site's own bands pass straight through; an
 * age range such as "8-10" or "10-12" (older book lists use ages) is turned into
 * the band those ages are in. null when the label says nothing useful.
 */
export function bandOf(label: unknown): GradeBand | null {
  const text = String(label ?? "").trim().toUpperCase().replace(/\s+/g, "").replace(/[–—]/g, "-");
  const own = GRADE_BANDS.find((band) => band === text);
  if (own) return own;
  const ages = /^(\d{1,2})-(\d{1,2})$/.exec(text);
  if (!ages) return null;
  // The middle of the age range, as a grade (a 6-year-old is in grade 1).
  const grade = (Number(ages[1]) + Number(ages[2])) / 2 - 5;
  return grade <= 2 ? "K-2" : grade <= 5 ? "3-5" : grade <= 8 ? "6-8" : "9-12";
}

/** A real page count (1 to 5000, whole pages), or null. */
export function cleanPages(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\s*\d+\s*$/.test(value)) return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= 5000 ? n : null;
}

/** What a book is worth in A.R.I.S.E. points, from its length and its grade band. */
export function pointsForBook(book: { band?: unknown; pages?: unknown }): number {
  const band = bandOf(book.band);
  const pages = cleanPages(book.pages);
  if (pages === null) return BAND_ALONE[band ?? "3-5"];
  const byLength = PAGE_STEPS.findIndex((most) => pages <= most);
  const index = byLength === -1 ? PAGE_STEPS.length : byLength;
  return step(index + (band === "K-2" ? -1 : band === "9-12" ? 1 : 0));
}

/**
 * The one-time switch for a book that carried an Accelerated Reader value: that
 * value rounded up into the six steps (3 becomes 10, 7 becomes 15, 12 becomes 20).
 * null when there is no old value to go by.
 */
export function convertedPoints(oldValue: unknown): number | null {
  const old = Number(oldValue);
  if (oldValue === null || oldValue === undefined || oldValue === "" || !Number.isFinite(old) || old <= 0) return null;
  return old <= 1 ? 5 : old <= 4 ? 10 : old <= 8 ? 15 : old <= 12 ? 20 : old <= 18 ? 25 : 30;
}

/** One of the six values an admin may give a book (5 to 30 in fives), or null for anything else. */
export function cleanBookPoints(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^\s*\d+(\.0+)?\s*$/.test(value)) return null;
  const n = Number(value);
  return (ARISE_POINTS as readonly number[]).includes(n) ? n : null;
}

/** The books an admin has set, from the saved setting. Anything unreadable is treated as none. */
export function readAdminBookPoints(raw: unknown): Record<string, number> {
  let parsed: unknown;
  try { parsed = typeof raw === "string" && raw ? JSON.parse(raw) : null; } catch { parsed = null; }
  const out: Record<string, number> = {};
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return out;
  for (const [id, points] of Object.entries(parsed as Record<string, unknown>)) {
    const n = typeof points === "number" ? points : NaN;
    if (/^\d+$/.test(id) && Number.isFinite(n) && n > 0) out[id] = n;
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
