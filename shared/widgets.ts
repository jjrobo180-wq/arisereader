// Widgets: a board of small live things on Home, added from the Plugin Store in WorkHub and LifeHub.
// Clocks, calendars, countdowns, fun ones and focus tools, each in any theme and in three sizes.
// This file is the catalog, the themes, the saved shape (cleaned like everything else) and the
// time math, so it can all be tested. The screens are client/src/components/widgets/.

// ── Themes ───────────────────────────────────────────────────────────────────

export type WidgetTheme = {
  id: string; name: string;
  /** Background (a colour or a gradient), text, quieter text, accent, and a border. */
  bg: string; fg: string; sub: string; accent: string; border: string;
  /** A soft second surface inside the widget (calendar cells, buttons). */
  soft: string;
  font: "sans" | "serif" | "mono" | "rounded";
  /** Neon glow on big text. */
  glow?: boolean;
  dark: boolean;
};

export const WIDGET_THEMES: readonly WidgetTheme[] = [
  { id: "classic", name: "Classic", bg: "#ffffff", fg: "#0f172a", sub: "#64748b", accent: "#2563eb", border: "#e2e8f0", soft: "#f1f5f9", font: "sans", dark: false },
  { id: "midnight", name: "Midnight", bg: "#0b1224", fg: "#f8fafc", sub: "#94a3b8", accent: "#38bdf8", border: "#1e293b", soft: "#162036", font: "sans", dark: true },
  { id: "arise", name: "Arise", bg: "linear-gradient(135deg,#7c3aed 0%,#c026d3 55%,#06b6d4 100%)", fg: "#ffffff", sub: "#ede9fe", accent: "#fde68a", border: "transparent", soft: "rgba(255,255,255,.16)", font: "rounded", dark: true },
  { id: "paper", name: "Paper", bg: "#fbf6ea", fg: "#3b2f2a", sub: "#8a7560", accent: "#b4542d", border: "#e9dcc2", soft: "#f3ead6", font: "serif", dark: false },
  { id: "neon", name: "Neon", bg: "#07060f", fg: "#f5d0fe", sub: "#a78bfa", accent: "#22d3ee", border: "#2e1065", soft: "#140f2b", font: "sans", glow: true, dark: true },
  { id: "pastel", name: "Pastel", bg: "#f6f1ff", fg: "#4c1d95", sub: "#8b7bb8", accent: "#ec4899", border: "#e9ddff", soft: "#ece3ff", font: "rounded", dark: false },
  { id: "ocean", name: "Ocean", bg: "linear-gradient(160deg,#0e7490 0%,#1e3a8a 100%)", fg: "#ecfeff", sub: "#a5f3fc", accent: "#67e8f9", border: "transparent", soft: "rgba(255,255,255,.14)", font: "sans", dark: true },
  { id: "sunset", name: "Sunset", bg: "linear-gradient(160deg,#fb923c 0%,#db2777 100%)", fg: "#fff7ed", sub: "#ffe4e6", accent: "#fef08a", border: "transparent", soft: "rgba(255,255,255,.18)", font: "rounded", dark: true },
  { id: "forest", name: "Forest", bg: "#13301f", fg: "#ecfccb", sub: "#a7c4a0", accent: "#a3e635", border: "#1f4a30", soft: "#1c3f29", font: "serif", dark: true },
  { id: "terminal", name: "Terminal", bg: "#141210", fg: "#fbbf24", sub: "#a16207", accent: "#fde68a", border: "#292524", soft: "#1f1b17", font: "mono", glow: true, dark: true },
  { id: "bold", name: "Bold", bg: "#ffffff", fg: "#000000", sub: "#3f3f46", accent: "#ef4444", border: "#000000", soft: "#f4f4f5", font: "sans", dark: false },
];
export const themeOf = (id: string | undefined): WidgetTheme => WIDGET_THEMES.find((t) => t.id === id) ?? WIDGET_THEMES[0];

// ── Catalog ──────────────────────────────────────────────────────────────────

export type WidgetGroup = "Clocks" | "Calendars" | "Countdowns" | "Fun" | "Focus";
export const WIDGET_GROUPS: readonly WidgetGroup[] = ["Clocks", "Calendars", "Countdowns", "Fun", "Focus"];
export type WidgetSize = "small" | "wide" | "large";
export const WIDGET_SIZES: { id: WidgetSize; label: string }[] = [{ id: "small", label: "Small" }, { id: "wide", label: "Wide" }, { id: "large", label: "Large" }];

/** What a widget can be set up with. */
export type WidgetOption = "label" | "date" | "tz" | "tz3" | "workday" | "bells" | "text" | "minutes" | "dice";

export type WidgetDef = {
  id: string; name: string; group: WidgetGroup; blurb: string;
  /** The size and theme it starts with. */
  size: WidgetSize; theme: string;
  options: WidgetOption[];
  /** A serious one for work, a fun one, or good for both. Shown as a hint in the gallery. */
  mood: "fun" | "serious" | "both";
};

export const WIDGET_DEFS: readonly WidgetDef[] = [
  // Clocks
  { id: "analog", name: "Classic clock", group: "Clocks", blurb: "A clock face with numbers and a sweeping second hand.", size: "small", theme: "classic", options: [], mood: "both" },
  { id: "analog-minimal", name: "Minimal clock", group: "Clocks", blurb: "Clean tick marks, thin hands, no numbers.", size: "small", theme: "midnight", options: [], mood: "serious" },
  { id: "flip", name: "Flip clock", group: "Clocks", blurb: "Big split-flap digits, like an old train station.", size: "wide", theme: "midnight", options: [], mood: "both" },
  { id: "digital", name: "Digital clock", group: "Clocks", blurb: "Hours, minutes and seconds with the date.", size: "wide", theme: "classic", options: [], mood: "serious" },
  { id: "neon", name: "Neon clock", group: "Clocks", blurb: "A glowing sign that tells the time.", size: "wide", theme: "neon", options: [], mood: "fun" },
  { id: "word", name: "Word clock", group: "Clocks", blurb: "The time in words: “It's quarter past four.”", size: "wide", theme: "paper", options: [], mood: "fun" },
  { id: "binary", name: "Binary clock", group: "Clocks", blurb: "The time in lights. Can you read it?", size: "small", theme: "terminal", options: [], mood: "fun" },
  { id: "world", name: "World clock", group: "Clocks", blurb: "The time in another city.", size: "small", theme: "ocean", options: ["tz"], mood: "serious" },
  { id: "world3", name: "Three cities", group: "Clocks", blurb: "Three cities side by side, with day or night.", size: "wide", theme: "classic", options: ["tz3"], mood: "serious" },
  { id: "headline", name: "Big date & time", group: "Clocks", blurb: "Today's date set like a magazine cover.", size: "wide", theme: "bold", options: [], mood: "serious" },
  // Calendars
  { id: "month", name: "Month calendar", group: "Calendars", blurb: "This month at a glance. Flip to other months.", size: "large", theme: "classic", options: [], mood: "serious" },
  { id: "tearoff", name: "Tear-off calendar", group: "Calendars", blurb: "A desk calendar page for today.", size: "small", theme: "classic", options: [], mood: "both" },
  { id: "week", name: "Week strip", group: "Calendars", blurb: "This week's seven days, today lit up.", size: "wide", theme: "pastel", options: [], mood: "both" },
  { id: "year-dots", name: "Year in dots", group: "Calendars", blurb: "Every day of the year as a dot. The filled ones are behind you.", size: "large", theme: "midnight", options: [], mood: "both" },
  { id: "date-facts", name: "Date facts", group: "Calendars", blurb: "Day of the year, week number, quarter and days left.", size: "wide", theme: "classic", options: [], mood: "serious" },
  // Countdowns & progress
  { id: "countdown", name: "Countdown", group: "Countdowns", blurb: "Days until something you're waiting for.", size: "small", theme: "arise", options: ["label", "date"], mood: "both" },
  { id: "since", name: "Days since", group: "Countdowns", blurb: "Days since something happened.", size: "small", theme: "forest", options: ["label", "date"], mood: "both" },
  { id: "day-ring", name: "Day ring", group: "Countdowns", blurb: "How much of today has gone by, in a ring.", size: "small", theme: "sunset", options: [], mood: "both" },
  { id: "progress", name: "Progress bars", group: "Countdowns", blurb: "Today, this week, this month and this year so far.", size: "wide", theme: "classic", options: [], mood: "serious" },
  { id: "workday", name: "Work or school day", group: "Countdowns", blurb: "How far through the day you are, and time left.", size: "wide", theme: "midnight", options: ["label", "workday"], mood: "serious" },
  { id: "bells", name: "Next bell", group: "Countdowns", blurb: "Minutes until the next bell, class or break.", size: "small", theme: "bold", options: ["bells"], mood: "serious" },
  { id: "season", name: "Season", group: "Countdowns", blurb: "The season now and days until the next one.", size: "small", theme: "pastel", options: [], mood: "fun" },
  // Fun
  { id: "moon", name: "Moon phase", group: "Fun", blurb: "Tonight's moon and how full it is.", size: "small", theme: "midnight", options: [], mood: "fun" },
  { id: "dice", name: "Dice", group: "Fun", blurb: "Tap to roll one or two dice.", size: "small", theme: "classic", options: ["dice"], mood: "fun" },
  { id: "coin", name: "Coin flip", group: "Fun", blurb: "Heads or tails? Tap to flip.", size: "small", theme: "paper", options: [], mood: "fun" },
  { id: "emoji", name: "Emoji of the day", group: "Fun", blurb: "A new emoji and a word to match, every day.", size: "small", theme: "pastel", options: [], mood: "fun" },
  { id: "fortune", name: "Fortune of the day", group: "Fun", blurb: "A friendly little fortune each day.", size: "wide", theme: "sunset", options: [], mood: "fun" },
  { id: "color", name: "Color of the day", group: "Fun", blurb: "A new color each day, with its name and code.", size: "small", theme: "classic", options: [], mood: "fun" },
  { id: "hourglass", name: "Hourglass", group: "Fun", blurb: "Sand falling through this hour.", size: "small", theme: "paper", options: [], mood: "fun" },
  { id: "decide", name: "Decision ball", group: "Fun", blurb: "Ask a yes-or-no question and tap for an answer.", size: "small", theme: "neon", options: [], mood: "fun" },
  // Focus
  { id: "stopwatch", name: "Stopwatch", group: "Focus", blurb: "Start, stop and laps.", size: "small", theme: "classic", options: [], mood: "serious" },
  { id: "timer", name: "Timer", group: "Focus", blurb: "A countdown timer with a chime.", size: "small", theme: "midnight", options: ["minutes"], mood: "serious" },
  { id: "note", name: "Note", group: "Focus", blurb: "A short note pinned to Home.", size: "small", theme: "paper", options: ["text"], mood: "both" },
  { id: "one-thing", name: "Today's one thing", group: "Focus", blurb: "The one thing that matters most today. Tick it off.", size: "wide", theme: "bold", options: ["text"], mood: "serious" },
];
export const widgetDef = (id: string) => WIDGET_DEFS.find((d) => d.id === id);

/** Cities for the world clocks: a name and its time zone. */
export const WIDGET_CITIES: readonly { tz: string; city: string }[] = [
  { tz: "America/New_York", city: "New York" }, { tz: "America/Chicago", city: "Chicago" }, { tz: "America/Denver", city: "Denver" },
  { tz: "America/Phoenix", city: "Phoenix" }, { tz: "America/Los_Angeles", city: "Los Angeles" }, { tz: "America/Anchorage", city: "Anchorage" },
  { tz: "Pacific/Honolulu", city: "Honolulu" }, { tz: "America/Puerto_Rico", city: "San Juan" }, { tz: "America/Mexico_City", city: "Mexico City" },
  { tz: "America/Toronto", city: "Toronto" }, { tz: "America/Sao_Paulo", city: "São Paulo" }, { tz: "Europe/London", city: "London" },
  { tz: "Europe/Paris", city: "Paris" }, { tz: "Europe/Berlin", city: "Berlin" }, { tz: "Europe/Madrid", city: "Madrid" },
  { tz: "Africa/Lagos", city: "Lagos" }, { tz: "Africa/Cairo", city: "Cairo" }, { tz: "Africa/Nairobi", city: "Nairobi" },
  { tz: "Asia/Dubai", city: "Dubai" }, { tz: "Asia/Kolkata", city: "Mumbai" }, { tz: "Asia/Manila", city: "Manila" },
  { tz: "Asia/Shanghai", city: "Beijing" }, { tz: "Asia/Seoul", city: "Seoul" }, { tz: "Asia/Tokyo", city: "Tokyo" },
  { tz: "Australia/Sydney", city: "Sydney" }, { tz: "Pacific/Auckland", city: "Auckland" },
];
export const cityOf = (tz: string | undefined) => WIDGET_CITIES.find((c) => c.tz === tz)?.city ?? "";

// ── Saved widgets ────────────────────────────────────────────────────────────

export type WidgetItem = {
  id: string; type: string; theme: string; size: WidgetSize;
  label?: string; date?: string; tz?: string; tzs?: string[];
  start?: string; end?: string; bells?: string; text?: string; minutes?: number; dice?: number;
  /** "Today's one thing": the day it was ticked off. */
  doneOn?: string;
};
export const MAX_WIDGETS = 24;

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T12:00:00Z`));
const isTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const isCity = (v: unknown): v is string => typeof v === "string" && WIDGET_CITIES.some((c) => c.tz === v);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, "").slice(0, max) : "");

/** Saved widgets made safe: known types, themes and sizes only, values capped, at most 24. */
export function cleanWidgets(raw: unknown): WidgetItem[] {
  if (!Array.isArray(raw)) return [];
  const out: WidgetItem[] = [];
  const seen = new Set<string>();
  for (const r of raw.slice(0, MAX_WIDGETS * 2)) {
    if (!r || typeof r !== "object" || Array.isArray(r)) continue;
    const def = widgetDef(String((r as any).type));
    const id = text((r as any).id, 60);
    if (!def || !id || seen.has(id)) continue;
    const x = r as Record<string, unknown>;
    const item: WidgetItem = {
      id, type: def.id,
      theme: WIDGET_THEMES.some((t) => t.id === x.theme) ? String(x.theme) : def.theme,
      size: WIDGET_SIZES.some((s) => s.id === x.size) ? (x.size as WidgetSize) : def.size,
    };
    if (def.options.includes("label") && text(x.label, 60)) item.label = text(x.label, 60);
    if (def.options.includes("date") && isDate(x.date)) item.date = x.date;
    if (def.options.includes("tz") && isCity(x.tz)) item.tz = x.tz;
    if (def.options.includes("tz3") && Array.isArray(x.tzs)) item.tzs = x.tzs.filter(isCity).slice(0, 3);
    if (def.options.includes("workday")) { if (isTime(x.start)) item.start = x.start; if (isTime(x.end)) item.end = x.end; }
    if (def.options.includes("bells") && text(x.bells, 400)) item.bells = text(x.bells, 400);
    if (def.options.includes("text") && text(x.text, 280)) item.text = text(x.text, 280);
    if (def.options.includes("minutes") && typeof x.minutes === "number" && Number.isFinite(x.minutes)) item.minutes = Math.min(600, Math.max(1, Math.round(x.minutes)));
    if (def.options.includes("dice")) item.dice = x.dice === 2 ? 2 : 1;
    if (def.id === "one-thing" && isDate(x.doneOn)) item.doneOn = x.doneOn;
    seen.add(id);
    out.push(item);
    if (out.length >= MAX_WIDGETS) break;
  }
  return out;
}

/** A new widget of this kind, with its usual size and theme. */
export function newWidget(type: string, id: string, today: string): WidgetItem | null {
  const def = widgetDef(type);
  if (!def) return null;
  const item: WidgetItem = { id, type, theme: def.theme, size: def.size };
  if (type === "countdown") { item.label = "Summer break"; item.date = nextDate(today, 6, 1); }
  if (type === "since") { item.label = "Started reading every day"; item.date = today; }
  if (type === "world") item.tz = "Europe/London";
  if (type === "world3") item.tzs = ["America/New_York", "Europe/London", "Asia/Tokyo"];
  if (type === "workday") { item.label = "School day"; item.start = "08:00"; item.end = "15:00"; }
  if (type === "bells") item.bells = "8:00, 8:50, 9:40, 10:30, 11:20, 12:10, 12:40, 1:30, 2:20, 3:00";
  if (type === "timer") item.minutes = 5;
  if (type === "dice") item.dice = 1;
  if (type === "note") item.text = "Tap ✎ to write a note.";
  if (type === "one-thing") item.text = "";
  return item;
}

// ── Time math ────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
/** "2026-10-11" for a Date, in local time. */
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (key: string) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d); };
/** Whole days from one date to another (local calendar days). */
export function daysBetween(from: string, to: string): number {
  if (!isDate(from) || !isDate(to)) return 0;
  return Math.round((Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86_400_000);
}
/** The next time this month and day comes around, today included. */
export function nextDate(today: string, month: number, day: number): string {
  const y = +today.slice(0, 4);
  const thisYear = `${y}-${pad(month)}-${pad(day)}`;
  return thisYear >= today ? thisYear : `${y + 1}-${pad(month)}-${pad(day)}`;
}

/** Hands of an analog clock, in degrees. */
export function handAngles(d: Date) {
  const s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
  return { hour: h * 30, minute: m * 6, second: s * 6 };
}

const HOURS = ["twelve", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven"];
/** The time in words, to the nearest five minutes: "It's quarter past four." */
export function timeInWords(d: Date): string {
  let m = Math.round((d.getMinutes() + d.getSeconds() / 60) / 5) * 5, h = d.getHours();
  if (m === 60) { m = 0; h += 1; }
  const hour = (x: number) => HOURS[((x % 12) + 12) % 12];
  const next = hour(h + 1), cur = hour(h);
  const special = m === 0 && (h % 24 === 0 ? "midnight" : h % 24 === 12 ? "noon" : null);
  if (special) return `It's ${special}.`;
  const phrase: Record<number, string> = {
    0: `${cur} o'clock`, 5: `five past ${cur}`, 10: `ten past ${cur}`, 15: `quarter past ${cur}`, 20: `twenty past ${cur}`, 25: `twenty-five past ${cur}`,
    30: `half past ${cur}`, 35: `twenty-five to ${next}`, 40: `twenty to ${next}`, 45: `quarter to ${next}`, 50: `ten to ${next}`, 55: `five to ${next}`,
  };
  return `It's ${phrase[m]}.`;
}

/** The six digits of HH:MM:SS (24-hour) as lights: each digit's four bits, most significant first. */
export function binaryDigits(d: Date): boolean[][] {
  const digits = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`.split("").map(Number);
  return digits.map((n) => [8, 4, 2, 1].map((b) => (n & b) !== 0));
}

/** The time in another city: "3:42 PM", the weekday, and whether it is night there. */
export function timeIn(tz: string, now: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", weekday: "short", hour12: true }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const hour24 = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now));
    return { time: `${get("hour")}:${get("minute")} ${get("dayPeriod")}`.trim(), weekday: get("weekday"), night: hour24 < 6 || hour24 >= 19, hour24 };
  } catch {
    return { time: "", weekday: "", night: false, hour24: 0 };
  }
}

/** Hours a city is ahead (+) or behind (−) this device, as text: "+7 hrs", "same time", "−1½ hrs". */
export function offsetFromHere(tz: string, now: Date): string {
  try {
    const there = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    const here = new Date(now.toLocaleString("en-US"));
    const mins = Math.round((there.getTime() - here.getTime()) / 60000 / 15) * 15;
    if (!mins) return "same time";
    const h = Math.abs(mins) / 60, whole = Math.floor(h), frac = h - whole;
    const num = `${whole || ""}${frac === 0.5 ? "½" : frac === 0.25 ? "¼" : frac === 0.75 ? "¾" : ""}` || "0";
    return `${mins > 0 ? "+" : "−"}${num} hr${h === 1 ? "" : "s"}`;
  } catch { return ""; }
}

/** The weeks of a month for a calendar grid, Sunday first. Days outside the month are null. */
export function monthGrid(year: number, month0: number): (number | null)[][] {
  const first = new Date(year, month0, 1).getDay();
  const days = new Date(year, month0 + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Day of the year, 1 to 366. */
export const dayOfYear = (key: string) => daysBetween(`${key.slice(0, 4)}-01-01`, key) + 1;
export const daysInYear = (year: number) => ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365);

/** ISO 8601 week number (weeks start Monday; week 1 holds the year's first Thursday). */
export function isoWeek(key: string): number {
  const d = new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** How far through the day, week (Monday to Sunday), month and year this moment is, 0 to 1. */
export function progressOf(now: Date) {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayFrac = (now.getTime() - dayStart.getTime()) / 86_400_000;
  const weekFrac = (((now.getDay() + 6) % 7) + dayFrac) / 7;
  const monthDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthFrac = (now.getDate() - 1 + dayFrac) / monthDays;
  const yearFrac = (dayOfYear(dayKey(now)) - 1 + dayFrac) / daysInYear(now.getFullYear());
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  return { day: clamp(dayFrac), week: clamp(weekFrac), month: clamp(monthFrac), year: clamp(yearFrac) };
}

const toMin = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
/** How far through a work or school day: before it starts, during (with the share done and minutes left), or over. */
export function workdayState(now: Date, start = "08:00", end = "15:00") {
  const s = isTime(start) ? toMin(start) : 480, e = isTime(end) ? toMin(end) : 900;
  const m = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  if (e <= s) return { state: "off" as const, frac: 0, left: 0, until: 0 };
  if (m < s) return { state: "before" as const, frac: 0, left: e - s, until: Math.ceil(s - m) };
  if (m >= e) return { state: "after" as const, frac: 1, left: 0, until: 0 };
  return { state: "during" as const, frac: (m - s) / (e - s), left: Math.ceil(e - m), until: 0 };
}

/**
 * Bell times from what a teacher types: "8:00, 8:50 9:40 1:05 2:30pm". A time with no am or pm
 * and an hour from 1 to 6 is afternoon, the way school schedules are written. Sorted, no repeats.
 */
export function parseBells(textIn: string | undefined): number[] {
  const out = new Set<number>();
  for (const m of String(textIn || "").matchAll(/(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?/gi)) {
    let h = +m[1];
    const min = +m[2], ap = (m[3] || "").toLowerCase().replace(/\./g, "");
    if (h > 23 || min > 59) continue;
    if (ap === "pm" && h < 12) h += 12;
    else if (ap === "am" && h === 12) h = 0;
    else if (!ap && h >= 1 && h <= 6) h += 12;
    out.add(h * 60 + min);
  }
  return [...out].sort((a, b) => a - b);
}
/** The next bell after now: its time and the minutes until it. null when the day's bells are done. */
export function nextBell(bells: number[], now: Date) {
  const m = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const i = bells.findIndex((b) => b > m);
  if (i < 0) return null;
  const at = bells[i];
  return { at, label: minutesToClock(at), minutes: Math.ceil(at - m), index: i + 1, total: bells.length };
}
export const minutesToClock = (min: number) => { const h = Math.floor(min / 60) % 24, m = min % 60; return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`; };

/** Northern-hemisphere seasons by their usual start dates, and days until the next one. */
export function seasonOf(key: string) {
  const y = +key.slice(0, 4);
  const starts = [
    { name: "Winter", emoji: "❄️", date: `${y - 1}-12-21` }, { name: "Spring", emoji: "🌷", date: `${y}-03-20` }, { name: "Summer", emoji: "☀️", date: `${y}-06-21` },
    { name: "Fall", emoji: "🍂", date: `${y}-09-22` }, { name: "Winter", emoji: "❄️", date: `${y}-12-21` }, { name: "Spring", emoji: "🌷", date: `${y + 1}-03-20` },
  ];
  let i = starts.length - 2;
  while (i > 0 && starts[i].date > key) i--;
  const now = starts[i], next = starts[i + 1];
  return { name: now.name, emoji: now.emoji, next: next.name, nextEmoji: next.emoji, daysToNext: daysBetween(key, next.date) };
}

const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14);
/** The moon on a date: how far through its cycle (0 new, 0.5 full), how lit up, and its name. */
export function moonPhase(when: Date) {
  const age = ((((when.getTime() - NEW_MOON_REF) / 86_400_000) % SYNODIC) + SYNODIC) % SYNODIC;
  const p = age / SYNODIC;
  const lit = (1 - Math.cos(2 * Math.PI * p)) / 2;
  const names: [number, string, string][] = [[0.0339, "New moon", "🌑"], [0.216, "Waxing crescent", "🌒"], [0.284, "First quarter", "🌓"], [0.466, "Waxing gibbous", "🌔"], [0.534, "Full moon", "🌕"], [0.716, "Waning gibbous", "🌖"], [0.784, "Last quarter", "🌗"], [0.966, "Waning crescent", "🌘"], [1.01, "New moon", "🌑"]];
  const [, name, emoji] = names.find(([upTo]) => p < upTo)!;
  const daysToFull = ((0.5 - p + 1) % 1) * SYNODIC;
  return { phase: p, lit, name, emoji, age, daysToFull: Math.round(daysToFull) };
}

/** A steady pick for a day: the same date always gives the same item. */
export function pickForDay<T>(list: readonly T[], key: string, salt = ""): T {
  let h = 2166136261;
  for (const c of key + salt) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return list[(h >>> 0) % list.length];
}

/** A countdown to a date: whole days, or hours and minutes when it's under two days away. */
export function countdownTo(date: string | undefined, now: Date) {
  if (!isDate(date)) return null;
  const target = fromKey(date);
  const ms = target.getTime() - now.getTime();
  const days = daysBetween(dayKey(now), date);
  if (days < 0) return { past: true, days: -days, hours: 0, minutes: 0, today: false };
  if (days === 0) return { past: false, days: 0, hours: 0, minutes: 0, today: true };
  return { past: false, days, hours: Math.max(0, Math.floor(ms / 3_600_000)), minutes: Math.max(0, Math.floor((ms % 3_600_000) / 60000)), today: false };
}

// ── Fun content ──────────────────────────────────────────────────────────────

export const DAY_EMOJIS: readonly [string, string][] = [
  ["🌻", "Sunny"], ["🚀", "Launch"], ["🐢", "Steady"], ["🎈", "Light"], ["🧩", "Curious"], ["🌊", "Flow"], ["🔥", "Fired up"], ["🍀", "Lucky"],
  ["🦉", "Wise"], ["🎨", "Creative"], ["🐝", "Busy"], ["🌈", "Hopeful"], ["⚡", "Electric"], ["🍋", "Zesty"], ["🧭", "Adventurous"], ["🪴", "Growing"],
  ["🎯", "Focused"], ["🐬", "Playful"], ["☕", "Cozy"], ["🦁", "Brave"], ["🌙", "Calm"], ["🎵", "Musical"], ["🍩", "Sweet"], ["🏔️", "Steady climb"],
  ["🌮", "Spicy"], ["🦋", "Changing"], ["📚", "Bookish"], ["🌟", "Shining"], ["🐙", "Multitasking"], ["🍉", "Refreshing"], ["🎉", "Celebrate"],
];

export const FORTUNES: readonly string[] = [
  "A small kindness you do today will come back around.", "Something you've been putting off will turn out easier than you think.",
  "Today is a good day to learn one new thing.", "Your next good idea is hiding in a conversation. Ask a question.",
  "A friend is thinking of you right now.", "The best part of today hasn't happened yet.", "Patience today saves you time tomorrow.",
  "You'll laugh hard at something today.", "Say yes to one small adventure.", "A tidy desk will tidy your thoughts.",
  "Someone needs the encouragement only you can give.", "The answer you're looking for starts with a walk outside.",
  "Today, finishing beats perfect.", "Good news is on its way.", "You'll find something you thought was lost.",
  "A book will surprise you soon.", "Your effort is noticed, even when no one says so.", "Lucky numbers: 3, 14 and the number of smiles you share.",
  "Rest is part of the plan today.", "You are one step closer than you were yesterday.", "Try the snack you've never tried.",
  "Your curiosity will lead somewhere good.", "A thank-you note will make two people happy.", "Today's challenge is tomorrow's story.",
];

export const DAY_COLORS: readonly { name: string; hex: string }[] = [
  { name: "Tangerine", hex: "#f28c28" }, { name: "Seafoam", hex: "#71eeb8" }, { name: "Cobalt", hex: "#0047ab" }, { name: "Marigold", hex: "#eaa221" },
  { name: "Lavender", hex: "#b57edc" }, { name: "Coral", hex: "#ff7f50" }, { name: "Sage", hex: "#9caf88" }, { name: "Crimson", hex: "#dc143c" },
  { name: "Teal", hex: "#008080" }, { name: "Mustard", hex: "#e1ad01" }, { name: "Periwinkle", hex: "#8c9eff" }, { name: "Plum", hex: "#8e4585" },
  { name: "Mint", hex: "#98ff98" }, { name: "Terracotta", hex: "#e2725b" }, { name: "Sky", hex: "#87ceeb" }, { name: "Emerald", hex: "#50c878" },
  { name: "Blush", hex: "#de5d83" }, { name: "Indigo", hex: "#4b0082" }, { name: "Sunflower", hex: "#ffc512" }, { name: "Slate", hex: "#708090" },
  { name: "Turquoise", hex: "#40e0d0" }, { name: "Rust", hex: "#b7410e" }, { name: "Lilac", hex: "#c8a2c8" }, { name: "Olive", hex: "#808000" },
];

/** The decision ball's answers: some yes, some no, some maybe. */
export const DECISIONS: readonly string[] = [
  "Yes, go for it!", "Absolutely.", "Signs point to yes.", "Looks good to me.", "Definitely yes.", "You already know the answer is yes.",
  "Not today.", "Probably not.", "I'd wait on that.", "No, but ask again tomorrow.", "Nope.",
  "Maybe. Flip a coin too.", "Ask a friend first.", "Sleep on it.", "Try again in a minute.", "Could go either way!",
];
