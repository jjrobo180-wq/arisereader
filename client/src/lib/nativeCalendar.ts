// The iPhone's own Calendar inside the Arise To Duo app (plugin: @ebarooni/capacitor-calendar, using
// Apple's EventKit). Every calendar on the phone comes along: iCloud, Google, Outlook, Exchange and
// school accounts added in Settings → Calendar → Accounts. The website can't reach these, so the
// buttons only show in the app. Events read here are kept in the person's own WorkHub or LifeHub,
// the same way a calendar link's events are.
import { hasNativePlugin, isNativeApp, nativeCall } from "@/lib/nativeApp";

const PLUGIN = /calendar/i;
const NAME = "CapacitorCalendar";

/** Marks the connected calendar that is the iPhone's own (instead of a calendar link). */
export const IPHONE_CALENDAR_URL = "iphone:calendar";
export const isIphoneCalendar = (url: string | undefined | null) => !!url && url.startsWith("iphone:");

/** True in an app build that has the Calendar plugin. */
export const iphoneCalendarAvailable = (): boolean => hasNativePlugin(PLUGIN);
/** True in the app at all (an older build without the plugin says to update). */
export const inIphoneApp = isNativeApp;

const call = (method: string, options?: unknown) => nativeCall(PLUGIN, NAME, method, options).catch((e: any) => {
  const msg = String(e?.message || e || "");
  if (/not implemented|unimplemented|plugin/i.test(msg)) throw new Error("iPhone Calendar isn't in this version of the app yet. Update Arise To Duo, then try again.");
  throw new Error(msg || "The iPhone Calendar didn't answer. Try again.");
});

/** Asks iOS for access to the calendars. Throws with what to do when it's turned off. */
export async function askCalendarAccess(): Promise<void> {
  const res = await call("requestFullCalendarAccess");
  const state = String(res?.result ?? res ?? "");
  if (state !== "granted") throw new Error("Calendar access is off. Turn it on in Settings → Privacy & Security → Calendars → Arise To Duo, then try again.");
}

export type PhoneEvent = { title: string; date: string; start: string; end: string; location: string; notes: string };
const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Turns the plugin's events into the Hub's shape: a day, "HH:MM" times ("" for all day), one entry
 *  per day for something that runs over several days (up to two weeks). Sorted by day and time. */
export function toPhoneEvents(list: unknown): PhoneEvent[] {
  const out: PhoneEvent[] = [];
  for (const e of Array.isArray(list) ? list : []) {
    const r = e as any;
    const s = new Date(Number(r?.startDate)), en = new Date(Number(r?.endDate ?? r?.startDate));
    if (!Number.isFinite(+s)) continue;
    const title = String(r?.title || "Busy").trim().slice(0, 200) || "Busy";
    const location = String(r?.location || "").slice(0, 200), notes = String(r?.description || "").slice(0, 1000);
    const allDay = !!r?.isAllDay;
    // The last moment it covers: an end at midnight (or an all-day end) belongs to the day before.
    const last = new Date(Number.isFinite(+en) && +en > +s ? +en - 1 : +s);
    const days = Math.min(14, Math.max(0, Math.round((new Date(day(last) + "T12:00").getTime() - new Date(day(s) + "T12:00").getTime()) / 86_400_000)));
    for (let i = 0; i <= days; i++) {
      const d = new Date(s); d.setDate(d.getDate() + i);
      const end = Number.isFinite(+en) ? en : s;
      // All day: no times. One day: its times. Several days: from the start time on the first,
      // all day in between, until the end time on the last.
      const [start, finish] = allDay ? ["", ""] : days === 0 ? [hm(s), hm(end)] : i === 0 ? [hm(s), "23:59"] : i === days ? ["00:00", hm(end)] : ["", ""];
      out.push({ title, date: day(d), start, end: finish, location, notes });
    }
  }
  return out.sort((a, b) => (a.date + (a.start || "00:00")).localeCompare(b.date + (b.start || "00:00")));
}

/** The events on the phone's calendars from `back` days ago to `ahead` days from now. */
export async function readIphoneEvents(back = 30, ahead = 120): Promise<PhoneEvent[]> {
  await askCalendarAccess();
  const from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - back);
  const to = new Date(); to.setHours(23, 59, 59, 999); to.setDate(to.getDate() + ahead);
  const res = await call("listEventsInRange", { from: from.getTime(), to: to.getTime() });
  return toPhoneEvents(res?.result ?? res?.events ?? []);
}

/** Opens the iPhone's own "New Event" screen filled in with this event, to save it to a phone calendar. */
export async function addToIphoneCalendar(e: { title: string; date: string; start?: string; end?: string; location?: string; notes?: string }): Promise<void> {
  const allDay = !e.start;
  const start = new Date(`${e.date}T${e.start || "00:00"}:00`);
  const end = allDay ? new Date(new Date(`${e.date}T00:00:00`).getTime() + 86_400_000) : new Date(`${e.date}T${e.end && e.end > (e.start || "") ? e.end : e.start}:00`);
  if (!allDay && +end <= +start) end.setTime(+start + 60 * 60_000);
  await call("createEventWithPrompt", { title: e.title, startDate: +start, endDate: +end, isAllDay: allDay, location: e.location || "", description: e.notes || "" });
}
