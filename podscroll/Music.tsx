// Pod+ Music: public domain music (Beethoven, Mozart, Bach, old jazz and blues) from the Internet
// Archive, through /api/podscroll/music (server/music.ts). Only recordings marked public domain are
// listed, so everything here is free to play. Tap an album to see its tracks; the bar at the bottom
// keeps playing while you browse, and moves on to the next track by itself.
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Loader2, Music as MusicIcon, Pause, Play, Search, SkipBack, SkipForward, Square } from "lucide-react";
import { onOtherSound, soundStarted } from "../client/src/components/family-hub/earshot/soundBus";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
export type Album = { id: string; title: string; artist: string; cover: string; plays: number; art?: string; year?: number };
type Artist = { name: string; image: string; albums: number };
type Sort = "popular" | "new" | "old";
const SORTS: [Sort, string][] = [["popular", "Popular"], ["new", "New"], ["old", "Oldest"]];

/** The album's real picture, or a designed cover (its name on a color picked from the name) when there's none. */
function Cover({ album, className = "" }: { album: Pick<Album, "title" | "artist" | "cover" | "art">; className?: string }) {
  const [broken, setBroken] = useState(false);
  const src = album.art || "";
  if (src && !broken) return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={`h-full w-full object-cover ${className}`} />;
  const h = [...(album.artist + album.title)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  return <span className={`flex h-full w-full flex-col justify-between p-3 text-left text-white ${className}`} style={{ background: `linear-gradient(140deg, hsl(${h} 55% 38%), hsl(${(h + 40) % 360} 60% 18%))` }}>
    <MusicIcon size={18} className="opacity-80" />
    <span className="min-w-0"><span className="line-clamp-3 block text-[13px] font-bold leading-tight">{album.title}</span><span className="mt-1 block truncate text-[11px] opacity-80">{album.artist}</span></span>
  </span>;
}
export type Track = { n: number; title: string; secs: number; audio: string };
export type AlbumDetail = Album & { tracks: Track[]; about: string; license: string; link: string };
/** What's playing: an album and which track. */
export type Listening = { album: AlbumDetail; index: number };

const time = (s: number) => (s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "");

export function MusicView({ api, current, onPlay }: { api: Api; current: Listening | null; onPlay: (l: Listening) => void }) {
  const [shelf, setShelf] = useState("all");
  const [shelves, setShelves] = useState<{ id: string; label: string }[]>([{ id: "all", label: "All" }]);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [list, setList] = useState<Album[] | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<AlbumDetail | null>(null);
  const [opening, setOpening] = useState("");
  const [sort, setSort] = useState<Sort>("popular");
  const [artist, setArtist] = useState("");
  const [artists, setArtists] = useState<Artist[]>([]);

  useEffect(() => {
    let live = true;
    api(`/api/earshot/music/artists?shelf=${encodeURIComponent(shelf)}`).then((b) => { if (live) setArtists(Array.isArray(b?.artists) ? b.artists : []); }).catch(() => { if (live) setArtists([]); });
    return () => { live = false; };
  }, [api, shelf]);

  useEffect(() => {
    let live = true;
    setList(null); setErr("");
    const p = new URLSearchParams({ shelf, q: term, sort, artist });
    api(`/api/earshot/music?${p}`).then((b) => {
      if (!live) return;
      setList(Array.isArray(b?.albums) ? b.albums : []);
      if (Array.isArray(b?.shelves)) setShelves(b.shelves);
    }).catch((e) => { if (live) setErr(e?.message || "Music isn't loading right now."); });
    return () => { live = false; };
  }, [api, shelf, term, sort, artist]);

  const openAlbum = (id: string) => {
    setOpening(id);
    api(`/api/earshot/music/${encodeURIComponent(id)}`).then((b) => setOpen(b.album)).catch((e) => setErr(e?.message || "This album isn't loading.")).finally(() => setOpening(""));
  };

  if (open) {
    return <div className="px-4 pb-28 pt-3 sm:px-6">
      <button onClick={() => setOpen(null)} className="inline-flex h-9 items-center gap-1 rounded-full px-2 text-sm font-medium hover:bg-[#f2f2f2]"><ChevronLeft size={18} />Music</button>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end">
        <span className="block h-40 w-40 shrink-0 overflow-hidden rounded-xl ring-1 ring-black/5"><Cover album={open} /></span>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{open.title}</h1>
          <p className="mt-1 text-sm text-[#606060]"><button onClick={() => { setOpen(null); setTerm(""); setQ(""); setArtist(open.artist); }} className="font-medium underline-offset-2 hover:underline">{open.artist}</button>{open.year ? ` · ${open.year}` : ""} · {open.tracks.length} {open.tracks.length === 1 ? "track" : "tracks"}</p>
          <button onClick={() => onPlay({ album: open, index: 0 })} className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-[#0f0f0f] px-5 text-sm font-semibold text-white"><Play size={16} fill="currentColor" />Play all</button>
        </div>
      </div>
      <ol className="mt-5 divide-y divide-[#eee]">
        {open.tracks.map((t, i) => {
          const on = current?.album.id === open.id && current.index === i;
          return <li key={t.audio}><button onClick={() => onPlay({ album: open, index: i })} aria-pressed={on} className={`flex w-full items-center gap-3 px-2 py-3 text-left hover:bg-[#f7f7f5] ${on ? "font-semibold text-[#c2410c]" : ""}`}>
            <span className="w-6 shrink-0 text-right text-sm text-[#606060]">{on ? <MusicIcon size={14} className="ml-auto" /> : t.n}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
            <span className="shrink-0 text-xs text-[#606060]">{time(t.secs)}</span>
          </button></li>;
        })}
      </ol>
      {open.about && <p className="mt-5 text-sm text-[#606060]">{open.about}</p>}
      <p className="mt-4 text-xs text-[#767676]">Public domain recording from the <a href={open.link} target="_blank" rel="noreferrer" className="underline">Internet Archive</a> (<a href={open.license} target="_blank" rel="noreferrer" className="underline">license</a>).</p>
    </div>;
  }

  return <div className="px-4 pb-28 pt-3 sm:px-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><MusicIcon size={24} strokeWidth={2} />Music</h1>
        <p className="mt-1 text-sm text-[#606060]">Classical, old jazz, blues and more. Every recording is public domain, free to play.</p>
      </div>
      <form role="search" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }} className="flex w-full max-w-[360px] items-center">
        <label htmlFor="ps-music-q" className="sr-only">Find music</label>
        <input id="ps-music-q" type="search" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setTerm(""); }} placeholder="Find a composer or piece (e.g. Moonlight Sonata)" className="h-10 min-w-0 flex-1 rounded-l-full border border-r-0 border-[#d3d3d3] px-4 text-sm outline-none focus:border-[#1c62b9]" />
        <button type="submit" aria-label="Find music" className="inline-flex h-10 w-12 shrink-0 items-center justify-center rounded-r-full border border-[#d3d3d3] bg-[#f8f8f8]"><Search size={18} /></button>
      </form>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Order" className="inline-flex rounded-full bg-[#f2f2f2] p-1">
        {SORTS.map(([v, l]) => <button key={v} onClick={() => setSort(v)} aria-pressed={sort === v} className={`h-8 rounded-full px-3.5 text-sm font-semibold ${sort === v ? "bg-[#0f0f0f] text-white" : "text-[#3f3f3f]"}`}>{l}</button>)}
      </div>
      {artist && <button onClick={() => setArtist("")} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#ff6a1f] px-3 text-sm font-semibold text-white" aria-label={`Showing ${artist}. Show everyone`}>{artist} <span aria-hidden>✕</span></button>}
    </div>
    {!term && !artist && artists.length > 0 && <section aria-label="Artists" className="mt-5">
      <h2 className="text-base font-bold">Artists</h2>
      <div className="-mx-1 mt-2 flex gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
        {artists.map((a) => <button key={a.name} onClick={() => setArtist(a.name)} className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center">
          <span className="block h-20 w-20 overflow-hidden rounded-full bg-[#f2f2f2] ring-1 ring-black/5">{a.image ? <img src={a.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-xl font-bold text-[#606060]">{a.name.slice(0, 1)}</span>}</span>
          <span className="line-clamp-2 text-xs font-semibold leading-tight">{a.name}</span>
        </button>)}
      </div>
    </section>}
    <div role="group" aria-label="Kinds of music" className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {shelves.map((s) => {
        const on = !term && shelf === s.id;
        return <button key={s.id} onClick={() => { setTerm(""); setQ(""); setArtist(""); setShelf(s.id); }} aria-pressed={on} className={`h-8 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium ${on ? "bg-[#0f0f0f] text-white" : "bg-[#f2f2f2] hover:bg-[#e5e5e5]"}`}>{s.label}</button>;
      })}
    </div>
    {err ? <p className="py-20 text-center text-[#606060]">{err}</p>
      : !list ? <div className="flex justify-center py-24" role="status" aria-label="Loading music"><Loader2 className="animate-spin text-[#606060]" size={28} /></div>
      : !list.length ? <p className="py-20 text-center text-[#606060]">{term ? `No free recordings of “${term}” yet.` : "Nothing here right now."} Try another search.</p>
      : <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(160px,100%),1fr))]">
        {list.map((a) => <button key={a.id} onClick={() => openAlbum(a.id)} className="min-w-0 text-left">
          <span className="relative block aspect-square overflow-hidden rounded-xl bg-[#f2f2f2] ring-1 ring-black/5">
            <Cover album={a} />
            {(opening === a.id || current?.album.id === a.id) && <span className="absolute inset-0 grid place-items-center bg-black/35 text-white">{opening === a.id ? <Loader2 className="animate-spin" /> : <MusicIcon />}</span>}
          </span>
          <span className="mt-2 line-clamp-2 block text-sm font-semibold">{a.title}</span>
          <span className="block truncate text-xs text-[#606060]">{a.artist}{a.year ? ` · ${a.year}` : ""}</span>
        </button>)}
      </div>}
    <p className="mt-8 text-xs text-[#767676]">Recordings from the <a href="https://archive.org" target="_blank" rel="noreferrer" className="underline">Internet Archive</a>, marked public domain.</p>
  </div>;
}

/** The bar at the bottom while music plays; goes on to the next track by itself. */
export function MusicBar({ listening, onChange, onStop, say }: { listening: Listening; onChange: (l: Listening) => void; onStop: () => void; say: (m: string) => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const { album, index } = listening;
  const track = album.tracks[index];
  useEffect(() => onOtherSound("music", () => audio.current?.pause()), []);
  const go = (i: number) => { if (i >= 0 && i < album.tracks.length) onChange({ album, index: i }); };

  useEffect(() => {
    const a = audio.current; if (!a || !track) return;
    setLoading(true);
    a.src = track.audio;
    a.play().catch(() => { setLoading(false); say("Tap play to start the music."); });
    try {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: album.artist, album: album.title, artwork: [{ src: album.cover }] });
        navigator.mediaSession.setActionHandler("play", () => { audio.current?.play().catch(() => {}); });
        navigator.mediaSession.setActionHandler("pause", () => audio.current?.pause());
        navigator.mediaSession.setActionHandler("nexttrack", () => go(index + 1));
        navigator.mediaSession.setActionHandler("previoustrack", () => go(index - 1));
      }
    } catch { /* older browsers */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [album.id, index]);
  useEffect(() => () => { const a = audio.current; if (a) { a.pause(); a.removeAttribute("src"); a.load(); } }, []);

  if (!track) return null;
  return <div role="region" aria-label="Now playing music" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e5e5] bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur">
    <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-3 py-2.5 sm:px-5">
      <span className="block h-11 w-11 shrink-0 overflow-hidden rounded-lg"><Cover album={album} className="!p-1 [&_span]:hidden" /></span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold">{track.title}</span>
        <span className="truncate text-xs text-[#606060]">{album.artist} · {album.title}</span>
      </div>
      <button onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous track" className="hidden h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2] disabled:opacity-30 sm:inline-flex"><SkipBack size={18} fill="currentColor" /></button>
      <button onClick={() => { const a = audio.current; if (a) a.paused ? a.play().catch(() => {}) : a.pause(); }} aria-label={playing ? "Pause" : "Play"} className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#0f0f0f] text-white">{loading && !playing ? <Loader2 className="animate-spin" size={20} /> : playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}</button>
      <button onClick={() => go(index + 1)} disabled={index >= album.tracks.length - 1} aria-label="Next track" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2] disabled:opacity-30"><SkipForward size={18} fill="currentColor" /></button>
      <button onClick={onStop} aria-label="Stop music" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2]"><Square size={16} fill="currentColor" /></button>
      <audio ref={audio} preload="auto"
        onPlaying={() => { setPlaying(true); setLoading(false); soundStarted("music"); }} onPause={() => setPlaying(false)} onWaiting={() => setLoading(true)}
        onEnded={() => { if (index < album.tracks.length - 1) go(index + 1); else setPlaying(false); }}
        onError={() => { setPlaying(false); setLoading(false); if (audio.current?.getAttribute("src")) { if (index < album.tracks.length - 1) go(index + 1); else say("This track won't play. Try another one."); } }} />
    </div>
  </div>;
}
