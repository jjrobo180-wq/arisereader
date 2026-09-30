import { useState } from "react";
import { X, Sparkles, Gamepad2, Users, BookOpen, Trophy, Volume2, Accessibility, Zap, ChevronRight } from "lucide-react";

const updates = [
  { icon: BookOpen, title: "Reading, rebuilt around you", text: "Discover books faster, get personalized choices, take book quizzes, earn points, and keep your reading journey moving from one place." },
  { icon: Zap, title: "Live Quiz is here", text: "Teachers can launch a live, game-show-style quiz with a short join code. Students answer together while scores and the leaderboard update live." },
  { icon: Gamepad2, title: "Learning unlocks play", text: "Quizzes now connect to a bigger reward experience. Earn access, coins, games, avatars, pets, and interactive worlds by reading and participating." },
  { icon: Users, title: "Club A.R.I.S.E. & multiplayer", text: "Hang out, play arcade games, challenge friends or the computer, explore shared spaces, and bring your avatar into a growing A.R.I.S.E. world." },
  { icon: Trophy, title: "More reasons to keep going", text: "Points, competitions, rewards, badges, progress, and leaderboards make growth visible. Teachers still control access and can shape the experience for their students." },
  { icon: Accessibility, title: "Built for more learners", text: "Eye Gazer experiences bring communication, learning games, My Talker, My World, life skills, visual supports, and accessible ways to participate." },
  { icon: Volume2, title: "Books can meet you where you are", text: "Audio and read-aloud experiences, simpler navigation, reading-level supports, and new ways to practice help students access reading with less friction." },
];

export function Arise2UpdateButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)} className={compact ? "w-full rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-amber-500/10 px-3 py-2.5 text-left hover:border-violet-400/60 transition" : "group relative w-full overflow-hidden rounded-3xl border border-white/15 bg-slate-950 px-5 py-5 text-left text-white shadow-2xl sm:px-7"}>
      {!compact && <><div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-violet-500/25 blur-3xl"/><div className="absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-amber-400/15 blur-3xl"/></>}
      <div className="relative flex items-center gap-3">
        <div className={compact ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500 text-white" : "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15"}><Sparkles className="h-5 w-5"/></div>
        <div className="min-w-0 flex-1"><div className={compact ? "text-[10px] font-black uppercase tracking-widest text-violet-500" : "text-[10px] font-black uppercase tracking-[.28em] text-amber-300"}>Major Update</div><div className={compact ? "text-sm font-black" : "mt-1 text-xl font-black sm:text-2xl"}>A.R.I.S.E. 2.0</div>{!compact && <div className="mt-1 text-sm text-slate-300">Reading was only the beginning. See what’s new.</div>}</div>
        <ChevronRight className="h-5 w-5 shrink-0 opacity-70 transition group-hover:translate-x-1"/>
      </div>
    </button>
    {open && <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/80 p-3 backdrop-blur-xl sm:p-6" onClick={() => setOpen(false)}>
      <div className="mx-auto min-h-full max-w-4xl py-3 sm:py-8" onClick={e => e.stopPropagation()}>
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#080b14] text-white shadow-2xl">
          <button onClick={() => setOpen(false)} className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close"><X className="h-5 w-5"/></button>
          <section className="relative overflow-hidden px-6 pb-12 pt-16 text-center sm:px-12 sm:pb-16 sm:pt-20">
            <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-600/30 blur-[90px]"/><div className="absolute -right-20 bottom-0 h-52 w-52 rounded-full bg-amber-400/20 blur-[80px]"/>
            <div className="relative"><div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[.25em] text-amber-300"><Sparkles className="h-4 w-4"/>Introducing</div><h1 className="text-5xl font-black tracking-tight sm:text-7xl">A.R.I.S.E. <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-300 bg-clip-text text-transparent">2.0</span></h1><p className="mx-auto mt-5 max-w-2xl text-lg font-semibold leading-relaxed text-slate-300 sm:text-xl">A reading platform is becoming a learning world.</p><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">A.R.I.S.E. 2.0 connects reading, live learning, rewards, games, creativity, accessibility, and community—so progress doesn’t just get recorded. It unlocks what happens next.</p></div>
          </section>
          <section className="border-t border-white/10 bg-white/[.025] px-4 py-8 sm:px-10 sm:py-12"><div className="mb-7"><div className="text-xs font-black uppercase tracking-[.24em] text-violet-300">What’s new</div><h2 className="mt-2 text-3xl font-black">One update. A completely bigger A.R.I.S.E.</h2></div><div className="grid gap-3 sm:grid-cols-2">{updates.map(({icon: Icon,title,text}) => <div key={title} className="rounded-3xl border border-white/10 bg-white/[.045] p-5"><div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-amber-400/20 ring-1 ring-white/10"><Icon className="h-5 w-5 text-white"/></div><h3 className="text-base font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></div>)}</div></section>
          <section className="px-6 py-12 text-center sm:px-12 sm:py-16"><div className="text-xs font-black uppercase tracking-[.25em] text-amber-300">The idea behind 2.0</div><h2 className="mx-auto mt-3 max-w-2xl text-3xl font-black sm:text-4xl">Read. Learn. Earn. Play. Grow.</h2><p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">Every part of A.R.I.S.E. 2.0 is designed around the same idea: give students a reason to start, a reason to keep going, and a way to see that their work matters.</p><button onClick={() => setOpen(false)} className="mt-8 rounded-full bg-white px-7 py-3 text-sm font-black text-slate-950 hover:bg-slate-100">Explore A.R.I.S.E. 2.0</button></section>
        </div>
      </div>
    </div>}
  </>;
}

export function Arise2HomeAnnouncement() {
  return <div className="mb-5"><Arise2UpdateButton /></div>;
}
