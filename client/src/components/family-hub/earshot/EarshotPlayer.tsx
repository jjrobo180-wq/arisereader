// The Earshot/Podscroll podcast player: genre setup, the swipe feed, Explore, Library and the sheets.
// Used by LifeHub's Earshot app (./Earshot.tsx) and by the separate Podscroll website (podscroll/),
// so it imports nothing from the Arise app itself: the caller passes data, saving and the API.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Bookmark, Check, ChevronDown, ExternalLink, Mic, Flag, Heart, ListVideo, Loader2, Maximize2, Megaphone, MessageCircle, Minimize2, Minus, Moon, Pause, Play, Plus, RotateCcw, RotateCw, Search, Settings2, Share2, SkipForward, ThumbsDown, Trash2, X } from "lucide-react";
import {
  EARSHOT_LIMITS, GENRES, GENRE, SPEEDS, chooseEpisode, chooseFreshEpisode, clock, compact, durationWords, mergeAds, pickNext, shareText, startAt, tasteOf, type AdMode,
  type AdRange, type Candidate, type Chapter, type Earshot as EarshotData, type PodEpisode, type PodShow, type PoolShow, type SavedEpisode, type Signal, type TranscriptChunk, type TxSegment,
} from "@shared/earshot";
import { alignAds, playAdAt, type PlayAd, type ServerAd } from "@shared/earshotAds";
import { AddToSheet, AiFinder, ModeView, ModesHub, ShowPage } from "./EarshotExtras";
import { ClipMaker, LIGHT_CSS, ProfileEditor, ShareSheet, UploadSheet, postEpisodeOf, toEpisode as micEpisode, toShow as micShow } from "./EarshotSocial";
import { CreateSheet, GoLiveSheet, LiveChip, LiveRoom, OpenMic, SignInSheet, Studio, useCreator, type LiveSummary, type MicEpisode } from "./EarshotCreators";
import { OWN_EPISODE, isMicSlot, type ListenSource } from "@shared/earshotCreators";
import { XSocial } from "./EarshotSocialX";
import { PreviewCard, Previews, previewPicks, type PreviewPick } from "./EarshotPreviews";
import { SubjectGrid, SubjectView } from "./EarshotTopics";
import type { Topic } from "@shared/earshotTopics";
import { hiRes, type PodMode } from "@shared/earshot";

type Counts = { likes: number; comments: number; shares: number; liked: boolean };
type Comment = { id: string; author: string; body: string; at: string; mine: boolean };
/** want: a particular episode to load (from a Pod Mode or a saved one without its audio). */
type Item = { key: string; show: PodShow; why: string; ep: PodEpisode | null; state: "loading" | "ready" | "none"; want?: string;
  /** A show coming back around once the feed has been through every show it has: play an episode this feed hasn't. */
  again?: boolean;
  /** An Open Mic episode (made by someone on Pod+), woven into For You. */
  mic?: { post: string; handle: string; name: string; newVoice: boolean; followed: boolean } };
type Tab = "foryou" | "following" | "openmic" | "social" | "explore" | "library";

export const ACCENT = "#ff8a3d";
const nowIso = () => new Date().toISOString();
const savedOf = (ep: PodEpisode): SavedEpisode => ({ id: ep.id, showId: ep.showId, title: ep.title, show: ep.show, art: ep.art, secs: ep.secs, at: nowIso(), audio: ep.audio, date: ep.date });
/** A saved episode back as one the player can play (no lookup needed when its audio was kept). */
const episodeOf = (s: SavedEpisode): PodEpisode => ({ id: s.id, showId: s.showId, show: s.show, author: "", title: s.title, about: "", audio: s.audio || "", date: s.date || "", secs: s.secs, art: s.art, link: "", explicit: false });
const agoWords = (iso: string) => {
  const d = (Date.now() - Date.parse(iso)) / 1000;
  if (!Number.isFinite(d)) return "";
  if (d < 3600) return `${Math.max(1, Math.floor(d / 60))}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  if (d < 86400 * 30) return `${Math.floor(d / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

// ===========================================================================
// Day, night, or follow the device. Kept on this device; every part of the app that asks hears changes.
// ===========================================================================
export type Theme = "system" | "light" | "dark";
const THEME_KEY = "earshot.theme";
const readTheme = (): Theme => { try { const v = localStorage.getItem(THEME_KEY); return v === "light" || v === "dark" ? v : "system"; } catch { return "system"; } };
export function setTheme(t: Theme) { try { localStorage.setItem(THEME_KEY, t); } catch { /* not kept */ } window.dispatchEvent(new Event("earshot-theme")); }
/** The chosen theme, and whether the app should be light right now. */
export function useTheme(): { theme: Theme; day: boolean } {
  const [theme, set] = useState<Theme>(readTheme);
  const [sysDark, setSysDark] = useState(() => typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const sys = () => setSysDark(mq.matches), mine = () => set(readTheme());
    mq.addEventListener("change", sys); window.addEventListener("earshot-theme", mine); window.addEventListener("storage", mine);
    return () => { mq.removeEventListener("change", sys); window.removeEventListener("earshot-theme", mine); window.removeEventListener("storage", mine); };
  }, []);
  return { theme, day: theme === "light" || (theme === "system" && !sysDark) };
}
/** Light versions of the dark sheets (with LIGHT_CSS): their panels and the setup card. */
export const LIGHT_SHEETS_CSS = `.ps-light :is([class*="bg-[#1d1720]"],[class*="bg-[#1c1620]"],[class*="bg-[#15121b]"],[class*="bg-[#17151b]"]){background-color:#fff}
.ps-light [class*="bg-white/[.03]"]{background-color:rgba(15,20,25,.04)}
.ps-light [class*="border-white/10"]{border-color:rgba(15,20,25,.1)}
.ps-light [class*="bg-[#0e0d10]"]{background-color:#fff}
.ps-light [class*="to-[#0e0d10]"]{--tw-gradient-to:#fff var(--tw-gradient-to-position)}
.ps-light [role="switch"][aria-checked="true"].h-7>span.bg-white{background-color:#fff}`;

// ===========================================================================
// Setup: pick genres and pace
// ===========================================================================
export function Setup({ initial, student, onDone, onCancel, brand = "Earshot" }: { brand?: string; initial: EarshotData; student: boolean; onDone: (genres: string[], pace: EarshotData["pace"]) => void; onCancel?: () => void }) {
  const [picked, setPicked] = useState<string[]>(initial.genres);
  const [pace, setPace] = useState(initial.pace);
  const list = GENRES.filter((g) => !student || g.kidSafe);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return <div className="mx-auto max-w-3xl rounded-3xl bg-[#15121b] p-5 text-white shadow-xl sm:p-8">
    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em]" style={{ color: ACCENT }}><span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />{brand} · real podcasts</p>
    <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">What do you want in your ears?</h1>
    <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">Pick at least three genres. Every show is a real podcast from Apple Podcasts, and the feed learns from every like, skip, save and share.{student ? " Student accounts only get clean podcasts." : ""}</p>
    <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {list.map((g) => {
        const on = picked.includes(g.id);
        return <button key={g.id} type="button" onClick={() => toggle(g.id)} aria-pressed={on}
          className={`flex min-h-14 items-center gap-3 rounded-2xl px-3 text-left text-sm font-bold ring-2 transition ${on ? "bg-white/10 ring-[#ff8a3d]" : "bg-white/5 ring-transparent hover:bg-white/10"}`}>
          <span className="grid h-9 w-9 flex-none place-items-center rounded-xl text-xs font-semibold" style={{ background: g.color, color: "#fff" }}>{on ? <Check size={18} /> : g.name.slice(0, 1)}</span>
          <span className="leading-tight">{g.name}</span>
        </button>;
      })}
    </div>
    <p className="mt-6 text-xs font-semibold uppercase tracking-[.16em] text-white/45">How long do you like to listen?</p>
    <div className="mt-2 grid grid-cols-3 gap-2">
      {([["short", "Quick hits", "under 25 min"], ["mix", "Mix it up", "any length"], ["deep", "Deep dives", "45 min +"]] as const).map(([v, label, sub]) =>
        <button key={v} type="button" onClick={() => setPace(v)} aria-pressed={pace === v} className={`rounded-2xl px-2 py-3 text-sm font-bold ring-2 ${pace === v ? "bg-white/10 ring-[#ff8a3d]" : "bg-white/5 ring-transparent"}`}>{label}<span className="block text-xs font-medium text-white/55">{sub}</span></button>)}
    </div>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-white/60">{picked.length < 3 ? `Pick ${3 - picked.length} more` : `${picked.length} genres picked`}</span>
      <div className="flex gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="min-h-11 rounded-full bg-white/10 px-5 font-bold">Cancel</button>}
        <button type="button" disabled={picked.length < 3} onClick={() => onDone(picked, pace)} className="min-h-11 rounded-full px-6 font-semibold bg-white text-[#111013] disabled:opacity-40">Start listening</button>
      </div>
    </div>
  </div>;
}

// ===========================================================================
// The player: feed, explore, library
// ===========================================================================
export type PlayerProps = {
  es: EarshotData; esRef: { current: EarshotData }; update: (fn: (e: EarshotData) => EarshotData) => void;
  api: (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
  signal: (genre: string, s: Signal) => void; say: (m: string) => void; student: boolean; explicit: boolean; onEditInterests: () => void;
  /** Fill the whole window and leave out the full-screen button (the Podscroll website). */
  standalone?: boolean;
  /** A link back to this episode in the app, used when sharing (else the Apple Podcasts link). */
  shareLink?: (show: PodShow, ep: PodEpisode) => string;
  /** The name comments are posted under, when the app has no accounts (Podscroll). */
  nickname?: string; setNickname?: (name: string) => void;
  /** An episode to open first, from a shared link. */
  start?: { showId: string; episodeId: string } | null;
  /** The full address of a server path, for audio played through the server (smart ad skip). */
  mediaUrl?: (path: string) => string;
  /** Where LivePod connects (wss://…), when the server is on another address (Podscroll). */
  liveBase?: string;
  /** Pod+ creators sign in with an email code; the app keeps the session and sends it with requests. */
  onSession?: (token: string | null, email?: string) => void;
  /** Nothing plays while this is on (Pod+: the free minute is up and there's no account yet). */
  locked?: boolean;
};

/** What the server found in this listener's own copy of an episode (server/podcastPlay.ts). */
type SessionAds = { ready: boolean; final: boolean; pending?: boolean; startAt?: number; ads: PlayAd[]; how: string; compared: number; dur?: number; gone?: boolean };
type PlaySession = { sid: string; showId: string; ads: SessionAds | null; polls: number; timer: ReturnType<typeof setTimeout> | null; used: number; retried?: boolean };
const newSid = () => { const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a, (b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[b & 63]).join(""); };
/** Audio formats the server can look inside (MP3); others play straight from the host. */
const throughServer = (url: string) => !/\.(m4a|mp4|aac|m4b|ogg|opus|wav|flac|webm)(\?|$)/i.test(url) && !/\/storage\/v1\/object\/public\//.test(url);

// ---- where each episode was left off, kept on this device ----
type Spot = { t: number; secs: number; title: string; show: string; showId: string; art: string; at: number };
const SPOTS_KEY = "earshot.spots";
const readSpots = (): Record<string, Spot> => { try { const v = JSON.parse(localStorage.getItem(SPOTS_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } };
function saveSpot(ep: PodEpisode, t: number) {
  const all = readSpots();
  if (t < 15 || (ep.secs && t > ep.secs - 30)) delete all[ep.id];
  else all[ep.id] = { t: Math.floor(t), secs: ep.secs, title: ep.title, show: ep.show, showId: ep.showId, art: ep.art, at: Date.now() };
  const keep = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 200);
  try { localStorage.setItem(SPOTS_KEY, JSON.stringify(Object.fromEntries(keep))); } catch { /* not kept */ }
}

// ---- a short silent sound, played once on the first tap so every player can start later without one ----
let silentUrl = "";
function silence(): string {
  if (silentUrl) return silentUrl;
  const n = 800, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, "data"); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  silentUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  return silentUrl;
}

type Tx = { source: TranscriptChunk["source"]; reason: string; segments: TxSegment[]; ads: AdRange[]; chapters: Chapter[]; chunks: Set<number>; loading: Set<number>; more: boolean; chunkSecs: number;
  /** Pieces that came back "not right now": when each may be asked for again, and how many tries so far. */
  wait: Map<number, { at: number; tries: number }> };
const emptyTx = (): Tx => ({ source: "none", reason: "", segments: [], ads: [], chapters: [], chunks: new Set(), loading: new Set(), more: true, chunkSecs: 600, wait: new Map() });

export function Player({ es, esRef, update, api, signal, say, student, explicit, onEditInterests, standalone, shareLink, nickname, setNickname, start, mediaUrl, liveBase, onSession, locked }: PlayerProps) {
  const { theme, day } = useTheme();
  const [tab, setTab] = useState<Tab>("foryou");
  // The feed tab last open (For You or Following), where the mini player goes back to.
  const lastFeed = useRef<Tab>("foryou");
  if (tab === "foryou" || tab === "following") lastFeed.current = tab;
  const [genreMode, setGenreMode] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const itemsRef = useRef(items); itemsRef.current = items;
  const [active, setActive] = useState(0);
  const activeRef = useRef(0); activeRef.current = active;
  const [unlocked, setUnlocked] = useState(false);
  const unlockedRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [commentsOn, setCommentsOn] = useState(!student);
  const [previews, setPreviews] = useState<PreviewPick[] | null>(null);
  const [sheet, setSheet] = useState<null | { kind: "comments"; ep: PodEpisode } | { kind: "show"; show: PodShow } | { kind: "settings" } | { kind: "sleep" } | { kind: "read" } | { kind: "addto"; ep: PodEpisode; genre: string } | { kind: "mode"; id: string } | { kind: "share"; ep: PodEpisode; genre: string; show: PodShow } | { kind: "clip"; ep: PodEpisode; time: number }>(null);
  const sheetRef = useRef(sheet); sheetRef.current = sheet;
  const [poolTick, setPoolTick] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "slow">("loading");
  const [retry, setRetry] = useState(0);
  const [txTick, setTxTick] = useState(0);
  const [skipped, setSkipped] = useState<{ ad: PlayAd; epId: string } | null>(null);
  // Smart ad skip: what the server knows per episode, this listener's marks in progress, and quick forward jumps.
  const serverAds = useRef<Map<string, ServerAd[]>>(new Map());
  // Playback through the server: a play token for audio addresses, and each episode's session.
  const playTok = useRef<{ token: string; exp: number; audio: string } | null>(null);
  const plays = useRef<Map<string, PlaySession>>(new Map());
  const direct = useRef<Set<string>>(new Set());
  const localAds = useRef<Map<string, PlayAd[]>>(new Map());
  const [adsTick, setAdsTick] = useState(0);
  const [adsShared, setAdsShared] = useState(true);
  const [marking, setMarking] = useState<{ epId: string; s: number } | null>(null);
  const markingRef = useRef(marking); markingRef.current = marking;
  const [draft, setDraft] = useState<{ ep: PodEpisode; showId: string; s: number; e: number; label: string } | null>(null);
  const skipRun = useRef<{ epId: string; from: number; to: number; at: number } | null>(null);
  const skipT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sleepAt, setSleepAt] = useState<number | "end" | null>(null);
  const sleepRef = useRef(sleepAt); sleepRef.current = sleepAt;
  const pools = useRef<Map<string, PoolShow[]>>(new Map());
  /** The next "more shows" page for each genre (null: none left), and whether one is loading. */
  const morePage = useRef<Map<string, number | null>>(new Map());
  /** The feed that's open right now (For You, Following or a genre), for answers that arrive late. */
  const modeRef = useRef("foryou");
  const growing = useRef(false);
  /** Shows coming back around that turned out to have no new episode, in a row (stops a hopeless loop). */
  const againMisses = useRef(0);
  const episodesCache = useRef<Map<string, Promise<{ show: PodShow | null; episodes: PodEpisode[] }>>>(new Map());
  const txs = useRef<Map<string, Tx>>(new Map());
  const undone = useRef<Set<string>>(new Set());
  const players = useRef<HTMLAudioElement[]>([]);
  const cur = useRef<HTMLAudioElement | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const listened = useRef(0);
  const lastTime = useRef(0);
  const lastSpot = useRef(0);
  const counted = useRef<Set<string>>(new Set());
  // Which feed the cards come from: the feed tab open, or the last one open while on another tab
  // (Open Mic, Social, Explore, Library), so visiting those never swaps the feed underneath.
  const feedTab = tab === "foryou" || tab === "following" ? tab : lastFeed.current;
  const picked = useRef(false);
  const mode = feedTab === "following" ? "following" : genreMode ? `genre:${genreMode}` : "foryou";
  modeRef.current = mode;
  const ex = explicit ? "&explicit=1" : "";

  // ---------------- creators: Open Mic, Studio, LivePod ----------------
  const { info: creator, reload: reloadCreator } = useCreator(api, student);
  const [live, setLive] = useState<LiveSummary[]>([]);
  const [maker, setMaker] = useState<null | "create" | "signin" | "golive" | "upload" | "profile" | "studio">(null);
  const afterSignIn = useRef<null | "create" | "golive" | "upload" | "studio">(null);
  const [liveRoom, setLiveRoom] = useState<{ id: string; ticket?: string } | null>(null);
  const [socialPerson, setSocialPerson] = useState<string | null>(null);
  const micPool = useRef<MicEpisode[]>([]);
  const micUsed = useRef<Set<string>>(new Set());
  const micHeard = useRef<{ ep: string; secs: number }>({ ep: "", secs: 0 });
  const sourceOf = useRef<Map<string, ListenSource>>(new Map());
  // Who's live (the top bar shows them), and Open Mic episodes to weave into For You.
  useEffect(() => {
    if (student) return;
    const pull = () => { if (document.visibilityState === "visible") api("/api/earshot/creators/live").then((b) => setLive(b.live || [])).catch(() => {}); };
    const pullMic = () => api("/api/earshot/creators/openmic?tab=fresh").then((b) => { micPool.current = (b.episodes || []).filter((m: MicEpisode) => !m.mine); }).catch(() => {});
    pull(); void pullMic();
    const a = setInterval(pull, 30_000), b = setInterval(pullMic, 5 * 60_000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [api, student]);
  /** Creating needs a profile, and on Pod+ an email sign-in first. */
  const create = (what: "create" | "golive" | "upload" | "studio") => {
    if (creator && !creator.creator && creator.signIn) { afterSignIn.current = what; setMaker("signin"); return; }
    if (what !== "create" && !creator?.profile) { afterSignIn.current = what; setMaker("profile"); return; }
    if (what === "golive" && creator?.live) { setMaker(null); setLiveRoom({ id: creator.live.id }); return; }
    setMaker(what);
  };
  const joinLive = (id: string) => { pausePlayer(); setLiveRoom({ id }); };
  const openCreator = (handle: string) => { setSocialPerson(handle); setTab("social"); };

  const loadEpisodes = useCallback((showId: string) => {
    let p = episodesCache.current.get(showId);
    if (!p) {
      p = api(`/api/earshot/show/${showId}?x=1${ex}`).then((b) => ({ show: b.show ?? null, episodes: Array.isArray(b.episodes) ? b.episodes : [] }));
      p.catch(() => episodesCache.current.delete(showId));
      episodesCache.current.set(showId, p);
    }
    return p;
  }, [api, ex]);

  /** Genres with episodes attached, several in one request. */
  const loadPools = useCallback(async (ids: string[]) => {
    const need = ids.filter((g) => !pools.current.has(g));
    if (!need.length) return;
    const b = await api(`/api/earshot/feed?genres=${need.join(",")}${ex}`);
    for (const g of need) pools.current.set(g, Array.isArray(b?.pools?.[g]) ? b.pools[g] : []);
    setPoolTick((t) => t + 1);
  }, [api, ex]);

  // Picked genres first (one request), then the genres they've warmed to.
  useEffect(() => {
    pools.current.clear(); morePage.current.clear();
    setLoadState("loading"); setLoadError("");
    const slow = setTimeout(() => setLoadState((s) => (s === "loading" ? "slow" : s)), 12_000);
    const ok = (g: string) => !student || !!GENRE[g]?.kidSafe;
    const picked = es.genres.filter(ok).slice(0, 10);
    const warmed = GENRES.map((g) => g.id).filter((g) => ok(g) && !picked.includes(g) && tasteOf(es, g) >= 4).slice(0, 6);
    // The first three genres come back first, so the feed can start while the rest load.
    const first = picked.slice(0, 3), rest = [...picked.slice(3), ...warmed];
    loadPools(first).then(() => { setLoadError(""); setLoadState("ready"); if (rest.length) void loadPools(rest).catch(() => {}); })
      .catch((e: any) => { setLoadError(e?.message || "Apple Podcasts can't be reached right now."); setLoadState("ready"); })
      .finally(() => clearTimeout(slow));
    return () => clearTimeout(slow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [es.genres.join(","), student, explicit, retry]);

  const candidates = useCallback((): (Candidate & { episodes?: PodEpisode[] })[] => {
    if (mode === "following") return esRef.current.follows.map((f, i) => ({ rank: i, show: { id: f.id, name: f.name, author: f.author, art: f.art, genre: f.genre, appleGenre: "", link: "", episodes: 0, explicit: false, latest: "" } }));
    const fromPool = (list: PoolShow[]) => list.map((p) => ({ show: p.show, rank: p.rank, episodes: p.episodes }));
    if (mode.startsWith("genre:")) return fromPool(pools.current.get(mode.slice(6)) ?? []);
    const out: (Candidate & { episodes?: PodEpisode[] })[] = []; const seen = new Set<string>();
    pools.current.forEach((list) => fromPool(list).forEach((c) => { if (!seen.has(c.show.id)) { seen.add(c.show.id); out.push(c); } }));
    return out;
  }, [mode, esRef]);

  const fill = useCallback((item: Item) => {
    loadEpisodes(item.show.id).then(({ episodes }) => {
      const playedHere = new Set<string>(itemsRef.current.map((x: Item) => x.ep?.id).filter((x: string | undefined): x is string => !!x));
      const ep = item.want ? episodes.find((e) => e.id === item.want) ?? null
        : item.again ? chooseFreshEpisode(esRef.current, episodes, playedHere)
        : chooseEpisode(esRef.current, episodes);
      if (item.again) againMisses.current = ep ? 0 : againMisses.current + 1;
      setItems((list) => list.map((x) => (x.key === item.key ? { ...x, ep, state: ep ? "ready" : "none" } : x)));
    }).catch(() => setItems((list) => list.map((x) => (x.key === item.key ? { ...x, state: "none" } : x))));
  }, [loadEpisodes, esRef]);

  /** Finds more shows for these genres (the next page of each genre's searches). Returns how many were new. */
  const loadMore = useCallback(async (ids: string[]): Promise<{ added: number; failed: boolean }> => {
    let added = 0, failed = false;
    for (const g of ids) {
      const page = morePage.current.has(g) ? morePage.current.get(g)! : 0;
      if (page === null) continue;
      try {
        const b = await api(`/api/earshot/more?genre=${encodeURIComponent(g)}&page=${page}${ex}`);
        morePage.current.set(g, typeof b?.next === "number" ? b.next : null);
        const cur = pools.current.get(g) ?? [];
        const have = new Set(cur.map((p) => p.show.id));
        const fresh = (Array.isArray(b?.pool) ? b.pool as PoolShow[] : []).filter((p) => !have.has(p.show.id)).map((p, i) => ({ ...p, show: { ...p.show, genre: g }, rank: 40 + page * 5 + i }));
        if (fresh.length) { pools.current.set(g, [...cur, ...fresh]); added += fresh.length; }
      } catch { failed = true; break; /* Apple is busy: the next swipe tries again */ }
    }
    if (added) setPoolTick((t) => t + 1);
    return { added, failed };
  }, [api, ex]);
  /** Which genres to find more shows for: the open genre, or (For You) their favourite genres that still have more. */
  const growTargets = useCallback(() => {
    if (mode === "following") return [];
    if (mode.startsWith("genre:")) return [mode.slice(6)];
    const ok = (g: string) => (!student || !!GENRE[g]?.kidSafe) && morePage.current.get(g) !== null;
    const mine = (Array.from(pools.current.keys()) as string[]).filter(ok).sort((a, b) => tasteOf(esRef.current, b) - tasteOf(esRef.current, a));
    // the favourite first, plus one other so For You keeps its variety
    return mine.length > 2 ? [mine[0], mine[1 + Math.floor(Math.random() * (mine.length - 1))]] : mine;
  }, [mode, student, esRef]);

  const extend = useCallback((n: number) => {
    const list = itemsRef.current;
    const pool = candidates();
    const ctxOf = (shown: string[]) => ({ recentShows: list.slice(-5).map((x) => x.show.id), shownShows: shown, follows: esRef.current.follows.map((f) => f.id) });
    let picks = pickNext(esRef.current, pool, ctxOf(list.map((x) => x.show.id)), n);
    /** Picks from here on are shows coming back around. */
    const newShows = picks.length;
    if (picks.length < n) {
      // Running low: find more shows first; only if there are none left do shows come back around.
      const targets = growTargets();
      if (targets.length && !growing.current) {
        growing.current = true;
        const short = n - picks.length;
        const feed = mode;
        void loadMore(targets).then(({ failed }) => {
          growing.current = false;
          // a different feed is open now, or Apple is busy (the next swipe tries again)
          if (feed !== modeRef.current || failed) return;
          extend(short);
        });
      } else if (!targets.length && againMisses.current < 8) {
        // Every show has had its turn: bring shows back (not the last 15), each with an episode this feed hasn't played.
        const recent = list.slice(-15).map((x) => x.show.id);
        const back = pickNext(esRef.current, pool, ctxOf([...recent, ...picks.map((p) => p.show.id)]), n - picks.length);
        picks = [...picks, ...back.map((p) => ({ ...p, why: `More from ${p.show.name}` }))];
      }
    }
    if (!picks.length) return;
    const byId = new Map<string, (typeof pool)[number]>(pool.map((c) => [c.show.id, c] as [string, (typeof pool)[number]]));
    const added: Item[] = picks.map((p, k) => {
      const isAgain = k >= newShows;
      const eps = byId.get(p.show.id)?.episodes;
      const ep = isAgain ? null : eps?.length ? chooseEpisode(esRef.current, eps) : null;
      return { key: `${p.show.id}-${Math.random().toString(36).slice(2, 7)}`, show: p.show, why: mode === "following" ? "A show you follow" : p.why, ep, state: ep ? "ready" : "loading", again: isAgain || undefined };
    });
    // For You: every few cards, an episode from Open Mic (new and independent creators).
    const woven: Item[] = [];
    let at = list.length;
    for (const a of added) {
      if (mode === "foryou" && !student && isMicSlot(at)) {
        const m = micPool.current.find((x) => !micUsed.current.has(x.post) && !esRef.current.heard.includes(x.episode.id));
        if (m) {
          micUsed.current.add(m.post);
          const ep = micEpisode(m.episode, m.creator.name);
          sourceOf.current.set(ep.id, "foryou");
          woven.push({ key: `mic-${m.post}`, show: micShow(m.episode, m.creator.name), why: "Open Mic", ep, state: "ready", mic: { post: m.post, handle: m.creator.handle, name: m.creator.name, newVoice: m.newVoice, followed: m.followed } });
          at++;
        }
      }
      woven.push(a); at++;
    }
    setItems((c) => [...c, ...woven]);
    added.filter((x) => x.state === "loading").forEach(fill);
  }, [candidates, fill, mode, esRef, student, growTargets, loadMore]);

  // Reset the feed when the mode changes; start it once there's something to pick from.
  useEffect(() => {
    // Something was just picked to play (Explore, a show, Social...): it already started the For You
    // feed with that pick, so there's nothing to clear.
    if (picked.current) { picked.current = false; return; }
    // For You, Following and each genre are separate feeds: switching starts the new one fresh.
    pausePlayer();
    againMisses.current = 0;
    setItems([]); itemsRef.current = []; setActive(0); activeRef.current = 0; prevActive.current = -1;
    if (feedRef.current) feedRef.current.scrollTop = 0;
    if (genreMode) loadPools([genreMode]).then(() => extend(6)).catch((e) => say(e?.message || "That genre didn't load."));
    else extend(6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  useEffect(() => { if (!itemsRef.current.length && (tab === "foryou" || tab === "following")) extend(6); }, [poolTick, extend, tab]);

  // Drop shows with nothing playable once they're ahead of the listener.
  useEffect(() => {
    if (items.some((x, i) => x.state === "none" && i > active)) {
      setItems((list) => list.filter((x, i) => !(x.state === "none" && i > activeRef.current)));
      extend(1);
    }
  }, [items, active, extend]);

  // Counts for episodes on screen.
  useEffect(() => {
    const ids = items.map((x) => x.ep?.id).filter((id): id is string => !!id && !counted.current.has(id)).slice(0, 40);
    if (!ids.length) return;
    ids.forEach((id) => counted.current.add(id));
    api(`/api/earshot/counts?ids=${ids.join(",")}`).then((b) => { setCounts((c) => ({ ...c, ...(b.counts || {}) })); if (typeof b.comments === "boolean") setCommentsOn(b.comments); }).catch(() => ids.forEach((id) => counted.current.delete(id)));
  }, [items, api]);

  // Coming back to the feed from another tab: land on the card that's playing, not the top (which the
  // "which card is on screen" watcher below would otherwise take as a swipe and play instead).
  useLayoutEffect(() => {
    if ((tab !== "foryou" && tab !== "following") || !feedRef.current) return;
    const el = feedRef.current.querySelector(`[data-i="${activeRef.current}"]`) as HTMLElement | null;
    if (el) feedRef.current.scrollTop = el.offsetTop;
  }, [tab]);
  // Which card is on screen.
  useEffect(() => {
    const root = feedRef.current; if (!root) return;
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting && en.intersectionRatio > 0.6) setActive(Number((en.target as HTMLElement).dataset.i));
    }, { root, threshold: [0.6] });
    root.querySelectorAll("[data-i]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items.length, tab, full]);

  // ---------------- audio: three players, so the next episode is loaded before you swipe ----------------
  const handlers = useRef({ time: (_a: HTMLAudioElement) => {}, ended: (_a: HTMLAudioElement) => {}, error: (_a: HTMLAudioElement) => {} });
  const pool = useCallback(() => {
    if (!players.current.length) {
      for (let k = 0; k < 3; k++) {
        const a = new Audio(); a.preload = "auto";
        a.addEventListener("timeupdate", () => { if (a === cur.current) handlers.current.time(a); });
        a.addEventListener("ended", () => { if (a === cur.current) handlers.current.ended(a); });
        a.addEventListener("play", () => { if (a === cur.current) setPlaying(true); });
        a.addEventListener("pause", () => { if (a === cur.current) setPlaying(false); });
        a.addEventListener("error", () => { if (a === cur.current && a.dataset.ep) handlers.current.error(a); });
        players.current.push(a);
      }
    }
    return players.current;
  }, []);
  useEffect(() => () => { players.current.forEach((a) => { a.pause(); a.removeAttribute("src"); a.load(); }); }, []);

  /** Must run inside a tap: lets every player start later without another tap (iPhone rule). */
  const unlock = () => {
    if (unlockedRef.current) return;
    unlockedRef.current = true; setUnlocked(true);
    for (const a of pool()) {
      if (a === cur.current) continue; // the tap itself starts this one
      if (!a.dataset.ep) a.src = silence();
      a.muted = true;
      const p = a.play();
      const done = () => { if (a !== cur.current) a.pause(); a.muted = false; };
      if (p) p.then(done, done); else done();
    }
  };

  // ---------------- playback through the server: ads found in this listener's own copy ----------------
  useEffect(() => {
    if (!mediaUrl) return;
    let stop = false; let t: ReturnType<typeof setTimeout> | null = null;
    const get = () => api("/api/earshot/play-token").then((b) => {
      if (stop || !b?.token) return;
      const first = !playTok.current;
      playTok.current = { token: String(b.token), exp: Number(b.exp) * 1000, audio: String(b.audio || "/api/earshot/audio/") };
      // Players loaded before the token came back play straight from the host: switch the ones that haven't started.
      if (first) for (const a of players.current) {
        const ep = itemsRef.current.find((x) => x.ep?.id === a.dataset.ep)?.ep;
        if (!ep || a.dataset.sid || !a.paused || a.currentTime > 0.5) continue;
        const via = viaServer(ep); if (!via) continue;
        a.dataset.sid = via; a.src = sessionSrc(ep, via); a.load();
      }
      t = setTimeout(get, Math.max(60_000, playTok.current.exp - Date.now() - 30 * 60_000));
    }).catch(() => { if (!stop) t = setTimeout(get, 60_000); });
    void get();
    return () => { stop = true; if (t) clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, mediaUrl ? 1 : 0]);
  /** A session for this episode (its id), when its audio can come through the server. */
  const viaServer = (ep: PodEpisode): string | null => {
    const tok = playTok.current;
    if (!mediaUrl || !tok || tok.exp - Date.now() < 5 * 60_000 || direct.current.has(ep.id) || !throughServer(ep.audio)) return null;
    let p = plays.current.get(ep.id);
    // The server lets a session go after half an hour unused: start a new one before that.
    if (!p || p.ads?.gone || Date.now() - p.used > 20 * 60_000) { if (p?.timer) clearTimeout(p.timer); p = { sid: newSid(), showId: ep.showId, ads: null, polls: 0, timer: null, used: Date.now(), retried: p?.retried }; plays.current.set(ep.id, p); pollPlay(ep.id); }
    p.used = Date.now();
    return p.sid;
  };
  const sessionSrc = (ep: PodEpisode, sid: string) => mediaUrl!(`${playTok.current!.audio}${sid}?e=${ep.id}&s=${ep.showId}&k=${encodeURIComponent(playTok.current!.token)}`);
  /** Jumps past a sure ad the player is in right now (and says so). */
  const skipIfInAd = (a: HTMLAudioElement, ads: PlayAd[]) => {
    const t = a.currentTime || 0;
    const ad = ads.find((x) => x.sure && (x.kind !== "intro" || esRef.current.settings.skipIntro) && t >= x.s - 0.5 && t < x.e - 1 && !undone.current.has(x.key));
    if (!ad) return;
    try { a.currentTime = ad.e; } catch { return; }
    const epId = a.dataset.ep; if (epId) setSkipped({ ad, epId });
  };
  /** Asks what the server found in this session's copy: soon after it starts, then less often, until it's final. */
  const pollPlay = (epId: string, again = false) => {
    const p = plays.current.get(epId); if (!p) return;
    if (again) { if (p.timer) return; p.polls = 3; }
    if (p.timer) clearTimeout(p.timer);
    const wait = [700, 1200, 1800, 2500, 4000, 6000][p.polls] ?? 9000;
    p.timer = setTimeout(() => {
      p.timer = null;
      const q = plays.current.get(epId); if (q !== p) return;
      p.polls++;
      api(`/api/earshot/play/${p.sid}/ads`).then((b: SessionAds) => {
        if (plays.current.get(epId) !== p) return;
        p.ads = b; setAdsTick((x) => x + 1);
        // Playing inside an ad this copy turns out to have (the pre-roll, usually): jump past it now.
        const a = cur.current;
        if (a && a.dataset.sid === p.sid && esRef.current.settings.adMode === "auto" && !esRef.current.adFree.includes(p.showId)) skipIfInAd(a, b?.ads ?? []);
        if ((!b?.final || b?.pending) && p.polls < 60) pollPlay(epId);
      }).catch(() => { if (plays.current.get(epId) === p && p.polls < 40) pollPlay(epId); });
    }, wait);
  };
  useEffect(() => () => { plays.current.forEach((p) => { if (p.timer) clearTimeout(p.timer); }); }, []);

  /** The player holding this episode, loading it into a free one if needed (and starting where it should). */
  const playerFor = (ep: PodEpisode, keep: (HTMLAudioElement | null)[]) => {
    const list = pool();
    let a = list.find((x) => x.dataset.ep === ep.id);
    if (a) return a;
    a = list.find((x) => !keep.includes(x) && x !== cur.current) ?? list.find((x) => !keep.includes(x))!;
    a.pause();
    a.dataset.ep = ep.id;
    const via = viaServer(ep);
    if (via) a.dataset.sid = via; else delete a.dataset.sid;
    a.src = via ? sessionSrc(ep, via) : ep.audio;
    a.preload = "auto";
    // Through the server the intro is found and skipped exactly; otherwise long episodes start 90 s in.
    const at = startAt(ep.secs, readSpots()[ep.id]?.t, via ? false : esRef.current.settings.skipIntro);
    a.addEventListener("loadedmetadata", () => {
      // Where to start: a saved spot or intro skip, or after the pre-roll the server found in this copy.
      const pre = via && esRef.current.settings.adMode === "auto" && !esRef.current.adFree.includes(ep.showId) ? plays.current.get(ep.id)?.ads?.startAt ?? 0 : 0;
      const to = Math.max(at || 0, pre);
      try { if (to && a!.dataset.ep === ep.id && a!.currentTime < 1) a!.currentTime = to; } catch { /* the host doesn't allow seeking */ }
    }, { once: true });
    // iPhones ignore a jump made before the audio is ready; check again once it plays.
    a.addEventListener("playing", () => { const p = plays.current.get(ep.id); if (a!.dataset.sid && p && a!.dataset.sid === p.sid && esRef.current.settings.adMode === "auto" && !esRef.current.adFree.includes(ep.showId)) skipIfInAd(a!, p.ads?.ads ?? []); }, { once: true });
    a.load();
    return a;
  };

  function pausePlayer() { cur.current?.pause(); setPlaying(false); }
  useEffect(() => { if (locked) { players.current.forEach((a) => a.pause()); setPlaying(false); } }, [locked]);
  const leave = useCallback((i: number) => {
    const it = itemsRef.current[i]; if (!it?.ep || !unlockedRef.current) return;
    if (cur.current?.dataset.ep === it.ep.id) saveSpot(it.ep, cur.current.currentTime);
    const secs = listened.current;
    if (secs < 3) { signal(it.show.genre, "skip"); update((e) => ({ ...e, skipped: [it.show.id, ...e.skipped].slice(0, 80) })); }
    else if (secs >= 30) { signal(it.show.genre, "listen"); const id = it.ep.id; update((e) => (e.heard.includes(id) ? e : { ...e, heard: [id, ...e.heard].slice(0, 200) })); }
  }, [signal, update]);

  const activate = useCallback((i: number, play: boolean) => {
    const it = itemsRef.current[i]; if (!it?.ep) return;
    const ep = it.ep;
    const next = itemsRef.current[i + 1]?.ep;
    const a = playerFor(ep, []);
    if (cur.current && cur.current !== a) cur.current.pause();
    cur.current = a;
    // It failed while loading ahead (through the server): load it again now that it's playing.
    if (a.error && a.dataset.sid) handlers.current.error(a);
    listened.current = 0; lastTime.current = a.currentTime; lastSpot.current = 0; setSkipped(null);
    if (markingRef.current && markingRef.current.epId !== ep.id) setMarking(null);
    loadAds(ep);
    setTime(a.currentTime || 0); setDur(Number.isFinite(a.duration) ? a.duration : ep.secs || 0);
    a.playbackRate = esRef.current.settings.speed;
    if (play) a.play().catch(() => setPlaying(false));
    if (next) playerFor(next, [a]);
    // Covers for the next few are fetched now, so they're there the moment you swipe.
    itemsRef.current.slice(i + 1, i + 4).forEach((x) => { const img = new Image(); img.src = x.ep?.art || x.show.art; });
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: ep.title, artist: ep.show, album: standalone ? "Pod+" : "Earshot", artwork: ep.art ? [{ src: ep.art, sizes: "600x600" }] : [] });
        navigator.mediaSession.setActionHandler("nexttrack", () => goTo(activeRef.current + 1));
        navigator.mediaSession.setActionHandler("previoustrack", () => goTo(activeRef.current - 1));
        navigator.mediaSession.setActionHandler("seekbackward", () => seekBy(-15));
        navigator.mediaSession.setActionHandler("seekforward", () => seekBy(30));
      } catch { /* not supported */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esRef, standalone]);

  const prevActive = useRef(-1);
  useEffect(() => {
    if (prevActive.current !== active && prevActive.current >= 0) leave(prevActive.current);
    prevActive.current = active;
    if (active >= items.length - 3) extend(4);
    if (items[active]?.ep) activate(active, unlockedRef.current);
    else pausePlayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  // When the active card's episode arrives after we got there, or the next one arrives, load them.
  const activeEpId = items[active]?.ep?.id, nextEpId = items[active + 1]?.ep?.id;
  useEffect(() => { if (activeEpId && cur.current?.dataset.ep !== activeEpId) activate(active, unlockedRef.current); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeEpId]);
  useEffect(() => { const n = items[active + 1]?.ep; if (n && cur.current) playerFor(n, [cur.current]); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [nextEpId]);
  useEffect(() => { if (cur.current) cur.current.playbackRate = es.settings.speed; }, [es.settings.speed]);
  useEffect(() => { const save = () => { const it = itemsRef.current[activeRef.current]; if (it?.ep && cur.current?.dataset.ep === it.ep.id) saveSpot(it.ep, cur.current.currentTime); }; window.addEventListener("pagehide", save); return () => window.removeEventListener("pagehide", save); }, []);

  const goTo = (i: number) => {
    const root = feedRef.current; if (!root) return;
    const el = root.querySelector(`[data-i="${Math.max(0, i)}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const toggle = () => {
    if (locked) return;
    unlock();
    const it = items[active]; if (!it?.ep) return;
    const a = cur.current;
    if (!a || a.dataset.ep !== it.ep.id) { activate(active, true); return; }
    if (a.paused) { a.playbackRate = esRef.current.settings.speed; a.play().catch(() => setPlaying(false)); } else a.pause();
  };
  const seekBy = (d: number) => {
    const a = cur.current; if (!a || !a.dataset.ep) return;
    const from = a.currentTime;
    a.currentTime = Math.max(0, Math.min((a.duration || dur) - 1, a.currentTime + d));
    if (d > 0 && !markingRef.current) noteSkip(a.dataset.ep, from, a.currentTime);
  };
  /** Plays s..e of the episode playing (the clip maker's "Hear it"), then pauses there. */
  const previewT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewClip = (s: number, e: number) => {
    const a = cur.current; if (!a) return;
    if (previewT.current) clearTimeout(previewT.current);
    a.currentTime = s; setTime(s); void a.play().catch(() => {});
    const stop = () => { if (a.currentTime >= e - 0.1) { a.pause(); a.removeEventListener("timeupdate", stop); } };
    a.addEventListener("timeupdate", stop);
    previewT.current = setTimeout(() => a.removeEventListener("timeupdate", stop), ((e - s) / (a.playbackRate || 1)) * 1000 + 4000);
  };
  /** user: the listener dragged the bar (a big jump forward counts as skipping past something). */
  const seekTo = (t: number, user = false) => {
    const a = cur.current; if (!a || !a.dataset.ep) return;
    const from = a.currentTime;
    a.currentTime = Math.max(0, t); setTime(a.currentTime);
    if (user && a.currentTime - from >= 10 && !markingRef.current) noteSkip(a.dataset.ep, from, a.currentTime);
  };
  // Forward jumps in a row (+30, +30…) are one skip; sent when they stop. Several listeners skipping the
  // same spot is how "Listeners skip this" is found.
  const flushSkip = () => {
    const r = skipRun.current; skipRun.current = null;
    const D = cur.current?.duration;
    const play = cur.current?.dataset.ep === r?.epId ? cur.current?.dataset.sid : undefined;
    if (r && D && Number.isFinite(D) && r.to - r.from >= 10 && r.to - r.from <= 300) api(`/api/earshot/ads/${r.epId}/skip`, { method: "POST", body: { from: r.from, to: r.to, dur: D, play } }).catch(() => {});
  };
  const noteSkip = (epId: string, from: number, to: number) => {
    const r = skipRun.current, now = Date.now();
    if (r && r.epId === epId && now - r.at < 5000 && Math.abs(r.to - from) < 3) { r.to = to; r.at = now; }
    else { flushSkip(); skipRun.current = { epId, from, to, at: now }; }
    if (skipT.current) clearTimeout(skipT.current);
    skipT.current = setTimeout(flushSkip, 5000);
  };

  // ---------------- read along and ad skip ----------------
  const activeEp = items[active]?.ep ?? null;
  const txFor = (ep: PodEpisode | null) => (ep ? txs.current.get(ep.id) : undefined);
  const loadTx = useCallback((ep: PodEpisode, chunk: number) => {
    let t = txs.current.get(ep.id);
    if (!t) { t = emptyTx(); txs.current.set(ep.id, t); }
    if (t.chunks.has(chunk) || t.loading.has(chunk) || (chunk > 0 && !t.more)) return;
    const w = t.wait.get(chunk);
    if (w && Date.now() < w.at) return;
    t.loading.add(chunk); setTxTick((x) => x + 1);
    // Playing through the server: the transcript is made from (and timed to) this very copy.
    const p = plays.current.get(ep.id);
    const play = p && players.current.some((a) => a.dataset.ep === ep.id && a.dataset.sid === p.sid) ? `&play=${p.sid}` : "";
    api(`/api/earshot/transcript/${ep.id}?show=${ep.showId}&chunk=${chunk}${play}`).then((r: TranscriptChunk) => {
      const x = txs.current.get(ep.id)!;
      x.loading.delete(chunk);
      // "Not right now" (the transcriber was busy): leave this piece open and ask again in 20 s, up to 6
      // times. It mustn't count as done, nor end the episode's transcript, or every later ad goes unfound.
      if (r.source === "none" && r.retry) {
        const tries = (x.wait.get(chunk)?.tries ?? 0) + 1;
        if (tries < 6) { x.wait.set(chunk, { at: Date.now() + 20_000, tries }); setTxTick((v) => v + 1); return; }
      }
      x.wait.delete(chunk); x.chunks.add(chunk);
      if (r.source !== "none" || chunk === 0) { x.source = r.source === "none" && x.segments.length ? x.source : r.source; x.reason = r.reason || ""; }
      x.chunkSecs = r.chunkSecs || x.chunkSecs; if (!r.retry) x.more = !!r.more;
      const seen = new Set(x.segments.map((s) => s.s));
      x.segments = [...x.segments, ...r.segments.filter((s) => !seen.has(s.s))].sort((a, b) => a.s - b.s);
      x.ads = mergeAds([...x.ads, ...r.ads]);
      if (r.chapters?.length) x.chapters = r.chapters;
      setTxTick((v) => v + 1);
      if (r.ads?.length) { loadAds(ep); if (play) pollPlay(ep.id, true); }
    }).catch(() => { const x = txs.current.get(ep.id); if (x) x.loading.delete(chunk); setTxTick((v) => v + 1); });
  }, [api]);
  /** Everything known about an episode's ads: found automatically, marked by listeners, often skipped. */
  const loadAds = useCallback((ep: PodEpisode) => {
    api(`/api/earshot/ads/${ep.id}`).then((b) => {
      serverAds.current.set(ep.id, Array.isArray(b?.ads) ? b.ads : []);
      if (typeof b?.shared === "boolean") setAdsShared(b.shared);
      setAdsTick((x) => x + 1);
    }).catch(() => {});
  }, [api]);
  const voteAd = (epId: string, key: string, vote: 1 | -1) => {
    if (!/^[auctg]:/.test(key)) return;
    api(`/api/earshot/ads/${epId}/vote`, { method: "POST", body: { key, vote } }).catch(() => {});
  };
  /** Transcripts are fetched once someone is really listening (or opens Read), never just for swiping past. */
  const wantTx = (ep: PodEpisode, t: number) => {
    const x = txs.current.get(ep.id);
    const chunkSecs = x?.chunkSecs || 600;
    const c = Math.floor(t / chunkSecs);
    loadTx(ep, c);
    if (t % chunkSecs > chunkSecs - 120) loadTx(ep, c + 1);
  };

  handlers.current.time = (a) => {
    const t = a.currentTime; const delta = t - lastTime.current; lastTime.current = t;
    if (delta > 0 && delta < 2) listened.current += delta;
    setTime(t); if (a.duration && Number.isFinite(a.duration)) setDur(a.duration);
    const it = itemsRef.current[activeRef.current]; const ep = it?.ep;
    if (ep && Math.abs(t - lastSpot.current) > 5) { lastSpot.current = t; saveSpot(ep, t); }
    // Plays and listening time for episodes people made, for their Studio.
    if (ep && OWN_EPISODE.test(ep.id) && delta > 0 && delta < 2) {
      const h = micHeard.current;
      if (h.ep !== ep.id) { h.ep = ep.id; h.secs = 0; }
      h.secs += delta;
      if (h.secs >= 15) { const secs = Math.round(h.secs); h.secs = 0; void api("/api/earshot/creators/listen", { method: "POST", body: { episode: ep.id, secs, source: sourceOf.current.get(ep.id) ?? "other" } }).catch(() => {}); }
    }
    const mode = esRef.current.settings.adMode;
    if (ep && (listened.current > 5 || sheetRef.current?.kind === "read") && (mode !== "off" || sheetRef.current?.kind === "read")) wantTx(ep, t);
    if (ep && it && mode === "auto" && !esRef.current.adFree.includes(it.show.id) && !markingRef.current) {
      const ad = playAdAt(adsRef.current, t);
      if (ad && ad.sure && !undone.current.has(ad.key)) { a.currentTime = ad.e; setSkipped({ ad, epId: ep.id }); }
    }
    const sl = sleepRef.current;
    if (typeof sl === "number" && Date.now() >= sl) { a.pause(); setSleepAt(null); say("Sleep timer: paused. Sleep well."); }
    const adv = esRef.current.settings.advance;
    if (adv && listened.current >= adv && !sheetRef.current) { listened.current = -1e9; goTo(activeRef.current + 1); }
  };
  handlers.current.ended = () => {
    const it = itemsRef.current[activeRef.current];
    if (it?.ep) { signal(it.show.genre, "finish"); saveSpot(it.ep, 0); const id = it.ep.id; update((e) => (e.heard.includes(id) ? e : { ...e, heard: [id, ...e.heard].slice(0, 200) })); }
    setPlaying(false);
    if (sleepRef.current === "end") { setSleepAt(null); say("Sleep timer: stopped at the end of the episode."); return; }
    if (!sheetRef.current) goTo(activeRef.current + 1);
  };
  handlers.current.error = (a) => {
    // Through the server didn't work: a new session once, then straight from the host, from the same spot.
    const it = itemsRef.current[activeRef.current]; const ep = it?.ep;
    if (ep && a.dataset.sid && a.dataset.ep === ep.id) {
      const t = a.currentTime || 0, wasPlaying = !a.paused || playing;
      const p = plays.current.get(ep.id); if (p?.timer) clearTimeout(p.timer); plays.current.delete(ep.id);
      if (!p?.retried) plays.current.set(ep.id, { sid: "", showId: ep.showId, ads: { ready: true, final: true, ads: [], how: "failed", compared: 0, gone: true }, polls: 0, timer: null, used: 0, retried: true });
      else direct.current.add(ep.id);
      const via = viaServer(ep);
      if (via) a.dataset.sid = via; else delete a.dataset.sid;
      a.src = via ? sessionSrc(ep, via) : ep.audio; a.load();
      if (t > 1) a.addEventListener("loadedmetadata", () => { try { a.currentTime = t; } catch { /* not seekable */ } }, { once: true });
      if (wasPlaying) a.play().catch(() => setPlaying(false));
      return;
    }
    if (unlockedRef.current) say("This episode won't play here. Swipe for the next one, or open it in Apple Podcasts.");
  };

  // The ads that fit this listener's copy of the episode (see alignAds), plus their own marks.
  const activeShowId = items[active]?.show.id ?? "";
  const activeAds: PlayAd[] = useMemo(() => {
    if (!activeEp || !(dur > 0)) return [];
    const mine = localAds.current.get(activeEp.id) ?? [];
    // Ads the server found in this very copy (exact), then the rest, leaving out ones they already cover.
    const p = plays.current.get(activeEp.id);
    const mineCopy = !!p && cur.current?.dataset.sid === p.sid;
    const own = mineCopy ? p!.ads?.ads ?? [] : [];
    // Once this copy has been compared, guesses from other copies (unsure, found in a copy of another
    // length) are left out; listeners' marks and exact matches stay.
    const compared = mineCopy && !!p!.ads?.final && (p!.ads.how === "diff" || p!.ads.how === "same");
    const covered = (a: PlayAd) => own.some((o) => Math.min(o.e, a.e) - Math.max(o.s, a.s) > 0.5 * (a.e - a.s));
    const others = alignAds(serverAds.current.get(activeEp.id) ?? [], dur).filter((a) => !compared || a.sure || a.kind === "user" || a.kind === "crowd");
    return [...own, ...[...others, ...mine].filter((a) => !covered(a))].filter((a) => !undone.current.has(a.key) && (a.kind !== "intro" || esRef.current.settings.skipIntro)).sort((x, y) => x.s - y.s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEp?.id, Math.round(dur * 10), adsTick]);
  const adsRef = useRef(activeAds); adsRef.current = activeAds;
  const adMode: AdMode = es.settings.adMode;
  const adsOn = adMode !== "off" && !es.adFree.includes(activeShowId);
  const adNow = adsOn ? playAdAt(activeAds, time) : null;
  // Shown as a button when it wasn't skipped by itself (Ask mode, or not sure enough to skip).
  const adOffer = adNow && !(adNow.sure && adMode === "auto") ? adNow : null;
  const undoSkip = () => {
    if (!skipped) return;
    undone.current.add(skipped.ad.key); seekTo(skipped.ad.s); voteAd(skipped.epId, skipped.ad.key, -1); setSkipped(null); setAdsTick((x) => x + 1);
    say("Got it, that wasn't an ad. It won't be skipped for you, and your vote counts for everyone.");
  };
  const takeOffer = () => { if (!adOffer || !activeEp) return; seekTo(adOffer.e); if (!adOffer.sure) voteAd(activeEp.id, adOffer.key, 1); };
  const refuseOffer = () => { if (!adOffer || !activeEp) return; undone.current.add(adOffer.key); voteAd(activeEp.id, adOffer.key, -1); setAdsTick((x) => x + 1); say("Thanks. Marked as not an ad."); };
  useEffect(() => { if (!skipped) return; const t = setTimeout(() => setSkipped(null), 6000); return () => clearTimeout(t); }, [skipped]);
  void txTick;

  // ---------------- "Mark ad": a listener marks an ad, and it's skipped for everyone with the same copy ----------------
  const startMark = () => {
    const a = cur.current, ep = activeEp; if (!a || !ep || a.dataset.ep !== ep.id) { say("Play the episode first, then tap Mark ad when an ad starts."); return; }
    setMarking({ epId: ep.id, s: Math.max(0, Math.floor(a.currentTime) - 3) });
    if (a.paused) toggle();
  };
  const endMark = () => {
    const m = markingRef.current, a = cur.current, it = items[active]; if (!m || !a || !it?.ep) return;
    const e = Math.max(m.s + 3, Math.floor(a.currentTime));
    setMarking(null);
    setDraft({ ep: it.ep, showId: it.show.id, s: m.s, e, label: "" });
  };
  const markFromLines = (s: number, e: number) => { const it = items[active]; if (!it?.ep) return; setSheet(null); setDraft({ ep: it.ep, showId: it.show.id, s: Math.floor(s), e: Math.ceil(e), label: "" }); };
  const saveDraft = async () => {
    const d = draft; const D = cur.current?.duration; if (!d) return;
    const dur = D && Number.isFinite(D) ? D : d.ep.secs;
    const local: PlayAd = { key: `l:${d.ep.id}:${d.s}:${d.e}`, s: d.s, e: d.e, label: d.label || "Ad break", kind: "user", sure: true };
    setDraft(null);
    try {
      // Playing through the server: the mark is kept in show time, so it fits everyone's copy.
      const play = cur.current?.dataset.ep === d.ep.id ? cur.current?.dataset.sid : undefined;
      const b = await api(`/api/earshot/ads/${d.ep.id}/mark`, { method: "POST", body: { showId: d.showId, s: d.s, e: d.e, dur, label: d.label, play } });
      if (Array.isArray(b?.ads)) serverAds.current.set(d.ep.id, b.ads);
      if (play) { localAds.current.set(d.ep.id, [...(localAds.current.get(d.ep.id) ?? []), local]); pollPlay(d.ep.id, true); }
      setAdsTick((x) => x + 1);
      say(play ? "Thanks! This ad will be skipped for everyone who plays this episode." : "Thanks! This ad will be skipped for everyone with this version of the episode.");
    } catch (e: any) {
      localAds.current.set(d.ep.id, [...(localAds.current.get(d.ep.id) ?? []), local]);
      setAdsTick((x) => x + 1);
      say(e?.status === 503 ? "Saved for you. Sharing marks with everyone isn't switched on yet." : e?.message || "That didn't save. Try again.");
    }
  };

  // ---------------- actions ----------------
  const isFollowing = (id: string) => es.follows.some((f) => f.id === id);
  /** Follows the person who made an Open Mic episode (a person on Social, not an Apple show). */
  const followCreator = (it: Item) => {
    const m = it.mic; if (!m) return;
    const on = !m.followed;
    const set = (v: boolean) => setItems((list) => list.map((x) => (x.mic?.handle === m.handle ? { ...x, mic: { ...x.mic!, followed: v } } : x)));
    set(on);
    api("/api/earshot/social/follow", { method: "POST", body: { handle: m.handle, on } }).then(() => say(on ? `Following @${m.handle}.` : `Unfollowed @${m.handle}.`))
      .catch((e) => { set(!on); say(/profile/i.test(e?.message || "") ? "Make your profile in Social first, then follow creators." : e.message); });
  };
  const toggleFollow = (show: PodShow) => {
    if (isFollowing(show.id)) { update((e) => ({ ...e, follows: e.follows.filter((f) => f.id !== show.id) })); signal(show.genre, "unfollow"); say(`Unfollowed ${show.name}.`); }
    else { update((e) => ({ ...e, follows: [{ id: show.id, name: show.name, author: show.author, art: show.art, genre: show.genre, at: nowIso() }, ...e.follows].slice(0, 200) })); signal(show.genre, "follow"); say(`Following ${show.name}.`); }
  };
  const toggleLike = (ep: PodEpisode, genre: string) => {
    const on = !(counts[ep.id]?.liked);
    setCounts((c) => ({ ...c, [ep.id]: { ...(c[ep.id] ?? { likes: 0, comments: 0, shares: 0, liked: false }), liked: on, likes: Math.max(0, (c[ep.id]?.likes ?? 0) + (on ? 1 : -1)) } }));
    update((e) => ({ ...e, liked: on ? [savedOf(ep), ...e.liked.filter((x) => x.id !== ep.id)].slice(0, 300) : e.liked.filter((x) => x.id !== ep.id) }));
    signal(genre, on ? "like" : "unlike");
    api("/api/earshot/like", { method: "POST", body: { episodeId: ep.id, on } }).catch((e) => say(e.message));
  };
  const toggleSave = (ep: PodEpisode, genre: string) => {
    const on = !es.saved.some((x) => x.id === ep.id);
    update((e) => ({ ...e, saved: on ? [savedOf(ep), ...e.saved].slice(0, 300) : e.saved.filter((x) => x.id !== ep.id) }));
    if (on) { signal(genre, "save"); say("Saved to your Library."); }
    // Bookmarks show on your social profile (when you have one).
    if (!student) api("/api/earshot/social/bookmark", { method: "POST", body: { episode: postEpisodeOf(ep), on } }).catch(() => {});
  };
  const share = async (ep: PodEpisode, genre: string, show?: PodShow) => {
    const link = show && shareLink ? shareLink(show, ep) : ep.link;
    const text = shareText({ ...ep, link });
    let done = false;
    try { if (navigator.share) { await navigator.share({ title: ep.title, text: `“${ep.title}” from ${ep.show}`, url: link || undefined }); done = true; } } catch (e: any) { if (e?.name === "AbortError") return; }
    if (!done) { try { await navigator.clipboard.writeText(text); say("Link copied. Paste it anywhere to share."); done = true; } catch { say(text); } }
    if (done) {
      setCounts((c) => ({ ...c, [ep.id]: { ...(c[ep.id] ?? { likes: 0, comments: 0, shares: 0, liked: false }), shares: (c[ep.id]?.shares ?? 0) + 1 } }));
      signal(genre, "share");
      api("/api/earshot/share", { method: "POST", body: { episodeId: ep.id } }).catch(() => {});
    }
  };
  /** from: start at that moment (a clip's place in its episode). */
  const playNow = (show: PodShow, ep: PodEpisode, from?: number) => {
    unlock();
    if (typeof from === "number" && from > 0) saveSpot(ep, Math.max(15, from));
    setSheet(null); setGenreMode(null);
    const item: Item = { key: `${show.id}-${Math.random().toString(36).slice(2, 7)}`, show, why: "You picked this", ep, state: "ready" };
    // From another feed (Following, a genre), the pick starts For You fresh; in For You it slots in next.
    const switching = mode !== "foryou";
    const at = !switching && itemsRef.current.length ? activeRef.current + 1 : 0;
    if (switching) { picked.current = true; pausePlayer(); itemsRef.current = []; setActive(0); activeRef.current = 0; prevActive.current = -1; }
    if (tab !== "foryou") setTab("foryou");
    setItems((list) => { const next = switching ? [] : [...list]; next.splice(at, 0, item); return next; });
    setTimeout(() => goTo(at), 120);
  };
  /** Plays a list back to back: the chosen episode now, the rest right after it in the feed. */
  const playList = (list: Item[]) => {
    if (!list.length) return;
    unlock();
    setSheet(null); setGenreMode(null);
    const switching = mode !== "foryou";
    const at = !switching && itemsRef.current.length ? activeRef.current + 1 : 0;
    if (switching) { picked.current = true; pausePlayer(); itemsRef.current = []; setActive(0); activeRef.current = 0; prevActive.current = -1; }
    if (tab !== "foryou") setTab("foryou");
    setItems((cur) => { const next = switching ? [] : [...cur]; next.splice(at, 0, ...list); return next; });
    list.filter((x) => x.state === "loading").forEach(fill);
    setTimeout(() => goTo(at), 120);
  };
  const playFrom = (show: PodShow, list: PodEpisode[], i: number) => playList(list.slice(i, i + 30).map((ep, k) => ({ key: `${show.id}-${ep.id}-${Math.random().toString(36).slice(2, 6)}`, show, why: k === 0 ? "You picked this" : `Up next · ${show.name}`, ep, state: "ready" as const })));
  /** A subject playlist (Explore → Browse by subject): episodes from many shows, back to back. */
  const playEpisodes = (list: PodEpisode[], i: number, title: string) => playList(list.slice(i, i + 40).map((ep, k) => {
    const show: PodShow = { id: ep.showId, name: ep.show, author: ep.author, art: ep.art, genre: "culture", appleGenre: "", link: ep.link, episodes: 0, explicit: ep.explicit, latest: ep.date };
    return { key: `t-${ep.id}-${Math.random().toString(36).slice(2, 6)}`, show, why: k === 0 ? `From ${title}` : `Up next · ${title}`, ep, state: "ready" as const };
  }));
  /** Saves a subject playlist to the listener's own playlists (replacing it if they saved it before). */
  const saveTopic = (topic: Topic, list: PodEpisode[]) => {
    const id = `t-${topic.id}`.slice(0, 24);
    const cur = esRef.current.modes;
    if (!cur.some((m) => m.id === id) && cur.length >= EARSHOT_LIMITS.modes) { say(`You have ${EARSHOT_LIMITS.modes} playlists, the most there can be. Delete one in Library first.`); return; }
    const episodes = list.slice(0, EARSHOT_LIMITS.modeEpisodes).map(savedOf);
    update((e) => ({ ...e, modes: e.modes.some((m) => m.id === id) ? e.modes.map((m) => (m.id === id ? { ...m, episodes } : m)) : [...e.modes, { id, name: topic.name.slice(0, 30), icon: "📚", episodes }] }));
    say(`Saved "${topic.name}" to your playlists in Library.`);
  };
  const playSaved = (list: SavedEpisode[], i: number, why: string) => playList(list.slice(i, i + 60).map((s) => {
    const show: PodShow = { id: s.showId, name: s.show, author: "", art: s.art, genre: "culture", appleGenre: "", link: "", episodes: 0, explicit: false, latest: "" };
    return s.audio ? { key: `m-${s.id}-${Math.random().toString(36).slice(2, 6)}`, show, why, ep: episodeOf(s), state: "ready" as const } : { key: `m-${s.id}-${Math.random().toString(36).slice(2, 6)}`, show, why, ep: null, state: "loading" as const, want: s.id };
  }));
  /** A preview's audio: through the server when it can, and when the show itself starts in this copy
   *  (after the pre-roll ads stitched in ahead of it), or 0 when there are none or it can't tell. */
  const previewSource = (ep: PodEpisode) => {
    const via = viaServer(ep);
    const src = via ? sessionSrc(ep, via) : ep.audio;
    const showStart = () => new Promise<number>((resolve) => {
      const known = () => api(`/api/earshot/ads/${ep.id}`).then((b) => {
        const pre = alignAds(Array.isArray(b?.ads) ? b.ads : [], ep.secs || 0).find((a) => a.s < 2 && a.kind !== "intro" && a.e - a.s <= 300);
        resolve(pre ? pre.e : 0);
      }).catch(() => resolve(0));
      if (!via) { void known(); return; }
      const until = Date.now() + 6000;
      const look = () => {
        const p = plays.current.get(ep.id), a = p && p.sid === via ? p.ads : null;
        if (a?.ready) return resolve(a.startAt ?? 0);
        if (Date.now() > until) return void known();
        setTimeout(look, 400);
      };
      look();
    });
    return { src, showStart };
  };
  const openRead = () => { const ep = items[active]?.ep; if (!ep) return; setSheet({ kind: "read" }); wantTx(ep, cur.current?.dataset.ep === ep.id ? cur.current.currentTime : 0); };

  // A shared link opens its episode first (it plays on the first tap, as browsers require).
  const started = useRef(false);
  useEffect(() => {
    if (!start || started.current) return;
    started.current = true;
    loadEpisodes(start.showId).then(({ show, episodes }) => {
      const ep = episodes.find((e) => e.id === start.episodeId) ?? episodes[0];
      if (!show || !ep) return;
      setItems((list) => [{ key: `start-${ep.id}`, show, why: "Shared with you", ep, state: "ready" }, ...list.filter((x) => x.ep?.id !== ep.id)]);
      if (feedRef.current) feedRef.current.scrollTop = 0;
    }).catch(() => {});
  }, [start, loadEpisodes]);

  // Podscroll fills exactly the visible screen (100dvh). It used to size itself to the whole screen on
  // the iPhone home screen, which ran past what iOS shows and hid the bottom of every tab there.
  // iPhone home screen: iOS only paints the page in the top part of the screen and fills the strip
  // below it (about the clock bar's height) with the page's color. So that color follows the cover:
  // its average, darkened like the bottom of the card, from a tiny copy the server hands over.
  const toneArt = [items[active]?.ep?.art, items[active]?.show.art].find((a) => a && /mzstatic\.com/.test(a)) || "";
  useEffect(() => {
    if (!standalone || !mediaUrl) return;
    const root = document.documentElement.style;
    const meta = document.querySelector('meta[name="theme-color"]');
    const paint = (c: string) => { root.background = c; meta?.setAttribute("content", c); };
    if (!(tab === "foryou" || tab === "following") || !toneArt) { paint(!(tab === "foryou" || tab === "following") && day ? "#ffffff" : "#120e14"); return; }
    let live = true;
    void artTone(mediaUrl(`/api/earshot/art?u=${encodeURIComponent(toneArt)}`)).then((c) => { if (live && c) paint(c); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standalone, toneArt, tab, day]);
  // Once per visit from the home screen: the screen's real measurements, to the server log.
  const shellRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!standalone || (navigator as Navigator & { standalone?: boolean }).standalone !== true) return;
    const t = setTimeout(() => {
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;left:0;top:0;visibility:hidden;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom) 0";
      document.body.appendChild(probe);
      const cs = getComputedStyle(probe); const safe = [parseFloat(cs.paddingTop), parseFloat(cs.paddingBottom)]; probe.remove();
      const rect = (el: Element | null) => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; };
      const at = (y: number) => { const el = document.elementFromPoint(innerWidth / 2, y) as HTMLElement | null; return el ? `${el.tagName.toLowerCase()} ${String(el.className || "").slice(0, 80)}` : null; };
      api("/api/earshot/screen", { method: "POST", body: {
        v: 1, ua: navigator.userAgent.slice(0, 160), inner: [innerWidth, innerHeight], outer: [outerWidth, outerHeight], screen: [screen.width, screen.height],
        vv: visualViewport ? [Math.round(visualViewport.height), Math.round(visualViewport.offsetTop)] : null, doc: document.documentElement.clientHeight, body: document.body.clientHeight,
        safe, shell: rect(shellRef.current), feed: rect(feedRef.current),
        card: rect(document.querySelector(`article[data-i="${activeRef.current}"]`)), bottom: at(innerHeight - 3), dpr: devicePixelRatio,
      } }).catch(() => {});
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standalone]);
  const chooseSleep = (v: number | "end" | null) => { setSleepAt(v); say(v === null ? "Sleep timer off." : v === "end" ? "Stopping at the end of this episode." : `Stopping in ${Math.round((v - Date.now()) / 60000)} minutes.`); };
  // The 1× button on the Podscroll player steps through the speeds, as in Apple Podcasts.
  const cycleSpeed = () => {
    const at = (SPEEDS as readonly number[]).indexOf(es.settings.speed);
    const next = SPEEDS[(at + 1) % SPEEDS.length];
    update((e) => ({ ...e, settings: { ...e.settings, speed: next } }));
  };

  // ---------------- layout ----------------
  const shell = standalone ? "fixed inset-x-0 top-0 h-[100dvh] supports-[not(height:100dvh)]:h-full" : full ? "fixed inset-0 z-[60]" : "relative h-[min(84dvh,880px)] min-h-[560px] rounded-3xl";
  const tabs: [Tab, string][] = student ? [["foryou", "For You"], ["following", "Following"], ["explore", "Explore"], ["library", "Library"]] : [["foryou", "For You"], ["following", "Following"], ["openmic", "Open Mic"], ["social", "Social"], ["explore", "Explore"], ["library", "Library"]];
  const spots = tab === "library" || tab === "explore" ? readSpots() : {};

  // On Podscroll the frame covers the whole screen, under the status bar and home indicator, so the
  // cover art fills it edge to edge. What sits on top steps clear of those itself: the tab bar, the
  // other tabs (pad), the notices and the sheets.
  const pad = (n: ReactNode) => standalone ? <div className="box-border h-full pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)]">{n}</div> : n;
  // Social, Explore and Library are white pages; the player and its sheets stay dark.
  const page = tab === "openmic" || tab === "social" || tab === "explore" || tab === "library";
  const light = page && day;
  // What's playing stays reachable from the other tabs: a mini player along the bottom.
  const nowItem = items[active];
  const mini = page && !previews && !!nowItem?.ep && cur.current?.dataset.ep === nowItem.ep.id && (playing || time > 0);
  const miniPad = mini ? "pb-[4.75rem]" : "";
  const lit = (n: ReactNode) => day
    ? <div className={`ps-light h-full ${miniPad}`}><style>{LIGHT_CSS}</style>{pad(n)}</div>
    : <div className={`h-full bg-[#120e14] ${miniPad}`}>{pad(n)}</div>;
  const chip = light ? "bg-black/[.05] text-[#0f1419]" : "bg-black/45";
  const below = standalone ? "top-[calc(4rem+env(safe-area-inset-top,0px))]" : "top-16";
  return <div ref={shellRef} className={`${shell} flex flex-col overflow-hidden ${light ? "bg-white" : standalone && !page ? "bg-transparent" : "bg-[#120e14]"} text-white shadow-2xl`}>
    <header className={`absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-3 ${standalone ? "pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]" : "pt-3"}`}>
      {genreMode && tab === "foryou"
        ? <span className="flex items-center gap-2 rounded-full bg-black/55 py-1.5 pl-3 pr-1.5 text-sm font-bold backdrop-blur">{GENRE[genreMode]?.name}<button type="button" aria-label="Back to For You" onClick={() => setGenreMode(null)} className="grid h-7 w-7 place-items-center rounded-full bg-white/15"><X size={14} /></button></span>
        : <nav className={`flex min-w-0 gap-1 overflow-x-auto rounded-full ${chip} p-1 backdrop-blur [scrollbar-width:none]`} aria-label="Sections">
          {tabs.map(([t, label]) => <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t} className={`flex-none rounded-full px-3 py-1.5 text-xs font-semibold sm:text-sm ${tab === t ? (light ? "bg-[#0f1419] text-white" : "bg-white text-[#120e14]") : light ? "text-[#536471]" : "text-white/75"}`}>{label}</button>)}
        </nav>}
      <div className="flex flex-none gap-1.5">
        {!student && <LiveChip live={live} light={light} onClick={() => setTab("openmic")} />}
        {sleepAt !== null && <span className={`flex items-center gap-1 rounded-full ${chip} px-2.5 text-xs font-bold backdrop-blur`}><Moon size={14} />{sleepAt === "end" ? "End" : `${Math.max(1, Math.ceil(((sleepAt as number) - Date.now()) / 60000))}m`}</span>}
        <button type="button" aria-label="Settings" onClick={() => setSheet({ kind: "settings" })} className={`grid h-9 w-9 place-items-center rounded-full ${chip} backdrop-blur`}><Settings2 size={18} /></button>
        {!standalone && <button type="button" aria-label={full ? "Exit full screen" : "Full screen"} onClick={() => setFull((f) => !f)} className={`grid h-9 w-9 place-items-center rounded-full ${chip} backdrop-blur`}>{full ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>}
      </div>
    </header>

    {(tab === "foryou" || tab === "following") && <div ref={feedRef} tabIndex={-1}
      onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); goTo(active + 1); } else if (e.key === "ArrowUp") { e.preventDefault(); goTo(active - 1); } else if (e.key === " ") { e.preventDefault(); toggle(); } }}
      className={`h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none] focus:outline-none`}>
      {!items.length && <FeedEmpty tab={tab} error={loadError} state={loadState} hasFollows={es.follows.length > 0} onExplore={() => setTab("explore")} onRetry={() => { episodesCache.current.clear(); setRetry((r) => r + 1); }} />}
      {items.map((it, i) => <Card key={it.key} i={i} item={it} active={i === active} playing={playing && i === active} time={i === active ? time : 0} dur={i === active ? dur : it.ep?.secs ?? 0}
        counts={it.ep ? counts[it.ep.id] : undefined} commentsOn={commentsOn} following={it.mic ? it.mic.followed : isFollowing(it.show.id)} saved={!!it.ep && (es.saved.some((x) => x.id === it.ep!.id) || es.modes.some((m) => m.episodes.some((x) => x.id === it.ep!.id)))} notes={es.settings.notes} full={es.settings.fullCover} unlocked={unlocked}
        apple={!!standalone} chapters={(i === active && txFor(it.ep)?.chapters) || NONE_CHAPTERS} lines={(i === active && txFor(it.ep)?.segments) || NONE_LINES} speed={es.settings.speed} onSpeed={cycleSpeed} sleepOn={sleepAt !== null} onSleep={() => setSheet({ kind: "sleep" })}
        ad={i === active ? adOffer : null} onSkipAd={takeOffer} onNotAd={refuseOffer} onTapStart={unlock}
        adMarks={i === active && adsOn ? activeAds : []} marking={i === active && !!marking} onMark={startMark}
        onToggle={toggle} onSeek={(t) => seekTo(t, true)} onBack={() => seekBy(-15)} onFwd={() => seekBy(30)} onRead={openRead}
        onLike={() => it.ep && toggleLike(it.ep, it.show.genre)} onDoubleLike={() => it.ep && !counts[it.ep.id]?.liked && toggleLike(it.ep, it.show.genre)}
        onSave={() => it.ep && setSheet({ kind: "addto", ep: it.ep, genre: it.show.genre })} onShare={() => it.ep && setSheet({ kind: "share", ep: it.ep, genre: it.show.genre, show: it.show })} onFollow={() => (it.mic ? followCreator(it) : toggleFollow(it.show))}
        onComments={() => it.ep && setSheet({ kind: "comments", ep: it.ep })} onShow={() => { if (it.mic) return openCreator(it.mic.handle); setSheet({ kind: "show", show: it.show }); signal(it.show.genre, "open"); }}
        onProfile={() => { if (it.mic) return openCreator(it.mic.handle); setSheet({ kind: "show", show: it.show }); signal(it.show.genre, "open"); }} onNext={() => goTo(i + 1)} />)}
    </div>}

    {skipped && <div role="status" className={`absolute inset-x-3 ${below} z-[25] mx-auto flex max-w-sm items-center justify-between gap-3 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-[#120e14] shadow-xl`}>
      <span className="min-w-0 truncate">Skipped {skipped.ad.kind === "user" ? "a listener-marked ad" : "an ad"}{skipped.ad.label && !/^(ad break|pre-roll)$/i.test(skipped.ad.label) ? ` · ${skipped.ad.label}` : ""} ({clock(skipped.ad.e - skipped.ad.s)})</span>
      <button type="button" onClick={undoSkip} className="flex-none rounded-full bg-[#120e14] px-3 py-1 text-xs font-semibold text-white">Undo</button>
    </div>}

    {marking && activeEp && marking.epId === activeEp.id && <div role="status" className={`absolute inset-x-3 ${below} z-[26] mx-auto flex max-w-md flex-col gap-2 rounded-2xl bg-[#ffd23f] p-3 text-[#120e14] shadow-xl`}>
      <div className="flex items-center justify-between gap-2 text-sm font-semibold"><span className="flex items-center gap-1.5"><Megaphone size={16} />Marking an ad · from {clock(marking.s)}</span>
        <span className="flex gap-1"><button type="button" aria-label="Ad started 5 seconds earlier" onClick={() => setMarking((m) => (m ? { ...m, s: Math.max(0, m.s - 5) } : m))} className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-semibold">−5s</button><button type="button" aria-label="Ad started 5 seconds later" onClick={() => setMarking((m) => (m ? { ...m, s: m.s + 5 } : m))} className="rounded-full bg-black/10 px-2 py-0.5 text-xs font-semibold">+5s</button></span></div>
      <p className="text-xs font-semibold">Listen (or jump ahead) until the show comes back, then tap “Ad's over”.</p>
      <div className="flex gap-2"><button type="button" onClick={() => seekBy(15)} className="flex-1 rounded-full bg-black/10 py-2 text-xs font-semibold">Jump 15s</button><button type="button" onClick={endMark} className="flex-1 rounded-full bg-[#120e14] py-2 text-xs font-semibold text-white">Ad's over</button><button type="button" onClick={() => setMarking(null)} className="rounded-full bg-black/10 px-3 py-2 text-xs font-semibold">Cancel</button></div>
    </div>}

    {tab === "explore" && lit(<Explore api={api} ex={ex} student={student} pools={pools.current} poolTick={poolTick} spots={spots} onPlayEpisode={playNow} onPreviews={setPreviews} onPlayEpisodes={playEpisodes} onSaveTopic={saveTopic}
      onGenre={(g) => { setGenreMode(g); setTab("foryou"); }} onShow={(show) => setSheet({ kind: "show", show })} onEpisode={playNow}
      onResume={(id, s) => loadEpisodes(s.showId).then(({ show, episodes }) => { const ep = episodes.find((e) => e.id === id); if (show && ep) playNow(show, ep); else say("That episode isn't available anymore."); }).catch((e) => say(e.message))} />)}
    {tab === "explore" && previews && <Previews picks={previews} source={previewSource} episodes={(id) => loadEpisodes(id).then((b) => b.episodes)} onClose={() => setPreviews(null)} onPlay={(s, e, at) => { setPreviews(null); playNow(s, e, at); }} onShow={(show) => setSheet({ kind: "show", show })} onHush={() => players.current.forEach((a) => a.pause())} />}
    {tab === "openmic" && !student && lit(<OpenMic api={api} say={say} creator={creator} live={live} onCreate={() => create("create")} onStudio={() => create("studio")} onJoinLive={joinLive} onPerson={openCreator}
      night={!day} onPlay={(show, ep, at) => { sourceOf.current.set(ep.id, "openmic"); playNow(show, ep, at); }} />)}
    {tab === "social" && !student && lit(<XSocial api={api} say={say} onHush={() => players.current.forEach((a) => a.pause())} onCreate={() => create("create")} openPerson={socialPerson} onPersonOpened={() => setSocialPerson(null)}
      onPlay={(show, ep, at) => { if (OWN_EPISODE.test(ep.id) && !sourceOf.current.has(ep.id)) sourceOf.current.set(ep.id, "social"); playNow(show, ep, at); }} />)}
    {tab === "library" && lit(<Library es={es} update={update} onEditInterests={onEditInterests} onMode={(m) => setSheet({ kind: "mode", id: m.id })} onOpen={(s) => loadEpisodes(s.showId).then(({ show, episodes }) => { const ep = episodes.find((e) => e.id === s.id); if (show && ep) playNow(show, ep); else say("That episode isn't available anymore."); }).catch((e) => say(e.message))} />)}

    {mini && nowItem?.ep && <MiniPlayer ep={nowItem.ep} art={nowItem.ep.art || nowItem.show.art} playing={playing} pct={dur ? (time / dur) * 100 : 0} light={day} standalone={!!standalone}
      onOpen={() => setTab(lastFeed.current)} onToggle={toggle} />}

    <div className={day ? "ps-light contents" : "contents"}>{day && <style>{LIGHT_CSS + LIGHT_SHEETS_CSS}</style>}
    {sheet?.kind === "comments" && <Comments ep={sheet.ep} api={api} say={say} nickname={nickname} setNickname={setNickname} onClose={() => setSheet(null)} onPosted={() => { setCounts((c) => ({ ...c, [sheet.ep.id]: { ...(c[sheet.ep.id] ?? { likes: 0, comments: 0, shares: 0, liked: false }), comments: (c[sheet.ep.id]?.comments ?? 0) + 1 } })); const it = items.find((x) => x.ep?.id === sheet.ep.id); if (it) signal(it.show.genre, "comment"); }} />}
    {sheet?.kind === "show" && <ShowPage show={sheet.show} load={loadEpisodes} hideTeasers={es.settings.hideTeasers} following={isFollowing(sheet.show.id)} adFree={es.adFree.includes(sheet.show.id)} onAdFree={(on) => update((e) => ({ ...e, adFree: on ? [sheet.show.id, ...e.adFree.filter((x) => x !== sheet.show.id)].slice(0, 300) : e.adFree.filter((x) => x !== sheet.show.id) }))} onFollow={toggleFollow} onPlayFrom={playFrom} onClose={() => setSheet(null)} onGenre={(g) => { setSheet(null); setGenreMode(g); setTab("foryou"); }} spots={readSpots()} onAddTo={(ep) => setSheet({ kind: "addto", ep, genre: sheet.show.genre })} />}
    {sheet?.kind === "share" && <ShareSheet api={api} say={say} ep={sheet.ep} social={!student} onLink={() => share(sheet.ep, sheet.genre, sheet.show)} onClose={() => setSheet(null)}
      onClip={cur.current?.dataset.ep === sheet.ep.id ? () => setSheet({ kind: "clip", ep: sheet.ep, time: cur.current?.currentTime ?? 0 }) : undefined} />}
    {sheet?.kind === "clip" && <ClipMaker api={api} say={say} ep={sheet.ep} time={sheet.time} lines={txFor(sheet.ep)?.segments ?? []} sid={cur.current?.dataset.ep === sheet.ep.id ? cur.current?.dataset.sid : undefined}
      onPreview={(s, e) => previewClip(s, e)} onClose={() => setSheet(null)} />}
    {sheet?.kind === "addto" && <AddToSheet es={es} ep={sheet.ep} saved={es.saved.some((x) => x.id === sheet.ep.id)} onSave={() => toggleSave(sheet.ep, sheet.genre)} update={update} say={say} onClose={() => setSheet(null)} toSaved={savedOf} />}
    {sheet?.kind === "mode" && (() => { const m = es.modes.find((x) => x.id === sheet.id); return m ? <ModeView mode={m} update={update} onPlay={(list, i) => playSaved(list, i, `${m.icon} ${m.name}`)} onClose={() => setSheet(null)} /> : null; })()}
    {sheet?.kind === "settings" && <SettingsSheet es={es} student={student} update={update} onClose={() => setSheet(null)} sleepAt={sleepAt} setSleep={chooseSleep} apple={!!standalone} theme={theme}
      account={standalone && creator?.signIn ? { email: creator.email, onSignIn: () => { setSheet(null); setMaker("signin"); },
        onSignOut: () => { void api("/api/earshot/account/signout", { method: "POST" }).catch(() => {}); onSession?.(null); setSheet(null); setTimeout(reloadCreator, 300); say("Signed out."); } } : undefined} />}
    {sheet?.kind === "sleep" && <SleepSheet sleepAt={sleepAt} onPick={(v) => { chooseSleep(v); setSheet(null); }} onClose={() => setSheet(null)} />}
    {draft && <MarkSheet draft={draft} shared={adsShared} onChange={setDraft} onPreview={(t) => { unlock(); seekTo(t); if (cur.current?.paused) toggle(); }} onSave={saveDraft} onClose={() => setDraft(null)} />}
    </div>
    {sheet?.kind === "read" && activeEp && <ReadAlong ep={activeEp} art={activeEp.art || items[active]?.show.art || ""} tx={txFor(activeEp)} time={time} dur={dur} playing={playing} onMarkRange={markFromLines}
      onSeek={(t) => { unlock(); seekTo(t); if (cur.current?.paused) toggle(); }} onToggle={toggle} onBack={() => seekBy(-15)} onFwd={() => seekBy(30)} onClose={() => setSheet(null)}
      onMore={() => { const x = txFor(activeEp); if (x) loadTx(activeEp, Math.max(-1, ...Array.from(x.chunks as Set<number>)) + 1); }} />}

    {/* Creating: sign in (Pod+), a profile, the Create menu, a new episode, going live, Studio, a LivePod */}
    {maker === "signin" && <SignInSheet api={api} say={say} why="Sign in with your email to publish episodes, go live and see your Studio." onClose={() => { afterSignIn.current = null; setMaker(null); }}
      onDone={(token, email) => { onSession?.(token, email); say(`Signed in as ${email}.`); const next = afterSignIn.current; afterSignIn.current = null; setMaker(null); setTimeout(() => { reloadCreator(); if (next) setMaker(next === "golive" || next === "upload" ? "create" : next); }, 350); }} />}
    {maker === "profile" && <ProfileEditor api={api} say={say} initial={creator?.profile ?? null} avatars={[]} onClose={() => setMaker(null)} onSaved={() => { reloadCreator(); const next = afterSignIn.current; afterSignIn.current = null; setMaker(next ?? null); }} />}
    {maker === "create" && <CreateSheet live={!!creator?.live} onClose={() => setMaker(null)} onEpisode={() => create("upload")} onLive={() => create("golive")} onStudio={() => create("studio")} />}
    {maker === "upload" && <UploadSheet api={api} say={say} onClose={() => setMaker(null)} onDone={() => { setMaker(null); micPool.current = []; setTab("openmic"); }} />}
    {maker === "golive" && <GoLiveSheet api={api} say={say} onClose={() => setMaker(null)} onStarted={(id, ticket) => { setMaker(null); pausePlayer(); setLiveRoom({ id, ticket }); reloadCreator(); }} />}
    {maker === "studio" && <Studio api={api} say={say} email={creator?.email ?? null} onClose={() => setMaker(null)} onCreate={() => setMaker("create")}
      onSignOut={creator?.signIn ? () => { void api("/api/earshot/account/signout", { method: "POST" }).catch(() => {}); onSession?.(null); setMaker(null); setTimeout(reloadCreator, 300); say("Signed out."); } : undefined} />}
    {liveRoom && <LiveRoom key={liveRoom.id} api={api} say={say} roomId={liveRoom.id} ticket={liveRoom.ticket} wsBase={liveBase || location.origin.replace(/^http/, "ws")}
      onClose={() => { setLiveRoom(null); reloadCreator(); api("/api/earshot/creators/live").then((b) => setLive(b.live || [])).catch(() => {}); }}
      onPerson={(h) => { setLiveRoom(null); openCreator(h); }} />}
  </div>;
}

function FeedEmpty({ tab, error, state, hasFollows, onExplore, onRetry }: { tab: Tab; error: string; state: "loading" | "ready" | "slow"; hasFollows: boolean; onExplore: () => void; onRetry: () => void }) {
  const retryBtn = <button type="button" onClick={onRetry} className="mt-2 min-h-11 rounded-full px-5 font-semibold bg-white text-[#111013]">Try again</button>;
  if (tab === "foryou" && state === "ready" && !error) return <Centered><p className="text-lg font-semibold">Nothing to play yet</p><p className="max-w-xs text-sm text-white/60">Podcasts for your genres are still being gathered. Try again in a moment, or browse genres in Explore.</p>{retryBtn}<button type="button" onClick={onExplore} className="min-h-11 rounded-full bg-white/10 px-5 font-bold">Explore</button></Centered>;
  if (state === "slow" && !error) return <Centered><Loader2 className="animate-spin" size={36} style={{ color: ACCENT }} /><p className="text-sm font-bold text-white/70">Still tuning in… this is taking longer than usual.</p>{retryBtn}</Centered>;
  if (tab === "following" && !hasFollows) return <Centered><p className="text-xl font-semibold">Nothing here yet</p><p className="max-w-xs text-sm text-white/60">Tap the + on any podcast to follow it. New episodes from shows you follow show up here.</p><button type="button" onClick={onExplore} className="mt-2 min-h-11 rounded-full px-5 font-semibold bg-white text-[#111013]">Find shows</button></Centered>;
  if (error) return <Centered><p className="text-lg font-semibold">Couldn't load podcasts</p><p className="max-w-xs text-sm text-white/60">{error}</p>{retryBtn}</Centered>;
  return <Centered><Loader2 className="animate-spin" size={36} style={{ color: ACCENT }} /><p className="text-sm font-bold text-white/70">Tuning in to real podcasts…</p></Centered>;
}
const Centered = ({ children }: { children: ReactNode }) => <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">{children}</div>;

// ===========================================================================
// One card in the feed. A column: cover, then notes (which shrink first), then the details,
// so nothing can overlap however short the screen is.
// ===========================================================================
type CardProps = {
  /** The avatar: tapping it opens the show (or, for an Open Mic episode, its creator's profile). */
  onProfile: () => void;
  i: number; item: Item; active: boolean; playing: boolean; time: number; dur: number; counts?: Counts; commentsOn: boolean; following: boolean; saved: boolean; notes: boolean; full: boolean; unlocked: boolean;
  ad: PlayAd | null; onSkipAd: () => void; onNotAd: () => void; onTapStart: () => void; onRead: () => void;
  adMarks: PlayAd[]; marking: boolean; onMark: () => void;
  /** Podscroll's Apple Podcasts-style card: edge-to-edge art, speed and sleep in the controls row. */
  apple: boolean; speed: number; onSpeed: () => void; sleepOn: boolean; onSleep: () => void;
  /** What the scrubber can show about a moment: chapter names and the transcript lines loaded so far. */
  chapters: Chapter[]; lines: TxSegment[];
  onToggle: () => void; onSeek: (t: number) => void; onBack: () => void; onFwd: () => void; onLike: () => void; onDoubleLike: () => void; onSave: () => void; onShare: () => void; onFollow: () => void; onComments: () => void; onShow: () => void; onNext: () => void;
};
/** The cover's motion while playing: a slow pan and zoom across the art, a gentle breath, a light
 *  sweep now and then, and a glow that swells. All still for reduced motion and when paused. */
const COVER_MOTION = `@keyframes esDrift{0%{transform:scale(1.06) translate(0,0)}33%{transform:scale(1.2) translate(-4%,-3%)}66%{transform:scale(1.14) translate(3.5%,-1.5%)}100%{transform:scale(1.22) translate(-1.5%,3.5%)}}
@keyframes esBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.025)}}
@keyframes esSheen{0%,72%{transform:translateX(-130%) skewX(-18deg);opacity:0}78%{opacity:1}92%,100%{transform:translateX(230%) skewX(-18deg);opacity:0}}
@keyframes esGlow{0%,100%{opacity:.5;transform:scale(.94)}50%{opacity:.85;transform:scale(1.08)}}
@keyframes esSpin{to{transform:rotate(360deg) scale(1.4)}}
@media (prefers-reduced-motion:reduce){.es-m{animation:none!important}}`;
/** Podscroll's cover fades out at the bottom; where it doesn't reach the screen's edges (tablets,
 *  computers) it fades at the sides too, so it always melts into the art-colored backdrop. */
const APPLE_ART = `.ps-art{-webkit-mask-image:linear-gradient(180deg,#000 66%,transparent);mask-image:linear-gradient(180deg,#000 66%,transparent)}
@media (min-aspect-ratio:5/8){.ps-art{-webkit-mask-image:linear-gradient(180deg,#000 66%,transparent),linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent);mask-image:linear-gradient(180deg,#000 66%,transparent),linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent);-webkit-mask-composite:source-in;mask-composite:intersect}}`;
/** The cover: almost the whole width, plain, lit by its own colors, alive while it plays. */
function Cover({ art, alt, eager, playing, children }: { art: string; alt: string; eager: boolean; playing: boolean; children?: ReactNode }) {
  const big = hiRes(art, 1200);
  const run = (a: string) => (playing ? a : "none");
  return <div className="relative aspect-square w-[min(calc(100vw-1.5rem),60svh,680px)] max-w-full">
    <style>{COVER_MOTION}</style>
    <img src={big} alt="" aria-hidden referrerPolicy="no-referrer" className="es-m pointer-events-none absolute inset-[4%] h-[92%] w-[92%] rounded-[28px] object-cover blur-[60px]" style={{ animation: run("esGlow 7s ease-in-out infinite"), opacity: playing ? undefined : 0.3, transition: "opacity 1s" }} />
    <div className="es-m relative h-full w-full" style={{ animation: run("esBreathe 6s ease-in-out infinite") }}>
      <div className={`relative h-full w-full overflow-hidden rounded-[22px] shadow-[0_40px_80px_-30px_rgba(0,0,0,.95)] transition-transform duration-700 ease-out ${playing ? "scale-100" : "scale-[.92]"}`}>
        <img src={big} onError={artFallback(art)} alt={alt} referrerPolicy="no-referrer" loading={eager ? "eager" : "lazy"} decoding="async" className="es-m h-full w-full bg-white/5 object-cover" style={{ animation: run("esDrift 36s ease-in-out infinite alternate"), transform: playing ? undefined : "scale(1.06)", transition: "transform 1.4s ease-out" }} />
        <span aria-hidden className="es-m pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" style={{ animation: run("esSheen 9s ease-in-out infinite"), opacity: 0 }} />
      </div>
    </div>
    {children}
  </div>;
}
/** On a For You card: this episode comes from Open Mic (made by someone on Pod+). */
const MicTag = ({ newVoice }: { newVoice: boolean }) => <p className="mb-1.5 flex items-center gap-1.5">
  <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-[#111013]" style={{ background: "#ff8a3d" }}><Mic size={11} strokeWidth={2.5} />Open Mic</span>
  {newVoice && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider">New voice</span>}
</p>;
function Card(p: CardProps) {
  const { item, counts: c } = p; const ep = item.ep; const art = ep?.art || item.show.art;
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [scrubbing, setScrubbing] = useState(false);
  const lastTap = useRef(0); const tapT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTap = (e: ReactMouseEvent<HTMLButtonElement>) => {
    p.onTapStart();
    const now = Date.now(); const r = e.currentTarget.getBoundingClientRect();
    if (now - lastTap.current < 300) {
      if (tapT.current) clearTimeout(tapT.current); lastTap.current = 0;
      const id = now; setHearts((h) => [...h, { id, x: e.clientX - r.left, y: e.clientY - r.top }]); setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 800);
      p.onDoubleLike(); return;
    }
    lastTap.current = now; tapT.current = setTimeout(p.onToggle, 260);
  };
  const pct = p.dur ? Math.min(100, (p.time / p.dur) * 100) : 0;
  const overArt = <>
    {!p.playing && ep && (p.unlocked && p.active
      ? null
      : <span className="absolute bottom-[18%] left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-black/50 px-4 py-2 text-sm font-medium backdrop-blur-md"><Play size={14} fill="currentColor" />Tap to listen</span>)}
    {item.state === "loading" && <span className="absolute inset-0 grid place-items-center bg-black/30"><Loader2 className="animate-spin" /></span>}
    {item.state === "none" && <span className="pointer-events-auto absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-2xl bg-black/80 p-3 text-center text-sm">No playable episodes right now.<button type="button" onClick={p.onNext} className="mt-2 block w-full rounded-full bg-white/15 py-1.5 font-bold">Next podcast</button></span>}
  </>;
  const rail = (tight: boolean) => <>
    <Avatar item={item} following={p.following} onProfile={p.onProfile} onFollow={p.onFollow} className={tight ? "mb-2.5" : "mb-1.5"} />
    <Act label="Like" n={c?.likes} on={!!c?.liked} onClick={p.onLike} disabled={!ep}><Heart size={26} strokeWidth={1.5} className={c?.liked ? "fill-rose-500 text-rose-500" : ""} /></Act>
    {p.commentsOn && <Act label="Comments" n={c?.comments} onClick={p.onComments} disabled={!ep}><MessageCircle size={25} strokeWidth={1.5} /></Act>}
    <Act label="Episodes" onClick={p.onShow}><ListVideo size={25} strokeWidth={1.5} /></Act>
    <Act label={p.saved ? "Saved" : "Save"} on={p.saved} onClick={p.onSave} disabled={!ep}><Bookmark size={25} strokeWidth={1.5} className={p.saved ? "fill-current" : ""} /></Act>
    <Act label="Share" n={c?.shares} onClick={p.onShare} disabled={!ep}><Share2 size={24} strokeWidth={1.5} /></Act>
  </>;

  if (p.apple) {
    const when = ep?.date && Number.isFinite(Date.parse(ep.date)) ? new Date(ep.date).toLocaleDateString(undefined, { month: "short", day: "numeric", ...(new Date(ep.date).getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) }) : "";
    const meta = [when, ep ? durationWords(ep.secs) : ""].filter(Boolean).join(" · ");
    return <article data-i={p.i} className="relative h-full snap-start overflow-hidden [scroll-snap-stop:always]" aria-label={ep ? `${ep.title}, ${item.show.name}` : item.show.name}>
      <style>{APPLE_ART}</style>
      <style>{COVER_MOTION}</style>
      {/* Behind everything, the art blurred and darkened, so the whole page takes on its colors. It
          turns slowly while playing. */}
      <div aria-hidden className="absolute inset-0 overflow-hidden bg-[#0e0d10]">
        <div className="es-m absolute -inset-[35%] bg-cover bg-center opacity-90 blur-3xl" style={{ backgroundImage: `url("${hiRes(art, 300)}")`, animation: p.playing ? "esSpin 80s linear infinite" : "none" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/55" />
      </div>
      {/* The art itself, edge to edge at the top, fading into that backdrop. While it plays it drifts
          (a slow pan and zoom) with a light sweep now and then; paused, it settles. */}
      <div className="ps-art absolute inset-x-0 top-0 mx-auto aspect-square w-full max-w-[62svh] overflow-hidden">
        <img src={hiRes(art, 1200)} onError={artFallback(art)} alt={`${item.show.name} cover art`} referrerPolicy="no-referrer" loading={p.i < 3 ? "eager" : "lazy"} decoding="async" className="es-m h-full w-full bg-white/5 object-cover" style={{ animation: p.playing ? "esDrift 40s ease-in-out infinite alternate" : "none", transform: p.playing ? undefined : "scale(1.06)", transition: "transform 1.4s ease-out" }} />
        <span aria-hidden className="es-m pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" style={{ animation: p.playing ? "esSheen 11s ease-in-out infinite" : "none", opacity: 0 }} />
        <div className="absolute inset-x-0 top-0 h-[calc(7rem+env(safe-area-inset-top,0px))] bg-gradient-to-b from-black/45 to-transparent" />
      </div>
      <button type="button" onClick={onTap} aria-label={p.playing ? "Pause. Double tap to like." : "Play. Double tap to like."} className="absolute inset-0 z-[1] cursor-pointer" />
      {hearts.map((h) => <Heart key={h.id} className="pointer-events-none absolute z-[5] -ml-12 -mt-12 h-24 w-24 animate-ping fill-rose-500 text-rose-500" style={{ left: h.x, top: h.y, animationIterationCount: 1 }} />)}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[2] mx-auto aspect-square w-full max-w-[62svh]">{overArt}</div>

      <div className="pointer-events-none relative z-[2] mx-auto flex h-full w-full max-w-[560px] flex-col justify-end px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {/* Title on the left, the side buttons on the right, both just above the scrubber. */}
        <div className="flex items-end gap-2">
          <div className={`min-w-0 flex-1 pb-1 transition-opacity duration-200 ${scrubbing ? "opacity-30" : ""}`}>
            {item.mic && <MicTag newVoice={item.mic.newVoice} />}
            {meta && <p className="truncate text-[13px] text-white/55">{meta}</p>}
            <h2 className="mt-0.5 line-clamp-2 text-[21px] font-bold leading-tight tracking-tight">{ep?.title ?? "Loading the newest episode…"}</h2>
            <button type="button" onClick={p.onShow} className="pointer-events-auto mt-0.5 block max-w-full truncate text-left text-[17px] text-white/60 hover:text-white/85">{item.show.name}</button>
            {ep && p.active && p.ad && <div className="pointer-events-auto mt-2.5 flex">
              <span className="flex items-center overflow-hidden rounded-full bg-white text-xs font-semibold text-[#0e0d10]">
                <button type="button" onClick={p.onSkipAd} className="flex items-center gap-1.5 py-1.5 pl-3 pr-2"><SkipForward size={13} />{p.ad.kind === "intro" ? "Skip intro" : p.ad.kind === "crowd" ? "Listeners skip this · Skip" : p.ad.sure ? `Skip ad${p.ad.label && !/^(ad break|pre-roll)$/i.test(p.ad.label) ? ` · ${p.ad.label}` : ""}` : "Possible ad · Skip"}</button>
                <button type="button" onClick={p.onNotAd} aria-label="Not an ad" title="Not an ad" className="border-l border-black/10 px-2 py-1.5"><ThumbsDown size={12} /></button>
              </span>
            </div>}
          </div>
          <div className={`pointer-events-auto -mr-4 flex w-14 flex-none flex-col items-center transition-opacity duration-200 ${scrubbing ? "opacity-20" : ""}`}>{rail(true)}</div>
        </div>

        {ep && <div className="pointer-events-auto mt-4 flex flex-col">
          <Scrubber time={p.time} dur={p.dur} active={p.active} ads={p.adMarks} chapters={p.chapters} lines={p.lines} onSeek={p.onSeek} onScrubbing={setScrubbing}
            middle={p.unlocked && p.active && !p.marking ? <button type="button" onClick={p.onMark} aria-label="Mark an ad" title="Mark an ad" className="grid h-8 w-8 place-items-center rounded-full text-white/40 hover:text-white/80"><Megaphone size={15} strokeWidth={1.7} /></button> : null} />
          <div className="mt-3 flex items-center justify-between">
            <button type="button" onClick={p.onSpeed} aria-label={`Playback speed ${p.speed}×. Tap to change.`} className="grid h-12 w-12 place-items-center rounded-full text-[17px] font-semibold text-white/80">{p.speed}×</button>
            <button type="button" onClick={p.onBack} aria-label="Back 15 seconds" className="relative grid h-14 w-14 place-items-center rounded-full text-white"><RotateCcw size={36} strokeWidth={1.7} /><span className="absolute pt-0.5 text-[11px] font-bold">15</span></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); p.onTapStart(); p.onToggle(); }} aria-label={p.playing ? "Pause" : "Play"} className="grid h-20 w-20 place-items-center rounded-full text-white transition active:scale-90">{p.playing ? <Pause size={50} fill="currentColor" strokeWidth={0} /> : <Play size={50} fill="currentColor" strokeWidth={0} className="ml-1.5" />}</button>
            <button type="button" onClick={p.onFwd} aria-label="Forward 30 seconds" className="relative grid h-14 w-14 place-items-center rounded-full text-white"><RotateCw size={36} strokeWidth={1.7} /><span className="absolute pt-0.5 text-[11px] font-bold">30</span></button>
            <button type="button" onClick={p.onSleep} aria-label={p.sleepOn ? "Sleep timer on. Change it." : "Sleep timer"} aria-pressed={p.sleepOn} className={`grid h-12 w-12 place-items-center rounded-full ${p.sleepOn ? "text-white" : "text-white/80"}`}><Moon size={24} strokeWidth={1.7} className={p.sleepOn ? "fill-current" : ""} /></button>
          </div>
          <div className="mt-1 flex justify-center">
            <button type="button" onClick={p.onRead} disabled={!p.active} aria-label="Read along" className="flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-white/75 transition hover:bg-white/10 hover:text-white disabled:opacity-30"><ReadIcon size={17} />Read along</button>
          </div>
        </div>}
      </div>
    </article>;
  }

  return <article data-i={p.i} className="relative h-full snap-start overflow-hidden [scroll-snap-stop:always]" aria-label={ep ? `${ep.title}, ${item.show.name}` : item.show.name}>
    {p.full ? <>
      {/* Full screen: the art itself fills the page, drifting while it plays. */}
      <div className="absolute inset-0 overflow-hidden">
        <img src={hiRes(art, 1200)} onError={artFallback(art)} alt="" aria-hidden referrerPolicy="no-referrer" loading={p.i < 3 ? "eager" : "lazy"} className="es-m h-full w-full object-cover" style={{ animation: p.playing ? "esDrift 40s ease-in-out infinite alternate" : "none", transform: p.playing ? undefined : "scale(1.06)", transition: "transform 1.4s ease-out" }} />
        <span aria-hidden className="es-m pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" style={{ animation: p.playing ? "esSheen 11s ease-in-out infinite" : "none", opacity: 0 }} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent via-40% to-[#0e0d10]" />
      <style>{COVER_MOTION}</style>
    </> : <>
      <div className="es-m absolute -inset-[35%] bg-cover bg-center opacity-50 blur-3xl" style={{ backgroundImage: `url("${hiRes(art, 300)}")`, animation: p.playing ? "esSpin 80s linear infinite" : "none" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-[#0e0d10]/70 to-[#0e0d10]" />
    </>}
    <button type="button" onClick={onTap} aria-label={p.playing ? "Pause. Double tap to like." : "Play. Double tap to like."} className="absolute inset-0 z-[1] cursor-pointer" />
    {hearts.map((h) => <Heart key={h.id} className="pointer-events-none absolute z-[5] -ml-12 -mt-12 h-24 w-24 animate-ping fill-rose-500 text-rose-500" style={{ left: h.x, top: h.y, animationIterationCount: 1 }} />)}

    <div className="pointer-events-none relative z-[2] flex h-full flex-col pt-16">
      <div className="flex flex-none justify-center px-3">
        {p.full ? <div className="relative aspect-square w-[min(calc(100vw-1.5rem),60svh,680px)]">
          {!p.playing && ep && (p.unlocked && p.active
            ? null
            : <span className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-black/50 px-4 py-2 text-sm font-medium backdrop-blur-md"><Play size={14} fill="currentColor" />Tap to listen</span>)}
          {item.state === "loading" && <span className="absolute inset-0 grid place-items-center rounded-[26px] bg-black/40"><Loader2 className="animate-spin" /></span>}
          {item.state === "none" && <span className="pointer-events-auto absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-2xl bg-black/80 p-3 text-center text-sm">No playable episodes right now.<button type="button" onClick={p.onNext} className="mt-2 block w-full rounded-full bg-white/15 py-1.5 font-bold">Next podcast</button></span>}
        </div> : <Cover art={art} alt={`${item.show.name} cover art`} eager={p.i < 3} playing={p.playing}>
          {!p.playing && ep && (p.unlocked && p.active
            ? null
            : <span className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-black/50 px-4 py-2 text-sm font-medium backdrop-blur-md"><Play size={14} fill="currentColor" />Tap to listen</span>)}
          {item.state === "loading" && <span className="absolute inset-0 grid place-items-center rounded-[26px] bg-black/40"><Loader2 className="animate-spin" /></span>}
          {item.state === "none" && <span className="pointer-events-auto absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-2xl bg-black/80 p-3 text-center text-sm">No playable episodes right now.<button type="button" onClick={p.onNext} className="mt-2 block w-full rounded-full bg-white/15 py-1.5 font-bold">Next podcast</button></span>}
        </Cover>}
      </div>

      <div className="min-h-0 w-full flex-1 overflow-hidden pl-6 pr-[4.75rem] pt-4 [mask-image:linear-gradient(180deg,#000_60%,transparent)]">
        {p.notes && ep?.about && <p className="line-clamp-3 text-[13px] leading-relaxed text-white/40">{ep.about}</p>}
      </div>

      <div className="flex w-full flex-none flex-col pb-6 pl-6 pr-[4.75rem]">
        {item.mic && <MicTag newVoice={item.mic.newVoice} />}
        <button type="button" onClick={p.onShow} className="pointer-events-auto w-fit max-w-full truncate text-left text-[13px] text-white/50 hover:text-white/80">{item.show.name}</button>
        <h2 className="mt-1 line-clamp-2 text-[19px] font-semibold leading-snug tracking-tight">{ep?.title ?? "Loading the newest episode…"}</h2>
        {ep && p.active && p.ad && <div className="pointer-events-auto mt-2.5 flex">
          <span className="flex items-center overflow-hidden rounded-full bg-white text-xs font-semibold text-[#0e0d10]">
            <button type="button" onClick={p.onSkipAd} className="flex items-center gap-1.5 py-1.5 pl-3 pr-2"><SkipForward size={13} />{p.ad.kind === "intro" ? "Skip intro" : p.ad.kind === "crowd" ? "Listeners skip this · Skip" : p.ad.sure ? `Skip ad${p.ad.label && !/^(ad break|pre-roll)$/i.test(p.ad.label) ? ` · ${p.ad.label}` : ""}` : "Possible ad · Skip"}</button>
            <button type="button" onClick={p.onNotAd} aria-label="Not an ad" title="Not an ad" className="border-l border-black/10 px-2 py-1.5"><ThumbsDown size={12} /></button>
          </span>
        </div>}
        {ep && <div className="pointer-events-auto mt-4 flex flex-col">
          <div className="relative h-5 w-full">
            <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/15" />
            {p.dur > 0 && p.adMarks.filter((a) => a.e - a.s < p.dur * 0.6).map((a) => <div key={a.key} title={a.label} className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full" style={{ left: `${Math.min(100, (a.s / p.dur) * 100)}%`, width: `${Math.max(0.6, ((a.e - a.s) / p.dur) * 100)}%`, background: a.kind === "intro" ? "rgba(255,255,255,.3)" : a.sure ? "rgba(255,214,102,.55)" : "rgba(255,214,102,.25)" }} />)}
            <div className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white" style={{ width: `${pct}%` }} />
            <input type="range" min={0} max={Math.max(1, Math.floor(p.dur))} value={Math.floor(p.time)} onChange={(e) => p.onSeek(Number(e.target.value))} aria-label="Seek" disabled={!p.active}
              className="absolute inset-0 h-5 w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white" />
          </div>
          <div className="flex items-center justify-between text-[11px] tabular-nums text-white/40"><span>{clock(p.time)}</span><span>-{clock(Math.max(0, p.dur - p.time))}</span></div>
          <div className="mt-2 flex items-center justify-between">
            {p.unlocked && p.active && !p.marking ? <button type="button" onClick={p.onMark} aria-label="Mark an ad" title="Mark an ad" className="grid h-10 w-10 place-items-center rounded-full text-white/40 hover:text-white/80"><Megaphone size={18} strokeWidth={1.7} /></button> : <span className="w-10" />}
            <div className="flex items-center gap-6">
              <button type="button" onClick={p.onBack} aria-label="Back 15 seconds" className="grid h-11 w-11 place-items-center rounded-full text-white/85"><RotateCcw size={24} strokeWidth={1.6} /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); p.onTapStart(); p.onToggle(); }} aria-label={p.playing ? "Pause" : "Play"} className="grid h-16 w-16 place-items-center rounded-full bg-white text-[#0e0d10] transition active:scale-95">{p.playing ? <Pause size={26} fill="currentColor" strokeWidth={0} /> : <Play size={26} fill="currentColor" strokeWidth={0} className="ml-1" />}</button>
              <button type="button" onClick={p.onFwd} aria-label="Forward 30 seconds" className="grid h-11 w-11 place-items-center rounded-full text-white/85"><RotateCw size={24} strokeWidth={1.6} /></button>
            </div>
            <button type="button" onClick={p.onRead} disabled={!p.active} aria-label="Read along" title="Read along" className="grid h-10 w-10 place-items-center rounded-full text-white/70 hover:text-white disabled:opacity-30"><ReadIcon size={20} /></button>
          </div>
        </div>}
      </div>
    </div>

    <div className="absolute bottom-6 right-1.5 z-[3] flex w-16 flex-col items-center gap-3.5">
      <Avatar item={item} following={p.following} onProfile={p.onProfile} onFollow={p.onFollow} className="mb-1.5" />
      <Act label="Like" n={c?.likes} on={!!c?.liked} onClick={p.onLike} disabled={!ep}><Heart size={26} strokeWidth={1.5} className={c?.liked ? "fill-rose-500 text-rose-500" : ""} /></Act>
      {p.commentsOn && <Act label="Comments" n={c?.comments} onClick={p.onComments} disabled={!ep}><MessageCircle size={25} strokeWidth={1.5} /></Act>}
      <Act label="Episodes" onClick={p.onShow}><ListVideo size={25} strokeWidth={1.5} /></Act>
      <Act label={p.saved ? "Saved" : "Save"} on={p.saved} onClick={p.onSave} disabled={!ep}><Bookmark size={25} strokeWidth={1.5} className={p.saved ? "fill-current" : ""} /></Act>
      <Act label="Share" n={c?.shares} onClick={p.onShare} disabled={!ep}><Share2 size={24} strokeWidth={1.5} /></Act>
    </div>
  </article>;
}
/** A cover's average color, darkened to match the bottom of the card (see the theme color above). */
const tones = new Map<string, Promise<string | null>>();
function artTone(src: string): Promise<string | null> {
  let p = tones.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas"); c.width = c.height = 16;
          const g = c.getContext("2d", { willReadFrequently: true })!; g.drawImage(img, 0, 0, 16, 16);
          const d = g.getImageData(0, 0, 16, 16).data; let r = 0, gr = 0, b = 0;
          for (let k = 0; k < d.length; k += 4) { r += d[k]; gr += d[k + 1]; b += d[k + 2]; }
          const n = d.length / 4, f = (v: number) => Math.round((v / n) * 0.42 + 5);
          resolve(`rgb(${f(r)}, ${f(gr)}, ${f(b)})`);
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
    tones.set(src, p);
  }
  return p;
}
/** When the big copy of a cover won't load (some shows' art is smaller than asked for), use the art as given. */
const artFallback = (art: string) => (e: { currentTarget: HTMLImageElement }) => { if (art && e.currentTarget.src !== art) e.currentTarget.src = art; };

const NONE_CHAPTERS: Chapter[] = [];
const NONE_LINES: TxSegment[] = [];
/** How much slower the scrub goes as the finger slides up away from the bar, and what it's called. */
const SCRUB_RATES: [number, number, string][] = [[140, 0.1, "Fine scrubbing"], [90, 0.25, "Quarter-speed scrubbing"], [40, 0.5, "Half-speed scrubbing"], [0, 1, ""]];
const rateAt = (lift: number) => SCRUB_RATES.find(([d]) => lift >= d)!;
const signedClock = (secs: number) => `${secs < 0 ? "−" : "+"}${clock(Math.abs(secs))}`;

/**
 * Podscroll's scrubber. Like Apple Podcasts: grab anywhere on the bar, it swells under the finger,
 * the times follow along, and the audio only jumps when the finger lifts. Sliding the finger up off
 * the bar scrubs slower (half, quarter, then fine). Podscroll's own part is the card that rides above
 * the finger: where you'll land, how far that is from where you were, and what's happening there:
 * the words being said (from the transcript), the chapter, or an ad. A tick stays on the bar where
 * you started, and the phone gives a small tap as the finger crosses into an ad or a new chapter.
 */
function Scrubber({ time, dur, active, ads, chapters, lines, onSeek, onScrubbing, middle }: {
  time: number; dur: number; active: boolean; ads: PlayAd[]; chapters: Chapter[]; lines: TxSegment[];
  onSeek: (t: number) => void; onScrubbing: (on: boolean) => void; middle: ReactNode;
}) {
  const track = useRef<HTMLDivElement | null>(null);
  // The drag: where it began, the point the current speed is measured from, and the landing spot.
  const drag = useRef<{ id: number; from: number; y0: number; x0: number; base: number; rate: number; zone: string } | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const [rate, setRate] = useState(1);
  const live = at !== null;
  const shown = live ? at : time;
  const pct = (t: number) => (dur ? Math.min(100, Math.max(0, (t / dur) * 100)) : 0);
  const clamp = (t: number) => Math.min(Math.max(0, dur - 1), Math.max(0, t));
  const timeAtX = (x: number) => { const r = track.current!.getBoundingClientRect(); return clamp(((x - r.left) / r.width) * dur); };
  const adAt = (t: number) => ads.find((a) => t >= a.s && t < a.e && a.e - a.s < dur * 0.6);
  const chapterAt = (t: number) => { let c: Chapter | undefined; for (const ch of chapters) { if (ch.s <= t) c = ch; else break; } return c; };
  const lineAt = (t: number) => lines.find((l) => t >= l.s && t < l.e) ?? lines.find((l) => Math.abs(l.s - t) < 8);
  const zoneOf = (t: number) => { const a = adAt(t); return a ? `ad:${a.key}` : `ch:${chapterAt(t)?.s ?? -1}`; };

  const end = (seek: boolean) => {
    const d = drag.current; drag.current = null;
    if (d && seek && at !== null) onSeek(at);
    setAt(null); setRate(1); onScrubbing(false);
  };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!active || !dur || drag.current) return;
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const t = timeAtX(e.clientX);
    drag.current = { id: e.pointerId, from: time, y0: e.clientY, x0: e.clientX, base: t, rate: 1, zone: zoneOf(t) };
    setAt(t); onScrubbing(true);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d || e.pointerId !== d.id) return;
    const r = track.current!.getBoundingClientRect();
    const [, nextRate] = rateAt(d.y0 - e.clientY);
    // Changing speed starts measuring again from here, so the landing spot never jumps.
    if (nextRate !== d.rate) { d.base = clamp(d.base + ((e.clientX - d.x0) / r.width) * dur * d.rate); d.x0 = e.clientX; d.rate = nextRate; setRate(nextRate); }
    const t = clamp(d.base + ((e.clientX - d.x0) / r.width) * dur * d.rate);
    const zone = zoneOf(t);
    if (zone !== d.zone) { d.zone = zone; try { navigator.vibrate?.(8); } catch { /* no haptics here */ } }
    setAt(t);
  };
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 10 : e.key === "ArrowLeft" ? -10 : e.key === "Home" ? -time : e.key === "End" ? dur - time - 1 : 0;
    if (!step || !active || !dur) return;
    e.preventDefault(); onSeek(clamp(time + step));
  };

  const ad = live ? adAt(at) : undefined;
  const chapter = live ? chapterAt(at) : undefined;
  const line = live ? lineAt(at) : undefined;
  const label = rate < 1 ? SCRUB_RATES.find(([, r]) => r === rate)?.[2] ?? "" : "";
  const delta = live ? at - (drag.current?.from ?? time) : 0;
  const from = drag.current?.from ?? time;

  return <div className="flex flex-col">
    <div ref={track} role="slider" tabIndex={active ? 0 : -1} aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.floor(dur)} aria-valuenow={Math.floor(shown)} aria-valuetext={`${clock(shown)} of ${clock(dur)}`} aria-disabled={!active}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => end(true)} onPointerCancel={() => end(false)} onLostPointerCapture={() => drag.current && end(true)} onKeyDown={onKey}
      className="relative h-9 w-full cursor-pointer touch-none select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded-full">
      {/* The bar: thin at rest, swelling while you scrub. */}
      <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-white/20 transition-[height,background-color] duration-200 ease-out ${live ? "h-[14px] bg-white/25" : "h-[5px]"}`}>
        <div className={`absolute inset-y-0 left-0 ${live ? "bg-white" : "bg-white/75"}`} style={{ width: `${pct(shown)}%` }} />
        {dur > 0 && ads.filter((a) => a.e - a.s < dur * 0.6).map((a) => <div key={a.key} title={a.label} className="absolute inset-y-0" style={{ left: `${pct(a.s)}%`, width: `${Math.max(0.6, pct(a.e) - pct(a.s))}%`, background: a.kind === "intro" ? "rgba(255,255,255,.3)" : a.sure ? "rgba(255,200,60,.9)" : "rgba(255,200,60,.45)" }} />)}
        {dur > 0 && chapters.length > 1 && chapters.slice(1).map((c) => <div key={c.s} className="absolute inset-y-0 w-[2px] bg-black/50" style={{ left: `${pct(c.s)}%` }} />)}
      </div>
      {/* Where you were when you grabbed it. */}
      {live && <div aria-hidden className="pointer-events-none absolute top-1/2 h-[22px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60 shadow-[0_0_0_2px_rgba(0,0,0,.35)]" style={{ left: `${pct(from)}%` }} />}

      {/* The card above the finger. */}
      {live && <div aria-hidden className="pointer-events-none absolute bottom-[calc(100%+14px)] z-10 w-[min(17rem,calc(100vw-3rem))] -translate-x-1/2 animate-[psRise_.18s_ease-out] rounded-2xl bg-black/80 p-3 shadow-[0_12px_40px_-12px_rgba(0,0,0,.9)] ring-1 ring-white/10 backdrop-blur-xl"
        style={{ left: `clamp(8.5rem, ${pct(at)}%, calc(100% - 8.5rem))` }}>
        <style>{"@keyframes psRise{from{opacity:0;transform:translate(-50%,6px) scale(.96)}to{opacity:1;transform:translate(-50%,0) scale(1)}}"}</style>
        <div className="flex items-baseline justify-between gap-3">
          <b className="text-[26px] font-bold leading-none tabular-nums tracking-tight">{clock(at)}</b>
          {Math.abs(delta) >= 1 && <span className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${delta < 0 ? "bg-white/15 text-white/85" : "bg-white text-[#0e0d10]"}`}>{signedClock(delta)}</span>}
        </div>
        {ad ? <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#ffd666]"><Megaphone size={12} />{ad.kind === "intro" ? "Intro" : ad.label && !/^(ad break|pre-roll)$/i.test(ad.label) ? `Ad · ${ad.label}` : "Ad"}</p>
          : chapter ? <p className="mt-2 truncate text-xs font-semibold text-white/70">{chapter.title}</p> : null}
        {line && !ad && <p className="mt-1.5 line-clamp-2 text-[13px] italic leading-snug text-white/80">“{line.t.trim()}”</p>}
        <p className="mt-2 text-[10px] font-medium uppercase tracking-[.12em] text-white/40">{label || "Slide up to scrub slower"}</p>
      </div>}
    </div>
    <div className="mt-0.5 grid grid-cols-[1fr_auto_1fr] items-center text-[12px] tabular-nums text-white/45">
      <span className={live ? "text-white" : ""}>{clock(shown)}</span>
      {middle ?? <span className="h-8" />}
      <span className={`text-right ${live ? "text-white" : ""}`}>-{clock(Math.max(0, dur - shown))}</span>
    </div>
  </div>;
}

/** One side action: a thin icon over a small quiet label (or its count). */
/** What's playing, along the bottom of Explore, Library, Social and Open Mic. Tap it to go back to the player. */
function MiniPlayer({ ep, art, playing, pct, light, standalone, onOpen, onToggle }: { ep: PodEpisode; art: string; playing: boolean; pct: number; light: boolean; standalone: boolean; onOpen: () => void; onToggle: () => void }) {
  return <div className={`absolute inset-x-0 bottom-0 z-[24] px-2 ${standalone ? "pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]" : "pb-2"}`}>
    <div className={`relative mx-auto flex max-w-xl items-center gap-3 overflow-hidden rounded-2xl p-2 pr-1.5 shadow-[0_10px_30px_rgba(0,0,0,.25)] ring-1 backdrop-blur-xl ${light ? "bg-white/90 text-[#0f1419] ring-black/[.06]" : "bg-[#241d29]/90 text-white ring-white/10"}`}>
      <button type="button" onClick={onOpen} aria-label={`Now playing: ${ep.title}. Open the player.`} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <img src={hiRes(art, 120)} alt="" referrerPolicy="no-referrer" className="h-11 w-11 flex-none rounded-lg object-cover" />
        <span className="min-w-0"><b className="block truncate text-[14px] font-semibold leading-tight">{ep.title}</b><span className={`block truncate text-[12px] ${light ? "text-[#536471]" : "text-white/60"}`}>{ep.show}</span></span>
      </button>
      <button type="button" onClick={onToggle} aria-label={playing ? "Pause" : "Play"} className="grid h-11 w-11 flex-none place-items-center rounded-full">{playing ? <Pause size={24} fill="currentColor" strokeWidth={0} /> : <Play size={24} fill="currentColor" strokeWidth={0} className="ml-0.5" />}</button>
      <span aria-hidden className={`absolute inset-x-3 bottom-0 h-[2px] rounded-full ${light ? "bg-black/[.06]" : "bg-white/10"}`}><span className="block h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: ACCENT }} /></span>
    </div>
  </div>;
}

/** The show's (or creator's) avatar on a card. The picture opens the show's page, or for an Open Mic
 *  episode the creator's profile; the + under it follows (it disappears once you follow). */
function Avatar({ item, following, onProfile, onFollow, className = "" }: { item: Item; following: boolean; onProfile: () => void; onFollow: () => void; className?: string }) {
  const who = item.mic ? `@${item.mic.handle}` : item.show.name;
  return <div className={`relative ${className}`}>
    <button type="button" onClick={onProfile} aria-label={item.mic ? `Open ${who}'s profile` : `Open ${who}`} className="block rounded-full transition active:scale-95">
      <img src={item.show.art} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-full object-cover ring-1 ring-white/30" />
    </button>
    {!following && <button type="button" onClick={onFollow} aria-label={`Follow ${who}`} className="absolute -bottom-2.5 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full">
      <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-white text-[#0e0d10] shadow"><Plus size={12} strokeWidth={2.5} /></span>
    </button>}
  </div>;
}
/** Read along's button: a speech bubble with lines, like a lyrics button. */
const ReadIcon = ({ size = 18 }: { size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 12z" /><path d="M8.5 10h7M8.5 13.5h4.5" /></svg>;

function Act({ children, label, n, on, onClick, disabled }: { children: ReactNode; label: string; n?: number; on?: boolean; onClick: () => void; disabled?: boolean }) {
  const shown = typeof n === "number" && n > 0 ? compact(n) : ["Like", "Comments", "Share"].includes(label) ? "" : label;
  return <button type="button" onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={on} className="flex min-h-11 w-14 flex-col items-center justify-center gap-1 text-white/85 transition hover:text-white active:scale-95 disabled:opacity-30">
    <span className="drop-shadow-[0_1px_6px_rgba(0,0,0,.45)]">{children}</span>
    {shown && <span className="text-[10px] font-medium tabular-nums text-white/55">{shown}</span>}
  </button>;
}

// ===========================================================================
// Read along: the words fill the screen like song lyrics. The line being said is bright and fills in
// word by word as it's spoken; lines already said fade back, lines to come wait dimmer. It follows
// along by itself until you scroll; tap any line to jump there. Search, chapters and marking an ad
// by its lines are a tap away at the top.
// ===========================================================================
function ReadAlong({ ep, art, tx, time, dur, playing, onSeek, onToggle, onBack, onFwd, onClose, onMore, onMarkRange }: {
  ep: PodEpisode; art: string; tx?: Tx; time: number; dur: number; playing: boolean;
  onSeek: (t: number) => void; onToggle: () => void; onBack: () => void; onFwd: () => void; onClose: () => void; onMore: () => void; onMarkRange: (s: number, e: number) => void;
}) {
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [marking, setMarking] = useState(false);
  const [first, setFirst] = useState<number | null>(null);
  const [following, setFollowing] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);
  const programmatic = useRef(0);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const segs = tx?.segments ?? [];
  const ads = tx?.ads ?? [];
  const nowIdx = segs.findIndex((s, i) => time >= s.s && (i === segs.length - 1 || time < segs[i + 1].s));
  const term = q.trim().toLowerCase();
  const shown = term ? segs.map((s, i) => ({ s, i })).filter((x) => x.s.t.toLowerCase().includes(term)) : segs.map((s, i) => ({ s, i }));
  // Keep the line being said about a third of the way down, until the listener scrolls themselves.
  useEffect(() => {
    if (term || !following || nowIdx < 0) return;
    const box = listRef.current, el = box?.querySelector(`[data-seg="${nowIdx}"]`) as HTMLElement | null;
    if (!box || !el) return;
    programmatic.current = Date.now();
    box.scrollTo({ top: Math.max(0, el.offsetTop - box.clientHeight * 0.32), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [nowIdx, term, following]);
  const loading = !!tx && tx.loading.size > 0;
  const lastEnd = segs.length ? segs[segs.length - 1].e : 0;
  const hl = (t: string) => {
    if (!term) return t;
    const parts = t.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
    return parts.map((x, k) => (x.toLowerCase() === term ? <mark key={k} className="rounded bg-[#ff8a3d] px-0.5 text-[#120e14]">{x}</mark> : x));
  };
  /** The line being said, its words lit as far as the voice has got (by their share of the line). */
  const liveWords = (s: TxSegment) => {
    const words = s.t.split(/(\s+)/);
    const total = s.t.length || 1, f = Math.max(0, Math.min(1, (time - s.s) / Math.max(0.5, s.e - s.s)));
    let at = 0;
    return words.map((w, k) => { at += w.length; return <span key={k} className="transition-colors duration-200" style={{ color: at / total <= f + 0.02 ? "#fff" : "rgba(255,255,255,.38)" }}>{w}</span>; });
  };
  const pct = dur ? Math.min(100, (time / dur) * 100) : 0;
  const pick = (i: number, s: TxSegment) => {
    if (!marking) { setFollowing(true); return onSeek(s.s); }
    if (first === null) return setFirst(i);
    const a = Math.min(first, i), b = Math.max(first, i);
    setMarking(false); setFirst(null);
    onMarkRange(segs[a].s, segs[b].e);
  };

  return <div role="dialog" aria-modal="true" aria-label={`Read along: ${ep.title}`} className="absolute inset-0 z-30 flex flex-col overflow-hidden bg-[#0e0d10] text-white">
    <div aria-hidden className="absolute -inset-[30%] bg-cover bg-center opacity-80 blur-3xl" style={{ backgroundImage: `url("${hiRes(art, 300)}")` }} />
    <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/70" />

    <header className="relative z-[1] flex items-center gap-3 px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
      <button type="button" onClick={onClose} aria-label="Close read along" className="grid h-10 w-10 flex-none place-items-center rounded-full bg-white/10 backdrop-blur"><ChevronDown size={22} /></button>
      <img src={hiRes(art, 120)} alt="" referrerPolicy="no-referrer" className="h-10 w-10 flex-none rounded-lg object-cover" />
      <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-semibold leading-tight">{ep.title}</p><p className="truncate text-[12px] text-white/60">{ep.show}</p></div>
      {!!segs.length && <button type="button" onClick={() => { setSearching((v) => !v); setQ(""); }} aria-label="Search this episode" aria-pressed={searching} className={`grid h-10 w-10 flex-none place-items-center rounded-full backdrop-blur ${searching ? "bg-white text-[#120e14]" : "bg-white/10"}`}><Search size={18} /></button>}
      {!!segs.length && <button type="button" onClick={() => { setMarking((m) => !m); setFirst(null); }} aria-label="Mark an ad by its lines" aria-pressed={marking} className={`grid h-10 w-10 flex-none place-items-center rounded-full backdrop-blur ${marking ? "bg-[#ffd23f] text-[#120e14]" : "bg-white/10"}`}><Megaphone size={17} /></button>}
    </header>
    {(searching || marking || !!tx?.chapters.length) && <div className="relative z-[1] px-4">
      {searching && <div className="relative mt-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/45" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this episode" aria-label="Search words in this episode" className="min-h-10 w-full rounded-xl border border-white/15 bg-black/30 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40" /></div>}
      {marking && <p className="mt-2 rounded-xl bg-[#ffd23f]/20 px-3 py-2 text-xs font-semibold text-[#ffd23f]">{first === null ? "Tap the first line of the ad." : "Now tap the last line of the ad."}</p>}
      {!!tx?.chapters.length && !searching && <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">{tx.chapters.map((c) => <button key={c.s} type="button" onClick={() => { setFollowing(true); onSeek(c.s); }} className="flex-none rounded-full bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur"><span className="tabular-nums text-white/55">{clock(c.s)}</span> {c.title}</button>)}</div>}
    </div>}

    <div ref={listRef} onScroll={() => { if (Date.now() - programmatic.current > 900) setFollowing(false); }}
      className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-6 [mask-image:linear-gradient(180deg,transparent,#000_8%,#000_86%,transparent)] [scrollbar-width:none]">
      {!tx || (loading && !segs.length) ? <div className="grid h-full place-items-center gap-2 text-center text-sm text-white/65"><span className="flex flex-col items-center gap-3"><Loader2 className="animate-spin" />Getting the words… this can take up to a minute the first time.</span></div>
        : !segs.length ? <div className="grid h-full place-items-center text-center text-[15px] text-white/70"><p className="max-w-xs">{tx.reason || "There's no transcript for this episode yet."}</p></div>
        : <>
          <div className="h-[22vh]" aria-hidden />
          {shown.length === 0 && <p className="py-8 text-center text-sm text-white/60">No lines mention “{q.trim()}” yet.</p>}
          <ol className="flex flex-col gap-1">{shown.map(({ s, i }) => {
            const inAd = ads.some((a) => s.s >= a.s - 0.5 && s.s < a.e);
            const now = i === nowIdx && !term, past = i < nowIdx;
            const picked = marking && first === i;
            return <li key={s.s} data-seg={i}>
              <button type="button" onClick={() => pick(i, s)} className={`w-full rounded-2xl px-2 py-2 text-left transition-all duration-500 ${picked ? "bg-[#ffd23f]/25 ring-1 ring-[#ffd23f]" : "hover:bg-white/[.06]"}`}>
                {inAd && <span className="mb-1 inline-block rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/75">Ad</span>}
                <span className={`block font-bold leading-[1.22] tracking-tight ${term ? "text-[19px] text-white/90" : inAd ? "text-[20px] italic text-white/30" : now ? "text-[27px]" : past ? "text-[24px] text-white/45" : "text-[24px] text-white/30"}`}
                  style={!term && !now ? { filter: Math.abs(i - nowIdx) > 2 ? "blur(.6px)" : undefined } : undefined}>
                  {term ? hl(s.t) : now && !inAd ? liveWords(s) : s.t}
                </span>
                {term && <span className="mt-0.5 block text-[11px] tabular-nums text-white/45">{clock(s.s)}</span>}
              </button>
            </li>;
          })}</ol>
          {tx.more && !term && <div className="py-6 text-center">{loading ? <span className="inline-flex items-center gap-2 text-xs text-white/60"><Loader2 size={14} className="animate-spin" />Writing the next part…</span> : <button type="button" onClick={onMore} className="rounded-full bg-white/15 px-4 py-2 text-xs font-bold backdrop-blur">Load more (from {clock(lastEnd)})</button>}</div>}
          <div className="h-[30vh]" aria-hidden />
        </>}
      {!following && !term && nowIdx >= 0 && <button type="button" onClick={() => setFollowing(true)} className="sticky bottom-3 mx-auto mb-3 flex w-fit items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#120e14] shadow-xl">Back to now</button>}
    </div>

    <footer className="relative z-[1] px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
      <button type="button" aria-label="Seek" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek(((e.clientX - r.left) / r.width) * dur); }} className="block h-4 w-full">
        <span className="relative block h-1 w-full overflow-hidden rounded-full bg-white/20"><span className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${pct}%` }} /></span>
      </button>
      <div className="flex justify-between text-[11px] tabular-nums text-white/55"><span>{clock(time)}</span><span>-{clock(Math.max(0, dur - time))}</span></div>
      <div className="mt-1 flex items-center justify-center gap-8">
        <button type="button" onClick={onBack} aria-label="Back 15 seconds" className="relative grid h-12 w-12 place-items-center"><RotateCcw size={28} strokeWidth={1.7} /><span className="absolute pt-0.5 text-[9px] font-bold">15</span></button>
        <button type="button" onClick={onToggle} aria-label={playing ? "Pause" : "Play"} className="grid h-16 w-16 place-items-center rounded-full bg-white text-[#0e0d10] transition active:scale-95">{playing ? <Pause size={28} fill="currentColor" strokeWidth={0} /> : <Play size={28} fill="currentColor" strokeWidth={0} className="ml-1" />}</button>
        <button type="button" onClick={onFwd} aria-label="Forward 30 seconds" className="relative grid h-12 w-12 place-items-center"><RotateCw size={28} strokeWidth={1.7} /><span className="absolute pt-0.5 text-[9px] font-bold">30</span></button>
      </div>
      {!!segs.length && <p className="mt-1 text-center text-[10.5px] text-white/45">{tx?.source === "publisher" ? "Transcript from the podcast's publisher." : "Written by AI, so it may have mistakes."}</p>}
    </footer>
  </div>;
}

// ===========================================================================
// Confirming a marked ad (fine-tune the edges, name the sponsor, share)
// ===========================================================================
type Draft = { ep: PodEpisode; showId: string; s: number; e: number; label: string };
function MarkSheet({ draft, shared, onChange, onPreview, onSave, onClose }: { draft: Draft; shared: boolean; onChange: (d: Draft) => void; onPreview: (t: number) => void; onSave: () => void; onClose: () => void }) {
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...patch });
  const len = draft.e - draft.s;
  const Nudge = ({ edge }: { edge: "s" | "e" }) => <div className="flex items-center gap-1">
    {[-5, -1, 1, 5].map((d) => <button key={d} type="button" onClick={() => { const v = Math.max(0, draft[edge] + d); if (edge === "s" ? v < draft.e - 3 : v > draft.s + 3) set({ [edge]: v } as Partial<Draft>); }} aria-label={`${edge === "s" ? "Start" : "End"} ${d > 0 ? "later" : "earlier"} by ${Math.abs(d)} seconds`} className="grid h-8 min-w-9 place-items-center rounded-full bg-white/10 px-2 text-xs font-semibold">{d > 0 ? <span className="flex items-center"><Plus size={11} />{d}s</span> : <span className="flex items-center"><Minus size={11} />{-d}s</span>}</button>)}
    <button type="button" onClick={() => onPreview(edge === "s" ? Math.max(0, draft.s - 3) : Math.max(0, draft.e - 2))} className="ml-1 grid h-8 place-items-center rounded-full bg-white/10 px-2.5 text-xs font-bold"><Play size={12} fill="currentColor" /></button>
  </div>;
  return <Sheet title="Mark this ad" onClose={onClose}>
    <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
      <p className="text-sm text-white/70">From <b className="tabular-nums text-white">{clock(draft.s)}</b> to <b className="tabular-nums text-white">{clock(draft.e)}</b> ({clock(len)}). Tap ▶ to hear an edge, and nudge it until it's right.</p>
      <div className="flex flex-col gap-2"><span className="text-xs font-semibold uppercase tracking-widest text-white/45">Ad starts</span><Nudge edge="s" /></div>
      <div className="flex flex-col gap-2"><span className="text-xs font-semibold uppercase tracking-widest text-white/45">Show comes back</span><Nudge edge="e" /></div>
      <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-widest text-white/45">Sponsor (optional)
        <input value={draft.label} onChange={(e) => set({ label: e.target.value.slice(0, 60) })} placeholder="e.g. Squarespace" className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium normal-case tracking-normal text-white outline-none placeholder:text-white/30 focus:border-[#ffd23f]" />
      </label>
      {len > 300 && <p className="text-xs text-[#ffd23f]">That's over 5 minutes. Make sure it's one ad break, not part of the show.</p>}
      <p className="text-xs text-white/45">{shared ? "It'll be skipped for everyone listening to this same version of the episode, and the show learns its sponsors and how its ads start." : "Sharing marks with everyone isn't switched on yet, so this is saved for you."}</p>
      <div className="flex gap-2"><button type="button" onClick={onClose} className="min-h-11 flex-1 rounded-full bg-white/10 font-bold">Cancel</button><button type="button" onClick={onSave} className="min-h-11 flex-[2] rounded-full bg-[#ffd23f] font-semibold text-[#120e14]">{shared ? "Save & share" : "Save"}</button></div>
    </div>
  </Sheet>;
}

// ===========================================================================
// Sheets
// ===========================================================================
function Sheet({ title, onClose, children, tall }: { title: string; onClose: () => void; children: ReactNode; tall?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return <div className="absolute inset-0 z-30 flex flex-col justify-end">
    <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/55" />
    <div role="dialog" aria-modal="true" aria-label={title} className={`relative flex flex-col rounded-t-3xl bg-[#1d1720] pb-[env(safe-area-inset-bottom,0px)] shadow-2xl ${tall ? "h-[85%]" : "max-h-[80%]"}`}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><h3 className="text-base font-semibold">{title}</h3><button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><X size={18} /></button></div>
      {children}
    </div>
  </div>;
}

function Comments({ ep, api, say, onClose, onPosted, nickname, setNickname }: { ep: PodEpisode; api: PlayerProps["api"]; say: (m: string) => void; onClose: () => void; onPosted: () => void; nickname?: string; setNickname?: (n: string) => void }) {
  const [list, setList] = useState<Comment[] | null>(null);
  const [admin, setAdmin] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const load = useCallback(() => api(`/api/earshot/comments/${ep.id}`).then((b) => { setList(b.comments || []); setAdmin(!!b.admin); setErr(""); }).catch((e) => { setErr(e.message); setList([]); }), [api, ep.id]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  const post = async (e: FormEvent) => {
    e.preventDefault(); const body = text.trim(); if (!body || busy) return;
    setBusy(true);
    try { const b = await api("/api/earshot/comments", { method: "POST", body: { episodeId: ep.id, showId: ep.showId, body, ...(setNickname ? { name: nickname || "" } : {}) } }); setList((l) => [b.comment, ...(l || [])]); setText(""); onPosted(); }
    catch (e: any) { say(e.message); } finally { setBusy(false); }
  };
  const remove = async (id: string) => { if (confirm !== id) { setConfirm(id); setTimeout(() => setConfirm((c) => (c === id ? null : c)), 3000); return; } try { await api(`/api/earshot/comments/${id}`, { method: "DELETE" }); setList((l) => (l || []).filter((c) => c.id !== id)); } catch (e: any) { say(e.message); } };
  const report = async (id: string) => { try { await api(`/api/earshot/comments/${id}/report`, { method: "POST", body: {} }); setList((l) => (l || []).filter((c) => c.id !== id)); say("Reported. Thanks for keeping it kind."); } catch (e: any) { say(e.message); } };
  return <Sheet title={list ? `${list.length} comment${list.length === 1 ? "" : "s"}` : "Comments"} onClose={onClose} tall>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <p className="mb-3 line-clamp-1 text-xs text-white/50">On “{ep.title}”</p>
      {!list && <div className="grid place-items-center py-10"><Loader2 className="animate-spin" /></div>}
      {err && <p className="py-6 text-center text-sm text-white/65">{err}</p>}
      {list && !err && !list.length && <p className="py-10 text-center text-sm text-white/60"><b className="text-white">No comments yet.</b><br />Say what you thought of this one.</p>}
      <ul className="flex flex-col gap-4">{(list || []).map((c) => <li key={c.id} className="grid grid-cols-[36px_1fr_auto] items-start gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-sm font-semibold text-white/70">{(c.mine ? "Y" : c.author[0] || "A").toUpperCase()}</span>
        <div className="min-w-0"><p className="text-xs font-bold text-white/60">{c.mine ? "You" : c.author} <span className="font-medium text-white/40">· {agoWords(c.at)}</span></p><p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed">{c.body}</p></div>
        {c.mine || admin
          ? <button type="button" onClick={() => remove(c.id)} aria-label="Delete comment" className={`flex items-center gap-1 p-1 text-xs font-bold ${confirm === c.id ? "text-rose-400" : "text-white/40"}`}><Trash2 size={14} />{confirm === c.id ? "Delete?" : ""}</button>
          : <button type="button" onClick={() => report(c.id)} aria-label="Report comment" className="p-1 text-white/35 hover:text-white/70"><Flag size={14} /></button>}
      </li>)}</ul>
    </div>
    {setNickname && <label className="flex items-center gap-2 border-t border-white/10 px-4 pt-2.5 text-xs text-white/55">Posting as<input value={nickname || ""} onChange={(e) => setNickname(e.target.value.slice(0, 24))} maxLength={24} placeholder="Your first name" aria-label="Your name for comments" className="min-w-0 flex-1 border-b border-dashed border-white/20 bg-transparent py-1 text-sm text-white outline-none placeholder:text-white/30" /></label>}
    <form onSubmit={post} className="flex items-center gap-2 border-t border-white/10 p-3">
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} placeholder="Add a comment" aria-label="Write a comment" className="min-h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#ff8a3d]" />
      <button type="submit" disabled={!text.trim() || busy} className="min-h-11 rounded-full px-4 text-sm font-semibold bg-white text-[#111013] disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin" /> : "Post"}</button>
    </form>
  </Sheet>;
}

/** The sleep timer, opened from the moon on Podscroll's controls row. */
function SleepSheet({ sleepAt, onPick, onClose }: { sleepAt: number | "end" | null; onPick: (v: number | "end" | null) => void; onClose: () => void }) {
  const options: [number | "end" | null, string][] = [[5, "5 minutes"], [15, "15 minutes"], [30, "30 minutes"], [45, "45 minutes"], [60, "1 hour"], ["end", "End of episode"], [null, "Off"]];
  const now = sleepAt === null ? "Off" : sleepAt === "end" ? "Stops at the end of this episode" : `Stops in ${Math.max(1, Math.ceil((sleepAt - Date.now()) / 60000))} min`;
  return <Sheet title="Sleep timer" onClose={onClose}>
    <p className="px-4 pt-3 text-xs text-white/55">{now}</p>
    <div className="flex flex-col overflow-y-auto px-2 pb-4 pt-1">{options.map(([v, l]) => {
      const on = v === null ? sleepAt === null : v === "end" && sleepAt === "end";
      return <button key={l} type="button" onClick={() => onPick(typeof v === "number" ? Date.now() + v * 60000 : v)} aria-pressed={on} className="flex min-h-12 items-center justify-between rounded-xl px-3 text-left text-[15px] hover:bg-white/5">{l}{on && <Check size={18} />}</button>;
    })}</div>
  </Sheet>;
}

function SettingsSheet({ es, student, update, onClose, sleepAt, setSleep, apple, theme, account }: { es: EarshotData; student: boolean; update: PlayerProps["update"]; onClose: () => void; sleepAt: number | "end" | null; setSleep: (v: number | "end" | null) => void; apple?: boolean; theme: Theme;
  /** Pod+: who is signed in, with sign in / sign out. */
  account?: { email: string | null; onSignIn: () => void; onSignOut: () => void } }) {
  const set = (patch: Partial<EarshotData["settings"]>) => update((e) => ({ ...e, settings: { ...e.settings, ...patch } }));
  const Row = ({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) => <div className="flex items-center justify-between gap-3 border-b border-white/10 py-3.5 last:border-0"><div><b className="block text-sm">{title}</b>{sub && <span className="block text-xs text-white/55">{sub}</span>}</div>{children}</div>;
  const Switch = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={`relative h-7 w-12 flex-none rounded-full transition ${on ? "" : "bg-white/15"}`} style={on ? { background: ACCENT } : undefined}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${on ? "left-6" : "left-1"}`} /></button>;
  const Seg = <T extends number>({ value, options, onPick }: { value: T; options: [T, string][]; onPick: (v: T) => void }) => <div className="flex flex-none rounded-full bg-white/10 p-0.5">{options.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onPick(v)} className={`rounded-full px-2.5 py-1.5 text-xs font-semibold ${value === v ? "bg-white text-[#120e14]" : "text-white/70"}`}>{l}</button>)}</div>;
  return <Sheet title="Settings" onClose={onClose}>
    <div className="overflow-y-auto px-4 pb-4">
      {account && <Row title="Account" sub={account.email ? `Signed in as ${account.email}` : "Not signed in"}>
        {account.email
          ? <button type="button" onClick={account.onSignOut} className="flex-none rounded-full bg-white/10 px-4 py-2 text-xs font-semibold">Sign out</button>
          : <button type="button" onClick={account.onSignIn} className="flex-none rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#120e14]">Sign in</button>}
      </Row>}
      <Row title="Appearance" sub={theme === "system" ? "Follows your phone or computer" : theme === "light" ? "Day: light pages" : "Night: dark pages"}>
        <div className="flex flex-none rounded-full bg-white/10 p-0.5">{([["light", "Day"], ["dark", "Night"], ["system", "Auto"]] as [Theme, string][]).map(([v, l]) => <button key={v} type="button" aria-pressed={theme === v} onClick={() => setTheme(v)} className={`rounded-full px-2.5 py-1.5 text-xs font-semibold ${theme === v ? "bg-white text-[#120e14]" : "text-white/70"}`}>{l}</button>)}</div>
      </Row>
      <Row title="Smart ad skip" sub={es.settings.adMode === "auto" ? "Skips ads it's sure about, and asks about the rest. Undo any skip" : es.settings.adMode === "ask" ? "Shows a Skip button during ads; you decide" : "Ads play normally"}>
        <div className="flex flex-none rounded-full bg-white/10 p-0.5">{([["auto", "Auto"], ["ask", "Ask"], ["off", "Off"]] as [AdMode, string][]).map(([v, l]) => <button key={v} type="button" aria-pressed={es.settings.adMode === v} onClick={() => set({ adMode: v })} className={`rounded-full px-2.5 py-1.5 text-xs font-semibold ${es.settings.adMode === v ? "bg-white text-[#120e14]" : "text-white/70"}`}>{l}</button>)}</div>
      </Row>
      <Row title="Sleep timer" sub={sleepAt === null ? "Off" : sleepAt === "end" ? "Stops at the end of this episode" : `Stops in ${Math.max(1, Math.ceil((sleepAt - Date.now()) / 60000))} min`}>
        <div className="flex flex-none flex-wrap justify-end gap-1">{([[15, "15m"], [30, "30m"], [60, "1h"], ["end", "End"], [null, "Off"]] as [number | "end" | null, string][]).map(([v, l]) =>
          <button key={l} type="button" onClick={() => setSleep(typeof v === "number" ? Date.now() + v * 60000 : v)} aria-pressed={v === null ? sleepAt === null : v === "end" ? sleepAt === "end" : false} className={`rounded-full px-2.5 py-1.5 text-xs font-semibold ${(v === null && sleepAt === null) || (v === "end" && sleepAt === "end") ? "bg-white text-[#120e14]" : "bg-white/10 text-white/75"}`}>{l}</button>)}</div>
      </Row>
      <Row title="Speed"><Seg value={es.settings.speed} options={SPEEDS.map((s) => [s, `${s}×`] as [number, string])} onPick={(v) => set({ speed: v })} /></Row>
      <Row title="Skip the intro" sub="Jump past theme music, recaps, teasers and the standard welcome to where the episode starts"><Switch on={es.settings.skipIntro} label="Skip the intro" onClick={() => set({ skipIntro: !es.settings.skipIntro })} /></Row>
      <Row title="Swipe for me after" sub="Move to the next podcast by itself"><Seg value={es.settings.advance} options={[[60, "1 min"], [180, "3 min"], [0, "The end"]]} onPick={(v) => set({ advance: v as 0 | 60 | 180 })} /></Row>
      <Row title="Hide trailers and previews" sub="Leave out trailers, sneak peeks, other shows' promos and anything under 3 minutes"><Switch on={es.settings.hideTeasers} label="Hide trailers and previews" onClick={() => set({ hideTeasers: !es.settings.hideTeasers })} /></Row>
      {/* Podscroll's cover is always edge to edge with no notes under it, so these two don't apply there. */}
      {!apple && <Row title="Full-screen cover" sub="The artwork fills the whole screen while you listen"><Switch on={es.settings.fullCover} label="Full-screen cover" onClick={() => set({ fullCover: !es.settings.fullCover })} /></Row>}
      {!apple && <Row title="Episode notes" sub="Show each episode's description under the cover"><Switch on={es.settings.notes} label="Episode notes" onClick={() => set({ notes: !es.settings.notes })} /></Row>}
      {!student && <Row title="Explicit podcasts" sub="Off by default. Turn on to include shows marked explicit"><Switch on={es.settings.explicit} label="Explicit podcasts" onClick={() => set({ explicit: !es.settings.explicit })} /></Row>}
    </div>
  </Sheet>;
}

// ===========================================================================
// Explore
// ===========================================================================
function Explore({ api, ex, student, pools, poolTick, spots, onGenre, onShow, onEpisode, onResume, onPlayEpisode, onPreviews, onPlayEpisodes, onSaveTopic }: { onPlayEpisodes: (list: PodEpisode[], i: number, title: string) => void; onSaveTopic: (topic: Topic, list: PodEpisode[]) => void; onPreviews: (p: PreviewPick[]) => void; api: PlayerProps["api"]; ex: string; student: boolean; pools: Map<string, PoolShow[]>; poolTick: number; spots: Record<string, Spot>; onGenre: (g: string) => void; onShow: (s: PodShow) => void; onEpisode: (s: PodShow, e: PodEpisode) => void; onResume: (id: string, s: Spot) => void; onPlayEpisode: (s: PodShow, e: PodEpisode) => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ shows: PodShow[]; episodes: PodEpisode[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    const term = q.trim(); if (term.length < 2) { setRes(null); setErr(""); return; }
    setBusy(true);
    const t = setTimeout(() => { api(`/api/earshot/search?q=${encodeURIComponent(term)}${ex}`).then((b) => { setRes({ shows: b.shows || [], episodes: b.episodes || [] }); setErr(""); }).catch((e) => setErr(e.message)).finally(() => setBusy(false)); }, 450);
    return () => clearTimeout(t);
  }, [q, api, ex]);
  const popular = useMemo(() => { const out: PodShow[] = []; const seen = new Set<string>(); pools.forEach((list) => list.slice(0, 5).forEach((p) => { if (!seen.has(p.show.id)) { seen.add(p.show.id); out.push(p.show); } })); return out.slice(0, 18); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pools, poolTick]);
  const resume = Object.entries(spots).sort((a, b) => b[1].at - a[1].at).slice(0, 12);
  const genres = GENRES.filter((g) => !student || g.kidSafe);
  const spooky = useMemo(() => [...(pools.get("horror") ?? []), ...(pools.get("truecrime") ?? [])].map((p) => p.show).slice(0, 12), [pools, poolTick]);
  const picks = useMemo(() => previewPicks(pools), [pools, poolTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const asShow = (e: PodEpisode): PodShow => ({ id: e.showId, name: e.show, author: e.author, art: e.art, genre: "culture", appleGenre: "", link: e.link, episodes: 0, explicit: e.explicit, latest: e.date });
  const [subject, setSubject] = useState<string | null>(null);
  if (subject) return <div className="h-full overflow-y-auto px-4 pb-8 pt-16">
    <SubjectView subjectId={subject} api={api} ex={ex} onBack={() => setSubject(null)} onShow={onShow} onPlay={onPlayEpisodes} onSave={onSaveTopic} />
  </div>;
  return <div className="h-full overflow-y-auto px-4 pb-8 pt-16">
    <div className="relative"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={18} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any podcast, host or topic" aria-label="Search podcasts" className="min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-3 text-base text-white outline-none placeholder:text-white/35 focus:border-[#ff8a3d]" /></div>
    {q.trim().length < 2 && <AiFinder api={api} ex={ex} onShow={onShow} onPlay={onPlayEpisode} />}
    {q.trim().length >= 2 ? <div className="mt-4 flex flex-col gap-1">
      {busy && !res && <div className="grid place-items-center py-8"><Loader2 className="animate-spin" /></div>}
      {err && <p className="py-6 text-center text-sm text-white/60">{err}</p>}
      {res && !res.shows.length && !res.episodes.length && <p className="py-6 text-center text-sm text-white/60">Nothing found for “{q.trim()}”. Try a show's name, a host, or a topic like history or cooking.</p>}
      {!!res?.shows.length && <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-white/40">Shows</p>}
      {res?.shows.map((s) => <Row key={s.id} art={s.art} title={s.name} sub={`${s.author}${GENRE[s.genre] ? ` · ${GENRE[s.genre].name}` : ""}`} onClick={() => onShow(s)} />)}
      {!!res?.episodes.length && <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-white/40">Episodes</p>}
      {res?.episodes.map((e) => <Row key={e.id} art={e.art} title={e.title} sub={`${e.show}${e.secs ? ` · ${durationWords(e.secs)}` : ""}`} onClick={() => onEpisode(asShow(e), e)} />)}
    </div> : <>
      {picks.length >= 3 && <PreviewCard picks={picks} onOpen={() => onPreviews(picks)} />}
      <SubjectGrid student={student} onOpen={(s) => setSubject(s.id)} />
      {!!resume.length && <Shelf title="Continue listening">{resume.map(([id, s]) => <Tile key={id} art={s.art} title={s.title} sub={`${s.show} · ${clock(s.t)} in`} onClick={() => onResume(id, s)} />)}</Shelf>}
      {!!popular.length && <Shelf title="Popular in your genres">{popular.map((s) => <Tile key={s.id} art={s.art} title={s.name} sub={s.author} onClick={() => onShow(s)} />)}</Shelf>}
      {!student && !!spooky.length && <Shelf title="Spooky season">{spooky.map((s) => <Tile key={s.id} art={s.art} title={s.name} sub={s.author} onClick={() => onShow(s)} />)}</Shelf>}
      <h3 className="mt-6 text-lg font-semibold">Browse all genres</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{genres.map((g) => <button key={g.id} type="button" onClick={() => onGenre(g.id)} className="flex h-14 items-center gap-2.5 rounded-xl bg-white/[.03] px-3.5 text-left text-sm font-medium leading-tight text-white/85 ring-1 ring-white/[.06]"><span className="h-2 w-2 flex-none rounded-full" style={{ background: g.color }} />{g.name}</button>)}</div>
    </>}
  </div>;
}
const Row = ({ art, title, sub, onClick }: { art: string; title: string; sub: string; onClick: () => void }) => <button type="button" onClick={onClick} className="grid grid-cols-[52px_1fr] items-center gap-3 rounded-xl p-2 text-left hover:bg-white/5"><img src={art} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-[52px] w-[52px] rounded-lg object-cover" /><span className="min-w-0"><b className="block truncate text-sm">{title}</b><span className="block truncate text-xs text-white/55">{sub}</span></span></button>;
const Shelf = ({ title, children }: { title: string; children: ReactNode }) => <section className="mt-6"><h3 className="text-lg font-semibold">{title}</h3><div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">{children}</div></section>;
const Tile = ({ art, title, sub, onClick }: { art: string; title: string; sub: string; onClick: () => void }) => <button type="button" onClick={onClick} className="w-32 flex-none text-left"><img src={art} alt="" referrerPolicy="no-referrer" loading="lazy" className="aspect-square w-32 rounded-xl object-cover" /><b className="mt-1.5 line-clamp-2 text-sm leading-tight">{title}</b><span className="line-clamp-1 text-xs text-white/55">{sub}</span></button>;

// ===========================================================================
// Library
// ===========================================================================
function Library({ es, update, onEditInterests, onOpen, onMode }: { es: EarshotData; update: PlayerProps["update"]; onEditInterests: () => void; onOpen: (s: SavedEpisode) => void; onMode: (m: PodMode) => void }) {
  const [which, setWhich] = useState<"liked" | "saved" | "following">("liked");
  const [asking, setAsking] = useState(false);
  const ranked = GENRES.map((g) => [g, tasteOf(es, g.id)] as const).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(1, ranked[0]?.[1] ?? 1);
  const eps = which === "liked" ? es.liked : es.saved;
  return <div className="h-full overflow-y-auto px-4 pb-8 pt-16">
    <div className="flex items-center justify-between gap-3"><h3 className="text-2xl font-semibold">Library</h3><button type="button" onClick={onEditInterests} className="min-h-9 rounded-full bg-white/10 px-4 text-sm font-bold">Edit interests</button></div>
    <ModesHub es={es} onOpen={onMode} />
    <div className="mt-6 grid grid-cols-3 gap-2">{([["Heard", es.heard.length], ["Liked", es.liked.length], ["Following", es.follows.length]] as const).map(([l, n]) => <div key={l} className="rounded-xl bg-white/[.03] p-3 ring-1 ring-white/[.06]"><b className="block text-xl font-semibold tabular-nums">{n}</b><span className="text-[11px] text-white/40">{l}</span></div>)}</div>
    <h4 className="mt-6 text-sm font-semibold">What your feed has learned</h4>
    <div className="mt-2 flex flex-col gap-2">{ranked.map(([g, v]) => <div key={g.id} className="grid grid-cols-[120px_1fr_32px] items-center gap-2 text-xs"><span className="truncate">{g.name}</span><span className="h-2 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full" style={{ width: `${Math.max(3, (Math.max(0, v) / max) * 100)}%`, background: g.color }} /></span><span className="text-right tabular-nums text-white/45">{Math.round((Math.max(0, v) / max) * 100)}</span></div>)}</div>
    <p className="mt-2 text-xs leading-relaxed text-white/45">Likes, follows, shares and listening raise a genre; quick skips lower it. About one in seven picks is something new on purpose.</p>
    <div className="mt-6 flex gap-1.5">{(["liked", "saved", "following"] as const).map((w) => <button key={w} type="button" aria-pressed={which === w} onClick={() => setWhich(w)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize ${which === w ? "bg-white text-[#120e14]" : "bg-white/10 text-white/70"}`}>{w}</button>)}</div>
    <div className="mt-3 grid grid-cols-3 gap-3">
      {which === "following" ? es.follows.map((s) => <div key={s.id} className="text-left"><img src={s.art} alt="" referrerPolicy="no-referrer" className="aspect-square w-full rounded-xl object-cover" /><b className="mt-1 line-clamp-2 text-xs">{s.name}</b></div>)
        : eps.map((e) => <button key={e.id} type="button" onClick={() => onOpen(e)} className="text-left"><img src={e.art} alt="" referrerPolicy="no-referrer" className="aspect-square w-full rounded-xl object-cover" /><b className="mt-1 line-clamp-2 text-xs leading-tight">{e.title}</b><span className="line-clamp-1 text-[11px] text-white/50">{e.show}</span></button>)}
    </div>
    {((which === "following" && !es.follows.length) || (which !== "following" && !eps.length)) && <p className="py-6 text-center text-sm text-white/55">{which === "liked" ? "Double-tap an episode to like it." : which === "saved" ? "Tap the bookmark to save an episode for later." : "Tap + on a podcast to follow it."}</p>}
    <div className="mt-8">{asking
      ? <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/5 p-3 text-sm"><span className="flex-1">Clear what the feed has learned? Likes, saves and follows stay.</span><button type="button" onClick={() => { update((e) => ({ ...e, taste: Object.fromEntries(e.genres.map((g) => [g, 3])), skipped: [] })); setAsking(false); }} className="rounded-full px-4 py-1.5 font-semibold bg-white text-[#111013]">Reset</button><button type="button" onClick={() => setAsking(false)} className="rounded-full bg-white/10 px-4 py-1.5 font-bold">Cancel</button></div>
      : <button type="button" onClick={() => setAsking(true)} className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold">Reset recommendations</button>}</div>
  </div>;
}
