import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight, BookOpen, BrainCircuit, Eye, Gamepad2, GraduationCap, Heart,
  LogIn, Megaphone, PlayCircle, ShieldCheck, Sparkles, Trophy, UserRound,
  Users, Zap
} from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import DonationGoal from "@/components/DonationGoal";
import { Arise2UpdateButton } from "@/components/Arise2Update";

type FeatureId = "reader" | "live" | "club" | "eye" | "family" | "teacher";

const FEATURES: Record<FeatureId, {
  label: string;
  kicker: string;
  title: string;
  description: string;
  bullets: string[];
  icon: any;
  tutorial: string;
  sample?: "student" | "eye-gaze" | "parent";
}> = {
  reader: {
    label: "Reader",
    kicker: "READ + DISCOVER",
    title: "A reading platform students can actually explore.",
    description: "Book discovery, quizzes, iARISE lessons, progress, certificates, rewards, and a fast FYP-style way to find the next book.",
    bullets: ["Search and discover books", "Full quizzes + instant results", "Points, certificates, badges, rewards"],
    icon: BookOpen,
    tutorial: "/tutorial/student",
    sample: "student",
  },
  live: {
    label: "A.R.I.S.E. Live",
    kicker: "LIVE CLASSROOM PLAY",
    title: "A.R.I.S.E. Live turns review into a game show.",
    description: "Teachers launch a live quiz, students join with a short code, answers come in together, and the live board updates in real time.",
    bullets: ["Short join codes", "Live questions + standings", "Built directly into A.R.I.S.E."],
    icon: Zap,
    tutorial: "/tutorial/teacher",
    sample: "student",
  },
  club: {
    label: "Club A.R.I.S.E.",
    kicker: "EARN + PLAY",
    title: "Reading unlocks a world beyond the quiz.",
    description: "Students can move from reading into Club A.R.I.S.E., arcade games, avatars, pets, homes, the cinema, Board Quest, The Block, and expanding 3D worlds.",
    bullets: ["Multiplayer + computer arcade games", "Avatars, pets, homes + Reader Coins", "Teacher and family game controls"],
    icon: Gamepad2,
    tutorial: "/tutorial/student",
    sample: "student",
  },
  eye: {
    label: "Eye Gazer",
    kicker: "ACCESS FOR MORE LEARNERS",
    title: "A complete learning experience built around visual access.",
    description: "My Talker AAC, visual quizzes, games, Life Skills, My World, Shorts, Flash Cards, My Buddy, progress, and family personalization live in one simplified experience.",
    bullets: ["AAC / My Talker", "Visual learning + accessible games", "Family-controlled learning environment"],
    icon: Eye,
    tutorial: "/tutorial/eye-gaze",
    sample: "eye-gaze",
  },
  family: {
    label: "Families",
    kicker: "SEE + SUPPORT",
    title: "One parent account can follow every child.",
    description: "Parents can switch quickly between linked children, see progress and certificates, and manage controls appropriate to regular Student or Eye Gazer accounts.",
    bullets: ["Quick child switching", "Progress, certificates + Growth Check", "Game, media + Eye Gazer controls"],
    icon: Heart,
    tutorial: "/tutorial/parent",
    sample: "parent",
  },
  teacher: {
    label: "Teachers",
    kicker: "CONTROL + MOTIVATE",
    title: "The classroom control center behind A.R.I.S.E.",
    description: "Manage students, review AI quizzes, create live games, monitor progress, connect families, create rewards, and control game access from one dashboard.",
    bullets: ["Student + quiz management", "A.R.I.S.E. Live", "Rewards, progress + game controls"],
    icon: GraduationCap,
    tutorial: "/tutorial/teacher",
  },
};

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSampleChooser, setShowSampleChooser] = useState(false);
  const [sampleLoading, setSampleLoading] = useState<"student" | "eye-gaze" | "parent" | null>(null);
  const [loginBanner, setLoginBanner] = useState<{ text: string; bgColor: string; textColor: string } | null>(null);
  const [activeFeature, setActiveFeature] = useState<FeatureId>("reader");

  useEffect(() => {
    fetch(`${API_BASE}/api/banners/login`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data && data.text) setLoginBanner(data); })
      .catch(() => {});
  }, []);

  const feature = FEATURES[activeFeature];
  const FeatureIcon = feature.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loginSample = async (type: "student" | "eye-gaze" | "parent") => {
    const usernameByType = {
      student: "sample",
      "eye-gaze": "sample-eye",
      parent: "sample-parent",
    } as const;
    setError("");
    setSampleLoading(type);
    try {
      await login(usernameByType[type], "sample1234");
      setShowSampleChooser(false);
    } catch (err: any) {
      setError(err.message || "Could not open that sample account.");
    } finally {
      setSampleLoading(null);
    }
  };

  const featureKeys = useMemo(() => Object.keys(FEATURES) as FeatureId[], []);

  return (
    <div className="min-h-screen bg-[#05070b] text-white selection:bg-orange-500/30">
      <header className="border-b border-white/8 bg-[#05070b]/90 backdrop-blur-xl lg:sticky lg:top-0 lg:z-50">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => navigate("/")} className="group flex min-w-0 items-center gap-3 text-left">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 via-violet-500 to-cyan-400 shadow-[0_10px_35px_rgba(249,115,22,.15)]">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-[-.04em] sm:text-xl">A.R.I.S.E. <span className="text-orange-400">Reader</span></span>
                <span className="rounded-full border border-orange-300/25 bg-orange-400/10 px-2 py-0.5 text-[9px] font-black tracking-wider text-orange-300">2.0</span>
              </div>
              <p className="hidden text-[10px] font-bold uppercase tracking-[.18em] text-white/35 sm:block">Read · Learn · Earn · Play · Grow</p>
            </div>
          </button>

          <nav className="ml-auto hidden items-center gap-1 lg:flex">
            <button type="button" onClick={() => navigate("/about")} className="rounded-full px-4 py-2 text-sm font-bold text-white/60 hover:bg-white/5 hover:text-white">About</button>
            <button type="button" onClick={() => navigate("/tutorial")} className="rounded-full px-4 py-2 text-sm font-bold text-white/60 hover:bg-white/5 hover:text-white">Tutorials</button>
            <button type="button" onClick={() => navigate("/leaderboard")} className="rounded-full px-4 py-2 text-sm font-bold text-white/60 hover:bg-white/5 hover:text-white">Leaderboard</button>
          </nav>
        </div>
      </header>

      {loginBanner && (
        <div className="mx-auto max-w-[1500px] px-4 pt-4 sm:px-6 lg:px-8">
          <div className="flex items-start gap-3 rounded-2xl p-3.5" style={{ background: loginBanner.bgColor, color: loginBanner.textColor }}>
            <Megaphone className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm font-bold leading-relaxed">{loginBanner.text}</p>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(380px,.72fr)] xl:items-start">
          <section className="min-w-0 space-y-6">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_15%_12%,rgba(249,115,22,.18),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(124,58,237,.19),transparent_30%),radial-gradient(circle_at_68%_85%,rgba(34,211,238,.09),transparent_25%),#0a0d14] p-6 shadow-[0_30px_100px_rgba(0,0,0,.35)] sm:p-9 lg:min-h-[560px] lg:p-12">
              <div className="absolute right-[-90px] top-[-100px] h-80 w-80 rounded-full border border-white/[.04]" />
              <div className="absolute right-[-35px] top-[-45px] h-56 w-56 rounded-full border border-white/[.05]" />

              <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.05] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-orange-300">
                    <Sparkles className="h-3.5 w-3.5" /> Built to make students want to keep going
                  </div>
                  <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[.94] tracking-[-.065em] sm:text-6xl lg:text-7xl">
                    Reading is the start.<br />
                    <span className="bg-gradient-to-r from-orange-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">A.R.I.S.E. is the world around it.</span>
                  </h1>
                  <p className="mt-6 max-w-2xl text-base font-semibold leading-7 text-white/55 sm:text-lg">
                    Books, quizzes, live classroom games, rewards, accessible learning, avatars, pets, arcade games, family controls, and progress — connected in one student-centered experience.
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <Button onClick={() => setShowSampleChooser(true)} className="h-12 rounded-full bg-white px-6 font-black text-slate-950 hover:bg-white/90">
                      <PlayCircle className="mr-2 h-4 w-4" /> Try it
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/tutorial")} className="h-12 rounded-full border-white/15 bg-white/[.03] px-6 font-black text-white hover:bg-white/10">
                      Explore tutorials
                    </Button>
                  </div>
                </div>

                <div className="relative mx-auto w-full max-w-[330px]">
                  <div className="absolute -inset-4 rounded-[3rem] bg-gradient-to-br from-orange-500/15 via-violet-500/15 to-cyan-400/10 blur-2xl" />
                  <div className="relative rounded-[2.5rem] border border-white/12 bg-black/30 p-4 shadow-2xl backdrop-blur">
                    <div className="rounded-[2rem] border border-white/10 bg-[#10141d] p-4">
                      <div className="flex items-center justify-between">
                        <div><p className="text-[9px] font-black uppercase tracking-widest text-orange-300">Your A.R.I.S.E.</p><p className="mt-1 text-lg font-black">One account. More reasons to learn.</p></div>
                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-orange-400"><Sparkles className="h-5 w-5" /></div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {[
                          ["📚", "Read", "Book discovery"],
                          ["⚡", "Live", "Classroom games"],
                          ["🎮", "Play", "Club + arcade"],
                          ["🏆", "Earn", "Points + rewards"],
                          ["🐾", "Build", "Pets + worlds"],
                          ["👁️", "Access", "Eye Gazer"],
                        ].map(([emoji, title, sub]) => (
                          <div key={title} className="rounded-2xl border border-white/8 bg-white/[.035] p-3">
                            <div className="text-xl">{emoji}</div>
                            <div className="mt-2 text-xs font-black">{title}</div>
                            <div className="mt-0.5 text-[9px] font-bold text-white/35">{sub}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative mt-8">
                <Arise2UpdateButton />
              </div>
            </div>

            <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0d14] shadow-2xl">
              <div className="border-b border-white/8 px-5 pt-5 sm:px-7 sm:pt-7">
                <p className="text-[10px] font-black uppercase tracking-[.22em] text-white/35">Explore A.R.I.S.E.</p>
                <div className="mt-4 flex gap-2 overflow-x-auto pb-4">
                  {featureKeys.map(key => {
                    const item = FEATURES[key];
                    const Icon = item.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveFeature(key)}
                        className={`flex min-w-max items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-black transition ${activeFeature === key ? "border-orange-300/45 bg-orange-400/10 text-white" : "border-white/8 bg-white/[.025] text-white/45 hover:border-white/20 hover:text-white"}`}
                      >
                        <Icon className="h-4 w-4" /> {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="p-6 sm:p-8">
                  <p className="text-[10px] font-black uppercase tracking-[.22em] text-orange-300">{feature.kicker}</p>
                  <h2 className="mt-2 max-w-2xl text-3xl font-black tracking-[-.04em] sm:text-4xl">{feature.title}</h2>
                  <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-white/50">{feature.description}</p>
                  <div className="mt-6 grid gap-2 sm:grid-cols-3">
                    {feature.bullets.map(bullet => (
                      <div key={bullet} className="rounded-2xl border border-white/8 bg-white/[.03] p-3 text-xs font-bold text-white/70">
                        <span className="mr-1 text-emerald-300">✓</span> {bullet}
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <Button onClick={() => navigate(feature.tutorial)} className="rounded-full font-black">
                      See the full tutorial <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    {feature.sample && (
                      <Button
                        variant="outline"
                        onClick={() => { setShowSampleChooser(true); }}
                        className="rounded-full border-white/15 bg-white/[.03] font-black text-white hover:bg-white/10"
                      >
                        Try sample
                      </Button>
                    )}
                  </div>
                </div>

                <div className="relative min-h-[300px] overflow-hidden border-t border-white/8 bg-[radial-gradient(circle_at_70%_25%,rgba(124,58,237,.24),transparent_30%),radial-gradient(circle_at_25%_78%,rgba(249,115,22,.15),transparent_30%),#080b11] p-6 lg:border-l lg:border-t-0">
                  <div className="absolute right-4 top-2 text-[130px] font-black leading-none text-white/[.025]">{featureKeys.indexOf(activeFeature) + 1}</div>
                  <div className="relative flex h-full flex-col justify-between">
                    <div className="grid h-20 w-20 place-items-center rounded-[1.5rem] border border-white/10 bg-white/[.06] shadow-xl">
                      <FeatureIcon className="h-9 w-9 text-orange-300" />
                    </div>
                    <div className="mt-12">
                      <div className="grid grid-cols-3 gap-2">
                        {[0,1,2].map(i => (
                          <div key={i} className={`rounded-2xl border border-white/8 bg-white/[.04] p-3 ${i === 1 ? "translate-y-[-8px]" : ""}`}>
                            <div className="h-2 w-10 rounded-full bg-white/10" />
                            <div className="mt-3 h-10 rounded-xl bg-gradient-to-br from-violet-500/15 to-orange-400/10" />
                            <div className="mt-3 h-1.5 rounded-full bg-white/8" />
                            <div className="mt-1.5 h-1.5 w-2/3 rounded-full bg-white/8" />
                          </div>
                        ))}
                      </div>
                      <p className="mt-5 text-xs font-black uppercase tracking-[.2em] text-white/25">Interactive feature preview</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <button onClick={() => navigate("/register")} className="group rounded-[1.75rem] border border-orange-400/25 bg-orange-500/8 p-5 text-left transition hover:-translate-y-1 hover:border-orange-300/50 hover:bg-orange-500/12">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-500/15"><Users className="h-5 w-5 text-orange-300" /></div>
                <h3 className="mt-4 text-lg font-black">Student account</h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-white/40">Read, quiz, earn, play, build your profile, and access the full student experience.</p>
                <div className="mt-4 flex items-center gap-1 text-xs font-black text-orange-300">Create student account <ArrowRight className="h-3.5 w-3.5" /></div>
              </button>
              <button onClick={() => navigate("/teacher-signup")} className="group rounded-[1.75rem] border border-blue-400/25 bg-blue-500/8 p-5 text-left transition hover:-translate-y-1 hover:border-blue-300/50 hover:bg-blue-500/12">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500/15"><GraduationCap className="h-5 w-5 text-blue-300" /></div>
                <h3 className="mt-4 text-lg font-black">Teacher account</h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-white/40">Manage students, quizzes, live games, rewards, progress, parent connections, and game rules.</p>
                <div className="mt-4 flex items-center gap-1 text-xs font-black text-blue-300">Create teacher account <ArrowRight className="h-3.5 w-3.5" /></div>
              </button>
              <button onClick={() => navigate("/parent-signup")} className="group rounded-[1.75rem] border border-violet-400/25 bg-violet-500/8 p-5 text-left transition hover:-translate-y-1 hover:border-violet-300/50 hover:bg-violet-500/12">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/15"><Heart className="h-5 w-5 text-violet-300" /></div>
                <h3 className="mt-4 text-lg font-black">Parent account</h3>
                <p className="mt-1 text-xs font-semibold leading-5 text-white/40">Connect one or multiple children, switch quickly, track progress, and manage family controls.</p>
                <div className="mt-4 flex items-center gap-1 text-xs font-black text-violet-300">Create parent account <ArrowRight className="h-3.5 w-3.5" /></div>
              </button>
            </section>
          </section>

          <aside className="xl:sticky xl:top-24">
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c1017] shadow-[0_30px_100px_rgba(0,0,0,.4)]">
              <div className="border-b border-white/8 p-6 sm:p-7">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[.06]"><LogIn className="h-5 w-5 text-orange-300" /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.2em] text-white/30">Welcome back</p>
                    <h2 className="text-2xl font-black tracking-tight">Sign in to A.R.I.S.E.</h2>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-7">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-white/65">Username</Label>
                    <Input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Your username" required className="h-12 border-white/10 bg-white/[.04] text-white placeholder:text-white/25" data-testid="input-username" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-white/65">Password</Label>
                    <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required className="h-12 border-white/10 bg-white/[.04] text-white placeholder:text-white/25" data-testid="input-password" />
                  </div>
                  {error && <div className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm font-bold text-red-200" data-testid="text-error">{error}</div>}
                  <Button type="submit" className="h-12 w-full rounded-xl font-black" disabled={loading} data-testid="button-login">{loading ? "Logging in…" : "Log in"}</Button>
                </form>

                <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-white/8" /><span className="text-[10px] font-black uppercase tracking-widest text-white/25">or explore first</span><div className="h-px flex-1 bg-white/8" /></div>

                <button type="button" onClick={() => setShowSampleChooser(true)} disabled={loading || !!sampleLoading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-fuchsia-500 px-4 text-sm font-black text-white shadow-lg transition hover:brightness-110 disabled:opacity-50">
                  <Sparkles className="h-4 w-4" /> Try a sample account
                </button>

                <div className="mt-5 rounded-2xl border border-white/8 bg-white/[.025] p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/30">New to A.R.I.S.E.?</p>
                  <div className="mt-3 grid gap-2">
                    <button type="button" onClick={() => navigate("/register")} className="flex items-center justify-between rounded-xl bg-orange-500/10 px-3 py-3 text-left text-sm font-black text-orange-200 hover:bg-orange-500/15"><span>Student sign up</span><ArrowRight className="h-4 w-4" /></button>
                    <button type="button" onClick={() => navigate("/teacher-signup")} className="flex items-center justify-between rounded-xl bg-blue-500/10 px-3 py-3 text-left text-sm font-black text-blue-200 hover:bg-blue-500/15"><span>Teacher sign up</span><ArrowRight className="h-4 w-4" /></button>
                    <button type="button" onClick={() => navigate("/parent-signup")} className="flex items-center justify-between rounded-xl bg-violet-500/10 px-3 py-3 text-left text-sm font-black text-violet-200 hover:bg-violet-500/15"><span>Parent sign up</span><ArrowRight className="h-4 w-4" /></button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => navigate("/tutorial")} className="rounded-xl border border-white/8 bg-white/[.025] p-3 text-xs font-black text-white/55 hover:bg-white/[.06] hover:text-white"><PlayCircle className="mx-auto mb-1 h-4 w-4" /> Tutorials</button>
                  <button type="button" onClick={() => navigate("/leaderboard")} className="rounded-xl border border-white/8 bg-white/[.025] p-3 text-xs font-black text-white/55 hover:bg-white/[.06] hover:text-white"><Trophy className="mx-auto mb-1 h-4 w-4" /> Leaderboard</button>
                  <button type="button" onClick={() => navigate("/about")} className="rounded-xl border border-white/8 bg-white/[.025] p-3 text-xs font-black text-white/55 hover:bg-white/[.06] hover:text-white"><Heart className="mx-auto mb-1 h-4 w-4" /> About</button>
                  <button type="button" onClick={() => navigate("/about")} className="rounded-xl border border-white/8 bg-white/[.025] p-3 text-xs font-black text-white/55 hover:bg-white/[.06] hover:text-white"><ShieldCheck className="mx-auto mb-1 h-4 w-4" /> Mission</button>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-white/8 bg-[#0a0d14] p-3">
              <DonationGoal />
            </div>
          </aside>
        </div>

        <footer className="mt-8 flex flex-col gap-3 border-t border-white/8 py-7 text-xs font-semibold text-white/30 sm:flex-row sm:items-center sm:justify-between">
          <p>A.R.I.S.E. Reader · Advocating Resilience, Inclusion, Support & Empowerment</p>
          <div className="flex flex-wrap gap-4">
            <button onClick={() => navigate("/about")} className="hover:text-white">About A.R.I.S.E.</button>
            <button onClick={() => navigate("/tutorial")} className="hover:text-white">See tutorials</button>
            <button onClick={() => navigate("/parent-signup")} className="hover:text-white">Families</button>
          </div>
        </footer>
      </main>

      {showSampleChooser && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl">
          <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c1017] shadow-2xl">
            <div className="border-b border-white/8 p-6 sm:p-7">
              <p className="text-xs font-black uppercase tracking-[.2em] text-orange-300">Sample Experience</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight">Choose the account you want to experience.</h2>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-white/45">Sample accounts are full sandbox demos. They do not enter student leaderboards or competition rankings, and sample game play is not limited by real-student game timers.</p>
            </div>

            <div className="grid gap-3 p-5 sm:p-6 md:grid-cols-3">
              <button type="button" onClick={() => void loginSample("student")} disabled={!!sampleLoading} className="rounded-2xl border-2 border-white/8 bg-white/[.03] p-5 text-left transition hover:-translate-y-1 hover:border-orange-400/50 hover:bg-orange-500/10 disabled:opacity-50">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-500/15"><Users className="h-6 w-6 text-orange-300" /></div>
                <p className="mt-4 font-black">{sampleLoading === "student" ? "Opening…" : "Student"}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-white/40">Library, full quizzes, A.R.I.S.E. Live, Club, arcade, avatars, pets, worlds, rewards, and more.</p>
              </button>
              <button type="button" onClick={() => void loginSample("eye-gaze")} disabled={!!sampleLoading} className="rounded-2xl border-2 border-white/8 bg-white/[.03] p-5 text-left transition hover:-translate-y-1 hover:border-cyan-400/50 hover:bg-cyan-500/10 disabled:opacity-50">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-500/15"><Eye className="h-6 w-6 text-cyan-300" /></div>
                <p className="mt-4 font-black">{sampleLoading === "eye-gaze" ? "Opening…" : "Eye Gazer"}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-white/40">My Talker, visual quizzes, games, Life Skills, My World, Shorts, Flash Cards, My Buddy, and progress.</p>
              </button>
              <button type="button" onClick={() => void loginSample("parent")} disabled={!!sampleLoading} className="rounded-2xl border-2 border-white/8 bg-white/[.03] p-5 text-left transition hover:-translate-y-1 hover:border-violet-400/50 hover:bg-violet-500/10 disabled:opacity-50">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15"><UserRound className="h-6 w-6 text-violet-300" /></div>
                <p className="mt-4 font-black">{sampleLoading === "parent" ? "Opening…" : "Parent"}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-white/40">Linked-child dashboard, progress, certificates, family controls, My Talker setup, My World, and more.</p>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 p-5 sm:px-6">
              <button type="button" onClick={() => setShowSampleChooser(false)} disabled={!!sampleLoading} className="rounded-xl px-4 py-2 text-sm font-bold text-white/45 hover:bg-white/5 hover:text-white">Cancel</button>
              <button type="button" onClick={() => { setShowSampleChooser(false); navigate("/tutorial"); }} disabled={!!sampleLoading} className="rounded-xl border border-white/10 bg-white/[.03] px-4 py-2 text-sm font-black text-white hover:bg-white/[.07]">View tutorials instead</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
