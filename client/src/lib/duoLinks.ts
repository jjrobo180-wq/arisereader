// Arise To Duo: where a tap on a Home Screen widget goes. The widgets open the app with an arisetodo:// link
// (client/src/lib/duoWidgets.ts makes them): "open?s=calendar" opens a LifeHub section, and "link?u=…" (a link on
// the Link page widget) opens that web address in Safari. Focus timer links (arisetodo://focus/…) are duoFocus.ts's.
import { nativeCall, nativeListen, openOutside } from "@/lib/nativeApp";

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

let handled = "";
/** Listens for widget taps (and the link the app was opened with); `open` shows a section. */
export function listenForDuoLinks(open: (section: string) => void): void {
  const run = (url?: string, launch = false) => {
    const link = url ? readDuoLink(url) : null;
    if (!link) return;
    // The launch link is read once: coming back to the app later must not open it again.
    if (launch) { if (handled === url) return; handled = url!; }
    if (link.kind === "section") open(link.section);
    else openOutside(link.url);
  };
  nativeCall(/^App$/, "App", "getLaunchUrl").then((r: any) => run(r?.url, true)).catch(() => {});
  void nativeListen("App", "appUrlOpen", (e: any) => run(e?.url));
}
