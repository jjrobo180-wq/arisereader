import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { SECTION_COLORS, type NewsArticle } from "@shared/ariseNews";
import { newsHeroSvg } from "@shared/newsArt";

export type NewsResult = { bookId: number; score: number; total: number; passed?: boolean; pointsEarned?: number };

/** The news fonts load only when someone opens the news. */
function useNewsFonts() {
  useEffect(() => {
    const id = "arise-news-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id; link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400&display=swap";
    document.head.appendChild(link);
  }, []);
}

/** Which library quiz belongs to each story, and how the reader did on it. */
export function useNews() {
  const { token, user } = useAuth();
  const [books, setBooks] = useState<Record<string, number> | null>(null);
  const [results, setResults] = useState<NewsResult[]>([]);
  const [error, setError] = useState("");
  useNewsFonts();
  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    let alive = true;
    fetch(`${API_BASE}/api/news/books`, { headers }).then(async (r) => {
      const d = await r.json().catch(() => ({}));
      if (!alive) return;
      if (r.ok) setBooks(d.books || {}); else { setBooks({}); setError(d.message || "The quizzes couldn't load right now."); }
    }).catch(() => { if (alive) { setBooks({}); setError("The quizzes couldn't load right now."); } });
    fetch(`${API_BASE}/api/profile`, { headers }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (alive && d) setResults(d.quizResults || []); }).catch(() => {});
    return () => { alive = false; };
  }, [token]);
  const resultFor = useMemo(() => (a: NewsArticle) => {
    const id = books?.[a.slug];
    return id ? results.find((r) => r.bookId === id) ?? null : null;
  }, [books, results]);
  const canTakeQuiz = !(user?.role === "teacher" || (user as any)?.isAdmin);
  return { books, resultFor, error, canTakeQuiz };
}

export const sectionStyle = (a: NewsArticle) => {
  const c = SECTION_COLORS[a.section];
  return { "--sec": c.ink, "--tint": c.tint, "--deep": c.deep } as CSSProperties;
};

export function NewsArt({ article, className = "nw-art", children }: { article: NewsArticle; className?: string; children?: ReactNode }) {
  const svg = useMemo(() => newsHeroSvg(article), [article]);
  return <div className={className} style={sectionStyle(article)}><div style={{ width: "100%", height: "100%" }} dangerouslySetInnerHTML={{ __html: svg }} />{children}</div>;
}

export const shortDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
export const formatNewsDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
