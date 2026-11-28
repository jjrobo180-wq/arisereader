// The daily check-in (shared/rise.ts): a card at the top of LifeHub's task list with one ring and one streak for
// everything, and a 60-second swipe-through of today's check-ins, one tap each, starting with why it matters.
// A reminder's link (?rise=<check-in id>, &act=same from a meal reminder's button) opens it right on that card.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronUp, Flame, Plus, Settings2, Share2, Snowflake, TrendingUp, X } from "lucide-react";
import { Modal, inputClass, primary } from "@/components/family-hub/ui";
import { SwipeFeed, type SwipeFeedHandle } from "@/components/swipe/SwipeFeed";
import { confetti, tap } from "@/lib/celebrate";
import { estimateMeal } from "@/lib/foodLookup";
import { DREAM_IDEAS } from "@shared/mindset";
import { counts, emptyRise, motivation, progressText, riseStreak, weekRecap, weightGoal, type RiseData } from "@shared/rise";
import { clock12, type Checkin, type FoodIn } from "@shared/dailyCheckins";
import type { DailyApi } from "./useDailyCheckins";

const MEAL_NAME: Record<string, string> = { breakfast: "breakfast", lunch: "lunch", dinner: "dinner", snacks: "snack", snack: "snack" };
const KIND_EMOJI: Record<string, string> = { meal: "🍽️", workout: "🏋️", water: "💧", weight: "⚖️", sleep: "😴", fast: "⏳", yoga: "🧘", breathe: "🌬️", stretch: "🤸", med: "💊", pill: "💊", habit: "🔁", routine: "📋", acct: "🤝", chore: "🏠", custom: "✅" };
const KIND_BG: Record<string, string> = { meal: "#7c2d12", workout: "#3b2a8a", water: "#0c4a6e", weight: "#134e4a", med: "#831843", pill: "#831843", habit: "#14532d", chore: "#7c2d12", custom: "#312e81" };
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const toUnits = (kg: number, units: "lb" | "kg") => Math.round((units === "lb" ? kg * 2.20462 : kg) * 10) / 10;

/** Pending "open the check-in on this card" from a reminder link. */
function readLink(): { card: string; act: string } | null {
  const h = window.location.hash, q = h.indexOf("?");
  if (q < 0) return null;
  const p = new URLSearchParams(h.slice(q + 1)), card = p.get("rise");
  if (!card) return null;
  const act = p.get("act") || "";
  p.delete("rise"); p.delete("act");
  const rest = p.toString();
  try { window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${h.slice(0, q)}${rest ? `?${rest}` : ""}`); } catch { /* fine */ }
  return { card, act };
}

/** The meal last time (the most recent earlier day it was logged). */
function lastMeal(d: DailyApi, meal: string): { date: string; foods: FoodIn[] } | null {
  const before = d.fit.foods.filter((f) => f.meal === meal && f.date < d.date);
  if (!before.length) return null;
  const date = before.reduce((m, f) => (f.date > m ? f.date : m), "");
  return { date, foods: before.filter((f) => f.date === date).map((f) => ({ name: f.name, kcal: f.kcal, p: f.p, c: f.c, f: f.f, serving: f.serving, servings: f.servings })) };
}

export function RiseCard({ d }: { d: DailyApi }) {
  const [open, setOpen] = useState<{ at: string } | null>(null);
  const [setup, setSetup] = useState(false);
  const [recap, setRecap] = useState(false);
  const rise = d.family?.rise;
  const ensure = () => d.setFamily((f) => (f.rise ? f : { ...f, rise: emptyRise() }));

  // A reminder link opens it on its card (and "Same as last time" logs that meal again).
  const latest = useRef(d);
  latest.current = d;
  useEffect(() => {
    const go = () => {
      const link = readLink();
      if (!link) return;
      ensure();
      const dd = latest.current;
      const c = dd.items.find((x) => x.id === link.card);
      if (link.act === "same" && c?.kind === "meal") {
        const last = lastMeal(dd, c.meal!);
        if (last) { dd.logMeal(c, last.foods); tap("success"); return; }
      }
      setOpen({ at: c ? c.id : "start" });
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (d.shared || !d.family || !d.settings.on || (!d.total && !rise)) return null;
  const st = rise ? riseStreak(rise, d.date) : { days: 0, today: false, frozen: [], best: 0, freezeReady: true };
  const pct = d.total ? d.done / d.total : 0, R = 30, C = 2 * Math.PI * R;
  const units = d.fit.profile.units;
  const nowKg = d.fit.weights.length ? d.fit.weights[d.fit.weights.length - 1].kg : undefined;
  const goal = weightGoal(nowKg, d.fit.profile.goalKg, rise?.startKg, units);
  const left = d.items.filter((c) => !c.done).length;
  const todayCounts = counts({ date: d.date, done: d.done, total: d.total });
  return <section className="relative overflow-hidden rounded-[1.6rem] bg-[radial-gradient(120%_130%_at_0%_0%,#8b6dff_0%,#5b3fe0_45%,#1d1645_100%)] p-4 text-white shadow-[0_14px_40px_#4b2fd12e]" data-testid="rise-card">
    <div className="flex items-center gap-4">
      <div className="relative h-[76px] w-[76px] shrink-0">
        <svg viewBox="0 0 72 72" className="h-[76px] w-[76px] -rotate-90"><circle cx="36" cy="36" r={R} fill="none" stroke="#ffffff26" strokeWidth="8" /><circle cx="36" cy="36" r={R} fill="none" stroke={todayCounts ? "#7fffd4" : "#ffd36e"} strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} className="transition-all duration-700" /></svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-lg font-black leading-none">{d.done}<span className="text-xs text-white/60">/{d.total}</span></span><span className="text-[9px] font-bold uppercase tracking-wider text-white/70">today</span></div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black ${st.days ? "bg-orange-400/25 text-orange-100" : "bg-white/10 text-white/80"}`}><Flame size={14} className={st.days ? "fill-orange-300 text-orange-300" : ""} />{st.days} day{st.days === 1 ? "" : "s"}</span>
          {rise && st.freezeReady && st.days > 2 && <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-sky-300/20 px-2 py-1 text-[11px] font-bold text-sky-100" title="One missed day a week is forgiven"><Snowflake size={12} />freeze ready</span>}
          <button onClick={() => { ensure(); setSetup(true); }} aria-label="Why, goals and nudges" className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/15" data-testid="rise-setup-open"><Settings2 size={17} /></button>
        </div>
        <p className="mt-1.5 text-[15px] font-black leading-snug">{todayCounts ? (left ? `Today counts. ${left} more if you've got a minute.` : "Every check-in done. That's a perfect day.") : st.days && !st.today ? `Keep your streak: ${Math.max(1, Math.ceil(d.total / 2) - d.done)} more today.` : left ? `${left} check-in${left === 1 ? "" : "s"} · about a minute` : "Your day"}</p>
        {goal && <div className="mt-1.5"><div className="flex justify-between text-[11px] font-bold text-white/75"><span>{goal.text}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-[#7fffd4] to-[#ffe27a]" style={{ width: `${goal.pct * 100}%` }} /></div></div>}
      </div>
    </div>
    {rise && (rise.why || rise.vision.length > 0) && <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none]">
      {rise.why && <span className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">💭 {rise.why.length > 60 ? `${rise.why.slice(0, 58)}…` : rise.why}</span>}
      {rise.vision.map((v) => <span key={v.id} className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">{v.emoji} {v.text}</span>)}
    </div>}
    <div className="mt-3 flex gap-2">
      <button onClick={() => { ensure(); setOpen({ at: "start" }); }} data-testid="rise-start" className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-black text-[#241c52] shadow-lg transition active:scale-[.98]"><ChevronUp size={19} />{left ? "60-second check-in" : "Look back at today"}</button>
      <button onClick={() => { ensure(); setRecap(true); }} data-testid="rise-week" className="flex min-h-12 items-center gap-1.5 rounded-2xl bg-white/15 px-4 text-sm font-black"><TrendingUp size={17} />Week</button>
    </div>
    {open && <RiseCheckin d={d} startAt={open.at} onClose={() => setOpen(null)} />}
    {setup && <RiseSetup d={d} onClose={() => setSetup(false)} />}
    {recap && <RiseRecap d={d} onClose={() => setRecap(false)} />}
  </section>;
}

/* ─── The 60-second check-in ─── */
function RiseCheckin({ d, startAt, onClose }: { d: DailyApi; startAt: string; onClose: () => void }) {
  // The cards are today's check-ins still to do when it opened (or every one, if all are done).
  const ids = useMemo(() => { const todo = d.items.filter((c) => !c.done); return (todo.length ? todo : d.items).map((c) => c.id); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const feed = useRef<SwipeFeedHandle>(null);
  const [touched, setTouched] = useState<string[]>([]);
  const rise = d.family?.rise ?? emptyRise();
  const next = () => window.setTimeout(() => feed.current?.next(), 380);
  const did = (id: string) => { setTouched((t) => (t.includes(id) ? t : [...t, id])); tap("light"); next(); };
  useEffect(() => { const i = ids.indexOf(startAt); if (i >= 0) window.setTimeout(() => feed.current?.goTo(i + 1), 80); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const cards = ids.map((id) => { const c = d.items.find((x) => x.id === id); return c ? <CheckCard key={id} c={c} d={d} done={() => did(id)} skip={next} /> : <div key={id} />; });
  const st = riseStreak({ days: [...rise.days.filter((x) => x.date !== d.date), { date: d.date, done: d.done, total: d.total }] }, d.date);
  const todayCounts = counts({ date: d.date, done: d.done, total: d.total });
  const [celebrated, setCelebrated] = useState(false);
  const intro = <Intro d={d} rise={rise} count={ids.length} go={() => feed.current?.next()} />;
  const end = <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(100%_80%_at_50%_10%,#16a34a,#0d0b1a_75%)] px-7 text-center">
    <p className="text-7xl">{todayCounts ? "🔥" : "🌱"}</p>
    <h2 className="mt-4 text-3xl font-black">{d.done} of {d.total} done</h2>
    <p className="mt-2 text-lg font-bold text-white/85">{todayCounts ? `${st.days}-day streak${st.days >= st.best && st.days > 2 ? " — your best yet" : ""}` : `${Math.max(1, Math.ceil(d.total / 2) - d.done)} more and today counts`}</p>
    <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">{motivation(rise, d.date, "end") || "That's how it's done: a minute a day, every day."}</p>
    <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
      <button onClick={() => { void shareProgress(d, rise); }} className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-white/15 font-black"><Share2 size={17} />Send to {rise.buddy || "a friend"}</button>
      <button onClick={onClose} className="min-h-14 rounded-full bg-white text-lg font-black text-[#1c1932]">Done</button>
    </div>
  </div>;
  return <SwipeFeed ref={feed} pages={[intro, ...cards, end]} label="Daily check-in" onClose={onClose}
    top={<div className="rounded-full bg-black/35 px-3.5 py-2 text-sm font-black backdrop-blur">{d.done}/{d.total}{touched.length ? ` · +${touched.length}` : ""}</div>}
    onIndex={(i) => { if (i === ids.length + 1 && todayCounts && !celebrated) { setCelebrated(true); confetti(2); tap("success"); } }} />;
}

async function shareProgress(d: DailyApi, rise: RiseData) {
  const text = progressText(rise, d.date, d.done, d.total);
  try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); } } catch { /* closed */ }
}

function Intro({ d, rise, count, go }: { d: DailyApi; rise: RiseData; count: number; go: () => void }) {
  const [why, setWhy] = useState("");
  const units = d.fit.profile.units;
  const nowKg = d.fit.weights.length ? d.fit.weights[d.fit.weights.length - 1].kg : undefined;
  const goal = weightGoal(nowKg, d.fit.profile.goalKg, rise.startKg, units);
  return <div className="flex h-full flex-col justify-center bg-[radial-gradient(110%_80%_at_50%_0%,#6d3df5,#120c2e_70%)] px-7 pb-24 pt-20 text-white">
    <div className="mx-auto w-full max-w-md">
      <p className="text-[11px] font-extrabold uppercase tracking-[.25em] text-white/60">Your 60 seconds</p>
      {rise.why ? <p className="mt-5 font-serif text-[28px] font-semibold leading-snug">“{rise.why}”</p>
        : <><h2 className="mt-5 text-3xl font-black leading-tight">Why are you doing this?</h2><p className="mt-2 text-sm text-white/70">One line. We'll remind you of it when it's hard.</p>
          <div className="mt-4 flex gap-2"><input value={why} onChange={(e) => setWhy(e.target.value.slice(0, 400))} placeholder="To keep up with my kids" className="min-h-12 w-full rounded-2xl bg-white/10 px-4 text-white outline-none ring-1 ring-white/20 placeholder:text-white/40" />
            <button disabled={!why.trim()} onClick={() => d.setFamily((f) => ({ ...f, rise: { ...(f.rise ?? emptyRise()), why: why.trim() } }))} className="min-h-12 rounded-2xl bg-white px-4 font-black text-[#1c1440] disabled:opacity-40">Save</button></div></>}
      {goal && <div className="mt-6 rounded-3xl bg-white/10 p-4 ring-1 ring-white/15"><p className="text-sm font-black">⚖️ {goal.text}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-[#7fffd4] to-[#ffe27a]" style={{ width: `${goal.pct * 100}%` }} /></div></div>}
      {rise.vision.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{rise.vision.slice(0, 6).map((v) => <span key={v.id} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">{v.emoji} {v.text}</span>)}</div>}
      <button onClick={go} className="mt-8 min-h-14 w-full rounded-full bg-white text-lg font-black text-[#1c1440] shadow-2xl active:scale-[.98]" data-testid="rise-go">{count ? `Let's go · ${count} thing${count === 1 ? "" : "s"}` : "See today"}</button>
    </div>
  </div>;
}

function CheckCard({ c, d, done, skip }: { c: Checkin; d: DailyApi; done: () => void; skip: () => void }) {
  const bg = `radial-gradient(110% 75% at 50% 10%, ${KIND_BG[c.kind] || "#312e81"}, #0d0b1a 78%)`;
  const wrap = (body: ReactNode) => <div className="flex h-full flex-col justify-center px-6 pb-24 pt-20 text-white" style={{ background: bg }}>
    <div className="mx-auto w-full max-w-md">
      <p className="text-[11px] font-extrabold uppercase tracking-[.25em] text-white/60">{KIND_EMOJI[c.kind]} {c.time ? clock12(c.time) : "Today"}{c.done ? " · done ✓" : ""}</p>
      <h2 className="mt-3 text-[34px] font-black leading-tight">{c.title}</h2>
      {c.detail && <p className="mt-1 text-sm font-semibold text-white/60">{c.detail}</p>}
      <div className="mt-7">{body}</div>
    </div>
    <div className="pointer-events-none absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col items-center text-white/40"><ChevronUp size={20} className="animate-bounce" /><span className="text-[10px] font-bold uppercase tracking-widest">Swipe to skip</span></div>
  </div>;
  const big = "flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl text-[17px] font-black transition active:scale-[.98]";
  const white = `${big} bg-white text-[#1c1440]`, ghost = `${big} bg-white/12 text-white ring-1 ring-white/20`;
  if (c.kind === "acct" && !c.quick) return wrap(<button className={white} onClick={() => d.open(c)}>Open it</button>);
  switch (c.kind) {
    case "meal": return wrap(<MealBody c={c} d={d} done={done} white={white} ghost={ghost} />);
    case "water": {
      const p = c.progress;
      return wrap(<div className="space-y-3"><p className="text-center text-6xl font-black">{p ? Math.round(p.now / 250) : 0}<span className="text-2xl text-white/50"> / {p ? Math.round(p.goal / 250) : 8} cups</span></p>
        <button className={white} onClick={() => { d.addWater(250); tap("light"); }}>💧 +1 cup</button>
        <div className="grid grid-cols-2 gap-2"><button className={ghost} onClick={() => { d.addWater(500); tap("light"); }}>+2 cups</button><button className={ghost} onClick={done}>That's it for now</button></div></div>);
    }
    case "weight": return wrap(<WeightBody d={d} done={done} white={white} />);
    case "workout": return wrap(<div className="space-y-2"><div className="grid grid-cols-2 gap-2">{[["Walk", 20], ["Run", 30], ["Gym", 45], ["Yoga", 20], ["Bike", 30], ["Stretch", 10]].map(([n, m]) => <button key={n} className={ghost} onClick={() => { d.logWorkout(n as string, m as number); done(); }}>{n} · {m}m</button>)}</div>
      <button className={white} onClick={() => { if (!c.done) d.toggle(c); done(); }}>Rest day</button></div>);
    case "med": case "pill": return wrap(<div className="space-y-2"><button className={white} onClick={() => { d.dose(c, "taken"); done(); }}><Check size={20} /> Taken</button><button className={ghost} onClick={() => { d.dose(c, "skipped"); done(); }}>Skipped</button></div>);
    default: return wrap(c.done ? <button className={white} onClick={skip}>Already done ✓</button> : <div className="space-y-2">
      <button className={white} onClick={() => { if (d.toggle(c) === "open") { d.open(c); return; } done(); }} data-testid="rise-done"><Check size={20} /> Done</button>
      <button className={ghost} onClick={skip}>Not yet</button></div>);
  }
}

function MealBody({ c, d, done, white, ghost }: { c: Checkin; d: DailyApi; done: () => void; white: string; ghost: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const logged = d.fit.foods.filter((f) => f.date === d.date && f.meal === c.meal);
  const last = lastMeal(d, c.meal!);
  const recent = d.fit.recentFoods.filter((r) => !logged.some((l) => l.name === r.name)).slice(0, 6);
  const word = MEAL_NAME[c.meal || ""] || "meal";
  const typed = async () => {
    const words = text.trim(); if (!words) return;
    setBusy(true);
    try { const found = await estimateMeal(d.token, words, null); d.logMeal(c, found.length ? found.map((f) => ({ name: f.brand ? `${f.name} (${f.brand})` : f.name, kcal: f.calories, p: f.protein, c: f.carbs, f: f.fat, serving: f.serving })) : [{ name: words, kcal: 0 }]); }
    catch { d.logMeal(c, [{ name: words, kcal: 0 }]); }
    finally { setBusy(false); setText(""); }
  };
  return <div className="space-y-3">
    {logged.length > 0 && <p className="rounded-2xl bg-emerald-400/15 px-4 py-3 text-sm font-bold text-emerald-100">✓ {logged.map((f) => f.name).join(", ")} · {fmt(logged.reduce((s, f) => s + f.kcal * f.servings, 0))} cal</p>}
    {last && <button className={white} onClick={() => { d.logMeal(c, last.foods); done(); }} data-testid="rise-same">Same as last {word} <span className="text-sm font-bold text-slate-500">· {fmt(last.foods.reduce((s, f) => s + f.kcal * (f.servings || 1), 0))} cal</span></button>}
    {last && <p className="-mt-1 truncate px-1 text-center text-xs text-white/50">{last.foods.map((f) => f.name).join(", ")}</p>}
    {recent.length > 0 && <div className="flex flex-wrap gap-2">{recent.map((r) => <button key={r.name} onClick={() => { d.logMeal(c, [{ ...r }]); tap("light"); }} className="inline-flex min-h-10 max-w-full items-center gap-1 rounded-full bg-white/12 px-3.5 text-sm font-bold ring-1 ring-white/15"><Plus size={14} /><span className="truncate">{r.name}</span></button>)}</div>}
    <form onSubmit={(e) => { e.preventDefault(); void typed(); }} className="flex gap-2"><input value={text} onChange={(e) => setText(e.target.value)} placeholder={`What did you have?`} className="min-h-12 w-full rounded-2xl bg-white/10 px-4 text-white outline-none ring-1 ring-white/20 placeholder:text-white/40" />
      <button disabled={!text.trim() || busy} className="min-h-12 rounded-2xl bg-white px-4 font-black text-[#1c1440] disabled:opacity-40">{busy ? "…" : "Add"}</button></form>
    <div className="grid grid-cols-2 gap-2">
      {logged.length ? <button className={ghost} onClick={done}>That's all</button> : <button className={ghost} onClick={() => { if (!c.done) d.toggle(c); done(); }}>Ate, no log</button>}
      <button className={ghost} onClick={() => { if (!c.done) d.toggle(c); done(); }}>Skipped it</button>
    </div>
  </div>;
}

function WeightBody({ d, done, white }: { d: DailyApi; done: () => void; white: string }) {
  const units = d.fit.profile.units, last = d.fit.weights.length ? d.fit.weights[d.fit.weights.length - 1].kg : 0;
  const [v, setV] = useState(last ? toUnits(last, units) : 0);
  const step = units === "lb" ? 0.2 : 0.1;
  const goal = weightGoal(last || undefined, d.fit.profile.goalKg, d.family?.rise?.startKg, units);
  return <div className="space-y-3">
    <div className="flex items-center justify-center gap-3">
      <button onClick={() => setV((x) => Math.round((x - step) * 10) / 10)} className="h-14 w-14 rounded-full bg-white/12 text-3xl font-black" aria-label="Less">−</button>
      <input type="number" inputMode="decimal" value={v || ""} onChange={(e) => setV(Number(e.target.value))} className="w-36 bg-transparent text-center text-5xl font-black outline-none" aria-label={`Weight in ${units}`} />
      <button onClick={() => setV((x) => Math.round((x + step) * 10) / 10)} className="h-14 w-14 rounded-full bg-white/12 text-3xl font-black" aria-label="More">+</button>
    </div>
    <p className="text-center text-sm font-bold text-white/60">{units}{goal ? ` · ${goal.text}` : ""}</p>
    <button className={white} disabled={!(v > 0)} onClick={() => { d.logWeight(v); done(); }}>Log weight</button>
  </div>;
}

/* ─── Why, vision board, goal weight, nudges, buddy ─── */
function RiseSetup({ d, onClose }: { d: DailyApi; onClose: () => void }) {
  const start = d.family?.rise ?? emptyRise();
  const [r, setR] = useState<RiseData>(start);
  const units = d.fit.profile.units;
  const nowKg = d.fit.weights.length ? d.fit.weights[d.fit.weights.length - 1].kg : 0;
  const [goal, setGoal] = useState(d.fit.profile.goalKg ? String(toUnits(d.fit.profile.goalKg, units)) : "");
  const [emoji, setEmoji] = useState("⭐");
  const [text, setText] = useState("");
  const set = (p: Partial<RiseData>) => setR((x) => ({ ...x, ...p }));
  const addVision = (e: string, t: string) => { if (!t.trim() || r.vision.length >= 12) return; set({ vision: [...r.vision, { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, emoji: e || "⭐", text: t.trim().slice(0, 120) }] }); setText(""); setEmoji("⭐"); };
  const save = () => {
    const g = Number(goal), goalKg = g > 0 ? (units === "lb" ? g / 2.20462 : g) : 0;
    const changedGoal = Math.round(goalKg * 10) !== Math.round((d.fit.profile.goalKg || 0) * 10);
    if (changedGoal) d.setGoalKg(goalKg || null);
    d.setFamily((f) => ({ ...f, rise: { ...r, days: f.rise?.days ?? r.days, ...(changedGoal && goalKg && nowKg ? { startKg: nowKg } : {}) } }));
    onClose();
  };
  const timeRow = (label: string, key: "morning" | "evening", hint: string) => <div className="rounded-2xl bg-slate-50 p-3">
    <p className="text-sm font-bold text-slate-800">{label}</p><p className="text-xs text-slate-500">{hint}</p>
    <div className="mt-2 flex items-center gap-2">{r[key] ? <><input type="time" value={r[key]} onChange={(e) => set({ [key]: e.target.value || (key === "morning" ? "07:30" : "20:30") } as Partial<RiseData>)} className={inputClass + " max-w-[10rem]"} aria-label={`${label} time`} /><button onClick={() => set({ [key]: "" } as Partial<RiseData>)} className="min-h-10 whitespace-nowrap rounded-xl px-3 text-sm font-bold text-slate-500">Turn off</button></>
      : <button onClick={() => set({ [key]: key === "morning" ? "07:30" : "20:30" } as Partial<RiseData>)} className="min-h-10 rounded-xl bg-violet-100 px-3 text-sm font-bold text-violet-700">Turn on</button>}</div>
  </div>;
  return <Modal title="Why, goals and nudges" eyebrow="Daily check-in" onClose={onClose}>
    <div className="space-y-5">
      <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Why you're doing this</span>
        <textarea value={r.why} onChange={(e) => set({ why: e.target.value.slice(0, 400) })} rows={2} placeholder="To feel strong again and keep up with my kids" className={inputClass + " py-3"} />
        <span className="mt-1 block text-xs text-slate-500">It shows at the start of every check-in and in your reminders.</span></label>
      <div><p className="mb-1.5 text-xs font-black uppercase tracking-wider text-slate-500">Goal weight</p>
        <div className="flex items-center gap-2"><input type="number" inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={nowKg ? String(toUnits(nowKg, units)) : "180"} className={inputClass + " w-36"} /><span className="text-sm font-bold text-slate-600">{units}</span>
          {nowKg ? <span className="text-xs text-slate-500">You're at {toUnits(nowKg, units)} {units}</span> : <span className="text-xs text-slate-500">Weigh in during a check-in to track it</span>}</div></div>
      <div><p className="mb-1.5 text-xs font-black uppercase tracking-wider text-slate-500">Vision board</p>
        <div className="flex flex-wrap gap-2">{r.vision.map((v) => <span key={v.id} className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 py-1.5 pl-3 pr-1.5 text-sm font-semibold text-violet-900">{v.emoji} {v.text}<button onClick={() => set({ vision: r.vision.filter((x) => x.id !== v.id) })} aria-label={`Remove ${v.text}`} className="rounded-full p-1 text-violet-400 hover:bg-violet-100"><X size={14} /></button></span>)}</div>
        <form onSubmit={(e) => { e.preventDefault(); addVision(emoji, text); }} className="mt-2 flex gap-2"><input value={emoji} onChange={(e) => setEmoji([...e.target.value].slice(-2).join(""))} aria-label="Emoji" className="h-11 w-12 shrink-0 rounded-xl border border-slate-200 text-center text-xl" /><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Fit into my old jeans" className={inputClass} /><button className="min-h-11 rounded-xl bg-violet-600 px-3 text-sm font-bold text-white">Add</button></form>
        {r.vision.length < 3 && <div className="mt-2 flex flex-wrap gap-1.5">{[{ emoji: "👖", text: "Fit into my old jeans" }, { emoji: "🏃", text: "Run a 5K without stopping" }, { emoji: "👨‍👧", text: "Keep up with my kids" }, ...DREAM_IDEAS.filter((x) => ["health", "money", "travel"].includes(x.cat)).slice(0, 5).map((x) => ({ emoji: x.emoji, text: x.title }))].filter((x) => !r.vision.some((v) => v.text === x.text)).map((x) => <button key={x.text} onClick={() => addVision(x.emoji, x.text)} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{x.emoji} {x.text}</button>)}</div>}</div>
      <div className="space-y-2"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Nudges</p>
        {timeRow("Morning nudge", "morning", "Your why, a goal or a quote, and the check-in ready to go")}
        {timeRow("Streak saver", "evening", "Only if today doesn't count yet")}
        <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-800">Quotes in reminders</span><span className="block text-xs text-slate-500">Mixed in with your why and your vision board</span></span><input type="checkbox" checked={r.quotes} onChange={(e) => set({ quotes: e.target.checked })} className="h-5 w-5 accent-violet-600" /></label>
        <p className="text-xs leading-5 text-slate-500">Meal reminders get a "Same as last time" button on your phone. Each reminder also says why it matters.</p></div>
      <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-500">Accountability buddy</span>
        <input value={r.buddy} onChange={(e) => set({ buddy: e.target.value.slice(0, 40) })} placeholder="Their name" className={inputClass} />
        <span className="mt-1 block text-xs text-slate-500">After each check-in and each week, send them your progress in one tap. People who share their progress stick with it far longer.</span></label>
      <button onClick={save} className={primary + " min-h-12 w-full"} data-testid="rise-setup-save">Save</button>
    </div>
  </Modal>;
}

/* ─── The week ─── */
function RiseRecap({ d, onClose }: { d: DailyApi; onClose: () => void }) {
  const rise = d.family?.rise ?? emptyRise();
  const rc = weekRecap({ rise, today: d.date, foods: d.fit.foods, weights: d.fit.weights, water: d.fit.water, waterGoal: d.fit.profile.waterGoalMl, units: d.fit.profile.units, workouts: d.fit.workouts.map((w) => ({ date: w.date })) });
  const st = riseStreak(rise, d.date);
  const days = Array.from({ length: 7 }, (_, i) => { const date = new Date(Date.parse(`${rc.from}T12:00:00Z`) + i * 864e5).toISOString().slice(0, 10); return { date, day: rise.days.find((x) => x.date === date) }; });
  const tile = (label: string, value: ReactNode) => <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xl font-black text-slate-800">{value}</p><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p></div>;
  const share = async () => {
    const text = `My week: checked in ${rc.daysCounted} of 7 days${st.days ? ` · 🔥 ${st.days}-day streak` : ""}.\n${rc.insights.slice(0, 2).join("\n")}`;
    try { if (navigator.share) await navigator.share({ text }); else await navigator.clipboard.writeText(text); } catch { /* closed */ }
  };
  return <Modal title={`${rc.daysCounted} of 7 days`} eyebrow="Your week" onClose={onClose}>
    <div className="space-y-4">
      <div className="flex justify-between gap-1">{days.map(({ date, day }) => { const on = counts(day); const frozen = st.frozen.includes(date); return <div key={date} className="flex flex-1 flex-col items-center gap-1">
        <span className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${on ? "bg-violet-600 text-white" : frozen ? "bg-sky-100" : "bg-slate-100 text-slate-300"}`}>{on ? "🔥" : frozen ? "❄️" : "·"}</span>
        <span className="text-[11px] font-bold text-slate-500">{["S", "M", "T", "W", "T", "F", "S"][new Date(`${date}T12:00:00Z`).getUTCDay()]}</span></div>; })}</div>
      <div className="grid grid-cols-3 gap-2">{tile("Check-ins", rc.checkins)}{tile("Meals logged", rc.meals)}{tile("Workouts", rc.workouts)}{tile("Streak", `${st.days}🔥`)}{tile("Avg calories", rc.avgKcal ? fmt(rc.avgKcal) : "—")}{tile("Weight", rc.weightChange === null ? "—" : `${rc.weightChange > 0 ? "+" : ""}${Math.round(rc.weightChange * 10) / 10}`)}</div>
      <div className="space-y-2">{rc.insights.map((x) => <p key={x} className="rounded-2xl bg-violet-50 px-4 py-3 text-sm font-semibold leading-6 text-violet-900">💡 {x}</p>)}</div>
      <button onClick={() => { void share(); }} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 font-black text-white"><Share2 size={17} />Send my week to {rise.buddy || "a friend"}</button>
    </div>
  </Modal>;
}
