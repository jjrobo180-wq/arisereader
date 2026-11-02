import { isNativeApp } from "@/lib/nativeApp";
import { cancelAllNativeReminders } from "@/lib/nativeReminders";
import { forgetAppleDevice } from "@/lib/applePush";
// Signing out should stop Arise WorkHub reminders on this phone or computer: they carry students' names,
// and the next person to pick the device up must not see them. Only this device is turned off; the
// teacher's other phones keep theirs. Never in the way of signing out: it gives up quietly.
import { API_BASE } from "@/lib/queryClient";

export async function forgetThisDevice(token: string | null): Promise<void> {
  // The iPhone app: its scheduled reminders and its Apple push token belong to the account signing out.
  if (isNativeApp()) {
    await Promise.all([cancelAllNativeReminders(), token ? forgetAppleDevice(token, API_BASE) : Promise.resolve()]).catch(() => {});
  }
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
