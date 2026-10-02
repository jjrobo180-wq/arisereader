import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, Gamepad2, Users, BookOpen, Trophy, Volume2, Accessibility, Zap, ChevronRight, ChevronLeft, Rocket, Coins, House } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const updates = [
  { icon: BookOpen, eyebrow: "READ", title: "A bigger reading experience", text: "Find books faster, search by point value, take book quizzes, request missing titles, and keep your reading progress in one place.", why: "Less hunting around means more time actually reading." },
  { icon: Zap, eyebrow: "LEARN", title: "Live Quiz", text: "Teachers can launch a live quiz with a short join code. Students answer together while scores and the leaderboard update in real time.", why: "Class review can feel like a game instead of another worksheet." },
  { icon: Trophy, eyebrow: "EARN", title: "Reading now unlocks rewards", text: "Passing book quizzes earns the book's full points, Reader Coins, competition progress, badges, and access to more of the A.R.I.S.E. experience.", why: "Students can see a direct connection between reading and what they unlock next." },
  { icon: Gamepad2, eyebrow: "PLAY", title: "A.R.I.S.E. Arcade & multiplayer", text: "Challenge another reader or play against the computer in arcade games. Teachers can control when game access is available.", why: "Play becomes something earned through participation instead of competing with learning." },
  { icon: House, eyebrow: "EXPLORE", title: "Your own world", text: "Create an avatar, adopt and care for a pet, buy a home, explore The Block, visit the cinema, and enter growing 3D A.R.I.S.E. worlds.", why: "Reading progress now follows students into a world they can build and personalize." },
  { icon: Coins, eyebrow: "COLLECT", title: "Coins, pets, homes & customization", text: "Reader Coins are separate from leaderboard points and can be spent on pets, care, avatar items, homes, and experiences.", why: "Students can make meaningful choices with rewards they earn." },
  { icon: Accessibility, eyebrow: "ACCESS", title: "Built for more learners", text: "Eye Gazer experiences include My Talker, My World, learning games, life skills, visual supports, accessible navigation, and family tools.", why: "More students can participate in ways that match how they communicate and learn." },
  { icon: Volume2, eyebrow: "GROW", title: "More ways to access reading", text: "Audio books, read-aloud supports, growth checks, reading-level tools, and simplified experiences help students keep moving forward.", why: "Support is built into the experience instead of feeling like a separate program." },
];

function Arise2Modal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  const active = updates[activeIndex];
  const ActiveIcon = active.icon;
  // Rendered into <body> so it opens full-screen even when the button sits inside a small dropdown menu.
  return createPortal(<div data-keep-menu-open="true" className="fixed inset-0 z-[300] overflow-y-auto bg-black/85 p-2 backdrop-blur-xl sm:p-6" onClick={onClose}>
    <div className="mx-auto min-h-full max-w-5xl py-2 sm:py-6" onClick={e => e.stopPropagation()}>
      <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#070912] text-white shadow-[0_30px_100px_rgba(0,0,0,.65)]">
        <button onClick={onClose} className="absolute right-4 top-4 z-30 grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-black/35 backdrop-blur hover:bg-white/15" aria-label="Close A.R.I.S.E. 2.0 update"><X className="h-5 w-5"/></button>

        <section className="relative overflow-hidden px-5 pb-14 pt-16 text-center sm:px-12 sm:pb-20 sm:pt-20">
          <div className="absolute left-1/2 top-[-180px] h-[430px] w-[430px] -translate-x-1/2 rounded-full bg-violet-600/35 blur-[110px]"/>
          <div className="absolute -right-20 bottom-[-80px] h-72 w-72 rounded-full bg-fuchsia-500/18 blur-[95px]"/>
          <div className="absolute -left-24 bottom-[-100px] h-72 w-72 rounded-full bg-cyan-400/15 blur-[95px]"/>
          <div className="relative">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.26em] text-cyan-300">
              <Rocket className="h-4 w-4"/> The biggest A.R.I.S.E. update yet
            </div>
            <p className="text-xs font-black uppercase tracking-[.4em] text-violet-300">Introducing</p>
            <h1 className="mt-3 text-5xl font-black tracking-[-.06em] sm:text-7xl lg:text-8xl">
              A.R.I.S.E. <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">2.0</span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-xl font-black leading-tight text-white sm:text-3xl">Reading was only the beginning.</p>
            <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-400 sm:text-base">
              A.R.I.S.E. is becoming a connected learning world where reading unlocks progress, rewards, games, creativity, community, and new ways to learn.
            </p>
            <div className="mx-auto mt-8 grid max-w-3xl grid-cols-5 gap-1.5 rounded-3xl border border-white/10 bg-white/[.04] p-2 sm:gap-2">
              {["READ","LEARN","EARN","PLAY","GROW"].map((word,i)=><div key={word} className="rounded-2xl bg-white/[.05] px-1 py-3 text-[9px] font-black tracking-wider text-white/75 sm:text-xs">{word}<div className="mx-auto mt-2 h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300"/></div>)}
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-gradient-to-b from-violet-950/25 to-[#070912] px-4 py-10 sm:px-10 sm:py-14">
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[.25em] text-cyan-300">Explore the update</div>
                <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Tap through A.R.I.S.E. 2.0</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Each part of 2.0 connects back to reading. Pick a feature below to see what students unlock and why it was added.</p>
              </div>
              <div className="text-xs font-black text-white/45">{activeIndex + 1} / {updates.length}</div>
            </div>

            <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
              {updates.map((item, index) => {
                const Icon = item.icon;
                const selected = index === activeIndex;
                return <button
                  key={item.title}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`min-w-[112px] rounded-2xl border px-3 py-3 text-left transition ${selected ? "border-cyan-300/55 bg-gradient-to-r from-violet-500/15 via-fuchsia-500/12 to-cyan-400/12 text-white shadow-[0_10px_35px_rgba(6,182,212,.12)]" : "border-white/10 bg-white/[.035] text-white/55 hover:border-violet-300/35 hover:text-white"}`}
                >
                  <Icon className={`h-5 w-5 ${selected ? "text-cyan-300" : "text-violet-300"}`}/>
                  <div className="mt-2 text-[9px] font-black uppercase tracking-wider">{item.eyebrow}</div>
                </button>;
              })}
            </div>

            <div className="relative mt-4 overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_15%_15%,rgba(139,92,246,.24),transparent_30%),radial-gradient(circle_at_90%_80%,rgba(6,182,212,.12),transparent_30%),rgba(255,255,255,.04)] p-6 sm:p-8">
              <div className="absolute right-[-40px] top-[-50px] text-[180px] font-black leading-none text-white/[.025]">{activeIndex + 1}</div>
              <div className="relative grid gap-6 md:grid-cols-[150px_1fr] md:items-center">
                <div className="mx-auto grid h-32 w-32 place-items-center rounded-[34px] border border-white/15 bg-gradient-to-br from-violet-500/30 via-fuchsia-500/15 to-fuchsia-500/18 shadow-[0_20px_70px_rgba(124,58,237,.18)]">
                  <ActiveIcon className="h-14 w-14 text-white"/>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[.28em] text-cyan-300">{active.eyebrow}</div>
                  <h3 className="mt-2 text-2xl font-black sm:text-3xl">{active.title}</h3>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">{active.text}</p>
                  <div className="mt-5 rounded-2xl border border-violet-300/15 bg-black/25 p-4">
                    <div className="text-[9px] font-black uppercase tracking-[.2em] text-violet-300">Why it matters</div>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{active.why}</p>
                  </div>
                </div>
              </div>

              <div className="relative mt-6 flex items-center justify-between">
                <button type="button" onClick={() => setActiveIndex(i => (i - 1 + updates.length) % updates.length)} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[.06] hover:bg-white/[.12]" aria-label="Previous A.R.I.S.E. 2.0 feature"><ChevronLeft className="h-5 w-5"/></button>
                <div className="flex gap-1.5">
                  {updates.map((_, index) => <button key={index} type="button" onClick={() => setActiveIndex(index)} aria-label={`Open feature ${index + 1}`} className={`h-2 rounded-full transition-all ${index === activeIndex ? "w-8 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300" : "w-2 bg-white/20"}`}/>)}
                </div>
                <button type="button" onClick={() => setActiveIndex(i => (i + 1) % updates.length)} className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[.06] hover:bg-white/[.12]" aria-label="Next A.R.I.S.E. 2.0 feature"><ChevronRight className="h-5 w-5"/></button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/10 bg-white/[.025] px-4 py-10 sm:px-10 sm:py-14">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8">
              <div className="text-xs font-black uppercase tracking-[.25em] text-violet-300">What changed</div>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">A completely bigger A.R.I.S.E.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Every major feature is connected to one idea: make students want to keep going while giving teachers and families more control and visibility.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {updates.map(({icon: Icon,eyebrow,title,text,why}) => <article key={title} className="group rounded-[26px] border border-white/10 bg-white/[.045] p-5 transition hover:-translate-y-0.5 hover:border-violet-400/30 hover:bg-white/[.06]">
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/18 ring-1 ring-white/10"><Icon className="h-5 w-5"/></div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[.22em] text-cyan-300">{eyebrow}</div>
                    <h3 className="mt-1 text-lg font-black">{title}</h3>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-400">{text}</p>
                <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-3">
                  <div className="text-[9px] font-black uppercase tracking-wider text-violet-300">Why it matters</div>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">{why}</p>
                </div>
              </article>)}
            </div>
          </div>
        </section>

        <section className="px-6 py-14 text-center sm:px-12 sm:py-18">
          <div className="text-xs font-black uppercase tracking-[.3em] text-cyan-300">A.R.I.S.E. 2.0</div>
          <h2 className="mx-auto mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">Read. Learn. Earn. Play. Grow.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">The goal is simple: give students a reason to start, a reason to keep going, and a way to see that their effort changes what they can do next.</p>
          <button onClick={onClose} className="mt-8 rounded-full bg-white px-8 py-3.5 text-sm font-black text-slate-950 shadow-xl transition hover:scale-[1.02]">Start exploring 2.0</button>
        </section>
      </div>
    </div>
  </div>, document.body);
}

export function Arise2UpdateButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} className={compact ? "group w-full rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-cyan-500/10 px-3 py-3 text-left transition hover:border-violet-400/60 hover:bg-violet-500/15" : "group relative w-full overflow-hidden rounded-[28px] border border-white/15 bg-slate-950 px-5 py-5 text-left text-white shadow-2xl sm:px-7"}>
      {!compact && <><div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-violet-500/25 blur-3xl"/><div className="absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-cyan-400/15 blur-3xl"/></>}
      <div className="relative flex items-center gap-3">
        <div className={compact ? "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-500/20" : "grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"}><Sparkles className="h-5 w-5"/></div>
        <div className="min-w-0 flex-1"><div className={compact ? "text-[9px] font-black uppercase tracking-widest text-violet-500" : "text-[10px] font-black uppercase tracking-[.28em] text-cyan-300"}>Major Update</div><div className={compact ? "text-sm font-black" : "mt-1 text-xl font-black sm:text-2xl"}>A.R.I.S.E. 2.0</div>{!compact && <div className="mt-1 text-sm text-slate-300">Reading was only the beginning. Open the launch experience.</div>}</div>
        <ChevronRight className="h-5 w-5 shrink-0 opacity-70 transition group-hover:translate-x-1"/>
      </div>
    </button>
    <Arise2Modal open={open} onClose={() => setOpen(false)}/>
  </>;
}

export function Arise2HomeAnnouncement() {
  return <section className="mb-5 rounded-[30px] bg-gradient-to-r from-violet-600 via-indigo-700 to-slate-950 p-[1px] shadow-xl">
    <div className="rounded-[29px] bg-slate-950/95 p-1"><Arise2UpdateButton /></div>
  </section>;
}

export function Arise2GlobalLauncher() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user?.id) { setReady(false); return; }
    setReady(true);
    const key = `arise_2_launch_seen_${user.id}_v2`;
    if (localStorage.getItem(key) !== "1") {
      const timer = window.setTimeout(() => setOpen(true), 900);
      return () => window.clearTimeout(timer);
    }
  }, [user?.id]);

  const close = () => {
    if (user?.id) localStorage.setItem(`arise_2_launch_seen_${user.id}_v2`, "1");
    setOpen(false);
  };

  if (!user || !ready) return null;
  return <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="fixed right-3 top-[74px] z-[85] flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/92 px-3 py-2 text-xs font-black text-white shadow-2xl backdrop-blur-xl transition hover:scale-[1.03] sm:right-5 sm:top-[78px]"
      aria-label="Open A.R.I.S.E. 2.0 launch experience"
    >
      <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400"><Sparkles className="h-3.5 w-3.5"/></span>
      <span>A.R.I.S.E. 2.0</span>
    </button>
    <Arise2Modal open={open} onClose={close}/>
  </>;
}
