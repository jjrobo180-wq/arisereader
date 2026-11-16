// Audiobooks, a Premium plugin of its own in To Duo (it was a page inside Podster until Nov 15, 2026).
// Free LibriVox books from Podster's book catalog, drawn with To Duo's own cards and pills, and played
// through To Duo's player (duoAudio.ts) so a book keeps going on every other page. Where each book was
// left is kept on this device, the same list Podster uses, so a book started in either one carries on.
import { useEffect, useState } from "react";
import { ChevronLeft, Headphones, Loader2, Pause, Play, Search, Sparkles, Star } from "lucide-react";
import { superAppOf } from "@shared/superApps";
import { bookSpots, chapterName, loadBook, saveSpot, type Book, type BookDetail } from "../../../../podscroll/Audiobooks";
import { Empty, inputClass, plain, primary } from "@/components/family-hub/ui";
import { PageStrip, SuperHead } from "@/components/super-apps/SuperShell";
import { clock } from "./AudioDock";
import { duoAudio, useDuoAudio } from "./duoAudio";
import { usePodApi, type PodApi } from "./podApi";

const hours = (s: number) => { if (!s) return ""; const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h} hr${m ? ` ${m} min` : ""}` : `${m} min`; };
const listens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n));
const KIND: Record<string, string> = { solo: "One reader", group: "Group of readers", dramatic: "Full cast" };
const ls = { get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private */ } } };

/** Plays a chapter of a book in To Duo's player; the next chapter follows on its own. */
export function playChapter(book: BookDetail, ch: number, at = 0) {
  const c = book.chapters[ch];
  if (!c) return;
  const { main } = chapterName(c);
  duoAudio.play({
    kind: "book", section: "audiobooks", key: `book:${book.id}:${ch}`, title: book.title, sub: `Chapter ${ch + 1} · ${main}`, art: book.cover, src: c.audio, at,
    onTime: (t) => saveSpot(book, ch, t),
    onEnd: () => { if (ch + 1 < book.chapters.length) playChapter(book, ch + 1, 0); else { saveSpot(book, ch, c.secs || 0, true); duoAudio.stop(); } },
    onPrev: ch > 0 ? () => playChapter(book, ch - 1, 0) : undefined,
    onNext: ch + 1 < book.chapters.length ? () => playChapter(book, ch + 1, 0) : undefined,
  });
}

function Cover({ src, title, className = "" }: { src: string; title: string; className?: string }) {
  const [bad, setBad] = useState(false);
  return src && !bad ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} className={`bg-slate-100 object-cover ${className}`} />
    : <span className={`grid place-items-center bg-gradient-to-br from-violet-500 to-indigo-700 p-3 text-center text-sm font-black leading-tight text-white ${className}`}>{title}</span>;
}

function BookTile({ b, onOpen, rank }: { b: Book; onOpen: () => void; rank?: number }) {
  return <button type="button" onClick={onOpen} className="group min-w-0 text-left" data-testid={`duo-book-${b.id}`}>
    <span className="relative block overflow-hidden rounded-2xl shadow-[0_6px_18px_#17152b14] ring-1 ring-black/5">
      <Cover src={b.cover} title={b.title} className="aspect-square w-full transition group-hover:scale-[1.03]" />
      {rank && <span className="absolute left-2 top-2 rounded-lg bg-slate-900/80 px-1.5 text-xs font-black text-white">#{rank}</span>}
    </span>
    <span className="mt-2 line-clamp-2 block text-sm font-bold leading-snug text-[#232139]">{b.title}</span>
    <span className="block truncate text-xs font-medium text-slate-500">{b.author}</span>
    {b.why ? <span className="mt-1 block text-xs leading-snug text-slate-600">{b.why}</span>
      : <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">{b.rating > 0 && <><Star size={12} className="fill-amber-400 text-amber-400" />{b.rating.toFixed(1)}<span aria-hidden>·</span></>}<Headphones size={12} />{listens(b.downloads)}</span>}
  </button>;
}

function Browse({ api, onOpen }: { api: PodApi; onOpen: (id: string) => void }) {
  const [shelf, setShelf] = useState(() => ls.get("podscroll.bookShelf") || "all");
  const [sort, setSort] = useState(() => ls.get("podscroll.bookSort") || "popular");
  const [shelves, setShelves] = useState<{ id: string; label: string }[]>([{ id: "all", label: "All" }]);
  const [sorts, setSorts] = useState<{ id: string; label: string }[]>([{ id: "popular", label: "Most popular" }]);
  const [ai, setAi] = useState(false);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState<{ ai: boolean; q: string } | null>(null);
  const [list, setList] = useState<Book[] | null>(null);
  const [err, setErr] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => { ls.set("podscroll.bookShelf", shelf); ls.set("podscroll.bookSort", sort); }, [shelf, sort]);
  useEffect(() => {
    let live = true;
    setList(null); setErr("");
    const req = term?.ai ? api("/api/earshot/books/ai", { method: "POST", body: { q: term.q } }) : api(`/api/earshot/books?${new URLSearchParams(term ? { q: term.q, sort } : { shelf, sort })}`);
    req.then((b) => {
      if (!live) return;
      setList(Array.isArray(b?.books) ? b.books : []);
      if (Array.isArray(b?.shelves) && b.shelves.length) setShelves(b.shelves);
      if (Array.isArray(b?.sorts) && b.sorts.length) setSorts(b.sorts);
    }).catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [api, shelf, sort, term, retry]);

  return <div className="space-y-4">
    <form role="search" onSubmit={(e) => { e.preventDefault(); const t = q.trim(); setTerm(t ? { ai, q: t } : null); }} className="flex flex-wrap gap-2">
      <label className="relative min-w-0 flex-1 basis-60">
        <span className="sr-only">{ai ? "Describe a book you'd like" : "Find a book or author"}</span>
        {ai ? <Sparkles size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-violet-500" /> : <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />}
        <input type="search" value={q} maxLength={ai ? 300 : 80} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setTerm(null); }} placeholder={ai ? "Like Sherlock Holmes, but spookier…" : "Find a book or author"} className={`${inputClass} pl-9`} />
      </label>
      <div role="group" aria-label="How to search" className="inline-flex rounded-xl bg-slate-100 p-1">
        <button type="button" aria-pressed={!ai} onClick={() => setAi(false)} className={`rounded-lg px-3 text-sm font-bold ${!ai ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Search</button>
        <button type="button" aria-pressed={ai} onClick={() => setAi(true)} className={`inline-flex items-center gap-1 rounded-lg px-3 text-sm font-bold ${ai ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}><Sparkles size={14} />Ask AI</button>
      </div>
    </form>
    {term ? <div className="flex items-center gap-2 text-sm">
      <span className="min-w-0 truncate font-semibold text-slate-500">{term.ai ? `AI picks for “${term.q}”` : `Results for “${term.q}”`}</span>
      <button type="button" onClick={() => { setTerm(null); setQ(""); }} className="rounded-full px-3 py-1 font-bold text-violet-700 hover:bg-violet-50">Clear</button>
    </div> : <div className="flex items-center gap-2">
      <div className="no-scrollbar -mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Shelves">
        {shelves.map((s) => <button key={s.id} type="button" aria-pressed={shelf === s.id} onClick={() => setShelf(s.id)}
          className={`min-h-9 shrink-0 rounded-full px-3.5 text-sm font-bold transition ${shelf === s.id ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{s.label}</button>)}
      </div>
      <label className="shrink-0"><span className="sr-only">Sort by</span>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="min-h-9 rounded-full border border-slate-200 bg-white px-3 text-sm font-bold text-slate-600 outline-none">{sorts.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
      </label>
    </div>}
    {err ? <div className="py-14 text-center"><p className="text-sm font-semibold text-slate-500">{err}</p><button type="button" onClick={() => setRetry((n) => n + 1)} className={`${plain} mt-3`}>Try again</button></div>
      : !list ? <div className="grid min-h-[30vh] place-items-center" role="status" aria-label="Loading audiobooks"><span className="flex flex-col items-center gap-2 text-sm font-semibold text-slate-500"><Loader2 className="animate-spin text-violet-600" size={26} />{term?.ai && "Finding books you'll like…"}</span></div>
      : !list.length ? <p className="py-14 text-center text-sm font-semibold text-slate-500">{term ? `Nothing found for “${term.q}”. Try other words.` : "Nothing on this shelf right now. Try another one."}</p>
      : <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="duo-books">
        {list.map((b, i) => <BookTile key={b.id} b={b} onOpen={() => onOpen(b.id)} rank={!term && sort === "popular" && shelf === "all" && i < 10 ? i + 1 : undefined} />)}
      </div>}
  </div>;
}

function Listening({ onOpen }: { onOpen: (id: string) => void }) {
  const [spots] = useState(bookSpots);
  const going = Object.entries(spots).sort((a, z) => z[1].at - a[1].at);
  if (!going.length) return <Empty icon={<Headphones size={26} />} title="Nothing started yet">Books you start show up here, so you can pick up right where you left off.</Empty>;
  return <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
    {going.map(([id, s]) => <button key={id} type="button" onClick={() => onOpen(id)} className="flex min-w-0 items-center gap-3 rounded-[1.25rem] border border-[#e7e8f0] bg-white p-3 text-left hover:border-violet-200">
      <Cover src={s.cover} title={s.title} className="h-16 w-16 shrink-0 rounded-xl" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-[#232139]">{s.title}</span>
        <span className="block truncate text-xs font-medium text-slate-500">{s.author}</span>
        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-[#6e5ae0]" style={{ width: `${Math.max(4, Math.round(((s.ch + 1) / Math.max(1, s.chapters)) * 100))}%` }} /></span>
        <span className="mt-1 block text-xs text-slate-400">Chapter {s.ch + 1} of {s.chapters}</span>
      </span>
    </button>)}
  </div>;
}

function BookPage({ api, id, onBack }: { api: PodApi; id: string; onBack: () => void }) {
  const [book, setBook] = useState<BookDetail | null>(null);
  const [err, setErr] = useState("");
  const [more, setMore] = useState(false);
  const a = useDuoAudio();
  useEffect(() => { let live = true; setBook(null); setErr(""); loadBook(api, id).then((b) => { if (live) setBook(b); }).catch((e) => { if (live) setErr(e.message); }); return () => { live = false; }; }, [api, id]);
  const back = <button type="button" onClick={onBack} className="-ml-2 mb-3 inline-flex min-h-10 items-center gap-1 rounded-full pl-1 pr-3 text-sm font-bold text-slate-600 hover:bg-slate-100"><ChevronLeft size={18} />Audiobooks</button>;
  if (err) return <div>{back}<Empty icon={<Headphones size={26} />} title="This book didn't open">{err}</Empty></div>;
  if (!book) return <div>{back}<div className="grid min-h-[30vh] place-items-center" role="status" aria-label="Loading audiobook"><Loader2 className="animate-spin text-violet-600" size={26} /></div></div>;
  const spot = bookSpots()[id];
  const nowCh = a.track?.key.startsWith(`book:${book.id}:`) ? Number(a.track.key.split(":").pop()) : -1;
  const here = nowCh >= 0;
  const startCh = here ? nowCh : spot ? Math.min(spot.ch, book.chapters.length - 1) : 0;
  const main = () => (here ? duoAudio.toggle() : playChapter(book, startCh, spot ? spot.t : 0));
  return <div>
    {back}
    <section className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-4 shadow-[0_8px_28px_#17152b08] sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row">
        <Cover src={book.cover} title={book.title} className="mx-auto aspect-square w-[min(60vw,220px)] shrink-0 rounded-2xl shadow-[0_12px_30px_#17152b26] sm:mx-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-violet-600">{KIND[book.kind] ?? "Audiobook"}{book.kind === "solo" && book.reader ? ` · read by ${book.reader}` : ""}</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-[#232139] sm:text-3xl">{book.title}</h2>
          {book.author && <p className="mt-1 text-sm font-semibold text-slate-500">{book.author}</p>}
          <p className="mt-1 text-xs text-slate-400">{[`${book.chapters.length} chapters`, hours(book.secs)].filter(Boolean).join(" · ")}</p>
          <button type="button" onClick={main} className={`${primary} mt-4 min-h-12 px-6`} data-testid="duo-book-play">
            {here && a.playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
            {here ? (a.playing ? "Pause" : "Play") : spot ? `Resume · Chapter ${startCh + 1}` : "Play"}
          </button>
          {book.about && <div className="mt-4"><p className={`text-sm leading-6 text-slate-600 ${more ? "" : "line-clamp-3"}`}>{book.about}</p>
            {book.about.length > 200 && <button type="button" onClick={() => setMore((v) => !v)} className="mt-1 text-sm font-bold text-violet-700">{more ? "Less" : "More"}</button>}</div>}
        </div>
      </div>
    </section>
    <section className="mt-4 rounded-[1.5rem] border border-[#e7e8f0] bg-white p-2 shadow-[0_8px_28px_#17152b08] sm:p-3">
      <h3 className="px-2 pb-1 pt-2 text-lg font-bold text-[#232139]">Chapters</h3>
      <ol className="divide-y divide-slate-100">
        {book.chapters.map((c, i) => {
          const now = nowCh === i;
          const { main: name, under } = chapterName(c);
          return <li key={c.n}><button type="button" onClick={() => (now ? duoAudio.toggle() : playChapter(book, i, 0))} className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left ${now ? "bg-violet-50" : "hover:bg-slate-50"}`}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black tabular-nums ${now ? "bg-[#6e5ae0] text-white" : "bg-slate-100 text-slate-500"}`}>{now && a.playing ? <Pause size={13} fill="currentColor" /> : c.n}</span>
            <span className="min-w-0 flex-1"><span className={`block truncate text-sm ${now ? "font-bold text-violet-900" : "font-semibold text-slate-700"}`}>{name}</span>{under && <span className="block truncate text-xs text-slate-400">{under}</span>}</span>
            <span className="shrink-0 text-xs tabular-nums text-slate-400">{c.secs ? clock(c.secs) : ""}</span>
          </button></li>;
        })}
      </ol>
    </section>
    <p className="mt-6 text-xs text-slate-400">A <a href="https://librivox.org" target="_blank" rel="noreferrer" className="underline">LibriVox</a> recording, public domain. <a href={book.link} target="_blank" rel="noreferrer" className="underline">See it at the Internet Archive</a>.</p>
  </div>;
}

export default function AudiobooksApp({ start }: { start?: string | null }) {
  const app = superAppOf("audiobooks")!;
  const { api } = usePodApi();
  const [page, setPage] = useState(start === "listening" ? "listening" : "browse");
  const [open, setOpen] = useState<string | null>(null);
  const go = (id: string) => { setOpen(id); window.scrollTo({ top: 0 }); };
  return <div data-testid="super-app-audiobooks">
    <SuperHead app={app} />
    <PageStrip app={app} pages={app.pages.map((p) => p.id)} current={page} onPick={(id) => { setPage(id); setOpen(null); }} />
    {open ? <BookPage api={api} id={open} onBack={() => setOpen(null)} />
      : page === "listening" ? <Listening onOpen={go} />
      : <Browse api={api} onOpen={go} />}
    {!open && <p className="mt-8 text-xs text-slate-400">Audiobooks from <a href="https://librivox.org" target="_blank" rel="noreferrer" className="underline">LibriVox</a>, read by volunteers and kept at the Internet Archive. All public domain.</p>}
  </div>;
}
