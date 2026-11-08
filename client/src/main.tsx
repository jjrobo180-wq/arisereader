import "./lib/accountStorageBoot";
import "./lib/sampleBoot";
import { isFitApp, isNativeApp, isNotesApp, isReaderApp, markAppReadyWhenDrawn, nativeAppInfo, nativeFlavor } from "./lib/nativeApp";
import { allowPopups } from "./lib/popupSupport";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./login-mobile-fix.css";
import "./keyboard-inset.css";
import "./reader-app.css";
import "./todo-app.css";
import { watchKeyboard } from "./lib/keyboardInset";
import { applyDeviceTopInset } from "./lib/deviceInsets";
import { startReaderNative } from "./lib/readerNative";
import { installDuoPaneBridge } from "./lib/duoPaneBridge";
import { installMediaUnlock, voiceElement } from "./lib/mediaUnlock";
import { configureAiVoice } from "@/lib/aiVoice";
import { API_BASE } from "@/lib/queryClient";

// Arise Fit draws edge to edge (contentInset "never" in fit/ios-app/capacitor.config.json). Without
// viewport-fit=cover the page stops short of the home indicator and env(safe-area-inset-*) reads 0, so titles
// sit under the Dynamic Island and the tab bar floats above a gray strip.
// The A.R.I.S.E. Reader app draws edge to edge too (reader-app.css keeps headers below the clock), and so does Arise Notes.
if (isFitApp() || isReaderApp() || isNotesApp()) {
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp && !/viewport-fit/.test(vp.getAttribute("content") || "")) vp.setAttribute("content", `${vp.getAttribute("content")}, viewport-fit=cover`);
}
if (isReaderApp()) document.documentElement.classList.add("reader-app");
// The A.R.I.S.E. Reader iPhone app: everything a little smaller (reader-app.css, html.reader-compact: 90%), so a
// phone shows more of a page, like the App Store's own apps. Done with the type size, never the viewport (see todo-compact).
if (isNativeApp() && nativeFlavor() === "reader") document.documentElement.classList.add("reader-compact");
// Arise Notes on the iPhone: a slightly smaller base size (index.css html.notes-app), so it feels like Apple's own
// apps instead of zoomed in. The viewport itself is left alone (changing it caused stuck zoom while typing).
if (isNotesApp()) document.documentElement.classList.add("notes-app");

// Arise To Duo draws edge to edge (contentInset "never" in arisetodo/ios-app/capacitor.config.json): the hub's
// header grows up behind the clock and its bottom bars reach the bottom edge (todo-app.css).
if (isNativeApp() && nativeFlavor() === "todo") {
  const html = document.documentElement;
  html.classList.add("todo-app");
  html.classList.add("todo-edge"); // the app now always draws edge to edge (capacitor.config.json)
}
// Arise To Duo on a phone: everything a touch smaller, so more fits on screen. Done with the type size
// (html.todo-compact in todo-app.css: 93.75%), never with the viewport. Any viewport below 100% (even locked at 93%)
// draws a 16px text box at about 15px, and iPhone zooms the page in when one is tapped. At 100% it has nothing to zoom to.
const todoCompact = isNativeApp() && nativeFlavor() === "todo" && (() => {
  const shortSide = Math.min(window.screen.width, window.screen.height);
  return shortSide > 0 && shortSide < 700;
})();
if (todoCompact) document.documentElement.classList.add("todo-compact");
// The clock's real height on this iPhone (lib/deviceInsets.ts): a Dynamic Island needs about 60px, not 44.
if (isNativeApp() && nativeFlavor() === "todo") applyDeviceTopInset();
if (isNotesApp()) applyDeviceTopInset();
// Arise Reader draws edge to edge too (reader/ios-app/capacitor.config.json), so it gets its phone's own clock space.
// The Educator, Trainer, Talk and Eye Gazer apps let iOS inset the page ("automatic"), so the system already does this.
if (isNativeApp() && nativeFlavor() === "reader") { applyDeviceTopInset(); startReaderNative(); }

// Keep Notes at the physical iPhone viewport width. A custom initial-scale=0.9
// made focus/keyboard geometry inconsistent with WKWebView's visual viewport.
// Arise Fit retains its independent intentional compact layout.
if (isFitApp()) {
  const shortSide = Math.min(window.screen.width, window.screen.height);
  if (shortSide > 0 && shortSide < 700) {
    const scale = 0.9;
    const vp = document.querySelector('meta[name="viewport"]');
    vp?.setAttribute("content", `width=${Math.round(shortSide / scale)}, initial-scale=${scale}, minimum-scale=${scale}, maximum-scale=${scale}, user-scalable=no, viewport-fit=cover`);
    document.documentElement.classList.add("native-zoomed-out", "fit-app");
    applyDeviceTopInset(scale);
  }
}

// iPhone apps: the page is exactly as wide as the screen. If iPhone ever lays the page out wider than the
// screen, the bars and cards run off the edge and the page drags sideways, so the viewport is pinned to the
// screen's own width in pixels. Arise Fit and Arise To Duo are left out: their page is meant to be wider than
// the screen (laid out at 90% / 93%), and pinning it is exactly what made To Duo jump to 100% while typing.
if (window.location.protocol === "capacitor:" && !isFitApp()) {
  const meta = () => document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const original = meta()?.getAttribute("content") || "";
  let waiting = false;
  const pin = () => {
    const m = meta();
    if (!m || waiting) return;
    const portrait = window.matchMedia("(orientation: portrait)").matches;
    const wide = Math.min(window.screen.width, window.screen.height);
    if (!portrait || wide < 280 || wide >= 700) { if (original && m.content !== original) m.content = original; return; }
    if (Math.abs(window.innerWidth - wide) < 2) return;
    waiting = true;
    m.content = `width=${wide}, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, shrink-to-fit=no, viewport-fit=cover`;
    setTimeout(() => { waiting = false; }, 400);
  };
  for (const ev of ["resize", "orientationchange", "load", "pageshow"]) window.addEventListener(ev, pin);
  pin(); setTimeout(pin, 300); setTimeout(pin, 1500);
}

// Sound on tablets: the first tap unlocks game sounds and voice lines (lib/mediaUnlock.ts).
installMediaUnlock();
// Spoken lines everywhere use the AI voice, through the one unlocked player.
configureAiVoice({ base: API_BASE, element: voiceElement });

// A pane of the Arise To Duo split screen: one shared floating button instead of each pane's own.
installDuoPaneBridge();

// Old personal-account signup links must open the shared A.R.I.S.E. sign-in/
// sign-up screen, never the retired LifeHub signup view.
if (/^(www\.)?arisetodo\.com$/i.test(window.location.hostname) &&
    /^#\/(?:lifehub|to-do)\?mode=signup(?:&|$)/.test(window.location.hash)) {
  window.history.replaceState(null, "", "/app#/signin");
}

// arisereader.com/hub (or /teacher-hub) goes straight to the Arise WorkHub sign-in.
{
  const path = window.location.pathname.replace(/\/+$/, "").toLowerCase();
  if (path === "/hub" || path === "/teacher-hub" || path === "/workhub") {
    window.history.replaceState(null, "", "/" + window.location.search + "#/workhub");
  } else if (path === "/to-do" || path === "/todo" || path === "/arise-todo" || path === "/lifehub") {
    window.history.replaceState(null, "", "/" + window.location.search + "#/lifehub");
  } else if (path === "/tv") {
    // arisetodo.com/tv, the address the Apple TV apps show for signing in. The app's pages live after the "#",
    // so the bare address opened the home page (or the hub) and never the page for typing the TV's code.
    // On arisetodo.com the app itself is at /app ("/" there is the home page).
    const code = new URLSearchParams(window.location.search).get("code");
    const appPath = /^(www\.)?arisetodo\.com$/i.test(window.location.hostname) ? "/app" : "/";
    window.history.replaceState(null, "", `${appPath}#/tv${code ? `?code=${encodeURIComponent(code)}` : ""}`);
  }
}

// The service worker is what lets the Home Screen app show notifications.
if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}

// In the iPhone apps, iOS closes an app in the background to free memory, so coming back starts it over.
// The screen you were on is kept (for 12 hours) and opened again, so it feels like you never left.
// (The open app, tab and typed text come back through lib/useStayOnRefresh.)
if (window.location.protocol === "capacitor:") {
  const LAST = "arise-last-hash", LAST_AT = "arise-last-hash-at";
  try {
    const h = window.location.hash;
    const saved = localStorage.getItem(LAST) || "", at = Number(localStorage.getItem(LAST_AT)) || 0;
    if ((!h || h === "#/" || h === "#/signin") && /^#\/[\w\-\/?=&.%]*$/.test(saved) && !/^#\/(signin|join|admin-handoff)/.test(saved) && Date.now() - at < 12 * 3600_000) window.location.hash = saved;
  } catch { /* nothing kept */ }
  window.addEventListener("hashchange", () => {
    try { const h = window.location.hash; if (h && h !== "#/") { localStorage.setItem(LAST, h); localStorage.setItem(LAST_AT, String(Date.now())); } } catch { /* fine */ }
  });
}

// No zoom, anywhere: index.html fixes the page at scale 1 (maximum-scale=1, user-scalable=no), which
// stops iPhone zooming in when a text box is tapped. The iPhone apps also hold the web view at 1
// natively (AriseZoomLock / NotesZoomLock). The meta is never changed at run time (except Fit's fixed
// compact scale, set once at start), and fields stay at 16px+ on phones as a third guard.
// A gesture zoom is also cancelled for good measure in browsers that still allow it.
{
  const stop = (e: Event) => e.preventDefault();
  document.addEventListener("gesturestart", stop, { passive: false });
  document.addEventListener("gesturechange", stop, { passive: false });
  document.addEventListener("touchmove", (e) => { if ((e as TouchEvent).touches.length > 1) e.preventDefault(); }, { passive: false });
}
if (!window.location.hash) {
  window.location.hash = "#/";
}

// A locally bundled iOS build runs on capacitor://localhost rather than the
// production web origin. Route relative API calls to the production backend.
// The backend must explicitly allow the Capacitor origin and credentialed CORS
// for authenticated sessions; this is verified separately before release.
const isAriseTodoNative = window.location.protocol === "capacitor:";
if (isAriseTodoNative && (!window.location.hash || window.location.hash === "#/")) {
  window.location.hash = "#/signin";
}
allowPopups();
const nativeApiOrigin = nativeAppInfo().api;
function resolveNativeApiUrl(url: string): string {
  if (!isAriseTodoNative || !url.startsWith("/api/")) return url;
  return nativeApiOrigin + url;
}

// Pictures and media from the server (book covers: <img src="/api/book-cover/…">) load the same way:
// in the app a short "/api/…" address would point inside the app, where they aren't.
if (isAriseTodoNative) {
  const ATTRS = ["src", "poster"];
  const fix = (el: Element) => {
    for (const a of ATTRS) { const v = el.getAttribute(a); if (v && v.startsWith("/api/")) el.setAttribute(a, nativeApiOrigin + v); }
  };
  const sweep = (root: ParentNode) => root.querySelectorAll?.('img[src^="/api/"], video[src^="/api/"], audio[src^="/api/"], source[src^="/api/"], video[poster^="/api/"]').forEach(fix);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "attributes") fix(m.target as Element);
      else m.addedNodes.forEach((n) => { if (n.nodeType === 1) { fix(n as Element); sweep(n as Element); } });
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ATTRS });
}

// Global fetch wrapper: a page load that briefly gets 401 (session store catching up) or 503 (server
// restarting during a deploy) is tried again. Only reads (GET) are retried, so a sign-in, a save or a
// submitted form is never sent twice; a wrong password is answered at once and counts once.
const originalFetch = window.fetch;
window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const target = resolveNativeApiUrl(url);
  const requestInput = target === url ? input : target;
  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  const readsApi = method === "GET" && /\/api\//.test(url) && !/\/api\/(login|logout|auth\/)/.test(url);
  const retries = readsApi ? 2 : 0;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await originalFetch(requestInput, isAriseTodoNative && target !== url ? { ...init, credentials: "include" } : init);
      const transient = res.status === 503 || (res.status === 401 && headers.has("Authorization") && attempt < 1);
      if (transient && attempt < retries) {
        await new Promise(r => setTimeout(r, 700));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < retries) { await new Promise(r => setTimeout(r, 700)); continue; }
      throw err;
    }
  }
};

// Sheets that sit at the bottom of the screen move up above the phone's keyboard while it's open.
watchKeyboard();

// Real photos on every A.R.I.S.E. Original cover (client/src/lib/readPhotos.ts).
// Loaded after the page starts: it carries every story's details, which the first screen doesn't need.
// A screen's stylesheet pulls its font from Google Fonts. When that is blocked (a school or work
// network, an ad blocker, no internet for a moment) the browser reports the whole stylesheet as
// failed, and the screen's code stopped there: LifeHub showed "Something went wrong". Carry on
// without it instead — the screen just uses the fallback font. (A failed script still counts.)
window.addEventListener("vite:preloadError", (event) => {
  const message = String((event as Event & { payload?: { message?: string } }).payload?.message || "");
  if (/preload CSS/i.test(message)) event.preventDefault();
});
createRoot(document.getElementById("root")!).render(<App />);
void import("./lib/readPhotos").then((m) => m.installReadPhotos()).catch(() => { /* covers keep their drawings */ });
// Live updates: this copy of the app started and drew its first screen (otherwise the iPhone app goes
// back to the copy that worked; client/src/lib/nativeApp.ts).
markAppReadyWhenDrawn();
