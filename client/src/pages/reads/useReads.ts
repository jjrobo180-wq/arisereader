import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { setReadsKeyIds, type ReadableBook } from "@shared/readsCatalog";

/** Progress is saved per book: by its key for the newer books, by book id for the rest. */
export const progressKey = (b: ReadableBook) => b.key ?? String(b.bookId);

let keyIdsLoad: Promise<void> | null = null;
/** Loads library ids for the keyed books once per visit (they're made on the server the first time). */
export function loadReadsKeyIds() {
  if (!keyIdsLoad) keyIdsLoad = fetch(`${API_BASE}/api/reads/books`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.books) setReadsKeyIds(d.books); }).catch(() => { keyIdsLoad = null; });
  return keyIdsLoad;
}

export type LibBook = { id: number; title: string; author: string; ageGroup: string; coverUrl: string | null; pointsValue: number };
export type QuizResult = { bookId: number; score: number; total: number; passed?: boolean; pointsEarned?: number };
export type Progress = Record<string, { chapter: number; at: number; of: number; finished?: boolean }>;

const key = (userId: number | undefined) => `reads_progress_${userId ?? "me"}`;
export function readProgress(userId: number | undefined): Progress {
  try { return JSON.parse(localStorage.getItem(key(userId)) || "{}") || {}; } catch { return {}; }
}
export function saveProgress(userId: number | undefined, bookId: number | string, p: Progress[string]) {
  try { const all = readProgress(userId); all[bookId] = p; localStorage.setItem(key(userId), JSON.stringify(all)); } catch { /* fine */ }
}

/** The reader's library books (respecting grade bands) and quiz results. */
export function useLibrary() {
  const { token, user } = useAuth();
  const [books, setBooks] = useState<LibBook[] | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [, setIdsReady] = useState(0);
  useEffect(() => { loadReadsKeyIds()?.then(() => setIdsReady((n) => n + 1)); }, []);
  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    fetch(`${API_BASE}/api/books`, { headers }).then((r) => (r.ok ? r.json() : [])).then((d) => setBooks(Array.isArray(d) ? d : [])).catch(() => setBooks([]));
    fetch(`${API_BASE}/api/profile`, { headers }).then((r) => (r.ok ? r.json() : null)).then((d) => d && setResults(d.quizResults || [])).catch(() => {});
  }, [token]);
  return { books, results, user, canTakeQuiz: !(user?.role === "teacher" || (user as any)?.isAdmin) };
}

export function useReadsFonts() {
  useEffect(() => {
    const id = "arise-news-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&display=swap";
    document.head.appendChild(link);
  }, []);
}

export const timeLabel = (words: number) => { const m = Math.round(words / 200); return m < 60 ? `${Math.max(1, m)} min` : `${Math.round(m / 60 * 10) / 10} hr`; };
