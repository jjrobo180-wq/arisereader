// Arise To Duo: where a tap on a Home Screen widget goes. The widgets open the app with an arisetodo:// link
// (client/src/lib/duoWidgets.ts makes them): "open?s=calendar" opens a LifeHub section, and "link?u=…" (a link on
// the Link page widget) opens that web address in Safari. Focus timer links (arisetodo://focus/…) are duoFocus.ts's.
import { isNativeApp, nativeCall, nativeFlavor, nativeListen, openOutside } from "@/lib/nativeApp";

/** The Arise To Duo iPhone app (the one with these widgets). */
export const isTodoApp = () => isNativeApp() && nativeFlavor() === "todo";

export type DuoLink = { kind: "section"; section: string } | { kind: "web"; url: string };

/** What an arisetodo:// widget link asks for, or null for anything else. */
export function readDuoLink(url: string): DuoLink | null {
  const m = /^arisetodo:\/\/(open|link)\/?\?(.*)$/i.exec(String(url || "").trim());
  if (!m) return null;
  const q = new URLSearchParams(m[2]);
  if (m[1].toLowerCase() === "open") {
    const section = (q.get("s") || "").trim();
    return /^[a-z][a-z0-9-]{0,40}$/i.test(section) ? { kind: "section", section } : null;
  }
  const u = (q.get("u") || "").trim();
  return /^https?:\/\/[^\s"<>]{3,2000}$/i.test(u) ? { kind: "web", url: u } : null;
}

/** A web address a widget tapped straight to (older Link widgets): plain http(s), but never this app's own site. */
export function widgetWebUrl(url: string): string {
  const u = String(url || "").trim();
  if (!/^https?:\/\/[^\s"<>]{3,2000}$/i.test(u)) return "";
  try { if (/(^|\.)(arisetodo\.com|arisereader\.com|localhost)$/i.test(new URL(u).hostname)) return ""; } catch { return ""; }
  return u;
}

let handled = "";
/** Listens for widget taps on a section (and the link the app was opened with); `open` shows it. LifeHub's. */
export function listenForDuoLinks(open: (section: string) => void): void {
  const run = (url?: string, launch = false) => {
    const link = url ? readDuoLink(url) : null;
    if (!link || link.kind !== "section") return;
    // The launch link is read once: coming back to the app later must not open it again.
    if (launch) { if (handled === url) return; handled = url!; }
    open(link.section);
  };
  nativeCall(/^App$/, "App", "getLaunchUrl").then((r: any) => run(r?.url, true)).catch(() => {});
  void nativeListen("App", "appUrlOpen", (e: any) => run(e?.url));
}

/** Link widget taps open Safari from anywhere in the app (WorkHub, LifeHub, any screen): set once at start-up (main.tsx). */
export function listenForWidgetWebLinks(): void {
  let last = "";
  const run = (url?: string, launch = false) => {
    const link = url ? readDuoLink(url) : null;
    const web = link?.kind === "web" ? link.url : widgetWebUrl(url || "");
    if (!web) return;
    if (launch) { try { if (sessionStorage.getItem("duo-web-launch") === url) return; sessionStorage.setItem("duo-web-launch", url!); } catch { /* open it */ } }
    const key = `${url}@${Math.floor(Date.now() / 2000)}`;
    if (key === last) return;
    last = key;
    openOutside(web);
  };
  nativeCall(/^App$/, "App", "getLaunchUrl").then((r: any) => run(r?.url, true)).catch(() => {});
  void nativeListen("App", "appUrlOpen", (e: any) => run(e?.url));
}
