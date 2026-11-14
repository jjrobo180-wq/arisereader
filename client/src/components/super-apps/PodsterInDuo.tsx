// Podster inside Arise To Duo: Podster's own pages (its home page, the swipe feed, audiobooks, music, radio,
// news, Study Podster, Social, the library…) as To Duo's row of pages instead of Podster's side menu and tab
// bar, in To Duo's look. Signed in with the To Duo account: the server turns the To Duo sign-in into the same
// Podster account the Podster app uses (server/earshot.ts, the podscroll gate), so there's no second sign-in.
// What the person follows, likes and saves is kept with the rest of their To Duo (family.earshot).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { applySignal, emptyEarshot, type Earshot, type PodEpisode, type Signal } from "@shared/earshot";
import { superAppOf } from "@shared/superApps";
import type { Family } from "@shared/familyHub";
import { LIGHT_SHEETS_CSS, Player, Setup, forceTheme, setCleanEnabled, type NowPlaying, type PlayerControl } from "@/components/family-hub/earshot/EarshotPlayer";
import { LIGHT_CSS } from "@/components/family-hub/earshot/EarshotSocial";
import { Home, type View } from "../../../../podscroll/Home";
import { setWikiMeter } from "../../../../podscroll/wikiPlayer";
import { downloads, installDownloads } from "../../../../podscroll/downloads";
import { PagePicker, PageStrip, SuperHead, useSuperPages } from "./SuperShell";
import { podDevice, syncDuoPodPush } from "./podsterLink";
import "./podster-duo.css";

type PlayerTab = "openmic" | "social" | "library";
type FeedStart = { showId: string; episodeId: string; ep?: PodEpisode; next?: PodEpisode[] };
type PodMode = { id: string; index: number; shuffle?: boolean; order?: "in" | "shuffle" | "shows" };

/** Pages that are a view of Podster's home page. */
const HOME_VIEWS: Record<string, View> = {
  home: { kind: "home" }, books: { kind: "books" }, music: { kind: "music" }, radio: { kind: "radio" }, now: { kind: "now" }, newsstations: { kind: "newsstations" },
  standup: { kind: "standup" }, study: { kind: "study" }, meeting: { kind: "meeting" }, wiki: { kind: "wiki" }, live: { kind: "live" }, party: { kind: "party", id: "new" },
  liked: { kind: "liked" }, later: { kind: "later" }, import: { kind: "import" },
};
/** Pages that are the player (the swipe feed, or one of its own pages). */
const PLAYER_PAGES: Record<string, PlayerTab | undefined> = { feed: undefined, social: "social", openmic: "openmic", library: "library" };
const isPlayerPage = (id: string) => Object.prototype.hasOwnProperty.call(PLAYER_PAGES, id);
/** Which page a home-page view belongs to (an audiobook is under Audiobooks, a search under Home). */
export const podsterPageOf = (v: View): string => (v.kind === "book" ? "books" : HOME_VIEWS[v.kind] ? v.kind : "home");
const STARTER_GENRES = ["comedy", "news", "science", "tech", "truecrime", "history", "business", "culture"];

export type PodsterStart = { page?: string | null; s?: string | null; e?: string | null };

export default function PodsterInDuo({ family, setFamily, say, night, start }: { family: Family; setFamily: (update: (f: Family) => Family) => void; say: (m: string) => void; night: boolean; start?: PodsterStart | null }) {
  const app = superAppOf("podster")!;
  const { token, user } = useAuth();
  const { pages, save } = useSuperPages(app, family, setFamily);
  const [picking, setPicking] = useState(false);
  const base = (API_BASE || (typeof location !== "undefined" ? location.origin : "")).replace(/\/$/, "");
  const device = useMemo(podDevice, []);
  const student = user?.role === "student";

  // To Duo's Day or Night, before anything draws (and given back when Podster closes).
  const themed = useRef(false);
  if (!themed.current) { forceTheme(night ? "dark" : "light", true); themed.current = true; }
  useEffect(() => { forceTheme(night ? "dark" : "light"); }, [night]);
  useEffect(() => () => forceTheme(null), []);

  // What's followed, liked and saved: kept in To Duo with the rest of the person's things.
  const es: Earshot = family.earshot ?? emptyEarshot();
  const esRef = useRef(es); esRef.current = es;
  const update = useCallback((fn: (e: Earshot) => Earshot) => setFamily((f) => ({ ...f, earshot: fn(f.earshot ?? emptyEarshot()) })), [setFamily]);

  // The To Duo sign-in on every request; the server answers as this person's Podster account.
  const api = useCallback(async (path: string, init?: { method?: string; body?: unknown }) => {
    const url = base + path.replace(/^\/api\/earshot/, "/api/podscroll");
    let res!: Response;
    let body: any;
    for (let attempt = 0; ; attempt++) {
      try {
        res = await fetch(url, {
          method: init?.method ?? "GET",
          headers: {
            "X-Podscroll-Device": device, ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(init?.body instanceof Blob ? { "Content-Type": init.body.type || "application/octet-stream" } : init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          body: init?.body instanceof Blob ? init.body : init?.body !== undefined ? JSON.stringify(init.body) : undefined,
        });
      } catch { throw new Error("Can't reach Podster right now. Check your connection and try again."); }
      body = await res.json().catch(() => ({}));
      // The podcast directory is busy: wait and ask again quietly a few times (reads only).
      const busy = res.status === 429 || (res.status === 503 && body?.busy !== false);
      if (!busy || attempt >= 3 || (init?.method && init.method !== "GET")) break;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
    if (!res.ok) throw Object.assign(new Error(body?.message || "Something went wrong. Try again."), { status: res.status, needSignIn: !!body?.needSignIn, needProfile: !!body?.needProfile });
    return body;
  }, [base, device, token]);
  const apiRef = useRef(api); apiRef.current = api;
  const mediaUrl = useCallback((path: string) => base + path.replace(/^\/api\/earshot/, "/api/podscroll"), [base]);
  const liveBase = base.replace(/^http/, "ws");
  const shareLink = useCallback((show: { id: string }, ep: { id: string }) => `https://arisetodo.com/podster/app/?s=${show.id}&e=${ep.id}`, []);

  // Signed in to Podster as the To Duo account (anyone with an email on their account).
  const [acct, setAcct] = useState<{ signedIn: boolean; email: string | null }>({ signedIn: false, email: null });
  useEffect(() => { api("/api/earshot/account").then((b) => setAcct({ signedIn: !!b?.signedIn, email: b?.email ?? null })).catch(() => {}); }, [api]);
  const pro = acct.signedIn;
  const proRef = useRef(pro); proRef.current = pro;
  // Ad-free listening is Arise All Access, the same as in the Podster app.
  const [paid, setPaid] = useState(false);
  useEffect(() => { if (!pro) { setPaid(false); return; } let alive = true; api("/api/earshot/ad-free").then((j) => { if (alive) setPaid(!!j?.adFree); }).catch(() => {}); return () => { alive = false; }; }, [pro, api]);
  useEffect(() => { setCleanEnabled(paid); }, [paid]);
  const adMode = paid ? ("auto" as const) : ("off" as const);
  const shown = useMemo(() => ({ ...es, settings: { ...es.settings, adMode } }), [es, adMode]);
  const shownRef = useRef(shown); shownRef.current = shown;
  const join = useCallback(() => say(pro ? "You're signed in to Podster with your To Duo account." : "Podster uses your To Duo account. Add an email to your account in To Duo's settings to post and keep your place."), [pro, say]);

  // The AI reader for Wiki podcasts spends AI minutes (shared with Arise Notes), and downloads for later.
  useEffect(() => {
    setWikiMeter(async (title, sec, chars) => {
      try { await apiRef.current("/api/earshot/wiki/section", { method: "POST", body: { title, sec, chars } }); return null; }
      catch (e: any) { return e?.message || "The AI reader isn't available right now."; }
    });
    return () => setWikiMeter(null);
  }, []);
  useEffect(() => { if (!downloads) installDownloads({ api: (p, i) => apiRef.current(p, i), apiBase: base, isMember: () => proRef.current, onJoin: () => join(), say }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Taste: what's tapped, finished and skipped teaches the feed, saved in small batches.
  const pending = useRef<{ genre: string; signal: Signal }[]>([]);
  const flushT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => {
    if (flushT.current) { clearTimeout(flushT.current); flushT.current = null; }
    const list = pending.current; pending.current = [];
    if (list.length) update((e) => list.reduce((acc, x) => applySignal(acc, x.genre, x.signal), e));
  }, [update]);
  const signal = useCallback((genre: string, s: Signal) => { pending.current.push({ genre, signal: s }); if (!flushT.current) flushT.current = setTimeout(flush, 5000); }, [flush]);
  useEffect(() => () => flush(), [flush]);

  // New-episode alerts on this iPhone, through To Duo's notifications (server/podPush.ts sends them to To Duo).
  const followKey = es.follows.map((f) => f.id).join(",");
  useEffect(() => {
    const t = setTimeout(() => syncDuoPodPush(token, es.follows.map((f) => f.id)), 1500);
    return () => clearTimeout(t);
  }, [followKey, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pages ──
  const first = start?.page && (HOME_VIEWS[start.page] || isPlayerPage(start.page)) ? start.page : start?.s && start?.e ? "feed" : "home";
  const [page, setPage] = useState<string>(first);
  const [view, setView] = useState<View>(HOME_VIEWS[first] ?? { kind: "home" });
  const onPlayer = isPlayerPage(page);
  const [editing, setEditing] = useState(false);
  // The player keeps running (hidden) on the other pages once it has opened, so what's playing keeps playing.
  const [feedSeen, setFeedSeen] = useState(onPlayer);
  const feedSeenRef = useRef(feedSeen); feedSeenRef.current = feedSeen;
  const [feedStart, setFeedStart] = useState<FeedStart | null>(start?.s && start?.e ? { showId: start.s, episodeId: start.e } : null);
  const [feedTab, setFeedTab] = useState<PlayerTab | undefined>(onPlayer ? PLAYER_PAGES[first] : undefined);
  const [feedMode, setFeedMode] = useState<PodMode | null>(null);
  const [feedKey, setFeedKey] = useState(0);
  const [tabNonce, setTabNonce] = useState(0);
  const [nowPod, setNowPod] = useState<NowPlaying | null>(null);
  const nowPodRef = useRef(nowPod); nowPodRef.current = nowPod;
  const podCtl = useRef<PlayerControl | null>(null);

  const openFeed = useCallback((at?: FeedStart, tab?: PlayerTab, mode?: PodMode) => {
    if ((at || tab || mode) && !esRef.current.setupDone) update((e) => (e.setupDone ? e : { ...e, setupDone: true, genres: STARTER_GENRES, taste: Object.fromEntries(STARTER_GENRES.map((g) => [g, 3])) }));
    const to = tab ?? "feed";
    window.scrollTo({ top: 0 });
    // Just a page and the player is already running: switch its page, so what's playing keeps playing.
    if (!at && !mode && feedSeenRef.current) { setFeedTab(tab); setTabNonce((n) => n + 1); setPage(to); return; }
    if (mode?.id === "__newsradio" && feedSeenRef.current && nowPodRef.current?.live) { setFeedTab(undefined); setTabNonce((n) => n + 1); setPage("feed"); return; }
    setFeedStart(at ?? null); setFeedTab(tab); setFeedMode(mode ?? null); setFeedKey((k) => k + 1); setFeedSeen(true); setPage(to);
  }, [update]);
  const pick = (id: string) => {
    setEditing(false);
    if (isPlayerPage(id)) { openFeed(undefined, PLAYER_PAGES[id]); return; }
    setView(HOME_VIEWS[id] ?? { kind: "home" }); setPage(id); window.scrollTo({ top: 0 });
  };
  const onView = useCallback((v: View) => { setView(v); setPage(podsterPageOf(v)); }, []);
  // A new-episode alert tapped while Podster is already open (#/to-do?go=podster&s=…&e=…).
  const startKey = `${start?.page ?? ""}|${start?.s ?? ""}|${start?.e ?? ""}`;
  const firstStart = useRef(startKey);
  useEffect(() => {
    if (startKey === firstStart.current) return;
    firstStart.current = startKey;
    if (start?.s && start?.e) openFeed({ showId: start.s, episodeId: start.e });
    else if (start?.page) pick(start.page);
  }, [startKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const strip = pages.includes(page) ? pages : [...pages, page];
  const setup = editing || (onPlayer && !es.setupDone);
  const day = !night;
  return <div className={`pod-duo ${night ? "pod-duo-night" : ""}`} data-testid="super-app-podster">
    <SuperHead app={app} onSettings={() => setPicking(true)} settingsLabel="Pick your Podster pages" />
    <PageStrip app={app} pages={strip} current={page} onPick={pick} />
    {setup && <div className={`overflow-hidden rounded-[1.5rem] px-3 py-6 ${day ? "ps-light bg-white ring-1 ring-[#e7e8f0]" : "bg-[#120e14]"}`} data-testid="podster-setup">
      {day && <style>{LIGHT_CSS + LIGHT_SHEETS_CSS}</style>}
      <Setup brand="Podster" initial={es} student={student} onCancel={() => setEditing(false)} onDone={(genres, pace) => {
        update((e) => {
          const taste = { ...e.taste };
          for (const g of genres) taste[g] = Math.max(taste[g] ?? 0, 3);
          for (const g of e.genres) if (!genres.includes(g)) taste[g] = Math.min(taste[g] ?? 0.3, 0.6);
          return { ...e, setupDone: true, genres, pace, taste };
        });
        setEditing(false);
        say(onPlayer ? "Tap a cover to listen. Swipe up for the next one." : "Your home page now follows your interests.");
      }} />
    </div>}
    <div style={{ display: !setup && !onPlayer ? "block" : "none" }} className="overflow-hidden rounded-[1.5rem] ring-1 ring-[#e7e8f0]" data-testid="podster-home">
      <Home embed={{ view, onView }} visible={!setup && !onPlayer} nowPod={nowPod} onPodToggle={() => podCtl.current?.toggle()} onPodOpen={() => openFeed()}
        es={shown} update={update} api={api} say={say} onOpenFeed={openFeed} onEditInterests={() => setEditing(true)} pro={pro} paid={paid}
        onJoin={join} onSignIn={join} email={acct.email || user?.email || ""} onSignOut={() => {}} device={device}
        nickname={String(user?.displayName || "").split(" ")[0]} setNickname={() => {}} liveBase={liveBase} signal={signal} />
    </div>
    {feedSeen && <div style={{ display: !setup && onPlayer ? "block" : "none" }} data-testid="podster-player">
      <Player key={feedKey} visible={!setup && onPlayer} onNowPlaying={setNowPod} control={podCtl} tabNonce={tabNonce} es={shown} esRef={shownRef} update={update} api={api}
        signal={signal} say={say} student={student} explicit={!student && es.settings.explicit} onEditInterests={() => setEditing(true)} shareLink={shareLink}
        start={feedStart} mediaUrl={mediaUrl} liveBase={liveBase} onHome={() => pick("home")} initialTab={feedTab} playMode={feedMode} />
    </div>}
    {picking && <PagePicker app={app} pages={pages} onSave={save} onClose={() => setPicking(false)} />}
  </div>;
}
