// Small pieces of Podster inside Arise To Duo that To Duo itself needs without loading Podster: this device's
// Podster id, and turning off new-episode alerts when Podster is taken out of To Duo.
import { API_BASE } from "@/lib/queryClient";
import { isNativeApp } from "@/lib/nativeApp";

/** This device's Podster id (the same one the Podster website keeps), sent with every Podster request. */
export function podDevice(): string {
  try { const saved = localStorage.getItem("podscroll.device"); if (saved && /^[A-Za-z0-9_-]{16,40}$/.test(saved)) return saved; } catch { /* made below */ }
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  try { localStorage.setItem("podscroll.device", id); } catch { /* used for this visit */ }
  return id;
}

/** The To Duo iPhone app's notification token, once notifications are on (client/src/lib/applePush.ts). */
export function duoPushToken(): string | null {
  if (!isNativeApp()) return null;
  let t = ""; try { t = localStorage.getItem("arise-apns-token") || ""; } catch { /* not allowed */ }
  return /^[0-9a-f]{64,200}$/i.test(t) ? t : null;
}

/** Podster was taken out of To Duo: no more new-episode alerts on this iPhone (server/podPush.ts). */
export function forgetDuoPodPush(authToken: string | null | undefined): void {
  const apns = duoPushToken();
  if (!apns) return;
  const base = (API_BASE || location.origin).replace(/\/$/, "");
  void fetch(`${base}/api/podscroll/push/forget`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Podscroll-Device": podDevice(), ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
    body: JSON.stringify({ token: apns, app: "todo" }),
    keepalive: true,
  }).catch(() => {});
}
