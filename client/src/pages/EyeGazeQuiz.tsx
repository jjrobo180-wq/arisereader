// An Eye Gazer lesson (#/eye-gaze-quiz/:id). Students get the lesson player: learn the words,
// then the quiz. Teachers and the admin see the whole lesson with its answers and can try it.
import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Check, Play } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import LessonPlayer from "@/components/eye-gaze/LessonPlayer";
import LessonPicture from "@/components/eye-gaze/LessonPicture";
import { builtInQuestion, lessonInfo, nextLessonId } from "@/lib/eyeGazeLesson";
import { LESSON_STEPS, type LessonStep } from "@shared/eyegaze/lessonSteps";

function cookieToken(): string | null {
  try {
    const match = document.cookie.match(/arise_session=([^;]+)/);
    return match ? JSON.parse(atob(match[1])).token || null : null;
  } catch {
    return null;
  }
}

/** The whole lesson with its answers, for teachers and the admin. */
function LessonOverview({ lesson, onTry, onBack }: { lesson: any; onTry: () => void; onBack: () => void }) {
  const info = lessonInfo(lesson);
  const questions = (lesson.questions || []).map((row: any) => ({ ...builtInQuestion(row), right: String(row.correct_answer || "") }));
  const step = LESSON_STEPS[Number(lesson.level) as LessonStep];
  return (
    <div className="min-h-screen bg-[#f6faf8] p-4 sm:p-6 text-slate-950">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onBack} className="inline-flex min-h-12 items-center gap-2 rounded-2xl border-2 border-teal-200 bg-white px-4 font-black text-teal-900"><ArrowLeft className="h-5 w-5" />Lessons</button>
          <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-black text-sky-900">Teacher view · students don't see the answers</span>
          <button type="button" onClick={onTry} className="ml-auto inline-flex min-h-12 items-center gap-2 rounded-2xl bg-teal-700 px-5 font-black text-white"><Play className="h-5 w-5" />Try it like a student</button>
        </div>
        {lesson.is_active === false && (
          <p className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 font-bold text-amber-900">This is an old lesson. Students don't see it anymore; the new lessons replaced it. Past scores and points stay.</p>
        )}
        <section className="flex flex-col gap-4 rounded-[2rem] border-2 border-teal-100 bg-white p-5 sm:flex-row sm:items-center">
          <LessonPicture src={info.cover} alt="" className="h-28 w-28" emojiClassName="text-7xl" />
          <div>
            {step && <p className="text-sm font-black uppercase tracking-wider text-teal-700">Step {lesson.level} · {step.name}</p>}
            <h1 className="text-3xl font-black">{info.title}</h1>
            <p className="font-semibold text-slate-600">{info.description}</p>
          </div>
        </section>
        {info.learn.length > 0 && (
          <section>
            <h2 className="mb-3 text-xl font-black">Learn cards (read aloud first)</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {info.learn.map((card, i) => (
                <div key={i} className="rounded-2xl border-2 border-teal-100 bg-white p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <LessonPicture src={card.picture} alt={card.word} count={card.count} className={card.count && card.count > 1 ? "h-8 w-8" : "h-20 w-20"} />
                    {card.picture2 && <LessonPicture src={card.picture2} alt="" className="h-14 w-14" />}
                  </div>
                  <div className="mt-2 text-lg font-black">{card.word}</div>
                  <div className="text-xs font-semibold text-slate-600">{card.say}</div>
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="space-y-3">
          <h2 className="text-xl font-black">Quiz ({questions.length} questions · pass with {Math.ceil(questions.length * 0.7)} right)</h2>
          {questions.map((q: any, i: number) => (
            <div key={q.id || i} className="rounded-2xl border-2 border-teal-100 bg-white p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-teal-700 text-sm font-black text-white">{i + 1}</span>
                <p className="text-lg font-black">{q.prompt}</p>
                {q.say !== q.prompt && <span className="text-sm font-semibold text-slate-500">Voice: “{q.say}”</span>}
                {q.word && <span className="rounded-xl bg-amber-100 px-3 py-1 text-lg font-black">{q.word}</span>}
                {q.picture && <LessonPicture src={q.picture} alt="" count={q.count} className={q.count > 1 ? "h-8 w-8" : "h-14 w-14"} emojiClassName="text-4xl" />}
                {q.sound && <audio controls src={q.sound} className="h-8" />}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {q.choices.map((c: any) => {
                  const right = c.letter === q.right;
                  return (
                    <div key={c.letter} className={`flex items-center gap-2 rounded-xl border-2 p-2 ${right ? "border-emerald-500 bg-emerald-50" : "border-slate-100"}`}>
                      <span className="text-xs font-black text-slate-400">{c.letter}</span>
                      {c.picture && <LessonPicture src={c.picture} alt="" className="h-10 w-10" emojiClassName="text-3xl" />}
                      <span className="font-bold">{c.text}</span>
                      {right && <Check className="ml-auto h-5 w-5 text-emerald-600" aria-label="right answer" />}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500">Shown as: {q.show === "pictures" ? "pictures only" : q.show === "words" ? "words only" : "pictures with words"}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

export default function EyeGazeQuiz() {
  const { id } = useParams<{ id: string }>();
  const quizId = Number(id) || 0;
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const [lesson, setLesson] = useState<any>(null);
  const [list, setList] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [trying, setTrying] = useState(false);
  const staff = !!user?.isAdmin || user?.role === "teacher";

  useEffect(() => {
    const t = token || cookieToken();
    const headers: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
    let active = true;
    setLesson(null);
    setError("");
    setTrying(false);
    Promise.all([
      fetch(`${API_BASE}/api/eye-gaze/quizzes/${quizId}`, { headers, cache: "no-store" }).then(async r => ({ ok: r.ok, data: await r.json().catch(() => ({})) })),
      fetch(`${API_BASE}/api/eye-gaze/quizzes`, { headers, cache: "no-store" }).then(r => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([one, all]) => {
      if (!active) return;
      if (!one.ok) setError(one.data?.message || "This lesson could not be found.");
      else setLesson(one.data);
      setList(Array.isArray(all) ? all : []);
    }).catch(() => { if (active) setError("This lesson could not load. Check the internet and try again."); });
    return () => { active = false; };
  }, [quizId, token]);

  const back = () => navigate("/eye-gaze-lessons");

  if (error) {
    return (
      <div className="grid min-h-[100dvh] place-items-center p-4">
        <div className="w-full max-w-lg rounded-[2rem] border-4 border-teal-100 bg-[#fffaf0] p-8 text-center shadow-sm" role="alert">
          <div className="text-6xl" aria-hidden="true">🙂</div>
          <p className="mt-3 text-2xl font-black text-teal-950">{error}</p>
          <button type="button" onClick={back} className="mt-6 inline-flex min-h-16 items-center gap-2 rounded-2xl bg-teal-700 px-6 text-xl font-black text-white"><ArrowLeft className="h-6 w-6" />Lessons</button>
        </div>
      </div>
    );
  }
  if (!lesson) {
    return <div className="grid min-h-[100dvh] place-items-center text-2xl font-black text-teal-950" role="status">Loading the lesson…</div>;
  }
  if (staff && !trying) return <LessonOverview lesson={lesson} onTry={() => setTrying(true)} onBack={back} />;
  if (lesson.is_active === false && !staff) {
    return (
      <div className="grid min-h-[100dvh] place-items-center p-4">
        <div className="w-full max-w-lg rounded-[2rem] border-4 border-teal-100 bg-[#fffaf0] p-8 text-center shadow-sm">
          <div className="text-6xl" aria-hidden="true">✨</div>
          <p className="mt-3 text-2xl font-black text-teal-950">This lesson got a new look! Pick a new lesson.</p>
          <button type="button" onClick={back} className="mt-6 inline-flex min-h-16 items-center gap-2 rounded-2xl bg-teal-700 px-6 text-xl font-black text-white"><ArrowLeft className="h-6 w-6" />Lessons</button>
        </div>
      </div>
    );
  }

  const next = nextLessonId(list, quizId);
  return (
    <LessonPlayer
      key={quizId}
      info={lessonInfo(lesson)}
      source={{
        kind: "eye_gaze",
        quizId,
        startPath: `/api/eye-gaze/quizzes/${quizId}/start`,
        attemptPath: attemptId => `/api/eye-gaze/quizzes/${attemptId}`,
        toQuestion: builtInQuestion,
      }}
      nextPath={next ? `/eye-gaze-quiz/${next}` : null}
      onExit={staff ? () => setTrying(false) : back}
      onNext={path => navigate(path)}
    />
  );
}

