// Potty Training on the phone: turning notifications on for this device, telling the server when the reminder timer
// ends (so a notification comes even with the app closed), and a "timer running" notification while it counts down.
// The server side is server/pottyTimers.ts; the rules are in shared/pro/potty/timerPush.ts.
// In the Arise To Duo iPhone app there is no Web Push: the phone itself schedules the timer's
// notifications (LocalNotifications), so they ring with the app closed and no server is needed.
import { API_BASE } from "@/lib/queryClient";
import { isNativeApp, nativeCall } from "@/lib/nativeApp";
import { nativeRemindersAvailable } from "@/lib/nativeReminders";
import { MAX_REPEATS, REPEAT_EVERY_MS, ringMessage } from "@shared/pro/potty/timerPush";

export type PushPhase = "checking" | "unsupported" | "install" | "off" | "on" | "blocked" | "unavailable";
export const LIVE_TAG = "potty-live";
export const RING_TAG = "potty-timer";
const URL_POTTY = "/#/pro?app=potty";

export const isApple = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isInstalled = () => (navigator as any).standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };
const capable = () => typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function keyBytes(text: string): Uint8Array {
  const padded = (text + "=".repeat((4 - (text.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function api(token: string | null, path: string, body?: unknown, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(`${API_BASE}${path}`, {
    method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong. Try again.");
  return data;
}

// ---- the iPhone app: notifications scheduled on the phone ----
const NATIVE = /localnotif/i;
const native = () => isNativeApp() && nativeRemindersAvailable();
const local = (method: string, options?: unknown) => nativeCall(NATIVE, "LocalNotifications", method, options);
/** Fixed ids for the timer's ring and its repeats (and the test), so a new timer replaces the old one. */
export const POTTY_NATIVE_IDS = Array.from({ length: MAX_REPEATS + 1 }, (_, i) => 910_000 + i);
const TEST_ID = 910_099;
/** The ring and its repeats, as iOS notifications. */
export function nativeRings(kidName: string, endAt: number) {
  return POTTY_NATIVE_IDS.map((id, sends) => {
    const m = ringMessage({ kidName, sends });
    return { id, title: m.title, body: m.body, threadIdentifier: `potty:${id}`, schedule: { at: new Date(endAt + sends * REPEAT_EVERY_MS), allowWhileIdle: true }, extra: { url: URL_POTTY } };
  });
}
async function nativePermission(): Promise<string> {
  try { return String((await local("checkPermissions"))?.display ?? ""); } catch { return ""; }
}
async function cancelNativeRings() {
  await local("cancel", { notifications: POTTY_NATIVE_IDS.map((id) => ({ id })) }).catch(() => {});
}

const currentSubscription = async () => (await navigator.serviceWorker.ready).pushManager.getSubscription();

/** Whether this phone or computer can get potty notifications, and whether it is signed up. */
export async function phoneState(token: string | null): Promise<PushPhase> {
  if (native()) { const p = await nativePermission(); return p === "granted" ? "on" : p === "denied" ? "blocked" : "off"; }
  if (isNativeApp()) return "unsupported";
  if (!capable()) return isApple() && !isInstalled() ? "install" : "unsupported";
  if (isApple() && !isInstalled()) return "install";
  if (Notification.permission === "denied") return "blocked";
  try {
    const sub = await Promise.race([currentSubscription(), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
    if (!sub || Notification.permission !== "granted") return "off";
    const status = await api(token, "/api/push/status", { endpoint: sub.endpoint }).catch(() => ({} as any));
    return status.device ? "on" : "off";
  } catch { return "off"; }
}

/** Asks for permission (this must run right after a tap) and signs this phone up. */
export async function turnOnPhone(token: string | null): Promise<PushPhase> {
  if (native()) {
    const p = String((await local("requestPermissions").catch(() => ({})))?.display ?? "");
    return p === "granted" ? "on" : p === "denied" ? "blocked" : "off";
  }
  const config = await api(token, "/api/push/config");
  if (!config.enabled || !config.publicKey) return "unavailable";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "blocked" : "off";
  const registration = await navigator.serviceWorker.ready;
  const sub = (await registration.pushManager.getSubscription())
    || (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) as BufferSource }));
  await api(token, "/api/pro/potty/push/subscribe", { subscription: sub.toJSON(), timeZone: zone() });
  return "on";
}

export const sendPottyTest = async (token: string | null) => {
  if (native()) {
    await local("schedule", { notifications: [{ id: TEST_ID, title: "🚽 Potty notifications are on", body: "You'll get one like this when the potty timer ends, even with the app closed.", schedule: { at: new Date(Date.now() + 5000) }, extra: { url: URL_POTTY } }] });
    return { ok: true };
  }
  return api(token, "/api/pro/potty/push/test", {});
};

/** Tells the server when the timer ends (or that there is none). Resolves false if it could not be reached. */
export async function syncPottyTimer(token: string | null, timer: { kid: string; endAt: number; minutes: number } | null, kidName: string): Promise<boolean> {
  if (native()) {
    try {
      await cancelNativeRings();
      const rings = timer ? nativeRings(kidName || "your child", timer.endAt).filter((n) => n.schedule.at.getTime() > Date.now()) : [];
      if (rings.length) await local("schedule", { notifications: rings });
      return true;
    } catch { return false; }
  }
  try {
    await api(token, "/api/pro/potty/timer", timer ? { kid: timer.kid, kidName, endAt: timer.endAt, minutes: timer.minutes } : { clear: true }, "PUT");
    return true;
  } catch { return false; }
}

/** Today's potty schedule (sit and prompt times) as iPhone notifications, so they ring with the app
 *  closed. `items` null clears them. Only in the iPhone app; the website rings them while open. */
export const POTTY_SCHEDULE_BASE = 911_000;
const SCHEDULE_MAX = 40;
export async function syncPottySchedule(kidName: string, items: { id: string; time: string; label: string }[] | null, day: string): Promise<void> {
  if (!native()) return;
  await local("cancel", { notifications: Array.from({ length: SCHEDULE_MAX }, (_, i) => ({ id: POTTY_SCHEDULE_BASE + i })) }).catch(() => {});
  if (!items?.length) return;
  const now = Date.now();
  const notifications = items.map((it, i) => {
    const [h, m] = it.time.split(":").map(Number);
    const at = new Date(`${day}T00:00:00`); at.setHours(h || 0, m || 0, 0, 0);
    return { id: POTTY_SCHEDULE_BASE + i, title: `🚽 ${it.label || "Potty time"}`, body: `Time for ${kidName || "your child"} to try the toilet. Open the app to log it.`, threadIdentifier: `potty-sched:${it.id}`, schedule: { at, allowWhileIdle: true }, extra: { url: URL_POTTY } };
  }).filter((n) => n.schedule.at.getTime() > now).slice(0, SCHEDULE_MAX);
  if (notifications.length) await local("schedule", { notifications }).catch(() => {});
}

/** The "timer running" notification: when it rings, and nothing that goes out of date while the app is closed. */
export async function showRunningTimer(kidName: string, endAtText: string): Promise<void> {
  if (isNativeApp()) return; // the iPhone app's ring is already scheduled; no live notification there
  try {
    if (!capable() || Notification.permission !== "granted") return;
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("🚽 Potty timer running", {
      body: `${kidName}: rings at ${endAtText}`, tag: LIVE_TAG, silent: true, icon: "/icon-192.png", badge: "/icon-192.png", data: { url: URL_POTTY },
    } as NotificationOptions);
  } catch { /* a notification is a nice extra, never in the way */ }
}

/** Takes the running-timer notification (and the ringing one) away. */
export async function clearPottyNotifications(tags: string[] = [LIVE_TAG, RING_TAG]): Promise<void> {
  if (native()) {
    // Takes away a ring that's showing; the repeats still come unless a trip is logged or the timer stops.
    if (tags.includes(RING_TAG)) await local("removeDeliveredNotifications", { notifications: POTTY_NATIVE_IDS.map((id) => ({ id })) }).catch(() => {});
    return;
  }
  try {
    if (!capable()) return;
    const registration = await navigator.serviceWorker.ready;
    for (const tag of tags) (await registration.getNotifications({ tag })).forEach((n) => n.close());
  } catch { /* nothing to clear */ }
}
