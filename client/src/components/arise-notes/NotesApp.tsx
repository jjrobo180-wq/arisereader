// Arise Notes: the app. The same screens run on their own at /notes/ (client/src/notes/main.tsx) and
// inside Arise To Duo (pages/AriseNotesPage.tsx): Home with the notes, Record, Upload, a note, Ask
// your notes, Voice memo, and Settings (plan and minutes, family, privacy, accessibility).
import AllAccessPopup from "@/components/AllAccessPopup";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { NoteTypeIcon } from "./NoteIcon";
import { NotesDock } from "./NotesDock";
import { ArrowRight, AudioLines, ChevronLeft, Columns2, Folder, LayoutGrid, Loader2, Lock, Mic, MessageCircle, Pencil, Search, Settings, Sparkles, Upload, Users, Zap } from "lucide-react";
import { hasAppearance, setAppearance, useAppearance } from "./appearance";
import { useAuth } from "@/context/AuthContext";
import { startApplePush } from "@/lib/applePush";
import { isNotesApp, nativeCall } from "@/lib/nativeApp";
import { NOTES_PLANS, SUITE_LOOKS, dayWords, fmtClock, nightLook, templateOf, themeOf, themeVars } from "@shared/ariseNotes";
import { notesApi, setNotesToken, type ListNote, type Me } from "./api";
import { setNotesLookup } from "@/undercover/askUndercover";
import { listLocalNotes, type LocalNote } from "./localNotes";
import { listenForLinks, widgetAi, widgetPages } from "./widgetLinks";
import { newPageId, pagesSyncFor } from "./pages/pagesSync";
import { DEFAULT_LOOK } from "@shared/arisePages";
import { publishWatch, removeWatchFile, watchActions, watchFile } from "@/lib/watch";
import { queueWatchRecording } from "./watchRecordings";
import { Btn, IconBtn, Notice, Spinner, ToastHost, plural, shortDate, useToast } from "./ui";
import { LookHomeHero, LookNoteList, activeLook } from "./looks";
import { archClass } from "./protoLooks";
import { useContrastGuard } from "@/lib/contrastGuard";
import "./notes.css";
import "./notes-themes.css";

const RecordScreen = lazy(() => import("./RecordScreen"));
const UploadScreen = lazy(() => import("./UploadScreen"));
const NoteScreen = lazy(() => import("./NoteScreen"));
const MemoScreen = lazy(() => import("./MemoScreen"));
import { AppsStrip } from "./notesAppsCatalog";
const SettingsScreen = lazy(() => import("./SettingsScreen"));
const PrivacyPage = lazy(() => import("./PrivacyPage"));
const LocalNoteScreen = lazy(() => import("./LocalNoteScreen"));
const PagesView = lazy(() => import("./pages/PagesView"));
// The App Gallery and its apps (Sticky Notes, Sheets, Slides, Docs, Flashcards, Checklists, Focus Timer, Whiteboard).
const AppsScreen = lazy(() => import("./NotesApps").then((m) => ({ default: m.AppsScreen })));
const AppScreen = lazy(() => import("./NotesApps").then((m) => ({ default: m.AppScreen })));

export type Route =
  | { name: "home" } | { name: "record" } | { name: "upload" } | { name: "note"; id: string; t?: number } | { name: "ask" } | { name: "memo" }
  /** Undercover: AI chat that looks like texting or a document (client/src/undercover/UndercoverApp.tsx). */
  | { name: "undercover" }
  | { name: "settings"; tab?: "plan" | "look" | "family" | "privacy" | "access" } | { name: "privacy" }
  /** A Strict-mode note, kept only on this iPhone (localNotes.ts). */
  | { name: "local"; id: string }
  /** The Notes tab: typed and handwritten notes (pages/PagesView.tsx), and one of them open. */
  | { name: "pages" } | { name: "page"; id: string }
  /** The App Gallery, and one app from it open. */
  | { name: "apps" } | { name: "app"; id: string };
export type Go = (r: Route) => void;
export type AppCtx = {
  me: Me;
  refreshMe: () => Promise<Me | null>;
  refreshNotes: () => void;
  go: Go;
  mode: "standalone" | "embedded";
  hub: "life" | "work";
  /** While recording: asks before leaving the screen. */
  setGuard: (g: (() => boolean) | null) => void;
};

function parseHash(h: string): Route {
  const p = h.replace(/^#\/?/, "").split("?")[0].split("/").filter(Boolean);
  switch (p[0]) {
    case "record": return { name: "record" };
    case "upload": return { name: "upload" };
    case "home": case "recordings": return { name: "pages" };
    case "note": return p[1] ? { name: "note", id: p[1], t: p[2] ? Number(p[2]) : undefined } : { name: "pages" };
    case "ask": return { name: "ask" };
    case "undercover": return { name: "undercover" };
    case "memo": return { name: "memo" };
    case "settings": return { name: "settings", tab: (["plan", "look", "family", "privacy", "access"] as const).find((t) => t === p[1]) };
    case "usage": case "plans": return { name: "settings", tab: "plan" };
    case "family": return { name: "settings", tab: "family" };
    case "privacy": return { name: "privacy" };
    case "local": return p[1] ? { name: "local", id: p[1] } : { name: "pages" };
    case "pages": return { name: "pages" };
    case "page": return p[1] ? { name: "page", id: p[1] } : { name: "pages" };
    case "apps": return { name: "apps" };
    case "app": return p[1] ? { name: "app", id: p[1] } : { name: "apps" };
    // The Notes tab is the main page (November 2026); the recorded meetings list is "Recordings" (#/home).
    default: return { name: "pages" };
  }
}
const hashOf = (r: Route) => r.name === "home" ? "#/home" : r.name === "local" ? `#/local/${r.id}` : r.name === "page" ? `#/page/${r.id}` : r.name === "app" ? `#/app/${r.id}` : r.name === "note" ? `#/note/${r.id}${r.t !== undefined ? `/${Math.round(r.t)}` : ""}` : r.name === "settings" ? `#/settings${r.tab ? `/${r.tab}` : ""}` : `#/${r.name}`;

let lexendLoaded = false;
const loadLexend = () => {
  if (lexendLoaded || typeof document === "undefined") return;
  lexendLoaded = true;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap";
  document.head.appendChild(l);
};
const loadedFonts = new Set<string>();
/** A Suite look's colors and type for the Notes tab, as --sx-* (notes-suite.css hands them to the screens). */
const suiteVars = (t: ReturnType<typeof themeOf>): CSSProperties => Object.fromEntries(Object.entries(themeVars(t)).map(([k, v]) => [k.replace("--an-", "--sx-"), v])) as CSSProperties;
const loadThemeFont = (href?: string) => {
  if (!href || loadedFonts.has(href) || typeof document === "undefined") return;
  loadedFonts.add(href);
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = href;
  document.head.appendChild(l);
};

export default function NotesApp(props: { mode: "standalone" | "embedded"; hub?: "life" | "work"; onExit?: () => void; startNote?: string }) {
  return <ToastHost><Shell {...props} /></ToastHost>;
}

function Shell({ mode, hub = "life", onExit, startNote }: { mode: "standalone" | "embedded"; hub?: "life" | "work"; onExit?: () => void; startNote?: string }) {
  const { token, user } = useAuth();
  // The All Access pop-up waits until Notes has been open a little while (Notes has no tutorial).
  const [notesSettled, setNotesSettled] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setNotesSettled(true), 20000); return () => window.clearTimeout(t); }, []);
  const say = useToast();
  const tokenRef = useRef(token);
  tokenRef.current = token;
  useEffect(() => { setNotesToken(() => tokenRef.current); }, []);
  // Every AI in Notes answers from the person's notes and the web together (askUndercover.ts).
  useEffect(() => {
    setNotesLookup(async (question) => {
      const day = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
      const r = await notesApi.ask(question, day);
      if (!r?.found || !r.answer) return null;
      const titles = [...new Set((r.cites || []).map((c) => c.title).filter(Boolean))].slice(0, 4).join("; ");
      return `${r.answer.replace(/\[\d{1,2}\]/g, "").trim()}${titles ? ` (from: ${titles})` : ""}`;
    });
    return () => setNotesLookup(null);
  }, []);
  // The Notes iPhone app: notifications (80% of the minutes used, out of minutes, and messages from
  // the rest of Arise to this account). iOS asks once.
  useEffect(() => { if (isNotesApp() && user) void startApplePush(true); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [meRaw, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<ListNote[] | null>(null);
  const [route, setRoute] = useState<Route>(() => {
    if (mode !== "standalone") return startNote ? { name: "note", id: startNote } : { name: "pages" };
    // Opening the app with no address goes back to the tab you were on.
    const bare = !window.location.hash || window.location.hash === "#/" || window.location.hash === "#/signin";
    return bare ? { name: "pages" } : parseHash(window.location.hash);
  });
  useEffect(() => { if (route.name === "pages" || route.name === "page") rememberTab("pages"); else if (route.name === "home") rememberTab("ai"); }, [route.name]);
  const guard = useRef<(() => boolean) | null>(null);

  const refreshMe = useCallback(async () => {
    try { const m = await notesApi.me(); setMe(m); setError(""); return m; }
    catch (e: any) { setError(e.message); return null; }
  }, []);
  const refreshNotes = useCallback(() => { notesApi.list().then((r) => setNotes(r.notes)).catch(() => setNotes((n) => n ?? [])); }, []);
  useEffect(() => { if (token) { void refreshMe(); refreshNotes(); } }, [token, user?.id, refreshMe, refreshNotes]);

  // Back from Stripe's payment page: confirm the plan, then show it.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("paid");
    if (!id || !token) return;
    const url = new URL(window.location.href); url.searchParams.delete("paid"); window.history.replaceState(null, "", url.toString());
    notesApi.confirmPaid(id).then(() => { say("Thank you! Your new plan is on."); void refreshMe(); }).catch((e) => say(e.message));
  }, [token, refreshMe, say]);

  const go = useCallback<Go>((r) => {
    if (guard.current && !guard.current()) return;
    guard.current = null;
    // "home" was the Recordings page, which is gone: every back button lands on the Notes page (with its own look).
    if (r.name === "home") r = { name: "pages" };
    setRoute(r);
    if (mode === "standalone") { if (window.location.hash !== hashOf(r)) window.history.pushState(null, "", hashOf(r)); }
    window.scrollTo({ top: 0 });
  }, [mode]);
  useEffect(() => {
    if (mode !== "standalone") return;
    const onPop = () => {
      const next = parseHash(window.location.hash);
      if (guard.current && !guard.current()) { window.history.pushState(null, "", hashOf(route)); return; }
      guard.current = null;
      setRoute(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [mode, route]);

  // The iPhone app's widgets: a tap opens the right screen, and they show your latest notes.
  useEffect(() => { listenForLinks(go); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (isNotesApp() && notes) widgetAi(notes); }, [notes]);
  useEffect(() => { if (isNotesApp() && user?.id) return pagesSyncFor(Number(user.id)).subscribe((snap) => widgetPages(snap.metas)); }, [user?.id]);
  // Apple Watch (native/notes-watch): your latest notes to read, and new ones dictated on the watch.
  useEffect(() => {
    if (!isNotesApp() || !user?.id) return;
    let meetings: { id: string; title: string; text: string; at: string }[] = [];
    let pages: { id: string; title: string; text: string; at: string }[] = [];
    const send = () => publishWatch({ pages, meetings });
    meetings = (notes ?? []).slice(0, 15).map((n) => ({ id: n.id, title: (n.title || "Meeting").slice(0, 80), text: (n.gist || "").slice(0, 600), at: n.createdAt }));
    const stop = pagesSyncFor(Number(user.id)).subscribe((snap) => {
      pages = snap.metas.filter((m) => !m.deletedAt && !m.locked).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 25)
        .map((m) => ({ id: m.id, title: (m.title || "Note").slice(0, 80), text: (m.preview || "").slice(0, 600), at: m.updatedAt }));
      send();
    });
    return stop;
  }, [user?.id, notes]);
  useEffect(() => {
    if (!isNotesApp() || !user?.id) return;
    return watchActions((actions) => {
      const sync = pagesSyncFor(Number(user.id));
      // Meetings recorded on the watch: written down like an uploaded recording (UploadScreen picks them up).
      const recs = actions.filter((a) => a.type === "recording" && typeof a.path === "string");
      if (recs.length) {
        void (async () => {
          let got = 0;
          for (const a of recs) {
            const blob = await watchFile(a.path as string);
            if (!blob) continue;
            const at = new Date(Number(a.at) || Date.now());
            const title = typeof a.title === "string" && a.title.trim() ? a.title.trim().slice(0, 140) : `Meeting ${at.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
            queueWatchRecording({ file: new File([blob], `${title.replace(/[^\w .-]+/g, " ").trim() || "Watch recording"}.m4a`, { type: blob.type || "audio/mp4" }), title, path: a.path as string });
            got++;
          }
          if (got) go({ name: "upload" });
        })();
      }
      for (const a of actions) {
        if (a.type !== "add" || typeof a.text !== "string" || !a.text.trim()) continue;
        const text = a.text.trim().slice(0, 5000), now = new Date(a.at || Date.now()).toISOString();
        const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const title = text.split(/[.!?\n]/)[0].slice(0, 60);
        sync.save({ id: newPageId(), kind: "text", folderId: "", color: "", pinned: false, tags: ["watch"], locked: false,
          content: { title, html: `<p>${esc}</p>`, ink: [], look: DEFAULT_LOOK }, cipher: null,
          preview: text.replace(/\s+/g, " ").slice(0, 240), search: "", rev: 0, createdAt: now, updatedAt: now, deletedAt: null });
      }
    });
  }, [user?.id]);

  // Day / Night / Auto (Auto is the default and follows the phone). One answer for the whole app: the old
  // "Night mode" switch used to color only some screens, so the writing area stayed white. Someone who had
  // Night mode on keeps it as a Night choice the first time.
  const appearance = useAppearance();
  useEffect(() => { if (meRaw?.settings.night && !hasAppearance()) setAppearance("dark"); }, [meRaw?.settings.night]);
  const me = useMemo(() => (meRaw ? { ...meRaw, settings: { ...meRaw.settings, night: appearance.dark } } : null), [meRaw, appearance.dark]);
  const s = me?.settings;
  useEffect(() => { if (s?.font === "dyslexic") loadLexend(); }, [s?.font]);
  // High contrast is an accessibility need, so it always wins over a look.
  const look = s?.night ? nightLook(themeOf(s?.theme)) : themeOf(s?.theme);
  // The Notes tab (typed and handwritten notes) always has a plain, professional look: neutral surfaces,
  // the system's own type and real folders. Dark when the look or night mode is dark.
  // Every screen has the same plain look (Ask paints its own, in the look chosen in Undercover).
  const pro = route.name !== "ask" && route.name !== "undercover" && !s?.contrast;
  // Light / Dark / Auto (Auto follows the phone). Light and Dark are a deliberate choice, so they win over the look.
  // The Suite looks (Paper, Midnight, Folio, Nordic, Carbon) carry on into the Notes tab and the writing
  // page: their colors and type replace the neutral ones there (notes-suite.css).
  const suite = SUITE_LOOKS.has(look.id) && !s?.contrast;
  // Every other look dresses the Notes tab and the writing page too (they stayed plain gray and white,
  // though the look's preview shows its colors everywhere).
  const proLook = pro && !suite && !s?.contrast && (look.id !== "classic" || !!s?.night);
  const proDark = pro && (suite || proLook ? !!look.dark : appearance.mode === "dark" ? true : appearance.mode === "light" ? false : appearance.dark || !!s?.night || (look.id !== "classic" && !!look.dark));
  const themed = !pro && !s?.contrast && (look.id !== "classic" || !!s?.night);
  useEffect(() => { if (themed || suite || proLook) loadThemeFont(look.fontUrl); }, [themed, suite, proLook, look.fontUrl]);
  // The areas around the page (behind the status bar and Home indicator) match the look.
  const backdrop = s?.contrast ? "#ffffff" : proLook && route.name === "page" ? look.card : suite || proLook ? look.bg : pro ? (proDark ? "#0f0f11" : route.name === "pages" || route.name === "page" ? "#ffffff" : "#f2f2f7") : themed ? look.bg : "#f5f4fb";
  const darkBackdrop = pro ? proDark : themed && !!look.dark;
  // Ask (Undercover) paints its own top strip in its look's color, so the app doesn't paint over it.
  const bare = route.name === "ask" || route.name === "undercover";
  useEffect(() => {
    if (bare) return;
    const html = document.documentElement, body = document.body;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const before = [html.style.background, body.style.background, meta?.content];
    // The strip behind the status bar takes the page's own painted color, so the top of the app runs all the way up.
    let paint = backdrop;
    try {
      const root = document.querySelector<HTMLElement>('[data-testid="arise-notes"]');
      const c = root ? getComputedStyle(root).backgroundColor : "";
      if (c && !/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)|transparent/i.test(c)) paint = c;
    } catch { /* keep the guess */ }
    html.style.background = paint;
    body.style.background = paint;
    if (meta) meta.content = paint;
    // The page doesn't stretch past its ends, so the bottom bar and the top stay put.
    const overscroll = [html.style.overscrollBehavior, body.style.overscrollBehavior];
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    if (isNotesApp()) {
      void nativeCall(/ariseondevice/i, "AriseOnDevice", "setBackdrop", { color: paint }).catch(() => {});
      void nativeCall(/statusbar/i, "StatusBar", "setStyle", { style: darkBackdrop ? "DARK" : "LIGHT" }).catch(() => {});
    }
    return () => { html.style.background = before[0] ?? ""; body.style.background = before[1] ?? ""; if (meta && before[2]) meta.content = before[2]; html.style.overscrollBehavior = overscroll[0]; body.style.overscrollBehavior = overscroll[1]; };
  }, [backdrop, darkBackdrop, route.name, bare]);
  const rootClass = ["an-root min-h-[100dvh]", bare && "an-bare", s?.font === "dyslexic" && "an-dyslexic", s?.simple && "an-simple", s?.contrast && "an-contrast", s?.night && !s?.contrast && !pro && "an-night", s?.large && "an-large", pro && "an-pro", proDark && "an-pro-dark", themed && "an-themed", themed && `an-theme-${look.id}${archClass(look)}`, suite && "an-suite", suite && `an-suite-${look.id}`, suite && look.dark && "an-suite-dark", proLook && `an-prolook${archClass(look)}`, proLook && look.dark && "an-prolook-dark"].filter(Boolean).join(" ");
  const rootStyle = themed ? themeVars(look) as CSSProperties : suite || proLook ? suiteVars(look) : undefined;
  // The safety net: any words that end up the same color as what is behind them are switched to one that reads.
  useContrastGuard(true, `${rootClass}|${route.name}`, themed || suite || proLook ? [look.ink, look.bg] : []);

  if (!me) {
    return <div className={rootClass}>
      {error ? <div className="mx-auto max-w-md p-6 pt-24"><Notice tone="bad" action={<Btn kind="primary" onClick={() => void refreshMe()}>Try again</Btn>}>{error}</Notice></div> : <div className="pt-32"><Spinner label="Opening Arise Notes" /></div>}
    </div>;
  }
  const ctx: AppCtx = { me, refreshMe, refreshNotes, go, mode, hub: me.settings.hub === "work" && me.user.workHub ? "work" : hub, setGuard: (g) => { guard.current = g; } };
  const screen = (() => {
    switch (route.name) {
      case "record": return <RecordScreen ctx={ctx} />;
      case "upload": return <UploadScreen ctx={ctx} />;
      case "note": return <NoteScreen key={route.id} ctx={ctx} id={route.id} at={route.t} />;
      // Ask is only the chat or note in the look chosen in Undercover: no toggles, no suggestion buttons.
      case "ask": return <AppScreen key="undercover" ctx={ctx} id="undercover" ask />;
      case "undercover": return <AppScreen key="undercover" ctx={ctx} id="undercover" ask />;
      case "memo": return <MemoScreen ctx={ctx} />;
      case "settings": return <SettingsScreen ctx={ctx} tab={route.tab} />;
      case "privacy": return <PrivacyPage onBack={() => go({ name: "settings", tab: "privacy" })} />;
      case "local": return <LocalNoteScreen key={route.id} ctx={ctx} id={route.id} />;
      case "pages": return <PagesView ctx={ctx} openId={null} recorded={notes ?? []} tabs={<TabBar ctx={ctx} on="pages" />} />;
      case "page": return <PagesView ctx={ctx} openId={route.id} recorded={notes ?? []} tabs={<TabBar ctx={ctx} on="pages" />} />;
      case "apps": return <AppsScreen ctx={ctx} />;
      case "app": return <AppScreen key={route.id} ctx={ctx} id={route.id} />;
      default: return <PagesView ctx={ctx} openId={null} recorded={notes ?? []} tabs={<TabBar ctx={ctx} on="pages" />} />; // "home" (the old Recordings page) is gone: Notes is the main page
    }
  })();
  return <div className={rootClass} style={rootStyle} data-testid="arise-notes">
    <Suspense fallback={<div className="pt-32"><Spinner /></div>}>{screen}</Suspense>
    {/* Notes has no tutorial: the All Access pop-up comes once, a little after the first open (iPhone app only). */}
    {mode === "standalone" && <AllAccessPopup userId={user?.id} token={token} ready={notesSettled} intro="Arise Notes is free, with 60 minutes of AI a month. Arise All Access gives you 1,500 minutes, plus the extras in To Duo, Fit and Podster." />}
  </div>;
}

// ─── Shared bits of every screen ──────────────────────────────────────────────

export function Logo({ size = 36 }: { size?: number }) {
  return <span aria-hidden className="an-logo grid shrink-0 place-items-center rounded-[11px] text-white shadow-sm" style={{ width: size, height: size }}>
    <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 10v4M9 7v10M13 4v16M17 8v8M21 11v2" /></svg>
  </span>;
}

export function TopBar({ ctx, title, back, right }: { ctx: AppCtx; title?: ReactNode; back?: () => void; right?: ReactNode }) {
  return <header className="an-noprint sticky top-0 z-30 border-b border-[var(--an-line)] bg-[color-mix(in_srgb,var(--an-bg)_88%,transparent)] pt-[var(--sat,env(safe-area-inset-top,0px))] backdrop-blur-xl">
    <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3 sm:px-5">
      {back ? <IconBtn label="Back" onClick={back}><ChevronLeft className="h-6 w-6" /></IconBtn> : <Logo size={34} />}
      <div className="min-w-0 flex-1 truncate text-[17px] font-bold tracking-tight">{title ?? "Arise Notes"}</div>
      {right}
    </div>
  </header>;
}

export function MinutesPill({ ctx }: { ctx: AppCtx }) {
  const u = ctx.me.usage;
  const tone = u.warn === 100 ? "bg-[var(--an-coral-soft)] text-[#9c1c2a]" : u.warn === 80 ? "bg-[var(--an-amber-soft)] text-[#7a4a04]" : "bg-white text-[var(--an-muted)] border border-[var(--an-line)]";
  return <button type="button" onClick={() => ctx.go({ name: "settings", tab: "plan" })} className={`hidden h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold sm:inline-flex ${tone}`} aria-label={`${u.left} minutes left this month. Open plan and minutes.`}>
    <span className="font-bold">{ctx.me.planName}</span><span aria-hidden>·</span>{plural(u.left, "min")} left
  </button>;
}

/** The out-of-minutes and 80% banners. */
export function MinutesBanner({ ctx }: { ctx: AppCtx }) {
  const u = ctx.me.usage;
  if (!u.warn) return null;
  return <Notice tone={u.warn === 100 ? "bad" : "warn"} action={<Btn kind={u.warn === 100 ? "primary" : "soft"} onClick={() => ctx.go({ name: "settings", tab: "plan" })}>{ctx.me.plan === "family" || ctx.me.plan === "plus" ? "See minutes" : "Upgrade"}</Btn>}>
    {u.warn === 100 ? <>Out of minutes: upgrade or wait until {dayWords(u.resetOn)}. New recordings are still saved, and written down when minutes come back.</> : <>You've used {u.pct}% of this month's minutes ({u.used.toLocaleString("en-US")} of {u.allowance.toLocaleString("en-US")}). They start again on {dayWords(u.resetOn)}.</>}
  </Notice>;
}

/** Opens Arise To Duo's split screen with Notes on one side and the to-do list on the other. */
export function openSplit(mode: "standalone" | "embedded", right: "tasks" | "calendar" | "workhub" = "tasks") {
  try { localStorage.setItem("arise_duo_split_v1", JSON.stringify({ left: "arisenotes", right })); } catch { /* the split opens with its own picks */ }
  if (mode === "embedded") window.location.hash = "#/duo";
  else window.location.assign(/^(www\.)?arisetodo\.com$/i.test(window.location.hostname) ? "/app#/duo" : "/#/duo");
}

// ─── The two tabs: AI Notes (recordings) and Notes (typed and handwritten) ───
const TAB_KEY = "arise-notes-tab";
const rememberTab = (t: "ai" | "pages") => { try { localStorage.setItem(TAB_KEY, t); } catch { /* not kept */ } };
export function TabBar({ ctx, on }: { ctx: AppCtx; on: "ai" | "pages" | "ask" | "menu" }) {
  // One bar in every look: Arise To Duo's floating pill (NotesDock.tsx). The look still colors the + button.
  return <NotesDock on={on} initial={(ctx.me.user.name || "A").trim().charAt(0).toUpperCase()} go={{
    home: () => ctx.go({ name: "home" }), notes: () => ctx.go({ name: "pages" }), record: () => ctx.go({ name: "record" }), upload: () => ctx.go({ name: "upload" }),
    memo: () => ctx.go({ name: "memo" }), ask: () => ctx.go({ name: "undercover" }), menu: () => ctx.go({ name: "settings" }),
    newNote: () => { try { sessionStorage.setItem("arise-notes-new", "1"); } catch { /* the list opens without the sheet */ } ctx.go({ name: "pages" }); window.dispatchEvent(new Event("arise-notes-new")); },
  }} />;
}

// ─── Home ────────────────────────────────────────────────────────────────────

function Home({ ctx, notes, onExit }: { ctx: AppCtx; notes: ListNote[] | null; onExit?: () => void }) {
  const [q, setQ] = useState("");
  // Strict-mode notes live only on this iPhone, so they're listed from here, not from the server.
  const [local, setLocal] = useState<LocalNote[]>([]);
  useEffect(() => { if (ctx.mode === "standalone") void listLocalNotes().then(setLocal); }, [notes, ctx.mode]);
  const [found, setFound] = useState<ListNote[] | null>(null);
  const [folder, setFolder] = useState<string>("");
  const [tag, setTag] = useState("");
  const say = useToast();
  useEffect(() => {
    if (!q.trim()) { setFound(null); return; }
    const t = setTimeout(() => { notesApi.list(q.trim()).then((r) => setFound(r.notes)).catch((e) => say(e.message)); }, 300);
    return () => clearTimeout(t);
  }, [q, say]);
  const all = found ?? notes ?? [];
  const folders = useMemo(() => [...new Set((notes ?? []).map((n) => n.folder).filter(Boolean))].sort(), [notes]);
  const tags = useMemo(() => [...new Set((notes ?? []).flatMap((n) => n.tags))].sort().slice(0, 12), [notes]);
  const shown = all.filter((n) => (folder === "__family" ? !n.mine || n.familyShared : !folder || n.folder === folder) && (!tag || n.tags.includes(tag)));
  const first = ctx.me.user.name.split(" ")[0];
  const exit = ctx.mode === "embedded" && onExit;
  const look = activeLook(ctx.me.settings);
  return <>
    {(!look || exit) && <TopBar ctx={ctx} back={exit ? onExit : undefined} title={exit ? <span className="flex items-center gap-2"><Logo size={26} />Arise Notes</span> : undefined}
      right={<>
        <IconBtn label="Ask your notes" onClick={() => ctx.go({ name: "ask" })}><MessageCircle className="h-5 w-5" /></IconBtn>
        <IconBtn label="Split screen with your to-do list" className="an-extra hidden md:grid" onClick={() => openSplit(ctx.mode, ctx.hub === "work" ? "workhub" : "tasks")}><Columns2 className="h-5 w-5" /></IconBtn>
        <IconBtn label="Menu" onClick={() => ctx.go({ name: "settings" })}><LayoutGrid className="h-5 w-5" /></IconBtn>
      </>} />}
    {/* Under the top bar (Notes inside a hub, with a look) the look's hero doesn't add the clock's space again. */}
    <main className={`mx-auto max-w-5xl space-y-4 px-4 pb-24 pt-4 sm:px-5 ${look && exit ? "an-under-bar" : ""}`}>
      {look ? <>
        <LookHomeHero look={look} a={{ first, minutes: <MinutesPill ctx={ctx} />, record: () => ctx.go({ name: "record" }), upload: () => ctx.go({ name: "upload" }), memo: () => ctx.go({ name: "memo" }), ask: () => ctx.go({ name: "ask" }), memoLocked: !ctx.me.features.memo, count: all.length, settings: () => ctx.go({ name: "settings" }), pages: () => ctx.go({ name: "pages" }) }} />
      <MinutesBanner ctx={ctx} />
      {!ctx.me.services.speech && <Notice tone="warn">Speech to text isn't switched on for this site yet, so recordings are saved but can't be written down.</Notice>}
      <AppsStrip ctx={ctx} />
      </> : <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-[var(--an-violet)]">Arise Notes</p>
          <h1 className="mt-0.5 text-[24px] font-extrabold leading-tight tracking-[-.02em] sm:text-[28px]">{first ? `Hi, ${first}.` : "Your notes"} What are we capturing?</h1>
        </div>
      </div>
      <MinutesBanner ctx={ctx} />
      {!ctx.me.services.speech && <Notice tone="warn">Speech to text isn't switched on for this site yet, so recordings are saved but can't be written down.</Notice>}

      <div className="grid gap-3 sm:grid-cols-3">
        <BigAction tone="record" icon={<Mic className="h-5 w-5" />} title="Record" text="A meeting, class or visit, live." onClick={() => ctx.go({ name: "record" })} testId="notes-record" />
        <BigAction tone="violet" icon={<Upload className="h-5 w-5" />} title="Upload" text="Audio or video, up to 2 hours." onClick={() => ctx.go({ name: "upload" })} testId="notes-upload" />
        <BigAction tone="amber" icon={<Zap className="h-5 w-5" />} title="Voice memo" text="Say it once, get a to-do." onClick={() => ctx.go({ name: "memo" })} locked={!ctx.me.features.memo} testId="notes-memo" />
      </div>

      <button type="button" onClick={() => ctx.go({ name: "ask" })} className="an-card flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:border-[var(--an-violet)]" data-testid="notes-ask-bar">
        <Sparkles className="h-5 w-5 shrink-0 text-[var(--an-violet)]" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--an-muted)]">Ask your notes: “What did I promise Maya's mom last month?”</span>
        <ArrowRight className="h-4 w-4 text-[var(--an-faint)]" aria-hidden />
      </button>
      <AppsStrip ctx={ctx} />
      </>}

      <section aria-labelledby="notes-heading" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="notes-heading" className="mr-auto text-[16px] font-bold tracking-tight">Your notes</h2>
          <label className="relative w-full sm:w-72">
            <span className="sr-only">Search notes</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--an-faint)]" aria-hidden />
            <input className="an-input an-search" placeholder="Search every note" value={q} onChange={(e) => setQ(e.target.value)} data-testid="notes-search" />
          </label>
        </div>
        {(folders.length > 0 || tags.length > 0 || ctx.me.family) && <div className="an-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <button type="button" className="an-chip" aria-pressed={!folder && !tag} onClick={() => { setFolder(""); setTag(""); }}>All</button>
          {folders.map((f) => <button key={f} type="button" className="an-chip" aria-pressed={folder === f} onClick={() => setFolder(folder === f ? "" : f)}><Folder className="h-3.5 w-3.5" aria-hidden />{f}</button>)}
          {ctx.me.family && <button type="button" className="an-chip" aria-pressed={folder === "__family"} onClick={() => setFolder(folder === "__family" ? "" : "__family")}><Users className="h-3.5 w-3.5" aria-hidden />Family</button>}
          {tags.map((t) => <button key={t} type="button" className="an-chip" aria-pressed={tag === t} onClick={() => setTag(tag === t ? "" : t)}>#{t}</button>)}
        </div>}
        {local.length > 0 && !q && <div className="space-y-2" data-testid="notes-local-list">
          <h3 className="flex items-center gap-1.5 text-[14px] font-bold text-[var(--an-violet-ink)]"><Lock className="h-4 w-4" aria-hidden />On this iPhone only</h3>
          <ul className="grid gap-3 md:grid-cols-2">{local.map((n) => <li key={n.id}>
            <button type="button" onClick={() => ctx.go({ name: "local", id: n.id })} className="an-card flex h-full w-full gap-3 p-4 text-left transition hover:border-[var(--an-violet)]" data-testid="notes-local-card">
              <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--an-violet-soft)] text-[var(--an-violet)]"><NoteTypeIcon id={templateOf(n.template).id} className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2"><span className="truncate text-[16px] font-bold">{n.title || "Untitled note"}</span><span className="shrink-0 rounded-full bg-[var(--an-violet-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--an-violet-ink)]">Strict</span></span>
                <span className="mt-0.5 block text-[13px] text-[var(--an-muted)]">{shortDate(n.createdAt)}{n.durationSecs ? ` · ${fmtClock(n.durationSecs)}` : ""} · {templateOf(n.template).label}</span>
                {n.summary?.summary && <span className="an-extra mt-1.5 line-clamp-2 block text-[14px] leading-snug text-[#3d3a52]">{n.summary.summary}</span>}
              </span>
            </button>
          </li>)}</ul>
        </div>}
        {notes === null ? <Spinner /> : shown.length ? (look ? <LookNoteList look={look} notes={shown} onOpen={(n) => ctx.go({ name: "note", id: n.id })} /> : <ul className="grid gap-2 md:grid-cols-2">{shown.map((n) => <NoteCard key={n.id} n={n} onOpen={() => ctx.go({ name: "note", id: n.id })} />)}</ul>)
          : q ? <p className="an-card px-5 py-8 text-center text-[15px] text-[var(--an-muted)]">Nothing matched “{q}”.</p>
            : <EmptyNotes ctx={ctx} />}
      </section>
      {ctx.mode === "standalone" && <p className="an-extra pt-4 text-center text-[13px] text-[var(--an-faint)]">Part of the A.R.I.S.E. family · <a className="font-semibold text-[var(--an-violet)] underline-offset-2 hover:underline" href={/^(www\.)?arisetodo\.com$/i.test(window.location.hostname) ? "/app#/lifehub" : "/#/lifehub"}>Open Arise To Duo</a> · <button type="button" className="font-semibold text-[var(--an-violet)] underline-offset-2 hover:underline" onClick={() => ctx.go({ name: "privacy" })}>Privacy</button></p>}
    </main>
  </>;
}

function BigAction({ tone, icon, title, text, onClick, locked, testId }: { tone: "record" | "violet" | "amber"; icon: ReactNode; title: string; text: string; onClick: () => void; locked?: boolean; testId: string }) {
  const bg = tone === "record" ? "bg-[var(--an-coral)] text-white" : tone === "violet" ? "bg-[var(--an-violet)] text-white" : "bg-[#f5a524] text-white";
  return <button type="button" onClick={onClick} data-testid={testId} className="an-card group flex items-center gap-3 p-3 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-28px_rgba(40,30,120,.6)] sm:flex-col sm:items-start sm:p-4">
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[14px] ${bg}`}>{icon}</span>
    <span className="min-w-0"><span className="flex items-center gap-2 text-[16px] font-bold">{title}{locked && <span className="rounded-full bg-[var(--an-amber-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--an-amber)]">Basic</span>}</span><span className="mt-0.5 block text-[13px] text-[var(--an-muted)]">{text}</span></span>
  </button>;
}

const STATUS: Record<string, { text: string; tone: string }> = {
  recording: { text: "Recording", tone: "bg-[var(--an-coral-soft)] text-[#9c1c2a]" },
  processing: { text: "Writing down…", tone: "bg-[var(--an-violet-soft)] text-[var(--an-violet-ink)]" },
  no_minutes: { text: "Out of minutes", tone: "bg-[var(--an-amber-soft)] text-[#7a4a04]" },
  failed: { text: "Needs a retry", tone: "bg-[var(--an-coral-soft)] text-[#9c1c2a]" },
};
function NoteCard({ n, onOpen }: { n: ListNote; onOpen: () => void }) {
  const st = STATUS[n.status];
  const t = templateOf(n.template);
  return <li>
    <button type="button" onClick={onOpen} className="an-card flex h-full w-full gap-3 p-3 text-left transition hover:border-[var(--an-violet)]" data-testid="notes-card">
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--an-violet-soft)] text-[var(--an-violet)]"><NoteTypeIcon id={n.source === "memo" ? "memo" : t.id} className="h-[18px] w-[18px]" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold">{n.title || "Untitled note"}</span>{st && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${st.tone}`}>{st.text}</span>}</span>
        <span className="mt-0.5 block text-[13px] text-[var(--an-muted)]">{shortDate(n.createdAt)}{n.durationSecs ? ` · ${fmtClock(n.durationSecs)}` : ""} · {n.source === "memo" ? "Voice memo" : t.label}{n.by ? ` · ${n.by}` : ""}</span>
        {n.gist && <span className="an-extra mt-1 line-clamp-1 block text-[13px] leading-snug text-[var(--an-muted)]">{n.gist}</span>}
        {(n.actions > 0 || n.folder) && <span className="an-extra mt-2 flex flex-wrap gap-1.5">{n.actions > 0 && <span className="rounded-full bg-[var(--an-green-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--an-green)]">{plural(n.actions, "to-do")}</span>}{n.folder && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{n.folder}</span>}</span>}
      </span>
    </button>
  </li>;
}

function EmptyNotes({ ctx }: { ctx: AppCtx }) {
  const p = NOTES_PLANS[ctx.me.plan];
  return <div className="an-card px-6 py-10 text-center">
    <div aria-hidden className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-[var(--an-violet-soft)] text-[var(--an-violet)]"><Mic className="h-7 w-7" /></div>
    <h3 className="text-[18px] font-bold">Your first note is one tap away</h3>
    <p className="mx-auto mt-1.5 max-w-sm text-[15px] leading-relaxed text-[var(--an-muted)]">Record a meeting or class, or upload a recording. You'll get a transcript with times, a summary and the to-dos, ready for your planner. {p.name} includes {plural(p.minutes, "minute")} a month.</p>
    <div className="mt-5 flex flex-wrap justify-center gap-2"><Btn kind="record" onClick={() => ctx.go({ name: "record" })}><Mic className="h-4 w-4" />Record</Btn><Btn kind="soft" onClick={() => ctx.go({ name: "upload" })}><Upload className="h-4 w-4" />Upload</Btn></div>
  </div>;
}

export function Loading() { return <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[var(--an-faint)]" /></div>; }
