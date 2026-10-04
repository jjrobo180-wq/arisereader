// Gives each new Read on Arise book (the keyed ones) a normal library quiz:
// a `books` row plus 10 `questions`, created the first time anyone asks. If the
// library already has the book with no questions, those questions are added to
// it instead of making a duplicate. The key → book id map lives in settings.
import type { Express } from "express";
import { storage, clearCache } from "./storage";
import { getAdminSupabase } from "./supabase";
import { syncReadsBooks, type ReadsStore } from "./readsSyncCore";
export { READS_BOOKS_KEY } from "./readsSyncCore";

let inFlight: Promise<Record<string, number>> | null = null;
let cached: { at: number; map: Record<string, number> } | null = null;

export function readsBooks(): Promise<Record<string, number>> {
  if (cached && Date.now() - cached.at < 10 * 60_000) return Promise.resolve(cached.map);
  if (!inFlight) {
    const db = getAdminSupabase();
    const store: ReadsStore = {
      getSetting: (k) => storage.getSetting(k),
      upsertSetting: (k, v) => storage.upsertSetting(k, v),
      getAllBooks: () => storage.getAllBooks(),
      async questionCount(bookId) {
        const { count, error } = await db.from("questions").select("id", { count: "exact", head: true }).eq("book_id", bookId);
        if (error) throw new Error(error.message);
        return count ?? 0;
      },
      async addQuestions(bookId, q) {
        const rows = q.questions.map((x, i) => ({ book_id: bookId, question_text: x.question, option_a: x.options[0], option_b: x.options[1], option_c: x.options[2], option_d: x.options[3], correct_answer: x.correct, question_order: i }));
        const { error } = await db.from("questions").insert(rows);
        if (error) throw new Error(error.message);
        await db.from("books").update({ points_value: q.points }).eq("id", bookId).eq("points_value", 0);
        clearCache("allBooks");
      },
      createBookWithQuestions: (b, q) => storage.createBookWithQuestions(b, q),
    };
    inFlight = syncReadsBooks(store)
      .then((map) => { cached = { at: Date.now(), map }; return map; })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

export function registerReadsRoutes(app: Express) {
  app.get("/api/reads/books", async (_req, res) => {
    try { res.json({ books: await readsBooks() }); }
    catch (e: any) {
      console.error("[reads] could not sync the reads quizzes:", e?.message || e);
      res.status(500).json({ message: "Couldn't load the new books right now." });
    }
  });
}
