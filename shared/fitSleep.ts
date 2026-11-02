// Arise Fit: sleep. One record per night (the morning you woke up), the time you went to bed and woke,
// and an optional 1-5 rating. A night in progress is kept as `asleepAt` until you tap "I'm awake".
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export type SleepNight = { date: string; bed: number; wake: number; q?: number };
export type Sleep = { goalH: number; nights: SleepNight[]; asleepAt?: number };

export const SLEEP_MAX = 400;
const MIN_MS = 30 * 60_000, MAX_MS = 20 * 3_600_000;
const num = (v: unknown, lo: number, hi: number, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

export function cleanSleep(raw: any): Sleep | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const byDate = new Map<string, SleepNight>();
  for (const n of (Array.isArray(raw.nights) ? raw.nights : []).slice(-SLEEP_MAX * 2)) {
    const bed = Number(n?.bed), wake = Number(n?.wake);
    if (!Number.isFinite(bed) || !Number.isFinite(wake) || wake - bed < MIN_MS || wake - bed > MAX_MS) continue;
    const date = dayKey(new Date(wake));
    byDate.set(date, { date, bed, wake, ...(n?.q ? { q: Math.round(num(n.q, 1, 5, 3)) } : {}) });
  }
  const nights = [...byDate.values()].sort((a, b) => a.wake - b.wake).slice(-SLEEP_MAX);
  const asleepAt = Number(raw.asleepAt);
  const out: Sleep = { goalH: num(raw.goalH, 4, 12, 8), nights };
  if (Number.isFinite(asleepAt) && asleepAt > 0 && Date.now() - asleepAt < MAX_MS) out.asleepAt = asleepAt;
  if (!nights.length && !out.asleepAt && out.goalH === 8) return undefined;
  return out;
}

export const nightHours = (n: SleepNight) => (n.wake - n.bed) / 3_600_000;
export const emptySleep = (): Sleep => ({ goalH: 8, nights: [] });

/** Adds a night, replacing any other night that ends the same day. */
export function addNight(s: Sleep | undefined, bed: number, wake: number, q?: number): Sleep {
  const base = s ?? emptySleep();
  const date = dayKey(new Date(wake));
  return { ...base, asleepAt: undefined, nights: [...base.nights.filter((n) => n.date !== date), { date, bed, wake, ...(q ? { q } : {}) }].sort((a, b) => a.wake - b.wake) };
}

/** The last `days` days (oldest first) with hours slept, or null for a night with no record. */
export function lastDays(s: Sleep | undefined, days = 7): { date: string; h: number | null }[] {
  const by = new Map((s?.nights ?? []).map((n) => [n.date, nightHours(n)]));
  const t = new Date(); t.setHours(12, 0, 0, 0);
  const out: { date: string; h: number | null }[] = [];
  for (let i = days - 1; i >= 0; i--) { const d = new Date(t); d.setDate(t.getDate() - i); const k = dayKey(d); out.push({ date: k, h: by.get(k) ?? null }); }
  return out;
}

export function sleepStats(s: Sleep | undefined, days = 7) {
  const got = lastDays(s, days).filter((d) => d.h != null) as { date: string; h: number }[];
  const goal = s?.goalH ?? 8;
  const avg = got.length ? got.reduce((a, d) => a + d.h, 0) / got.length : 0;
  const debt = got.reduce((a, d) => a + Math.max(0, goal - d.h), 0);
  const hit = got.filter((d) => d.h >= goal - 0.25).length;
  return { avg, debt, hit, n: got.length, goal };
}
