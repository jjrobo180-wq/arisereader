import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Eye,
  Gamepad2,
  GraduationCap,
  Heart,
  LogIn,
  Megaphone,
  PlayCircle,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  Zap,
} from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import DonationGoal from "@/components/DonationGoal";
import { Arise2UpdateButton } from "@/components/Arise2Update";

type FeatureId = "reader" | "live" | "club" | "eye" | "family" | "teacher";
type FrontTab = "signin" | "create" | "explore";

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
    title: "Find a book. Take a quiz. Keep growing.",
    description: "Book discovery, comprehension quizzes, iARISE lessons, progress, certificates, rewards, and a fast way to find the next read.",
    bullets: ["Book discovery", "Quizzes + instant results", "Points, badges + certificates"],
    icon: BookOpen,
    tutorial: "/tutorial/student",
    sample: "student",
  },
  live: {
    label: "A.R.I.S.E. Live",
    kicker: "LIVE CLASSROOM PLAY",
    title: "Turn review into a live game.",
    description: "Teachers launch a quiz, students join with a short code, and the class sees questions and standings update together.",
    bullets: ["Short join codes", "Live questions", "Real-time standings"],
    icon: Zap,
    tutorial: "/tutorial/teacher",
    sample: "student",
  },
  club: {
    label: "Club A.R.I.S.E.",
    kicker: "EARN + PLAY",
    title: "Reading unlocks more to do.",
    description: "Students can earn access to Club A.R.I.S.E., arcade games, avatars, pets, homes, Board Quest, the cinema, and expanding worlds.",
    bullets: ["Arcade + multiplayer", "Avatars, pets + homes", "Teacher/family controls"],
    icon: Gamepad2,
    tutorial: "/tutorial/student",
    sample: "student",
  },
  eye: {
    label: "Eye Gazer",
    kicker: "ACCESS FOR MORE LEARNERS",
    title: "A visual-first learning experience.",
    description: "My Talker AAC, visual quizzes, games, Life Skills, My World, Shorts, Flash Cards, My Buddy, progress, and family personalization.",
    bullets: ["My Talker AAC", "Visual learning", "Accessible games"],
    icon: Eye,
    tutorial: "/tutorial/eye-gaze",
    sample: "eye-gaze",
  },
  family: {
    label: "Families",
    kicker: "SEE + SUPPORT",
    title: "One parent account can follow every child.",
    description: "Parents can quickly switch between linked children, see progress and certificates, and manage controls for Student and Eye Gazer accounts.",
    bullets: ["Quick child switching", "Progress + certificates", "Family controls"],
    icon: Heart,
    tutorial: "/tutorial/parent",
    sample: "parent",
  },
  teacher: {
    label: "Teachers",
    kicker: "CONTROL + MOTIVATE",
    title: "Everything teachers need in one place.",
    description: "Manage students, review quizzes, create live games, monitor progress, connect families, create rewards, and control game access.",
    bullets: ["Student + quiz tools", "A.R.I.S.E. Live", "Rewards + controls"],
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
  const [frontTab, setFrontTab] = useState<FrontTab>("signin");
  const [donationOpen, setDonationOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/banners/login`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data && data.text) setLoginBanner(data); })
      .catch(() => {});
  }, []);

  const feature = FEATURES[activeFeature];
  const FeatureIcon = feature.icon;
  const featureKeys = useMemo(() => Object.keys(FEATURES) as FeatureId[], []);

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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,rgba(124,58,237,.24),transparent_28%),radial-gradient(circle_at_90%_8%,rgba(6,182,212,.16),transparent_26%),radial-gradient(circle_at_52%_45%,rgba(217,70,239,.08),transparent_35%),#0b0a16] text-slate-100 selection:bg-violet-500/100/40">
      <header className="border-b border-white/10 bg-[#0d0b1a]/92 backdrop-blur-xl lg:sticky lg:top-0 lg:z-50">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <button type="button" onClick={() => navigate("/")} className="group flex min-w-0 items-center gap-3 text-left">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-cyan-400 shadow-sm">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="whitespace-nowrap text-base font-black tracking-[.07em] sm:text-lg">
                  A.R.I.S.E. <span className="tracking-[.02em] bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 bg-clip-text text-transparent">Reader</span>
                </span>
                <span className="rounded-full border border-violet-400/25 bg-violet-500/100/10 px-2 py-0.5 text-[9px] font-black tracking-[.14em] text-violet-200">2.0</span>
              </div>
              <p className="hidden text-[9px] font-bold uppercase tracking-[.2em] text-slate-400 sm:block">Read · Learn · Earn · Play · Grow</p>
            </div>
          </button>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            <button type="button" onClick={() => navigate("/about")} className="rounded-full px-3 py-2 text-sm font-bold text-slate-400 hover:bg-white/[.09] hover:text-cyan-200">About</button>
            <button type="button" onClick={() => navigate("/tutorial")} className="rounded-full px-3 py-2 text-sm font-bold text-slate-400 hover:bg-white/[.09] hover:text-fuchsia-200">Tutorials</button>
            <button type="button" onClick={() => navigate("/leaderboard")} className="rounded-full px-3 py-2 text-sm font-bold text-slate-400 hover:bg-white/[.09] hover:text-violet-200">Leaderboard</button>
          </nav>
        </div>
      </header>

      {loginBanner && (
        <div className="mx-auto max-w-[1500px] px-4 pt-3 sm:px-6 lg:px-8">
          <div className="flex items-start gap-3 rounded-2xl border border-black/5 p-3 shadow-sm" style={{ background: loginBanner.bgColor, color: loginBanner.textColor }}>
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm font-bold leading-relaxed">{loginBanner.text}</p>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1500px] px-4 py-4 sm:px-6 sm:py-7 lg:px-8 lg:py-9">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)] lg:items-start">
          <section className="order-2 min-w-0 lg:order-1">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#151326] shadow-[0_28px_90px_rgba(0,0,0,.28)]">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400" />

              <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center lg:p-10">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/100/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-violet-200">
                    <Sparkles className="h-3.5 w-3.5" /> A.R.I.S.E. Reader 2.0
                  </div>

                  <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[.98] tracking-[-.05em] text-white sm:text-5xl lg:text-6xl">
                    Read. Learn. Earn.
                    <span className="mt-1 block bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-600 bg-clip-text text-transparent">Then keep exploring.</span>
                  </h1>

                  <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-slate-400">
                    Books, quizzes, live classroom games, rewards, accessible learning, avatars, pets, family controls, and progress — all in one student-centered experience.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {["Books + quizzes", "A.R.I.S.E. Live", "Club + games", "Eye Gazer", "Family controls"].map(item => (
                      <span key={item} className="rounded-full border border-white/10 bg-white/[.045] px-3 py-2 text-xs font-bold text-slate-300 backdrop-blur">{item}</span>
                    ))}
                  </div>

                  <div className="mt-7 flex flex-wrap gap-3">
                    <Button onClick={() => setFrontTab("create")} className="h-11 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-5 font-black text-white shadow-lg shadow-violet-500/15 hover:brightness-105">
                      Create an account <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button variant="outline" onClick={() => setShowSampleChooser(true)} className="h-11 rounded-full border-white/10 bg-white/[.055] px-5 font-black text-slate-100 hover:bg-white/[.04]">
                      <PlayCircle className="mr-2 h-4 w-4" /> Try a sample
                    </Button>
                  </div>
                </div>

                <div className="relative mx-auto w-full max-w-[300px]">
                  <div className="absolute -inset-3 rounded-[2.5rem] bg-gradient-to-br from-violet-500/18 via-fuchsia-500/14 to-cyan-400/16 blur-xl" />
                  <div className="relative rounded-[2rem] border border-white/10 bg-[#1b1830] p-4 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[.18em] text-violet-300">Your A.R.I.S.E.</p>
                        <p className="mt-1 text-base font-black">More reasons to keep going.</p>
                      </div>
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-cyan-400 text-white"><Sparkles className="h-5 w-5" /></div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {[
                        ["📚", "Read"],
                        ["⚡", "Live"],
                        ["🎮", "Play"],
                        ["🏆", "Earn"],
                        ["🐾", "Build"],
                        ["👁️", "Access"],
                      ].map(([emoji, title]) => (
                        <div key={title} className="rounded-2xl border border-white/8 bg-white/[.045] p-3">
                          <div className="text-xl">{emoji}</div>
                          <div className="mt-2 text-xs font-black text-slate-100">{title}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/8 bg-white/[.025] p-4 sm:px-8">
                <Arise2UpdateButton />
              </div>
            </div>
          </section>

          <aside className="order-1 lg:order-2 lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#151326] shadow-[0_24px_75px_rgba(0,0,0,.3)]">
              <div className="grid grid-cols-3 gap-1 border-b border-white/8 bg-[#100e20] p-2">
                {([
                  ["signin", "Sign in", LogIn],
                  ["create", "Create", Users],
                  ["explore", "Explore", Sparkles],
                ] as const).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFrontTab(key)}
                    className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-black transition ${frontTab === key ? "bg-white/[.08] text-white shadow-sm ring-1 ring-slate-200" : "text-slate-400 hover:bg-white/[.06] hover:text-slate-100"}`}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>

              {frontTab === "signin" && (
                <div className="p-5 sm:p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500/10"><LogIn className="h-5 w-5 text-violet-300" /></div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Welcome back</p>
                      <h2 className="text-xl font-black tracking-tight">Sign in to A.R.I.S.E.</h2>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-slate-200">Username</Label>
                      <Input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Your username" required className="h-12 border-white/10 bg-[#0f0d1d] text-white placeholder:text-slate-500 focus-visible:ring-violet-500/50" data-testid="input-username" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-slate-200">Password</Label>
                      <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required className="h-12 border-white/10 bg-[#0f0d1d] text-white placeholder:text-slate-500 focus-visible:ring-violet-500/50" data-testid="input-password" />
                    </div>
                    {error && <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm font-bold text-red-200" data-testid="text-error">{error}</div>}
                    <Button type="submit" className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 font-black text-white shadow-lg shadow-violet-500/15 hover:brightness-105" disabled={loading} data-testid="button-login">
                      {loading ? "Logging in…" : "Log in"}
                    </Button>
                  </form>

                  <button
                    type="button"
                    onClick={() => setShowSampleChooser(true)}
                    disabled={loading || !!sampleLoading}
                    className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-500/12 via-fuchsia-500/10 to-cyan-400/10 px-4 text-sm font-black text-violet-200 transition hover:border-fuchsia-400/25 hover:shadow-sm disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" /> Try sample account
                  </button>

                  <button type="button" onClick={() => setFrontTab("create")} className="mt-4 w-full text-center text-sm font-bold text-slate-400 hover:text-white">
                    New here? <span className="text-violet-300">Create an account</span>
                  </button>
                </div>
              )}

              {frontTab === "create" && (
                <div className="p-5 sm:p-6">
                  <div className="mb-5">
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Choose your account</p>
                    <h2 className="mt-1 text-xl font-black">Get started with A.R.I.S.E.</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-400">Student, teacher, and parent sign-up are separated so each option is easy to find.</p>
                  </div>

                  <div className="space-y-3">
                    <button type="button" onClick={() => navigate("/register")} className="group flex w-full items-center gap-4 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-500/12 to-fuchsia-500/10 p-4 text-left transition hover:-translate-y-0.5 hover:border-fuchsia-400/25">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-500/100 text-white"><Users className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-white">Student</p>
                        <p className="text-xs font-semibold text-slate-400">Read, quiz, earn, play, and build your profile.</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-violet-300" />
                    </button>

                    <button type="button" onClick={() => navigate("/teacher-signup")} className="group flex w-full items-center gap-4 rounded-2xl border border-cyan-400/25 bg-gradient-to-r from-cyan-500/12 to-blue-500/10 p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-300">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white"><GraduationCap className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-white">Teacher</p>
                        <p className="text-xs font-semibold text-slate-400">Manage students, live games, quizzes, rewards, and controls.</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-cyan-300" />
                    </button>

                    <button type="button" onClick={() => navigate("/parent-signup")} className="group flex w-full items-center gap-4 rounded-2xl border border-fuchsia-400/25 bg-gradient-to-r from-fuchsia-500/12 to-violet-500/10 p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-300">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white"><Heart className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-white">Parent</p>
                        <p className="text-xs font-semibold text-slate-400">Link children, switch quickly, track growth, and manage controls.</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-violet-300" />
                    </button>
                  </div>
                </div>
              )}

              {frontTab === "explore" && (
                <div className="p-5 sm:p-6">
                  <div className="mb-5">
                    <p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">No login required</p>
                    <h2 className="mt-1 text-xl font-black">Look around first.</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => navigate("/tutorial")} className="rounded-2xl border border-white/10 bg-white/[.04] p-4 text-center transition hover:bg-white/[.09]">
                      <PlayCircle className="mx-auto h-5 w-5 text-cyan-300" />
                      <p className="mt-2 text-sm font-black">Tutorials</p>
                    </button>
                    <button type="button" onClick={() => navigate("/leaderboard")} className="rounded-2xl border border-white/10 bg-white/[.04] p-4 text-center transition hover:bg-white/[.09]">
                      <Trophy className="mx-auto h-5 w-5 text-fuchsia-300" />
                      <p className="mt-2 text-sm font-black">Leaderboard</p>
                    </button>
                    <button type="button" onClick={() => navigate("/about")} className="rounded-2xl border border-white/10 bg-white/[.04] p-4 text-center transition hover:bg-white/[.09]">
                      <Heart className="mx-auto h-5 w-5 text-fuchsia-300" />
                      <p className="mt-2 text-sm font-black">About</p>
                    </button>
                    <button type="button" onClick={() => setShowSampleChooser(true)} className="rounded-2xl border border-white/10 bg-white/[.04] p-4 text-center transition hover:bg-white/[.09]">
                      <Sparkles className="mx-auto h-5 w-5 text-violet-300" />
                      <p className="mt-2 text-sm font-black">Sample</p>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

        <section className="mt-5 overflow-hidden rounded-[1.5rem] border border-fuchsia-400/20 bg-gradient-to-r from-[#171229] via-[#181329] to-[#101827] shadow-[0_18px_55px_rgba(0,0,0,.22)]">
          <button
            type="button"
            onClick={() => setDonationOpen(open => !open)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
            aria-expanded={donationOpen}
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-fuchsia-500/10"><Heart className="h-5 w-5 text-fuchsia-300" fill="currentColor" /></div>
            <div className="min-w-0 flex-1">
              <p className="font-black text-white">Support Our Readers</p>
              <p className="truncate text-xs font-semibold text-slate-400">Help keep A.R.I.S.E. Reader growing for students.</p>
            </div>
            <span className="hidden text-xs font-black text-fuchsia-300 sm:block">{donationOpen ? "Close" : "See donation goal"}</span>
            {donationOpen ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
          </button>

          {donationOpen && (
            <div className="border-t border-fuchsia-400/15 bg-fuchsia-500/[.06] p-3 sm:p-4">
              <DonationGoal />
            </div>
          )}
        </section>

        <section className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-[#151326] shadow-[0_18px_55px_rgba(0,0,0,.22)]">
          <div className="border-b border-white/8 px-5 pt-5 sm:px-7 sm:pt-6">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-slate-400">Explore A.R.I.S.E.</p>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-4">
              {featureKeys.map(key => {
                const item = FEATURES[key];
                const Icon = item.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveFeature(key)}
                    className={`flex min-w-max items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-black transition ${activeFeature === key ? "border-violet-200 bg-gradient-to-r from-violet-500/12 via-fuchsia-500/10 to-cyan-400/10 text-violet-200" : "border-white/10 bg-white/[.055] text-slate-400 hover:bg-white/[.04] hover:text-white"}`}
                  >
                    <Icon className="h-4 w-4" /> {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="p-6 sm:p-7">
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-300">{feature.kicker}</p>
              <h2 className="mt-2 max-w-2xl text-2xl font-black tracking-[-.03em] sm:text-3xl">{feature.title}</h2>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-400">{feature.description}</p>

              <div className="mt-5 flex flex-wrap gap-2">
                {feature.bullets.map(bullet => (
                  <span key={bullet} className="rounded-full border border-white/10 bg-white/[.04] px-3 py-2 text-xs font-bold text-slate-300">✓ {bullet}</span>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button onClick={() => navigate(feature.tutorial)} className="rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 font-black text-white shadow-md shadow-violet-500/10 hover:brightness-105">
                  Full tutorial <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                {feature.sample && (
                  <Button variant="outline" onClick={() => setShowSampleChooser(true)} className="rounded-full border-white/10 bg-white/[.055] font-black text-slate-100 hover:bg-white/[.04]">
                    Try sample
                  </Button>
                )}
              </div>
            </div>

            <div className="relative min-h-[220px] overflow-hidden border-t border-white/8 bg-gradient-to-br from-violet-500/14 via-fuchsia-500/10 to-cyan-400/12 p-6 lg:border-l lg:border-t-0">
              <div className="absolute right-4 top-1 text-[110px] font-black leading-none text-white/[.03]">{featureKeys.indexOf(activeFeature) + 1}</div>
              <div className="relative flex h-full flex-col justify-between">
                <div className="grid h-16 w-16 place-items-center rounded-[1.4rem] border border-white/10 bg-[#211d35] shadow-md">
                  <FeatureIcon className="h-8 w-8 text-violet-300" />
                </div>
                <p className="mt-12 text-xs font-black uppercase tracking-[.2em] text-slate-400">Interactive feature preview</p>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-7 flex flex-col gap-3 border-t border-white/10 py-6 text-xs font-semibold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>A.R.I.S.E. Reader · Advocating Resilience, Inclusion, Support & Empowerment</p>
          <div className="flex flex-wrap gap-4">
            <button onClick={() => navigate("/about")} className="hover:text-cyan-200">About</button>
            <button onClick={() => navigate("/tutorial")} className="hover:text-fuchsia-200">Tutorials</button>
            <button onClick={() => navigate("/parent-signup")} className="hover:text-white">Families</button>
          </div>
        </footer>
      </main>

      {showSampleChooser && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-[#06050d]/85 p-4 backdrop-blur-md">
          <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#151326] shadow-2xl">
            <div className="border-b border-white/8 p-6 sm:p-7">
              <p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">Sample Experience</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Choose the account you want to try.</h2>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-400">Sample accounts are sandbox demos and do not enter student leaderboards or competition rankings.</p>
            </div>

            <div className="grid gap-3 p-5 sm:p-6 md:grid-cols-3">
              <button type="button" onClick={() => void loginSample("student")} disabled={!!sampleLoading} className="rounded-2xl border-2 border-white/10 bg-white/[.045] p-5 text-left transition hover:-translate-y-1 hover:border-violet-200 hover:bg-violet-500/10 disabled:opacity-50">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/16"><Users className="h-6 w-6 text-violet-300" /></div>
                <p className="mt-4 font-black">{sampleLoading === "student" ? "Opening…" : "Student"}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">Library, quizzes, Club, arcade, avatars, pets, worlds, rewards, and more.</p>
              </button>

              <button type="button" onClick={() => void loginSample("eye-gaze")} disabled={!!sampleLoading} className="rounded-2xl border-2 border-white/10 bg-white/[.045] p-5 text-left transition hover:-translate-y-1 hover:border-cyan-400/25 hover:bg-cyan-500/10 disabled:opacity-50">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-500/16"><Eye className="h-6 w-6 text-cyan-200" /></div>
                <p className="mt-4 font-black">{sampleLoading === "eye-gaze" ? "Opening…" : "Eye Gazer"}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">My Talker, visual quizzes, games, Life Skills, My World, and progress.</p>
              </button>

              <button type="button" onClick={() => void loginSample("parent")} disabled={!!sampleLoading} className="rounded-2xl border-2 border-white/10 bg-white/[.045] p-5 text-left transition hover:-translate-y-1 hover:border-violet-200 hover:bg-violet-500/10 disabled:opacity-50">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/16"><UserRound className="h-6 w-6 text-violet-200" /></div>
                <p className="mt-4 font-black">{sampleLoading === "parent" ? "Opening…" : "Parent"}</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">Linked children, progress, certificates, family controls, and more.</p>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 bg-[#100e20] p-5 sm:px-6">
              <button type="button" onClick={() => setShowSampleChooser(false)} disabled={!!sampleLoading} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-400 hover:bg-white/[.04] hover:text-white">Cancel</button>
              <button type="button" onClick={() => { setShowSampleChooser(false); navigate("/tutorial"); }} disabled={!!sampleLoading} className="rounded-xl border border-white/10 bg-white px-4 py-2 text-sm font-black text-slate-100 hover:bg-white/[.04]">View tutorials instead</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
