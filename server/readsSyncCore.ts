// Pure logic for the Read on Arise library quizzes (see readsSync.ts), over a small storage interface so it can be tested.
import { READS_QUIZZES, type ReadsQuiz } from "../shared/readsQuizzes";
// A.R.I.S.E. points go 5 to 30 in fives; the list's older, smaller values are stepped up to match.
import { convertedPoints } from "../shared/bookPoints";

export const READS_BOOKS_KEY = "reads_book_ids";

export type ReadsStore = {
  getSetting(key: string): Promise<string>;
  upsertSetting(key: string, value: string): Promise<void>;
  getAllBooks(): Promise<{ id: number; title: string; author: string }[]>;
  questionCount(bookId: number): Promise<number>;
  addQuestions(bookId: number, quiz: ReadsQuiz): Promise<void>;
  createBookWithQuestions(book: any, questions: any[]): Promise<{ id: number }>;
};

const coverFor = (key: string) => `/covers/reads/${key}.svg`;

/** Makes sure every keyed book has its library quiz. Returns { key: bookId }. Safe to call often. */
export async function syncReadsBooks(store: ReadsStore, quizzes: ReadsQuiz[] = READS_QUIZZES): Promise<Record<string, number>> {
  let map: Record<string, number> = {};
  try { map = JSON.parse((await store.getSetting(READS_BOOKS_KEY)) || "{}") || {}; } catch { map = {}; }
  const books = await store.getAllBooks();
  if (!books.length && Object.keys(map).length) return map;
  const byId = new Set(books.map((b) => Number(b.id)));
  let changed = false;
  for (const q of quizzes) {
    if (map[q.key] && byId.has(Number(map[q.key]))) continue;
    const names = [q.title, ...(q.matchTitles ?? [])].map((t) => t.toLowerCase());
    const existing = books.find((b) => names.includes(String(b.title).toLowerCase()));
    if (existing) {
      if ((await store.questionCount(Number(existing.id))) === 0) await store.addQuestions(Number(existing.id), q);
      map[q.key] = Number(existing.id); changed = true; continue;
    }
    const created = await store.createBookWithQuestions(
      { title: q.title, author: q.author, ageGroup: q.ageGroup, coverUrl: coverFor(q.key), description: q.description, pointsValue: convertedPoints(q.points) ?? q.points, readUrl: null, keepPoints: true },
      q.questions.map((x) => ({ question: x.question, options: x.options, correct: x.correct })),
    );
    map[q.key] = Number(created.id); changed = true;
  }
  if (changed) await store.upsertSetting(READS_BOOKS_KEY, JSON.stringify(map));
  return map;
}

