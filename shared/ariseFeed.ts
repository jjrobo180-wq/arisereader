// Arise Feed (LifeHub section "feed", client/src/components/family-hub/AriseFeed.tsx): your whole life as a
// full-screen feed you swipe up through, one card at a time, and it never ends.
//
// First come the real things that need you, most urgent first: overdue and today's to-dos (LifeHub, WorkHub and
// FamilyHub), medicines due, today's events, chores, the verse of the day and today's Bible reading, water, food
// (today's calories and protein from Cooked's food diary, the LifeHub diary and Apple Health, and the meal to log
// now), today's workout (Cooked's program, or one to do now), move goals, sleep, a weigh-in that's due, habits,
// bills, the week's to-dos and events, check-ins, birthdays, countdowns, upkeep, goals, savings jars, measures, and
// an episode from the person's own podcasts.
// Then it keeps going forever, about 30 cards a page: Bible verses and whole chapters (KJV), quotes, new podcasts
// to follow, workouts, stretches and breathing, food ideas to log, hobbies, things to consider, kindness, family
// time, money moves, books, lessons, facts, trivia, words, Mindset advice, affirmations, challenges and stories,
// Life Score insights, science tips, stats and records, check-ins, prompts, memories and real items resurfaced.
// Each library is walked in a shuffled order, so nothing repeats until all of it has been seen.
// Pure, so it's tested (tests/arise-feed.test.ts). Seeded by page and day, so a page is the same on every render.
import { METRICS, localDay, plusDays, type LifeScoreResult } from "./lifeScore";
import { SCALES } from "./lifeScales";
import { buildFeed, cardId, newMindset, type Card as MindCard, type MindsetData } from "./mindset";
import { ADVICE, AFFIRMATIONS, BIBLE_STORIES, CHALLENGES, LESSONS, LIFE_STORIES, QUOTES as MIND_QUOTES, VERSES as MIND_VERSES } from "./mindsetContent";
import { CONVERSATION_STARTERS, DATE_IDEAS, QUOTES as PLUGIN_QUOTES, VERSES as PLUGIN_VERSES, WORDS } from "./lifePlugins";
import { BOOKS, CHAPTERS, FACTS, FAMILY_FUN, FOOD_IDEAS, HOBBIES, IDEAS, KINDNESS, LESSONS_MORE, MONEY_MOVES, MORE_QUOTES, MORE_VERSES, TRIVIA, WORDS_MORE, WORKOUTS, type FeedWorkout, type FoodIdea } from "./feedLibrary";
import { PROGRAM_BY_ID, nextProgramDay } from "./fit";
import { healthPeople } from "./familyHealth";
import { choreDueOn, occursOn, billDue } from "./familyHub";

export type FeedCat = "todo" | "week" | "health" | "food" | "fit" | "faith" | "money" | "home" | "ideas" | "learn" | "pods" | "score" | "mind";
export type FeedKind =
  | "intro" | "task" | "event" | "water" | "rings" | "sleep" | "podcast" | "chore" | "jar" | "bill" | "insight" | "habit" | "checkin"
  | "birthday" | "countdown" | "goal" | "pill" | "upkeep" | "gratitude" | "journal" | "memory" | "mind" | "tip" | "stat" | "record" | "measure" | "meal"
  | "verse" | "chapter" | "quote" | "show" | "workout" | "activity" | "breath" | "foodday" | "foodlog" | "food" | "hobby" | "idea" | "kind"
  | "fact" | "trivia" | "word" | "book" | "lesson" | "weigh" | "program";
export type FitMeal = "breakfast" | "lunch" | "dinner" | "snack";

export type FeedCard = {
  id: string; kind: FeedKind; cat: FeedCat; kicker: string; title: string; body?: string; chips?: string[];
  /** Where it came from, and the LifeHub section Open goes to. */ source: string; open?: string;
  bg: string; accent: string;
  /** The real item it's about (a to-do, chore, jar…). */ ref?: string; hub?: "LifeHub" | "WorkHub" | "FamilyHub";
  /** A big number, the line under it, and progress 0–100. */ big?: string; sub?: string; pct?: number;
  /** A small bar chart. */ bars?: { label: string; v: number; hi?: boolean }[];
  /** Already done today (a habit checked, water reached). */ done?: boolean;
  /** Check-in: the Life Score field it fills and its two ends. */ field?: string; low?: string; high?: string;
  /** What Done is called on this card, and whether it has Done / Later. */ doneWord?: string; doneable?: boolean; snoozable?: boolean;
  /** A to-do the card can add. */ todo?: string;
  /** Podcast. */ audio?: string; art?: string; mins?: number; ep?: FeedEpisode;
  /** Mindset card id (to remember it was seen). */ mindId?: string;
  /** A Bible passage to read in place (KJV, read live), and a verse to save. */ passage?: string; verse?: { ref: string; text: string };
  /** A workout to run or log, a food to log, and the meal it goes in. */ workout?: FeedWorkout; food?: FoodIdea; meal?: FitMeal;
  /** Macros on the food card: eaten and goal. */ macros?: { label: string; v: number; goal: number; unit: string }[];
  /** Trivia. */ options?: string[]; answer?: number;
  /** What the card can save: a word, a book to the reading list, a hobby or idea to the bucket list. */
  word?: { word: string; definition: string }; book?: { title: string; author: string }; bucket?: string;
  /** Text to copy (quotes). */ copy?: string;
  /** Breathing: seconds in, hold, out, hold. */ breath?: [number, number, number, number];
};

export type FeedTask = { id: string; title: string; due: string; time?: string; done: boolean; list?: string; hub: "LifeHub" | "WorkHub" | "FamilyHub"; mine: boolean };
export type FeedEpisode = { id: string; title: string; show: string; audio: string; art: string; secs: number; about?: string;
  /** The show, for following it. */ showId?: string; author?: string; genre?: string; date?: string;
  /** From a genre the person doesn't listen to yet, or a show they don't follow. */ discover?: boolean };
export type FeedCtx = {
  today: string; now?: Date;
  family: any;
  tasks: FeedTask[];
  score?: LifeScoreResult | null;
  stats?: { insights: string[]; records: { label: string; value: string; when: string }[]; sections: { id: string; name: string; stats: { label: string; value: string; sub?: string }[] }[] } | null;
  podcasts?: FeedEpisode[];
  /** Cooked's data (food diary, workouts, program, weights), when the person uses it. */ fit?: any;
  name?: string;
};

// ——— Look per kind (the prototype's palette) ————————————————————————————————————————————————————————————————
const LOOK: Record<FeedKind, [string, string]> = {
  intro: ["#0e0e12", "#c6f432"], task: ["#16161d", "#c6f432"], event: ["#1d2b64", "#9db8ff"], water: ["#06475c", "#5eead4"], rings: ["#3b0d1e", "#ff6b8a"],
  sleep: ["#1e1b4b", "#a5b4fc"], podcast: ["#2a1650", "#c4a5ff"], chore: ["#233418", "#b5e48c"], jar: ["#0f3d2e", "#6ee7b7"], bill: ["#2b2b33", "#e5e7eb"],
  insight: ["#3a2a06", "#fbbf24"], habit: ["#1f1f1f", "#f97316"], checkin: ["#12263a", "#7dd3fc"], birthday: ["#4a1532", "#f9a8d4"], countdown: ["#3b1d4a", "#e9a8ff"],
  goal: ["#0f2f3d", "#67e8f9"], pill: ["#1a2e44", "#93c5fd"], upkeep: ["#2e2614", "#fcd34d"], gratitude: ["#3f1d24", "#fda4af"], journal: ["#262019", "#fde68a"],
  memory: ["#22192e", "#d8b4fe"], mind: ["#101827", "#f0abfc"], tip: ["#0d2b24", "#5eead4"], stat: ["#111827", "#93c5fd"], record: ["#2b1d05", "#fcd34d"],
  measure: ["#0f2a2a", "#5eead4"], meal: ["#30200f", "#fdba74"],
  verse: ["#2a1d0c", "#f5c26b"], chapter: ["#1f170b", "#f5c26b"], quote: ["#141414", "#f4f4f5"], show: ["#1c1236", "#c4a5ff"], workout: ["#3a1208", "#ff7a45"],
  activity: ["#2d0f0f", "#fb923c"], breath: ["#0b2633", "#7dd3fc"], foodday: ["#33200a", "#fdba74"], foodlog: ["#2b1a0a", "#fb923c"], food: ["#2f1d0d", "#fcd34d"],
  hobby: ["#0f2c33", "#5eead4"], idea: ["#18181b", "#a3e635"], kind: ["#3b1530", "#f9a8d4"], fact: ["#0c1f3f", "#60a5fa"], trivia: ["#1e1145", "#a78bfa"],
  word: ["#14213d", "#fca311"], book: ["#2a1b12", "#e7c9a9"], lesson: ["#0f2027", "#67e8f9"], weigh: ["#13262f", "#5eead4"], program: ["#2d0c0c", "#f87171"],
};
const card = (c: Omit<FeedCard, "bg" | "accent">): FeedCard => ({ ...c, bg: LOOK[c.kind][0], accent: LOOK[c.kind][1] });

// ——— Helpers ———————————————————————————————————————————————————————————————————————————————————————————————————
const arr = <T = any>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const at = (d: string) => new Date(`${d}T12:00:00`);
const daysTo = (from: string, to: string) => Math.round((at(to).getTime() - at(from).getTime()) / 864e5);
const dayName = (d: string) => at(d).toLocaleDateString("en-US", { weekday: "long" });
const shortDate = (d: string) => at(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const clock = (t: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); if (!m) return ""; const h = +m[1]; return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? "AM" : "PM"}`; };
const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const when = (due: string, today: string, time?: string) => {
  if (!due) return "No date";
  const n = daysTo(today, due);
  const t = time ? ` · ${clock(time)}` : "";
  return n === 0 ? `Today${t}` : n === 1 ? `Tomorrow${t}` : n === -1 ? "Yesterday" : n < 0 ? `${-n} days late` : n < 7 ? `${dayName(due)}${t}` : shortDate(due);
};
function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const pick = <T>(list: T[], r: () => number): T | undefined => (list.length ? list[Math.floor(r() * list.length)] : undefined);
/** Whose health diary the feed writes to: the same person the Health page shows first. */
export function healthMe(family: any): string {
  try { return healthPeople({ members: arr(family?.members), health: { goals: family?.health?.goals ?? {}, food: arr(family?.health?.food), exercise: arr(family?.health?.exercise), days: arr(family?.health?.days), weights: arr(family?.health?.weights) } as any }, "")[0]?.id ?? "me"; }
  catch { return "me"; }
}
const me = healthMe;
/** The meal to log at this hour. */
export const mealAt = (hour: number): FitMeal => (hour < 10.5 ? "breakfast" : hour < 15 ? "lunch" : hour < 17 ? "snack" : hour < 21.5 ? "dinner" : "snack");
const MEAL_NAME: Record<FitMeal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
/** Whether Cooked is the person's food diary (they've logged there or set it up). */
export const usesCooked = (fit: any) => !!fit && (arr(fit.foods).length > 0 || !!fit.onboarded || !!fit.profile?.kcalGoal);

/** Everything eaten today, from Cooked, the LifeHub diary and Apple Health, with the goals. */
export function foodToday(f: any, fit: any, T: string) {
  const mid = me(f);
  const items: { name: string; meal: FitMeal; kcal: number; p: number; c: number; fat: number }[] = [];
  for (const e of arr(fit?.foods)) if (e?.date === T) { const k = Number(e.servings) || 1; items.push({ name: String(e.name), meal: (e.meal === "snacks" ? "snack" : e.meal) as FitMeal, kcal: Math.round((Number(e.kcal) || 0) * k), p: (Number(e.p) || 0) * k, c: (Number(e.c) || 0) * k, fat: (Number(e.f) || 0) * k }); }
  for (const e of arr(f?.health?.food)) if (e?.date === T && (!e.memberId || e.memberId === mid)) { const k = Number(e.servings) || 1; items.push({ name: String(e.name), meal: (e.meal === "snacks" ? "snack" : e.meal) as FitMeal, kcal: Math.round((Number(e.calories) || 0) * k), p: (Number(e.protein) || 0) * k, c: (Number(e.carbs) || 0) * k, fat: (Number(e.fat) || 0) * k }); }
  const apple = Number(f?.lifeScore?.health?.[T]?.eaten) || 0;
  const sum = (k: "kcal" | "p" | "c" | "fat") => Math.round(items.reduce((a, i) => a + i[k], 0));
  const kcal = items.length ? sum("kcal") : apple;
  const goal = Number(fit?.profile?.kcalGoal) || Number(f?.health?.goals?.[mid]?.calories) || 2000;
  const split = fit?.profile?.macroSplit ?? { p: Number(f?.health?.goals?.[mid]?.proteinPct) || 25, c: Number(f?.health?.goals?.[mid]?.carbsPct) || 45, f: Number(f?.health?.goals?.[mid]?.fatPct) || 30 };
  return { items, kcal, p: sum("p"), c: sum("c"), fat: sum("fat"), fromApple: !items.length && apple > 0, goal,
    goals: { p: Math.round((goal * (split.p || 25)) / 100 / 4), c: Math.round((goal * (split.c || 45)) / 100 / 4), fat: Math.round((goal * (split.f || 30)) / 100 / 9) },
    meals: new Set(items.map((i) => i.meal)) };
}
/** Minutes of exercise logged today anywhere (Cooked workouts and runs, LifeHub diary, Apple Health). */
export function movedToday(f: any, fit: any, T: string) {
  const mid = me(f);
  const cooked = arr(fit?.workouts).filter((w: any) => localDay(w?.date) === T && !String(w?.programId || "").startsWith("session-")).reduce((a: number, w: any) => a + Math.round((Number(w.secs) || 0) / 60), 0)
    + arr(fit?.runs).filter((r: any) => localDay(r?.date) === T).reduce((a: number, r: any) => a + Math.round((Number(r.secs) || 0) / 60), 0);
  const diary = arr(f?.health?.exercise).filter((e: any) => e.date === T && (!e.memberId || e.memberId === mid)).reduce((a: number, e: any) => a + (Number(e.minutes) || 0), 0);
  const h = f?.lifeScore?.health?.[T] ?? {};
  return Math.max(cooked + diary, Number(h.woMin) || 0);
}

/** A list walked in a shuffled order for the day: item n of the walk (it wraps only after every item). */
function walker<T>(name: string, list: readonly T[], day: string) {
  let seed = Number(day.replace(/-/g, "")) || 1; for (const ch of name) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const r = rng(seed), order = list.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return (n: number): T | undefined => (list.length ? list[order[((n % list.length) + list.length) % list.length]] : undefined);
}
const dayNumber = (d: string) => Math.floor(at(d).getTime() / 864e5);

// ——— All the verses and quotes in Arise, once each ————————————————————————————————————————————————————————————
export const ALL_VERSES: { ref: string; text: string }[] = (() => {
  const seen = new Set<string>(), out: { ref: string; text: string }[] = [];
  for (const v of [...MORE_VERSES, ...MIND_VERSES.map((x) => ({ ref: x.ref, text: x.text })), ...PLUGIN_VERSES.map((x) => ({ ref: x.reference, text: x.text }))]) {
    const k = v.ref.replace(/\s+/g, "").toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push(v);
  }
  return out;
})();
export const ALL_QUOTES: { text: string; by: string }[] = (() => {
  const seen = new Set<string>(), out: { text: string; by: string }[] = [];
  for (const q of [...MORE_QUOTES, ...MIND_QUOTES.map((x) => ({ text: x.text, by: x.by })), ...PLUGIN_QUOTES.map((x) => ({ text: x.text, by: x.by }))]) {
    const k = q.text.toLowerCase().replace(/[^a-z]/g, "").slice(0, 60); if (seen.has(k)) continue; seen.add(k); out.push(q);
  }
  return out;
})();
/** The chapter a Bible reading plan lands on today (the same for everyone on a given day). */
export const chapterFor = (day: string, offset = 0) => CHAPTERS[((dayNumber(day) + offset) % CHAPTERS.length + CHAPTERS.length) % CHAPTERS.length];
/** The parent chapter of a verse reference ("John 3:16" → "John 3"). */
export const chapterOf = (ref: string) => ref.replace(/:.*$/, "").trim();


/** The person's Mindset answers, or a starting mix for someone who hasn't set Mindset up (verses when their
 *  check-ins show faith practice). */
export function mindFor(family: any): MindsetData {
  if (family?.mindset?.profile) return family.mindset;
  const faith = Object.values(family?.lifeScore?.days ?? {}).some((d: any) => d?.faith);
  return newMindset({ name: "", goals: [], season: "okay", faith: faith ? "christian" : "none", bible: faith, tone: "mix", kinds: ["quote", "advice", "affirmation", "lesson", "prompt", "challenge", ...(faith ? ["verse" as const] : [])], minutes: 30, why: "", startedAt: "" });
}

// ——— The real things, most urgent first ——————————————————————————————————————————————————————————————————————
export function realCards(x: FeedCtx): FeedCard[] {
  const T = x.today, f = x.family ?? {}, out: FeedCard[] = [];
  const week = Array.from({ length: 7 }, (_, i) => plusDays(T, i));
  const open = x.tasks.filter((t) => !t.done);
  const late = open.filter((t) => t.due && t.due < T).sort((a, b) => a.due.localeCompare(b.due));
  const todayT = open.filter((t) => t.due === T).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  const soon = open.filter((t) => t.due > T && t.due <= week[6]).sort((a, b) => (a.due + (a.time || "")).localeCompare(b.due + (b.time || "")));
  const taskCard = (t: FeedTask, kicker: string): FeedCard => card({ id: `task:${t.hub}:${t.id}`, kind: "task", cat: "todo", kicker, title: t.title, chips: [when(t.due, T, t.time), ...(t.list ? [t.list] : [])], source: `${t.hub} · To-dos`, open: t.hub === "WorkHub" ? "workhub" : "tasks", ref: t.id, hub: t.hub, doneable: t.mine, snoozable: t.mine, doneWord: "DONE" });

  for (const t of late.slice(0, 6)) out.push(taskCard(t, `To-do · ${daysTo(t.due, T)} day${daysTo(t.due, T) === 1 ? "" : "s"} overdue`));
  for (const t of todayT) out.push(taskCard(t, "To-do · Due today"));

  // Medicines due today, not marked yet.
  const doses = arr(f.pillDoses);
  for (const p of arr(f.pills).filter((p: any) => p.active && (!p.days?.length || p.days.includes(at(T).getDay())) && (!p.start || p.start <= T) && (!p.end || p.end >= T))) {
    for (const time of arr<string>(p.times).length ? arr<string>(p.times) : [""]) {
      if (doses.some((d: any) => d.pillId === p.id && d.date === T && d.time === time)) continue;
      out.push(card({ id: `pill:${p.id}:${time}`, kind: "pill", cat: "health", kicker: `Medicine${time ? ` · ${clock(time)}` : ""}`, title: p.name, body: p.dose || undefined, source: "Pills", open: "pills", ref: p.id, sub: time, doneable: true, snoozable: false, doneWord: "TAKEN" }));
    }
  }

  // Today's events.
  const events = arr(f.events);
  const evOn = (d: string) => events.filter((e: any) => occursOn(e, d)).sort((a: any, b: any) => (a.time || "").localeCompare(b.time || ""));
  for (const e of evOn(T)) out.push(card({ id: `event:${e.id}:${T}`, kind: "event", cat: "week", kicker: "Today", title: e.title, chips: [e.time ? `${clock(e.time)}${e.endTime ? `–${clock(e.endTime)}` : ""}` : "All day", ...(e.location ? [e.location] : [])], body: e.notes || undefined, big: String(at(T).getDate()), sub: at(T).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(), source: "Calendar", open: "calendar", ref: e.id, doneable: false, snoozable: false }));

  // Chores due today.
  const doneChores = arr(f.choreDone);
  for (const ch of arr(f.chores).filter((c: any) => { try { return choreDueOn(c, T, doneChores); } catch { return false; } })) {
    const doneToday = doneChores.some((d: any) => d.choreId === ch.id && d.date === T);
    if (doneToday) continue;
    const who = arr(f.members).find((m: any) => m.id === ch.memberId)?.name;
    out.push(card({ id: `chore:${ch.id}`, kind: "chore", cat: "home", kicker: who ? `Chore · ${who}` : "Chore", title: `${ch.icon ? `${ch.icon} ` : ""}${ch.title}`, chips: ["Today", ...(ch.mins ? [`${ch.mins} min`] : []), ...(ch.points ? [`${ch.points} pts`] : [])], source: "Chores", open: "chores", ref: ch.id, doneable: true, snoozable: true, doneWord: "DONE" }));
  }

  // The verse of the day, and today's chapter in the reading plan.
  const vod = walker("vod", ALL_VERSES, T)(0)!;
  out.push(verseCard(vod, "Verse of the day", `vod:${T}`));
  const ch = chapterFor(T);
  out.push(card({ id: `chapter:${T}`, kind: "chapter", cat: "faith", kicker: "Today's reading", title: ch.ref, body: ch.about, passage: ch.ref, source: "Bible · Reading plan", open: "bible", doneable: true, snoozable: false, doneWord: "READ" }));

  // Water (LifeHub's health day, in cups) and move rings (Apple Health through Life Score).
  const mid = me(f);
  const day = arr(f.health?.days).find((d: any) => d.date === T && (!d.memberId || d.memberId === mid));
  const waterGoal = Number(f.health?.goals?.[mid]?.water) || 8;
  const cups = Number(day?.water) || 0;
  out.push(card({ id: "water", kind: "water", cat: "health", kicker: "Water goal", title: `${cups} of ${waterGoal} cups`, big: String(cups), sub: `of ${waterGoal} cups today`, pct: Math.min(100, Math.round((cups / waterGoal) * 100)), done: cups >= waterGoal, source: "Health & fitness", open: "health", doneable: false, snoozable: false }));
  const h = f.lifeScore?.health?.[T] ?? {};
  const stepGoal = Number(f.lifeScore?.settings?.stepGoal) || 8000;
  if (h.steps !== undefined || h.exMin !== undefined) {
    const left = Math.max(0, stepGoal - (h.steps ?? 0));
    out.push(card({ id: "rings", kind: "rings", cat: "health", kicker: "Move goal", title: left ? `${left.toLocaleString("en-US")} steps to go` : "Step goal reached", body: left ? `About a ${Math.max(5, Math.round(left / 110))}-minute walk closes it.` : "Nice. Anything more is a bonus.", big: (h.steps ?? 0).toLocaleString("en-US"), sub: `of ${stepGoal.toLocaleString("en-US")} steps`, pct: Math.min(100, Math.round(((h.steps ?? 0) / stepGoal) * 100)), chips: [`${h.exMin ?? 0} of 30 exercise min`, ...(h.active ? [`${h.active} active cal`] : [])], source: "Apple Health", open: "lifescore", doneable: false, snoozable: false }));
  }
  if (h.sleep !== undefined) {
    const hrs = h.sleep as number;
    out.push(card({ id: "sleep", kind: "sleep", cat: "health", kicker: "Last night", title: `${Math.floor(hrs)} h ${Math.round((hrs % 1) * 60)} min asleep`, body: hrs >= 7 ? "In the 7 to 9 hour range adults need." : `${Math.round((7 - hrs) * 60)} minutes short of 7 hours. An earlier wind-down tonight helps.`, chips: [...(h.deep ? [`${h.deep} min deep`] : []), ...(h.rem ? [`${h.rem} min REM`] : [])], source: "Apple Health", open: "lifescore", doneable: false, snoozable: false }));
  }

  // Food: today so far, and the meal to log now (Cooked's diary, the LifeHub diary, Apple Health).
  const fit = x.fit, hour = (x.now ?? new Date()).getHours() + (x.now ?? new Date()).getMinutes() / 60;
  const food = foodToday(f, fit, T);
  const left = food.goal - food.kcal;
  out.push(card({ id: `foodday:${T}`, kind: "foodday", cat: "food", kicker: "Food today", title: food.kcal ? (left >= 0 ? `${left.toLocaleString("en-US")} calories left` : `${(-left).toLocaleString("en-US")} over your goal`) : "Nothing logged yet today",
    big: food.kcal.toLocaleString("en-US"), sub: `of ${food.goal.toLocaleString("en-US")} cal`, pct: Math.min(100, Math.round((food.kcal / food.goal) * 100)),
    macros: [{ label: "Protein", v: food.p, goal: food.goals.p, unit: "g" }, { label: "Carbs", v: food.c, goal: food.goals.c, unit: "g" }, { label: "Fat", v: food.fat, goal: food.goals.fat, unit: "g" }],
    body: food.fromApple ? "From Apple Health." : food.items.length ? (["breakfast", "lunch", "dinner", "snack"] as FitMeal[]).filter((m) => food.meals.has(m)).map((m) => `${MEAL_NAME[m]}: ${food.items.filter((i) => i.meal === m).map((i) => i.name).slice(0, 4).join(", ")}`).join("\n") : "Log what you eat and it shows up here, in Cooked and in Life Score.",
    source: usesCooked(fit) ? "Cooked · Food diary" : "Health · Food diary", open: usesCooked(fit) ? "cooked" : "health", doneable: false, snoozable: false }));
  const slot = mealAt(hour);
  if (!food.meals.has(slot) || slot === "snack") out.push(card({ id: `foodlog:${T}:${slot}`, kind: "foodlog", cat: "food", kicker: `Log ${MEAL_NAME[slot].toLowerCase()}`, title: slot === "snack" ? "Had a snack?" : `What did you have for ${slot}?`, meal: slot, source: usesCooked(fit) ? "Cooked · Food diary" : "Health · Food diary", open: usesCooked(fit) ? "cooked" : "health", doneable: false, snoozable: false }));

  // Today's workout, when nothing's logged yet: the next day of their Cooked program, or one to do now.
  const moved = movedToday(f, fit, T);
  const prog = fit?.program?.id ? PROGRAM_BY_ID.get(fit.program.id) : undefined;
  if (prog && !moved) {
    const nx = nextProgramDay(prog, arr(fit.program.done));
    out.push(card({ id: `program:${T}`, kind: "program", cat: "fit", kicker: `${prog.name} · Week ${nx.week}`, title: nx.day.name, chips: nx.day.items.slice(0, 6).map((i) => `${i.sets}×${i.reps}`), body: `${nx.day.items.length} exercises. Your next day in Cooked.`, source: "Cooked · Program", open: "cooked", doneable: false, snoozable: true }));
  } else if (!moved) {
    const w = walker("wod", WORKOUTS.filter((w) => w.kind !== "walk" || hour >= 17), T)(0);
    if (w) out.push(workoutCard(w, "Today's workout", `wod:${T}`));
  } else {
    out.push(card({ id: `moved:${T}`, kind: "stat", cat: "fit", kicker: "Moved today", title: "Exercise logged", big: `${moved}`, sub: "minutes today", body: moved >= 30 ? "That's a full day's worth. Nice." : `${30 - moved} more minutes reaches 30 for the day.`, source: "Cooked · Health", open: usesCooked(fit) ? "cooked" : "health", doneable: false, snoozable: false }));
  }

  // A weigh-in, for someone who tracks weight and hasn't in a week.
  const lastW = [...arr(fit?.weights).map((w: any) => String(w.date).slice(0, 10)), ...arr(f.health?.weights).filter((w: any) => w.memberId === mid).map((w: any) => w.date)].sort().pop();
  if (lastW && daysTo(lastW, T) >= 7) out.push(card({ id: `weigh:${T}`, kind: "weigh", cat: "health", kicker: "Weekly weigh-in", title: "Step on the scale", body: `Last weigh-in ${daysTo(lastW, T)} days ago. Same time of day each week makes the trend honest.`, sub: fit?.profile?.units === "kg" ? "kg" : "lb", source: usesCooked(fit) ? "Cooked · Weight" : "Health · Weight", open: usesCooked(fit) ? "cooked" : "health", doneable: false, snoozable: true }));

  // Habits not done today.
  for (const hb of arr(f.habits).filter((hb: any) => !arr(hb.days).includes(T))) {
    let streak = 0; for (let i = 1; arr(hb.days).includes(plusDays(T, -i)); i++) streak++;
    out.push(card({ id: `habit:${hb.id}`, kind: "habit", cat: "score", kicker: "Habit", title: `${hb.emoji ? `${hb.emoji} ` : ""}${hb.name}`, sub: streak ? `${streak}-day streak · do it today to keep it` : "Start a streak today", bars: Array.from({ length: 7 }, (_, i) => { const d = plusDays(T, i - 6); return { label: at(d).toLocaleDateString("en-US", { weekday: "narrow" }), v: arr(hb.days).includes(d) ? 1 : 0, hi: d === T }; }), source: "Habits", open: "habits", ref: hb.id, doneable: true, snoozable: false, doneWord: "DONE" }));
  }

  // Bills due in the next 10 days, unpaid.
  const month = T.slice(0, 7);
  for (const b of arr(f.bills)) {
    const due = billDue(b, month), next = due >= T ? due : billDue(b, plusDays(`${month}-28`, 7).slice(0, 7));
    const key = next.slice(0, 7);
    if (arr(b.paid).includes(key) || daysTo(T, next) > 10) continue;
    out.push(card({ id: `bill:${b.id}:${key}`, kind: "bill", cat: "money", kicker: daysTo(T, next) === 0 ? "Bill · Due today" : "Bill coming up", title: b.name, big: money(Number(b.amount) || 0), sub: `due ${when(next, T)}`, body: b.autopay ? "On autopay." : "Not on autopay.", source: "Money · Bills", open: "money", ref: b.id, doneable: true, snoozable: false, doneWord: "PAID" }));
  }

  // The rest of the week's to-dos and events.
  for (const t of soon.slice(0, 12)) out.push(taskCard(t, `To-do · ${when(t.due, T)}`));
  for (const d of week.slice(1)) for (const e of evOn(d)) out.push(card({ id: `event:${e.id}:${d}`, kind: "event", cat: "week", kicker: "This week", title: e.title, chips: [`${dayName(d)}${e.time ? ` · ${clock(e.time)}` : ""}`, ...(e.location ? [e.location] : [])], body: `In ${daysTo(T, d)} day${daysTo(T, d) === 1 ? "" : "s"}.${e.notes ? ` ${e.notes}` : ""}`, big: String(at(d).getDate()), sub: at(d).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(), source: "Calendar", open: "calendar", ref: e.id, doneable: false, snoozable: false }));

  // Today's check-in (Life Score), when it isn't done.
  const ci = f.lifeScore?.days?.[T] ?? {};
  if (ci.happy === undefined) out.push(card({ id: `checkin:happy:${T}`, kind: "checkin", cat: "score", kicker: "Quick check-in", title: "How happy are you right now?", field: "happy", low: "Awful", high: "Wonderful", source: "Life Score · Check in", open: "lifescore", doneable: false, snoozable: false }));

  // Birthdays and countdowns in the next 30 days.
  const y = Number(T.slice(0, 4));
  for (const b of arr(f.birthdays)) {
    let d = `${y}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`; if (d < T) d = `${y + 1}${d.slice(4)}`;
    const n = daysTo(T, d); if (n > 30) continue;
    const age = b.year ? Number(d.slice(0, 4)) - b.year : 0;
    out.push(card({ id: `birthday:${b.id ?? b.name}`, kind: "birthday", cat: "week", kicker: n === 0 ? "Today" : "Coming up", title: b.kind === "anniversary" ? `${b.name}${age ? ` · ${age} years` : ""}` : `${b.name}${age ? ` turns ${age}` : "'s birthday"}`, sub: `${shortDate(d)} · ${n === 0 ? "today" : `in ${n} day${n === 1 ? "" : "s"}`}`, source: "Birthdays", open: "birthdays", doneable: false, snoozable: false }));
  }
  for (const c of arr(f.countdowns).filter((c: any) => c.date >= T && daysTo(T, c.date) <= 60)) out.push(card({ id: `countdown:${c.id}`, kind: "countdown", cat: "week", kicker: "Countdown", title: `${c.emoji ? `${c.emoji} ` : ""}${c.title}`, big: String(daysTo(T, c.date)), sub: `days · ${shortDate(c.date)}`, source: "Countdowns", open: "countdowns", doneable: false, snoozable: false }));

  // Upkeep overdue.
  for (const k of arr(f.care).filter((k: any) => k.lastDone && plusDays(k.lastDone, k.everyDays) <= T).slice(0, 4)) out.push(card({ id: `upkeep:${k.id}`, kind: "upkeep", cat: "home", kicker: `Upkeep · ${k.group || k.kind}`, title: k.name, body: `Every ${k.everyDays} days. Last done ${shortDate(k.lastDone)}.`, source: "Upkeep", open: "upkeep", ref: k.id, doneable: true, snoozable: true, doneWord: "DONE" }));

  // Goals and savings jars.
  for (const g of arr(f.goals).filter((g: any) => !g.done && (!g.memberId || g.memberId === mid)).slice(0, 3)) {
    const pct = g.kind === "number" ? (g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0) : arr(g.milestones).length ? Math.round((arr(g.milestones).filter((m: any) => m.done).length / arr(g.milestones).length) * 100) : 0;
    const next = arr(g.milestones).find((m: any) => !m.done);
    out.push(card({ id: `goal:${g.id}`, kind: "goal", cat: "score", kicker: "Goal", title: g.title, big: `${pct}%`, sub: g.kind === "number" ? `${g.current} of ${g.target} ${g.unit || ""}`.trim() : next ? `Next: ${next.title}` : "", pct, body: g.due ? `${daysTo(T, g.due)} days left.` : undefined, source: "Goals", open: "goals", ref: g.id, doneable: g.kind === "number" || !!next, snoozable: false, doneWord: g.kind === "number" ? "+1" : "STEP DONE" }));
  }
  for (const j of arr(f.jars).filter((j: any) => j.target > j.saved).slice(0, 2)) out.push(card({ id: `jar:${j.id}`, kind: "jar", cat: "money", kicker: "Money goal", title: `${j.emoji ? `${j.emoji} ` : ""}${j.name}`, big: money(j.saved), sub: `of ${money(j.target)}`, pct: Math.min(100, Math.round((j.saved / Math.max(1, j.target)) * 100)), body: `${money(j.target - j.saved)} to go.`, source: "Savings jars", open: "jars", ref: j.id, doneable: false, snoozable: false }));

  // Questionnaires due (weekly or monthly).
  for (const def of SCALES) {
    const list = arr(f.lifeScore?.scales?.[def.id]); const last = list[list.length - 1];
    const due = !last || daysTo(last.date, T) >= (def.every === "week" ? 7 : 30);
    if (due && list.length) out.push(card({ id: `measure:${def.id}:${T}`, kind: "measure", cat: "score", kicker: `${def.every === "week" ? "Weekly" : "Monthly"} measure`, title: def.name, body: def.about, source: "Life Score · Measures", open: "lifescore", doneable: false, snoozable: true }));
  }

  // One podcast episode up front.
  const ep = x.podcasts?.find((e) => !e.discover) ?? x.podcasts?.[0];
  if (ep) out.push(podcastCard(ep));
  return out;
}

const verseCard = (v: { ref: string; text: string }, kicker: string, id: string): FeedCard =>
  card({ id, kind: "verse", cat: "faith", kicker, title: v.text, sub: `${v.ref} (KJV)`, verse: v, passage: chapterOf(v.ref), source: "Bible", open: "bible", doneable: false, snoozable: false });
const workoutCard = (w: FeedWorkout, kicker: string, id: string): FeedCard =>
  card({ id, kind: "workout", cat: "fit", kicker: `${kicker} · ${w.mins} min`, title: w.name, body: w.why, chips: [w.kind === "hiit" ? "HIIT" : w.kind[0].toUpperCase() + w.kind.slice(1), ["Easy", "Medium", "Hard"][w.level - 1], w.rounds > 1 ? `${w.rounds} rounds` : `${w.moves.length} moves`], workout: w, source: "Workouts", open: "cooked", doneable: false, snoozable: false });

const podcastCard = (ep: FeedEpisode, kicker = "From your shows"): FeedCard => card({ id: `pod:${ep.id}`, kind: "podcast", cat: "pods", kicker, title: ep.title, sub: ep.show, body: ep.about, audio: ep.audio, art: ep.art, mins: Math.round((ep.secs || 0) / 60), ep, source: "Arise Podcasts", open: "podster", doneable: false, snoozable: false });
const showCard = (ep: FeedEpisode): FeedCard => card({ id: `show:${ep.showId ?? ep.show}`, kind: "show", cat: "pods", kicker: ep.genre ? `New to you · ${ep.genre}` : "A show you might like", title: ep.show, sub: ep.author, body: `Latest: ${ep.title}`, audio: ep.audio, art: ep.art, mins: Math.round((ep.secs || 0) / 60), ep, source: "Arise Podcasts · Discover", open: "podster", doneable: false, snoozable: false });

// ——— Endless: discovery pages ——————————————————————————————————————————————————————————————————————————————————
const CHECKINS: { field: string; title: string; low: string; high: string }[] = [
  { field: "stress", title: "How stressed are you right now?", low: "Calm", high: "Overwhelmed" },
  { field: "energy", title: "How's your energy?", low: "Drained", high: "Full" },
  { field: "connect", title: "How connected do you feel to the people in your life?", low: "Alone", high: "Deeply connected" },
  { field: "faithFelt", title: "How close do you feel to God today?", low: "Far", high: "Very close" },
  { field: "happy", title: "How happy are you right now?", low: "Awful", high: "Wonderful" },
];
const GRATITUDE = ["What's one small thing that went right today?", "Who made your week better, and how?", "What's something you'd miss if it were gone?", "What made you laugh recently?", "What's a comfort you usually take for granted?", "What's one thing your body did for you today?", "Who taught you something you still use?", "What are you looking forward to?", "What's a prayer God answered for you?", "What's something beautiful you saw this week?", "Who would you want to thank if you could?", "What's a skill you're glad you have?"];
const JOURNAL = ["What's taking up the most space in your head right now?", "What would make tomorrow a good day?", "What did you learn about yourself this week?", "What's one thing you'd tell yourself a year ago?", "Where did you spend your energy today, and was it worth it?", "What are you avoiding, and what's the smallest first step?", "What does a great week look like for you?", "What's something you're proud of that nobody saw?", "What would you do if you weren't afraid?", "What do you want people to say about you when you're not in the room?", "What's one belief about yourself you'd like to drop?", "What season of life are you in, and what is it asking of you?"];
/** Breathing patterns: seconds to breathe in, hold, breathe out, hold. */
const BREATHS: { name: string; pattern: [number, number, number, number]; why: string }[] = [
  { name: "Box breathing", pattern: [4, 4, 4, 4], why: "In 4, hold 4, out 4, hold 4. Slow, even breathing lowers your heart rate within minutes." },
  { name: "4-7-8 breathing", pattern: [4, 7, 8, 0], why: "In 4, hold 7, out 8. The long exhale switches on the body's calming side. Good before sleep." },
  { name: "Slow breathing", pattern: [5, 0, 5, 0], why: "About six breaths a minute, in 5 and out 5. The pace where heart rate and breath line up." },
  { name: "Longer exhale", pattern: [4, 0, 6, 0], why: "Breathing out longer than in is one of the fastest ways to feel calmer." },
];
const ACTIVITY_PRESETS = [{ name: "Walk", met: 4.3, mins: [10, 20, 30, 45] }, { name: "Run", met: 9.8, mins: [15, 20, 30, 45] }, { name: "Strength training", met: 3.5, mins: [20, 30, 45, 60] }, { name: "Cycling", met: 8, mins: [15, 30, 45, 60] }, { name: "Yoga", met: 2.5, mins: [10, 20, 30, 45] }, { name: "Yard work", met: 4, mins: [20, 30, 60, 90] }];

function mindCard(c: MindCard): FeedCard | null {
  const id = `mind:${c.key}`;
  switch (c.kind) {
    case "advice": return card({ id, kind: "mind", cat: "mind", kicker: "Advice", title: c.item.title, body: c.item.body, source: "Mindset", open: "mindset", mindId: cardId(c), doneable: false, snoozable: false });
    case "affirmation": return card({ id, kind: "mind", cat: "mind", kicker: "Say it", title: c.item.text, source: "Mindset", open: "mindset", mindId: cardId(c), doneable: false, snoozable: false });
    case "prompt": return card({ id, kind: "journal", cat: "mind", kicker: "Reflect", title: c.item.text, source: "Journal", open: "journal", mindId: cardId(c), doneable: false, snoozable: false });
    case "challenge": return card({ id, kind: "mind", cat: "mind", kicker: `Challenge · ${c.item.mins} min`, title: c.item.title, body: c.item.how, todo: c.item.title, source: "Mindset", open: "mindset", mindId: cardId(c), doneable: false, snoozable: false });
    case "lesson": return card({ id, kind: "mind", cat: "mind", kicker: "Mind lesson", title: c.item.title, body: `${c.item.idea}\n\nTry: ${c.item.try}`, source: "Mindset", open: "mindset", mindId: cardId(c), doneable: false, snoozable: false });
    default: return null;
  }
}

/** Page `page` (1, 2, 3, …) of the endless part: about 30 cards, a seeded mix of everything, no two of a kind in a row. */
export function discoverCards(x: FeedCtx, page: number, seen: ReadonlySet<string> = new Set()): FeedCard[] {
  const T = x.today, f = x.family ?? {}, n = page - 1;
  const r = rng(page * 7919 + Number(T.replace(/-/g, "")));
  const hour = (x.now ?? new Date()).getHours();
  const out: (FeedCard | null | undefined)[] = [];
  const W = <V>(name: string, list: readonly V[]) => walker(name, list, T);

  // Faith: two verses, a chapter, and a Bible story part.
  const verse = W("verse", ALL_VERSES);
  out.push(verseCard(verse(1 + n * 2)!, "Verse", `verse:${n * 2}`), verseCard(verse(2 + n * 2)!, "Verse", `verse:${n * 2 + 1}`));
  const chap = chapterFor(T, page * 7);
  out.push(card({ id: `chapter:${chap.ref}`, kind: "chapter", cat: "faith", kicker: "Read a chapter", title: chap.ref, body: chap.about, passage: chap.ref, source: "Bible · Reading plan", open: "bible", doneable: true, snoozable: false, doneWord: "READ" }));
  const story = W("story", [...BIBLE_STORIES, ...LIFE_STORIES])(n);
  if (story) out.push(card({ id: `story:${story.id}`, kind: "mind", cat: story.faith ? "faith" : "mind", kicker: story.ref ? `Story · ${story.ref}` : "Story", title: story.title, body: `${story.body.join("\n\n")}\n\n${story.lesson}`, source: story.faith ? "Bible stories" : "Mindset · Stories", open: "mindset", doneable: false, snoozable: false }));

  // Quotes.
  const quote = W("quote", ALL_QUOTES);
  for (const k of [0, 1]) { const q = quote(n * 2 + k)!; out.push(card({ id: `quote:${n * 2 + k}`, kind: "quote", cat: "mind", kicker: "Quote", title: `“${q.text}”`, sub: `— ${q.by}`, copy: `“${q.text}” — ${q.by}`, source: "Quotes", open: "quotes", doneable: false, snoozable: false })); }

  // Podcasts: a show to discover and an episode from their own.
  const eps = x.podcasts ?? [];
  const fresh = eps.filter((e) => e.discover), mine = eps.filter((e) => !e.discover);
  if (fresh.length) out.push(showCard(W("show", fresh)(n)!));
  if (mine.length > 1) out.push(podcastCard(W("ep", mine.slice(1))(n)!));
  else if (fresh.length > 1) out.push(podcastCard(W("ep2", fresh)(n + 7)!, "Try an episode"));

  // Fitness: a workout, a quick activity log or a breathing break.
  out.push(workoutCard(W("workout", WORKOUTS)(n + 1)!, "Workout", `workout:${n}`));
  if (page % 4 === 1) { const a = W("act", ACTIVITY_PRESETS)(n)!; out.push(card({ id: `activity:${page}`, kind: "activity", cat: "fit", kicker: "Log a workout", title: "Did you move today?", body: "Tap what you did and how long. It goes in your diary and counts toward Life Score.", chips: ACTIVITY_PRESETS.map((p) => p.name), sub: a.name, source: "Health · Exercise", open: "cooked", doneable: false, snoozable: false })); }
  if (page % 3 === 2) { const b = BREATHS[Math.floor(page / 3) % BREATHS.length]; out.push(card({ id: `breath:${page}`, kind: "breath", cat: "fit", kicker: "One-minute reset", title: b.name, body: b.why, breath: b.pattern, source: "Breathe", open: "meditate", doneable: false, snoozable: false })); }

  // Food: an idea to log, matched to the time of day half the time.
  const slot = mealAt(hour);
  const fi = r() < 0.5 ? W(`food-${slot}`, FOOD_IDEAS.filter((i) => i.meal === slot))(n) : W("food", FOOD_IDEAS)(n);
  if (fi) out.push(card({ id: `food:${fi.name}:${page}`, kind: "food", cat: "food", kicker: `${MEAL_NAME[fi.meal]} idea`, title: fi.name, body: fi.why, chips: [`${fi.kcal} cal`, `${fi.p} g protein`, fi.serving], food: fi, meal: fi.meal, source: "Food ideas", open: "cooked", doneable: false, snoozable: false }));

  // Ideas: a hobby, two things to consider, kindness or family time, a money move, a book.
  const hb = W("hobby", HOBBIES)(n)!;
  out.push(card({ id: `hobby:${hb.name}`, kind: "hobby", cat: "ideas", kicker: "New hobby to try", title: `${hb.emoji} ${hb.name}`, body: hb.why, chips: [hb.cost], sub: `First step: ${hb.first}`, todo: hb.first, bucket: `Try ${hb.name.toLowerCase()}`, source: "Hobbies", open: "bucket", doneable: false, snoozable: false }));
  const idea = W("idea", IDEAS);
  for (const k of [0, 1]) { const i = idea(n * 2 + k)!; out.push(card({ id: `idea:${i.title}`, kind: "idea", cat: i.area === "money" ? "money" : i.area === "home" ? "home" : i.area === "faith" ? "faith" : i.area === "health" ? "health" : "ideas", kicker: "Something to consider", title: i.title, body: i.why, todo: i.title, source: "Ideas", doneable: false, snoozable: false })); }
  if (page % 2) { const k = W("kind", KINDNESS)(n)!; out.push(card({ id: `kind:${k}`, kind: "kind", cat: "ideas", kicker: "Kindness to try", title: k, body: "Acts of kindness lift the giver's mood too, and they spread.", todo: k, source: "Kindness", doneable: false, snoozable: false })); }
  else { const fam = W("fam", FAMILY_FUN)(n)!; out.push(card({ id: `fam:${fam}`, kind: "kind", cat: "home", kicker: "Family time", title: fam, todo: fam, bucket: fam, source: "Family ideas", doneable: false, snoozable: false })); }
  const mm = W("money", MONEY_MOVES)(n)!;
  out.push(card({ id: `money:${mm.title}`, kind: "idea", cat: "money", kicker: "Money move", title: mm.title, body: mm.why, todo: mm.title, source: "Money", open: "money", doneable: false, snoozable: false }));
  const bk = W("book", BOOKS)(n)!;
  out.push(card({ id: `book:${bk.title}`, kind: "book", cat: "ideas", kicker: "Worth reading", title: bk.title, sub: bk.author, body: bk.why, book: { title: bk.title, author: bk.author }, source: "Books", open: "reading", doneable: false, snoozable: false }));
  if (page % 3 === 1) { const d = W("date", DATE_IDEAS)(n)!; out.push(card({ id: `date:${d.idea}`, kind: "kind", cat: "home", kicker: "Date idea", title: d.idea, todo: d.idea, source: "Date ideas", open: "datehub", doneable: false, snoozable: false })); }
  if (page % 3 === 2) { const c = W("convo", CONVERSATION_STARTERS)(n)!; out.push(card({ id: `convo:${c}`, kind: "kind", cat: "home", kicker: "Ask someone tonight", title: c, source: "Conversation starters", open: "relationships", doneable: false, snoozable: false })); }

  // Learn: a lesson, a fact, trivia, a word.
  const ls = W("lesson", [...LESSONS_MORE, ...LESSONS.map((l) => ({ title: l.title, body: `${l.idea}\n\nTry: ${l.try}` }))])(n)!;
  out.push(card({ id: `lesson:${ls.title}`, kind: "lesson", cat: "learn", kicker: "Learn something", title: ls.title, body: ls.body, source: "Lessons", doneable: false, snoozable: false }));
  const fc = W("fact", FACTS)(n)!;
  out.push(card({ id: `fact:${fc.slice(0, 40)}`, kind: "fact", cat: "learn", kicker: "Did you know?", title: fc, source: "Facts", doneable: false, snoozable: false }));
  const tv = W("trivia", TRIVIA)(n)!;
  out.push(card({ id: `trivia:${tv.q}`, kind: "trivia", cat: "learn", kicker: "Trivia", title: tv.q, options: tv.options, answer: tv.answer, body: tv.why, source: "Trivia", doneable: false, snoozable: false }));
  const wd = W("word", [...WORDS_MORE, ...WORDS])(n)!;
  out.push(card({ id: `word:${wd.word}`, kind: "word", cat: "learn", kicker: `Word · ${wd.type}`, title: wd.word, sub: wd.definition, body: `“${wd.example}”`, word: { word: wd.word, definition: wd.definition }, source: "Dictionary", open: "dictionary", doneable: false, snoozable: false }));

  // Mindset: advice, an affirmation and a challenge (their own Mindset mix when they've set it up).
  if (f?.mindset?.profile) out.push(...buildFeed(f.mindset, { count: 3, seed: page * 31 + 7, skip: new Set(seen) }).map(mindCard));
  else {
    const ad = W("advice", ADVICE)(n)!; out.push(card({ id: `advice:${ad.id}`, kind: "mind", cat: "mind", kicker: "Advice", title: ad.title, body: ad.body, source: "Mindset", open: "mindset", doneable: false, snoozable: false }));
    const af = W("aff", AFFIRMATIONS)(n)!; out.push(card({ id: `aff:${af.id}`, kind: "mind", cat: "mind", kicker: "Say it", title: af.text, source: "Mindset", open: "mindset", doneable: false, snoozable: false }));
    const cg = W("chal", CHALLENGES)(n)!; out.push(card({ id: `chal:${cg.id}`, kind: "mind", cat: "mind", kicker: `Challenge · ${cg.mins} min`, title: cg.title, body: cg.how, todo: cg.title, source: "Mindset", open: "mindset", doneable: false, snoozable: false }));
  }

  // Their own life: insights, the science behind a score, stats, records, check-ins, prompts, memories, real items.
  const patterns = [...(x.score?.patterns?.map((p) => p.text) ?? []), ...(x.stats?.insights ?? [])];
  const low = (x.score?.metrics ?? []).filter((m) => m.score !== null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 6).map((m) => m.id);
  const statPool = (x.stats?.sections ?? []).flatMap((s) => s.stats.map((st) => ({ s, st }))).filter((p) => p.st.value && p.st.value !== "—" && p.st.value !== "0");
  const ci = f.lifeScore?.days?.[T] ?? {};
  const past = [...arr(f.journal).filter((j: any) => j.date < plusDays(T, -6) && String(j.body || "").trim()).map((j: any) => ({ d: j.date, t: j.title || "Journal", b: String(j.body) })),
    ...arr(f.gratitude).filter((g: any) => g.date < plusDays(T, -6) && arr(g.items).some((i: any) => String(i).trim())).map((g: any) => ({ d: g.date, t: "You were grateful for", b: arr<string>(g.items).filter((i) => i.trim()).join(" · ") }))];
  const open = x.tasks.filter((t) => !t.done && t.mine);
  const coll = arr(f.collections).filter((c: any) => !c.doneOn && /bucket|reading|learning|watchlist|restaurants|projects/.test(String(c.kind)));
  const kindWord: Record<string, string> = { bucket: "Bucket list", reading: "On your reading list", learning: "Want to learn", watchlist: "To watch", restaurants: "Restaurants to try", projects: "Project" };
  const routines = arr(x.fit?.routines);
  const makers: (() => FeedCard | null)[] = [
    () => { const t = W("pattern", patterns)(n); return t ? card({ id: `insight:${t}`, kind: "insight", cat: "score", kicker: "Life Score insight", title: t, source: "Life Score · Patterns", open: "lifescore", doneable: false, snoozable: false }) : null; },
    () => {
      const pool = r() < 0.6 && low.length ? METRICS.filter((m) => low.includes(m.id)) : METRICS;
      const m = pick(pool, r); if (!m) return null;
      const tip = pick(m.improve, r)!, res = x.score?.metrics.find((q) => q.id === m.id);
      return card({ id: `tip:${m.id}:${tip.slice(0, 24)}`, kind: "tip", cat: "score", kicker: `Raise ${m.name}${res?.score != null ? ` · ${res.score}` : ""}`, title: tip, body: m.sources[0] ? `${m.sources[0].finding} (${m.sources[0].title})` : undefined, todo: pick(m.todos, r), source: "Life Score · The science", open: "lifescore", doneable: false, snoozable: false });
    },
    () => { const p = W("stat", statPool)(n); return p ? card({ id: `stat:${p.s.id}:${p.st.label}`, kind: "stat", cat: "score", kicker: p.s.name, title: p.st.label, big: p.st.value, sub: p.st.sub, source: "Life Score · Stats", open: "lifescore", doneable: false, snoozable: false }) : null; },
    () => { const rc = W("record", x.stats?.records ?? [])(n); return rc ? card({ id: `record:${rc.label}`, kind: "record", cat: "score", kicker: "Personal record", title: rc.label, big: rc.value, sub: rc.when, source: "Life Score · Records", open: "lifescore", doneable: false, snoozable: false }) : null; },
    () => { const left = CHECKINS.filter((q) => (ci as any)[q.field] === undefined), c = left[Math.floor(n / 2)]; return c ? card({ id: `checkin:${c.field}:${T}`, kind: "checkin", cat: "score", kicker: "Quick check-in", title: c.title, field: c.field, low: c.low, high: c.high, source: "Life Score · Check in", open: "lifescore", doneable: false, snoozable: false }) : null; },
    () => card({ id: `gratitude:${T}:${page}`, kind: "gratitude", cat: "mind", kicker: "Gratitude", title: W("grat", GRATITUDE)(n)!, source: "Gratitude", open: "gratitude", doneable: false, snoozable: false }),
    () => card({ id: `journal:${T}:${page}`, kind: "journal", cat: "mind", kicker: "Journal", title: W("jour", JOURNAL)(n)!, source: "Journal", open: "journal", doneable: false, snoozable: false }),
    () => { const m = W("memory", past)(n); return m ? card({ id: `memory:${m.d}:${m.t}`, kind: "memory", cat: "mind", kicker: `${daysTo(m.d, T)} days ago · ${shortDate(m.d)}`, title: m.t, body: m.b.length > 420 ? `${m.b.slice(0, 419)}…` : m.b, source: "Memories", open: "journal", doneable: false, snoozable: false }) : null; },
    () => { const t = W("open", open)(n); return t ? card({ id: `task:${t.hub}:${t.id}`, kind: "task", cat: "todo", kicker: "Still on your list", title: t.title, chips: [when(t.due, T, t.time), ...(t.list ? [t.list] : [])], source: `${t.hub} · To-dos`, open: "tasks", ref: t.id, hub: t.hub, doneable: true, snoozable: true, doneWord: "DONE" }) : null; },
    () => { const c = W("coll", coll)(n); return c ? card({ id: `coll:${c.id ?? c.title}`, kind: "goal", cat: "ideas", kicker: kindWord[c.kind] ?? "Someday", title: c.title, body: c.note || undefined, todo: `${c.kind === "reading" ? "Read" : c.kind === "watchlist" ? "Watch" : "Plan"}: ${c.title}`, source: kindWord[c.kind] ?? "Lists", open: c.kind === "bucket" ? "bucket" : c.kind, doneable: false, snoozable: false }) : null; },
    () => { const rt = W("routine", routines)(n); return rt ? card({ id: `routine:${rt.id}`, kind: "program", cat: "fit", kicker: "Your Cooked routine", title: rt.name, chips: arr(rt.exercises).slice(0, 5).map((e: any) => e.name), body: `${arr(rt.exercises).length} exercises${rt.used ? `, last done ${shortDate(String(rt.used).slice(0, 10))}` : ""}.`, source: "Cooked · Routines", open: "cooked", doneable: false, snoozable: false }) : null; },
  ];
  // Five of them, different ones each page.
  for (let i = 0, made = 0; i < makers.length && made < 5; i++) { const c = makers[(n * 5 + i) % makers.length](); if (c) { out.push(c); made++; } }

  // Mix: shuffle, then keep two of the same kind from sitting together.
  const list = out.filter((c): c is FeedCard => !!c);
  const ids = new Set<string>();
  const uniq = list.filter((c) => (ids.has(c.id) ? false : (ids.add(c.id), true)));
  for (let i = uniq.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [uniq[i], uniq[j]] = [uniq[j], uniq[i]]; }
  for (let i = 1; i < uniq.length; i++) if (uniq[i].kind === uniq[i - 1].kind) { const j = uniq.findIndex((c, k) => k > i && c.kind !== uniq[i - 1].kind && (k + 1 >= uniq.length || uniq[k + 1].kind !== uniq[i].kind)); if (j > 0) [uniq[i], uniq[j]] = [uniq[j], uniq[i]]; }
  // Unique ids across pages (a library can come round again on a much later page).
  return uniq.map((c) => ({ ...c, id: `${c.id}#${page}` }));
}

/** The opening card. */
export function introCard(x: FeedCtx, left: number): FeedCard {
  const h = (x.now ?? new Date()).getHours();
  const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return card({ id: "intro", kind: "intro", cat: "todo", kicker: at(x.today).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }), title: `${greet}${x.name ? `, ${x.name}` : ""}.`, body: "Your whole life, one card at a time: to-dos, your week, food, workouts, faith, money, home, podcasts, ideas and Life Score. Swipe up. It never runs out.", big: x.score?.score != null ? String(x.score.score) : undefined, sub: `${left} thing${left === 1 ? "" : "s"} need${left === 1 ? "s" : ""} you`, pct: x.score?.score ?? undefined, source: "Arise Feed", doneable: false, snoozable: false });
}

/** Cards for a filter ("all" shows everything). */
export const inFilter = (c: FeedCard, filter: FeedCat | "all") => filter === "all" || c.kind === "intro" || c.cat === filter;
