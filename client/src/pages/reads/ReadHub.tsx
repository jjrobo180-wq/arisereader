import { useMemo, useState } from "react";
import { Link } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { READABLE_BOOKS, type ReadableBook } from "@shared/readsCatalog";
import { FEATURES, NEWS_ARTICLES, NEWS_POINTS, WORLD_NEWS, newsReadMinutes } from "@shared/ariseNews";
import { NewsArt, sectionStyle } from "../news/useNews";
import { POEMS, POEM_BANDS, poemLineCount, type PoemBand } from "@shared/poems";
import { poemsRead, progressKey, readProgress, timeLabel, useLibrary, useReadsFonts } from "./useReads";
import IAriseShelf from "./IAriseShelf";
import "../news/news.css";
import "./reads.css";

const Back = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>;
type Filter = "All" | "Short reads" | "Chapter books" | "Long novels";
/** Spooky-but-friendly picks for October. */
const SPOOKY = new Set([
  "sleepy-hollow", "canterville-ghost", "hound-baskervilles", "christmas-carol", "secret-of-the-caves", "bungalow-mystery",
  "jekyll-and-hyde", "frankenstein", "phantom-of-the-opera", "war-of-the-worlds",
]);
const linkFor = (b: ReadableBook) => `/reads/book/${b.key ?? b.bookId}`;
const coverFor = (b: ReadableBook) => (b.key ? `/covers/reads/${b.key}.svg` : `${API_BASE}/api/book-cover/${b.bookId}`);
const sizeOf = (words: number): Filter => (words < 30000 ? "Short reads" : words < 70000 ? "Chapter books" : "Long novels");

export default function ReadHub() {
  useReadsFonts();
  const { books, results, user } = useLibrary();
  const [filter, setFilter] = useState<Filter>("All");
  const [band, setBand] = useState<PoemBand | "All">("All");
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
  const spooky = available.filter((b) => b.key && SPOOKY.has(b.key));
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
          <p className="nw-tagline">{available.length} books, {POEMS.length} poems, iARISE lessons and {NEWS_ARTICLES.length} articles you can read right here. Finish a book or article, pass the quiz, earn points.</p>
          <nav className="rd-jump" aria-label="Jump to">
            {reading.length > 0 && <button type="button" onClick={jumpTo("continue")}>Continue reading</button>}
            {spooky.length > 0 && <button type="button" onClick={jumpTo("spooky")}>Spooky stories</button>}
            <button type="button" onClick={jumpTo("books")}>Books</button>
            <button type="button" onClick={jumpTo("poetry")}>Poetry</button>
            <button type="button" onClick={jumpTo("iarise")}>iARISE</button>
            <button type="button" onClick={jumpTo("articles")}>Articles</button>
          </nav>
        </div>
      </header>

      <div className="nw-wrap">
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

        {spooky.length > 0 && (
          <section className="nw-block" id="spooky" aria-labelledby="spooky-h">
            <div className="nw-block-head"><h2 id="spooky-h">Spooky stories</h2><p>Ghosts, monsters, mysteries and a hound on the moor. Shivery, not scary.</p></div>
            <div className="rd-books">{spooky.map((b) => bookCard(b))}</div>
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

        <IAriseShelf books={books} results={results} />

        <section className="nw-block" id="articles" aria-labelledby="articles-h">
          <div className="nw-block-head"><h2 id="articles-h">Articles</h2><p>World news and features from Arise News. {NEWS_POINTS} points each.</p><Link href="/news" className="rd-more">Open Arise News</Link></div>
          <div className="nw-grid">
            {[...WORLD_NEWS, ...FEATURES].slice(0, 9).map((a) => (
              <Link key={a.slug} href={`/news/${a.slug}`} className="nw-card" style={sectionStyle(a)}>
                <NewsArt article={a} />
                <div className="nw-card-text">
                  <span className="nw-kicker">{a.kind === "news" && <span className="nw-section">World News</span>}<span className="nw-section">{a.section}</span></span>
                  <h3>{a.title}</h3>
                  <div className="nw-meta"><span>{newsReadMinutes(a)} min read</span></div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <footer className="nw-foot"><div className="nw-wrap">Every book and poem here is in the public domain. Quizzes and points work the same as the rest of the library.</div></footer>
    </main>
  );
}
