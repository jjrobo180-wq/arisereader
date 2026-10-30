// Book Store (a premium app): every public-domain book on Arise in one store — 70+ classics for adults
// (shared/classicsCatalog.ts, built by script/build_classics.py) and the children's books from Read on
// Arise (shared/readsCatalog.ts). The store and reader borrow the Read on Arise layout; the reader adds a
// read-aloud player in AI voices (lib/aiVoice.ts; never the phone's robot voice), with the
// paragraph being read highlighted, speed, voice, a sleep timer and automatic next chapter.
// Shelf, progress and settings are saved to the account (usePro), so they follow the reader.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CLASSIC_BOOKS } from "@shared/classicsCatalog";
import { READABLE_BOOKS, readsDir } from "@shared/readsCatalog";
import { usePro } from "../kit";
import { AI_VOICES, aiVoiceOr, preloadAiVoice, sayAI, stopAiVoice } from "@/lib/aiVoice";
import { BookCover } from "./covers";
import { useReadsFonts } from "@/pages/reads/useReads";
import "./bookstore.css";

export type StoreBook = { id: string; title: string; author: string; year: number | null; genre: string; blurb: string; chapters: number; words: number; base: string; kids: boolean };
type Prog = { ch: number; at: number; of: number; done: boolean; t: number };
type Theme = "paper" | "sepia" | "night";
type Data = { shelf: string[]; prog: Record<string, Prog>; size: number; theme: Theme; font: "serif" | "sans"; rate: number; voice: string; autoNext: boolean; sleep: number };
const DEFAULTS: Data = { shelf: [], prog: {}, size: 19, theme: "paper", font: "serif", rate: 1, voice: "", autoNext: true, sleep: 0 };

const KIDS_GENRE = "Kids & Family";
export const BOOKS: StoreBook[] = [
  ...CLASSIC_BOOKS.map((b) => ({ id: `c-${b.slug}`, title: b.title, author: b.author, year: b.year, genre: b.genre, blurb: b.blurb, chapters: b.chapters, words: b.words, base: `/classics/${b.slug}`, kids: false })),
  ...READABLE_BOOKS.map((b) => ({ id: `k-${readsDir(b)}`, title: b.title, author: b.author, year: null, genre: KIDS_GENRE, blurb: "", chapters: b.chapters, words: b.words, base: `/reads/${readsDir(b)}`, kids: true })),
];
const GENRES = ["Romance", "Classics", "Mystery", "Adventure", "Horror", "Sci-Fi", "Plays", "Short Stories", "Humor", "Nonfiction", KIDS_GENRE].filter((g) => BOOKS.some((b) => b.genre === g));
const GENRE_NOTE: Record<string, string> = {
  Romance: "Courtships, scandals and grand passions.", Classics: "The novels everyone means to read.", Mystery: "Detectives, codes and country-house murders.",
  Adventure: "Swords, sails and the open road.", Horror: "Vampires, ghosts and things in the dark.", "Sci-Fi": "Time machines, Mars and strange islands.",
  Plays: "Shakespeare and Wilde, ready to read aloud.", "Short Stories": "Perfect for a lunch break.", Humor: "Guaranteed smiles.",
  Nonfiction: "Ideas and lives that shaped the world.", [KIDS_GENRE]: "The children's classics from Read on Arise.",
};
const FEATURED = ["c-pride-and-prejudice", "c-the-great-gatsby", "c-dracula", "c-the-count-of-monte-cristo", "c-jane-eyre", "c-the-time-machine", "c-meditations", "c-the-picture-of-dorian-gray"];
const readTime = (w: number) => { const m = Math.round(w / 230); return m < 60 ? `${Math.max(1, m)} min read` : `${Math.round(m / 6) / 10} hr read`; };
const listenTime = (w: number) => { const m = Math.round(w / 160); return m < 60 ? `${Math.max(1, m)} min listen` : `${Math.round(m / 6) / 10} hr listen`; };
const canSpeak = () => true;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function Cover({ b, className = "" }: { b: StoreBook; className?: string }) {
  return <BookCover id={b.id} title={b.title} author={b.author} genre={b.genre} className={className} />;
}

export default function BookStore() {
  useReadsFonts();
  const { data, setData } = usePro<Data>("bookstore", DEFAULTS);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<string | null>(null);
  const [sort, setSort] = useState<"popular" | "title" | "author" | "short">("popular");
  const [detail, setDetail] = useState<StoreBook | null>(null);
  const [reading, setReading] = useState<{ book: StoreBook; listen: boolean } | null>(null);
  const shelf = useMemo(() => data.shelf.map((id) => BOOKS.find((b) => b.id === id)).filter((b): b is StoreBook => !!b), [data.shelf]);
  const prog = (b: StoreBook) => data.prog[b.id];
  const continuing = useMemo(() => BOOKS.filter((b) => data.prog[b.id] && !data.prog[b.id].done).sort((a, b) => data.prog[b.id].t - data.prog[a.id].t), [data.prog]);
  const finished = BOOKS.filter((b) => data.prog[b.id]?.done).length;
  const toggleShelf = (b: StoreBook) => setData((d) => ({ ...d, shelf: d.shelf.includes(b.id) ? d.shelf.filter((x) => x !== b.id) : [b.id, ...d.shelf] }));
  const open = (b: StoreBook, listen = false) => { setDetail(null); setData((d) => (d.shelf.includes(b.id) ? d : { ...d, shelf: [b.id, ...d.shelf] })); setReading({ book: b, listen }); };

  const q = norm(query.trim());
  const results = useMemo(() => {
    let list = BOOKS.filter((b) => (!genre || b.genre === genre) && (!q || norm(`${b.title} ${b.author} ${b.genre}`).includes(q)));
    if (sort === "title") list = [...list].sort((a, b) => a.title.replace(/^(The|A|An) /, "").localeCompare(b.title.replace(/^(The|A|An) /, "")));
    if (sort === "author") list = [...list].sort((a, b) => a.author.split(" ").pop()!.localeCompare(b.author.split(" ").pop()!));
    if (sort === "short") list = [...list].sort((a, b) => a.words - b.words);
    return list;
  }, [genre, q, sort]);
  const browsing = !q && !genre;

  useEffect(() => { if (reading || detail) window.scrollTo({ top: 0 }); }, [reading, detail]);

  if (reading) return <Reader book={reading.book} listen={reading.listen} data={data} setData={setData} onClose={() => setReading(null)} />;

  const card = (b: StoreBook) => {
    const p = prog(b);
    return (
      <button key={b.id} type="button" className="bs-book" onClick={() => setDetail(b)} data-testid={`bs-book-${b.id}`}>
        <span className="bs-cover"><Cover b={b} />{p?.done ? <span className="bs-flag done">✓ Finished</span> : p ? <span className="bs-flag">{Math.round(((p.ch + p.at) / Math.max(1, p.of)) * 100)}%</span> : null}</span>
        <span className="bs-book-title">{b.title}</span>
        <span className="bs-book-author">{b.author}</span>
        <span className="bs-meta">{readTime(b.words)}</span>
      </button>
    );
  };
  const rail = (list: StoreBook[]) => <div className="bs-rail">{list.map(card)}</div>;

  return (
    <div className="bs" data-testid="bookstore">
      <header className="bs-mast">
        <p className="bs-kicker">Arise Book Store</p>
        <h2 className="bs-wordmark">Every book is <span>free.</span></h2>
        <p className="bs-tagline">{CLASSIC_BOOKS.length} classics for grown-ups and {READABLE_BOOKS.length} children's books, all in the public domain. Read them here, or press Listen and have them read to you.</p>
        <form className="bs-search" role="search" onSubmit={(e) => e.preventDefault()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder={`Search ${BOOKS.length} books by title or author`} aria-label="Search books" data-testid="bs-search" />
        </form>
        <nav className="bs-genres" aria-label="Genres">
          <button type="button" aria-pressed={!genre} onClick={() => setGenre(null)}>All</button>
          {GENRES.map((g) => <button key={g} type="button" aria-pressed={genre === g} onClick={() => setGenre(genre === g ? null : g)}>{g}</button>)}
        </nav>
        {(shelf.length > 0 || finished > 0) && <p className="bs-stats"><b>{shelf.length}</b> on your shelf · <b>{finished}</b> finished</p>}
      </header>

      {browsing ? <>
        {continuing.length > 0 && <section className="bs-block" aria-labelledby="bs-cont">
          <div className="bs-block-head"><h3 id="bs-cont">Continue</h3></div>
          <div className="bs-continue">{continuing.slice(0, 4).map((b) => { const p = prog(b)!; return (
            <div key={b.id} className="bs-cont-card">
              <Cover b={b} className="bs-cont-cover" />
              <div className="bs-cont-body">
                <h4>{b.title}</h4><p>Chapter {p.ch + 1} of {p.of}</p>
                <div className="bs-bar"><i style={{ width: `${Math.round(((p.ch + p.at) / Math.max(1, p.of)) * 100)}%` }} /></div>
                <div className="bs-cont-actions"><button type="button" className="bs-cta" onClick={() => open(b)}>Read</button>{canSpeak() && <button type="button" className="bs-ghost" onClick={() => open(b, true)}>▶ Listen</button>}</div>
              </div>
            </div>); })}</div>
        </section>}
        {shelf.length > 0 && <section className="bs-block" aria-labelledby="bs-shelf"><div className="bs-block-head"><h3 id="bs-shelf">Your shelf</h3><p>Books you've added or opened.</p></div>{rail(shelf)}</section>}
        <section className="bs-block" aria-labelledby="bs-feat"><div className="bs-block-head"><h3 id="bs-feat">Staff picks</h3><p>A good place to start.</p></div>{rail(FEATURED.map((id) => BOOKS.find((b) => b.id === id)).filter((b): b is StoreBook => !!b))}</section>
        {GENRES.map((g) => { const list = BOOKS.filter((b) => b.genre === g); return (
          <section key={g} className="bs-block" aria-labelledby={`bs-g-${g}`}>
            <div className="bs-block-head"><h3 id={`bs-g-${g}`}>{g} <small>{list.length}</small></h3><p>{GENRE_NOTE[g]}</p>{list.length > 8 && <button type="button" className="bs-more" onClick={() => setGenre(g)}>See all</button>}</div>
            {rail(list.slice(0, 12))}
          </section>); })}
        <section className="bs-block" aria-labelledby="bs-short"><div className="bs-block-head"><h3 id="bs-short">Read it in an evening</h3><p>Under three hours.</p></div>{rail(BOOKS.filter((b) => !b.kids && b.words < 42000).sort((a, b) => a.words - b.words))}</section>
      </> : (
        <section className="bs-block" aria-live="polite">
          <div className="bs-block-head bs-results-head">
            <h3>{genre ?? "Results"} <small>{results.length}</small></h3>
            <label className="bs-sort">Sort <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="popular">Featured</option><option value="title">Title</option><option value="author">Author</option><option value="short">Shortest first</option></select></label>
          </div>
          {results.length ? <div className="bs-grid">{results.map(card)}</div> : <p className="bs-empty">No books match “{query.trim()}”. Try a title, an author or a genre.</p>}
        </section>
      )}
      <p className="bs-foot">Every book here is in the public domain. Classics for grown-ups come from Standard Ebooks; a few dated slurs are shown as a letter and dashes.</p>

      {detail && <Detail book={detail} prog={prog(detail)} onShelf={data.shelf.includes(detail.id)} onToggleShelf={() => toggleShelf(detail)} onRead={() => open(detail)} onListen={() => open(detail, true)} onClose={() => setDetail(null)} />}
    </div>
  );
}

function Detail({ book: b, prog, onShelf, onToggleShelf, onRead, onListen, onClose }: { book: StoreBook; prog?: Prog; onShelf: boolean; onToggleShelf: () => void; onRead: () => void; onListen: () => void; onClose: () => void }) {
  const [toc, setToc] = useState<{ title: string; words: number }[] | null>(null);
  useEffect(() => { fetch(`${b.base}/index.json`).then((r) => (r.ok ? r.json() : null)).then((d) => setToc(d?.chapters ?? [])).catch(() => setToc([])); }, [b.base]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="bs-sheet-wrap" role="dialog" aria-modal="true" aria-label={b.title} onClick={onClose}>
      <div className="bs-sheet" onClick={(e) => e.stopPropagation()} data-testid="bs-detail">
        <button type="button" className="bs-x" onClick={onClose} aria-label="Close">×</button>
        <div className="bs-detail-top">
          <Cover b={b} className="bs-detail-cover" />
          <div className="bs-detail-info">
            <p className="bs-kicker">{b.genre}{b.year ? ` · ${b.year < 0 ? `${-b.year} BC` : b.year}` : ""}</p>
            <h3>{b.title}</h3>
            <p className="bs-by">by {b.author}</p>
            <p className="bs-facts"><span>{readTime(b.words)}</span><span>{listenTime(b.words)}</span><span>{b.chapters} {b.chapters === 1 ? "part" : b.genre === "Plays" ? "parts" : "chapters"}</span></p>
            <p className="bs-price">Free</p>
          </div>
        </div>
        {b.blurb && <p className="bs-blurb">{b.blurb}</p>}
        <div className="bs-actions">
          <button type="button" className="bs-cta" onClick={onRead} data-testid="bs-read">{prog && !prog.done ? `Continue · chapter ${prog.ch + 1}` : prog?.done ? "Read again" : "Read"}</button>
          {canSpeak() && <button type="button" className="bs-cta bs-listen" onClick={onListen} data-testid="bs-listen">▶ Listen</button>}
          <button type="button" className="bs-ghost" onClick={onToggleShelf} aria-pressed={onShelf}>{onShelf ? "✓ On your shelf" : "+ Add to shelf"}</button>
        </div>
        <h4 className="bs-toc-h">Contents</h4>
        {toc === null ? <p className="bs-empty">Loading…</p> : <ol className="bs-toc">{toc.map((c, i) => <li key={i}><span>{c.title}</span><small>{Math.max(1, Math.round(c.words / 230))} min</small></li>)}</ol>}
      </div>
    </div>
  );
}

// ── Reader with read-aloud ──────────────────────────────────────────────────

type Seg = { el: HTMLElement; text: string };
const BLOCKS = "p, h2, h3, h4, li, dt, dd, figcaption, blockquote";
/** The chapter as sentences, each tied to the paragraph it's in. */
function collect(root: HTMLElement): Seg[] {
  const out: Seg[] = [];
  const blocks = Array.from(root.querySelectorAll<HTMLElement>(BLOCKS)).filter((el) => !el.querySelector(BLOCKS));
  const seg = typeof Intl !== "undefined" && (Intl as any).Segmenter ? new (Intl as any).Segmenter("en", { granularity: "sentence" }) : null;
  for (const el of blocks) {
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    let parts: string[] = seg ? Array.from(seg.segment(text), (s: any) => String(s.segment).trim()) : (text.match(/[^.!?…]+[.!?…]+["'”’)\]]*\s*|[^.!?…]+$/g) || [text]).map((s) => s.trim());
    parts = parts.filter(Boolean).flatMap((s) => (s.length <= 280 ? [s] : s.split(/(?<=[,;:—])\s+/).reduce<string[]>((acc, piece) => { if (acc.length && (acc[acc.length - 1] + " " + piece).length < 240) acc[acc.length - 1] += " " + piece; else acc.push(piece); return acc; }, [])));
    for (const p of parts) out.push({ el, text: p });
  }
  return out;
}

function Reader({ book: b, listen, data, setData, onClose }: { book: StoreBook; listen: boolean; data: Data; setData: (u: (d: Data) => Data) => void; onClose: () => void }) {
  const saved = data.prog[b.id];
  const [index, setIndex] = useState<{ title: string; words: number }[] | null>(null);
  const [ch, setCh] = useState(() => (saved && !saved.done ? Math.min(saved.ch, Math.max(0, saved.of - 1)) : 0));
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [read, setRead] = useState(0);
  const [panel, setPanel] = useState<"none" | "type" | "toc">("none");
  const [more, setMore] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const article = useRef<HTMLElement>(null);
  const restore = useRef<number | null>(saved && !saved.done && saved.ch === ch ? saved.at : null);
  const lastSave = useRef(0);
  const savePending = useRef<number | null>(null);

  // Player
  const [segs, setSegs] = useState<Seg[]>([]);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [sleepEnd, setSleepEnd] = useState<number | null>(null);
  const [sleepLeft, setSleepLeft] = useState("");
  const run = useRef(0);
  const playAfterLoad = useRef(listen);
  const playingRef = useRef(false);
  playingRef.current = playing;
  const atRef = useRef(0);
  atRef.current = at;
  /** The latest settings, for speech callbacks that outlive the render that started them. */
  const live = useRef({ data, sleepEnd, index, ch });
  live.current = { data, sleepEnd, index, ch };

  useEffect(() => {
    fetch(`${b.base}/index.json`).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then((d) => setIndex(d.chapters || [])).catch(() => setError("This book couldn't open. Check your connection and try again."));
  }, [b.base]);
  useEffect(() => {
    if (!index) return;
    setHtml(""); setSegs([]);
    fetch(`${b.base}/${ch + 1}.html`).then((r) => { if (!r.ok) throw new Error(); return r.text(); }).then((t) => {
      setHtml(t);
      requestAnimationFrame(() => {
        const s = scroller.current; if (!s) return;
        const f = restore.current ?? 0;
        s.scrollTop = f * (s.scrollHeight - s.clientHeight);
        restore.current = null;
        savePending.current = f; // saved once saveProgress has this chapter (see below)
      });
    }).catch(() => setError("This chapter couldn't load. Check your connection and try again."));
  }, [index, ch, b.base]);

  const saveProgress = useCallback((frac: number, force = false) => {
    if (!index) return;
    const now = Date.now();
    if (!force && now - lastSave.current < 1500) return;
    lastSave.current = now;
    // Finished once the last page of the last chapter is reached; opening a finished book again starts it over.
    const done = ch === index.length - 1 && frac > 0.97;
    setData((d) => ({ ...d, prog: { ...d.prog, [b.id]: { ch, at: Math.round(frac * 1000) / 1000, of: index.length, done, t: now } } }));
  }, [index, ch, b.id, setData]);

  // Opening a chapter counts as progress, at the place it was restored to.
  useEffect(() => { if (savePending.current !== null && html) { const f = savePending.current; savePending.current = null; saveProgress(f, true); } }, [html, saveProgress]);
  useEffect(() => {
    const s = scroller.current; if (!s) return;
    const on = () => { const f = Math.min(1, s.scrollTop / Math.max(1, s.scrollHeight - s.clientHeight)); setRead(f); saveProgress(f); };
    s.addEventListener("scroll", on, { passive: true });
    return () => s.removeEventListener("scroll", on);
  }, [saveProgress]);

  // One stable object, so a re-render never rewrites the page (which would drop the read-aloud highlight).
  const inner = useMemo(() => ({ __html: html }), [html]);
  // Sentences for the player once the chapter is on screen.
  useEffect(() => {
    if (!html || !article.current) return;
    const list = collect(article.current);
    setSegs(list);
    setAt(0);
    if (playAfterLoad.current && list.length) { playAfterLoad.current = false; window.setTimeout(() => speakFrom(0, list), 150); }
  }, [html]);

  const voice = aiVoiceOr(data.voice);

  const mark = (list: Seg[], i: number) => {
    article.current?.querySelectorAll(".bs-say").forEach((n) => n.classList.remove("bs-say"));
    const el = list[i]?.el; if (!el) return;
    el.classList.add("bs-say");
    const s = scroller.current; if (!s) return;
    const r = el.getBoundingClientRect(), box = s.getBoundingClientRect();
    if (r.top < box.top + 70 || r.bottom > box.bottom - 150) s.scrollTo({ top: s.scrollTop + r.top - box.top - box.height * 0.3, behavior: "smooth" });
  };

  function speakFrom(i: number, list = segs) {
    const id = ++run.current;
    stopAiVoice();
    if (i >= list.length) { chapterEnded(); return; }
    setPlaying(true); setAt(i); mark(list, i);
    const v = aiVoiceOr(live.current.data.voice);
    // The next paragraph is made while this one is read, so there's no gap between them.
    if (list[i + 1]) void preloadAiVoice(list[i + 1].text, v).catch(() => {});
    let failed = false;
    void sayAI(list[i].text, { voice: v, rate: live.current.data.rate, onError: () => { failed = true; if (run.current === id) setPlaying(false); },
      onEnd: () => { if (!failed && run.current === id && playingRef.current) speakFrom(i + 1, list); } });
  }
  function stop() { run.current++; setPlaying(false); stopAiVoice(); }
  function chapterEnded() {
    const { sleepEnd: se, index: idx, ch: c, data: d } = live.current;
    if (se === -1) { stop(); setSleepEnd(null); return; }
    if (idx && c < idx.length - 1 && d.autoNext) { playAfterLoad.current = true; run.current++; setPlaying(false); goCh(c + 1, true); }
    else { stop(); article.current?.querySelectorAll(".bs-say").forEach((n) => n.classList.remove("bs-say")); }
  }
  const toggle = () => (playing ? stop() : speakFrom(at));
  // Speed or voice changes take effect from the current sentence.
  useEffect(() => { if (playingRef.current) speakFrom(atRef.current); }, [data.rate, data.voice]);
  // Sleep timer
  useEffect(() => {
    if (!sleepEnd || sleepEnd < 0) { setSleepLeft(sleepEnd === -1 ? "end of chapter" : ""); return; }
    const t = window.setInterval(() => {
      const left = sleepEnd - Date.now();
      if (left <= 0) { stop(); setSleepEnd(null); setSleepLeft(""); return; }
      setSleepLeft(`${Math.ceil(left / 60000)} min`);
    }, 1000);
    return () => window.clearInterval(t);
  }, [sleepEnd]);
  // Lock-screen and headphone controls where the browser supports them.
  useEffect(() => {
    const ms = (navigator as any).mediaSession; if (!ms || typeof (window as any).MediaMetadata === "undefined") return;
    try {
      ms.metadata = new (window as any).MediaMetadata({ title: index?.[ch]?.title || b.title, artist: b.author, album: b.title });
      ms.setActionHandler("play", () => speakFrom(atRef.current));
      ms.setActionHandler("pause", () => stop());
      ms.setActionHandler("nexttrack", () => speakFrom(Math.min(segs.length - 1, atRef.current + 1)));
      ms.setActionHandler("previoustrack", () => speakFrom(Math.max(0, atRef.current - 1)));
    } catch { /* not supported */ }
  }, [ch, index, segs]);
  useEffect(() => () => { run.current++; stopAiVoice(); }, []);

  function goCh(n: number, keepPlaying = false) {
    if (!index) return;
    const c = Math.max(0, Math.min(index.length - 1, n));
    if (!keepPlaying) { stop(); playAfterLoad.current = false; }
    restore.current = null;
    setPanel("none");
    setCh(c);
  }
  const close = () => { stop(); saveProgress(read, true); onClose(); };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") { if (panel !== "none") setPanel("none"); else close(); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); });

  const sizes = [16, 17, 19, 21, 24, 28];
  const step = sizes.indexOf(data.size) < 0 ? 2 : sizes.indexOf(data.size);
  const last = index ? ch === index.length - 1 : false;
  const total = index?.length ?? b.chapters;

  return (
    <div className={`bs-reader bs-${data.theme} bs-font-${data.font}`} ref={scroller} data-testid="bs-reader">
      <div className="bs-progress" style={{ width: `${((ch + read) / Math.max(1, total)) * 100}%` }} aria-hidden="true" />
      <header className="bs-rbar">
        <button type="button" className="bs-rbtn" onClick={close} aria-label="Back to the Book Store"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
        <span className="bs-rtitle">{b.title}</span>
        <button type="button" className="bs-rbtn" onClick={() => setPanel(panel === "toc" ? "none" : "toc")} aria-expanded={panel === "toc"} aria-label="Contents">☰</button>
        <button type="button" className="bs-rbtn" onClick={() => setPanel(panel === "type" ? "none" : "type")} aria-expanded={panel === "type"} aria-label="Text and page settings">Aa</button>
      </header>
      {panel === "type" && <div className="bs-panel" role="group" aria-label="Text and page settings">
        <div className="bs-row"><span>Size</span><div className="bs-seg"><button type="button" onClick={() => setData((d) => ({ ...d, size: sizes[Math.max(0, step - 1)] }))} disabled={step <= 0} aria-label="Smaller text">A−</button><button type="button" onClick={() => setData((d) => ({ ...d, size: sizes[Math.min(sizes.length - 1, step + 1)] }))} disabled={step >= sizes.length - 1} aria-label="Bigger text">A+</button></div></div>
        <div className="bs-row"><span>Page</span><div className="bs-seg">{(["paper", "sepia", "night"] as Theme[]).map((t) => <button key={t} type="button" aria-pressed={data.theme === t} onClick={() => setData((d) => ({ ...d, theme: t }))}>{t === "paper" ? "White" : t === "sepia" ? "Sepia" : "Night"}</button>)}</div></div>
        <div className="bs-row"><span>Font</span><div className="bs-seg"><button type="button" aria-pressed={data.font === "serif"} onClick={() => setData((d) => ({ ...d, font: "serif" }))}>Book</button><button type="button" aria-pressed={data.font === "sans"} onClick={() => setData((d) => ({ ...d, font: "sans" }))}>Clean</button></div></div>
      </div>}
      {panel === "toc" && index && <div className="bs-panel bs-panel-toc"><ol>{index.map((c, i) => <li key={i}><button type="button" aria-current={i === ch} onClick={() => goCh(i)}>{i + 1}. {c.title}</button></li>)}</ol></div>}

      <div className="bs-page" style={{ ["--bs-fs" as string]: `${data.size}px` }}>
        <div className="bs-rhead"><h1>{b.title}</h1><p>{b.author} · {index ? `${ch + 1} of ${total}` : "Opening…"}{index?.[ch] ? ` · ${index[ch].title}` : ""}</p></div>
        {error ? <div className="bs-empty"><p>{error}</p><button type="button" className="bs-cta" onClick={() => { setError(""); setIndex(null); fetch(`${b.base}/index.json`).then((r) => r.json()).then((d) => setIndex(d.chapters || [])).catch(() => setError("Still couldn't open it. Try again later.")); }}>Try again</button></div>
          : !html ? <p className="bs-empty">Opening…</p>
          : <article ref={article} className="bs-text" onClick={(e) => { if (!segs.length) return; const block = (e.target as HTMLElement).closest(BLOCKS) as HTMLElement | null; const i = block ? segs.findIndex((s) => s.el === block || block.contains(s.el)) : -1; if (i >= 0 && playing) speakFrom(i); }} dangerouslySetInnerHTML={inner} />}
        {index && <nav className="bs-chnav" aria-label="Chapters">
          <button type="button" className="bs-ghost" onClick={() => goCh(ch - 1)} disabled={ch === 0}>← Previous</button>
          <span>{ch + 1} / {total}</span>
          {last ? <span className="bs-thanks">The End</span> : <button type="button" className="bs-cta" onClick={() => goCh(ch + 1)}>Next →</button>}
        </nav>}
      </div>

      {canSpeak() && <div className={`bs-player ${playing ? "on" : ""}`} role="region" aria-label="Read aloud">
        <div className="bs-player-row">
          <button type="button" className="bs-pbtn" onClick={() => speakFrom(Math.max(0, at - 1))} disabled={!segs.length} aria-label="Back one sentence">⏮</button>
          <button type="button" className="bs-play" onClick={toggle} disabled={!segs.length} aria-label={playing ? "Pause" : "Listen"} data-testid="bs-play">{playing ? "❚❚" : "▶"}</button>
          <button type="button" className="bs-pbtn" onClick={() => speakFrom(Math.min(segs.length - 1, at + 1))} disabled={!segs.length} aria-label="Forward one sentence">⏭</button>
          <div className="bs-pinfo"><b>{playing ? "Playing" : at > 0 ? "Paused" : "Listen"}</b><span>{segs.length ? `${at + 1} of ${segs.length}` : "…"}{sleepLeft ? ` · stops in ${sleepLeft}` : ""}</span></div>
          <select className="bs-psel" value={data.rate} onChange={(e) => setData((d) => ({ ...d, rate: Number(e.target.value) }))} aria-label="Reading speed">{[0.75, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2].map((r) => <option key={r} value={r}>{r}×</option>)}</select>
          <button type="button" className="bs-pbtn bs-pmore" onClick={() => setMore((m) => !m)} aria-expanded={more} aria-label="More listening options">⋯</button>
        </div>
        {more && <div className="bs-player-row bs-player-more">
          <select className="bs-psel bs-voice" value={voice} onChange={(e) => setData((d) => ({ ...d, voice: e.target.value }))} aria-label="Voice">{AI_VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select>
          <select className="bs-psel" value={sleepEnd === -1 ? "-1" : sleepEnd ? "on" : "0"} onChange={(e) => { const v = e.target.value; setSleepEnd(v === "0" ? null : v === "-1" ? -1 : Date.now() + Number(v) * 60000); }} aria-label="Sleep timer">
            <option value="0">Sleep timer: off</option><option value="15">Stop in 15 min</option><option value="30">Stop in 30 min</option><option value="60">Stop in 1 hour</option><option value="-1">Stop at end of chapter</option>{sleepEnd && sleepEnd > 0 && <option value="on">Timer on</option>}
          </select>
          <label className="bs-auto"><input type="checkbox" checked={data.autoNext} onChange={(e) => setData((d) => ({ ...d, autoNext: e.target.checked }))} /> Keep going to the next chapter</label>
        </div>}
      </div>}
    </div>
  );
}
