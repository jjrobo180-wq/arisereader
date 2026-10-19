// Arise LifeHub · Sleep: what the Sleep app saves, and the small pieces of logic around it.
// Kept apart from the content (sleepContent.ts, sleepScripts.ts) so the family data module,
// which every screen and the server use, stays light. The nightly sleep log itself (bedtime,
// wake time, how it felt) is still family.sleep; this is everything the app adds around it.

export const SOUND_IDS = ["brown", "pink", "white", "rain", "thunder", "ocean", "stream", "wind", "crickets", "fire", "fan", "heartbeat", "drone"] as const;
export type SoundId = (typeof SOUND_IDS)[number];

export const JOURNAL_KINDS = ["dump", "tomorrow", "worry", "gratitude", "prayer", "free"] as const;
export type JournalKind = (typeof JOURNAL_KINDS)[number];

/** A tool started on a night, like "sound:brown" or "script:night-train". `night` is the date
 *  the night ends on (the date you wake up), the same date the sleep log uses. */
export type SleepUse = { id: string; night: string; tool: string; at: string };
/** The morning check-in: how fast you fell asleep, and which of the night's tools helped. */
export type SleepReview = { id: string; night: string; fell: "fast" | "ok" | "slow"; helped: string[] };
export type SleepJournalEntry = { id: string; night: string; kind: JournalKind; text: string; at: string };
/** A thought parked for the morning, from Quiet mind or a cast-your-cares prayer. */
export type ParkedThought = { id: string; night: string; text: string; prayed: boolean; done: boolean };

export type SleepPlan = {
  bed: string;
  wake: string;
  /** The wind-down checklist; null keeps the app's suggested one. */
  checklist: { id: string; text: string }[] | null;
  /** What's ticked off, on `checkedNight` only, so it starts fresh every night. */
  checked: string[];
  checkedNight: string;
};

export type SleepSettings = {
  /** Show Christian content: Scripture, prayer, breath prayers. */
  faith: boolean;
  /** Read aloud with the calm AI voice, or the phone's own voice (works offline). */
  voice: "ai" | "device";
  aiVoice: "warm" | "deep";
  /** The phone voice picked, by its voiceURI. Empty: the best one available. */
  deviceVoice: string;
  pace: "slow" | "slower" | "slowest";
  /** Show the words on screen while they're read. */
  showWords: boolean;
  /** Sleep timer in minutes: sound fades out and reading stops. 0 keeps going until stopped. */
  timer: number;
  breathCue: "chime" | "voice" | "none";
  /** The last sound mix, each sound's level from 0 to 1. */
  mix: Partial<Record<SoundId, number>>;
  volume: number;
};

export type SleepApp = {
  settings: SleepSettings;
  plan: SleepPlan;
  uses: SleepUse[];
  reviews: SleepReview[];
  journal: SleepJournalEntry[];
  parked: ParkedThought[];
  /** Tool ids starred by the person. */
  favorites: string[];
};

export const SLEEP_LIMITS = { uses: 3000, reviews: 1000, journal: 1000, parked: 300, favorites: 60, checklist: 20 };
export const TIMER_CHOICES = [15, 30, 45, 60, 90, 0] as const;

export const emptySleepApp = (): SleepApp => ({
  settings: { faith: true, voice: "ai", aiVoice: "warm", deviceVoice: "", pace: "slower", showWords: true, timer: 45, breathCue: "chime", mix: {}, volume: 0.8 },
  plan: { bed: "22:30", wake: "06:30", checklist: null, checked: [], checkedNight: "" },
  uses: [], reviews: [], journal: [], parked: [], favorites: [],
});

// ── Sanitizing ───────────────────────────────────────────────────────────────

const obj = (v: unknown): Record<string, any> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : null);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\u0000/g, "").slice(0, max) : "");
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const clock = (v: unknown, fallback = "") => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback);
const isDay = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T12:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};
const level = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, Math.round(v * 100) / 100)) : fallback);
const toolId = (v: unknown) => (typeof v === "string" && /^[a-z]+:[a-z0-9-]{1,60}$/.test(v) ? v : "");

/** Keeps up to `max` rows with a unique id, the newest ones (these all grow at the end). */
function newest<T extends { id: string }>(v: unknown, max: number, clean: (r: Record<string, any>) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>(), out: T[] = [];
  for (const raw of v.slice(-max * 2)) {
    const r = obj(raw), row = r && clean(r);
    if (!row || !row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out.slice(-max);
}

export function cleanSleepApp(input: unknown): SleepApp {
  const base = emptySleepApp();
  const raw = obj(input);
  if (!raw) return base;
  const s = obj(raw.settings) || {};
  const mix: Partial<Record<SoundId, number>> = {};
  const rawMix = obj(s.mix) || {};
  for (const id of SOUND_IDS) if (typeof rawMix[id] === "number") { const v = level(rawMix[id], 0); if (v > 0) mix[id] = v; }
  const timer = typeof s.timer === "number" && (TIMER_CHOICES as readonly number[]).includes(s.timer) ? s.timer : base.settings.timer;
  const settings: SleepSettings = {
    faith: bool(s.faith, base.settings.faith),
    voice: oneOf(s.voice, ["ai", "device"] as const, base.settings.voice),
    aiVoice: oneOf(s.aiVoice, ["warm", "deep"] as const, base.settings.aiVoice),
    deviceVoice: str(s.deviceVoice, 200),
    pace: oneOf(s.pace, ["slow", "slower", "slowest"] as const, base.settings.pace),
    showWords: bool(s.showWords, base.settings.showWords),
    timer,
    breathCue: oneOf(s.breathCue, ["chime", "voice", "none"] as const, base.settings.breathCue),
    mix,
    volume: level(s.volume, base.settings.volume),
  };
  const p = obj(raw.plan) || {};
  const checklist = Array.isArray(p.checklist)
    ? p.checklist.slice(0, SLEEP_LIMITS.checklist).map((r: unknown) => { const o = obj(r); const text = str(o?.text, 80).trim(); return o && text ? { id: str(o.id, 60) || text.slice(0, 20), text } : null; }).filter((x: { id: string; text: string } | null): x is { id: string; text: string } => !!x)
    : null;
  const checkedNight = isDay(p.checkedNight) ? p.checkedNight : "";
  const plan: SleepPlan = {
    bed: clock(p.bed, base.plan.bed),
    wake: clock(p.wake, base.plan.wake),
    checklist,
    checked: checkedNight && Array.isArray(p.checked) ? [...new Set(p.checked.filter((x: unknown): x is string => typeof x === "string" && !!x && x.length <= 60))].slice(0, SLEEP_LIMITS.checklist) : [],
    checkedNight,
  };
  const uses = newest(raw.uses, SLEEP_LIMITS.uses, (r) => {
    const tool = toolId(r.tool);
    return tool && isDay(r.night) ? { id: str(r.id, 100), night: r.night, tool, at: clock(r.at) } : null;
  });
  const reviews = newest(raw.reviews, SLEEP_LIMITS.reviews, (r) => isDay(r.night)
    ? { id: str(r.id, 100), night: r.night, fell: oneOf(r.fell, ["fast", "ok", "slow"] as const, "ok"), helped: Array.isArray(r.helped) ? [...new Set(r.helped.map(toolId).filter(Boolean))].slice(0, 30) as string[] : [] }
    : null);
  const journal = newest(raw.journal, SLEEP_LIMITS.journal, (r) => {
    const text = str(r.text, 5000);
    return text.trim() && isDay(r.night) ? { id: str(r.id, 100), night: r.night, kind: oneOf(r.kind, JOURNAL_KINDS, "free"), text, at: str(r.at, 40) } : null;
  });
  const parked = newest(raw.parked, SLEEP_LIMITS.parked, (r) => {
    const text = str(r.text, 300).trim();
    return text && isDay(r.night) ? { id: str(r.id, 100), night: r.night, text, prayed: bool(r.prayed, false), done: bool(r.done, false) } : null;
  });
  const favorites = Array.isArray(raw.favorites) ? [...new Set(raw.favorites.map(toolId).filter(Boolean))].slice(0, SLEEP_LIMITS.favorites) as string[] : [];
  return { settings, plan, uses, reviews, journal, parked, favorites };
}

// ── Nights ───────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
export const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localClock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** The night a moment belongs to, named by the date it ends on: 11 p.m. on the 18th and 2 a.m.
 *  on the 19th are both the night of the 19th, the same date the sleep log calls "woke up on". */
export function nightOf(d: Date = new Date()): string {
  const x = new Date(d.getTime());
  if (x.getHours() >= 12) x.setDate(x.getDate() + 1);
  return localDay(x);
}

/** Between 4 a.m. and 6 p.m., the night that just ended (today's date); at night, null. */
export function reviewNight(d: Date = new Date()): string | null {
  const h = d.getHours();
  return h >= 4 && h < 18 ? localDay(d) : null;
}

/** Morning to late afternoon, evening, or the middle of the night: what the app says hello with. */
export function partOfNight(d: Date = new Date()): "day" | "evening" | "late" | "small-hours" {
  const h = d.getHours();
  if (h >= 4 && h < 17) return "day";
  if (h >= 17 && h < 22) return "evening";
  if (h >= 22 || h < 1) return "late";
  return "small-hours";
}

/** The app with a tool recorded for tonight. Only the first use of a tool each night counts. */
export function recordUse(app: SleepApp, tool: string, makeId: () => string, now: Date = new Date()): SleepApp {
  if (!toolId(tool)) return app;
  const night = nightOf(now);
  if (app.uses.some((u) => u.night === night && u.tool === tool)) return app;
  return { ...app, uses: [...app.uses, { id: makeId(), night, tool, at: localClock(now) }].slice(-SLEEP_LIMITS.uses) };
}

/** The tools tried on a night, in the order they were first used. */
export const toolsTried = (app: Pick<SleepApp, "uses">, night: string) => app.uses.filter((u) => u.night === night).map((u) => u.tool);

/** If last night has tools tried and no check-in yet, the night to ask about. */
export function pendingReview(app: Pick<SleepApp, "uses" | "reviews">, now: Date = new Date()): string | null {
  const night = reviewNight(now);
  if (!night || app.reviews.some((r) => r.night === night)) return null;
  return toolsTried(app, night).length ? night : null;
}

/** The app with a night's check-in saved (replacing any earlier one for that night). */
export function saveReview(app: SleepApp, night: string, fell: SleepReview["fell"], helped: string[], makeId: () => string): SleepApp {
  const kept = [...new Set(helped.map(toolId).filter(Boolean))];
  return { ...app, reviews: [...app.reviews.filter((r) => r.night !== night), { id: makeId(), night, fell, helped: kept }].slice(-SLEEP_LIMITS.reviews) };
}

/** What works for this person: each tool they said helped, with how often it helped out of the
 *  checked-in nights it was tried on. Best first: most nights helped, then the steadiest. */
export function whatWorks(app: Pick<SleepApp, "uses" | "reviews">): { tool: string; helped: number; tried: number }[] {
  const reviewed = new Map(app.reviews.map((r) => [r.night, r]));
  const tally = new Map<string, { helped: number; tried: number }>();
  const seen = new Set<string>();
  for (const u of app.uses) {
    const r = reviewed.get(u.night);
    const key = `${u.night}|${u.tool}`;
    if (!r || seen.has(key)) continue;
    seen.add(key);
    const t = tally.get(u.tool) ?? { helped: 0, tried: 0 };
    t.tried++;
    if (r.helped.includes(u.tool)) t.helped++;
    tally.set(u.tool, t);
  }
  // A tool marked as helping on a night it wasn't recorded (added by hand) still counts once.
  for (const r of app.reviews) for (const tool of r.helped) {
    const key = `${r.night}|${tool}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const t = tally.get(tool) ?? { helped: 0, tried: 0 };
    t.tried++; t.helped++;
    tally.set(tool, t);
  }
  return [...tally.entries()].map(([tool, t]) => ({ tool, ...t })).filter((x) => x.helped > 0)
    .sort((a, b) => b.helped - a.helped || (b.helped + 1) / (b.tried + 2) - (a.helped + 1) / (a.tried + 2) || a.tool.localeCompare(b.tool));
}

// ── The bedtime plan ─────────────────────────────────────────────────────────

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (m: number) => { const x = ((Math.round(m) % 1440) + 1440) % 1440; return `${pad(Math.floor(x / 60))}:${pad(x % 60)}`; };

/** Hours between bedtime and wake time, across midnight. */
export function hoursBetween(bed: string, wake: string): number {
  let m = toMin(wake) - toMin(bed);
  if (m <= 0) m += 1440;
  return Math.round((m / 60) * 10) / 10;
}

export type PlanItem = { id: string; at: string; title: string; detail: string };

/** The day worked backward from bedtime, and forward from waking. Each time comes from the
 *  research cited in the app's Learn tab. */
export function planTimeline(bed: string, wake: string): PlanItem[] {
  const b = toMin(bed), w = toMin(wake);
  return [
    { id: "caffeine", at: fromMin(b - 9 * 60), title: "Last caffeine", detail: "Coffee, tea, soda and energy drinks. A cup of coffee needs about 9 hours to stop costing you sleep." },
    { id: "dinner", at: fromMin(b - 3 * 60), title: "Finish dinner", detail: "Big meals done 2 to 3 hours before bed. A small snack later is fine." },
    { id: "shower", at: fromMin(b - 90), title: "Warm shower or bath", detail: "1 to 2 hours before bed. Cooling off afterward tells your body it's time to sleep." },
    { id: "workout", at: fromMin(b - 60), title: "Hard workouts finished", detail: "Evening exercise is fine; just finish anything intense about an hour before bed." },
    { id: "dim", at: fromMin(b - 60), title: "Dim the lights", detail: "Overhead lights off, lamps low and warm. Phone brightness down." },
    { id: "wind-down", at: fromMin(b - 45), title: "Start winding down", detail: "Set an alarm for this one. Brush teeth, change, and start your checklist." },
    { id: "write", at: fromMin(b - 15), title: "Write tomorrow's list", detail: "Five minutes. Get tomorrow out of your head and onto paper." },
    { id: "bed", at: fromMin(b), title: "Lights out", detail: "Start a sound or a story, switch on Lights out, and let your phone go dark." },
    { id: "wake", at: fromMin(w), title: "Wake up", detail: "The same time every day, weekends too. This anchors your whole body clock." },
    { id: "light", at: fromMin(w + 30), title: "Get morning light", detail: "Ten to thirty minutes outside, or by a bright window. It helps you get sleepy earlier tonight." },
  ];
}
