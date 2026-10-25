// A.R.I.S.E. Beginners: one lesson, one task at a time, with Ari saying every instruction.
// Sound Blast (key words for the new spellings) → Say it (watch Ari's mouth, then say it) → Build (a word chain in
// sound boxes, one change at a time) → Spell → Heart words → Sort → Read (the Reading Coach) → Questions → Done.
// The story questions are checked by the server, and the server scores the reading; the rest is practice.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ARI, blastCards, chainChange, dotsOf, shuffled, tilesFor, unitOf, type Entry, type HeartWord, type Lesson } from "@shared/beginners";
import { showGrapheme } from "@shared/beginners/phonics";
import { Ari, useAri } from "./Ari";
import { Bubble, Confetti, Dialog, SoundBoxes, SpeakerIcon, Stars, Tile } from "./parts";
import { SayWord } from "./SayWord";
import { ReadingCoach } from "./ReadingCoach";
import { preload, sounds } from "./voice";

export type StartedLesson = { id: string; lesson: string; questions: { q: string; choices: string[] }[] };
export type FinishResult = {
  stars: number; right: number; total: number; readAccuracy: number | null; wcpm: number | null; points: number; capped: boolean; firstPass: boolean;
  tooFast: boolean; preview: boolean; next: string | null; unitDone: boolean; nextUnitOpen: number | null; streak: number; totalPoints: number;
};
type Api = (path: string, init?: RequestInit) => Promise<any>;
type StepId = "intro" | "blast" | "say" | "build" | "spell" | "heart" | "sort" | "read" | "questions" | "done";
const STEP_INFO: Record<StepId, { label: string; icon: string }> = {
  intro: { label: "Start", icon: "☀️" }, blast: { label: "Sound Blast", icon: "⚡" }, say: { label: "Say it", icon: "🎤" }, build: { label: "Build", icon: "🧱" },
  spell: { label: "Spell", icon: "✏️" }, heart: { label: "Heart words", icon: "❤️" }, sort: { label: "Sort", icon: "🗂️" }, read: { label: "Read", icon: "📖" },
  questions: { label: "Questions", icon: "❓" }, done: { label: "Done", icon: "⭐" },
};
type Ari = ReturnType<typeof useAri>;
type Say = (line: string, tone?: "plain" | "good" | "try") => void;

export function LessonPlayer({ lesson, started, api, onExit, onFinished, onNext }: {
  lesson: Lesson; started: StartedLesson; api: Api; onExit: () => void; onFinished: (r: FinishResult) => void; onNext: (lessonId: string) => void;
}) {
  const steps = useMemo<StepId[]>(() => ["intro", "blast", "say", "build", "spell", ...(lesson.heart.length ? ["heart" as const] : []), "sort", "read", "questions", "done"], [lesson]);
  const [at, setAt] = useState(0);
  const [line, setLine] = useState<{ text: string; tone: "plain" | "good" | "try" }>({ text: "", tone: "plain" });
  const [mood, setMood] = useState<"happy" | "cheer" | "listen" | "think">("happy");
  const [leaving, setLeaving] = useState(false);
  const ari = useAri();
  const step = steps[at];
  const say: Say = (text, tone = "plain") => { setLine({ text, tone }); setMood(tone === "good" ? "cheer" : "happy"); };
  const next = () => { ari.hush(); setMood("happy"); setAt((i) => Math.min(steps.length - 1, i + 1)); };
  useEffect(() => {
    preload([lesson.title, ARI.blast, ARI.sayIt, ARI.build, ARI.next, ARI.spell, ...lesson.chain.map((e) => e.show), ...lesson.spell.map((e) => e.show), ...blastCards(lesson).map((c) => c.word)]);
  }, [lesson]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLeaving(true); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="bg-player" role="dialog" aria-modal="true" aria-label={`Lesson: ${lesson.title}`}>
      <header className="bg-player-top">
        <button type="button" className="bg-close" onClick={() => (step === "done" ? onExit() : setLeaving(true))} aria-label="Leave the lesson">✕</button>
        <ol className="bg-steps" aria-label="Lesson steps">
          {steps.map((s, i) => (
            <li key={s} className={i < at ? "is-done" : i === at ? "is-now" : ""} aria-current={i === at ? "step" : undefined} title={STEP_INFO[s].label}>
              <span aria-hidden="true">{i < at ? "✓" : STEP_INFO[s].icon}</span><em>{STEP_INFO[s].label}</em>
            </li>
          ))}
        </ol>
      </header>
      <div className="bg-guide">
        <Ari viseme={ari.viseme} mood={ari.talking ? "happy" : mood} size={92} />
        {line.text && <Bubble tone={line.tone} onSpeak={() => void ari.talk(line.text)}>{line.text}</Bubble>}
      </div>
      <main className="bg-stage" key={step}>
        {step === "intro" && <IntroStep lesson={lesson} ari={ari} say={say} onDone={next} />}
        {step === "blast" && <BlastStep lesson={lesson} ari={ari} say={say} onDone={next} />}
        {step === "say" && <SayStep lesson={lesson} ari={ari} say={say} onDone={next} />}
        {step === "build" && <BuildStep lesson={lesson} words={lesson.chain} mode="build" ari={ari} say={say} onDone={next} />}
        {step === "spell" && <BuildStep lesson={lesson} words={lesson.spell} mode="spell" ari={ari} say={say} onDone={next} />}
        {step === "heart" && <HeartStep lesson={lesson} hearts={lesson.heart} ari={ari} say={say} onDone={next} />}
        {step === "sort" && <SortStep lesson={lesson} ari={ari} say={say} onDone={next} />}
        {step === "read" && <ReadingCoach lesson={lesson} sessionId={started.id} ari={ari} say={say} onDone={() => next()} />}
        {step === "questions" && <QuestionsStep started={started} api={api} ari={ari} say={say} onDone={next} />}
        {step === "done" && <DoneStep lesson={lesson} started={started} api={api} ari={ari} say={say} onFinished={onFinished} onExit={onExit} onNext={onNext} />}
      </main>
      {leaving && (
        <Dialog title="Leave this lesson?" actions={<>
          <button type="button" className="bg-btn bg-btn-quiet" onClick={() => setLeaving(false)}>Keep going</button>
          <button type="button" className="bg-btn bg-btn-stop" onClick={() => { ari.hush(); onExit(); }}>Leave</button>
        </>}>
          <p>You'll start this lesson over next time.</p>
        </Dialog>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ steps */

function StepShell({ title, children, foot }: { title: string; children: ReactNode; foot?: ReactNode }) {
  return (
    <section className="bg-step">
      <h2 className="bg-step-title">{title}</h2>
      <div className="bg-step-body">{children}</div>
      {foot && <div className="bg-step-foot">{foot}</div>}
    </section>
  );
}

function IntroStep({ lesson, ari, say, onDone }: { lesson: Lesson; ari: Ari; say: Say; onDone: () => void }) {
  const firstOfUnit = lesson.num === 1;
  const unit = unitOf(lesson.unit);
  useEffect(() => {
    // The first lesson of a unit opens with Ari saying what the unit is about.
    const kid = firstOfUnit && unit ? unit.kid : "";
    say(kid || lesson.title);
    void ari.talkAll([{ text: lesson.title }, ...(kid ? [{ text: kid }] : [])]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const focus = lesson.focus.filter((g) => !/^(closed|open|compound)$/.test(g));
  return (
    <StepShell title={lesson.title} foot={<button type="button" className="bg-btn bg-btn-go bg-btn-big" onClick={onDone} autoFocus>Let's go!</button>}>
      <div className="bg-intro">
        <span className="bg-intro-pic" aria-hidden="true">{lesson.pic}</span>
        {focus.length > 0 && (
          <div className="bg-intro-focus">
            <p>{firstOfUnit ? "New today:" : "Practice today:"}</p>
            <div className="bg-row">{focus.map((g) => <Tile key={g} text={showGrapheme(g.replace(/^-/, ""))} syll={lesson.syll} size="lg" />)}</div>
          </div>
        )}
        {lesson.heart.length > 0 && <p className="bg-intro-hearts">Heart {lesson.heart.length === 1 ? "word" : "words"}: {lesson.heart.map((h) => <strong key={h.w}>{h.show}</strong>)}</p>}
      </div>
    </StepShell>
  );
}

function BlastStep({ lesson, ari, say, onDone }: { lesson: Lesson; ari: Ari; say: Say; onDone: () => void }) {
  const cards = useMemo(() => blastCards(lesson), [lesson]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const card = cards[i];
  const choices = useMemo(() => (card ? shuffled([card.g, ...card.wrong], card.g + lesson.id) : []), [card, lesson.id]);
  const prompt = card?.at === "vowel" ? ARI.blastVowel : card?.at === "end" ? ARI.blastEnd : ARI.blast;
  useEffect(() => { if (!cards.length) onDone(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!card) return;
    setPicked(null); setWrong([]);
    say(prompt);
    void ari.talkAll(i === 0 || cards[i - 1]?.at !== card.at ? [{ text: prompt }, { text: card.word }] : [{ text: card.word }]);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!card) return null;
  const choose = (g: string) => {
    if (picked) return;
    if (g === card.g) {
      setPicked(g); sounds.right();
      if (!wrong.length) setScore((s) => s + 1);
      say(`${showGrapheme(card.g)}, like ${card.word}!`, "good");
      setTimeout(() => { if (i < cards.length - 1) setI(i + 1); else onDone(); }, 1100);
    } else {
      sounds.miss(); setWrong((w) => [...w, g]);
      say(ARI.tryAgain, "try");
      void ari.talk(card.word);
    }
  };
  return (
    <StepShell title="Sound Blast" foot={<p className="bg-step-hint">{i + 1} of {cards.length} · {score} on the first try</p>}>
      <div className="bg-blast">
        <button type="button" className="bg-blast-card" onClick={() => void ari.talk(card.word)} aria-label={`Hear the word ${card.word}`}>
          <span className="bg-blast-pic" aria-hidden="true">{card.e || "🔊"}</span>
          {/* The word stays hidden until it's answered: the child has to listen, not read the first letter. */}
          <span className="bg-blast-word"><SpeakerIcon /> {picked ? card.word : "Hear it"}</span>
        </button>
        <div className="bg-row bg-blast-choices" role="group" aria-label="Pick a spelling">
          {choices.map((g) => <Tile key={g} text={showGrapheme(g)} size="lg" onClick={() => choose(g)} disabled={!!picked || wrong.includes(g)} state={picked === g ? "ok" : wrong.includes(g) ? "bad" : null} />)}
        </div>
      </div>
    </StepShell>
  );
}

function SayStep({ lesson, ari, say, onDone }: { lesson: Lesson; ari: Ari; say: Say; onDone: () => void }) {
  const words = useMemo(() => {
    const seen = new Set<string>(); const out: Entry[] = [];
    for (const e of [...lesson.spell, ...lesson.chain]) if (!seen.has(e.w) && out.length < 3) { seen.add(e.w); out.push(e); }
    return out;
  }, [lesson]);
  const [i, setI] = useState(0);
  const [tried, setTried] = useState(false);
  const w = words[i];
  const model = () => ari.talkAll([{ text: w.show, slow: true }, { text: w.show }]);
  useEffect(() => {
    setTried(false);
    say(i === 0 ? ARI.sayIt : `Say “${w.show}”.`);
    void ari.talkAll(i === 0 ? [{ text: ARI.sayIt }, { text: w.show, slow: true }, { text: w.show }] : [{ text: w.show, slow: true }, { text: w.show }]);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <StepShell title="Say it" foot={
      <div className="bg-row">
        <button type="button" className="bg-btn bg-btn-quiet" onClick={() => (i < words.length - 1 ? setI(i + 1) : onDone())}>Skip</button>
        <button type="button" className="bg-btn bg-btn-go" disabled={!tried} onClick={() => (i < words.length - 1 ? setI(i + 1) : onDone())}>{i < words.length - 1 ? "Next word" : "Next"}</button>
      </div>}>
      <div className="bg-sayit">
        <button type="button" className="bg-bigword" onClick={() => void model()} aria-label={`Hear ${w.show} again`}>
          {w.e && <span className="bg-bigword-pic" aria-hidden="true">{w.e}</span>}{w.show} <SpeakerIcon />
        </button>
        <SoundBoxes parts={w.parts} dots={dotsOf(w)} syll={w.syll} label={`Sound boxes for ${w.show}`} />
        <SayWord word={w.show} onResult={(r) => {
          setTried(true);
          if (r.correct) { say(ARI.saidIt, "good"); void ari.talk(ARI.saidIt); }
          else if (r.correct === false) { say(r.close ? "So close! Watch my mouth and try again." : ARI.niceTry, "try"); void model(); }
          else say(ARI.great, "good");
        }} />
        <p className="bg-step-hint">Word {i + 1} of {words.length}</p>
      </div>
    </StepShell>
  );
}

/** Builds words from tiles into sound boxes. "build" keeps the tiles from the last word (a chain); "spell" starts fresh. */
function BuildStep({ lesson, words, mode, ari, say, onDone, title, intro }: { lesson: Lesson; words: Entry[]; mode: "build" | "spell"; ari: Ari; say: Say; onDone: () => void; title?: string; intro?: string }) {
  const tiles = useMemo(() => tilesFor(words, `${lesson.id}-${mode}`), [words, lesson.id, mode]);
  const [i, setI] = useState(0);
  const w = words[i];
  const [boxes, setBoxes] = useState<(string | null)[]>(() => w.parts.map(() => null));
  const [states, setStates] = useState<("ok" | "bad" | null)[]>([]);
  const [tries, setTries] = useState(0);
  const [solved, setSolved] = useState(false);
  const [firstTries, setFirstTries] = useState(0);
  useEffect(() => {
    const prev = i > 0 ? words[i - 1] : null;
    const ch = prev && mode === "build" ? chainChange(prev, w) : null;
    // A chain keeps the last word's tiles in the boxes: the child changes just the one that's different.
    setBoxes(ch?.kind === "swap" ? prev!.parts.slice() : w.parts.map(() => null));
    setStates([]); setTries(0); setSolved(false);
    const opener = i === 0 ? (intro || (mode === "build" ? ARI.build : ARI.spell)) : ch?.kind === "swap" ? ARI.next : "";
    say(opener || (mode === "build" ? "Build the next word." : "Spell the next word."));
    void ari.talkAll(opener ? [{ text: opener }, { text: w.show }] : [{ text: w.show }]);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const put = (t: string) => {
    if (solved) return;
    const slot = boxes.findIndex((b) => !b);
    if (slot < 0) { say("Tap a box to take a tile out first.", "try"); return; }
    sounds.snap();
    setStates([]);
    setBoxes((b) => b.map((x, k) => (k === slot ? t : x)));
  };
  const take = (k: number) => { if (solved) return; sounds.tap(); setStates([]); setBoxes((b) => b.map((x, j) => (j === k ? null : x))); };
  const check = () => {
    const st = boxes.map((b, k) => (b && b.toLowerCase() === w.parts[k].toLowerCase() ? "ok" : "bad")) as ("ok" | "bad")[];
    setStates(st);
    if (st.every((s) => s === "ok")) {
      setSolved(true); sounds.right();
      if (tries === 0) setFirstTries((n) => n + 1);
      say(`Yes! ${w.show}!`, "good");
      void ari.talk(w.show);
    } else {
      sounds.miss(); setTries((n) => n + 1);
      say(tries >= 1 ? "Listen to each sound slowly. The glowing tile goes in the red box." : ARI.tryAgain, "try");
      void ari.talk(w.show, { slow: tries >= 1 });
    }
  };
  const firstBad = states.findIndex((s) => s === "bad");
  const hintTile = tries >= 2 && firstBad >= 0 ? w.parts[firstBad] : null;
  const full = boxes.every(Boolean);
  return (
    <StepShell title={title || (mode === "build" ? "Build words" : "Spell it")} foot={
      solved
        ? <button type="button" className="bg-btn bg-btn-go bg-btn-big" autoFocus onClick={() => (i < words.length - 1 ? setI(i + 1) : onDone())}>{i < words.length - 1 ? "Next word" : "Next"}</button>
        : <div className="bg-row"><button type="button" className="bg-btn bg-btn-quiet" onClick={() => setBoxes(w.parts.map(() => null))} disabled={!boxes.some(Boolean)}>Clear</button><button type="button" className="bg-btn bg-btn-go" onClick={check} disabled={!full}>Check</button></div>}>
      <div className="bg-build">
        <div className="bg-build-top">
          <button type="button" className="bg-listen" onClick={() => void ari.talk(w.show, { slow: tries >= 1 })} aria-label="Hear the word again"><SpeakerIcon size={28} /> Hear it</button>
          {mode === "spell" && w.e && <span className="bg-build-pic" aria-hidden="true">{w.e}</span>}
          {i > 0 && mode === "build" && <span className="bg-build-last">Last word: <strong>{words[i - 1].show}</strong></span>}
        </div>
        <SoundBoxes parts={boxes} dots={solved || mode === "build" ? dotsOf(w) : undefined} syll={w.syll} states={states} onBox={take} big label={`Build ${mode === "spell" ? "the word you hear" : w.show}`} />
        {solved && <p className="bg-solved">{w.show}</p>}
        <div className="bg-bank" role="group" aria-label="Letter tiles">
          {tiles.map((t) => <Tile key={t} text={t} syll={w.syll} onClick={() => put(t)} disabled={solved} pulse={hintTile === t} size="lg" />)}
        </div>
        <p className="bg-step-hint">Word {i + 1} of {words.length}{firstTries ? ` · ${firstTries} on the first try` : ""}</p>
      </div>
    </StepShell>
  );
}

function HeartStep({ lesson, hearts, ari, say, onDone }: { lesson: Lesson; hearts: HeartWord[]; ari: Ari; say: Say; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<"look" | "spell">("look");
  const h = hearts[i];
  useEffect(() => {
    setPhase("look");
    say(i === 0 ? ARI.heart : `Another heart word: ${h.show}.`);
    void ari.talkAll(i === 0 ? [{ text: ARI.heart }, { text: h.show }] : [{ text: h.show }]);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const entry: Entry = useMemo(() => ({ w: h.w, show: h.show, parts: h.parts, unit: h.unit, e: "", name: false, syll: false }), [h]);
  if (phase === "spell") {
    return <BuildStep key={h.w} lesson={lesson} words={[entry]} mode="spell" ari={ari} say={say} title="Heart words" intro={ARI.spell}
      onDone={() => (i < hearts.length - 1 ? setI(i + 1) : onDone())} />;
  }
  return (
    <StepShell title="Heart words" foot={<button type="button" className="bg-btn bg-btn-go bg-btn-big" onClick={() => setPhase("spell")}>Now spell it</button>}>
      <div className="bg-heart">
        <div className="bg-heart-word" aria-label={`${h.show}: the tricky part is ${h.tricky.map((k) => h.parts[k]).join(" and ")}`}>
          {h.parts.map((p, k) => (
            <span key={k} className={`bg-heart-part${h.tricky.includes(k) ? " is-tricky" : ""}`}>
              {h.tricky.includes(k) && <span className="bg-heart-mark" aria-hidden="true">❤️</span>}
              <Tile text={p} size="lg" />
            </span>
          ))}
        </div>
        <button type="button" className="bg-listen" onClick={() => void ari.talkAll([{ text: h.show, slow: true }, { text: h.show }])}><SpeakerIcon size={28} /> Hear “{h.show}”</button>
        <p className="bg-step-hint">The part with the heart doesn't sound out the usual way. Look at it, say the word, then spell it.</p>
      </div>
    </StepShell>
  );
}

function SortStep({ lesson, ari, say, onDone }: { lesson: Lesson; ari: Ari; say: Say; onDone: () => void }) {
  const all = useMemo(() => shuffled([...lesson.sort.leftWords.map((w) => ({ w, side: "left" as const })), ...lesson.sort.rightWords.map((w) => ({ w, side: "right" as const }))], `${lesson.id}-sort`), [lesson]);
  const [placed, setPlaced] = useState<Record<string, "left" | "right">>({});
  const [chosen, setChosen] = useState<string | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  useEffect(() => { say(ARI.sort); void ari.talk(ARI.sort); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const left = all.filter((x) => !placed[x.w]);
  const drop = (side: "left" | "right") => {
    if (!chosen) { void ari.talk(side === "left" ? lesson.sort.left : lesson.sort.right); return; }
    const item = all.find((x) => x.w === chosen)!;
    if (item.side === side) {
      sounds.snap();
      const nextPlaced = { ...placed, [chosen]: side };
      setPlaced(nextPlaced); setChosen(null);
      if (Object.keys(nextPlaced).length === all.length) { sounds.right(); say(ARI.great, "good"); void ari.talk(ARI.great); }
    } else {
      sounds.miss(); setShake(side); setTimeout(() => setShake(null), 500);
      say(ARI.tryAgain, "try");
    }
  };
  const done = Object.keys(placed).length === all.length;
  return (
    <StepShell title="Sort the words" foot={<button type="button" className="bg-btn bg-btn-go bg-btn-big" disabled={!done} onClick={onDone}>Next</button>}>
      <div className="bg-sort">
        <div className="bg-sort-pool" role="group" aria-label="Words to sort">
          {left.map((x) => (
            <button key={x.w} type="button" className={`bg-chip bg-chip-big${chosen === x.w ? " is-chosen" : ""}`} aria-pressed={chosen === x.w}
              onClick={() => { setChosen(x.w); void ari.talk(x.w); }}>{x.w}</button>
          ))}
          {done && <p className="bg-step-hint">All sorted!</p>}
        </div>
        <div className="bg-sort-bins">
          {(["left", "right"] as const).map((side) => (
            <button key={side} type="button" className={`bg-bin${shake === side ? " is-shake" : ""}${chosen ? " is-ready" : ""}`} onClick={() => drop(side)}>
              <span className="bg-bin-label">{side === "left" ? lesson.sort.left : lesson.sort.right}</span>
              <span className="bg-bin-words">{all.filter((x) => placed[x.w] === side).map((x) => <span key={x.w} className="bg-chip is-placed">{x.w}</span>)}</span>
            </button>
          ))}
        </div>
      </div>
    </StepShell>
  );
}

function QuestionsStep({ started, api, ari, say, onDone }: { started: StartedLesson; api: Api; ari: Ari; say: Say; onDone: () => void }) {
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<{ pick: string; right: string; correct: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const q = started.questions[i];
  useEffect(() => {
    setAnswer(null);
    say(q.q);
    void ari.talkAll(i === 0 ? [{ text: ARI.questions }, { text: q.q }] : [{ text: q.q }]);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = async (c: string) => {
    if (answer || busy) return;
    setBusy(true);
    try {
      const r = await api(`/api/beginners/sessions/${started.id}/answer`, { method: "POST", body: JSON.stringify({ index: i, answer: c }) });
      setAnswer({ pick: c, right: r.right, correct: r.correct });
      if (r.correct) { sounds.right(); say(ARI.yes, "good"); void ari.talk(ARI.yes); }
      else { sounds.miss(); say(`The answer is: ${r.right}.`, "try"); void ari.talk(r.right); }
    } catch (e: any) {
      say(e?.message || "Something went wrong. Please try again.", "try");
    } finally { setBusy(false); }
  };
  return (
    <StepShell title={`Question ${i + 1} of ${started.questions.length}`} foot={answer && <button type="button" className="bg-btn bg-btn-go bg-btn-big" autoFocus onClick={() => (i < started.questions.length - 1 ? setI(i + 1) : onDone())}>{i < started.questions.length - 1 ? "Next question" : "Finish"}</button>}>
      <div className="bg-quiz">
        <button type="button" className="bg-quiz-q" onClick={() => void ari.talk(q.q)}><SpeakerIcon /> {q.q}</button>
        <div className="bg-quiz-choices">
          {q.choices.map((c) => {
            const state = answer ? (c === answer.right ? "is-right" : c === answer.pick ? "is-wrong" : "is-faded") : "";
            return (
              <div key={c} className={`bg-choice ${state}`}>
                <button type="button" className="bg-choice-main" onClick={() => void pick(c)} disabled={!!answer || busy}>{c}</button>
                <button type="button" className="bg-choice-hear" onClick={() => void ari.talk(c)} aria-label={`Hear “${c}”`}><SpeakerIcon size={18} /></button>
              </div>
            );
          })}
        </div>
      </div>
    </StepShell>
  );
}

function DoneStep({ lesson, started, api, ari, say, onFinished, onExit, onNext }: {
  lesson: Lesson; started: StartedLesson; api: Api; ari: Ari; say: Say; onFinished: (r: FinishResult) => void; onExit: () => void; onNext: (id: string) => void;
}) {
  const [r, setR] = useState<FinishResult | null>(null);
  const [error, setError] = useState("");
  const [party, setParty] = useState(0);
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return; once.current = true;
    (async () => {
      try {
        const res: FinishResult = await api(`/api/beginners/sessions/${started.id}/finish`, { method: "POST", body: "{}" });
        setR(res); onFinished(res);
        if (res.stars > 0) { sounds.win(); setParty(1); say(ARI.done, "good"); void ari.talk(ARI.done); }
        else { say("Let's read it once more. You'll get it!", "try"); void ari.talk(ARI.keepGoing); }
      } catch (e: any) { setError(e?.message || "Your lesson couldn't be saved. Please try again."); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <StepShell title="Hmm…" foot={<button type="button" className="bg-btn bg-btn-go" onClick={onExit}>Back to the map</button>}><p className="bg-note" role="alert">{error}</p></StepShell>;
  if (!r) return <StepShell title="Adding up your stars…"><div className="bg-loading" aria-hidden="true" /></StepShell>;
  return (
    <StepShell title={r.stars > 0 ? "Lesson complete!" : "Almost there"} foot={
      <div className="bg-row">
        <button type="button" className="bg-btn bg-btn-quiet" onClick={onExit}>Back to the map</button>
        {r.stars > 0 && r.next ? <button type="button" className="bg-btn bg-btn-go bg-btn-big" autoFocus onClick={() => onNext(r.next!)}>Next lesson</button>
          : <button type="button" className="bg-btn bg-btn-go bg-btn-big" autoFocus onClick={() => onNext(lesson.id)}>Try again</button>}
      </div>}>
      <Confetti go={party} />
      <div className="bg-done">
        <Stars n={r.stars} size={54} />
        <p className="bg-done-line">{r.right} of {r.total} questions right{r.readAccuracy !== null ? ` · read out loud: ${r.readAccuracy}%` : ""}</p>
        {r.points > 0 && <p className="bg-points-won">+{r.points} Reader points</p>}
        {r.preview && <p className="bg-note">Preview: nothing was saved or scored.</p>}
        {!r.preview && r.stars > 0 && r.points === 0 && !r.tooFast && <p className="bg-note">{r.capped ? "You reached today's Beginners points. Come back tomorrow for more!" : r.firstPass ? "" : "You already earned this lesson's points. Practice makes you stronger!"}</p>}
        {r.tooFast && <p className="bg-note">That was very fast! Points come from reading every part of the lesson.</p>}
        {r.stars > 0 && r.stars < 3 && <p className="bg-step-hint">{r.readAccuracy === null ? "Read the story out loud to Ari to earn the third star." : r.right < r.total ? "Get every question right for another star." : "Read the story out loud with 90% right for the third star."}</p>}
        {r.unitDone && <p className="bg-unit-done">You finished Unit {lesson.unit}!{r.nextUnitOpen ? ` Unit ${r.nextUnitOpen} is open.` : ""}</p>}
        {r.streak > 1 && <p className="bg-streak">🔥 {r.streak} days in a row</p>}
      </div>
    </StepShell>
  );
}
