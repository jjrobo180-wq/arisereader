// The focus timer in the Arise To Do iPhone app: a timer on one task that shows on the Lock Screen and in the
// Dynamic Island (a Live Activity, drawn by native/widget-extension/AriseWidgets.swift and started by the
// AriseWidgets plugin). Its Done and Stop buttons open the app with an arisetodo://focus/... link, which
// listenForFocusLinks hands back here. Outside the iPhone app none of this shows.
import { hasNativePlugin, isNativeApp, nativeCall, nativeFlavor, nativeListen } from "@/lib/nativeApp";
import { publishFocusNow } from "@/lib/duoBoard";

const PLUGIN = /arise.?widgets/i;

export type FocusNow = { id: string; title: string; startedAt: number; endsAt: number };
/** "add" and "tasks" come from the Home Screen widgets' buttons (native/widget-extension/DuoDesigns.swift). */
export type FocusLink = { kind: "done"; id: string } | { kind: "stop" } | { kind: "open" } | { kind: "add" } | { kind: "tasks" } | WidgetGo;
/** A tap on a Home Screen or Lock Screen widget: the hub and the section it's about, and the task when it's about one. */
export type WidgetGo = { kind: "go"; hub: "work" | "life"; to: string; view: string; task: string };
const GO_TO = new Set(["tasks", "calendar", "asks", "add", "links", "home"]);

export const FOCUS_MINUTES = [15, 25, 45, 60] as const;

/** True in the Arise To Do iPhone app (the only app whose Info.plist turns Live Activities on). */
export const focusSupported = (): boolean => isNativeApp() && nativeFlavor() === "todo" && hasNativePlugin(PLUGIN);

let current: FocusNow | null = null;
export const currentFocus = () => current;

/** Starts the timer on a task. Resolves with the timer, or rejects with a message to show. */
export async function startFocus(task: { id: string; title: string }, minutes: number, tint = "#7c6cf0"): Promise<FocusNow> {
  if (!focusSupported()) throw new Error("The focus timer works in the Arise To Do iPhone app.");
  try {
    const r = await nativeCall(PLUGIN, "AriseWidgets", "startFocus", { id: task.id, title: task.title.slice(0, 80) || "Focus", minutes, tint });
    current = { id: task.id, title: task.title, startedAt: Number(r?.startedAt) || Date.now(), endsAt: Number(r?.endsAt) || Date.now() + minutes * 60_000 };
    publishFocusNow(current);
    return current;
  } catch (e: any) {
    const msg = String(e?.message || e || "");
    // An app from before the focus timer (a live update reached it, the native part didn't).
    if (/not implemented|unimplemented|not available/i.test(msg)) throw new Error("Update Arise To Do to use the focus timer.");
    throw new Error(msg || "The focus timer couldn't start.");
  }
}

/** Ends the timer (it leaves the Lock Screen and the Dynamic Island). */
export async function stopFocus(): Promise<void> {
  current = null;
  publishFocusNow(null);
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
  publishFocusNow(current);
  return current;
}

/** What an arisetodo://focus/... link asks for. */
export function readFocusLink(url: string): FocusLink | null {
  const m = /^arisetodo:\/\/focus\/(done|stop|open|add|tasks|go)\b(?:\?(.*))?$/i.exec(String(url || "").trim());
  if (!m) return null;
  const kind = m[1].toLowerCase();
  if (kind === "go") {
    const q = new URLSearchParams(m[2] || "");
    const to = (q.get("to") || "").toLowerCase();
    const view = (q.get("view") || "").toLowerCase();
    return { kind: "go", hub: q.get("hub") === "work" ? "work" : "life", to: GO_TO.has(to) ? to : "tasks", view: /^(today|upcoming|all)$/.test(view) ? view : "", task: (q.get("task") || "").slice(0, 80) };
  }
  if (kind === "stop") return { kind: "stop" };
  if (kind === "open") return { kind: "open" };
  if (kind === "add") return { kind: "add" };
  if (kind === "tasks") return { kind: "tasks" };
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

/** Where a widget tap goes in the app: the hub's own "?go=" link (each hub reads it and opens that section or task). */
export function widgetGoHash(g: WidgetGo): string {
  const q = new URLSearchParams({ go: g.to });
  if (g.view) q.set("view", g.view);
  if (g.task) q.set("task", g.task);
  return `#/${g.hub === "work" ? "workhub" : "lifehub"}?${q.toString()}`;
}

/**
 * Widget taps open the exact place they show, whichever screen the app is on (or opened on): set once at start-up
 * (main.tsx). Separate from listenForFocusLinks, which the hubs use for the timer's Done and Stop.
 */
export function listenForWidgetGo(): void {
  if (!isNativeApp() || nativeFlavor() !== "todo") return;
  let last = "";
  const run = (url?: string) => {
    const link = url ? readFocusLink(url) : null;
    if (!link || link.kind !== "go") return;
    const key = `${url}@${Math.floor(Date.now() / 3000)}`;
    if (key === last) return;
    last = key;
    window.location.hash = widgetGoHash(link);
  };
  nativeCall(/^App$/, "App", "getLaunchUrl").then((r: any) => {
    const url = String(r?.url || "");
    if (!url) return;
    try { if (sessionStorage.getItem("duo-go-launch") === url) return; sessionStorage.setItem("duo-go-launch", url); } catch { /* act on it */ }
    run(url);
  }).catch(() => {});
  void nativeListen("App", "appUrlOpen", (e: any) => run(e?.url));
}
