// Pod+ home: a browse layout (top search bar, side menu, topic chips, a grid of episodes). Picking an
// episode opens the swipe feed on it, so listening always happens there. Everything shown is real:
// shows and episodes come from the same /api/podscroll routes the swipe feed uses (Apple Podcasts
// through the Arise server). Follows, likes and Listen later come from the swipe feed's saved state.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { GENRE, GENRES, chooseEpisode, hiRes, pickNext, tasteOf, type Candidate, type Earshot, type PodEpisode, type PodShow, type PoolShow, type SavedEpisode, type Signal } from "@shared/earshot";
import { Bell, Check, Moon, Sun, Clock, Heart, Home as HomeIcon, Library, Loader2, Menu, MessageCircle, Mic, MoreVertical, Radio as RadioIcon, Search, Sparkles, ThumbsUp, Users, X } from "lucide-react";
import { RadioBar, RadioView, type Station } from "./Radio";
import { PartyRoom } from "./Party";
import { AddToMenu, ModePage, ModesRow, NewModeDialog, makeMode } from "./Hubs";
import { hubTheme } from "@shared/earshot";
import { GoLiveSheet, LiveRoom, type LiveSummary } from "../client/src/components/family-hub/earshot/EarshotCreators";
import { setTheme, useTheme } from "../client/src/components/family-hub/earshot/EarshotPlayer";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
type View = { kind: "home" } | { kind: "search"; q: string } | { kind: "liked" } | { kind: "later" } | { kind: "radio" } | { kind: "party"; id: string } | { kind: "mode"; id: string } | { kind: "watch"; showId: string; episodeId: string };

const DEFAULT_GENRES = ["comedy", "news", "science", "tech", "truecrime", "history", "business", "culture"];
const ACCENT = "#ff6a1f";

const fmtTime = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};
const ago = (iso: string) => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = Math.max(0, (Date.now() - t) / 1000);
  const units: [number, string][] = [[31536000, "year"], [2592000, "month"], [604800, "week"], [86400, "day"], [3600, "hour"], [60, "minute"]];
  for (const [n, w] of units) if (d >= n) { const k = Math.floor(d / n); return `${k} ${w}${k > 1 ? "s" : ""} ago`; }
  return "just now";
};
const plain = (s: string) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

function parseHash(): View {
  const h = location.hash.replace(/^#\/?/, "");
  const [a, b, c] = h.split("/");
  if (a === "watch" && /^\d+$/.test(b || "") && /^\d+$/.test(c || "")) return { kind: "watch", showId: b, episodeId: c };
  if (a === "search" && b) return { kind: "search", q: decodeURIComponent(b) };
  if (a === "liked") return { kind: "liked" };
  if (a === "later") return { kind: "later" };
  if (a === "radio") return { kind: "radio" };
  if (a === "party" && /^(new|[A-Za-z0-9_-]{6,20})$/.test(b || "")) return { kind: "party", id: b };
  if (a === "mode" && /^[a-z0-9-]{1,30}$/.test(b || "")) return { kind: "mode", id: b };
  return { kind: "home" };
}
const hashOf = (v: View) => v.kind === "party" ? `#/party/${v.id}` : v.kind === "mode" ? `#/mode/${v.id}` : v.kind === "watch" ? `#/watch/${v.showId}/${v.episodeId}` : v.kind === "search" ? `#/search/${encodeURIComponent(v.q)}` : v.kind === "home" ? "#/" : `#/${v.kind}`;

const fromSaved = (s: SavedEpisode): PodEpisode => ({ id: s.id, showId: s.showId, show: s.show, author: "", title: s.title, about: "", audio: s.audio || "", date: s.date || s.at, secs: s.secs, art: s.art, link: "", explicit: false });

const readLs = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeLs = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window */ } };
const loadTopics = (): string[] => { try { const v = JSON.parse(readLs("podscroll.topics") || "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, 20) : []; } catch { return []; } };

/** Same order for the whole visit, different every visit: nothing is ranked by how popular it is. */
function shuffled<T>(list: T[], seed: number): T[] {
  const out = list.slice(); let s = seed || 1;
  const rand = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/** Dark mode for the home page and its pages: its light colors swapped for dark ones. */
const DARK_CSS = ".ps-dark{background-color:#0f0f0f!important;color:#f1f1f1!important}.ps-dark .bg-white{background-color:#0f0f0f}.ps-dark .bg-\\[\\#f2f2f2\\]{background-color:#272727}.ps-dark .bg-\\[\\#f7f7f5\\]{background-color:#1c1c1c}.ps-dark .bg-\\[\\#f8f8f8\\]{background-color:#222}.ps-dark .bg-\\[\\#e5e5e5\\]{background-color:#333}.ps-dark .bg-\\[\\#fff1e8\\]{background-color:#3a2416}.ps-dark .bg-\\[\\#fff4ee\\]{background-color:#2b1b11}.ps-dark .bg-\\[\\#fef3f2\\]{background-color:#3a1d1b}.ps-dark .bg-\\[\\#ececec\\]{background-color:#2a2a2a}.ps-dark .hover\\:bg-\\[\\#f2f2f2\\]:hover{background-color:#272727}.ps-dark .hover\\:bg-\\[\\#e5e5e5\\]:hover{background-color:#3a3a3a}.ps-dark .hover\\:bg-\\[\\#f7f7f5\\]:hover{background-color:#1f1f1f}.ps-dark .hover\\:bg-\\[\\#ffe9dc\\]:hover{background-color:#3a2416}.ps-dark .hover\\:bg-\\[\\#def1ff\\]:hover{background-color:#1d2b3a}.ps-dark .hover\\:bg-\\[\\#efefec\\]:hover{background-color:#262626}.ps-dark .hover\\:bg-\\[\\#fee4e2\\]:hover{background-color:#4a2420}.ps-dark .hover\\:bg-\\[\\#272727\\]:hover{background-color:#d9d9d9}.ps-dark .hover\\:bg-\\[\\#fef3f2\\]:hover{background-color:#3a1d1b}.ps-dark .text-\\[\\#0f0f0f\\]{color:#f1f1f1}.ps-dark .text-\\[\\#606060\\]{color:#aaaaaa}.ps-dark .text-\\[\\#767676\\]{color:#9a9a9a}.ps-dark .text-\\[\\#3a3a3a\\]{color:#d0d0d0}.ps-dark .text-\\[\\#065fd4\\]{color:#3ea6ff}.ps-dark .text-\\[\\#b42318\\]{color:#ff8a80}.ps-dark .text-\\[\\#9a3412\\]{color:#ffb38a}.ps-dark .text-\\[\\#c2410c\\]{color:#ff9a5a}.ps-dark .border-\\[\\#e5e5e5\\]{border-color:#3a3a3a}.ps-dark .border-\\[\\#ececec\\]{border-color:#3a3a3a}.ps-dark .border-\\[\\#d3d3d3\\]{border-color:#3a3a3a}.ps-dark .border-\\[\\#c4c4c4\\]{border-color:#3a3a3a}.ps-dark .border-\\[\\#1a1a1c\\]{border-color:#3a3a3a}.ps-dark .divide-\\[\\#ececec\\]>:not([hidden])~:not([hidden]){border-color:#2e2e2e}.ps-dark .divide-\\[\\#e5e5e5\\]>:not([hidden])~:not([hidden]){border-color:#2e2e2e}.ps-dark .ring-\\[\\#c4c4c4\\]{--tw-ring-color:#4a4a4a}.ps-dark .ring-\\[\\#d3d3d3\\]{--tw-ring-color:#4a4a4a}.ps-dark .bg-\\[\\#0f0f0f\\]:not(.ps-keep){background-color:#f1f1f1;color:#0f0f0f}.ps-dark .bg-\\[\\#0f0f0f\\]:not(.ps-keep).text-white{color:#0f0f0f}.ps-dark .bg-white\\/95{background-color:rgba(15,15,15,.95)}.ps-dark input:not([type=color]),.ps-dark textarea{color:#f1f1f1;background-color:#121212}.ps-dark input::placeholder,.ps-dark textarea::placeholder{color:#8a8a8a}.ps-dark .shadow-2xl{box-shadow:0 20px 60px rgba(0,0,0,.6)}";

const HINTS = [
  "Search podcasts",
  "Video killed the radio star",
  "Phone down, podcast on",
  "Screen off. Still on.",
  "Free with the screen off",
  "Nothing to stare at",
  "Keep your eyes free",
  "Get your hours back",
  "Listen while you do",
  "No algorithm bait",
  "Not ranked by views",
  "Small shows count",
  "Real podcasts only",
  "No clickbait. Ever.",
];

const WHY: { h: string; p: string }[] = [
  { h: "Video killed the radio star.", p: "Audio's back, and it doesn't need your screen." },
  { h: "Lock your phone. It keeps playing.", p: "On YouTube that takes Premium. Here it's free." },
  { h: "No ads stacked on ads.", p: "No unskippable pre-rolls, no break every few minutes. We don't add a single ad of our own." },
  { h: "Nothing to stare at.", p: "Video wants your eyes. Audio leaves them for the drive, the gym, the work." },
  { h: "Get the hours back.", p: "The people getting things done aren't scrolling. They're listening while they do it." },
  { h: "No algorithm bait.", p: "We don't rank by views. Anyone can start a podcast, and the thing you need might come from a show with one follower." },
  { h: "Swipe through substance.", p: "Every swipe is a real podcast, not a clip built to bait a click." },
];

export function Home({ es, update, api, say, onOpenFeed, onEditInterests, pro, onJoin, device, nickname, setNickname, liveBase, signal }: {
  es: Earshot;
  update: (fn: (e: Earshot) => Earshot) => void;
  api: Api;
  say: (m: string) => void;
  onOpenFeed: (start?: { showId: string; episodeId: string }, page?: "openmic" | "social" | "library", mode?: { id: string; index: number; shuffle?: boolean; order?: "in" | "shuffle" | "shows" }) => void;
  onEditInterests: () => void;
  pro: boolean;
  onJoin: () => void;
  signal: (genre: string, s: Signal) => void;
  device: string;
  nickname: string;
  setNickname: (n: string) => void;
  liveBase: string;
}) {
  const [view, setViewState] = useState<View>(parseHash);
  // Switch views right away, and keep the address in step (so Back and links work).
  const go = useCallback((v: View) => { const h = hashOf(v); setViewState(v); if (location.hash !== h) location.hash = h; window.scrollTo(0, 0); }, []);
  useEffect(() => { const on = () => { setViewState(parseHash()); window.scrollTo(0, 0); }; window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []);
  // Light or dark: the same setting as the swipe feed (follows the phone unless changed).
  const { theme, day } = useTheme();
  const dark = !day;
  useEffect(() => { document.documentElement.style.background = dark ? "#0f0f0f" : "#ffffff"; }, [dark]);
  const cycleTheme = () => setTheme(theme === "system" ? (dark ? "light" : "dark") : theme === "dark" ? "light" : "dark");

  const ex = es.settings.explicit ? "&explicit=1" : "";
  const genres = useMemo(() => (es.setupDone && es.genres.length ? es.genres : DEFAULT_GENRES).filter((g) => GENRE[g]).slice(0, 12), [es.setupDone, es.genres]);
  const [pools, setPools] = useState<Record<string, PoolShow[]> | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    setErr(""); setPools(null);
    api(`/api/earshot/feed?genres=${genres.join(",")}${ex}`).then((b) => setPools(b.pools || {})).catch((e) => setErr(e.message));
  }, [api, genres, ex]);
  useEffect(() => { load(); }, [load]);
  const [seed] = useState(() => Math.floor(Math.random() * 4294967296));

  // One card per show (its newest episode), shuffled and taking turns between genres: a show with a
  // handful of listeners gets the same spot as the biggest one.
  const cardsOf = useCallback((g: string, list: PoolShow[]) => shuffled(list.map((p) => p.episodes[0] && { ...p.episodes[0], art: p.episodes[0].art || p.show.art, genre: g }).filter(Boolean) as (PodEpisode & { genre: string })[], seed), [seed]);
  // "All" is your For You feed laid out as a grid: the same picks and the same learning as the swipe
  // feed (shared/earshot pickNext). A brand-new listener starts from what's popular across podcast
  // apps; that head start fades as they listen, tap and like, until the feed is theirs.
  const esRef = useRef(es); esRef.current = es;
  const poolsRef = useRef<Record<string, PoolShow[]>>({});
  const [feed, setFeed] = useState<(PodEpisode & { genre: string })[]>([]);
  const feedRef = useRef(feed); feedRef.current = feed;
  const shownShows = useRef(new Set<string>());
  const showGenre = useRef(new Map<string, string>());
  const morePage = useRef(new Map<string, number | null>());
  const growing = useRef(false);
  const fails = useRef(0);
  const [chart, setChart] = useState<Map<string, number> | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setChart((c) => c ?? new Map()), 2500);
    api("/api/earshot/top").then((b) => setChart(new Map((b.shows || []).map((sh: PodShow, i: number) => [sh.id, i + 1] as [string, number])))).catch(() => setChart((c) => c ?? new Map()));
    return () => clearTimeout(t);
  }, [api]);
  const chartRef = useRef(chart); chartRef.current = chart;
  const candidates = useCallback((): (Candidate & { episodes: PodEpisode[] })[] => {
    const e = esRef.current;
    const learned = Math.min(1, (e.heard.length + 2 * e.liked.length + 2 * e.follows.length + e.saved.length) / 40);
    const out: (Candidate & { episodes: PodEpisode[] })[] = []; const seen = new Set<string>();
    for (const [g, list] of Object.entries(poolsRef.current)) for (const p of list) {
      if (seen.has(p.show.id)) continue; seen.add(p.show.id);
      const show = { ...p.show, genre: p.show.genre || g };
      showGenre.current.set(show.id, show.genre);
      const c = chartRef.current?.get(show.id);
      const rank = c !== undefined ? p.rank - Math.round((1 - learned) * (45 - Math.min(c, 40))) : p.rank;
      out.push({ show, rank, episodes: p.episodes });
    }
    return out;
  }, []);
  const buildRef = useRef<(n: number) => void>(() => {});
  const grow = useCallback(() => {
    if (growing.current || fails.current >= 3) return;
    growing.current = true;
    const e = esRef.current;
    const loaded = Object.keys(poolsRef.current);
    const open = GENRES.map((g) => g.id).filter((g) => !loaded.includes(g) && g !== "kids").sort((a, b) => tasteOf(e, b) - tasteOf(e, a));
    let job: Promise<void> | null = null;
    if (open.length) {
      const g = Math.random() < 0.7 ? open[0] : open[Math.floor(Math.random() * open.length)];
      job = api(`/api/earshot/feed?genres=${g}${ex}`).then((b) => { poolsRef.current[g] = b.pools?.[g] || []; });
    } else {
      const g = loaded.filter((x) => morePage.current.get(x) !== null).sort((a, b) => tasteOf(e, b) - tasteOf(e, a))[0];
      if (g) {
        const page = morePage.current.get(g) ?? 0;
        job = api(`/api/earshot/more?genre=${g}&page=${page}${ex}`).then((b) => {
          morePage.current.set(g, typeof b.next === "number" ? b.next : null);
          const have = new Set((poolsRef.current[g] || []).map((x) => x.show.id));
          poolsRef.current[g] = [...(poolsRef.current[g] || []), ...((b.pool || []) as PoolShow[]).filter((x) => !have.has(x.show.id))];
        });
      } else {
        // Every show has had a turn: start the rotation again, newest unheard episodes first.
        shownShows.current = new Set(feedRef.current.slice(-30).map((x) => x.showId));
      }
    }
    const done = (ok: boolean) => { growing.current = false; fails.current = ok ? 0 : fails.current + 1; if (ok || fails.current < 3) buildRef.current(12); };
    if (job) job.then(() => done(true), () => done(false)); else done(true);
  }, [api, ex]);
  const build = useCallback((n: number) => {
    const e = esRef.current;
    const cands = candidates();
    const picks = pickNext(e, cands, { recentShows: feedRef.current.slice(-5).map((x) => x.showId), shownShows: shownShows.current, follows: e.follows.map((f) => f.id) }, n);
    const byId = new Map(cands.map((c) => [c.show.id, c] as [string, (typeof cands)[number]]));
    const add: (PodEpisode & { genre: string })[] = [];
    for (const p of picks) {
      shownShows.current.add(p.show.id);
      const c = byId.get(p.show.id);
      const ep = c?.episodes.length ? chooseEpisode(e, c.episodes) : null;
      if (ep && !feedRef.current.some((x) => x.id === ep.id)) add.push({ ...ep, art: ep.art || p.show.art, genre: p.show.genre });
    }
    if (add.length) setFeed((f) => { const next = [...f, ...add]; feedRef.current = next; return next; });
    if (picks.length < n) grow();
  }, [candidates, grow]);
  buildRef.current = build;
  // Start (and restart when their topics change) once the shows and the popularity list are in.
  useEffect(() => {
    if (!pools || !chart) return;
    poolsRef.current = { ...pools }; shownShows.current = new Set(); morePage.current = new Map(); fails.current = 0;
    feedRef.current = []; setFeed([]);
    buildRef.current(24);
  }, [pools, chart]);
  const all = feed;
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = moreRef.current; if (!el) return;
    const io = new IntersectionObserver((ents) => { if (ents.some((x) => x.isIntersecting)) buildRef.current(12); }, { rootMargin: "800px 0px" });
    io.observe(el); return () => io.disconnect();
  });

  const [chip, setChip] = useState("all");
  // Live radio keeps playing while you browse the rest of the home page.
  const [station, setStation] = useState<Station | null>(null);
  const stopRadio = useCallback(() => setStation(null), []);
  // Listening together and the radio don't mix: the radio stops when a group opens.
  useEffect(() => { if (view.kind === "party") setStation(null); }, [view.kind]);
  const onPartyRoom = useCallback((id: string) => { if (location.hash !== `#/party/${id}`) history.replaceState(null, "", `${location.pathname}${location.search}#/party/${id}`); }, []);

  // LivePod (audio-only live): who's live now, on the home page too.
  const [live, setLive] = useState<LiveSummary[]>([]);
  const [liveRoom, setLiveRoom] = useState<{ id: string; ticket?: string } | null>(null);
  const [goLive, setGoLive] = useState(false);
  useEffect(() => {
    const pull = () => { if (document.visibilityState === "visible") api("/api/earshot/creators/live").then((b) => setLive(b.live || [])).catch(() => {}); };
    pull(); const t = setInterval(pull, 30_000); return () => clearInterval(t);
  }, [api]);
  const openLive = (id: string) => { setStation(null); setLiveRoom({ id }); };
  // Pod Modes: "Add to" from any episode card, and making a new mode.
  const [addTo, setAddTo] = useState<PodEpisode | null>(null);
  const [newMode, setNewMode] = useState(false);
  // Any genre can be a chip, not just the ones picked: its shows load the first time it's tapped.
  const [extra, setExtra] = useState<Record<string, PodEpisode[] | "loading" | "error">>({});
  const [extraShows, setExtraShows] = useState<Record<string, PodShow[]>>({});
  useEffect(() => {
    if (chip === "all" || chip.startsWith("t:") || genres.includes(chip) || extra[chip]) return;
    setExtra((x) => ({ ...x, [chip]: "loading" }));
    api(`/api/earshot/feed?genres=${chip}${ex}`).then((b) => { const list: PoolShow[] = b.pools?.[chip] || []; setExtraShows((x) => ({ ...x, [chip]: byRank(list) })); setExtra((x) => ({ ...x, [chip]: cardsOf(chip, list) })); }).catch(() => setExtra((x) => ({ ...x, [chip]: "error" })));
  }, [chip, genres, extra, api, ex, cardsOf]);
  // The round "Top shows" row: real popularity from the server (Apple's Top Podcasts charts for All
  // and each genre). Only this row is ranked by popularity; the grid below never is.
  const [tops, setTops] = useState<Record<string, PodShow[]>>({});
  const topKey = chip.startsWith("t:") ? "" : chip;
  useEffect(() => {
    if (!topKey) return;
    if (tops[topKey]) return;
    if (topKey === "all") return;
    const path = `/api/earshot/top?genre=${encodeURIComponent(topKey)}`;
    api(path).then((b) => setTops((t) => ({ ...t, [topKey]: b.shows || [] }))).catch(() => setTops((t) => ({ ...t, [topKey]: [] })));
  }, [topKey, tops, api]);
  const topShows = topKey ? tops[topKey] || [] : [];
  const openShowLatest = (sh: PodShow) => api(`/api/earshot/show/${sh.id}?x=1${ex}`).then((b) => { const e = (b.episodes || [])[0]; if (e) openEp(e); else say("No episodes to play yet."); }).catch((e) => say(e.message));
  const chipGenres = useMemo(() => [...genres, ...GENRES.map((g) => g.id).filter((g) => !genres.includes(g) && g !== "kids")], [genres]);

  // Your own topics: a tab for anything (a person, a place, an idea) that pulls every episode, new or
  // old, that mentions it.
  const [topics, setTopicsState] = useState<string[]>(loadTopics);
  const setTopics = (t: string[]) => { setTopicsState(t); writeLs("podscroll.topics", JSON.stringify(t)); };
  const [adding, setAdding] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const addTopic = () => {
    const t = newTopic.replace(/\s+/g, " ").trim().slice(0, 40);
    if (t.length < 2) return;
    if (!topics.some((x) => x.toLowerCase() === t.toLowerCase())) setTopics([...topics, t].slice(0, 20));
    setChip(`t:${t}`); setNewTopic(""); setAdding(false);
  };
  // New here: ask for two or more topics (skippable). Skipped, the feed starts from what's popular.
  const [askTopics, setAskTopics] = useState(() => !es.setupDone && readLs("podscroll.asked") !== "yes");
  const doneAsking = (picked: string[] | null) => {
    writeLs("podscroll.asked", "yes"); setAskTopics(false);
    if (picked && picked.length >= 2) update((e) => ({ ...e, setupDone: true, genres: picked, taste: { ...e.taste, ...Object.fromEntries(picked.map((g) => [g, Math.max(3, e.taste[g] ?? 0)])) } }));
  };
  const [whyHidden, setWhyHidden] = useState(() => readLs("podscroll.why") === "hidden");
  const [side, setSide] = useState(true);
  const [q, setQ] = useState(view.kind === "search" ? view.q : "");
  // The search box's placeholder: "Search podcasts" first, then a short line every few seconds, in
  // random order. Paused while the box is in use. Short enough to fit a phone's search box.
  const [hint, setHint] = useState(0);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (searching) return;
    const t = setInterval(() => setHint((h) => { let n = h; while (n === h) n = 1 + Math.floor(Math.random() * (HINTS.length - 1)); return n; }), 4000);
    return () => clearInterval(t);
  }, [searching]);
  // Browse here; listen in the swipe feed, starting on the episode you picked.
  const openEp = useCallback((e: PodEpisode) => {
    // A tap teaches the feed too (a small nudge toward that show's genre).
    const g = (e as { genre?: string }).genre || showGenre.current.get(e.showId);
    if (g && GENRE[g]) signal(g, "open");
    onOpenFeed({ showId: e.showId, episodeId: e.id });
  }, [onOpenFeed, signal]);
  // An older #/watch/... link opens that episode in the swipe feed.
  useEffect(() => {
    if (view.kind !== "watch") return;
    history.replaceState(null, "", location.pathname + location.search + "#/");
    onOpenFeed({ showId: view.showId, episodeId: view.episodeId });
  }, [view, onOpenFeed]);

  const header = (
    <header className="sticky top-0 z-30 bg-white pt-[env(safe-area-inset-top,0px)]">
      <div className="flex h-14 items-center justify-between gap-3 px-3 sm:px-4">
      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        <button onClick={() => setSide((s) => !s)} aria-label="Menu" className="hidden h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2] lg:inline-flex"><Menu size={22} strokeWidth={1.8} /></button>
        <button onClick={() => { setChip("all"); go({ kind: "home" }); }} aria-label="Pod+ home" className="inline-flex items-center gap-1.5 px-1 py-2">
          <svg width="30" height="21" viewBox="0 0 30 21" aria-hidden="true"><rect width="30" height="21" rx="6" fill={ACCENT} /><rect x="8" y="7.5" width="2.4" height="6" rx="1.2" fill="#fff" /><rect x="12.2" y="4.5" width="2.4" height="12" rx="1.2" fill="#fff" /><rect x="16.4" y="6.5" width="2.4" height="8" rx="1.2" fill="#fff" /><rect x="20.6" y="8.5" width="2.4" height="4" rx="1.2" fill="#fff" /></svg>
          <span className="text-[20px] font-bold tracking-[-0.04em]">Pod+</span>
        </button>
      </div>
      <form role="search" className="flex min-w-0 max-w-[640px] flex-1 items-center" onSubmit={(e) => { e.preventDefault(); const t = q.trim(); if (t.length >= 2) go({ kind: "search", q: t }); }}>
        <label htmlFor="ps-q" className="sr-only">Search podcasts</label>
        <input id="ps-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => { setSearching(true); setHint(0); }} onBlur={() => setSearching(false)} placeholder={HINTS[hint]} aria-label="Search podcasts" className="h-10 min-w-0 flex-1 rounded-l-full border border-r-0 border-[#d3d3d3] px-4 text-base text-[#0f0f0f] outline-none placeholder:text-[#888] focus:border-[#1c62b9]" />
        <button type="submit" aria-label="Search" className="inline-flex h-10 w-14 shrink-0 items-center justify-center rounded-r-full border border-[#d3d3d3] bg-[#f8f8f8] hover:bg-[#f0f0f0] sm:w-16"><Search size={20} strokeWidth={1.8} /></button>
      </form>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <button onClick={() => onOpenFeed()} className="hidden h-9 items-center gap-2 rounded-full border border-[#e5e5e5] px-4 text-sm font-medium hover:bg-[#f2f2f2] md:inline-flex"><Sparkles size={17} strokeWidth={1.8} />Swipe feed</button>
        {!pro && <button onClick={onJoin} className="hidden h-9 items-center rounded-full bg-[#0f0f0f] px-4 text-sm font-semibold text-white hover:bg-[#272727] sm:inline-flex">Go ad-free</button>}
        <button onClick={cycleTheme} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2]">{dark ? <Sun size={20} strokeWidth={1.8} /> : <Moon size={20} strokeWidth={1.8} />}</button>
        <button aria-label="Notifications" className="hidden h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2] sm:inline-flex"><Bell size={21} strokeWidth={1.8} /></button>
      </div>
      </div>
    </header>
  );

  const navItem = (label: string, icon: React.ReactNode, on: boolean, act: () => void) => (
    <button key={label} onClick={act} className={`flex h-10 w-full items-center gap-6 rounded-[10px] px-3 text-left text-sm hover:bg-[#f2f2f2] ${on ? "bg-[#f2f2f2] font-semibold" : ""}`}>{icon}<span className="truncate">{label}</span></button>
  );
  const sidebar = side && view.kind !== "watch" && (
    <nav aria-label="Library" className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] hidden max-h-[calc(100vh-56px-env(safe-area-inset-top,0px))] w-[240px] shrink-0 flex-col gap-0.5 overflow-y-auto p-3 lg:flex">
      {navItem("Home", <HomeIcon size={22} strokeWidth={1.8} />, view.kind === "home", () => { setChip("all"); go({ kind: "home" }); })}
      {navItem("Swipe feed",<Sparkles size={22} strokeWidth={1.8} />, false, () => onOpenFeed())}
      {navItem("Open Mic", <Mic size={22} strokeWidth={1.8} />, false, () => onOpenFeed(undefined, "openmic"))}
      {navItem("Social", <MessageCircle size={22} strokeWidth={1.8} />, false, () => onOpenFeed(undefined, "social"))}
      {navItem("Radio", <RadioIcon size={22} strokeWidth={1.8} />, view.kind === "radio", () => go({ kind: "radio" }))}
      {navItem("Listen together", <Users size={22} strokeWidth={1.8} />, view.kind === "party", () => go({ kind: "party", id: "new" }))}
      {navItem("Go live", <Mic size={22} strokeWidth={1.8} />, false, () => setGoLive(true))}
      <div className="my-3 h-px bg-[#e5e5e5]" />
      <p className="mx-3 mb-1.5 mt-1 text-base font-semibold">You</p>
      {navItem("Library", <Library size={22} strokeWidth={1.8} />, false, () => onOpenFeed(undefined, "library"))}
      {navItem("Liked episodes", <ThumbsUp size={22} strokeWidth={1.8} />, view.kind === "liked", () => go({ kind: "liked" }))}
      {navItem("Listen later", <Clock size={22} strokeWidth={1.8} />, view.kind === "later", () => go({ kind: "later" }))}
      <div className="my-3 h-px bg-[#e5e5e5]" />
      <p className="mx-3 mb-1.5 mt-1 text-base font-semibold">Pod Modes</p>
      {es.modes.map((m) => { const th = hubTheme(m); return navItem(m.name, <span className="h-[22px] w-[22px] shrink-0 rounded-full" style={{ background: th.bg, boxShadow: `inset 0 0 0 5px ${th.bg}, inset 0 0 0 11px ${th.accent}` }} />, view.kind === "mode" && view.id === m.id, () => go({ kind: "mode", id: m.id })); })}
      {navItem("New mode", <span className="grid h-[22px] w-[22px] place-items-center rounded-full ring-1 ring-[#c4c4c4] text-[#606060]">+</span>, false, () => setNewMode(true))}
      <div className="my-3 h-px bg-[#e5e5e5]" />
      {navItem("Your interests", <Heart size={22} strokeWidth={1.8} />, false, onEditInterests)}
      {es.follows.length > 0 && <>
        <div className="my-3 h-px bg-[#e5e5e5]" />
        <p className="mx-3 mb-1.5 mt-1 text-base font-semibold">Following</p>
        {es.follows.slice(0, 12).map((f) => navItem(f.name, <img src={hiRes(f.art, 60)} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover" />, false, () => {
          api(`/api/earshot/show/${f.id}?x=1${ex}`).then((b) => { const e = (b.episodes || [])[0]; if (e) openEp(e); else say("No episodes to play yet."); }).catch((e) => say(e.message));
        }))}
      </>}
      <div className="my-3 h-px bg-[#e5e5e5]" />
      {pro
        ? <p className="mx-3 text-sm text-[#606060]"><b className="text-[#0f0f0f]">Pod+ Member.</b> Ads get skipped, and your show can earn.</p>
        : <div className="mx-1 rounded-xl border border-[#e5e5e5] p-3">
          <p className="text-sm font-semibold">Pod+ Membership</p>
          <p className="mt-1 text-[13px] leading-snug text-[#606060]">Listening is free. Members skip the ads and get paid for their own show.</p>
          <button onClick={onJoin} className="mt-3 h-9 w-full rounded-full bg-[#0f0f0f] text-sm font-semibold text-white hover:bg-[#272727]">Become a member</button>
        </div>}
    </nav>
  );

  let content: React.ReactNode;
  if (view.kind === "watch") {
    content = <div className="flex justify-center py-32"><Loader2 className="animate-spin text-[#606060]" size={28} /></div>;
  } else if (view.kind === "search") {
    content = <SearchResults key={view.q} q={view.q} api={api} ex={ex} onOpen={openEp} />;
  } else if (view.kind === "mode") {
    content = <ModePage es={es} id={view.id} update={update} say={say} onBack={() => go({ kind: "home" })} api={api} ex={ex} onPlay={(index, order) => onOpenFeed(undefined, undefined, { id: view.id, index, order })} />;
  } else if (view.kind === "party") {
    content = <PartyRoom key="party" room={view.id} api={api} wsBase={liveBase} device={device} nickname={nickname} setNickname={setNickname} say={say} pickFrom={all} ex={ex} onRoom={onPartyRoom} onLeave={() => go({ kind: "home" })} />;
  } else if (view.kind === "radio") {
    content = <RadioView onPlay={setStation} current={station} />;
  } else if (view.kind === "liked" || view.kind === "later") {
    const list = (view.kind === "liked" ? es.liked : es.saved).map(fromSaved);
    content = <div className="px-4 pb-16 pt-4 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{view.kind === "liked" ? "Liked episodes" : "Listen later"}</h1>
      {list.length ? <Grid list={list} onOpen={openEp} /> : <p className="text-[#606060]">{view.kind === "liked" ? "Episodes you like show up here." : "Tap Save on any episode to keep it here for later."}</p>}
    </div>;
  } else {
    const chipCls = (on: boolean) => `h-8 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium ${on ? "bg-[#0f0f0f] text-white" : "bg-[#f2f2f2] hover:bg-[#e5e5e5]"}`;
    const topic = chip.startsWith("t:") ? chip.slice(2) : null;
    const more = !topic && chip !== "all" && !genres.includes(chip) ? extra[chip] : null;
    const shown = chip === "all" ? feed : Array.isArray(more) ? more : cardsOf(chip, pools?.[chip] || []);
    content = <div className="min-w-0 flex-1 px-4 pb-16 sm:px-6">
      <div role="group" aria-label="Topics" className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-20 -mx-1 flex items-center gap-3 overflow-x-auto bg-white px-1 py-3 [scrollbar-width:none]">
        <button onClick={() => setChip("all")} aria-pressed={chip === "all"} className={chipCls(chip === "all")}>All</button>
        <button onClick={() => go({ kind: "radio" })} className={`${chipCls(false)} inline-flex items-center gap-1.5`}><RadioIcon size={15} />Radio</button>
        <button onClick={() => go({ kind: "party", id: "new" })} className={`${chipCls(false)} inline-flex items-center gap-1.5`}><Users size={15} />Listen together</button>
        <button onClick={() => onOpenFeed(undefined, "openmic")} className={`${chipCls(false)} inline-flex items-center gap-1.5`}><Mic size={15} />Open Mic</button>
        <button onClick={() => onOpenFeed(undefined, "social")} className={`${chipCls(false)} inline-flex items-center gap-1.5`}><MessageCircle size={15} />Social</button>
        <button onClick={() => onOpenFeed(undefined, "library")} className={`${chipCls(false)} inline-flex items-center gap-1.5`}><Library size={15} />Library</button>
        {topics.map((t) => {
          const on = chip === `t:${t}`;
          return <span key={t} className="flex shrink-0 items-center">
            <button onClick={() => setChip(`t:${t}`)} aria-pressed={on} className={`${chipCls(on)} ${on ? "rounded-r-none pr-2" : ""}`}>{t}</button>
            {on && <button onClick={() => { setTopics(topics.filter((x) => x !== t)); setChip("all"); }} aria-label={`Remove ${t}`} className="inline-flex h-8 w-7 items-center justify-center rounded-r-lg bg-[#0f0f0f] text-white/70 hover:text-white"><X size={14} /></button>}
          </span>;
        })}
        {adding
          ? <form onSubmit={(e) => { e.preventDefault(); addTopic(); }} className="flex shrink-0 items-center gap-1">
            <label htmlFor="ps-topic" className="sr-only">New topic</label>
            <input id="ps-topic" autoFocus value={newTopic} onChange={(e) => setNewTopic(e.target.value)} onBlur={() => { if (!newTopic.trim()) setAdding(false); }} placeholder="Anyone or anything" maxLength={40} className="h-8 w-44 rounded-lg border border-[#d3d3d3] px-3 text-sm outline-none focus:border-[#1c62b9]" />
            <button type="submit" className="h-8 rounded-lg bg-[#0f0f0f] px-3 text-sm font-semibold text-white">Add</button>
          </form>
          : <button onClick={() => setAdding(true)} className="h-8 shrink-0 whitespace-nowrap rounded-lg border border-dashed border-[#c4c4c4] px-3 text-sm font-medium hover:bg-[#f2f2f2]">+ Your topic</button>}
        {chipGenres.map((g) => <button key={g} onClick={() => setChip(g)} aria-pressed={chip === g} className={chipCls(chip === g)}>{GENRE[g].name}</button>)}
        <button onClick={onEditInterests} className="h-8 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium text-[#065fd4] hover:bg-[#def1ff]">Your interests</button>
      </div>

      {chip === "all" && <section aria-label="Live now" className="mb-5 mt-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold"><span className={`h-2 w-2 rounded-full bg-[#ff3b30] ${live.length ? "motion-safe:animate-pulse" : "opacity-40"}`} />Live now</h2>
          <button onClick={() => setGoLive(true)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e5e5e5] px-3 text-sm font-medium hover:bg-[#f2f2f2]"><Mic size={15} />Go live</button>
        </div>
        {live.length
          ? <div className="mt-3 flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
            {live.map((l) => <button key={l.id} onClick={() => openLive(l.id)} className="flex w-[220px] shrink-0 items-center gap-3 rounded-xl bg-[#fff4ee] p-3 text-left hover:bg-[#ffe9dc]">
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-xl ring-2 ring-[#ff3b30]">{l.host.avatar || l.host.name.slice(0, 1)}<span className="absolute -bottom-1.5 rounded bg-[#ff3b30] px-1 text-[9px] font-bold text-white">LIVE</span></span>
              <span className="flex min-w-0 flex-col">
                <span className="line-clamp-2 text-sm font-semibold leading-snug">{l.title}</span>
                <span className="truncate text-xs text-[#606060]">@{l.host.handle} · {l.listeners} listening</span>
              </span>
            </button>)}
          </div>
          : <p className="mt-1 text-sm text-[#606060]">No one's live right now. Audio only, so you can go live from anywhere, camera off.</p>}
      </section>}

      {!topic && chip !== "all" && <TopShows shows={topShows} onShow={openShowLatest} label={`Top in ${GENRE[chip]?.name ?? ""}`} note="Everything below stays unranked." />}

      {chip === "all" && <ModesRow es={es} onOpen={(m) => go({ kind: "mode", id: m.id })} onNew={() => setNewMode(true)} />}

      {chip === "all" && !whyHidden && <section aria-label="Why Pod+" className="ps-keep relative mb-6 mt-1 flex h-11 items-center overflow-hidden rounded-full bg-[#0f0f0f] text-white ring-1 ring-white/10">
        <style>{"@keyframes ps-tick{from{transform:translateX(0)}to{transform:translateX(-50%)}}.ps-tick{animation:ps-tick 70s linear infinite}.ps-strip:hover .ps-tick,.ps-strip:active .ps-tick,.ps-strip:focus-within .ps-tick{animation-play-state:paused}@media (prefers-reduced-motion:reduce){.ps-tick{animation:none}}"}</style>
        <span className="ps-keep z-10 flex h-full shrink-0 items-center bg-[#0f0f0f] pl-4 pr-3 text-[13px] font-semibold text-[#ff8a3d]">Phone down. Podcast on.</span>
        <div className="ps-strip relative h-full min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_24px,#000_calc(100%-24px),transparent)]">
          <p className="sr-only">{WHY.map((w) => `${w.h} ${w.p}`).join(" ")}</p>
          <div aria-hidden="true" className="ps-tick flex h-full w-max items-center whitespace-nowrap">
            {[0, 1].map((k) => <span key={k} className="flex items-center">
              {WHY.map((w) => <span key={w.h} className="flex items-center pr-8 text-[13px]"><b className="font-semibold">{w.h}</b><span className="ml-1.5 text-white/70">{w.p}</span><span className="ml-8 h-1 w-1 rounded-full bg-white/30" /></span>)}
            </span>)}
          </div>
        </div>
        <button onClick={() => { setWhyHidden(true); writeLs("podscroll.why", "hidden"); }} aria-label="Hide this" className="ps-keep z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center bg-[#0f0f0f] text-white/60 hover:text-white"><X size={16} /></button>
      </section>}

      {topic ? <TopicResults key={topic} topic={topic} api={api} ex={ex} onOpen={openEp} />
        : err ? <div className="py-20 text-center"><p className="text-[#606060]">{err}</p><button onClick={load} className="mt-4 h-9 rounded-full bg-[#0f0f0f] px-4 text-sm font-semibold text-white">Try again</button></div>
        : !pools || more === "loading" ? <Skeleton />
        : more === "error" ? <p className="py-20 text-center text-[#606060]">Couldn't load {GENRE[chip]?.name}. Try again in a moment.</p>
        : shown.length ? <><Grid list={shown} onOpen={openEp} />{chip === "all" && <div ref={moreRef} className="flex justify-center py-10" aria-hidden="true"><Loader2 className="animate-spin text-[#606060]" size={22} /></div>}</>
        : <p className="py-20 text-center text-[#606060]">Nothing here yet. Try another topic.</p>}
    </div>;
  }

  return <MoreCtx.Provider value={setAddTo}><div className={`min-h-full bg-white text-[#0f0f0f] [&_input]:text-[#0f0f0f] [&_input::placeholder]:text-[#767676] ${dark ? "ps-dark [color-scheme:dark]" : "[color-scheme:light]"} [font-family:Roboto,Inter,ui-sans-serif,system-ui,-apple-system,'Segoe_UI',sans-serif]`}>
    {dark && <style>{DARK_CSS}</style>}
    {header}
    <div className={`flex items-start ${station ? "pb-20" : ""}`}>{sidebar}<main className="min-w-0 flex-1">{content}</main></div>
    {station && <RadioBar station={station} onStop={stopRadio} say={say} />}
    {askTopics && view.kind === "home" && <TopicsPrompt onDone={doneAsking} />}
    {addTo && <AddToMenu es={es} ep={addTo} update={update} say={say} onClose={() => setAddTo(null)} />}
    {newMode && <NewModeDialog onClose={() => setNewMode(false)} onMake={(name) => { const id = makeMode(update, name); setNewMode(false); go({ kind: "mode", id }); }} />}
    {goLive && <GoLiveSheet api={api} say={(m) => { say(m); if (/sign in|profile|account/i.test(m)) { setGoLive(false); onJoin(); } }} onClose={() => setGoLive(false)} onStarted={(id, ticket) => { setGoLive(false); setStation(null); setLiveRoom({ id, ticket }); }} />}
    {liveRoom && <LiveRoom key={liveRoom.id} api={api} say={say} roomId={liveRoom.id} ticket={liveRoom.ticket} wsBase={liveBase}
      onClose={() => { setLiveRoom(null); api("/api/earshot/creators/live").then((b) => setLive(b.live || [])).catch(() => {}); }} />}
  </div></MoreCtx.Provider>;
}

/** A 16:9 picture made from a square cover: the cover sits in the middle over a blurred copy of itself. */
function Thumb({ e, small }: { e: PodEpisode; small?: boolean }) {
  const art = hiRes(e.art, small ? 300 : 400);
  return <div className={`relative aspect-video w-full overflow-hidden bg-[#e5e5e5] ${small ? "rounded-lg" : "rounded-[10px] transition-[border-radius] duration-200 group-hover:rounded-md"}`}>
    {art && <img src={art} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 h-full w-full scale-125 object-cover blur-2xl" />}
    <div className="absolute inset-0 bg-black/15" />
    {art && <img src={art} alt="" loading="lazy" className="absolute left-1/2 top-1/2 h-[82%] -translate-x-1/2 -translate-y-1/2 rounded-md object-cover shadow-[0_8px_30px_rgba(0,0,0,.35)]" style={{ aspectRatio: "1 / 1" }} />}
    {e.secs > 0 && <span className={`absolute rounded bg-black/80 px-1 py-px text-[11px] font-medium text-white ${small ? "bottom-1 right-1" : "bottom-1.5 right-1.5"}`}>{fmtTime(e.secs)}</span>}
  </div>;
}

/** Opens "Add to" for an episode (Listen later, Pod Modes); set once for the whole home page. */
const MoreCtx = createContext<((e: PodEpisode) => void) | null>(null);

function Grid({ list, onOpen }: { list: PodEpisode[]; onOpen: (e: PodEpisode) => void }) {
  const onMore = useContext(MoreCtx);
  return <div className="grid gap-x-3.5 gap-y-7 pt-3 [grid-template-columns:repeat(auto-fill,minmax(min(180px,calc(50%_-_7px)),1fr))]">
    {list.map((e) => <Card key={e.id} e={e} onOpen={onOpen} onMore={onMore} />)}
  </div>;
}

/** An episode card: tap to listen; tap ⋮, or press and hold, to add it to a Pod Mode. */
function Card({ e, onOpen, onMore }: { e: PodEpisode; onOpen: (e: PodEpisode) => void; onMore: ((e: PodEpisode) => void) | null }) {
  const hold = useRef<{ t: ReturnType<typeof setTimeout> | null; x: number; y: number; fired: boolean }>({ t: null, x: 0, y: 0, fired: false });
  const cancel = () => { if (hold.current.t) clearTimeout(hold.current.t); hold.current.t = null; };
  return <div className="group relative min-w-0 select-none [-webkit-touch-callout:none]">
    <button
      onClick={() => { if (hold.current.fired) { hold.current.fired = false; return; } onOpen(e); }}
      onPointerDown={(ev) => { if (!onMore || ev.button !== 0) return; hold.current.fired = false; hold.current.x = ev.clientX; hold.current.y = ev.clientY; cancel(); hold.current.t = setTimeout(() => { hold.current.fired = true; hold.current.t = null; try { navigator.vibrate?.(12); } catch { /* no vibration */ } onMore(e); }, 480); }}
      onPointerMove={(ev) => { if (hold.current.t && Math.hypot(ev.clientX - hold.current.x, ev.clientY - hold.current.y) > 10) cancel(); }}
      onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
      onContextMenu={(ev) => { if (onMore) { ev.preventDefault(); if (!hold.current.fired) { cancel(); hold.current.fired = true; onMore(e); } } }}
      className="flex w-full min-w-0 flex-col gap-2 rounded-[10px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1c62b9] focus-visible:ring-offset-4">
      <Thumb e={e} />
      <div className="flex gap-2.5 pr-7">
        <img src={hiRes(e.art, 60)} alt="" draggable={false} className="h-7 w-7 shrink-0 rounded-full bg-[#e5e5e5] object-cover" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="line-clamp-2 text-sm font-semibold leading-snug">{e.title}</span>
          <span className="truncate text-xs text-[#606060]">{e.show}</span>
          <span className="text-xs text-[#606060]">{ago(e.date)}</span>
        </div>
      </div>
    </button>
    {onMore && <button onClick={() => onMore(e)} aria-label={`Add “${e.title}” to a Pod Mode`} className="absolute right-[-6px] top-[calc(56.25%+4px)] inline-flex h-9 w-9 items-center justify-center rounded-full text-[#0f0f0f] hover:bg-[#f2f2f2] sm:opacity-70 sm:group-hover:opacity-100"><MoreVertical size={18} /></button>}
  </div>;
}

/** First visit: pick two or more topics for the feed, or skip and start from what's popular. */
function TopicsPrompt({ onDone }: { onDone: (picked: string[] | null) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (g: string) => setPicked((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]));
  return <div role="dialog" aria-modal="true" aria-labelledby="ps-topics-title" className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 px-3 pb-3 sm:items-center">
    <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white text-[#0f0f0f] shadow-2xl">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 id="ps-topics-title" className="text-xl font-bold tracking-tight">What are you into?</h2>
          <p className="mt-1 text-sm text-[#606060]">Pick two or more. Your feed starts there and keeps learning from what you play.</p>
        </div>
        <button onClick={() => onDone(null)} aria-label="Skip" className="-mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-[#f2f2f2]"><X size={20} /></button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 overflow-y-auto px-5 pb-4">
        {GENRES.filter((g) => g.id !== "kids").map((g) => { const on = picked.includes(g.id); return <button key={g.id} onClick={() => toggle(g.id)} aria-pressed={on} className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium ${on ? "bg-[#0f0f0f] text-white" : "bg-[#f2f2f2] hover:bg-[#e5e5e5]"}`}>{on && <Check size={15} />}{g.name}</button>; })}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[#ececec] px-5 py-4">
        <button onClick={() => onDone(null)} className="h-11 rounded-full px-4 text-sm font-medium text-[#606060] hover:bg-[#f2f2f2]">Skip for now</button>
        <button onClick={() => onDone(picked)} disabled={picked.length < 2} className="h-11 rounded-full bg-[#0f0f0f] px-6 text-sm font-semibold text-white disabled:opacity-40">{picked.length < 2 ? `Pick ${2 - picked.length} more` : "Start my feed"}</button>
      </div>
    </div>
  </div>;
}

const byRank = (list: PoolShow[]): PodShow[] => list.slice().sort((a, b) => a.rank - b.rank).map((p) => p.show).slice(0, 16);

/** Big round show covers: the most popular shows for a genre or topic. */
function TopShows({ shows, onShow, label, note }: { shows: PodShow[]; onShow: (s: PodShow) => void; label: string; note: string }) {
  if (!shows.length) return null;
  return <section aria-label={label} className="mb-6 mt-4">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 className="text-base font-semibold">{label}</h2>
      <span className="text-xs text-[#606060]">{note}</span>
    </div>
    <div className="-mx-1 mt-3 flex gap-5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {shows.map((sh, i) => <button key={sh.id} onClick={() => onShow(sh)} className="flex w-[96px] shrink-0 flex-col items-center gap-2 text-center sm:w-[112px]">
        <span className="relative">
          <img src={hiRes(sh.art, 240)} alt="" loading="lazy" className="h-[96px] w-[96px] rounded-full bg-[#f2f2f2] object-cover sm:h-[112px] sm:w-[112px]" />
          <span className="absolute -bottom-1 -left-1 grid h-7 min-w-7 place-items-center rounded-full bg-[#0f0f0f] px-1.5 text-xs font-bold text-white ring-2 ring-white">{i + 1}</span>
        </span>
        <span className="line-clamp-2 text-[13px] font-semibold leading-snug">{sh.name}</span>
      </button>)}
    </div>
  </section>;
}

function Skeleton() {
  return <div className="grid gap-x-3.5 gap-y-7 pt-3 [grid-template-columns:repeat(auto-fill,minmax(min(180px,calc(50%_-_7px)),1fr))]" aria-label="Loading" role="status">
    {Array.from({ length: 18 }, (_, i) => <div key={i} className="flex flex-col gap-2 motion-safe:animate-pulse">
      <div className="aspect-video rounded-[10px] bg-[#f2f2f2]" />
      <div className="flex gap-2.5"><div className="h-7 w-7 rounded-full bg-[#f2f2f2]" /><div className="flex flex-1 flex-col gap-2"><div className="h-4 w-11/12 rounded bg-[#f2f2f2]" /><div className="h-4 w-2/3 rounded bg-[#f2f2f2]" /></div></div>
    </div>)}
  </div>;
}

function SearchResults({ q, api, ex, onOpen }: { q: string; api: Api; ex: string; onOpen: (e: PodEpisode) => void }) {
  const [res, setRes] = useState<{ shows: PodShow[]; episodes: PodEpisode[] } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api(`/api/earshot/search?q=${encodeURIComponent(q)}${ex}`).then((b) => setRes({ shows: b.shows || [], episodes: b.episodes || [] })).catch((e) => setErr(e.message)); }, [api, q, ex]);
  const openShow = (s: PodShow) => api(`/api/earshot/show/${s.id}?x=1${ex}`).then((b) => { const e = (b.episodes || [])[0]; if (e) onOpen(e); }).catch((e) => setErr(e.message));
  return <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-4 sm:px-6">
    <h1 className="mb-4 text-xl font-semibold">Results for “{q}”</h1>
    {err ? <p className="text-[#606060]">{err}</p> : !res ? <Skeleton /> : <>
      {res.shows.length > 0 && <section aria-label="Shows" className="mb-8">
        <div className="flex gap-6 overflow-x-auto pb-2 [scrollbar-width:none]">
          {res.shows.slice(0, 12).map((s) => <button key={s.id} onClick={() => openShow(s)} className="flex w-[120px] shrink-0 flex-col items-center gap-2 text-center">
            <img src={hiRes(s.art, 240)} alt="" className="h-[120px] w-[120px] rounded-full bg-[#f2f2f2] object-cover" />
            <span className="line-clamp-2 text-sm font-semibold">{s.name}</span>
            <span className="line-clamp-1 text-xs text-[#606060]">{s.author}</span>
          </button>)}
        </div>
      </section>}
      {res.episodes.length ? <Grid list={res.episodes} onOpen={onOpen} /> : !res.shows.length && <p className="text-[#606060]">No podcasts found. Try different words.</p>}
    </>}
  </div>;
}

/** A topic tab: every episode that mentions it, newest first, from any show however small. */
function TopicResults({ topic, api, ex, onOpen }: { topic: string; api: Api; ex: string; onOpen: (e: PodEpisode) => void }) {
  const [list, setList] = useState<PodEpisode[] | null>(null);
  const [shows, setShows] = useState<PodShow[]>([]);
  const [top, setTop] = useState<PodShow[]>([]);
  useEffect(() => { api(`/api/earshot/top?q=${encodeURIComponent(topic)}`).then((b) => setTop(b.shows || [])).catch(() => setTop([])); }, [api, topic]);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    api(`/api/earshot/search?q=${encodeURIComponent(topic)}${ex}`).then(async (b) => {
      const eps: PodEpisode[] = b.episodes || [];
      const found: PodShow[] = b.shows || [];
      // Shows named for the topic: their latest episodes count too.
      const named = found.filter((s) => s.name.toLowerCase().includes(topic.toLowerCase())).slice(0, 2);
      const extra = await Promise.all(named.map((s) => api(`/api/earshot/show/${s.id}?x=1${ex}`).then((r) => (r.episodes || []).slice(0, 6).map((e: PodEpisode) => ({ ...e, art: e.art || s.art }))).catch(() => [])));
      const seen = new Set<string>(); const out: PodEpisode[] = [];
      for (const e of [...eps, ...extra.flat()]) if (!seen.has(e.id)) { seen.add(e.id); out.push(e); }
      out.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
      if (live) { setList(out); setShows(found.slice(0, 12)); }
    }).catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [api, topic, ex]);
  const openShow = (s: PodShow) => api(`/api/earshot/show/${s.id}?x=1${ex}`).then((b) => { const e = (b.episodes || [])[0]; if (e) onOpen(e); }).catch((e) => setErr(e.message));
  return <div className="pt-2">
    <h2 className="text-xl font-bold tracking-tight">{topic}</h2>
    <p className="mt-1 text-sm text-[#606060]">Every episode we can find that mentions it, newest first. Big show or brand new, same shelf.</p>
    {err ? <p className="py-16 text-center text-[#606060]">{err}</p> : !list ? <div className="mt-4"><Skeleton /></div> : <>
      <TopShows shows={top} onShow={openShow} label={`Top shows covering ${topic}`} note="Everything below stays unranked." />
      {list.length ? <div className="mt-2"><p className="mb-1 text-[12px] font-semibold uppercase tracking-[.14em] text-[#767676]">Every episode, newest first</p><Grid list={list} onOpen={onOpen} /></div> : <p className="py-16 text-center text-[#606060]">Nothing mentions “{topic}” yet. Try a different spelling.</p>}
    </>}
  </div>;
}
