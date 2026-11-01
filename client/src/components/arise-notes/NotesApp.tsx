// Arise Notes: the app. The same screens run on their own at /notes/ (client/src/notes/main.tsx) and
// inside Arise To Duo (pages/AriseNotesPage.tsx): Home with the notes, Record, Upload, a note, Ask
// your notes, Voice memo, and Settings (plan and minutes, family, privacy, accessibility).
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ChevronLeft, Columns2, Folder, Loader2, Mic, MessageCircle, Search, Settings, Sparkles, Upload, Users, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { NOTES_PLANS, dayWords, fmtClock, templateOf } from "@shared/ariseNotes";
import { notesApi, setNotesToken, type ListNote, type Me } from "./api";
import { Btn, IconBtn, Notice, Spinner, ToastHost, plural, shortDate, useToast } from "./ui";
import "./notes.css";

const RecordScreen = lazy(() => import("./RecordScreen"));
const UploadScreen = lazy(() => import("./UploadScreen"));
const NoteScreen = lazy(() => import("./NoteScreen"));
const AskScreen = lazy(() => import("./AskScreen"));
const MemoScreen = lazy(() => import("./MemoScreen"));
const SettingsScreen = lazy(() => import("./SettingsScreen"));
const PrivacyPage = lazy(() => import("./PrivacyPage"));

export type Route =
  | { name: "home" } | { name: "record" } | { name: "upload" } | { name: "note"; id: string; t?: number } | { name: "ask" } | { name: "memo" }
  | { name: "settings"; tab?: "plan" | "family" | "privacy" | "access" } | { name: "privacy" };
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
    case "note": return p[1] ? { name: "note", id: p[1], t: p[2] ? Number(p[2]) : undefined } : { name: "home" };
    case "ask": return { name: "ask" };
    case "memo": return { name: "memo" };
    case "settings": return { name: "settings", tab: (["plan", "family", "privacy", "access"] as const).find((t) => t === p[1]) };
    case "usage": case "plans": return { name: "settings", tab: "plan" };
    case "family": return { name: "settings", tab: "family" };
    case "privacy": return { name: "privacy" };
    default: return { name: "home" };
  }
}
const hashOf = (r: Route) => r.name === "home" ? "#/" : r.name === "note" ? `#/note/${r.id}${r.t !== undefined ? `/${Math.round(r.t)}` : ""}` : r.name === "settings" ? `#/settings${r.tab ? `/${r.tab}` : ""}` : `#/${r.name}`;

let lexendLoaded = false;
const loadLexend = () => {
  if (lexendLoaded || typeof document === "undefined") return;
  lexendLoaded = true;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700&display=swap";
  document.head.appendChild(l);
};

export default function NotesApp(props: { mode: "standalone" | "embedded"; hub?: "life" | "work"; onExit?: () => void; startNote?: string }) {
  return <ToastHost><Shell {...props} /></ToastHost>;
}

function Shell({ mode, hub = "life", onExit, startNote }: { mode: "standalone" | "embedded"; hub?: "life" | "work"; onExit?: () => void; startNote?: string }) {
  const { token, user } = useAuth();
  const say = useToast();
  const tokenRef = useRef(token);
  tokenRef.current = token;
  useEffect(() => { setNotesToken(() => tokenRef.current); }, []);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState<ListNote[] | null>(null);
  const [route, setRoute] = useState<Route>(() => (mode === "standalone" ? parseHash(window.location.hash) : startNote ? { name: "note", id: startNote } : { name: "home" }));
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

  const s = me?.settings;
  useEffect(() => { if (s?.font === "dyslexic") loadLexend(); }, [s?.font]);
  const rootClass = ["an-root min-h-[100dvh]", s?.font === "dyslexic" && "an-dyslexic", s?.simple && "an-simple", s?.contrast && "an-contrast", s?.large && "an-large"].filter(Boolean).join(" ");

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
      case "ask": return <AskScreen ctx={ctx} />;
      case "memo": return <MemoScreen ctx={ctx} />;
      case "settings": return <SettingsScreen ctx={ctx} tab={route.tab} />;
      case "privacy": return <PrivacyPage onBack={() => go({ name: "settings", tab: "privacy" })} />;
      default: return <Home ctx={ctx} notes={notes} onExit={onExit} />;
    }
  })();
  return <div className={rootClass} data-testid="arise-notes">
    <Suspense fallback={<div className="pt-32"><Spinner /></div>}>{screen}</Suspense>
  </div>;
}

// ─── Shared bits of every screen ──────────────────────────────────────────────

export function Logo({ size = 36 }: { size?: number }) {
  return <span aria-hidden className="an-logo grid shrink-0 place-items-center rounded-[11px] text-white shadow-sm" style={{ width: size, height: size }}>
    <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 10v4M9 7v10M13 4v16M17 8v8M21 11v2" /></svg>
  </span>;
}

export function TopBar({ ctx, title, back, right }: { ctx: AppCtx; title?: ReactNode; back?: () => void; right?: ReactNode }) {
  return <header className="an-noprint sticky top-0 z-30 border-b border-[var(--an-line)] bg-[color-mix(in_srgb,var(--an-bg)_88%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur-xl">
    <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3 sm:px-5">
      {back ? <IconBtn label="Back" onClick={back}><ChevronLeft className="h-6 w-6" /></IconBtn> : <Logo size={34} />}
      <div className="min-w-0 flex-1 truncate text-[17px] font-bold tracking-tight">{title ?? "Arise Notes"}</div>
      {right}
      <MinutesPill ctx={ctx} />
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

// ─── Home ────────────────────────────────────────────────────────────────────

function Home({ ctx, notes, onExit }: { ctx: AppCtx; notes: ListNote[] | null; onExit?: () => void }) {
  const [q, setQ] = useState("");
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
  return <>
    <TopBar ctx={ctx} back={exit ? onExit : undefined} title={exit ? <span className="flex items-center gap-2"><Logo size={26} />Arise Notes</span> : undefined}
      right={<>
        <IconBtn label="Ask your notes" onClick={() => ctx.go({ name: "ask" })}><MessageCircle className="h-5 w-5" /></IconBtn>
        <IconBtn label="Split screen with your to-do list" className="an-extra hidden md:grid" onClick={() => openSplit(ctx.mode, ctx.hub === "work" ? "workhub" : "tasks")}><Columns2 className="h-5 w-5" /></IconBtn>
        <IconBtn label="Settings" onClick={() => ctx.go({ name: "settings" })}><Settings className="h-5 w-5" /></IconBtn>
      </>} />
    <main className="mx-auto max-w-5xl space-y-5 px-4 pb-24 pt-5 sm:px-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-[var(--an-violet)]">Arise Notes</p>
          <h1 className="mt-0.5 text-[28px] font-extrabold leading-tight tracking-[-.02em] sm:text-[32px]">{first ? `Hi, ${first}.` : "Your notes"} What are we capturing?</h1>
        </div>
      </div>
      <MinutesBanner ctx={ctx} />
      {!ctx.me.services.speech && <Notice tone="warn">Speech to text isn't switched on for this site yet, so recordings are saved but can't be written down.</Notice>}

      <div className="grid gap-3 sm:grid-cols-3">
        <BigAction tone="record" icon={<Mic className="h-7 w-7" />} title="Record" text="A meeting, class or visit, live." onClick={() => ctx.go({ name: "record" })} testId="notes-record" />
        <BigAction tone="violet" icon={<Upload className="h-7 w-7" />} title="Upload" text="Audio or video, up to 2 hours." onClick={() => ctx.go({ name: "upload" })} testId="notes-upload" />
        <BigAction tone="amber" icon={<Zap className="h-7 w-7" />} title="Voice memo" text="Say it once, get a to-do." onClick={() => ctx.go({ name: "memo" })} locked={!ctx.me.features.memo} testId="notes-memo" />
      </div>

      <button type="button" onClick={() => ctx.go({ name: "ask" })} className="an-card flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:border-[var(--an-violet)]" data-testid="notes-ask-bar">
        <Sparkles className="h-5 w-5 shrink-0 text-[var(--an-violet)]" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--an-muted)]">Ask your notes: “What did I promise Maya's mom last month?”</span>
        <ArrowRight className="h-4 w-4 text-[var(--an-faint)]" aria-hidden />
      </button>

      <section aria-labelledby="notes-heading" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="notes-heading" className="mr-auto text-[18px] font-bold tracking-tight">Your notes</h2>
          <label className="relative w-full sm:w-72">
            <span className="sr-only">Search notes</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--an-faint)]" aria-hidden />
            <input className="an-input pl-9" placeholder="Search every note" value={q} onChange={(e) => setQ(e.target.value)} data-testid="notes-search" />
          </label>
        </div>
        {(folders.length > 0 || tags.length > 0 || ctx.me.family) && <div className="an-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <button type="button" className="an-chip" aria-pressed={!folder && !tag} onClick={() => { setFolder(""); setTag(""); }}>All</button>
          {folders.map((f) => <button key={f} type="button" className="an-chip" aria-pressed={folder === f} onClick={() => setFolder(folder === f ? "" : f)}><Folder className="h-3.5 w-3.5" aria-hidden />{f}</button>)}
          {ctx.me.family && <button type="button" className="an-chip" aria-pressed={folder === "__family"} onClick={() => setFolder(folder === "__family" ? "" : "__family")}><Users className="h-3.5 w-3.5" aria-hidden />Family</button>}
          {tags.map((t) => <button key={t} type="button" className="an-chip" aria-pressed={tag === t} onClick={() => setTag(tag === t ? "" : t)}>#{t}</button>)}
        </div>}
        {notes === null ? <Spinner /> : shown.length ? <ul className="grid gap-3 md:grid-cols-2">{shown.map((n) => <NoteCard key={n.id} n={n} onOpen={() => ctx.go({ name: "note", id: n.id })} />)}</ul>
          : q ? <p className="an-card px-5 py-8 text-center text-[15px] text-[var(--an-muted)]">Nothing matched “{q}”.</p>
            : <EmptyNotes ctx={ctx} />}
      </section>
      {ctx.mode === "standalone" && <p className="an-extra pt-4 text-center text-[13px] text-[var(--an-faint)]">Part of the A.R.I.S.E. family · <a className="font-semibold text-[var(--an-violet)] underline-offset-2 hover:underline" href={/^(www\.)?arisetodo\.com$/i.test(window.location.hostname) ? "/app#/lifehub" : "/#/lifehub"}>Open Arise To Duo</a> · <button type="button" className="font-semibold text-[var(--an-violet)] underline-offset-2 hover:underline" onClick={() => ctx.go({ name: "privacy" })}>Privacy</button></p>}
    </main>
  </>;
}

function BigAction({ tone, icon, title, text, onClick, locked, testId }: { tone: "record" | "violet" | "amber"; icon: ReactNode; title: string; text: string; onClick: () => void; locked?: boolean; testId: string }) {
  const bg = tone === "record" ? "bg-[var(--an-coral)] text-white" : tone === "violet" ? "bg-[var(--an-violet)] text-white" : "bg-[#f5a524] text-white";
  return <button type="button" onClick={onClick} data-testid={testId} className="an-card group flex items-center gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-28px_rgba(40,30,120,.6)] sm:flex-col sm:items-start sm:p-5">
    <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${bg}`}>{icon}</span>
    <span className="min-w-0"><span className="flex items-center gap-2 text-[18px] font-bold">{title}{locked && <span className="rounded-full bg-[var(--an-amber-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--an-amber)]">Basic</span>}</span><span className="mt-0.5 block text-[14px] text-[var(--an-muted)]">{text}</span></span>
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
    <button type="button" onClick={onOpen} className="an-card flex h-full w-full gap-3 p-4 text-left transition hover:border-[var(--an-violet)]" data-testid="notes-card">
      <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--an-violet-soft)] text-[20px]">{n.source === "memo" ? "⚡" : t.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><span className="truncate text-[16px] font-bold">{n.title || "Untitled note"}</span>{st && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${st.tone}`}>{st.text}</span>}</span>
        <span className="mt-0.5 block text-[13px] text-[var(--an-muted)]">{shortDate(n.createdAt)}{n.durationSecs ? ` · ${fmtClock(n.durationSecs)}` : ""} · {n.source === "memo" ? "Voice memo" : t.label}{n.by ? ` · ${n.by}` : ""}</span>
        {n.gist && <span className="an-extra mt-1.5 line-clamp-2 block text-[14px] leading-snug text-[#3d3a52]">{n.gist}</span>}
        {(n.actions > 0 || n.folder) && <span className="an-extra mt-2 flex flex-wrap gap-1.5">{n.actions > 0 && <span className="rounded-full bg-[var(--an-green-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--an-green)]">{plural(n.actions, "to-do")}</span>}{n.folder && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{n.folder}</span>}</span>}
      </span>
    </button>
  </li>;
}

function EmptyNotes({ ctx }: { ctx: AppCtx }) {
  const p = NOTES_PLANS[ctx.me.plan];
  return <div className="an-card px-6 py-10 text-center">
    <div aria-hidden className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-[var(--an-violet-soft)] text-[30px]">🎙️</div>
    <h3 className="text-[18px] font-bold">Your first note is one tap away</h3>
    <p className="mx-auto mt-1.5 max-w-sm text-[15px] leading-relaxed text-[var(--an-muted)]">Record a meeting or class, or upload a recording. You'll get a transcript with times, a summary and the to-dos, ready for your planner. {p.name} includes {plural(p.minutes, "minute")} a month.</p>
    <div className="mt-5 flex flex-wrap justify-center gap-2"><Btn kind="record" onClick={() => ctx.go({ name: "record" })}><Mic className="h-4 w-4" />Record</Btn><Btn kind="soft" onClick={() => ctx.go({ name: "upload" })}><Upload className="h-4 w-4" />Upload</Btn></div>
  </div>;
}

export function Loading() { return <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[var(--an-faint)]" /></div>; }
