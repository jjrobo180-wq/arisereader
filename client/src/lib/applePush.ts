// Apple push notifications in the Arise To Duo iPhone app (plugin: @capacitor/push-notifications).
// Reminders are scheduled on the phone (nativeReminders.ts); these are the notifications only the
// server knows about (a message, something shared with you, a test). The app hands the server its
// Apple device token once notifications are allowed; tapping a notification opens its page.
import { apiRequest } from "@/lib/queryClient";
import { hasNativePlugin, isNativeApp, nativeCall, nativeFlavor } from "@/lib/nativeApp";

/** Which app the server sends to (Arise To Duo unless this is the Educator app). */
const appKey = () => (nativeFlavor() === "educator" ? "educator" : undefined);

const PLUGIN = /^pushnotif/i;
const NAME = "PushNotifications";
let started = false;
let lastToken = "";

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
      const plugin = (window as any).Capacitor?.Plugins?.PushNotifications;
      await plugin?.addListener?.("registration", (t: { value?: string }) => {
        const token = String(t?.value || "");
        if (!token || token === lastToken) return;
        lastToken = token;
        void apiRequest("POST", "/api/push/apple", { token, timeZone: zone(), app: appKey() }).catch(() => { lastToken = ""; });
      });
      await plugin?.addListener?.("pushNotificationActionPerformed", (e: any) => open(String(e?.notification?.data?.url || "")));
    }
    await nativeCall(PLUGIN, NAME, "register");
    return true;
  } catch {
    return false;
  }
}

/** True once this iPhone has handed the server its Apple device token in this launch. */
export const applePushReady = (): boolean => !!lastToken;

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
