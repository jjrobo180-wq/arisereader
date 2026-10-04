// Read on Arise: one poem on its own page, with the words to know beside it,
// something to notice, and questions to think about.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { POEMS, poemBySlug, poemLineCount, type Poem } from "@shared/poems";
import { markPoemRead, poemsRead, useReadsFonts } from "./useReads";
import "../news/news.css";
import "./reads.css";

const SIZES = [17, 19, 21, 24];
const SIZE_KEY = "reads_size";
const Back = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>;
const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

/** What the read-aloud voice says: the title, the poet, then the poem with a breath between stanzas. */
function spokenText(p: Poem) {
  return [`${p.title}, by ${p.poet}.`, ...p.stanzas.map((s) => s.map((l) => l.trim()).join("\n"))];
}

export default function PoemReader() {
  useReadsFonts();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const poem = poemBySlug(slug);
  const [size, setSize] = useState<number>(() => { try { const v = Number(JSON.parse(localStorage.getItem(SIZE_KEY) || "19")); return SIZES.includes(v) ? v : 19; } catch { return 19; } });
  const [done, setDone] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { try { localStorage.setItem(SIZE_KEY, JSON.stringify(size)); } catch { /* fine */ } }, [size]);
  useEffect(() => {
    window.scrollTo(0, 0);
    setDone(!!slug && poemsRead(user?.id).includes(slug));
    return () => { if (canSpeak()) window.speechSynthesis.cancel(); setSpeaking(false); };
  }, [slug, user?.id]);

  // a poem counts as read once its last line has been on screen for a few seconds
  useEffect(() => {
    const end = endRef.current;
    if (!poem || !end || done || typeof IntersectionObserver === "undefined") return;
    let timer = 0;
    const finish = () => { markPoemRead(user?.id, poem.slug); setDone(true); };
    const io = new IntersectionObserver(([entry]) => {
      window.clearTimeout(timer);
      if (entry.isIntersecting) timer = window.setTimeout(finish, Math.min(12000, 2500 + poemLineCount(poem) * 250));
    }, { threshold: 1 });
    io.observe(end);
    return () => { io.disconnect(); window.clearTimeout(timer); };
  }, [poem, done, user?.id]);

  const next = useMemo(() => {
    if (!poem) return null;
    const same = POEMS.filter((p) => p.band === poem.band);
    return same[(same.indexOf(poem) + 1) % same.length];
  }, [poem]);

  if (!poem) {
    return <main className="nw"><div className="nw-wrap nw-missing"><p>We couldn't find that poem.</p><Link href="/reads" className="nw-cta">Back to Read on Arise</Link></div></main>;
  }

  const listen = () => {
    if (!canSpeak()) return;
    const synth = window.speechSynthesis;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    synth.cancel();
    const parts = spokenText(poem);
    parts.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.85; u.pitch = 1;
      if (i === parts.length - 1) { u.onend = () => setSpeaking(false); u.onerror = () => setSpeaking(false); }
      synth.speak(u);
    });
    setSpeaking(true);
  };

  const step = SIZES.indexOf(size);
  let lineNo = 0;
  return (
    <main className="nw pm">
      <header className="nw-mast">
        <div className="nw-wrap nw-mast-row">
          <Link href="/reads" className="nw-back"><Back /><span>Read on Arise</span></Link>
          <span className="nw-logo" style={{ fontSize: 26 }}>Poetry</span>
          <div className="nw-tools" role="group" aria-label="Text size">
            <button type="button" onClick={() => setSize(SIZES[step - 1])} disabled={step <= 0} aria-label="Smaller text">A−</button>
            <button type="button" onClick={() => setSize(SIZES[step + 1])} disabled={step >= SIZES.length - 1} aria-label="Bigger text">A+</button>
          </div>
        </div>
      </header>

      <article className="nw-wrap">
        <div className="nw-head pm-head">
          <h1>{poem.title}</h1>
          <div className="nw-byline">
            <span>By <b>{poem.poet}</b></span><span>{poem.year}</span><span>{poemLineCount(poem)} lines</span><span>Grades {poem.band}</span>
            {done && <span className="pm-read">✓ Read</span>}
          </div>
        </div>

        <div className="nw-layout pm-layout">
          <div>
            {canSpeak() && <button type="button" className="pm-listen" onClick={listen} aria-pressed={speaking}>{speaking ? "Stop reading" : "Listen to the poem"}</button>}
            <div className="pm-poem" style={{ ["--fs" as string]: `${size}px` }} lang="en">
              {poem.stanzas.map((stanza, si) => (
                <p key={si} className="pm-stanza">
                  {stanza.map((line, li) => {
                    lineNo++;
                    return <span key={li} className="pm-line">{lineNo % 5 === 0 && <i aria-hidden="true">{lineNo}</i>}{line}</span>;
                  })}
                </p>
              ))}
              <div ref={endRef} className="pm-end" aria-hidden="true">❦</div>
            </div>
            <section className="pm-note" aria-labelledby="pm-about">
              <h2 id="pm-about">About this poem</h2>
              <p>{poem.about}</p>
            </section>
          </div>

          <div className="nw-rail">
            {poem.words.length > 0 && (
              <section className="nw-words" aria-labelledby="pm-words">
                <h2 id="pm-words">Words to know</h2>
                <dl>{poem.words.map((w) => <div key={w.word}><dt>{w.word}</dt><dd>{w.meaning}</dd></div>)}</dl>
              </section>
            )}
            <section className="nw-words pm-notice" aria-labelledby="pm-notice">
              <h2 id="pm-notice">Something to notice</h2>
              <p>{poem.notice}</p>
            </section>
            <section className="nw-words" aria-labelledby="pm-think">
              <h2 id="pm-think">Think about it</h2>
              <ol className="pm-think">{poem.think.map((q) => <li key={q}>{q}</li>)}</ol>
            </section>
          </div>
        </div>

        <nav className="pm-next" aria-label="More poems">
          <Link href="/reads" className="nw-chip pm-chip">All poems</Link>
          {next && next !== poem && <Link href={`/reads/poem/${next.slug}`} className="nw-cta">Next poem: {next.title}</Link>}
        </nav>
      </article>
      <footer className="nw-foot"><div className="nw-wrap">This poem is in the public domain.</div></footer>
    </main>
  );
}
