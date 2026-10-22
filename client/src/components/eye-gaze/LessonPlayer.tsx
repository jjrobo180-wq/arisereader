// The Eye Gazer lesson player: a lesson's "learn" cards (big picture, word, sentence read aloud),
// then its quiz. Every button can be pressed by looking at it (the yellow bar fills) or by a tap.
//
// It is built so a quiz can't get stuck: the answer buttons never wait for the voice (if the AI
// voice is down it uses the device voice, or none), every answer moves on by itself, and all text
// sits on white cards so it can be read on any background color a family picks.
//
// The first quiz try is unlocked by a parent or teacher proctor code and earns points; after that
// the lesson can be practiced any time (no points, nothing saved). Staff and sample accounts preview.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowLeft, BookOpen, Check, ChevronLeft, ChevronRight, KeyRound, Lock, Pencil, RotateCcw, Sparkles, Star, Volume2, VolumeX } from "lucide-react";
import GazeButton from "@/components/eye-gaze/GazeButton";
import LessonPicture from "@/components/eye-gaze/LessonPicture";
import Celebration, { type CelebrationStyle } from "@/components/Celebration";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { readTurnIn } from "@/lib/quizCheck";
import { answerWords, resultWords, starsFor, type Letter, type LessonInfo, type LessonQuestion } from "@/lib/eyeGazeLesson";
import { playLessonSound, saveLessonVoice, savedLessonVoice, sayLessonLine, stopLessonVoice, warmLessonLines } from "@/lib/lessonVoice";
import { LESSON_POINTS } from "@shared/eyegaze/lessonSteps";

export type LessonSource = {
  /** Which proctor code this quiz needs. */
  kind: "eye_gaze" | "custom_eye_gaze";
  quizId: number;
  /** POST { practice, proctorSessionToken } → questions without answers and an attempt id. */
  startPath: string;
  /** The attempt's base path; "/check" and "/submit" are added. */
  attemptPath: (attemptId: number) => string;
  toQuestion: (row: any) => LessonQuestion;
};

type Phase = "intro" | "learn" | "ready" | "unlock" | "starting" | "quiz" | "submitting" | "results" | "error";
type Mode = "scored" | "practice" | "preview";
type Feedback = { picked: Letter; checking: boolean; correct: boolean | null; right: Letter | null };

/** How long the eyes rest on a button to press it. */
const DWELL = { answer: 1500, main: 1400, exit: 2200 } as const;
/** Answers wait this long after a new question shows, so a resting gaze doesn't pick by accident. */
const SETTLE_MS = 900;

function cookieToken(): string | null {
  try {
    const match = document.cookie.match(/arise_session=([^;]+)/);
    return match ? JSON.parse(atob(match[1])).token || null : null;
  } catch {
    return null;
  }
}

async function checkAnswer(path: string, token: string | null, questionId: number, answer: Letter): Promise<{ correct: boolean | null; right: Letter | null }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ questionId, answer }),
      signal: controller.signal,
    });
    const data = res.ok ? await res.json().catch(() => null) : null;
    const right = typeof data?.rightAnswer === "string" && /^[ABCD]$/.test(data.rightAnswer) ? data.rightAnswer as Letter : null;
    return { correct: typeof data?.correct === "boolean" ? data.correct : null, right };
  } catch {
    return { correct: null, right: null };
  } finally {
    window.clearTimeout(timer);
  }
}

/** A big look-to-press button for the lesson screens. */
function BigButton({ onSelect, children, tone = "teal", ms = DWELL.main, label, className = "" }: {
  onSelect: () => void; children: ReactNode; tone?: "teal" | "amber" | "white"; ms?: number; label?: string; className?: string;
}) {
  const tones = {
    teal: "bg-teal-700 text-white border-teal-800 hover:bg-teal-800",
    amber: "bg-amber-300 text-amber-950 border-amber-400 hover:bg-amber-200",
    white: "bg-white text-teal-950 border-teal-200 hover:border-teal-400",
  };
  return (
    <GazeButton onSelect={onSelect} ms={ms} label={label} barClass="h-2.5"
      className={`min-h-[88px] rounded-[1.75rem] border-4 px-6 text-2xl sm:text-3xl font-black flex items-center justify-center gap-3 shadow-sm focus:outline-none focus:ring-4 focus:ring-teal-200 ${tones[tone]} ${className}`}>
      {children}
    </GazeButton>
  );
}

function StarsRow({ filled, size = "w-10 h-10 sm:w-14 sm:h-14" }: { filled: number; size?: string }) {
  return (
    <div className="flex justify-center gap-1.5" aria-label={`${filled} of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} aria-hidden="true" className={`${size} ${i < filled ? "fill-amber-400 text-amber-500" : "fill-slate-100 text-slate-300"}`} />
      ))}
    </div>
  );
}

export default function LessonPlayer({ info, source, nextPath, onExit, onNext }: {
  info: LessonInfo;
  source: LessonSource;
  /** The next lesson in the list, for the "Next lesson" button. */
  nextPath?: string | null;
  onExit: () => void;
  onNext?: (path: string) => void;
}) {
  const { user, token } = useAuth();
  const authToken = () => token || cookieToken();
  const jsonHeaders = () => {
    const t = authToken();
    return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
  };
  // Staff, the admin's preview and the sample logins try lessons without a proctor code; nothing is saved.
  const previewer = /^(sample|tutorial-eye|admin-preview)/.test(String(user?.username || "")) || !!user?.isAdmin || user?.role === "teacher";

  const [phase, setPhase] = useState<Phase>("intro");
  const [learnIndex, setLearnIndex] = useState(0);
  const [completed, setCompleted] = useState(info.hasCompleted);
  const [mode, setMode] = useState<Mode>("scored");
  const [attemptId, setAttemptId] = useState(0);
  const [questions, setQuestions] = useState<LessonQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [settling, setSettling] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [voice, setVoice] = useState(savedLessonVoice);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [unlockedBy, setUnlockedBy] = useState("");
  const [celebrationStyle, setCelebrationStyle] = useState<CelebrationStyle>("confetti");
  const [celebrate, setCelebrate] = useState(0);
  const answers = useRef<Record<number, string>>({});
  const cards = useRef<Partial<Record<Letter, HTMLDivElement | null>>>({});
  const celebrateFrom = useRef<HTMLElement | null>(null);
  const resultCard = useRef<HTMLDivElement | null>(null);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };

  const learn = info.learn;
  const card = learn[learnIndex];
  const question = questions[index];

  useEffect(() => () => { stopLessonVoice(); timers.current.forEach(window.clearTimeout); }, []);

  useEffect(() => {
    const t = authToken();
    fetch(`${API_BASE}/api/eye-gaze/celebration-style`, { headers: t ? { Authorization: `Bearer ${t}` } : {} })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d?.style) setCelebrationStyle(d.style); })
      .catch(() => {});
    warmLessonLines([`${info.title}. ${info.description}`, ...learn.map(c => c.say)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.id]);

  // Say what is on the screen.
  useEffect(() => {
    if (phase === "intro") sayLessonLine(`${info.title}. ${info.description}`, { voice });
    else if (phase === "ready") sayLessonLine(completed && !previewer ? "Ready to practice the quiz?" : "Ready for the quiz?", { voice });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== "learn" || !card) return;
    sayLessonLine(card.say, { voice, sound: card.sound });
    warmLessonLines([learn[learnIndex + 1]?.say]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, learnIndex]);

  useEffect(() => {
    if (phase !== "quiz" || !question) return;
    setSettling(true);
    later(() => setSettling(false), SETTLE_MS);
    sayLessonLine(question.say, { voice, sound: question.sound });
    warmLessonLines([questions[index + 1]?.say]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index, questions]);

  const sayAgain = () => {
    if (phase === "learn" && card) sayLessonLine(card.say, { voice: true, sound: card.sound });
    else if (phase === "quiz" && question && !feedback) sayLessonLine(question.say, { voice: true, sound: question.sound });
    else if (phase === "intro") sayLessonLine(`${info.title}. ${info.description}`, { voice: true });
    else if (phase === "results" && result) sayLessonLine(resultWords(result).say, { voice: true });
  };

  const toggleVoice = () => {
    const next = !voice;
    setVoice(next);
    saveLessonVoice(next);
    if (!next) stopLessonVoice();
  };

  const exit = () => { stopLessonVoice(); onExit(); };

  const startQuiz = async (practice: boolean, proctorSessionToken = "") => {
    stopLessonVoice();
    setPhase("starting");
    setError("");
    try {
      const res = await fetch(`${API_BASE}${source.startPath}`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ practice, proctorSessionToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.completed) setCompleted(true);
        setError(data?.message || "Could not start the quiz.");
        setPhase("error");
        return;
      }
      const list = (Array.isArray(data.questions) ? data.questions : []).map(source.toQuestion).filter((q: LessonQuestion) => q.choices.length >= 2);
      if (!list.length) {
        setError("This quiz has no questions yet.");
        setPhase("error");
        return;
      }
      const id = Number(data.attemptId);
      answers.current = {};
      setQuestions(list);
      setIndex(0);
      setFeedback(null);
      setAttemptId(id);
      setMode(data.practice ? "practice" : data.preview || id < 0 ? "preview" : "scored");
      if (data.proctorName) setUnlockedBy(`${data.proctorType === "parent" ? "Parent / Guardian" : "Teacher / School Staff"} · ${data.proctorName}`);
      setPhase("quiz");
    } catch {
      setError("Could not start the quiz. Check the internet and try again.");
      setPhase("error");
    }
  };

  const goToQuiz = () => {
    if (previewer) return void startQuiz(false);
    if (completed) return void startQuiz(true);
    stopLessonVoice();
    setCode("");
    setCodeError("");
    setPhase("unlock");
  };

  const unlock = async () => {
    if (!code.trim() || codeBusy) return;
    setCodeBusy(true);
    setCodeError("");
    try {
      const res = await fetch(`${API_BASE}/api/verify-proctor`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ password: code.trim(), quizKind: source.kind, quizId: source.quizId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.verified) {
        setCode("");
        setCodeError(data.message || "That code didn't work. Please try again.");
        return;
      }
      setCode("");
      await startQuiz(false, String(data.proctorSessionToken || ""));
    } catch {
      setCodeError("Could not check the code. Please try again.");
    } finally {
      setCodeBusy(false);
    }
  };

  const submit = async (id: number, quizMode: Mode, count: number) => {
    stopLessonVoice();
    setPhase("submitting");
    try {
      const res = await fetch(`${API_BASE}${source.attemptPath(id)}/submit`, {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({ answers: answers.current }),
      });
      const out = await readTurnIn(res);
      if (!out.ok) {
        setError(out.message);
        setPhase("error");
        return;
      }
      const data = out.data || {};
      const final = {
        ...data,
        score: Number(data.score || 0),
        total: Number(data.total || count),
        practice: quizMode === "practice" || !!data.practice,
        preview: quizMode === "preview" || !!data.preview,
      };
      setResult(final);
      if (quizMode === "scored") setCompleted(true);
      setPhase("results");
      const words = resultWords(final);
      if (words.passed) later(() => { celebrateFrom.current = resultCard.current; setCelebrate(n => n + 1); }, 250);
      sayLessonLine(words.say, { voice });
    } catch {
      setError("Could not turn in the quiz. Check the internet and try again.");
      setPhase("error");
    }
  };

  const choose = async (letter: Letter) => {
    if (phase !== "quiz" || settling || feedback || !question) return;
    const at = index;
    const q = question;
    const id = attemptId;
    const quizMode = mode;
    const count = questions.length;
    stopLessonVoice();
    setFeedback({ picked: letter, checking: true, correct: null, right: null });
    const checked = await checkAnswer(`${source.attemptPath(id)}/check`, authToken(), q.id, letter);
    answers.current = { ...answers.current, [q.id]: letter };
    const right = checked.right || (checked.correct ? letter : null);
    setFeedback({ picked: letter, checking: false, correct: checked.correct, right });
    if (checked.correct) {
      celebrateFrom.current = cards.current[letter] || null;
      setCelebrate(n => n + 1);
    }
    // Move on once the child has seen it and the voice is done (never later than 6 seconds).
    let moved = false;
    let voiceDone = false;
    let seen = false;
    const move = () => {
      if (moved) return;
      moved = true;
      if (at + 1 < count) {
        setFeedback(null);
        setIndex(at + 1);
      } else {
        void submit(id, quizMode, count);
      }
    };
    sayLessonLine(answerWords(checked.correct, q.choices.find(c => c.letter === right) || null), {
      voice,
      onDone: () => { voiceDone = true; if (seen) move(); },
    });
    later(() => { seen = true; if (voiceDone) move(); }, checked.correct ? 1500 : 2500);
    later(move, 6000);
  };

  // ── Pieces ──

  const topBar = (middle: ReactNode) => (
    <header className="flex items-center gap-2 sm:gap-3">
      <GazeButton onSelect={exit} ms={DWELL.exit} label="Back to lessons" barClass="h-2"
        className="min-h-[60px] rounded-2xl border-4 border-teal-200 bg-white px-4 font-black text-teal-900 flex items-center gap-2 shadow-sm">
        <ArrowLeft className="w-6 h-6" aria-hidden="true" /><span className="hidden sm:inline text-lg">Lessons</span>
      </GazeButton>
      <div className="flex-1 min-w-0 rounded-2xl bg-white border-4 border-teal-100 px-4 py-2 shadow-sm">{middle}</div>
      <GazeButton onSelect={sayAgain} label="Hear it again" barClass="h-2"
        className="min-h-[60px] min-w-[60px] rounded-2xl border-4 border-teal-200 bg-white text-teal-800 grid place-items-center shadow-sm">
        <Volume2 className="w-7 h-7" aria-hidden="true" />
      </GazeButton>
      <GazeButton onSelect={toggleVoice} ms={DWELL.exit} label={voice ? "Turn the voice off" : "Turn the voice on"} pressed={voice} barClass="h-2"
        className={`min-h-[60px] rounded-2xl border-4 px-3 font-black flex items-center gap-2 shadow-sm ${voice ? "border-teal-200 bg-white text-teal-800" : "border-slate-300 bg-slate-100 text-slate-600"}`}>
        {voice ? <Volume2 className="w-6 h-6" aria-hidden="true" /> : <VolumeX className="w-6 h-6" aria-hidden="true" />}
        <span className="hidden md:inline">{voice ? "Voice on" : "Voice off"}</span>
      </GazeButton>
    </header>
  );

  const titleLine = (sub: ReactNode) => (
    <div className="min-w-0">
      <div className="truncate text-lg sm:text-xl font-black text-teal-950">{info.title}</div>
      <div className="text-sm font-bold text-slate-600 truncate">{sub}</div>
    </div>
  );

  const shell = (children: ReactNode, fitScreen = false) => (
    <div className={`${fitScreen ? "h-[100dvh] min-h-[560px]" : "min-h-[100dvh]"} flex flex-col gap-3 p-3 sm:p-4 text-slate-950`}>
      {children}
      <Celebration style={celebrationStyle} trigger={celebrate} targetRef={celebrateFrom as RefObject<HTMLElement>} />
    </div>
  );

  const panel = "rounded-[2rem] border-4 border-teal-100 bg-[#fffaf0] shadow-sm";

  // ── Screens ──

  if (phase === "intro" || phase === "ready" || phase === "unlock" || phase === "starting" || phase === "error") {
    const pointsLine = previewer ? "Preview: try it out. Nothing is saved."
      : completed ? (info.score != null && info.total ? `Done! You got ${info.score} of ${info.total}. Practice any time.` : "Done! Practice any time.")
      : `Pass the quiz to earn ${LESSON_POINTS} points.`;
    return shell(<>
      {topBar(titleLine(phase === "ready" ? "You looked at every word!" : learn.length ? `${learn.length} words to learn, then 5 questions` : "Quiz"))}
      <main className="flex-1 grid place-items-center">
        <section className={`${panel} w-full max-w-3xl p-5 sm:p-8 text-center`}>
          {phase === "unlock" ? (
            <div className="mx-auto max-w-xl">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-teal-700 text-white"><Lock className="h-8 w-8" aria-hidden="true" /></div>
              <h1 className="mt-4 text-3xl sm:text-4xl font-black text-teal-950">A grown-up unlocks the quiz</h1>
              <p className="mt-2 text-lg font-semibold text-slate-700">A parent or teacher types their proctor code. The first try earns points.</p>
              <div className="relative mt-5">
                <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-teal-600" aria-hidden="true" />
                <input type="password" autoComplete="off" value={code} autoFocus
                  onChange={e => { setCode(e.target.value); setCodeError(""); }}
                  onKeyDown={e => { if (e.key === "Enter") void unlock(); }}
                  placeholder="Parent or teacher proctor code"
                  className="min-h-16 w-full rounded-2xl border-4 border-teal-200 bg-white pl-14 pr-4 text-xl font-bold outline-none focus:border-teal-500" />
              </div>
              {codeError && <p role="alert" className="mt-3 text-base font-bold text-rose-700">{codeError}</p>}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => setPhase("intro")} className="min-h-16 rounded-2xl border-4 border-teal-200 bg-white text-xl font-black text-teal-900">Not now</button>
                <button type="button" onClick={() => void unlock()} disabled={!code.trim() || codeBusy}
                  className="min-h-16 rounded-2xl border-4 border-teal-800 bg-teal-700 text-xl font-black text-white disabled:opacity-50">{codeBusy ? "Checking…" : "Unlock the quiz"}</button>
              </div>
            </div>
          ) : phase === "starting" ? (
            <div className="py-10" role="status">
              <div className="mx-auto h-16 w-16 animate-spin rounded-full border-8 border-teal-100 border-t-teal-600" />
              <p className="mt-5 text-2xl font-black text-teal-950">Getting the quiz ready…</p>
            </div>
          ) : phase === "error" ? (
            <div role="alert">
              <div className="text-6xl" aria-hidden="true">🙂</div>
              <h1 className="mt-3 text-3xl font-black text-teal-950">Let's try something else</h1>
              <p className="mt-2 text-xl font-semibold text-slate-700">{error || "Something went wrong."}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {completed && !previewer
                  ? <BigButton tone="amber" onSelect={() => void startQuiz(true)}><RotateCcw className="w-8 h-8" aria-hidden="true" />Practice</BigButton>
                  : <BigButton tone="amber" onSelect={() => setPhase("intro")}><RotateCcw className="w-8 h-8" aria-hidden="true" />Try again</BigButton>}
                <BigButton tone="white" ms={DWELL.exit} onSelect={exit}><ArrowLeft className="w-8 h-8" aria-hidden="true" />Lessons</BigButton>
              </div>
            </div>
          ) : (
            <>
              <LessonPicture src={info.cover} alt="" className="mx-auto h-32 w-32 sm:h-44 sm:w-44" emojiClassName="text-8xl" />
              <h1 className="mt-3 text-4xl sm:text-5xl font-black text-teal-950">{phase === "ready" ? (completed && !previewer ? "Ready to practice?" : "Ready for the quiz?") : info.title}</h1>
              <p className="mt-2 text-xl sm:text-2xl font-semibold text-slate-700">{phase === "ready" ? "Look at a picture and the yellow bar fills to pick it." : info.description}</p>
              <p className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-base font-black ${completed && !previewer ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                {completed && !previewer ? <Check className="h-5 w-5" aria-hidden="true" /> : <Star className="h-5 w-5 fill-amber-400 text-amber-500" aria-hidden="true" />}{pointsLine}
              </p>
              <div className={`mt-6 grid gap-3 ${learn.length ? "sm:grid-cols-2" : ""}`}>
                {learn.length > 0 && (phase === "ready"
                  ? <BigButton tone="white" onSelect={() => { setLearnIndex(0); setPhase("learn"); }}><BookOpen className="w-8 h-8" aria-hidden="true" />Learn again</BigButton>
                  : <BigButton onSelect={() => { setLearnIndex(0); setPhase("learn"); }}><BookOpen className="w-8 h-8" aria-hidden="true" />Learn the words</BigButton>)}
                <BigButton tone={phase === "ready" || !learn.length ? "teal" : "amber"} onSelect={goToQuiz}>
                  {completed && !previewer ? <RotateCcw className="w-8 h-8" aria-hidden="true" /> : <Pencil className="w-8 h-8" aria-hidden="true" />}
                  {completed && !previewer ? "Practice the quiz" : phase === "ready" ? "Start the quiz" : "Take the quiz"}
                </BigButton>
              </div>
            </>
          )}
        </section>
      </main>
    </>);
  }

  if (phase === "learn" && card) {
    const last = learnIndex === learn.length - 1;
    return shell(<>
      {topBar(titleLine(`Learn · ${learnIndex + 1} of ${learn.length}`))}
      <main className={`${panel} flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-4 sm:p-6 text-center`}>
        <div className="flex items-center justify-center gap-4 sm:gap-8 min-h-0">
          <LessonPicture src={card.picture} alt={card.word} count={card.count}
            className={card.count && card.count > 1 ? "h-24 w-24 sm:h-32 sm:w-32 max-h-[16vh] max-w-[16vh]" : card.picture2 ? "h-36 w-36 sm:h-52 sm:w-52 max-h-[28vh] max-w-[28vh]" : "h-48 w-48 sm:h-64 sm:w-64 max-h-[32vh] max-w-[32vh]"} />
          {card.picture2 && <>
            <span className="text-5xl font-black text-teal-700" aria-hidden="true">&amp;</span>
            <LessonPicture src={card.picture2} alt="" className="h-36 w-36 sm:h-52 sm:w-52 max-h-[28vh] max-w-[28vh]" />
          </>}
        </div>
        <div className="text-5xl sm:text-7xl font-black tracking-wide text-teal-950">{card.word}</div>
        <p className="max-w-3xl text-2xl sm:text-3xl font-bold text-slate-700">{card.say}</p>
        <div className="flex gap-2 pt-1" aria-hidden="true">
          {learn.map((_, i) => <span key={i} className={`h-3 w-8 rounded-full ${i <= learnIndex ? "bg-teal-600" : "bg-teal-100"}`} />)}
        </div>
      </main>
      <footer className="grid grid-cols-[1fr_2fr] gap-3">
        <BigButton tone="white" onSelect={() => learnIndex > 0 ? setLearnIndex(i => i - 1) : setPhase("intro")}>
          <ChevronLeft className="w-9 h-9" aria-hidden="true" />Back
        </BigButton>
        <BigButton onSelect={() => last ? setPhase("ready") : setLearnIndex(i => i + 1)}>
          {last ? "I'm ready!" : "Next"}<ChevronRight className="w-9 h-9" aria-hidden="true" />
        </BigButton>
      </footer>
    </>, true);
  }

  if ((phase === "quiz" || phase === "submitting") && question) {
    const hasVisual = !!(question.picture || question.word || question.sound);
    const few = question.choices.length <= 3;
    const badge = mode === "practice" ? "Practice · no points" : mode === "preview" ? "Preview · not saved" : unlockedBy ? `Unlocked by ${unlockedBy}` : "";
    const message = feedback && !feedback.checking
      ? feedback.correct ? "✓ Yes! That's right!"
        : feedback.right ? `The answer is ${question.choices.find(c => c.letter === feedback.right)?.text || "the green one"}.`
        : "Nice try!"
      : null;
    return shell(<>
      {topBar(
        <div className="flex items-center gap-3 min-w-0">
          {titleLine(`Question ${index + 1} of ${questions.length}${badge ? ` · ${badge}` : ""}`)}
          <div className="ml-auto hidden sm:flex gap-1.5" aria-label={`Question ${index + 1} of ${questions.length}`}>
            {questions.map((_, i) => <span key={i} className={`h-4 w-4 rounded-full ${i < index ? "bg-teal-600" : i === index ? "bg-amber-400 ring-4 ring-amber-200" : "bg-teal-100"}`} />)}
          </div>
        </div>,
      )}
      <section className={`${panel} px-4 py-3 sm:px-6 sm:py-4 text-center`} aria-live="polite">
        <h1 className={`text-2xl sm:text-4xl font-black leading-tight ${message ? (feedback?.correct ? "text-emerald-700" : "text-amber-800") : "text-teal-950"}`}>
          {message || question.prompt}
        </h1>
      </section>
      <main className={`flex-1 min-h-0 flex flex-col gap-3 ${hasVisual ? "lg:grid lg:grid-cols-5" : ""}`}>
        {hasVisual && (
          <div className={`${panel} bg-white shrink-0 h-[27vh] lg:h-auto lg:col-span-2 min-h-0 flex items-center justify-center gap-4 p-4 overflow-hidden`}>
            {question.word
              ? <span className="text-7xl sm:text-8xl lg:text-9xl font-black tracking-wider text-teal-950">{question.word}</span>
              : !question.picture && question.sound
              ? <GazeButton onSelect={() => playLessonSound(question.sound!)} label="Play the sound again" barClass="h-3"
                  className="h-full max-h-72 w-full max-w-sm rounded-[2rem] border-4 border-amber-300 bg-amber-100 text-amber-950 flex flex-col items-center justify-center gap-2">
                  <Volume2 className="h-20 w-20 sm:h-28 sm:w-28" aria-hidden="true" />
                  <span className="text-2xl sm:text-3xl font-black">Listen</span>
                </GazeButton>
              : <>
                <LessonPicture src={question.picture} alt="the picture" count={question.count}
                  className={question.count > 3 ? "h-16 w-16 sm:h-24 sm:w-24 lg:h-28 lg:w-28" : question.count > 1 ? "h-20 w-20 sm:h-28 sm:w-28 lg:h-36 lg:w-36" : "h-full max-h-80 w-auto max-w-full"} />
                {question.picture2 && <LessonPicture src={question.picture2} alt="" className="h-full max-h-64 w-auto max-w-full" />}
              </>}
          </div>
        )}
        <div className={`flex-1 min-h-0 grid gap-3 ${few ? "grid-cols-3" : "grid-cols-2"} ${hasVisual ? "lg:col-span-3" : few ? "" : "lg:grid-cols-4"}`}>
          {question.choices.map(choice => {
            const picked = feedback?.picked === choice.letter;
            const isRight = !!feedback && !feedback.checking && feedback.right === choice.letter;
            const missed = !!feedback && !feedback.checking && picked && feedback.correct === false;
            const faded = !!feedback && !feedback.checking && !picked && !isRight;
            const showPicture = question.show !== "words" && !!choice.picture;
            const showWord = question.show !== "pictures" || isRight;
            const look = isRight ? "border-emerald-500 bg-emerald-50 ring-8 ring-emerald-200 scale-[1.02]"
              : missed ? "border-amber-400 bg-amber-50"
              : picked ? "border-teal-500 bg-white"
              : "border-teal-100 bg-white hover:border-teal-400";
            return (
              <div key={choice.letter} ref={el => { cards.current[choice.letter] = el; }} className={`min-h-0 transition-opacity duration-300 ${faded ? "opacity-40" : ""}`}>
                <GazeButton onSelect={() => void choose(choice.letter)} ms={DWELL.answer} barClass="h-3"
                  disabled={settling || !!feedback || phase !== "quiz"}
                  label={choice.text || `Choice ${choice.letter}`}
                  className={`h-full w-full min-h-[120px] rounded-[1.75rem] border-[6px] p-3 flex flex-col items-center justify-center gap-2 shadow-sm disabled:opacity-100 ${look}`}>
                  {showPicture && (
                    <span className={`relative flex-1 min-h-[64px] w-full rounded-2xl ${isRight ? "bg-white/70" : "bg-slate-50"}`}>
                      <LessonPicture src={choice.picture} alt="" className="absolute inset-0 h-full w-full p-2" emojiClassName="absolute inset-0 grid place-items-center text-7xl" />
                    </span>
                  )}
                  {showWord && choice.text && (
                    <span className={`font-black text-teal-950 leading-tight text-center ${showPicture ? "text-2xl sm:text-3xl" : "text-4xl sm:text-6xl"}`}>{choice.text}</span>
                  )}
                  {isRight && <span className="absolute right-3 top-3 grid h-12 w-12 place-items-center rounded-full bg-emerald-500 text-white shadow" aria-hidden="true"><Check className="h-8 w-8" /></span>}
                  {feedback?.checking && picked && <span className="absolute right-3 top-3 h-10 w-10 animate-spin rounded-full border-4 border-teal-100 border-t-teal-600" aria-hidden="true" />}
                </GazeButton>
              </div>
            );
          })}
        </div>
      </main>
      {phase === "submitting" && <div role="status" className="text-center text-xl font-black text-teal-950">Adding up your stars…</div>}
    </>, true);
  }

  if (phase === "results" && result) {
    const words = resultWords(result);
    const stars = starsFor(result.score, result.total);
    return shell(<>
      {topBar(titleLine(result.practice ? "Practice" : result.preview ? "Preview" : "Quiz done"))}
      <main className="flex-1 grid place-items-center">
        <section className={`${panel} w-full max-w-3xl p-5 sm:p-8 text-center`}>
          <div ref={resultCard}><StarsRow filled={stars} /></div>
          <h1 className="mt-4 text-4xl sm:text-6xl font-black text-teal-950">{words.headline}</h1>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-800">{words.line}</p>
          <p className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-lg font-black ${Number(result.pointsEarned) > 0 ? "bg-amber-100 text-amber-900" : "bg-teal-50 text-teal-900"}`}>
            {Number(result.pointsEarned) > 0 ? <Star className="h-6 w-6 fill-amber-400 text-amber-500" aria-hidden="true" /> : <Sparkles className="h-6 w-6" aria-hidden="true" />}
            {words.note}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {nextPath && onNext
              ? <BigButton onSelect={() => { stopLessonVoice(); onNext(nextPath); }}>Next lesson<ChevronRight className="w-9 h-9" aria-hidden="true" /></BigButton>
              : <BigButton onSelect={exit} ms={DWELL.main}><ArrowLeft className="w-8 h-8" aria-hidden="true" />Lessons</BigButton>}
            <BigButton tone="amber" onSelect={() => void (previewer ? startQuiz(false) : startQuiz(true))}>
              <RotateCcw className="w-8 h-8" aria-hidden="true" />{previewer ? "Try again" : "Practice again"}
            </BigButton>
            {learn.length > 0 && <BigButton tone="white" onSelect={() => { setLearnIndex(0); setPhase("learn"); }} className="sm:col-span-2 min-h-[72px] text-xl sm:text-2xl">
              <BookOpen className="w-7 h-7" aria-hidden="true" />Learn the words again
            </BigButton>}
          </div>
        </section>
      </main>
    </>);
  }

  return shell(<div className="grid flex-1 place-items-center text-2xl font-black text-teal-950" role="status">Loading…</div>);
}
