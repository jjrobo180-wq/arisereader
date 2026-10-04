// Arise News in the library. Each story in shared/ariseNews.ts is stored as an
// ordinary 5-point library quiz (a `books` row plus its `questions`), so it uses
// the same quiz page, proctoring, attempts and leaderboard as every other quiz.
// The rows are created the first time anyone opens the news (and whenever a new
// story is added to the issue); the slug → book id map lives in settings.
import type { Express, RequestHandler } from "express";
import { storage, clearCache } from "./storage";
import { getAdminSupabase } from "./supabase";
import { NEWS_POINTS } from "../shared/ariseNews";
import { syncNewsBooks, type NewsStore } from "./ariseNewsSync";

let inFlight: Promise<Record<string, number>> | null = null;
let cached: { at: number; map: Record<string, number> } | null = null;

/** One sync at a time, then remembered for a few minutes. */
export function newsBooks(): Promise<Record<string, number>> {
  if (cached && Date.now() - cached.at < 5 * 60_000) return Promise.resolve(cached.map);
  if (!inFlight) {
    const store: NewsStore = {
      getSetting: (k) => storage.getSetting(k),
      upsertSetting: (k, v) => storage.upsertSetting(k, v),
      getAllBooks: () => storage.getAllBooks(),
      createBookWithQuestions: (b, q) => storage.createBookWithQuestions(b, q),
      async retireBook(id) {
        const { error } = await getAdminSupabase().from("books").update({ points_value: 0 }).eq("id", id);
        if (error) throw new Error(error.message);
        clearCache("allBooks");
      },
    };
    inFlight = syncNewsBooks(store)
      .then((map) => { cached = { at: Date.now(), map }; return map; })
      .finally(() => { inFlight = null; });
  }
  return inFlight;
}

export function registerAriseNewsRoutes(app: Express, authMiddleware: RequestHandler) {
  app.get("/api/news/books", authMiddleware, async (_req, res) => {
    try {
      res.json({ books: await newsBooks(), points: NEWS_POINTS });
    } catch (e: any) {
      console.error("[arise-news] could not sync the news quizzes:", e?.message || e);
      res.status(500).json({ message: "The news quizzes couldn't load right now. Try again in a minute." });
    }
  });
}
