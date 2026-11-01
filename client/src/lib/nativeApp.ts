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

/** Which iPhone app this build is (set at build time with VITE_NATIVE_APP): Arise To Duo ("todo"),
 *  A.R.I.S.E. Reader for students ("reader"), or A.R.I.S.E. Reader Educator for teachers and parents. */
export type NativeFlavor = "todo" | "reader" | "educator" | "fit" | "eyegaze";
export const nativeFlavor = (): NativeFlavor => {
  const f = String((import.meta as any).env?.VITE_NATIVE_APP || "");
  return f === "reader" || f === "educator" || f === "fit" || f === "eyegaze" ? f : "todo";
};
/** Inside one of the two A.R.I.S.E. Reader apps (student or Educator). */
export const isReaderApp = (): boolean => isNativeApp() && (nativeFlavor() === "reader" || nativeFlavor() === "educator" || nativeFlavor() === "eyegaze");
/** Inside the Arise Eye Gazer app (the A.R.I.S.E. eye-gaze games and lessons, on iPad and iPhone). */
export const isEyeGazerApp = (): boolean => isNativeApp() && nativeFlavor() === "eyegaze";
/** Inside the Arise Fit iPhone app. */
export const isFitApp = (): boolean => isNativeApp() && nativeFlavor() === "fit";
/** Each app's name, bundle id (Sign in with Apple asks for it) and server. All three use the same
 *  server, through arisetodo.com, the address the Arise To Duo app is already allowed to call. */
export const NATIVE_APPS: Record<NativeFlavor, { name: string; bundle: string; api: string }> = {
  todo: { name: "Arise To Duo", bundle: "com.arisereader.arisetodo", api: "https://arisetodo.com" },
  reader: { name: "A.R.I.S.E. Reader", bundle: "com.arisereader.reader", api: "https://arisetodo.com" },
  educator: { name: "A.R.I.S.E. Reader Educator", bundle: "com.arisereader.educator", api: "https://arisetodo.com" },
  fit: { name: "Arise Fit", bundle: "com.arisereader.fit", api: "https://arisetodo.com" },
  eyegaze: { name: "Arise Eye Gazer", bundle: "com.arisereader.eyegazer", api: "https://arisetodo.com" },
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
