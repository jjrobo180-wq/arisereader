// Reminders in the Arise To Duo iPhone app (plugin: @capacitor/local-notifications). The website sends
// LifeHub and WorkHub reminders by Web Push, which an App Store app can't receive. In the app the
// same reminders are worked out on the phone (shared/todoReminders.ts and shared/hubReminders.ts,
// the exact rules the server uses) and handed to iOS as scheduled notifications for the next
// 24 hours. They're worked out again whenever the hub changes, so a checked-off task or a logged
// meal stops its reminder.
import { dueHubReminders, type HubReminder } from "@shared/hubReminders";
import { dueTodoReminders } from "@shared/todoReminders";
import type { Workspace } from "@shared/teacherHub";
import { hasNativePlugin, isNativeApp, nativeCall, nativeListen, notificationHash } from "@/lib/nativeApp";
import { startApplePush, stopApplePush } from "@/lib/applePush";

export type ReminderKind = "life" | "work";
const PLUGIN = /localnotif/i;
const NAME = "LocalNotifications";
const STEP_MS = 5 * 60_000;
/** Three days ahead, so reminders keep coming even if the app isn't opened for a day or two. */
const AHEAD_MS = 72 * 3600_000;
/** iOS keeps at most 64 waiting notifications for an app; the two hubs share them. */
const MOST_PER_KIND = 30;

const flagKey = (kind: ReminderKind) => `arise_native_reminders:${kind}`;
/** One switch for both hubs (LifeHub and WorkHub start out the same; October 2026). */
const BOTH_KEY = "arise_native_reminders";
const idsKey = (kind: ReminderKind) => `arise_native_reminder_ids:${kind}`;
const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* not kept; asks again */ } },
  drop: (k: string) => { try { localStorage.removeItem(k); } catch { /* nothing kept */ } },
};
const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };

/** The notification sound. iOS plays no sound for a scheduled notification unless one is named, and
 *  the file has to be inside the app: arisetodo/ios-app/sounds/ is copied into it by configure-ios.py. */
export const CHIME = "arise-chime.wav";
const SOUND_KEY = "arise_native_sound";
/** On unless the person turned it off (Settings, Reminders). */
export const nativeSoundOn = (): boolean => store.get(SOUND_KEY) !== "0";
export function setNativeSound(on: boolean): void {
  store.set(SOUND_KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(REMINDERS_CHANGED)); // schedules again with, or without, the sound
}
/** Spread into a scheduled notification to give it the sound (or nothing, when sound is off). */
export const soundField = (): { sound?: string } => (nativeSoundOn() ? { sound: nativeSoundFile() } : {});

/** The sounds in the app (arisetodo/ios-app/sounds/*.wav, all copied in by add-sound.py). */
export const REMINDER_SOUNDS = [
  { file: CHIME, name: "Chime" }, { file: "arise-bell.wav", name: "Bell" }, { file: "arise-glass.wav", name: "Glass" },
  { file: "arise-marimba.wav", name: "Marimba" }, { file: "arise-pulse.wav", name: "Pulse" }, { file: "arise-soft.wav", name: "Soft" },
] as const;
const SOUND_NAME_KEY = "arise_native_sound_file";
/** The one picked in Settings, or the chime. */
export const nativeSoundFile = (): string => { const v = store.get(SOUND_NAME_KEY); return REMINDER_SOUNDS.some((x) => x.file === v) ? (v as string) : CHIME; };
export function setNativeSoundFile(file: string): void {
  if (!REMINDER_SOUNDS.some((x) => x.file === file)) return;
  store.set(SOUND_NAME_KEY, file);
  window.dispatchEvent(new Event(REMINDERS_CHANGED)); // every reminder is scheduled again with the new sound
}

/** True in an app build that can schedule notifications. */
export const nativeRemindersAvailable = (): boolean => hasNativePlugin(PLUGIN);
/** True inside the app at all (so the website's "add to Home Screen" steps are never shown there). */
export const inApp = isNativeApp;
export const nativeRemindersOn = (kind: ReminderKind) => store.get(BOTH_KEY) === "1" || (store.get(BOTH_KEY) !== "0" && store.get(flagKey(kind)) === "1");

const call = (method: string, options?: unknown) => nativeCall(PLUGIN, NAME, method, options).catch((e: any) => {
  const msg = String(e?.message || e || "");
  if (/not implemented|unimplemented|plugin/i.test(msg)) throw new Error("Reminders aren't in this version of the app yet. Update Arise To Duo, then try again.");
  throw new Error(msg || "Reminders didn't answer. Try again.");
});

/** A notification id iOS can keep (a positive 31-bit number) that's the same for the same reminder. */
export function reminderId(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 1) || 1;
}

export type PlannedReminder = HubReminder & { at: number };
/** Every reminder due from `from` to `from + ahead`, at the five-minute step it first comes due,
 *  exactly as the server's every-few-minutes check would send them. News headlines are left out
 *  (the server writes those). */
export function planReminders(kind: ReminderKind, workspace: unknown, from: number, timeZone: string, ahead = AHEAD_MS): PlannedReminder[] {
  const sent: Record<string, unknown> = {};
  const out: PlannedReminder[] = [];
  const start = Math.ceil(from / STEP_MS) * STEP_MS;
  for (let t = start; t <= from + ahead; t += STEP_MS) {
    const due: (HubReminder & { news?: unknown })[] = kind === "life" ? dueTodoReminders(workspace, t, timeZone, sent) : dueHubReminders(workspace as Workspace, t, timeZone, sent);
    for (const r of due) {
      sent[r.key] = t;
      if (!r.news) out.push({ ...r, at: t });
    }
  }
  return out;
}

/** Seconds between reminders that come due at the same moment, so they arrive one by one. */
export const SAME_TIME_GAP_MS = 20_000;
/** What iOS is handed. Each reminder gets its own thread, so iOS shows them as separate notifications
 *  instead of stacking them into one, and reminders due at the same moment are spaced a little apart. */
export function nativeNotifications(kind: ReminderKind, plan: PlannedReminder[]) {
  const seen = new Map<number, number>();
  return plan.map((r) => {
    const n = seen.get(r.at) ?? 0;
    seen.set(r.at, n + 1);
    return {
      id: reminderId(`${kind}:${r.key}`), title: r.title, body: r.body, threadIdentifier: `${kind}:${r.key}`,
      schedule: { at: new Date(r.at + n * SAME_TIME_GAP_MS), allowWhileIdle: true }, extra: { url: r.url }, ...soundField(),
    };
  });
}

/** Asks iOS to allow notifications and turns reminders on, for LifeHub and WorkHub both. */
export async function turnOnNativeReminders(_kind?: ReminderKind): Promise<void> {
  const res = await call("requestPermissions");
  if (String(res?.display ?? "") !== "granted") throw new Error("Notifications are off for Arise To Duo. Turn them on in Settings → Notifications → Arise To Duo, then try again.");
  store.set(BOTH_KEY, "1");
  void startApplePush(true); // messages and shares from the server, too
  window.dispatchEvent(new Event(REMINDERS_CHANGED));
}

export async function turnOffNativeReminders(_kind?: ReminderKind): Promise<void> {
  store.set(BOTH_KEY, "0");
  void stopApplePush();
  store.drop(flagKey("life")); store.drop(flagKey("work"));
  await cancelScheduled("life"); await cancelScheduled("work");
  window.dispatchEvent(new Event(REMINDERS_CHANGED));
}
/** Fired when reminders are turned on or off, so both hubs schedule (or clear) theirs at once. */
export const REMINDERS_CHANGED = "arise:reminders-changed";

/** What iPhone says about notifications for this app: allowed, denied, or not asked yet. */
export async function nativeReminderPermission(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  try { const r = await call("checkPermissions"); const d = String(r?.display ?? ""); return d === "granted" || d === "denied" ? d : d.startsWith("prompt") ? "prompt" : "unknown"; } catch { return "unknown"; }
}

let tapsInstalled = false;
/** Tapping a reminder opens the screen it's about (its `url`). */
export function installReminderTaps(): void {
  if (tapsInstalled || !isNativeApp()) return;
  tapsInstalled = true;
  // Sign this iPhone up with the server again (the token can change) whenever iOS already allows notifications,
  // not only when reminders are on: messages, shares and Accountability ("she did it") come from the server.
  // Nothing is asked here; startApplePush(false) only goes ahead if notifications are already allowed.
  void startApplePush(false);
  try {
    void nativeListen("LocalNotifications", "localNotificationActionPerformed", (e: any) => {
      const url = String(e?.notification?.extra?.url || "");
      if (!url) return;
      const hash = notificationHash(url);
      if (hash !== null) window.location.hash = hash;
    });
  } catch { /* no listener here */ }
}

async function cancelScheduled(kind: ReminderKind) {
  let ids: number[] = [];
  try { ids = JSON.parse(store.get(idsKey(kind)) || "[]"); } catch { ids = []; }
  if (ids.length) await call("cancel", { notifications: ids.map((id) => ({ id })) }).catch(() => {});
  store.drop(idsKey(kind));
}

/** Puts this hub's reminders for the next day and a half in place of the ones scheduled before. */
export async function scheduleNativeReminders(kind: ReminderKind, workspace: unknown): Promise<number> {
  if (!nativeRemindersOn(kind) || !nativeRemindersAvailable()) return 0;
  const now = Date.now();
  const plan = planReminders(kind, workspace, now + 60_000, zone()).slice(0, MOST_PER_KIND);
  await cancelScheduled(kind);
  if (!plan.length) return 0;
  const notifications = nativeNotifications(kind, plan);
  await call("schedule", { notifications });
  store.set(idsKey(kind), JSON.stringify(notifications.map((n) => n.id)));
  return notifications.length;
}

/** A test notification a few seconds from now. */
export async function sendNativeTest(): Promise<void> {
  await call("schedule", { notifications: [{ id: reminderId(`test:${Date.now()}`), title: "Arise To Duo", body: "Reminders are working on this iPhone.", schedule: { at: new Date(Date.now() + 5000) }, ...soundField() }] });
}

/** Signing out: every reminder scheduled on this iPhone is taken away, so the next account never sees the last one's. */
export async function cancelAllNativeReminders(): Promise<void> {
  if (!nativeRemindersAvailable()) return;
  try {
    const pending = await nativeCall(PLUGIN, NAME, "getPending");
    const ids = (Array.isArray(pending?.notifications) ? pending.notifications : []).map((n: any) => ({ id: Number(n?.id) })).filter((n: { id: number }) => Number.isFinite(n.id));
    if (ids.length) await nativeCall(PLUGIN, NAME, "cancel", { notifications: ids });
  } catch { /* signing out always works */ }
}
