// Arise Feed (LifeHub section "feed", client/src/components/family-hub/AriseFeed.tsx): the whole week as a
// full-screen feed you swipe up through, one card at a time, and it never ends.
//
// First come the real things that need you, most urgent first: overdue and today's to-dos (LifeHub, WorkHub and
// FamilyHub), medicines due, today's events, chores due, water and move goals, habits not done yet, bills due
// soon, the rest of this week's events, today's check-in, birthdays and countdowns, upkeep that's overdue, goals,
// savings jars, questionnaires due, a podcast from the person's own shows.
// Then it keeps going forever, page after page: Life Score insights and patterns, the science behind a score
// with a to-do to add, numbers from Stats, records, Mindset quotes, verses, advice, affirmations and challenges,
// memories from the journal and gratitude, prompts to write, more podcast episodes, and real items resurfaced.
// Pure, so it's tested (tests/arise-feed.test.ts). Seeded by page, so a page looks the same on every render.
import { METRICS, plusDays, type LifeScoreResult } from "./lifeScore";
import { SCALES } from "./lifeScales";
import { buildFeed, cardId, newMindset, type Card as MindCard, type MindsetData } from "./mindset";
import { choreDueOn, occursOn, billDue } from "./familyHub";

export type FeedCat = "todo" | "week" | "health" | "money" | "home" | "score" | "mind";
export type FeedKind =
  | "intro" | "task" | "event" | "water" | "rings" | "sleep" | "podcast" | "chore" | "jar" | "bill" | "insight" | "habit" | "checkin"
  | "birthday" | "countdown" | "goal" | "pill" | "upkeep" | "gratitude" | "journal" | "memory" | "mind" | "tip" | "stat" | "record" | "measure" | "meal";

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
  /** A to-do the card can add (science tips). */ todo?: string;
  /** Podcast. */ audio?: string; art?: string; mins?: number;
  /** Mindset card id (to remember it was seen). */ mindId?: string;
};

export type FeedTask = { id: string; title: string; due: string; time?: string; done: boolean; list?: string; hub: "LifeHub" | "WorkHub" | "FamilyHub"; mine: boolean };
export type FeedEpisode = { id: string; title: string; show: string; audio: string; art: string; secs: number; about?: string };
export type FeedCtx = {
  today: string; now?: Date;
  family: any;
  tasks: FeedTask[];
  score?: LifeScoreResult | null;
  stats?: { insights: string[]; records: { label: string; value: string; when: string }[]; sections: { id: string; name: string; stats: { label: string; value: string; sub?: string }[] }[] } | null;
  podcasts?: FeedEpisode[];
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
const me = (family: any): string => arr(family?.members)[0]?.id ?? Object.keys(family?.health?.profiles ?? {})[0] ?? "";

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
  const ep = x.podcasts?.[0];
  if (ep) out.push(podcastCard(ep));
  return out;
}

const podcastCard = (ep: FeedEpisode): FeedCard => card({ id: `pod:${ep.id}`, kind: "podcast", cat: "mind", kicker: "From your shows", title: ep.title, sub: ep.show, body: ep.about, audio: ep.audio, art: ep.art, mins: Math.round((ep.secs || 0) / 60), source: "Arise Podcasts", open: "podster", doneable: false, snoozable: false });

// ——— Endless: discovery pages ——————————————————————————————————————————————————————————————————————————————————
const CHECKINS: { field: string; title: string; low: string; high: string }[] = [
  { field: "stress", title: "How stressed are you right now?", low: "Calm", high: "Overwhelmed" },
  { field: "energy", title: "How's your energy?", low: "Drained", high: "Full" },
  { field: "connect", title: "How connected do you feel to the people in your life?", low: "Alone", high: "Deeply connected" },
  { field: "faithFelt", title: "How close do you feel to God today?", low: "Far", high: "Very close" },
  { field: "happy", title: "How happy are you right now?", low: "Awful", high: "Wonderful" },
];
const GRATITUDE = ["What's one small thing that went right today?", "Who made your week better, and how?", "What's something you'd miss if it were gone?", "What made you laugh recently?", "What's a comfort you usually take for granted?", "What's one thing your body did for you today?", "Who taught you something you still use?", "What are you looking forward to?"];
const JOURNAL = ["What's taking up the most space in your head right now?", "What would make tomorrow a good day?", "What did you learn about yourself this week?", "What's one thing you'd tell yourself a year ago?", "Where did you spend your energy today, and was it worth it?", "What are you avoiding, and what's the smallest first step?", "What does a great week look like for you?", "What's something you're proud of that nobody saw?"];

function mindCard(c: MindCard): FeedCard | null {
  const id = `mind:${c.key}`;
  switch (c.kind) {
    case "quote": return card({ id, kind: "mind", cat: "mind", kicker: "Quote", title: `“${c.item.text}”`, sub: `— ${c.item.by}`, source: "Mindset", open: "mindset", mindId: cardId(c), doneable: false, snoozable: false });
    case "verse": return card({ id, kind: "mind", cat: "mind", kicker: "Verse", title: c.item.text, sub: `${c.item.ref} (KJV)`, source: "Mindset", open: "mindset", mindId: cardId(c), doneable: false, snoozable: false });
    case "advice": return card({ id, kind: "mind", cat: "mind", kicker: "Advice", title: c.item.title, body: c.item.body, source: "Mindset", open: "mindset", mindId: cardId(c), doneable: false, snoozable: false });
    case "affirmation": return card({ id, kind: "mind", cat: "mind", kicker: "Say it", title: c.item.text, source: "Mindset", open: "mindset", mindId: cardId(c), doneable: false, snoozable: false });
    case "prompt": return card({ id, kind: "journal", cat: "mind", kicker: "Reflect", title: c.item.text, source: "Journal", open: "journal", mindId: cardId(c), doneable: false, snoozable: false });
    case "challenge": return card({ id, kind: "mind", cat: "mind", kicker: `Challenge · ${c.item.mins} min`, title: c.item.title, body: c.item.how, todo: c.item.title, source: "Mindset", open: "mindset", mindId: cardId(c), doneable: false, snoozable: false });
    case "lesson": return card({ id, kind: "mind", cat: "mind", kicker: "Mind lesson", title: c.item.title, body: `${c.item.idea}\n\nTry: ${c.item.try}`, source: "Mindset", open: "mindset", mindId: cardId(c), doneable: false, snoozable: false });
    default: return null;
  }
}

/** Page `page` (1, 2, 3, …) of the endless part: 14 cards, a seeded mix, never the same order twice. */
export function discoverCards(x: FeedCtx, page: number, seen: ReadonlySet<string> = new Set()): FeedCard[] {
  const r = rng(page * 7919 + Number(x.today.replace(/-/g, "")));
  const f = x.family ?? {}, T = x.today, out: FeedCard[] = [];
  const makers: (() => FeedCard | null)[] = [];

  // Life Score: patterns, insights from Stats, the science behind a score (lowest scores most often), records, numbers.
  const patterns = [...(x.score?.patterns?.map((p) => p.text) ?? []), ...(x.stats?.insights ?? [])];
  makers.push(() => { const t = pick(patterns, r); return t ? card({ id: `insight:${t}`, kind: "insight", cat: "score", kicker: "Life Score insight", title: t, source: "Life Score · Patterns", open: "lifescore", doneable: false, snoozable: false }) : null; });
  const low = (x.score?.metrics ?? []).filter((m) => m.score !== null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 6).map((m) => m.id);
  makers.push(() => {
    const pool = r() < 0.6 && low.length ? METRICS.filter((m) => low.includes(m.id)) : METRICS;
    const m = pick(pool, r); if (!m) return null;
    const tip = pick(m.improve, r)!, res = x.score?.metrics.find((q) => q.id === m.id);
    return card({ id: `tip:${m.id}:${tip.slice(0, 24)}`, kind: "tip", cat: "score", kicker: `Raise ${m.name}${res?.score != null ? ` · ${res.score}` : ""}`, title: tip, body: m.sources[0] ? `${m.sources[0].finding} (${m.sources[0].title})` : undefined, todo: pick(m.todos, r), source: "Life Score · The science", open: "lifescore", doneable: false, snoozable: false });
  });
  const statPool = (x.stats?.sections ?? []).flatMap((s) => s.stats.map((st) => ({ s, st }))).filter((p) => p.st.value && p.st.value !== "—" && p.st.value !== "0");
  makers.push(() => { const p = pick(statPool, r); return p ? card({ id: `stat:${p.s.id}:${p.st.label}`, kind: "stat", cat: "score", kicker: p.s.name, title: p.st.label, big: p.st.value, sub: p.st.sub, source: "Life Score · Stats", open: "lifescore", doneable: false, snoozable: false }) : null; });
  makers.push(() => { const rc = pick(x.stats?.records ?? [], r); return rc ? card({ id: `record:${rc.label}`, kind: "record", cat: "score", kicker: "Personal record", title: rc.label, big: rc.value, sub: rc.when, source: "Life Score · Records", open: "lifescore", doneable: false, snoozable: false }) : null; });
  // Check-ins not answered today.
  const ci = f.lifeScore?.days?.[T] ?? {};
  makers.push(() => { const c = pick(CHECKINS.filter((q) => (ci as any)[q.field] === undefined), r); return c ? card({ id: `checkin:${c.field}:${T}`, kind: "checkin", cat: "score", kicker: "Quick check-in", title: c.title, field: c.field, low: c.low, high: c.high, source: "Life Score · Check in", open: "lifescore", doneable: false, snoozable: false }) : null; });
  // Writing prompts and memories.
  makers.push(() => card({ id: `gratitude:${T}:${page}`, kind: "gratitude", cat: "mind", kicker: "Gratitude", title: pick(GRATITUDE, r)!, source: "Gratitude", open: "gratitude", doneable: false, snoozable: false }));
  makers.push(() => card({ id: `journal:${T}:${page}`, kind: "journal", cat: "mind", kicker: "Journal", title: pick(JOURNAL, r)!, source: "Journal", open: "journal", doneable: false, snoozable: false }));
  const past = [...arr(f.journal).filter((j: any) => j.date < plusDays(T, -6) && String(j.body || "").trim()).map((j: any) => ({ d: j.date, t: j.title || "Journal", b: String(j.body) })),
    ...arr(f.gratitude).filter((g: any) => g.date < plusDays(T, -6) && arr(g.items).some((i: any) => String(i).trim())).map((g: any) => ({ d: g.date, t: "You were grateful for", b: arr<string>(g.items).filter((i) => i.trim()).join(" · ") }))];
  makers.push(() => { const m = pick(past, r); return m ? card({ id: `memory:${m.d}:${m.t}`, kind: "memory", cat: "mind", kicker: `${daysTo(m.d, T)} days ago · ${shortDate(m.d)}`, title: m.t, body: m.b.length > 420 ? `${m.b.slice(0, 419)}…` : m.b, source: "Memories", open: "journal", doneable: false, snoozable: false }) : null; });
  // Podcasts beyond the first.
  const eps = x.podcasts ?? [];
  makers.push(() => { const e = eps.length > 1 ? eps[1 + Math.floor(r() * (eps.length - 1))] : undefined; return e ? podcastCard(e) : null; });
  // Real items resurfaced: open to-dos, goals, jars, bucket list, books.
  const open = x.tasks.filter((t) => !t.done && t.mine);
  makers.push(() => { const t = pick(open, r); return t ? card({ id: `task:${t.hub}:${t.id}`, kind: "task", cat: "todo", kicker: "Still on your list", title: t.title, chips: [when(t.due, T, t.time), ...(t.list ? [t.list] : [])], source: `${t.hub} · To-dos`, open: "tasks", ref: t.id, hub: t.hub, doneable: true, snoozable: true, doneWord: "DONE" }) : null; });
  const coll = arr(f.collections).filter((c: any) => !c.doneOn && /bucket|reading|learning|watchlist|restaurants|projects/.test(String(c.kind)));
  const kindWord: Record<string, string> = { bucket: "Bucket list", reading: "On your reading list", learning: "Want to learn", watchlist: "To watch", restaurants: "Restaurants to try", projects: "Project" };
  makers.push(() => { const c = pick(coll, r); return c ? card({ id: `coll:${c.id ?? c.title}`, kind: "goal", cat: "mind", kicker: kindWord[c.kind] ?? "Someday", title: c.title, body: c.notes || undefined, todo: `${c.kind === "reading" ? "Read" : c.kind === "watchlist" ? "Watch" : "Plan"}: ${c.title}`, source: kindWord[c.kind] ?? "Lists", open: c.kind === "bucket" ? "bucket" : c.kind, doneable: false, snoozable: false }) : null; });

  // Mindset: quotes, verses, advice, affirmations, challenges, lessons (a third of each page).
  const mind = buildFeed(mindFor(f), { count: 6, seed: page * 31 + 7, skip: new Set(seen) }).map(mindCard).filter((c): c is FeedCard => !!c);

  const pageCards: FeedCard[] = [];
  let guard = 0;
  while (pageCards.length < 9 && guard++ < 60) { const c = makers[Math.floor(r() * makers.length)](); if (c && !pageCards.some((p) => p.id === c.id)) pageCards.push(c); }
  // Interleave: two from the mix, one from Mindset.
  let mi = 0;
  pageCards.forEach((c, i) => { out.push(c); if (i % 2 === 1 && mind[mi]) out.push(mind[mi++]); });
  while (mi < mind.length && out.length < 14) out.push(mind[mi++]);
  // Unique ids across pages (the same tip or quote can come back on a later page).
  return out.map((c) => ({ ...c, id: `${c.id}#${page}` }));
}

/** The opening card. */
export function introCard(x: FeedCtx, left: number): FeedCard {
  const h = (x.now ?? new Date()).getHours();
  const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return card({ id: "intro", kind: "intro", cat: "todo", kicker: at(x.today).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }), title: `${greet}${x.name ? `, ${x.name}` : ""}.`, body: "Your whole week, one card at a time: to-dos, events, health, money, home and Life Score. Swipe up. It never runs out.", big: x.score?.score != null ? String(x.score.score) : undefined, sub: `${left} thing${left === 1 ? "" : "s"} need${left === 1 ? "s" : ""} you`, pct: x.score?.score ?? undefined, source: "Arise Feed", doneable: false, snoozable: false });
}

/** Cards for a filter ("all" shows everything). */
export const inFilter = (c: FeedCard, filter: FeedCat | "all") => filter === "all" || c.kind === "intro" || c.cat === filter;
