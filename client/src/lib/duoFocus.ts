// The focus timer in the Arise To Duo iPhone app: a timer on one task that shows on the Lock Screen and in the
// Dynamic Island (a Live Activity, drawn by native/widget-extension/AriseWidgets.swift and started by the
// AriseWidgets plugin). Its Done and Stop buttons open the app with an arisetodo://focus/... link, which
// listenForFocusLinks hands back here. Outside the iPhone app none of this shows.
import { hasNativePlugin, isNativeApp, nativeCall, nativeFlavor, nativeListen } from "@/lib/nativeApp";

const PLUGIN = /arise.?widgets/i;

export type FocusNow = { id: string; title: string; startedAt: number; endsAt: number };
export type FocusLink = { kind: "done"; id: string } | { kind: "stop" } | { kind: "open" };

export const FOCUS_MINUTES = [15, 25, 45, 60] as const;

/** True in the Arise To Duo iPhone app (the only app whose Info.plist turns Live Activities on). */
export const focusSupported = (): boolean => isNativeApp() && nativeFlavor() === "todo" && hasNativePlugin(PLUGIN);

let current: FocusNow | null = null;
export const currentFocus = () => current;

/** Starts the timer on a task. Resolves with the timer, or rejects with a message to show. */
export async function startFocus(task: { id: string; title: string }, minutes: number, tint = "#7c6cf0"): Promise<FocusNow> {
  if (!focusSupported()) throw new Error("The focus timer works in the Arise To Duo iPhone app.");
  try {
    const r = await nativeCall(PLUGIN, "AriseWidgets", "startFocus", { id: task.id, title: task.title.slice(0, 80) || "Focus", minutes, tint });
    current = { id: task.id, title: task.title, startedAt: Number(r?.startedAt) || Date.now(), endsAt: Number(r?.endsAt) || Date.now() + minutes * 60_000 };
    return current;
  } catch (e: any) {
    const msg = String(e?.message || e || "");
    // An app from before the focus timer (a live update reached it, the native part didn't).
    if (/not implemented|unimplemented|not available/i.test(msg)) throw new Error("Update Arise To Duo from TestFlight or the App Store to use the focus timer.");
    throw new Error(msg || "The focus timer couldn't start.");
  }
}

/** Ends the timer (it leaves the Lock Screen and the Dynamic Island). */
export async function stopFocus(): Promise<void> {
  current = null;
  if (!focusSupported()) return;
  try { await nativeCall(PLUGIN, "AriseWidgets", "stopFocus"); } catch { /* nothing running */ }
}

/** The timer that's running (asked of iOS, so it's right after the app was closed). */
export async function readFocus(): Promise<FocusNow | null> {
  if (!focusSupported()) return null;
  try {
    const r = await nativeCall(PLUGIN, "AriseWidgets", "focusState");
    current = r && typeof r.id === "string" && Number(r.endsAt) > 0 ? { id: r.id, title: String(r.title || ""), startedAt: Number(r.startedAt) || 0, endsAt: Number(r.endsAt) } : null;
  } catch { current = null; }
  return current;
}

/** What an arisetodo://focus/... link asks for. */
export function readFocusLink(url: string): FocusLink | null {
  const m = /^arisetodo:\/\/focus\/(done|stop|open)\b(?:\?(.*))?$/i.exec(String(url || "").trim());
  if (!m) return null;
  const kind = m[1].toLowerCase();
  if (kind === "stop") return { kind: "stop" };
  if (kind === "open") return { kind: "open" };
  const id = new URLSearchParams(m[2] || "").get("id") || "";
  return id ? { kind: "done", id } : { kind: "stop" };
}

/** Calls `handle` for the Done and Stop buttons (also when one of them is what opened the app). */
export function listenForFocusLinks(handle: (link: FocusLink) => void): void {
  if (!focusSupported()) return;
  const seen = new Set<string>();
  const run = (url?: string) => {
    const link = url ? readFocusLink(url) : null;
    if (!link) return;
    // The launch link and the open event can both carry the same tap.
    const key = `${url}@${Math.floor(Date.now() / 5000)}`;
    if (seen.has(key)) return;
    seen.add(key);
    handle(link);
  };
  // The link the app was opened with stays the launch link until the app is closed: act on it once, not again
  // every time the page reloads (a live update), or a Stop from earlier would end a newer timer.
  nativeCall(/^App$/, "App", "getLaunchUrl").then((r: any) => {
    const url = String(r?.url || "");
    if (!url) return;
    try { if (sessionStorage.getItem("duo-focus-launch") === url) return; sessionStorage.setItem("duo-focus-launch", url); } catch { /* act on it */ }
    run(url);
  }).catch(() => {});
  void nativeListen("App", "appUrlOpen", (e: any) => run(e?.url));
}
