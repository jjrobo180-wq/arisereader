// AI Reminders (a LifeHub app, section "lifeplan"): tell it the life you're driving toward, and it builds
// a full schedule of reminders — reading the Bible, logging food, working out, winding down for sleep —
// each with a short, plain reason grounded in well-established research, plus a one-page overview:
// "this is your life, and this is how these small things get you there".
//
// The plan is built by the site's AI (server/lifePlan.ts) or, when the AI isn't available, by the built-in
// planner below from the same choices, so it always works. Reminders reach the phone through LifeHub's
// notifications (shared/todoReminders.ts). Each one can open the app it belongs to (Food diary, Workouts,
// Bible...), and can be marked done, snoozed or skipped. Snoozing moves today's reminder later; it never
// changes the plan.

import type { FamilySection } from "./familyHub";

export const PLAN_AREAS = {
  faith: { label: "Faith", emoji: "🙏" },
  body: { label: "Movement", emoji: "💪" },
  food: { label: "Food & water", emoji: "🥗" },
  sleep: { label: "Sleep", emoji: "😴" },
  mind: { label: "Mind", emoji: "🧘" },
  family: { label: "Family & friends", emoji: "❤️" },
  work: { label: "Work & focus", emoji: "🎯" },
  money: { label: "Money", emoji: "💵" },
  learning: { label: "Learning", emoji: "📚" },
  home: { label: "Home", emoji: "🏠" },
} as const;
export type PlanArea = keyof typeof PLAN_AREAS;
const AREAS = Object.keys(PLAN_AREAS) as PlanArea[];

/** The LifeHub apps a reminder can open. Kept to ones that exist, so the AI can't point anywhere else. */
export const PLAN_OPENS = {
  bible: "Bible", health: "Food & fitness", workouts: "Workouts", sleep: "Sleep", meditate: "Meditate",
  habits: "Habits", goals: "Goals", journal: "Journal", gratitude: "Gratitude", mood: "Mood", pills: "Pill reminders",
  reading: "Reading", grocery: "Grocery list", meals: "Meal planner", recipes: "Recipes", money: "Budget & bills",
  focus: "Focus timer", routines: "Routines", cleaning: "Cleaning", chores: "Chores", calendar: "Calendar", notes: "Notes",
} as const satisfies Partial<Record<FamilySection, string>>;
export type PlanOpens = keyof typeof PLAN_OPENS;
const isOpens = (v: unknown): v is PlanOpens => typeof v === "string" && Object.prototype.hasOwnProperty.call(PLAN_OPENS, v);

export type PlanReminder = {
  id: string;
  title: string;
  emoji: string;
  /** "07:30", in the person's own time. */
  time: string;
  /** Days of the week it's on: 0 Sunday … 6 Saturday. */
  days: number[];
  area: PlanArea;
  /** Why this helps, in a sentence or two. */
  why: string;
  /** The app it opens, if any. */
  opens?: PlanOpens;
  /** Switched off without deleting it. */
  off?: boolean;
};
export type PlanPillar = { area: PlanArea; title: string; why: string };
/** A time the person can't do anything else: work, school pickup, church. From their calendar or typed in. */
export type BusyBlock = { label: string; from: string; to: string; days: number[] };

export type LifePlan = {
  /** What they said they're driving toward, in their words. */
  vision: string;
  /** The overview: "this is your life, and this is how the plan gets you there". */
  summary: string;
  pillars: PlanPillar[];
  reminders: PlanReminder[];
  wake: string;
  bed: string;
  /** Busy times the plan works around (shared/lifePlan.ts's fitAroundBusy). */
  busy: BusyBlock[];
  /** Phone reminders on (they also need notifications turned on for the device). */
  on: boolean;
  createdAt: string;
  /** "ai" or "builtin", so the screen can say how it was made. */
  madeBy: "ai" | "builtin";
  /** Today's (and recent) check-offs: `${reminderId}|${date}` → done or skipped. Old entries are dropped. */
  log: Record<string, "done" | "skip">;
  /** A reminder snoozed today: reminderId → { date, at } (minutes after midnight, the person's own time). */
  snoozed: Record<string, { date: string; at: number }>;
};

export const PLAN_LIMITS = { vision: 600, summary: 1800, pillars: 6, reminders: 40, title: 80, why: 320, log: 1200, busy: 20 } as const;
export const SNOOZE_CHOICES = [{ minutes: 10, label: "10 min" }, { minutes: 30, label: "30 min" }, { minutes: 60, label: "1 hour" }, { minutes: 180, label: "3 hours" }] as const;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max) : "");
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export const toMinutes = (hm: string): number | null => { const m = /^(\d{1,2}):(\d{2})$/.exec(hm || ""); if (!m) return null; const h = Number(m[1]), mm = Number(m[2]); return h < 24 && mm < 60 ? h * 60 + mm : null; };
export const fromMinutes = (n: number): string => { const v = ((Math.round(n) % 1440) + 1440) % 1440; return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`; };
const clock = (v: unknown, fallback: string) => { const m = toMinutes(typeof v === "string" ? v.trim() : ""); return m === null ? fallback : fromMinutes(m); };
export const clock12 = (hm: string) => { const m = toMinutes(hm); if (m === null) return hm; const h = Math.floor(m / 60); return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const days = (v: unknown): number[] => { const d = Array.isArray(v) ? [...new Set(v.map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort() : []; return d.length ? d : ALL_DAYS; };
const area = (v: unknown): PlanArea => (typeof v === "string" && (AREAS as string[]).includes(v) ? (v as PlanArea) : "mind");
const emoji = (v: unknown, fallback: string) => { const e = str(v, 8); return e && !/[a-z0-9]/i.test(e) ? e : fallback; };
const rid = (v: unknown, i: number) => { const s = str(v, 40); return /^[\w-]{1,40}$/.test(s) ? s : `r${i + 1}`; };

/** Busy times made safe: a label, a start before the end (an overnight shift is split at midnight), and days. */
export function cleanBusy(raw: unknown): BusyBlock[] {
  const out: BusyBlock[] = [];
  for (const r of Array.isArray(raw) ? raw.slice(0, PLAN_LIMITS.busy * 2) : []) {
    if (!r || typeof r !== "object") continue;
    const from = toMinutes(String((r as any).from || "")), to = toMinutes(String((r as any).to || ""));
    if (from === null || to === null || from === to) continue;
    const label = str((r as any).label, 40) || "Busy";
    const d = days((r as any).days);
    if (to > from) out.push({ label, from: fromMinutes(from), to: fromMinutes(to), days: d });
    else out.push({ label, from: fromMinutes(from), to: "23:59", days: d }, { label, from: "00:00", to: fromMinutes(to), days: d.map((x) => (x + 1) % 7).sort() });
    if (out.length >= PLAN_LIMITS.busy) break;
  }
  return out.slice(0, PLAN_LIMITS.busy);
}

/** Is this minute of this weekday inside a busy time? */
const busyAt = (busy: readonly BusyBlock[], weekday: number, minute: number) => busy.find((b) => b.days.includes(weekday) && minute >= toMinutes(b.from)! && minute < toMinutes(b.to)!);

/**
 * Reminders moved out of busy times, to the nearest free time inside waking hours (trying later first,
 * then earlier, in 15-minute steps). A reminder is moved for all its days at once, to a time free on
 * every one of them; if no single time works, the days it clashes on are dropped from it instead.
 */
export function fitAroundBusy(reminders: PlanReminder[], busy: readonly BusyBlock[], wake: string, bed: string): PlanReminder[] {
  if (!busy.length) return reminders;
  const w = toMinutes(wake) ?? 420, b = toMinutes(bed) ?? 1350;
  return reminders.map((r) => {
    const at = toMinutes(r.time)!;
    const freeAll = (m: number) => r.days.every((d) => !busyAt(busy, d, m));
    if (freeAll(at)) return r;
    for (let step = 15; step <= 12 * 60; step += 15) {
      for (const m of [at + step, at - step]) if (m >= w && m <= b && freeAll(m)) return { ...r, time: fromMinutes(m) };
    }
    const okDays = r.days.filter((d) => !busyAt(busy, d, at));
    return okDays.length ? { ...r, days: okDays } : { ...r, off: true };
  });
}

/** The busy time a reminder lands in on any of its days ("Work"), or "" when it's clear. */
export const busyClash = (busy: readonly BusyBlock[], r: Pick<PlanReminder, "time" | "days">): string => { const m = toMinutes(r.time); return m === null ? "" : r.days.map((d) => busyAt(busy, d, m)?.label).find(Boolean) || ""; };

/** A week of busy times read from the calendar: every event with a time in the next 7 days, by weekday. */
export function busyFromEvents(eventsByDay: { date: string; events: { title: string; time: string; endTime?: string }[] }[]): BusyBlock[] {
  const byKey = new Map<string, BusyBlock>();
  for (const { date, events } of eventsByDay) {
    const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
    for (const e of events) {
      const from = toMinutes(e.time || "");
      if (from === null) continue;
      const end = toMinutes(e.endTime || "");
      const to = end !== null && end > from ? end : Math.min(from + 60, 1439);
      const label = str(e.title, 40) || "Busy";
      const key = `${label}|${from}|${to}`;
      const had = byKey.get(key);
      if (had) { if (!had.days.includes(wd)) had.days = [...had.days, wd].sort(); }
      else byKey.set(key, { label, from: fromMinutes(from), to: fromMinutes(to), days: [wd] });
    }
  }
  return [...byKey.values()].slice(0, PLAN_LIMITS.busy);
}

/** One reminder made safe (from saved data or from the AI), or null if it isn't usable. */
export function cleanReminder(raw: unknown, i = 0): PlanReminder | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title, PLAN_LIMITS.title);
  const time = toMinutes(typeof r.time === "string" ? r.time.trim() : "");
  if (!title || time === null) return null;
  const a = area(r.area);
  return {
    id: rid(r.id, i), title, emoji: emoji(r.emoji, PLAN_AREAS[a].emoji), time: fromMinutes(time), days: days(r.days), area: a,
    why: str(r.why, PLAN_LIMITS.why), ...(isOpens(r.opens) ? { opens: r.opens } : {}), ...(r.off === true ? { off: true } : {}),
  };
}

/** A saved plan made safe, or undefined when there isn't one. */
export function cleanLifePlan(raw: unknown): LifePlan | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, any>;
  const reminders: PlanReminder[] = [];
  const ids = new Set<string>();
  for (const [i, x] of (Array.isArray(r.reminders) ? r.reminders : []).slice(0, PLAN_LIMITS.reminders * 2).entries()) {
    const c = cleanReminder(x, i);
    if (!c) continue;
    while (ids.has(c.id)) c.id = `${c.id}x`;
    ids.add(c.id);
    reminders.push(c);
    if (reminders.length >= PLAN_LIMITS.reminders) break;
  }
  const pillars = (Array.isArray(r.pillars) ? r.pillars : []).map((p: any) => p && typeof p === "object" ? { area: area(p.area), title: str(p.title, 60), why: str(p.why, PLAN_LIMITS.why) } : null)
    .filter((p: PlanPillar | null): p is PlanPillar => !!p && !!p.title).slice(0, PLAN_LIMITS.pillars);
  const log: LifePlan["log"] = {};
  const entries = Object.entries(r.log && typeof r.log === "object" ? r.log : {}).filter(([k, v]) => /^[\w-]{1,40}\|\d{4}-\d{2}-\d{2}$/.test(k) && (v === "done" || v === "skip"));
  for (const [k, v] of entries.sort((a, b) => b[0].split("|")[1].localeCompare(a[0].split("|")[1])).slice(0, PLAN_LIMITS.log)) log[k] = v as "done" | "skip";
  const snoozed: LifePlan["snoozed"] = {};
  for (const [k, v] of Object.entries(r.snoozed && typeof r.snoozed === "object" ? r.snoozed : {})) {
    const s = v as any;
    if (ids.has(k) && s && isDay(s.date) && Number.isInteger(s.at) && s.at >= 0 && s.at < 1440) snoozed[k] = { date: s.date, at: s.at };
  }
  if (!reminders.length && !str(r.vision, 10)) return undefined;
  return {
    vision: str(r.vision, PLAN_LIMITS.vision), summary: str(r.summary, PLAN_LIMITS.summary), pillars, reminders,
    wake: clock(r.wake, "07:00"), bed: clock(r.bed, "22:30"), busy: cleanBusy(r.busy), on: r.on !== false, createdAt: str(r.createdAt, 40),
    madeBy: r.madeBy === "ai" ? "ai" : "builtin", log, snoozed,
  };
}

// ─── What someone tells it ────────────────────────────────────────────────────

export const PLAN_FOCUSES = [
  { id: "faith", label: "Grow closer to God", emoji: "🙏" },
  { id: "eat", label: "Eat healthier", emoji: "🥗" },
  { id: "move", label: "Work out & move more", emoji: "💪" },
  { id: "weight", label: "Reach a healthy weight", emoji: "⚖️" },
  { id: "sleep", label: "Sleep better", emoji: "😴" },
  { id: "calm", label: "Feel calmer", emoji: "🧘" },
  { id: "family", label: "Be there for family", emoji: "❤️" },
  { id: "organized", label: "Get organized", emoji: "🗂️" },
  { id: "money", label: "Spend less, save more", emoji: "💵" },
  { id: "read", label: "Read more", emoji: "📚" },
  { id: "career", label: "Grow at work", emoji: "🎯" },
  { id: "water", label: "Drink more water", emoji: "💧" },
] as const;
export type PlanFocus = (typeof PLAN_FOCUSES)[number]["id"];
const FOCUS_IDS = PLAN_FOCUSES.map((f) => f.id) as string[];

export type PlanRequest = { vision: string; focuses: PlanFocus[]; wake: string; bed: string; workDays: number[]; busy: BusyBlock[] };

export function cleanPlanRequest(raw: unknown): PlanRequest {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const focuses = (Array.isArray(r.focuses) ? r.focuses : []).filter((f): f is PlanFocus => typeof f === "string" && FOCUS_IDS.includes(f));
  const workDays = Array.isArray(r.workDays) ? days(r.workDays) : [1, 2, 3, 4, 5];
  return { vision: str(r.vision, PLAN_LIMITS.vision), focuses: [...new Set(focuses)].slice(0, 8), wake: clock(r.wake, "07:00"), bed: clock(r.bed, "22:30"), workDays: Array.isArray(r.workDays) && r.workDays.length === 0 ? [] : workDays, busy: cleanBusy(r.busy) };
}

// ─── The built-in planner (used when the AI isn't available) ──────────────────

type Seed = { title: string; emoji: string; at: (w: number, b: number) => number; days?: "all" | "work" | "off" | number[]; area: PlanArea; why: string; opens?: PlanOpens };
const WEEKEND = [0, 6];
const SEEDS: Record<PlanFocus, { pillar: string; why: string; area: PlanArea; seeds: Seed[] }> = {
  faith: { pillar: "Start and end each day with God", area: "faith", why: "Spiritual practices done at the same time every day become anchors the rest of the day can lean on.", seeds: [
    { title: "Read your Bible", emoji: "📖", at: (w) => w + 20, area: "faith", opens: "bible", why: "Tying a habit to something you already do (waking up) makes it far more likely to stick than relying on remembering." },
    { title: "Pray and give thanks", emoji: "🙏", at: (_w, b) => b - 30, area: "faith", opens: "gratitude", why: "Ending the day by naming what you're thankful for is linked in research to better mood and easier sleep." },
  ] },
  eat: { pillar: "Feed your body well", area: "food", why: "Simply writing down what you eat is one of the most reliable ways people change how they eat.", seeds: [
    { title: "Log breakfast", emoji: "🍳", at: (w) => w + 45, area: "food", opens: "health", why: "Noting meals as you go is more accurate than trying to remember them later, and awareness alone shifts choices." },
    { title: "Log lunch", emoji: "🥪", at: () => 12 * 60 + 30, area: "food", opens: "health", why: "A midday check keeps the afternoon on track before hunger makes the choice for you." },
    { title: "Log dinner", emoji: "🍽️", at: () => 18 * 60 + 30, area: "food", opens: "health", why: "Closing the day's food log shows patterns over a week that are hard to see meal by meal." },
    { title: "Plan the week's meals", emoji: "🗓️", at: () => 16 * 60, days: [0], area: "food", opens: "meals", why: "Deciding meals ahead means fewer last-minute, tired choices on busy nights." },
  ] },
  move: { pillar: "Move every day", area: "body", why: "Guidelines suggest about 150 minutes of moderate activity a week; spreading it out makes it doable.", seeds: [
    { title: "Workout", emoji: "🏋️", at: () => 17 * 60 + 30, days: [1, 3, 5], area: "body", opens: "workouts", why: "Three set times a week turn exercise from a decision into an appointment, which is far easier to keep." },
    { title: "10-minute walk after lunch", emoji: "🚶", at: () => 13 * 60, days: "work", area: "body", why: "A short walk after eating helps your body handle the meal and gives a real lift to afternoon focus." },
    { title: "Weekend activity", emoji: "🚴", at: (w) => w + 120, days: WEEKEND, area: "body", opens: "workouts", why: "Something active and fun on days off keeps the habit alive without feeling like a chore." },
  ] },
  weight: { pillar: "Healthy, steady progress", area: "food", why: "Small, steady habits are what keep weight changes lasting; crash diets usually rebound.", seeds: [
    { title: "Log meals", emoji: "📝", at: () => 19 * 60 + 30, area: "food", opens: "health", why: "Keeping a food log is consistently tied to better results than not logging, because it makes eating visible." },
    { title: "Weekly weigh-in", emoji: "⚖️", at: (w) => w + 10, days: [6], area: "body", opens: "health", why: "Once a week, same time, smooths out normal day-to-day ups and downs so the trend is what you see." },
    { title: "Walk 20 minutes", emoji: "🚶", at: () => 18 * 60, area: "body", opens: "workouts", why: "Regular walking is gentle, easy to keep up and adds up over a week." },
  ] },
  sleep: { pillar: "Protect your sleep", area: "sleep", why: "Sleep affects mood, focus, appetite and patience more than almost anything else we can change.", seeds: [
    { title: "Start winding down: screens away", emoji: "🌙", at: (_w, b) => b - 60, area: "sleep", opens: "sleep", why: "Bright screens late at night can delay the body's sleep signal; an hour of calm helps you fall asleep sooner." },
    { title: "Get morning daylight", emoji: "☀️", at: (w) => w + 15, area: "sleep", why: "Light early in the day helps set your body clock, which makes it easier to feel sleepy at night." },
    { title: "Lights out", emoji: "😴", at: (_w, b) => b, area: "sleep", opens: "sleep", why: "Going to bed and waking at the same times, even on weekends, is one of the strongest habits for better sleep." },
  ] },
  calm: { pillar: "Make room to breathe", area: "mind", why: "A few minutes of quiet attention each day is linked to lower stress and better focus.", seeds: [
    { title: "5 minutes of quiet", emoji: "🧘", at: (w) => w + 30, area: "mind", opens: "meditate", why: "Even short daily meditation is linked to lower stress; consistency matters more than length." },
    { title: "How are you feeling?", emoji: "💭", at: () => 20 * 60, area: "mind", opens: "mood", why: "Putting a feeling into words helps calm it, and a daily check-in shows patterns over time." },
  ] },
  family: { pillar: "Be present with the people you love", area: "family", why: "Close relationships are one of the strongest predictors of a happy, healthy life.", seeds: [
    { title: "Phone-free dinner", emoji: "🍽️", at: () => 18 * 60, area: "family", why: "Regular family meals without screens are linked to closer relationships and kids who feel more supported." },
    { title: "Family meeting", emoji: "👨‍👩‍👧", at: () => 17 * 60, days: [0], area: "family", opens: "calendar", why: "A short weekly check-in heads off conflicts and gets the week's plans on everyone's radar." },
    { title: "Call or text someone you love", emoji: "📞", at: () => 11 * 60, days: [6], area: "family", why: "Small, regular contact keeps friendships strong far better than rare big catch-ups." },
  ] },
  organized: { pillar: "Calm, organized days", area: "home", why: "Deciding ahead of time when and where you'll do something makes you much more likely to do it.", seeds: [
    { title: "Plan tomorrow", emoji: "🗒️", at: (_w, b) => b - 90, area: "work", opens: "calendar", why: "Writing tomorrow's top three tonight clears your head for sleep and gives the morning a running start." },
    { title: "10-minute tidy", emoji: "🧹", at: () => 19 * 60 + 30, area: "home", opens: "cleaning", why: "A short daily reset stops mess from piling up into a weekend-long job." },
    { title: "Weekly review", emoji: "📋", at: () => 19 * 60, days: [0], area: "work", opens: "notes", why: "Looking back and ahead once a week catches loose ends before they become problems." },
  ] },
  money: { pillar: "Money that works for you", area: "money", why: "People who track spending regularly tend to spend less without feeling deprived.", seeds: [
    { title: "Log today's spending", emoji: "🧾", at: () => 21 * 60, area: "money", opens: "money", why: "Seeing every purchase the same day makes small leaks visible while you can still do something about them." },
    { title: "Weekly money check", emoji: "💵", at: () => 18 * 60, days: [0], area: "money", opens: "money", why: "A short weekly look at bills and the budget prevents surprises at the end of the month." },
  ] },
  read: { pillar: "Read a little every day", area: "learning", why: "Twenty minutes a day adds up to many books a year.", seeds: [
    { title: "Read for 20 minutes", emoji: "📚", at: (_w, b) => b - 45, area: "learning", opens: "reading", why: "Reading before bed (on paper or a dim screen) is a calming replacement for scrolling, and it adds up fast." },
  ] },
  career: { pillar: "Grow at work", area: "work", why: "Doing your most important work first, without interruptions, is where most progress happens.", seeds: [
    { title: "Focus block: most important task", emoji: "🎯", at: (w) => Math.max(w + 120, 9 * 60), days: "work", area: "work", opens: "focus", why: "One task at a time, with notifications off, gets far more done than switching back and forth." },
    { title: "Learn something new (15 min)", emoji: "💡", at: () => 19 * 60 + 15, days: [2, 4], area: "learning", why: "Short, spaced practice sessions are remembered much better than one long cram." },
  ] },
  water: { pillar: "Stay hydrated", area: "food", why: "Even mild dehydration can make you tired, foggy and cranky.", seeds: [
    { title: "Glass of water", emoji: "💧", at: (w) => w + 5, area: "food", opens: "health", why: "Your body goes all night without water; a glass first thing is an easy win." },
    { title: "Water break", emoji: "💧", at: () => 10 * 60 + 30, area: "food", opens: "health", why: "Spacing water through the day is easier than catching up at night." },
    { title: "Water break", emoji: "💧", at: () => 15 * 60, area: "food", opens: "health", why: "Mid-afternoon tiredness is often thirst; a drink can help more than a snack." },
  ] },
};

const dayList = (d: Seed["days"], work: number[]): number[] => d === undefined || d === "all" ? ALL_DAYS : d === "work" ? (work.length ? work : [1, 2, 3, 4, 5]) : d === "off" ? ALL_DAYS.filter((x) => !work.includes(x)) : d;

/** A plan made without the AI, from the same choices. Always gives something useful. */
export function builtinPlan(req: PlanRequest, nowIso = new Date().toISOString()): LifePlan {
  const focuses: PlanFocus[] = req.focuses.length ? req.focuses : ["sleep", "move", "calm"];
  const w = toMinutes(req.wake) ?? 420, b = toMinutes(req.bed) ?? 1350;
  const reminders: PlanReminder[] = [];
  const pillars: PlanPillar[] = [];
  for (const f of focuses) {
    const s = SEEDS[f];
    pillars.push({ area: s.area, title: s.pillar, why: s.why });
    for (const seed of s.seeds) {
      if (reminders.length >= PLAN_LIMITS.reminders) break;
      let at = seed.at(w, b);
      // Keep everything inside waking hours.
      at = Math.min(Math.max(at, w), b);
      // Two of the same thing (water on two focuses) only once.
      if (reminders.some((r) => r.title === seed.title && r.time === fromMinutes(at))) continue;
      reminders.push({ id: `r${reminders.length + 1}`, title: seed.title, emoji: seed.emoji, time: fromMinutes(at), days: dayList(seed.days, req.workDays), area: seed.area, why: seed.why, ...(seed.opens ? { opens: seed.opens } : {}) });
    }
  }
  const fitted = fitAroundBusy(reminders, req.busy, req.wake, req.bed);
  reminders.splice(0, reminders.length, ...fitted);
  reminders.sort((a, z) => a.time.localeCompare(z.time));
  const named = PLAN_FOCUSES.filter((f) => focuses.includes(f.id)).map((f) => f.label.toLowerCase());
  const vision = req.vision || `I want to ${named.join(", ")}.`;
  const summary = [
    `This is the life you're building, and every reminder below is a small step toward it.`,
    `Your plan rests on ${pillars.length} ${pillars.length === 1 ? "pillar" : "pillars"}: ${pillars.map((p) => p.title).join(", ")}. Each one is a few small actions at the same time on the same days, because consistency, not intensity, is what changes a life.`,
    `Why it works: habits form when an action is repeated in the same situation until it becomes automatic. Research from University College London found that took about 66 days on average, with a wide range, and that missing a day here and there didn't undo progress. So expect the first few weeks to take effort, and don't quit after a slip: just do the next one.`,
    ...(req.busy.length ? [`It's built around your busy times (${req.busy.map((x) => x.label).slice(0, 4).join(", ")}${req.busy.length > 4 ? "…" : ""}), so nothing lands while you're at work or away. Change any time to fit your real day.`] : []),
    `Start with what you can keep. If the whole plan feels like too much, switch a few reminders off and add them back once the first ones feel easy.`,
  ].join("\n\n");
  return { vision, summary, pillars, reminders, wake: fromMinutes(w), bed: fromMinutes(b), busy: req.busy, on: true, createdAt: nowIso, madeBy: "builtin", log: {}, snoozed: {} };
}

// ─── The AI ────────────────────────────────────────────────────────────────────

export const PLAN_PROMPT = `You are the planner inside "AI Reminders", an app in A.R.I.S.E. LifeHub (a family organizer).
The person tells you the life they want. You turn it into a realistic weekly schedule of reminders and a short, warm overview.

Return ONLY a JSON object with exactly these keys:
{
  "summary": string,   // 3 to 5 short paragraphs separated by blank lines. Start by reflecting their vision back in one sentence ("This is the life you're building: ..."). Then explain how the pillars and the daily reminders get them there, and the science of why small, consistent, same-time habits work (cue-based habit formation; habits take weeks to become automatic, often around two months; missing a day doesn't erase progress). Plain, encouraging language. No markdown headings.
  "pillars": [ { "area": one of ${JSON.stringify(Object.keys(PLAN_AREAS))}, "title": string (max 60 chars), "why": string (1 to 2 sentences) } ],  // 2 to 6 pillars
  "reminders": [ { "title": string (max 60 chars, an action: "Read your Bible", "Log lunch"), "emoji": one emoji, "time": "HH:MM" 24-hour, "days": array of weekday numbers 0=Sunday..6=Saturday, "area": one of the areas above, "why": string (1 to 2 sentences, why this specific habit helps, grounded in well-established research), "opens": one of ${JSON.stringify(Object.keys(PLAN_OPENS))} or null } ]  // 6 to 18 reminders
}

Rules:
- Every time must be between their wake time and bedtime. Never put more than two reminders at the same time; spread them out.
- Respect their work days for work-hour reminders. Fewer reminders on busy days is fine.
- NEVER put a reminder inside one of their busy times. Plan around them realistically: if they work evenings, time with family goes before work or on days off, not during the shift.
- "opens" is the LifeHub app the reminder belongs to (food logging -> "health", Bible reading -> "bible", workouts -> "workouts", sleep -> "sleep", meditation -> "meditate", mood check-in -> "mood", spending -> "money"). Use null when nothing fits.
- Keep the science honest: describe well-established findings in general terms ("research suggests", "studies link"). Never invent study names, statistics or quotes. No medical claims, diagnoses, calorie or weight targets, or supplement advice; for health conditions suggest talking to their doctor.
- If they mention faith, honor it respectfully in their own tradition's words. Never add faith content they didn't ask for.
- Make it achievable for a busy parent: start small. Quality over quantity.`;

/** What the AI is told about this person. */
export function planUserMessage(req: PlanRequest): string {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const focusLabels = PLAN_FOCUSES.filter((f) => req.focuses.includes(f.id)).map((f) => f.label);
  return [
    `The life I'm driving toward: ${req.vision || "(not written; use my picks)"}`,
    focusLabels.length ? `What matters most to me: ${focusLabels.join(", ")}` : "",
    `I wake up around ${req.wake} and go to bed around ${req.bed}.`,
    req.workDays.length ? `I work (or have school) on ${req.workDays.map((d) => names[d]).join(", ")}.` : "I don't have a fixed work schedule.",
    req.busy.length ? `I'm busy at these times (don't schedule anything then):\n${req.busy.map((x) => `- ${x.label}: ${x.from}–${x.to} on ${x.days.length === 7 ? "every day" : x.days.map((d) => names[d]).join(", ")}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

/** The AI's answer made into a plan (cleaned like saved data), or null if it isn't usable. */
export function planFromAi(text: string, req: PlanRequest, nowIso = new Date().toISOString()): LifePlan | null {
  let data: any;
  try { data = JSON.parse(String(text).replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { return null; }
  if (!data || typeof data !== "object") return null;
  const w = toMinutes(req.wake) ?? 420, b = toMinutes(req.bed) ?? 1350;
  const reminders = (Array.isArray(data.reminders) ? data.reminders : []).map((r: any, i: number) => {
    const c = cleanReminder({ ...r, id: `r${i + 1}` }, i);
    if (!c) return null;
    const at = toMinutes(c.time)!;
    // An AI time outside waking hours is pulled back inside them rather than dropped.
    if (b > w && (at < w || at > b)) c.time = fromMinutes(Math.min(Math.max(at, w), b));
    return c;
  }).filter((r: PlanReminder | null): r is PlanReminder => !!r).slice(0, PLAN_LIMITS.reminders);
  if (reminders.length < 2) return null;
  // Even if the AI ignored a busy time, nothing is left inside one.
  const fitted = fitAroundBusy(reminders, req.busy, req.wake, req.bed).sort((a: PlanReminder, z: PlanReminder) => a.time.localeCompare(z.time));
  const plan = cleanLifePlan({ vision: req.vision || PLAN_FOCUSES.filter((f) => req.focuses.includes(f.id)).map((f) => f.label).join(", "), summary: data.summary, pillars: data.pillars, reminders: fitted, wake: req.wake, bed: req.bed, busy: req.busy, on: true, createdAt: nowIso, madeBy: "ai" });
  return plan && plan.summary ? plan : null;
}

// ─── Today ───────────────────────────────────────────────────────────────────

const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const logKey = (id: string, date: string) => `${id}|${date}`;

export type TodayItem = PlanReminder & { at: number; state: "done" | "skip" | "snoozed" | "due" | "later"; snoozedTo?: number };

/** Today's reminders in time order, each with what happened to it so far. `minutes` is now, in the person's own time. */
export function todayItems(plan: LifePlan, date: string, minutes: number): TodayItem[] {
  const wd = weekdayOf(date);
  return plan.reminders.filter((r) => !r.off && r.days.includes(wd)).map((r) => {
    const logged = plan.log[logKey(r.id, date)];
    const s = plan.snoozed[r.id];
    const snoozedTo = s && s.date === date ? s.at : undefined;
    const at = snoozedTo ?? toMinutes(r.time)!;
    const state: TodayItem["state"] = logged ?? (snoozedTo !== undefined && snoozedTo > minutes ? "snoozed" : at <= minutes ? "due" : "later");
    return { ...r, at, state, ...(snoozedTo !== undefined ? { snoozedTo } : {}) };
  }).sort((a, z) => a.at - z.at);
}

/** The plan with today's reminder marked done or skipped (and any snooze for it cleared). */
export function markReminder(plan: LifePlan, id: string, date: string, how: "done" | "skip" | null): LifePlan {
  const log = { ...plan.log };
  if (how) log[logKey(id, date)] = how; else delete log[logKey(id, date)];
  const { [id]: _gone, ...snoozed } = plan.snoozed;
  return { ...plan, log, snoozed };
}

/** The plan with today's reminder moved later by some minutes (never past midnight). */
export function snoozeReminder(plan: LifePlan, id: string, date: string, nowMinutes: number, by: number): LifePlan {
  const at = Math.min(nowMinutes + Math.max(1, Math.round(by)), 1439);
  const log = { ...plan.log };
  delete log[logKey(id, date)];
  return { ...plan, log, snoozed: { ...plan.snoozed, [id]: { date, at } } };
}

/** How many of the last 7 days' reminders were done, for the streak line. */
export function weekScore(plan: LifePlan, today: string): { done: number; total: number } {
  let done = 0, total = 0;
  // Only days since the plan started count, so a brand-new plan doesn't start at 0% for days it didn't exist.
  const started = isDay(plan.createdAt.slice(0, 10)) ? plan.createdAt.slice(0, 10) : "";
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10), wd = d.getUTCDay();
    if (started && date < started) break;
    for (const r of plan.reminders) if (!r.off && r.days.includes(wd)) { total++; if (plan.log[logKey(r.id, date)] === "done") done++; }
  }
  return { done, total };
}

// ─── Phone reminders (used by shared/todoReminders.ts) ────────────────────────

export type PlanPush = { key: string; title: string; body: string; url: string };

/** Reminders whose time (or snoozed time) has come, not yet done or skipped today. `window` is how long a reminder stays sendable. */
export function duePlanReminders(plan: LifePlan | undefined, date: string, minutes: number, window: number, baseUrl: string): PlanPush[] {
  if (!plan || !plan.on) return [];
  const out: PlanPush[] = [];
  for (const item of todayItems(plan, date, minutes)) {
    if (item.state === "done" || item.state === "skip") continue;
    if (minutes < item.at || minutes >= item.at + window) continue;
    const why = item.why ? ` ${item.why.split(/(?<=[.!?])\s/)[0]}` : "";
    out.push({
      key: `todo:plan:${item.id}:${date}:${item.at}`,
      title: `${item.emoji} ${item.title}`.slice(0, 120),
      body: `${item.snoozedTo !== undefined ? "Snoozed reminder." : clock12(fromMinutes(item.at)) + "."}${why} Tap for done or snooze.`.slice(0, 240),
      url: `${baseUrl}?plan=${encodeURIComponent(item.id)}`,
    });
  }
  return out;
}
