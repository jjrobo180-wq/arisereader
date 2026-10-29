// A.R.I.S.E. Beginners: the Reading Coach (like Microsoft Reading Coach). The child can listen to Ari read the story
// with each word lighting up, then read it out loud. The server scores the recording word by word like a running
// record; missed words are marked and become practice, with sound boxes and "say it" for each one.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { dotsOf, entryFor, type Lesson } from "@shared/beginners";
import { sentencesOf, storyTokens, bareWord, type Mark } from "@shared/beginners/reading";
import { ARI } from "@shared/beginners";
import { canRecord, sendAudio, sounds, speakingProgress, startRecording, type Recording } from "./voice";
import { MicIcon, SoundBoxes, SpeakerIcon } from "./parts";
import { SayWord } from "./SayWord";
import type { useAri } from "./Ari";

type Ari = ReturnType<typeof useAri>;
export type ReadResult = { marks: Mark[]; heard: string[]; correct: number; attempted: number; total: number; accuracy: number; wcpm: number; seconds: number; practice: string[] };
type Mode = "story" | "listening" | "recording" | "scoring" | "result" | "practice";

export function ReadingCoach({ lesson, sessionId, ari, say, onDone }: {
  lesson: Lesson; sessionId: string; ari: Ari; say: (line: string, tone?: "plain" | "good" | "try") => void; onDone: (r: { read: boolean; accuracy: number | null }) => void;
}) {
  const tokens = useMemo(() => storyTokens(lesson.text), [lesson.text]);
  const sentences = useMemo(() => sentencesOf(lesson.text), [lesson.text]);
  /** Which sentence each word is in. */
  const sentenceOf = useMemo(() => {
    const out: number[] = []; let s = 0;
    tokens.forEach((t) => { out.push(s); if (/[.!?]["”]?$/.test(t)) s++; });
    return out;
  }, [tokens]);
  const [mode, setMode] = useState<Mode>("story");
  const [activeSentence, setActiveSentence] = useState(-1);
  const [activeWord, setActiveWord] = useState(-1);
  const [result, setResult] = useState<ReadResult | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [secs, setSecs] = useState(0);
  const [note, setNote] = useState("");
  const [practiceAt, setPracticeAt] = useState(0);
  const rec = useRef<Recording | null>(null);
  const stopListen = useRef(false);
  const raf = useRef(0);
  const live = useRef(true);
  const mic = canRecord();
  useEffect(() => () => { live.current = false; rec.current?.stop(); cancelAnimationFrame(raf.current); }, []);

  async function listen() {
    if (mode === "listening") { stopListen.current = true; ari.hush(); return; }
    stopListen.current = false;
    setMode("listening"); setResult(null);
    for (let s = 0; s < sentences.length; s++) {
      if (stopListen.current || !live.current) break;
      setActiveSentence(s);
      const ids = tokens.map((_, i) => i).filter((i) => sentenceOf[i] === s);
      const weights = ids.map((i) => bareWord(tokens[i]).length + 2);
      const total = weights.reduce((a, b) => a + b, 0);
      const follow = () => {
        const p = speakingProgress();
        if (p !== null) {
          let acc = 0; const target = Math.max(0, (p - 0.06) / 0.88) * total;
          let k = 0; while (k < ids.length - 1 && acc + weights[k] < target) { acc += weights[k]; k++; }
          setActiveWord(ids[k]);
        }
        raf.current = requestAnimationFrame(follow);
      };
      raf.current = requestAnimationFrame(follow);
      await ari.talk(sentences[s]);
      cancelAnimationFrame(raf.current);
    }
    setActiveSentence(-1); setActiveWord(-1);
    if (live.current) setMode("story");
  }

  async function read() {
    ari.hush();
    setNote(""); setResult(null);
    let r: Recording;
    try {
      r = await startRecording({ maxMs: 150_000, level: (v) => live.current && setLevel(v) });
    } catch {
      setNote("The microphone is off. You can read the story out loud to a grown-up instead, then go on.");
      return;
    }
    rec.current = r;
    setMode("recording");
    say(ARI.readToMe);
    sounds.tap();
    const started = performance.now();
    const timer = setInterval(() => live.current && setSecs(Math.round((performance.now() - started) / 1000)), 500);
    const { blob, seconds, spoke } = await r.done;
    clearInterval(timer);
    rec.current = null;
    if (!live.current) return;
    if (!spoke || blob.size < 1000) { setMode("story"); setNote("I didn't hear any reading. Tap Read to me and read nice and loud!"); return; }
    setMode("scoring");
    try {
      const res: ReadResult = await sendAudio(`/api/beginners/sessions/${sessionId}/read?seconds=${Math.round(seconds)}`, blob);
      if (!live.current) return;
      setResult(res);
      setBest((b) => (b === null ? res.accuracy : Math.max(b, res.accuracy)));
      setMode("result");
      if (res.attempted === 0) { say("Hmm, I couldn't hear the story words. Try reading again, a little closer to the microphone.", "try"); return; }
      if (res.accuracy >= 90) { sounds.win(); say(`${ARI.greatReading} You read ${res.correct} words right!`, "good"); void ari.talk(ARI.greatReading); }
      else { sounds.right(); say(res.practice.length ? `Good reading! Let's practice ${res.practice.length === 1 ? "one tricky word" : `${res.practice.length} tricky words`}.` : "Good reading!", "good"); void ari.talk(ARI.great); }
    } catch (e: any) {
      if (!live.current) return;
      setMode("story");
      setNote(e?.message || "I couldn't listen that time. Please try again.");
    }
  }

  const practiceWords = result?.practice || [];
  const pw = practiceWords[practiceAt] || "";
  const pe = useMemo(() => (pw ? entryFor(pw, lesson.unit) : null), [pw, lesson.unit]);
  useEffect(() => { if (mode === "practice" && pw) void ari.talkAll([{ text: pw, slow: true }, { text: pw }]); }, [mode, pw]); // eslint-disable-line react-hooks/exhaustive-deps

  if (mode === "practice" && pe) {
    return (
      <div className="bg-coach">
        <div className="bg-practice">
          <p className="bg-step-hint">Tricky word {practiceAt + 1} of {practiceWords.length}</p>
          <button type="button" className="bg-bigword" onClick={() => void ari.talkAll([{ text: pw, slow: true }, { text: pw }])}>{pw} <SpeakerIcon /></button>
          <SoundBoxes parts={pe.parts} dots={dotsOf(pe)} syll={pe.syll} label={`Sound boxes for ${pw}`} />
          <SayWord word={pw} onResult={(r) => { if (r.correct) say(ARI.saidIt, "good"); else if (r.correct === false) say(r.close ? "So close! Listen and try again." : ARI.niceTry, "try"); else say(ARI.great, "good"); }} />
          <div className="bg-row">
            <button type="button" className="bg-btn bg-btn-quiet" onClick={() => { setMode("result"); }}>Back to my reading</button>
            {practiceAt < practiceWords.length - 1
              ? <button type="button" className="bg-btn bg-btn-go" onClick={() => setPracticeAt((i) => i + 1)}>Next word</button>
              : <button type="button" className="bg-btn bg-btn-go" onClick={() => { setMode("story"); setResult(null); say("Now read the story again. You can do it!"); }}>Read it again</button>}
          </div>
        </div>
      </div>
    );
  }

  const markOf = (i: number): Mark | null => (result ? result.marks[i] : null);
  return (
    <div className="bg-coach">
      <div className="bg-story-head">
        <span className="bg-story-pic" aria-hidden="true">{lesson.pic}</span>
        <h2 className="bg-story-title">{lesson.title}</h2>
      </div>
      <div className={`bg-story${mode === "recording" ? " is-reading" : ""}`} aria-label="Story">
        {tokens.map((t, i) => {
          const m = markOf(i);
          const w = bareWord(t);
          const cls = ["bg-w", activeWord === i ? "is-now" : "", activeSentence >= 0 && sentenceOf[i] === activeSentence ? "is-sentence" : "", m ? `is-${m}` : ""].join(" ");
          return (
            <Fragment key={i}>
              <button type="button" className={cls} onClick={() => w && void ari.talk(w)} disabled={mode === "recording" || mode === "scoring"} title={m === "miss" && result?.heard[i] ? `I heard “${result.heard[i]}”` : undefined}>{t}</button>{" "}
            </Fragment>
          );
        })}
      </div>
      {result && result.attempted > 0 && (
        <div className="bg-score" role="status">
          <div className="bg-score-ring" style={{ ["--p" as any]: result.accuracy }}><strong>{result.accuracy}%</strong><span>right</span></div>
          <div className="bg-score-facts">
            <p><strong>{result.correct}</strong> of {result.attempted} words read right</p>
            <p><strong>{result.wcpm}</strong> words a minute</p>
            {result.practice.length > 0 && <p className="bg-score-practice">Practice: {result.practice.map((w) => <button key={w} type="button" className="bg-chip" onClick={() => void ari.talk(w)}>{w}</button>)}</p>}
            <p className="bg-score-key"><span className="bg-key is-ok">read right</span><span className="bg-key is-miss">tricky</span><span className="bg-key is-skip">skipped</span></p>
          </div>
        </div>
      )}
      {note && <p className="bg-note" role="alert">{note}</p>}
      {mode === "recording" && (
        <div className="bg-reading-bar" role="status">
          <span className="bg-rec-dot" aria-hidden="true" />
          <span>Reading… {secs}s</span>
          <span className="bg-level" aria-hidden="true"><i style={{ transform: `scaleX(${0.1 + level * 0.9})` }} /></span>
          <button type="button" className="bg-btn bg-btn-go" onClick={() => rec.current?.stop()}>I'm done</button>
        </div>
      )}
      {mode === "scoring" && <p className="bg-note" role="status">Ari is listening to your reading…</p>}
      {mode !== "recording" && mode !== "scoring" && (
        <div className="bg-row bg-coach-actions">
          <button type="button" className="bg-btn bg-btn-soft" onClick={listen}><SpeakerIcon /> {mode === "listening" ? "Stop" : "Listen"}</button>
          {mic && <button type="button" className="bg-btn bg-btn-read" onClick={read} disabled={mode === "listening"}><MicIcon size={22} /> {result ? "Read again" : "Read to me"}</button>}
          {result && result.practice.length > 0 && <button type="button" className="bg-btn bg-btn-soft" onClick={() => { setPracticeAt(0); setMode("practice"); }}>Practice tricky words</button>}
          <button type="button" className="bg-btn bg-btn-go" onClick={() => { ari.hush(); stopListen.current = true; onDone({ read: best !== null, accuracy: best }); }}>
            {best !== null || !mic ? "Next" : "Skip reading"}
          </button>
        </div>
      )}
      {!mic && <p className="bg-note">Read the story out loud to a grown-up. (Reading to Ari needs a microphone.)</p>}
    </div>
  );
}
