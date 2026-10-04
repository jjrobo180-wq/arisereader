import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { readableBook, readsDir } from "@shared/readsCatalog";
import { progressKey, readProgress, saveProgress, timeLabel, useLibrary, useReadsFonts } from "./useReads";
import "../news/news.css";
import "./reads.css";

type Index = { id: number; title: string; author: string; chapters: { title: string; words: number }[]; words: number };
const SIZES = [17, 19, 21, 24];
const THEMES = ["paper", "sepia", "night"] as const;
type Theme = typeof THEMES[number];
const pref = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const setPref = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* fine */ } };
const Back = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>;

export default function BookReader() {
  useReadsFonts();
  const { id } = useParams<{ id: string }>();
  const { books, results, user, canTakeQuiz } = useLibrary();
  // newer books are opened by key ("sleepy-hollow"); the rest by library book id
  const meta = readableBook(/^\d+$/.test(id) ? Number(id) : id);
  const bookId = meta?.bookId ?? 0;
  const dir = meta ? readsDir(meta) : id;
  const pk = meta ? progressKey(meta) : id;
  const [, navigate] = useLocation();
  const [index, setIndex] = useState<Index | null>(null);
  const [chapter, setChapter] = useState(() => readProgress(user?.id)[pk]?.chapter ?? 0);
  const [htmlText, setHtml] = useState<string>("");
  const [error, setError] = useState("");
  const [size, setSize] = useState<number>(() => pref("reads_size", 19));
  const [theme, setTheme] = useState<Theme>(() => pref("reads_theme", "paper"));
  const [read, setRead] = useState(0);
  const restore = useRef<number | null>(readProgress(user?.id)[pk]?.chapter === chapter ? readProgress(user?.id)[pk]?.at ?? null : null);

  useEffect(() => { setPref("reads_size", size); }, [size]);
  useEffect(() => { setPref("reads_theme", theme); }, [theme]);
  useEffect(() => {
    fetch(`/reads/${dir}/index.json`).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setIndex).catch(() => setError("This book couldn't open. Try again in a moment."));
  }, [dir]);
  useEffect(() => {
    if (!index) return;
    setHtml("");
    fetch(`/reads/${dir}/${chapter + 1}.html`).then((r) => { if (!r.ok) throw new Error(); return r.text(); }).then((t) => {
      setHtml(t);
      requestAnimationFrame(() => {
        const h = document.documentElement;
        window.scrollTo(0, restore.current ? restore.current * (h.scrollHeight - h.clientHeight) : 0);
        restore.current = null;
      });
    }).catch(() => setError("This chapter couldn't load. Try again in a moment."));
  }, [index, chapter, dir]);
  useEffect(() => {
    let t = 0;
    const on = () => {
      const h = document.documentElement, at = Math.min(1, h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight));
      setRead(at);
      window.clearTimeout(t);
      t = window.setTimeout(() => index && saveProgress(user?.id, pk, { chapter, at, of: index.chapters.length, finished: chapter === index.chapters.length - 1 && at > 0.95 }), 400);
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); window.clearTimeout(t); };
  }, [chapter, index, pk, user?.id]);

  if (!meta) return <main className="nw"><div className="nw-wrap nw-missing"><p>This book isn't available to read here yet.</p><Link href="/reads" className="nw-cta">See all books</Link></div></main>;

  const lib = books?.find((b) => b.id === bookId);
  const result = results.find((r) => r.bookId === bookId);
  const last = index ? chapter === index.chapters.length - 1 : false;
  const go = (n: number) => { if (!index) return; const c = Math.max(0, Math.min(index.chapters.length - 1, n)); setChapter(c); saveProgress(user?.id, pk, { chapter: c, at: 0, of: index.chapters.length }); };
  const step = SIZES.indexOf(size);
  const quiz = lib && canTakeQuiz && !result;

  return (
    <main className={`nw rd-reader rd-${theme}`}>
      <div className="nw-bar" style={{ width: `${read * 100}%`, background: "#7048e8" }} aria-hidden="true" />
      <header className="nw-mast">
        <div className="nw-wrap nw-mast-row rd-bar-row">
          <Link href="/reads" className="nw-back"><Back /><span>Read on Arise</span></Link>
          <span className="rd-booktitle">{meta.title}</span>
          <div className="nw-tools" role="group" aria-label="Reading settings">
            <button type="button" onClick={() => setSize(SIZES[step - 1])} disabled={step <= 0} aria-label="Smaller text">A−</button>
            <button type="button" onClick={() => setSize(SIZES[step + 1])} disabled={step >= SIZES.length - 1} aria-label="Bigger text">A+</button>
            <button type="button" onClick={() => setTheme(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length])} aria-label={`Page color: ${theme}. Change`}>{theme === "night" ? "☾" : theme === "sepia" ? "◐" : "☀"}</button>
            {quiz && <button type="button" className="rd-quizbtn" onClick={() => navigate(`/quiz/${bookId}`)}>Quiz</button>}
          </div>
        </div>
      </header>

      <div className="nw-wrap rd-page">
        <div className="rd-head">
          <h1>{meta.title}</h1>
          <p>{meta.author} · {timeLabel(meta.words)} · {meta.chapters} {meta.chapters === 1 ? "part" : "chapters"}</p>
          {index && index.chapters.length > 1 && (
            <label className="rd-toc">
              <span>Chapter</span>
              <select value={chapter} onChange={(e) => go(Number(e.target.value))}>
                {index.chapters.map((c, i) => <option key={i} value={i}>{i + 1}. {c.title}</option>)}
              </select>
            </label>
          )}
        </div>
        {error ? <p className="nw-empty">{error}</p> : !htmlText ? <p className="nw-empty">Opening…</p> : (
          <article className="rd-text" style={{ ["--fs" as string]: `${size}px` }} dangerouslySetInnerHTML={{ __html: htmlText }} />
        )}
        {index && (
          <nav className="rd-nav" aria-label="Chapters">
            <button type="button" className="nw-chip" onClick={() => go(chapter - 1)} disabled={chapter === 0}>← Previous</button>
            <span>{chapter + 1} / {index.chapters.length}</span>
            {!last && <button type="button" className="nw-cta" onClick={() => go(chapter + 1)}>Next chapter →</button>}
          </nav>
        )}
        {(last || result) && lib && (
          <section className="nw-quiz rd-done">
            <div className="nw-quiz-num" style={{ background: "#7048e8" }}>+{lib.pointsValue}<small>points</small></div>
            <div>
              <h2>{result ? "You took this quiz" : "You reached the end!"}</h2>
              <p>{result ? `You got ${result.score} of ${result.total} right.` : `Take the quiz on ${meta.title}. Pass it to earn ${lib.pointsValue} points.`}</p>
            </div>
            {result ? <span className="nw-result">{result.passed ? "Points earned" : "Quiz done"}</span> : canTakeQuiz && bookId > 0 ? <button type="button" className="nw-cta" onClick={() => navigate(`/quiz/${bookId}`)}>Take the quiz</button> : <span className="nw-result">Students take this quiz</span>}
          </section>
        )}
      </div>
      <footer className="nw-foot"><div className="nw-wrap">This book is in the public domain.</div></footer>
    </main>
  );
}
