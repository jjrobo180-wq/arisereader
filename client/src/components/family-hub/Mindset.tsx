// Mindset: the self-help plugin. A short questionnaire shapes a full-screen feed you swipe up through, one card
// at a time (quotes, advice, affirmations, lessons, stories, reflection questions, challenges, breathing, and
// Bible verses and stories for people who want them). Around it: today's picks, a dream board, a wins log, a
// reflection journal, saved cards and an honest look at growth. The logic and data are in shared/mindset.ts;
// the cards are in shared/mindsetContent.ts.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronUp, Flame, Heart, Plus, Settings2, Share2, Sparkles, Trash2, X } from "lucide-react";
import {
  DREAM_CATS, DREAM_COLORS, DREAM_IDEAS, KINDS, SEASONS, TONES, WIN_CATS, buildFeed, cardId, cardText, dayOf, findCard, growth, logTime,
  mindBadges, mindStreak, newMindset, recentDays, today as todayPicks, totals,
  type Card, type Dream, type Faith, type Kind, type MindProfile, type MindsetData, type Season, type Tone,
} from "@shared/mindset";
import { TOPICS, type Topic } from "@shared/mindsetContent";
import { Modal, Panel, confirmed, inputClass, primary, shortDate, stickyFoot, type SectionProps } from "./ui";
import { SwipeFeed, type SwipeFeedHandle } from "@/components/swipe/SwipeFeed";
import { confetti, tap } from "@/lib/celebrate";

type SetM = (fn: (m: MindsetData) => MindsetData) => void;
type Tab = "today" | "dreams" | "wins" | "journal" | "saved" | "growth";

const BGS = [
  "linear-gradient(160deg,#2b1a6b 0%,#120c2e 70%)", "linear-gradient(160deg,#0f3b4c 0%,#081a24 75%)", "linear-gradient(160deg,#4a1942 0%,#1a0a19 75%)",
  "linear-gradient(160deg,#1e3a2b 0%,#0a140f 75%)", "linear-gradient(160deg,#4b2a0e 0%,#150c05 75%)", "linear-gradient(160deg,#1b2a5c 0%,#0a0f22 75%)",
  "linear-gradient(160deg,#5a1e2c 0%,#1a0810 75%)", "linear-gradient(160deg,#223047 0%,#0b0f17 75%)",
];
const bgFor = (key: string) => BGS[[...key].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7) % BGS.length];
const greet = () => { const h = new Date().getHours(); return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const fmtMins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ""}`.trim() : `${m} min`);

export default function Mindset({ family, setFamily, today, makeId, say }: SectionProps) {
  const m = family.mindset;
  const [tab, setTab] = useState<Tab>("today");
  const [feed, setFeed] = useState(false);
  const [editing, setEditing] = useState(false);
  const setM: SetM = (fn) => setFamily((f) => (f.mindset ? { ...f, mindset: fn(f.mindset) } : f));

  if (!m || editing) return <Questionnaire start={m?.profile} today={today} onCancel={m ? () => setEditing(false) : undefined}
    onDone={(profile, dream) => {
      setFamily((f) => ({ ...f, mindset: f.mindset ? { ...f.mindset, profile } : { ...newMindset(profile), dreams: dream ? [{ id: makeId(), title: dream.title, emoji: dream.emoji, color: DREAM_COLORS[0], cat: "", why: profile.why, target: "", steps: [], done: "", at: today }] : [] } }));
      setEditing(false);
      if (!m) { confetti(); setFeed(true); } else say("Your feed is updated");
    }} />;

  const tabs: { id: Tab; label: string }[] = [{ id: "today", label: "Today" }, { id: "dreams", label: "Dream board" }, { id: "wins", label: "Wins" }, { id: "journal", label: "Journal" }, { id: "saved", label: `Saved${m.likes.length ? ` · ${m.likes.length}` : ""}` }, { id: "growth", label: "Growth" }];
  return <div className="space-y-5">
    <Hero m={m} today={today} onFeed={() => setFeed(true)} onSettings={() => setEditing(true)} />
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist">
      {tabs.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} data-testid={`mind-tab-${t.id}`}
        className={`min-h-11 shrink-0 rounded-2xl px-4 text-sm font-extrabold transition ${tab === t.id ? "bg-[#1c1932] text-white" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>{t.label}</button>)}
    </div>
    {tab === "today" && <TodayTab m={m} today={today} setM={setM} makeId={makeId} say={say} onFeed={() => setFeed(true)} />}
    {tab === "dreams" && <Dreams m={m} today={today} setM={setM} makeId={makeId} say={say} />}
    {tab === "wins" && <Wins m={m} today={today} setM={setM} makeId={makeId} say={say} />}
    {tab === "journal" && <Journal m={m} today={today} setM={setM} makeId={makeId} say={say} />}
    {tab === "saved" && <Saved m={m} setM={setM} say={say} />}
    {tab === "growth" && <Growth m={m} today={today} />}
    {feed && <Feed m={m} today={today} setM={setM} makeId={makeId} say={say} onClose={() => setFeed(false)} />}
  </div>;
}

/* ─── The top card ─── */
function Hero({ m, today, onFeed, onSettings }: { m: MindsetData; today: string; onFeed: () => void; onSettings: () => void }) {
  const mins = Math.floor(dayOf(m, today).secs / 60), goal = m.profile.minutes, pct = Math.min(1, mins / goal);
  const st = mindStreak(m, today), g = growth(m), R = 34, C = 2 * Math.PI * R;
  return <section className="relative overflow-hidden rounded-[1.75rem] bg-[radial-gradient(130%_120%_at_10%_0%,#9b6bff_0%,#5a2fd6_40%,#160f33_100%)] p-5 text-white shadow-[0_18px_50px_#4b2fd133] sm:p-6">
    <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-white/70">Mindset · Level {g.level} {g.title}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{greet()}{m.profile.name ? `, ${m.profile.name}` : ""}.</h1></div>
      <button onClick={onSettings} aria-label="Change my answers" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15"><Settings2 size={18} /></button>
    </div>
    <div className="mt-4 flex items-center gap-4">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90"><circle cx="40" cy="40" r={R} fill="none" stroke="#ffffff26" strokeWidth="9" /><circle cx="40" cy="40" r={R} fill="none" stroke="#ffd36e" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} className="transition-all duration-700" /></svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-xl font-black leading-none">{mins}<span className="text-xs text-white/60">/{goal}</span></span><span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70">min today</span></div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap gap-2 text-xs font-extrabold">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${st.days ? "bg-orange-400/25 text-orange-100" : "bg-white/10 text-white/70"}`}><Flame size={14} className={st.days ? "fill-orange-300 text-orange-300" : ""} />{st.days} day streak</span>
          <span className="rounded-full bg-white/10 px-2.5 py-1">{g.pts.toLocaleString()} growth pts</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-[#ffd36e] to-[#ff8fb1]" style={{ width: `${(g.into / g.need) * 100}%` }} /></div>
        <p className="text-xs font-semibold text-white/70">{pct >= 1 ? "Daily goal reached. Anything more is a bonus." : st.days && !st.today ? "Keep your streak alive — one minute counts." : `${goal - mins} minutes to today's goal`}</p>
      </div>
    </div>
    <button onClick={onFeed} data-testid="mind-open-feed" className="mt-4 flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 text-left text-[#241c52] shadow-lg transition active:scale-[.98]">
      <span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"><ChevronUp size={22} /></span><span><span className="block text-sm font-black">Open my feed</span><span className="block text-xs font-semibold text-slate-500">Swipe up. Made for what you're working on.</span></span></span>
      <ArrowRight size={20} className="text-slate-400" />
    </button>
  </section>;
}

/* ─── The questionnaire ─── */
type Answers = Omit<MindProfile, "startedAt"> & { dream: string; dreamEmoji: string };
function Questionnaire({ start, today, onDone, onCancel }: { start?: MindProfile; today: string; onDone: (p: MindProfile, dream: { title: string; emoji: string } | null) => void; onCancel?: () => void }) {
  const [a, setA] = useState<Answers>(() => ({
    name: start?.name ?? "", goals: start?.goals ?? [], season: start?.season ?? "okay", faith: start?.faith ?? "none", bible: start?.bible ?? false, tone: start?.tone ?? "mix",
    kinds: start?.kinds ?? KINDS.filter((k) => !k.faith).map((k) => k.id), minutes: start?.minutes ?? 30, why: start?.why ?? "", dream: "", dreamEmoji: "⭐",
  }));
  const [step, setStep] = useState(start ? 1 : 0);
  const set = (p: Partial<Answers>) => setA((x) => ({ ...x, ...p }));
  const toggle = <T,>(list: T[], v: T, max = 99) => (list.includes(v) ? list.filter((x) => x !== v) : list.length >= max ? list : [...list, v]);
  const chip = (on: boolean) => `flex min-h-14 items-center gap-3 rounded-2xl px-4 text-left text-[15px] font-bold transition active:scale-[.98] ${on ? "bg-white text-[#1c1440] shadow-xl" : "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15"}`;
  const steps: { title: string; sub?: string; ok?: boolean; body: ReactNode }[] = [
    { title: "Let's build your daily mind feed", sub: "A few questions, about two minutes. Your answers decide everything you see — and you can change them any time.", body: <div className="text-center text-8xl">🌅</div> },
    { title: "What should we call you?", ok: true, body: <input autoFocus value={a.name} onChange={(e) => set({ name: e.target.value.slice(0, 40) })} placeholder="Your first name" className="min-h-16 w-full rounded-2xl bg-white/10 px-5 text-xl font-bold text-white outline-none ring-1 ring-white/20 placeholder:text-white/40 focus:ring-white/60" /> },
    { title: "What do you want to work on?", sub: "Pick up to five. These shape your whole feed.", ok: a.goals.length > 0,
      body: <div className="grid grid-cols-2 gap-2">{TOPICS.filter((t) => t.id !== "faith").map((t) => <button type="button" key={t.id} onClick={() => set({ goals: toggle(a.goals, t.id as Topic, 5) })} aria-pressed={a.goals.includes(t.id as Topic)} className={chip(a.goals.includes(t.id as Topic))}><span className="text-2xl">{t.emoji}</span><span className="leading-tight">{t.name}</span></button>)}</div> },
    { title: "Where are you right now, honestly?", sub: "No wrong answer. It helps us know when to push and when to be gentle.",
      body: <div className="grid gap-2">{SEASONS.map((s) => <button type="button" key={s.id} onClick={() => set({ season: s.id as Season, tone: a.tone === "mix" && s.id === "hard" ? "gentle" : a.tone })} aria-pressed={a.season === s.id} className={chip(a.season === s.id)}><span className="text-2xl">{s.emoji}</span>{s.name}</button>)}</div> },
    { title: "Is faith part of your life?", body: <div className="grid gap-2">{([["christian", "✝️", "Yes — I'm a Christian"], ["spiritual", "🕊️", "I'm spiritual"], ["none", "🌿", "Not really"]] as [Faith, string, string][]).map(([id, e, label]) => <button type="button" key={id} onClick={() => set({ faith: id, bible: id === "christian" ? true : id === "none" ? false : a.bible, kinds: id === "christian" && !a.kinds.includes("verse") ? [...a.kinds, "verse"] : id === "none" ? a.kinds.filter((k) => k !== "verse") : a.kinds })} aria-pressed={a.faith === id} className={chip(a.faith === id)}><span className="text-2xl">{e}</span>{label}</button>)}</div> },
    { title: "Bible verses and stories in your feed?", sub: "Scripture for what you're facing, and Bible stories retold one swipe at a time.",
      body: <div className="grid gap-2">{[[true, "📖", "Yes, include them"], [false, "🙅", "Not in my feed"]].map(([v, e, label]) => <button type="button" key={String(v)} onClick={() => set({ bible: v as boolean, kinds: v ? [...new Set([...a.kinds, "verse" as Kind])] : a.kinds.filter((k) => k !== "verse") })} aria-pressed={a.bible === v} className={chip(a.bible === v)}><span className="text-2xl">{e as string}</span>{label as string}</button>)}</div> },
    { title: "How do you like to be talked to?", body: <div className="grid gap-2">{TONES.map((t) => <button type="button" key={t.id} onClick={() => set({ tone: t.id as Tone })} aria-pressed={a.tone === t.id} className={chip(a.tone === t.id)}><span className="text-2xl">{t.emoji}</span><span><span className="block">{t.name}</span><span className={`block text-xs font-semibold ${a.tone === t.id ? "text-slate-500" : "text-white/60"}`}>{t.blurb}</span></span></button>)}</div> },
    { title: "What should fill your feed?", sub: "Turn off anything you don't want.", ok: a.kinds.some((k) => k !== "breathe"),
      body: <div className="grid grid-cols-2 gap-2">{KINDS.filter((k) => !k.faith || a.bible).map((k) => <button type="button" key={k.id} onClick={() => set({ kinds: toggle(a.kinds, k.id) })} aria-pressed={a.kinds.includes(k.id)} className={chip(a.kinds.includes(k.id))}><span className="text-2xl">{k.emoji}</span><span className="leading-tight"><span className="block">{k.name}</span><span className={`block text-[11px] font-semibold ${a.kinds.includes(k.id) ? "text-slate-500" : "text-white/60"}`}>{k.blurb}</span></span></button>)}</div> },
    { title: "How much time a day for your mind?", sub: "Your daily goal. Swap some scrolling for this — even a little changes a lot.",
      body: <div className="grid grid-cols-3 gap-2">{[10, 20, 30, 45, 60, 90, 120, 180, 240].map((n) => <button type="button" key={n} onClick={() => set({ minutes: n })} aria-pressed={a.minutes === n} className={chip(a.minutes === n) + " justify-center"}>{fmtMins(n)}</button>)}</div> },
    { title: "Why are you starting this?", sub: "We'll remind you of this on the hard days.", ok: true,
      body: <textarea value={a.why} onChange={(e) => set({ why: e.target.value.slice(0, 400) })} rows={4} placeholder="I want to be the kind of person who…" className="w-full rounded-2xl bg-white/10 p-4 text-lg font-semibold text-white outline-none ring-1 ring-white/20 placeholder:text-white/40 focus:ring-white/60" /> },
    ...(start ? [] : [{ title: "One dream you'd love to make real", sub: "It goes on your dream board. Big or small.", ok: true,
      body: <div className="space-y-3"><div className="flex gap-2"><input value={a.dreamEmoji} onChange={(e) => set({ dreamEmoji: [...e.target.value].slice(-2).join("") || "⭐" })} aria-label="Emoji" className="h-16 w-16 shrink-0 rounded-2xl bg-white/10 text-center text-3xl text-white outline-none ring-1 ring-white/20" /><input value={a.dream} onChange={(e) => set({ dream: e.target.value.slice(0, 120) })} placeholder="Own my own home" className="min-h-16 w-full rounded-2xl bg-white/10 px-4 text-lg font-bold text-white outline-none ring-1 ring-white/20 placeholder:text-white/40" /></div>
        <div className="flex flex-wrap gap-2">{DREAM_IDEAS.slice(0, 10).map((d) => <button type="button" key={d.title} onClick={() => set({ dream: d.title, dreamEmoji: d.emoji })} className="rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white/90 ring-1 ring-white/15">{d.emoji} {d.title}</button>)}</div></div> }]),
  ];
  const visible = steps.filter((_, i) => i !== 5 || a.faith !== "none");
  const s = visible[Math.min(step, visible.length - 1)], last = step >= visible.length - 1;
  const next = () => {
    if (!last) { setStep(step + 1); tap("light"); return; }
    onDone({ name: a.name.trim(), goals: a.goals.length ? a.goals : ["discipline", "confidence"], season: a.season, faith: a.faith, bible: a.bible, tone: a.tone, kinds: a.kinds.filter((k) => k !== "verse" || a.bible), minutes: a.minutes, why: a.why.trim(), startedAt: start?.startedAt || today },
      a.dream.trim() ? { title: a.dream.trim(), emoji: a.dreamEmoji } : null);
  };
  return <div className="fixed inset-0 z-[450] flex flex-col bg-[radial-gradient(120%_80%_at_50%_0%,#5b33d6_0%,#1b1240_55%,#0b0818_100%)] text-white" role="dialog" aria-modal="true" aria-label="Mindset questions">
    <div className="flex items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      {step > 0 ? <button onClick={() => setStep(step - 1)} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10"><ArrowLeft size={20} /></button> : <span className="w-11" />}
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${((step + 1) / visible.length) * 100}%` }} /></div>
      {onCancel ? <button onClick={onCancel} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10"><X size={20} /></button> : <span className="w-11" />}
    </div>
    <div key={step} className="mx-auto flex w-full max-w-lg flex-1 flex-col overflow-y-auto px-5 pb-4 pt-8 animate-[mindIn_.35s_ease-out]">
      <h2 className="text-3xl font-black leading-tight tracking-tight">{s.title}</h2>
      {s.sub && <p className="mt-2 text-[15px] leading-6 text-white/70">{s.sub}</p>}
      <div className="mt-7">{s.body}</div>
    </div>
    <div className="mx-auto w-full max-w-lg px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <button onClick={next} disabled={s.ok === false} data-testid="mind-next" className="min-h-16 w-full rounded-full bg-white text-lg font-black text-[#1c1440] shadow-2xl transition active:scale-[.98] disabled:opacity-40">{step === 0 ? "Let's go" : last ? (start ? "Save" : "Build my feed") : "Next"}</button>
    </div>
  </div>;
}

/* ─── The swipe feed ─── */
function Feed({ m, today, setM, makeId, say, onClose }: { m: MindsetData; today: string; setM: SetM; makeId: () => string; say: (s: string) => void; onClose: () => void }) {
  const seed0 = useRef(Date.now() % 1_000_000);
  const [cards, setCards] = useState<Card[]>(() => buildFeed(m, { count: 30, seed: seed0.current }));
  const [index, setIndex] = useState(0);
  const feed = useRef<SwipeFeedHandle>(null);
  const pending = useRef({ secs: 0, cards: 0, affirm: 0, seen: [] as string[] });
  const shown = useRef(new Set<string>());
  const goalHit = useRef(dayOf(m, today).secs >= m.profile.minutes * 60);
  const baseSecs = useRef(dayOf(m, today).secs);
  const [, force] = useState(0);
  const flush = () => {
    const p = pending.current;
    if (!p.secs && !p.cards && !p.seen.length) return;
    const add = { ...p };
    pending.current = { secs: 0, cards: 0, affirm: 0, seen: [] };
    setM((x) => ({ ...logTime(x, today, add.secs, add.cards, add.affirm), seen: [...x.seen, ...add.seen].slice(-700) }));
  };
  useEffect(() => {
    const tick = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      pending.current.secs += 1; baseSecs.current += 1;
      if (!goalHit.current && baseSecs.current >= m.profile.minutes * 60) { goalHit.current = true; confetti(2); tap("success"); say(`Daily goal reached — ${m.profile.minutes} minutes for your mind 🎉`); }
      if (baseSecs.current % 20 === 0) flush();
      if (baseSecs.current % 5 === 0) force((n) => n + 1);
    }, 1000);
    return () => { window.clearInterval(tick); flush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onIndex = (i: number) => {
    setIndex(i);
    const c = cards[i];
    if (c && !shown.current.has(c.key)) { shown.current.add(c.key); pending.current.cards += 1; const id = cardId(c); if (id && (c.kind !== "story" || c.part === 0)) pending.current.seen.push(id); }
  };
  const more = () => setCards((list) => {
    const skip = new Set(list.map(cardId).filter(Boolean));
    return [...list, ...buildFeed({ ...m, seen: [...m.seen, ...skip] }, { count: 25, seed: seed0.current + list.length, start: list.length })];
  });
  const close = () => { flush(); onClose(); };
  const liked = (c: Card) => { const id = cardId(c); return !!id && m.likes.includes(id); };
  const like = (c: Card) => {
    const id = cardId(c); if (!id) return;
    const on = m.likes.includes(id);
    setM((x) => ({ ...x, likes: on ? x.likes.filter((l) => l !== id) : [...x.likes, id].slice(-1500) }));
    if (!on) tap("light");
  };
  const share = async (c: Card) => {
    const text = cardText(c);
    try { if (navigator.share) { await navigator.share({ text }); return; } await navigator.clipboard.writeText(text); say("Copied"); } catch { /* cancelled */ }
  };
  const mins = Math.floor(baseSecs.current / 60);
  const top = <div className="flex items-center gap-2 rounded-full bg-black/30 px-3.5 py-2 text-xs font-black backdrop-blur"><span className="text-amber-300">●</span>{mins}/{m.profile.minutes} min</div>;
  const pages = cards.map((c, i) => <FeedCard key={c.key} c={c} near={Math.abs(i - index) <= 1} m={m} today={today} setM={setM} makeId={makeId} say={say}
    liked={liked(c)} onLike={() => like(c)} onShare={() => share(c)} onNext={() => feed.current?.next()} onAffirm={() => { pending.current.affirm += 1; }} />);
  return <SwipeFeed ref={feed} pages={pages} onClose={close} top={top} label="Mindset feed" onIndex={onIndex} onNearEnd={more} />;
}

function Rail({ liked, onLike, onShare }: { liked: boolean; onLike: () => void; onShare: () => void }) {
  return <div className="absolute bottom-[max(6.5rem,calc(env(safe-area-inset-bottom)+5.5rem))] right-3 z-10 flex flex-col items-center gap-4">
    <button onClick={onLike} aria-pressed={liked} aria-label={liked ? "Saved" : "Save"} className="flex flex-col items-center gap-1 text-[11px] font-bold text-white/80">
      <span className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur transition active:scale-90 ${liked ? "bg-rose-500" : "bg-white/15"}`}><Heart size={24} className={liked ? "fill-white text-white" : "text-white"} /></span>{liked ? "Saved" : "Save"}</button>
    <button onClick={onShare} aria-label="Share" className="flex flex-col items-center gap-1 text-[11px] font-bold text-white/80"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur active:scale-90"><Share2 size={22} /></span>Share</button>
  </div>;
}
const Tag = ({ children }: { children: ReactNode }) => <p className="text-[11px] font-extrabold uppercase tracking-[.25em] text-white/60">{children}</p>;
const SwipeHint = ({ text = "Swipe up" }: { text?: string }) => <div className="pointer-events-none absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col items-center text-white/40"><ChevronUp size={20} className="animate-bounce" /><span className="text-[10px] font-bold uppercase tracking-widest">{text}</span></div>;

function FeedCard({ c, near, m, today, setM, makeId, say, liked, onLike, onShare, onNext, onAffirm }: {
  c: Card; near: boolean; m: MindsetData; today: string; setM: SetM; makeId: () => string; say: (s: string) => void; liked: boolean; onLike: () => void; onShare: () => void; onNext: () => void; onAffirm: () => void;
}) {
  const [text, setText] = useState("");
  const [claimed, setClaimed] = useState(0);
  const bg = c.kind === "verse" ? "linear-gradient(170deg,#3d2a0a 0%,#140d04 75%)" : c.kind === "story" ? (c.item.faith ? "linear-gradient(170deg,#2a1c0c 0%,#0e0904 80%)" : "linear-gradient(170deg,#0f2a33 0%,#061014 80%)") : c.kind === "dream" ? `linear-gradient(170deg,${c.dream.color} 0%,#0b0818 80%)` : bgFor(c.key);
  const wrap = (body: ReactNode, rail = true) => <div className="relative flex h-full flex-col justify-center px-7 pb-24 pt-20 sm:px-12" style={{ background: bg }}>
    <div className="mx-auto w-full max-w-xl">{near ? body : null}</div>{rail && near && <Rail liked={liked} onLike={onLike} onShare={onShare} />}<SwipeHint />
  </div>;
  switch (c.kind) {
    case "quote": return wrap(<><Tag>💬 Quote</Tag><p className="mt-6 font-serif text-[30px] font-semibold leading-[1.25] sm:text-4xl">“{c.item.text}”</p><p className="mt-6 text-base font-bold text-amber-200">— {c.item.by}</p></>);
    case "verse": return wrap(<><Tag>✝️ {c.item.ref}</Tag><p className="mt-6 font-serif text-[27px] leading-[1.35] sm:text-[34px]">{c.item.text}</p><p className="mt-6 text-sm font-bold text-amber-200">{c.item.ref} · KJV</p></>);
    case "advice": return wrap(<><Tag>🧭 {TONES.find((t) => t.id === c.item.tone)?.name} advice</Tag><h2 className="mt-5 text-4xl font-black leading-tight">{c.item.title}</h2><p className="mt-5 text-lg leading-8 text-white/85">{c.item.body}</p></>);
    case "lesson": return wrap(<><Tag>🧠 Mind lesson</Tag><h2 className="mt-5 text-4xl font-black leading-tight">{c.item.title}</h2><p className="mt-5 text-lg leading-8 text-white/85">{c.item.idea}</p><div className="mt-6 rounded-3xl bg-white/10 p-4 ring-1 ring-white/15"><p className="text-xs font-black uppercase tracking-widest text-emerald-300">Try this</p><p className="mt-1 text-base font-semibold">{c.item.try}</p></div></>);
    case "affirmation": return wrap(<div className="text-center"><Tag>✨ Say it out loud</Tag>
      <p className={`mt-8 text-[34px] font-black leading-tight transition duration-500 sm:text-5xl ${claimed ? "scale-105 text-amber-100 [text-shadow:0_0_30px_#ffd36e88]" : ""}`}>{c.item.text}</p>
      <button onClick={() => { setClaimed((n) => n + 1); onAffirm(); tap("light"); if (claimed === 2) confetti(); }} className="mt-10 min-h-14 rounded-full bg-white px-8 text-base font-black text-[#1c1440] transition active:scale-95">{claimed >= 3 ? "Believed it ✓" : claimed ? `Again (${claimed}/3)` : "I claim this"}</button>
      <p className="mt-3 text-xs text-white/50">Saying it three times helps it stick.</p></div>);
    case "prompt": {
      const saved = m.reflections.some((r) => r.prompt === c.item.text && r.date === today);
      return wrap(<><Tag>✍️ Reflect</Tag><h2 className="mt-5 text-3xl font-black leading-snug">{c.item.text}</h2>
        {saved ? <p className="mt-6 rounded-2xl bg-emerald-400/20 p-4 font-bold text-emerald-100">Saved to your journal ✓</p> : <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Write freely. Nobody sees this but you." className="mt-6 w-full rounded-3xl bg-white/10 p-4 text-base text-white outline-none ring-1 ring-white/20 placeholder:text-white/40 focus:ring-white/50" />
          <button disabled={!text.trim()} onClick={() => { setM((x) => ({ ...x, reflections: [...x.reflections, { id: makeId(), date: today, prompt: c.item.text, text: text.trim() }].slice(-2000) })); tap("success"); say("Saved to your journal · +5 growth"); window.setTimeout(onNext, 500); }} className="mt-3 min-h-12 w-full rounded-full bg-white font-black text-[#1c1440] disabled:opacity-40">Save to journal</button></>}</>);
    }
    case "challenge": {
      const row = m.challenges.find((x) => x.date === today && x.id === c.item.id);
      return wrap(<><Tag>🎯 Today's dare · {c.item.mins} min</Tag><h2 className="mt-5 text-4xl font-black leading-tight">{c.item.title}</h2><p className="mt-4 text-lg leading-8 text-white/85">{c.item.how}</p>
        {row?.done ? <p className="mt-8 rounded-2xl bg-emerald-400/25 p-4 text-center text-lg font-black text-emerald-100">Done · +10 growth 🏆</p>
          : <button onClick={() => { setM((x) => ({ ...x, challenges: row ? x.challenges.map((y) => (y === row ? { ...y, done: true } : y)) : [...x.challenges, { date: today, id: c.item.id, done: false }] })); if (row) { confetti(); tap("success"); say("Challenge complete · +10 growth"); } else { tap("light"); say("Challenge accepted — it's on your Today page"); } }}
            className={`mt-8 min-h-14 w-full rounded-full text-lg font-black transition active:scale-95 ${row ? "bg-emerald-400 text-emerald-950" : "bg-white text-[#1c1440]"}`}>{row ? "I did it ✓" : "Accept the challenge"}</button>}</>);
    }
    case "story": {
      const s = c.item, isLesson = c.part >= s.body.length;
      return wrap(<><Tag>📖 {s.faith ? "Bible story" : "True story"} · {Math.min(c.part + 1, s.body.length + 1)}/{s.body.length + 1}</Tag>
        {c.part === 0 && <h2 className="mt-4 text-4xl font-black leading-tight">{s.title}</h2>}{c.part === 0 && s.ref && <p className="mt-1 text-sm font-bold text-amber-200">{s.ref}</p>}
        {isLesson ? <><p className="mt-5 text-sm font-bold text-white/60">{s.title}</p><p className="mt-3 text-xs font-black uppercase tracking-widest text-emerald-300">What it means for you</p><p className="mt-3 text-[28px] font-black leading-snug">{s.lesson}</p></>
          : <p className={`${c.part === 0 ? "mt-6" : "mt-5"} font-serif text-[23px] leading-[1.5] text-white/95`}>{s.body[c.part]}</p>}
        <div className="mt-8 flex gap-1.5">{Array.from({ length: s.body.length + 1 }, (_, i) => <span key={i} className={`h-1 flex-1 rounded-full ${i <= c.part ? "bg-white" : "bg-white/20"}`} />)}</div></>, isLesson || c.part === 0);
    }
    case "breathe": return wrap(<div className="flex flex-col items-center text-center"><Tag>🌬️ One-minute reset</Tag>
      <div className="relative mt-10 flex h-56 w-56 items-center justify-center"><span className="absolute inset-0 rounded-full bg-cyan-300/20 animate-[mindBreathe_10s_ease-in-out_infinite]" /><span className="absolute inset-6 rounded-full bg-cyan-200/25 animate-[mindBreathe_10s_ease-in-out_infinite]" /><span className="relative text-lg font-black">Breathe</span></div>
      <p className="mt-10 text-xl font-bold">In as it grows for 4 · out as it shrinks for 6</p><p className="mt-2 text-sm text-white/60">Six slow breaths. Your nervous system will thank you.</p></div>, false);
    case "dream": {
      const d = c.dream, nextStep = d.steps.find((s) => !s.done);
      return wrap(<div className="text-center"><Tag>☁️ Your dream</Tag><p className="mt-6 text-8xl">{d.emoji}</p><h2 className="mt-5 text-4xl font-black leading-tight">{d.title}</h2>
        {d.why && <p className="mt-4 text-lg italic text-white/80">“{d.why}”</p>}
        {nextStep ? <button onClick={() => { setM((x) => ({ ...x, dreams: x.dreams.map((y) => (y.id === d.id ? { ...y, steps: y.steps.map((s) => (s.id === nextStep.id ? { ...s, done: true } : s)) } : y)) })); confetti(); say("Step done · you're closer"); }} className="mt-8 w-full rounded-3xl bg-white/15 p-4 text-left ring-1 ring-white/20"><span className="block text-xs font-black uppercase tracking-widest text-white/60">Next step — tap when done</span><span className="mt-1 block text-lg font-bold">{nextStep.text}</span></button>
          : <p className="mt-8 text-base text-white/75">Close your eyes for ten seconds and picture it already done. What do you see? What's one step toward it this week? Add it on your dream board.</p>}
      </div>, false);
    }
    case "win": return wrap(<><Tag>⭐ Proof you're growing</Tag><h2 className="mt-5 text-4xl font-black leading-tight">What's one win from today?</h2><p className="mt-3 text-base text-white/70">Big or small. Got up early, said no, drank water, finished something. Wins you write down are wins you remember.</p>
      <input value={text} onChange={(e) => setText(e.target.value.slice(0, 200))} placeholder="Today I…" className="mt-6 min-h-14 w-full rounded-2xl bg-white/10 px-4 text-lg font-semibold text-white outline-none ring-1 ring-white/20 placeholder:text-white/40" />
      <button disabled={!text.trim()} onClick={() => { setM((x) => ({ ...x, wins: [...x.wins, { id: makeId(), date: today, title: text.trim(), emoji: "⭐", cat: "other" }].slice(-3000) })); setText(""); confetti(); say("Win logged · +5 growth"); window.setTimeout(onNext, 600); }} className="mt-3 min-h-12 w-full rounded-full bg-white font-black text-[#1c1440] disabled:opacity-40">Log my win</button></>, false);
    default: return wrap(null, false);
  }
}

/* ─── Today ─── */
function TodayTab({ m, today, setM, makeId, say, onFeed }: { m: MindsetData; today: string; setM: SetM; makeId: () => string; say: (s: string) => void; onFeed: () => void }) {
  const p = todayPicks(m, today);
  const intention = m.intentions.find((x) => x.date === today)?.text ?? "";
  const [draft, setDraft] = useState(intention);
  const [answer, setAnswer] = useState("");
  const ch = p.challenge && m.challenges.find((x) => x.date === today && x.id === p.challenge!.id);
  const reflected = p.prompt && m.reflections.some((r) => r.date === today && r.prompt === p.prompt!.text);
  const block = (bg: string, children: ReactNode) => <div className="relative overflow-hidden rounded-[1.5rem] p-5 text-white shadow-[0_10px_30px_#17152b14]" style={{ background: bg }}>{children}</div>;
  return <div className="space-y-4">
    <Panel eyebrow="Today's intention" title="Who do you want to be today?">
      <div className="flex gap-2"><input value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 300))} placeholder="Patient. Focused. Brave enough to start." className={inputClass + " min-h-12"} />
        <button onClick={() => { setM((x) => ({ ...x, intentions: [...x.intentions.filter((i) => i.date !== today), { date: today, text: draft.trim() }].slice(-1000) })); say("Intention set"); }} disabled={!draft.trim() || draft.trim() === intention} className={primary + " min-h-12 px-4"}>Set</button></div>
    </Panel>
    {p.quote && block(BGS[0], <><Tag>💬 Quote of the day</Tag><p className="mt-3 font-serif text-2xl font-semibold leading-snug">“{p.quote.text}”</p><p className="mt-3 text-sm font-bold text-amber-200">— {p.quote.by}</p></>)}
    {p.verse && block("linear-gradient(160deg,#5a3d0c,#1c1205)", <><Tag>✝️ Verse of the day</Tag><p className="mt-3 font-serif text-xl leading-relaxed">{p.verse.text}</p><p className="mt-3 text-sm font-bold text-amber-200">{p.verse.ref} · KJV</p></>)}
    {p.affirmation && block(BGS[2], <><Tag>✨ Say it today</Tag><p className="mt-3 text-2xl font-black leading-snug">{p.affirmation.text}</p></>)}
    {p.challenge && <Panel eyebrow={`Today's challenge · ${p.challenge.mins} min`} title={p.challenge.title}>
      <p className="text-sm leading-6 text-slate-600">{p.challenge.how}</p>
      {ch?.done ? <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700">Done today · +10 growth 🏆</p>
        : <button onClick={() => { const id = p.challenge!.id; setM((x) => { const has = x.challenges.find((y) => y.date === today && y.id === id); return { ...x, challenges: has ? x.challenges.map((y) => (y === has ? { ...y, done: true } : y)) : [...x.challenges, { date: today, id, done: !!ch }] }; }); if (ch) { confetti(); say("Challenge complete · +10 growth"); } else say("Challenge accepted"); }} className={primary + " mt-3 min-h-12 w-full"}>{ch ? "I did it" : "Accept"}</button>}
    </Panel>}
    {p.prompt && <Panel eyebrow="Today's question" title={p.prompt.text}>
      {reflected ? <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700">Answered — it's in your journal.</p> : <>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={3} placeholder="Write a few honest lines…" className={inputClass + " py-3"} />
        <button disabled={!answer.trim()} onClick={() => { setM((x) => ({ ...x, reflections: [...x.reflections, { id: makeId(), date: today, prompt: p.prompt!.text, text: answer.trim() }] })); setAnswer(""); say("Saved to your journal"); }} className={primary + " mt-2 min-h-11 w-full"}>Save</button></>}
    </Panel>}
    {p.lesson && <Panel eyebrow="Mind lesson" title={p.lesson.title}><p className="text-sm leading-6 text-slate-600">{p.lesson.idea}</p><p className="mt-3 rounded-xl bg-violet-50 px-3 py-2.5 text-sm font-semibold text-violet-800">Try this: {p.lesson.try}</p></Panel>}
    {m.profile.why && <Panel eyebrow="Your why"><p className="font-serif text-lg italic leading-relaxed text-slate-700">“{m.profile.why}”</p></Panel>}
    <button onClick={onFeed} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#1c1932] text-base font-black text-white"><ChevronUp size={20} /> Keep going in my feed</button>
  </div>;
}

/* ─── Dream board ─── */
function Dreams({ m, today, setM, makeId, say }: { m: MindsetData; today: string; setM: SetM; makeId: () => string; say: (s: string) => void }) {
  const [edit, setEdit] = useState<Dream | null>(null);
  const open = m.dreams.filter((d) => !d.done), done = m.dreams.filter((d) => d.done);
  const blank = (): Dream => ({ id: "", title: "", emoji: "⭐", color: DREAM_COLORS[m.dreams.length % DREAM_COLORS.length], cat: "", why: "", target: "", steps: [], done: "", at: today });
  const tile = (d: Dream) => {
    const n = d.steps.length, k = d.steps.filter((s) => s.done).length;
    return <button key={d.id} onClick={() => setEdit(d)} className="group relative flex aspect-[4/5] flex-col overflow-hidden rounded-[1.5rem] p-4 text-left text-white shadow-lg transition active:scale-[.98]" style={{ background: `linear-gradient(160deg, ${d.color}, ${d.color}99 45%, #0b0818)` }}>
      <span className="text-5xl drop-shadow">{d.emoji}</span>
      <span className="mt-auto text-lg font-black leading-tight">{d.title}</span>
      {d.target && <span className="mt-1 text-[11px] font-bold text-white/75">by {shortDate(d.target, { month: "short", year: "numeric" })}</span>}
      {n > 0 && <span className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/25"><span className="block h-full rounded-full bg-white" style={{ width: `${(k / n) * 100}%` }} /></span>}
      {d.done && <span className="absolute right-3 top-3 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-emerald-700">ACHIEVED</span>}
    </button>;
  };
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {open.map(tile)}
      <button onClick={() => setEdit(blank())} data-testid="dream-add" className="flex aspect-[4/5] flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-violet-200 bg-white text-violet-700"><Plus size={28} /><span className="mt-2 text-sm font-black">Add a dream</span></button>
    </div>
    {!open.length && <Panel eyebrow="Ideas" title="Not sure where to start?"><div className="flex flex-wrap gap-2">{DREAM_IDEAS.map((d) => <button key={d.title} onClick={() => setEdit({ ...blank(), title: d.title, emoji: d.emoji, cat: d.cat })} className="rounded-full bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800">{d.emoji} {d.title}</button>)}</div></Panel>}
    {done.length > 0 && <Panel eyebrow={`${done.length} made real`} title="Dreams come true 🎉"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{done.map(tile)}</div></Panel>}
    {edit && <DreamSheet d={edit} makeId={makeId} onClose={() => setEdit(null)}
      onSave={(d) => { const isNew = !d.id; const saved = isNew ? { ...d, id: makeId() } : d; setM((x) => ({ ...x, dreams: isNew ? [...x.dreams, saved] : x.dreams.map((y) => (y.id === d.id ? saved : y)) })); if (d.done && !m.dreams.find((y) => y.id === d.id)?.done) { confetti(3); say("Dream made real. Look what you did 🎉"); } else say(isNew ? "On your dream board" : "Saved"); setEdit(null); }}
      onDelete={edit.id ? () => { if (!confirmed(`Remove "${edit.title}" from your board?`)) return; setM((x) => ({ ...x, dreams: x.dreams.filter((y) => y.id !== edit.id) })); setEdit(null); } : undefined} today={today} />}
  </div>;
}
function DreamSheet({ d: start, today, makeId, onClose, onSave, onDelete }: { d: Dream; today: string; makeId: () => string; onClose: () => void; onSave: (d: Dream) => void; onDelete?: () => void }) {
  const [d, setD] = useState(start);
  const [step, setStep] = useState("");
  const set = (p: Partial<Dream>) => setD((x) => ({ ...x, ...p }));
  return <Modal title={d.id ? d.title : "New dream"} eyebrow="Dream board" onClose={onClose}>
    <div className="space-y-4">
      <div className="flex gap-2"><input value={d.emoji} onChange={(e) => set({ emoji: [...e.target.value].slice(-2).join("") || "⭐" })} aria-label="Emoji" className="h-14 w-14 shrink-0 rounded-2xl border border-slate-200 text-center text-3xl" />
        <input autoFocus={!d.id} value={d.title} onChange={(e) => set({ title: e.target.value.slice(0, 120) })} placeholder="What's the dream?" className={inputClass + " min-h-14 text-base font-bold"} /></div>
      <div className="flex flex-wrap gap-2">{DREAM_COLORS.map((c) => <button type="button" key={c} onClick={() => set({ color: c })} aria-label={`Color ${c}`} aria-pressed={d.color === c} className={`h-9 w-9 rounded-full ring-offset-2 ${d.color === c ? "ring-2 ring-slate-800" : ""}`} style={{ background: c }} />)}</div>
      <div className="flex flex-wrap gap-1.5">{DREAM_CATS.map((c) => <button type="button" key={c.id} onClick={() => set({ cat: d.cat === c.id ? "" : c.id })} aria-pressed={d.cat === c.id} className={`min-h-9 rounded-full px-3 text-xs font-bold ring-1 ${d.cat === c.id ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-slate-600 ring-slate-200"}`}>{c.emoji} {c.name}</button>)}</div>
      <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Why it matters to you</span><textarea value={d.why} onChange={(e) => set({ why: e.target.value.slice(0, 600) })} rows={2} className={inputClass + " py-3"} placeholder="Because…" /></label>
      <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">By when (optional)</span><input type="date" value={d.target} min={today} onChange={(e) => set({ target: e.target.value })} className={inputClass} /></label>
      <div><p className="mb-1.5 text-xs font-bold text-slate-600">Steps to get there</p>
        <div className="space-y-1.5">{d.steps.map((s) => <div key={s.id} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2">
          <button type="button" onClick={() => set({ steps: d.steps.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })} aria-pressed={s.done} aria-label={s.text} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${s.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}>{s.done && <Check size={16} />}</button>
          <span className={`min-w-0 flex-1 text-sm font-semibold ${s.done ? "text-slate-400 line-through" : "text-slate-800"}`}>{s.text}</span>
          <button type="button" onClick={() => set({ steps: d.steps.filter((x) => x.id !== s.id) })} aria-label="Remove step" className="p-1 text-slate-400"><X size={16} /></button></div>)}</div>
        <form onSubmit={(e) => { e.preventDefault(); if (!step.trim()) return; set({ steps: [...d.steps, { id: makeId(), text: step.trim().slice(0, 160), done: false }].slice(0, 30) }); setStep(""); }} className="mt-2 flex gap-2"><input value={step} onChange={(e) => setStep(e.target.value)} placeholder="Next small step" className={inputClass} /><button className="min-h-11 rounded-xl bg-violet-50 px-3 text-sm font-bold text-violet-700">Add</button></form></div>
      {d.id && <button type="button" onClick={() => set({ done: d.done ? "" : today })} className={`min-h-12 w-full rounded-xl text-sm font-black ${d.done ? "bg-slate-100 text-slate-600" : "bg-emerald-500 text-white"}`}>{d.done ? "Not achieved yet" : "🎉 I achieved this"}</button>}
      <div className={stickyFoot}><button onClick={() => d.title.trim() && onSave({ ...d, title: d.title.trim() })} disabled={!d.title.trim()} className={primary + " min-h-12 flex-1"}>{d.id ? "Save" : "Put it on my board"}</button>
        {onDelete && <button onClick={onDelete} aria-label="Remove dream" className="min-h-12 rounded-xl border border-rose-100 bg-rose-50 px-4 text-rose-600"><Trash2 size={17} /></button>}</div>
    </div>
  </Modal>;
}

/* ─── Wins ─── */
function Wins({ m, today, setM, makeId, say }: { m: MindsetData; today: string; setM: SetM; makeId: () => string; say: (s: string) => void }) {
  const [title, setTitle] = useState("");
  const [cat, setCat] = useState("other");
  const byMonth = useMemo(() => { const g = new Map<string, typeof m.wins>(); for (const w of [...m.wins].reverse()) g.set(w.date.slice(0, 7), [...(g.get(w.date.slice(0, 7)) || []), w]); return [...g]; }, [m.wins]);
  const thisWeek = m.wins.filter((w) => w.date > new Date(Date.parse(`${today}T12:00:00Z`) - 7 * 864e5).toISOString().slice(0, 10)).length;
  const add = () => { if (!title.trim()) return; const c = WIN_CATS.find((x) => x.id === cat)!; setM((x) => ({ ...x, wins: [...x.wins, { id: makeId(), date: today, title: title.trim(), emoji: c.emoji, cat }].slice(-3000) })); setTitle(""); confetti(); say("Win logged · +5 growth"); };
  return <div className="space-y-4">
    <div className="grid grid-cols-3 gap-2.5">{[["Total wins", m.wins.length, "🏆"], ["This week", thisWeek, "📅"], ["Today", m.wins.filter((w) => w.date === today).length, "⭐"]].map(([l, v, e]) => <div key={l as string} className="rounded-2xl bg-white p-3 text-center ring-1 ring-slate-200"><p className="text-xl">{e}</p><p className="text-2xl font-black text-slate-800">{v}</p><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{l}</p></div>)}</div>
    <Panel eyebrow="Log a win" title="What went right?">
      <div className="mb-3 flex flex-wrap gap-1.5">{WIN_CATS.map((c) => <button key={c.id} onClick={() => setCat(c.id)} aria-pressed={cat === c.id} className={`min-h-9 rounded-full px-3 text-xs font-bold ring-1 ${cat === c.id ? "bg-amber-500 text-white ring-amber-500" : "bg-white text-slate-600 ring-slate-200"}`}>{c.emoji} {c.name}</button>)}</div>
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2"><input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 200))} placeholder="Went to the gym even though I didn't want to" className={inputClass + " min-h-12"} /><button disabled={!title.trim()} className={primary + " min-h-12 px-4"}>Add</button></form>
    </Panel>
    {byMonth.map(([month, wins]) => <Panel key={month} eyebrow={`${wins.length} win${wins.length === 1 ? "" : "s"}`} title={new Date(`${month}-15T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })}>
      <ul className="space-y-2">{wins.map((w) => <li key={w.id} className="flex items-center gap-3 rounded-xl bg-amber-50/60 p-2.5"><span className="text-xl">{w.emoji}</span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-800">{w.title}</span><span className="text-[11px] text-slate-500">{shortDate(w.date)}</span></span>
        <button onClick={() => { if (confirmed("Delete this win?")) setM((x) => ({ ...x, wins: x.wins.filter((y) => y.id !== w.id) })); }} aria-label="Delete win" className="p-1.5 text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button></li>)}</ul>
    </Panel>)}
    {!m.wins.length && <p className="px-2 text-center text-sm text-slate-500">Your wins will live here. On hard days, scroll back and see how far you've come.</p>}
  </div>;
}

/* ─── Journal ─── */
function Journal({ m, today, setM, makeId, say }: { m: MindsetData; today: string; setM: SetM; makeId: () => string; say: (s: string) => void }) {
  const [text, setText] = useState("");
  const prompt = todayPicks(m, today).prompt?.text ?? "What's on your mind?";
  const list = [...m.reflections].reverse();
  return <div className="space-y-4">
    <Panel eyebrow="Write" title={prompt}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Just start typing…" className={inputClass + " py-3"} />
      <button disabled={!text.trim()} onClick={() => { setM((x) => ({ ...x, reflections: [...x.reflections, { id: makeId(), date: today, prompt, text: text.trim() }] })); setText(""); say("Saved · +5 growth"); }} className={primary + " mt-2 min-h-11 w-full"}>Save entry</button>
    </Panel>
    {list.map((r) => <Panel key={r.id} eyebrow={shortDate(r.date, { weekday: "long", month: "long", day: "numeric" })}>
      <p className="text-xs font-bold text-violet-700">{r.prompt}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{r.text}</p>
      <button onClick={() => { if (confirmed("Delete this entry?")) setM((x) => ({ ...x, reflections: x.reflections.filter((y) => y.id !== r.id) })); }} className="mt-2 text-xs font-bold text-slate-400 hover:text-rose-500">Delete</button>
    </Panel>)}
    {!list.length && <p className="text-center text-sm text-slate-500">Your reflections from the feed and here are kept together, just for you.</p>}
  </div>;
}

/* ─── Saved ─── */
function Saved({ m, setM, say }: { m: MindsetData; setM: SetM; say: (s: string) => void }) {
  const [kind, setKind] = useState("");
  const cards = [...m.likes].reverse().map(findCard).filter((c): c is Card => !!c && (!kind || c.kind === kind));
  if (!m.likes.length) return <Panel><div className="py-8 text-center"><p className="text-4xl">❤️</p><p className="mt-2 font-black text-slate-800">Nothing saved yet</p><p className="mt-1 text-sm text-slate-500">Tap the heart on any card in your feed to keep it here.</p></div></Panel>;
  return <div className="space-y-3">
    <div className="flex flex-wrap gap-1.5"><button onClick={() => setKind("")} aria-pressed={!kind} className={`min-h-9 rounded-full px-3 text-xs font-bold ring-1 ${!kind ? "bg-slate-800 text-white ring-slate-800" : "bg-white text-slate-600 ring-slate-200"}`}>All</button>
      {KINDS.filter((k) => k.id !== "breathe").map((k) => <button key={k.id} onClick={() => setKind(kind === k.id ? "" : k.id)} aria-pressed={kind === k.id} className={`min-h-9 rounded-full px-3 text-xs font-bold ring-1 ${kind === k.id ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-slate-600 ring-slate-200"}`}>{k.emoji} {k.name}</button>)}</div>
    {cards.map((c) => <div key={c.key} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="whitespace-pre-wrap text-[15px] leading-6 text-slate-800">{cardText(c)}</p>
      <div className="mt-2 flex gap-3 text-xs font-bold"><button onClick={() => { void navigator.clipboard?.writeText(cardText(c)); say("Copied"); }} className="text-violet-700">Copy</button><button onClick={() => setM((x) => ({ ...x, likes: x.likes.filter((l) => l !== cardId(c)) }))} className="text-slate-400">Remove</button></div>
    </div>)}
  </div>;
}

/* ─── Growth: the real numbers ─── */
function Growth({ m, today }: { m: MindsetData; today: string }) {
  const t = totals(m), g = growth(m), st = mindStreak(m, today), b = mindBadges(m, today), earned = b.filter((x) => x.earned).length;
  const days = recentDays(m, today, 30), top = Math.max(m.profile.minutes, ...days.map((d) => d.mins));
  const weeks = recentDays(m, today, 84);
  const tile = (label: string, value: ReactNode, emoji: string) => <div className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-200"><p className="text-xl">{emoji}</p><p className="mt-1 text-2xl font-black text-slate-800">{value}</p><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p></div>;
  return <div className="space-y-5">
    <section className="rounded-[1.5rem] bg-[#1c1932] p-5 text-white"><p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-white/60">Growth level</p><p className="mt-1 text-3xl font-black">Level {g.level} · {g.title}</p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-pink-400" style={{ width: `${(g.into / g.need) * 100}%` }} /></div>
      <p className="mt-2 text-xs text-white/60">{g.need - g.into} points to level {g.level + 1}. Points: 1 per minute, 5 per reflection or win, 10 per challenge, 3 per dream step, 25 per dream reached.</p>
      {m.profile.startedAt && <p className="mt-3 text-sm font-semibold text-white/80">You started on {shortDate(m.profile.startedAt, { month: "long", day: "numeric", year: "numeric" })}.</p>}</section>
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {tile("Time invested", fmtMins(t.minutes), "⏳")}{tile("Streak", `${st.days} · best ${Math.max(st.best, st.days)}`, "🔥")}{tile("Active days", t.activeDays, "📆")}{tile("Cards read", t.cards.toLocaleString(), "📚")}
      {tile("Reflections", `${t.reflections} · ${t.words.toLocaleString()} words`, "✍️")}{tile("Challenges done", t.challenges, "🎯")}{tile("Wins logged", t.wins, "⭐")}{tile("Dreams reached", `${t.dreamsDone} of ${m.dreams.length}`, "☁️")}
    </div>
    <Panel eyebrow="Last 30 days" title={`${fmtMins(days.reduce((s, d) => s + d.mins, 0))} for your mind`}>
      <div className="relative flex h-32 items-end gap-[3px]">
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-amber-400" style={{ bottom: `${(m.profile.minutes / top) * 100}%` }}><span className="absolute -top-4 right-0 text-[10px] font-bold text-amber-600">goal {m.profile.minutes}m</span></div>
        {days.map((d) => <div key={d.date} title={`${shortDate(d.date)}: ${d.mins} min`} className={`flex-1 rounded-t ${d.mins >= m.profile.minutes ? "bg-gradient-to-t from-violet-600 to-fuchsia-400" : d.mins ? "bg-violet-300" : "bg-slate-100"}`} style={{ height: `${Math.max(3, (d.mins / top) * 100)}%` }} />)}
      </div>
    </Panel>
    <Panel eyebrow="12 weeks" title="Showing up">
      <div className="grid grid-flow-col grid-rows-7 gap-1">{weeks.map((d) => <span key={d.date} title={`${shortDate(d.date)}: ${d.mins} min`} className="aspect-square rounded-[4px]" style={{ background: d.mins === 0 ? "#eef0f6" : d.mins >= m.profile.minutes ? "#6d3df5" : d.mins >= m.profile.minutes / 2 ? "#a78bfa" : "#ddd6fe" }} />)}</div>
    </Panel>
    <Panel eyebrow={`${earned} of ${b.length} earned`} title="Badges">
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">{b.map((x) => <div key={x.id} title={x.blurb} className={`flex flex-col items-center rounded-2xl p-3 text-center ring-1 ${x.earned ? "bg-gradient-to-b from-violet-50 to-white ring-violet-200" : "bg-slate-50 ring-slate-200"}`}>
        <span className={`text-3xl ${x.earned ? "" : "opacity-35 grayscale"}`}>{x.emoji}</span><span className={`mt-1 text-[11px] font-black leading-tight ${x.earned ? "text-slate-800" : "text-slate-500"}`}>{x.name}</span>
        {!x.earned && <><div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-violet-500" style={{ width: `${(x.have / x.goal) * 100}%` }} /></div><span className="mt-0.5 text-[10px] font-bold text-slate-400">{x.have.toLocaleString()}/{x.goal.toLocaleString()}</span></>}
      </div>)}</div>
    </Panel>
    <p className="px-2 text-center text-xs leading-5 text-slate-400"><Sparkles size={12} className="mr-1 inline" />Every number here is something you actually did. That's the point.</p>
  </div>;
}
