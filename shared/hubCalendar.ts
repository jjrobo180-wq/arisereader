// Teacher Hub calendar: what is still ahead, the week and month grids, and open time.
import { cleanWeekly, type FreeWindow } from "./availability";

export type CalEvent = { id?: string; date: string; start: string; end: string };
export type Now = { date: string; minutes: number };

const TIME = /^(\d{1,2}):(\d{2})$/;
const mins = (hm: string) => { const m = TIME.exec(hm || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const pad = (n: number) => String(n).padStart(2, "0");
export const clockOf = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
export const shiftDay = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** The date and minutes-into-the-day of a moment on this device. */
export function nowParts(d = new Date()): Now {
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, minutes: d.getHours() * 60 + d.getMinutes() };
}

/** Over already? An earlier day is. Today it is once the end time has passed (an event with only a start counts as one hour). All-day events last all day. */
export function isPast(event: CalEvent, now: Now): boolean {
  if (event.date < now.date) return true;
  if (event.date > now.date) return false;
  const start = mins(event.start);
  if (start === null) return false;
  const end = mins(event.end);
  return (end !== null && end > start ? end : start + 60) <= now.minutes;
}

export const stillAhead = <T extends CalEvent>(events: T[], now: Now) => events.filter((e) => !isPast(e, now));

/** The seven days (Sunday first) of the week holding `date`. */
export function weekOf(date: string): string[] {
  const first = shiftDay(date, -weekdayOf(date));
  return Array.from({ length: 7 }, (_, i) => shiftDay(first, i));
}

/** Weeks of a month, Sunday first, padded with days of the neighbouring months. */
export function monthGrid(date: string): string[][] {
  const first = `${date.slice(0, 7)}-01`;
  const weeks: string[][] = [];
  let start = shiftDay(first, -weekdayOf(first));
  do {
    weeks.push(Array.from({ length: 7 }, (_, i) => shiftDay(start, i)));
    start = shiftDay(start, 7);
  } while (start.slice(0, 7) <= first.slice(0, 7) && weeks.length < 6);
  return weeks;
}

export const addMonthsTo = (date: string, n: number) => {
  const d = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

export type OpenRange = { start: string; end: string };

/**
 * Open time on one day: the weekly free times, minus timed events and (for today) time that has gone by.
 * Stretches under `least` minutes are left out. Events with no times don't block anything.
 */
export function openRanges(weekly: FreeWindow[], events: CalEvent[], date: string, now?: Now, least = 30): OpenRange[] {
  const dow = weekdayOf(date);
  let ranges: [number, number][] = cleanWeekly(weekly).filter((w) => w.day === dow).map((w) => [mins(w.start)!, mins(w.end)!] as [number, number]);
  if (now && date < now.date) return [];
  if (now && date === now.date) ranges = ranges.map(([a, b]) => [Math.max(a, Math.ceil(now.minutes / 15) * 15), b] as [number, number]);
  for (const e of events.filter((x) => x.date === date)) {
    const s = mins(e.start);
    if (s === null) continue;
    const t = mins(e.end);
    const end = t !== null && t > s ? t : s + 60;
    ranges = ranges.flatMap(([a, b]) => (end <= a || s >= b ? [[a, b] as [number, number]] : [[a, Math.min(b, s)] as [number, number], [Math.max(a, end), b] as [number, number]]));
  }
  return ranges.filter(([a, b]) => b - a >= least).sort((x, y) => x[0] - y[0]).map(([a, b]) => ({ start: clockOf(a), end: clockOf(b) }));
}
