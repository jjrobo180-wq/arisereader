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

/**
 * The agenda: events (already in order) grouped by day. With `only`, it is that one day's agenda
 * and nothing from any other day.
 */
export function agendaDays<T extends CalEvent>(sorted: T[], only?: string): { date: string; events: T[] }[] {
  const groups: { date: string; events: T[] }[] = [];
  for (const event of sorted) {
    if (only && event.date !== only) continue;
    if (groups[groups.length - 1]?.date === event.date) groups[groups.length - 1].events.push(event);
    else groups.push({ date: event.date, events: [event] });
  }
  return groups;
}

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

/** One timed event placed on the day's timeline. Events that overlap sit side by side in `lanes` columns. */
export type DayBlock<T> = { event: T; start: number; end: number; lane: number; lanes: number };
export type DayTimeline<T> = { from: number; to: number; allDay: T[]; blocks: DayBlock<T>[] };

/**
 * One day laid out against the clock, for the timeline view. It runs over the teacher's usual day
 * (`hours`), stretched to whole hours and to fit anything earlier or later. Times are minutes into the day.
 * An event with no end time is drawn as an hour; a very short one is drawn as half an hour so it can be read.
 */
export function dayTimeline<T extends CalEvent>(events: T[], date: string, hours: { from: string; to: string }): DayTimeline<T> {
  const todays = events.filter((e) => e.date === date);
  const allDay = todays.filter((e) => mins(e.start) === null);
  const timed = todays.filter((e) => mins(e.start) !== null).map((event) => {
    const start = mins(event.start)!;
    const end = mins(event.end);
    return { event, start, end: Math.min(1440, Math.max(end !== null && end > start ? end : start + 60, start + 30)) };
  }).sort((a, b) => a.start - b.start || b.end - a.end);

  let from = mins(hours.from) ?? 450, to = mins(hours.to) ?? 960;
  if (to <= from) { from = 450; to = 960; }
  for (const t of timed) { from = Math.min(from, t.start); to = Math.max(to, t.end); }
  from = Math.floor(from / 60) * 60;
  to = Math.min(1440, Math.max(Math.ceil(to / 60) * 60, from + 60));

  // Events that touch in time form a group; within a group each takes the first free column.
  const blocks: DayBlock<T>[] = [];
  let group: DayBlock<T>[] = [], laneEnds: number[] = [], groupEnd = -1;
  const close = () => { for (const b of group) b.lanes = laneEnds.length; group = []; laneEnds = []; };
  for (const t of timed) {
    if (group.length && t.start >= groupEnd) close();
    let lane = laneEnds.findIndex((end) => end <= t.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = t.end;
    groupEnd = Math.max(groupEnd, t.end);
    const block = { ...t, lane, lanes: 1 };
    group.push(block); blocks.push(block);
  }
  close();
  return { from, to, allDay, blocks };
}
