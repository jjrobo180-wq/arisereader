import "./lib/accountStorageBoot";
import "./lib/sampleBoot";
import { markAppReady, nativeAppInfo } from "./lib/nativeApp";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./login-mobile-fix.css";
import "./keyboard-inset.css";
import { watchKeyboard } from "./lib/keyboardInset";
import { installDuoPaneBridge } from "./lib/duoPaneBridge";
import { installMediaUnlock, voiceElement } from "./lib/mediaUnlock";
import { configureAiVoice } from "@/lib/aiVoice";
import { API_BASE } from "@/lib/queryClient";

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
  }
}

// The service worker is what lets the Home Screen app show notifications.
if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
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
createRoot(document.getElementById("root")!).render(<App />);
void import("./lib/readPhotos").then((m) => m.installReadPhotos()).catch(() => { /* covers keep their drawings */ });
// Live updates: this copy of the app started and drew its first screen (otherwise the iPhone app goes
// back to the copy that worked; client/src/lib/nativeApp.ts).
setTimeout(() => { if (document.getElementById("root")?.childElementCount) markAppReady(); }, 2000);
