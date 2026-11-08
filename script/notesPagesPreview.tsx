// A preview of Arise Notes' Notes tab (typed and handwritten notes) for the App Store screens workflow
// (script/appStoreScreens.mjs): Notes needs an account, so this page seeds this browser's own copy of
// the notes (IndexedDB, as the app keeps it) with made-up notes and folders and draws the real screen.
// Not part of any app. ?pane=folders|list&view=list|grid&dark=1&look=<id>
import type { CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_LOOK, DEFAULT_SETTINGS, type Page } from "@shared/arisePages";
import { themeOf, themeVars } from "@shared/ariseNotes";
import PagesView from "@/components/arise-notes/pages/PagesView";
import { LookTabBar } from "@/components/arise-notes/looks";
import "@/components/arise-notes/notes.css";
import "@/components/arise-notes/notes-themes.css";

const q = new URLSearchParams(location.search), USER = 7;
const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
const FOLDERS = [{ id: "0f1c2d3e-0000-4000-8000-000000000001", name: "Work", color: "#0ea5e9", icon: "📁", sort: 0 }, { id: "0f1c2d3e-0000-4000-8000-000000000002", name: "School", color: "#10b981", icon: "📁", sort: 1 }, { id: "0f1c2d3e-0000-4000-8000-000000000003", name: "Home", color: "#f59e0b", icon: "📁", sort: 2 }];
const page = (id: string, title: string, preview: string, h: number, folderId = "", extra: Partial<Page> = {}): Page => ({ id, kind: "text", folderId, color: "", pinned: false, tags: [], locked: false,
  content: { title, html: `<p>${preview}</p>`, ink: [], look: DEFAULT_LOOK }, cipher: null, preview, search: "", rev: 1, createdAt: ago(h + 2), updatedAt: ago(h), deletedAt: null, ...extra });
const PAGES = [
  page("1a2b3c4d-0000-4000-8000-000000000001", "Q4 planning", "Budget review moves to Thursday. Maya owns the hiring plan; finance needs numbers by the 15th.", 1, "0f1c2d3e-0000-4000-8000-000000000001", { pinned: true }),
  page("1a2b3c4d-0000-4000-8000-000000000002", "Parent-teacher conference", "Reading is up two levels. Practice fractions at home, 15 minutes a night.", 3, "0f1c2d3e-0000-4000-8000-000000000002"),
  page("1a2b3c4d-0000-4000-8000-000000000003", "Groceries", "Oat milk, spinach, eggs, rice, lemons, coffee beans", 5, "0f1c2d3e-0000-4000-8000-000000000003"),
  page("1a2b3c4d-0000-4000-8000-000000000004", "Interview notes: design lead", "Strong portfolio, clear on research. Follow up on team size and timeline.", 26, "0f1c2d3e-0000-4000-8000-000000000001"),
  page("1a2b3c4d-0000-4000-8000-000000000005", "Sketch: kitchen layout", "Handwritten note", 30, "0f1c2d3e-0000-4000-8000-000000000003", { kind: "ink" }),
  page("1a2b3c4d-0000-4000-8000-000000000006", "Book ideas", "A lighthouse keeper who records the weather for forty years.", 52),
  page("1a2b3c4d-0000-4000-8000-000000000007", "Passwords and codes", "Locked", 70, "", { locked: true }),
];

async function seed() {
  await new Promise<void>((done) => {
    const req = indexedDB.open(`arise-pages-${USER}`, 1);
    req.onupgradeneeded = () => { const d = req.result; d.createObjectStore("pages", { keyPath: "id" }); d.createObjectStore("kv"); };
    req.onsuccess = () => {
      const t = req.result.transaction(["pages", "kv"], "readwrite");
      for (const p of PAGES) { const { content, cipher: _c, search: _s, ...rest } = p; t.objectStore("pages").put({ id: p.id, meta: { ...rest, content: { title: content.title, html: "", ink: [], look: content.look }, title: content.title }, page: p, dirty: false, baseRev: 1 }); }
      t.objectStore("kv").put({ ...DEFAULT_SETTINGS, folders: FOLDERS, prefs: { ...DEFAULT_SETTINGS.prefs, view: q.get("view") === "grid" ? "grid" : "list" } }, "settings");
      t.oncomplete = () => done(); t.onerror = () => done();
    };
    req.onerror = () => done();
  });
  try { localStorage.setItem("arise-pages-pane", q.get("pane") === "list" ? "list" : "folders"); localStorage.setItem("arise-pages-filter", JSON.stringify({ kind: "all" })); } catch { /* none */ }
}

const look = themeOf(q.get("look") || "tide"), dark = q.get("dark") === "1";
const ctx = { me: { user: { id: USER, name: "Sam" }, settings: { theme: look.id }, features: {} }, go: () => {}, refreshMe: async () => null, refreshNotes: () => {}, mode: "cloud", hub: "life", setGuard: () => {} } as any;
void seed().then(() => createRoot(document.getElementById("root")!).render(
  // As the app draws the Notes tab: the professional look, light or dark, whatever the look is.
  <div className={`an-root an-pro${dark ? " an-pro-dark" : ""}`} style={themeVars(look) as CSSProperties}>
    <PagesView ctx={ctx} openId={null} tabs={<LookTabBar on="pages" initial="S" home={() => {}} notes={() => {}} record={() => {}} settings={() => {}} />} />
  </div>));
