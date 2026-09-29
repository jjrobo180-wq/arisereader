import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  ArrowLeft, BookOpen, Check, ChevronRight, Clock3, Copy, Crown, Gamepad2, Gem,
  GraduationCap, Grid3X3, Loader2, PartyPopper, Play, Plus, Radio, RefreshCcw,
  Save, Sparkles, Star, Trophy, Users, WandSparkles, Zap
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

type GameType = "quiz" | "flash" | "wheel" | "jeopardy" | "fifth" | "millionaire" | "party";
type Question = {
  prompt: string;
  options: string[];
  correct: string;
  category?: string;
  difficulty?: "easy" | "medium" | "hard";
  value?: number;
};
type Quiz = { id: number; title: string; questionCount: number; gameType: GameType };
type Preset = {
  id: string; title: string; description: string; grade: string; subject: string;
  gameType: GameType; questionCount: number; questions: Question[];
};
type Room = {
  id: string; code: string; title: string; gameType: GameType;
  status: "lobby" | "question" | "results" | "finished";
  currentQuestion: number; questionCount: number; deadline: string | null; serverTime: string;
  question: Question | null;
  players: { user_id: number; display_name: string; score: number | null }[];
  answerCount: number; answerCounts?: number[];
  board?: { index: number; category: string; value: number; difficulty: string }[];
  myAnswer: { choice: string; correct?: boolean; points?: number } | null;
};

const letters = ["A", "B", "C", "D"];
const answerStyles = [
  "from-rose-500 to-rose-700 border-rose-300/40",
  "from-sky-500 to-blue-700 border-sky-300/40",
  "from-amber-400 to-orange-600 border-amber-200/50",
  "from-emerald-500 to-green-700 border-emerald-300/40",
];
const blank = (): Question => ({ prompt: "", options: ["", "", "", ""], correct: "A", category: "General", difficulty: "medium", value: 100 });

const MODES: Record<GameType, {
  name: string; description: string; icon: any; emoji: string; accent: string; glow: string; panel: string;
}> = {
  quiz: { name: "Quiz Blitz", description: "Fast, colorful classroom competition.", icon: Zap, emoji: "⚡", accent: "text-orange-300", glow: "from-orange-500/30 via-rose-500/15 to-transparent", panel: "border-orange-300/25 bg-orange-500/10" },
  flash: { name: "Flash Match", description: "Quizlet-style terms, meanings, and quick recall.", icon: BookOpen, emoji: "🧠", accent: "text-cyan-300", glow: "from-cyan-500/30 via-blue-500/15 to-transparent", panel: "border-cyan-300/25 bg-cyan-500/10" },
  wheel: { name: "Spin the Wheel", description: "A category wheel turns every question into a reveal.", icon: RefreshCcw, emoji: "🎡", accent: "text-fuchsia-300", glow: "from-fuchsia-500/30 via-violet-500/15 to-transparent", panel: "border-fuchsia-300/25 bg-fuchsia-500/10" },
  jeopardy: { name: "Classroom Jeopardy", description: "Category-and-value review with a game-board feel.", icon: Grid3X3, emoji: "🟦", accent: "text-blue-200", glow: "from-blue-600/35 via-indigo-500/15 to-transparent", panel: "border-blue-300/25 bg-blue-600/10" },
  fifth: { name: "5th Grade Challenge", description: "Climb through school subjects and grade-level questions.", icon: GraduationCap, emoji: "🎓", accent: "text-emerald-300", glow: "from-emerald-500/30 via-teal-500/15 to-transparent", panel: "border-emerald-300/25 bg-emerald-500/10" },
  millionaire: { name: "Millionaire Challenge", description: "A dramatic difficulty ladder with a 50:50 lifeline.", icon: Gem, emoji: "💎", accent: "text-amber-300", glow: "from-amber-500/30 via-violet-500/15 to-transparent", panel: "border-amber-300/25 bg-amber-500/10" },
  party: { name: "Class Party", description: "School-safe party rounds with a Jackbox-like energy.", icon: PartyPopper, emoji: "🎉", accent: "text-pink-300", glow: "from-pink-500/30 via-purple-500/20 to-transparent", panel: "border-pink-300/25 bg-pink-500/10" },
};

function cookieToken() {
  try {
    const value = document.cookie.split(";").map(x => x.trim()).find(x => x.startsWith("arise_session="))?.split("=")[1];
    return value ? JSON.parse(atob(value)).token as string : null;
  } catch { return null; }
}
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "?";
}

export default function LiveQuiz() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/live-quiz/:id");
  const id = params?.id;
  const isTeacher = Boolean(user?.isAdmin || user?.role === "teacher");

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [teacherView, setTeacherView] = useState<"create" | "sets" | "saved">("create");
  const [gameType, setGameType] = useState<GameType>("quiz");
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([blank()]);
  const [editing, setEditing] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiGrade, setAiGrade] = useState("6–8");
  const [aiCount, setAiCount] = useState(10);
  const [aiNotes, setAiNotes] = useState("");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [offset, setOffset] = useState(0);
  const [fiftyUsed, setFiftyUsed] = useState(false);
  const [hiddenChoices, setHiddenChoices] = useState<string[]>([]);
  const lastAuto = useRef<number>(-1);
  const lastQuestion = useRef<number>(-1);

  const mode = MODES[room?.gameType || gameType];

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

  async function loadTeacherHome() {
    if (!isTeacher || id) return;
    try {
      const [saved, ready] = await Promise.all([api("/api/live-quizzes"), api("/api/live-quizzes/presets")]);
      setQuizzes(saved); setPresets(ready);
    } catch (e) { setError((e as Error).message); }
  }

  async function loadRoom(roomId: string) {
    const next: Room = await api(`/api/live-sessions/${roomId}`);
    setRoom(next);
    setOffset(Date.now() - Date.parse(next.serverTime));
    if (lastQuestion.current !== next.currentQuestion) {
      lastQuestion.current = next.currentQuestion;
      setHiddenChoices([]);
    }
  }

  useEffect(() => { void loadTeacherHome(); }, [isTeacher, id, token]);

  useEffect(() => {
    if (!id) { setRoom(null); return; }
    let alive = true, waiting = false;
    const refresh = async () => {
      if (waiting || !alive) return;
      waiting = true;
      try { await loadRoom(id); if (alive) setError(""); }
      catch (e) { if (alive) setError((e as Error).message); }
      finally { waiting = false; }
    };
    void refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [id, token]);

  useEffect(() => {
    if (!room || room.status !== "question" || !room.deadline) return;
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((Date.parse(room.deadline!) - (Date.now() - offset)) / 1000)));
    tick();
    const timer = window.setInterval(tick, 150);
    return () => clearInterval(timer);
  }, [room?.status, room?.deadline, offset]);

  useEffect(() => {
    if (!isTeacher || !room || room.status !== "question" || timeLeft > 0 || lastAuto.current === room.currentQuestion) return;
    lastAuto.current = room.currentQuestion;
    void advance("reveal");
  }, [isTeacher, room?.status, room?.currentQuestion, timeLeft]);

  async function run(key: string, operation: () => Promise<void>) {
    if (busy) return;
    setBusy(key); setError(""); setNotice("");
    try { await operation(); } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }

  function openManual(type: GameType = gameType) {
    setGameType(type); setTitle(""); setQuestions([blank()]); setEditing(true); setTeacherView("create"); setNotice("");
  }

  async function generateAI() {
    await run("ai", async () => {
      const generated = await api("/api/live-quizzes/generate", {
        method: "POST",
        body: JSON.stringify({ topic: aiTopic, grade: aiGrade, count: aiCount, gameType, notes: aiNotes }),
      });
      setTitle(generated.title);
      setQuestions(generated.questions);
      setEditing(true);
      setNotice("AI built the game. Review anything you want, then save or launch it.");
    });
  }

  async function saveQuiz(hostAfter = false) {
    await run(hostAfter ? "save-host" : "save", async () => {
      const created = await api("/api/live-quizzes", { method: "POST", body: JSON.stringify({ title, questions, gameType }) });
      setQuizzes(prev => [{ id: created.id, title: created.title, questionCount: questions.length, gameType }, ...prev]);
      if (hostAfter) {
        const session = await api(`/api/live-quizzes/${created.id}/host`, { method: "POST" });
        navigate(`/live-quiz/${session.id}`);
        return;
      }
      setEditing(false); setNotice("Saved to My Games."); setTeacherView("saved");
    });
  }

  async function usePreset(preset: Preset, hostNow = false) {
    if (!hostNow) {
      setGameType(preset.gameType); setTitle(preset.title); setQuestions(preset.questions);
      setEditing(true); setTeacherView("create"); setNotice("Ready-made set loaded. You can edit it or launch it as-is.");
      return;
    }
    await run(`preset-${preset.id}`, async () => {
      const created = await api("/api/live-quizzes", { method: "POST", body: JSON.stringify({ title: preset.title, questions: preset.questions, gameType: preset.gameType }) });
      const session = await api(`/api/live-quizzes/${created.id}/host`, { method: "POST" });
      navigate(`/live-quiz/${session.id}`);
    });
  }

  async function host(quizId: number) {
    await run(`host-${quizId}`, async () => {
      const session = await api(`/api/live-quizzes/${quizId}/host`, { method: "POST" });
      navigate(`/live-quiz/${session.id}`);
    });
  }

  async function join() {
    await run("join", async () => {
      const session = await api("/api/live-sessions/join", { method: "POST", body: JSON.stringify({ code: code.trim().toUpperCase() }) });
      navigate(`/live-quiz/${session.id}`);
    });
  }

  async function advance(action: "start" | "reveal" | "next") {
    if (!id) return;
    await run(`advance-${action}`, async () => {
      await api(`/api/live-sessions/${id}/advance`, { method: "POST", body: JSON.stringify({ action }) });
      await loadRoom(id);
    });
  }

  async function answer(choice: string) {
    if (!id || !room || room.myAnswer || timeLeft <= 0 || hiddenChoices.includes(choice)) return;
    await run("answer", async () => {
      await api(`/api/live-sessions/${id}/answer`, { method: "POST", body: JSON.stringify({ questionIndex: room.currentQuestion, choice }) });
      await loadRoom(id);
    });
  }

  async function useFiftyFifty() {
    if (!id || fiftyUsed || room?.gameType !== "millionaire") return;
    await run("5050", async () => {
      const result = await api(`/api/live-sessions/${id}/lifeline/5050`, { method: "POST" });
      setHiddenChoices(result.hide || []); setFiftyUsed(true);
    });
  }

  const setQuestion = (index: number, update: Partial<Question>) =>
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, ...update } : q));

  const wheelRotation = room ? 720 + Math.max(0, room.currentQuestion) * 137 : 720;
  const boardGroups = useMemo(() => {
    const groups: Record<string, { index: number; value: number }[]> = {};
    (room?.board || []).forEach(item => { (groups[item.category] ||= []).push({ index: item.index, value: item.value }); });
    return groups;
  }, [room?.board]);

  return <main className="min-h-screen overflow-hidden bg-[#070b18] text-white">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(56,189,248,.12),transparent_26%),radial-gradient(circle_at_85%_15%,rgba(244,63,94,.12),transparent_24%),radial-gradient(circle_at_50%_90%,rgba(139,92,246,.13),transparent_30%)]" />
    <div className="relative mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <button onClick={() => id ? navigate("/live-quiz") : navigate(isTeacher ? "/teacher-dashboard" : "/library")}
          className="flex min-h-11 items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-4 font-black hover:bg-white/10">
          <ArrowLeft size={18} /> Back
        </button>
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 font-black">
          <Radio className="text-orange-300" /> A.R.I.S.E. Live Classroom
        </div>
      </header>

      {error && <div role="alert" className="mb-5 rounded-2xl border border-red-400/50 bg-red-950/80 p-4 font-bold">{error}</div>}
      {notice && <div className="mb-5 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4 font-bold text-emerald-100">{notice}</div>}

      {!id && isTeacher && <>
        <section className="relative mb-5 overflow-hidden rounded-[2rem] border border-white/10 bg-[#11182e] p-5 shadow-2xl sm:p-8">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-violet-500/10 to-orange-500/10" />
          <div className="relative grid gap-6 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-black tracking-widest text-cyan-200"><Sparkles size={14} /> LIVE GAME STUDIO</div>
              <h1 className="text-4xl font-black leading-tight sm:text-6xl">Turn any lesson into a live game.</h1>
              <p className="mt-3 max-w-2xl text-base font-semibold text-slate-300 sm:text-lg">Pick a game style, type what you are teaching, and AI builds the questions. Or launch a ready-made set in a few clicks.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
              {(Object.entries(MODES) as [GameType, typeof MODES[GameType]][]).slice(0, 4).map(([type, info]) => {
                const Icon = info.icon;
                return <button key={type} onClick={() => { setGameType(type); setTeacherView("create"); }}
                  className={"rounded-2xl border p-4 text-left transition hover:-translate-y-1 " + (gameType === type ? "border-white/50 bg-white/15" : "border-white/10 bg-black/15")}>
                  <Icon className={"mb-2 " + info.accent} /><strong className="block">{info.name}</strong>
                </button>;
              })}
            </div>
          </div>
        </section>

        <nav className="mb-5 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5">
          {([["create", WandSparkles, "Create"], ["sets", Star, "Ready Sets"], ["saved", Gamepad2, "My Games"]] as const).map(([tab, Icon, label]) =>
            <button key={tab} onClick={() => setTeacherView(tab)} className={"min-h-12 rounded-xl font-black flex items-center justify-center gap-2 " + (teacherView === tab ? "bg-white text-slate-950" : "text-white/65 hover:bg-white/10")}>
              <Icon size={18} /> {label}
            </button>)}
        </nav>

        {teacherView === "create" && <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <aside className="rounded-[2rem] border border-white/10 bg-[#11182e] p-4 sm:p-5">
            <p className="text-xs font-black tracking-widest text-cyan-300">1. PICK THE EXPERIENCE</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(Object.entries(MODES) as [GameType, typeof MODES[GameType]][]).map(([type, info]) => {
                const Icon = info.icon;
                return <button key={type} onClick={() => setGameType(type)} className={"rounded-2xl border p-3 text-left transition " + (gameType === type ? "border-white/45 bg-white/15 shadow-lg" : "border-white/10 bg-white/[.03] hover:bg-white/[.08]")}>
                  <div className="flex items-center gap-2"><Icon size={18} className={info.accent} /><strong className="text-sm">{info.name}</strong></div>
                  <p className="mt-1 text-[11px] font-semibold text-white/45">{info.description}</p>
                </button>;
              })}
            </div>
          </aside>

          <section className="rounded-[2rem] border border-white/10 bg-[#11182e] p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-black tracking-widest text-violet-300">2. TELL AI WHAT YOU NEED</p><h2 className="mt-1 text-2xl font-black">AI Game Maker</h2></div>
              <div className={"rounded-full border px-3 py-1 text-xs font-black " + mode.panel}>{mode.emoji} {mode.name}</div>
            </div>
            <label className="mt-5 block text-sm font-black">What are you teaching?</label>
            <textarea value={aiTopic} onChange={e => setAiTopic(e.target.value)} maxLength={180}
              placeholder="Example: 7th grade ratios, or Chapters 1–3 of The Giver"
              className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-white/15 bg-black/20 p-4 text-base font-semibold outline-none focus:border-cyan-300/50" />
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="text-sm font-black">Grade / level
                <select value={aiGrade} onChange={e => setAiGrade(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#0b1020] px-3">
                  {["K–2", "3–5", "6–8", "9–12", "Mixed levels"].map(g => <option key={g}>{g}</option>)}
                </select>
              </label>
              <label className="text-sm font-black">Questions
                <select value={aiCount} onChange={e => setAiCount(Number(e.target.value))} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#0b1020] px-3">
                  {[5, 8, 10, 12, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="text-sm font-black">Optional focus
                <input value={aiNotes} onChange={e => setAiNotes(e.target.value)} maxLength={800} placeholder="IEP-friendly, vocab..."
                  className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-[#0b1020] px-3" />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={generateAI} disabled={busy === "ai" || aiTopic.trim().length < 2}
                className="flex min-h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-300 to-violet-400 px-5 text-lg font-black text-slate-950 disabled:opacity-40">
                {busy === "ai" ? <Loader2 className="animate-spin" /> : <WandSparkles />} {busy === "ai" ? "Building your game..." : "Generate with AI"}
              </button>
              <button onClick={() => openManual(gameType)} className="min-h-14 rounded-2xl border border-white/20 px-5 font-black hover:bg-white/10">Build manually</button>
            </div>
          </section>
        </div>}

        {teacherView === "sets" && <section>
          <div className="mb-4"><p className="text-xs font-black tracking-widest text-amber-300">READY TO PLAY</p><h2 className="text-3xl font-black">Premade classroom sets</h2><p className="mt-1 text-slate-300">Use them instantly or customize first.</p></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{presets.map(preset => {
            const info = MODES[preset.gameType]; const Icon = info.icon;
            return <article key={preset.id} className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#11182e] p-5">
              <div className={"absolute inset-0 bg-gradient-to-br opacity-60 " + info.glow} />
              <div className="relative">
                <div className="flex items-start justify-between gap-3"><div className={"grid h-12 w-12 place-items-center rounded-2xl border " + info.panel}><Icon className={info.accent} /></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black">{preset.grade}</span></div>
                <h3 className="mt-4 text-xl font-black">{preset.title}</h3>
                <p className="mt-2 min-h-10 text-sm font-semibold text-white/55">{preset.description}</p>
                <p className="mt-3 text-xs font-black text-white/40">{preset.subject} · {preset.questionCount} questions · {info.name}</p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button onClick={() => usePreset(preset, false)} className="min-h-11 rounded-xl border border-white/20 font-black hover:bg-white/10">Customize</button>
                  <button onClick={() => usePreset(preset, true)} disabled={busy === `preset-${preset.id}`} className="min-h-11 rounded-xl bg-white text-slate-950 font-black disabled:opacity-50">{busy === `preset-${preset.id}` ? "Opening..." : "Play now"}</button>
                </div>
              </div>
            </article>;
          })}</div>
        </section>}

        {teacherView === "saved" && <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black tracking-widest text-emerald-300">YOUR LIBRARY</p><h2 className="text-3xl font-black">My live games</h2></div><button onClick={() => openManual("quiz")} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/20 px-4 font-black"><Plus size={17} /> New game</button></div>
          <div className="grid gap-3 md:grid-cols-2">{quizzes.map(q => {
            const info = MODES[q.gameType || "quiz"]; const Icon = info.icon;
            return <article key={q.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#11182e] p-4">
              <div className={"grid h-12 w-12 shrink-0 place-items-center rounded-2xl border " + info.panel}><Icon className={info.accent} /></div>
              <div className="min-w-0 flex-1"><h3 className="truncate text-lg font-black">{q.title}</h3><p className="text-sm font-semibold text-white/45">{q.questionCount} questions · {info.name}</p></div>
              <button onClick={() => host(q.id)} disabled={busy === `host-${q.id}`} className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-orange-500 px-4 font-black disabled:opacity-50"><Play size={17} /> Host</button>
            </article>;
          })}</div>
          {!quizzes.length && <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-slate-300">Your saved live games will appear here.</div>}
        </section>}

        {editing && <div className="fixed inset-0 z-50 overflow-y-auto bg-[#050814]/95 p-3 backdrop-blur sm:p-6">
          <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/15 bg-[#10182e] p-4 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-black tracking-widest text-cyan-300">REVIEW & LAUNCH</p><h2 className="text-3xl font-black">{MODES[gameType].name}</h2></div>
              <button onClick={() => setEditing(false)} className="rounded-xl border border-white/15 px-4 py-2 font-black">Close</button>
            </div>
            <label className="mt-5 block font-black">Game title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="Game title"
              className="mt-2 min-h-12 w-full rounded-xl border border-white/20 bg-black/20 px-4 text-lg font-bold" />
            <div className="mt-5 space-y-4">{questions.map((q, i) => <div key={i} className="rounded-2xl border border-white/10 bg-black/15 p-4">
              <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-black">Question {i + 1}</h3>{questions.length > 1 && <button onClick={() => setQuestions(prev => prev.filter((_, n) => n !== i))} className="text-sm font-bold text-rose-300">Remove</button>}</div>
              <input value={q.prompt} onChange={e => setQuestion(i, { prompt: e.target.value })} maxLength={240} placeholder="Question"
                className="min-h-12 w-full rounded-xl border border-white/15 bg-[#18223e] px-3 font-semibold" />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">{q.options.map((option, n) => <label key={n}
                className={"flex min-h-12 items-center gap-2 rounded-xl border p-2 " + (q.correct === letters[n] ? "border-emerald-300 bg-emerald-500/10" : "border-white/10")}>
                <input type="radio" name={`correct-${i}`} checked={q.correct === letters[n]} onChange={() => setQuestion(i, { correct: letters[n] })} />
                <strong>{letters[n]}</strong>
                <input value={option} maxLength={120} placeholder={`Answer ${letters[n]}`} onChange={e => setQuestion(i, { options: q.options.map((v, k) => k === n ? e.target.value : v) })}
                  className="min-w-0 flex-1 bg-transparent outline-none" />
              </label>)}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <input value={q.category || ""} onChange={e => setQuestion(i, { category: e.target.value })} placeholder="Category" className="min-h-10 rounded-lg border border-white/10 bg-[#18223e] px-3 text-sm" />
                <select value={q.difficulty || "medium"} onChange={e => setQuestion(i, { difficulty: e.target.value as Question["difficulty"] })} className="min-h-10 rounded-lg border border-white/10 bg-[#18223e] px-3 text-sm">
                  <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                </select>
                <input type="number" step="100" min="100" max="2000" value={q.value || 100} onChange={e => setQuestion(i, { value: Number(e.target.value) })} className="min-h-10 rounded-lg border border-white/10 bg-[#18223e] px-3 text-sm" />
              </div>
            </div>)}</div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={() => setQuestions(prev => prev.length >= 30 ? prev : [...prev, blank()])} className="min-h-12 rounded-xl border border-white/20 px-5 font-black"><Plus className="mr-1 inline" size={17} /> Add question</button>
              <button onClick={() => saveQuiz(false)} disabled={!!busy} className="min-h-12 rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-5 font-black"><Save className="mr-1 inline" size={17} /> Save</button>
              <button onClick={() => saveQuiz(true)} disabled={!!busy} className="min-h-12 flex-1 rounded-xl bg-gradient-to-r from-orange-400 to-rose-500 px-6 text-lg font-black"><Play className="mr-2 inline" /> {busy === "save-host" ? "Launching..." : "Save & Host Now"}</button>
            </div>
          </div>
        </div>}
      </>}

      {!id && !isTeacher && <section className="mx-auto max-w-xl pt-6">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#11182e] p-6 text-center shadow-2xl sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(249,115,22,.18),transparent_45%)]" />
          <div className="relative">
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-[1.75rem] bg-gradient-to-br from-orange-400 to-rose-600 shadow-[0_0_50px_rgba(249,115,22,.28)]"><Gamepad2 size={40} /></div>
            <h1 className="mt-5 text-4xl font-black">Join the game</h1>
            <p className="mt-2 font-semibold text-slate-300">Enter the six-character code on your teacher’s screen.</p>
            <input value={code} maxLength={6} autoComplete="off" onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))}
              onKeyDown={e => { if (e.key === "Enter") void join(); }} placeholder="ABC123"
              className="mt-7 min-h-20 w-full rounded-2xl border-2 border-white/20 bg-black/25 text-center text-4xl font-black tracking-[.28em] outline-none focus:border-orange-300" />
            <button onClick={join} disabled={busy === "join" || code.length !== 6} className="mt-4 min-h-16 w-full rounded-2xl bg-gradient-to-r from-orange-400 to-rose-500 text-xl font-black disabled:opacity-40">
              {busy === "join" ? "Joining..." : "Join Live Game"}
            </button>
            <p className="mt-4 text-sm font-semibold text-white/45">You will play using the name on your A.R.I.S.E. account.</p>
          </div>
        </div>
      </section>}

      {id && !room && !error && <div className="grid min-h-[55vh] place-items-center"><div className="text-center"><Loader2 className="mx-auto animate-spin text-cyan-300" size={42} /><p className="mt-3 font-black text-slate-300">Loading live game…</p></div></div>}

      {id && room && <div className="mx-auto max-w-6xl">
        <section className={"relative mb-4 overflow-hidden rounded-[2rem] border bg-[#11182e] p-4 sm:p-6 " + mode.panel}>
          <div className={"pointer-events-none absolute inset-0 bg-gradient-to-r " + mode.glow} />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-4xl">{mode.emoji}</div>
              <div><p className={"text-xs font-black uppercase tracking-[.2em] " + mode.accent}>{mode.name}</p><h1 className="text-2xl font-black sm:text-3xl">{room.title}</h1></div>
            </div>
            {isTeacher ? <button onClick={() => navigator.clipboard?.writeText(room.code)} className="flex items-center gap-3 rounded-2xl border border-white/20 bg-black/25 px-4 py-3">
              <div className="text-left"><div className="text-[10px] font-black text-white/45">JOIN CODE</div><strong className="text-2xl tracking-[.18em] sm:text-3xl">{room.code}</strong></div><Copy size={18} />
            </button> : <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-black">{room.status === "finished" ? "Game complete" : room.status === "lobby" ? "You’re in!" : `Question ${room.currentQuestion + 1}/${room.questionCount}`}</div>}
          </div>
        </section>

        {room.status === "lobby" && <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="rounded-[2rem] border border-white/10 bg-[#11182e] p-5 sm:p-8">
            <div className="text-center"><Users className="mx-auto text-cyan-300" size={46} /><h2 className="mt-3 text-3xl font-black">{room.players.length} {room.players.length === 1 ? "player" : "players"} ready</h2><p className="mt-2 font-semibold text-slate-300">{isTeacher ? "Students join with the code above. Start when the room is ready." : "Your teacher will start the game."}</p></div>
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">{room.players.map((p, index) => <div key={p.user_id} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 font-black">{initials(p.display_name)}</div>
              <span className="min-w-0 truncate font-black">{p.display_name}</span>{index === 0 && room.players.length > 1 && <Star className="ml-auto text-amber-300" size={15} />}
            </div>)}</div>
            {isTeacher && <button onClick={() => advance("start")} disabled={!!busy || room.players.length === 0} className="mt-7 min-h-16 w-full rounded-2xl bg-gradient-to-r from-orange-400 to-rose-500 text-xl font-black disabled:opacity-40"><Play className="mr-2 inline" /> Start {mode.name}</button>}
          </div>
          <aside className="rounded-[2rem] border border-white/10 bg-[#0d1327] p-5">
            <p className="text-xs font-black tracking-widest text-white/40">GAME PREVIEW</p>
            {room.gameType === "wheel" ? <div className="mt-5 grid place-items-center"><div className="relative h-56 w-56 rounded-full border-[10px] border-white/10 bg-[conic-gradient(#ec4899_0_25%,#8b5cf6_25%_50%,#06b6d4_50%_75%,#f59e0b_75%)] shadow-[0_0_55px_rgba(217,70,239,.18)]"><div className="absolute inset-[32%] grid place-items-center rounded-full bg-slate-950 text-3xl">🎡</div></div><p className="mt-4 font-black">Categories spin before every question.</p></div>
            : room.gameType === "jeopardy" && Object.keys(boardGroups).length ? <div className="mt-4 grid grid-cols-2 gap-2">{Object.entries(boardGroups).slice(0, 6).map(([category, cells]) => <div key={category} className="rounded-xl bg-blue-700 p-2 text-center"><strong className="block truncate text-xs uppercase">{category}</strong><div className="mt-2 grid gap-1">{cells.slice(0, 3).map(cell => <span key={cell.index} className="rounded bg-blue-950/70 py-1 font-black text-amber-300">{cell.value}</span>)}</div></div>)}</div>
            : <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5 text-center"><div className="text-6xl">{mode.emoji}</div><h3 className="mt-3 text-xl font-black">{mode.name}</h3><p className="mt-2 text-sm font-semibold text-white/50">{MODES[room.gameType].description}</p><div className="mt-4 rounded-xl bg-black/20 p-3 text-sm font-black">{room.questionCount} rounds</div></div>}
          </aside>
        </section>}

        {(room.status === "question" || room.status === "results") && room.question && <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black">{room.question.category || "General"}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-black capitalize">{room.question.difficulty || "medium"}</span>
              {(room.gameType === "jeopardy" || room.gameType === "millionaire") && <span className="rounded-full bg-amber-400 px-3 py-2 text-xs font-black text-slate-950">{room.gameType === "millionaire" ? "$" : ""}{(room.question.value || 100).toLocaleString()}</span>}
            </div>
            <div className="flex items-center gap-3"><span className="text-sm font-black text-white/55">{room.answerCount}/{room.players.length} answered</span>
              {room.status === "question" && <div className={"grid h-14 w-14 place-items-center rounded-full border-4 font-black " + (timeLeft <= 5 ? "border-rose-400 bg-rose-500/20 text-rose-200" : "border-cyan-300/50 bg-cyan-500/10 text-cyan-200")}><span>{timeLeft}</span></div>}
            </div>
          </div>

          {room.gameType === "wheel" && <div className="mb-4 grid place-items-center overflow-hidden rounded-[2rem] border border-fuchsia-300/20 bg-fuchsia-500/10 p-4">
            <div className="relative h-32 w-32 rounded-full border-[7px] border-white/15 bg-[conic-gradient(#ec4899_0_25%,#8b5cf6_25%_50%,#06b6d4_50%_75%,#f59e0b_75%)] transition-transform duration-1000" style={{ transform: `rotate(${wheelRotation}deg)` }}><div className="absolute inset-[34%] grid place-items-center rounded-full bg-slate-950 text-xl">🎡</div></div>
            <div className="mt-2 text-sm font-black text-fuchsia-200">The wheel landed on {room.question.category || "General"}!</div>
          </div>}

          {room.gameType === "jeopardy" && <div className="mb-4 rounded-[2rem] border-2 border-blue-300/20 bg-gradient-to-b from-blue-700 to-blue-950 p-4 text-center shadow-2xl"><div className="text-sm font-black uppercase tracking-[.25em] text-blue-100">{room.question.category}</div><div className="mt-1 text-4xl font-black text-amber-300">{room.question.value || 100}</div></div>}
          {room.gameType === "fifth" && <div className="mb-4 flex items-center justify-center gap-3 rounded-[2rem] border border-emerald-300/20 bg-emerald-500/10 p-4"><GraduationCap className="text-emerald-300" /><strong className="text-xl">{room.question.category || "School Challenge"}</strong></div>}
          {room.gameType === "millionaire" && <div className="mb-4 flex items-center justify-between gap-3 rounded-[2rem] border border-amber-300/20 bg-gradient-to-r from-violet-950 to-slate-950 p-4">
            <div><div className="text-xs font-black tracking-widest text-amber-300">PRIZE LADDER</div><div className="text-3xl font-black"><span>$</span>{(room.question.value || 100).toLocaleString()}</div></div>
            {!isTeacher && room.status === "question" && <button onClick={useFiftyFifty} disabled={fiftyUsed || !!busy} className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 font-black text-amber-200 disabled:opacity-35">50:50 {fiftyUsed ? "USED" : ""}</button>}
          </div>}
          {room.gameType === "party" && <div className="mb-4 flex items-center justify-center gap-3 rounded-[2rem] border border-pink-300/20 bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-cyan-500/15 p-4 text-center"><PartyPopper className="text-pink-300" /><strong className="text-xl">Party Round: {room.question.category || "Wild Card"}</strong><PartyPopper className="text-cyan-300" /></div>}

          <section className={"mb-4 rounded-[2rem] border border-white/10 bg-[#11182e] p-6 text-center shadow-2xl sm:p-9 " + (room.gameType === "flash" ? "min-h-52 grid place-items-center" : "")}>
            {room.gameType === "flash" && <p className="mb-2 text-xs font-black uppercase tracking-[.25em] text-cyan-300">MATCH THIS</p>}
            <h2 className={"font-black leading-tight " + (room.gameType === "flash" ? "text-4xl sm:text-6xl" : "text-3xl sm:text-5xl")}>{room.question.prompt}</h2>
          </section>

          <div className="grid gap-3 sm:grid-cols-2">{room.question.options.map((option, n) => {
            const letter = letters[n], chosen = room.myAnswer?.choice === letter;
            const right = room.status === "results" && room.question?.correct === letter;
            const hidden = hiddenChoices.includes(letter);
            if (hidden) return <div key={letter} className="min-h-28 rounded-[1.5rem] border border-white/5 bg-white/[.02] opacity-20" />;
            return <button key={letter} onClick={() => answer(letter)} disabled={!!busy || isTeacher || room.status !== "question" || !!room.myAnswer || timeLeft <= 0}
              className={"relative min-h-28 overflow-hidden rounded-[1.5rem] border bg-gradient-to-br p-5 text-left text-lg font-black shadow-xl transition enabled:hover:-translate-y-1 enabled:hover:scale-[1.01] " + answerStyles[n] + (chosen ? " ring-4 ring-white" : "") + (right ? " ring-4 ring-emerald-200" : "") + (room.status === "results" && !right ? " opacity-55" : "")}>
              <span className="mr-3 inline-grid h-10 w-10 place-items-center rounded-xl bg-black/20 text-xl">{letter}</span>{option}
              {right && <Check className="absolute right-4 top-1/2 -translate-y-1/2" size={28} />}
              {isTeacher && room.status === "results" && <span className="absolute bottom-3 right-4 rounded-full bg-black/25 px-3 py-1 text-sm">{room.answerCounts?.[n] || 0} votes</span>}
            </button>;
          })}</div>

          {!isTeacher && room.status === "question" && room.myAnswer && <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-center font-black">Locked in! Watch the class screen for the reveal.</div>}
          {!isTeacher && room.status === "question" && timeLeft === 0 && !room.myAnswer && <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-center font-black">Time is up. Get ready for the answer.</div>}
          {!isTeacher && room.status === "results" && <div className={"mt-4 overflow-hidden rounded-2xl border p-5 text-center text-xl font-black " + (room.myAnswer?.correct ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-100" : "border-white/10 bg-white/5")}>
            {room.myAnswer?.correct ? <><div className="mb-1 text-4xl">🎉</div>Correct! +{room.myAnswer.points} points</> : room.myAnswer ? "Good try — next round!" : "No answer this round."}
          </div>}

          {isTeacher && <button onClick={() => advance(room.status === "question" ? "reveal" : "next")} disabled={!!busy}
            className="mt-5 min-h-16 w-full rounded-2xl bg-gradient-to-r from-orange-400 to-rose-500 px-6 text-xl font-black disabled:opacity-50">
            {room.status === "question" ? "Reveal Answer" : room.currentQuestion + 1 === room.questionCount ? "Finish Game" : "Next Round"} <ChevronRight className="ml-1 inline" />
          </button>}
        </>}

        {(room.status === "results" || room.status === "finished") && <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#11182e] p-5 sm:p-7">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-2xl font-black"><Trophy className="text-amber-300" /> {room.status === "finished" ? "Final leaderboard" : "Live leaderboard"}</h2>{room.status !== "finished" && <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black text-white/45">Scores update every round</span>}</div>
          <ol className="space-y-2">{room.players.slice(0, 12).map((p, n) => <li key={p.user_id} className={"flex items-center justify-between gap-3 rounded-2xl border p-3 font-black " + (n === 0 ? "border-amber-300/25 bg-amber-400/10" : "border-white/10 bg-white/5")}>
            <span className="flex min-w-0 items-center gap-3">{n === 0 ? <Crown className="shrink-0 text-amber-300" /> : <span className="w-6 shrink-0 text-center text-white/45">{n + 1}</span>}<span className="truncate">{p.display_name}</span></span>
            <span className="rounded-full bg-black/20 px-3 py-1">{typeof p.score === "number" ? p.score.toLocaleString() : "—"}</span>
          </li>)}</ol>
        </section>}

        {room.status === "finished" && <button onClick={() => navigate("/live-quiz")} className="mt-5 min-h-14 w-full rounded-2xl bg-white text-slate-950 font-black">Back to Live Classroom</button>}
      </div>}
    </div>
  </main>;
}