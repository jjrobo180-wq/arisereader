/** Build-time identity keeps Reader and To-Do separate on capacitor://localhost. */
export type NativeApp = "reader" | "todo" | null;
export function nativeAppFor(protocol: string, flavor?: string): NativeApp {
  return protocol === "capacitor:" ? (flavor === "reader" ? "reader" : "todo") : null;
}
export const nativeApp = nativeAppFor(
  typeof window === "undefined" ? "" : window.location.protocol,
  import.meta.env?.VITE_NATIVE_APP,
);
export const isNativeReader = nativeApp === "reader";
export const isNativeApp = nativeApp !== null;
export const nativeApiOrigin = isNativeReader ? "https://www.arisereader.com" : "https://arisetodo.com";
