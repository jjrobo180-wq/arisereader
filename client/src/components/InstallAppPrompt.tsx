// A small pop-up for people on a computer: get A.R.I.S.E. as an app (a shortcut on the desktop or dock that
// opens in its own window) and turn on notifications. It shows once, a few seconds after sign-in, and comes
// back no sooner than two weeks after "Not now". Not shown on phones, in the installed app, or when done.
import { isNativeApp } from "@/lib/nativeApp";
import { useEffect, useState } from "react";
import { Bell, Check, Download, MonitorSmartphone, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

const KEY = "arise-install-prompt";
const WAIT = 14 * 86_400_000;
type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const installed = () => isNativeApp() || window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
const desktop = () => window.matchMedia?.("(pointer: fine)").matches && window.innerWidth >= 1024;
function browser(): "chrome" | "edge" | "safari" | "firefox" | "other" {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}
const STEPS: Record<ReturnType<typeof browser>, string[]> = {
  chrome: ["Click the install icon at the right end of the address bar (a screen with a down arrow).", "Or open the ⋮ menu → Cast, save and share → Install page as app.", "A.R.I.S.E. opens in its own window and gets a desktop and taskbar shortcut."],
  edge: ["Click the app icon at the right end of the address bar.", "Or open the … menu → Apps → Install this site as an app.", "Pin it to the taskbar or Start so it's one click away."],
  safari: ["In the menu bar, choose File → Add to Dock.", "Click Add. A.R.I.S.E. opens from the Dock in its own window."],
  firefox: ["Firefox doesn't install sites as apps. For a shortcut, drag the lock icon in the address bar onto your desktop.", "Or open this site in Chrome or Edge to install the app."],
  other: ["Look for “Install app” or “Add to Dock” in your browser's menu.", "Or drag the address onto your desktop for a shortcut."],
};

function keyBytes(text: string): Uint8Array {
  const padded = (text + "=".repeat((4 - (text.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export default function InstallAppPrompt() {
  const { user, token } = useAuth();
  const [show, setShow] = useState(false);
  const [evt, setEvt] = useState<BIP | null>(null);
  const [how, setHow] = useState(false);
  const [bell, setBell] = useState<"idle" | "busy" | "on" | "blocked" | "none">(() => (typeof Notification === "undefined" ? "none" : Notification.permission === "granted" ? "on" : Notification.permission === "denied" ? "blocked" : "idle"));
  const [didInstall, setDidInstall] = useState(false);

  useEffect(() => {
    const keep = (e: Event) => { e.preventDefault(); setEvt(e as BIP); };
    const done = () => { setDidInstall(true); try { localStorage.setItem(KEY, "installed"); } catch { /* not kept */ } };
    window.addEventListener("beforeinstallprompt", keep);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", keep); window.removeEventListener("appinstalled", done); };
  }, []);
  useEffect(() => {
    // Never for students: the install pop-up is for parents, teachers and adults only.
    if (!user || (!user.isAdmin && (user.role === "student" || !user.role)) || installed() || !desktop()) return;
    let saved = ""; try { saved = localStorage.getItem(KEY) || ""; } catch { /* private window */ }
    if (saved === "installed" || (saved && Date.now() - Number(saved) < WAIT)) return;
    const t = window.setTimeout(() => setShow(true), 6000);
    return () => window.clearTimeout(t);
  }, [user]);
  if (!show) return null;

  const later = () => { setShow(false); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* not kept */ } };
  const install = async () => { if (!evt) { setHow(true); return; } await evt.prompt(); const r = await evt.userChoice; setEvt(null); if (r.outcome === "accepted") setDidInstall(true); };
  const notify = async () => {
    setBell("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setBell(permission === "denied" ? "blocked" : "idle"); return; }
      const auth = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const config = await fetch(`${API_BASE}/api/push/config`, { headers: auth }).then((r) => r.json()).catch(() => null);
      if (config?.enabled && config.publicKey && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(config.publicKey) as BufferSource }));
        await fetch(`${API_BASE}/api/push/subscribe`, { method: "POST", headers: auth, body: JSON.stringify({ subscription: sub.toJSON(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
      }
      setBell("on");
    } catch { setBell("idle"); }
  };
  const b = browser();

  return <div role="dialog" aria-label="Get the A.R.I.S.E. app" data-testid="install-prompt"
    className="fixed bottom-5 right-5 z-[640] w-[360px] max-w-[calc(100vw-2.5rem)] rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
    <button type="button" onClick={later} aria-label="Not now" className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
    <div className="flex items-center gap-3 pr-8">
      <img src="/icon-192.png?v=seam1" alt="" className="h-12 w-12 rounded-2xl shadow" />
      <div><p className="font-black leading-tight">Get the A.R.I.S.E. app</p><p className="text-sm text-slate-500">One click from your desktop, in its own window.</p></div>
    </div>
    <ol className="mt-4 space-y-3">
      <li className="flex items-start gap-3">
        <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${didInstall ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"}`}>{didInstall ? <Check className="h-4 w-4" /> : 1}</span>
        <div className="min-w-0 flex-1"><p className="text-sm font-bold">Make it a shortcut</p>
          {didInstall ? <p className="text-sm text-emerald-700">Installed. Look for A.R.I.S.E. on your desktop or dock.</p>
            : <><button type="button" onClick={() => void install()} className="mt-1.5 inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white"><Download className="h-4 w-4" />{evt ? "Install the app" : "Show me how"}</button>
              {how && <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-600">{STEPS[b].map((s) => <li key={s}>{s}</li>)}</ul>}</>}
        </div>
      </li>
      <li className="flex items-start gap-3">
        <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${bell === "on" ? "bg-emerald-600 text-white" : "bg-slate-900 text-white"}`}>{bell === "on" ? <Check className="h-4 w-4" /> : 2}</span>
        <div className="min-w-0 flex-1"><p className="text-sm font-bold">Turn on notifications</p>
          {bell === "on" ? <p className="text-sm text-emerald-700">On. You'll hear about messages, passes and reminders.</p>
            : bell === "blocked" ? <p className="text-sm text-slate-600">Notifications are blocked. Click the lock icon in the address bar → Notifications → Allow.</p>
            : bell === "none" ? <p className="text-sm text-slate-600">This browser can't show notifications. Chrome or Edge can.</p>
            : <button type="button" disabled={bell === "busy"} onClick={() => void notify()} className="mt-1.5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold hover:bg-slate-50"><Bell className="h-4 w-4" />{bell === "busy" ? "Asking…" : "Turn on"}</button>}
        </div>
      </li>
    </ol>
    <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
      <span className="inline-flex items-center gap-1.5"><MonitorSmartphone className="h-3.5 w-3.5" />Works on phones too: Share → Add to Home Screen</span>
      <button type="button" onClick={later} className="min-h-9 rounded-lg px-2 font-semibold text-slate-600 hover:bg-slate-100">{didInstall || bell === "on" ? "Done" : "Not now"}</button>
    </div>
  </div>;
}
