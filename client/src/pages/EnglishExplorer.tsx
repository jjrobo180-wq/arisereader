// English Explorer (#/english): the English-language-learner program, for the students a teacher turned it
// on for. A trail of lessons across six levels (shared/ariseEnglish.ts), each lesson: meet the words, then
// play with them (hear and find, read and find, spell, fill the blank, build the sentence, say it).
// Every word is spoken by the premium AI voice; Spanish help when the teacher turned it on.
// Points go on the A.R.I.S.E. leaderboard. The server checks every answer (server/ariseEnglish.ts).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { LEVELS, KIND_LABEL, VOICE_LINES, isCognate, unitById, wordById, type ItemKind, type PublicItem } from "@shared/ariseEnglish";
import { canRecord, preload, record, say, sayAll, setVoiceToken, sounds, stopVoice } from "@/lib/englishVoice";
import "./englishExplorer.css";

type Me = {
  enabled: boolean; staff?: boolean; preview?: boolean; name?: string; help?: boolean; level?: number; startLevel?: number;
  units?: Record<string, { stars: number; best: number; plays: number }>; open?: string[]; words?: Record<string, string>;
  mastered?: number; learning?: number; due?: number; streak?: number; today?: { points: number; lessons: number }; points?: number; dailyCap?: number;
  setup?: boolean; message?: string;
};
type Session = { id: string; kind: "lesson" | "review"; unitId: string | null; items: PublicItem[]; words: { id: string; w: string; e: string; s: string; es: string; m: string | null }[] };
type Result = {
  score: number; total: number; stars: number; points: number; capped: boolean; levelUp: number | null; preview: boolean; next: string | null;
  spoken: { right: number; tried: number }; learned: string[]; mastered: string[]; missed: { w: string; e: string }[];
};
type Feedback = { correct: boolean; answer: string; show: string; word: { id: string; w: string; e: string; s: string; es: string } };

function useFonts() {
  useEffect(() => {
    if (document.getElementById("ee-fonts")) return;
    const l = document.createElement("link");
    l.id = "ee-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Andika:wght@400;700&family=Baloo+2:wght@500;600;700;800&display=swap";
    document.head.appendChild(l);
  }, []);
}

/* ------------------------------------------------------------------ pictures */

/** Pico the parrot, English Explorer's guide (parrots are good at repeating words). */
export function Pico({ size = 72, mood = "happy", className = "" }: { size?: number; mood?: "happy" | "cheer" | "think" | "sleep"; className?: string }) {
  const wingUp = mood === "cheer";
  return (
    <svg className={`ee-pico ${className}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M38 80 L30 98 L40 92 L44 99 L48 84 Z" fill="#2563eb" />
      <path d="M46 82 L48 99 L54 90 L60 98 L56 80 Z" fill="#e11d48" />
      <ellipse cx="50" cy="62" rx="22" ry="25" fill="#22a95a" />
      <ellipse cx="52" cy="68" rx="13" ry="15" fill="#c9f2d6" />
      <g transform={wingUp ? "rotate(-55 34 56)" : "rotate(8 34 56)"}><ellipse cx="32" cy="62" rx="9" ry="17" fill="#178a45" /><path d="M27 72 q5 8 10 0" fill="#ffb627" /></g>
      <g transform={wingUp ? "rotate(55 68 56)" : "rotate(-8 68 56)"}><ellipse cx="70" cy="62" rx="8" ry="15" fill="#178a45" /></g>
      <circle cx="52" cy="34" r="19" fill="#2fc06a" />
      <path d="M44 16 q4 -10 10 -2 q4 -8 8 2" fill="#ffb627" />
      <circle cx="58" cy="31" r="7.5" fill="#fff" />
      {mood === "sleep" ? <path d="M53 31 q5 4 10 0" stroke="#1f2a44" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        : mood === "happy" || mood === "cheer" ? <path d="M53.5 32 q4.5 -5 9 0" stroke="#1f2a44" strokeWidth="3" fill="none" strokeLinecap="round" />
        : <><circle cx="59" cy="30" r="3.6" fill="#1f2a44" /><circle cx="60.3" cy="28.8" r="1.2" fill="#fff" /></>}
      <path d="M66 36 q13 0 11 12 q-3 -6 -11 -4 z" fill="#ffb627" stroke="#d98a00" strokeWidth="1.2" />
      <circle cx="46" cy="40" r="3.4" fill="#ff8fab" opacity=".75" />
    </svg>
  );
}

/** A ball and a box (or two), for the "where" words. */
function Scene({ where, size }: { where: string; size: number }) {
  const box = (x: number) => <g key={x}><rect x={x} y="44" width="36" height="30" rx="3" fill="#c98a4b" stroke="#8a5a2b" strokeWidth="2.5" /><path d={`M${x} 52 h36`} stroke="#8a5a2b" strokeWidth="2" /><rect x={x + 3} y="74" width="5" height="10" fill="#8a5a2b" /><rect x={x + 28} y="74" width="5" height="10" fill="#8a5a2b" /></g>;
  const ball = (cx: number, cy: number, r = 9) => <g><circle cx={cx} cy={cy} r={r} fill="#e11d48" /><circle cx={cx - r / 3} cy={cy - r / 3} r={r / 3.5} fill="#fff" opacity=".7" /></g>;
  let body: ReactNode;
  switch (where) {
    case "in": body = <>{box(42)}{ball(60, 50, 8)}<rect x="42" y="52" width="36" height="22" rx="2" fill="#c98a4b" stroke="#8a5a2b" strokeWidth="2.5" /></>; break;
    case "on": body = <>{box(42)}{ball(60, 34)}</>; break;
    case "under": body = <>{box(42)}{ball(60, 80, 6)}</>; break;
    case "next": body = <>{box(30)}{ball(86, 75)}</>; break;
    case "behind": body = <>{ball(64, 40, 10)}{box(42)}</>; break;
    case "front": body = <>{box(42)}{ball(60, 78, 12)}</>; break;
    case "between": body = <>{box(10)}{box(74)}{ball(60, 75)}</>; break;
    case "over": body = <>{box(42)}{ball(60, 16)}<path d="M40 30 q20 -24 40 0" stroke="#e11d48" strokeWidth="2" strokeDasharray="4 4" fill="none" /></>; break;
    default: body = box(42);
  }
  return <svg width={size} height={size * 0.83} viewBox="0 0 120 100" role="img" aria-label="a ball and a box"><rect x="0" y="84" width="120" height="3" fill="#7fb5bd" />{body}</svg>;
}
function Calendar({ days, size }: { days: string; size: number }) {
  const list = days.split("+");
  return <span style={{ display: "inline-flex", gap: 6 }}>{list.map((d) => (
    <svg key={d} width={size * (list.length > 1 ? 0.62 : 0.85)} height={size * (list.length > 1 ? 0.62 : 0.85)} viewBox="0 0 80 80" role="img" aria-label={d}>
      <rect x="4" y="10" width="72" height="66" rx="10" fill="#fff" stroke="#1f2a44" strokeWidth="3" />
      <rect x="4" y="10" width="72" height="20" rx="10" fill="#e11d48" /><rect x="4" y="22" width="72" height="8" fill="#e11d48" />
      <rect x="20" y="4" width="6" height="14" rx="3" fill="#1f2a44" /><rect x="54" y="4" width="6" height="14" rx="3" fill="#1f2a44" />
      <text x="40" y="62" textAnchor="middle" fontSize="24" fontWeight="700" fontFamily="Andika, sans-serif" fill="#1f2a44">{d}</text>
    </svg>))}</span>;
}
function Picture({ e, size = 96 }: { e: string; size?: number }) {
  if (e.startsWith("scene:")) return <Scene where={e.slice(6)} size={size * 1.75} />;
  if (e.startsWith("cal:")) return <Calendar days={e.slice(4)} size={size} />;
  return <span className="ee-emoji" style={{ fontSize: size }} role="img" aria-hidden="true">{e}</span>;
}
const Stars = ({ n, of = 3 }: { n: number; of?: number }) => <span className="ee-stars" aria-label={`${n} of ${of} stars`}>{Array.from({ length: of }, (_, i) => <span key={i} className={i < n ? "" : "off"}>★</span>)}</span>;

function Confetti({ go }: { go: number }) {
  const [bits, setBits] = useState<{ id: number; left: number; color: string; dur: number; delay: number }[]>([]);
  useEffect(() => {
    if (!go) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#ffb627", "#22a95a", "#2563eb", "#e11d48", "#8b5cf6", "#06b6d4"];
    setBits(Array.from({ length: 60 }, (_, i) => ({ id: go * 100 + i, left: Math.random() * 100, color: colors[i % colors.length], dur: 1.6 + Math.random() * 1.4, delay: Math.random() * 0.4 })));
    const t = setTimeout(() => setBits([]), 3400);
    return () => clearTimeout(t);
  }, [go]);
  return bits.length ? <div className="ee-confetti" aria-hidden="true">{bits.map((b) => <i key={b.id} style={{ left: `${b.left}%`, background: b.color, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }} />)}</div> : null;
}

/* ------------------------------------------------------------------ the page */

export default function EnglishExplorer() {
  useFonts();
  const { token, user } = useAuth();
  const [, navigate] = useLocation();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setVoiceToken(token); }, [token]);
  useEffect(() => () => stopVoice(), []);

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    const r = await fetch(`${API_BASE}${path}`, { ...init, headers: { ...(init.body && !(init.body instanceof Blob) ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) }, cache: "no-store" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { const e: any = new Error(data.message || "Something went wrong. Please try again."); e.data = data; throw e; }
    return data;
  }, [token]);

  const load = useCallback(async () => {
    try { setMe(await api("/api/english/me")); setError(""); }
    catch (e: any) { setMe({ enabled: false, setup: !!e?.data?.setup, message: e?.message }); }
  }, [api]);
  useEffect(() => { if (token) void load(); }, [token, load]);

  const start = async (body: { unitId?: string; review?: boolean }) => {
    setBusy(true); setError("");
    try {
      const s: Session = await api("/api/english/sessions", { method: "POST", body: JSON.stringify(body) });
      preload([...VOICE_LINES_FOR(s), ...s.words.flatMap((w) => [{ text: w.w }, { text: w.s }])]);
      setResult(null); setSession(s);
      window.scrollTo(0, 0);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (!user) return null;
  if (!me) return <div className="ee"><div className="ee-wrap" style={{ paddingTop: 80, textAlign: "center" }}><Pico size={110} className="bob" /><p>Getting your words ready…</p></div></div>;
  if (!me.enabled) return <NotOn me={me} onBack={() => navigate("/library")} />;

  if (session && !result) return <Lesson session={session} me={me} api={api}
    onQuit={() => { stopVoice(); setSession(null); void load(); }}
    onDone={(r) => { setResult(r); void load(); window.scrollTo(0, 0); }} />;
  if (session && result) return <Results result={result} session={session} me={me}
    onMap={() => { setSession(null); setResult(null); }}
    onAgain={() => void start(session.unitId ? { unitId: session.unitId } : { review: true })}
    onNext={result.next ? () => void start({ unitId: result.next! }) : undefined} />;

  return <Home me={me} busy={busy} error={error} onStart={start} onBack={() => navigate("/library")} onBoard={() => navigate("/leaderboard")} />;
}

const VOICE_LINES_FOR = (s: Session) => [...new Set(s.items.map((i) => i.kind))].map((k) => ({ text: VOICE_LINES.en[k as keyof typeof VOICE_LINES.en] }));

function NotOn({ me, onBack }: { me: Me; onBack: () => void }) {
  return <div className="ee"><div className="ee-wrap" style={{ paddingTop: 48, textAlign: "center" }}>
    <Pico size={130} mood="sleep" className="bob" />
    <h1 style={{ fontSize: 34, margin: "10px 0 6px" }}>English Explorer</h1>
    <p style={{ fontSize: 20, maxWidth: 520, margin: "0 auto 20px" }}>{me.setup ? "English Explorer is almost ready. Please check back soon." : me.message || "Your teacher turns on English Explorer for you. Ask your teacher if you want to learn English words here."}</p>
    <button type="button" className="ee-cta alt" style={{ maxWidth: 320 }} onClick={onBack}>Back to the library</button>
  </div></div>;
}

/* ------------------------------------------------------------------ home: the trail */

function Home({ me, busy, error, onStart, onBack, onBoard }: { me: Me; busy: boolean; error: string; onStart: (b: { unitId?: string; review?: boolean }) => void; onBack: () => void; onBoard: () => void }) {
  const open = new Set(me.open || []);
  const units = me.units || {};
  // The next lesson: the first unplayed one from the student's starting level up (lower levels stay open to explore).
  const allUnits = LEVELS.flatMap((l) => l.units);
  const fresh = (u: (typeof allUnits)[number]) => open.has(u.id) && !(units[u.id]?.stars);
  const next = allUnits.find((u) => fresh(u) && u.level >= (me.startLevel || 1)) || allUnits.find(fresh) || null;
  const nextLevelRef = useRef<HTMLElement | null>(null);
  const greeted = useRef(false);
  useEffect(() => {
    if (greeted.current) return; greeted.current = true;
    if (!sessionStorage.getItem("ee-welcomed")) { try { sessionStorage.setItem("ee-welcomed", "1"); } catch { /* fine */ } void say(VOICE_LINES.en.welcome); }
    // Scroll to where the student is on the trail.
    setTimeout(() => nextLevelRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 400);
  }, []);
  const wordsIn = (unitId: string) => { const u = unitById(unitId)!; return u.words.filter((w) => me.words?.[w.id] === "mastered").length; };
  return <div className="ee">
    <div className="ee-wrap">
      <div className="ee-top">
        <button type="button" className="ee-icon-btn" onClick={() => { stopVoice(); onBack(); }} aria-label="Back to the library">← Library</button>
        <span className="ee-spacer" />
        <span className="ee-chip" title="Days in a row">🔥 {me.streak || 0}</span>
        <button type="button" className="ee-chip" onClick={onBoard} title="Your English points are on the A.R.I.S.E. leaderboard">🏆 {me.points || 0}</button>
      </div>
      {me.preview && <div className="ee-preview">Teacher preview: every lesson is open, and nothing you do here is saved or scored.</div>}
      <div className="ee-hello">
        <Pico size={84} className="bob" />
        <div className="ee-bubble">
          <h1>Hi, {me.name}!</h1>
          <p>{me.today?.lessons ? `You played ${me.today.lessons} ${me.today.lessons === 1 ? "lesson" : "lessons"} today. Keep going!` : "Let's learn some English words today."}{me.help ? <span className="es" style={{ display: "block" }}>¡Vamos a aprender palabras en inglés!</span> : null}</p>
        </div>
      </div>
      {error && <div className="ee-preview" role="alert" style={{ borderColor: "#b86b00", color: "#8a4b00" }}>{error}</div>}
      <div className="ee-today">
        {next ? <button type="button" className="ee-go" disabled={busy} onClick={() => onStart({ unitId: next.id })}>
          <span className="big" aria-hidden="true">{next.icon}</span>
          <span><b>{units[next.id]?.plays ? "Keep going" : "Start"}: {next.title}</b><span>Level {next.level}, {next.words.length} words{me.help ? ` · ${next.es}` : ""}</span></span>
        </button> : <div className="ee-bubble">You finished every lesson! Review your words to keep them strong.</div>}
        <button type="button" className="ee-go ee-review" disabled={busy || (!me.due && !me.learning && !me.preview)} onClick={() => onStart({ review: true })}>
          <span className="big" aria-hidden="true">🔁</span>
          <span><b>{me.due ? `Review ${me.due} ${me.due === 1 ? "word" : "words"}` : "Practice words"}</b><span>{me.due ? "They're ready to come back" : me.learning ? "Make your words stronger" : "Play a lesson first"}</span></span>
        </button>
      </div>
      <div className="ee-stats">
        <span className="ee-chip">⭐ {me.mastered || 0} words mastered</span>
        <span className="ee-chip">🌱 {me.learning || 0} learning</span>
        <span className="ee-chip">Today {me.today?.points || 0} / {me.dailyCap} points</span>
      </div>

      {LEVELS.map((level) => {
        const unlocked = level.n <= (me.level || 1);
        return <section key={level.n} className={`ee-land${unlocked ? "" : " locked"}`} style={{ ["--c" as any]: level.color }} ref={next?.level === level.n ? (el) => { nextLevelRef.current = el; } : undefined} aria-label={`Level ${level.n}: ${level.title}`}>
          <h2>Level {level.n}: {level.title}</h2>
          <p className="meta">{unlocked ? level.goal : `Finish level ${level.n - 1} to open this level.`}{me.help ? ` (${level.es})` : ""}</p>
          <ol className="ee-trail">
            {level.units.map((u) => {
              const isOpen = open.has(u.id);
              const p = units[u.id];
              const isNext = next?.id === u.id;
              return <li key={u.id}>
                <button type="button" className={`ee-stop${p?.stars ? " done" : ""}${isNext ? " next" : ""}`} disabled={!isOpen || busy} onClick={() => onStart({ unitId: u.id })} aria-label={`${u.title}${isOpen ? "" : ", locked"}${p?.stars ? `, ${p.stars} stars` : ""}`}>
                  <span className="ee-node">{isOpen ? u.icon : "🔒"}{isNext && <span className="ee-here"><Pico size={46} /></span>}</span>
                  <span className="t">{u.title}</span>
                  {p?.plays ? <Stars n={p.stars} /> : <span className="s">{isOpen ? `${u.words.length} words` : ""}</span>}
                  {p?.plays && wordsIn(u.id) > 0 ? <span className="s">{wordsIn(u.id)}/{u.words.length} mastered</span> : null}
                </button>
              </li>;
            })}
          </ol>
        </section>;
      })}
      <p style={{ textAlign: "center", color: "#4d5b78", fontSize: 15 }}>Your English points count on the A.R.I.S.E. leaderboard.</p>
    </div>
  </div>;
}

/* ------------------------------------------------------------------ a lesson */

function Lesson({ session, me, api, onQuit, onDone }: { session: Session; me: Me; api: (p: string, i?: RequestInit) => Promise<any>; onQuit: () => void; onDone: (r: Result) => void }) {
  const unit = session.unitId ? unitById(session.unitId) : null;
  const playedBefore = !!(session.unitId && me.units?.[session.unitId]?.plays);
  const [phase, setPhase] = useState<"learn" | "play">(session.kind === "lesson" ? "learn" : "play");
  const [card, setCard] = useState(0);
  const [i, setI] = useState(0);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [combo, setCombo] = useState(0);
  const [cheer, setCheer] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [err, setErr] = useState("");
  const started = useRef(Date.now());
  const item = session.items[i];
  const help = !!me.help;
  const learnSteps = session.kind === "lesson" ? session.words.length : 0;
  const progress = Math.round(((phase === "learn" ? card : learnSteps + i) / Math.max(1, learnSteps + session.items.length)) * 100);

  const finish = async () => {
    setFinishing(true);
    try { onDone(await api(`/api/english/sessions/${session.id}/finish`, { method: "POST", body: "{}" })); }
    catch (e: any) { setErr(e.message); setFinishing(false); }
  };
  const nextItem = () => {
    stopVoice(); setFb(null); setPicked(null); started.current = Date.now();
    if (i + 1 >= session.items.length) void finish(); else setI(i + 1);
  };
  const answer = async (value: string) => {
    if (fb || picked) return;
    setPicked(value);
    try {
      const r: Feedback = await api(`/api/english/sessions/${session.id}/answer`, { method: "POST", body: JSON.stringify({ index: i, answer: value, ms: Date.now() - started.current }) });
      setFb(r);
      if (r.correct) {
        const c = combo + 1; setCombo(c); setCheer((n) => n + 1);
        (c >= 3 ? sounds.combo : sounds.right)();
        const praise = [VOICE_LINES.en.great, VOICE_LINES.en.yes, VOICE_LINES.en.super, VOICE_LINES.en.awesome][c % 4];
        void sayAll([{ text: praise }, { text: item.kind === "blank" || item.kind === "order" || item.kind === "context" ? r.word.s : r.word.w }]);
      } else {
        setCombo(0); sounds.miss();
        void sayAll([{ text: VOICE_LINES.en.tryAgain }, { text: item.kind === "order" || item.kind === "blank" ? r.word.s : r.word.w }]);
      }
    } catch (e: any) { setPicked(null); setErr(e.message); }
  };

  return <div className="ee"><div className="ee-lesson">
    <div className="ee-top">
      <button type="button" className="ee-icon-btn" onClick={onQuit} aria-label="Stop and go back to the map">✕</button>
      <div className="ee-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Lesson progress"><i style={{ width: `${progress}%` }} /></div>
      <span className="ee-combo" aria-live="polite">{combo >= 3 ? `🔥 ${combo}` : ""}</span>
    </div>
    {me.preview && <div className="ee-preview">Teacher preview: nothing is saved.</div>}
    {err && <div className="ee-preview" role="alert">{err}</div>}

    {phase === "learn" && <LearnCard key={card} word={session.words[card]} help={help} n={card} of={session.words.length} unitTitle={unit?.title || ""}
      onNext={() => { if (card + 1 >= session.words.length) { stopVoice(); setPhase("play"); } else setCard(card + 1); }}
      onSkip={playedBefore ? () => { stopVoice(); setPhase("play"); } : undefined} />}

    {phase === "play" && item && <div className="ee-stage">
      <Ask item={item} help={help} first={i === 0 || session.items[i - 1].kind !== item.kind} />
      <ItemView key={i} item={item} session={session} index={i} api={api} picked={picked} fb={fb} onAnswer={answer} help={help}
        onSpoken={(ok) => { if (ok) { setCheer((n) => n + 1); sounds.right(); } }} onNext={nextItem} />
      {fb && <FeedbackSheet fb={fb} kind={item.kind} help={help} cheer={cheer} onNext={nextItem} last={i + 1 >= session.items.length} busy={finishing} />}
    </div>}
    {finishing && !fb && <div className="ee-show" style={{ paddingTop: 40 }}><Pico size={100} className="bob" /><p>Counting your stars…</p></div>}
  </div></div>;
}

function Ask({ item, help, first }: { item: PublicItem; help: boolean; first: boolean }) {
  const line = VOICE_LINES.en[item.kind as keyof typeof VOICE_LINES.en];
  const es = VOICE_LINES.es[item.kind as keyof typeof VOICE_LINES.es];
  useEffect(() => {
    // The question is said aloud: the instruction the first time a kind comes up, then the word or sentence to hear.
    const parts: { text: string; lang?: "en" | "es" }[] = [];
    if (item.kind === "speak") return; // "Say it" speaks for itself
    if (first) parts.push({ text: line });
    if (item.say) parts.push({ text: item.say });
    if (parts.length) void sayAll(parts);
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="ee-ask">
    <button type="button" className="ee-icon-btn" onClick={() => void say(line)} aria-label="Hear the instructions">🔊</button>
    <div><span className="q">{KIND_LABEL[item.kind as ItemKind]}</span>{help && <button type="button" className="es ee-link" lang="es" style={{ padding: 0, textDecoration: "none", textAlign: "left" }} onClick={() => void say(es, { lang: "es" })}>{es}</button>}</div>
  </div>;
}

function LearnCard({ word, help, n, of, unitTitle, onNext, onSkip }: { word: Session["words"][number]; help: boolean; n: number; of: number; unitTitle: string; onNext: () => void; onSkip?: () => void }) {
  const full = wordById(word.id);
  const cognate = help && full ? isCognate(full) : false;
  const sayIt = (slow = false) => void sayAll([{ text: word.w, slow }, { text: word.s, slow }]);
  useEffect(() => { void sayAll([...(n === 0 ? [{ text: VOICE_LINES.en.learn }] : []), { text: word.w }, { text: word.s }]); }, [word.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const sentence = useMemo(() => {
    const target = word.s.toLowerCase().includes(word.w.toLowerCase()) ? word.w : full?.k || word.w; const at = word.s.toLowerCase().indexOf(target.toLowerCase());
    return at < 0 ? word.s : <>{word.s.slice(0, at)}<b style={{ color: "#0a5f67" }}>{word.s.slice(at, at + target.length)}</b>{word.s.slice(at + target.length)}</>;
  }, [word, full]);
  return <div className="ee-stage">
    <div className="ee-ask"><span className="q">New words: {unitTitle}</span><span className="ee-spacer" /><span className="ee-chip">{n + 1} / {of}</span></div>
    <div className="ee-card">
      <button type="button" onClick={() => sayIt()} style={{ border: 0, background: "none" }} aria-label={`Hear ${word.w}`}><Picture e={word.e} size={120} /></button>
      <div className="word">{word.w}</div>
      {word.m && <p className="mean">{word.m}</p>}
      <p className="sent word">{sentence}</p>
      {help && <div><button type="button" className="ee-es" onClick={() => void say(word.es, { lang: "es" })} aria-label={`In Spanish: ${word.es}`}>🗣️ <span lang="es">{word.es}</span></button></div>}
      {cognate && <span className="ee-cognate">Looks like Spanish! / ¡Se parece al español!</span>}
      <div className="ee-row">
        <button type="button" className="ee-play small" onClick={() => sayIt()} aria-label="Hear it again">🔊</button>
        <button type="button" className="ee-play small" onClick={() => sayIt(true)} aria-label="Hear it slowly">🐢</button>
      </div>
    </div>
    <button type="button" className="ee-cta" onClick={() => { sounds.tap(); onNext(); }}>{n + 1 >= of ? "Let's play!" : "Next word"}</button>
    {onSkip && <button type="button" className="ee-link" onClick={onSkip}>I know these words. Skip to the games.</button>}
  </div>;
}

function ItemView({ item, session, index, api, picked, fb, onAnswer, onSpoken, onNext, help }: {
  item: PublicItem; session: Session; index: number; api: (p: string, i?: RequestInit) => Promise<any>; picked: string | null; fb: Feedback | null;
  onAnswer: (v: string) => void; onSpoken: (ok: boolean) => void; onNext: () => void; help: boolean;
}) {
  const word = wordById(item.wordId);
  const tileState = (id: string) => (!fb ? "" : id === fb.answer ? " right" : id === picked ? " wrong" : "");
  const replay = (slow = false) => item.say && void say(item.say, { slow });
  const hearBtn = <div className="ee-hear"><button type="button" className="ee-play" onClick={() => replay()} aria-label="Hear it again">🔊</button><button type="button" className="ee-play small" style={{ alignSelf: "center" }} onClick={() => replay(true)} aria-label="Hear it slowly">🐢</button></div>;
  const pictureGrid = () => <div className="ee-grid">{(item.choices || []).map((c) => <button key={c.id} type="button" className={`ee-tile${tileState(c.id)}`} disabled={!!fb || !!picked} onClick={() => { sounds.tap(); onAnswer(c.id); }} aria-label={wordById(c.id)?.w && fb ? wordById(c.id)!.w : "picture"}><Picture e={c.e || ""} size={78} /></button>)}</div>;
  const textGrid = (speak: boolean) => <div className="ee-grid">{(item.choices || []).map((c) => {
    const long = (c.text || "").length > 22;
    return <button key={c.id} type="button" className={`ee-tile text word${long ? " long" : ""}${tileState(c.id)}`} disabled={!!fb || !!picked} onClick={() => { sounds.tap(); onAnswer(c.id); }}>
      {c.text}
      {speak && <span className="hear" role="button" tabIndex={-1} aria-label={`Hear ${c.text}`} onClick={(e) => { e.stopPropagation(); void say(c.text || ""); }}>🔊</span>}
    </button>;
  })}</div>;

  switch (item.kind) {
    case "listen": return <>{hearBtn}{pictureGrid()}</>;
    case "context": return <><div className="ee-show"><div className="line word">{item.prompt}</div></div>{hearBtn}{pictureGrid()}</>;
    case "see": return <><div className="ee-show"><div className="word">{item.prompt}</div></div>{pictureGrid()}</>;
    case "name": return <><div className="ee-pic-big"><Picture e={word?.e || ""} size={120} /></div>{textGrid((word?.level || 1) <= 2)}</>;
    case "meaning": return <><div className="ee-show"><div className="line">{item.prompt}</div></div>{textGrid(false)}</>;
    case "define": return <><div className="ee-show"><div className="word">{item.prompt}</div><button type="button" className="ee-link" onClick={() => void say(item.prompt || "")}>🔊 Hear it</button></div>{textGrid(false)}</>;
    case "blank": {
      const [a, b] = String(item.prompt || "").split("___");
      const filled = fb ? fb.show : null;
      return <><div className="ee-show"><div className="line word">{a}<span className="ee-blank">{filled}</span>{b}</div></div>{textGrid(false)}</>;
    }
    case "spell": return <Builder key={index} item={item} hearBtn={hearBtn} picture={word?.e} joiner="" onCheck={onAnswer} locked={!!fb || !!picked} />;
    case "order": return <Builder key={index} item={item} hearBtn={hearBtn} joiner=" " onCheck={onAnswer} locked={!!fb || !!picked} />;
    case "speak": return <Speak key={index} item={item} session={session} index={index} api={api} onSpoken={onSpoken} onNext={onNext} help={help} />;
  }
}

/** Spell it (letter tiles) or build the sentence (word tiles): tap a tile to place it, tap a placed one to take it back. */
function Builder({ item, hearBtn, picture, joiner, onCheck, locked }: { item: PublicItem; hearBtn: ReactNode; picture?: string; joiner: string; onCheck: (v: string) => void; locked: boolean }) {
  const tiles = item.tiles || [];
  const [placed, setPlaced] = useState<number[]>([]);
  const words = joiner === " ";
  return <>
    {hearBtn}
    {picture && <div className="ee-pic-big"><Picture e={picture} size={72} /></div>}
    <div className="ee-slots word" aria-label="Your answer">
      {placed.length ? placed.map((t, k) => <button key={`${t}-${k}`} type="button" className="ee-slot filled" disabled={locked} onClick={() => setPlaced(placed.filter((_, j) => j !== k))}>{tiles[t]}</button>)
        : <span className="ee-slot" style={{ minWidth: 180, fontSize: 18, color: "#4d5b78" }}>{words ? "Tap the words in order" : "Tap the letters"}</span>}
    </div>
    <div className="ee-tiles word">{tiles.map((t, k) => <button key={k} type="button" className="ee-letter" disabled={locked || placed.includes(k)} onClick={() => { sounds.tap(); setPlaced([...placed, k]); }}>{t}</button>)}</div>
    {!locked && <button type="button" className="ee-cta" disabled={!placed.length} onClick={() => onCheck(placed.map((k) => tiles[k]).join(joiner))}>Check</button>}
  </>;
}

/** Say it: the child records the word; the server listens and compares. Never required, never stored. */
function Speak({ item, session, index, api, onSpoken, onNext, help }: { item: PublicItem; session: Session; index: number; api: (p: string, i?: RequestInit) => Promise<any>; onSpoken: (ok: boolean) => void; onNext: () => void; help: boolean }) {
  const word = wordById(item.wordId);
  const [state, setState] = useState<"ready" | "rec" | "think" | "right" | "again" | "error">("ready");
  const [heard, setHeard] = useState("");
  const [tries, setTries] = useState(0);
  const [msg, setMsg] = useState("");
  const able = canRecord();
  useEffect(() => { void sayAll([{ text: VOICE_LINES.en.speak }, { text: item.say || "" }]); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const go = async () => {
    stopVoice(); setMsg(""); setState("rec");
    try {
      const blob = await record();
      setState("think");
      const d = await api(`/api/english/sessions/${session.id}/speak/${index}`, { method: "POST", headers: { "Content-Type": (blob.type || "audio/webm").split(";")[0] }, body: blob });
      setHeard(d.heard || ""); setTries(d.tries || tries + 1);
      if (d.correct) { setState("right"); onSpoken(true); void sayAll([{ text: VOICE_LINES.en.super }, { text: item.say || "" }]); }
      else { setState("again"); void sayAll([{ text: VOICE_LINES.en.tryAgain }, { text: item.say || "", slow: true }]); }
    } catch (e: any) {
      setState("error");
      setMsg(e?.name === "NotAllowedError" ? "The microphone is off. You can skip this one." : e?.message || "I couldn't listen that time.");
    }
  };
  const skip = async () => { stopVoice(); try { await api(`/api/english/sessions/${session.id}/skip/${index}`, { method: "POST", body: "{}" }); } catch { /* fine */ } onNext(); };
  void help;
  return <>
    <div className="ee-pic-big"><Picture e={word?.e || ""} size={110} /></div>
    <div className="ee-show"><div className="word">{item.prompt}</div></div>
    <div className="ee-hear"><button type="button" className="ee-play small" onClick={() => void say(item.say || "")} aria-label="Hear it">🔊</button><button type="button" className="ee-play small" onClick={() => void say(item.say || "", { slow: true })} aria-label="Hear it slowly">🐢</button></div>
    {able ? <div className="ee-show">
      {(state === "ready" || state === "again" || state === "error" || state === "rec") && <button type="button" className={`ee-mic${state === "rec" ? " on" : ""}`} disabled={state === "rec"} onClick={() => void go()} aria-label={state === "rec" ? "Listening" : "Tap and say the word"}>🎤</button>}
      {state === "think" && <Pico size={90} mood="think" className="bob" />}
      <p className="ee-heard" aria-live="polite">{state === "rec" ? "I'm listening…" : state === "think" ? "Let me hear…" : state === "right" ? `I heard “${heard}”. Great speaking!` : state === "again" ? (heard ? `I heard “${heard}”. Try again!` : "I didn't hear you. Try again, a little louder!") : msg || "Tap the microphone and say it."}</p>
    </div> : <p className="ee-show">This device can't use the microphone. Say it out loud to yourself, then go on.</p>}
    {state === "right" || tries >= 3 || !able || state === "error"
      ? <button type="button" className="ee-cta" onClick={() => (state === "right" ? onNext() : void skip())}>Continue</button>
      : <button type="button" className="ee-link" onClick={() => void skip()}>Skip this one</button>}
  </>;
}

function FeedbackSheet({ fb, kind, help, cheer, onNext, last, busy }: { fb: Feedback; kind: ItemKind; help: boolean; cheer: number; onNext: () => void; last: boolean; busy: boolean }) {
  const btn = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { btn.current?.focus(); }, []);
  const showSentence = kind === "blank" || kind === "order" || kind === "context";
  return <div className={`ee-sheet ${fb.correct ? "good" : "oops"}`} role="status">
    <div className="row">
      {fb.correct ? <Pico key={cheer} size={64} mood="cheer" className="cheer" /> : <Picture e={fb.word.e} size={56} />}
      <div>
        <h3>{fb.correct ? ["Great job!", "Yes!", "Super!", "Awesome!"][cheer % 4] : "Good try!"}</h3>
        <p className="word">{fb.correct ? (showSentence ? fb.word.s : fb.word.w) : <>The answer is <b>{kind === "define" ? fb.show : showSentence ? fb.word.s : fb.word.w}</b></>}</p>
        {help && !fb.correct && <p lang="es" style={{ color: "#4d5b78", fontSize: 16 }}>{fb.word.es}</p>}
      </div>
      <span className="ee-spacer" />
      <button type="button" className="ee-icon-btn" onClick={() => void say(showSentence ? fb.word.s : fb.word.w)} aria-label="Hear it">🔊</button>
    </div>
    <button ref={btn} type="button" className="ee-cta" disabled={busy} onClick={onNext}>{last ? "See my stars" : "Continue"}</button>
  </div>;
}

/* ------------------------------------------------------------------ results */

function Results({ result, session, me, onMap, onAgain, onNext }: { result: Result; session: Session; me: Me; onMap: () => void; onAgain: () => void; onNext?: () => void }) {
  const [lit, setLit] = useState(0);
  const [party, setParty] = useState(0);
  const unit = session.unitId ? unitById(session.unitId) : null;
  const pass = result.stars > 0 || session.kind === "review";
  useEffect(() => {
    if (pass) { sounds.win(); setParty(1); void say(VOICE_LINES.en.done); }
    const timers = Array.from({ length: result.stars }, (_, k) => setTimeout(() => { setLit(k + 1); sounds.star(); }, 600 + k * 450));
    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const level = result.levelUp ? LEVELS[result.levelUp - 1] : null;
  return <div className="ee"><Confetti go={party} /><div className="ee-wrap ee-results">
    <Pico size={110} mood={pass ? "cheer" : "happy"} className="bob" />
    <h1>{session.kind === "review" ? "Review done!" : pass ? "Lesson complete!" : "Good practice!"}</h1>
    <p style={{ margin: 0, fontSize: 20 }}>{unit ? unit.title : "Your words"}: {result.score} of {result.total} right the first time</p>
    {session.kind === "lesson" && <div className="ee-bigstars" aria-label={`${result.stars} stars`}>{[0, 1, 2].map((k) => <span key={k} className={k < lit ? "lit" : ""}>★</span>)}</div>}
    {!pass && <p style={{ fontSize: 18 }}>Get 60% right to earn a star and open the next lesson. You can do it!</p>}
    {result.preview ? <p className="ee-preview">Teacher preview: no points were given.</p>
      : <div className="ee-points"><b>+{result.points}</b><span>points on the A.R.I.S.E. leaderboard</span></div>}
    {result.capped && <p style={{ fontSize: 16, color: "#4d5b78" }}>You reached today's English points limit ({me.dailyCap}). Your practice still makes your words stronger!</p>}
    {level && <div className="ee-levelup" style={{ ["--c" as any]: level.color }}>Level {level.n} is open: {level.title}! +25 bonus points</div>}
    {result.spoken.tried > 0 && <p style={{ fontSize: 18 }}>🎤 You said {result.spoken.right} of {result.spoken.tried} words clearly.</p>}
    {result.mastered.length > 0 && <><h2 style={{ fontSize: 22, margin: "14px 0 0" }}>Words you mastered</h2><WordChips words={result.mastered.map((w) => ({ w }))} /></>}
    {result.missed.length > 0 && <><h2 style={{ fontSize: 22, margin: "14px 0 0" }}>Words to practice</h2><WordChips words={result.missed} /></>}
    <div style={{ display: "grid", gap: 12, maxWidth: 420, margin: "18px auto 0" }}>
      {onNext && pass && <button type="button" className="ee-cta" onClick={onNext}>Next lesson</button>}
      <button type="button" className={onNext && pass ? "ee-cta alt" : "ee-cta"} onClick={onAgain}>{session.kind === "review" ? "Review again" : "Play again"}</button>
      <button type="button" className="ee-cta alt" onClick={onMap}>Back to the map</button>
    </div>
  </div></div>;
}
function WordChips({ words }: { words: { w: string; e?: string }[] }) {
  return <ul className="ee-wordlist">{words.map((x) => <li key={x.w}><button type="button" className="word" onClick={() => void say(x.w)}>{x.e ? <span className="ee-emoji">{x.e.startsWith("scene:") || x.e.startsWith("cal:") ? "🔊" : x.e}</span> : "🔊"} {x.w}</button></li>)}</ul>;
}
