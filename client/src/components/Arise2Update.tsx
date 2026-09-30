import { useEffect, useMemo, useState } from "react";
import { X, Sparkles, Gamepad2, Users, BookOpen, Trophy, Volume2, Accessibility, Zap, ChevronRight, House, Coins, Brain, Radio, Rocket } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const updates = [
  { icon: BookOpen, title: "Reading became the starting point", text: "Find a book, read it, take the quiz, and turn your reading into points, access, rewards, and progress across the rest of A.R.I.S.E." },
  { icon: Zap, title: "Live Quiz", text: "Teachers can launch a live game-show quiz with a short join code. Students answer together while scores and the live board update in real time." },
  { icon: Gamepad2, title: "A.R.I.S.E. Arcade", text: "Students can play multiplayer reading games or choose a computer opponent. Game access can be controlled by teachers and connected to reading success." },
  { icon: House, title: "A world that belongs to the student", text: "Avatars, homes, pets, neighborhoods, the cinema, Board Quest, and other worlds turn reading rewards into something students can actually use and explore." },
  { icon: Coins, title: "Points and Reader Coins do different jobs", text: "Leaderboard points celebrate reading performance. Reader Coins can be spent on pets, care, avatar items, homes, and other experiences." },
  { icon: Trophy, title: "Rewards feel visible", text: "Leaderboards, prizes, badges, competitions, and printable celebrations make progress public, exciting, and worth working toward." },
  { icon: Accessibility, title: "Eye Gazer grew into its own learning experience", text: "My Talker, My World, accessible games, life skills, visual learning, parent controls, and simplified navigation support more ways to communicate and learn." },
  { icon: Volume2, title: "More ways into a book", text: "Audio, read-aloud support, shorter-book point bands, simpler discovery, and reading-level supports help students find an entry point that works for them." },
  { icon: Brain, title: "Growth is easier to see", text: "Teachers and families can follow quiz history, reading progress, growth checks, and student performance without losing the fun side of the program." },
  { icon: Radio, title: "A.R.I.S.E. is becoming a community", text: "Reading Club, polls, shared worlds, social spaces, live activities, and school celebrations make reading something students can participate in together." },
];

function UpdateModal({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-[300] overflow-y-auto bg-black/90 p-2 backdrop-blur-2xl sm:p-6" onClick={onClose}>
    <div className="mx-auto flex min-h-full max-w-5xl items-center py-3 sm:py-8" onClick={e => e.stopPropagation()}>
      <div className="relative w-full overflow-hidden rounded-[34px] border border-white/10 bg-[#070a12] text-white shadow-[0_40px_120px_rgba(0,0,0,.7)]">
        <button onClick={onClose} className="absolute right-4 top-4 z-30 grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-black/35 backdrop-blur hover:bg-white/15" aria-label="Close A.R.I.S.E. 2.0 update"><X className="h-5 w-5"/></button>

        <section className="relative min-h-[520px] overflow-hidden px-6 pb-14 pt-20 text-center sm:px-14 sm:pb-20 sm:pt-24">
          <div className="absolute left-1/2 top-[-180px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-violet-600/35 blur-[120px]"/>
          <div className="absolute -right-24 bottom-[-70px] h-80 w-80 rounded-full bg-amber-400/20 blur-[100px]"/>
          <div className="absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-cyan-500/15 blur-[90px]"/>
          <div className="relative mx-auto max-w-3xl">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.28em] text-amber-300"><Rocket className="h-4 w-4"/>Major Release</div>
            <p className="mt-8 text-sm font-black uppercase tracking-[.38em] text-violet-200">Introducing</p>
            <h1 className="mt-2 text-6xl font-black tracking-[-.06em] sm:text-8xl">A.R.I.S.E. <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent">2.0</span></h1>
            <p className="mx-auto mt-7 max-w-2xl text-2xl font-black leading-tight text-white sm:text-3xl">Reading was only the beginning.</p>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-300 sm:text-lg">A.R.I.S.E. 2.0 turns reading into a connected learning world: quizzes unlock experiences, progress earns rewards, teachers get more control, and students get more reasons to keep going.</p>
            <div className="mx-auto mt-8 grid max-w-2xl grid-cols-5 gap-2 text-center text-[10px] font-black uppercase tracking-wider text-slate-300">
              {["Read","Learn","Earn","Play","Grow"].map((word,i)=><div key={word} className="rounded-2xl border border-white/10 bg-white/[.06] px-2 py-3"><span className="block text-lg">{["📚","🧠","🪙","🎮","🚀"][i]}</span><span className="mt-1 block">{word}</span></div>)}
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[.025] px-4 py-10 sm:px-10 sm:py-14">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 text-center">
              <div className="text-xs font-black uppercase tracking-[.25em] text-violet-300">What changed</div>
              <h2 className="mt-2 text-3xl font-black sm:text-4xl">One platform. A much bigger experience.</h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">Every major part of 2.0 has a purpose: make reading easier to start, more rewarding to finish, and more visible to the people supporting the student.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">{updates.map(({icon: Icon,title,text}) => <article key={title} className="rounded-3xl border border-white/10 bg-white/[.045] p-5">
              <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/35 to-amber-400/20 ring-1 ring-white/10"><Icon className="h-5 w-5"/></div>
              <h3 className="text-base font-black">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{text}</p>
            </article>)}</div>
          </div>
        </section>

        <section className="relative overflow-hidden px-6 py-14 text-center sm:px-12 sm:py-20">
          <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-600/15 blur-[100px]"/>
          <div className="relative">
            <div className="text-xs font-black uppercase tracking-[.28em] text-amber-300">The A.R.I.S.E. 2.0 idea</div>
            <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">Give students a reason to start.<br/>Give them a reason to come back.</h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">Reading still matters most. 2.0 simply makes the work lead somewhere students can see, feel, share, and enjoy.</p>
            <button onClick={onClose} className="mt-9 rounded-full bg-white px-8 py-3.5 text-sm font-black text-slate-950 shadow-xl hover:bg-slate-100">Enter A.R.I.S.E. 2.0</button>
          </div>
        </section>
      </div>
    </div>
  </div>;
}

export function Arise2UpdateButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)} className={compact ? "group w-full rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-amber-500/10 px-3 py-3 text-left transition hover:border-violet-400/70 hover:bg-violet-500/15" : "group relative w-full overflow-hidden rounded-[2rem] border border-white/15 bg-slate-950 px-5 py-6 text-left text-white shadow-2xl sm:px-7"}>
      {!compact && <><div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-violet-500/25 blur-3xl"/><div className="absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-amber-400/15 blur-3xl"/></>}
      <div className="relative flex items-center gap-3">
        <div className={compact ? "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-600 text-white shadow-lg" : "grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"}><Sparkles className="h-5 w-5"/></div>
        <div className="min-w-0 flex-1"><div className={compact ? "text-[9px] font-black uppercase tracking-[.2em] text-violet-400" : "text-[10px] font-black uppercase tracking-[.28em] text-amber-300"}>Major Update</div><div className={compact ? "text-sm font-black" : "mt-1 text-2xl font-black"}>A.R.I.S.E. 2.0</div>{!compact && <div className="mt-1 text-sm text-slate-300">Reading was only the beginning. Open the launch experience.</div>}</div>
        <ChevronRight className="h-5 w-5 shrink-0 opacity-70 transition group-hover:translate-x-1"/>
      </div>
    </button>
    {open && <UpdateModal onClose={() => setOpen(false)}/>}
  </>;
}

export function Arise2HomeAnnouncement() {
  return <div className="mb-5"><Arise2UpdateButton /></div>;
}

export function Arise2GlobalLaunch({ autoLaunch = true }: { autoLaunch?: boolean }) {
  const { user } = useAuth();
  const [open,setOpen] = useState(false);
  const key = useMemo(() => user ? `arise_2_launch_session_${user.id}` : "", [user?.id]);

  useEffect(() => {
    if (!user || !autoLaunch || !key) return;
    if (sessionStorage.getItem(key) === "seen") return;
    const timer = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [user?.id,autoLaunch,key]);

  if (!user) return null;
  const close=()=>{ if(key) sessionStorage.setItem(key,"seen"); setOpen(false); };
  return <>
    <button
      type="button"
      onClick={()=>setOpen(true)}
      className="fixed bottom-4 right-4 z-[120] inline-flex items-center gap-2 rounded-full border border-violet-300/30 bg-slate-950/92 px-4 py-2.5 text-xs font-black text-white shadow-2xl backdrop-blur-xl hover:bg-slate-900"
      aria-label="Open the A.R.I.S.E. 2.0 launch experience"
    >
      <Sparkles className="h-4 w-4 text-amber-300"/><span>A.R.I.S.E. 2.0</span>
    </button>
    {open && <UpdateModal onClose={close}/>}
  </>;
}
