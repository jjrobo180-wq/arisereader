import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight, Award, BookOpen, ChevronDown, ChevronUp, Eye, Gamepad2,
  GraduationCap, Heart, Home, LibraryBig, LogIn, Megaphone, MessageCircle,
  PlayCircle, Search, Sparkles, Trophy, UserRound, Users, Zap,
} from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import DonationGoal from "@/components/DonationGoal";
import { Arise2UpdateButton } from "@/components/Arise2Update";

type SampleType = "student" | "eye-gaze" | "parent";
type FrontTab = "signin" | "create" | "explore";
type FeatureId =
  | "discover" | "quizzes" | "iarise" | "progress" | "live" | "leaderboard"
  | "club" | "board" | "avatar" | "pets" | "theater" | "worlds"
  | "eye" | "talker" | "myworld" | "lifeskills" | "family" | "teacher";

type Feature = {
  label: string;
  category: string;
  kicker: string;
  title: string;
  description: string;
  bullets: string[];
  icon: any;
  tutorial: string;
  sample?: SampleType;
};

const FEATURES: Record<FeatureId, Feature> = {
  discover: { label: "Book Discovery", category: "Reading", kicker: "FIND THE NEXT BOOK", title: "Browse books without digging through a giant list.", description: "Students can search the library, explore recommendations, save books, use the fast FYP-style discovery experience, and find books that fit their interests and reading goals.", bullets: ["Library + search", "FYP-style discovery", "Saved books + recommendations"], icon: Search, tutorial: "/tutorial/student", sample: "student" },
  quizzes: { label: "Book Quizzes", category: "Reading", kicker: "READ + PROVE IT", title: "Comprehension quizzes turn reading into progress.", description: "Students take book quizzes, get results, earn points for passing, and build a record of what they have completed.", bullets: ["Book comprehension quizzes", "Instant results", "Points for passing"], icon: BookOpen, tutorial: "/tutorial/student", sample: "student" },
  iarise: { label: "iARISE", category: "Learning", kicker: "LEARN BEYOND BOOKS", title: "Short learning experiences built into the same platform.", description: "iARISE gives students focused learning topics and quizzes so reading, life knowledge, interests, and skill-building can live together.", bullets: ["Student-friendly topics", "Short learning experiences", "Built-in quizzes"], icon: LibraryBig, tutorial: "/tutorial/student", sample: "student" },
  progress: { label: "Progress + Rewards", category: "Motivation", kicker: "MAKE GROWTH VISIBLE", title: "Students can see that their work is adding up.", description: "Points, certificates, badges, quiz history, rewards, reading growth, and progress tools celebrate effort instead of hiding it in a gradebook.", bullets: ["Certificates + badges", "Points + rewards", "Reading progress"], icon: Award, tutorial: "/tutorial/student", sample: "student" },
  live: { label: "A.R.I.S.E. Live", category: "Classroom", kicker: "LIVE CLASSROOM PLAY", title: "A Kahoot-style live quiz experience built into A.R.I.S.E.", description: "Teachers create or launch a live quiz, students join with a short code, answer together, and watch the live standings update.", bullets: ["Short join codes", "Live questions", "Real-time standings"], icon: Zap, tutorial: "/tutorial/teacher", sample: "student" },
  leaderboard: { label: "Leaderboard", category: "Motivation", kicker: "CELEBRATE READING", title: "Reading points become something students can see and celebrate.", description: "Leaderboards make quiz points and reading progress visible while giving teachers another way to build friendly motivation around reading.", bullets: ["Reading points", "Friendly competition", "Recognition for progress"], icon: Trophy, tutorial: "/tutorial/student", sample: "student" },
  club: { label: "Club A.R.I.S.E.", category: "Play", kicker: "EARN + PLAY", title: "A social 3D arcade students can earn access to.", description: "Club A.R.I.S.E. connects reading rewards to a 3D student world with multiplayer arcade games, safe social features, movement, and teacher-controlled access.", bullets: ["3D arcade", "Multiplayer games", "Teacher-controlled access"], icon: Gamepad2, tutorial: "/tutorial/student", sample: "student" },
  board: { label: "Board Quest", category: "Play", kicker: "GAME NIGHT MEETS LEARNING", title: "A dramatic multiplayer board game inside the platform.", description: "Board Quest uses 3D dice, player order challenges, questions, points, animations, and multiplayer turns to make review feel like a full game.", bullets: ["3D board experience", "Multiplayer turns", "Questions + point events"], icon: Gamepad2, tutorial: "/tutorial/student", sample: "student" },
  avatar: { label: "Avatar World", category: "Rewards", kicker: "BUILD YOUR IDENTITY", title: "Students earn coins and make the experience their own.", description: "Students can choose characters, unlock items, customize their avatar, collect cars and furniture, and use what they earn across A.R.I.S.E. worlds.", bullets: ["Characters + accessories", "Cars + furniture", "Reader Coins"], icon: UserRound, tutorial: "/tutorial/student", sample: "student" },
  pets: { label: "Pets + Homes", category: "Rewards", kicker: "CARE + CREATE", title: "Pets and homes make rewards feel alive.", description: "Students can adopt pets, keep their happiness up with care, choose a home, decorate it, and visit The Block as part of the connected A.R.I.S.E. world.", bullets: ["Pet happiness + care", "Homes + decorating", "The Block neighborhood"], icon: Home, tutorial: "/tutorial/student", sample: "student" },
  theater: { label: "A.R.I.S.E. Theater", category: "Play", kicker: "WATCH TOGETHER", title: "A virtual theater inside the student world.", description: "Students can enter a 3D cinema experience with seats, a lobby, snacks, shared viewing, and administrator-controlled video programming.", bullets: ["3D cinema", "Lobby + seats", "Admin-controlled programming"], icon: PlayCircle, tutorial: "/tutorial/student", sample: "student" },
  worlds: { label: "Worlds", category: "Play", kicker: "ONE CONNECTED EXPERIENCE", title: "Move between A.R.I.S.E. spaces instead of opening disconnected games.", description: "The world portal connects Club A.R.I.S.E., The Block, the theater, Board Quest, and future destinations through one student-facing world experience.", bullets: ["World portal", "Connected destinations", "Expanding experiences"], icon: Sparkles, tutorial: "/tutorial/student", sample: "student" },
  eye: { label: "Eye Gazer", category: "Accessibility", kicker: "ACCESS FOR MORE LEARNERS", title: "A dedicated visual-first experience, not just larger buttons.", description: "Eye Gazer accounts have their own home, visual quizzes, games, learning tools, progress, family controls, and accessible navigation designed around different ways of communicating and learning.", bullets: ["Dedicated Eye Gazer home", "Visual learning", "Accessible games"], icon: Eye, tutorial: "/tutorial/eye-gaze", sample: "eye-gaze" },
  talker: { label: "My Talker AAC", category: "Accessibility", kicker: "COMMUNICATE + LEARN", title: "An AAC-style communication space built into Eye Gazer.", description: "My Talker organizes words by category, speaks words and sentences, supports personalized pictures and phrases, and gives families tools to shape communication around the learner.", bullets: ["Words + sentences", "Custom pictures + phrases", "Family personalization"], icon: MessageCircle, tutorial: "/tutorial/eye-gaze", sample: "eye-gaze" },
  myworld: { label: "My World", category: "Accessibility", kicker: "LEARN FROM REAL LIFE", title: "Turn familiar spaces into interactive learning scenes.", description: "Families can add room or environment images, create tappable labels, use visual prompts, and build learning around the places and objects a student already knows.", bullets: ["Personal room images", "Interactive labels", "I-spy style prompts"], icon: Eye, tutorial: "/tutorial/eye-gaze", sample: "eye-gaze" },
  lifeskills: { label: "Life Skills", category: "Accessibility", kicker: "PRACTICE EVERYDAY SKILLS", title: "Everyday routines get their own learning space.", description: "Eye Gazer Life Skills includes practical supports such as potty coaching, timers, routines, visual steps, and family-guided practice.", bullets: ["Visual routines", "Potty coaching", "Timers + guided practice"], icon: Heart, tutorial: "/tutorial/eye-gaze", sample: "eye-gaze" },
  family: { label: "Family Controls", category: "Families", kicker: "SEE + SUPPORT", title: "One parent account can support multiple children.", description: "Parents can link children, switch between Student and Eye Gazer profiles, review progress and certificates, and manage controls and personalization from one family experience.", bullets: ["Quick child switching", "Progress + certificates", "Student + Eye Gazer controls"], icon: Heart, tutorial: "/tutorial/parent", sample: "parent" },
  teacher: { label: "Teacher Dashboard", category: "Teachers", kicker: "CONTROL + MOTIVATE", title: "Teachers manage the reading experience from one dashboard.", description: "Teachers can review students, create live quizzes, monitor progress, connect families, manage rewards, control game access and club hours, and support both regular and Eye Gazer students.", bullets: ["Student + quiz tools", "Rewards + game controls", "Family connections + progress"], icon: GraduationCap, tutorial: "/tutorial/teacher" },
};

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSampleChooser, setShowSampleChooser] = useState(false);
  const [sampleLoading, setSampleLoading] = useState<SampleType | null>(null);
  const [loginBanner, setLoginBanner] = useState<{ text: string; bgColor: string; textColor: string } | null>(null);
  const [activeFeature, setActiveFeature] = useState<FeatureId>("discover");
  const [frontTab, setFrontTab] = useState<FrontTab>("signin");
  const [donationOpen, setDonationOpen] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/banners/login`).then(res => res.ok ? res.json() : null).then(data => { if (data?.text) setLoginBanner(data); }).catch(() => {});
  }, []);

  const feature = FEATURES[activeFeature];
  const FeatureIcon = feature.icon;
  const featureKeys = useMemo(() => Object.keys(FEATURES) as FeatureId[], []);
  const categories = useMemo(() => Array.from(new Set(featureKeys.map(key => FEATURES[key].category))), [featureKeys]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try { await login(username, password); }
    catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const loginSample = async (type: SampleType) => {
    const usernameByType = { student: "sample", "eye-gaze": "tutorial-eye", parent: "sample-parent" } as const;
    setError(""); setSampleLoading(type);
    try { await login(usernameByType[type], "sample1234"); setShowSampleChooser(false); }
    catch (err: any) { setError(err.message || "Could not open that sample account."); }
    finally { setSampleLoading(null); }
  };

  const chooseFeature = (key: FeatureId) => setActiveFeature(key);

  const openFrontTab = (tab: FrontTab) => {
    setFrontTab(tab);
    requestAnimationFrame(() => document.getElementById("account-panel")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,rgba(124,58,237,.24),transparent_28%),radial-gradient(circle_at_90%_8%,rgba(6,182,212,.16),transparent_26%),radial-gradient(circle_at_52%_45%,rgba(217,70,239,.08),transparent_35%),#0b0a16] text-slate-100">
      <header className="border-b border-white/10 bg-[#0d0b1a]/92 backdrop-blur-xl lg:sticky lg:top-0 lg:z-50">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <button type="button" onClick={() => navigate("/")} className="flex min-w-0 items-center gap-3 text-left">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-cyan-400"><BookOpen className="h-5 w-5" /></div>
            <div><p className="font-black tracking-[.07em]">A.R.I.S.E. <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">Reader</span> <span className="text-[9px] text-violet-300">2.0</span></p><p className="hidden text-[9px] font-bold uppercase tracking-[.2em] text-slate-400 sm:block">Read · Learn · Earn · Play · Grow</p></div>
          </button>
          <nav className="ml-auto hidden gap-1 md:flex"><button onClick={() => navigate("/about")} className="rounded-full px-3 py-2 text-sm font-bold text-slate-400 hover:bg-white/10 hover:text-white">About</button><button onClick={() => navigate("/tutorial")} className="rounded-full px-3 py-2 text-sm font-bold text-slate-400 hover:bg-white/10 hover:text-white">Tutorials</button><button onClick={() => navigate("/leaderboard")} className="rounded-full px-3 py-2 text-sm font-bold text-slate-400 hover:bg-white/10 hover:text-white">Leaderboard</button></nav>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-3 px-4 pt-3 sm:px-6 lg:px-8">
        <Arise2UpdateButton compact />
        <section className="overflow-hidden rounded-[1.4rem] border border-fuchsia-400/20 bg-gradient-to-r from-[#211338] via-[#21152f] to-[#102434]">
          <button type="button" onClick={() => setDonationOpen(v => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-fuchsia-500/10"><Heart className="h-5 w-5 text-fuchsia-300" fill="currentColor" /></div><div className="min-w-0 flex-1"><p className="font-black">Support Our Readers</p><p className="truncate text-xs font-semibold text-slate-400">Help fund books, rewards, and reading experiences for students.</p></div>{donationOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          {donationOpen && <div className="border-t border-white/10 p-3 sm:p-4"><DonationGoal /></div>}
        </section>
        {loginBanner && <div className="flex gap-3 rounded-2xl p-3 text-sm font-bold" style={{ background: loginBanner.bgColor, color: loginBanner.textColor }}><Megaphone className="h-4 w-4 shrink-0" />{loginBanner.text}</div>}
      </div>

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)] lg:items-start">
          <div className="order-2 space-y-5 lg:order-1">
            <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#151326] p-6 shadow-2xl sm:p-8 lg:p-10">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400" />
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-violet-200"><Sparkles className="h-3.5 w-3.5" /> A.R.I.S.E. Reader 2.0</div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[.98] tracking-[-.05em] sm:text-5xl lg:text-6xl">Read. Learn. Earn.<span className="mt-1 block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">Then keep exploring.</span></h1>
              <p className="mt-5 max-w-3xl text-base font-semibold leading-7 text-slate-400">A reading platform that connects books and quizzes to live classroom games, rewards, accessible learning, avatars, pets, families, progress, and student worlds.</p>
              <div className="mt-7 flex flex-wrap gap-3"><Button onClick={() => openFrontTab("create")} className="h-11 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-5 font-black">Create an account <ArrowRight className="ml-2 h-4 w-4" /></Button><Button variant="outline" onClick={() => setShowSampleChooser(true)} className="h-11 rounded-full border-white/10 bg-white/5 px-5 font-black text-white"><PlayCircle className="mr-2 h-4 w-4" /> Try a sample</Button></div>
            </section>

            <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#151326] shadow-xl">
              <div className="px-5 pb-3 pt-6 sm:px-7 sm:pt-8">
                <p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-300">Explore A.R.I.S.E.</p>
                <h2 className="mt-1 max-w-2xl text-3xl font-black tracking-[-.035em] sm:text-4xl">One platform. A lot more inside.</h2>
                <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-400">Choose a feature and the preview changes right here — no jumping to the bottom of the page.</p>
              </div>

              <div className="px-5 pb-5 sm:px-7">
                <div key={activeFeature} className="relative min-h-[310px] overflow-hidden rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_82%_18%,rgba(34,211,238,.18),transparent_30%),radial-gradient(circle_at_15%_85%,rgba(168,85,247,.2),transparent_32%),#0f0d1d] p-6 shadow-2xl sm:p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />
                  <div className="relative grid gap-6 md:grid-cols-[1fr_170px] md:items-center">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-cyan-200"><FeatureIcon className="h-3.5 w-3.5" />{feature.category}</div>
                      <p className="mt-5 text-[10px] font-black uppercase tracking-[.2em] text-violet-300">{feature.kicker}</p>
                      <h3 className="mt-2 max-w-2xl text-2xl font-black leading-tight tracking-[-.03em] sm:text-3xl">{feature.title}</h3>
                      <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-400">{feature.description}</p>
                      <div className="mt-5 flex flex-wrap gap-2">{feature.bullets.map(item => <span key={item} className="rounded-full border border-white/8 bg-white/[.06] px-3 py-1.5 text-xs font-bold text-slate-300">{item}</span>)}</div>
                      <div className="mt-6 flex flex-wrap gap-2"><Button size="sm" onClick={() => navigate(feature.tutorial)} className="rounded-full arise-gradient-button px-4 font-black">See tutorial <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Button>{feature.sample && <Button size="sm" variant="outline" onClick={() => setShowSampleChooser(true)} className="rounded-full border-white/10 bg-white/5 px-4 font-black text-white">Try this experience</Button>}</div>
                    </div>
                    <div className="hidden md:grid place-items-center">
                      <div className="relative grid h-36 w-36 place-items-center rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-violet-600/80 via-fuchsia-500/75 to-cyan-400/70 shadow-[0_25px_80px_rgba(124,58,237,.3)] transition duration-500 hover:scale-105 hover:rotate-2">
                        <div className="absolute inset-3 rounded-[2rem] border border-white/20" />
                        <FeatureIcon className="h-14 w-14 drop-shadow-xl" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 bg-[#100e20]/80 py-6">
                <div className="mb-4 flex items-center justify-between gap-3 px-5 sm:px-7"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-slate-500">Feature gallery</p><p className="mt-1 text-sm font-bold text-slate-300">Swipe on mobile. Tap a card to preview it.</p></div><span className="hidden text-xs font-semibold text-slate-500 sm:block">← swipe / scroll →</span></div>
                <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3 sm:px-7 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {featureKeys.map(key => { const item = FEATURES[key]; const Icon = item.icon; const active = activeFeature === key; return <button key={key} type="button" onClick={() => chooseFeature(key)} className={`group relative min-h-[150px] w-[72%] max-w-[245px] shrink-0 snap-start overflow-hidden rounded-[1.5rem] border p-4 text-left transition-all duration-300 sm:w-[220px] ${active ? "-translate-y-1 border-cyan-300/45 bg-gradient-to-br from-violet-500/25 via-fuchsia-500/15 to-cyan-400/15 shadow-[0_16px_45px_rgba(34,211,238,.12)]" : "border-white/10 bg-white/[.035] hover:-translate-y-1 hover:border-white/20 hover:bg-white/[.07]"}`}><div className={`grid h-10 w-10 place-items-center rounded-2xl transition duration-300 ${active ? "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 text-white" : "bg-white/[.07] text-slate-300 group-hover:scale-105 group-hover:text-white"}`}><Icon className="h-5 w-5" /></div><p className="mt-5 text-[9px] font-black uppercase tracking-[.16em] text-slate-500">{item.category}</p><p className="mt-1 font-black leading-tight text-white">{item.label}</p><ArrowRight className={`absolute bottom-4 right-4 h-4 w-4 transition ${active ? "translate-x-0 text-cyan-300" : "-translate-x-1 text-slate-600 group-hover:translate-x-0 group-hover:text-cyan-300"}`} /></button>; })}
                </div>
                <div className="mt-3 flex flex-wrap gap-2 px-5 sm:px-7">{categories.map(category => <button key={category} type="button" onClick={() => { const first = featureKeys.find(key => FEATURES[key].category === category); if (first) chooseFeature(first); }} className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-[.12em] text-slate-400 transition hover:border-cyan-300/25 hover:bg-cyan-400/10 hover:text-cyan-200">{category}</button>)}</div>
              </div>
            </section>
          </div>

          <aside id="account-panel" className="order-1 scroll-mt-24 lg:order-2 lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#151326] shadow-2xl">
              <div className="grid grid-cols-3 gap-1 border-b border-white/10 bg-[#100e20] p-2">{([ ["signin","Sign in",LogIn], ["create","Create",Users], ["explore","Explore",Sparkles] ] as const).map(([key,label,Icon]) => <button key={key} type="button" onClick={() => setFrontTab(key)} className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-black ${frontTab===key ? "bg-white/10 text-white ring-1 ring-white/10" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</button>)}</div>

              {frontTab === "signin" && <div className="p-5 sm:p-6"><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300">Welcome back</p><h2 className="mt-1 text-xl font-black">Sign in to A.R.I.S.E.</h2><form onSubmit={handleSubmit} className="mt-5 space-y-4"><div className="space-y-2"><Label htmlFor="username">Username</Label><Input id="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="Your username" required className="h-12 border-white/10 bg-[#0f0d1d] text-white" /></div><div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required className="h-12 border-white/10 bg-[#0f0d1d] text-white" /></div>{error && <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm font-bold text-red-200">{error}</div>}<Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 font-black">{loading ? "Logging in…" : "Log in"}</Button></form><button type="button" onClick={() => setShowSampleChooser(true)} className="mt-3 min-h-11 w-full rounded-xl border border-violet-300/20 bg-violet-500/10 text-sm font-black text-violet-200"><Sparkles className="mr-2 inline h-4 w-4" />Try sample account</button><button type="button" onClick={() => openFrontTab("create")} className="mt-4 w-full text-center text-sm font-bold text-slate-400 hover:text-white">New here? <span className="text-violet-300">Create an account</span></button></div>}

              {frontTab === "create" && <div className="p-5 sm:p-6"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Choose your account</p><h2 className="mt-1 text-xl font-black">Get started with A.R.I.S.E.</h2><div className="mt-5 space-y-3">
                <button type="button" onClick={() => navigate("/register")} className="flex w-full items-center gap-3 rounded-2xl border border-violet-300/20 bg-violet-500/8 p-4 text-left hover:bg-violet-500/15"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-500"><SchoolIcon /></div><div className="flex-1"><p className="font-black">School Student</p><p className="text-xs text-slate-400">Connect to a school and teacher.</p></div><ArrowRight className="h-4 w-4" /></button>
                <button type="button" onClick={() => navigate("/register?independent=1")} className="flex w-full items-center gap-3 rounded-2xl border border-cyan-300/25 bg-cyan-500/8 p-4 text-left hover:bg-cyan-500/15"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-400 text-slate-950"><UserRound className="h-5 w-5" /></div><div className="flex-1"><p className="font-black">Independent Student</p><p className="text-xs text-slate-300">A separate signup — no school checkbox to remember.</p></div><ArrowRight className="h-4 w-4 text-cyan-300" /></button>
                <button type="button" onClick={() => navigate("/teacher-signup")} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10"><GraduationCap className="h-6 w-6 text-fuchsia-300" /><div className="flex-1"><p className="font-black">Teacher</p><p className="text-xs text-slate-400">Students, live games, rewards, controls.</p></div><ArrowRight className="h-4 w-4" /></button>
                <button type="button" onClick={() => navigate("/parent-signup")} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10"><Heart className="h-6 w-6 text-fuchsia-300" /><div className="flex-1"><p className="font-black">Parent / Guardian</p><p className="text-xs text-slate-400">Link children, progress, controls.</p></div><ArrowRight className="h-4 w-4" /></button>
              </div></div>}

              {frontTab === "explore" && <div className="p-5 sm:p-6"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">No login required</p><h2 className="mt-1 text-xl font-black">Look around first.</h2><div className="mt-5 grid grid-cols-2 gap-3"><ExploreButton icon={PlayCircle} label="Tutorials" onClick={() => navigate("/tutorial")} /><ExploreButton icon={Trophy} label="Leaderboard" onClick={() => navigate("/leaderboard")} /><ExploreButton icon={Heart} label="About" onClick={() => navigate("/about")} /><ExploreButton icon={Sparkles} label="Sample" onClick={() => setShowSampleChooser(true)} /></div></div>}
            </div>
          </aside>
        </div>

        <section className="mt-5 flex flex-col gap-4 rounded-[1.7rem] border border-white/10 bg-gradient-to-r from-[#17142a] via-[#1b1530] to-[#102331] p-5 sm:flex-row sm:items-center sm:p-6"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-fuchsia-500/10"><Heart className="h-5 w-5 text-fuchsia-300" /></div><div className="flex-1"><p className="text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-300">The story behind A.R.I.S.E.</p><h2 className="mt-1 text-xl font-black">About A.R.I.S.E. Reader</h2><p className="mt-1 text-sm font-semibold text-slate-400">Meet Mr. J, see the classroom story behind the platform, and learn what A.R.I.S.E. stands for.</p></div><Button onClick={() => navigate("/about")} className="rounded-full arise-gradient-button px-5 font-black">About A.R.I.S.E. <ArrowRight className="ml-2 h-4 w-4" /></Button></section>
      </main>

      {showSampleChooser && <div className="fixed inset-0 z-[250] flex items-center justify-center bg-[#06050d]/90 p-4 backdrop-blur-md"><div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#151326] shadow-2xl"><div className="border-b border-white/10 p-6"><p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">Sample Experience</p><h2 className="mt-1 text-2xl font-black">Choose exactly what you want to preview.</h2><p className="mt-2 text-sm font-semibold text-slate-400">The regular Student sample is now strictly non-Eye-Gazer. Eye Gazer has its own separate sample.</p></div><div className="grid gap-3 p-5 md:grid-cols-3"><SampleButton icon={Users} title={sampleLoading==="student"?"Opening…":"Student"} text="Regular student: books, quizzes, rewards, Club, avatars, pets, homes and worlds." onClick={() => void loginSample("student")} disabled={!!sampleLoading} /><SampleButton icon={Eye} title={sampleLoading==="eye-gaze"?"Opening…":"Eye Gazer"} text="Accessible sample: My Talker, visual learning, games, My World and Life Skills." onClick={() => void loginSample("eye-gaze")} disabled={!!sampleLoading} /><SampleButton icon={UserRound} title={sampleLoading==="parent"?"Opening…":"Parent"} text="Family sample: linked children, progress, certificates and controls." onClick={() => void loginSample("parent")} disabled={!!sampleLoading} /></div><div className="border-t border-white/10 p-5"><button type="button" onClick={() => setShowSampleChooser(false)} className="rounded-xl px-4 py-2 text-sm font-black text-slate-300 hover:bg-white/10">Cancel</button></div></div></div>}
    </div>
  );
}

function SchoolIcon() { return <Users className="h-5 w-5" />; }
function ExploreButton({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center hover:bg-white/10"><Icon className="mx-auto h-5 w-5 text-cyan-300" /><p className="mt-2 text-sm font-black">{label}</p></button>; }
function SampleButton({ icon: Icon, title, text, onClick, disabled }: { icon: any; title: string; text: string; onClick: () => void; disabled: boolean }) { return <button type="button" onClick={onClick} disabled={disabled} className="rounded-2xl border-2 border-white/10 bg-white/5 p-5 text-left transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/10 disabled:opacity-50"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15"><Icon className="h-6 w-6 text-cyan-200" /></div><p className="mt-4 font-black">{title}</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-400">{text}</p></button>; }