// Arise Feed (LifeHub section "feed"): the whole week as a full-screen feed you swipe up through, one card at a
// time, and it never runs out (cards from shared/ariseFeed.ts). Every card does something real: check off a
// to-do, chore, habit, medicine or upkeep; move a to-do to tomorrow; log water; add to a savings jar; mark a bill
// paid; answer a Life Score check-in; write a gratitude or journal line; play a podcast episode; add a tip as a
// to-do; or open the part of the app it came from. The list is fixed when the feed opens (so cards don't jump
// while you swipe); numbers on it (water, jars, goals) stay live.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, Check, Clock, Pause, Play, Plus, Sparkles } from "lucide-react";
import { SwipeFeed, type SwipeFeedHandle } from "@/components/swipe/SwipeFeed";
import { confetti, tap } from "@/lib/celebrate";
import { useHubTasks } from "@/lib/hubTasksBridge";
import { API_BASE } from "@/lib/queryClient";
import { podDevice } from "@/components/super-apps/podsterLink";
import { useExtra } from "./LifeScoreApp";
import { emptyLifeScore, lifeInputFrom, lifeScore, plusDays } from "@shared/lifeScore";
import { lifeStats } from "@shared/lifeStats";
import { setDay } from "@shared/familyHealth";
import { discoverCards, inFilter, introCard, realCards, type FeedCard, type FeedCat, type FeedEpisode, type FeedTask } from "@shared/ariseFeed";
import type { SectionProps } from "./ui";

type HubTask = { id: string; title: string; due: string; time?: string; done: boolean; listId?: string; archived?: boolean; createdAt?: string; completedAt?: string };
type Props = SectionProps & {
  token?: string | null; lifeTasks?: HubTask[]; lists?: { id: string; name: string }[]; familySpace?: boolean; userName?: string;
  onToggleTask?: (id: string) => void; onMoveTask?: (id: string, due: string) => void; go?: (section: string) => void;
};

const FILTERS: { id: FeedCat | "all"; label: string }[] = [
  { id: "all", label: "For you" }, { id: "todo", label: "To-dos" }, { id: "week", label: "This week" }, { id: "health", label: "Health" },
  { id: "money", label: "Money" }, { id: "home", label: "Home" }, { id: "score", label: "Life Score" }, { id: "mind", label: "Mind" },
];
const SNOOZE = "arise-feed-snoozed";
const readSnoozed = (today: string): Set<string> => { try { const v = JSON.parse(localStorage.getItem(SNOOZE) || "{}"); return new Set(Object.keys(v).filter((k) => v[k] >= today)); } catch { return new Set(); } };
const writeSnooze = (id: string, until: string) => { try { const v = JSON.parse(localStorage.getItem(SNOOZE) || "{}"); v[id] = until; localStorage.setItem(SNOOZE, JSON.stringify(v)); } catch { /* this visit only */ } };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** The person's podcast episodes: their followed shows and genres from Arise Podcasts. */
function usePodcasts(family: any, token: string | null | undefined): FeedEpisode[] {
  const [eps, setEps] = useState<FeedEpisode[]>([]);
  const genres: string[] = family?.earshot?.genres ?? [];
  const follows: string[] = (family?.earshot?.follows ?? []).map((s: any) => s.id);
  useEffect(() => {
    let live = true;
    const saved: FeedEpisode[] = (family?.earshot?.saved ?? []).filter((e: any) => e?.audio).map((e: any) => ({ id: e.id, title: e.title, show: e.show, audio: e.audio, art: e.art, secs: e.secs }));
    if (!genres.length || !token) { setEps(saved); return; }
    const base = (API_BASE || location.origin).replace(/\/$/, "");
    fetch(`${base}/api/podscroll/feed?genres=${encodeURIComponent(genres.slice(0, 6).join(","))}`, { headers: { Authorization: `Bearer ${token}`, "X-Podscroll-Device": podDevice() } })
      .then((r) => (r.ok ? r.json() : null)).then((b) => {
        if (!live) return;
        const pools: any[] = Object.values(b?.pools ?? {}).flat() as any[];
        const fromPools: FeedEpisode[] = pools.sort((a, z) => Number(follows.includes(z?.show?.id)) - Number(follows.includes(a?.show?.id)))
          .flatMap((p) => (p?.episodes ?? []).slice(0, 1)).filter((e: any) => e?.audio)
          .map((e: any) => ({ id: e.id, title: e.title, show: e.show, audio: e.audio, art: e.art, secs: e.secs, about: e.about }));
        setEps([...fromPools, ...saved].slice(0, 40));
      }).catch(() => { if (live) setEps(saved); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, genres.join(","), follows.join(",")]);
  return eps;
}

export default function AriseFeed(props: Props) {
  const { family, setFamily, today, say, token, lifeTasks, lists, familySpace = false, userName, onToggleTask, onMoveTask, go } = props;
  const bridge = useHubTasks();
  const extra = useExtra(token, familySpace);
  const podcasts = usePodcasts(family, token);
  const [openFeed, setOpenFeed] = useState(true);
  const [filter, setFilter] = useState<FeedCat | "all">("all");
  const [pages, setPages] = useState(2);
  const [handled, setHandled] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const feedRef = useRef<SwipeFeedHandle>(null);

  // Every hub's to-dos.
  const tasks: FeedTask[] = useMemo(() => {
    const here = familySpace ? "FamilyHub" : "LifeHub", there = familySpace ? "LifeHub" : "FamilyHub";
    const name = (id?: string) => lists?.find((l) => l.id === id)?.name;
    const own = (lifeTasks ?? (bridge?.tasks ?? []).map((t) => ({ id: t.id, title: t.title, due: t.dueDate, time: t.dueTime, done: t.done }))) as HubTask[];
    return [
      ...own.filter((t) => !t.archived).map((t) => ({ id: t.id, title: t.title, due: t.due || "", time: t.time, done: t.done, list: name(t.listId), hub: here as FeedTask["hub"], mine: true })),
      ...(extra.otherTasks ?? []).filter((t: any) => t?.title && !t.archived).map((t: any) => ({ id: String(t.id), title: String(t.title), due: String(t.due || ""), time: t.time, done: !!t.done, hub: there as FeedTask["hub"], mine: false })),
      ...(Array.isArray(extra.work?.tasks) ? extra.work.tasks : []).filter((t: any) => t?.title && !t.archived).map((t: any) => ({ id: String(t.id), title: String(t.title), due: String(t.dueDate || ""), time: t.dueTime, done: !!t.done, hub: "WorkHub" as const, mine: false })),
    ];
  }, [lifeTasks, bridge?.tasks, lists, extra, familySpace]);

  // Life Score and Stats, for insights, tips, numbers and records (worked out once per opening).
  const scoreStats = useMemo(() => {
    if (!openFeed) return null;
    try {
      const ls = family.lifeScore ?? emptyLifeScore();
      const score = lifeScore({ ...lifeInputFrom(family, tasks.map((t) => ({ due: t.due, done: t.done }))), fit: extra.fit }, today);
      const stats = lifeStats({ today, family, tasks: tasks.map((t) => ({ title: t.title, due: t.due, done: t.done, hub: t.hub, list: t.list })), work: extra.work, fit: extra.fit, ls, score });
      return { score, stats };
    } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFeed, today, extra.fit, extra.work]);

  // The list: fixed when the feed opens (and when the outside data first arrives), then pages added forever.
  const ctx = useMemo(() => ({ today, family, tasks, score: scoreStats?.score, stats: scoreStats?.stats, podcasts, name: userName }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [today, openFeed, scoreStats, podcasts.length, tasks.length]);
  const snoozed = useMemo(() => readSnoozed(today), [today, openFeed]);
  const base = useMemo(() => {
    const real = realCards(ctx).filter((c) => !snoozed.has(c.id));
    const left = real.filter((c) => c.doneable || c.kind === "task").length;
    return [introCard(ctx, left), ...real];
  }, [ctx, snoozed]);
  const more = useMemo(() => Array.from({ length: pages }, (_, i) => discoverCards(ctx, i + 1)).flat(), [ctx, pages]);
  const cards = useMemo(() => [...base, ...more].filter((c) => inFilter(c, filter)), [base, more, filter]);
  const nearEnd = useCallback(() => setPages((p) => p + 1), []);

  // ——— Actions ———
  const mark = (c: FeedCard, how: string) => setHandled((h) => ({ ...h, [c.id]: how }));
  const celebrate = () => { tap("success"); confetti(1); };
  const update = (fn: (f: any) => any) => setFamily((f) => fn(f));
  const memberId = family.members?.[0]?.id ?? Object.keys(family.health?.profiles ?? {})[0] ?? "";
  const done = (c: FeedCard) => {
    if (handled[c.id] === "done") return;
    switch (c.kind) {
      case "task": if (c.ref) onToggleTask?.(c.ref); break;
      case "chore": update((f) => { const ch = (f.chores ?? []).find((x: any) => x.id === c.ref); return { ...f, choreDone: [...(f.choreDone ?? []), { id: uid(), choreId: c.ref, date: today, memberId: ch?.memberId || memberId, points: ch?.points ?? 0 }] }; }); break;
      case "habit": update((f) => ({ ...f, habits: (f.habits ?? []).map((h: any) => (h.id === c.ref ? { ...h, days: [...new Set([...(h.days ?? []), today])] } : h)) })); break;
      case "bill": { const key = c.id.split(":")[2]; update((f) => ({ ...f, bills: (f.bills ?? []).map((b: any) => (b.id === c.ref ? { ...b, paid: [...new Set([...(b.paid ?? []), key])] } : b)) })); break; }
      case "pill": { const time = c.sub ?? ""; update((f) => ({ ...f, pillDoses: [...(f.pillDoses ?? []), { id: `${c.ref}:${today}:${time}`, pillId: c.ref, date: today, time, status: "taken", at: new Date().toISOString() }] })); break; }
      case "upkeep": update((f) => ({ ...f, care: (f.care ?? []).map((k: any) => (k.id === c.ref ? { ...k, lastDone: today } : k)) })); break;
      case "goal": update((f) => ({ ...f, goals: (f.goals ?? []).map((g: any) => { if (g.id !== c.ref) return g; if (g.kind === "number") return { ...g, current: g.current + 1 }; const i = (g.milestones ?? []).findIndex((m: any) => !m.done); return i < 0 ? g : { ...g, milestones: g.milestones.map((m: any, k: number) => (k === i ? { ...m, done: true } : m)) }; }) })); break;
    }
    mark(c, "done"); celebrate();
  };
  const later = (c: FeedCard) => {
    const tomorrow = plusDays(today, 1);
    if (c.kind === "task" && c.ref) onMoveTask?.(c.ref, tomorrow);
    else writeSnooze(c.id, today);
    mark(c, "later"); tap();
    say(c.kind === "task" ? "Moved to tomorrow." : "Hidden until tomorrow.");
  };
  const openIt = (c: FeedCard) => {
    if (!c.open) return;
    setOpenFeed(false);
    if (c.open === "workhub") { window.location.hash = "#/workhub"; return; }
    go?.(c.open);
  };
  const addWater = () => { update((f) => { const day = (f.health?.days ?? []).find((d: any) => d.date === today && d.memberId === memberId); return { ...f, health: setDay(f.health, memberId, today, { water: (Number(day?.water) || 0) + 1 }) }; }); tap(); };
  const addJar = (c: FeedCard, amount: number) => { update((f) => ({ ...f, jars: (f.jars ?? []).map((j: any) => (j.id === c.ref ? { ...j, saved: Math.min(j.target * 10, j.saved + amount) } : j)) })); tap(); };
  const checkIn = (c: FeedCard, v: number) => { update((f) => { const ls = f.lifeScore ?? emptyLifeScore(); return { ...f, lifeScore: { ...ls, days: { ...ls.days, [today]: { ...(ls.days?.[today] ?? {}), [c.field!]: v } } } }; }); mark(c, String(v)); tap(); setTimeout(() => feedRef.current?.next(), 450); };
  const write = (c: FeedCard, text: string) => {
    const t = text.trim(); if (!t) return;
    if (c.kind === "gratitude") update((f) => { const g = (f.gratitude ?? []).find((x: any) => x.date === today); return { ...f, gratitude: g ? f.gratitude.map((x: any) => (x === g ? { ...x, items: [...x.items, t] } : x)) : [...(f.gratitude ?? []), { id: uid(), date: today, items: [t] }] }; });
    else update((f) => ({ ...f, journal: [...(f.journal ?? []), { id: uid(), date: today, title: c.title.slice(0, 120), body: t, mood: "", createdAt: new Date().toISOString() }] }));
    mark(c, "done"); celebrate(); say(c.kind === "gratitude" ? "Saved to Gratitude." : "Saved to your journal.");
  };
  const addTodo = (c: FeedCard) => { if (!c.todo) return; if (bridge) { bridge.add(c.todo, "From Arise Feed"); mark(c, "added"); tap(); say(`Added "${c.todo}" to your to-dos.`); } };

  // Live numbers for cards that change as you tap.
  const water = (() => { const d = (family.health?.days ?? []).find((x: any) => x.date === today && (!x.memberId || x.memberId === memberId)); return Number(d?.water) || 0; })();
  const waterGoal = Number(family.health?.goals?.[memberId]?.water) || 8;
  const jar = (id?: string) => (family.jars ?? []).find((j: any) => j.id === id);

  const top = (
    <div className="flex max-w-[calc(100vw-5rem)] gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {FILTERS.map((f) => <button key={f.id} type="button" onClick={() => { setFilter(f.id); feedRef.current?.goTo(0); }} aria-pressed={filter === f.id}
        className={`min-h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold backdrop-blur transition ${filter === f.id ? "bg-white text-[#0b0b0f]" : "bg-black/30 text-white"}`}>{f.label}</button>)}
    </div>
  );

  const pagesOut: ReactNode[] = cards.map((c, i) => (
    <FeedPage key={c.id} c={c} pos={`${i + 1}`} handled={handled[c.id]} live={{ water, waterGoal, jar: jar(c.ref) }}
      onDone={() => done(c)} onLater={() => later(c)} onOpen={() => openIt(c)} onWater={addWater} onJar={(n) => addJar(c, n)} onCheck={(v) => checkIn(c, v)}
      onWrite={(t) => write(c, t)} onTodo={() => addTodo(c)} active={i === index} />
  ));

  return (
    <div className="mx-auto w-full max-w-2xl py-6" data-testid="arise-feed">
      <div className="overflow-hidden rounded-[28px] bg-[#0e0e12] p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#c6f432]">Arise Feed</p>
        <h1 className="mt-2 text-[32px] font-extrabold leading-tight tracking-[-0.02em]">Your whole week, one swipe at a time.</h1>
        <p className="mt-2 max-w-md text-[15px] leading-6 text-white/70">To-dos from every hub, this week's events, water, steps, sleep, chores, bills, money goals, habits, medicines, Life Score, podcasts and Mindset. It never runs out.</p>
        <button type="button" onClick={() => { setOpenFeed(true); setIndex(0); }} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#c6f432] px-6 text-[15px] font-extrabold text-[#16161d]" data-testid="arise-feed-open"><Play className="h-4 w-4" fill="currentColor" />Open the feed</button>
      </div>
      {openFeed && <SwipeFeed ref={feedRef} pages={pagesOut} label="Arise Feed" top={top} onClose={() => setOpenFeed(false)} onIndex={setIndex} onNearEnd={nearEnd} />}
    </div>
  );
}

// ——— One card ————————————————————————————————————————————————————————————————————————————————————————————————————
export function FeedPage({ c, pos, handled, live, onDone, onLater, onOpen, onWater, onJar, onCheck, onWrite, onTodo, active }: {
  c: FeedCard; pos: string; handled?: string; live: { water: number; waterGoal: number; jar?: any };
  onDone: () => void; onLater: () => void; onOpen: () => void; onWater: () => void; onJar: (n: number) => void; onCheck: (v: number) => void; onWrite: (t: string) => void; onTodo: () => void; active: boolean;
}) {
  const isDone = handled === "done";
  const stamp = handled === "done" ? (c.doneWord ?? "DONE") : handled === "later" ? "TOMORROW" : handled === "added" ? "ADDED" : "";
  const H = "font-[650] leading-[1.06] tracking-[-0.02em] [font-family:'Space_Grotesk',Inter,system-ui,sans-serif]";
  return (
    <div className="relative flex h-full w-full flex-col justify-center gap-4 pb-28 pl-6 pr-[88px] pt-28 text-white" style={{ background: c.bg }}>
      <p className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: c.accent }}><span className="h-2 w-2 rounded-full" style={{ background: c.accent }} />{c.kicker}</p>

      {c.kind === "intro" && <>
        <h1 className={`${H} text-[42px]`}>{c.title}</h1>
        <p className="max-w-sm text-[17px] leading-7 text-white/70">{c.body}</p>
        <div className="mt-2 flex items-center gap-4">
          {c.big && <Ring pct={c.pct ?? 0} color={c.accent} size={92}><span className={`${H} text-[26px]`}>{c.big}</span></Ring>}
          <div><p className="text-[15px] font-bold">{c.big ? "Life Score" : "This week"}</p><p className="text-sm text-white/65">{c.sub}</p></div>
        </div>
        <p className="mt-6 text-sm font-semibold text-white/50">Swipe up ↑</p>
      </>}

      {(c.kind === "task" || c.kind === "chore" || c.kind === "upkeep" || c.kind === "pill") && <>
        <h2 className={`${H} text-[38px] ${isDone ? "line-through opacity-55" : ""}`}>{c.title}</h2>
        {c.chips && <div className="flex flex-wrap gap-2">{c.chips.map((x) => <span key={x} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">{x}</span>)}</div>}
        {c.body && <p className="max-w-md text-base leading-7 text-white/70">{c.body}</p>}
      </>}

      {c.kind === "event" && <>
        <div className="w-24 overflow-hidden rounded-[18px] bg-white text-center text-[#1d2b64]"><div className="py-1.5 text-[13px] font-extrabold tracking-[0.08em]" style={{ background: c.accent }}>{c.sub}</div><div className={`${H} pb-2.5 pt-1.5 text-[40px]`}>{c.big}</div></div>
        <h2 className={`${H} text-[36px]`}>{c.title}</h2>
        {c.chips && <p className="text-[17px] font-semibold">{c.chips.join(" · ")}</p>}
        {c.body && <p className="max-w-md text-[15px] leading-6 text-white/70">{c.body}</p>}
      </>}

      {c.kind === "water" && <>
        <div className="flex items-end gap-6">
          <div className="relative h-52 w-28 shrink-0 overflow-hidden rounded-b-[30px] rounded-t-2xl border-[3px] border-white/75"><div className="absolute inset-x-0 bottom-0 transition-[height] duration-500" style={{ height: `${Math.min(100, (live.water / live.waterGoal) * 100)}%`, background: c.accent }} /></div>
          <div className="flex flex-col gap-1.5">
            <span className={`${H} text-[56px]`}>{live.water}</span><span className="text-base text-white/75">of {live.waterGoal} cups today</span>
            <button type="button" onClick={onWater} className="mt-3 min-h-12 rounded-full px-5 text-base font-bold text-[#04313f]" style={{ background: c.accent }}>+ 1 cup</button>
          </div>
        </div>
        <p className="text-[15px] text-white/70">{live.water >= live.waterGoal ? "Goal reached. Nice." : `${live.waterGoal - live.water} to go.`}</p>
      </>}

      {(c.kind === "rings" || c.kind === "sleep") && <>
        {c.kind === "rings" && <div className="flex items-center gap-5"><Ring pct={c.pct ?? 0} color={c.accent} size={140}><span className={`${H} text-[22px]`}>{c.pct}%</span></Ring><div><p className={`${H} text-[34px]`}>{c.big}</p><p className="text-sm font-bold" style={{ color: c.accent }}>{c.sub}</p></div></div>}
        <h2 className={`${H} text-[32px]`}>{c.title}</h2>
        {c.chips && c.chips.length > 0 && <div className="flex flex-wrap gap-2">{c.chips.map((x) => <span key={x} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">{x}</span>)}</div>}
        {c.body && <p className="max-w-md text-[17px] leading-7 font-semibold text-white/85">{c.body}</p>}
      </>}

      {c.kind === "podcast" && <Podcast c={c} active={active} />}

      {c.kind === "jar" && (() => { const j = live.jar; const saved = j?.saved ?? 0, target = j?.target ?? 1; return <>
        <h2 className={`${H} text-[34px]`}>{c.title}</h2>
        <div className="flex items-baseline gap-2"><span className={`${H} text-[56px]`} style={{ color: c.accent }}>${Math.round(saved).toLocaleString()}</span><span className="text-[17px] text-white/70">of ${Math.round(target).toLocaleString()}</span></div>
        <div className="h-3.5 rounded-full bg-white/15"><div className="h-3.5 rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, (saved / target) * 100)}%`, background: c.accent }} /></div>
        <p className="text-[15px] text-white/75">{saved >= target ? "Fully funded." : `$${Math.round(target - saved).toLocaleString()} to go.`}</p>
        <div className="flex gap-2">{[10, 25, 50].map((n) => <button key={n} type="button" onClick={() => onJar(n)} className="min-h-12 rounded-full px-5 text-base font-bold text-[#053b2a]" style={{ background: c.accent }}>+${n}</button>)}</div>
      </>; })()}

      {(c.kind === "bill" || c.kind === "countdown" || c.kind === "stat" || c.kind === "record" || c.kind === "goal") && <>
        <h2 className={`${H} text-[38px] ${isDone && c.kind === "bill" ? "line-through opacity-55" : ""}`}>{c.title}</h2>
        {c.big && <div className="flex flex-wrap items-baseline gap-2.5"><span className={`${H} text-[56px]`} style={{ color: c.accent }}>{c.big}</span>{c.sub && <span className="text-[17px] text-white/70">{c.sub}</span>}</div>}
        {!c.big && c.sub && <p className="text-[17px] text-white/70">{c.sub}</p>}
        {c.pct !== undefined && c.kind === "goal" && <div className="h-3 rounded-full bg-white/15"><div className="h-3 rounded-full" style={{ width: `${c.pct}%`, background: c.accent }} /></div>}
        {c.body && <p className="max-w-md text-[15px] leading-6 text-white/70">{c.body}</p>}
        {c.todo && <TodoButton c={c} onTodo={onTodo} added={handled === "added"} />}
      </>}

      {(c.kind === "insight" || c.kind === "tip" || c.kind === "mind" || c.kind === "memory" || c.kind === "measure" || c.kind === "birthday") && <>
        <h2 className={`${H} ${c.title.length > 140 ? "text-[24px]" : c.title.length > 80 ? "text-[29px]" : "text-[34px]"}`}>{c.title}</h2>
        {c.sub && <p className="text-[17px] font-semibold" style={{ color: c.accent }}>{c.sub}</p>}
        {c.body && <p className="max-w-md whitespace-pre-line text-[15px] leading-6 text-white/70">{c.body}</p>}
        {c.todo && <TodoButton c={c} onTodo={onTodo} added={handled === "added"} />}
      </>}

      {c.kind === "habit" && <>
        <h2 className={`${H} text-[40px] ${isDone ? "line-through opacity-55" : ""}`}>{c.title}</h2>
        <div className="grid grid-cols-7 gap-1.5">{(c.bars ?? []).map((b, i) => <div key={i} className="flex flex-col items-center gap-1.5"><span className="h-9 w-9 rounded-[10px]" style={{ background: b.v || (b.hi && isDone) ? c.accent : "rgba(255,255,255,0.12)" }} /><span className="text-xs text-white/60">{b.label}</span></div>)}</div>
        <p className="text-[17px] font-bold" style={{ color: c.accent }}>{isDone ? "Done today. Streak kept." : c.sub}</p>
      </>}

      {c.kind === "checkin" && <>
        <h2 className={`${H} text-[34px]`}>{c.title}</h2>
        <div className="grid grid-cols-6 gap-2">{Array.from({ length: 11 }, (_, v) => <button key={v} type="button" onClick={() => onCheck(v)} aria-pressed={handled === String(v)} className="h-12 rounded-2xl text-base font-bold" style={{ background: handled === String(v) ? c.accent : "rgba(255,255,255,0.12)", color: handled === String(v) ? "#082f49" : "#fff" }}>{v}</button>)}</div>
        <div className="flex justify-between text-xs text-white/55"><span>0 · {c.low}</span><span>10 · {c.high}</span></div>
        <p className="text-[15px] text-white/70">{handled ? "Saved to your Life Score." : "One tap. It feeds your Life Score and Patterns."}</p>
      </>}

      {(c.kind === "gratitude" || c.kind === "journal") && <Writer c={c} done={isDone} onWrite={onWrite} />}

      {stamp && <span className="absolute right-[92px] top-32 -rotate-[8deg] rounded-xl border-[3px] px-3.5 py-1.5 text-lg font-extrabold tracking-[0.08em] [font-family:'Space_Grotesk',Inter,sans-serif]" style={{ borderColor: handled === "later" ? "#fbbf24" : "#c6f432", color: handled === "later" ? "#fbbf24" : "#c6f432" }}>{stamp}</span>}

      {/* Right rail */}
      <div className="absolute bottom-36 right-3 flex flex-col items-center gap-[18px]">
        {c.doneable && <RailButton label={isDone ? "Done" : c.kind === "bill" ? "Paid" : c.kind === "pill" ? "Taken" : c.kind === "goal" ? (c.doneWord === "+1" ? "+1" : "Step") : "Done"} on={isDone} onClick={onDone}><Check className="h-6 w-6" strokeWidth={2.6} /></RailButton>}
        {c.snoozable && <RailButton label="Later" on={handled === "later"} onClick={onLater}><Clock className="h-6 w-6" /></RailButton>}
        {c.open && <RailButton label="Open" onClick={onOpen}><ArrowUpRight className="h-6 w-6" /></RailButton>}
      </div>

      {/* Caption */}
      <div className="absolute inset-x-6 bottom-[max(2.25rem,env(safe-area-inset-bottom))] flex items-center justify-between text-[13px] font-semibold text-white/65"><span>{c.source}</span><span>{pos}</span></div>
    </div>
  );
}

function RailButton({ label, on, onClick, children }: { label: string; on?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} aria-pressed={on} className="flex flex-col items-center gap-1 text-xs font-semibold text-white">
    <span className={`grid h-[54px] w-[54px] place-items-center rounded-full transition active:scale-90 ${on ? "bg-[#c6f432] text-[#16161d]" : "bg-white/15 text-white"}`}>{children}</span>{label}
  </button>;
}

function TodoButton({ c, onTodo, added }: { c: FeedCard; onTodo: () => void; added: boolean }) {
  return <button type="button" onClick={onTodo} disabled={added} className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-full px-4 text-sm font-bold text-[#0b0b0f] disabled:opacity-70" style={{ background: c.accent }}>{added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{added ? "Added to your to-dos" : c.todo}</button>;
}

function Ring({ pct, color, size, children }: { pct: number; color: string; size: number; children?: ReactNode }) {
  const sw = size > 100 ? 14 : 10, r = (size - sw) / 2, c = 2 * Math.PI * r;
  return <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
    <svg width={size} height={size} className="-rotate-90" aria-hidden="true"><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={sw} /><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${(Math.min(100, Math.max(0, pct)) / 100) * c} ${c}`} /></svg>
    <span className="absolute inset-0 grid place-items-center">{children}</span>
  </span>;
}

function Writer({ c, done, onWrite }: { c: FeedCard; done: boolean; onWrite: (t: string) => void }) {
  const [text, setText] = useState("");
  return <>
    <h2 className="text-[30px] font-[650] leading-[1.1] tracking-[-0.02em] [font-family:'Space_Grotesk',Inter,sans-serif]">{c.title}</h2>
    {done ? <p className="text-[17px] font-semibold" style={{ color: c.accent }}>Saved. Swipe on.</p> : <>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={c.kind === "gratitude" ? "I'm grateful for…" : "Write a few lines…"} aria-label={c.title}
        className="w-full resize-none rounded-2xl border border-white/15 bg-white/10 p-4 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2" />
      <button type="button" onClick={() => onWrite(text)} disabled={!text.trim()} className="min-h-12 self-start rounded-full px-6 text-base font-bold text-[#16161d] disabled:opacity-40" style={{ background: c.accent }}>Save</button>
    </>}
  </>;
}

function Podcast({ c, active }: { c: FeedCard; active: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pct, setPct] = useState(0);
  // Swiping away pauses it.
  useEffect(() => { if (!active && audio.current && !audio.current.paused) { audio.current.pause(); setPlaying(false); } }, [active]);
  useEffect(() => () => { audio.current?.pause(); }, []);
  const toggle = () => {
    if (!c.audio) return;
    if (!audio.current) { audio.current = new Audio(c.audio); audio.current.ontimeupdate = () => { const a = audio.current!; if (a.duration) setPct((a.currentTime / a.duration) * 100); }; audio.current.onended = () => setPlaying(false); }
    if (audio.current.paused) { void audio.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); } else { audio.current.pause(); setPlaying(false); }
  };
  return <>
    {c.art ? <img src={c.art} alt="" className="h-44 w-44 rounded-[28px] object-cover" /> : <div className="grid h-44 w-44 place-items-center rounded-[28px]" style={{ background: c.accent }}><Sparkles className="h-12 w-12 text-[#2a1650]" /></div>}
    <h2 className="line-clamp-3 text-[28px] font-[650] leading-[1.1] tracking-[-0.02em] [font-family:'Space_Grotesk',Inter,sans-serif]">{c.title}</h2>
    <p className="text-[15px] font-semibold" style={{ color: c.accent }}>{c.sub}{c.mins ? ` · ${c.mins} min` : ""}</p>
    <div className="flex items-center gap-3.5">
      <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-[#2a1650]">{playing ? <Pause className="h-6 w-6" fill="currentColor" /> : <Play className="h-6 w-6" fill="currentColor" />}</button>
      <div className="h-1.5 flex-1 rounded-full bg-white/20"><div className="h-1.5 rounded-full transition-[width]" style={{ width: `${pct}%`, background: c.accent }} /></div>
    </div>
  </>;
}
