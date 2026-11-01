// Apple push notifications in the Arise To Duo iPhone app (plugin: @capacitor/push-notifications).
// Reminders are scheduled on the phone (nativeReminders.ts); these are the notifications only the
// server knows about (a message, something shared with you, a test). The app hands the server its
// Apple device token once notifications are allowed; tapping a notification opens its page.
import { apiRequest } from "@/lib/queryClient";
import { hasNativePlugin, isNativeApp, nativeCall, nativeFlavor, nativeListen } from "@/lib/nativeApp";

/** Which app the server sends to (Arise To Duo unless this is the Educator app). */
const appKey = () => { const f = nativeFlavor(); return f === "educator" || f === "eyegaze" || f === "fit" || f === "trainer" ? f : undefined; };

const PLUGIN = /^pushnotif/i;
const NAME = "PushNotifications";
let started = false;
let lastToken = "";
/** Why this iPhone isn't signed up yet, in words (Apple's error, or the server's). */
let lastProblem = "";
let tokenWaiters: ((ok: boolean) => void)[] = [];
const settle = (ok: boolean) => { const w = tokenWaiters; tokenWaiters = []; w.forEach((f) => f(ok)); };
export const applePushProblem = () => lastProblem;
/** This iPhone's token, kept for the device (not an account) so signing out can always forget it. */
const TOKEN_KEY = "arise-apns-token";

export const applePushAvailable = (): boolean => hasNativePlugin(PLUGIN);
const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };
const open = (url: string) => {
  if (!url) return;
  if (url.startsWith("#")) window.location.hash = url.slice(1);
  else if (url.startsWith("/")) window.location.hash = url;
};

/** Signs this iPhone up with the server. Asks iOS first only when `ask` (a person turning notifications on). */
export async function startApplePush(ask = false): Promise<boolean> {
  if (!isNativeApp() || !applePushAvailable()) return false;
  try {
    const now = await nativeCall(PLUGIN, NAME, "checkPermissions");
    let state = String(now?.receive ?? "");
    if (state !== "granted" && ask) state = String((await nativeCall(PLUGIN, NAME, "requestPermissions"))?.receive ?? "");
    if (state !== "granted") return false;
    if (!started) {
      started = true;
      const add = (event: string, fn: (e: any) => void) => nativeListen(NAME, event, fn);
      await add("registration", (t: { value?: string }) => {
        const token = String(t?.value || "");
        if (!token) return;
        try { localStorage.setItem(TOKEN_KEY, token); } catch { /* still sent to the server */ }
        // Ready once the server has it (Apple gives the same token again on each launch).
        void apiRequest("POST", "/api/push/apple", { token, timeZone: zone(), app: appKey() })
          .then(() => { lastToken = token; lastProblem = ""; settle(true); })
          .catch((e: any) => { lastToken = ""; lastProblem = `The server didn't save this iPhone (${String(e?.message || "no connection").replace(/^\d+:\s*/, "").slice(0, 120)}).`; settle(false); });
      });
      await add("registrationError", (e: any) => { lastProblem = `Apple didn't give this iPhone a notification address (${String(e?.error || e?.message || "unknown error").slice(0, 120)}).`; settle(false); });
      await add("pushNotificationActionPerformed", (e: any) => open(String(e?.notification?.data?.url || e?.notification?.data?.aps?.url || "")));
    }
    await nativeCall(PLUGIN, NAME, "register");
    return true;
  } catch {
    return false;
  }
}

/** True once this iPhone has handed the server its Apple device token in this launch. */
export const applePushReady = (): boolean => !!lastToken;

/** Signs this iPhone up if it isn't yet, and waits (up to `ms`) for the server to have it. */
export async function ensureApplePush(ms = 10_000): Promise<boolean> {
  if (lastToken) return true;
  const waiting = new Promise<boolean>((resolve) => { tokenWaiters.push(resolve); setTimeout(() => resolve(!!lastToken), ms); });
  const asked = await startApplePush(true);
  if (!asked) { if (!lastProblem) lastProblem = "Notifications are off for Arise To Duo in iPhone Settings."; settle(false); }
  return waiting;
}

/** Asks the server to send a real test through Apple to this person's phones. Resolves with how many
 *  phones Apple accepted it for; throws with the server's own words when it couldn't. */
export async function sendAppleTest(): Promise<number> {
  const res = await apiRequest("POST", "/api/arise-todo/push/test", {});
  const data = await res.json().catch(() => ({}));
  return Number(data?.apple ?? 0);
}

/** Stops this iPhone's server notifications (turning notifications off, or signing out). */
export async function stopApplePush(): Promise<void> {
  if (!lastToken) return;
  const token = lastToken;
  lastToken = "";
  await apiRequest("POST", "/api/push/apple/forget", { token, app: appKey() }).catch(() => {});
}

/** Signing out: tells the server to stop sending the account signing out to this iPhone. Uses the
 *  outgoing account's own sign-in (passed in, since it's being cleared), and the token kept for the
 *  device, so it works even when notifications weren't started in this launch. Never throws. */
export async function forgetAppleDevice(authToken: string, apiBase = ""): Promise<void> {
  let token = lastToken;
  if (!token) { try { token = localStorage.getItem(TOKEN_KEY) || ""; } catch { token = ""; } }
  lastToken = "";
  if (!token || !authToken) return;
  await fetch(`${apiBase}/api/push/apple/forget`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
    body: JSON.stringify({ token, app: appKey() }),
    keepalive: true,
  }).catch(() => {});
}
