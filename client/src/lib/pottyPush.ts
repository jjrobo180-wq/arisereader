// Potty Training on the phone: turning notifications on for this device, telling the server when the reminder timer
// ends (so a notification comes even with the app closed), and a "timer running" notification while it counts down.
// The server side is server/pottyTimers.ts; the rules are in shared/pro/potty/timerPush.ts.
import { API_BASE } from "@/lib/queryClient";

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

const currentSubscription = async () => (await navigator.serviceWorker.ready).pushManager.getSubscription();

/** Whether this phone or computer can get potty notifications, and whether it is signed up. */
export async function phoneState(token: string | null): Promise<PushPhase> {
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

export const sendPottyTest = (token: string | null) => api(token, "/api/pro/potty/push/test", {});

/** Tells the server when the timer ends (or that there is none). Resolves false if it could not be reached. */
export async function syncPottyTimer(token: string | null, timer: { kid: string; endAt: number; minutes: number } | null, kidName: string): Promise<boolean> {
  try {
    await api(token, "/api/pro/potty/timer", timer ? { kid: timer.kid, kidName, endAt: timer.endAt, minutes: timer.minutes } : { clear: true }, "PUT");
    return true;
  } catch { return false; }
}

/** The "timer running" notification: when it rings, and nothing that goes out of date while the app is closed. */
export async function showRunningTimer(kidName: string, endAtText: string): Promise<void> {
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
  try {
    if (!capable()) return;
    const registration = await navigator.serviceWorker.ready;
    for (const tag of tags) (await registration.getNotifications({ tag })).forEach((n) => n.close());
  } catch { /* nothing to clear */ }
}
