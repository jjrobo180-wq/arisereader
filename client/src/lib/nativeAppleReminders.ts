// Apple Reminders in the Arise To Duo iPhone app, read straight from the phone (plugin:
// @ebarooni/capacitor-calendar, the same one as the iPhone Calendar). No Shortcut, no link to copy:
// once someone says yes, the reminders that aren't done come into LifeHub → Tasks (a "Reminders"
// list) each time the app opens. Checking one off is kept in step both ways.
// The website can't reach Apple Reminders, so it keeps the Shortcut way (teacher-hub/HubApple.tsx).
import { hasNativePlugin, isNativeApp, nativeCall } from "@/lib/nativeApp";

const PLUGIN = /calendar/i;
const NAME = "CapacitorCalendar";
const ON_KEY = "arise-apple-reminders-on";
const SEEN_KEY = "arise-apple-reminders-seen";

/** Fired once Reminders are connected (from the first-run setup or the Reminders card), so LifeHub reads them at once. */
export const REMINDERS_CONNECTED = "arise:apple-reminders-connected";

export type PhoneReminder = { key: string; title: string; due: string; time: string; notes: string; done: boolean };

const pad = (n: number) => String(n).padStart(2, "0");
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* not kept */ } },
};

/** In the iPhone app, with the plugin that reads Reminders. */
export const appleRemindersAvailable = (): boolean => isNativeApp() && hasNativePlugin(PLUGIN);
/** This person turned it on, on this phone. */
export const appleRemindersOn = (): boolean => store.get(ON_KEY) === "1";

/** Asks iOS for Reminders (its own prompt). Throws a sentence to show when it's not allowed. */
export async function connectAppleReminders(): Promise<void> {
  if (!appleRemindersAvailable()) throw new Error("Apple Reminders connect in the Arise To Duo iPhone app.");
  const res = await nativeCall(PLUGIN, NAME, "requestFullRemindersAccess");
  if (String(res?.result ?? "") !== "granted") throw new Error("Reminders are off for Arise To Duo. Turn them on in Settings → Privacy & Security → Reminders, then try again.");
  store.set(ON_KEY, "1");
  window.dispatchEvent(new Event(REMINDERS_CONNECTED));
}

export function disconnectAppleReminders(): void { store.set(ON_KEY, "0"); }

/** Every reminder on the phone, from every list (done ones too, so a check-off is kept in step). */
export async function readAppleReminders(): Promise<PhoneReminder[]> {
  const lists = await nativeCall(PLUGIN, NAME, "getRemindersLists");
  const ids: string[] = (Array.isArray(lists?.result) ? lists.result : []).map((l: any) => String(l?.id || "")).filter(Boolean);
  if (!ids.length) return [];
  const res = await nativeCall(PLUGIN, NAME, "getRemindersFromLists", { listIds: ids });
  const raw: any[] = Array.isArray(res?.result) ? res.result : [];
  return raw.filter((r) => r && typeof r.id === "string" && String(r.title || "").trim()).slice(0, 500).map((r) => {
    const ms = typeof r.dueDate === "number" ? r.dueDate : null;
    const d = ms ? new Date(ms) : null;
    // A reminder set for a day without a time comes back at midnight: that's a day, not a time.
    const timed = !!d && (d.getHours() !== 0 || d.getMinutes() !== 0);
    return {
      key: String(r.id).slice(0, 94),
      title: String(r.title).trim().slice(0, 200),
      due: d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "",
      time: timed && d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "",
      notes: String(r.notes || "").slice(0, 2000),
      done: r.isCompleted === true,
    };
  });
}

/** Checks a reminder off (or back on) in the Reminders app too, when it's checked in the hub. */
export async function setAppleReminderDone(key: string, done: boolean): Promise<void> {
  if (!appleRemindersAvailable() || !appleRemindersOn()) return;
  await nativeCall(PLUGIN, NAME, "modifyReminder", { id: key, isCompleted: done, completionDate: done ? Date.now() : null }).catch(() => { /* changed again next time */ });
}

/** Ids already brought in once: a task deleted in the hub isn't brought back while it's still in Reminders. */
export function seenReminders(): Set<string> {
  try { return new Set(JSON.parse(store.get(SEEN_KEY) || "[]")); } catch { return new Set(); }
}
export function rememberReminders(keys: Iterable<string>): void {
  store.set(SEEN_KEY, JSON.stringify([...new Set([...seenReminders(), ...keys])].slice(-2000)));
}
