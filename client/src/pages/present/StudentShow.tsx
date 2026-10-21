// The student welcome show: a 5-minute presentation of A.R.I.S.E. Reader for a room of students.
// It plays by itself (captions, and an optional voice, move it along), or a teacher steps through it with a clicker.
// Open it at /#/present. No login is needed and nothing is saved. The script is shared/presentShow.ts; the screens are scenes*.tsx.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Expand, Mic, MicOff, Pause, Play, PlayCircle, Presentation, RotateCcw, StickyNote, X } from "lucide-react";
import { FLAT, SCENES, TARGET_SECONDS, clock, firstBeatOf, totalSeconds, type SceneId } from "@shared/presentShow";
import { LeaderboardScene, PrizesScene, WrapScene } from "./scenesC";
import { LibraryScene, WelcomeScene } from "./scenesA";
import { LoginScene } from "./scenesLogin";
import { QuizScene, ReadsScene } from "./scenesB";
import type { SceneProps } from "./kit";
import { aiVoiceReady, clipFor, clipWithin, stopWarming, warmFrom } from "./voice";
import "./show.css";

const VIEWS: Record<SceneId, ComponentType<SceneProps>> = {
  welcome: WelcomeScene, login: LoginScene, library: LibraryScene, reads: ReadsScene,
  quiz: QuizScene, leaderboard: LeaderboardScene, prizes: PrizesScene, wrap: WrapScene,
};
const STAGE_W = 960, STAGE_H = 656;
const IDLE_MS = 2800;
const TOTAL = totalSeconds();

/** The picture is drawn on a fixed 960 by 540 stage and scaled to fit any screen, so it looks the same on a laptop and a projector. */
function useFit() {
  const [scale, setScale] = useState(1);
  const [width, setWidth] = useState(typeof window === "undefined" ? 1280 : window.innerWidth);
  useLayoutEffect(() => {
    const fit = () => { setWidth(window.innerWidth); setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H)); };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return { scale, width };
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  const english = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
  return english.find((v) => /google us english|samantha|jenny|aria|zira/i.test(v.name)) ?? english.find((v) => v.lang.toLowerCase().startsWith("en-us")) ?? english[0] ?? null;
}

export default function StudentShow() {
  const [, navigate] = useLocation();
  const { scale, width } = useFit();
  const [started, setStarted] = useState(false);
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [voice, setVoice] = useState(false);
  const [ai, setAi] = useState(false);
  const voiceTouched = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [notes, setNotes] = useState(false);
  const [idle, setIdle] = useState(false);
  const [, setNow] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const beatStarted = useRef(Date.now());
  const speech = useRef<{ done: boolean; waiting: (() => void) | null }>({ done: true, waiting: null });
  const idleTimer = useRef<number>();

  const cur = FLAT[pos];
  const scene = SCENES[cur.scene];
  const View = VIEWS[cur.id];
  const last = pos === FLAT.length - 1;
  const browserVoice = typeof window !== "undefined" && "speechSynthesis" in window;
  // the natural AI voice when the server has it, the computer's own voice otherwise
  const voiceOk = ai || browserVoice;
  useEffect(() => {
    let alive = true;
    void aiVoiceReady().then((ok) => { if (alive && ok) { setAi(true); if (!voiceTouched.current) setVoice(true); } });
    return () => { alive = false; stopWarming(); };
  }, []);
  const chooseVoice = useCallback((on: boolean | ((v: boolean) => boolean)) => { voiceTouched.current = true; setVoice(on); }, []);
  // get the lines ready ahead of time so they play the moment they are needed
  useEffect(() => { if (ai && voice) warmFrom(started ? pos : 0, FLAT.length); }, [ai, voice, started, pos]);

  const go = useCallback((to: number) => setPos(Math.max(0, Math.min(FLAT.length - 1, to))), []);
  const next = useCallback(() => setPos((p) => Math.min(FLAT.length - 1, p + 1)), []);
  const back = useCallback(() => setPos((p) => Math.max(0, p - 1)), []);
  const goScene = useCallback((scene: number) => go(firstBeatOf(scene)), [go]);

  const poke = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setIdle(true), IDLE_MS);
  }, []);
  useEffect(() => { if (started) poke(); return () => window.clearTimeout(idleTimer.current); }, [started, poke]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void rootRef.current?.requestFullscreen?.().catch(() => {});
  }, []);

  const begin = (auto: boolean) => {
    void rootRef.current?.requestFullscreen?.().catch(() => {});
    const startNow = () => { setStarted(true); setPos(0); setPlaying(auto); beatStarted.current = Date.now(); };
    // with the AI voice, wait a moment for the first line so the opening is not silent
    if (ai && voice) void clipWithin(0, 4000).then(startNow); else startNow();
  };
  const restart = () => { go(0); setPlaying(true); };

  // each beat restarts its clock
  useEffect(() => { beatStarted.current = Date.now(); }, [pos]);

  // the voice reads the caption of each beat
  useEffect(() => {
    try { window.speechSynthesis?.cancel(); } catch { /* none */ }
    audioRef.current?.pause(); audioRef.current = null;
    speech.current = { done: true, waiting: null };
    if (!started || !voice || !voiceOk) return;
    let alive = true;
    const s: { done: boolean; waiting: (() => void) | null } = { done: false, waiting: null };
    speech.current = s;
    const finish = () => { s.done = true; const w = s.waiting; s.waiting = null; w?.(); };
    const computerVoice = () => {
      if (!alive) return;
      if (!browserVoice) return finish();
      const say = new SpeechSynthesisUtterance(cur.say);
      const v = pickVoice();
      if (v) { say.voice = v; say.lang = v.lang; } else say.lang = "en-US";
      say.rate = 1;
      say.onend = finish; say.onerror = finish;
      window.speechSynthesis.speak(say);
    };
    if (ai) {
      void clipFor(pos).then((url) => {
        if (!alive) return;
        if (!url) return computerVoice();
        const a = new Audio(url);
        audioRef.current = a;
        a.onended = finish;
        a.onerror = () => computerVoice();
        a.play().catch(() => computerVoice());
      });
    } else computerVoice();
    return () => { alive = false; audioRef.current?.pause(); audioRef.current = null; try { window.speechSynthesis?.cancel(); } catch { /* none */ } };
  }, [pos, voice, started, cur.say, voiceOk, ai, browserVoice]);
  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch { /* none */ } }, []);

  // playing by itself: stay on the beat for its time (and until the voice has finished), then move on
  useEffect(() => {
    if (!started || !playing) return;
    let alive = true;
    const move = () => { if (!alive) return; if (last) setPlaying(false); else next(); };
    const timer = window.setTimeout(() => {
      if (speech.current.done) move();
      else speech.current.waiting = move;
    }, cur.seconds * 1000);
    return () => { alive = false; window.clearTimeout(timer); speech.current.waiting = null; };
  }, [started, playing, pos, last, next, cur.seconds]);

  // a steady tick while playing keeps the clock and progress bar moving
  useEffect(() => {
    if (!started || !playing) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [started, playing]);

  // keyboard, including the keys a presentation clicker sends
  useEffect(() => {
    if (!started) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      const used = () => { e.preventDefault(); poke(); };
      if (k === "ArrowRight" || k === "PageDown" || k === "ArrowDown" || k === " " || k === "Enter") { used(); next(); }
      else if (k === "ArrowLeft" || k === "PageUp" || k === "ArrowUp" || k === "Backspace") { used(); back(); }
      else if (k === "p" || k === "P" || k === "k" || k === "K") { used(); setPlaying((v) => !v); }
      else if (k === "f" || k === "F") { used(); toggleFullscreen(); }
      else if (k === "v" || k === "V") { used(); if (voiceOk) chooseVoice((v) => !v); }
      else if (k === "n" || k === "N") { used(); setNotes((v) => !v); }
      else if (k === "Home") { used(); go(0); }
      else if (k === "End") { used(); go(FLAT.length - 1); }
      else if (/^[1-8]$/.test(k) && Number(k) <= SCENES.length) { used(); goScene(Number(k) - 1); }
      else if (k === "Escape") { poke(); setNotes(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, next, back, go, goScene, poke, toggleFullscreen, voiceOk, chooseVoice]);

  const leave = () => { if (document.fullscreenElement) void document.exitFullscreen?.(); try { window.speechSynthesis?.cancel(); } catch { /* none */ } audioRef.current?.pause(); navigate("/tutorial"); };
  useEffect(() => () => { if (document.fullscreenElement) void document.exitFullscreen?.(); }, []);

  const beatsInScene = scene.beats.length;
  const elapsed = Math.min(TOTAL, cur.start + (playing ? Math.min(cur.seconds, (Date.now() - beatStarted.current) / 1000) : 0));
  const hidden = started && idle;
  const tooSmall = width < 640;
  const nextScene = SCENES[cur.scene + 1];

  const sceneChips = useMemo(() => SCENES.map((s, i) => ({ id: s.id, title: s.title, i })), []);

  if (tooSmall) {
    return (
      <div className="sw-root grid place-items-center px-8 text-center" ref={rootRef}>
        <div><Presentation className="mx-auto mb-4 h-10 w-10 text-violet-300" /><h1 className="text-2xl font-black">Use a bigger screen</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-300">The student show is made for a laptop or a projector. Open this page on one, or turn your device sideways.</p>
          <button type="button" onClick={leave} className="sw-btn mx-auto mt-5">Back to tutorials</button></div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="sw-root overflow-auto arise-page-bg" ref={rootRef}>
        <div className="mx-auto flex min-h-full max-w-3xl flex-col items-center justify-center px-6 py-10 text-center">
          <div className="mb-6 grid h-20 w-20 place-items-center rounded-[1.5rem] arise-icon-tile"><Presentation className="h-10 w-10 text-white" /></div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-violet-300">A.R.I.S.E. Reader · about {Math.round(TARGET_SECONDS / 60)} minutes</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-.035em] sm:text-5xl">Student welcome show</h1>
          <p className="mt-3 max-w-xl text-lg text-slate-300">How to log in, find a book, take a quiz, climb the leaderboard, read short reads, and win. Made to put on the board in front of the whole class.</p>

          <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => begin(true)} className="rounded-2xl border border-violet-400/35 bg-gradient-to-br from-violet-600/30 to-fuchsia-600/20 p-5 text-left transition hover:border-violet-300" data-testid="show-start-auto">
              <PlayCircle className="h-8 w-8 text-cyan-300" /><h2 className="mt-3 text-xl font-black">Play by itself</h2>
              <p className="mt-1 text-sm text-slate-300">Runs the whole show in about {clock(TOTAL)}, with every line on screen. Pause any time.</p>
            </button>
            <button type="button" onClick={() => begin(false)} className="rounded-2xl border border-white/10 arise-surface p-5 text-left transition hover:border-violet-300/60" data-testid="show-start-clicker">
              <Presentation className="h-8 w-8 text-cyan-300" /><h2 className="mt-3 text-xl font-black">Present it yourself</h2>
              <p className="mt-1 text-sm text-slate-300">Step through at your own pace with a clicker, the arrow keys, or the space bar.</p>
            </button>
          </div>

          <label className={`mt-6 flex items-center gap-2 text-sm font-bold ${voiceOk ? "text-slate-200" : "text-slate-500"}`}>
            <input type="checkbox" className="h-4 w-4 accent-violet-500" checked={voice} disabled={!voiceOk} onChange={(e) => chooseVoice(e.target.checked)} data-testid="show-voice-toggle" />
            {ai ? "Read the captions out loud in a natural AI voice" : "Read the captions out loud (uses this computer's voice)"}
          </label>

          <div className="mt-8 grid w-full max-w-2xl grid-cols-2 gap-x-6 gap-y-1.5 rounded-2xl border border-white/10 bg-white/[.03] p-4 text-left text-sm text-slate-300 sm:grid-cols-3">
            <p><b className="text-white">Space / →</b> next</p><p><b className="text-white">←</b> back</p><p><b className="text-white">P</b> play / pause</p>
            <p><b className="text-white">F</b> full screen</p><p><b className="text-white">V</b> voice</p><p><b className="text-white">N</b> presenter notes</p>
            <p><b className="text-white">1 to 8</b> jump to a part</p><p><b className="text-white">Home</b> start over</p>
          </div>
          <button type="button" onClick={leave} className="mt-6 text-sm font-bold text-slate-400 hover:text-white"><ArrowLeft className="mr-1 inline h-4 w-4" />Back to tutorials</button>
        </div>
      </div>
    );
  }

  const finished = last && !playing;
  const Icon = playing ? Pause : finished ? RotateCcw : Play;
  return (
    <div className="sw-root" ref={rootRef} onMouseMove={poke} onTouchStart={poke} style={{ cursor: hidden ? "none" : undefined }} data-testid="student-show" data-scene={cur.id} data-beat={cur.beat} data-pos={pos}>
      <div className="sw-frame" style={{ width: STAGE_W * scale, height: STAGE_H * scale, marginLeft: -(STAGE_W * scale) / 2, marginTop: -(STAGE_H * scale) / 2 }}>
        <div className="sw-stage" style={{ transform: `scale(${scale})` }}>
          <div className="sw-screen"><div className="sw-scene" key={cur.id}><View beat={cur.beat} /></div></div>
          <div className="sw-captionbar"><p className="sw-caption" aria-live="polite" data-testid="show-caption">{cur.say}</p></div>
          <div className="sw-footer"><span><b>C.G.M.S.</b> · A.R.I.S.E. Reader</span><span>Demo screens · sample books and readers</span></div>
        </div>
      </div>

      <div className="sw-progress" aria-hidden="true"><i style={{ width: `${(elapsed / TOTAL) * 100}%` }} /></div>

      {notes && (
        <aside className="sw-notes" aria-label="Presenter notes">
          <h3>Presenter notes · {scene.title}</h3>
          <p>{scene.tip}</p>
          <p className="mt-2 text-xs text-slate-400">Part {cur.scene + 1} of {SCENES.length} · line {cur.beat + 1} of {beatsInScene}{nextScene ? ` · next: ${nextScene.title}` : " · last part"}</p>
        </aside>
      )}

      <div className="sw-controls" data-hidden={hidden ? "true" : "false"}>
        <div className="sw-controls-inner">
          <button type="button" className="sw-btn" onClick={back} aria-label="Back one line"><ArrowLeft className="h-4 w-4" /></button>
          <button type="button" className="sw-btn sw-primary" onClick={() => (finished ? restart() : setPlaying((v) => !v))} aria-label={playing ? "Pause" : "Play by itself"} data-testid="show-play"><Icon className="h-4 w-4" />{playing ? "Pause" : finished ? "Replay" : "Play"}</button>
          <button type="button" className="sw-btn" onClick={next} aria-label="Next line" data-testid="show-next"><ArrowRight className="h-4 w-4" /></button>
          <span className="sw-clock" aria-label="Time">{clock(elapsed)} / {clock(TOTAL)}</span>
          <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
          {sceneChips.map((c) => (
            <button key={c.id} type="button" className="sw-chip" aria-current={c.i === cur.scene ? "step" : undefined} onClick={() => goScene(c.i)} data-testid={`show-scene-${c.id}`}>{c.title}</button>
          ))}
          <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
          <button type="button" className="sw-btn" aria-pressed={voice} disabled={!voiceOk} onClick={() => chooseVoice((v) => !v)} aria-label="Read the captions out loud">{voice ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}Voice</button>
          <button type="button" className="sw-btn" aria-pressed={notes} onClick={() => setNotes((v) => !v)} aria-label="Presenter notes"><StickyNote className="h-4 w-4" />Notes</button>
          <button type="button" className="sw-btn" onClick={toggleFullscreen} aria-label="Full screen"><Expand className="h-4 w-4" /></button>
          <button type="button" className="sw-btn" onClick={leave} aria-label="Exit the show"><X className="h-4 w-4" />Exit</button>
        </div>
      </div>
    </div>
  );
}
