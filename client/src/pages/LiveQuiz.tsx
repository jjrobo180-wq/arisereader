import { useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Check, Clock3, Copy, Crown, Play, Plus, Radio, Trophy, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

type Question = { prompt: string; options: string[]; correct: string };
type Quiz = { id: number; title: string; questionCount: number };
type Room = {
  id: string; code: string; title: string; status: "lobby" | "question" | "results" | "finished";
  currentQuestion: number; questionCount: number; deadline: string | null; serverTime: string;
  question: Question | null; players: { user_id: number; display_name: string; score: number }[];
  answerCount: number; answerCounts?: number[];
  myAnswer: { choice: string; correct?: boolean; points?: number } | null;
};
const letters = ["A", "B", "C", "D"];
const colors = ["bg-rose-600", "bg-sky-600", "bg-amber-500", "bg-emerald-600"];
const blank = (): Question => ({ prompt: "", options: ["", "", "", ""], correct: "A" });

function cookieToken() {
  try {
    const value = document.cookie.split(";").map(x => x.trim()).find(x => x.startsWith("arise_session="))?.split("=")[1];
    return value ? JSON.parse(atob(value)).token as string : null;
  } catch { return null; }
}

export default function LiveQuiz() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/live-quiz/:id");
  const id = params?.id;
  const isTeacher = Boolean(user?.isAdmin || user?.role === "teacher");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([blank()]);
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [offset, setOffset] = useState(0);
  const lastAuto = useRef<number>(-1);

  async function api(path: string, options: RequestInit = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || cookieToken() || ""}`, ...options.headers },
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Something went wrong. Please try again.");
    return data;
  }

  async function loadRoom(roomId: string) {
    const next: Room = await api(`/api/live-sessions/${roomId}`);
    setRoom(next);
    setOffset(Date.now() - Date.parse(next.serverTime));
  }

  useEffect(() => {
    if (!isTeacher || id) return;
    api("/api/live-quizzes").then(setQuizzes).catch((e: Error) => setError(e.message));
  }, [isTeacher, id, token]);

  useEffect(() => {
    if (!id) { setRoom(null); return; }
    let alive = true;
    let waiting = false;
    const refresh = async () => {
      if (waiting || !alive) return;
      waiting = true;
      try { await loadRoom(id); if (alive) setError(""); }
      catch (e) { if (alive) setError((e as Error).message); }
      finally { waiting = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 1200);
    return () => { alive = false; window.clearInterval(timer); };
  }, [id, token]);

  useEffect(() => {
    if (!room || room.status !== "question" || !room.deadline) return;
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((Date.parse(room.deadline!) - (Date.now() - offset)) / 1000)));
    tick();
    const timer = window.setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [room?.status, room?.deadline, offset]);

  useEffect(() => {
    if (!isTeacher || !room || room.status !== "question" || timeLeft > 0 || lastAuto.current === room.currentQuestion) return;
    lastAuto.current = room.currentQuestion;
    void advance("reveal");
  }, [isTeacher, room?.status, room?.currentQuestion, timeLeft]);

  async function act(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await operation(); } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function saveQuiz() {
    await act(async () => {
      const created = await api("/api/live-quizzes", { method: "POST", body: JSON.stringify({ title, questions }) });
      setQuizzes(prev => [{ ...created, questionCount: questions.length }, ...prev]);
      setEditing(false); setTitle(""); setQuestions([blank()]);
    });
  }
  async function host(quizId: number) {
    await act(async () => {
      const session = await api(`/api/live-quizzes/${quizId}/host`, { method: "POST" });
      navigate(`/live-quiz/${session.id}`);
    });
  }
  async function join() {
    await act(async () => {
      const session = await api("/api/live-sessions/join", { method: "POST", body: JSON.stringify({ code: code.trim().toUpperCase() }) });
      navigate(`/live-quiz/${session.id}`);
    });
  }
  async function advance(action: "start" | "reveal" | "next") {
    if (!id) return;
    await act(async () => {
      await api(`/api/live-sessions/${id}/advance`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      await loadRoom(id);
    });
  }
  async function answer(choice: string) {
    if (!id || !room || room.myAnswer || timeLeft <= 0) return;
    await act(async () => {
      await api(`/api/live-sessions/${id}/answer`, { method: "POST", body: JSON.stringify({ questionIndex: room.currentQuestion, choice }) });
      await loadRoom(id);
    });
  }
  const setQuestion = (index: number, update: Partial<Question>) =>
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, ...update } : q));

  return <main className="min-h-screen bg-[#101427] px-4 py-6 text-white sm:px-6">
    <div className="mx-auto max-w-5xl">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => id ? navigate("/live-quiz") : navigate(isTeacher ? "/teacher-dashboard" : "/library")}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 font-semibold hover:bg-white/10"><ArrowLeft size={18} /> Back</button>
        <div className="flex items-center gap-2 text-lg font-black tracking-wide"><Radio className="text-[#ff6b25]" /> A.R.I.S.E. Live</div>
      </header>
      {error && <div role="alert" className="mb-5 rounded-xl border border-red-400 bg-red-950 p-4 text-white">{error}</div>}

      {!id && isTeacher && <>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-3xl font-black">Live classroom quizzes</h1><p className="mt-2 text-slate-300">Create a quiz, share the code, and run each question together.</p></div>
          <button onClick={() => setEditing(!editing)} className="flex min-h-12 items-center gap-2 rounded-xl bg-[#ff6b25] px-5 font-bold text-white hover:bg-[#e55c1e]"><Plus size={20} /> {editing ? "Close editor" : "Create quiz"}</button>
        </div>
        {editing && <section className="mb-8 rounded-2xl border border-white/15 bg-[#1c2543] p-5 sm:p-7">
          <label className="mb-2 block font-semibold" htmlFor="live-title">Quiz title</label>
          <input id="live-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="Example: Fractions review"
            className="mb-6 min-h-12 w-full rounded-xl border border-white/25 bg-[#11192f] px-4 text-white" />
          {questions.map((q, i) => <div key={i} className="mb-6 rounded-xl border border-white/15 bg-[#11192f] p-4">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-bold">Question {i + 1}</h2>
              {questions.length > 1 && <button onClick={() => setQuestions(prev => prev.filter((_, n) => n !== i))} className="rounded-lg px-3 py-2 text-rose-300 hover:bg-rose-500/20">Remove</button>}</div>
            <label className="mb-2 block font-semibold" htmlFor={`prompt-${i}`}>Question</label>
            <input id={`prompt-${i}`} value={q.prompt} onChange={e => setQuestion(i, { prompt: e.target.value })} maxLength={240} placeholder="What is...?"
              className="mb-4 min-h-12 w-full rounded-lg border border-white/25 bg-[#202b49] px-3" />
            <p className="mb-3 text-sm text-slate-300">Enter four answers. Select the correct one.</p>
            <div className="grid gap-3 sm:grid-cols-2">{q.options.map((option, n) => <label key={n} className={`flex min-h-14 items-center gap-3 rounded-lg border p-2 ${q.correct === letters[n] ? "border-emerald-400" : "border-white/20"}`}>
              <input type="radio" name={`correct-${i}`} checked={q.correct === letters[n]} onChange={() => setQuestion(i, { correct: letters[n] })} aria-label={`Answer ${letters[n]} is correct`} />
              <strong>{letters[n]}</strong><input value={option} maxLength={120} aria-label={`Answer ${letters[n]} for question ${i + 1}`} placeholder={`Answer ${letters[n]}`}
                onChange={e => setQuestion(i, { options: q.options.map((v, k) => k === n ? e.target.value : v) })}
                className="min-h-10 min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" />
            </label>)}</div>
          </div>)}
          <div className="flex flex-wrap gap-3"><button onClick={() => setQuestions(prev => [...prev, blank()])} disabled={questions.length >= 30} className="min-h-12 rounded-xl border border-white/30 px-5 font-semibold disabled:opacity-40">Add question</button>
            <button onClick={saveQuiz} disabled={busy} className="min-h-12 rounded-xl bg-[#ff6b25] px-6 font-bold disabled:opacity-50">{busy ? "Saving..." : "Save quiz"}</button></div>
        </section>}
        <div className="grid gap-3 sm:grid-cols-2">{quizzes.map(q => <article key={q.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-[#1c2543] p-5">
          <div><h2 className="text-lg font-bold">{q.title}</h2><p className="text-slate-300">{q.questionCount} questions · 30 seconds each</p></div>
          <button onClick={() => host(q.id)} disabled={busy} className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#ff6b25] px-4 font-bold disabled:opacity-50"><Play size={17} /> Host</button>
        </article>)}</div>
        {!quizzes.length && !editing && <p className="rounded-2xl border border-dashed border-white/20 p-8 text-center text-slate-300">Create your first quiz to host a game.</p>}
      </>}

      {!id && !isTeacher && <section className="mx-auto max-w-lg rounded-3xl border border-white/15 bg-[#1c2543] p-6 text-center sm:p-10">
        <h1 className="text-3xl font-black">Join a live quiz</h1><p className="mt-3 text-slate-300">Ask your teacher for the six-character game code.</p>
        <label htmlFor="room-code" className="mt-8 block text-left font-semibold">Game code</label>
        <input id="room-code" value={code} maxLength={6} autoComplete="off" onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))}
          onKeyDown={e => { if (e.key === "Enter") void join(); }} placeholder="ABC123" className="mt-2 min-h-16 w-full rounded-xl border border-white/30 bg-[#11192f] text-center text-3xl font-black tracking-[.25em]" />
        <button onClick={join} disabled={busy || code.length !== 6} className="mt-5 min-h-14 w-full rounded-xl bg-[#ff6b25] text-lg font-black disabled:opacity-50">Join game</button>
        <p className="mt-5 text-sm text-slate-300">You’ll play with the name on your A.R.I.S.E. account.</p>
      </section>}

      {id && !room && !error && <p role="status" className="text-center text-slate-300">Loading game...</p>}
      {id && room && <>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/15 bg-[#1c2543] p-5">
          <div><p className="text-sm font-bold uppercase tracking-wider text-orange-300">{room.status === "lobby" ? "Waiting room" : room.status === "finished" ? "Final results" : `Question ${room.currentQuestion + 1} of ${room.questionCount}`}</p><h1 className="mt-1 text-2xl font-black">{room.title}</h1></div>
          {isTeacher && <button onClick={() => navigator.clipboard?.writeText(room.code)} title="Copy game code" className="flex items-center gap-3 rounded-xl border border-orange-400 bg-orange-500/15 px-4 py-2"><span className="text-sm">Code</span><strong className="text-2xl tracking-widest">{room.code}</strong><Copy size={17} /></button>}
        </div>
        {room.status === "lobby" && <section className="rounded-3xl border border-white/15 bg-[#1c2543] p-7 text-center">
          <Users className="mx-auto mb-3 text-orange-300" size={42} /><h2 className="text-2xl font-black">{room.players.length} {room.players.length === 1 ? "player" : "players"} joined</h2>
          <p className="mt-2 text-slate-300">{isTeacher ? "Share the code. Start when your class is ready." : "You’re in! Your teacher will start soon."}</p>
          <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2">{room.players.map(p => <span key={p.user_id} className="rounded-full bg-white/10 px-4 py-2 font-semibold">{p.display_name}</span>)}</div>
          {isTeacher && <button onClick={() => advance("start")} disabled={busy || room.players.length === 0} className="mt-7 min-h-14 rounded-xl bg-[#ff6b25] px-8 font-black disabled:opacity-50">Start game</button>}
        </section>}
        {(room.status === "question" || room.status === "results") && room.question && <>
          <div className="mb-5 flex items-center justify-between gap-3"><span className="text-slate-300">{room.answerCount} / {room.players.length} answered</span>
            {room.status === "question" && <span className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xl font-black ${timeLeft <= 5 ? "bg-rose-600" : "bg-white/10"}`}><Clock3 size={20} /> {timeLeft}s</span>}</div>
          <section className="mb-5 rounded-3xl border border-white/15 bg-[#1c2543] p-7 text-center"><h2 className="text-2xl font-black sm:text-4xl">{room.question.prompt}</h2></section>
          <div className="grid gap-3 sm:grid-cols-2">{room.question.options.map((option, n) => {
            const letter = letters[n]; const chosen = room.myAnswer?.choice === letter;
            const right = room.status === "results" && room.question?.correct === letter;
            return <button key={letter} onClick={() => answer(letter)} disabled={busy || isTeacher || room.status !== "question" || !!room.myAnswer || timeLeft <= 0}
              className={`min-h-24 rounded-2xl p-5 text-left text-lg font-bold shadow-lg transition-transform enabled:hover:scale-[1.02] disabled:cursor-default ${colors[n]} ${chosen ? "ring-4 ring-white" : ""} ${right ? "ring-4 ring-emerald-300" : ""} ${room.status === "results" && !right ? "opacity-65" : ""}`}>
              <span className="mr-3 inline-block rounded-lg bg-black/20 px-3 py-2">{letter}</span>{option}
              {right && <Check className="ml-2 inline" size={22} />}
              {isTeacher && room.status === "results" && <span className="ml-3 text-sm">{room.answerCounts?.[n] || 0} votes</span>}
            </button>;
          })}</div>
          {room.status === "question" && !isTeacher && room.myAnswer && <p role="status" className="mt-5 text-center text-lg font-bold">Answer locked in. Wait for your teacher to reveal the result.</p>}
          {room.status === "question" && timeLeft === 0 && !isTeacher && <p role="status" className="mt-5 text-center text-lg font-bold">Time is up. Waiting for the result.</p>}
          {room.status === "results" && !isTeacher && <p role="status" className="mt-5 text-center text-lg font-bold">{room.myAnswer ? room.myAnswer.correct ? `Correct! +${room.myAnswer.points} points` : "Good try!" : "No answer this round."}</p>}
          {isTeacher && <button onClick={() => advance(room.status === "question" ? "reveal" : "next")} disabled={busy} className="mt-6 min-h-14 w-full rounded-xl bg-[#ff6b25] px-6 text-lg font-black disabled:opacity-50">{room.status === "question" ? "Reveal answer" : room.currentQuestion + 1 === room.questionCount ? "Finish game" : "Next question"}</button>}
        </>}
        {(room.status === "results" || room.status === "finished") && <section className="mt-8 rounded-3xl border border-white/15 bg-[#1c2543] p-5 sm:p-7">
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-black"><Trophy className="text-amber-300" /> {room.status === "finished" ? "Final leaderboard" : "Leaderboard"}</h2>
          <ol className="space-y-2">{room.players.map((p, n) => <li key={p.user_id} className="flex items-center justify-between gap-3 rounded-xl bg-white/10 p-3 font-bold"><span className="flex items-center gap-3">{n === 0 ? <Crown className="text-amber-300" /> : <span className="w-6 text-center">{n + 1}</span>}{p.display_name}</span><span>{p.score.toLocaleString()}</span></li>)}</ol>
        </section>}
        {room.status === "finished" && <button onClick={() => navigate("/live-quiz")} className="mt-6 min-h-12 rounded-xl border border-white/30 px-6 font-bold">Back to live quizzes</button>}
      </>}
    </div>
  </main>;
}
