// Book points on the server: the points the admin sets by hand, keeping
// already-passed quizzes in step when a book's value changes, and the one-time
// switch of the whole library to A.R.I.S.E.'s own points. The rules are in
// shared/bookPoints.ts.
//
// This file never imports the database itself; it is handed a store, so the
// rules can be tested without one (tests/book-points.test.ts).
import type { Express, RequestHandler } from "express";
import {
  ARISE_POINTS, BOOK_POINTS_BY_ADMIN_KEY, cleanBookPoints, convertedPoints, movedTotal, planRescore, readAdminBookPoints, type SavedAttempt,
} from "../shared/bookPoints";

/** A book as the one-time switch sees it: what it is worth now and the old value it was given. */
export type BookForSwitch = { id: number; points_value: number | string | null; ar_points: number | string | null; ar_match_status: string | null };

export type BookPointsStore = {
  /** The book's current points, or null when there is no such book. */
  bookPoints(bookId: number): Promise<number | null>;
  setBookPoints(bookId: number, points: number): Promise<void>;
  /** Every book, for the one-time switch. */
  allBooks(): Promise<BookForSwitch[]>;
  /** Gives many books the same points in one go. */
  setManyBookPoints(bookIds: number[], points: number): Promise<void>;
  /** The books that at least one student holds points for. */
  booksWithPoints(): Promise<Set<number>>;
  attempts(bookId: number): Promise<SavedAttempt[]>;
  setAttemptPoints(attemptId: number, points: number): Promise<void>;
  studentTotal(userId: number): Promise<number>;
  setStudentTotal(userId: number, total: number): Promise<void>;
  setting(key: string): Promise<string>;
  saveSetting(key: string, value: string): Promise<void>;
};

const PAGE = 1000;

/** The store on the site's own database. `db` is a Supabase client. */
export function supabaseBookPointsStore(db: any): BookPointsStore {
  const must = <T extends { error: any }>(result: T): T => { if (result.error) throw new Error(result.error.message); return result; };
  return {
    async bookPoints(bookId) {
      const { data } = must(await db.from("books").select("id, points_value").eq("id", bookId).maybeSingle());
      return data ? Number(data.points_value ?? 0) : null;
    },
    async setBookPoints(bookId, points) { must(await db.from("books").update({ points_value: points }).eq("id", bookId)); },
    async allBooks() {
      // The database hands back at most 1,000 rows at a time, so the list is read in pages.
      const books: BookForSwitch[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data } = must(await db.from("books").select("id, points_value, ar_points, ar_match_status").order("id", { ascending: true }).range(from, from + PAGE - 1));
        books.push(...(data || []));
        if (!data || data.length < PAGE) return books;
      }
    },
    async setManyBookPoints(bookIds, points) {
      for (let i = 0; i < bookIds.length; i += 200) must(await db.from("books").update({ points_value: points }).in("id", bookIds.slice(i, i + 200)));
    },
    async booksWithPoints() {
      const ids = new Set<number>();
      for (let from = 0; ; from += PAGE) {
        const { data } = must(await db.from("attempts").select("id, book_id").gt("points_earned", 0).order("id", { ascending: true }).range(from, from + PAGE - 1));
        for (const row of data || []) ids.add(Number(row.book_id));
        if (!data || data.length < PAGE) return ids;
      }
    },
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

/** Did the admin set this book's points? If so the site never works them out again. */
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
  if (points === null) return { ok: false, status: 400, message: `Choose the points for this book: ${ARISE_POINTS.join(", ")}.` };
  const previous = await store.bookPoints(bookId);
  if (previous === null) return { ok: false, status: 404, message: "Book not found." };
  // Remembered first, so nothing that works points out at the same moment can put the old value back.
  await rememberAdminPoints(store, bookId, points);
  await store.setBookPoints(bookId, points);
  const changed = await rescoreBook(store, bookId, points, previous);
  return { ok: true, pointsValue: points, previous, ...changed };
}

// ─── The one-time switch to A.R.I.S.E. points ───────────────────────────────

/** The setting that says the library has been switched (and what the switch did). */
export const BOOK_POINTS_SYSTEM_KEY = "book_points_system";
const SYSTEM = "arise-1";
/** A switch that started this recently is taken to be still running somewhere. */
const RUNNING_FOR_MS = 30 * 60_000;

export type SwitchSummary = { system: string; state: "running" | "stopped" | "done"; at: string; books: number; attempts: number; students: number };

/**
 * Which books the switch changes, and to what. Only a book still carrying a
 * value copied from Accelerated Reader is touched: it gets that value rounded up
 * into the six steps. Books the admin set, books with no quiz (0 points) and the
 * site's own reads, news and lessons keep what they have.
 */
export function planSwitch(books: BookForSwitch[], setByAdmin: Record<string, number>): { id: number; from: number; to: number }[] {
  const changes: { id: number; from: number; to: number }[] = [];
  for (const book of books) {
    const from = Number(book.points_value) || 0;
    const copied = book.ar_match_status === "exact" || book.ar_match_status === "formula";
    const to = copied ? convertedPoints(book.ar_points) : null;
    if (from <= 0 || to === null || to === from || String(book.id) in setByAdmin) continue;
    changes.push({ id: Number(book.id), from, to });
  }
  return changes;
}

/**
 * Switches the whole library to A.R.I.S.E. points, once. Students who already
 * passed a book are moved to its new value. Safe to start again after a stop:
 * a book is only marked with its new value after its students are corrected.
 */
export async function switchLibraryToArisePoints(store: BookPointsStore, now: () => number = Date.now): Promise<SwitchSummary | null> {
  let saved: Partial<SwitchSummary> = {};
  try { saved = JSON.parse((await store.setting(BOOK_POINTS_SYSTEM_KEY)) || "{}") || {}; } catch { saved = {}; }
  if (saved.system === SYSTEM && saved.state === "done") return null;
  if (saved.system === SYSTEM && saved.state === "running" && now() - (Date.parse(String(saved.at)) || 0) < RUNNING_FOR_MS) return null;

  const summary: SwitchSummary = { system: SYSTEM, state: "running", at: new Date(now()).toISOString(), books: 0, attempts: 0, students: 0 };
  await store.saveSetting(BOOK_POINTS_SYSTEM_KEY, JSON.stringify(summary));
  try {
    return await runSwitch(store, summary, now);
  } catch (error) {
    // Not left marked as running, so the next try starts straight away.
    await store.saveSetting(BOOK_POINTS_SYSTEM_KEY, JSON.stringify({ ...summary, state: "stopped" })).catch(() => {});
    throw error;
  }
}

async function runSwitch(store: BookPointsStore, summary: SwitchSummary, now: () => number): Promise<SwitchSummary> {
  const changes = planSwitch(await store.allBooks(), await adminBookPoints(store));
  const earned = await store.booksWithPoints();
  const students = new Set<number>();

  // Books students hold points for: correct the students first, then the book.
  for (const change of changes.filter((c) => earned.has(c.id))) {
    const plan = planRescore(await store.attempts(change.id), change.to, change.from);
    for (const attempt of plan.attempts) await store.setAttemptPoints(attempt.id, attempt.points);
    for (const [userId, difference] of plan.students) {
      await store.setStudentTotal(userId, movedTotal(await store.studentTotal(userId), difference));
      students.add(userId);
    }
    await store.setBookPoints(change.id, change.to);
    summary.attempts += plan.attempts.length;
  }
  // Everything else is only the book's own number, so those go in a few large steps.
  for (const points of ARISE_POINTS) {
    const ids = changes.filter((c) => !earned.has(c.id) && c.to === points).map((c) => c.id);
    if (ids.length) await store.setManyBookPoints(ids, points);
  }

  summary.books = changes.length;
  summary.students = students.size;
  summary.state = "done";
  summary.at = new Date(now()).toISOString();
  await store.saveSetting(BOOK_POINTS_SYSTEM_KEY, JSON.stringify(summary));
  return summary;
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
