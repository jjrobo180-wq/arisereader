// Pod+ Audiobooks: free public domain audiobooks from LibriVox (read by volunteers, kept at the
// Internet Archive). The server lists them, their chapters, other readings, the book's text and
// AI transcripts (server/audiobooks.ts); the audio plays straight from the Archive (or through the
// server when Voice boost shapes it). Like the radio, a book keeps playing in the bar at the bottom
// while you browse, and each book remembers its chapter and spot on this device.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BookOpen, BookOpenText, Bookmark, ChevronLeft, ChevronRight, Headphones, Loader2, Pause, Play, RotateCcw, RotateCw, Search, SkipBack, SkipForward, SlidersHorizontal, Sparkles, Star, X } from "lucide-react";
import { bookAudioSupported, isRouted, levelOf, primeBookAudio, routeBook, setBookSound, setFade } from "./bookAudio";

type Api = (path: string, init?: { method?: string; body?: unknown }) => Promise<any>;
export type BookKind = "solo" | "group" | "dramatic";
export type Book = { id: string; title: string; author: string; cover: string; downloads: number; rating: number; reviews: number; about: string; reader: string; kind: BookKind; added: string; why?: string };
export type BookChapter = { n: number; title: string; sub: string; secs: number; audio: string; bytes: number };
export type BookDetail = Book & { chapters: BookChapter[]; secs: number; link: string; gutenberg: number };
/** What's playing: the book, the chapter (0-based) and where in it to start. */
export type Reading = { book: BookDetail; ch: number; at: number };

const API = String(import.meta.env.VITE_PODSCROLL_API || "https://arisereader.onrender.com").replace(/\/$/, "");
const ACCENT = "#ff6a1f";
const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
/** Listening choices, kept on this device. boost, even and silence are for members (they need the
 *  sound to come through the server); rewind is for everyone. */
type Listen = { boost: boolean; even: boolean; silence: boolean; rewind: boolean };
const readListen = (): Listen => {
  try { const v = JSON.parse(ls.get("podscroll.bookListen") || "null"); if (v && typeof v === "object") return { boost: !!v.boost, even: !!v.even, silence: !!v.silence, rewind: v.rewind !== false }; } catch { /* default */ }
  return { boost: ls.get("podscroll.bookBoost") === "1", even: false, silence: false, rewind: true };
};
/** Smart rewind: after a pause, back up a little, more the longer it was. */
export const rewindFor = (pausedSecs: number) => (pausedSecs < 10 ? 0 : pausedSecs < 60 ? 3 : pausedSecs < 600 ? 8 : pausedSecs < 3600 ? 15 : 30);
const KIND_LABEL: Record<BookKind, string> = { solo: "One reader", group: "Group of readers", dramatic: "Full cast" };

// ---- small things ----
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window */ } },
};
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
/** A chapter as people read it: its name, and what kind of part it is underneath. */
export const chapterName = (c: BookChapter) => ({ main: c.sub || c.title || `Part ${c.n}`, under: c.sub ? c.title : "" });

// ---- where each book was left, on this device ----
type Spot = { ch: number; t: number; at: number; title: string; author: string; cover: string; chapters: number };
const SPOTS = "podscroll.books";
export function bookSpots(): Record<string, Spot> {
  try { const v = JSON.parse(ls.get(SPOTS) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
function saveSpot(b: BookDetail, ch: number, t: number, finished = false) {
  const all = bookSpots();
  const last = finished || (ch >= b.chapters.length - 1 && !!b.chapters[ch]?.secs && t > b.chapters[ch].secs - 20);
  if (last) delete all[b.id];
  else all[b.id] = { ch, t: Math.floor(t), at: Date.now(), title: b.title, author: b.author, cover: b.cover, chapters: b.chapters.length };
  const keep = Object.entries(all).sort((a, z) => z[1].at - a[1].at).slice(0, 50);
  ls.set(SPOTS, JSON.stringify(Object.fromEntries(keep)));
}

// ---- bookmarks: moments saved with a note, on this device ----
export type Mark = { id: string; ch: number; t: number; note: string; at: number };
const MARKS = "podscroll.bookmarks";
export function marksOf(bookId: string): Mark[] {
  try { const v = JSON.parse(ls.get(MARKS) || "{}"); return Array.isArray(v?.[bookId]) ? v[bookId] : []; } catch { return []; }
}
function setMarks(bookId: string, list: Mark[]) {
  let all: Record<string, Mark[]> = {};
  try { const v = JSON.parse(ls.get(MARKS) || "{}"); if (v && typeof v === "object") all = v; } catch { /* start over */ }
  if (list.length) all[bookId] = list.slice(0, 200); else delete all[bookId];
  ls.set(MARKS, JSON.stringify(all));
  window.dispatchEvent(new Event("ps-book-marks"));
}
function useMarks(bookId: string): Mark[] {
  const [list, setList] = useState(() => marksOf(bookId));
  useEffect(() => { setList(marksOf(bookId)); const f = () => setList(marksOf(bookId)); window.addEventListener("ps-book-marks", f); return () => window.removeEventListener("ps-book-marks", f); }, [bookId]);
  return list;
}

// ---- books, fetched once per visit ----
const details = new Map<string, Promise<BookDetail>>();
function loadBook(api: Api, id: string): Promise<BookDetail> {
  let p = details.get(id);
  if (!p) { p = api(`/api/earshot/books/${encodeURIComponent(id)}`).then((b) => b.book as BookDetail); p.catch(() => details.delete(id)); details.set(id, p); }
  return p;
}

// ---- previews: a short taste of a reading, one at a time ----
let previewEl: HTMLAudioElement | null = null;
let previewStop: (() => void) | null = null;
function usePreview(api: Api) {
  const [on, setOn] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const stop = useCallback(() => { previewEl?.pause(); setOn(null); setPct(0); }, []);
  useEffect(() => () => { if (previewStop === stop) { previewEl?.pause(); previewStop = null; } }, [stop]);
  const play = useCallback(async (id: string, secs = 30) => {
    if (on === id) { stop(); return; }
    previewStop?.(); previewStop = stop;
    setOn(id); setPct(0);
    try {
      const b = await loadBook(api, id);
      const c = b.chapters[0];
      if (!c) { stop(); return; }
      previewEl ??= new Audio();
      const a = previewEl;
      // Past the LibriVox notice at the start of every chapter, into the reading itself.
      const from = c.secs > 120 ? 60 : 20;
      a.src = c.audio; a.currentTime = 0;
      a.onloadedmetadata = () => { try { a.currentTime = from; } catch { /* not seekable */ } };
      a.ontimeupdate = () => { const k = (a.currentTime - from) / secs; setPct(Math.max(0, Math.min(1, k))); if (k >= 1) stop(); };
      a.onerror = () => stop();
      await a.play();
    } catch { stop(); }
  }, [api, on, stop]);
  return { on, pct, play, stop };
}

function PreviewButton({ playing, pct, onClick, label, small }: { playing: boolean; pct: number; onClick: () => void; label: string; small?: boolean }) {
  const size = small ? 34 : 40, r = size / 2 - 2.5, len = 2 * Math.PI * r;
  return <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={playing ? "Stop preview" : label} title={playing ? "Stop preview" : label}
    className="ps-keep relative inline-flex shrink-0 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur" style={{ width: size, height: size }}>
    <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden><circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeDasharray={len} strokeDashoffset={len * (1 - pct)} opacity={playing ? 1 : 0} /></svg>
    {playing ? <Pause size={small ? 13 : 15} fill="currentColor" /> : <Headphones size={small ? 14 : 16} />}
  </button>;
}

/** One on/off setting with a line on what it does. */
function Toggle({ on, onClick, title, line, members }: { on: boolean; onClick: () => void; title: string; line: string; members?: boolean }) {
  return <div className="flex items-start justify-between gap-4">
    <div><p className="flex items-center gap-2 text-sm font-semibold">{title}{members && <MembersTag />}</p><p className="text-xs text-[#606060]">{line}</p></div>
    <button role="switch" aria-checked={on} aria-label={title} onClick={onClick} className={`relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${on ? "bg-[#ff6a1f]" : "bg-[#d3d3d3]"}`}><span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${on ? "translate-x-6" : "translate-x-1"}`} /></button>
  </div>;
}

/** A small "Members" tag on what's part of Pod+ Membership. */
function MembersTag() {
  return <span className="ps-keep rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: ACCENT }}>Members</span>;
}

function Cover({ src, title, className = "" }: { src: string; title: string; className?: string }) {
  const [bad, setBad] = useState(false);
  return <span className={`relative block overflow-hidden bg-[#f2f2f2] ${className}`}>
    {!bad ? <img src={src} alt="" loading="lazy" onError={() => setBad(true)} className="h-full w-full object-cover" />
      : <span className="flex h-full w-full items-center justify-center p-3 text-center text-sm font-semibold text-[#606060]">{title}</span>}
  </span>;
}

function Sheet({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
    <div className="absolute inset-0 bg-black/45" onClick={onClose} />
    <div className={`relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom,0px)] shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-[720px]" : "sm:max-w-[460px]"}`}>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#ececec] pl-5 pr-2">
        <h2 className="truncate text-base font-semibold">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2]"><X size={20} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  </div>;
}

// ---------------- the shelf ----------------

export function AudiobooksView({ api, pro, onJoin, current, onOpen }: { api: Api; /** A Pod+ member: Ask AI is theirs. */ pro: boolean; onJoin: () => void; current: Reading | null; onOpen: (id: string) => void }) {
  const [shelf, setShelf] = useState(() => ls.get("podscroll.bookShelf") || "all");
  const [sort, setSort] = useState(() => ls.get("podscroll.bookSort") || "popular");
  const [shelves, setShelves] = useState<{ id: string; label: string }[]>([{ id: "all", label: "All" }]);
  const [sorts, setSorts] = useState<{ id: string; label: string }[]>([{ id: "popular", label: "Most popular" }]);
  const [mode, setMode] = useState<"search" | "ai">("search");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState<{ kind: "search" | "ai"; q: string } | null>(null);
  const [list, setList] = useState<Book[] | null>(null);
  const [err, setErr] = useState("");
  const [retry, setRetry] = useState(0);
  const [spots] = useState(bookSpots);
  const going = Object.entries(spots).sort((a, z) => z[1].at - a[1].at).slice(0, 12);
  const preview = usePreview(api);

  useEffect(() => { ls.set("podscroll.bookShelf", shelf); ls.set("podscroll.bookSort", sort); }, [shelf, sort]);
  useEffect(() => {
    let live = true;
    setList(null); setErr("");
    const req = term?.kind === "ai"
      ? api("/api/earshot/books/ai", { method: "POST", body: { q: term.q } })
      : api(`/api/earshot/books?${new URLSearchParams(term ? { q: term.q, sort } : { shelf, sort })}`);
    req.then((b) => {
      if (!live) return;
      setList(Array.isArray(b?.books) ? b.books : []);
      if (Array.isArray(b?.shelves) && b.shelves.length) setShelves(b.shelves);
      if (Array.isArray(b?.sorts) && b.sorts.length) setSorts(b.sorts);
    }).catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [api, shelf, sort, term, retry]);

  const ai = mode === "ai";
  return <div className="px-4 pb-28 pt-3 sm:px-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><BookOpen size={24} strokeWidth={2} />Audiobooks</h1>
        <p className="mt-1 text-sm text-[#606060]">Thousands of classic books, read aloud. Free, with no ads.</p>
      </div>
      <form role="search" onSubmit={(e) => { e.preventDefault(); const t = q.trim(); if (t && mode === "ai" && !pro) { onJoin(); return; } setTerm(t ? { kind: mode, q: t } : null); }} className="flex w-full max-w-[440px] flex-col gap-2">
        <div role="group" aria-label="How to search" className="flex gap-1 self-start rounded-full bg-[#f2f2f2] p-0.5 text-xs font-semibold">
          <button type="button" aria-pressed={!ai} onClick={() => setMode("search")} className={`h-7 rounded-full px-3 ${!ai ? "bg-white shadow-sm" : "text-[#606060]"}`}>Search</button>
          <button type="button" aria-pressed={ai} onClick={() => setMode("ai")} className={`inline-flex h-7 items-center gap-1 rounded-full px-3 ${ai ? "bg-white shadow-sm" : "text-[#606060]"}`}><Sparkles size={13} />Ask AI{!pro && <MembersTag />}</button>
        </div>
        <div className="flex items-center">
          <label htmlFor="ps-book-q" className="sr-only">{ai ? "Describe a book you'd like" : "Find a book or author"}</label>
          <input id="ps-book-q" type="search" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setTerm(null); }} maxLength={ai ? 300 : 80}
            placeholder={ai ? "Like Sherlock Holmes, but spookier…" : "Find a book or author"} className="h-10 min-w-0 flex-1 rounded-l-full border border-r-0 border-[#d3d3d3] px-4 text-sm outline-none focus:border-[#1c62b9]" />
          <button type="submit" aria-label={ai ? "Ask AI" : "Find book"} className="inline-flex h-10 w-12 shrink-0 items-center justify-center rounded-r-full border border-[#d3d3d3] bg-[#f8f8f8]">{ai ? <Sparkles size={18} /> : <Search size={18} />}</button>
        </div>
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

    {term ? <div className="mt-5 flex items-center gap-2 text-sm">
      <span className="min-w-0 truncate text-[#606060]">{term.kind === "ai" ? <>AI picks for “{term.q}”</> : <>Results for “{term.q}”</>}</span>
      <button onClick={() => { setTerm(null); setQ(""); }} className="h-8 shrink-0 rounded-full px-3 font-medium text-[#065fd4] hover:bg-[#def1ff]">Clear</button>
    </div>
      : <div className="mt-5 flex items-center gap-3">
        <div role="group" aria-label="Shelves" className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {shelves.map((s) => {
            const on = shelf === s.id;
            return <button key={s.id} onClick={() => setShelf(s.id)} aria-pressed={on} className={`h-8 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-medium ${on ? "bg-[#0f0f0f] text-white" : "bg-[#f2f2f2] hover:bg-[#e5e5e5]"}`}>{s.label}</button>;
          })}
        </div>
        <label className="relative shrink-0">
          <span className="sr-only">Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-8 appearance-none rounded-lg border border-[#d3d3d3] bg-white pl-3 pr-8 text-sm font-medium outline-none">
            {sorts.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <ChevronRight size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-[#606060]" />
        </label>
      </div>}

    {err ? <div className="py-20 text-center"><p className="text-[#606060]">{err}</p><button onClick={() => setRetry((n) => n + 1)} className="mt-4 h-9 rounded-full bg-[#0f0f0f] px-4 text-sm font-semibold text-white">Try again</button></div>
      : !list ? <div className="flex flex-col items-center gap-3 py-24" role="status" aria-label="Loading audiobooks"><Loader2 className="animate-spin text-[#606060]" size={28} />{term?.kind === "ai" && <span className="text-sm text-[#606060]">Finding books you'll like…</span>}</div>
      : !list.length ? <p className="py-20 text-center text-[#606060]">{term ? `Nothing found for “${term.q}”. Try other words.` : "Nothing on this shelf right now. Try another one."}</p>
      : <div className="mt-4 grid gap-x-4 gap-y-6 [grid-template-columns:repeat(auto-fill,minmax(min(150px,45%),1fr))]">
        {list.map((b, i) => {
          const on = current?.book.id === b.id;
          return <div key={b.id} className="group min-w-0" data-testid={`ps-book-${b.id}`}>
            <span className="relative block">
              <button onClick={() => onOpen(b.id)} className="block w-full" aria-label={`Open ${b.title}`}>
                <Cover src={b.cover} title={b.title} className={`aspect-square w-full rounded-xl transition group-hover:scale-[1.02] ${on ? "ring-2 ring-[#ff6a1f]" : ""}`} />
              </button>
              {!term && sort === "popular" && shelf === "all" && i < 10 && <span className="ps-keep pointer-events-none absolute left-2 top-2 rounded-md bg-[#0f0f0f]/80 px-1.5 text-xs font-bold text-white">#{i + 1}</span>}
              <span className="absolute bottom-2 right-2"><PreviewButton small playing={preview.on === b.id} pct={preview.on === b.id ? preview.pct : 0} onClick={() => void preview.play(b.id)} label={`Preview ${b.title}`} /></span>
            </span>
            <button onClick={() => onOpen(b.id)} className="block w-full text-left">
              <span className="mt-2 line-clamp-2 block text-sm font-semibold leading-snug">{b.title}</span>
              <span className="block truncate text-xs text-[#606060]">{b.author}</span>
              {b.why ? <span className="mt-1 block text-xs leading-snug text-[#3a3a3a]">{b.why}</span>
                : <span className="mt-0.5 flex items-center gap-1 text-xs text-[#606060]">
                  {b.rating > 0 && <><Star size={12} fill="currentColor" className="text-[#f5a623]" />{b.rating.toFixed(1)}<span aria-hidden>·</span></>}
                  <Headphones size={12} />{listens(b.downloads)}
                </span>}
            </button>
          </div>;
        })}
      </div>}
    <p className="mt-8 text-xs text-[#767676]">Audiobooks from <a href="https://librivox.org" target="_blank" rel="noreferrer" className="underline">LibriVox</a>, read by volunteers, kept at the <a href="https://archive.org/details/librivoxaudio" target="_blank" rel="noreferrer" className="underline">Internet Archive</a>. All public domain.</p>
  </div>;
}

// ---------------- one book ----------------

export function BookPage({ api, id, current, playing, onPlay, onToggle, onBack, onOpen }: { api: Api; id: string; current: Reading | null; playing: boolean; onPlay: (r: Reading) => void; onToggle: () => void; onBack: () => void; onOpen: (id: string) => void }) {
  const [book, setBook] = useState<BookDetail | null>(null);
  const [err, setErr] = useState("");
  const [more, setMore] = useState(false);
  const [readers, setReaders] = useState(false);
  useEffect(() => {
    let live = true;
    setBook(null); setErr("");
    loadBook(api, id).then((b) => { if (live) setBook(b); }).catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [api, id]);
  const spot = bookSpots()[id];
  const here = current?.book.id === id;

  if (err) return <div className="px-4 py-20 text-center"><p className="text-[#606060]">{err}</p><button onClick={onBack} className="mt-4 h-9 rounded-full bg-[#0f0f0f] px-4 text-sm font-semibold text-white">Back to audiobooks</button></div>;
  if (!book) return <div className="flex justify-center py-32" role="status" aria-label="Loading audiobook"><Loader2 className="animate-spin text-[#606060]" size={28} /></div>;

  const startCh = here ? current!.ch : spot ? Math.min(spot.ch, book.chapters.length - 1) : 0;
  const play = (r: Reading) => { primeBookAudio(); onPlay(r); };
  const main = () => (here ? onToggle() : play({ book, ch: startCh, at: spot && !here ? spot.t : 0 }));
  const label = here ? (playing ? "Pause" : "Play") : spot ? `Resume · Chapter ${startCh + 1}` : "Play";
  // Another reading: the same place in the book (chapter number), in the new voice.
  const switchTo = async (otherId: string) => {
    setReaders(false);
    try {
      const other = await loadBook(api, otherId);
      const ch = Math.min(here ? current!.ch : startCh, other.chapters.length - 1);
      if (here) play({ book: other, ch, at: 0 });
      onOpen(otherId);
    } catch (e: any) { setErr(e.message); }
  };

  return <div className="mx-auto max-w-[760px] px-4 pb-28 pt-2 sm:px-6">
    <button onClick={onBack} className="-ml-2 mb-2 inline-flex h-9 items-center gap-1 rounded-full pl-1 pr-3 text-sm font-medium hover:bg-[#f2f2f2]"><ChevronLeft size={20} />Audiobooks</button>
    <div className="flex flex-col items-center text-center">
      <div className="relative w-[min(72vw,300px)]">
        <img src={book.cover} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full scale-110 rounded-3xl object-cover opacity-40 blur-2xl" />
        <Cover src={book.cover} title={book.title} className="relative aspect-square w-full rounded-2xl shadow-2xl" />
      </div>
      <h1 className="mt-6 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{book.title}</h1>
      {book.author && <p className="mt-1 text-[15px] text-[#606060]">{book.author}</p>}
      <button onClick={() => setReaders(true)} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-[#f2f2f2] px-3 text-xs font-semibold hover:bg-[#e5e5e5]" data-testid="ps-book-readers">
        {book.kind === "solo" ? `Read by ${book.reader}` : KIND_LABEL[book.kind]}<span className="text-[#065fd4]">· Change reader</span>
      </button>
      <p className="mt-2 text-xs text-[#767676]">{[`${book.chapters.length} chapters`, hours(book.secs)].filter(Boolean).join(" · ")}</p>
      <button onClick={main} className="mt-5 inline-flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white" style={{ background: ACCENT }} data-testid="ps-book-play">
        {here && playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}{label}
      </button>
    </div>

    {book.about && <div className="mt-7">
      <p className={`text-sm leading-relaxed text-[#3a3a3a] ${more ? "" : "line-clamp-3"}`}>{book.about}</p>
      {book.about.length > 200 && <button onClick={() => setMore((v) => !v)} className="mt-1 text-sm font-semibold">{more ? "Less" : "More"}</button>}
    </div>}

    <Bookmarks book={book} onJump={(m) => play({ book, ch: Math.min(m.ch, book.chapters.length - 1), at: m.t })} />

    <h2 className="mt-7 text-base font-semibold">Chapters</h2>
    <ol className="mt-2 divide-y divide-[#ececec]">
      {book.chapters.map((c, i) => {
        const now = here && current!.ch === i;
        const { main: name, under } = chapterName(c);
        return <li key={c.n}>
          <button onClick={() => (now ? onToggle() : play({ book, ch: i, at: 0 }))} className="flex min-h-[3.25rem] w-full items-center gap-4 py-2 text-left">
            <span className="w-6 shrink-0 text-right text-sm tabular-nums" style={{ color: now ? ACCENT : "#9a9a9a" }}>
              {now && playing ? <span className="inline-flex items-end gap-[2px]" aria-label="Playing">{[0, 1, 2].map((k) => <span key={k} className="inline-block w-[3px] rounded-sm motion-safe:animate-pulse" style={{ height: 6 + k * 3, background: ACCENT, animationDelay: `${k * 0.15}s` }} />)}</span> : c.n}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={`truncate text-[15px] ${now ? "font-semibold" : ""}`}>{name}</span>
              {under && <span className="truncate text-xs text-[#767676]">{under}</span>}
            </span>
            <span className="shrink-0 text-xs tabular-nums text-[#767676]">{c.secs ? clock(c.secs) : ""}</span>
          </button>
        </li>;
      })}
    </ol>
    <p className="mt-8 text-xs text-[#767676]">A <a href="https://librivox.org" target="_blank" rel="noreferrer" className="underline">LibriVox</a> recording, public domain. <a href={book.link} target="_blank" rel="noreferrer" className="underline">See it at the Internet Archive</a>.</p>
    {readers && <ReadersSheet api={api} book={book} onClose={() => setReaders(false)} onPick={(otherId) => void switchTo(otherId)} />}
  </div>;
}

/** The book's bookmarks: tap one to play from there. */
function Bookmarks({ book, onJump }: { book: BookDetail; onJump: (m: Mark) => void }) {
  const marks = useMarks(book.id);
  if (!marks.length) return null;
  return <section aria-label="Bookmarks" className="mt-7">
    <h2 className="flex items-center gap-2 text-base font-semibold"><Bookmark size={17} />Bookmarks</h2>
    <ul className="mt-2 divide-y divide-[#ececec]">
      {[...marks].sort((a, z) => a.ch - z.ch || a.t - z.t).map((m) => {
        const c = book.chapters[m.ch];
        return <li key={m.id} className="flex items-center gap-2">
          <button onClick={() => onJump(m)} className="flex min-h-12 min-w-0 flex-1 flex-col justify-center py-2 text-left">
            <span className="truncate text-[15px]">{m.note || (c ? chapterName(c).main : `Chapter ${m.ch + 1}`)}</span>
            <span className="truncate text-xs text-[#767676]">{c ? chapterName(c).main : `Chapter ${m.ch + 1}`} · {clock(m.t)}</span>
          </button>
          <button onClick={() => setMarks(book.id, marksOf(book.id).filter((x) => x.id !== m.id))} aria-label="Delete bookmark" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#767676] hover:bg-[#f2f2f2]"><X size={16} /></button>
        </li>;
      })}
    </ul>
  </section>;
}

/** Every reading of this book, to hear a little of each and pick the voice you like. */
function ReadersSheet({ api, book, onClose, onPick }: { api: Api; book: BookDetail; onClose: () => void; onPick: (id: string) => void }) {
  const [list, setList] = useState<Book[] | null>(null);
  const [err, setErr] = useState("");
  const preview = usePreview(api);
  useEffect(() => {
    let live = true;
    api(`/api/earshot/books/${encodeURIComponent(book.id)}/versions`).then((b) => { if (live) setList(Array.isArray(b?.versions) ? b.versions : []); }).catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; preview.stop(); };
  }, [api, book.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Sheet title="Choose a reader" onClose={onClose}>
    <p className="px-5 pt-3 text-sm text-[#606060]">Tap the headphones to hear a little of each reading. Switching keeps your place in the book.</p>
    {err ? <p className="px-5 py-10 text-center text-[#606060]">{err}</p>
      : !list ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#606060]" size={24} /></div>
      : <ul className="px-3 py-2">
        {list.map((v) => {
          const on = v.id === book.id;
          return <li key={v.id} className={`flex items-center gap-3 rounded-xl px-2 py-2.5 ${on ? "bg-[#fff1e8]" : ""}`}>
            <PreviewButton playing={preview.on === v.id} pct={preview.on === v.id ? preview.pct : 0} onClick={() => void preview.play(v.id, 20)} label={`Hear ${v.reader}`} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{v.kind === "solo" ? v.reader : KIND_LABEL[v.kind]}</span>
              <span className="truncate text-xs text-[#606060]">{[KIND_LABEL[v.kind], v.rating > 0 ? `★ ${v.rating.toFixed(1)}` : "", `${listens(v.downloads)} listens`].filter(Boolean).join(" · ")}</span>
            </span>
            {on ? <span className="shrink-0 text-xs font-semibold" style={{ color: ACCENT }}>Listening</span>
              : <button onClick={() => { preview.stop(); onPick(v.id); }} className="h-8 shrink-0 rounded-full bg-[#0f0f0f] px-3 text-xs font-semibold text-white">Use this one</button>}
          </li>;
        })}
      </ul>}
  </Sheet>;
}

// ---------------- read along ----------------

type TextSection = { heading: string; text: string };
type TxLine = { s: number; e: number; t: string };
/** The number in "Chapter 12" or "CHAPTER XII." (12). */
const numIn = (s: string): number => {
  const m = /^\S+\s+(\d{1,3}|[IVXLCDM]{1,8})\b/.exec(s.trim());
  if (!m) return 0;
  if (/^\d+$/.test(m[1])) return Number(m[1]);
  const R: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let t = 0; for (let i = 0; i < m[1].length; i++) { const v = R[m[1][i]], n = R[m[1][i + 1]] || 0; t += v < n ? -v : v; }
  return t;
};
/** Which part of the book's text goes with this chapter: the same numbered part when the names
 *  say, else the same place along the book. */
function sectionFor(sections: TextSection[], book: BookDetail, ch: number): number {
  const c = book.chapters[ch];
  const word = (c?.title.split(" ")[0] || "").toLowerCase(), n = numIn(c?.title || "");
  if (n && /^(chapter|book|part|letter|stave|section|canto|act|lecture|volume)$/.test(word)) {
    const hit = sections.findIndex((s) => s.heading.toLowerCase().startsWith(word) && numIn(s.heading) === n);
    if (hit >= 0) return hit;
  }
  const byName = c?.sub ? sections.findIndex((s) => s.heading.toLowerCase().includes(c.sub.toLowerCase().slice(0, 24))) : -1;
  if (byName >= 0) return byName;
  return Math.min(sections.length - 1, Math.round((ch / Math.max(1, book.chapters.length)) * sections.length));
}

function ReadAlong({ api, pro, onJoin, reading, time, onSeek, onClose }: { api: Api; pro: boolean; onJoin: () => void; reading: Reading; time: number; onSeek: (t: number) => void; onClose: () => void }) {
  const { book, ch } = reading;
  const [tab, setTab] = useState<"text" | "transcript">("text");
  const [text, setText] = useState<{ sections: TextSection[]; source: string } | null | "none">(null);
  const [at, setAt] = useState(0);
  const [lines, setLines] = useState<TxLine[]>([]);
  const [txErr, setTxErr] = useState("");
  const [txMore, setTxMore] = useState(true);
  const asked = useRef(new Set<number>());
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    api(`/api/earshot/books/${encodeURIComponent(book.id)}/text`).then((b) => { if (live) setText(Array.isArray(b?.sections) && b.sections.length ? b : "none"); })
      .catch(() => { if (live) { setText("none"); setTab("transcript"); } });
    return () => { live = false; };
  }, [api, book.id]);
  useEffect(() => { if (text && text !== "none") setAt(sectionFor(text.sections, book, ch)); }, [text, book, ch]);
  useEffect(() => { setLines([]); setTxErr(""); setTxMore(true); asked.current.clear(); }, [book.id, ch]);

  // The transcript, 10 minutes at a time, a little before the listener gets there.
  const piece = Math.floor(time / 600);
  useEffect(() => {
    if (tab !== "transcript" || !pro) return;
    for (const k of [piece, piece + (time % 600 > 480 ? 1 : 0)]) {
      if (asked.current.has(k) || (k > piece && !txMore)) continue;
      asked.current.add(k);
      api(`/api/earshot/books/${encodeURIComponent(book.id)}/transcript?ch=${ch}&piece=${k}`).then((b) => {
        setLines((cur) => [...cur, ...(Array.isArray(b?.lines) ? b.lines : [])].sort((x, y) => x.s - y.s));
        if (k === piece && b?.more === false) setTxMore(false);
      }).catch((e) => setTxErr(e.message));
    }
  }, [tab, piece, time, api, book.id, ch, txMore]);
  const activeLine = useMemo(() => { let i = -1; for (let k = 0; k < lines.length; k++) if (lines[k].s <= time) i = k; return i; }, [lines, time]);
  useEffect(() => {
    if (tab !== "transcript" || activeLine < 0) return;
    box.current?.querySelector(`[data-line="${activeLine}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeLine, tab]);

  const sec = text && text !== "none" ? text.sections[at] : null;
  const { main: name } = chapterName(book.chapters[ch]);
  return <Sheet title={`${book.title} · ${name}`} onClose={onClose} wide>
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#ececec] bg-white px-4 py-2">
      <div role="group" aria-label="Read along" className="flex gap-1 rounded-full bg-[#f2f2f2] p-0.5 text-xs font-semibold">
        <button aria-pressed={tab === "text"} onClick={() => setTab("text")} className={`h-7 rounded-full px-3 ${tab === "text" ? "bg-white shadow-sm" : "text-[#606060]"}`}>Book text</button>
        <button aria-pressed={tab === "transcript"} onClick={() => setTab("transcript")} className={`inline-flex h-7 items-center gap-1 rounded-full px-3 ${tab === "transcript" ? "bg-white shadow-sm" : "text-[#606060]"}`}><Sparkles size={12} />Transcript{!pro && <MembersTag />}</button>
      </div>
      {tab === "text" && sec && <span className="ml-auto flex items-center gap-1">
        <button onClick={() => setAt((n) => Math.max(0, n - 1))} disabled={at === 0} aria-label="Previous part" className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#f2f2f2] disabled:opacity-30"><ChevronLeft size={18} /></button>
        <button onClick={() => setAt((n) => Math.min((text as any).sections.length - 1, n + 1))} disabled={at >= (text as any).sections.length - 1} aria-label="Next part" className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#f2f2f2] disabled:opacity-30"><ChevronRight size={18} /></button>
      </span>}
    </div>
    <div ref={box} className="px-5 pb-10 pt-4 sm:px-8">
      {tab === "text" ? (
        text === null ? <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#606060]" size={24} /></div>
          : text === "none" ? <div className="py-10 text-center text-sm text-[#606060]"><p>This book's text isn't available.</p><button onClick={() => setTab("transcript")} className="mt-3 h-9 rounded-full bg-[#0f0f0f] px-4 font-semibold text-white">Use the transcript</button></div>
          : <article className="mx-auto max-w-[620px]">
            <h3 className="mb-4 font-serif text-xl font-semibold">{sec!.heading}</h3>
            {sec!.text.split(/\n{2,}/).map((p, i) => <p key={i} className="mb-4 whitespace-pre-line font-serif text-[17px] leading-[1.75] text-[#0f0f0f]">{p}</p>)}
            <p className="mt-8 text-xs text-[#767676]">The book's original text, from <a href={text.source} target="_blank" rel="noreferrer" className="underline">Project Gutenberg</a> (public domain). The reading may differ a little.</p>
          </article>
      ) : (
        !pro ? <div className="mx-auto max-w-[420px] py-10 text-center">
          <Sparkles className="mx-auto" size={26} style={{ color: ACCENT }} />
          <p className="mt-3 text-base font-semibold">AI transcripts are for Pod+ members</p>
          <p className="mt-1 text-sm text-[#606060]">Follow every word as it's read, and tap any line to jump there. The book's own text is free in the Book text tab.</p>
          <button onClick={onJoin} className="mt-4 h-10 rounded-full px-5 text-sm font-semibold text-white" style={{ background: ACCENT }}>Become a member</button>
        </div>
        : <div className="mx-auto max-w-[620px]">
          {!lines.length && !txErr && <div className="flex flex-col items-center gap-2 py-12 text-sm text-[#606060]"><Loader2 className="animate-spin" size={24} />Writing out this part with AI…</div>}
          {txErr && <div className="py-6 text-center text-sm text-[#606060]"><p>{txErr}</p><button onClick={() => { asked.current.clear(); setTxErr(""); setLines([]); }} className="mt-3 h-9 rounded-full bg-[#0f0f0f] px-4 font-semibold text-white">Try again</button></div>}
          {lines.map((l, i) => <button key={`${l.s}-${i}`} data-line={i} onClick={() => onSeek(l.s)}
            className={`block w-full rounded-lg px-2 py-1.5 text-left text-[17px] leading-relaxed transition-colors ${i === activeLine ? "bg-[#fff1e8] font-medium text-[#0f0f0f]" : "text-[#606060] hover:bg-[#f7f7f5]"}`}>{l.t}</button>)}
          {lines.length > 0 && <p className="mt-6 text-xs text-[#767676]">Written out by AI from the recording, so a few words may be off. Tap a line to jump there.</p>}
        </div>
      )}
    </div>
  </Sheet>;
}

/** Saves this moment, with a note if you like. */
function MarkSheet({ book, ch, t, onClose, onSaved }: { book: BookDetail; ch: number; t: number; onClose: () => void; onSaved: () => void }) {
  const [note, setNote] = useState("");
  const at = useRef(Math.max(0, Math.floor(t))).current;
  const c = book.chapters[ch];
  const save = () => {
    const m: Mark = { id: Math.random().toString(36).slice(2, 10), ch, t: at, note: note.replace(/\s+/g, " ").trim().slice(0, 140), at: Date.now() };
    setMarks(book.id, [...marksOf(book.id), m]);
    onSaved();
  };
  return <Sheet title="Add a bookmark" onClose={onClose}>
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-4 px-5 py-5">
      <p className="text-sm text-[#606060]">{c ? chapterName(c).main : `Chapter ${ch + 1}`} · {clock(at)}</p>
      <label className="block">
        <span className="text-sm font-semibold">Note (optional)</span>
        <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="A line I liked, where Darcy proposes…" className="mt-1.5 h-11 w-full rounded-xl border border-[#d3d3d3] px-3 text-sm outline-none focus:border-[#1c62b9]" />
      </label>
      <button type="submit" className="h-11 w-full rounded-full text-sm font-semibold text-white" style={{ background: ACCENT }}>Save bookmark</button>
    </form>
  </Sheet>;
}

// ---------------- the bar ----------------

const SLEEPS: [string, number | "end" | null][] = [["Off", null], ["15 min", 15], ["30 min", 30], ["45 min", 45], ["1 hour", 60], ["End of chapter", "end"]];

/** The bar at the bottom while a book plays: plays chapter after chapter, and remembers the spot. */
export function AudiobookBar({ api, pro, onJoin, reading, tap, onChange, onStop, onOpen, onPlaying, say }: { api: Api; /** A Pod+ member: AI transcripts and Voice boost are theirs. */ pro: boolean; onJoin: () => void; reading: Reading; /** Goes up each time the book page's Play/Pause is tapped. */ tap: number; onChange: (r: Reading) => void; onStop: () => void; onOpen: () => void; onPlaying: (on: boolean) => void; say: (m: string) => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [speed, setSpeed] = useState<number>(() => { const n = Number(ls.get("podscroll.bookSpeed")); return n >= 0.5 && n <= 3 ? n : 1; });
  const [listen, setListen] = useState<Listen>(readListen);
  // The sound features need membership (and a browser that can shape sound).
  const can = pro && bookAudioSupported();
  const boost = listen.boost && can, even = listen.even && can, silence = listen.silence && can;
  const shaped = boost || even || silence;
  const pausedAt = useRef(0);
  const [sleepAt, setSleepAt] = useState<number | "end" | null>(null);
  const [sheet, setSheet] = useState<"settings" | "read" | "mark" | null>(null);
  const { book, ch } = reading;
  const chapter = book.chapters[ch];
  const lastSave = useRef(0);
  // Once a player's sound is routed through the boost, it must keep coming through the server.
  const routed = useRef(false);

  const go = useCallback((n: number) => {
    if (n < 0 || n >= book.chapters.length) return;
    onChange({ book, ch: n, at: 0 });
  }, [book, onChange]);
  // Voice boost's audio comes through the server with a member's pass (good for 12 hours).
  const pass = useRef<{ k: string; exp: number } | null>(null);
  const getPass = async () => {
    if (pass.current && pass.current.exp > Date.now() + 60_000) return pass.current.k;
    const b = await api("/api/earshot/books/relay-pass");
    pass.current = { k: String(b.pass), exp: Number(String(b.pass).split(".")[0]) * 1000 };
    return pass.current.k;
  };
  const relayUrl = (c: BookChapter, k: string) => `${API}/api/podscroll/books/audio?u=${encodeURIComponent(c.audio)}&k=${encodeURIComponent(k)}`;

  useEffect(() => {
    const a = audio.current; if (!a || !chapter) return;
    setLoading(true); setTime(reading.at); setDur(chapter.secs);
    let alive = true;
    const seek = () => { if (reading.at > 0) { try { a.currentTime = reading.at; } catch { /* not seekable yet */ } } };
    const start = (src: string) => {
      if (!alive) return;
      a.src = src; a.playbackRate = speed;
      a.addEventListener("loadedmetadata", seek, { once: true });
      a.play().catch(() => { setLoading(false); say("Tap play to start the book."); });
    };
    pausedAt.current = 0;
    setFade(a, 1);
    if (shaped || routed.current) {
      a.crossOrigin = "anonymous";
      getPass().then((k) => start(relayUrl(chapter, k))).catch(() => {
        // Not a member any more: play it as it is (a player already routed through the boost can't).
        if (routed.current) say("Sign in again to keep the sound settings on.");
        a.removeAttribute("crossorigin"); start(chapter.audio);
      });
    } else { a.removeAttribute("crossorigin"); start(chapter.audio); }
    try {
      if ("mediaSession" in navigator) {
        const { main } = chapterName(chapter);
        navigator.mediaSession.metadata = new MediaMetadata({ title: main, artist: book.author || "LibriVox", album: book.title, artwork: [{ src: book.cover, sizes: "300x300" }] });
        const ms = navigator.mediaSession;
        ms.setActionHandler("play", () => { audio.current?.play().catch(() => {}); });
        ms.setActionHandler("pause", () => audio.current?.pause());
        ms.setActionHandler("previoustrack", ch > 0 ? () => go(ch - 1) : null);
        ms.setActionHandler("nexttrack", ch < book.chapters.length - 1 ? () => go(ch + 1) : null);
        ms.setActionHandler("seekbackward", () => { const x = audio.current; if (x) x.currentTime = Math.max(0, x.currentTime - 15); });
        ms.setActionHandler("seekforward", () => { const x = audio.current; if (x) x.currentTime = x.currentTime + 30; });
      }
    } catch { /* older browsers */ }
    return () => { alive = false; a.removeEventListener("loadedmetadata", seek); if (a.currentTime > 0) saveSpot(book, ch, a.currentTime); a.pause(); };
  }, [book, ch]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { const a = audio.current; if (a) { a.pause(); a.removeAttribute("src"); a.load(); } }, []);
  useEffect(() => { onPlaying(playing); }, [playing, onPlaying]);

  // Sound settings on: this chapter comes through the server from where it is, and is shaped.
  const setSound = async (patch: Partial<Listen>) => {
    const wantsShape = patch.boost || patch.even || patch.silence;
    if (wantsShape && !pro) { setSheet(null); say("Sound settings are part of Pod+ Membership."); onJoin(); return; }
    const next = { ...listen, ...patch };
    setListen(next); ls.set("podscroll.bookListen", JSON.stringify(next));
    const a = audio.current;
    if (!a || !wantsShape) { if (a) setBookSound(a, { boost: next.boost && can, even: next.even && can }); return; }
    primeBookAudio();
    if (!routed.current && a.crossOrigin !== "anonymous") {
      let k = "";
      try { k = await getPass(); } catch (e: any) { setListen(listen); say(e?.message || "This isn't available right now."); return; }
      const t = a.currentTime, was = !a.paused;
      a.crossOrigin = "anonymous"; a.src = relayUrl(chapter, k);
      a.addEventListener("loadedmetadata", () => { try { a.currentTime = t; } catch { /* ignore */ } }, { once: true });
      if (was) a.play().catch(() => {});
    }
    setBookSound(a, { boost: next.boost && can, even: next.even && can });
  };
  useEffect(() => { const a = audio.current; if (a && isRouted(a)) setBookSound(a, { boost, even }); }, [boost, even]);

  // Skip silences: long pauses between sentences go by at a quicker pace.
  useEffect(() => {
    const a = audio.current;
    if (!silence || !playing || !a) return;
    let quiet = 0, fast = false;
    const id = setInterval(() => {
      const lvl = levelOf(a);
      if (lvl < 0) return;
      quiet = lvl < 0.012 ? quiet + 100 : 0;
      const want = quiet >= 450;
      if (want !== fast) { fast = want; a.playbackRate = want ? Math.min(4, speed * 2.5) : speed; }
    }, 100);
    return () => { clearInterval(id); a.playbackRate = speed; };
  }, [silence, playing, speed]);

  // Sleep timer.
  useEffect(() => {
    if (typeof sleepAt !== "number") return;
    const id = setInterval(() => {
      const a = audio.current; if (!a) return;
      const left = sleepAt - Date.now();
      // The last minute fades out, so it doesn't stop with a jolt.
      if (left <= 60_000) setFade(a, left / 60_000);
      if (left <= 0) { a.pause(); setSleepAt(null); setFade(a, 1); say("Sleep timer: paused."); }
    }, 500);
    return () => { clearInterval(id); if (audio.current) setFade(audio.current, 1); };
  }, [sleepAt, say]);

  const toggle = () => { const a = audio.current; if (!a) return; if (a.paused) { if (shaped) primeBookAudio(); a.play().catch(() => say("This chapter won't play right now. Try again.")); } else a.pause(); };
  const firstTap = useRef(tap);
  useEffect(() => { if (tap !== firstTap.current) toggle(); }, [tap]); // eslint-disable-line react-hooks/exhaustive-deps
  const skip = (d: number) => { const a = audio.current; if (a) a.currentTime = Math.max(0, Math.min((a.duration || dur || 0) - 1, a.currentTime + d)); };
  const pickSpeed = (next: number) => { next = Math.round(Math.min(3, Math.max(0.5, next)) * 20) / 20; setSpeed(next); if (audio.current) audio.current.playbackRate = next; ls.set("podscroll.bookSpeed", String(next)); };
  const pct = dur ? Math.min(100, (time / dur) * 100) : 0;
  const { main: chName } = chapterName(chapter || { n: ch + 1, title: "", sub: "", secs: 0, audio: "", bytes: 0 });
  const sleepWords = sleepAt === null ? "" : sleepAt === "end" ? "End of chapter" : `${Math.max(1, Math.ceil((sleepAt - Date.now()) / 60000))} min`;

  return <div role="region" aria-label="Now playing audiobook" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e5e5e5] bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur">
    <input type="range" min={0} max={dur || 1} step={1} value={Math.min(time, dur || 1)} aria-label="Position in chapter"
      onChange={(e) => { const a = audio.current; const v = Number(e.target.value); setTime(v); if (a) a.currentTime = v; }}
      className="ps-book-range absolute -top-[7px] left-0 h-[14px] w-full cursor-pointer appearance-none bg-transparent"
      style={{ background: `linear-gradient(to right, ${ACCENT} ${pct}%, transparent ${pct}%) center / 100% 3px no-repeat` }} />
    <style>{".ps-book-range::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#ff6a1f}.ps-book-range::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:50%;background:#ff6a1f}"}</style>
    <div className="mx-auto flex max-w-[1600px] items-center gap-1.5 px-3 py-2.5 sm:gap-2.5 sm:px-5">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Open ${book.title}`}>
        <Cover src={book.cover} title={book.title} className="h-11 w-11 shrink-0 rounded-lg" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">{book.title}</span>
          <span className="truncate text-xs text-[#606060]">{chName} · {clock(time)}{dur ? ` / ${clock(dur)}` : ""}{sleepWords ? ` · Sleep ${sleepWords}` : ""}</span>
        </span>
      </button>
      <button onClick={() => setSheet("mark")} aria-label="Add a bookmark" title="Add a bookmark" className="hidden h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2] sm:inline-flex"><Bookmark size={18} /></button>
      <button onClick={() => setSheet("read")} aria-label="Read along" title="Read along" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2]"><BookOpenText size={19} /></button>
      <button onClick={() => go(ch - 1)} disabled={ch === 0} aria-label="Previous chapter" className="hidden h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2] disabled:opacity-30 md:inline-flex"><SkipBack size={18} /></button>
      <button onClick={() => skip(-15)} aria-label="Back 15 seconds" className="hidden h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2] sm:inline-flex"><RotateCcw size={19} /></button>
      <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0f0f0f] text-white">{loading && !playing ? <Loader2 className="animate-spin" size={20} /> : playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}</button>
      <button onClick={() => skip(30)} aria-label="Forward 30 seconds" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2]"><RotateCw size={19} /></button>
      <button onClick={() => go(ch + 1)} disabled={ch >= book.chapters.length - 1} aria-label="Next chapter" className="hidden h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2] disabled:opacity-30 md:inline-flex"><SkipForward size={18} /></button>
      <button onClick={() => setSheet("settings")} aria-label="Listening settings" title="Speed, sleep timer, sound" className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2]"><SlidersHorizontal size={18} /></button>
      <button onClick={onStop} aria-label="Close audiobook" className="hidden h-10 w-10 items-center justify-center rounded-full hover:bg-[#f2f2f2] sm:inline-flex"><X size={18} /></button>
      <audio ref={audio} preload="auto"
        onPlaying={() => { setPlaying(true); setLoading(false); const a = audio.current; if (a && shaped && !routed.current && a.crossOrigin === "anonymous") { primeBookAudio(); if (routeBook(a)) { routed.current = true; setBookSound(a, { boost, even }); } } }}
        onPlay={() => {
          // Smart rewind: back up a little after a pause, more the longer it was.
          const a = audio.current; if (!a || !pausedAt.current || !listen.rewind) return;
          const back = rewindFor((Date.now() - pausedAt.current) / 1000);
          pausedAt.current = 0;
          if (back) a.currentTime = Math.max(0, a.currentTime - back);
        }}
        onPause={() => { setPlaying(false); const a = audio.current; if (a && !a.ended) pausedAt.current = Date.now(); if (a && a.currentTime > 0) saveSpot(book, ch, a.currentTime); }} onWaiting={() => setLoading(true)}
        onLoadedMetadata={() => { const a = audio.current; if (a && Number.isFinite(a.duration)) setDur(a.duration); if (a) a.playbackRate = speed; }}
        onTimeUpdate={() => { const a = audio.current; if (!a) return; setTime(a.currentTime); if (sleepAt === "end" && a.duration) { const left = a.duration - a.currentTime; if (left < 30) setFade(a, left / 30); } if (Date.now() - lastSave.current > 5000) { lastSave.current = Date.now(); saveSpot(book, ch, a.currentTime); } }}
        onEnded={() => {
          if (sleepAt === "end") { setSleepAt(null); if (audio.current) setFade(audio.current, 1); setPlaying(false); saveSpot(book, Math.min(ch + 1, book.chapters.length - 1), 0); say("Sleep timer: stopped at the end of the chapter."); return; }
          if (ch < book.chapters.length - 1) go(ch + 1); else { saveSpot(book, ch, 0, true); setPlaying(false); say(`You finished ${book.title}.`); }
        }}
        onError={() => { setPlaying(false); setLoading(false); if (audio.current?.getAttribute("src")) say("This chapter won't play right now. Try the next one."); }} />
    </div>

    {sheet === "settings" && <Sheet title="Listening" onClose={() => setSheet(null)}>
      <div className="space-y-6 px-5 py-5">
        <button onClick={() => setSheet("mark")} className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#f2f2f2] text-sm font-semibold sm:hidden"><Bookmark size={17} />Add a bookmark here</button>
        <div>
          <p className="flex items-baseline justify-between text-sm font-semibold"><span>Speed</span><span className="tabular-nums">{speed.toFixed(2).replace(/0$/, "")}×</span></p>
          <div className="mt-2 flex items-center gap-2">
            <button onClick={() => pickSpeed(speed - 0.05)} aria-label="Slower" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f2f2f2] text-lg font-semibold">−</button>
            <input type="range" min={0.5} max={3} step={0.05} value={speed} onChange={(e) => pickSpeed(Number(e.target.value))} aria-label="Speed" className="ps-book-range h-[14px] min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-[#e5e5e5]" />
            <button onClick={() => pickSpeed(speed + 0.05)} aria-label="Faster" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f2f2f2] text-lg font-semibold">+</button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">{SPEEDS.map((s) => <button key={s} onClick={() => pickSpeed(s)} aria-pressed={speed === s} className={`h-8 min-w-[52px] rounded-full px-3 text-xs font-semibold tabular-nums ${speed === s ? "bg-[#0f0f0f] text-white" : "bg-[#f2f2f2] hover:bg-[#e5e5e5]"}`}>{s}×</button>)}</div>
        </div>
        <div>
          <p className="text-sm font-semibold">Sleep timer</p>
          <p className="text-xs text-[#606060]">{sleepAt === null ? "Off" : sleepAt === "end" ? "Stops at the end of this chapter" : `Stops in ${sleepWords}`}</p>
          <div className="mt-2 flex flex-wrap gap-2">{SLEEPS.map(([l, v]) => {
            const on = v === null ? sleepAt === null : v === "end" ? sleepAt === "end" : false;
            return <button key={l} onClick={() => setSleepAt(typeof v === "number" ? Date.now() + v * 60000 : v)} aria-pressed={on} className={`h-9 rounded-full px-3 text-sm font-semibold ${on ? "bg-[#0f0f0f] text-white" : "bg-[#f2f2f2] hover:bg-[#e5e5e5]"}`}>{l}</button>;
          })}</div>
        </div>
        <Toggle on={listen.rewind} onClick={() => void setSound({ rewind: !listen.rewind })} title="Smart rewind" line="After a pause, it backs up a few seconds so you don't lose the thread. The longer the pause, the further back." />
        {bookAudioSupported() && <>
          <Toggle on={boost} members={!pro} onClick={() => void setSound({ boost: !boost })} title="Voice boost" line="Clearer voices and steadier volume. Great for quiet readers and the car." />
          <Toggle on={even} members={!pro} onClick={() => void setSound({ even: !even })} title="Even volume" line="Quiet readers and loud ones come out at about the same level, chapter to chapter." />
          <Toggle on={silence} members={!pro} onClick={() => void setSound({ silence: !silence })} title="Skip silences" line="Long pauses between sentences go by quickly. Slow readers get easier to follow, at the same voice speed." />
        </>}
        <div className="flex gap-2 md:hidden">
          <button onClick={() => go(ch - 1)} disabled={ch === 0} className="h-10 flex-1 rounded-full bg-[#f2f2f2] text-sm font-semibold disabled:opacity-40">Previous chapter</button>
          <button onClick={() => go(ch + 1)} disabled={ch >= book.chapters.length - 1} className="h-10 flex-1 rounded-full bg-[#f2f2f2] text-sm font-semibold disabled:opacity-40">Next chapter</button>
        </div>
        <button onClick={() => { setSheet(null); onStop(); }} className="h-10 w-full rounded-full border border-[#d3d3d3] text-sm font-semibold sm:hidden">Close the book</button>
      </div>
    </Sheet>}
    {sheet === "mark" && <MarkSheet book={book} ch={ch} t={time} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); say("Bookmark added. Find it on the book's page."); }} />}
    {sheet === "read" && <ReadAlong api={api} pro={pro} onJoin={() => { setSheet(null); onJoin(); }} reading={reading} time={time} onSeek={(t) => { const a = audio.current; if (a) { a.currentTime = t; if (a.paused) a.play().catch(() => {}); } }} onClose={() => setSheet(null)} />}
  </div>;
}
