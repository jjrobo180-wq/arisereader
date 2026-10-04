import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "wouter";
import { NEWS_ARTICLES, NEWS_POINTS, newsBySlug, newsReadMinutes, type NewsArticle as Article, type NewsBlock } from "@shared/ariseNews";
import { NewsArt, formatNewsDate, sectionStyle, useNews } from "./useNews";
import "./news.css";

const SIZES = [17, 19, 21, 24];
const SIZE_KEY = "news_text_size";
const Back = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>;

/** Marks the first time each glossary word appears, with its meaning on hover. */
function withTerms(text: string, words: Article["words"], used: Set<string>): ReactNode {
  const todo = words.filter((w) => !used.has(w.word));
  if (!todo.length) return text;
  const re = new RegExp(`\\b(${todo.map((w) => w.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");
  const m = text.match(re);
  if (!m || m.index === undefined) return text;
  const w = todo.find((x) => x.word.toLowerCase() === m[1].toLowerCase())!;
  used.add(w.word);
  return <>{text.slice(0, m.index)}<dfn title={w.meaning}>{m[1]}</dfn>{withTerms(text.slice(m.index + m[1].length), words, used)}</>;
}

function Block({ b, words, used }: { b: NewsBlock; words: Article["words"]; used: Set<string> }) {
  if (b.kind === "p") return <p>{withTerms(b.text, words, used)}</p>;
  if (b.kind === "h") return <h2>{b.text}</h2>;
  if (b.kind === "fact") return <aside className="nw-fact"><h3>{b.title}</h3><p>{withTerms(b.text, words, used)}</p></aside>;
  if (b.kind === "quote") return <blockquote className="nw-quote"><p>“{b.text}”</p>{b.by && <cite>{b.by}</cite>}</blockquote>;
  return <aside className="nw-list"><h3>{b.title}</h3><ul>{b.items.map((i) => <li key={i}>{i}</li>)}</ul></aside>;
}

export default function NewsArticle() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const article = newsBySlug(slug || "");
  const { books, resultFor, canTakeQuiz } = useNews();
  const [size, setSize] = useState(() => { try { const v = Number(localStorage.getItem(SIZE_KEY)); return SIZES.includes(v) ? v : 19; } catch { return 19; } });
  const [read, setRead] = useState(0);

  useEffect(() => { window.scrollTo(0, 0); }, [slug]);
  useEffect(() => { try { localStorage.setItem(SIZE_KEY, String(size)); } catch { /* fine */ } }, [size]);
  useEffect(() => {
    const on = () => { const h = document.documentElement; setRead(Math.min(1, h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight))); };
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [slug]);

  const more = useMemo(() => {
    if (!article) return [];
    const i = NEWS_ARTICLES.indexOf(article);
    return [1, 2, 3].map((k) => NEWS_ARTICLES[(i + k) % NEWS_ARTICLES.length]);
  }, [article]);

  if (!article) {
    return <main className="nw"><div className="nw-wrap nw-missing"><p>We couldn't find that story.</p><Link href="/news" className="nw-cta">See all stories</Link></div></main>;
  }

  const used = new Set<string>();
  const bookId = books?.[article.slug];
  const result = resultFor(article);
  const step = SIZES.indexOf(size);

  return (
    <main className="nw" style={sectionStyle(article)}>
      <div className="nw-bar" style={{ width: `${read * 100}%` }} aria-hidden="true" />
      <header className="nw-mast">
        <div className="nw-wrap nw-mast-row">
          <Link href="/news" className="nw-back"><Back /><span>All stories</span></Link>
          <span className="nw-logo" style={{ fontSize: 26 }}>Arise <span>News</span></span>
          <div className="nw-tools" role="group" aria-label="Text size">
            <button type="button" onClick={() => setSize(SIZES[step - 1])} disabled={step <= 0} aria-label="Smaller text">A−</button>
            <button type="button" onClick={() => setSize(SIZES[step + 1])} disabled={step >= SIZES.length - 1} aria-label="Bigger text">A+</button>
          </div>
        </div>
      </header>

      <article className="nw-wrap">
        <div className="nw-hero"><NewsArt article={article} /></div>
        <div className="nw-head">
          <span className="nw-section">{article.section}</span>
          <h1>{article.title}</h1>
          <p className="nw-dek">{article.dek}</p>
          <div className="nw-byline"><span>By <b>the Arise News team</b></span><span>{formatNewsDate(article.publishedOn)}</span><span>{newsReadMinutes(article)} min read</span><span>{article.grades}</span></div>
        </div>

        <div className="nw-layout">
          <div className="nw-body" style={{ ["--fs" as string]: `${size}px` }}>
            {article.body.map((b, i) => <Fragment key={i}><Block b={b} words={article.words} used={used} /></Fragment>)}
          </div>
          <div className="nw-rail">
            <section className="nw-words" aria-labelledby="words-to-know">
              <h2 id="words-to-know">Words to know</h2>
              <dl>{article.words.map((w) => <div key={w.word}><dt>{w.word}</dt><dd>{w.meaning}</dd></div>)}</dl>
            </section>
          </div>
        </div>

        <section className="nw-quiz" aria-labelledby="quiz-title">
          <div className="nw-quiz-num">+{NEWS_POINTS}<small>points</small></div>
          <div>
            <h2 id="quiz-title">{result ? "You took this quiz" : "Ready for the quiz?"}</h2>
            <p>{result
              ? `You got ${result.score} of ${result.total} right${result.passed ? ` and earned ${result.pointsEarned ?? NEWS_POINTS} points.` : ". Keep reading more stories to earn points."}`
              : `${article.questions.length} questions about this story. Get ${Math.ceil(article.questions.length * 0.7)} right to earn ${NEWS_POINTS} points.`}</p>
          </div>
          {result ? <span className="nw-result">{result.passed ? "Points earned" : "Quiz done"}</span>
            : canTakeQuiz ? <button type="button" className="nw-cta" disabled={!bookId} onClick={() => bookId && navigate(`/quiz/${bookId}`)}>{bookId ? "Take the quiz" : books ? "Quiz coming soon" : "Loading…"}</button>
              : <span className="nw-result">Students take this quiz</span>}
        </section>

        <section className="nw-more" aria-labelledby="more-stories">
          <h2 id="more-stories">More stories</h2>
          <div className="nw-grid">
            {more.map((a) => (
              <Link key={a.slug} href={`/news/${a.slug}`} className="nw-card" style={sectionStyle(a)}>
                <NewsArt article={a} />
                <span><span className="nw-section">{a.section}</span></span>
                <h3>{a.title}</h3>
                <p>{a.dek}</p>
              </Link>
            ))}
          </div>
        </section>
      </article>
    </main>
  );
}
