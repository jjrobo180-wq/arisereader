// Book points the admin sets by hand, and keeping already-passed quizzes in step
// when a book's value changes. The rules are in shared/bookPoints.ts.
//
// This file never imports the database itself; it is handed a store, so the
// rules can be tested without one (tests/book-points.test.ts).
import type { Express, RequestHandler } from "express";
import {
  BOOK_POINTS_BY_ADMIN_KEY, BOOK_POINTS_MAX, cleanBookPoints, movedTotal, planRescore, readAdminBookPoints, type SavedAttempt,
} from "../shared/bookPoints";

export type BookPointsStore = {
  /** The book's current points, or null when there is no such book. */
  bookPoints(bookId: number): Promise<number | null>;
  setBookPoints(bookId: number, points: number): Promise<void>;
  attempts(bookId: number): Promise<SavedAttempt[]>;
  setAttemptPoints(attemptId: number, points: number): Promise<void>;
  studentTotal(userId: number): Promise<number>;
  setStudentTotal(userId: number, total: number): Promise<void>;
  setting(key: string): Promise<string>;
  saveSetting(key: string, value: string): Promise<void>;
};

/** The store on the site's own database. `db` is a Supabase client. */
export function supabaseBookPointsStore(db: any): BookPointsStore {
  const must = <T extends { error: any }>(result: T): T => { if (result.error) throw new Error(result.error.message); return result; };
  return {
    async bookPoints(bookId) {
      const { data } = must(await db.from("books").select("id, points_value").eq("id", bookId).maybeSingle());
      return data ? Number(data.points_value ?? 0) : null;
    },
    async setBookPoints(bookId, points) { must(await db.from("books").update({ points_value: points }).eq("id", bookId)); },
    async attempts(bookId) {
      const { data } = must(await db.from("attempts").select("id, user_id, score, total, points_earned").eq("book_id", bookId));
      return data || [];
    },
    async setAttemptPoints(attemptId, points) { must(await db.from("attempts").update({ points_earned: points }).eq("id", attemptId)); },
    async studentTotal(userId) {
      const { data } = must(await db.from("users").select("total_points").eq("id", userId).maybeSingle());
      return Number(data?.total_points || 0);
    },
    async setStudentTotal(userId, total) { must(await db.from("users").update({ total_points: total }).eq("id", userId)); },
    async setting(key) {
      const { data } = must(await db.from("settings").select("value").eq("key", key).maybeSingle());
      return data?.value || "";
    },
    async saveSetting(key, value) { must(await db.from("settings").upsert({ key, value }, { onConflict: "key" })); },
  };
}

/** The books whose points the admin set, as { "<book id>": points }. */
export async function adminBookPoints(store: BookPointsStore): Promise<Record<string, number>> {
  return readAdminBookPoints(await store.setting(BOOK_POINTS_BY_ADMIN_KEY));
}

/** Did the admin set this book's points? If so AR BookFinder leaves them alone. */
export async function isSetByAdmin(store: BookPointsStore, bookId: number): Promise<boolean> {
  return String(bookId) in (await adminBookPoints(store));
}

/** Remembers that the admin chose this book's points. */
export async function rememberAdminPoints(store: BookPointsStore, bookId: number, points: number): Promise<void> {
  const all = await adminBookPoints(store);
  all[String(bookId)] = points;
  await store.saveSetting(BOOK_POINTS_BY_ADMIN_KEY, JSON.stringify(all));
}

/**
 * Brings quizzes already passed for a book into line with its new value, and
 * moves each student's total by the difference. Says how many changed.
 */
export async function rescoreBook(store: BookPointsStore, bookId: number, bookPoints: number, previousBookPoints: number): Promise<{ attempts: number; students: number }> {
  const plan = planRescore(await store.attempts(bookId), bookPoints, previousBookPoints);
  for (const attempt of plan.attempts) await store.setAttemptPoints(attempt.id, attempt.points);
  for (const [userId, difference] of plan.students) {
    await store.setStudentTotal(userId, movedTotal(await store.studentTotal(userId), difference));
  }
  return { attempts: plan.attempts.length, students: plan.students.size };
}

export type SetPointsResult =
  | { ok: true; pointsValue: number; previous: number; attempts: number; students: number }
  | { ok: false; status: 400 | 404; message: string };

/** The admin gives a book its points. From then on that number is what the book is worth. */
export async function setBookPointsByAdmin(store: BookPointsStore, bookId: number, value: unknown): Promise<SetPointsResult> {
  const points = cleanBookPoints(value);
  if (!Number.isSafeInteger(bookId) || bookId < 1) return { ok: false, status: 404, message: "Book not found." };
  if (points === null) return { ok: false, status: 400, message: `Enter the points for this book: a number above 0, up to ${BOOK_POINTS_MAX}.` };
  const previous = await store.bookPoints(bookId);
  if (previous === null) return { ok: false, status: 404, message: "Book not found." };
  // Remembered first, so a BookFinder check that runs at the same moment can't put the old value back.
  await rememberAdminPoints(store, bookId, points);
  await store.setBookPoints(bookId, points);
  const changed = await rescoreBook(store, bookId, points, previous);
  return { ok: true, pointsValue: points, previous, ...changed };
}

export type BookPointsDeps = {
  store: BookPointsStore;
  /** Forgets cached books, students and leaderboards after points move. */
  clearCaches(): void;
};

export function registerBookPointsRoutes(app: Express, auth: RequestHandler, admin: RequestHandler, deps: BookPointsDeps) {
  // Admin: set what a book is worth. Students who already passed it are corrected.
  app.patch("/api/admin/books/:id/points", auth, admin, async (req: any, res) => {
    try {
      const result = await setBookPointsByAdmin(deps.store, Number(req.params.id), req.body?.pointsValue);
      if (result.ok === false) return res.status(result.status).json({ message: result.message });
      deps.clearCaches();
      const { ok: _ok, ...body } = result;
      return res.json(body);
    } catch (error: any) {
      console.error("[book-points] could not set points", error?.message);
      return res.status(500).json({ message: "Could not save the points. Try again in a moment." });
    }
  });
}
