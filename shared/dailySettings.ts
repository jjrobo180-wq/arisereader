// Daily check-ins' settings, kept with LifeHub's data (family.daily, shared/familyHub.ts) so they sync to every
// device and the reminder senders (shared/todoReminders.ts, on the server and on the phone) can read them.
// The check-ins themselves are worked out from the plugins (shared/dailyCheckins.ts); this only holds what the
// person changed: what's hidden, the times, which ones remind them, and today's done list for the reminders.

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
};

export const DAILY_LIMITS = { ids: 200, idLength: 80 };
export const emptyDaily = (): DailySettings => ({ on: true, off: [], times: {}, remind: true, mute: [], extra: [] });

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
    ...(done ? { done } : {}),
  };
}
