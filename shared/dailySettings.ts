// Daily check-ins' settings, kept with LifeHub's data (family.daily, shared/familyHub.ts) so they sync to every
// device and the reminder senders (shared/todoReminders.ts, on the server and on the phone) can read them.
// The check-ins themselves are worked out from the plugins (shared/dailyCheckins.ts); this only holds what the
// person changed: what's hidden, the times, which ones remind them, and today's done list for the reminders.

/** A check-in someone made themselves ("Walk the dog", "Feed the fish"). In FamilyHub everyone in the family
 *  sees the same ones and can add, change, tick and remove them. `days` are weekdays (0 = Sunday). */
export type CustomCheckin = { id: string; title: string; time: string; days: number[]; by: string };

export type DailySettings = {
  /** Show check-ins in the task list at all. */
  on: boolean;
  /** Check-ins hidden from the list (by id). */
  off: string[];
  /** Times picked for check-ins, "HH:MM" by id (anything not here uses its plugin's time or the default). */
  times: Record<string, string>;
  /** Reminders for check-ins with a time. */
  remind: boolean;
  /** Check-ins that don't send a reminder (by id). */
  mute: string[];
  /** What was done on one day (the phone writes it as things are logged), so a reminder isn't sent for
   *  something already done even when it was logged in Cooked, which the reminder senders can't see. */
  done?: { date: string; ids: string[] };
  /** Check-ins turned on that are off by default (a snack, a workout on a day off), by id. */
  extra: string[];
  /** Check-ins made by hand. */
  custom: CustomCheckin[];
  /** Who ticked a hand-made check-in: day -> check-in id -> their name ("" when it's just you). */
  log: Record<string, Record<string, string>>;
};

export const DAILY_LIMITS = { ids: 200, idLength: 80, custom: 60, title: 80, logDays: 60 };
export const emptyDaily = (): DailySettings => ({ on: true, off: [], times: {}, remind: true, mute: [], extra: [], custom: [], log: {} });
/** Settings as the code expects them, whatever was saved: anything missing (saved by an older version, before
 *  hand-made check-ins existed) is filled in, so reading them can never fail. */
export function fillDaily(s: Partial<DailySettings> | null | undefined): DailySettings {
  const e = emptyDaily();
  if (!s || typeof s !== "object") return e;
  const arr = <T,>(v: unknown, d: T[]): T[] => (Array.isArray(v) ? v as T[] : d);
  const obj = <T,>(v: unknown, d: T): T => (v && typeof v === "object" && !Array.isArray(v) ? v as T : d);
  return { ...e, ...s, on: s.on !== false, remind: s.remind !== false, off: arr(s.off, e.off), mute: arr(s.mute, e.mute), extra: arr(s.extra, e.extra), custom: arr(s.custom, e.custom), times: obj(s.times, e.times), log: obj(s.log, e.log) };
}

const ID = /^[a-z]{2,12}:[A-Za-z0-9_@:.-]{1,66}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ids = (v: unknown): string[] => [...new Set((Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string" && x.length <= DAILY_LIMITS.idLength && ID.test(x)))].slice(0, DAILY_LIMITS.ids);

export function cleanDaily(raw: unknown): DailySettings | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const times: Record<string, string> = {};
  if (r.times && typeof r.times === "object") {
    for (const [k, v] of Object.entries(r.times as Record<string, unknown>).slice(0, DAILY_LIMITS.ids)) if (ID.test(k) && k.length <= DAILY_LIMITS.idLength && typeof v === "string" && CLOCK.test(v)) times[k] = v;
  }
  const d = r.done as Record<string, unknown> | undefined;
  const done = d && typeof d.date === "string" && DAY.test(d.date) ? { date: d.date, ids: ids(d.ids) } : undefined;
  return {
    on: r.on !== false,
    off: ids(r.off),
    times,
    remind: r.remind !== false,
    mute: ids(r.mute),
    extra: ids(r.extra),
    custom: (Array.isArray(r.custom) ? r.custom : []).flatMap((x: any): CustomCheckin[] => {
      const title = typeof x?.title === "string" ? x.title.replace(/\s+/g, " ").trim().slice(0, DAILY_LIMITS.title) : "";
      const id = typeof x?.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(x.id) ? x.id : "";
      if (!title || !id) return [];
      const days = [...new Set((Array.isArray(x.days) ? x.days : []).filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))].sort() as number[];
      return [{ id, title, time: typeof x.time === "string" && CLOCK.test(x.time) ? x.time : "", days: days.length ? days : [0, 1, 2, 3, 4, 5, 6], by: typeof x.by === "string" ? x.by.slice(0, 60) : "" }];
    }).filter((c, i, all) => all.findIndex((o) => o.id === c.id) === i).slice(0, DAILY_LIMITS.custom),
    log: (() => {
      const out: Record<string, Record<string, string>> = {};
      const raw = r.log && typeof r.log === "object" ? r.log as Record<string, unknown> : {};
      for (const day of Object.keys(raw).filter((k) => DAY.test(k)).sort().slice(-DAILY_LIMITS.logDays)) {
        const row: Record<string, string> = {};
        const v = raw[day];
        if (v && typeof v === "object") for (const [k, who] of Object.entries(v as Record<string, unknown>).slice(0, DAILY_LIMITS.ids)) if (/^[A-Za-z0-9_-]{1,40}$/.test(k)) row[k] = typeof who === "string" ? who.slice(0, 60) : "";
        if (Object.keys(row).length) out[day] = row;
      }
      return out;
    })(),
    ...(done ? { done } : {}),
  };
}
