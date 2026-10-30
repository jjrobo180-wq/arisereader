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

/** True when this build of the app has a native plugin whose name matches. */
export const hasNativePlugin = (match: RegExp): boolean => isNativeApp() && !!bridge()?.PluginHeaders?.some((h) => match.test(h.name));

/** Calls a native plugin method. `fallbackName` is used when the plugin list can't be read. */
export function nativeCall(match: RegExp, fallbackName: string, method: string, options?: unknown): Promise<any> {
  const b = bridge();
  if (!isNativeApp() || !b?.nativePromise) return Promise.reject(new Error("This works in the Arise To Duo iPhone app."));
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
