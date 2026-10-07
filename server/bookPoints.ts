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
 *
 * The book must already hold the new value. The database has a rule of its own
 * (trigger attempts_full_points_at_70, see migrations/attempts_full_points_at_70.sql):
 * whenever a quiz row is changed, a passed quiz is given its book's current points.
 * A quiz changed while its book still has the old value is put straight back.
 *
 * A student's quiz is changed before their total, so a stop in between can
 * leave a total short but can never pay anyone twice.
 */
export async function rescoreBook(store: BookPointsStore, bookId: number, bookPoints: number, previousBookPoints: number, checkIn?: () => Promise<void>): Promise<{ attempts: number; students: number; studentIds: number[] }> {
  const all = await store.attempts(bookId);
  const plan = planRescore(all, bookPoints, previousBookPoints);
  const before = new Map(all.map((a) => [a.id, a]));
  for (const change of plan.attempts) {
    const attempt = before.get(change.id)!;
    await store.setAttemptPoints(change.id, change.points);
    const difference = change.points - (Number(attempt.points_earned) || 0);
    await store.setStudentTotal(attempt.user_id, movedTotal(await store.studentTotal(attempt.user_id), difference));
    await checkIn?.();
  }
  return { attempts: plan.attempts.length, students: plan.students.size, studentIds: [...plan.students.keys()] };
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
  return { ok: true, pointsValue: points, previous, attempts: changed.attempts, students: changed.students };
}

// ─── The one-time switch to A.R.I.S.E. points ───────────────────────────────

/** The setting that says where the switch has got to (and what it did). */
export const BOOK_POINTS_SYSTEM_KEY = "book_points_system";
/** Raised when the switch's rules change, so every site runs the new pass once. */
const SYSTEM = "arise-2";
/** A running switch checks in at least this often (after every single change it makes, if that long has passed)... */
const CHECK_IN_MS = 5_000;
/** ...so one that has been quiet this long was cut off (the server restarted) and can be picked up again. */
const QUIET_FOR_MS = 45_000;

export type SwitchSummary = {
  system: string; state: "running" | "stopped" | "done"; at: string;
  books: number; attempts: number; students: number;
  /** Why it stopped, when it did. */
  error?: string;
};

/**
 * Which books the switch changes, and to what. Only a book still carrying a
 * value copied from Accelerated Reader is touched: it gets that value rounded up
 * into the six steps. Books the admin set, books with no quiz (0 points) and the
 * site's own reads, news and lessons keep what they have.
 */
export function planSwitch(books: BookForSwitch[], setByAdmin: Record<string, number>): { id: number; from: number; to: number }[] {
  return switchedBooks(books, setByAdmin).filter((book) => book.to !== book.from);
}

/** Every book the switch is responsible for, with the value it has now and the value it should have. */
function switchedBooks(books: BookForSwitch[], setByAdmin: Record<string, number>): { id: number; from: number; to: number }[] {
  const out: { id: number; from: number; to: number }[] = [];
  for (const book of books) {
    const from = Number(book.points_value) || 0;
    const to = convertedPoints(book.ar_points);
    // Marked as matched, still worth exactly the number that was copied, or already on its switched value.
    const copied = book.ar_match_status === "exact" || book.ar_match_status === "formula"
      || (to !== null && (Number(book.ar_points) === from || to === from));
    if (from <= 0 || to === null || !copied || String(book.id) in setByAdmin) continue;
    out.push({ id: Number(book.id), from, to });
  }
  return out;
}

async function savedSwitch(store: BookPointsStore): Promise<Partial<SwitchSummary>> {
  try {
    const saved = JSON.parse((await store.setting(BOOK_POINTS_SYSTEM_KEY)) || "{}");
    return saved && typeof saved === "object" && saved.system === SYSTEM ? saved : {};
  } catch { return {}; }
}

const stillRunning = (saved: Partial<SwitchSummary>, now: number) =>
  saved.state === "running" && now - (Date.parse(String(saved.at)) || 0) < QUIET_FOR_MS;

export type SwitchStatus = {
  /** done: finished. running: at work now. waiting: not finished and not at work (it will pick up, or can be started). stopped: it hit a problem. */
  state: "done" | "running" | "waiting" | "stopped";
  at: string | null;
  books: number; attempts: number; students: number;
  /** Books still on their old points. */
  left: number;
  error?: string;
};

/** Where the switch stands, for the admin's Library. */
export async function switchStatus(store: BookPointsStore, now: () => number = Date.now): Promise<SwitchStatus> {
  const saved = await savedSwitch(store);
  const left = planSwitch(await store.allBooks(), await adminBookPoints(store)).length;
  const state = saved.state === "done" ? "done" : stillRunning(saved, now()) ? "running" : saved.state === "stopped" ? "stopped" : "waiting";
  return {
    state, at: saved.at || null, left,
    books: Number(saved.books) || 0, attempts: Number(saved.attempts) || 0, students: Number(saved.students) || 0,
    ...(state === "stopped" && saved.error ? { error: saved.error } : {}),
  };
}

/**
 * Switches the whole library to A.R.I.S.E. points, once. Students who already
 * passed a book are moved to its new value.
 *
 * It answers null when there is nothing for this call to do: the switch has
 * finished, or it is at work right now somewhere else. A switch that was cut
 * off part-way (the server restarted) is picked up where it stopped; that is
 * safe because a book is only given its new value after its students are
 * corrected, so nobody is paid twice.
 */
export async function switchLibraryToArisePoints(store: BookPointsStore, now: () => number = Date.now): Promise<SwitchSummary | null> {
  const saved = await savedSwitch(store);
  if (saved.state === "done" || stillRunning(saved, now())) return null;

  // What an earlier, cut-off run already did is kept in the count.
  const summary: SwitchSummary = {
    system: SYSTEM, state: "running", at: new Date(now()).toISOString(),
    books: Number(saved.books) || 0, attempts: Number(saved.attempts) || 0, students: Number(saved.students) || 0,
  };
  const save = () => store.saveSetting(BOOK_POINTS_SYSTEM_KEY, JSON.stringify(summary));
  await save();
  try {
    return await runSwitch(store, summary, now, save);
  } catch (error: any) {
    // Not left marked as running, so the next try starts straight away.
    summary.state = "stopped";
    summary.error = String(error?.message || error).slice(0, 300);
    await save().catch(() => {});
    throw error;
  }
}

async function runSwitch(store: BookPointsStore, summary: SwitchSummary, now: () => number, save: () => Promise<void>): Promise<SwitchSummary> {
  const switched = switchedBooks(await store.allBooks(), await adminBookPoints(store));
  const changes = switched.filter((book) => book.to !== book.from);
  const before = summary.students;
  const students = new Set<number>();
  let checkedIn = now();
  const checkIn = async () => {
    if (now() - checkedIn < CHECK_IN_MS) return;
    checkedIn = now();
    summary.at = new Date(checkedIn).toISOString();
    await save();
  };

  // 1. The books. They go first: the database keeps a passed quiz equal to its
  //    book's points, so a quiz can't be moved until its book has been.
  for (const points of ARISE_POINTS) {
    const ids = changes.filter((c) => c.to === points).map((c) => c.id);
    if (!ids.length) continue;
    await store.setManyBookPoints(ids, points);
    summary.books += ids.length;
    await checkIn();
  }

  // 2. The students of every switched book, including a book an earlier run moved
  //    just before it was cut off: any quiz still holding other points is corrected.
  const earned = await store.booksWithPoints();
  for (const book of switched.filter((b) => earned.has(b.id))) {
    const changed = await rescoreBook(store, book.id, book.to, book.to, checkIn);
    for (const id of changed.studentIds) students.add(id);
    summary.attempts += changed.attempts;
    summary.students = before + students.size;
    await checkIn();
  }

  summary.state = "done";
  summary.at = new Date(now()).toISOString();
  delete summary.error;
  await save();
  return summary;
}

/**
 * Keeps the switch going until it has finished: starts it, and when it could
 * not finish (it is at work elsewhere, was cut off, or hit a problem) looks
 * again a little later. Returns a function that starts a try straight away.
 */
export function keepSwitching(
  store: BookPointsStore,
  onDone: (summary: SwitchSummary) => void,
  options: { againMs?: number; tries?: number; later?: (run: () => void, ms: number) => unknown; log?: (message: string) => void } = {},
): () => void {
  const againMs = options.againMs ?? 30_000;
  const later = options.later ?? ((run, ms) => setTimeout(run, ms));
  const log = options.log ?? ((message) => console.error(message));
  let triesLeft = options.tries ?? 240;
  let waiting = false;
  const again = () => {
    if (waiting || triesLeft <= 0) return;
    waiting = true;
    later(() => { waiting = false; attempt(); }, againMs);
  };
  const attempt = () => {
    triesLeft -= 1;
    void switchLibraryToArisePoints(store)
      .then(async (summary) => {
        if (summary) return onDone(summary);
        if ((await savedSwitch(store)).state !== "done") again();
      })
      .catch((error: any) => { log(`[book-points] switch stopped: ${error?.message || error}`); again(); });
  };
  return attempt;
}

export type BookPointsDeps = {
  store: BookPointsStore;
  /** Forgets cached books, students and leaderboards after points move. */
  clearCaches(): void;
  /** Starts a try at the one-time switch now (it does nothing if the switch is finished or already at work). */
  startSwitch?(): void;
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

  // Admin: where the one-time switch to A.R.I.S.E. points stands.
  app.get("/api/admin/book-points/switch", auth, admin, async (_req: any, res) => {
    try {
      res.set("Cache-Control", "no-store");
      return res.json(await switchStatus(deps.store));
    } catch (error: any) {
      console.error("[book-points] could not read the switch", error?.message);
      return res.status(500).json({ message: "Could not check the books' points. Try again in a moment." });
    }
  });

  // Admin: start (or pick up) the switch now. It carries on in the background.
  app.post("/api/admin/book-points/switch", auth, admin, async (_req: any, res) => {
    try {
      deps.startSwitch?.();
      // A moment for it to mark itself as running, so the answer says so.
      await new Promise((resolve) => setTimeout(resolve, 600));
      res.set("Cache-Control", "no-store");
      return res.json(await switchStatus(deps.store));
    } catch (error: any) {
      console.error("[book-points] could not start the switch", error?.message);
      return res.status(500).json({ message: "Could not start it. Try again in a moment." });
    }
  });
}
