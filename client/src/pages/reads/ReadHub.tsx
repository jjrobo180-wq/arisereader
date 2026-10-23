import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";
import { quizTakersText } from "@/components/QuizTakersTag";
import { READABLE_BOOKS, type ReadableBook } from "@shared/readsCatalog";
import { NEWS_ARTICLES, NEWS_POINTS, QUICK_CATEGORIES, newsReadMinutes, quickCategoryOf } from "@shared/ariseNews";
import { NewsArt, sectionStyle } from "../news/useNews";
import { POEMS, POEM_BANDS, poemLineCount, type PoemBand } from "@shared/poems";
import { poemsRead, progressKey, readProgress, timeLabel, useLibrary, useReadsFonts } from "./useReads";
import "../news/news.css";
import "./reads.css";

const Back = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>;
type Filter = "All" | "Short reads" | "Chapter books" | "Long novels";
const linkFor = (b: ReadableBook) => `/reads/book/${b.key ?? b.bookId}`;
const coverFor = (b: ReadableBook) => (b.key ? `/covers/reads/${b.key}.svg` : `${API_BASE}/api/book-cover/${b.bookId}`);
const sizeOf = (words: number): Filter => (words < 30000 ? "Short reads" : words < 70000 ? "Chapter books" : "Long novels");

export default function ReadHub() {
  useReadsFonts();
  const { books, results, user } = useLibrary();
  const [filter, setFilter] = useState<Filter>("All");
  const [band, setBand] = useState<PoemBand | "All">("All");
  const [cat, setCat] = useState("All");
  const quick = useMemo(() => [...NEWS_ARTICLES].sort((a, b) => b.publishedOn.localeCompare(a.publishedOn)), []);
  const quickCats = QUICK_CATEGORIES.filter((c) => quick.some((a) => c.sections.includes(a.section)));
  const quickShown = cat === "All" ? quick : quick.filter((a) => quickCategoryOf(a).label === cat);
  // How many readers took each quick read's quiz: each read's quiz id, and the counts by quiz id.
  const { token } = useAuth();
  const [newsIds, setNewsIds] = useState<Record<string, number>>({});
  const [takers, setTakers] = useState<Record<number, number> | null>(null);
  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    void fetch(`${API_BASE}/api/news/books`, { headers }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.books) setNewsIds(d.books); }).catch(() => {});
    void fetch(`${API_BASE}/api/books/quiz-takers`, { headers }).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d && typeof d === "object") setTakers(d); }).catch(() => {});
  }, [token]);
  // the library's "See all quick reads" button lands on /reads#quick
  useEffect(() => { if (window.location.hash === "#quick") setTimeout(() => document.getElementById("quick")?.scrollIntoView({ block: "start" }), 50); }, []);
  const readPoems = useMemo(() => new Set(poemsRead(user?.id)), [user?.id]);
  const poems = POEMS.filter((p) => band === "All" || p.band === band);
  const jumpTo = (id: string) => (e: { preventDefault(): void }) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const progress = useMemo(() => readProgress(user?.id), [user?.id]);
  // only books this reader can see in their library (grade bands), matched by id and title
  // keyed books are matched by id alone (their library title can differ a little)
  const available = READABLE_BOOKS.filter((r) => !books || books.some((b) => b.id === r.bookId && (r.key !== null || b.title === r.title)));
  const libBook = (id: number) => books?.find((b) => b.id === id);
  const result = (id: number) => results.find((r) => r.bookId === id);
  const prog = (b: ReadableBook) => progress[progressKey(b)];
  const reading = available.filter((b) => prog(b) && !prog(b).finished);
  const shown = available.filter((b) => filter === "All" || sizeOf(b.words) === filter);

  function bookCard(b: ReadableBook) {
    const lb = b.bookId > 0 ? libBook(b.bookId) : undefined, r = b.bookId > 0 ? result(b.bookId) : undefined, p = prog(b);
    return (
      <Link key={progressKey(b)} href={linkFor(b)} className="rd-book">
        <div className="rd-cover">
          <img src={coverFor(b)} alt={`Cover of ${b.title}`} loading="lazy" />
          {r ? <span className="rd-flag done">✓ Quiz {r.score}/{r.total}</span> : p ? <span className="rd-flag">Reading</span> : null}
        </div>
        <h3>{b.title}</h3>
        <p>{b.author}</p>
        <div className="nw-meta"><span>{timeLabel(b.words)}</span>{b.pictures > 0 && <span>Pictures</span>}{lb && <span className="nw-pts">{lb.pointsValue} pts</span>}</div>
      </Link>
    );
  }

  return (
    <main className="nw">
      <header className="nw-mast rd-mast">
        <div className="nw-wrap">
          <div className="nw-topline"><Link href="/library" className="nw-back"><Back /><span>Library</span></Link></div>
          <h1 className="nw-wordmark">Read <span>on Arise</span></h1>
          <p className="nw-tagline">Start with a 5-minute read: {NEWS_ARTICLES.length} short stories about sports, soccer, famous people, speeches and wild facts. Plus {available.length} books and {POEMS.length} poems. Finish one, pass the quiz, earn points.</p>
          <nav className="rd-jump" aria-label="Jump to">
            <button type="button" onClick={jumpTo("quick")}>⚡ 5-Minute Reads</button>
            {reading.length > 0 && <button type="button" onClick={jumpTo("continue")}>Continue reading</button>}
            <button type="button" onClick={jumpTo("poetry")}>Poetry</button>
            <button type="button" onClick={jumpTo("books")}>Books</button>
          </nav>
        </div>
      </header>

      <div className="nw-wrap">
        <section className="nw-block" id="quick" aria-labelledby="quick-h">
          <div className="nw-block-head"><h2 id="quick-h">⚡ 5-Minute Reads</h2><p>Every one is short enough to finish in 5 minutes or less. Read it, take the 5-question quiz, earn {NEWS_POINTS} points.</p></div>
          <nav className="nw-filter" aria-label="Kinds of quick reads">
            <button type="button" className="nw-chip" aria-pressed={cat === "All"} onClick={() => setCat("All")}>All {quick.length}</button>
            {quickCats.map((c) => <button key={c.label} type="button" className="nw-chip" aria-pressed={cat === c.label} onClick={() => setCat(c.label)}><span aria-hidden="true">{c.emoji} </span>{c.label}</button>)}
          </nav>
          <div className="nw-grid">
            {quickShown.map((a) => (
              <Link key={a.slug} href={`/news/${a.slug}`} className="nw-card" style={sectionStyle(a)}>
                <NewsArt article={a} />
                <div className="nw-card-text">
                  <span className="nw-kicker"><span className="nw-section">{quickCategoryOf(a).emoji} {quickCategoryOf(a).label}</span></span>
                  <h3>{a.title}</h3>
                  <div className="nw-meta"><span>⏱ {newsReadMinutes(a)} min read</span><span className="nw-pts">{NEWS_POINTS} pts</span></div>
                  {takers && newsIds[a.slug] ? <div className="nw-meta"><span><span aria-hidden="true">👥 </span>{quizTakersText(takers[newsIds[a.slug]] || 0, !!result(newsIds[a.slug]))}</span></div> : null}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {reading.length > 0 && (
          <section className="nw-block" id="continue" aria-labelledby="continue-h">
            <div className="nw-block-head"><h2 id="continue-h">Continue reading</h2></div>
            <div className="rd-continue">
              {reading.slice(0, 4).map((b) => {
                const p = prog(b);
                return (
                  <Link key={progressKey(b)} href={linkFor(b)} className="rd-cont-card">
                    <img src={coverFor(b)} alt="" />
                    <div>
                      <h3>{b.title}</h3>
                      <p>Chapter {p.chapter + 1} of {b.chapters}</p>
                      <div className="rd-bar"><i style={{ width: `${Math.round(((p.chapter + 1) / b.chapters) * 100)}%` }} /></div>
                      <span className="rd-go">Keep reading</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section className="nw-block" id="books" aria-labelledby="books-h">
          <div className="nw-block-head"><h2 id="books-h">Books</h2><p>Classic books, free to read here from the first page to the last.</p></div>
          <nav className="nw-filter" aria-label="Book length">
            {(["All", "Short reads", "Chapter books", "Long novels"] as Filter[]).map((f) => <button key={f} type="button" className="nw-chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}
          </nav>
          <div className="rd-books">{shown.map((b) => bookCard(b))}</div>
        </section>

        <section className="nw-block" id="poetry" aria-labelledby="poetry-h">
          <div className="nw-block-head"><h2 id="poetry-h">Poetry</h2><p>{POEMS.length} classic poems, each short enough to read twice. Words to know and questions come with every one.</p></div>
          <nav className="nw-filter" aria-label="Poems by grade">
            <button type="button" className="nw-chip" aria-pressed={band === "All"} onClick={() => setBand("All")}>All poems</button>
            {POEM_BANDS.map((b) => <button key={b.band} type="button" className="nw-chip" aria-pressed={band === b.band} onClick={() => setBand(b.band)}>{b.label}</button>)}
          </nav>
          <div className="rd-poems">
            {poems.map((p) => (
              <Link key={p.slug} href={`/reads/poem/${p.slug}`} className="rd-poem" data-band={p.band}>
                <h3>{p.title}</h3>
                <p>{p.poet}</p>
                <q>{p.hook}</q>
                <div className="nw-meta"><span>{poemLineCount(p)} lines</span><span>Grades {p.band}</span>{readPoems.has(p.slug) && <span className="rd-flag done">✓ Read</span>}</div>
              </Link>
            ))}
          </div>
        </section>

      </div>
      <footer className="nw-foot"><div className="nw-wrap">Every book and poem here is in the public domain. Quizzes and points work the same as the rest of the library.</div></footer>
    </main>
  );
}
