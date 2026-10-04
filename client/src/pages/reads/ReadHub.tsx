import { useMemo, useState } from "react";
import { Link } from "wouter";
import { API_BASE } from "@/lib/queryClient";
import { READABLE_BOOKS, type ReadableBook } from "@shared/readsCatalog";
import { FEATURES, NEWS_ARTICLES, NEWS_POINTS, WORLD_NEWS, newsReadMinutes } from "@shared/ariseNews";
import { NewsArt, sectionStyle } from "../news/useNews";
import { progressKey, readProgress, timeLabel, useLibrary, useReadsFonts } from "./useReads";
import IAriseShelf from "./IAriseShelf";
import "../news/news.css";
import "./reads.css";

const Back = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>;
type Filter = "All" | "Short reads" | "Chapter books" | "Long novels";
/** Spooky-but-friendly picks for October. */
const SPOOKY = new Set(["sleepy-hollow", "canterville-ghost", "hound-baskervilles"]);
const linkFor = (b: ReadableBook) => `/reads/book/${b.key ?? b.bookId}`;
const coverFor = (b: ReadableBook) => (b.key ? `/covers/reads/${b.key}.svg` : `${API_BASE}/api/book-cover/${b.bookId}`);
const sizeOf = (words: number): Filter => (words < 30000 ? "Short reads" : words < 70000 ? "Chapter books" : "Long novels");

export default function ReadHub() {
  useReadsFonts();
  const { books, results, user } = useLibrary();
  const [filter, setFilter] = useState<Filter>("All");
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
          <p className="nw-tagline">{available.length} books, iARISE lessons and {NEWS_ARTICLES.length} articles you can read right here. Finish one, pass the quiz, earn points.</p>
          <nav className="rd-jump" aria-label="Jump to">
            {reading.length > 0 && <a href="#continue">Continue reading</a>}
            {spooky.length > 0 && <a href="#spooky">Spooky stories</a>}
            <a href="#books">Books</a><a href="#iarise">iARISE</a><a href="#articles">Articles</a>
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
            <div className="nw-block-head"><h2 id="spooky-h">Spooky stories</h2><p>Ghosts, legends and a hound on the moor. Shivery, not scary.</p></div>
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
      <footer className="nw-foot"><div className="nw-wrap">Every book here is in the public domain. Quizzes and points work the same as the rest of the library.</div></footer>
    </main>
  );
}
