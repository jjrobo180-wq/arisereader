// Arise LifeHub reminders on this phone or computer (Web Push), like Arise WorkHub's:
// a morning summary of the day, a heads-up 15 minutes before timed events and tasks,
// and a nudge the day before a bill is due. iPhones need the site on the Home Screen first.
import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Share, SquarePlus } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { Panel, plain, primary } from "./ui";

type Phase = "checking" | "unsupported" | "install" | "off" | "on" | "blocked" | "unavailable";

const isApple = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInstalled = () => (navigator as any).standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };

function keyBytes(text: string): Uint8Array {
  const padded = (text + "=".repeat((4 - (text.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
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

async function currentSubscription() {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export default function TodoNotifications() {
  const { token } = useAuth();
  const [phase, setPhase] = useState<Phase>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!capable) return live && setPhase(isApple() && !isInstalled() ? "install" : "unsupported");
      if (isApple() && !isInstalled()) return live && setPhase("install");
      if (Notification.permission === "denied") return live && setPhase("blocked");
      try {
        const sub = await Promise.race([currentSubscription(), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
        const on = !!sub && Notification.permission === "granted" && !!(await api(token, "/api/push/status", { endpoint: sub.endpoint }).catch(() => ({}))).todo;
        if (live) setPhase(on ? "on" : "off");
      } catch { if (live) setPhase("off"); }
    })();
    return () => { live = false; };
  }, [token]);

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
      await api(token, "/api/arise-todo/push/subscribe", { subscription: sub.toJSON(), timeZone: zone() });
      setPhase("on");
      setMessage("Reminders are on. Tap “Send a test” to see one.");
    } catch (error: any) {
      setMessage(error?.message || "Could not turn reminders on.");
    } finally { setBusy(false); }
  }

  async function turnOff() {
    setBusy(true); setMessage("");
    try {
      const sub = await currentSubscription();
      if (sub) {
        const result = await api(token, "/api/arise-todo/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => ({}));
        if (!result.stillUsed) await sub.unsubscribe(); // keep it when Arise WorkHub reminders still use it
      }
      setPhase("off");
    } finally { setBusy(false); }
  }

  async function sendTest() {
    setBusy(true); setMessage("");
    try { await api(token, "/api/arise-todo/push/test", {}); setMessage("Sent. It should show up in a few seconds."); }
    catch (error: any) { setMessage(error?.message || "Could not send a test."); }
    finally { setBusy(false); }
  }

  return <Panel eyebrow="Reminders" title="Notifications on this device">
    <div className="space-y-3 text-sm leading-6 text-slate-600" data-testid="todo-notifications">
      {phase === "checking" && <div className="flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Checking…</div>}
      {phase === "install" && <>
        <p className="font-semibold text-slate-800">On iPhone, add LifeHub to your Home Screen first. Then you can turn reminders on.</p>
        <ol className="space-y-2">
          <li className="flex items-start gap-2"><Share size={16} className="mt-1 shrink-0 text-violet-600" /><span>Open this page in <b>Safari</b> and tap <b>Share</b> (the square with an arrow).</span></li>
          <li className="flex items-start gap-2"><SquarePlus size={16} className="mt-1 shrink-0 text-violet-600" /><span>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</span></li>
          <li className="flex items-start gap-2"><Bell size={16} className="mt-1 shrink-0 text-violet-600" /><span>Open <b>A.R.I.S.E.</b> from your Home Screen, sign in, come back here and tap <b>Turn on reminders</b>.</span></li>
        </ol>
        <p className="text-xs text-slate-500">Needs iOS 16.4 or newer.</p>
      </>}
      {phase === "unsupported" && <p>This browser can't show notifications. On an iPhone use Safari; on Android or a computer use Chrome, Edge or Firefox.</p>}
      {phase === "unavailable" && <p>Notifications aren't switched on for the site yet. Please try again later.</p>}
      {phase === "blocked" && <p>Notifications are blocked. Open your phone's <b>Settings</b>, find <b>A.R.I.S.E.</b> (or your browser), allow notifications, then come back here.</p>}
      {phase === "off" && <>
        <p>Turn notifications on for this phone or computer, then pick below which ones you get and how many: a morning summary, heads-ups before tasks and events, bills, water, meals, workouts, news and more.</p>
        <button type="button" onClick={turnOn} disabled={busy} className={primary + " min-h-11"}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />} Turn on reminders</button>
      </>}
      {phase === "on" && <>
        <p className="font-semibold text-emerald-700">Reminders are on for this device.</p>
        <p className="text-xs text-slate-500">Signing out turns them off here.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={sendTest} disabled={busy} className={plain}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />} Send a test</button>
          <button type="button" onClick={turnOff} disabled={busy} className={plain}><BellOff size={15} /> Turn off</button>
        </div>
      </>}
      {message && <p role="status" className="rounded-xl bg-slate-50 px-3 py-2 text-slate-700">{message}</p>}
    </div>
  </Panel>;
}
