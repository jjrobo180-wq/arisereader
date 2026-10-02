import { useEffect } from "react";
import { useLocation, Redirect } from "wouter";
import {
  ArrowLeft, Zap, Gamepad2, ClipboardCheck, Sparkles, Trophy, Users, Brain, ShieldCheck,
  Accessibility, ChevronRight, Check, Rocket, Clock3, FileQuestion,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// Teacher-only pitch page for A.R.I.S.E. 2.0. Every claim here maps to a real
// feature in the app (Live Quiz, Club Controls, student profiles, etc.).

const heroStats = [
  { value: "7", label: "live game styles" },
  { value: "1", label: "join code to play" },
  { value: "1 tap", label: "to lock games" },
];

const features = [
  {
    icon: Zap,
    tag: "LIVE GAMES",
    title: "Kahoot-style games, built into your reading program",
    pitch: "Type what you're teaching — \"Chapters 1–3 of The Giver\" or \"7th grade ratios\" — and AI writes the questions. Students join with a short code and the leaderboard updates every round.",
    points: ["Quiz Blitz, Jeopardy, Millionaire, Spin the Wheel, Flash Match and more", "Ready-made sets you can launch in a few clicks", "Save your games and replay them any period"],
    win: "Review day becomes the day they ask for.",
    accent: "from-orange-500/25 to-rose-500/10",
    iconColor: "text-orange-300",
  },
  {
    icon: Gamepad2,
    tag: "YOU CONTROL PLAY",
    title: "Games are a privilege you hand out — not a distraction",
    pitch: "Students love the A.R.I.S.E. arcade and worlds. You decide who gets in and how much. Lock a student out after a rough day, or reward a great one.",
    points: ["Lock or unlock games for any student in one tap", "Set a daily game limit (1, 2, 3, 5…)", "Require passed book quizzes to earn game time", "Set class closing hours so games shut off during instruction"],
    win: "The thing they want most becomes your best behavior tool.",
    accent: "from-violet-500/25 to-fuchsia-500/10",
    iconColor: "text-violet-300",
  },
  {
    icon: ClipboardCheck,
    tag: "SEE EVERYTHING",
    title: "Know exactly who read what",
    pitch: "Every student has a profile you can open: quizzes taken, scores, points earned and full quiz history. No spreadsheets, no chasing reading logs.",
    points: ["Quizzes taken and points for every student at a glance", "Full quiz history with scores", "Approve AI-generated quizzes before students take them"],
    win: "Accountability without the paperwork.",
    accent: "from-cyan-500/25 to-blue-500/10",
    iconColor: "text-cyan-300",
  },
  {
    icon: Trophy,
    tag: "MOTIVATION",
    title: "Reading is what unlocks everything",
    pitch: "Passing a book quiz earns points, Reader Coins, badges and competition progress. Coins buy pets, homes and avatar items — so students read to earn them.",
    points: ["Class and school leaderboards", "Certificates you can print and hand out", "Rewards students choose themselves"],
    win: "Students chase the next book instead of avoiding it.",
    accent: "from-amber-500/25 to-orange-500/10",
    iconColor: "text-amber-300",
  },
];

const extras = [
  { icon: Brain, title: "Growth Checks", text: "Track reading scores and words-correct-per-minute over time." },
  { icon: ShieldCheck, title: "Proctor mode", text: "Your password keeps quizzes honest when it counts." },
  { icon: Users, title: "Parents connected", text: "Print parent invite letters and message students directly." },
  { icon: FileQuestion, title: "Custom quizzes", text: "Build your own quiz for any book or lesson." },
  { icon: Accessibility, title: "Every learner included", text: "Eye Gaze mode, read-aloud and audio books built in." },
  { icon: Clock3, title: "Minutes to set up", text: "Approve students and you're running — no installs." },
];

const steps = [
  { title: "Approve your students", text: "They sign up and pick you. One tap approves them." },
  { title: "Set your game rules", text: "Choose limits and quiz requirements in Club Controls." },
  { title: "Host your first live game", text: "Type a topic, share the code, press start." },
];

export default function TeacherArise2() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const allowed = !!user && (user.role === "teacher" || user.isAdmin);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  if (!allowed) return <Redirect to="/" replace />;

  return (
    <main className="min-h-screen bg-[#070912] text-white">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-violet-600/30 blur-[120px]" />
        <div className="pointer-events-none absolute -right-24 top-40 h-72 w-72 rounded-full bg-cyan-400/12 blur-[100px]" />

        <div className="relative mx-auto max-w-5xl px-4 pt-5 sm:px-8">
          <button onClick={() => navigate("/teacher-dashboard")} className="inline-flex items-center gap-2 rounded-full px-2 py-2 text-sm font-bold text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Teacher Dashboard
          </button>
        </div>

        {/* Hero */}
        <section className="relative mx-auto max-w-4xl px-5 pb-14 pt-10 text-center sm:pb-20 sm:pt-14">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.24em] text-cyan-300">
            <Sparkles className="h-4 w-4" /> For teachers
          </div>
          <h1 className="text-4xl font-black leading-[1.05] tracking-[-.04em] sm:text-6xl">
            Your class will <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">ask</span> to read.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base font-semibold leading-7 text-slate-300 sm:text-lg">
            A.R.I.S.E. 2.0 gives you live classroom games, full control over game time, and a clear view of every student's reading — all in one place.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={() => navigate("/live-quiz")} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-7 text-sm font-black text-slate-950 shadow-xl transition hover:scale-[1.03]">
              <Zap className="h-4 w-4" /> Host a live game
            </button>
            <button onClick={() => { try { sessionStorage.setItem("teacher_dashboard_tab", "club-controls"); } catch {} navigate("/teacher-dashboard"); }} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 text-sm font-black text-white transition hover:bg-white/10">
              <Gamepad2 className="h-4 w-4" /> Set game controls
            </button>
          </div>
          <div className="mx-auto mt-10 grid max-w-xl grid-cols-3 gap-2 rounded-3xl border border-white/10 bg-white/[.04] p-2">
            {heroStats.map(s => (
              <div key={s.label} className="rounded-2xl bg-white/[.05] px-2 py-4">
                <div className="text-3xl font-black sm:text-4xl">{s.value}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-wider text-white/55 sm:text-xs">{s.label}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Core features */}
      <section className="border-t border-white/10 px-4 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[.25em] text-violet-300">What you get</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Four reasons teachers switch</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {features.map(({ icon: Icon, tag, title, pitch, points, win, accent, iconColor }) => (
              <article key={tag} className={`relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br ${accent} p-6 sm:p-7`}>
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-black/30 ring-1 ring-white/10">
                    <Icon className={`h-6 w-6 ${iconColor}`} />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-[.24em] ${iconColor}`}>{tag}</span>
                </div>
                <h3 className="mt-4 text-xl font-black leading-snug sm:text-2xl">{title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">{pitch}</p>
                <ul className="mt-4 space-y-2">
                  {points.map(p => (
                    <li key={p} className="flex gap-2 text-sm leading-6 text-slate-200">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />{p}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black text-white">
                  {win}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Extras */}
      <section className="border-y border-white/10 bg-white/[.025] px-4 py-12 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[.25em] text-cyan-300">Also included</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">The small things that save you time</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {extras.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" />
                <div>
                  <div className="font-black">{title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Get started */}
      <section className="px-4 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[.25em] text-emerald-300">Start this week</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Up and running in three steps</h2>
          <ol className="mt-6 grid gap-3 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 text-sm font-black">{i + 1}</div>
                <div className="mt-3 font-black">{s.title}</div>
                <p className="mt-1 text-sm leading-6 text-slate-400">{s.text}</p>
              </li>
            ))}
          </ol>

          <div className="relative mt-10 overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-r from-violet-600/30 via-fuchsia-600/20 to-cyan-500/20 p-7 text-center sm:p-10">
            <Rocket className="mx-auto h-8 w-8 text-cyan-200" />
            <h2 className="mx-auto mt-3 max-w-2xl text-2xl font-black sm:text-4xl">Try one live game with your class tomorrow.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-200">It takes about two minutes to set up. Watch what happens to the energy in the room.</p>
            <button onClick={() => navigate("/live-quiz")} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-8 text-sm font-black text-slate-950 shadow-xl transition hover:scale-[1.03]">
              Open the Live Game Studio <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
