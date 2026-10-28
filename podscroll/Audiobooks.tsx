// Pod+ Audiobooks: free public domain audiobooks from LibriVox (read by volunteers, kept at the
// Internet Archive). The server lists them and their chapters (server/audiobooks.ts); the audio
// plays straight from the Archive. Like the radio, a book keeps playing in the bar at the bottom
// while you browse, and each book remembers its chapter and spot on this device.
import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, ChevronLeft, Headphones, Loader2, Pause, Play, RotateCcw, RotateCw, Search, SkipBack, SkipForward, Star, X } from "lucide-react";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
export type Book = { id: string; title: string; author: string; cover: string; downloads: number; rating: number; reviews: number; about: string };
export type BookChapter = { n: number; title: string; secs: number; audio: string };
export type BookDetail = Book & { chapters: BookChapter[]; secs: number; link: string };
/** What's playing: the book, the chapter (0-based) and where in it to start. */
export type Reading = { book: BookDetail; ch: number; at: number };

const ACCENT = "#ff6a1f";
const SPEEDS = [1, 1.25, 1.5, 1.75, 2, 0.75] as const;

// ---- where each book was left, on this device ----
type Spot = { ch: number; t: number; at: number; title: string; author: string; cover: string; chapters: number };
const SPOTS = "podscroll.books";
export function bookSpots(): Record<string, Spot> {
  try { const v = JSON.parse(localStorage.getItem(SPOTS) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
function saveSpot(b: BookDetail, ch: number, t: number, finished = false) {
  const all = bookSpots();
  const last = finished || (ch >= b.chapters.length - 1 && !!b.chapters[ch]?.secs && t > b.chapters[ch].secs - 20);
  if (last) delete all[b.id];
  else all[b.id] = { ch, t: Math.floor(t), at: Date.now(), title: b.title, author: b.author, cover: b.cover, chapters: b.chapters.length };
  const keep = Object.entries(all).sort((a, z) => z[1].at - a[1].at).slice(0, 50);
  try { localStorage.setItem(SPOTS, JSON.stringify(Object.fromEntries(keep))); } catch { /* private window */ }
}

const hours = (s: number) => {
  if (!s) return "";
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
  return h ? `${h} hr${m ? ` ${m} min` : ""}` : `${m} min`;
};
const clock = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`;
};
const listens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));

function Cover({ src, title, className = "" }: { src: string; title: string; className?: string }) {
  const [bad, setBad] = useState(false);
  return <span className={`relative block overflow-hidden bg-[#f2f2f2] ${className}`}>
    {!bad ? <img src={src} alt="" loading="lazy" onError={() => setBad(true)} className="h-full w-full object-cover" />
      : <span className="flex h-full w-full items-center justify-center p-3 text-center text-sm font-semibold text-[#606060]">{title}</span>}
  </span>;
}

// ---------------- the shelf ----------------

export function AudiobooksView({ api, current, onOpen }: { api: Api; current: Reading | null; onOpen: (id: string) => void }) {
  const [shelf, setShelf] = useState("top");
  const [shelves, setShelves] = useState<{ id: string; label: string }[]>([{ id: "top", label: "Top rated" }]);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [list, setList] = useState<Book[] | null>(null);
  const [err, setErr] = useState("");
  const [retry, setRetry] = useState(0);
  const [spots] = useState(bookSpots);
  const going = Object.entries(spots).sort((a, z) => z[1].at - a[1].at).slice(0, 12);

  useEffect(() => {
    let live = true;
    setList(null); setErr("");
    const p = new URLSearchParams(term ? { q: term } : { shelf });
    api(`/api/earshot/books?${p}`).then((b) => {
      if (!live) return;
      setList(Array.isArray(b?.books) ? b.books : []);
      if (Array.isArray(b?.shelves) && b.shelves.length) setShelves(b.shelves);
    }).catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [api, shelf, term, retry]);

  return <div className="px-4 pb-28 pt-3 sm:px-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><BookOpen size={24} strokeWidth={2} />Audiobooks</h1>
        <p className="mt-1 text-sm text-[#606060]">Thousands of classic books, read aloud. Free, with no ads.</p>
      </div>
      <form role="search" onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }} className="flex w-full max-w-[360px] items-center">
        <label htmlFor="ps-book-q" className="sr-only">Find a book</label>
        <input id="ps-book-q" type="search" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setTerm(""); }} placeholder="Find a book or author" className="h-10 min-w-0 flex-1 rounded-l-full border border-r-0 border-[#d3d3d3] px-4 text-sm outline-none focus:border-[#1c62b9]" />
        <button type="submit" aria-label="Find book" className="inline-flex h-10 w-12 shrink-0 items-center justify-center rounded-r-full border border-[#d3d3d3] bg-[#f8f8f8]"><Search size={18} /></button>
      </form>
    </div>

    {going.length > 0 && !term && <section aria-label="Continue listening" className="mt-5">
      <h2 className="mb-2 text-base font-semibold">Continue listening</h2>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {going.map(([id, s]) => <button key={id} onClick={() => onOpen(id)} className="w-[120px] shrink-0 text-left">
          <Cover src={s.cover} title={s.title} className="aspect-square w-full rounded-xl" />
          <span className="mt-1.5 line-clamp-2 block text-[13px] font-semibold leading-snug">{s.title}</span>
          <span className="block text-xs text-[#606060]">Chapter {s.ch + 1} of {s.chapters}</span>
        </button>)}
      </div>
    </section>}

    <div role="group" aria-label="Shelves" className="-mx-1 mt-5 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {shelves.map((s) => {
        const on = !term && shelf === s.id;
        return <button key={s.id} onClick={() => { setTerm(""); setQ(""); setShelf(s.id); }} aria-pressed={on} className={`h-8 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium ${on ? "bg-[#0f0f0f] text-white" : "bg-[#f2f2f2] hover:bg-[#e5e5e5]"}`}>{s.label}</button>;
      })}
    </div>

    {err ? <div className="py-20 text-center"><p className="text-[#606060]">{err}</p><button onClick={() => setRetry((n) => n + 1)} className="mt-4 h-9 rounded-full bg-[#0f0f0f] px-4 text-sm font-semibold text-white">Try again</button></div>
      : !list ? <div className="flex justify-center py-24" role="status" aria-label="Loading audiobooks"><Loader2 className="animate-spin text-[#606060]" size={28} /></div>
      : !list.length ? <p className="py-20 text-center text-[#606060]">{term ? `No audiobooks match “${term}”.` : "Nothing on this shelf right now."} Try another one.</p>
      : <div className="mt-4 grid gap-x-4 gap-y-6 [grid-template-columns:repeat(auto-fill,minmax(min(150px,45%),1fr))]">
        {list.map((b, i) => {
          const on = current?.book.id === b.id;
          return <button key={b.id} onClick={() => onOpen(b.id)} className="group min-w-0 text-left" data-testid={`ps-book-${b.id}`}>
            <span className="relative block">
              <Cover src={b.cover} title={b.title} className={`aspect-square w-full rounded-xl transition group-hover:scale-[1.02] ${on ? "ring-2 ring-[#ff6a1f]" : ""}`} />
              {shelf === "top" && !term && i < 10 && <span className="ps-keep absolute left-2 top-2 rounded-md bg-[#0f0f0f]/80 px-1.5 text-xs font-bold text-white">#{i + 1}</span>}
            </span>
            <span className="mt-2 line-clamp-2 block text-sm font-semibold leading-snug">{b.title}</span>
            <span className="block truncate text-xs text-[#606060]">{b.author}</span>
            <span className="mt-0.5 flex items-center gap-1 text-xs text-[#606060]">
              {b.rating > 0 && <><Star size={12} fill="currentColor" className="text-[#f5a623]" />{b.rating.toFixed(1)}<span aria-hidden>·</span></>}
              <Headphones size={12} />{listens(b.downloads)}
            </span>
          </button>;
        })}
      </div>}
    <p className="mt-8 text-xs text-[#767676]">Audiobooks from <a href="https://librivox.org" target="_blank" rel="noreferrer" className="underline">LibriVox</a>, read by volunteers, kept at the <a href="https://archive.org/details/librivoxaudio" target="_blank" rel="noreferrer" className="underline">Internet Archive</a>. All public domain.</p>
  </div>;
}

/** A row of the top audiobooks for the home page. Says nothing if they can't load. */
export function BooksRow({ api, onOpen, onAll }: { api: Api; onOpen: (id: string) => void; onAll: () => void }) {
  const [list, setList] = useState<Book[]>([]);
  useEffect(() => {
    let live = true;
    api("/api/earshot/books?shelf=top").then((b) => { if (live && Array.isArray(b?.books)) setList(b.books.slice(0, 14)); }).catch(() => {});
    return () => { live = false; };
  }, [api]);
  if (!list.length) return null;
  return <section aria-label="Top audiobooks" className="mb-6">
    <div className="mb-2 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight"><BookOpen size={19} />Top audiobooks</h2>
      <button onClick={onAll} className="h-8 rounded-full px-3 text-sm font-medium text-[#065fd4] hover:bg-[#def1ff]">See all</button>
    </div>
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {list.map((b) => <button key={b.id} onClick={() => onOpen(b.id)} className="w-[132px] shrink-0 text-left">
        <Cover src={b.cover} title={b.title} className="aspect-square w-full rounded-xl" />
        <span className="mt-1.5 line-clamp-2 block text-[13px] font-semibold leading-snug">{b.title}</span>
        <span className="block truncate text-xs text-[#606060]">{b.author}</span>
      </button>)}
    </div>
  </section>;
}

// ---------------- one book ----------------

export function useBook(api: Api, id: string | null) {
  const [book, setBook] = useState<BookDetail | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!id) return;
    let live = true;
    setBook(null); setErr("");
    api(`/api/earshot/books/${encodeURIComponent(id)}`).then((b) => { if (live) setBook(b.book); }).catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [api, id]);
  return { book, err };
}

export function BookPage({ api, id, current, playing, onPlay, onToggle, onBack }: { api: Api; id: string; current: Reading | null; playing: boolean; onPlay: (r: Reading) => void; onToggle: () => void; onBack: () => void }) {
  const { book, err } = useBook(api, id);
  const [more, setMore] = useState(false);
  const spot = bookSpots()[id];
  const here = current?.book.id === id;

  if (err) return <div className="px-4 py-20 text-center"><p className="text-[#606060]">{err}</p><button onClick={onBack} className="mt-4 h-9 rounded-full bg-[#0f0f0f] px-4 text-sm font-semibold text-white">Back to audiobooks</button></div>;
  if (!book) return <div className="flex justify-center py-32" role="status" aria-label="Loading audiobook"><Loader2 className="animate-spin text-[#606060]" size={28} /></div>;

  const startCh = here ? current!.ch : spot ? Math.min(spot.ch, book.chapters.length - 1) : 0;
  const main = () => (here ? onToggle() : onPlay({ book, ch: startCh, at: spot && !here ? spot.t : 0 }));
  const label = here ? (playing ? "Pause" : "Play") : spot ? `Resume · Chapter ${startCh + 1}` : "Play";

  return <div className="mx-auto max-w-[760px] px-4 pb-28 pt-2 sm:px-6">
    <button onClick={onBack} className="-ml-2 mb-2 inline-flex h-9 items-center gap-1 rounded-full pl-1 pr-3 text-sm font-medium hover:bg-[#f2f2f2]"><ChevronLeft size={20} />Audiobooks</button>
    <div className="flex flex-col items-center text-center">
      <div className="relative w-[min(72vw,300px)]">
        {/* A soft glow of the cover behind it. */}
        <img src={book.cover} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full scale-110 rounded-3xl object-cover opacity-40 blur-2xl" />
        <Cover src={book.cover} title={book.title} className="relative aspect-square w-full rounded-2xl shadow-2xl" />
      </div>
      <h1 className="mt-6 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{book.title}</h1>
      {book.author && <p className="mt-1 text-[15px] text-[#606060]">{book.author}</p>}
      <p className="mt-1 text-xs text-[#767676]">{[`${book.chapters.length} chapters`, hours(book.secs)].filter(Boolean).join(" · ")}</p>
      <button onClick={main} className="mt-5 inline-flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white" style={{ background: ACCENT }} data-testid="ps-book-play">
        {here && playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}{label}
      </button>
    </div>

    {book.about && <div className="mt-7">
      <p className={`text-sm leading-relaxed text-[#3a3a3a] ${more ? "" : "line-clamp-3"}`}>{book.about}</p>
      {book.about.length > 200 && <button onClick={() => setMore((v) => !v)} className="mt-1 text-sm font-semibold">{more ? "Less" : "More"}</button>}
    </div>}

    <h2 className="mt-7 text-base font-semibold">Chapters</h2>
    <ol className="mt-2 divide-y divide-[#ececec]">
      {book.chapters.map((c, i) => {
        const now = here && current!.ch === i;
        return <li key={c.n}>
          <button onClick={() => (now ? onToggle() : onPlay({ book, ch: i, at: 0 }))} className={`flex min-h-12 w-full items-center gap-3 py-2 text-left ${now ? "font-semibold" : ""}`}>
            <span className={`w-7 shrink-0 text-right text-xs tabular-nums ${now ? "" : "text-[#767676]"}`} style={now ? { color: ACCENT } : undefined}>{now && playing ? <span className="inline-flex gap-[2px]" aria-label="Playing">{[0, 1, 2].map((k) => <span key={k} className="inline-block w-[3px] rounded-sm motion-safe:animate-pulse" style={{ height: 10, background: ACCENT, animationDelay: `${k * 0.15}s` }} />)}</span> : c.n}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
            <span className="shrink-0 text-xs tabular-nums text-[#767676]">{c.secs ? clock(c.secs) : ""}</span>
          </button>
        </li>;
      })}
    </ol>
    <p className="mt-8 text-xs text-[#767676]">A <a href="https://librivox.org" target="_blank" rel="noreferrer" className="underline">LibriVox</a> recording, public domain. <a href={book.link} target="_blank" rel="noreferrer" className="underline">See it at the Internet Archive</a>.</p>
  </div>;
}

// ---------------- the bar ----------------

/** The bar at the bottom while a book plays: plays chapter after chapter, and remembers the spot. */
export function AudiobookBar({ reading, tap, onChange, onStop, onOpen, onPlaying, say }: { reading: Reading; /** Goes up each time the book page's Play/Pause is tapped. */ tap: number; onChange: (r: Reading) => void; onStop: () => void; onOpen: () => void; onPlaying: (on: boolean) => void; say: (m: string) => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState<number>(() => { try { const n = Number(localStorage.getItem("podscroll.bookSpeed")); return (SPEEDS as readonly number[]).includes(n) ? n : 1; } catch { return 1; } });
  const { book, ch } = reading;
  const chapter = book.chapters[ch];
  const lastSave = useRef(0);

  const go = useCallback((n: number) => {
    if (n < 0 || n >= book.chapters.length) return;
    onChange({ book, ch: n, at: 0 });
  }, [book, onChange]);

  useEffect(() => {
    const a = audio.current; if (!a || !chapter) return;
    setLoading(true); setTime(reading.at); setDur(chapter.secs);
    a.src = chapter.audio;
    a.playbackRate = speed;
    const seek = () => { if (reading.at > 0) { try { a.currentTime = reading.at; } catch { /* not seekable yet */ } } };
    a.addEventListener("loadedmetadata", seek, { once: true });
    a.play().catch(() => { setLoading(false); say("Tap play to start the book."); });
    try {
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: chapter.title, artist: book.author || "LibriVox", album: book.title, artwork: [{ src: book.cover, sizes: "300x300" }] });
        const ms = navigator.mediaSession;
        ms.setActionHandler("play", () => { audio.current?.play().catch(() => {}); });
        ms.setActionHandler("pause", () => audio.current?.pause());
        ms.setActionHandler("previoustrack", ch > 0 ? () => go(ch - 1) : null);
        ms.setActionHandler("nexttrack", ch < book.chapters.length - 1 ? () => go(ch + 1) : null);
        ms.setActionHandler("seekbackward", () => { const x = audio.current; if (x) x.currentTime = Math.max(0, x.currentTime - 15); });
        ms.setActionHandler("seekforward", () => { const x = audio.current; if (x) x.currentTime = x.currentTime + 30; });
      }
    } catch { /* older browsers */ }
    return () => { a.removeEventListener("loadedmetadata", seek); if (a.currentTime > 0) saveSpot(book, ch, a.currentTime); a.pause(); };
  }, [book, ch]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { const a = audio.current; if (a) { a.pause(); a.removeAttribute("src"); a.load(); } }, []);
  useEffect(() => { onPlaying(playing); }, [playing, onPlaying]);

  const toggle = () => { const a = audio.current; if (!a) return; if (a.paused) a.play().catch(() => say("This chapter won't play right now. Try again.")); else a.pause(); };
  const firstTap = useRef(tap);
  useEffect(() => { if (tap !== firstTap.current) toggle(); }, [tap]); // eslint-disable-line react-hooks/exhaustive-deps
  const skip = (d: number) => { const a = audio.current; if (a) a.currentTime = Math.max(0, Math.min((a.duration || dur || 0) - 1, a.currentTime + d)); };
  const cycleSpeed = () => {
    const next = SPEEDS[((SPEEDS as readonly number[]).indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next); if (audio.current) audio.current.playbackRate = next;
    try { localStorage.setItem("podscroll.bookSpeed", String(next)); } catch { /* private window */ }
  };
  const pct = dur ? Math.min(100, (time / dur) * 100) : 0;

  return <div role="region" aria-label="Now playing audiobook" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e5e5] bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur">
    <input type="range" min={0} max={dur || 1} step={1} value={Math.min(time, dur || 1)} aria-label="Position in chapter"
      onChange={(e) => { const a = audio.current; const v = Number(e.target.value); setTime(v); if (a) a.currentTime = v; }}
      className="ps-book-range absolute -top-[7px] left-0 h-[14px] w-full cursor-pointer appearance-none bg-transparent"
      style={{ background: `linear-gradient(to right, ${ACCENT} ${pct}%, transparent ${pct}%) center / 100% 3px no-repeat` }} />
    <style>{".ps-book-range::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#ff6a1f}.ps-book-range::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:50%;background:#ff6a1f}"}</style>
    <div className="mx-auto flex max-w-[1600px] items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-5">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Open ${book.title}`}>
        <Cover src={book.cover} title={book.title} className="h-11 w-11 shrink-0 rounded-lg" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">{book.title}</span>
          <span className="truncate text-xs text-[#606060]">{chapter?.title || `Chapter ${ch + 1}`} · {clock(time)}{dur ? ` / ${clock(dur)}` : ""}</span>
        </span>
      </button>
      <button onClick={cycleSpeed} aria-label={`Speed ${speed}x`} className="hidden h-9 min-w-[44px] items-center justify-center rounded-full px-2 text-xs font-bold tabular-nums hover:bg-[#f2f2f2] sm:inline-flex">{speed}×</button>
      <button onClick={() => go(ch - 1)} disabled={ch === 0} aria-label="Previous chapter" className="hidden h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2] disabled:opacity-30 md:inline-flex"><SkipBack size={18} /></button>
      <button onClick={() => skip(-15)} aria-label="Back 15 seconds" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2]"><RotateCcw size={19} /></button>
      <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0f0f0f] text-white">{loading && !playing ? <Loader2 className="animate-spin" size={20} /> : playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}</button>
      <button onClick={() => skip(30)} aria-label="Forward 30 seconds" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2]"><RotateCw size={19} /></button>
      <button onClick={() => go(ch + 1)} disabled={ch >= book.chapters.length - 1} aria-label="Next chapter" className="hidden h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2] disabled:opacity-30 md:inline-flex"><SkipForward size={18} /></button>
      <button onClick={onStop} aria-label="Close audiobook" className="hidden h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2] sm:inline-flex"><X size={18} /></button>
      <audio ref={audio} preload="auto"
        onPlaying={() => { setPlaying(true); setLoading(false); }} onPause={() => { setPlaying(false); const a = audio.current; if (a && a.currentTime > 0) saveSpot(book, ch, a.currentTime); }} onWaiting={() => setLoading(true)}
        onLoadedMetadata={() => { const a = audio.current; if (a && Number.isFinite(a.duration)) setDur(a.duration); if (a) a.playbackRate = speed; }}
        onTimeUpdate={() => { const a = audio.current; if (!a) return; setTime(a.currentTime); if (Date.now() - lastSave.current > 5000) { lastSave.current = Date.now(); saveSpot(book, ch, a.currentTime); } }}
        onEnded={() => { if (ch < book.chapters.length - 1) go(ch + 1); else { saveSpot(book, ch, 0, true); setPlaying(false); say(`You finished ${book.title}.`); } }}
        onError={() => { setPlaying(false); setLoading(false); if (audio.current?.getAttribute("src")) say("This chapter won't play right now. Try the next one."); }} />
    </div>
  </div>;
}
