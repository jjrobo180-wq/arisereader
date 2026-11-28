// Chores: every chore a home has, picked from a catalog by room with how often, then done from Today, the task
// list (shared/dailyCheckins.ts shows each chore due today there, and a tick in either place is the same tick),
// the watch and widgets. XP, levels, the day streak, badges and how fresh each room is (shared/choreGame.ts) make
// it rewarding; the swipe session ("Instead of scrolling") deals one chore per screen. Families still get owners,
// weekly turns, stars and the week chart.
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { scrollToFocus, useIntent } from "@/lib/deepLink";
import { Award, Check, ChevronLeft, ChevronRight, ChevronUp, Flame, Pencil, Plus, Repeat2, Search, Star, Timer, Trash2, Trophy, Zap } from "lucide-react";
import { addDays, choreDoneOn, choreDueOn, choreOwner, choreWindow, toggleChore, weekStart, type Chore, type ChoreUnit, type Family } from "@shared/familyHub";
import { CHORE_CATALOG, CHORE_CATEGORIES, CHORE_PACKS, FREQ_CHOICES, FREQ_CODES, catalogById, categoryOf, choreFromCatalog, freqLabel, type CatalogChore, type ChoreFreq } from "@shared/choreCatalog";
import { badges, bestStreak, freshness, homeScore, lastDone, lastWeek, levelOf, minutesLeft, perfectDay, quickQueue, rooms, streak, totalXp, xpFor } from "@shared/choreGame";
import { Avatar, Label, MemberPicker, MemberTag, Modal, Panel, confirmed, danger, inputClass, memberOf, plain, primary, shortDate, soft, stickyFoot, type SectionProps } from "./ui";
import { ShareButton } from "./ShareLink";
import { SwipeFeed, type SwipeFeedHandle } from "@/components/swipe/SwipeFeed";
import { confetti, tap } from "@/lib/celebrate";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type Tab = "today" | "mine" | "add" | "progress" | "week";
const colorOf = (c: Pick<Chore, "cat"> | undefined) => categoryOf(c?.cat)?.color || "#7c5cff";
const iconOf = (c: Pick<Chore, "icon" | "cat">) => c.icon || categoryOf(c.cat)?.emoji || "✨";
const mins = (n: number) => (n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ""}` : `${n} min`);

type Draft = {
  id: string | null; title: string; icon: string; cat: string; mins: number;
  unit: ChoreUnit; every: number; days: number[]; flex: boolean; start: string;
  mode: "one" | "rotate"; memberId: string; rotation: string[]; points: number;
};
const draftFrom = (c: Chore, today: string): Draft => ({
  id: c.id, title: c.title, icon: c.icon || "", cat: c.cat || "", mins: c.mins || 10, unit: c.unit || "week", every: c.every || 1, days: c.days, flex: !!c.flex,
  start: c.start || today, mode: c.rotation.length ? "rotate" : "one", memberId: c.memberId, rotation: c.rotation, points: c.points,
});
const draftNew = (item: Pick<CatalogChore, "title" | "icon" | "mins" | "cat">, freq: ChoreFreq, today: string): Draft => ({
  id: null, title: item.title, icon: item.icon, cat: item.cat, mins: item.mins, unit: freq.unit, every: freq.every, days: freq.days ?? [], flex: !!freq.flex, start: today,
  mode: "one", memberId: "", rotation: [], points: Math.max(1, Math.min(10, Math.round(item.mins / 10) || 1)),
});
/** Which frequency chip a draft matches ("custom" when none). */
function choiceOf(d: Pick<Draft, "unit" | "every" | "days" | "flex">): string {
  const days = d.days.join();
  if (d.unit === "week" && d.every === 1) return d.flex ? "w" : !days ? "d" : days === "1,2,3,4,5" ? "wd" : days === "0,6" ? "we" : "w";
  if (d.unit === "week" && d.every === 2) return "2w";
  if (d.unit === "day" && (d.every === 2 || d.every === 3)) return `${d.every}d`;
  if (d.unit === "day" && d.every === 1) return "d";
  if (d.unit === "month") return d.every === 1 ? "m" : d.every === 3 ? "3m" : d.every === 6 ? "6m" : d.every === 12 ? "y" : "custom";
  return "custom";
}

export default function Chores({ family, setFamily, today, makeId, say }: SectionProps) {
  const [tab, setTab] = useState<Tab>(() => (family.chores.length ? "today" : "add"));
  // A chore reminder (shared/notifyLinks.ts): Today, on that chore.
  useIntent("chores", (i) => { if (i.focus?.startsWith("chore:")) { setTab("today"); scrollToFocus(i.focus); } });
  const [who, setWho] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [session, setSession] = useState(false);
  const [pop, setPop] = useState<{ id: string; xp: number } | null>(null);
  const data = family;

  const due = family.chores.filter((c) => choreDueOn(c, today, family.choreDone) && (!who || choreOwner(c, today) === who));
  const doneToday = due.filter((c) => !!choreDoneOn(family, c.id, today));
  const xp = totalXp(data, who || undefined), lvl = levelOf(xp), st = streak(data, today, who || undefined);

  /** Tick or untick, with the rewards: XP, level up, a perfect day. */
  const tick = (c: Chore, date = today) => {
    const wasDone = !!choreDoneOn(family, c.id, date);
    setFamily((f) => toggleChore(f, c, date, makeId));
    if (wasDone) return;
    const gained = xpFor(c), before = levelOf(totalXp(family)).level, after = levelOf(totalXp(family) + gained).level;
    tap("light");
    setPop({ id: c.id, xp: gained });
    window.setTimeout(() => setPop((p) => (p?.id === c.id ? null : p)), 1100);
    if (after > before) { confetti(2); tap("success"); say(`Level ${after}! You're now a ${levelOf(totalXp(family) + gained).title} 🎉`); return; }
    const all = family.chores.filter((x) => choreDueOn(x, date, family.choreDone));
    const left = all.filter((x) => x.id !== c.id && !choreDoneOn(family, x.id, date));
    if (date === today && all.length > 1 && !left.length) { confetti(); tap("success"); say("Perfect day — every chore done 🏆"); }
    else say(`${c.title} · +${gained} XP${c.points ? ` · +${c.points} ⭐` : ""}`);
  };

  const addChore = (chore: Chore) => setFamily((f) => ({ ...f, chores: [...f.chores, chore] }));
  const quickAdd = (item: CatalogChore) => {
    addChore(choreFromCatalog(item, FREQ_CODES[item.freq], makeId(), today));
    tap("light");
    say(`Added ${item.title} · ${freqLabel(choreFromCatalog(item, FREQ_CODES[item.freq], "x", today))}`);
  };
  const addPack = (ids: string[]) => {
    const have = new Set(family.chores.map((c) => c.title.toLowerCase()));
    const items = ids.map((id) => catalogById.get(id)).filter((x): x is CatalogChore => !!x && !have.has(x.title.toLowerCase()));
    if (!items.length) { say("You already have all of these"); return; }
    setFamily((f) => ({ ...f, chores: [...f.chores, ...items.map((i) => choreFromCatalog(i, FREQ_CODES[i.freq], makeId(), today))] }));
    confetti(); say(`Added ${items.length} chore${items.length === 1 ? "" : "s"} 🎉`);
    setTab("today");
  };
  const save = (d: Draft) => {
    const title = d.title.trim().slice(0, 120);
    if (!title) return;
    const old = family.chores.find((c) => c.id === d.id);
    const chore: Chore = { id: d.id || makeId(), title, memberId: d.mode === "one" ? d.memberId : "", rotation: d.mode === "rotate" ? d.rotation : [], days: d.unit === "week" && !d.flex ? d.days : [], points: Math.max(0, Math.min(100, Math.round(d.points) || 0)), start: d.start || today };
    if (d.unit !== "week" || d.every > 1) chore.unit = d.unit;
    if (d.every > 1) chore.every = Math.min(365, Math.round(d.every));
    if (d.flex && !(d.unit === "day" && d.every === 1)) chore.flex = true;
    if (d.cat) chore.cat = d.cat;
    if (d.icon) chore.icon = d.icon;
    if (d.mins) chore.mins = Math.max(1, Math.min(600, Math.round(d.mins)));
    setFamily((f) => ({ ...f, chores: old ? f.chores.map((c) => (c.id === chore.id ? chore : c)) : [...f.chores, chore] }));
    setDraft(null);
    say(old ? "Chore saved" : `Added ${title} · ${freqLabel(chore)}`);
  };
  const remove = (c: Chore) => {
    if (!confirmed(`Delete "${c.title}"? What you've already done still counts.`)) return;
    setFamily((f) => ({ ...f, chores: f.chores.filter((x) => x.id !== c.id) }));
    setDraft(null);
    say("Chore deleted");
  };

  const tabs: { id: Tab; label: string }[] = [{ id: "today", label: "Today" }, { id: "mine", label: `My chores${family.chores.length ? ` · ${family.chores.length}` : ""}` }, { id: "add", label: "Add" }, { id: "progress", label: "Progress" }, { id: "week", label: "Week" }];

  return <div className="space-y-5">
    {tab === "today" || tab === "progress" ? <Hero family={family} today={today} lvl={lvl} xp={xp} streakDays={st.days} alive={st.aliveToday} doneCount={doneToday.length} dueCount={due.length}
      onSession={() => setSession(true)} action={<ShareButton target="chores" title="Chore chart" say={say} />} />
      : <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-black tracking-tight text-[#232139]">Chores<span className="text-[#7866e1]">.</span></h1><span className="inline-flex items-center gap-1.5 rounded-full bg-[#1c1932] px-3 py-1.5 text-xs font-black text-white">Lv {lvl.level} · <Flame size={13} className="fill-orange-400 text-orange-400" />{st.days}</span></div>}

    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist">
      {tabs.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} data-testid={`chores-tab-${t.id}`}
        className={`min-h-11 shrink-0 rounded-2xl px-4 text-sm font-extrabold transition ${tab === t.id ? "bg-[#1c1932] text-white shadow-lg shadow-violet-900/10" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-800"}`}>{t.label}</button>)}
    </div>

    {family.members.length > 0 && tab !== "add" && <div className="flex flex-wrap gap-2">
      <button onClick={() => setWho("")} aria-pressed={!who} className={`min-h-10 rounded-xl px-4 text-xs font-bold ring-1 ${!who ? "bg-slate-800 text-white ring-slate-800" : "bg-white text-slate-500 ring-slate-200"}`}>Everyone</button>
      {family.members.map((m) => <button key={m.id} onClick={() => setWho(who === m.id ? "" : m.id)} aria-pressed={who === m.id} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3 text-xs font-bold text-slate-600 ring-1 ring-slate-200" style={who === m.id ? { background: m.color, color: "#fff", boxShadow: `0 0 0 1px ${m.color}` } : undefined}><span>{m.emoji || "🙂"}</span>{m.name}</button>)}
    </div>}

    {tab === "today" && <TodayTab family={family} today={today} due={due} pop={pop} tick={tick} edit={(c) => setDraft(draftFrom(c, today))} goAdd={() => setTab("add")} onSession={() => setSession(true)} />}
    {tab === "mine" && <MineTab family={family} today={today} who={who} edit={(c) => setDraft(draftFrom(c, today))} goAdd={() => setTab("add")} />}
    {tab === "add" && <AddTab family={family} today={today} pick={(item) => setDraft(draftNew(item, FREQ_CODES[item.freq], today))} quickAdd={quickAdd} addPack={addPack}
      custom={() => setDraft(draftNew({ title: "", icon: "", mins: 10, cat: "" }, FREQ_CODES.w, today))} />}
    {tab === "progress" && <ProgressTab family={family} today={today} who={who} />}
    {tab === "week" && <WeekTab family={family} today={today} who={who} tick={tick} edit={(c) => setDraft(draftFrom(c, today))} />}

    {draft && <ChoreSheet draft={draft} family={family} today={today} onClose={() => setDraft(null)} onSave={save}
      onDelete={draft.id ? () => { const c = family.chores.find((x) => x.id === draft.id); if (c) remove(c); } : undefined} />}
    {session && <QuickSession family={family} today={today} tick={tick} onClose={() => setSession(false)} />}
  </div>;
}

/* ─── The top card: level, XP, streak, today's ring ─── */
function Hero({ family, today, lvl, xp, streakDays, alive, doneCount, dueCount, onSession, action }: {
  family: Family; today: string; lvl: ReturnType<typeof levelOf>; xp: number; streakDays: number; alive: boolean; doneCount: number; dueCount: number; onSession: () => void; action: ReactNode;
}) {
  const pct = dueCount ? doneCount / dueCount : 0, R = 34, C = 2 * Math.PI * R;
  const home = homeScore(family, today), left = minutesLeft(family, today);
  return <section className="relative overflow-hidden rounded-[1.75rem] bg-[radial-gradient(120%_120%_at_0%_0%,#8b6dff_0%,#5b3fe0_45%,#221a4d_100%)] p-5 text-white shadow-[0_18px_50px_#4b2fd133] sm:p-6">
    <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-extrabold uppercase tracking-[.2em] text-white/70">Chores · {shortDate(today, { weekday: "long", month: "short", day: "numeric" })}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Level {lvl.level} · {lvl.title}</h1>
      </div>
      <div className="shrink-0 [&_button]:bg-white/15 [&_button]:text-white [&_button]:ring-0">{action}</div>
    </div>
    <div className="mt-4 flex items-center gap-4">
      <div className="relative h-24 w-24 shrink-0">
        <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90"><circle cx="40" cy="40" r={R} fill="none" stroke="#ffffff26" strokeWidth="9" /><circle cx="40" cy="40" r={R} fill="none" stroke="#7fffd4" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} className="transition-all duration-700" /></svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-2xl font-black leading-none">{doneCount}<span className="text-sm text-white/60">/{dueCount}</span></span><span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70">today</span></div>
      </div>
      <div className="min-w-0 flex-1 space-y-2.5">
        <div><div className="flex justify-between text-[11px] font-bold text-white/75"><span>{xp.toLocaleString()} XP</span><span>{lvl.next} to level {lvl.level + 1}</span></div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-[#7fffd4] to-[#ffe27a] transition-all duration-700" style={{ width: `${(lvl.into / lvl.need) * 100}%` }} /></div></div>
        <div className="flex flex-wrap gap-2 text-xs font-extrabold">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${streakDays ? "bg-orange-400/25 text-orange-100" : "bg-white/10 text-white/70"}`}><Flame size={14} className={streakDays ? "fill-orange-300 text-orange-300" : ""} />{streakDays} day{streakDays === 1 ? "" : "s"}{streakDays && !alive ? " · keep it going" : ""}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">🏡 Home {home}% fresh</span>
          {left > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1"><Timer size={13} />{mins(left)} left</span>}
        </div>
      </div>
    </div>
    {family.chores.length > 0 && <button onClick={onSession} data-testid="chores-session" className="mt-4 flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 text-left text-[#241c52] shadow-lg transition active:scale-[.98]">
      <span className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f1ecff] text-[#5b3fe0]"><Zap size={20} className="fill-[#5b3fe0]" /></span><span><span className="block text-sm font-black">Instead of scrolling</span><span className="block text-xs font-semibold text-slate-500">Swipe through quick chores, one at a time</span></span></span>
      <ChevronRight size={20} className="text-slate-400" />
    </button>}
  </section>;
}

/* ─── A chore row ─── */
function ChoreCard({ c, family, today, done, onTick, onEdit, pop, sub }: { c: Chore; family: Family; today: string; done: boolean; onTick: () => void; onEdit: () => void; pop?: number; sub?: ReactNode }) {
  const owner = memberOf(family, choreOwner(c, today)), color = colorOf(c);
  return <div data-focus={done ? undefined : `chore:${c.id}`} className={`group relative flex min-h-[4.5rem] items-center gap-3 rounded-2xl border p-2.5 pr-3 transition ${done ? "border-emerald-200 bg-emerald-50/70" : "border-[#ececf3] bg-white hover:border-violet-200"}`}>
    <button onClick={onTick} aria-pressed={done} aria-label={`${c.title}${done ? ", done" : ""}`} data-testid={`chore-tick-${c.id}`}
      className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl transition active:scale-90 ${done ? "bg-emerald-500 text-white" : ""}`} style={done ? undefined : { background: color + "1c" }}>
      {done ? <Check size={24} strokeWidth={3} /> : <span aria-hidden="true">{iconOf(c)}</span>}
      {pop ? <span className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 animate-[xpPop_1.1s_ease-out_forwards] whitespace-nowrap rounded-full bg-[#1c1932] px-2 py-0.5 text-[11px] font-black text-[#ffe27a]">+{pop} XP</span> : null}
    </button>
    <button onClick={onEdit} className="min-w-0 flex-1 text-left">
      <span className={`block truncate text-[15px] font-bold ${done ? "text-emerald-800 line-through decoration-2" : "text-slate-800"}`}>{c.title}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-500">
        <span>{freqLabel(c)}</span>{c.mins ? <span>· {mins(c.mins)}</span> : null}{owner && <MemberTag member={owner} />}{sub}
      </span>
    </button>
    {!done && <span className="hidden shrink-0 text-[11px] font-black text-violet-500 sm:block">+{xpFor(c)} XP</span>}
  </div>;
}

/* ─── Today ─── */
function TodayTab({ family, today, due, pop, tick, edit, goAdd, onSession }: { family: Family; today: string; due: Chore[]; pop: { id: string; xp: number } | null; tick: (c: Chore, d?: string) => void; edit: (c: Chore) => void; goAdd: () => void; onSession: () => void }) {
  if (!family.chores.length) return <Panel><div className="flex flex-col items-center py-8 text-center"><span className="text-5xl">🧹</span><p className="mt-3 text-lg font-black text-slate-800">Let's set up your home</p><p className="mt-1 max-w-sm text-sm text-slate-500">Pick chores from every room — {CHORE_CATALOG.length} to choose from — and say how often. They'll show up here and in your task list.</p><button onClick={goAdd} className={primary + " mt-4 min-h-12 px-6"}><Plus size={18} /> Pick my chores</button></div></Panel>;
  const isDone = (c: Chore) => !!choreDoneOn(family, c.id, today);
  const todo = due.filter((c) => !isDone(c)).sort((a, b) => (a.mins || 10) - (b.mins || 10)), finished = due.filter(isDone);
  const dueIds = new Set(due.map((c) => c.id));
  const stale = family.chores.filter((c) => !dueIds.has(c.id) && !choreDoneOn(family, c.id, today) && freshness(family, c, today) < 1).sort((a, b) => freshness(family, a, today) - freshness(family, b, today)).slice(0, 5);
  const quick = todo.filter((c) => (c.mins || 10) <= 5);
  return <div className="space-y-5">
    {todo.length > 0 && quick.length > 1 && <button onClick={onSession} className="flex w-full items-center gap-3 rounded-2xl bg-amber-50 p-3 text-left ring-1 ring-amber-200">
      <span className="text-2xl">⚡</span><span className="min-w-0 flex-1 text-sm font-bold text-amber-900">{quick.length} chores take 5 minutes or less. Knock them out in one swipe session.</span><ChevronRight size={18} className="text-amber-500" /></button>}
    <Panel eyebrow={todo.length ? `${todo.length} to go` : due.length ? "All done" : "Today"} title={todo.length ? "Up next" : due.length ? "Every chore done today 🏆" : "Nothing due today"}>
      {todo.length ? <div className="space-y-2">{todo.map((c) => <ChoreCard key={c.id} c={c} family={family} today={today} done={false} onTick={() => tick(c)} onEdit={() => edit(c)} pop={pop?.id === c.id ? pop.xp : 0}
        sub={byWhen(c, today)} />)}</div>
        : <p className="text-sm text-slate-500">{due.length ? "You showed up for your home today. That's how calm gets built. Come back tomorrow to keep the streak." : "A rest day. Enjoy it — or get ahead on something below."}</p>}
    </Panel>
    {stale.length > 0 && <Panel eyebrow="Getting stale" title="Get ahead">
      <div className="space-y-2">{stale.map((c) => <ChoreCard key={c.id} c={c} family={family} today={today} done={false} onTick={() => tick(c)} onEdit={() => edit(c)} pop={pop?.id === c.id ? pop.xp : 0}
        sub={<span className="text-amber-600">· last done {lastDone(family, c.id) ? shortDate(lastDone(family, c.id), { month: "short", day: "numeric" }) : "never"}</span>} />)}</div>
    </Panel>}
    {finished.length > 0 && <Panel eyebrow={`${finished.length} done`} title="Done today" collapseKey="chores-done-today">
      <div className="space-y-2">{finished.map((c) => <ChoreCard key={c.id} c={c} family={family} today={today} done onTick={() => tick(c)} onEdit={() => edit(c)} />)}</div>
    </Panel>}
  </div>;
}
/** "today's the last day" / "by Thu, Dec 31" for an any-day chore. */
function byWhen(c: Chore, today: string) {
  const w = choreWindow(c, today);
  if (!w) return null;
  return <span className={w.to === today ? "font-bold text-rose-600" : "text-violet-600"}>· {w.to === today ? "last day today" : `by ${shortDate(w.to, { weekday: "short", month: "short", day: "numeric" })}`}</span>;
}

/* ─── My chores, by room ─── */
function MineTab({ family, today, who, edit, goAdd }: { family: Family; today: string; who: string; edit: (c: Chore) => void; goAdd: () => void }) {
  const list = family.chores.filter((c) => !who || c.memberId === who || c.rotation.includes(who));
  const groups = useMemo(() => {
    const m = new Map<string, Chore[]>();
    for (const c of list) m.set(c.cat || "", [...(m.get(c.cat || "") || []), c]);
    return [...m].sort((a, b) => (CHORE_CATEGORIES.findIndex((x) => x.id === a[0]) + 99) % 99 - (CHORE_CATEGORIES.findIndex((x) => x.id === b[0]) + 99) % 99);
  }, [list]);
  if (!list.length) return <Panel><div className="py-8 text-center"><p className="text-4xl">🗂️</p><p className="mt-2 font-black text-slate-800">No chores yet</p><button onClick={goAdd} className={soft + " mt-3"}><Plus size={16} /> Add chores</button></div></Panel>;
  return <div className="space-y-4">
    {groups.map(([cat, chores]) => {
      const info = categoryOf(cat), fresh = chores.reduce((s, c) => s + freshness(family, c, today), 0) / chores.length;
      return <Panel key={cat || "other"}>
        <div className="mb-3 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl text-2xl" style={{ background: (info?.color || "#7c5cff") + "1f" }}>{info?.emoji || "✨"}</span>
          <div className="min-w-0 flex-1"><p className="font-black text-slate-800">{info?.name || "My own"}</p><div className="mt-1 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.round(fresh * 100)}%`, background: fresh > 0.8 ? "#22c55e" : fresh > 0.5 ? "#f59e0b" : "#ef4444" }} /></div><span className="text-[11px] font-bold text-slate-500">{Math.round(fresh * 100)}% fresh</span></div></div></div>
        <div className="divide-y divide-slate-100">{chores.map((c) => {
          const last = lastDone(family, c.id), owner = c.rotation.length ? null : memberOf(family, c.memberId);
          return <button key={c.id} onClick={() => edit(c)} className="flex w-full items-center gap-3 py-2.5 text-left">
            <span className="text-xl" aria-hidden="true">{iconOf(c)}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-800">{c.title}</span><span className="block text-[11px] font-semibold text-slate-500">{freqLabel(c)}{c.rotation.length ? " · takes turns" : owner ? ` · ${owner.name}` : ""}{last ? ` · last ${shortDate(last, { month: "short", day: "numeric" })}` : ""}</span></span>
            {choreDueOn(c, today, family.choreDone) && !choreDoneOn(family, c.id, today) && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-black text-violet-700">TODAY</span>}
            <Pencil size={15} className="shrink-0 text-slate-300" />
          </button>;
        })}</div>
      </Panel>;
    })}
    <button onClick={goAdd} className={soft + " w-full min-h-12"}><Plus size={17} /> Add more chores</button>
  </div>;
}

/* ─── The catalog ─── */
function AddTab({ family, today, pick, quickAdd, addPack, custom }: { family: Family; today: string; pick: (item: CatalogChore) => void; quickAdd: (item: CatalogChore) => void; addPack: (ids: string[]) => void; custom: () => void }) {
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const have = new Set(family.chores.map((c) => c.title.toLowerCase()));
  const term = q.trim().toLowerCase();
  const items = CHORE_CATALOG.filter((c) => (!cat || c.cat === cat) && (!term || c.title.toLowerCase().includes(term) || categoryOf(c.cat)?.name.toLowerCase().includes(term)));
  return <div className="space-y-5">
    {!term && !cat && <div>
      <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-[.14em] text-slate-500">Start with a pack</p>
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
        {CHORE_PACKS.map((p) => <button key={p.id} onClick={() => addPack(p.chores)} className="w-60 shrink-0 snap-start rounded-3xl bg-gradient-to-br from-[#f4f0ff] to-white p-4 text-left ring-1 ring-violet-100 transition active:scale-[.98]">
          <span className="text-3xl">{p.emoji}</span><p className="mt-2 font-black text-slate-800">{p.name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{p.blurb}</p>
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-violet-600 px-3 py-1 text-xs font-black text-white"><Plus size={13} /> Add {p.chores.length}</p>
        </button>)}
      </div>
    </div>}
    <div className="relative"><Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${CHORE_CATALOG.length} chores`} className={inputClass + " min-h-12 rounded-2xl pl-10"} aria-label="Search chores" data-testid="chores-search" /></div>
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      <button onClick={() => setCat("")} aria-pressed={!cat} className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-extrabold ring-1 ${!cat ? "bg-[#1c1932] text-white ring-[#1c1932]" : "bg-white text-slate-600 ring-slate-200"}`}>All</button>
      {CHORE_CATEGORIES.map((c) => <button key={c.id} onClick={() => setCat(cat === c.id ? "" : c.id)} aria-pressed={cat === c.id} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-xs font-extrabold text-slate-600 ring-1 ring-slate-200" style={cat === c.id ? { background: c.color, color: "#fff", boxShadow: `0 0 0 1px ${c.color}` } : undefined}><span>{c.emoji}</span>{c.name}</button>)}
    </div>
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => {
        const added = have.has(item.title.toLowerCase()), color = categoryOf(item.cat)?.color || "#7c5cff";
        return <div key={item.id} className={`relative flex min-h-[8.5rem] flex-col rounded-3xl p-3 ring-1 transition ${added ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-slate-200 hover:ring-violet-300"}`}>
          <button onClick={() => pick(item)} className="flex flex-1 flex-col text-left" aria-label={`${item.title}, choose how often`}>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-2xl" style={{ background: color + "1c" }}>{item.icon}</span>
            <span className="mt-2 text-[13px] font-extrabold leading-snug text-slate-800">{item.title}</span>
            <span className="mt-auto pt-1 text-[11px] font-semibold text-slate-500">{freqLabel({ ...FREQ_CODES[item.freq], days: FREQ_CODES[item.freq].days ?? [], start: today })} · {mins(item.mins)}</span>
          </button>
          <button onClick={() => (added ? pick(item) : quickAdd(item))} aria-label={added ? `${item.title} is added` : `Add ${item.title}`} className={`absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90 ${added ? "bg-emerald-500 text-white" : "bg-[#1c1932] text-white"}`}>{added ? <Check size={17} /> : <Plus size={18} />}</button>
        </div>;
      })}
      <button onClick={custom} className="flex min-h-[8.5rem] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-violet-200 p-3 text-center text-sm font-extrabold text-violet-700"><Plus size={22} /><span className="mt-1">Make my own</span></button>
    </div>
    {!items.length && <p className="text-center text-sm text-slate-500">No chore called that yet — make your own.</p>}
  </div>;
}

/* ─── Progress: level, streaks, rooms, badges, family stars ─── */
function ProgressTab({ family, today, who }: { family: Family; today: string; who: string }) {
  const id = who || undefined;
  const xp = totalXp(family, id), lvl = levelOf(xp), st = streak(family, today, id), best = Math.max(bestStreak(family, today, id), st.days);
  const done = id ? family.choreDone.filter((d) => d.memberId === id) : family.choreDone;
  const byId = new Map(family.chores.map((c) => [c.id, c]));
  const minutes = done.reduce((s, d) => s + (byId.get(d.choreId)?.mins || 10), 0);
  const perfect = [...new Set(done.map((d) => d.date))].filter((d) => perfectDay(family, d)).length;
  const week = lastWeek(family, today, id), top = Math.max(1, ...week.map((w) => w.count));
  const list = badges(family, today, id), earned = list.filter((b) => b.earned).length;
  const roomList = rooms(family, today);
  const weekFrom = weekStart(today);
  const stars = family.members.map((m) => ({ m, xp: totalXp({ chores: family.chores, choreDone: family.choreDone.filter((d) => d.date >= weekFrom) }, m.id), stars: family.choreDone.filter((d) => d.memberId === m.id && d.date >= weekFrom).reduce((s, d) => s + d.points, 0) })).sort((a, b) => b.xp - a.xp);
  const tile = (label: string, value: ReactNode, emoji: string) => <div className="rounded-2xl bg-white p-3.5 ring-1 ring-slate-200"><p className="text-xl">{emoji}</p><p className="mt-1 text-2xl font-black text-slate-800">{value}</p><p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</p></div>;
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {tile("Chores done", done.length.toLocaleString(), "✅")}{tile("Time invested", mins(minutes), "⏳")}{tile("Best streak", `${best} day${best === 1 ? "" : "s"}`, "🔥")}{tile("Perfect days", perfect, "💎")}
    </div>
    <Panel eyebrow="Last 7 days" title={`${week.reduce((s, w) => s + w.count, 0)} chores this week`}>
      <div className="flex h-36 items-end gap-2">{week.map((w) => <div key={w.date} className="flex flex-1 flex-col items-center gap-1.5">
        <span className="text-[11px] font-black text-slate-600">{w.count || ""}</span>
        <div className={`w-full rounded-xl transition-all ${w.date === today ? "bg-gradient-to-t from-violet-600 to-fuchsia-400" : "bg-violet-200"}`} style={{ height: Math.max(6, (w.count / top) * 92) }} />
        <span className={`text-[11px] font-bold ${w.date === today ? "text-violet-700" : "text-slate-400"}`}>{DAY_NAMES[new Date(`${w.date}T12:00:00`).getDay()].slice(0, 2)}</span></div>)}</div>
    </Panel>
    {roomList.length > 0 && <Panel eyebrow={`Home ${homeScore(family, today)}% fresh`} title="Your rooms">
      <div className="space-y-3">{roomList.map((r) => { const info = categoryOf(r.cat), pct = Math.round(r.fresh * 100); return <div key={r.cat} className="flex items-center gap-3">
        <span className="text-xl">{info?.emoji || "✨"}</span><div className="min-w-0 flex-1"><div className="flex justify-between text-xs font-bold"><span className="text-slate-700">{info?.name || "My own"}</span><span className={pct > 80 ? "text-emerald-600" : pct > 50 ? "text-amber-600" : "text-rose-600"}>{pct}%</span></div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct > 80 ? "#22c55e" : pct > 50 ? "#f59e0b" : "#ef4444" }} /></div>
          {r.stale.length > 0 && <p className="mt-1 truncate text-[11px] text-slate-500">Needs: {r.stale.slice(0, 3).map((c) => c.title).join(", ")}</p>}</div></div>; })}</div>
    </Panel>}
    <Panel eyebrow={`${earned} of ${list.length} earned`} title="Badges" right={<Award size={18} className="text-amber-500" />}>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">{list.map((b) => <div key={b.id} className={`flex flex-col items-center rounded-2xl p-3 text-center ring-1 ${b.earned ? "bg-gradient-to-b from-amber-50 to-white ring-amber-200" : "bg-slate-50 ring-slate-200"}`} title={b.blurb}>
        <span className={`text-3xl ${b.earned ? "" : "opacity-35 grayscale"}`}>{b.emoji}</span>
        <span className={`mt-1 text-[11px] font-black leading-tight ${b.earned ? "text-slate-800" : "text-slate-500"}`}>{b.name}</span>
        {!b.earned && <><div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-violet-500" style={{ width: `${(b.have / b.goal) * 100}%` }} /></div><span className="mt-0.5 text-[10px] font-bold text-slate-400">{b.have}/{b.goal}</span></>}
      </div>)}</div>
    </Panel>
    <Panel eyebrow={`Level ${lvl.level}`} title={lvl.title}>
      <p className="text-sm text-slate-600">{xp.toLocaleString()} XP so far. {lvl.next} more XP to level {lvl.level + 1}. Every chore earns 10 XP plus a point for each minute it takes, so the bigger jobs count for more.</p>
    </Panel>
    {family.members.length > 0 && <Panel eyebrow="This week" title="Family leaderboard" right={<Trophy size={18} className="text-amber-500" />}>
      <ol className="space-y-3">{stars.map((row, i) => <li key={row.m.id} className="flex items-center gap-3"><span className="w-4 text-xs font-black text-slate-400">{i + 1}</span><Avatar member={row.m} />
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{row.m.name}</span><span className="text-xs font-black text-violet-600">{row.xp} XP</span>
        <span className="inline-flex items-center gap-1 text-sm font-black text-amber-600"><Star size={15} className="fill-amber-400 text-amber-400" />{row.stars}</span></li>)}</ol>
    </Panel>}
  </div>;
}

/* ─── The family week chart ─── */
function WeekTab({ family, today, who, tick, edit }: { family: Family; today: string; who: string; tick: (c: Chore, d?: string) => void; edit: (c: Chore) => void }) {
  const [week, setWeek] = useState(() => weekStart(today));
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const chores = family.chores.filter((c) => !who || c.memberId === who || c.rotation.includes(who));
  return <Panel eyebrow="Week at a glance" title={`${shortDate(days[0], { month: "short", day: "numeric" })} – ${shortDate(days[6], { month: "short", day: "numeric" })}`}
    right={<><button onClick={() => setWeek(addDays(week, -7))} className={plain} aria-label="Previous week"><ChevronLeft size={17} /></button><button onClick={() => setWeek(weekStart(today))} className={plain}>This week</button><button onClick={() => setWeek(addDays(week, 7))} className={plain} aria-label="Next week"><ChevronRight size={17} /></button></>}>
    {!chores.length ? <p className="text-sm text-slate-500">No chores yet.</p> : <div className="-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
      <table className="w-full min-w-[680px] border-separate border-spacing-0 text-sm">
        <thead><tr><th className="sticky left-0 z-10 bg-white pb-2 text-left text-[11px] font-black uppercase tracking-wider text-slate-400">Chore</th>{days.map((d) => <th key={d} className={`pb-2 text-center text-[11px] font-black uppercase tracking-wider ${d === today ? "text-violet-600" : "text-slate-400"}`}>{DAY_NAMES[new Date(`${d}T12:00:00`).getDay()]}<span className="block text-xs font-bold normal-case tracking-normal">{Number(d.slice(8))}</span></th>)}</tr></thead>
        <tbody>{chores.map((c) => <tr key={c.id}>
          <td className="sticky left-0 z-10 max-w-[220px] border-t border-slate-100 bg-white py-2 pr-3">
            <button onClick={() => edit(c)} className="group flex w-full min-w-0 items-center gap-2 text-left"><span aria-hidden="true">{iconOf(c)}</span><span className="min-w-0 flex-1"><span className="block truncate font-bold text-slate-800 group-hover:text-violet-700">{c.title}</span><span className="flex items-center gap-1 text-[11px] text-slate-500">{c.rotation.length ? <><Repeat2 size={11} /> Takes turns</> : memberOf(family, c.memberId)?.name || freqLabel(c)}{c.points ? ` · ${c.points}⭐` : ""}</span></span></button>
          </td>
          {days.map((d) => {
            if (!choreDueOn(c, d, family.choreDone)) return <td key={d} className="border-t border-slate-100 py-2 text-center text-slate-200">–</td>;
            const done = !!choreDoneOn(family, c.id, d), owner = memberOf(family, choreOwner(c, d));
            return <td key={d} className={`border-t border-slate-100 py-2 text-center ${d === today ? "bg-violet-50/50" : ""}`}>
              <button onClick={() => tick(c, d)} aria-pressed={done} aria-label={`${c.title} on ${shortDate(d)}${done ? ", done" : ""}`} title={owner?.name || "Anyone"}
                className={`mx-auto flex h-9 w-9 items-center justify-center rounded-xl border-2 text-xs font-black transition ${done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-200 bg-white hover:border-violet-400"}`}
                style={!done && owner ? { borderColor: owner.color + "88", color: owner.color } : undefined}>{done ? <Check size={17} /> : owner ? (owner.emoji || owner.name[0]) : ""}</button>
            </td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>}
  </Panel>;
}

/* ─── Add / edit: what, how often, who ─── */
function ChoreSheet({ draft: start, family, today, onClose, onSave, onDelete }: { draft: Draft; family: Family; today: string; onClose: () => void; onSave: (d: Draft) => void; onDelete?: () => void }) {
  const [d, setD] = useState(start);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const choice = choiceOf(d);
  const pickFreq = (id: string) => { const f = FREQ_CHOICES.find((x) => x.id === id)!.freq; set({ unit: f.unit, every: f.every, days: f.days ?? [], flex: !!f.flex }); };
  const canFlex = !["d", "wd", "we"].includes(choice);
  const submit = (e: FormEvent) => { e.preventDefault(); onSave(d); };
  const info = categoryOf(d.cat);
  return <Modal title={d.id ? "Edit chore" : d.title ? d.title : "New chore"} eyebrow={info ? `${info.emoji} ${info.name}` : "Chores"} onClose={onClose}>
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center gap-3">
        <input value={d.icon} onChange={(e) => set({ icon: [...e.target.value].slice(-2).join("") })} aria-label="Emoji" placeholder="✨" className="h-14 w-14 shrink-0 rounded-2xl border border-slate-200 text-center text-3xl outline-none focus:border-violet-400" />
        <input autoFocus={!d.title} required maxLength={120} value={d.title} onChange={(e) => set({ title: e.target.value })} className={inputClass + " min-h-14 rounded-2xl text-base font-bold"} placeholder="What needs doing?" aria-label="Chore" />
      </div>
      {!start.title && <Label text="Room or area"><select value={d.cat} onChange={(e) => set({ cat: e.target.value })} className={inputClass}><option value="">My own</option>{CHORE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}</select></Label>}

      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-[.12em] text-slate-500">How often</p>
        <div className="flex flex-wrap gap-2">{FREQ_CHOICES.map((f) => <button type="button" key={f.id} onClick={() => pickFreq(f.id)} aria-pressed={choice === f.id} data-testid={`freq-${f.id}`}
          className={`min-h-11 rounded-2xl px-3.5 text-sm font-extrabold ring-1 transition active:scale-95 ${choice === f.id ? "bg-violet-600 text-white ring-violet-600 shadow-md shadow-violet-600/20" : "bg-white text-slate-600 ring-slate-200"}`}>{f.label}</button>)}
          <button type="button" onClick={() => set({ unit: d.unit, every: Math.max(2, d.every), flex: true })} aria-pressed={choice === "custom"} className={`min-h-11 rounded-2xl px-3.5 text-sm font-extrabold ring-1 ${choice === "custom" ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-slate-600 ring-slate-200"}`}>Custom…</button>
        </div>
        {choice === "custom" && <div className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700">Every
          <input type="number" min={1} max={365} value={d.every} onChange={(e) => set({ every: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })} className={inputClass + " w-20 text-center"} aria-label="How many" />
          <select value={d.unit} onChange={(e) => set({ unit: e.target.value as ChoreUnit })} className={inputClass + " w-32"} aria-label="Days, weeks or months"><option value="day">days</option><option value="week">weeks</option><option value="month">months</option></select></div>}
      </div>

      {canFlex && <div className="space-y-3 rounded-2xl bg-[#f7f5ff] p-3.5">
        <div className="inline-flex rounded-xl bg-white p-1 text-xs font-bold ring-1 ring-violet-100">
          <button type="button" onClick={() => set({ flex: true, days: [] })} aria-pressed={d.flex} className={`min-h-9 rounded-lg px-3 ${d.flex ? "bg-violet-600 text-white" : "text-slate-500"}`}>Any day</button>
          <button type="button" onClick={() => set({ flex: false, days: d.unit === "week" && !d.days.length ? [new Date(`${today}T12:00:00`).getDay()] : d.days })} aria-pressed={!d.flex} className={`min-h-9 rounded-lg px-3 ${!d.flex ? "bg-violet-600 text-white" : "text-slate-500"}`}>Set day</button>
        </div>
        <p className="text-xs leading-5 text-slate-600">{d.flex ? "It stays on your list every day until you do it, then comes back next time round. Nothing piles up." : d.unit === "week" ? "Pick the days it's done on." : d.unit === "month" ? "It's due on the same date each time — pick the first one." : "It's due on a set rhythm from the first day."}</p>
        {!d.flex && d.unit === "week" && <div className="flex flex-wrap gap-1.5">{DAY_NAMES.map((n, i) => { const on = d.days.includes(i); return <button type="button" key={n} aria-pressed={on} onClick={() => set({ days: on ? d.days.filter((x) => x !== i) : [...d.days, i].sort() })} className={`min-h-10 w-11 rounded-xl text-xs font-bold ring-1 ${on ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-slate-500 ring-slate-200"}`}>{n}</button>; })}</div>}
        {(!d.flex && d.unit !== "week") && <Label text="First time"><input type="date" value={d.start} onChange={(e) => set({ start: e.target.value || today })} className={inputClass} /></Label>}
      </div>}
      {choice === "w" && !d.flex && <p className="-mt-3 text-xs text-slate-500">Weekly on {d.days.map((x) => DAY_NAMES[x]).join(", ") || "—"}.</p>}

      <div className="grid grid-cols-2 gap-3">
        <Label text="Minutes it takes"><input type="number" min={1} max={600} value={d.mins} onChange={(e) => set({ mins: Number(e.target.value) })} className={inputClass} /></Label>
        <Label text="Stars each time"><input type="number" min={0} max={100} value={d.points} onChange={(e) => set({ points: Number(e.target.value) })} className={inputClass} /></Label>
      </div>

      {family.members.length > 0 && <div>
        <p className="mb-1.5 text-xs font-bold text-slate-600">Who does it</p>
        <div className="mb-3 inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
          {(["one", "rotate"] as const).map((m) => <button type="button" key={m} onClick={() => set({ mode: m })} aria-pressed={d.mode === m} className={`min-h-9 rounded-lg px-3 ${d.mode === m ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>{m === "one" ? "Same person" : "Take turns weekly"}</button>)}
        </div>
        {d.mode === "one" ? <MemberPicker members={family.members} value={d.memberId ? [d.memberId] : []} onChange={(ids) => set({ memberId: ids[0] || "" })} allowNone />
          : <><MemberPicker members={family.members} value={d.rotation} onChange={(ids) => set({ rotation: ids })} multi /><p className="mt-2 text-xs text-slate-500">The turn moves to the next person each Sunday, in the order you tap them.</p></>}
      </div>}

      <p className="rounded-2xl bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800">✅ {freqLabel({ ...d, days: d.unit === "week" && !d.flex ? d.days : [] })} · {xpFor({ mins: d.mins })} XP each time · shows in your task list on the days it's due</p>

      <div className={stickyFoot}>
        <button type="submit" className={primary + " min-h-12 flex-1 px-5"} data-testid="chore-save"><Check size={17} /> {d.id ? "Save" : "Add chore"}</button>
        {onDelete && <button type="button" onClick={onDelete} className={danger + " min-h-12"} aria-label="Delete chore"><Trash2 size={17} /></button>}
      </div>
    </form>
  </Modal>;
}

/* ─── Instead of scrolling: one chore per screen ─── */
function QuickSession({ family, today, tick, onClose }: { family: Family; today: string; tick: (c: Chore, d?: string) => void; onClose: () => void }) {
  const [minutes, setMinutes] = useState<number | null>(null);
  const [queue, setQueue] = useState<Chore[]>([]);
  const [did, setDid] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState(0);
  const [, setNow] = useState(0);
  const feed = useRef<SwipeFeedHandle>(null);
  const timer = useRef<number>();
  const begin = (m: number) => {
    const q = quickQueue(family, today, m);
    setMinutes(m); setQueue(q); setDid([]); setStartedAt(Date.now());
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => setNow(Date.now()), 1000);
    window.setTimeout(() => feed.current?.goTo(1), 60);
  };
  const close = () => { window.clearInterval(timer.current); onClose(); };
  const remain = minutes ? Math.max(0, minutes * 60 - Math.floor((Date.now() - startedAt) / 1000)) : 0;
  const gained = did.reduce((s, id) => s + xpFor(queue.find((c) => c.id === id)), 0);
  const finish = (c: Chore) => {
    if (did.includes(c.id)) return;
    tick(c);
    setDid((x) => [...x, c.id]);
    window.setTimeout(() => feed.current?.next(), 650);
  };

  const pick = <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(100%_80%_at_50%_0%,#5b3fe0,#0d0b1a)] px-6 text-center">
    <p className="text-6xl">⚡</p>
    <h2 className="mt-4 text-3xl font-black">How long have you got?</h2>
    <p className="mt-2 max-w-xs text-sm text-white/70">Pick a time. You'll swipe through your chores one at a time — done, swipe, done. It's the same thumb, just spent on your life.</p>
    <div className="mt-8 grid w-full max-w-xs grid-cols-2 gap-3">{[5, 10, 15, 30].map((m) => <button key={m} onClick={() => begin(m)} data-testid={`session-${m}`} className="min-h-16 rounded-3xl bg-white/10 text-xl font-black ring-1 ring-white/20 transition active:scale-95 hover:bg-white/20">{m} min</button>)}</div>
  </div>;

  const cards = queue.map((c) => {
    const info = categoryOf(c.cat), color = colorOf(c), isDone = did.includes(c.id) || !!choreDoneOn(family, c.id, today);
    return <div className="flex h-full flex-col items-center justify-center px-7 text-center" style={{ background: `radial-gradient(110% 70% at 50% 15%, ${color}, #0d0b1a 75%)` }}>
      <p className="text-xs font-extrabold uppercase tracking-[.25em] text-white/70">{info ? `${info.emoji} ${info.name}` : "Chore"}</p>
      <p className={`mt-6 text-[110px] leading-none transition-transform duration-500 ${isDone ? "scale-110" : ""}`} aria-hidden="true">{isDone ? "✅" : iconOf(c)}</p>
      <h2 className="mt-6 text-3xl font-black leading-tight sm:text-4xl">{c.title}</h2>
      <p className="mt-3 text-sm font-bold text-white/70">{mins(c.mins || 10)} · {freqLabel(c)} · +{xpFor(c)} XP</p>
      <button onClick={() => finish(c)} disabled={isDone} className={`mt-10 flex min-h-16 w-full max-w-xs items-center justify-center gap-2 rounded-full text-lg font-black transition active:scale-95 ${isDone ? "bg-emerald-400 text-emerald-950" : "bg-white text-[#1c1932] shadow-2xl"}`}>
        <Check size={22} strokeWidth={3} /> {isDone ? `Done · +${xpFor(c)} XP` : "Done"}</button>
      <div className="absolute inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col items-center text-white/50"><ChevronUp className="animate-bounce" size={22} /><span className="text-[11px] font-bold uppercase tracking-widest">Swipe up {isDone ? "for the next one" : "to skip"}</span></div>
    </div>;
  });

  const st = streak(family, today);
  const end = <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(100%_80%_at_50%_10%,#16a34a,#0d0b1a_75%)] px-7 text-center">
    <p className="text-7xl">{did.length ? "🏆" : "🌿"}</p>
    <h2 className="mt-5 text-3xl font-black">{did.length ? `${did.length} chore${did.length === 1 ? "" : "s"} done` : queue.length ? "No worries" : "You're all caught up"}</h2>
    <p className="mt-3 max-w-xs text-sm text-white/75">{did.length ? `+${gained} XP and a ${Math.max(1, st.days)}-day streak. That's time you took back from the scroll — your home (and your head) will feel it.` : queue.length ? "Every swipe counts as a look. Come back when you have a minute." : "Nothing's due and nothing's stale. Enjoy it — you earned the rest."}</p>
    <button onClick={close} className="mt-10 min-h-14 w-full max-w-xs rounded-full bg-white text-lg font-black text-[#1c1932]">Finish</button>
  </div>;

  const pages = minutes === null ? [pick] : [pick, ...cards, end];
  const top = minutes !== null ? <div className="flex items-center gap-2 rounded-full bg-black/35 px-3.5 py-2 text-sm font-black backdrop-blur"><Timer size={15} />{Math.floor(remain / 60)}:{String(remain % 60).padStart(2, "0")}<span className="text-white/50">·</span>{did.length}/{queue.length}</div> : null;
  return <SwipeFeed ref={feed} pages={pages} onClose={close} top={top} label="Chores, one at a time"
    onIndex={(i) => { if (minutes !== null && i === pages.length - 1 && did.length) confetti(); }} />;
}
