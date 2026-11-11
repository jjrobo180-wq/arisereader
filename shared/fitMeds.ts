// Cooked "Medicine tracker" plugin: medicines and vitamins with their dose times and days, today's
// doses to tick off (or skip), the last week at a glance and a supply count that warns before it runs out.
// Kept with the rest of a person's Cooked data (shared/fit.ts). The screen is client/src/pages/fit/FitMeds.tsx.

export type FitMed = {
  id: string; name: string; dose: string;
  /** Dose times as "08:00". */
  times: string[];
  /** Days of the week it's taken on (0 = Sunday). */
  days: number[];
  note: string;
  /** Pills left; counts down as doses are ticked off. null = not counted. */
  supply: number | null;
  /** Warn when this many days of pills are left. */
  refillDays: number;
  /** Phone reminder at each dose time. */
  remind: boolean;
  color: string;
};
export type DoseStatus = "taken" | "skipped";
export type Meds = {
  list: FitMed[];
  /** day -> "medId@time" -> what happened. */
  log: Record<string, Record<string, DoseStatus>>;
};

export const MED_COLORS = ["#60a5fa", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#fb923c", "#f87171", "#2dd4bf"];
export const MED_LIMITS = { meds: 20, times: 4, days: 400 };
export const emptyMeds = (): Meds => ({ list: [], log: {} });

const str = (v: unknown, n: number) => (typeof v === "string" ? v.trimStart().replace(/ {2,}$/, "").slice(0, n) : "");
const isDay = (k: string) => /^\d{4}-\d{2}-\d{2}$/.test(k);
const clock = (t: unknown) => (typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : "");

export function cleanMeds(raw: any): Meds | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const list: FitMed[] = (Array.isArray(raw.list) ? raw.list : []).slice(0, MED_LIMITS.meds).filter((m: any) => m && typeof m.id === "string" && str(m.name, 80)).map((m: any, i: number): FitMed => {
    const times = [...new Set((Array.isArray(m.times) ? m.times : []).map(clock).filter(Boolean) as string[])].sort().slice(0, MED_LIMITS.times);
    const days = [...new Set((Array.isArray(m.days) ? m.days : []).map(Number).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() as number[];
    const supply = m.supply === null || m.supply === undefined || m.supply === "" ? null : Math.max(0, Math.min(9999, Math.round(Number(m.supply)) || 0));
    return {
      id: str(m.id, 40), name: str(m.name, 80), dose: str(m.dose, 40), times: times.length ? times : ["08:00"], days: days.length ? days : [0, 1, 2, 3, 4, 5, 6],
      note: str(m.note, 200), supply, refillDays: Math.max(1, Math.min(60, Math.round(Number(m.refillDays)) || 7)), remind: m.remind !== false,
      color: typeof m.color === "string" && /^#[0-9a-f]{6}$/i.test(m.color) ? m.color : MED_COLORS[i % MED_COLORS.length],
    };
  });
  const log: Meds["log"] = {};
  const days = Object.keys(raw.log && typeof raw.log === "object" ? raw.log : {}).filter(isDay).sort().slice(-MED_LIMITS.days);
  for (const k of days) {
    const row: Record<string, DoseStatus> = {};
    for (const [slot, s] of Object.entries(raw.log[k] || {})) if ((s === "taken" || s === "skipped") && /^[^@]{1,40}@\d\d:\d\d$/.test(slot)) row[slot] = s as DoseStatus;
    if (Object.keys(row).length) log[k] = row;
  }
  return list.length || Object.keys(log).length ? { list, log } : undefined;
}

export const slotKey = (medId: string, time: string) => `${medId}@${time}`;
const dow = (day: string) => new Date(`${day}T12:00:00`).getDay();

export type Dose = { med: FitMed; time: string; status: DoseStatus | null };
/** Every dose due on a day, in time order, with what happened to it. */
export function dosesOn(m: Meds | undefined, day: string): Dose[] {
  const meds = m ?? emptyMeds();
  const out: Dose[] = [];
  for (const med of meds.list) if (med.days.includes(dow(day))) for (const time of med.times) out.push({ med, time, status: meds.log[day]?.[slotKey(med.id, time)] ?? null });
  return out.sort((a, b) => a.time.localeCompare(b.time) || a.med.name.localeCompare(b.med.name));
}

/** Tick a dose taken or skipped (null clears it). Taking a dose uses up one pill; undoing it gives it back. */
export function markDose(m: Meds | undefined, medId: string, day: string, time: string, status: DoseStatus | null): Meds {
  const cur = m ?? emptyMeds();
  const key = slotKey(medId, time), before = cur.log[day]?.[key] ?? null;
  if (before === status) return cur;
  const row = { ...(cur.log[day] || {}) };
  if (status) row[key] = status; else delete row[key];
  const log = { ...cur.log, [day]: row };
  if (!Object.keys(row).length) delete log[day];
  const delta = (status === "taken" ? 1 : 0) - (before === "taken" ? 1 : 0);
  const list = delta ? cur.list.map((x) => (x.id === medId && x.supply !== null ? { ...x, supply: Math.max(0, x.supply - delta) } : x)) : cur.list;
  return { list, log };
}

/** Doses taken out of doses due across the last `days` days up to and including `today` (a day with nothing due counts as nothing). */
export function adherence(m: Meds | undefined, today: string, days = 7): { taken: number; due: number; pct: number } {
  let taken = 0, due = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    for (const x of dosesOn(m, key)) { due++; if (x.status === "taken") taken++; }
  }
  return { taken, due, pct: due ? Math.round((taken / due) * 100) : 0 };
}

/** Doses a medicine uses in an average day. */
export const dosesPerDay = (med: FitMed) => (med.times.length * med.days.length) / 7;
/** Days of pills left, or null when the supply isn't counted. */
export function daysLeft(med: FitMed): number | null {
  if (med.supply === null) return null;
  const per = dosesPerDay(med);
  return per > 0 ? Math.floor(med.supply / per) : null;
}
export const needsRefill = (med: FitMed) => { const d = daysLeft(med); return d !== null && d <= med.refillDays; };
