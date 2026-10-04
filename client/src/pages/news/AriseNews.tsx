import { useMemo, useState } from "react";
import { Link } from "wouter";
import { FEATURES, NEWS_ARTICLES, NEWS_ISSUE, NEWS_POINTS, WORLD_NEWS, newsReadMinutes, type NewsArticle, type NewsSection } from "@shared/ariseNews";
import { NewsArt, sectionStyle, shortDate, useNews, type NewsResult } from "./useNews";
import "./news.css";

const Back = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>;
const Check = () => <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>;

function Status({ result }: { result: NewsResult | null }) {
  return result ? <span className="nw-done"><Check /> Quiz {result.score}/{result.total}</span> : <span className="nw-pts">+{NEWS_POINTS} pts</span>;
}

function Kicker({ a }: { a: NewsArticle }) {
  return a.kind === "news"
    ? <span className="nw-kicker"><span className="nw-section">{a.section}</span><time dateTime={a.publishedOn}>{shortDate(a.publishedOn)}</time></span>
    : <span className="nw-kicker"><span className="nw-section">{a.section}</span></span>;
}

export default function AriseNews() {
  const { resultFor } = useNews();
  const [section, setSection] = useState<NewsSection | "All">("All");
  const [lead, ...latest] = WORLD_NEWS;
  const sections = useMemo(() => Array.from(new Set(FEATURES.map((a) => a.section))), []);
  const features = FEATURES.filter((a) => section === "All" || a.section === section);
  const done = NEWS_ARTICLES.filter((a) => resultFor(a)).length;
  const earned = NEWS_ARTICLES.reduce((n, a) => n + (resultFor(a)?.pointsEarned ?? 0), 0);
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <main className="nw">
      <header className="nw-mast">
        <div className="nw-wrap">
          <div className="nw-topline">
            <Link href="/library" className="nw-back"><Back /><span>Library</span></Link>
            <span>{today}</span>
            <span className="nw-topline-issue">Issue {NEWS_ISSUE.number} · {NEWS_ISSUE.name}</span>
          </div>
          <h1 className="nw-wordmark">Arise <span>News</span></h1>
          <p className="nw-tagline">Read an article. Pass the quiz. Earn {NEWS_POINTS} points.</p>
          <div className="nw-progress-strip" aria-label={`${done} of ${NEWS_ARTICLES.length} quizzes done`}>
            <span><b>{NEWS_ARTICLES.length}</b> articles</span>
            <span><b>{done}</b> quizzes done</span>
            <div className="nw-meter" aria-hidden="true"><i style={{ width: `${(done / NEWS_ARTICLES.length) * 100}%` }} /></div>
            <span><b>{earned}</b> points earned</span>
          </div>
        </div>
      </header>

      <div className="nw-wrap">
        {/* World News: the newest story leads, the rest in a column beside it */}
        <section className="nw-block" aria-labelledby="world-news">
          <div className="nw-block-head">
            <h2 id="world-news">World News</h2>
            <p>Recent events, checked against trusted sources.</p>
          </div>
          <div className="nw-front">
            {lead && (
              <Link href={`/news/${lead.slug}`} className="nw-front-lead" style={sectionStyle(lead)}>
                <NewsArt article={lead} />
                <Kicker a={lead} />
                <h3>{lead.title}</h3>
                <p>{lead.dek}</p>
                <div className="nw-meta"><span>{newsReadMinutes(lead)} min read</span><Status result={resultFor(lead)} /></div>
              </Link>
            )}
            <ol className="nw-latest" aria-label="More world news">
              {latest.map((a) => (
                <li key={a.slug}>
                  <Link href={`/news/${a.slug}`} className="nw-latest-item" style={sectionStyle(a)}>
                    <NewsArt article={a} className="nw-art nw-thumb" />
                    <div>
                      <Kicker a={a} />
                      <h3>{a.title}</h3>
                      <div className="nw-meta"><span>{newsReadMinutes(a)} min</span><Status result={resultFor(a)} /></div>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section className="nw-block" aria-labelledby="features">
          <div className="nw-block-head">
            <h2 id="features">Features</h2>
            <p>Stories about science, nature, history and the arts.</p>
          </div>
          <nav className="nw-filter" aria-label="Feature topics">
            {(["All", ...sections] as const).map((s) => (
              <button key={s} type="button" className="nw-chip" aria-pressed={section === s} onClick={() => setSection(s)}>{s}</button>
            ))}
          </nav>
          {features.length ? (
            <div className="nw-grid">
              {features.map((a, i) => {
                const result = resultFor(a);
                return (
                  <Link key={a.slug} href={`/news/${a.slug}`} className={"nw-card" + (i === 0 && section === "All" ? " wide" : "")} style={sectionStyle(a)}>
                    <NewsArt article={a}>{result && <span className="nw-badge">Done</span>}</NewsArt>
                    <div className="nw-card-text">
                      <Kicker a={a} />
                      <h3>{a.title}</h3>
                      <p>{a.dek}</p>
                      <div className="nw-meta"><span>{newsReadMinutes(a)} min read</span><span>{a.grades}</span><Status result={result} /></div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : <p className="nw-empty">No articles in this topic yet.</p>}
        </section>
      </div>
      <footer className="nw-foot"><div className="nw-wrap">Arise News articles are written for readers on Arise. News stories list their sources at the end.</div></footer>
    </main>
  );
}
