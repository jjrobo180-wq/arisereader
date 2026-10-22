// Eye Gazer "Lessons & Books" (#/eye-gaze-lessons, also inside Games). Lessons come in four steps,
// easiest first; each lesson teaches a few words with pictures, then asks 5 questions.
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, Check, ChevronRight, Search, Star } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import GazeButton from "@/components/eye-gaze/GazeButton";
import LessonPicture from "@/components/eye-gaze/LessonPicture";
import { isPictureFile } from "@/lib/eyeGazeLesson";
import { LESSON_POINTS, LESSON_STEPS, picturePath, type LessonStep } from "@shared/eyegaze/lessonSteps";

function getTokenFromCookie(): string | null {
  try {
    const m = document.cookie.match(/arise_session=([^;]+)/);
    if (!m) return null;
    return JSON.parse(atob(m[1])).token || null;
  } catch {
    return null;
  }
}

type Lesson = { id: number; title: string; description?: string; level?: number; cover_visual?: string; hasCompleted?: boolean; score?: number | null; total?: number | null };

function LessonCard({ lesson, onOpen, cover }: { lesson: Lesson; onOpen: () => void; cover?: string | null }) {
  const done = !!lesson.hasCompleted;
  const scored = done && lesson.total ? `${lesson.score ?? 0} of ${lesson.total}` : "";
  return (
    <GazeButton onSelect={onOpen} barClass="h-2.5"
      label={`${lesson.title}. ${done ? "Done. Practice it again." : `Pass the quiz for ${LESSON_POINTS} points.`}`}
      className={`min-h-[150px] w-full rounded-[1.75rem] border-4 p-4 text-left flex items-center gap-4 shadow-sm ${done ? "border-emerald-200 bg-emerald-50/70 hover:border-emerald-400" : "border-teal-100 bg-white hover:border-teal-400"}`}>
      <span className="grid h-24 w-24 flex-shrink-0 place-items-center rounded-3xl bg-slate-50">
        <LessonPicture src={cover || lesson.cover_visual || picturePath("puzzle")} alt="" className="h-20 w-20" emojiClassName="text-6xl" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xl sm:text-2xl font-black leading-tight text-teal-950">{lesson.title}</span>
        {lesson.description && <span className="mt-1 block text-sm sm:text-base font-semibold text-slate-600 line-clamp-2">{lesson.description}</span>}
        <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-black ${done ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
          {done ? <><Check className="h-4 w-4" aria-hidden="true" />Done{scored ? ` · ${scored}` : ""}</> : <><Star className="h-4 w-4 fill-amber-400 text-amber-500" aria-hidden="true" />{LESSON_POINTS} points</>}
        </span>
      </span>
    </GazeButton>
  );
}

export default function EyeGazeLessons({ embedded = false }: { embedded?: boolean }) {
  const { token } = useAuth();
  const [, navigate] = useLocation();
  const [books, setBooks] = useState<any[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
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
    const get = (path: string) => fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" }).then(r => (r.ok ? r.json() : [])).catch(() => []);
    Promise.all([get("/api/eye-gaze/quizzes"), get("/api/custom-quizzes"), get("/api/books")]).then(([q, c, b]) => {
      setLessons(Array.isArray(q) ? q : []);
      setCustom((Array.isArray(c) ? c : []).filter((x: any) => x.quiz_type !== "regular"));
      setBooks(Array.isArray(b) ? b : []);
    }).finally(() => setLoading(false));
  }, [token]);

  const done = lessons.filter(l => l.hasCompleted).length;
  const nextUp = lessons.find(l => !l.hasCompleted) || null;
  const steps = useMemo(() => {
    const groups = ([1, 2, 3, 4] as LessonStep[]).map(step => ({ step, name: LESSON_STEPS[step].name, blurb: LESSON_STEPS[step].blurb, items: lessons.filter(l => Number(l.level) === step) }));
    const other = lessons.filter(l => !groups.some(g => g.items.includes(l)));
    return [...groups, ...(other.length ? [{ step: 0, name: "More lessons", blurb: "", items: other }] : [])].filter(g => g.items.length);
  }, [lessons]);

  const filteredBooks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return !q ? books : books.filter((b: any) => `${b.title || ""} ${b.author || ""}`.toLowerCase().includes(q));
  }, [books, search]);

  const openLesson = (lesson: Lesson) => navigate(`/eye-gaze-quiz/${lesson.id}`);
  const customCover = (quiz: any) => (quiz.questions || []).map((q: any) => q.question_image).find(isPictureFile) || picturePath("teacher");

  return (
    <main className="max-w-[1350px] mx-auto px-4 sm:px-6 py-5 space-y-5">
      {!embedded && (
        <section className="rounded-[2rem] bg-[#fffaf0] border-4 border-teal-100 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center gap-4">
          <LessonPicture src={picturePath("book")} alt="" className="h-20 w-20" />
          <div className="flex-1">
            <p className="text-sm font-black uppercase tracking-wider text-teal-700">Lessons &amp; Books</p>
            <h1 className="text-3xl sm:text-4xl font-black text-teal-950">Learn the words, then take the quiz.</h1>
            <p className="text-slate-700 font-semibold mt-1">Look at a button until the yellow bar fills, or tap it.</p>
          </div>
          {lessons.length > 0 && (
            <div className="rounded-2xl bg-white border-4 border-amber-200 px-5 py-3 min-w-[230px]">
              <div className="flex items-center gap-2 font-black text-lg text-amber-900"><Star className="w-5 h-5 fill-amber-400 text-amber-500" aria-hidden="true" />{done} of {lessons.length} lessons done</div>
              <div className="mt-2 h-3 rounded-full bg-amber-100 overflow-hidden" aria-hidden="true"><div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.round((done / lessons.length) * 100)}%` }} /></div>
              <div className="mt-1 text-sm font-bold text-slate-600">Pass a quiz the first time = {LESSON_POINTS} points</div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-3xl bg-white border-4 border-teal-100 p-2 grid grid-cols-2 gap-2" role="tablist" aria-label="Lessons or books">
        <GazeButton pressed={tab === "lessons"} onSelect={() => setTab("lessons")}
          className={`min-h-[64px] rounded-2xl text-lg sm:text-xl font-black ${tab === "lessons" ? "bg-teal-700 text-white" : "bg-teal-50 text-teal-900"}`}>
          🧩 Lessons ({lessons.length + custom.length})
        </GazeButton>
        <GazeButton pressed={tab === "books"} onSelect={() => { setTab("books"); setSearch(""); }}
          className={`min-h-[64px] rounded-2xl text-lg sm:text-xl font-black ${tab === "books" ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-900"}`}>
          📚 Books ({books.length})
        </GazeButton>
      </section>

      {tab === "lessons" ? (
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="status" aria-label="Loading lessons">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[150px] rounded-[1.75rem] bg-white/70 animate-pulse" />)}
          </div>
        ) : !lessons.length && !custom.length ? (
          <div className="rounded-3xl bg-white border-4 border-teal-100 p-8 text-center text-xl font-bold text-slate-600">The lessons are getting ready. Please check back soon.</div>
        ) : (
          <>
            {nextUp && (
              <GazeButton onSelect={() => openLesson(nextUp)} barClass="h-3" label={`Keep going: ${nextUp.title}`}
                className="w-full min-h-[120px] rounded-[2rem] border-4 border-amber-300 bg-amber-100 p-4 sm:p-5 text-left flex items-center gap-4 shadow-sm hover:border-amber-400">
                <span className="grid h-24 w-24 flex-shrink-0 place-items-center rounded-3xl bg-white">
                  <LessonPicture src={nextUp.cover_visual} alt="" className="h-20 w-20" emojiClassName="text-6xl" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-black uppercase tracking-wider text-amber-800">{done ? "Keep going" : "Start here"}</span>
                  <span className="block text-2xl sm:text-4xl font-black text-amber-950 leading-tight">{nextUp.title}</span>
                </span>
                <ChevronRight className="w-12 h-12 text-amber-800 flex-shrink-0" aria-hidden="true" />
              </GazeButton>
            )}
            {steps.map(group => {
              const groupDone = group.items.filter(l => l.hasCompleted).length;
              return (
                <section key={group.step} aria-labelledby={`step-${group.step}`}>
                  <div className="flex flex-wrap items-end gap-x-3 gap-y-1 mb-3">
                    <h2 id={`step-${group.step}`} className="text-2xl sm:text-3xl font-black text-teal-950">
                      {group.step ? <span className="text-teal-600">Step {group.step} · </span> : null}{group.name}
                    </h2>
                    {group.blurb && <p className="text-base font-semibold text-slate-600">{group.blurb}</p>}
                    <span className="ml-auto rounded-full bg-white border-2 border-teal-100 px-3 py-1 text-sm font-black text-teal-900">{groupDone} of {group.items.length} done</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {group.items.map(lesson => <LessonCard key={lesson.id} lesson={lesson} onOpen={() => openLesson(lesson)} />)}
                  </div>
                </section>
              );
            })}
            {custom.length > 0 && (
              <section aria-labelledby="from-teacher">
                <div className="flex flex-wrap items-end gap-x-3 mb-3">
                  <h2 id="from-teacher" className="text-2xl sm:text-3xl font-black text-teal-950">From my teacher</h2>
                  <p className="text-base font-semibold text-slate-600">Quizzes my teacher made for me.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {custom.map((quiz: any) => (
                    <LessonCard key={`custom-${quiz.id}`} cover={customCover(quiz)}
                      lesson={{ id: quiz.id, title: quiz.title, description: String(quiz.description || "").replace(/^AI-generated eye gaze quiz about\s+/i, "A quiz about "), hasCompleted: quiz.hasCompleted }}
                      onOpen={() => navigate(`/custom-quiz/${quiz.id}`)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )
      ) : (
        <section>
          <div className="relative mb-3">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-teal-500" aria-hidden="true" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Find a book..."
              aria-label="Find a book"
              className="w-full h-14 rounded-2xl border-4 border-teal-100 bg-white pl-14 pr-5 text-base font-bold text-slate-900 outline-none focus:border-teal-400"
            />
          </div>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-6 h-6 text-emerald-600" aria-hidden="true" />
            <h2 className="text-2xl font-black text-teal-950">Books</h2>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">{Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[2/3] rounded-3xl bg-white animate-pulse" />)}</div>
          ) : filteredBooks.length === 0 ? (
            <div className="rounded-3xl bg-white border-4 border-teal-100 p-8 text-center font-bold text-slate-500">No reading books found.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredBooks.map((book: any) => (
                <GazeButton key={book.id} label={`${book.title}. Pass the quiz for ${book.pointsValue || 10} points.`} onSelect={() => navigate(`/quiz/${book.id}`)} className="rounded-3xl border-4 border-teal-100 bg-white text-left hover:border-teal-400">
                  <div className="aspect-[2/3] bg-sky-50 flex items-center justify-center overflow-hidden">
                    {book.coverUrl ? <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" /> : <div className="text-6xl">📘</div>}
                  </div>
                  <div className="p-3">
                    <h3 className="font-black text-teal-950 text-sm leading-tight line-clamp-2">{book.title}</h3>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{book.author}</p>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-500" aria-hidden="true" /> Pass = {book.pointsValue || 10} pts
                    </div>
                  </div>
                </GazeButton>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
