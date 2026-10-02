import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, BookOpen, Trophy, Gamepad2, Award, MessageCircle, Users, KeyRound, Accessibility,
  Heart, Check, Sparkles, ChevronRight, UserPlus, LogIn, Share2, Home,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// Public page for parents and families (shareable link, no login needed).
// Every claim maps to a real feature in the Parent Portal.

const features = [
  {
    icon: BookOpen,
    tag: "SEE THEIR READING",
    title: "Know exactly what your child is reading",
    pitch: "See every book they've read, every quiz they've taken and how they scored, all from your phone.",
    points: ["Quiz history with scores", "Books read and points earned", "Their Arise Reading Score, a snapshot to help you support growth"],
    win: "No more guessing. \"What did you read today?\" finally has an answer.",
    accent: "from-cyan-500/25 to-blue-500/10",
    iconColor: "text-cyan-300",
  },
  {
    icon: Gamepad2,
    tag: "YOU SET THE RULES",
    title: "Games are earned by reading",
    pitch: "Kids love the A.R.I.S.E. games and worlds. You decide how much play they get and what it takes to unlock it.",
    points: ["Turn games on or off anytime", "Set a daily game limit", "Require a passed book quiz to earn game time", "Limit daily A.R.I.S.E. Shorts"],
    win: "Screen time that rewards reading instead of competing with it.",
    accent: "from-violet-500/25 to-fuchsia-500/10",
    iconColor: "text-violet-300",
  },
  {
    icon: Trophy,
    tag: "CELEBRATE WINS",
    title: "Watch them want to read more",
    pitch: "Every passed quiz earns points, Reader Coins and a certificate. Kids spend coins on pets, homes and avatar items, so reading feels like progress they can see.",
    points: ["Points and leaderboards by grade", "Certificates you can view and print", "Rewards your child chooses"],
    win: "Something to celebrate together at the dinner table.",
    accent: "from-amber-500/25 to-orange-500/10",
    iconColor: "text-amber-300",
  },
];

const extras = [
  { icon: Users, title: "All your kids, one account", text: "Connect every child and switch between them anytime." },
  { icon: KeyRound, title: "Family proctor code", text: "Your private code lets your child take quizzes at home with you watching." },
  { icon: MessageCircle, title: "Stay connected", text: "Keep in touch with your child's teacher about their reading." },
  { icon: Award, title: "Printable certificates", text: "Hang their wins on the fridge." },
  { icon: Accessibility, title: "For every learner", text: "Eye Gaze mode with My Talker and My World you can personalize for your child." },
  { icon: Heart, title: "Reading Club", text: "Sign your child up for the A.R.I.S.E. Reading Club." },
];

const steps = [
  { title: "Get your child's parent code", text: "It's on the parent letter from school, or your child can find it on their Account page." },
  { title: "Create your parent account", text: "Enter the code and you're connected to your child automatically." },
  { title: "Check in and set your rules", text: "See their progress and choose their game settings." },
];

export default function ParentArise2() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);
  const isParent = user?.role === "parent";
  const isStaff = !!user && (user.role === "teacher" || user.isAdmin);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const signUp = () => navigate("/parent-signup");
  const copyShareLink = async () => {
    const link = `${window.location.origin}${window.location.pathname}#/for-parents`;
    try { await navigator.clipboard.writeText(link); } catch { window.prompt("Copy this link:", link); return; }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  return (
    <main className="min-h-screen bg-[#070912] text-white">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-fuchsia-600/25 blur-[120px]" />
        <div className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-cyan-400/12 blur-[100px]" />

        <div className="relative mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-5 sm:px-8">
          {isParent ? (
            <button onClick={() => navigate("/parent-dashboard")} className="inline-flex items-center gap-2 rounded-full px-2 py-2 text-sm font-bold text-slate-300 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Parent Portal
            </button>
          ) : isStaff ? (
            <button onClick={() => navigate(user?.isAdmin ? "/admin" : "/teacher-dashboard")} className="inline-flex items-center gap-2 rounded-full px-2 py-2 text-sm font-bold text-slate-300 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : (
            <span className="text-sm font-black tracking-wide">A.R.I.S.E. <span className="text-cyan-300">Reader</span></span>
          )}
          {isStaff || isParent ? (
            <button onClick={copyShareLink} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 text-sm font-black hover:bg-white/10">
              {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Share2 className="h-4 w-4" />} {copied ? "Link copied" : "Copy share link"}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => navigate("/")} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-slate-300 hover:text-white">
                <LogIn className="h-4 w-4" /> Log in
              </button>
              <button onClick={signUp} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-black text-slate-950 transition hover:scale-[1.03]">
                <UserPlus className="h-4 w-4" /> Parent sign up
              </button>
            </div>
          )}
        </div>

        {/* Hero */}
        <section className="relative mx-auto max-w-4xl px-5 pb-14 pt-10 text-center sm:pb-20 sm:pt-14">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.24em] text-fuchsia-200">
            <Home className="h-4 w-4" /> For parents & families
          </div>
          <h1 className="text-4xl font-black leading-[1.05] tracking-[-.04em] sm:text-6xl">
            See your child's reading <span className="bg-gradient-to-r from-fuchsia-300 via-violet-300 to-cyan-300 bg-clip-text text-transparent">grow</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base font-semibold leading-7 text-slate-300 sm:text-lg">
            A.R.I.S.E. turns reading into something kids want to do. With a parent account you see their progress, celebrate their wins and decide how much game time they earn.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {isParent ? (
              <button onClick={() => navigate("/parent-dashboard")} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-7 text-sm font-black text-slate-950 shadow-xl transition hover:scale-[1.03]">
                Open my Parent Portal <ChevronRight className="h-4 w-4" />
              </button>
            ) : <>
              <button onClick={signUp} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-7 text-sm font-black text-slate-950 shadow-xl transition hover:scale-[1.03]">
                <UserPlus className="h-4 w-4" /> Create a parent account
              </button>
              {!user && <button onClick={() => navigate("/")} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 text-sm font-black transition hover:bg-white/10">
                <LogIn className="h-4 w-4" /> I already have an account
              </button>}
            </>}
          </div>
        </section>
      </div>

      {/* Core features */}
      <section className="border-t border-white/10 px-4 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[.25em] text-fuchsia-300">What you get</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Your window into their reading</h2>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {features.map(({ icon: Icon, tag, title, pitch, points, win, accent, iconColor }) => (
              <article key={tag} className={`flex flex-col rounded-[28px] border border-white/10 bg-gradient-to-br ${accent} p-6`}>
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-black/30 ring-1 ring-white/10">
                    <Icon className={`h-6 w-6 ${iconColor}`} />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-[.24em] ${iconColor}`}>{tag}</span>
                </div>
                <h3 className="mt-4 text-xl font-black leading-snug">{title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">{pitch}</p>
                <ul className="mt-4 flex-1 space-y-2">
                  {points.map(p => (
                    <li key={p} className="flex gap-2 text-sm leading-6 text-slate-200">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />{p}
                    </li>
                  ))}
                </ul>
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black">{win}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Extras */}
      <section className="border-y border-white/10 bg-white/[.025] px-4 py-12 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[.25em] text-cyan-300">Also included</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Made for busy families</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {extras.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-4">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-300" />
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
          <p className="text-xs font-black uppercase tracking-[.25em] text-emerald-300">Get started</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Connected in three steps</h2>
          <ol className="mt-6 grid gap-3 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-white/10 bg-white/[.04] p-5">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-400 text-sm font-black">{i + 1}</div>
                <div className="mt-3 font-black">{s.title}</div>
                <p className="mt-1 text-sm leading-6 text-slate-400">{s.text}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-r from-fuchsia-600/30 via-violet-600/20 to-cyan-500/20 p-7 text-center sm:p-10">
            <Sparkles className="mx-auto h-8 w-8 text-cyan-200" />
            <h2 className="mx-auto mt-3 max-w-2xl text-2xl font-black sm:text-4xl">Be part of their reading journey.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-200">It takes a couple of minutes with your child's parent code. Don't have the code? Ask your child or their teacher.</p>
            {isParent ? (
              <button onClick={() => navigate("/parent-dashboard")} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-8 text-sm font-black text-slate-950 shadow-xl transition hover:scale-[1.03]">
                Open my Parent Portal <ChevronRight className="h-4 w-4" />
              </button>
            ) : <>
              <button onClick={signUp} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-8 text-sm font-black text-slate-950 shadow-xl transition hover:scale-[1.03]">
                Sign up as a parent <ChevronRight className="h-4 w-4" />
              </button>
              {!user && <p className="mt-3 text-xs font-semibold text-slate-300">Already have an account? <button onClick={() => navigate("/")} className="font-black text-cyan-200 hover:underline">Log in</button></p>}
            </>}
          </div>
        </div>
      </section>
    </main>
  );
}
