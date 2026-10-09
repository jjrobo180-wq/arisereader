// Signing out should stop Teacher Hub reminders on this phone or computer: they carry students' names,
// and the next person to pick the device up must not see them. Only this device is turned off; the
// teacher's other phones keep theirs. Never in the way of signing out: it gives up quietly.
import { API_BASE } from "@/lib/queryClient";

export async function forgetThisDevice(token: string | null): Promise<void> {
  try {
    if (!token || typeof navigator === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const registration = await navigator.serviceWorker.getRegistration(); // none registered: nothing to turn off
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await fetch(`${API_BASE}/api/push/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
      keepalive: true,
    }).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
  } catch {
    /* signing out always works */
  }
}
