import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { BookOpen, Eye, Gamepad2, Search, Sparkles } from "lucide-react";

function getTokenFromCookie(): string | null {
  try {
    const m = document.cookie.match(/arise_session=([^;]+)/);
    if (!m) return null;
    return JSON.parse(atob(m[1])).token || null;
  } catch { return null; }
}

export default function EyeGazeLessons() {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const [books, setBooks] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [custom, setCustom] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = token || getTokenFromCookie();
    if (!t) { setLoading(false); return; }
    Promise.all([
      fetch(`${API_BASE}/api/books`, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/api/eye-gaze/quizzes`, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" }).then(r => r.ok ? r.json() : []),
      fetch(`${API_BASE}/api/custom-quizzes`, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" }).then(r => r.ok ? r.json() : []),
    ]).then(([b,q,c]) => {
      setBooks(Array.isArray(b) ? b : []);
      setQuizzes(Array.isArray(q) ? q : []);
      setCustom((Array.isArray(c) ? c : []).filter((x:any) => x.quiz_type !== "regular"));
    }).finally(() => setLoading(false));
  }, [token]);

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return !q ? books : books.filter((b:any) => `${b.title || ""} ${b.author || ""}`.toLowerCase().includes(q));
  }, [books, search]);

  return (
    <div className="bg-[#f7fbff] min-h-screen px-4 sm:px-6 py-6">
      <div className="max-w-[1350px] mx-auto space-y-6">
        <section className="rounded-[2rem] bg-gradient-to-r from-sky-100 via-white to-violet-100 border border-sky-100 p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-5">
            <div className="w-24 h-24 rounded-[2rem] bg-white border-4 border-white shadow flex items-center justify-center text-6xl">📚</div>
            <div className="flex-1">
              <div className="text-sm font-black uppercase tracking-wider text-blue-600">My Lessons</div>
              <h1 className="text-3xl sm:text-5xl font-black text-blue-950 mt-1">What do you want to learn today?</h1>
              <p className="text-slate-600 font-semibold mt-2">Choose a book, an Eye Gaze lesson, or a reading game.</p>
            </div>
            <button onClick={() => navigate("/eye-gaze-games")} className="min-h-[72px] rounded-3xl bg-amber-400 hover:bg-amber-500 text-blue-950 px-6 font-black text-lg flex items-center justify-center gap-2">
              <Gamepad2 className="w-6 h-6" /> Play Reading Games
            </button>
          </div>
        </section>

        <div className="relative">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-blue-400" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find a book or lesson..." className="w-full h-16 rounded-3xl border-2 border-sky-100 bg-white pl-14 pr-5 text-lg font-bold text-slate-900 outline-none focus:border-blue-400" />
        </div>

        {(quizzes.length > 0 || custom.length > 0) && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-7 h-7 text-blue-500" />
              <h2 className="text-2xl font-black text-blue-950">Eye Gaze Lessons</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quizzes.map((q:any) => (
                <button key={`b-${q.id}`} onClick={()=>navigate(`/eye-gaze-quiz/${q.id}?mode=quiz`)} className="min-h-[190px] rounded-[2rem] border-2 border-blue-100 bg-white p-5 text-left hover:border-blue-400 transition">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-3xl mb-4">👀</div>
                  <h3 className="text-xl font-black text-blue-950">{q.title}</h3>
                  <p className="text-sm text-slate-500 mt-2">{q.description || "Eye Gaze reading lesson"}</p>
                  <div className="mt-4 text-sm font-black text-blue-600">START LESSON →</div>
                </button>
              ))}
              {custom.map((q:any) => (
                <button key={`c-${q.id}`} onClick={()=>navigate(`/custom-quiz/${q.id}?mode=quiz`)} className="min-h-[190px] rounded-[2rem] border-2 border-violet-100 bg-white p-5 text-left hover:border-violet-400 transition">
                  <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center text-3xl mb-4">⭐</div>
                  <h3 className="text-xl font-black text-blue-950">{q.title}</h3>
                  <p className="text-sm text-slate-500 mt-2">{q.description || "Custom Eye Gaze lesson"}</p>
                  <div className="mt-4 text-sm font-black text-violet-600">START LESSON →</div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-7 h-7 text-emerald-500" />
            <h2 className="text-2xl font-black text-blue-950">My Reading Books</h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">{Array.from({length:10}).map((_,i)=><div key={i} className="aspect-[2/3] rounded-3xl bg-white animate-pulse" />)}</div>
          ) : filteredBooks.length === 0 ? (
            <div className="rounded-3xl bg-white border border-sky-100 p-10 text-center font-bold text-slate-500">No reading books found.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {filteredBooks.map((book:any) => (
                <button key={book.id} onClick={()=>navigate(`/quiz/${book.id}`)} className="rounded-3xl overflow-hidden border-2 border-sky-100 bg-white text-left hover:border-blue-400 hover:-translate-y-1 transition">
                  <div className="aspect-[2/3] bg-sky-50 flex items-center justify-center overflow-hidden">
                    {book.coverUrl ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" /> : <div className="text-6xl">📘</div>}
                  </div>
                  <div className="p-4">
                    <h3 className="font-black text-blue-950 leading-tight line-clamp-2">{book.title}</h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{book.author}</p>
                    <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs font-black text-amber-700">
                      <Sparkles className="w-3 h-3" /> {book.pointsValue || 10} pts
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
