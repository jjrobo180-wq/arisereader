// Keeps one library quiz (a `books` row plus its `questions`) for every Arise
// News story. Pure logic over a small storage interface so it can be tested.
import { NEWS_ARTICLES, NEWS_AUTHOR, NEWS_POINTS, type NewsArticle } from "../shared/ariseNews";

export const NEWS_BOOKS_KEY = "arise_news_book_ids";
export const NEWS_RETIRED_KEY = "arise_news_retired_book_ids";

export type NewsStore = {
  getSetting(key: string): Promise<string>;
  upsertSetting(key: string, value: string): Promise<void>;
  getAllBooks(): Promise<{ id: number; title: string; author: string }[]>;
  createBookWithQuestions(book: any, questions: any[]): Promise<{ id: number }>;
  /** Takes a book out of the library (points to 0) without touching anyone's past results. */
  retireBook?(id: number): Promise<void>;
};

export const newsCoverUrl = (a: NewsArticle) => `/covers/news/${a.slug}.svg`;

/** Makes sure every story has its library quiz. Returns { slug: bookId }. Safe to call often. */
export async function syncNewsBooks(store: NewsStore, articles: NewsArticle[] = NEWS_ARTICLES): Promise<Record<string, number>> {
  let map: Record<string, number> = {};
  try { map = JSON.parse((await store.getSetting(NEWS_BOOKS_KEY)) || "{}") || {}; } catch { map = {}; }
  const books = await store.getAllBooks();
  // if the book list failed to load, don't risk making duplicates; try again later
  if (!books.length && Object.keys(map).length) return map;
  const byId = new Set(books.map((b) => Number(b.id)));
  let changed = false;
  for (const a of articles) {
    if (map[a.slug] && byId.has(Number(map[a.slug]))) continue;
    // reuse a row from an earlier run (say, if saving the map failed) before making a new one
    const existing = books.find((b) => b.title === a.title && b.author === NEWS_AUTHOR);
    if (existing) { map[a.slug] = Number(existing.id); changed = true; continue; }
    const created = await store.createBookWithQuestions(
      { title: a.title, author: NEWS_AUTHOR, ageGroup: a.grades, coverUrl: newsCoverUrl(a), description: a.dek, pointsValue: NEWS_POINTS, readUrl: null, keepPoints: true },
      a.questions.map((q) => ({ question: q.question, options: q.options, correct: q.correct })),
    );
    map[a.slug] = Number(created.id); changed = true;
  }
  // stories taken out of the issue leave the library; students keep any points they earned
  let retired: number[] = [];
  try { retired = JSON.parse((await store.getSetting(NEWS_RETIRED_KEY)) || "[]") || []; } catch { retired = []; }
  const current = new Set(articles.map((a) => a.slug));
  for (const [slug, id] of Object.entries(map)) {
    if (current.has(slug) || retired.includes(Number(id)) || !store.retireBook) continue;
    await store.retireBook(Number(id));
    retired.push(Number(id));
    await store.upsertSetting(NEWS_RETIRED_KEY, JSON.stringify(retired));
  }
  if (changed) await store.upsertSetting(NEWS_BOOKS_KEY, JSON.stringify(map));
  return Object.fromEntries(Object.entries(map).filter(([slug]) => current.has(slug)));
}

