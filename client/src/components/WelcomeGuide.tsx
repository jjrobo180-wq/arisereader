// Shown once after someone signs in: a welcome that explains, simply, how to add A.R.I.S.E. to the Home Screen
// and how to turn on notifications. When it is closed, a small bar at the bottom says it once more and then
// goes away on its own, for good. The words and the rules are in shared/welcomeGuide.ts.
import { useEffect, useRef, useState } from "react";
import { Bell, Check, Download, Share, SquarePlus, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import {
  BAR_TEXT, HOME_NOTE, HOME_STEPS, NOTIFY_LINES, barLeftMs, closeBar, closePopup, deviceOf, parseWelcome, showPopup,
  type Device, type WelcomeState,
} from "@shared/welcomeGuide";

const INSTALL_PROMPT_KEY = "arise-install-prompt"; // the desktop pop-up in InstallAppPrompt waits while this is set
// The demo accounts (the app shows "sample" as "sample-student") and the admin's student preview never get a welcome.
const isDemo = (username: unknown) => /^(sample|tutorial-eye|admin-preview)/.test(String(username));
type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const installed = () => window.matchMedia?.("(display-mode: standalone)").matches === true || (navigator as any).standalone === true;
const keyFor = (userId: unknown) => `arise-welcome:${userId ?? "me"}`;
const memory = new Map<string, string>(); // if the browser won't keep it, at least not twice in one visit
const readState = (userId: unknown): WelcomeState => {
  try { return parseWelcome(window.localStorage.getItem(keyFor(userId)) ?? memory.get(keyFor(userId))); } catch { return parseWelcome(memory.get(keyFor(userId))); }
};
const writeState = (userId: unknown, state: WelcomeState) => {
  const text = JSON.stringify(state);
  memory.set(keyFor(userId), text);
  try { window.localStorage.setItem(keyFor(userId), text); } catch { /* kept for this visit only */ }
};

function keyBytes(text: string): Uint8Array {
  const padded = (text + "=".repeat((4 - (text.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export default function WelcomeGuide() {
  const { user, token } = useAuth();
  const userId = user?.id;
  const eligible = !!user && !isDemo(user.username) && !(user as any).is_eye_gaze_user && !(user as any).mustChangePassword;
  const device: Device = typeof navigator === "undefined" ? "desktop" : deviceOf(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
  const [state, setState] = useState<WelcomeState>(() => (userId ? readState(userId) : parseWelcome(null)));
  const [popup, setPopup] = useState(false);
  const [leftMs, setLeftMs] = useState(0);
  const [evt, setEvt] = useState<BIP | null>(null);
  const [done, setDone] = useState(false); // the install prompt was accepted
  const [bell, setBell] = useState<"idle" | "busy" | "on" | "blocked" | "none">(() =>
    typeof Notification === "undefined" ? "none" : Notification.permission === "granted" ? "on" : Notification.permission === "denied" ? "blocked" : "idle");
  const primary = useRef<HTMLButtonElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const save = (next: WelcomeState) => { stateRef.current = next; setState(next); if (userId) writeState(userId, next); };

  // The browser's own "install" offer (Android and desktop Chrome/Edge), kept for the button.
  useEffect(() => {
    const keep = (e: Event) => { e.preventDefault(); setEvt(e as BIP); };
    const installedNow = () => setDone(true);
    window.addEventListener("beforeinstallprompt", keep);
    window.addEventListener("appinstalled", installedNow);
    return () => { window.removeEventListener("beforeinstallprompt", keep); window.removeEventListener("appinstalled", installedNow); };
  }, []);

  // Read this person's saved state when they sign in, and open the pop-up a moment later.
  useEffect(() => {
    if (!eligible || !userId) { setPopup(false); return; }
    const saved = readState(userId);
    stateRef.current = saved;
    setState(saved);
    if (!showPopup(saved)) return;
    // Hold the desktop install pop-up back so the two never stack.
    try { if (window.localStorage.getItem(INSTALL_PROMPT_KEY) !== "installed") window.localStorage.setItem(INSTALL_PROMPT_KEY, String(Date.now())); } catch { /* fine */ }
    const t = window.setTimeout(() => setPopup(true), 1200);
    return () => window.clearTimeout(t);
  }, [eligible, userId]);

  useEffect(() => { if (popup) primary.current?.focus(); }, [popup]);
  useEffect(() => {
    if (!popup) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeIt(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // The bar: counts down the time it has left, then removes itself and never comes back.
  useEffect(() => {
    if (popup || !eligible) { setLeftMs(0); return; }
    const tick = () => setLeftMs(barLeftMs(stateRef.current, Date.now()));
    tick();
    const timer = window.setInterval(tick, 500);
    return () => window.clearInterval(timer);
  }, [popup, eligible, state]);

  if (!eligible) return null;

  function closeIt() { setPopup(false); save(closePopup(stateRef.current, Date.now())); }

  const isInstalled = installed();
  const install = async () => {
    if (!evt) return;
    try { await evt.prompt(); const r = await evt.userChoice; setEvt(null); if (r.outcome === "accepted") setDone(true); } catch { /* the steps below still work */ }
  };
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

  const name = String(user?.displayName || "").trim().split(/\s+/)[0];
  // iPhone and iPad only allow notifications once the app is on the Home Screen.
  const needsApp = device === "ios" && !isInstalled;
  const Num = ({ n, ok }: { n: number; ok?: boolean }) => (
    <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${ok ? "bg-emerald-600" : "bg-violet-700"}`}>{ok ? <Check className="h-4 w-4" /> : n}</span>
  );

  return (
    <>
      {popup && (
        <div className="fixed inset-0 z-[700] flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4" data-testid="welcome-guide">
          <div role="dialog" aria-modal="true" aria-labelledby="welcome-title"
            className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white text-slate-900 shadow-2xl sm:max-w-md sm:rounded-3xl">
            <div className="flex-1 overflow-y-auto overscroll-contain p-5 pb-3 sm:p-6 sm:pb-3">
              <button type="button" onClick={closeIt} aria-label="Close" className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
              <div className="flex items-center gap-3 pr-10">
                <img src="/icon-192.png?v=seam1" alt="" className="h-14 w-14 rounded-2xl shadow" />
                <div>
                  <h2 id="welcome-title" className="text-xl font-black leading-tight">Welcome{name ? `, ${name}` : ""}!</h2>
                  <p className="text-sm text-slate-600">Two quick things make A.R.I.S.E. work like a real app.</p>
                </div>
              </div>

              {!isInstalled ? (
                <section className="mt-5" aria-label="Add to Home Screen">
                  <div className="flex items-start gap-3">
                    <Num n={1} ok={done} />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold">{device === "desktop" ? "Install the app" : "Add it to your Home Screen"}</h3>
                      <p className="text-sm text-slate-600">{device === "desktop" ? "One click to open, in its own window." : "One tap to open, just like your other apps."}</p>
                      {done ? <p className="mt-2 text-sm font-semibold text-emerald-700">Added! Look for A.R.I.S.E. with your other apps.</p> : (
                        <>
                          {evt && (
                            <button type="button" onClick={() => void install()} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-bold text-white hover:bg-violet-800">
                              <Download className="h-4 w-4" /> Add it now
                            </button>
                          )}
                          <ol className="mt-3 space-y-2.5">
                            {HOME_STEPS[device].map((step, i) => (
                              <li key={step} className="flex items-start gap-2.5 text-sm leading-snug text-slate-800">
                                <span className="mt-0.5 shrink-0 text-violet-700">{device === "ios" && i === 0 ? <Share className="h-4 w-4" /> : device === "ios" && i === 1 ? <SquarePlus className="h-4 w-4" /> : <span className="inline-block w-4 text-center text-xs font-black">{i + 1}.</span>}</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                          {HOME_NOTE[device] && <p className="mt-2 text-xs text-slate-500">{HOME_NOTE[device]}</p>}
                        </>
                      )}
                    </div>
                  </div>
                </section>
              ) : (
                <p className="mt-5 flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800"><Check className="h-4 w-4 shrink-0" /> You’re using the app. Nice!</p>
              )}

              <section className={isInstalled ? "mt-5" : "mt-6"} aria-label="Turn on notifications">
                <div className="flex items-start gap-3">
                  <Num n={isInstalled ? 1 : 2} ok={bell === "on"} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold">Turn on notifications</h3>
                    <p className="text-sm text-slate-600">Hear about messages, tasks and reminders, even when the app is closed.</p>
                    {bell === "on" ? <p className="mt-2 text-sm font-semibold text-emerald-700">Notifications are on.</p>
                      : needsApp ? <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-snug text-amber-900">{NOTIFY_LINES.ios.needsApp}</p>
                      : bell === "blocked" ? <p className="mt-2 text-sm leading-snug text-slate-700">Notifications are blocked for this site. Open your device’s Settings (or the lock icon in the address bar), find A.R.I.S.E., and switch Notifications on.</p>
                      : bell === "none" ? <p className="mt-2 text-sm leading-snug text-slate-700">This browser can’t show notifications. {device === "ios" ? "Add the app to your Home Screen first." : "Chrome, Edge or Firefox can."}</p>
                      : (
                        <>
                          <p className="mt-2 text-sm text-slate-800">{NOTIFY_LINES[device].ready}</p>
                          <button type="button" disabled={bell === "busy"} onClick={() => void notify()} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-violet-700 px-4 text-sm font-bold text-violet-800 hover:bg-violet-50 disabled:opacity-60">
                            <Bell className="h-4 w-4" /> {bell === "busy" ? "Asking…" : "Turn on notifications"}
                          </button>
                        </>
                      )}
                  </div>
                </div>
              </section>
              <p className="mt-5 text-xs text-slate-500">You can change this any time from the bell at the top of the page.</p>
            </div>
            <div className="shrink-0 border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
              <button ref={primary} type="button" onClick={closeIt} className="min-h-12 w-full rounded-2xl bg-slate-900 px-4 text-base font-bold text-white hover:bg-slate-800">Got it</button>
            </div>
          </div>
        </div>
      )}

      {!popup && leftMs > 0 && (
        <div role="status" data-testid="welcome-bar"
          className="fixed inset-x-0 bottom-0 z-[690] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex w-full max-w-xl items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/95 py-2 pl-4 pr-1.5 text-sm text-white shadow-2xl backdrop-blur">
            <span className="min-w-0 flex-1 leading-snug">{BAR_TEXT[device]}</span>
            <button type="button" onClick={() => setPopup(true)} className="min-h-10 shrink-0 rounded-xl bg-white/15 px-3 text-xs font-bold hover:bg-white/25">Show me</button>
            <button type="button" onClick={() => save(closeBar(stateRef.current))} aria-label="Close" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/80 hover:bg-white/10"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </>
  );
}
