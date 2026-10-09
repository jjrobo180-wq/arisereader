import BannerTap from "@/components/BannerTap";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import HalloreadAtmosphere from "@/components/HalloreadAtmosphere";
import { useLocation } from "wouter";
import { TEACHER_CONFIRM_KEY } from "@shared/schoolEmail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight, Award, BookOpen, Calculator, ChevronDown, ChevronUp, Eye, Gamepad2,
  GraduationCap, Heart, Home, LibraryBig, LogIn, Megaphone, MessageCircle,
  PlayCircle, Search, ShieldCheck, Sparkles, Trophy, UserRound, Users, X, Zap,
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
  label: string; category: string; kicker: string; title: string; description: string;
  bullets: string[]; icon: any; tutorial: string; sample?: SampleType;
};

const FEATURES: Record<FeatureId, Feature> = {
  discover: { label:"Book Discovery", category:"Reading", kicker:"FIND THE NEXT BOOK", title:"Browse books without digging through a giant list.", description:"Students can search the library, explore recommendations, save books, use the fast FYP-style discovery experience, and find books that fit their interests and reading goals.", bullets:["Library + search","FYP-style discovery","Saved books + recommendations"], icon:Search, tutorial:"/tutorial/student", sample:"student" },
  quizzes: { label:"Book Quizzes", category:"Reading", kicker:"READ + PROVE IT", title:"Comprehension quizzes turn reading into progress.", description:"Students take book quizzes, get results, earn points for passing, and build a record of what they have completed.", bullets:["Book comprehension quizzes","Instant results","Points for passing"], icon:BookOpen, tutorial:"/tutorial/student", sample:"student" },
  iarise: { label:"iARISE", category:"Learning", kicker:"LEARN BEYOND BOOKS", title:"Short learning experiences built into the same platform.", description:"iARISE gives students focused learning topics and quizzes so reading, life knowledge, interests, and skill-building can live together.", bullets:["Student-friendly topics","Short learning experiences","Built-in quizzes"], icon:LibraryBig, tutorial:"/tutorial/student", sample:"student" },
  progress: { label:"Progress + Rewards", category:"Motivation", kicker:"MAKE GROWTH VISIBLE", title:"Students can see that their work is adding up.", description:"Points, certificates, badges, quiz history, rewards, reading growth, and progress tools celebrate effort instead of hiding it in a gradebook.", bullets:["Certificates + badges","Points + rewards","Reading progress"], icon:Award, tutorial:"/tutorial/student", sample:"student" },
  live: { label:"A.R.I.S.E. Live", category:"Classroom", kicker:"LIVE CLASSROOM PLAY", title:"A Kahoot-style live quiz experience built into A.R.I.S.E.", description:"Teachers create or launch a live quiz, students join with a short code, answer together, and watch the live standings update.", bullets:["Short join codes","Live questions","Real-time standings"], icon:Zap, tutorial:"/tutorial/teacher", sample:"student" },
  leaderboard: { label:"Leaderboard", category:"Motivation", kicker:"CELEBRATE READING", title:"Reading points become something students can see and celebrate.", description:"Leaderboards make quiz points and reading progress visible while giving teachers another way to build friendly motivation around reading.", bullets:["Reading points","Friendly competition","Recognition for progress"], icon:Trophy, tutorial:"/tutorial/student", sample:"student" },
  club: { label:"Club A.R.I.S.E.", category:"Play", kicker:"EARN + PLAY", title:"A social 3D arcade students can earn access to.", description:"Club A.R.I.S.E. connects reading rewards to a 3D student world with multiplayer arcade games, safe social features, movement, and teacher-controlled access.", bullets:["3D arcade","Multiplayer games","Teacher-controlled access"], icon:Gamepad2, tutorial:"/tutorial/student", sample:"student" },
  board: { label:"Board Quest", category:"Play", kicker:"GAME NIGHT MEETS LEARNING", title:"A dramatic multiplayer board game inside the platform.", description:"Board Quest uses 3D dice, player order challenges, questions, points, animations, and multiplayer turns to make review feel like a full game.", bullets:["3D board experience","Multiplayer turns","Questions + point events"], icon:Gamepad2, tutorial:"/tutorial/student", sample:"student" },
  avatar: { label:"Avatar World", category:"Rewards", kicker:"BUILD YOUR IDENTITY", title:"Students earn coins and make the experience their own.", description:"Students can choose characters, unlock items, customize their avatar, collect cars and furniture, and use what they earn across A.R.I.S.E. worlds.", bullets:["Characters + accessories","Cars + furniture","Reader Coins"], icon:UserRound, tutorial:"/tutorial/student", sample:"student" },
  pets: { label:"Pets + Homes", category:"Rewards", kicker:"CARE + CREATE", title:"Pets and homes make rewards feel alive.", description:"Students can adopt pets, keep their happiness up with care, choose a home, decorate it, and visit The Block as part of the connected A.R.I.S.E. world.", bullets:["Pet happiness + care","Homes + decorating","The Block neighborhood"], icon:Home, tutorial:"/tutorial/student", sample:"student" },
  theater: { label:"A.R.I.S.E. Theater", category:"Play", kicker:"WATCH TOGETHER", title:"A virtual theater inside the student world.", description:"Students can enter a 3D cinema experience with seats, a lobby, snacks, shared viewing, and administrator-controlled video programming.", bullets:["3D cinema","Lobby + seats","Admin-controlled programming"], icon:PlayCircle, tutorial:"/tutorial/student", sample:"student" },
  worlds: { label:"Worlds", category:"Play", kicker:"ONE CONNECTED EXPERIENCE", title:"Move between A.R.I.S.E. spaces instead of opening disconnected games.", description:"The world portal connects Club A.R.I.S.E., The Block, the theater, Board Quest, and future destinations through one student-facing world experience.", bullets:["World portal","Connected destinations","Expanding experiences"], icon:Sparkles, tutorial:"/tutorial/student", sample:"student" },
  eye: { label:"Eye Gazer", category:"Accessibility", kicker:"ACCESS FOR MORE LEARNERS", title:"A dedicated visual-first experience, not just larger buttons.", description:"Eye Gazer accounts have their own home, visual quizzes, games, learning tools, progress, family controls, and accessible navigation designed around different ways of communicating and learning.", bullets:["Dedicated Eye Gazer home","Visual learning","Accessible games"], icon:Eye, tutorial:"/tutorial/eye-gaze", sample:"eye-gaze" },
  talker: { label:"My Talker AAC", category:"Accessibility", kicker:"COMMUNICATE + LEARN", title:"An AAC-style communication space built into Eye Gazer.", description:"My Talker organizes words by category, speaks words and sentences, supports personalized pictures and phrases, and gives families tools to shape communication around the learner.", bullets:["Words + sentences","Custom pictures + phrases","Family personalization"], icon:MessageCircle, tutorial:"/tutorial/eye-gaze", sample:"eye-gaze" },
  myworld: { label:"My World", category:"Accessibility", kicker:"LEARN FROM REAL LIFE", title:"Turn familiar spaces into interactive learning scenes.", description:"Families can add room or environment images, create tappable labels, use visual prompts, and build learning around the places and objects a student already knows.", bullets:["Personal room images","Interactive labels","I-spy style prompts"], icon:Eye, tutorial:"/tutorial/eye-gaze", sample:"eye-gaze" },
  lifeskills: { label:"Life Skills", category:"Accessibility", kicker:"PRACTICE EVERYDAY SKILLS", title:"Everyday routines get their own learning space.", description:"Eye Gazer Life Skills includes practical supports such as potty coaching, timers, routines, visual steps, and family-guided practice.", bullets:["Visual routines","Potty coaching","Timers + guided practice"], icon:Heart, tutorial:"/tutorial/eye-gaze", sample:"eye-gaze" },
  family: { label:"Family Controls", category:"Families", kicker:"SEE + SUPPORT", title:"One parent account can support multiple children.", description:"Parents can link children, switch between Student and Eye Gazer profiles, review progress and certificates, and manage controls and personalization from one family experience.", bullets:["Quick child switching","Progress + certificates","Student + Eye Gazer controls"], icon:Heart, tutorial:"/tutorial/parent", sample:"parent" },
  teacher: { label:"Teacher Dashboard", category:"Teachers", kicker:"CONTROL + MOTIVATE", title:"Teachers manage the reading experience from one dashboard.", description:"Teachers can review students, create live quizzes, monitor progress, connect families, manage rewards, control game access and club hours, and support both regular and Eye Gazer students.", bullets:["Student + quiz tools","Rewards + game controls","Family connections + progress"], icon:GraduationCap, tutorial:"/tutorial/teacher" },
};

export default function Login() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [showSampleChooser,setShowSampleChooser]=useState(false);
  const [sampleLoading,setSampleLoading]=useState<SampleType|null>(null);
  const [loginBanner,setLoginBanner]=useState<{text:string;bgColor:string;textColor:string;link?:string}|null>(null);
  const [frontTab,setFrontTab]=useState<FrontTab>(()=>/[?&]tab=create\b/.test(window.location.hash)||/[?&]tab=create\b/.test(window.location.search)?"create":"signin");
  const [donationOpen,setDonationOpen]=useState(false);
  const [selectedFeature,setSelectedFeature]=useState<FeatureId|null>(null);

  useEffect(()=>{fetch(`${API_BASE}/api/banners/login`).then(r=>r.ok?r.json():null).then(d=>{if(d?.text)setLoginBanner(d);}).catch(()=>{});},[]);
  useEffect(()=>{
    if(!selectedFeature)return;
    const old=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return()=>{document.body.style.overflow=old;};
  },[selectedFeature]);

  const featureKeys=useMemo(()=>Object.keys(FEATURES) as FeatureId[],[]);
  const categories=useMemo(()=>Array.from(new Set(featureKeys.map(k=>FEATURES[k].category))),[featureKeys]);

  const handleSubmit=async(e:React.FormEvent)=>{e.preventDefault();setError("");setLoading(true);try{await login(username,password);}catch(err:any){if(err?.confirmEmail){try{sessionStorage.setItem(TEACHER_CONFIRM_KEY,err.username||username);}catch{}navigate("/teacher-signup");return;}setError(err.message);}finally{setLoading(false);}};
  const loginSample=async(type:SampleType)=>{const names={student:"sample","eye-gaze":"tutorial-eye",parent:"sample-parent"} as const;setError("");setSampleLoading(type);try{await login(names[type],"sample1234");setShowSampleChooser(false);}catch(err:any){setError(err.message||"Could not open that sample account.");}finally{setSampleLoading(null);}};
  const openFrontTab=(tab:FrontTab)=>{setFrontTab(tab);requestAnimationFrame(()=>document.getElementById("account-panel")?.scrollIntoView({behavior:"smooth",block:"center"}));};
  const scrollToFeatures=()=>document.getElementById("features")?.scrollIntoView({behavior:"smooth",block:"start"});

  return <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[radial-gradient(circle_at_10%_0%,rgba(124,58,237,.24),transparent_28%),radial-gradient(circle_at_90%_8%,rgba(6,182,212,.16),transparent_26%),radial-gradient(circle_at_52%_45%,rgba(217,70,239,.08),transparent_35%),#0b0a16] text-slate-100">
    <HalloreadAtmosphere />
    <header className="border-b border-white/10 bg-[#0d0b1a]/92 backdrop-blur-xl lg:sticky lg:top-0 lg:z-50"><div className="mx-auto flex w-full max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8"><button type="button" onClick={()=>navigate("/")} className="flex min-w-0 items-center gap-3 text-left"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-cyan-400"><BookOpen className="h-5 w-5"/></div><div className="min-w-0"><p className="truncate font-black tracking-[.07em]">A.R.I.S.E. <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">Reader</span> <span className="text-[9px] text-violet-300">2.0</span></p><p className="hidden text-[9px] font-bold uppercase tracking-[.2em] text-slate-400 sm:block">Read · Learn · Earn · Play · Grow</p></div></button><nav className="ml-auto hidden gap-1 md:flex"><button onClick={()=>navigate("/about")} className="rounded-full px-3 py-2 text-sm font-bold text-slate-400 hover:bg-white/10 hover:text-white">About</button><button onClick={()=>navigate("/pricing")} className="rounded-full px-3 py-2 text-sm font-bold text-slate-400 hover:bg-white/10 hover:text-white">Pricing</button><button onClick={()=>navigate("/teacher-hub")} className="rounded-full px-3 py-2 text-sm font-bold text-slate-400 hover:bg-white/10 hover:text-white">Teacher Hub</button><button onClick={()=>navigate("/tutorial")} className="rounded-full px-3 py-2 text-sm font-bold text-slate-400 hover:bg-white/10 hover:text-white">Tutorials</button><button onClick={()=>navigate("/leaderboard")} className="rounded-full px-3 py-2 text-sm font-bold text-slate-400 hover:bg-white/10 hover:text-white">Leaderboard</button><a href="/social/" className="rounded-full px-3 py-2 text-sm font-bold text-slate-400 hover:bg-white/10 hover:text-white">Arise Social</a></nav></div></header>

    <div className="mx-auto w-full max-w-[1500px] space-y-3 px-4 pt-3 sm:px-6 lg:px-8"><Arise2UpdateButton compact/><section className="overflow-hidden rounded-[1.4rem] border border-fuchsia-400/20 bg-gradient-to-r from-[#211338] via-[#21152f] to-[#102434]"><button type="button" onClick={()=>setDonationOpen(v=>!v)} className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-fuchsia-500/10"><Heart className="h-5 w-5 text-fuchsia-300" fill="currentColor"/></div><div className="min-w-0 flex-1"><p className="font-black">Support Our Readers</p><p className="truncate text-xs font-semibold text-slate-400">Help fund books, rewards, and reading experiences for students.</p></div>{donationOpen?<ChevronUp className="h-5 w-5 shrink-0"/>:<ChevronDown className="h-5 w-5 shrink-0"/>}</button>{donationOpen&&<div className="border-t border-white/10 p-3 sm:p-4"><DonationGoal/></div>}</section>{loginBanner&&<BannerTap link={loginBanner.link} className="flex gap-3 rounded-2xl p-3 text-sm font-bold" style={{background:loginBanner.bgColor,color:loginBanner.textColor}}><Megaphone className="h-4 w-4 shrink-0"/><span className="min-w-0">{loginBanner.text}</span></BannerTap>}</div>

    <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8"><div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)] lg:items-start"><div className="order-3 min-w-0 space-y-5 lg:order-1">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#151326] p-5 shadow-2xl sm:p-8 lg:p-10"><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400"/><div className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-violet-200"><Sparkles className="h-3.5 w-3.5"/> A.R.I.S.E. Reader 2.0</div><h1 className="mt-5 max-w-4xl text-4xl font-black leading-[.98] tracking-[-.05em] sm:text-5xl lg:text-6xl">Read. Learn. Earn.<span className="mt-1 block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">Then keep exploring.</span></h1><p className="mt-5 max-w-3xl text-base font-semibold leading-7 text-slate-400">A reading platform that connects books and quizzes to live classroom games, rewards, accessible learning, avatars, pets, families, progress, and student worlds.</p><div className="mt-7 flex flex-wrap gap-3"><Button onClick={()=>openFrontTab("create")} className="h-11 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 px-5 font-black">Create an account <ArrowRight className="ml-2 h-4 w-4"/></Button><Button variant="outline" onClick={()=>setShowSampleChooser(true)} className="h-11 rounded-full border-white/10 bg-white/5 px-5 font-black text-white"><PlayCircle className="mr-2 h-4 w-4"/> Try a sample</Button><Button variant="outline" onClick={scrollToFeatures} className="h-11 rounded-full border-cyan-300/20 bg-cyan-400/10 px-5 font-black text-cyan-100"><Sparkles className="mr-2 h-4 w-4"/> Explore features <ChevronDown className="ml-2 h-4 w-4"/></Button></div></section>

      <div className="hidden lg:block"><ResearchEvidenceSection sectionId="research-desktop" /></div>

      <section id="features" className="scroll-mt-20 overflow-hidden rounded-[2rem] border border-white/10 bg-[#151326] shadow-xl">
        <div className="space-y-9 p-4 sm:p-7">{categories.map(category=><div key={category}><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-300">{category}</p><h3 className="mt-1 text-xl font-black">{category==="Reading"?"Start with a story.":category==="Play"?"Earn the fun.":category==="Accessibility"?"Built for more ways to learn.":category==="Rewards"?"Make progress feel real.":category==="Teachers"?"Tools for the classroom.":category==="Families"?"Stay connected to growth.":category==="Classroom"?"Bring everyone into the game.":category==="Motivation"?"Celebrate the work.":"Keep learning."}</h3></div></div><div className="grid gap-3 sm:grid-cols-2">{featureKeys.filter(k=>FEATURES[k].category===category).map(key=>{const item=FEATURES[key];const Icon=item.icon;return <button key={key} type="button" onClick={()=>setSelectedFeature(key)} className="group relative min-w-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.025))] p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-cyan-300/25 hover:bg-white/[.075] focus:outline-none focus:ring-2 focus:ring-cyan-300/40"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-cyan-400/20 text-cyan-100 ring-1 ring-white/10 transition group-hover:scale-105"><Icon className="h-6 w-6"/></div><div className="min-w-0 flex-1"><p className="text-[9px] font-black uppercase tracking-[.17em] text-slate-500">{item.kicker}</p><h4 className="mt-1 text-lg font-black leading-tight text-white">{item.label}</h4><p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-400">{item.title}</p></div><ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-1 group-hover:text-cyan-300"/></div><div className="mt-4 flex flex-wrap gap-1.5">{item.bullets.slice(0,2).map(b=><span key={b} className="rounded-full bg-white/[.05] px-2.5 py-1 text-[10px] font-bold text-slate-400">{b}</span>)}</div><p className="mt-4 text-xs font-black text-cyan-300">View details <ArrowRight className="ml-1 inline h-3.5 w-3.5"/></p></button>;})}</div></div>)}</div>
      </section>
    </div>

    <aside id="account-panel" className="order-1 min-w-0 scroll-mt-24 lg:order-2 lg:sticky lg:top-24"><div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#151326] shadow-2xl"><div className="grid grid-cols-3 gap-1 border-b border-white/10 bg-[#100e20] p-2">{([["signin","Sign in",LogIn],["create","Create",Users],["explore","Explore",Sparkles]] as const).map(([key,label,Icon])=><button key={key} type="button" onClick={()=>setFrontTab(key)} className={`flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-black ${frontTab===key?"bg-white/10 text-white ring-1 ring-white/10":"text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon className="h-4 w-4 shrink-0"/><span className="truncate">{label}</span></button>)}</div>
      {frontTab==="signin"&&<div className="p-5 sm:p-6"><p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-300">Welcome back</p><h2 className="mt-1 text-xl font-black">Sign in to A.R.I.S.E.</h2><form onSubmit={handleSubmit} className="mt-5 space-y-4"><div className="space-y-2"><Label htmlFor="username">Username</Label><Input id="username" value={username} onChange={e=>setUsername(e.target.value)} placeholder="Your username" required className="h-12 w-full border-white/10 bg-[#0f0d1d] text-white"/></div><div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" required className="h-12 w-full border-white/10 bg-[#0f0d1d] text-white"/></div>{error&&<div className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm font-bold text-red-200">{error}</div>}<Button type="submit" disabled={loading} className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 font-black">{loading?"Logging in…":"Log in"}</Button></form><button type="button" onClick={()=>setShowSampleChooser(true)} className="mt-3 min-h-11 w-full rounded-xl border border-violet-300/20 bg-violet-500/10 text-sm font-black text-violet-200"><Sparkles className="mr-2 inline h-4 w-4"/>Try sample account</button><button type="button" onClick={()=>openFrontTab("create")} className="mt-4 w-full text-center text-sm font-bold text-slate-400 hover:text-white">New here? <span className="text-violet-300">Create an account</span></button></div>}
      {frontTab==="create"&&<div className="p-5 sm:p-6"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">Choose your account</p><h2 className="mt-1 text-xl font-black">Get started with A.R.I.S.E.</h2><div className="mt-5 space-y-3"><AccountChoice icon={Users} title="School Student" text="Connect to a school and teacher." onClick={()=>navigate("/register")} tone="violet"/><AccountChoice icon={UserRound} title="Independent Student" text="A separate signup — no school checkbox to remember." onClick={()=>navigate("/register-independent")} tone="cyan"/><AccountChoice icon={GraduationCap} title="Teacher" text="Students, live games, rewards, controls." onClick={()=>navigate("/teacher-signup")}/><AccountChoice icon={Heart} title="Parent / Guardian" text="Link children, progress, controls." onClick={()=>navigate("/parent-signup")}/></div></div>}
      {frontTab==="explore"&&<div className="p-5 sm:p-6"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-400">No login required</p><h2 className="mt-1 text-xl font-black">Look around first.</h2><div className="mt-5 grid grid-cols-2 gap-3"><ExploreButton icon={PlayCircle} label="Tutorials" onClick={()=>navigate("/tutorial")}/><ExploreButton icon={Trophy} label="Leaderboard" onClick={()=>navigate("/leaderboard")}/><ExploreButton icon={Heart} label="About" onClick={()=>navigate("/about")}/><ExploreButton icon={Award} label="Pricing" onClick={()=>navigate("/pricing")}/><ExploreButton icon={Sparkles} label="Sample" onClick={()=>setShowSampleChooser(true)}/><ExploreButton icon={Calculator} label="Arise Math" onClick={()=>{window.location.href="/math/";}}/></div></div>}
    </div></aside>

    <div className="order-2 lg:hidden"><ResearchEvidenceSection sectionId="research-mobile" /></div></div>

    <section className="mt-5 flex flex-col gap-4 rounded-[1.7rem] border border-white/10 bg-gradient-to-r from-[#17142a] via-[#1b1530] to-[#102331] p-5 sm:flex-row sm:items-center sm:p-6"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-fuchsia-500/10"><Heart className="h-5 w-5 text-fuchsia-300"/></div><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-300">The story behind A.R.I.S.E.</p><h2 className="mt-1 text-xl font-black">About A.R.I.S.E. Reader</h2><p className="mt-1 text-sm font-semibold text-slate-400">Meet Mr. J, see the classroom story behind the platform, and learn what A.R.I.S.E. stands for.</p></div><Button onClick={()=>navigate("/about")} className="rounded-full arise-gradient-button px-5 font-black">About A.R.I.S.E. <ArrowRight className="ml-2 h-4 w-4"/></Button></section>
    </main>

    {selectedFeature&&<FeatureDetails feature={FEATURES[selectedFeature]} onClose={()=>setSelectedFeature(null)} onTutorial={()=>{const path=FEATURES[selectedFeature].tutorial;setSelectedFeature(null);navigate(path);}} onSample={()=>{setSelectedFeature(null);setShowSampleChooser(true);}}/>}
    {showSampleChooser&&<div className="fixed inset-0 z-[250] flex items-end justify-center overflow-y-auto bg-[#06050d]/90 p-3 backdrop-blur-md sm:items-center sm:p-4"><div className="my-3 w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#151326] shadow-2xl"><div className="border-b border-white/10 p-5 sm:p-6"><p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">Sample Experience</p><h2 className="mt-1 text-2xl font-black">Choose exactly what you want to preview.</h2><p className="mt-2 text-sm font-semibold text-slate-400">The regular Student sample is strictly non-Eye-Gazer. Eye Gazer has its own separate sample.</p></div><div className="grid gap-3 p-4 sm:p-5 md:grid-cols-3"><SampleButton icon={Users} title={sampleLoading==="student"?"Opening…":"Student"} text="Regular student: books, quizzes, rewards, Club, avatars, pets, homes and worlds." onClick={()=>void loginSample("student")} disabled={!!sampleLoading}/><SampleButton icon={Eye} title={sampleLoading==="eye-gaze"?"Opening…":"Eye Gazer"} text="Accessible sample: My Talker, visual learning, games, My World and Life Skills." onClick={()=>void loginSample("eye-gaze")} disabled={!!sampleLoading}/><SampleButton icon={UserRound} title={sampleLoading==="parent"?"Opening…":"Parent"} text="Family sample: linked children, progress, certificates and controls." onClick={()=>void loginSample("parent")} disabled={!!sampleLoading}/></div><div className="border-t border-white/10 p-4 sm:p-5"><button type="button" onClick={()=>setShowSampleChooser(false)} className="rounded-xl px-4 py-2 text-sm font-black text-slate-300 hover:bg-white/10">Cancel</button></div></div></div>}
    <nav aria-label="Explore reading resources" className="mx-auto flex max-w-[1500px] flex-wrap justify-center gap-x-5 gap-y-2 px-4 pb-8 pt-4 text-xs font-semibold text-slate-400">
      <a href="/reading-quizzes/" className="hover:text-cyan-300 hover:underline">Reading quizzes</a>
      <a href="/for-teachers/" className="hover:text-cyan-300 hover:underline">For teachers</a>
      <a href="/for-parents/" className="hover:text-cyan-300 hover:underline">For parents</a>
      <a href="/reading-rewards/" className="hover:text-cyan-300 hover:underline">Reading rewards</a>
        <a href="/special-education-reading/" className="hover:text-cyan-300 hover:underline">Inclusive reading</a>
        <a href="/teacher-workspace/" className="hover:text-cyan-300 hover:underline">Teacher workspace</a>
        <a href="/math/" className="hover:text-cyan-300 hover:underline">Arise Math</a>
        <a href="/social/" className="hover:text-cyan-300 hover:underline">Arise Social</a>
    </nav>
  </div>;
}


const RESEARCH_PROOF = [
  {
    title: "Quizzing helps learning stick",
    value: 0.51,
    display: "+0.51",
    strengthLabel: "Moderate positive effect",
    plain: "Students who practiced recalling what they learned did better than students who simply reread the material.",
    proof: "118 articles · 272 results · 15,427 participants",
    source: "Adesope, Trevisan & Sundararajan (2017)",
    url: "https://doi.org/10.3102/0034654316689306",
    arise: "A.R.I.S.E. uses book quizzes to make students pull information back from memory instead of only rereading.",
  },
  {
    title: "Game-style learning can improve results",
    value: 0.49,
    display: "+0.49",
    strengthLabel: "Positive learning effect",
    plain: "A large review found that gamified learning had a positive effect on learning outcomes.",
    proof: "19 studies · 1,686 participants",
    source: "Sailer & Homner (2020)",
    url: "https://link.springer.com/article/10.1007/s10648-019-09498-w",
    arise: "A.R.I.S.E. connects reading to points, rewards, games, avatars, pets, and progress students can actually see.",
  },
  {
    title: "Motivation can support comprehension",
    value: 0.27,
    display: "+0.27",
    strengthLabel: "Positive reading growth effect",
    plain: "Across school-based studies, programs designed to increase reading motivation also improved reading comprehension on average.",
    proof: "39 school-based effect studies",
    source: "van der Sande et al. (2023)",
    url: "https://link.springer.com/article/10.1007/s10648-023-09719-3",
    arise: "A.R.I.S.E. is built to give students reasons to come back to reading through choice, recognition, progress, and rewards.",
  },
] as const;

function ResearchEvidenceSection({sectionId="research"}:{sectionId?:string}){
  return <section id={sectionId} className="relative mt-5 overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-[radial-gradient(circle_at_82%_12%,rgba(34,211,238,.13),transparent_28%),radial-gradient(circle_at_18%_20%,rgba(139,92,246,.18),transparent_30%),linear-gradient(145deg,#111426,#10101e_52%,#0a1820)] p-5 shadow-2xl sm:p-7 lg:p-9">
    <style>{`
      @keyframes ariseResearchGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      .arise-research-bar { transform-origin: left center; animation: ariseResearchGrow 1.1s cubic-bezier(.2,.8,.2,1) both; }
      @media (prefers-reduced-motion: reduce) { .arise-research-bar { animation: none; } }
    `}</style>
    <div className="relative">
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-cyan-200"><ShieldCheck className="h-3.5 w-3.5"/> Real research behind the idea</div>
        <h2 className="mt-4 text-3xl font-black tracking-[-.04em] sm:text-4xl">3 reasons this approach makes sense.</h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">What the research found — and how A.R.I.S.E. puts it into practice.</p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {RESEARCH_PROOF.map((item,index)=><article key={item.title} className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4 sm:p-5 lg:p-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <p className="whitespace-nowrap text-[10px] font-black uppercase tracking-[.15em] text-violet-300">Proof point {index+1}</p>
              <div className="text-[10px] font-bold text-slate-500">Research number: <span className="tabular-nums">{item.display}</span></div>
            </div>
            <h3 className="mt-3 break-words text-xl font-black leading-[1.15] text-white">{item.title}</h3>
            <div className="mt-3 inline-flex max-w-full rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-center text-[10px] font-black uppercase leading-4 tracking-wide text-cyan-200">{item.strengthLabel}</div>
          </div>

          <div className="mt-4">
            <div className="h-4 overflow-hidden rounded-full border border-white/10 bg-white/[.05]">
              <div className="arise-research-bar h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-400" style={{width:`${Math.min(100,(item.value/.6)*100)}%`,animationDelay:`${index*180}ms`}}/>
            </div>
            <div className="mt-1 flex justify-between text-[9px] font-bold text-slate-600"><span>0</span><span>0.60 research-effect scale</span></div>
          </div>

          <p className="mt-4 text-sm font-bold leading-6 text-slate-200">{item.plain}</p>
          <div className="mt-4 rounded-2xl border border-cyan-300/10 bg-cyan-400/[.05] p-3">
            <p className="text-[9px] font-black uppercase tracking-[.15em] text-cyan-300">The proof</p>
            <p className="mt-1 text-xs font-black text-white">{item.proof}</p>
          </div>
          <div className="mt-3 rounded-2xl border border-violet-300/10 bg-violet-400/[.05] p-3">
            <p className="text-[9px] font-black uppercase tracking-[.15em] text-violet-300">How A.R.I.S.E. connects</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">{item.arise}</p>
          </div>
          <a href={item.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center text-[10px] font-black text-slate-500 underline decoration-white/10 underline-offset-2 hover:text-cyan-300">View the study · {item.source}</a>
        </article>)}
      </div>

      <p className="mt-4 text-[10px] font-semibold leading-5 text-slate-500"><b className="text-slate-300">Quick note:</b> The plain-English labels focus on the direction of the research finding so the section is easy to understand. The +0.51, +0.49, and +0.27 values are research effect sizes, not percentages. The gamification study itself describes its +0.49 result as a small positive effect. These studies support ideas used by A.R.I.S.E.; they did not directly test A.R.I.S.E. Reader itself.</p>
    </div>
  </section>;
}

function FeatureDetails({feature,onClose,onTutorial,onSample}:{feature:Feature;onClose:()=>void;onTutorial:()=>void;onSample:()=>void}){const Icon=feature.icon;return <div className="fixed inset-0 z-[260] flex items-end justify-center bg-[#06050d]/88 p-0 backdrop-blur-md sm:items-center sm:p-4" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className="max-h-[88dvh] w-full overflow-y-auto rounded-t-[2rem] border border-white/10 bg-[#151326] shadow-2xl sm:max-w-2xl sm:rounded-[2rem]"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#151326]/95 px-5 py-4 backdrop-blur-xl"><div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400"><Icon className="h-5 w-5"/></div><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.17em] text-cyan-300">{feature.category}</p><p className="truncate font-black">{feature.label}</p></div></div><button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[.07] text-slate-300"><X className="h-5 w-5"/></button></div><div className="p-5 sm:p-7"><p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-300">{feature.kicker}</p><h2 className="mt-2 text-3xl font-black leading-tight tracking-[-.04em]">{feature.title}</h2><p className="mt-4 text-sm font-semibold leading-6 text-slate-400">{feature.description}</p><div className="mt-6 grid gap-2 sm:grid-cols-3">{feature.bullets.map(b=><div key={b} className="rounded-2xl border border-white/10 bg-white/[.045] p-3 text-sm font-bold text-slate-200">{b}</div>)}</div><div className="mt-7 flex flex-col gap-2 sm:flex-row"><Button onClick={onTutorial} className="min-h-12 rounded-full arise-gradient-button px-5 font-black">See tutorial <ArrowRight className="ml-2 h-4 w-4"/></Button>{feature.sample&&<Button variant="outline" onClick={onSample} className="min-h-12 rounded-full border-white/10 bg-white/5 px-5 font-black text-white">Try this experience</Button>}</div></div></div></div>;}
function AccountChoice({icon:Icon,title,text,onClick,tone}:{icon:any;title:string;text:string;onClick:()=>void;tone?:"violet"|"cyan"}){return <button type="button" onClick={onClick} className={`flex w-full min-w-0 items-center gap-3 rounded-2xl border p-4 text-left transition hover:bg-white/10 ${tone==="cyan"?"border-cyan-300/25 bg-cyan-500/8":tone==="violet"?"border-violet-300/20 bg-violet-500/8":"border-white/10 bg-white/5"}`}><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tone==="cyan"?"bg-cyan-400 text-slate-950":tone==="violet"?"bg-violet-500":"bg-white/[.07] text-fuchsia-300"}`}><Icon className="h-5 w-5"/></div><div className="min-w-0 flex-1"><p className="font-black">{title}</p><p className="text-xs leading-5 text-slate-400">{text}</p></div><ArrowRight className="h-4 w-4 shrink-0"/></button>;}
function ExploreButton({icon:Icon,label,onClick}:{icon:any;label:string;onClick:()=>void}){return <button type="button" onClick={onClick} className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-4 text-center hover:bg-white/10"><Icon className="mx-auto h-5 w-5 text-cyan-300"/><p className="mt-2 truncate text-sm font-black">{label}</p></button>;}
function SampleButton({icon:Icon,title,text,onClick,disabled}:{icon:any;title:string;text:string;onClick:()=>void;disabled:boolean}){return <button type="button" onClick={onClick} disabled={disabled} className="rounded-2xl border-2 border-white/10 bg-white/5 p-5 text-left transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/10 disabled:opacity-50"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15"><Icon className="h-6 w-6 text-cyan-200"/></div><p className="mt-4 font-black">{title}</p><p className="mt-1 text-xs font-semibold leading-5 text-slate-400">{text}</p></button>;}