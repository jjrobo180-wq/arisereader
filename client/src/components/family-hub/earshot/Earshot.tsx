// Earshot (a LifeHub App Store app): real podcasts in a feed you swipe like short videos.
// Shows, episodes and artwork come from Apple Podcasts through the server (server/earshot.ts); audio
// plays straight from each podcast's host. The ranking, parsing and saved-data rules live in
// shared/earshot.ts. What someone picked, follows, likes and saves is kept in family.earshot.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Bookmark, Check, ExternalLink, Flag, Heart, Loader2, Maximize2, MessageCircle, Minimize2, Pause, Play, Plus, RotateCcw, RotateCw, Search, Settings2, Share2, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import {
  GENRES, GENRE, SPEEDS, applySignal, chooseEpisode, clock, compact, durationWords, introSkip, pickNext, shareText, tasteOf, emptyEarshot,
  type Candidate, type Earshot as EarshotData, type PodEpisode, type PodShow, type SavedEpisode, type Signal,
} from "@shared/earshot";
import type { SectionProps } from "../ui";

type Counts = { likes: number; comments: number; shares: number; liked: boolean };
type Comment = { id: string; author: string; body: string; at: string; mine: boolean };
type Item = { key: string; show: PodShow; why: string; ep: PodEpisode | null; state: "loading" | "ready" | "none" };
type Tab = "foryou" | "following" | "explore" | "library";

const ACCENT = "#ff8a3d";
const nowIso = () => new Date().toISOString();
const savedOf = (ep: PodEpisode): SavedEpisode => ({ id: ep.id, showId: ep.showId, title: ep.title, show: ep.show, art: ep.art, secs: ep.secs, at: nowIso() });
const agoWords = (iso: string) => {
  const d = (Date.now() - Date.parse(iso)) / 1000;
  if (!Number.isFinite(d)) return "";
  if (d < 3600) return `${Math.max(1, Math.floor(d / 60))}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  if (d < 86400 * 30) return `${Math.floor(d / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export default function Earshot({ family, setFamily, say }: SectionProps) {
  const { token, user } = useAuth();
  const student = user?.role === "student";
  const es: EarshotData = family.earshot ?? emptyEarshot();
  const esRef = useRef(es); esRef.current = es;
  const update = useCallback((fn: (e: EarshotData) => EarshotData) => setFamily((f) => ({ ...f, earshot: fn(f.earshot ?? emptyEarshot()) })), [setFamily]);
  const explicit = !student && es.settings.explicit;

  const api = useCallback(async (path: string, init?: { method?: string; body?: unknown }) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: { ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body?.message || "Something went wrong. Try again."), { status: res.status });
    return body;
  }, [token]);

  // ---------------- taste signals, saved in small batches ----------------
  const pending = useRef<{ genre: string; signal: Signal }[]>([]);
  const flushT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => {
    if (flushT.current) { clearTimeout(flushT.current); flushT.current = null; }
    const list = pending.current; pending.current = [];
    if (list.length) update((e) => list.reduce((acc, s) => applySignal(acc, s.genre, s.signal), e));
  }, [update]);
  const signal = useCallback((genre: string, s: Signal) => {
    pending.current.push({ genre, signal: s });
    if (!flushT.current) flushT.current = setTimeout(flush, 5000);
  }, [flush]);
  useEffect(() => () => flush(), [flush]);

  // ---------------- setup ----------------
  const [editing, setEditing] = useState(false);
  if (!es.setupDone || editing) {
    return <Setup initial={es} student={student} onDone={(genres, pace) => {
      update((e) => {
        const taste = { ...e.taste };
        for (const g of genres) taste[g] = Math.max(taste[g] ?? 0, 3);
        for (const g of e.genres) if (!genres.includes(g)) taste[g] = Math.min(taste[g] ?? 0.3, 0.6);
        return { ...e, setupDone: true, genres, pace, taste };
      });
      setEditing(false);
      say("Your feed is ready. Tap a cover to listen, swipe up for the next one.");
    }} onCancel={es.setupDone ? () => setEditing(false) : undefined} />;
  }
  return <Player es={es} esRef={esRef} update={update} api={api} signal={signal} say={say} student={student} explicit={explicit} onEditInterests={() => setEditing(true)} />;
}

// ===========================================================================
// Setup: pick genres and pace
// ===========================================================================
function Setup({ initial, student, onDone, onCancel }: { initial: EarshotData; student: boolean; onDone: (genres: string[], pace: EarshotData["pace"]) => void; onCancel?: () => void }) {
  const [picked, setPicked] = useState<string[]>(initial.genres);
  const [pace, setPace] = useState(initial.pace);
  const list = GENRES.filter((g) => !student || g.kidSafe);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return <div className="mx-auto max-w-3xl rounded-3xl bg-[#15121b] p-5 text-white shadow-xl sm:p-8">
    <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.2em]" style={{ color: ACCENT }}><span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />Earshot · real podcasts</p>
    <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">What do you want in your ears?</h1>
    <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">Pick at least three genres. Every show is a real podcast from Apple Podcasts, and the feed learns from every like, skip, save and share.{student ? " Student accounts only get clean podcasts." : ""}</p>
    <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {list.map((g) => {
        const on = picked.includes(g.id);
        return <button key={g.id} type="button" onClick={() => toggle(g.id)} aria-pressed={on}
          className={`flex min-h-14 items-center gap-3 rounded-2xl px-3 text-left text-sm font-bold ring-2 transition ${on ? "bg-white/10 ring-[#ff8a3d]" : "bg-white/5 ring-transparent hover:bg-white/10"}`}>
          <span className="grid h-9 w-9 flex-none place-items-center rounded-xl text-xs font-black" style={{ background: g.color }}>{on ? <Check size={18} /> : g.name.slice(0, 1)}</span>
          <span className="leading-tight">{g.name}</span>
        </button>;
      })}
    </div>
    <p className="mt-6 text-xs font-extrabold uppercase tracking-[.16em] text-white/45">How long do you like to listen?</p>
    <div className="mt-2 grid grid-cols-3 gap-2">
      {([["short", "Quick hits", "under 25 min"], ["mix", "Mix it up", "any length"], ["deep", "Deep dives", "45 min +"]] as const).map(([v, label, sub]) =>
        <button key={v} type="button" onClick={() => setPace(v)} aria-pressed={pace === v} className={`rounded-2xl px-2 py-3 text-sm font-bold ring-2 ${pace === v ? "bg-white/10 ring-[#ff8a3d]" : "bg-white/5 ring-transparent"}`}>{label}<span className="block text-xs font-medium text-white/55">{sub}</span></button>)}
    </div>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-white/60">{picked.length < 3 ? `Pick ${3 - picked.length} more` : `${picked.length} genres picked`}</span>
      <div className="flex gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="min-h-11 rounded-full bg-white/10 px-5 font-bold">Cancel</button>}
        <button type="button" disabled={picked.length < 3} onClick={() => onDone(picked, pace)} className="min-h-11 rounded-full px-6 font-black text-[#24160a] disabled:opacity-40" style={{ background: ACCENT }}>Start listening</button>
      </div>
    </div>
  </div>;
}

// ===========================================================================
// The player: feed, explore, library
// ===========================================================================
type PlayerProps = {
  es: EarshotData; esRef: { current: EarshotData }; update: (fn: (e: EarshotData) => EarshotData) => void;
  api: (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
  signal: (genre: string, s: Signal) => void; say: (m: string) => void; student: boolean; explicit: boolean; onEditInterests: () => void;
};

function Player({ es, esRef, update, api, signal, say, student, explicit, onEditInterests }: PlayerProps) {
  const [tab, setTab] = useState<Tab>("foryou");
  const [genreMode, setGenreMode] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const itemsRef = useRef(items); itemsRef.current = items;
  const [active, setActive] = useState(0);
  const activeRef = useRef(0); activeRef.current = active;
  const [unlocked, setUnlocked] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [commentsOn, setCommentsOn] = useState(!student);
  const [sheet, setSheet] = useState<null | { kind: "comments"; ep: PodEpisode } | { kind: "show"; show: PodShow } | { kind: "settings" }>(null);
  const [poolTick, setPoolTick] = useState(0);
  const [loadError, setLoadError] = useState("");
  const pools = useRef<Map<string, PodShow[]>>(new Map());
  const episodesCache = useRef<Map<string, Promise<{ show: PodShow | null; episodes: PodEpisode[] }>>>(new Map());
  const audio = useRef<HTMLAudioElement | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const listened = useRef(0);
  const lastTime = useRef(0);
  const counted = useRef<Set<string>>(new Set());
  const mode = tab === "following" ? "following" : genreMode ? `genre:${genreMode}` : "foryou";
  const ex = explicit ? "&explicit=1" : "";

  const loadEpisodes = useCallback((showId: string) => {
    let p = episodesCache.current.get(showId);
    if (!p) {
      p = api(`/api/earshot/show/${showId}?x=1${ex}`).then((b) => ({ show: b.show ?? null, episodes: Array.isArray(b.episodes) ? b.episodes : [] }));
      p.catch(() => episodesCache.current.delete(showId));
      episodesCache.current.set(showId, p);
    }
    return p;
  }, [api, ex]);

  const loadGenre = useCallback(async (id: string) => {
    if (pools.current.has(id)) return pools.current.get(id)!;
    const b = await api(`/api/earshot/genre/${id}?x=1${ex}`);
    const shows: PodShow[] = Array.isArray(b.shows) ? b.shows : [];
    pools.current.set(id, shows);
    setPoolTick((t) => t + 1);
    return shows;
  }, [api, ex]);

  // Load the genre pools for the feed: picked genres first, then the ones they've warmed to.
  useEffect(() => {
    let stop = false;
    const genres = Array.from(new Set([...es.genres, ...GENRES.map((g) => g.id).filter((g) => tasteOf(es, g) >= 4)])).filter((g) => !student || GENRE[g]?.kidSafe).slice(0, 10);
    (async () => {
      let ok = 0;
      for (const g of genres) {
        if (stop) return;
        try { await loadGenre(g); ok++; setLoadError(""); } catch (e: any) { if (!ok) setLoadError(e?.message || "Apple Podcasts can't be reached right now."); }
      }
    })();
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [es.genres.join(","), student, explicit]);

  const candidates = useCallback((): Candidate[] => {
    if (mode === "following") return esRef.current.follows.map((f, i) => ({ rank: i, show: { id: f.id, name: f.name, author: f.author, art: f.art, genre: f.genre, appleGenre: "", link: "", episodes: 0, explicit: false, latest: "" } }));
    if (mode.startsWith("genre:")) return (pools.current.get(mode.slice(6)) ?? []).map((show, rank) => ({ show, rank }));
    const out: Candidate[] = []; const seen = new Set<string>();
    pools.current.forEach((shows) => shows.forEach((show, rank) => { if (!seen.has(show.id)) { seen.add(show.id); out.push({ show, rank }); } }));
    return out;
  }, [mode, esRef]);

  const fill = useCallback((item: Item) => {
    loadEpisodes(item.show.id).then(({ episodes }) => {
      const ep = chooseEpisode(esRef.current, episodes);
      setItems((list) => list.map((x) => (x.key === item.key ? { ...x, ep, state: ep ? "ready" : "none" } : x)));
    }).catch(() => setItems((list) => list.map((x) => (x.key === item.key ? { ...x, state: "none" } : x))));
  }, [loadEpisodes, esRef]);

  const extend = useCallback((n: number) => {
    const list = itemsRef.current;
    const picks = pickNext(esRef.current, candidates(), { recentShows: list.slice(-5).map((x) => x.show.id), shownShows: list.map((x) => x.show.id), follows: esRef.current.follows.map((f) => f.id) }, n);
    if (!picks.length) return;
    const added: Item[] = picks.map((p) => ({ key: `${p.show.id}-${Math.random().toString(36).slice(2, 7)}`, show: p.show, why: mode === "following" ? "A show you follow" : p.why, ep: null, state: "loading" }));
    setItems((cur) => [...cur, ...added]);
    added.forEach(fill);
  }, [candidates, fill, mode, esRef]);

  // Reset the feed when the mode changes; start it once there's something to pick from.
  useEffect(() => {
    if (tab === "explore" || tab === "library") return;
    stopAudio();
    setItems([]); itemsRef.current = []; setActive(0); activeRef.current = 0;
    if (feedRef.current) feedRef.current.scrollTop = 0;
    if (genreMode) loadGenre(genreMode).then(() => extend(5)).catch((e) => say(e?.message || "That genre didn't load."));
    else extend(5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  useEffect(() => { if (!itemsRef.current.length && (tab === "foryou" || tab === "following")) extend(5); }, [poolTick, extend, tab]);

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

  // Which card is on screen.
  useEffect(() => {
    const root = feedRef.current; if (!root) return;
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting && en.intersectionRatio > 0.6) setActive(Number((en.target as HTMLElement).dataset.i));
    }, { root, threshold: [0.6] });
    root.querySelectorAll("[data-i]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items.length, tab, full]);

  // ---------------- audio ----------------
  function stopAudio() { const a = audio.current; if (a) { a.pause(); } setPlaying(false); }
  const leave = useCallback((i: number) => {
    const it = itemsRef.current[i]; if (!it?.ep || !unlocked) return;
    const secs = listened.current;
    if (secs < 3) { signal(it.show.genre, "skip"); update((e) => ({ ...e, skipped: [it.show.id, ...e.skipped].slice(0, 80) })); }
    else if (secs >= 30) { signal(it.show.genre, "listen"); const id = it.ep.id; update((e) => (e.heard.includes(id) ? e : { ...e, heard: [id, ...e.heard].slice(0, 200) })); }
  }, [unlocked, signal, update]);

  const playItem = useCallback((i: number) => {
    const a = audio.current; const it = itemsRef.current[i];
    if (!a || !it?.ep) return;
    const ep = it.ep;
    if (a.dataset.ep !== ep.id) {
      a.src = ep.audio; a.dataset.ep = ep.id; listened.current = 0; lastTime.current = 0; setTime(0); setDur(ep.secs || 0);
      const start = introSkip(ep.secs, esRef.current.settings.skipIntro);
      if (start) a.addEventListener("loadedmetadata", () => { try { a.currentTime = start; } catch { /* the host doesn't allow seeking */ } }, { once: true });
    }
    a.playbackRate = esRef.current.settings.speed;
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: ep.title, artist: ep.show, album: "Earshot", artwork: ep.art ? [{ src: ep.art, sizes: "600x600" }] : [] });
        navigator.mediaSession.setActionHandler("nexttrack", () => goTo(activeRef.current + 1));
        navigator.mediaSession.setActionHandler("previoustrack", () => goTo(activeRef.current - 1));
      } catch { /* not supported */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esRef]);

  const prevActive = useRef(0);
  useEffect(() => {
    if (prevActive.current !== active) { leave(prevActive.current); prevActive.current = active; }
    if (active >= items.length - 3) extend(4);
    stopAudio();
    if (unlocked && items[active]?.ep) playItem(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  // When the active card's episode arrives after we got there, start it.
  const activeEpId = items[active]?.ep?.id;
  useEffect(() => { if (unlocked && activeEpId && audio.current?.dataset.ep !== activeEpId) playItem(active); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeEpId]);
  useEffect(() => { if (audio.current) audio.current.playbackRate = es.settings.speed; }, [es.settings.speed]);
  useEffect(() => { if (tab === "explore" || tab === "library") stopAudio(); }, [tab]);
  useEffect(() => () => { audio.current?.pause(); }, []);

  const goTo = (i: number) => {
    const root = feedRef.current; if (!root) return;
    const el = root.querySelector(`[data-i="${Math.max(0, i)}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  const toggle = () => {
    const a = audio.current; if (!a) return;
    if (!unlocked) { setUnlocked(true); playItem(active); return; }
    if (a.paused || a.dataset.ep !== items[active]?.ep?.id) playItem(active); else { a.pause(); setPlaying(false); }
  };
  const seekBy = (d: number) => { const a = audio.current; if (a && a.dataset.ep) a.currentTime = Math.max(0, Math.min((a.duration || dur) - 1, a.currentTime + d)); };

  const onTime = () => {
    const a = audio.current; if (!a) return;
    const t = a.currentTime; const delta = t - lastTime.current; lastTime.current = t;
    if (delta > 0 && delta < 2) listened.current += delta;
    setTime(t); if (a.duration && Number.isFinite(a.duration)) setDur(a.duration);
    const adv = esRef.current.settings.advance;
    if (adv && listened.current >= adv && !sheet) { listened.current = -1e9; goTo(activeRef.current + 1); }
  };
  const onEnded = () => {
    const it = itemsRef.current[activeRef.current];
    if (it?.ep) { signal(it.show.genre, "finish"); const id = it.ep.id; update((e) => (e.heard.includes(id) ? e : { ...e, heard: [id, ...e.heard].slice(0, 200) })); }
    setPlaying(false);
    if (!sheet) goTo(activeRef.current + 1);
  };

  // ---------------- actions ----------------
  const isFollowing = (id: string) => es.follows.some((f) => f.id === id);
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
  };
  const share = async (ep: PodEpisode, genre: string) => {
    const text = shareText(ep);
    let done = false;
    try { if (navigator.share) { await navigator.share({ title: ep.title, text: `“${ep.title}” from ${ep.show}`, url: ep.link || undefined }); done = true; } } catch (e: any) { if (e?.name === "AbortError") return; }
    if (!done) { try { await navigator.clipboard.writeText(text); say("Link copied. Paste it anywhere to share."); done = true; } catch { say(text); } }
    if (done) {
      setCounts((c) => ({ ...c, [ep.id]: { ...(c[ep.id] ?? { likes: 0, comments: 0, shares: 0, liked: false }), shares: (c[ep.id]?.shares ?? 0) + 1 } }));
      signal(genre, "share");
      api("/api/earshot/share", { method: "POST", body: { episodeId: ep.id } }).catch(() => {});
    }
  };
  const playNow = (show: PodShow, ep: PodEpisode) => {
    setSheet(null); setGenreMode(null);
    const item: Item = { key: `${show.id}-${Math.random().toString(36).slice(2, 7)}`, show, why: "You picked this", ep, state: "ready" };
    const at = itemsRef.current.length ? activeRef.current + 1 : 0;
    setUnlocked(true);
    if (tab !== "foryou") setTab("foryou");
    setItems((list) => { const next = [...list]; next.splice(at, 0, item); return next; });
    setTimeout(() => goTo(at), 120);
  };

  // ---------------- layout ----------------
  const shell = full ? "fixed inset-0 z-[60]" : "relative h-[min(84dvh,880px)] min-h-[560px] rounded-3xl";
  const tabs: [Tab, string][] = [["foryou", "For You"], ["following", "Following"], ["explore", "Explore"], ["library", "Library"]];

  return <div className={`${shell} flex flex-col overflow-hidden bg-[#120e14] text-white shadow-2xl`}>
    <audio ref={audio} preload="none" onTimeUpdate={onTime} onEnded={onEnded} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)}
      onError={() => { if (unlocked) say("This episode won't play here. Swipe for the next one, or open it in Apple Podcasts."); }} />
    <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-3 pt-3">
      {genreMode && tab === "foryou"
        ? <span className="flex items-center gap-2 rounded-full bg-black/55 py-1.5 pl-3 pr-1.5 text-sm font-bold backdrop-blur">{GENRE[genreMode]?.name}<button type="button" aria-label="Back to For You" onClick={() => setGenreMode(null)} className="grid h-7 w-7 place-items-center rounded-full bg-white/15"><X size={14} /></button></span>
        : <nav className="flex gap-1 rounded-full bg-black/45 p-1 backdrop-blur" aria-label="Earshot">
          {tabs.map(([t, label]) => <button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t} className={`rounded-full px-3 py-1.5 text-xs font-extrabold sm:text-sm ${tab === t ? "bg-white text-[#120e14]" : "text-white/75"}`}>{label}</button>)}
        </nav>}
      <div className="flex gap-1.5">
        <button type="button" aria-label="Playback settings" onClick={() => setSheet({ kind: "settings" })} className="grid h-9 w-9 place-items-center rounded-full bg-black/45 backdrop-blur"><Settings2 size={18} /></button>
        <button type="button" aria-label={full ? "Exit full screen" : "Full screen"} onClick={() => setFull((f) => !f)} className="grid h-9 w-9 place-items-center rounded-full bg-black/45 backdrop-blur">{full ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
      </div>
    </header>

    {(tab === "foryou" || tab === "following") && <div ref={feedRef} tabIndex={-1}
      onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); goTo(active + 1); } else if (e.key === "ArrowUp") { e.preventDefault(); goTo(active - 1); } else if (e.key === " ") { e.preventDefault(); toggle(); } }}
      className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none] focus:outline-none">
      {!items.length && <FeedEmpty tab={tab} error={loadError} hasFollows={es.follows.length > 0} onExplore={() => setTab("explore")} />}
      {items.map((it, i) => <Card key={it.key} i={i} item={it} active={i === active} playing={playing && i === active} time={i === active ? time : 0} dur={i === active ? dur : it.ep?.secs ?? 0}
        counts={it.ep ? counts[it.ep.id] : undefined} commentsOn={commentsOn} following={isFollowing(it.show.id)} saved={!!it.ep && es.saved.some((x) => x.id === it.ep!.id)} notes={es.settings.notes} unlocked={unlocked}
        onToggle={toggle} onSeek={(t) => { const a = audio.current; if (a && a.dataset.ep) a.currentTime = t; }} onBack={() => seekBy(-15)} onFwd={() => seekBy(30)}
        onLike={() => it.ep && toggleLike(it.ep, it.show.genre)} onDoubleLike={() => it.ep && !counts[it.ep.id]?.liked && toggleLike(it.ep, it.show.genre)}
        onSave={() => it.ep && toggleSave(it.ep, it.show.genre)} onShare={() => it.ep && share(it.ep, it.show.genre)} onFollow={() => toggleFollow(it.show)}
        onComments={() => it.ep && setSheet({ kind: "comments", ep: it.ep })} onShow={() => { setSheet({ kind: "show", show: it.show }); signal(it.show.genre, "open"); }} onNext={() => goTo(i + 1)} />)}
    </div>}

    {tab === "explore" && <Explore api={api} ex={ex} student={student} pools={pools.current} poolTick={poolTick}
      onGenre={(g) => { setGenreMode(g); setTab("foryou"); }} onShow={(show) => setSheet({ kind: "show", show })} onEpisode={playNow} />}
    {tab === "library" && <Library es={es} update={update} onEditInterests={onEditInterests} onOpen={(s) => loadEpisodes(s.showId).then(({ show, episodes }) => { const ep = episodes.find((e) => e.id === s.id); if (show && ep) playNow(show, ep); else say("That episode isn't available anymore."); }).catch((e) => say(e.message))} />}

    {sheet?.kind === "comments" && <Comments ep={sheet.ep} api={api} say={say} onClose={() => setSheet(null)} onPosted={() => { setCounts((c) => ({ ...c, [sheet.ep.id]: { ...(c[sheet.ep.id] ?? { likes: 0, comments: 0, shares: 0, liked: false }), comments: (c[sheet.ep.id]?.comments ?? 0) + 1 } })); const it = items.find((x) => x.ep?.id === sheet.ep.id); if (it) signal(it.show.genre, "comment"); }} />}
    {sheet?.kind === "show" && <ShowSheet show={sheet.show} load={loadEpisodes} following={isFollowing(sheet.show.id)} onFollow={toggleFollow} onPlay={playNow} onClose={() => setSheet(null)} onGenre={(g) => { setSheet(null); setGenreMode(g); setTab("foryou"); }} />}
    {sheet?.kind === "settings" && <SettingsSheet es={es} student={student} update={update} onClose={() => setSheet(null)} />}
  </div>;
}

function FeedEmpty({ tab, error, hasFollows, onExplore }: { tab: Tab; error: string; hasFollows: boolean; onExplore: () => void }) {
  if (tab === "following" && !hasFollows) return <Centered><p className="text-xl font-black">Nothing here yet</p><p className="max-w-xs text-sm text-white/60">Tap the + on any podcast to follow it. New episodes from shows you follow show up here.</p><button type="button" onClick={onExplore} className="mt-2 min-h-11 rounded-full px-5 font-black text-[#24160a]" style={{ background: ACCENT }}>Find shows</button></Centered>;
  if (error) return <Centered><p className="text-lg font-black">Couldn't load podcasts</p><p className="max-w-xs text-sm text-white/60">{error}</p></Centered>;
  return <Centered><Loader2 className="animate-spin" size={36} style={{ color: ACCENT }} /><p className="text-sm font-bold text-white/70">Tuning in to real podcasts…</p></Centered>;
}
const Centered = ({ children }: { children: ReactNode }) => <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">{children}</div>;

// ===========================================================================
// One card in the feed
// ===========================================================================
type CardProps = {
  i: number; item: Item; active: boolean; playing: boolean; time: number; dur: number; counts?: Counts; commentsOn: boolean; following: boolean; saved: boolean; notes: boolean; unlocked: boolean;
  onToggle: () => void; onSeek: (t: number) => void; onBack: () => void; onFwd: () => void; onLike: () => void; onDoubleLike: () => void; onSave: () => void; onShare: () => void; onFollow: () => void; onComments: () => void; onShow: () => void; onNext: () => void;
};
function Card(p: CardProps) {
  const { item, counts: c } = p; const ep = item.ep; const art = ep?.art || item.show.art;
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const lastTap = useRef(0); const tapT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTap = (e: ReactMouseEvent<HTMLButtonElement>) => {
    const now = Date.now(); const r = e.currentTarget.getBoundingClientRect();
    if (now - lastTap.current < 300) {
      if (tapT.current) clearTimeout(tapT.current); lastTap.current = 0;
      const id = now; setHearts((h) => [...h, { id, x: e.clientX - r.left, y: e.clientY - r.top }]); setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 800);
      p.onDoubleLike(); return;
    }
    lastTap.current = now; tapT.current = setTimeout(p.onToggle, 260);
  };
  const pct = p.dur ? Math.min(100, (p.time / p.dur) * 100) : 0;
  return <article data-i={p.i} className="relative h-full snap-start overflow-hidden [scroll-snap-stop:always]" aria-label={ep ? `${ep.title}, ${item.show.name}` : item.show.name}>
    <div className="absolute -inset-[15%] bg-cover bg-center opacity-70 blur-3xl saturate-150" style={{ backgroundImage: `url("${art}")` }} />
    <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-[#120e14]" />
    <button type="button" onClick={onTap} aria-label={p.playing ? "Pause. Double tap to like." : "Play. Double tap to like."} className="absolute inset-0 z-[1] cursor-pointer" />
    {hearts.map((h) => <Heart key={h.id} className="pointer-events-none absolute z-[5] -ml-12 -mt-12 h-24 w-24 animate-ping fill-rose-500 text-rose-500" style={{ left: h.x, top: h.y, animationIterationCount: 1 }} />)}

    <div className="pointer-events-none absolute left-1/2 top-16 z-[2] aspect-square w-[min(68%,42vh)] max-w-full -translate-x-1/2">
      <img src={art} alt={`${item.show.name} cover art`} referrerPolicy="no-referrer" loading={p.i < 2 ? "eager" : "lazy"} className={`h-full w-full rounded-2xl object-cover shadow-2xl ring-1 ring-white/10 transition-transform duration-500 ${p.playing ? "scale-[1.03]" : ""}`} />
      {!p.playing && ep && <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-black/65 px-4 py-2.5 text-sm font-extrabold backdrop-blur"><Play size={18} fill="currentColor" style={{ color: ACCENT }} />{p.unlocked && p.active ? "Paused" : "Tap to listen"}</span>}
      {item.state === "loading" && <span className="absolute inset-0 grid place-items-center rounded-2xl bg-black/40"><Loader2 className="animate-spin" /></span>}
      {item.state === "none" && <span className="pointer-events-auto absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-2xl bg-black/80 p-3 text-center text-sm">No playable episodes right now.<button type="button" onClick={p.onNext} className="mt-2 block w-full rounded-full bg-white/15 py-1.5 font-bold">Next podcast</button></span>}
    </div>

    {p.notes && ep?.about && <p className="pointer-events-none absolute inset-x-5 top-[calc(4rem+min(68%,42vh)+14px)] z-[2] line-clamp-4 pr-14 text-sm leading-relaxed text-white/75">{ep.about}</p>}

    <div className="absolute bottom-0 left-0 right-16 z-[3] flex flex-col gap-1.5 p-4 pb-5">
      <div className="pointer-events-none flex flex-wrap gap-1.5"><span className="rounded-md bg-white/12 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider">{GENRE[item.show.genre]?.name ?? "Podcast"}</span><span className="rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider" style={{ background: "rgba(255,138,61,.18)", color: ACCENT }}>{item.why}</span></div>
      <button type="button" onClick={p.onShow} className="w-fit text-left text-[15px] font-black hover:underline">{item.show.name}</button>
      <h2 className="line-clamp-2 text-xl font-black leading-tight sm:text-2xl">{ep?.title ?? "Loading the newest episode…"}</h2>
      <p className="text-xs text-white/65">{[item.show.author, ep?.secs ? durationWords(ep.secs) : "", ep?.date ? agoWords(ep.date) : ""].filter(Boolean).join(" · ")}</p>
      {ep && <div className="mt-1 flex items-center gap-2">
        <button type="button" onClick={p.onBack} aria-label="Back 15 seconds" className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white/12"><RotateCcw size={17} /></button>
        <button type="button" onClick={p.onToggle} aria-label={p.playing ? "Pause" : "Play"} className="grid h-11 w-11 flex-none place-items-center rounded-full text-[#24160a]" style={{ background: ACCENT }}>{p.playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button>
        <button type="button" onClick={p.onFwd} aria-label="Forward 30 seconds" className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white/12"><RotateCw size={17} /></button>
        <input type="range" min={0} max={Math.max(1, Math.floor(p.dur))} value={Math.floor(p.time)} onChange={(e) => p.onSeek(Number(e.target.value))} aria-label="Seek" disabled={!p.active}
          className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full" style={{ background: `linear-gradient(90deg, ${ACCENT} ${pct}%, rgba(255,255,255,.2) ${pct}%)`, accentColor: ACCENT }} />
        <span className="w-[86px] flex-none text-right text-[11px] tabular-nums text-white/65">{clock(p.time)} / {clock(p.dur)}</span>
      </div>}
      {ep?.link && <a href={ep.link} target="_blank" rel="noopener noreferrer" className="flex w-fit items-center gap-1 text-xs font-bold text-white/55 hover:text-white">Open in Apple Podcasts <ExternalLink size={12} /></a>}
    </div>

    <div className="absolute bottom-6 right-2 z-[3] flex flex-col items-center gap-4">
      <button type="button" onClick={p.onFollow} aria-label={p.following ? `Unfollow ${item.show.name}` : `Follow ${item.show.name}`} className="relative mb-2">
        <img src={item.show.art} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-full object-cover ring-2 ring-white" />
        <span className={`absolute -bottom-2 left-1/2 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full ${p.following ? "bg-white text-[#120e14]" : "bg-rose-500 text-white"}`}>{p.following ? <Check size={13} /> : <Plus size={13} />}</span>
      </button>
      <Rail label="Like" n={c?.likes} on={!!c?.liked} onClick={p.onLike} disabled={!ep}><Heart size={30} className={c?.liked ? "fill-rose-500 text-rose-500" : ""} /></Rail>
      {p.commentsOn && <Rail label="Comments" n={c?.comments} onClick={p.onComments} disabled={!ep}><MessageCircle size={30} /></Rail>}
      <Rail label={p.saved ? "Saved" : "Save"} onClick={p.onSave} disabled={!ep}><Bookmark size={30} className={p.saved ? "fill-current" : ""} style={p.saved ? { color: ACCENT } : undefined} /></Rail>
      <Rail label="Share" n={c?.shares} onClick={p.onShare} disabled={!ep}><Share2 size={28} /></Rail>
    </div>
  </article>;
}
function Rail({ children, label, n, on, onClick, disabled }: { children: ReactNode; label: string; n?: number; on?: boolean; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={on} className="flex min-w-12 flex-col items-center gap-0.5 text-xs font-bold drop-shadow disabled:opacity-40">
    {children}<span>{typeof n === "number" ? compact(n) : label === "Comments" || label === "Like" || label === "Share" ? "" : label}</span>
  </button>;
}

// ===========================================================================
// Sheets
// ===========================================================================
function Sheet({ title, onClose, children, tall }: { title: string; onClose: () => void; children: ReactNode; tall?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return <div className="absolute inset-0 z-30 flex flex-col justify-end">
    <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/55" />
    <div role="dialog" aria-modal="true" aria-label={title} className={`relative flex flex-col rounded-t-3xl bg-[#1d1720] shadow-2xl ${tall ? "h-[85%]" : "max-h-[80%]"}`}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><h3 className="text-base font-black">{title}</h3><button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><X size={18} /></button></div>
      {children}
    </div>
  </div>;
}

function Comments({ ep, api, say, onClose, onPosted }: { ep: PodEpisode; api: PlayerProps["api"]; say: (m: string) => void; onClose: () => void; onPosted: () => void }) {
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
    try { const b = await api("/api/earshot/comments", { method: "POST", body: { episodeId: ep.id, showId: ep.showId, body } }); setList((l) => [b.comment, ...(l || [])]); setText(""); onPosted(); }
    catch (e: any) { say(e.message); } finally { setBusy(false); }
  };
  const remove = async (id: string) => { if (confirm !== id) { setConfirm(id); setTimeout(() => setConfirm((c) => (c === id ? null : c)), 3000); return; } try { await api(`/api/earshot/comments/${id}`, { method: "DELETE" }); setList((l) => (l || []).filter((c) => c.id !== id)); } catch (e: any) { say(e.message); } };
  const report = async (id: string) => { try { await api(`/api/earshot/comments/${id}/report`, { method: "POST", body: {} }); setList((l) => (l || []).filter((c) => c.id !== id)); say("Reported. Thanks for keeping Earshot kind."); } catch (e: any) { say(e.message); } };
  return <Sheet title={list ? `${list.length} comment${list.length === 1 ? "" : "s"}` : "Comments"} onClose={onClose} tall>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <p className="mb-3 line-clamp-1 text-xs text-white/50">On “{ep.title}”</p>
      {!list && <div className="grid place-items-center py-10"><Loader2 className="animate-spin" /></div>}
      {err && <p className="py-6 text-center text-sm text-white/65">{err}</p>}
      {list && !err && !list.length && <p className="py-10 text-center text-sm text-white/60"><b className="text-white">No comments yet.</b><br />Say what you thought of this one.</p>}
      <ul className="flex flex-col gap-4">{(list || []).map((c) => <li key={c.id} className="grid grid-cols-[36px_1fr_auto] items-start gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-sm font-black text-white/70">{(c.mine ? "Y" : c.author[0] || "A").toUpperCase()}</span>
        <div className="min-w-0"><p className="text-xs font-bold text-white/60">{c.mine ? "You" : c.author} <span className="font-medium text-white/40">· {agoWords(c.at)}</span></p><p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed">{c.body}</p></div>
        {c.mine || admin
          ? <button type="button" onClick={() => remove(c.id)} aria-label="Delete comment" className={`flex items-center gap-1 p-1 text-xs font-bold ${confirm === c.id ? "text-rose-400" : "text-white/40"}`}><Trash2 size={14} />{confirm === c.id ? "Delete?" : ""}</button>
          : <button type="button" onClick={() => report(c.id)} aria-label="Report comment" className="p-1 text-white/35 hover:text-white/70"><Flag size={14} /></button>}
      </li>)}</ul>
    </div>
    <form onSubmit={post} className="flex items-center gap-2 border-t border-white/10 p-3">
      <input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} placeholder="Add a comment" aria-label="Write a comment" className="min-h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#ff8a3d]" />
      <button type="submit" disabled={!text.trim() || busy} className="min-h-11 rounded-full px-4 text-sm font-black text-[#24160a] disabled:opacity-40" style={{ background: ACCENT }}>{busy ? <Loader2 size={16} className="animate-spin" /> : "Post"}</button>
    </form>
  </Sheet>;
}

function ShowSheet({ show, load, following, onFollow, onPlay, onClose, onGenre }: { show: PodShow; load: (id: string) => Promise<{ show: PodShow | null; episodes: PodEpisode[] }>; following: boolean; onFollow: (s: PodShow) => void; onPlay: (s: PodShow, e: PodEpisode) => void; onClose: () => void; onGenre: (g: string) => void }) {
  const [eps, setEps] = useState<PodEpisode[] | null>(null);
  const [full, setFull] = useState<PodShow>(show);
  const [err, setErr] = useState("");
  useEffect(() => { let on = true; load(show.id).then((b) => { if (!on) return; setEps(b.episodes); if (b.show) setFull({ ...b.show, genre: show.genre || b.show.genre }); }).catch((e) => on && setErr(e.message)); return () => { on = false; }; }, [show.id, show.genre, load]);
  return <Sheet title={GENRE[full.genre]?.name ?? "Podcast"} onClose={onClose} tall>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div className="flex items-end gap-4"><img src={full.art} alt="" referrerPolicy="no-referrer" className="h-28 w-28 flex-none rounded-2xl object-cover shadow-xl" /><div className="min-w-0"><h2 className="text-xl font-black leading-tight">{full.name}</h2><p className="mt-1 text-sm text-white/60">{full.author}</p>{full.episodes > 0 && <p className="text-xs text-white/45">{full.episodes} episodes</p>}</div></div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => onFollow(full)} className={`min-h-10 rounded-full px-5 text-sm font-black ${following ? "bg-white/10 text-white" : "text-[#24160a]"}`} style={following ? undefined : { background: ACCENT }}>{following ? "Following" : "Follow"}</button>
        {GENRE[full.genre] && <button type="button" onClick={() => onGenre(full.genre)} className="min-h-10 rounded-full bg-white/10 px-4 text-sm font-bold">More {GENRE[full.genre].name}</button>}
        {full.link && <a href={full.link} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center gap-1 rounded-full bg-white/10 px-4 text-sm font-bold">Apple Podcasts <ExternalLink size={13} /></a>}
      </div>
      <div className="mt-5 flex flex-col">
        {!eps && !err && <div className="grid place-items-center py-8"><Loader2 className="animate-spin" /></div>}
        {err && <p className="py-6 text-center text-sm text-white/60">{err}</p>}
        {eps && !eps.length && <p className="py-6 text-center text-sm text-white/60">No playable episodes right now.</p>}
        {(eps || []).map((e) => <button key={e.id} type="button" onClick={() => onPlay(full, e)} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl p-3 text-left hover:bg-white/5">
          <span className="min-w-0"><b className="line-clamp-2 block text-sm leading-snug">{e.title}</b><span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-white/55">{e.about}</span><span className="mt-1 block text-[11px] font-bold uppercase tracking-wider text-white/40">{[e.date ? agoWords(e.date) : "", durationWords(e.secs)].filter(Boolean).join(" · ")}</span></span>
          <span className="grid h-9 w-9 place-items-center rounded-full text-[#24160a]" style={{ background: ACCENT }}><Play size={16} fill="currentColor" /></span>
        </button>)}
      </div>
    </div>
  </Sheet>;
}

function SettingsSheet({ es, student, update, onClose }: { es: EarshotData; student: boolean; update: PlayerProps["update"]; onClose: () => void }) {
  const set = (patch: Partial<EarshotData["settings"]>) => update((e) => ({ ...e, settings: { ...e.settings, ...patch } }));
  const Row = ({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) => <div className="flex items-center justify-between gap-3 border-b border-white/10 py-3.5 last:border-0"><div><b className="block text-sm">{title}</b>{sub && <span className="block text-xs text-white/55">{sub}</span>}</div>{children}</div>;
  const Switch = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className={`relative h-7 w-12 flex-none rounded-full transition ${on ? "" : "bg-white/15"}`} style={on ? { background: ACCENT } : undefined}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${on ? "left-6" : "left-1"}`} /></button>;
  const Seg = <T extends number>({ value, options, onPick }: { value: T; options: [T, string][]; onPick: (v: T) => void }) => <div className="flex flex-none rounded-full bg-white/10 p-0.5">{options.map(([v, l]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onPick(v)} className={`rounded-full px-2.5 py-1.5 text-xs font-extrabold ${value === v ? "bg-white text-[#120e14]" : "text-white/70"}`}>{l}</button>)}</div>;
  return <Sheet title="Playback" onClose={onClose}>
    <div className="overflow-y-auto px-4 pb-4">
      <Row title="Speed"><Seg value={es.settings.speed} options={SPEEDS.map((s) => [s, `${s}×`] as [number, string])} onPick={(v) => set({ speed: v })} /></Row>
      <Row title="Skip the intro" sub="Start long episodes 90 seconds in, past most ads and theme music"><Switch on={es.settings.skipIntro} label="Skip the intro" onClick={() => set({ skipIntro: !es.settings.skipIntro })} /></Row>
      <Row title="Swipe for me after" sub="Move to the next podcast by itself"><Seg value={es.settings.advance} options={[[60, "1 min"], [180, "3 min"], [0, "The end"]]} onPick={(v) => set({ advance: v as 0 | 60 | 180 })} /></Row>
      <Row title="Episode notes" sub="Show each episode's description under the cover"><Switch on={es.settings.notes} label="Episode notes" onClick={() => set({ notes: !es.settings.notes })} /></Row>
      {!student && <Row title="Explicit podcasts" sub="Off by default. Turn on to include shows marked explicit"><Switch on={es.settings.explicit} label="Explicit podcasts" onClick={() => set({ explicit: !es.settings.explicit })} /></Row>}
    </div>
  </Sheet>;
}

// ===========================================================================
// Explore
// ===========================================================================
function Explore({ api, ex, student, pools, poolTick, onGenre, onShow, onEpisode }: { api: PlayerProps["api"]; ex: string; student: boolean; pools: Map<string, PodShow[]>; poolTick: number; onGenre: (g: string) => void; onShow: (s: PodShow) => void; onEpisode: (s: PodShow, e: PodEpisode) => void }) {
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
  const popular = useMemo(() => { const out: PodShow[] = []; pools.forEach((s) => out.push(...s.slice(0, 4))); return out.slice(0, 16); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pools, poolTick]);
  const genres = GENRES.filter((g) => !student || g.kidSafe);
  const spooky = useMemo(() => [...(pools.get("horror") ?? []), ...(pools.get("truecrime") ?? [])].slice(0, 12), [pools, poolTick]);
  const asShow = (e: PodEpisode): PodShow => ({ id: e.showId, name: e.show, author: e.author, art: e.art, genre: "culture", appleGenre: "", link: e.link, episodes: 0, explicit: e.explicit, latest: e.date });
  return <div className="h-full overflow-y-auto px-4 pb-8 pt-16">
    <div className="relative"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={18} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search any podcast, host or topic" aria-label="Search podcasts" className="min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-3 text-base text-white outline-none placeholder:text-white/35 focus:border-[#ff8a3d]" /></div>
    {q.trim().length >= 2 ? <div className="mt-4 flex flex-col gap-1">
      {busy && !res && <div className="grid place-items-center py-8"><Loader2 className="animate-spin" /></div>}
      {err && <p className="py-6 text-center text-sm text-white/60">{err}</p>}
      {res && !res.shows.length && !res.episodes.length && <p className="py-6 text-center text-sm text-white/60">Nothing found for “{q.trim()}”. Try a show's name, a host, or a topic like history or cooking.</p>}
      {!!res?.shows.length && <p className="mt-2 text-xs font-extrabold uppercase tracking-widest text-white/40">Shows</p>}
      {res?.shows.map((s) => <Row key={s.id} art={s.art} title={s.name} sub={`${s.author}${GENRE[s.genre] ? ` · ${GENRE[s.genre].name}` : ""}`} onClick={() => onShow(s)} />)}
      {!!res?.episodes.length && <p className="mt-4 text-xs font-extrabold uppercase tracking-widest text-white/40">Episodes</p>}
      {res?.episodes.map((e) => <Row key={e.id} art={e.art} title={e.title} sub={`${e.show}${e.secs ? ` · ${durationWords(e.secs)}` : ""}`} onClick={() => onEpisode(asShow(e), e)} />)}
    </div> : <>
      {!!popular.length && <Shelf title="Popular in your genres">{popular.map((s) => <Tile key={s.id} art={s.art} title={s.name} sub={s.author} onClick={() => onShow(s)} />)}</Shelf>}
      {!student && !!spooky.length && <Shelf title="Spooky season">{spooky.map((s) => <Tile key={s.id} art={s.art} title={s.name} sub={s.author} onClick={() => onShow(s)} />)}</Shelf>}
      <h3 className="mt-6 text-lg font-black">Browse all genres</h3>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{genres.map((g) => <button key={g.id} type="button" onClick={() => onGenre(g.id)} className="flex h-20 items-end rounded-2xl p-3 text-left text-sm font-black leading-tight shadow" style={{ background: g.color }}>{g.name}</button>)}</div>
    </>}
  </div>;
}
const Row = ({ art, title, sub, onClick }: { art: string; title: string; sub: string; onClick: () => void }) => <button type="button" onClick={onClick} className="grid grid-cols-[52px_1fr] items-center gap-3 rounded-xl p-2 text-left hover:bg-white/5"><img src={art} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-[52px] w-[52px] rounded-lg object-cover" /><span className="min-w-0"><b className="block truncate text-sm">{title}</b><span className="block truncate text-xs text-white/55">{sub}</span></span></button>;
const Shelf = ({ title, children }: { title: string; children: ReactNode }) => <section className="mt-6"><h3 className="text-lg font-black">{title}</h3><div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">{children}</div></section>;
const Tile = ({ art, title, sub, onClick }: { art: string; title: string; sub: string; onClick: () => void }) => <button type="button" onClick={onClick} className="w-32 flex-none text-left"><img src={art} alt="" referrerPolicy="no-referrer" loading="lazy" className="aspect-square w-32 rounded-xl object-cover" /><b className="mt-1.5 line-clamp-2 block text-sm leading-tight">{title}</b><span className="line-clamp-1 block text-xs text-white/55">{sub}</span></button>;

// ===========================================================================
// Library
// ===========================================================================
function Library({ es, update, onEditInterests, onOpen }: { es: EarshotData; update: PlayerProps["update"]; onEditInterests: () => void; onOpen: (s: SavedEpisode) => void }) {
  const [which, setWhich] = useState<"liked" | "saved" | "following">("liked");
  const [asking, setAsking] = useState(false);
  const ranked = GENRES.map((g) => [g, tasteOf(es, g.id)] as const).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(1, ranked[0]?.[1] ?? 1);
  const eps = which === "liked" ? es.liked : es.saved;
  return <div className="h-full overflow-y-auto px-4 pb-8 pt-16">
    <div className="flex items-center justify-between gap-3"><h3 className="text-2xl font-black">Library</h3><button type="button" onClick={onEditInterests} className="min-h-9 rounded-full bg-white/10 px-4 text-sm font-bold">Edit interests</button></div>
    <div className="mt-4 grid grid-cols-3 gap-2">{([["Heard", es.heard.length], ["Liked", es.liked.length], ["Following", es.follows.length]] as const).map(([l, n]) => <div key={l} className="rounded-2xl bg-white/5 p-3"><b className="block text-2xl font-black tabular-nums">{n}</b><span className="text-xs text-white/55">{l}</span></div>)}</div>
    <h4 className="mt-6 text-sm font-black">What your feed has learned</h4>
    <div className="mt-2 flex flex-col gap-2">{ranked.map(([g, v]) => <div key={g.id} className="grid grid-cols-[120px_1fr_32px] items-center gap-2 text-xs"><span className="truncate">{g.name}</span><span className="h-2 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full" style={{ width: `${Math.max(3, (Math.max(0, v) / max) * 100)}%`, background: g.color }} /></span><span className="text-right tabular-nums text-white/45">{Math.round((Math.max(0, v) / max) * 100)}</span></div>)}</div>
    <p className="mt-2 text-xs leading-relaxed text-white/45">Likes, follows, shares and listening raise a genre; quick skips lower it. About one in seven picks is something new on purpose.</p>
    <div className="mt-6 flex gap-1.5">{(["liked", "saved", "following"] as const).map((w) => <button key={w} type="button" aria-pressed={which === w} onClick={() => setWhich(w)} className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold capitalize ${which === w ? "bg-white text-[#120e14]" : "bg-white/10 text-white/70"}`}>{w}</button>)}</div>
    <div className="mt-3 grid grid-cols-3 gap-3">
      {which === "following" ? es.follows.map((s) => <div key={s.id} className="text-left"><img src={s.art} alt="" referrerPolicy="no-referrer" className="aspect-square w-full rounded-xl object-cover" /><b className="mt-1 line-clamp-2 block text-xs">{s.name}</b></div>)
        : eps.map((e) => <button key={e.id} type="button" onClick={() => onOpen(e)} className="text-left"><img src={e.art} alt="" referrerPolicy="no-referrer" className="aspect-square w-full rounded-xl object-cover" /><b className="mt-1 line-clamp-2 block text-xs leading-tight">{e.title}</b><span className="line-clamp-1 block text-[11px] text-white/50">{e.show}</span></button>)}
    </div>
    {((which === "following" && !es.follows.length) || (which !== "following" && !eps.length)) && <p className="py-6 text-center text-sm text-white/55">{which === "liked" ? "Double-tap an episode to like it." : which === "saved" ? "Tap the bookmark to save an episode for later." : "Tap + on a podcast to follow it."}</p>}
    <div className="mt-8">{asking
      ? <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/5 p-3 text-sm"><span className="flex-1">Clear what the feed has learned? Likes, saves and follows stay.</span><button type="button" onClick={() => { update((e) => ({ ...e, taste: Object.fromEntries(e.genres.map((g) => [g, 3])), skipped: [] })); setAsking(false); }} className="rounded-full px-4 py-1.5 font-black text-[#24160a]" style={{ background: ACCENT }}>Reset</button><button type="button" onClick={() => setAsking(false)} className="rounded-full bg-white/10 px-4 py-1.5 font-bold">Cancel</button></div>
      : <button type="button" onClick={() => setAsking(true)} className="rounded-full bg-white/10 px-4 py-2 text-sm font-bold">Reset recommendations</button>}</div>
  </div>;
}
