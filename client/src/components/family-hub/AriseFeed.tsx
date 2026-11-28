// Arise Feed (LifeHub section "feed"): your whole life as a full-screen feed you swipe up through, one card at a
// time, and it never runs out (cards from shared/ariseFeed.ts). Every card does something real: check off a
// to-do, chore, habit, medicine or upkeep; move a to-do to tomorrow; log water, food (to Cooked's food diary when
// that's where they log, else the LifeHub diary), a workout (run it here with a timer), an activity or a weigh-in;
// read a Bible chapter in place and save verses; play podcast episodes and follow new shows; answer trivia and
// Life Score check-ins; breathe; write a gratitude or journal line; save a word, a book or a bucket-list idea;
// add any idea as a to-do; or open the part of the app it came from. The list is fixed when the feed opens (so
// cards don't jump while you swipe); numbers on it (water, food, jars) stay live.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, BookOpen, Bookmark, Check, Clock, Copy, Pause, Play, Plus, Search, Sparkles, X } from "lucide-react";
import { SwipeFeed, type SwipeFeedHandle } from "@/components/swipe/SwipeFeed";
import { confetti, tap } from "@/lib/celebrate";
import { useHubTasks } from "@/lib/hubTasksBridge";
import { API_BASE } from "@/lib/queryClient";
import { useExtra } from "./LifeScoreApp";
import { emptyLifeScore, lifeInputFrom, lifeScore, plusDays } from "@shared/lifeScore";
import { lifeStats } from "@shared/lifeStats";
import { COMMON_FOODS, exerciseCalories, recentFoods, setDay } from "@shared/familyHealth";
import { cleanFit, CATALOG_BY_ID } from "@shared/fit";
import { emptyEarshot, GENRE, GENRES } from "@shared/earshot";
import type { FeedWorkout } from "@shared/feedLibrary";
import { discoverCards, foodToday, healthMe, inFilter, introCard, realCards, usesCooked, type FeedCard, type FeedCat, type FeedEpisode, type FeedTask, type FitMeal } from "@shared/ariseFeed";
import type { SectionProps } from "./ui";

type HubTask = { id: string; title: string; due: string; time?: string; done: boolean; listId?: string; archived?: boolean; createdAt?: string; completedAt?: string };
type Props = SectionProps & {
  token?: string | null; lifeTasks?: HubTask[]; lists?: { id: string; name: string }[]; familySpace?: boolean; userName?: string;
  onToggleTask?: (id: string) => void; onMoveTask?: (id: string, due: string) => void; go?: (section: string) => void;
};
type Logged = { name: string; kcal: number; p: number; c: number; f: number; serving?: string };

const FILTERS: { id: FeedCat | "all"; label: string }[] = [
  { id: "all", label: "For you" }, { id: "todo", label: "To-dos" }, { id: "week", label: "This week" }, { id: "food", label: "Food" }, { id: "fit", label: "Fitness" },
  { id: "health", label: "Health" }, { id: "faith", label: "Faith" }, { id: "pods", label: "Podcasts" }, { id: "money", label: "Money" }, { id: "home", label: "Home" },
  { id: "ideas", label: "Ideas" }, { id: "learn", label: "Learn" }, { id: "score", label: "Life Score" }, { id: "mind", label: "Mind" },
];
const SNOOZE = "arise-feed-snoozed";
const readSnoozed = (today: string): Set<string> => { try { const v = JSON.parse(localStorage.getItem(SNOOZE) || "{}"); return new Set(Object.keys(v).filter((k) => v[k] >= today)); } catch { return new Set(); } };
const writeSnooze = (id: string, until: string) => { try { const v = JSON.parse(localStorage.getItem(SNOOZE) || "{}"); v[id] = until; localStorage.setItem(SNOOZE, JSON.stringify(v)); } catch { /* this visit only */ } };
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const H = "font-[650] leading-[1.06] tracking-[-0.02em] [font-family:'Space_Grotesk',Inter,system-ui,sans-serif]";
const SERIF = "[font-family:'Iowan_Old_Style','Palatino_Linotype',Georgia,serif]";

/** Podcast episodes: the person's own genres and followed shows first, then shows from genres they don't listen to yet. */
function usePodcasts(family: any, token: string | null | undefined, today: string): FeedEpisode[] {
  const [eps, setEps] = useState<FeedEpisode[]>([]);
  const genres: string[] = family?.earshot?.genres ?? [];
  const follows: string[] = (family?.earshot?.follows ?? []).map((s: any) => s.id);
  useEffect(() => {
    let live = true;
    const saved: FeedEpisode[] = (family?.earshot?.saved ?? []).filter((e: any) => e?.audio).map((e: any) => ({ id: e.id, title: e.title, show: e.show, showId: e.showId, audio: e.audio, art: e.art, secs: e.secs }));
    if (!token) { setEps(saved); return; }
    const base = (API_BASE || location.origin).replace(/\/$/, "");
    const day = Math.floor(Date.parse(`${today}T12:00:00Z`) / 864e5);
    const others = GENRES.map((g) => g.id).filter((g) => !genres.includes(g));
    const fresh = Array.from({ length: 5 }, (_, i) => others[(day * 5 + i) % Math.max(1, others.length)]).filter(Boolean);
    const get = (list: string[]) => (list.length ? fetch(`${base}/api/earshot/feed?genres=${encodeURIComponent(list.join(","))}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null));
    const toEps = (b: any, discover: boolean): FeedEpisode[] => Object.entries(b?.pools ?? {}).flatMap(([g, pool]: [string, any]) => (Array.isArray(pool) ? pool : [])
      .flatMap((p: any) => (p?.episodes ?? []).slice(0, 1).filter((e: any) => e?.audio).map((e: any) => ({ id: e.id, title: e.title, show: p.show?.name ?? e.show, showId: p.show?.id ?? e.showId, author: p.show?.author, genre: GENRE[g]?.name, audio: e.audio, art: e.art || p.show?.art, secs: e.secs, about: e.about, date: e.date, discover: discover && !follows.includes(p.show?.id) }))));
    void Promise.all([get(genres.slice(0, 8)), get([...new Set(fresh)])]).then(([mine, disc]) => {
      if (!live) return;
      const own = toEps(mine, false).sort((a, z) => Number(follows.includes(z.showId ?? "")) - Number(follows.includes(a.showId ?? "")));
      const seen = new Set<string>();
      setEps([...own, ...saved, ...toEps(disc, true)].filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true))).slice(0, 80));
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, genres.join(","), follows.join(","), today]);
  return eps;
}

export default function AriseFeed(props: Props) {
  const { family, setFamily, today, say, token, lifeTasks, lists, familySpace = false, userName, onToggleTask, onMoveTask, go } = props;
  const bridge = useHubTasks();
  const extra = useExtra(token, familySpace);
  const podcasts = usePodcasts(family, token, today);
  const [fitOver, setFitOver] = useState<any>(null);
  const fit = fitOver ?? extra.fit;
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
  const ctx = useMemo(() => ({ today, family, tasks, score: scoreStats?.score, stats: scoreStats?.stats, podcasts, fit: extra.fit, name: userName }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [today, openFeed, scoreStats, podcasts.length, tasks.length, !!extra.fit]);
  const snoozed = useMemo(() => readSnoozed(today), [today, openFeed]);
  const base = useMemo(() => {
    const real = realCards(ctx).filter((c) => !snoozed.has(c.id));
    const left = real.filter((c) => c.doneable || c.kind === "task").length;
    return [introCard(ctx, left), ...real];
  }, [ctx, snoozed]);
  const more = useMemo(() => Array.from({ length: pages }, (_, i) => discoverCards(ctx, i + 1)).flat(), [ctx, pages]);
  const cards = useMemo(() => [...base, ...more].filter((c) => inFilter(c, filter)), [base, more, filter]);
  const nearEnd = useCallback(() => setPages((p) => p + 1), []);

  // ——— Saving ———
  const mark = (c: FeedCard, how: string) => setHandled((h) => ({ ...h, [c.id]: how }));
  const celebrate = () => { tap("success"); confetti(1); };
  const update = (fn: (f: any) => any) => setFamily((f) => fn(f));
  const memberId = healthMe(family);
  const cooked = usesCooked(fit) && !!token;
  /** A change to Cooked's data: shown at once, then saved over the server's latest copy (Cooked merges on its next open). */
  const saveFit = async (fn: (d: any) => any) => {
    setFitOver((d: any) => fn(cleanFit(d ?? extra.fit)));
    try {
      const head = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      const r = await fetch(`${API_BASE}/api/fit/data`, { headers: head, cache: "no-store" });
      if (!r.ok) throw new Error();
      const next = cleanFit(fn(cleanFit((await r.json())?.data)));
      const w = await fetch(`${API_BASE}/api/fit/data`, { method: "PUT", headers: head, body: JSON.stringify({ data: next }) });
      if (!w.ok) throw new Error();
      setFitOver(next);
    } catch { say("Cooked couldn't save that right now. Try again in a minute."); }
  };
  const lb = () => { const w = [...(family.health?.weights ?? [])].filter((x: any) => x.memberId === memberId).pop()?.weight; const kg = fit?.weights?.[fit.weights.length - 1]?.kg; return Number(w) || (kg ? kg * 2.2046 : 160); };

  // ——— Actions ———
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
      case "chapter": update((f) => { const ls = f.lifeScore ?? emptyLifeScore(); return { ...f, lifeScore: { ...ls, days: { ...ls.days, [today]: { ...(ls.days?.[today] ?? {}), faith: true } } } }; }); say("Reading done. Counted toward Faith in Life Score."); break;
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
  const addTodo = (c: FeedCard) => { if (!c.todo) return; if (bridge) { bridge.add(c.todo, "From Arise Feed"); mark(c, "added"); tap(); say(`Added "${c.todo}" to your to-dos.`); } else say("Open To-dos once, then try again."); };
  const logFood = (item: Logged, meal: FitMeal) => {
    if (cooked) {
      const row = { name: item.name, kcal: item.kcal, p: item.p, c: item.c, f: item.f, servings: 1, ...(item.serving ? { serving: item.serving } : {}) };
      void saveFit((d) => ({ ...d, foods: [...(d.foods ?? []), { id: uid(), date: today, meal, ...row }], recentFoods: [row, ...(d.recentFoods ?? []).filter((x: any) => x.name.toLowerCase() !== item.name.toLowerCase())].slice(0, 60) }));
    } else update((f) => ({ ...f, health: { ...f.health, food: [...(f.health?.food ?? []), { id: uid(), memberId, date: today, meal: meal === "snack" ? "snacks" : meal, name: item.name, servings: 1, calories: item.kcal, protein: item.p, carbs: item.c, fat: item.f }] } }));
    tap("success"); say(`${item.name} logged to ${meal}${cooked ? " in Cooked" : ""}.`);
  };
  const logWorkout = (c: FeedCard, w: FeedWorkout, secs: number) => {
    const mins = Math.max(1, Math.round(secs / 60));
    if (cooked) void saveFit((d) => ({ ...d, workouts: [...(d.workouts ?? []), { id: uid(), date: new Date().toISOString(), name: w.name, programId: "arise-feed", dayId: w.id, secs: Math.round(secs),
      exercises: w.moves.map((m) => ({ exId: m.exId, name: CATALOG_BY_ID.get(m.exId)?.name ?? m.name, sets: Array.from({ length: w.rounds }, () => ({ reps: m.reps ?? 0, weight: 0, done: true })), ...(m.secs ? { target: `${m.secs}s` } : {}) })) }] }));
    else update((f) => ({ ...f, health: { ...f.health, exercise: [...(f.health?.exercise ?? []), { id: uid(), memberId, date: today, name: w.name, minutes: mins, calories: exerciseCalories(w.met, mins, lb()) }] } }));
    mark(c, "done"); celebrate(); say(`${w.name}: ${mins} min logged${cooked ? " in Cooked" : ""}.`);
  };
  const logActivity = (c: FeedCard, name: string, met: number, mins: number) => {
    update((f) => ({ ...f, health: { ...f.health, exercise: [...(f.health?.exercise ?? []), { id: uid(), memberId, date: today, name, minutes: mins, calories: exerciseCalories(met, mins, lb()) }] } }));
    mark(c, "done"); celebrate(); say(`${name}, ${mins} min logged.`);
  };
  const weigh = (c: FeedCard, value: number) => {
    if (!(value > 20 && value < 1000)) { say("Enter your weight."); return; }
    const kgUnits = fit?.profile?.units === "kg";
    if (cooked) void saveFit((d) => ({ ...d, weights: [...(d.weights ?? []).filter((x: any) => x.date !== today), { date: today, kg: Math.round((kgUnits ? value : value / 2.20462) * 10) / 10 }] }));
    else update((f) => ({ ...f, health: { ...f.health, weights: [...(f.health?.weights ?? []).filter((x: any) => !(x.memberId === memberId && x.date === today)), { id: uid(), memberId, date: today, weight: value }] } }));
    mark(c, "done"); celebrate(); say("Weigh-in saved.");
  };
  const saveVerse = (c: FeedCard) => {
    const v = c.verse; if (!v) return;
    if ((family.savedVerses ?? []).some((x: any) => x.reference.toLowerCase() === v.ref.toLowerCase())) { mark(c, "saved"); say(`${v.ref} is already saved.`); return; }
    update((f) => ({ ...f, savedVerses: [...(f.savedVerses ?? []), { id: uid(), reference: v.ref, text: v.text }] })); mark(c, "saved"); tap("success"); say(`${v.ref} saved to your Bible verses.`);
  };
  const saveWord = (c: FeedCard) => { const w = c.word; if (!w) return; update((f) => ({ ...f, savedWords: [...(f.savedWords ?? []).filter((x: any) => x.word !== w.word), { id: uid(), word: w.word, definition: w.definition }] })); mark(c, "saved"); tap("success"); say(`"${w.word}" saved to your words.`); };
  const collect = (c: FeedCard, kind: "reading" | "bucket", title: string, sub = "") => {
    update((f) => ({ ...f, collections: [...(f.collections ?? []), { id: uid(), kind, title, sub, status: "want", rating: 0, note: "", url: "", price: 0, doneOn: "" }] }));
    mark(c, kind === "reading" ? "saved" : "bucket"); tap("success"); say(kind === "reading" ? `${title} added to your reading list.` : `Added to your bucket list.`);
  };
  const copyText = async (c: FeedCard) => { try { await navigator.clipboard.writeText(c.copy ?? c.title); mark(c, "copied"); say("Copied."); } catch { say("Couldn't copy on this device."); } };
  const follow = (c: FeedCard) => {
    const e = c.ep; if (!e?.showId) return;
    update((f) => { const es = f.earshot ?? emptyEarshot(); if (es.follows.some((s: any) => s.id === e.showId)) return f; return { ...f, earshot: { ...es, follows: [{ id: e.showId, name: e.show, author: e.author ?? "", art: e.art, genre: Object.values(GENRE).find((g) => g.name === e.genre)?.id ?? "", at: new Date().toISOString() }, ...es.follows].slice(0, 500) } }; });
    mark(c, "followed"); tap("success"); say(`Following ${e.show} in Arise Podcasts.`);
  };
  const saveEp = (c: FeedCard) => {
    const e = c.ep; if (!e) return;
    update((f) => { const es = f.earshot ?? emptyEarshot(); if (es.saved.some((s: any) => s.id === e.id)) return f; return { ...f, earshot: { ...es, saved: [{ id: e.id, showId: e.showId ?? "", title: e.title, show: e.show, art: e.art, secs: e.secs, at: new Date().toISOString(), audio: e.audio, ...(e.date ? { date: e.date } : {}) }, ...es.saved].slice(0, 300) } }; });
    mark(c, "saved"); tap("success"); say("Saved to your podcast library.");
  };
  const breathed = (c: FeedCard) => { update((f) => ({ ...f, meditations: [...(f.meditations ?? []), { id: uid(), date: today, minutes: 1, kind: "breathing" }] })); mark(c, "done"); celebrate(); say("One mindful minute logged."); };

  // Live numbers for cards that change as you tap.
  const water = (() => { const d = (family.health?.days ?? []).find((x: any) => x.date === today && (!x.memberId || x.memberId === memberId)); return Number(d?.water) || 0; })();
  const waterGoal = Number(family.health?.goals?.[memberId]?.water) || 8;
  const jar = (id?: string) => (family.jars ?? []).find((j: any) => j.id === id);
  const food = useMemo(() => foodToday(family, fit, today), [family, fit, today]);
  const quickFoods: Logged[] = useMemo(() => {
    const seen = new Set<string>(), out: Logged[] = [];
    const add = (x: Logged) => { const k = x.name.toLowerCase(); if (!seen.has(k) && x.name) { seen.add(k); out.push(x); } };
    for (const r of fit?.recentFoods ?? []) add({ name: r.name, kcal: r.kcal, p: r.p, c: r.c, f: r.f, serving: r.serving });
    for (const r of fit?.favFoods ?? []) add({ name: r.name, kcal: r.kcal, p: r.p, c: r.c, f: r.f, serving: r.serving });
    try { for (const r of recentFoods(family.health, memberId, 20)) add({ name: r.name, kcal: r.calories, p: r.protein, c: r.carbs, f: r.fat }); } catch { /* no diary yet */ }
    return out;
  }, [fit, family.health, memberId]);

  const top = (
    <div className="flex max-w-[calc(100vw-5rem)] gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {FILTERS.map((f) => <button key={f.id} type="button" onClick={() => { setFilter(f.id); feedRef.current?.goTo(0); }} aria-pressed={filter === f.id}
        className={`min-h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold backdrop-blur transition ${filter === f.id ? "bg-white text-[#0b0b0f]" : "bg-black/30 text-white"}`}>{f.label}</button>)}
    </div>
  );

  const act: Act = {
    done, later, openIt, addWater, addJar, checkIn, write, addTodo, logFood, logWorkout, logActivity, weigh, saveVerse, saveWord, collect, copyText, follow, saveEp, breathed,
    token: token ?? null,
  };
  const pagesOut: ReactNode[] = cards.map((c, i) => (
    <FeedPage key={c.id} c={c} pos={`${i + 1}`} handled={handled[c.id]} live={{ water, waterGoal, jar: jar(c.ref), food, quickFoods, cooked }} act={act} active={i === index} />
  ));

  return (
    <div className="mx-auto w-full max-w-2xl py-6" data-testid="arise-feed">
      <div className="overflow-hidden rounded-[28px] bg-[#0e0e12] p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#c6f432]">Arise Feed</p>
        <h1 className="mt-2 text-[32px] font-extrabold leading-tight tracking-[-0.02em]">Your whole life, one swipe at a time.</h1>
        <p className="mt-2 max-w-md text-[15px] leading-6 text-white/70">To-dos from every hub, your week, food and workouts, Bible reading, podcasts to discover, money, home, hobbies and ideas, trivia, Life Score and Mindset. It never runs out.</p>
        <button type="button" onClick={() => { setOpenFeed(true); setIndex(0); }} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#c6f432] px-6 text-[15px] font-extrabold text-[#16161d]" data-testid="arise-feed-open"><Play className="h-4 w-4" fill="currentColor" />Open the feed</button>
      </div>
      {openFeed && <SwipeFeed ref={feedRef} pages={pagesOut} label="Arise Feed" top={top} onClose={() => setOpenFeed(false)} onIndex={setIndex} onNearEnd={nearEnd} />}
    </div>
  );
}

// ——— One card ————————————————————————————————————————————————————————————————————————————————————————————————————
export type Act = {
  done: (c: FeedCard) => void; later: (c: FeedCard) => void; openIt: (c: FeedCard) => void; addWater: () => void; addJar: (c: FeedCard, n: number) => void;
  checkIn: (c: FeedCard, v: number) => void; write: (c: FeedCard, t: string) => void; addTodo: (c: FeedCard) => void;
  logFood: (item: Logged, meal: FitMeal) => void; logWorkout: (c: FeedCard, w: FeedWorkout, secs: number) => void; logActivity: (c: FeedCard, name: string, met: number, mins: number) => void;
  weigh: (c: FeedCard, v: number) => void; saveVerse: (c: FeedCard) => void; saveWord: (c: FeedCard) => void; collect: (c: FeedCard, kind: "reading" | "bucket", title: string, sub?: string) => void;
  copyText: (c: FeedCard) => void; follow: (c: FeedCard) => void; saveEp: (c: FeedCard) => void; breathed: (c: FeedCard) => void; token: string | null;
};
type Live = { water: number; waterGoal: number; jar?: any; food: ReturnType<typeof foodToday>; quickFoods: Logged[]; cooked: boolean };

export function FeedPage({ c, pos, handled, live, act, active }: { c: FeedCard; pos: string; handled?: string; live: Live; act: Act; active: boolean }) {
  const isDone = handled === "done";
  const stamp = handled === "done" ? (c.doneWord ?? "DONE") : handled === "later" ? "TOMORROW" : handled === "added" ? "ADDED" : "";
  const chips = (list?: string[]) => list && list.length > 0 && <div className="flex flex-wrap gap-2">{list.map((x) => <span key={x} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">{x}</span>)}</div>;
  const textSize = (t: string) => (t.length > 220 ? "text-[21px]" : t.length > 140 ? "text-[24px]" : t.length > 80 ? "text-[29px]" : "text-[34px]");
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
        {chips(c.chips)}
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
            <button type="button" onClick={act.addWater} className="mt-3 min-h-12 rounded-full px-5 text-base font-bold text-[#04313f]" style={{ background: c.accent }}>+ 1 cup</button>
          </div>
        </div>
        <p className="text-[15px] text-white/70">{live.water >= live.waterGoal ? "Goal reached. Nice." : `${live.waterGoal - live.water} to go.`}</p>
      </>}

      {(c.kind === "rings" || c.kind === "sleep") && <>
        {c.kind === "rings" && <div className="flex items-center gap-5"><Ring pct={c.pct ?? 0} color={c.accent} size={140}><span className={`${H} text-[22px]`}>{c.pct}%</span></Ring><div><p className={`${H} text-[34px]`}>{c.big}</p><p className="text-sm font-bold" style={{ color: c.accent }}>{c.sub}</p></div></div>}
        <h2 className={`${H} text-[32px]`}>{c.title}</h2>
        {chips(c.chips)}
        {c.body && <p className="max-w-md text-[17px] font-semibold leading-7 text-white/85">{c.body}</p>}
      </>}

      {c.kind === "podcast" && <Podcast c={c} active={active} onFollow={() => act.follow(c)} onSave={() => act.saveEp(c)} handled={handled} />}
      {c.kind === "show" && <Podcast c={c} active={active} show onFollow={() => act.follow(c)} onSave={() => act.saveEp(c)} handled={handled} />}

      {c.kind === "jar" && (() => { const j = live.jar; const saved = j?.saved ?? 0, target = j?.target ?? 1; return <>
        <h2 className={`${H} text-[34px]`}>{c.title}</h2>
        <div className="flex items-baseline gap-2"><span className={`${H} text-[56px]`} style={{ color: c.accent }}>${Math.round(saved).toLocaleString()}</span><span className="text-[17px] text-white/70">of ${Math.round(target).toLocaleString()}</span></div>
        <div className="h-3.5 rounded-full bg-white/15"><div className="h-3.5 rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, (saved / target) * 100)}%`, background: c.accent }} /></div>
        <p className="text-[15px] text-white/75">{saved >= target ? "Fully funded." : `$${Math.round(target - saved).toLocaleString()} to go.`}</p>
        <div className="flex gap-2">{[10, 25, 50].map((n) => <button key={n} type="button" onClick={() => act.addJar(c, n)} className="min-h-12 rounded-full px-5 text-base font-bold text-[#053b2a]" style={{ background: c.accent }}>+${n}</button>)}</div>
      </>; })()}

      {(c.kind === "bill" || c.kind === "countdown" || c.kind === "stat" || c.kind === "record" || c.kind === "goal") && <>
        <h2 className={`${H} text-[38px] ${isDone && c.kind === "bill" ? "line-through opacity-55" : ""}`}>{c.title}</h2>
        {c.big && <div className="flex flex-wrap items-baseline gap-2.5"><span className={`${H} text-[56px]`} style={{ color: c.accent }}>{c.big}</span>{c.sub && <span className="text-[17px] text-white/70">{c.sub}</span>}</div>}
        {!c.big && c.sub && <p className="text-[17px] text-white/70">{c.sub}</p>}
        {c.pct !== undefined && c.kind === "goal" && <div className="h-3 rounded-full bg-white/15"><div className="h-3 rounded-full" style={{ width: `${c.pct}%`, background: c.accent }} /></div>}
        {c.body && <p className="max-w-md text-[15px] leading-6 text-white/70">{c.body}</p>}
        {c.todo && <TodoButton c={c} onTodo={() => act.addTodo(c)} added={handled === "added"} />}
      </>}

      {(c.kind === "insight" || c.kind === "tip" || c.kind === "mind" || c.kind === "memory" || c.kind === "measure" || c.kind === "birthday" || c.kind === "lesson" || c.kind === "fact") && <>
        <h2 className={`${H} ${textSize(c.title)}`}>{c.title}</h2>
        {c.sub && <p className="text-[17px] font-semibold" style={{ color: c.accent }}>{c.sub}</p>}
        {c.body && <p className="line-clamp-[14] max-w-md whitespace-pre-line text-[15px] leading-6 text-white/75">{c.body}</p>}
        {c.todo && <TodoButton c={c} onTodo={() => act.addTodo(c)} added={handled === "added"} />}
      </>}

      {c.kind === "quote" && <>
        <h2 className={`${SERIF} ${textSize(c.title)} font-semibold leading-[1.2]`}>{c.title}</h2>
        <p className="text-[17px] font-semibold text-white/70">{c.sub}</p>
        <button type="button" onClick={() => act.copyText(c)} className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-full bg-white/12 px-4 text-sm font-bold">{handled === "copied" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{handled === "copied" ? "Copied" : "Copy"}</button>
      </>}

      {(c.kind === "verse" || c.kind === "chapter") && <Scripture c={c} act={act} handled={handled} />}

      {(c.kind === "idea" || c.kind === "kind" || c.kind === "hobby") && <>
        <h2 className={`${H} ${c.title.length > 70 ? "text-[28px]" : "text-[34px]"}`}>{c.title}</h2>
        {chips(c.chips)}
        {c.body && <p className="max-w-md text-[16px] leading-7 text-white/75">{c.body}</p>}
        {c.sub && <p className="text-[15px] font-bold" style={{ color: c.accent }}>{c.sub}</p>}
        <div className="flex flex-wrap gap-2">
          {c.todo && <TodoButton c={c} onTodo={() => act.addTodo(c)} added={handled === "added"} label={c.kind === "hobby" ? "Add first step" : undefined} />}
          {c.bucket && <button type="button" onClick={() => act.collect(c, "bucket", c.bucket!)} disabled={handled === "bucket"} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/12 px-4 text-sm font-bold disabled:opacity-60">{handled === "bucket" ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}{handled === "bucket" ? "On your bucket list" : "Bucket list"}</button>}
        </div>
      </>}

      {c.kind === "book" && <>
        <div className="flex h-44 w-32 flex-col justify-between rounded-r-xl rounded-l-sm p-3 shadow-[6px_6px_0_#00000040]" style={{ background: c.accent, color: c.bg }}><span className="text-[13px] font-extrabold leading-tight">{c.title}</span><span className="text-[11px] font-semibold">{c.sub}</span></div>
        <h2 className={`${H} text-[32px]`}>{c.title}</h2>
        <p className="text-[17px] font-semibold" style={{ color: c.accent }}>{c.sub}</p>
        {c.body && <p className="text-[16px] leading-7 text-white/75">{c.body}</p>}
        <button type="button" onClick={() => act.collect(c, "reading", c.book!.title, c.book!.author)} disabled={handled === "saved"} className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-full px-4 text-sm font-bold text-[#1a120b] disabled:opacity-70" style={{ background: c.accent }}>{handled === "saved" ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{handled === "saved" ? "On your reading list" : "Add to reading list"}</button>
      </>}

      {c.kind === "word" && <>
        <h2 className={`${SERIF} text-[48px] font-semibold leading-none`}>{c.title}</h2>
        <p className="text-[19px] font-semibold leading-7">{c.sub}</p>
        <p className="text-[16px] italic leading-7 text-white/70">{c.body}</p>
        <button type="button" onClick={() => act.saveWord(c)} disabled={handled === "saved"} className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-full px-4 text-sm font-bold text-[#14213d] disabled:opacity-70" style={{ background: c.accent }}>{handled === "saved" ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}{handled === "saved" ? "Saved" : "Save word"}</button>
      </>}

      {c.kind === "trivia" && <Trivia c={c} />}
      {c.kind === "breath" && <Breath c={c} active={active} done={isDone} onDone={() => act.breathed(c)} />}
      {(c.kind === "workout") && c.workout && <WorkoutRun c={c} w={c.workout} active={active} done={isDone} onLog={(secs) => act.logWorkout(c, c.workout!, secs)} />}
      {c.kind === "program" && <>
        <h2 className={`${H} text-[36px]`}>{c.title}</h2>
        {chips(c.chips)}
        {c.body && <p className="text-[16px] leading-7 text-white/75">{c.body}</p>}
        <button type="button" onClick={() => act.openIt(c)} className="inline-flex min-h-12 items-center gap-2 self-start rounded-full px-5 text-base font-bold text-[#2d0c0c]" style={{ background: c.accent }}><Play className="h-4 w-4" fill="currentColor" />Start in Cooked</button>
      </>}
      {c.kind === "activity" && <Activity c={c} done={isDone} onLog={(name, met, mins) => act.logActivity(c, name, met, mins)} />}
      {c.kind === "weigh" && <Weigh c={c} done={isDone} onSave={(v) => act.weigh(c, v)} />}
      {c.kind === "foodday" && <FoodDay c={c} food={live.food} />}
      {(c.kind === "foodlog") && <FoodLog c={c} quick={live.quickFoods} onLog={(item) => act.logFood(item, c.meal ?? "snack")} />}
      {c.kind === "food" && c.food && <>
        <h2 className={`${H} text-[34px]`}>{c.title}</h2>
        {chips(c.chips)}
        {c.body && <p className="text-[16px] leading-7 text-white/75">{c.body}</p>}
        <p className="text-sm text-white/55">{c.food.c} g carbs · {c.food.f} g fat · approximate</p>
        <button type="button" onClick={() => { act.logFood({ name: c.food!.name, kcal: c.food!.kcal, p: c.food!.p, c: c.food!.c, f: c.food!.f, serving: c.food!.serving }, c.meal ?? "snack"); }} className="inline-flex min-h-12 items-center gap-2 self-start rounded-full px-5 text-base font-bold text-[#2f1d0d]" style={{ background: c.accent }}><Plus className="h-4 w-4" />I ate this</button>
      </>}

      {c.kind === "habit" && <>
        <h2 className={`${H} text-[40px] ${isDone ? "line-through opacity-55" : ""}`}>{c.title}</h2>
        <div className="grid grid-cols-7 gap-1.5">{(c.bars ?? []).map((b, i) => <div key={i} className="flex flex-col items-center gap-1.5"><span className="h-9 w-9 rounded-[10px]" style={{ background: b.v || (b.hi && isDone) ? c.accent : "rgba(255,255,255,0.12)" }} /><span className="text-xs text-white/60">{b.label}</span></div>)}</div>
        <p className="text-[17px] font-bold" style={{ color: c.accent }}>{isDone ? "Done today. Streak kept." : c.sub}</p>
      </>}

      {c.kind === "checkin" && <>
        <h2 className={`${H} text-[34px]`}>{c.title}</h2>
        <div className="grid grid-cols-6 gap-2">{Array.from({ length: 11 }, (_, v) => <button key={v} type="button" onClick={() => act.checkIn(c, v)} aria-pressed={handled === String(v)} className="h-12 rounded-2xl text-base font-bold" style={{ background: handled === String(v) ? c.accent : "rgba(255,255,255,0.12)", color: handled === String(v) ? "#082f49" : "#fff" }}>{v}</button>)}</div>
        <div className="flex justify-between text-xs text-white/55"><span>0 · {c.low}</span><span>10 · {c.high}</span></div>
        <p className="text-[15px] text-white/70">{handled ? "Saved to your Life Score." : "One tap. It feeds your Life Score and Patterns."}</p>
      </>}

      {(c.kind === "gratitude" || c.kind === "journal") && <Writer c={c} done={isDone} onWrite={(t) => act.write(c, t)} />}

      {stamp && <span className="pointer-events-none absolute right-[92px] top-32 -rotate-[8deg] rounded-xl border-[3px] px-3.5 py-1.5 text-lg font-extrabold tracking-[0.08em] [font-family:'Space_Grotesk',Inter,sans-serif]" style={{ borderColor: handled === "later" ? "#fbbf24" : "#c6f432", color: handled === "later" ? "#fbbf24" : "#c6f432" }}>{stamp}</span>}

      {/* Right rail */}
      <div className="absolute bottom-36 right-3 flex flex-col items-center gap-[18px]">
        {c.doneable && <RailButton label={isDone ? "Done" : c.kind === "bill" ? "Paid" : c.kind === "pill" ? "Taken" : c.kind === "chapter" ? "Read" : c.kind === "goal" ? (c.doneWord === "+1" ? "+1" : "Step") : "Done"} on={isDone} onClick={() => act.done(c)}><Check className="h-6 w-6" strokeWidth={2.6} /></RailButton>}
        {c.snoozable && <RailButton label="Later" on={handled === "later"} onClick={() => act.later(c)}><Clock className="h-6 w-6" /></RailButton>}
        {c.open && <RailButton label="Open" onClick={() => act.openIt(c)}><ArrowUpRight className="h-6 w-6" /></RailButton>}
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

function TodoButton({ c, onTodo, added, label }: { c: FeedCard; onTodo: () => void; added: boolean; label?: string }) {
  return <button type="button" onClick={onTodo} disabled={added} className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-full px-4 text-sm font-bold text-[#0b0b0f] disabled:opacity-70" style={{ background: c.accent }}>{added ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{added ? "Added to your to-dos" : label ?? (c.kind === "tip" || c.kind === "goal" ? c.todo : "Add to my to-dos")}</button>;
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
    <h2 className={`${H} text-[30px]`}>{c.title}</h2>
    {done ? <p className="text-[17px] font-semibold" style={{ color: c.accent }}>Saved. Swipe on.</p> : <>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={c.kind === "gratitude" ? "I'm grateful for…" : "Write a few lines…"} aria-label={c.title}
        className="w-full resize-none rounded-2xl border border-white/15 bg-white/10 p-4 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2" />
      <button type="button" onClick={() => onWrite(text)} disabled={!text.trim()} className="min-h-12 self-start rounded-full px-6 text-base font-bold text-[#16161d] disabled:opacity-40" style={{ background: c.accent }}>Save</button>
    </>}
  </>;
}

/** A verse (save it, read its chapter) or a chapter of the reading plan, read in place (KJV, read live). */
function Scripture({ c, act, handled }: { c: FeedCard; act: Act; handled?: string }) {
  const [text, setText] = useState<{ verse: number; text: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const read = async () => {
    if (!c.passage || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${API_BASE}/api/lifehub/bible?ref=${encodeURIComponent(c.passage)}`, { headers: act.token ? { Authorization: `Bearer ${act.token}` } : {} });
      const b = await r.json().catch(() => null);
      if (!r.ok || !Array.isArray(b?.verses)) throw new Error(b?.message || "That passage can't be loaded right now.");
      setText(b.verses.map((v: any) => ({ verse: v.verse, text: String(v.text).trim() })));
    } catch (e: any) { setErr(e.message || "That passage can't be loaded right now."); }
    finally { setBusy(false); }
  };
  if (text) return <>
    <h2 className={`${H} text-[28px]`}>{c.passage}</h2>
    <div className={`${SERIF} max-h-[52dvh] overflow-y-auto overscroll-contain rounded-2xl bg-black/25 p-4 text-[17px] leading-8 text-white/90`} data-testid="feed-passage">
      {text.map((v) => <span key={v.verse}><sup className="mr-1 text-[11px] font-bold" style={{ color: c.accent }}>{v.verse}</sup>{v.text} </span>)}
    </div>
    <p className="text-xs text-white/50">King James Version</p>
  </>;
  return <>
    {c.kind === "verse" ? <h2 className={`${SERIF} ${c.title.length > 200 ? "text-[21px]" : c.title.length > 120 ? "text-[25px]" : "text-[30px]"} font-semibold leading-[1.3]`}>{c.title}</h2>
      : <><h2 className={`${H} text-[44px]`}>{c.title}</h2>{c.body && <p className="text-[17px] leading-7 text-white/75">{c.body}</p>}</>}
    {c.kind === "verse" && <p className="text-[17px] font-bold" style={{ color: c.accent }}>{c.sub}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={read} disabled={busy} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-[#2a1d0c] disabled:opacity-60" style={{ background: c.accent }}><BookOpen className="h-4 w-4" />{busy ? "Opening…" : c.kind === "verse" ? `Read ${c.passage}` : "Read it here"}</button>
      {c.kind === "verse" && <button type="button" onClick={() => act.saveVerse(c)} disabled={handled === "saved"} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/12 px-4 text-sm font-bold disabled:opacity-60">{handled === "saved" ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}{handled === "saved" ? "Saved" : "Save verse"}</button>}
    </div>
    {err && <p className="text-sm text-amber-200">{err}</p>}
  </>;
}

function Trivia({ c }: { c: FeedCard }) {
  const [pick, setPick] = useState<number | null>(null);
  const right = pick !== null && pick === c.answer;
  return <>
    <h2 className={`${H} text-[30px]`}>{c.title}</h2>
    <div className="grid gap-2">{(c.options ?? []).map((o, i) => {
      const show = pick !== null, isAns = i === c.answer, mine = i === pick;
      return <button key={o} type="button" disabled={show} onClick={() => { setPick(i); tap(i === c.answer ? "success" : undefined); if (i === c.answer) confetti(1); }}
        className="flex min-h-12 items-center justify-between rounded-2xl px-4 text-left text-base font-bold transition disabled:cursor-default"
        style={{ background: show && isAns ? "#4ade80" : show && mine ? "#f87171" : "rgba(255,255,255,0.12)", color: show && (isAns || mine) ? "#0b0b0f" : "#fff" }}>
        <span>{o}</span>{show && isAns && <Check className="h-5 w-5" />}{show && mine && !isAns && <X className="h-5 w-5" />}
      </button>;
    })}</div>
    {pick !== null && <p className="text-[16px] leading-7 text-white/80"><b style={{ color: c.accent }}>{right ? "Right! " : "Not quite. "}</b>{c.body}</p>}
  </>;
}

/** A guided breath: a circle that grows and shrinks with the pattern, four rounds. */
function Breath({ c, active, done, onDone }: { c: FeedCard; active: boolean; done: boolean; onDone: () => void }) {
  const pattern = c.breath ?? [4, 4, 4, 4];
  const [run, setRun] = useState(false);
  const [t, setT] = useState(0);
  const cycle = pattern.reduce((a, b) => a + b, 0), total = cycle * 4;
  useEffect(() => { if (!active) setRun(false); }, [active]);
  useEffect(() => {
    if (!run) return;
    const id = window.setInterval(() => setT((x) => { if (x + 1 >= total) { window.clearInterval(id); setRun(false); onDone(); return total; } return x + 1; }), 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);
  const inCycle = t % cycle;
  const phase = inCycle < pattern[0] ? 0 : inCycle < pattern[0] + pattern[1] ? 1 : inCycle < pattern[0] + pattern[1] + pattern[2] ? 2 : 3;
  const word = ["Breathe in", "Hold", "Breathe out", "Hold"][phase];
  const big = run ? (phase === 0 || phase === 1) : false;
  return <>
    <h2 className={`${H} text-[34px]`}>{c.title}</h2>
    {!run && <p className="text-[16px] leading-7 text-white/75">{c.body}</p>}
    <div className="grid h-52 place-items-center">
      <div className="grid place-items-center rounded-full transition-all ease-in-out" style={{ width: big ? 200 : 110, height: big ? 200 : 110, background: `${c.accent}33`, border: `3px solid ${c.accent}`, transitionDuration: `${(phase === 0 ? pattern[0] : phase === 2 ? pattern[2] : 1) * 1000}ms` }}>
        <span className="text-lg font-bold">{run ? word : done || t >= total ? "Nice." : "Ready"}</span>
      </div>
    </div>
    {!run && !done && <button type="button" onClick={() => { setT(0); setRun(true); }} className="inline-flex min-h-12 items-center gap-2 self-start rounded-full px-6 text-base font-bold text-[#0b2633]" style={{ background: c.accent }}><Play className="h-4 w-4" fill="currentColor" />Start · {total < 90 ? `${total} sec` : `${Math.round(total / 60)} min`}</button>}
    {run && <p className="text-sm text-white/60">Round {Math.min(4, Math.floor(t / cycle) + 1)} of 4</p>}
  </>;
}

/** A workout to run here: each move with its countdown (or reps and a Next button), then it's logged. */
function WorkoutRun({ c, w, active, done, onLog }: { c: FeedCard; w: FeedWorkout; active: boolean; done: boolean; onLog: (secs: number) => void }) {
  const steps = useMemo(() => Array.from({ length: w.rounds }, (_, r) => w.moves.map((m) => ({ ...m, round: r + 1 }))).flat(), [w]);
  const [i, setI] = useState(-1);
  const [left, setLeft] = useState(0);
  const [paused, setPaused] = useState(false);
  const started = useRef(0);
  const running = i >= 0 && i < steps.length;
  useEffect(() => { if (!active && running) setPaused(true); }, [active, running]);
  const goTo = (n: number) => { if (n >= steps.length) { setI(steps.length); onLog((Date.now() - started.current) / 1000); return; } setI(n); setLeft(steps[n].secs ?? 0); tap(); };
  useEffect(() => {
    if (!running || paused || !steps[i].secs) return;
    const id = window.setInterval(() => setLeft((x) => (x <= 1 ? (window.clearInterval(id), 0) : x - 1)), 1000);
    return () => window.clearInterval(id);
  }, [i, paused, running, steps]);
  useEffect(() => { if (running && steps[i].secs && left === 0 && !paused) goTo(i + 1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [left]);
  if (running) {
    const s = steps[i], cue = CATALOG_BY_ID.get(s.exId)?.cues?.[0] ?? s.cue;
    return <>
      <p className="text-sm font-bold text-white/60">{w.rounds > 1 ? `Round ${s.round} of ${w.rounds} · ` : ""}Move {(i % w.moves.length) + 1} of {w.moves.length}</p>
      <h2 className={`${H} text-[40px]`}>{s.name}</h2>
      <p className={`${H} text-[80px]`} style={{ color: c.accent }}>{s.secs ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : `×${s.reps}`}</p>
      <p className="text-[16px] leading-7 text-white/75">{cue}</p>
      {steps[i + 1] && <p className="text-sm text-white/55">Next: {steps[i + 1].name}</p>}
      <div className="flex gap-2">
        {s.secs ? <button type="button" onClick={() => setPaused((p) => !p)} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/15 px-5 font-bold">{paused ? <Play className="h-4 w-4" fill="currentColor" /> : <Pause className="h-4 w-4" fill="currentColor" />}{paused ? "Resume" : "Pause"}</button> : null}
        <button type="button" onClick={() => { setPaused(false); goTo(i + 1); }} className="inline-flex min-h-12 items-center rounded-full px-5 font-bold text-[#3a1208]" style={{ background: c.accent }}>{steps[i + 1] ? (s.secs ? "Skip" : "Done, next") : "Finish"}</button>
      </div>
    </>;
  }
  return <>
    <h2 className={`${H} text-[34px] ${done ? "opacity-60" : ""}`}>{c.title}</h2>
    <div className="flex flex-wrap gap-2">{(c.chips ?? []).map((x) => <span key={x} className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">{x}</span>)}</div>
    <ol className="space-y-1 text-[15px] text-white/85">{w.moves.slice(0, 7).map((m, k) => <li key={k} className="flex justify-between gap-3"><span>{m.name}</span><span className="shrink-0 text-white/55">{m.secs ? `${m.secs}s` : `×${m.reps}`}</span></li>)}{w.moves.length > 7 && <li className="text-white/55">+{w.moves.length - 7} more</li>}</ol>
    {c.body && <p className="line-clamp-3 text-[14px] leading-6 text-white/60">{c.body}</p>}
    {done || i >= steps.length ? <p className="text-[17px] font-bold" style={{ color: c.accent }}>Workout logged. Strong work.</p> :
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { started.current = Date.now(); setPaused(false); goTo(0); }} className="inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-base font-bold text-[#3a1208]" style={{ background: c.accent }}><Play className="h-4 w-4" fill="currentColor" />Start</button>
        <button type="button" onClick={() => onLog(w.mins * 60)} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/12 px-5 text-base font-bold"><Check className="h-4 w-4" />I did it</button>
      </div>}
  </>;
}

const ACTS = [{ name: "Walk", met: 4.3 }, { name: "Run", met: 9.8 }, { name: "Strength training", met: 3.5 }, { name: "Cycling", met: 8 }, { name: "Yoga", met: 2.5 }, { name: "HIIT", met: 8 }, { name: "Sports", met: 6.5 }, { name: "Yard work", met: 4 }];
function Activity({ c, done, onLog }: { c: FeedCard; done: boolean; onLog: (name: string, met: number, mins: number) => void }) {
  const [a, setA] = useState(ACTS.find((x) => x.name === c.sub) ?? ACTS[0]);
  if (done) return <><h2 className={`${H} text-[34px]`}>Logged.</h2><p className="text-[17px] font-semibold" style={{ color: c.accent }}>It counts toward your exercise in Life Score.</p></>;
  return <>
    <h2 className={`${H} text-[34px]`}>{c.title}</h2>
    <div className="flex flex-wrap gap-2">{ACTS.map((x) => <button key={x.name} type="button" onClick={() => setA(x)} aria-pressed={a.name === x.name} className="min-h-10 rounded-full px-3.5 text-sm font-bold" style={{ background: a.name === x.name ? c.accent : "rgba(255,255,255,0.12)", color: a.name === x.name ? "#2d0f0f" : "#fff" }}>{x.name}</button>)}</div>
    <p className="text-sm font-semibold text-white/60">How long?</p>
    <div className="grid grid-cols-4 gap-2">{[10, 20, 30, 45, 60, 75, 90, 120].map((m) => <button key={m} type="button" onClick={() => onLog(a.name, a.met, m)} className="h-12 rounded-2xl bg-white/12 text-base font-bold">{m}m</button>)}</div>
  </>;
}

function Weigh({ c, done, onSave }: { c: FeedCard; done: boolean; onSave: (v: number) => void }) {
  const [v, setV] = useState("");
  if (done) return <><h2 className={`${H} text-[34px]`}>Saved.</h2><p className="text-[17px] font-semibold" style={{ color: c.accent }}>See your trend in {c.source.split(" · ")[0]}.</p></>;
  return <>
    <h2 className={`${H} text-[36px]`}>{c.title}</h2>
    {c.body && <p className="text-[16px] leading-7 text-white/75">{c.body}</p>}
    <div className="flex items-center gap-2">
      <input inputMode="decimal" value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0.0" aria-label={`Weight in ${c.sub}`} className="h-14 w-36 rounded-2xl border border-white/15 bg-white/10 px-4 text-2xl font-bold text-white placeholder:text-white/30 focus:outline-none focus:ring-2" />
      <span className="text-lg font-bold text-white/70">{c.sub}</span>
      <button type="button" onClick={() => onSave(Number(v))} disabled={!Number(v)} className="ml-1 min-h-12 rounded-full px-5 font-bold text-[#13262f] disabled:opacity-40" style={{ background: c.accent }}>Save</button>
    </div>
  </>;
}

function FoodDay({ c, food }: { c: FeedCard; food: ReturnType<typeof foodToday> }) {
  const left = food.goal - food.kcal;
  const macros = [{ label: "Protein", v: food.p, goal: food.goals.p, color: "#f472b6" }, { label: "Carbs", v: food.c, goal: food.goals.c, color: "#60a5fa" }, { label: "Fat", v: food.fat, goal: food.goals.fat, color: "#fbbf24" }];
  return <>
    <div className="flex items-center gap-5">
      <Ring pct={Math.min(100, (food.kcal / food.goal) * 100)} color={c.accent} size={130}><span className="flex flex-col items-center"><span className={`${H} text-[28px]`}>{food.kcal.toLocaleString()}</span><span className="text-[11px] text-white/60">of {food.goal.toLocaleString()}</span></span></Ring>
      <div className="min-w-0"><p className={`${H} text-[26px]`}>{food.kcal ? (left >= 0 ? `${left.toLocaleString()} left` : `${(-left).toLocaleString()} over`) : "Nothing yet"}</p><p className="text-sm text-white/60">calories today</p></div>
    </div>
    <div className="space-y-2.5">{macros.map((m) => <div key={m.label}><div className="mb-1 flex justify-between text-sm font-semibold"><span>{m.label}</span><span className="text-white/65">{m.v} / {m.goal} g</span></div><div className="h-2.5 rounded-full bg-white/12"><div className="h-2.5 rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, (m.v / Math.max(1, m.goal)) * 100)}%`, background: m.color }} /></div></div>)}</div>
    <p className="line-clamp-4 whitespace-pre-line text-[14px] leading-6 text-white/65">{food.fromApple ? "From Apple Health." : food.items.length ? (["breakfast", "lunch", "dinner", "snack"] as FitMeal[]).filter((m) => food.meals.has(m)).map((m) => `${m[0].toUpperCase() + m.slice(1)}: ${food.items.filter((i) => i.meal === m).map((i) => i.name).slice(0, 4).join(", ")}`).join("\n") : c.body}</p>
  </>;
}

/** Log a meal: one tap on a recent food, a search of common foods, or your own. */
function FoodLog({ c, quick, onLog }: { c: FeedCard; quick: Logged[]; onLog: (item: Logged) => void }) {
  const [q, setQ] = useState("");
  const [added, setAdded] = useState<string[]>([]);
  const [own, setOwn] = useState({ name: "", kcal: "" });
  const pool: Logged[] = useMemo(() => [...quick, ...COMMON_FOODS.map((f) => ({ name: f.name, kcal: f.calories, p: f.protein, c: f.carbs, f: f.fat, serving: f.serving }))], [quick]);
  const shown = (q.trim() ? pool.filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase())) : pool).filter((f, i, a) => a.findIndex((x) => x.name.toLowerCase() === f.name.toLowerCase()) === i).slice(0, 8);
  const log = (f: Logged) => { onLog(f); setAdded((a) => [...a, f.name]); };
  return <>
    <h2 className={`${H} text-[32px]`}>{c.title}</h2>
    {added.length > 0 && <p className="text-[15px] font-bold" style={{ color: c.accent }}>Logged: {added.join(", ")}</p>}
    <label className="relative block"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods" aria-label="Search foods" className="h-12 w-full rounded-2xl border border-white/15 bg-white/10 pl-10 pr-3 text-base text-white placeholder:text-white/40 focus:outline-none focus:ring-2" /></label>
    <div className="flex max-h-[30dvh] flex-wrap gap-2 overflow-y-auto overscroll-contain">{shown.map((f) => <button key={f.name} type="button" onClick={() => log(f)} className="min-h-10 rounded-full bg-white/12 px-3.5 text-left text-sm font-bold">{f.name} <span className="font-semibold text-white/55">· {Math.round(f.kcal)}</span></button>)}</div>
    <div className="flex gap-2">
      <input value={own.name} onChange={(e) => setOwn({ ...own, name: e.target.value })} placeholder="Something else" aria-label="Food name" className="h-11 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white placeholder:text-white/40 focus:outline-none" />
      <input value={own.kcal} onChange={(e) => setOwn({ ...own, kcal: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="cal" aria-label="Calories" className="h-11 w-16 rounded-xl border border-white/15 bg-white/10 px-2 text-sm text-white placeholder:text-white/40 focus:outline-none" />
      <button type="button" disabled={!own.name.trim()} onClick={() => { log({ name: own.name.trim(), kcal: Number(own.kcal) || 0, p: 0, c: 0, f: 0 }); setOwn({ name: "", kcal: "" }); }} className="h-11 rounded-xl px-3 text-sm font-bold text-[#2b1a0a] disabled:opacity-40" style={{ background: c.accent }}>Add</button>
    </div>
  </>;
}

function Podcast({ c, active, show, onFollow, onSave, handled }: { c: FeedCard; active: boolean; show?: boolean; onFollow: () => void; onSave: () => void; handled?: string }) {
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
    {c.art ? <img src={c.art} alt="" className={`${show ? "h-36 w-36" : "h-44 w-44"} rounded-[28px] object-cover`} /> : <div className="grid h-40 w-40 place-items-center rounded-[28px]" style={{ background: c.accent }}><Sparkles className="h-12 w-12 text-[#2a1650]" /></div>}
    <h2 className={`${H} line-clamp-3 ${show ? "text-[32px]" : "text-[28px]"}`}>{c.title}</h2>
    <p className="text-[15px] font-semibold" style={{ color: c.accent }}>{c.sub}{!show && c.mins ? ` · ${c.mins} min` : ""}</p>
    {show && c.body && <p className="line-clamp-2 text-[15px] leading-6 text-white/75">{c.body}{c.mins ? ` · ${c.mins} min` : ""}</p>}
    <div className="flex items-center gap-3.5">
      <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-[#2a1650]">{playing ? <Pause className="h-6 w-6" fill="currentColor" /> : <Play className="h-6 w-6" fill="currentColor" />}</button>
      <div className="h-1.5 flex-1 rounded-full bg-white/20"><div className="h-1.5 rounded-full transition-[width]" style={{ width: `${pct}%`, background: c.accent }} /></div>
    </div>
    <div className="flex flex-wrap gap-2">
      {show && c.ep?.showId && <button type="button" disabled={handled === "followed"} onClick={onFollow} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-bold text-[#1c1236] disabled:opacity-70" style={{ background: c.accent }}>{handled === "followed" ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{handled === "followed" ? "Following" : "Follow show"}</button>}
      <button type="button" disabled={handled === "saved"} onClick={onSave} className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/12 px-4 text-sm font-bold disabled:opacity-70">{handled === "saved" ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}{handled === "saved" ? "Saved" : "Save episode"}</button>
    </div>
  </>;
}
