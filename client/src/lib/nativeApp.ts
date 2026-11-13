// The Arise To Duo iPhone app runs this same site from capacitor://localhost. These helpers say when
// we're inside it and call its native plugins (Apple Health, Calendar) without importing their
// JavaScript packages, so the website build never depends on them.
type Bridge = {
  PluginHeaders?: { name: string }[];
  nativePromise?: (plugin: string, method: string, options?: unknown) => Promise<any>;
};

const bridge = (): Bridge | null => (typeof window !== "undefined" ? ((window as any).Capacitor as Bridge) || null : null);

/** True inside the iPhone app (the bundled page, not the website in Safari). */
export const isNativeApp = (): boolean => typeof window !== "undefined" && window.location.protocol === "capacitor:";
/** Opens a website outside the app, once. In the iPhone apps the app hands the address to Safari; it must
 *  not also be loaded a second way, or a one-use sign-in link is spent before the visible tab uses it. */
export function openOutside(url: string): void {
  if (isNativeApp()) { try { window.open(url, "_blank"); } catch { /* nothing else: never twice */ } return; }
  let opened: Window | null = null;
  try { opened = window.open(url, "_blank"); } catch { opened = null; }
  if (!opened) window.location.href = url;
}

/** Which iPhone app this build is (set at build time with VITE_NATIVE_APP): Arise To Duo ("todo"),
 *  Arise Reader for students ("reader"), or Arise Reader Educator for teachers and parents. */
export type NativeFlavor = "todo" | "reader" | "educator" | "fit" | "eyegaze" | "trainer" | "notes" | "talk" | "undercover";
export const nativeFlavor = (): NativeFlavor => {
  const f = String((import.meta as any).env?.VITE_NATIVE_APP || "");
  return f === "reader" || f === "educator" || f === "fit" || f === "eyegaze" || f === "trainer" || f === "notes" || f === "talk" || f === "undercover" ? f : "todo";
};
/** Inside one of the two Arise Reader apps (student or Educator). */
export const isReaderApp = (): boolean => isNativeApp() && (nativeFlavor() === "reader" || nativeFlavor() === "educator" || nativeFlavor() === "eyegaze");
/** Inside the Arise AAC app (the A.R.I.S.E. eye-gaze games and lessons, on iPad and iPhone). */
export const isEyeGazerApp = (): boolean => isNativeApp() && nativeFlavor() === "eyegaze";
/** Inside the Cooked iPhone app. */
export const isFitApp = (): boolean => isNativeApp() && nativeFlavor() === "fit";
/** Inside the Cooked PT iPhone app (coaches; pages/trainer/TrainerApp.tsx). */
export const isTrainerApp = (): boolean => isNativeApp() && nativeFlavor() === "trainer";
/** Inside the Arise Notes iPhone app (the AI note taker; components/arise-notes/NotesApp.tsx). */
export const isNotesApp = (): boolean => isNativeApp() && nativeFlavor() === "notes";
/** Inside the Arise Talk iPhone app (the talking boards; pages/talk/TalkApp.tsx). */
export const isTalkApp = (): boolean => isNativeApp() && nativeFlavor() === "talk";
/** Inside the Arise Undercover iPhone app (AI chat that looks like texting or a doc; undercover/UndercoverApp.tsx). */
export const isUndercoverApp = (): boolean => isNativeApp() && nativeFlavor() === "undercover";
/** Each app's name, bundle id (Sign in with Apple asks for it) and server. All three use the same
 *  server, through arisetodo.com, the address the Arise To Duo app is already allowed to call. */
export const NATIVE_APPS: Record<NativeFlavor, { name: string; bundle: string; api: string }> = {
  todo: { name: "Arise To Duo", bundle: "com.arisereader.arisetodo", api: "https://arisetodo.com" },
  reader: { name: "Arise Reader", bundle: "com.arisereader.reader", api: "https://arisetodo.com" },
  educator: { name: "Arise Reader Educator", bundle: "com.arisereader.educator", api: "https://arisetodo.com" },
  fit: { name: "Cooked Fitness by Arise", bundle: "com.arisereader.fit", api: "https://arisetodo.com" },
  eyegaze: { name: "Arise AAC", bundle: "com.arisereader.eyegazer", api: "https://arisetodo.com" },
  trainer: { name: "Cooked PT", bundle: "com.arisereader.trainer", api: "https://arisetodo.com" },
  notes: { name: "Arise Notes", bundle: "com.arisereader.notes", api: "https://arisetodo.com" },
  talk: { name: "Arise Talk", bundle: "com.arisereader.talk", api: "https://arisetodo.com" },
  undercover: { name: "Arise Undercover", bundle: "com.arisereader.undercover", api: "https://arisetodo.com" },
};
export const nativeAppInfo = () => NATIVE_APPS[nativeFlavor()];

/** True when this build of the app has a native plugin whose name matches. */
export const hasNativePlugin = (match: RegExp): boolean => isNativeApp() && !!bridge()?.PluginHeaders?.some((h) => match.test(h.name));

/** Calls a native plugin method. `fallbackName` is used when the plugin list can't be read. */
export function nativeCall(match: RegExp, fallbackName: string, method: string, options?: unknown): Promise<any> {
  const b = bridge();
  if (!isNativeApp() || !b?.nativePromise) return Promise.reject(new Error("This works in the iPhone app."));
  const name = b.PluginHeaders?.find((h) => match.test(h.name))?.name || fallbackName;
  return b.nativePromise(name, method, options);
}

/** Where the policies and support live (public pages, so App Store Connect can link to them too). */
export const LEGAL = {
  privacy: "https://arisetodo.com/privacy/",
  terms: "https://arisetodo.com/terms/",
  support: "https://arisetodo.com/support/",
};

/** Plans and add-ons are bought on the website, never inside the iPhone app (App Review 3.1.1). What
 *  someone already has works in the app when they sign in. */
export const NATIVE_NO_PURCHASE = "Plans and add-ons can't be bought in the iPhone app. Anything already on your account works here when you sign in.";

/** Listens to a native plugin's events (a push token, a tapped notification) without its JavaScript
 *  package: the plugin object if the page has one, else Capacitor's own registerPlugin or bridge
 *  callback. Without this, a plugin that was never imported here had no addListener and the events
 *  were lost (the iPhone never handed the server its notification token). */
export async function nativeListen(pluginName: string, event: string, fn: (data: any) => void): Promise<boolean> {
  const cap = typeof window !== "undefined" ? (window as any).Capacitor : null;
  if (!cap || !isNativeApp()) return false;
  try {
    const plugin = cap.Plugins?.[pluginName] ?? cap.registerPlugin?.(pluginName);
    if (plugin?.addListener) { await plugin.addListener(event, fn); return true; }
  } catch { /* try the bridge */ }
  try {
    if (typeof cap.nativeCallback === "function") { cap.nativeCallback(pluginName, "addListener", { eventName: event }, fn); return true; }
  } catch { /* nothing to listen with */ }
  return false;
}

/** Live updates (.github/scripts/ota_setup.py): tells the updater this copy of the app's web code
 *  started fine. Without it within 15 seconds, the app goes back to the copy that worked. */
let readySent = false;
/** Tells the updater "this copy started fine". It doesn't depend on the plugin list
 *  (Capacitor.PluginHeaders), which newer Capacitor versions don't always fill in: without this
 *  signal every downloaded update was rolled back 15 seconds after it opened. Resolves true once sent. */
export async function markAppReady(): Promise<boolean> {
  if (readySent) return true;
  if (!isNativeApp()) return false;
  const cap = typeof window !== "undefined" ? (window as any).Capacitor : null;
  const tries: (() => Promise<unknown>)[] = [];
  const plugin = cap?.Plugins?.CapacitorUpdater;
  if (plugin?.notifyAppReady) tries.push(() => plugin.notifyAppReady());
  try { const reg = cap?.registerPlugin?.("CapacitorUpdater"); if (reg?.notifyAppReady) tries.push(() => reg.notifyAppReady()); } catch { /* not available */ }
  tries.push(() => nativeCall(/CapacitorUpdater/i, "CapacitorUpdater", "notifyAppReady"));
  for (const t of tries) {
    try { await t(); readySent = true; return true; } catch { /* try the next way */ }
  }
  return false;
}

/** Sends the ready signal as soon as the first screen is drawn, retrying well inside the
 *  updater's 15-second window (a slow start no longer counts as a failed update). */
export function markAppReadyWhenDrawn(): void {
  if (!isNativeApp()) return;
  let n = 0;
  const tick = () => {
    n++;
    const drawn = !!document.getElementById("root")?.childElementCount;
    if (drawn) void markAppReady().then((ok) => { if (!ok && n < 12) window.setTimeout(tick, 1000); });
    else if (n < 12) window.setTimeout(tick, 1000);
  };
  window.setTimeout(tick, 800);
}

/** Live updates while the app is open: the newest web code is downloaded in the background and switched to
 *  the next time the app goes to the background or opens again — never while it's on screen. Reloading on the
 *  spot (a few seconds after opening, or when coming back) showed up as the app freezing and losing its place.
 *  Builds whose updater already does this by itself (autoUpdate on) are left to it, so the code isn't downloaded twice. */
const updater = () => {
  const cap = typeof window !== "undefined" ? (window as any).Capacitor : null;
  const p = cap?.Plugins?.CapacitorUpdater;
  if (p?.getLatest && p?.download && p?.set) return p;
  try { const reg = cap?.registerPlugin?.("CapacitorUpdater"); if (reg?.getLatest) return reg; } catch { /* not available */ }
  return null;
};
let checking = false, lastCheck = 0;
/** Downloads newer web code, if any, and queues it for the next time the app goes to the background or opens.
 *  It never reloads the screen (only "Check for updates" in Settings does, because someone asked for it). */
export async function liveUpdateNow(force = false): Promise<"none" | "applied" | "failed"> {
  if (!isNativeApp() || checking || (!force && Date.now() - lastCheck < 60_000)) return "none";
  const u = updater(); if (!u) return "none";
  checking = true; lastCheck = Date.now();
  try {
    // The app's own updater already checks, downloads and switches over in the background: nothing to add.
    if (typeof u.isAutoUpdateEnabled === "function") {
      const auto: any = await u.isAutoUpdateEnabled().catch(() => null);
      if (auto?.enabled === true) return "none";
    }
    const latest: any = await u.getLatest();
    const version = String(latest?.version || ""), url = String(latest?.url || "");
    if (!version || !url || latest?.error) return "none";
    const cur: any = await u.current().catch(() => null);
    if (String(cur?.bundle?.version || "") === version) return "none";
    const tries = Number(sessionStorage.getItem(`arise-live-${version}`) || 0);
    if (tries >= 2) return "none"; // this copy didn't take twice: leave it to the next open
    sessionStorage.setItem(`arise-live-${version}`, String(tries + 1));
    const bundle: any = await u.download({ url, version, ...(latest.checksum ? { checksum: latest.checksum } : {}) });
    if (!bundle?.id) return "failed";
    if (typeof u.next !== "function") return "none"; // very old updater: leave it to the next app build
    await u.next({ id: bundle.id }); // used the next time the app goes to the background or opens
    return "applied";
  } catch { return "failed"; } finally { checking = false; }
}
/** Settings → "Check for updates": does the whole check now and says in plain words what happened,
 *  so a phone that isn't updating shows why. Switches to the new copy right away when there is one. */
export async function checkForUpdateNow(): Promise<string> {
  if (!isNativeApp()) return "This is the website: it always has the newest version. Reload the page to get it.";
  const u = updater();
  if (!u) return "This app can't update itself (the updater isn't in this build). It needs a new TestFlight build.";
  let cur: any = null;
  try { cur = await u.current(); } catch { /* unknown */ }
  const running = String(cur?.bundle?.version || "builtin"), shipped = String(cur?.native || "");
  let latest: any;
  try { latest = await u.getLatest(); } catch (e: any) { return `Couldn't reach the update server (${e?.message || e}). Running ${running}.`; }
  const version = String(latest?.version || ""), url = String(latest?.url || "");
  if (!version || !url || latest?.error) return `Up to date: no newer version for this app (running ${running}${shipped ? `, app ${shipped}` : ""}; server said: ${latest?.message || latest?.error || "nothing new"}).`;
  if (running === version) return `Up to date (${version}).`;
  try {
    const bundle: any = await u.download({ url, version, ...(latest.checksum ? { checksum: latest.checksum } : {}) });
    if (!bundle?.id) return `Downloaded ${version} but it couldn't be opened.`;
    await u.set({ id: bundle.id }); // reloads into the new copy
    return `Updating to ${version}…`;
  } catch (e: any) { return `Found ${version} but the download failed: ${e?.message || e}`; }
}
export function keepLiveUpdated(): void {
  if (!isNativeApp() || typeof document === "undefined") return;
  // Well after the first screen is up, so the download never competes with opening the app.
  window.setTimeout(() => void liveUpdateNow(true), 30_000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void liveUpdateNow(); });
  window.setInterval(() => { if (document.visibilityState === "visible") void liveUpdateNow(); }, 10 * 60_000);
}

/** The hash to open for a notification's link. Links are written "/#/lifehub?go=tasks", and this page
 *  already lives at "/", so only what's after the "#" belongs in the hash. */
export const notificationHash = (url: string): string | null => {
  if (url.startsWith("#")) return url.slice(1);
  if (!url.startsWith("/")) return null;
  const at = url.indexOf("#");
  return at >= 0 ? url.slice(at + 1) : url;
};
