// The Arise To Duo iPhone app runs this same site from capacitor://localhost. These helpers say when
// we're inside it and call its native plugins (Apple Health, Calendar) without importing their
// JavaScript packages, so the website build never depends on them.
/** True only in the Arise To Duo iPhone app's own build (vite.todo.config.ts); unset in tests. */
declare const __TODO_APP__: boolean | undefined;
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
  if (isNativeApp()) {
    // Safari through the app itself where it can (a widget tap isn't a tap in the page, so the web view refuses
    // window.open then); window.open in older builds.
    if (/^https?:\/\//i.test(url) && hasNativePlugin(/AriseNative/)) { void nativeCall(/AriseNative/, "AriseNative", "openExternal", { url }).catch(() => { try { window.open(url, "_blank"); } catch { /* no */ } }); return; }
    try { window.open(url, "_blank"); } catch { /* nothing else: never twice */ }
    return;
  }
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
/** In every iPhone app but Arise Undercover itself, the AI chat always looks like what it is: a plain chat
 *  titled "Ask AI", with no looks that disguise it and nothing that hides it (App Review 5.6). */
export const plainAsk = (): boolean => isNativeApp() && nativeFlavor() !== "undercover";
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
  undercover: (typeof __TODO_APP__ !== "undefined" && __TODO_APP__) ? (undefined as never) : { name: "Arise Undercover", bundle: "com.arisereader.undercover", api: "https://arisetodo.com" },
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

/** No live updates in any iPhone app (App Review 2.5.2 / 2.5.19): the web code an app runs is the code
 *  in the build Apple reviewed, and every change ships as an App Store update (server/ota.ts). */

/** The hash to open for a notification's link. Links are written "/#/lifehub?go=tasks", and this page
 *  already lives at "/", so only what's after the "#" belongs in the hash. */
export const notificationHash = (url: string): string | null => {
  if (url.startsWith("#")) return url.slice(1);
  if (!url.startsWith("/")) return null;
  const at = url.indexOf("#");
  return at >= 0 ? url.slice(at + 1) : url;
};
