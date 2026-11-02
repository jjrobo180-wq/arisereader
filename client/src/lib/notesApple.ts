// Arise Notes in the iPhone app: the action items and dates a person checked can also go to the
// iPhone's own Reminders and Calendar apps (plugin: @ebarooni/capacitor-calendar, Apple's EventKit),
// alongside Arise To Duo. iOS asks once for each; nothing is read, only added.
import { hasNativePlugin, isNativeApp, nativeAppInfo, nativeCall } from "@/lib/nativeApp";

const PLUGIN = /calendar/i;
const NAME = "CapacitorCalendar";

/** In an iPhone app build that has the Reminders and Calendar plugin. */
export const appleAddAvailable = (): boolean => isNativeApp() && hasNativePlugin(PLUGIN);

const call = (method: string, options?: unknown) => nativeCall(PLUGIN, NAME, method, options).catch((e: any) => {
  const msg = String(e?.message || e || "");
  if (/not implemented|unimplemented|plugin/i.test(msg)) throw new Error(`Reminders and Calendar aren't in this version of ${nativeAppInfo().name} yet. Update the app, then try again.`);
  throw new Error(msg || "The iPhone didn't answer. Try again.");
});
const granted = (res: any) => String(res?.result ?? res ?? "") === "granted";

/** A to-do's due moment: its day and time, or 9:00 that morning when it has only a day. */
export function dueMs(due: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return null;
  const t = /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "09:00";
  const ms = new Date(`${due}T${t}:00`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** An event's start and end: an hour from its time, or the whole day when it has no time. */
export function eventSpan(date: string, time: string): { startDate: number; endDate: number; isAllDay: boolean } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const allDay = !/^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const start = new Date(`${date}T${allDay ? "00:00" : time}:00`).getTime();
  if (!Number.isFinite(start)) return null;
  return { startDate: start, endDate: start + (allDay ? 86_400_000 : 3_600_000), isAllDay: allDay };
}

/** Adds to-dos to Apple Reminders (the default list). Returns how many were added. */
export async function addToAppleReminders(tasks: { title: string; due: string; time: string; notes?: string }[]): Promise<number> {
  if (!tasks.length) return 0;
  if (!granted(await call("requestFullRemindersAccess"))) {
    throw new Error(`Reminders are off for ${nativeAppInfo().name}. Turn them on in Settings → Privacy & Security → Reminders, then try again.`);
  }
  let added = 0;
  for (const t of tasks) {
    const due = dueMs(t.due, t.time);
    await call("createReminder", { title: t.title.slice(0, 200), notes: t.notes || "", ...(due ? { dueDate: due, alerts: [0] } : {}) });
    added++;
  }
  return added;
}

/** Adds events to the iPhone's default calendar. Returns how many were added. */
export async function addToIphoneCalendar(events: { title: string; date: string; time: string; notes?: string }[]): Promise<number> {
  const list = events.map((e) => ({ e, span: eventSpan(e.date, e.time) })).filter((x) => x.span);
  if (!list.length) return 0;
  if (!granted(await call("requestWriteOnlyCalendarAccess")) && !granted(await call("requestFullCalendarAccess"))) {
    throw new Error(`Calendar access is off for ${nativeAppInfo().name}. Turn it on in Settings → Privacy & Security → Calendars, then try again.`);
  }
  let added = 0;
  for (const { e, span } of list) {
    await call("createEvent", { title: e.title.slice(0, 200), description: e.notes || "", ...span! });
    added++;
  }
  return added;
}
