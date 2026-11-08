// The Notes iPhone app's widgets (notes/ios-app/widgets/NotesWidgets.swift): what they show, and where
// a tap on one goes. The widgets get titles and short previews of your latest notes and recordings
// (locked notes only as "Locked note"); a tap opens an arisenotes:// link, handled here.
import type { PageMeta } from "@shared/arisePages";
import { pageTitle } from "@shared/arisePages";
import { hasNativePlugin, isNotesApp, nativeCall, nativeListen } from "@/lib/nativeApp";
import type { Route } from "./NotesApp";

const PLUGIN = /arise.?on.?device/i;
let pages: PageMeta[] = [];
let ai: { id: string; title: string; createdAt: string; status?: string }[] = [];
let signedIn = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let last = "";

function publish() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    if (!isNotesApp() || !hasNativePlugin(PLUGIN)) return;
    const live = pages.filter((p) => !p.deletedAt).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
    const json = JSON.stringify({
      signedIn,
      pages: live.map((p) => ({ id: p.id, title: pageTitle(p as any).slice(0, 80), preview: p.locked ? "" : (p.preview || "").slice(0, 120), color: p.color ? p.color.replace("#", "") : null, kind: p.kind, locked: p.locked, pinned: p.pinned, edited: Date.parse(p.updatedAt) || Date.now() })),
      ai: ai.filter((n) => n.status !== "recording").slice(0, 4).map((n) => ({ id: n.id, title: (n.title || "Recording").slice(0, 80), when: Date.parse(n.createdAt) || Date.now() })),
    });
    if (json === last) return;
    last = json;
    void nativeCall(PLUGIN, "AriseOnDevice", "widgetSave", { json }).catch(() => { last = ""; });
  }, 1500);
}
export function widgetPages(list: PageMeta[]) { pages = list; signedIn = true; publish(); }
export function widgetAi(list: typeof ai) { ai = list; signedIn = true; publish(); }
export function widgetSignedOut() { pages = []; ai = []; signedIn = false; publish(); }

/** Where an arisenotes:// link goes. "new" and "draw" open the Notes tab with a new note. */
export function routeOfLink(url: string): Route | null {
  const m = /^arisenotes:\/\/([a-z]+)(?:\/([A-Za-z0-9-]+))?/i.exec(url.trim());
  if (!m) return null;
  const [, what, id] = m;
  switch (what.toLowerCase()) {
    case "record": return { name: "record" };
    case "memo": return { name: "memo" };
    case "upload": return { name: "upload" };
    case "notes": return { name: "pages" };
    case "new": case "draw": try { sessionStorage.setItem("arise-pages-new", what.toLowerCase() === "draw" ? "ink" : "text"); } catch { /* opens the list */ } return { name: "pages" };
    case "page": return id ? { name: "page", id } : { name: "pages" };
    case "ai": return id ? { name: "note", id } : { name: "home" };
    default: return null;
  }
}

/** Listens for widget taps (and the link the app was opened with). */
export function listenForLinks(go: (r: Route) => void) {
  if (!isNotesApp()) return;
  const run = (url?: string) => {
    const r = url ? routeOfLink(url) : null;
    if (!r) return;
    go(r);
    // The Notes tab may already be open: tell it a new note was asked for.
    setTimeout(() => window.dispatchEvent(new Event("arise-pages-new")), 50);
  };
  nativeCall(/^App$/, "App", "getLaunchUrl").then((r: any) => run(r?.url)).catch(() => {});
  void nativeListen("App", "appUrlOpen", (e: any) => run(e?.url));
}
