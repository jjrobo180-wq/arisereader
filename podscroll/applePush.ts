// Pod+ notifications on iPhone (plugin: @capacitor/push-notifications). The phone hands the server its
// Apple device token with the ids of the shows it follows (server/podPush.ts); the server sends
// "New episode" when one of them puts one out. Tapping it opens that episode.
import { hasNativePlugin, isNativeApp, nativeCall } from "../client/src/lib/nativeApp";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
const PLUGIN = /^pushnotif/i;
const NAME = "PushNotifications";
export const OPEN_EVENT = "podplus:open-episode";
let token = "";
let listening = false;
let lastSent = "";

export const podPushAvailable = () => isNativeApp() && hasNativePlugin(PLUGIN);
const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };

/** Whether iOS already allows Pod+ to notify. */
export async function podPushAllowed(): Promise<boolean> {
  if (!podPushAvailable()) return false;
  try { return String((await nativeCall(PLUGIN, NAME, "checkPermissions"))?.receive ?? "") === "granted"; } catch { return false; }
}

/** Signs this iPhone up. Asks iOS first only when `ask` (someone tapping "Turn on notifications"). */
export async function startPodPush(api: Api, follows: () => string[], ask: boolean): Promise<boolean> {
  if (!podPushAvailable()) return false;
  try {
    let state = String((await nativeCall(PLUGIN, NAME, "checkPermissions"))?.receive ?? "");
    if (state !== "granted" && ask) state = String((await nativeCall(PLUGIN, NAME, "requestPermissions"))?.receive ?? "");
    if (state !== "granted") return false;
    if (!listening) {
      listening = true;
      const plugin = (window as any).Capacitor?.Plugins?.PushNotifications;
      await plugin?.addListener?.("registration", (t: { value?: string }) => {
        token = String(t?.value || "");
        if (token) void syncPodPush(api, follows());
      });
      await plugin?.addListener?.("pushNotificationActionPerformed", (e: any) => {
        const q = new URLSearchParams(String(e?.notification?.data?.url || "").replace(/^[^?]*/, ""));
        const s = (q.get("s") || "").replace(/\D/g, ""), ep = (q.get("e") || "").replace(/\D/g, "");
        if (s && ep) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { showId: s, episodeId: ep } }));
      });
    }
    await nativeCall(PLUGIN, NAME, "register");
    return true;
  } catch { return false; }
}

/** Tells the server which shows this phone follows (only when the list changed). */
export async function syncPodPush(api: Api, follows: string[]): Promise<void> {
  if (!token) return;
  const key = token + "|" + follows.join(",");
  if (key === lastSent) return;
  lastSent = key;
  await api("/api/podscroll/push", { method: "POST", body: { token, follows, timeZone: zone() } }).catch(() => { lastSent = ""; });
}
