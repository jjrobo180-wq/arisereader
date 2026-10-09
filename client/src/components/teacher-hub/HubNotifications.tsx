// Arise WorkHub: put the Hub on the iPhone Home Screen and turn on notifications (Web Push).
// iPhones only allow notifications for a site that was added to the Home Screen first.
import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Share, SquarePlus } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { Card, GhostButton, PrimaryButton } from "./ui";
import { localZone } from "./HubImport";

type Phase = "checking" | "unsupported" | "install" | "off" | "on" | "blocked" | "unavailable";

const isApple = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInstalled = () => (navigator as any).standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;

function keyBytes(text: string): Uint8Array {
  const padded = (text + "=".repeat((4 - (text.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function api(token: string | null, path: string, body?: unknown) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong. Try again.");
  return data;
}

export default function HubNotifications({ token }: { token: string | null }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function currentSubscription() {
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
  }

  useEffect(() => {
    let live = true;
    (async () => {
      const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!capable) return live && setPhase(isApple() && !isInstalled() ? "install" : "unsupported");
      if (isApple() && !isInstalled()) return live && setPhase("install");
      if (Notification.permission === "denied") return live && setPhase("blocked");
      try {
        const sub = await currentSubscription();
        // The same phone may get Arise LifeHub reminders; ask whether Hub ones are on.
        const on = !!sub && Notification.permission === "granted" && !!(await api(token, "/api/push/status", { endpoint: sub.endpoint }).catch(() => ({ hub: true }))).hub;
        if (live) setPhase(on ? "on" : "off");
      } catch { if (live) setPhase("off"); }
    })();
    return () => { live = false; };
  }, []);

  async function turnOn() {
    setBusy(true); setMessage("");
    try {
      const config = await api(token, "/api/push/config");
      if (!config.enabled || !config.publicKey) { setPhase("unavailable"); return; }
      const permission = await Notification.requestPermission(); // must happen right after a tap
      if (permission !== "granted") { setPhase(permission === "denied" ? "blocked" : "off"); return; }
      const registration = await navigator.serviceWorker.ready;
      const sub = (await registration.pushManager.getSubscription())
        || (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) as BufferSource }));
      await api(token, "/api/push/subscribe", { subscription: sub.toJSON(), timeZone: localZone() });
      setPhase("on");
      setMessage("Notifications are on. Tap “Send a test” to see one.");
    } catch (error: any) {
      setMessage(error?.message || "Could not turn notifications on.");
    } finally { setBusy(false); }
  }

  async function turnOff() {
    setBusy(true); setMessage("");
    try {
      const sub = await currentSubscription();
      if (sub) {
        const result = await api(token, "/api/push/unsubscribe", { endpoint: sub.endpoint, app: "hub" }).catch(() => ({}));
        if (!result.stillUsed) await sub.unsubscribe(); // keep it when LifeHub reminders still use it
      }
      setPhase("off");
    } finally { setBusy(false); }
  }

  async function sendTest() {
    setBusy(true); setMessage("");
    try { await api(token, "/api/push/test", {}); setMessage("Sent. It should show up in a few seconds."); }
    catch (error: any) { setMessage(error?.message || "Could not send a test."); }
    finally { setBusy(false); }
  }

  return (
    <Card title="Phone app and notifications" collapseKey="home-notifications">
      <div className="space-y-3 text-sm text-slate-600">
        {phase === "checking" && <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Checking…</div>}

        {phase === "install" && (
          <>
            <p className="font-medium text-slate-900">On iPhone, add the Hub to your Home Screen first. Then you can turn notifications on.</p>
            <ol className="space-y-2">
              <li className="flex items-start gap-2"><Share className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" /><span>Open this page in <b>Safari</b> and tap the <b>Share</b> button (the square with an arrow).</span></li>
              <li className="flex items-start gap-2"><SquarePlus className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" /><span>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</span></li>
              <li className="flex items-start gap-2"><Bell className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" /><span>Open <b>A.R.I.S.E.</b> from your Home Screen, sign in, come back to this card and tap <b>Turn on notifications</b>.</span></li>
            </ol>
            <p className="text-xs text-slate-500">Needs iOS 16.4 or newer. The Home Screen app keeps its own sign-in, so you sign in once there.</p>
          </>
        )}

        {phase === "unsupported" && <p>This browser can't show notifications. On an iPhone use Safari; on Android or a computer use Chrome, Edge or Firefox.</p>}
        {phase === "unavailable" && <p>Notifications aren't switched on for the site yet. Please try again later.</p>}
        {phase === "blocked" && <p>Notifications are blocked for this app. Open your phone's <b>Settings</b>, find <b>A.R.I.S.E.</b> (or your browser), and allow notifications. Then come back here.</p>}

        {phase === "off" && (
          <>
            <p>Get a morning summary of what's on today, and a heads-up 15 minutes before a timed event on your calendar.</p>
            <PrimaryButton onClick={turnOn} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Turn on notifications</PrimaryButton>
          </>
        )}

        {phase === "on" && (
          <>
            <p className="font-medium text-emerald-700">Notifications are on for this device.</p>
            <p className="text-xs text-slate-500">Signing out turns them off here, so reminders about your students never show on a phone you've signed out of.</p>
            <div className="flex flex-wrap gap-2">
              <GhostButton onClick={sendTest}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />} Send a test</GhostButton>
              <GhostButton onClick={turnOff}><BellOff className="h-4 w-4" /> Turn off</GhostButton>
            </div>
          </>
        )}

        {message && <p role="status" className="rounded-xl bg-slate-50 px-3 py-2 text-slate-700">{message}</p>}
      </div>
    </Card>
  );
}
