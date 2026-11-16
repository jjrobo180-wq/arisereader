// Math Lessons (WorkHub app, opens at #/math-lessons): a teacher's guide to Grade 7 Unit 1, Scale Drawings,
// for teachers who have never taught it. Lesson data lives in shared/spedMath*.ts (answers are checked by
// tests/sped-math-lessons.test.ts). Nothing here needs the server.
import { useEffect, useMemo, useState } from "react";
import { areaFactor, fmt, scaleFactorOf, START_HERE, TOOLBOX, toActual, toDrawing, UNIT, unitlessScale, type Activity, type Item, type Lesson, type LengthUnit } from "@shared/spedMathUnit";
import { answerCounts, LESSONS } from "@shared/spedMathLessons";
import "./mathLessons.css";

const KEY = "arise-math-lessons";
type View = "start" | "helper" | number;
const readView = (): View => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "start" || v === "helper") return v;
    const n = Number(v);
    if (LESSONS.some((l) => l.n === n)) return n;
  } catch { /* fine */ }
  return "start";
};
const readAnswers = () => { try { return localStorage.getItem(`${KEY}-answers`) !== "off"; } catch { return true; } };

function Answer({ item, show }: { item: Item; show: boolean }) {
  return (
    <li className="ml-item">
      <p className="ml-q">{item.q}</p>
      {show ? (
        <div className="ml-a">
          <span className={`ml-badge ${item.check === "ok" ? "is-ok" : "is-figure"}`}>{item.check === "ok" ? "Answer checked" : "Check your copy"}</span>
          <p>{item.a}</p>
          {item.note && <p className="ml-note">{item.note}</p>}
        </div>
      ) : <p className="ml-hidden">Answer hidden. Tap “Show answers” at the top.</p>}
    </li>
  );
}

function ActivityCard({ a, show }: { a: Activity; show: boolean }) {
  return (
    <section className="ml-card" aria-labelledby={`act-${a.id}`}>
      <header className="ml-card-head">
        <h3 id={`act-${a.id}`}><span className="ml-num">{a.id}</span> {a.name}</h3>
        <span className="ml-min">{a.minutes} min{a.optional ? " · optional" : ""}</span>
      </header>
      <p className="ml-what">{a.what}</p>
      <h4>How to run it</h4>
      <ol className="ml-steps">{a.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      <h4>Questions and answers</h4>
      <ul className="ml-items">{a.items.map((it) => <Answer key={it.id} item={it} show={show} />)}</ul>
      {a.watch && a.watch.length > 0 && (<><h4>Watch for</h4><ul className="ml-watch">{a.watch.map((w, i) => <li key={i}>{w}</li>)}</ul></>)}
    </section>
  );
}

function SupportTabs({ l }: { l: Lesson }) {
  const [tab, setTab] = useState<"simplified" | "modified" | "extension">("simplified");
  const names = { simplified: "Simplified", modified: "Modified", extension: "Extension" } as const;
  const hint = {
    simplified: "Same goal, less load: fewer steps, easier numbers, more scaffolds.",
    modified: "Changes how the student shows learning: tools, format, partner supports. Match to the IEP.",
    extension: "For students who finish early or are ready for more.",
  } as const;
  return (
    <section className="ml-card" aria-labelledby="sup">
      <h3 id="sup">Supports for your students</h3>
      <div className="ml-tabs" role="tablist" aria-label="Kinds of support">
        {(Object.keys(names) as (keyof typeof names)[]).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "is-on" : ""} onClick={() => setTab(k)}>{names[k]}</button>
        ))}
      </div>
      <p className="ml-hint">{hint[tab]}</p>
      <ul>{l.supports[tab].map((s, i) => <li key={i}>{s}</li>)}</ul>
    </section>
  );
}

function LessonView({ l, show }: { l: Lesson; show: boolean }) {
  const mins = l.activities.filter((a) => !a.optional).reduce((s, a) => s + a.minutes, 0);
  return (
    <article className="ml-lesson">
      <header className="ml-lhead">
        <p className="ml-kicker">Lesson {l.n} · {l.section}</p>
        <h2>{l.title}</h2>
        <p className="ml-meta">About {mins} minutes of core activities. Optional activities and the cool-down are extra.</p>
      </header>
      <section className="ml-card ml-big"><h3>The big idea</h3><p>{l.bigIdea}</p></section>
      <section className="ml-card ml-first" aria-labelledby="first">
        <h3 id="first">Read this first (no math background needed)</h3>
        {l.primer.map((p, i) => <p key={i}>{p}</p>)}
      </section>
      <section className="ml-card">
        <h3>Students will be able to</h3>
        <ul>{l.targets.map((t, i) => <li key={i}>{t}</li>)}</ul>
        <h3>Words to teach</h3>
        <div className="ml-table-wrap"><table className="ml-table"><thead><tr><th>Word</th><th>In kid words</th><th>Example</th></tr></thead>
          <tbody>{l.vocab.map((v) => <tr key={v.term}><th scope="row">{v.term}</th><td>{v.kid}</td><td>{v.example}</td></tr>)}</tbody></table></div>
        <h3>Gather before class</h3>
        <ul>{l.materials.map((m, i) => <li key={i}>{m}</li>)}</ul>
      </section>
      {l.activities.map((a) => <ActivityCard key={a.id} a={a} show={show} />)}
      <section className="ml-card"><h3>Wrap up: say this</h3><ul>{l.summary.map((s, i) => <li key={i}>{s}</li>)}</ul></section>
      <SupportTabs l={l} />
      <section className="ml-card">
        <h3>Exit check (ours)</h3>
        <p className="ml-hint">The curriculum’s own cool-down is behind the publisher’s teacher sign-in, so this one is written for this guide.</p>
        <ul className="ml-items"><Answer item={l.exit} show={show} /></ul>
      </section>
      <section className="ml-card"><h3>Common mistakes</h3><ul>{l.mistakes.map((m, i) => <li key={i}>{m}</li>)}</ul></section>
      <p className="ml-links">
        <a href={UNIT.teacherUrl(l.n)} target="_blank" rel="noreferrer noopener">Publisher’s teacher page for lesson {l.n}</a>
        {" · "}
        <a href={UNIT.studentUrl(l.n)} target="_blank" rel="noreferrer noopener">Student page (printable tasks)</a>
      </p>
    </article>
  );
}

function StartHere() {
  const c = answerCounts();
  return (
    <div className="ml-lesson">
      <header className="ml-lhead">
        <p className="ml-kicker">{UNIT.title}</p>
        <h2>Teach 7th grade scale drawings, even if you have never taught it</h2>
        <p className="ml-meta">13 lessons. Every lesson has the plain-English background, how to run each activity, the answers, and supports for students who need them.</p>
      </header>
      <section className="ml-card ml-first"><h3>{START_HERE.title}</h3><ul>{START_HERE.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
        <p className="ml-move"><strong>The one move to know:</strong> {START_HERE.move}</p></section>
      <section className="ml-card"><h3>Always have on hand</h3><ul>{TOOLBOX.map((t, i) => <li key={i}>{t}</li>)}</ul></section>
      <section className="ml-card">
        <h3>How to read the answers</h3>
        <p><span className="ml-badge is-ok">Answer checked</span> The answer follows from numbers in the task. We recomputed it in automated tests ({c.ok} answers).</p>
        <p><span className="ml-badge is-figure">Check your copy</span> The answer depends on a picture, grid or card set you have in front of you ({c.figure} answers). We give the method and what the answer should look like. Confirm it against your printed sheet.</p>
        <p className="ml-note">{UNIT.gated}</p>
      </section>
      <section className="ml-card"><h3>Credit</h3>
        <p>Based on <a href={UNIT.unitUrl} target="_blank" rel="noreferrer noopener">{UNIT.source}</a>. Licensed under <a href={UNIT.licenseUrl} target="_blank" rel="noreferrer noopener">CC BY 4.0</a>. This is our own teacher-facing summary and is not endorsed by Illustrative Mathematics or Kendall Hunt. Please also use the publisher’s printable activities and blackline masters, which are free on their site.</p></section>
    </div>
  );
}

const UNIT_LIST: LengthUnit[] = ["mm", "cm", "m", "km", "in", "ft", "mi"];
const num = (s: string) => { const x = Number(s); return s.trim() !== "" && Number.isFinite(x) ? x : null; };

function Helper() {
  const [per, setPer] = useState("2");
  const [dir, setDir] = useState<"toReal" | "toDrawing">("toReal");
  const [val, setVal] = useState("5");
  const [n, setN] = useState("15");
  const [du, setDu] = useState<LengthUnit>("in");
  const [ru, setRu] = useState<LengthUnit>("ft");
  const [orig, setOrig] = useState("3, 4, 5");
  const [copy, setCopy] = useState("6, 8, 10");
  const p = num(per), v = num(val), nn = num(n);
  const parse = (s: string) => s.split(/[ ,]+/).filter(Boolean).map(Number);
  const o = parse(orig), c = parse(copy);
  const k = o.length && o.length === c.length && [...o, ...c].every((x) => Number.isFinite(x)) ? scaleFactorOf(o, c) : undefined;
  return (
    <div className="ml-lesson">
      <header className="ml-lhead"><p className="ml-kicker">Tool</p><h2>Scale helper</h2><p className="ml-meta">Check a student’s answer or build your own examples. It does the multiplying and dividing; you still explain why.</p></header>
      <section className="ml-card">
        <h3>Drawing length and real length</h3>
        <p className="ml-hint">One drawing unit stands for this many real units (for 1 cm to 2 m, type 2).</p>
        <div className="ml-form">
          <label>One drawing unit stands for<input inputMode="decimal" value={per} onChange={(e) => setPer(e.target.value)} /></label>
          <label>Find<select value={dir} onChange={(e) => setDir(e.target.value as "toReal" | "toDrawing")}><option value="toReal">real length from drawing length</option><option value="toDrawing">drawing length from real length</option></select></label>
          <label>{dir === "toReal" ? "Drawing length" : "Real length"}<input inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} /></label>
        </div>
        <p className="ml-out" aria-live="polite">{p && p > 0 && v !== null ? <>{dir === "toReal" ? "Real length" : "Drawing length"}: <strong>{fmt(dir === "toReal" ? toActual(v, p) : toDrawing(v, p))}</strong>. Area is multiplied by <strong>{fmt(areaFactor(p))}</strong> (the scale number squared).</> : "Type numbers above (the scale number must be more than 0)."}</p>
      </section>
      <section className="ml-card">
        <h3>Write a scale with no units</h3>
        <div className="ml-form">
          <label>1<select value={du} onChange={(e) => setDu(e.target.value as LengthUnit)}>{UNIT_LIST.map((u) => <option key={u}>{u}</option>)}</select> to</label>
          <label>Number<input inputMode="decimal" value={n} onChange={(e) => setN(e.target.value)} /></label>
          <label>Real unit<select value={ru} onChange={(e) => setRu(e.target.value as LengthUnit)}>{UNIT_LIST.map((u) => <option key={u}>{u}</option>)}</select></label>
        </div>
        <p className="ml-out" aria-live="polite">{nn && nn > 0 ? <>1 {du} to {fmt(nn)} {ru} is the same as <strong>1 to {fmt(unitlessScale(nn, du, ru), 2)}</strong>.</> : "Type a number more than 0."}</p>
      </section>
      <section className="ml-card">
        <h3>Is it a scaled copy?</h3>
        <p className="ml-hint">Type matching side lengths in the same order, separated by commas.</p>
        <div className="ml-form">
          <label>Original sides<input value={orig} onChange={(e) => setOrig(e.target.value)} /></label>
          <label>Copy sides<input value={copy} onChange={(e) => setCopy(e.target.value)} /></label>
        </div>
        <p className="ml-out" aria-live="polite">{k === undefined ? "Type the same number of sides in each box." : k === null ? <>Not a scaled copy: the lengths do not all use the same scale factor.</> : <>Yes, if the angles match too. Scale factor <strong>{fmt(k)}</strong>. Area factor <strong>{fmt(areaFactor(k))}</strong>.</>}</p>
      </section>
    </div>
  );
}

export default function MathLessons() {
  const [view, setView] = useState<View>(readView);
  const [show, setShow] = useState(readAnswers);
  useEffect(() => { document.title = "Math Lessons | A.R.I.S.E."; }, []);
  useEffect(() => { try { localStorage.setItem(KEY, String(view)); } catch { /* fine */ } window.scrollTo?.({ top: 0 }); }, [view]);
  useEffect(() => { try { localStorage.setItem(`${KEY}-answers`, show ? "on" : "off"); } catch { /* fine */ } }, [show]);
  const lesson = typeof view === "number" ? LESSONS.find((l) => l.n === view) : undefined;
  const idx = lesson ? LESSONS.indexOf(lesson) : -1;
  const body = useMemo(() => view === "start" ? <StartHere /> : view === "helper" ? <Helper /> : lesson ? <LessonView l={lesson} show={show} /> : <StartHere />, [view, lesson, show]);
  return (
    <div className="ml-root">
      <header className="ml-top">
        <div className="ml-top-row">
          <a className="ml-back" href="#/workhub">← WorkHub</a>
          <h1>Math Lessons</h1>
          <div className="ml-tools">
            <button type="button" aria-pressed={show} onClick={() => setShow(!show)}>{show ? "Hide answers" : "Show answers"}</button>
            <button type="button" onClick={() => window.print()}>Print</button>
          </div>
        </div>
        <nav className="ml-nav" aria-label="Lessons">
          <button type="button" aria-current={view === "start" ? "page" : undefined} className={view === "start" ? "is-on" : ""} onClick={() => setView("start")}>Start here</button>
          {LESSONS.map((l) => (
            <button key={l.n} type="button" aria-label={`Lesson ${l.n}: ${l.title}`} title={l.title} aria-current={view === l.n ? "page" : undefined} className={view === l.n ? "is-on" : ""} onClick={() => setView(l.n)}>{l.n}</button>
          ))}
          <button type="button" aria-current={view === "helper" ? "page" : undefined} className={view === "helper" ? "is-on" : ""} onClick={() => setView("helper")}>Scale helper</button>
        </nav>
      </header>
      <main className="ml-main">{body}
        {lesson && (
          <div className="ml-pager">
            <button type="button" disabled={idx <= 0} onClick={() => setView(LESSONS[idx - 1].n)}>← Previous lesson</button>
            <button type="button" disabled={idx >= LESSONS.length - 1} onClick={() => setView(LESSONS[idx + 1].n)}>Next lesson →</button>
          </div>
        )}
      </main>
      <footer className="ml-foot">{UNIT.source}. <a href={UNIT.licenseUrl} target="_blank" rel="noreferrer noopener">CC BY 4.0</a>.</footer>
    </div>
  );
}
