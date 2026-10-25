// A.R.I.S.E. Beginners (#/beginners): Reader for younger readers (about K–3). Same account, same leaderboard, same
// points and prizes as the rest of Reader. The map of 18 units; each lesson mixes phonics and decoding (Sound Blast,
// word chains, spelling, heart words, sorts), a read-aloud coach and speech practice with Ari. Say It Studio is
// the speech room. Teachers, parents and the administrator can preview every lesson and see each child's progress.
// Server: server/ariseBeginners.ts. Program: shared/beginners.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { ARI, LESSONS, UNITS, dotsOf, entryFor, lessonById, type Lesson } from "@shared/beginners";
import { Ari, useAri } from "@/components/beginners/Ari";
import { Bubble, SoundBoxes, SpeakerIcon, Stars, useApi, useBeginnersFonts } from "@/components/beginners/parts";
import { LessonPlayer, type FinishResult, type StartedLesson } from "@/components/beginners/LessonPlayer";
import { SayItStudio } from "@/components/beginners/SayItStudio";
import { ClassView } from "@/components/beginners/ClassView";
import { SayWord } from "@/components/beginners/SayWord";
import { setBeginnersToken, stopAll } from "@/components/beginners/voice";
import "./beginners.css";

type LessonRec = { stars: number; best: number; read: number | null; wcpm: number | null; plays: number; first: string | null };
type Me = {
  name: string; role: string; preview: boolean; staff: boolean; parent: boolean; grade: string | null; beginnerGrade: boolean; startUnit: number;
  lessons: Record<string, LessonRec>; open: number[]; next: string | null; today: { points: number; cap: number }; total: number; streak: number;
  practice: string[]; readings: { lesson: string; at: string; accuracy: number; wcpm: number }[]; sayit: { right: number; points: number; max: number; every: number };
};
type View = "map" | "studio" | "class" | "practice";

export default function Beginners() {
  useBeginnersFonts();
  const { token, user, refreshUser } = useAuth();
  const [, navigate] = useLocation();
  const api = useApi(token);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("map");
  const [playing, setPlaying] = useState<{ lesson: Lesson; started: StartedLesson } | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const ari = useAri();
  useEffect(() => { setBeginnersToken(token); }, [token]);
  useEffect(() => () => stopAll(), []);
  const load = useCallback(async () => {
    try { setMe(await api("/api/beginners/me")); setError(""); }
    catch (e: any) { setError(e?.message || "Beginners couldn't load. Please try again."); }
  }, [api]);
  useEffect(() => { if (token) void load(); }, [token, load]);
  useEffect(() => { document.title = "A.R.I.S.E. Beginners"; }, []);

  const start = async (id: string) => {
    setStarting(id); setNotice("");
    try {
      const started: StartedLesson = await api(`/api/beginners/lessons/${id}/start`, { method: "POST", body: "{}" });
      const lesson = lessonById(started.lesson);
      if (lesson) { ari.hush(); setPlaying({ lesson, started }); }
    } catch (e: any) { setNotice(e?.message || "That lesson couldn't start. Please try again."); }
    finally { setStarting(null); }
  };
  const finished = (r: FinishResult) => { if (!r.preview && r.points > 0) void refreshUser?.(); void load(); };

  const next = me?.next ? lessonById(me.next) : null;
  const starsTotal = useMemo(() => (me ? Object.values(me.lessons).reduce((t, l) => t + l.stars, 0) : 0), [me]);
  const greeting = useMemo(() => {
    if (!me) return "";
    if (me.preview) return me.parent ? "Try any lesson, just like your child sees it. Nothing you do here is saved." : "You're previewing Beginners. Every lesson is open, and nothing is saved or scored.";
    if (!Object.keys(me.lessons).length) return `Hi ${me.name}! I'm Ari. Let's learn to read together!`;
    return next ? `Welcome back, ${me.name}! Next up: ${next.title}.` : `Wow, ${me.name}! You finished every lesson!`;
  }, [me, next]);
  useEffect(() => { if (me && view === "map" && !playing) void ari.talk(ARI.hello); }, [!!me]); // eslint-disable-line react-hooks/exhaustive-deps

  if (playing) {
    return (
      <div className="bg-root">
        <LessonPlayer key={playing.started.id} lesson={playing.lesson} started={playing.started} api={api}
          onExit={() => { stopAll(); setPlaying(null); void load(); }}
          onFinished={finished}
          onNext={(id) => { stopAll(); setPlaying(null); void start(id); }} />
      </div>
    );
  }

  return (
    <div className="bg-root">
      <header className="bg-top">
        <button type="button" className="bg-btn bg-btn-quiet bg-back" onClick={() => { stopAll(); navigate(user?.role === "student" || !user ? "/library" : "/"); }}>Library</button>
        <h1 className="bg-brand"><span className="bg-brand-sun" aria-hidden="true">☀</span> Beginners</h1>
        <div className="bg-top-stats">
          {me && !me.preview && <span className="bg-pill" title="Days in a row">🔥 {me.streak}</span>}
          {me && !me.preview && <span className="bg-pill" title="Stars">⭐ {starsTotal}</span>}
          {user?.role === "student" && <span className="bg-pill is-points" title="Your Reader points: the same points as the library and the leaderboard">{(user.totalPoints ?? 0).toLocaleString()} points</span>}
        </div>
      </header>

      {error && <div className="bg-wrap"><p className="bg-note" role="alert">{error} <button type="button" className="bg-link" onClick={() => void load()}>Try again</button></p></div>}
      {!me && !error && <div className="bg-wrap"><div className="bg-loading" aria-label="Loading" /></div>}

      {me && view === "studio" && <div className="bg-wrap"><SayItStudio userId={user?.id ?? "guest"} onBack={() => { setView("map"); void load(); }} onPoints={() => { void refreshUser?.(); }} /></div>}
      {me && view === "practice" && <div className="bg-wrap"><PracticeWords words={me.practice} onBack={() => setView("map")} /></div>}
      {me && view === "class" && (
        <div className="bg-wrap">
          <div className="bg-row bg-class-top"><button type="button" className="bg-btn bg-btn-quiet" onClick={() => setView("map")}>Back to the lessons</button><h2>{me.parent ? "My children" : "My class"} in Beginners</h2></div>
          <ClassView api={api} parent={me.parent} />
        </div>
      )}

      {me && view === "map" && (
        <div className="bg-wrap bg-home">
          <section className="bg-hero">
            <div className="bg-hero-ari"><Ari viseme={ari.viseme} size={150} mood={ari.talking ? "happy" : "happy"} label="Ari the sun" /></div>
            <div className="bg-hero-main">
              <Bubble onSpeak={() => void ari.talk(ARI.hello)}>{greeting}</Bubble>
              <div className="bg-row bg-hero-actions">
                {next && <button type="button" className="bg-btn bg-btn-go bg-btn-hero" disabled={!!starting} onClick={() => void start(next.id)}>
                  <span className="bg-hero-pic" aria-hidden="true">{next.pic}</span>
                  <span><strong>{starting === next.id ? "Starting…" : Object.keys(me.lessons).length ? "Keep reading" : "Start reading"}</strong><small>Unit {next.unit}: {next.title}</small></span>
                </button>}
                {(me.staff || me.parent) && <button type="button" className="bg-btn bg-btn-soft" onClick={() => setView("class")}>{me.parent ? "My children's progress" : "Class progress"}</button>}
              </div>
              {notice && <p className="bg-note" role="alert">{notice}</p>}
              {!me.preview && <p className="bg-step-hint">Today: {me.today.points} of {me.today.cap} Beginners points. They count on the Reader leaderboard and toward prizes.</p>}
            </div>
          </section>

          <div className="bg-home-grid">
            <section className="bg-map" aria-label="Lessons">
              {UNITS.map((u) => {
                const open = me.open.includes(u.n);
                const passed = u.lessons.filter((l) => me.lessons[l.id]?.first).length;
                return (
                  <article key={u.n} className={`bg-unit${open ? "" : " is-locked"}`} style={{ ["--unit" as any]: u.color }}>
                    <header className="bg-unit-head">
                      <span className="bg-unit-icon" aria-hidden="true">{u.icon}</span>
                      <div className="bg-unit-names">
                        <h2>Unit {u.n}: {u.title}</h2>
                        <p>{u.skill} · grade {u.grade}</p>
                      </div>
                      <span className="bg-unit-count" aria-label={`${passed} of ${u.lessons.length} lessons passed`}>{open ? `${passed}/${u.lessons.length}` : "🔒"}</span>
                    </header>
                    <ol className="bg-trail">
                      {u.lessons.map((l) => {
                        const rec = me.lessons[l.id];
                        const isNext = me.next === l.id;
                        return (
                          <li key={l.id}>
                            <button type="button" className={`bg-stone${rec?.first ? " is-passed" : ""}${isNext ? " is-next" : ""}`} disabled={!open || !!starting} onClick={() => void start(l.id)}
                              aria-label={`${l.title}${rec?.first ? `, ${rec.stars} stars` : ""}${!open ? ", locked" : ""}`}>
                              <span className="bg-stone-pic" aria-hidden="true">{l.pic}</span>
                              {isNext && <span className="bg-stone-flag">Next</span>}
                            </button>
                            <span className="bg-stone-title">{l.title}</span>
                            {rec?.first ? <Stars n={rec.stars} size={16} /> : <span className="bg-stone-pts">{l.points} pts</span>}
                          </li>
                        );
                      })}
                    </ol>
                    {!open && <p className="bg-unit-lock">Finish Unit {u.n - 1} to open this unit.</p>}
                  </article>
                );
              })}
            </section>

            <aside className="bg-side">
              <button type="button" className="bg-card bg-card-studio" onClick={() => { ari.hush(); setView("studio"); }}>
                <span className="bg-card-icon" aria-hidden="true">🎤</span>
                <span className="bg-card-body"><strong>Say It Studio</strong><small>Watch Ari's mouth and say first words, animal sounds and tricky sounds.</small>
                  {!me.preview && <small className="bg-card-meta">Today: {me.sayit.right} said right · a point for every {me.sayit.every}</small>}</span>
              </button>
              <div className="bg-card">
                <h3>Words to practice</h3>
                {me.practice.length ? <>
                  <p className="bg-chips">{me.practice.slice(0, 10).map((w) => <button key={w} type="button" className="bg-chip" onClick={() => void ari.talk(w)}>{w}</button>)}</p>
                  <button type="button" className="bg-btn bg-btn-soft" onClick={() => setView("practice")}>Practice them</button>
                </> : <p className="bg-step-hint">Read a story to Ari. Any tricky words show up here to practice.</p>}
              </div>
              <div className="bg-card">
                <h3>My reading</h3>
                {me.readings.length ? <>
                  <div className="bg-readchart" aria-label="Read-aloud accuracy, oldest to newest">
                    {me.readings.slice(0, 10).reverse().map((r, i) => <i key={i} style={{ height: `${Math.max(8, r.accuracy)}%` }} className={r.accuracy >= 90 ? "is-good" : r.accuracy >= 75 ? "is-ok" : "is-low"} title={`${lessonById(r.lesson)?.title}: ${r.accuracy}%, ${r.wcpm} words a minute`} />)}
                  </div>
                  <p className="bg-step-hint">Last time: {me.readings[0].accuracy}% right, {me.readings[0].wcpm} words a minute.</p>
                </> : <p className="bg-step-hint">When you read a story out loud, your scores show up here.</p>}
              </div>
              <button type="button" className="bg-card bg-card-board" onClick={() => { stopAll(); navigate("/leaderboard"); }}>
                <span className="bg-card-icon" aria-hidden="true">🏆</span>
                <span className="bg-card-body"><strong>Leaderboard and prizes</strong><small>Beginners points are Reader points. See where you are and what you can win.</small></span>
              </button>
              <p className="bg-side-note">{LESSONS.length} lessons in {UNITS.length} units, from first sounds to two-syllable words.</p>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}

/** Practice the words missed in read-alouds: see the sound boxes, hear Ari, say it. */
function PracticeWords({ words, onBack }: { words: string[]; onBack: () => void }) {
  const [i, setI] = useState(0);
  const [line, setLine] = useState<{ text: string; tone: "plain" | "good" | "try" }>({ text: ARI.practice, tone: "plain" });
  const ari = useAri();
  const w = words[i];
  const e = useMemo(() => (w ? entryFor(w) : null), [w]);
  useEffect(() => { if (w) void ari.talkAll(i === 0 ? [{ text: ARI.practice }, { text: w, slow: true }, { text: w }] : [{ text: w, slow: true }, { text: w }]); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!w || !e) return <div className="bg-empty"><p>No words to practice right now.</p><button type="button" className="bg-btn bg-btn-go" onClick={onBack}>Back to the map</button></div>;
  return (
    <div className="bg-practice is-page">
      <div className="bg-guide is-row"><Ari viseme={ari.viseme} size={96} mood={line.tone === "good" ? "cheer" : "happy"} /><Bubble tone={line.tone}>{line.text}</Bubble></div>
      <button type="button" className="bg-bigword" onClick={() => void ari.talkAll([{ text: w, slow: true }, { text: w }])}>{w} <SpeakerIcon /></button>
      <SoundBoxes parts={e.parts} dots={dotsOf(e)} syll={e.syll} label={`Sound boxes for ${w}`} />
      <SayWord word={w} onResult={(r) => setLine(r.correct ? { text: ARI.saidIt, tone: "good" } : r.correct === false ? { text: r.close ? "So close! Try again." : ARI.niceTry, tone: "try" } : { text: ARI.great, tone: "good" })} />
      <div className="bg-row">
        <button type="button" className="bg-btn bg-btn-quiet" onClick={onBack}>Back to the map</button>
        <span className="bg-step-hint">{i + 1} of {words.length}</span>
        <button type="button" className="bg-btn bg-btn-go" onClick={() => (i < words.length - 1 ? setI(i + 1) : onBack())}>{i < words.length - 1 ? "Next word" : "Done"}</button>
      </div>
    </div>
  );
}
