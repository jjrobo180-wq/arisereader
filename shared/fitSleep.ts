// Arise Fit: sleep. One record per night (the morning you woke up): when you went to bed and woke, how
// it was tracked, the time spent in each sleep stage when Apple Health has it, and an optional 1-5
// rating. Nights come from Apple Health (an Apple Watch, the iPhone's Sleep schedule or any sleep app
// that writes to Health), from your bedtime schedule (confirmed in the morning), from a guess based on
// when you put your phone down and picked it up, from the "Going to sleep" button, or typed in. Naps
// are kept apart. A night in progress is kept as `asleepAt` until you tap "I'm awake".
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export type SleepSource = "health" | "schedule" | "phone" | "button" | "manual" | "pillow";
/** Minutes in each stage (from Apple Health). `core` is Apple's light sleep. */
export type SleepStages = { deep: number; rem: number; core: number; awake: number };
export type SleepNight = { date: string; bed: number; wake: number; q?: number; src?: SleepSource; stages?: SleepStages;
  /** Minutes actually asleep, when known (Health); otherwise bed to wake counts. */
  asleepMin?: number };
export type Nap = { start: number; end: number };
/** Usual bedtime and wake time ("22:30", "06:30"). */
export type SleepSchedule = { bed: string; wake: string };
export type Sleep = { goalH: number; nights: SleepNight[]; asleepAt?: number; naps?: Nap[]; schedule?: SleepSchedule;
  /** Reminders: wind down before bed, and the morning check-in. */
  remind?: { windDown: boolean; morning: boolean };
  /** Nights the morning check-in was dismissed (date keys), so it doesn't ask again. */
  skipped?: string[] };

export const SLEEP_MAX = 400;
const MIN_MS = 30 * 60_000, MAX_MS = 20 * 3_600_000;
const SOURCES: SleepSource[] = ["health", "schedule", "phone", "button", "manual", "pillow"];
const num = (v: unknown, lo: number, hi: number, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const hhmm = (v: unknown) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) ? String(v) : "");

export function cleanSleep(raw: any): Sleep | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const byDate = new Map<string, SleepNight>();
  for (const n of (Array.isArray(raw.nights) ? raw.nights : []).slice(-SLEEP_MAX * 2)) {
    const bed = Number(n?.bed), wake = Number(n?.wake);
    if (!Number.isFinite(bed) || !Number.isFinite(wake) || wake - bed < MIN_MS || wake - bed > MAX_MS) continue;
    const date = dayKey(new Date(wake));
    const s = n?.stages;
    const stages = s && typeof s === "object" ? { deep: num(s.deep, 0, 900), rem: num(s.rem, 0, 900), core: num(s.core, 0, 1200), awake: num(s.awake, 0, 900) } : undefined;
    byDate.set(date, { date, bed, wake, ...(n?.q ? { q: Math.round(num(n.q, 1, 5, 3)) } : {}), ...(SOURCES.includes(n?.src) ? { src: n.src } : {}),
      ...(stages && stages.deep + stages.rem + stages.core > 0 ? { stages } : {}), ...(n?.asleepMin ? { asleepMin: Math.round(num(n.asleepMin, 10, 1200)) } : {}) });
  }
  const nights = [...byDate.values()].sort((a, b) => a.wake - b.wake).slice(-SLEEP_MAX);
  const asleepAt = Number(raw.asleepAt);
  const out: Sleep = { goalH: num(raw.goalH, 4, 12, 8), nights };
  if (Number.isFinite(asleepAt) && asleepAt > 0 && Date.now() - asleepAt < MAX_MS) out.asleepAt = asleepAt;
  const naps = (Array.isArray(raw.naps) ? raw.naps : []).slice(-200).map((x: any) => ({ start: Number(x?.start), end: Number(x?.end) }))
    .filter((x: Nap) => Number.isFinite(x.start) && Number.isFinite(x.end) && x.end - x.start >= 5 * 60_000 && x.end - x.start <= 4 * 3_600_000);
  if (naps.length) out.naps = naps;
  if (raw.schedule && hhmm(raw.schedule.bed) && hhmm(raw.schedule.wake)) out.schedule = { bed: hhmm(raw.schedule.bed), wake: hhmm(raw.schedule.wake) };
  if (raw.remind && typeof raw.remind === "object") out.remind = { windDown: !!raw.remind.windDown, morning: !!raw.remind.morning };
  const skipped = (Array.isArray(raw.skipped) ? raw.skipped : []).map(String).filter((k: string) => /^\d{4}-\d{2}-\d{2}$/.test(k)).slice(-14);
  if (skipped.length) out.skipped = skipped;
  if (!nights.length && !out.asleepAt && out.goalH === 8 && !naps.length && !out.schedule && !out.remind) return undefined;
  return out;
}

/** Hours of sleep in a night: time asleep when Health says, otherwise bed to wake. */
export const nightHours = (n: SleepNight) => (n.asleepMin ? n.asleepMin / 60 : (n.wake - n.bed) / 3_600_000);
export const emptySleep = (): Sleep => ({ goalH: 8, nights: [] });

/** Adds a night, replacing any other night that ends the same day. */
export function addNight(s: Sleep | undefined, bed: number, wake: number, q?: number, extra: { src?: SleepSource; stages?: SleepStages; asleepMin?: number } = {}): Sleep {
  const base = s ?? emptySleep();
  const date = dayKey(new Date(wake));
  const old = base.nights.find((n) => n.date === date);
  const night: SleepNight = { date, bed, wake, ...(q ?? old?.q ? { q: q ?? old?.q } : {}), ...(extra.src ? { src: extra.src } : {}), ...(extra.stages ? { stages: extra.stages } : {}), ...(extra.asleepMin ? { asleepMin: extra.asleepMin } : {}) };
  return { ...base, asleepAt: undefined, nights: [...base.nights.filter((n) => n.date !== date), night].sort((a, b) => a.wake - b.wake) };
}
/** Rates a saved night 1-5. */
export const rateNight = (s: Sleep | undefined, date: string, q: number): Sleep => {
  const base = s ?? emptySleep();
  return { ...base, nights: base.nights.map((n) => (n.date === date ? { ...n, q: Math.round(num(q, 1, 5, 3)) } : n)) };
};
export const addNap = (s: Sleep | undefined, start: number, end: number): Sleep => {
  const base = s ?? emptySleep();
  return { ...base, naps: [...(base.naps ?? []), { start, end }].sort((a, b) => a.start - b.start).slice(-200) };
};

/** The last `days` days (oldest first) with hours slept, or null for a night with no record. */
export function lastDays(s: Sleep | undefined, days = 7): { date: string; h: number | null }[] {
  const by = new Map((s?.nights ?? []).map((n) => [n.date, nightHours(n)]));
  const t = new Date(); t.setHours(12, 0, 0, 0);
  const out: { date: string; h: number | null }[] = [];
  for (let i = days - 1; i >= 0; i--) { const d = new Date(t); d.setDate(t.getDate() - i); const k = dayKey(d); out.push({ date: k, h: by.get(k) ?? null }); }
  return out;
}

/** Minutes past 6 PM (so 11 PM and 1 AM sit close together), for averaging bedtimes and wake times. */
const eveningMin = (t: number) => { const d = new Date(t); return ((d.getHours() - 18 + 24) % 24) * 60 + d.getMinutes(); };
const dayMin = (t: number) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };
const spread = (xs: number[]) => { if (xs.length < 2) return 0; const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length); };
/** A clock time from minutes after midnight ("10:42 PM"). */
export const clockOf = (min: number) => { const m = ((Math.round(min) % 1440) + 1440) % 1440; const h = Math.floor(m / 60); return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

export function sleepStats(s: Sleep | undefined, days = 7) {
  const got = lastDays(s, days).filter((d) => d.h != null) as { date: string; h: number }[];
  const goal = s?.goalH ?? 8;
  const avg = got.length ? got.reduce((a, d) => a + d.h, 0) / got.length : 0;
  const debt = got.reduce((a, d) => a + Math.max(0, goal - d.h), 0);
  const hit = got.filter((d) => d.h >= goal - 0.25).length;
  const dates = new Set(got.map((d) => d.date));
  const nights = (s?.nights ?? []).filter((n) => dates.has(n.date));
  const beds = nights.map((n) => eveningMin(n.bed)), wakes = nights.map((n) => dayMin(n.wake));
  const avgBed = beds.length ? beds.reduce((a, b) => a + b, 0) / beds.length + 18 * 60 : null;
  const avgWake = wakes.length ? wakes.reduce((a, b) => a + b, 0) / wakes.length : null;
  /** How much bedtime moves around, in minutes (under 30 is steady). */
  const bedSpread = Math.round(spread(beds));
  return { avg, debt, hit, n: got.length, goal, avgBed, avgWake, bedSpread };
}

/** A 0-100 score for one night: hours against your goal (60), deep and REM sleep or your rating (25),
 *  and going to bed near your usual time (15). */
export function sleepScore(n: SleepNight, s: Sleep | undefined): { score: number; parts: { label: string; got: number; of: number }[] } {
  const goal = s?.goalH ?? 8;
  const h = nightHours(n);
  const duration = Math.round(60 * Math.min(1, h / goal) ** 1.5);
  let quality: number;
  if (n.stages && n.stages.deep + n.stages.rem + n.stages.core > 0) {
    const asleep = n.stages.deep + n.stages.rem + n.stages.core;
    // Healthy adults: deep about 13-23% and REM about 20-25% of the night; waking a little is normal.
    const deep = Math.min(1, n.stages.deep / asleep / 0.15), rem = Math.min(1, n.stages.rem / asleep / 0.2);
    const awakePenalty = Math.min(1, n.stages.awake / Math.max(1, asleep + n.stages.awake) / 0.15);
    quality = Math.round(25 * (0.45 * deep + 0.45 * rem + 0.1 * (1 - awakePenalty)));
  } else quality = n.q ? Math.round((n.q / 5) * 25) : 18;
  const others = (s?.nights ?? []).filter((x) => x.date !== n.date).slice(-14).map((x) => eveningMin(x.bed));
  const usual = others.length ? others.reduce((a, b) => a + b, 0) / others.length : eveningMin(n.bed);
  const off = Math.abs(eveningMin(n.bed) - usual);
  const steady = Math.round(15 * Math.max(0, 1 - Math.max(0, off - 20) / 100));
  return { score: Math.min(100, duration + quality + steady), parts: [{ label: "Hours", got: duration, of: 60 }, { label: n.stages ? "Deep & REM" : "How rested", got: quality, of: 25 }, { label: "Steady bedtime", got: steady, of: 15 }] };
}
export const scoreWord = (x: number) => (x >= 85 ? "Excellent" : x >= 70 ? "Good" : x >= 55 ? "Fair" : "Poor");

/** Last night's times from a schedule ("22:30" to "06:30"), ending on the morning of `today`. */
export function scheduleNight(sc: SleepSchedule, today = new Date()): { bed: number; wake: number } {
  const [wh, wm] = sc.wake.split(":").map(Number), [bh, bm] = sc.bed.split(":").map(Number);
  const wake = new Date(today); wake.setHours(wh, wm, 0, 0);
  const bed = new Date(wake); bed.setHours(bh, bm, 0, 0);
  if (bed.getTime() >= wake.getTime()) bed.setDate(bed.getDate() - 1);
  return { bed: bed.getTime(), wake: wake.getTime() };
}

/** From the times the app went to the background and came back, a likely night: the phone was put down
 *  between 7 PM and 4 AM and picked up 3 to 14 hours later, between 4 AM and 2 PM. Falling asleep is
 *  counted as 15 minutes after putting it down. */
export function phoneNight(downAt: number, upAt: number): { bed: number; wake: number } | null {
  const gap = upAt - downAt;
  if (!(gap >= 3 * 3_600_000 && gap <= 14 * 3_600_000)) return null;
  const dh = new Date(downAt).getHours(), uh = new Date(upAt).getHours();
  if (!(dh >= 19 || dh < 4) || !(uh >= 4 && uh < 14)) return null;
  return { bed: downAt + 15 * 60_000, wake: upAt };
}

/** Apple Health sleep samples (stage, start, end) folded into one night ending today: the longest run
 *  of sleep with gaps under 90 minutes, stage minutes added up. */
export function healthNight(samples: { state: string; start: number; end: number }[], today = new Date()): { bed: number; wake: number; stages: SleepStages; asleepMin: number } | null {
  const noon = new Date(today); noon.setHours(14, 0, 0, 0);
  const from = noon.getTime() - 24 * 3_600_000;
  const xs = samples.filter((x) => x.end > from && x.start < noon.getTime() && x.end > x.start).sort((a, b) => a.start - b.start);
  if (!xs.length) return null;
  const groups: (typeof xs)[] = [];
  for (const x of xs) { const g = groups[groups.length - 1]; if (g && x.start - Math.max(...g.map((y) => y.end)) < 90 * 60_000) g.push(x); else groups.push([x]); }
  const span = (g: typeof xs) => Math.max(...g.map((y) => y.end)) - g[0].start;
  const g = groups.sort((a, b) => span(b) - span(a))[0];
  const stages: SleepStages = { deep: 0, rem: 0, core: 0, awake: 0 };
  let asleep = 0, inBedOnly = true;
  for (const x of g) {
    const m = (x.end - x.start) / 60_000;
    const st = x.state.toLowerCase();
    if (st === "deep") { stages.deep += m; asleep += m; inBedOnly = false; }
    else if (st === "rem") { stages.rem += m; asleep += m; inBedOnly = false; }
    else if (st === "light" || st === "core") { stages.core += m; asleep += m; inBedOnly = false; }
    else if (st === "asleep") { stages.core += m; asleep += m; inBedOnly = false; }
    else if (st === "awake") stages.awake += m;
  }
  const bed = g[0].start, wake = Math.max(...g.map((y) => y.end));
  if (wake - bed < MIN_MS) return null;
  // Only "in bed" samples (no stages): count the time in bed.
  if (inBedOnly) asleep = (wake - bed) / 60_000;
  const r = (v: number) => Math.round(v);
  const hasStages = stages.deep + stages.rem > 0;
  return { bed, wake, stages: hasStages ? { deep: r(stages.deep), rem: r(stages.rem), core: r(stages.core), awake: r(stages.awake) } : { deep: 0, rem: 0, core: 0, awake: 0 }, asleepMin: r(asleep) };
}

export const SOURCE_NAME: Record<SleepSource, string> = { health: "Apple Health", schedule: "Your schedule", phone: "Phone down", button: "Sleep button", manual: "Logged by hand", pillow: "Pillow tracking" };
