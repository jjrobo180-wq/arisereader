import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { BookOpen, Gamepad2, Search, Sparkles } from "lucide-react";

function getTokenFromCookie(): string | null {
  try {
    const m = document.cookie.match(/arise_session=([^;]+)/);
    if (!m) return null;
    return JSON.parse(atob(m[1])).token || null;
  } catch {
    return null;
  }
}

function lessonVisual(title: string) {
  const t = (title || "").toLowerCase();
  if (/animal|zoo|pet|dog|cat/.test(t)) return "🐶";
  if (/food|eat|drink|snack|meal/.test(t)) return "🍎";
  if (/feel|emotion|happy|sad|mad/.test(t)) return "😊";
  if (/color|rainbow/.test(t)) return "🌈";
  if (/home|house|family/.test(t)) return "🏠";
  if (/school|class|teacher/.test(t)) return "🎒";
  if (/body|health/.test(t)) return "🧍";
  if (/weather|sun|rain/.test(t)) return "☀️";
  if (/number|count|math/.test(t)) return "🔢";
  if (/letter|alphabet|phon|sound/.test(t)) return "🔤";
  if (/word|vocab|sight/.test(t)) return "💬";
  if (/story|read|book/.test(t)) return "📖";
  if (/friend|social/.test(t)) return "🤝";
  return "🧩";
}

export default function EyeGazeLessons() {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const [books, setBooks] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [custom, setCustom] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"lessons" | "books">("lessons");

  useEffect(() => {
    const t = token || getTokenFromCookie();
    if (!t) {
      setLoading(false);
      return;
    }
    Promise.all([
      fetch(`${API_BASE}/api/books`, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/api/eye-gaze/quizzes`, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/api/custom-quizzes`, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" }).then(r => r.ok ? r.json() : []),
    ]).then(([b, q, c]) => {
      setBooks(Array.isArray(b) ? b : []);
      setQuizzes(Array.isArray(q) ? q : []);
      setCustom((Array.isArray(c) ? c : []).filter((x: any) => x.quiz_type !== "regular"));
    }).finally(() => setLoading(false));
  }, [token]);

  const lessons = useMemo(() => [
    ...quizzes.map((q: any) => ({ ...q, kind: "built" as const })),
    ...custom.map((q: any) => ({ ...q, kind: "custom" as const })),
  ], [quizzes, custom]);

  const filteredLessons = useMemo(() => {
    const q = search.trim().toLowerCase();
    return !q ? lessons : lessons.filter((item: any) => `${item.title || ""} ${item.description || ""}`.toLowerCase().includes(q));
  }, [lessons, search]);

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return !q ? books : books.filter((b: any) => `${b.title || ""} ${b.author || ""}`.toLowerCase().includes(q));
  }, [books, search]);

  return (
    <main className="max-w-[1350px] mx-auto px-4 sm:px-6 py-5 space-y-4">
      <section className="rounded-[2rem] bg-gradient-to-r from-sky-100 via-white to-violet-100 border border-sky-100 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="w-20 h-20 rounded-[1.7rem] bg-white shadow flex items-center justify-center text-5xl">📚</div>
          <div className="flex-1">
            <p className="text-sm font-black uppercase tracking-wider text-blue-600">Learning Library</p>
            <h1 className="text-3xl sm:text-4xl font-black text-blue-950">Pick a picture. Pick a lesson.</h1>
            <p className="text-slate-600 font-semibold mt-1">Lessons and books are separated so the page stays simple.</p>
          </div>
          <button onClick={() => navigate("/eye-gaze-games")} className="min-h-[58px] rounded-2xl bg-amber-400 hover:bg-amber-500 text-blue-950 px-5 font-black flex items-center justify-center gap-2">
            <Gamepad2 className="w-5 h-5" /> Reading Games
          </button>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 gap-3">
        <button type="button" onClick={() => navigate("/buddy-world")} className="rounded-3xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-100 to-sky-50 p-4 flex items-center gap-4 text-left hover:border-emerald-400">
          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-4xl flex-shrink-0">🏠</div>
          <div>
            <div className="text-lg font-black text-blue-950">Buddy World</div>
            <div className="text-sm font-bold text-slate-600">Home, kitchen, zoo, park & everyday words</div>
          </div>
        </button>
        <button type="button" onClick={() => navigate("/eye-gaze-talker")} className="rounded-3xl border-2 border-teal-200 bg-gradient-to-r from-teal-100 to-cyan-50 p-4 flex items-center gap-4 text-left hover:border-teal-400">
          <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-4xl flex-shrink-0">🗣️</div>
          <div>
            <div className="text-lg font-black text-blue-950">My Talker</div>
            <div className="text-sm font-bold text-slate-600">Practice familiar pictures, words, and phrases</div>
          </div>
        </button>
      </section>

      <section className="rounded-3xl bg-white border border-sky-100 p-2 flex gap-2">
        <button type="button" onClick={() => { setTab("lessons"); setSearch(""); }} className={`flex-1 min-h-[54px] rounded-2xl font-black transition-colors ${tab === "lessons" ? "bg-blue-600 text-white" : "bg-sky-50 text-blue-800"}`}>
          🧩 Lessons ({lessons.length})
        </button>
        <button type="button" onClick={() => { setTab("books"); setSearch(""); }} className={`flex-1 min-h-[54px] rounded-2xl font-black transition-colors ${tab === "books" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-800"}`}>
          📚 Books ({books.length})
        </button>
      </section>

      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tab === "lessons" ? "Find a lesson..." : "Find a book..."}
          className="w-full h-14 rounded-2xl border-2 border-sky-100 bg-white pl-14 pr-5 text-base font-bold text-slate-900 outline-none focus:border-blue-400"
        />
      </div>

      {tab === "lessons" ? (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="text-2xl">👀</div>
            <h2 className="text-2xl font-black text-blue-950">Eye Gaze Lessons</h2>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-40 rounded-3xl bg-white animate-pulse" />)}</div>
          ) : filteredLessons.length === 0 ? (
            <div className="rounded-3xl bg-white border border-sky-100 p-8 text-center font-bold text-slate-500">No lessons found.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {filteredLessons.map((item: any) => {
                const picture = lessonVisual(item.title);
                return (
                  <button
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    onClick={() => navigate(item.kind === "custom" ? `/custom-quiz/${item.id}?mode=quiz` : `/eye-gaze-quiz/${item.id}?mode=quiz`)}
                    className="min-h-[165px] rounded-[1.7rem] border-2 border-blue-100 bg-white p-4 text-left hover:border-blue-400 hover:-translate-y-0.5 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-100 to-violet-100 flex items-center justify-center text-4xl flex-shrink-0" aria-hidden="true">{picture}</div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-black text-blue-950 leading-tight">{picture} {item.title}</h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.description || "Picture-supported Eye Gaze lesson"}</p>
                      </div>
                    </div>
                    <div className="mt-4 text-xs font-black text-blue-600">START LESSON →</div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-6 h-6 text-emerald-500" />
            <h2 className="text-2xl font-black text-blue-950">Reading Books</h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[2/3] rounded-3xl bg-white animate-pulse" />)}</div>
          ) : filteredBooks.length === 0 ? (
            <div className="rounded-3xl bg-white border border-sky-100 p-8 text-center font-bold text-slate-500">No reading books found.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredBooks.map((book: any) => (
                <button key={book.id} onClick={() => navigate(`/quiz/${book.id}`)} className="rounded-3xl overflow-hidden border-2 border-sky-100 bg-white text-left hover:border-blue-400 hover:-translate-y-1 transition">
                  <div className="aspect-[2/3] bg-sky-50 flex items-center justify-center overflow-hidden">
                    {book.coverUrl ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" /> : <div className="text-6xl">📘</div>}
                  </div>
                  <div className="p-3">
                    <h3 className="font-black text-blue-950 text-sm leading-tight line-clamp-2">{book.title}</h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{book.author}</p>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-[10px] font-black text-amber-700">
                      <Sparkles className="w-3 h-3" /> {book.pointsValue || 10} pts
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
