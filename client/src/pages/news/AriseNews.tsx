import { useMemo, useState } from "react";
import { Link } from "wouter";
import { NEWS_ARTICLES, NEWS_ISSUE, NEWS_POINTS, newsReadMinutes, type NewsArticle, type NewsSection } from "@shared/ariseNews";
import { NewsArt, sectionStyle, useNews, type NewsResult } from "./useNews";
import "./news.css";

const Back = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>;
const Check = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>;

function Meta({ a, result }: { a: NewsArticle; result: NewsResult | null }) {
  return (
    <div className="nw-meta">
      <span>{newsReadMinutes(a)} min read</span>
      <span>{a.grades}</span>
      {result ? <span className="nw-done"><Check /> Quiz {result.score}/{result.total}</span> : <span className="nw-pts">+{NEWS_POINTS} points</span>}
    </div>
  );
}

export default function AriseNews() {
  const { resultFor } = useNews();
  const [section, setSection] = useState<NewsSection | "All">("All");
  const lead = NEWS_ARTICLES[0];
  const sections = useMemo(() => Array.from(new Set(NEWS_ARTICLES.map((a) => a.section))), []);
  const rest = NEWS_ARTICLES.filter((a) => (section === "All" ? a !== lead : a.section === section));
  const done = NEWS_ARTICLES.filter((a) => resultFor(a)).length;
  const earned = NEWS_ARTICLES.reduce((n, a) => n + (resultFor(a)?.pointsEarned ?? 0), 0);

  return (
    <main className="nw">
      <header className="nw-mast">
        <div className="nw-wrap">
          <div className="nw-mast-row">
            <Link href="/library" className="nw-back"><Back /><span>Library</span></Link>
            <h1 className="nw-logo">Arise <span>News</span></h1>
            <div className="nw-issue"><b>Issue {NEWS_ISSUE.number} · {NEWS_ISSUE.name}</b>Real stories for curious kids</div>
          </div>
          <div className="nw-progress-strip" aria-label={`${done} of ${NEWS_ARTICLES.length} quizzes done`}>
            <span>{done} of {NEWS_ARTICLES.length} quizzes done</span>
            <div className="nw-meter" aria-hidden="true"><i style={{ width: `${(done / NEWS_ARTICLES.length) * 100}%` }} /></div>
            <span>{earned} points earned</span>
          </div>
        </div>
      </header>

      <div className="nw-wrap">
        {section === "All" && (
          <article className="nw-lead" style={sectionStyle(lead)}>
            <Link href={`/news/${lead.slug}`} aria-label={lead.title}><NewsArt article={lead} /></Link>
            <div>
              <span className="nw-section">{lead.section}</span>
              <h2>{lead.title}</h2>
              <p>{lead.dek}</p>
              <Meta a={lead} result={resultFor(lead)} />
              <div style={{ marginTop: 22 }}><Link href={`/news/${lead.slug}`} className="nw-cta sec">Read the story</Link></div>
            </div>
          </article>
        )}

        <nav className="nw-filter" aria-label="Sections">
          {(["All", ...sections] as const).map((s) => (
            <button key={s} type="button" className="nw-chip" aria-pressed={section === s} onClick={() => setSection(s)}>{s}</button>
          ))}
        </nav>

        {rest.length ? (
          <div className="nw-grid">
            {rest.map((a) => {
              const result = resultFor(a);
              return (
                <Link key={a.slug} href={`/news/${a.slug}`} className="nw-card" style={sectionStyle(a)}>
                  <NewsArt article={a}>{result && <span className="nw-badge">Done</span>}</NewsArt>
                  <span><span className="nw-section">{a.section}</span></span>
                  <h3>{a.title}</h3>
                  <p>{a.dek}</p>
                  <Meta a={a} result={result} />
                </Link>
              );
            })}
          </div>
        ) : <p className="nw-empty">No stories in this section yet.</p>}
      </div>
    </main>
  );
}
