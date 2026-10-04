// Study Squad: flashcards. Any study set can be flipped through alone, at your
// own speed: see the question, think, flip, then say whether you knew it. Cards
// you didn't know come back until you do.
import { useEffect, useMemo, useState } from "react";
import type { StudySet, StudySetSummary } from "@shared/study/sets";
import type { StudyClient } from "./api";
import { IconClose } from "./icons";

type Card = { front: string; back: string; note?: string };

function shuffled<T>(list: T[]): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export default function Flashcards({ api, sets, startWith, onClose }: { api: StudyClient; sets: StudySetSummary[]; startWith: string | null; onClose: () => void }) {
  const [setId, setSetId] = useState<string | null>(startWith);
  const [set, setSet] = useState<StudySet | null>(null);
  const [error, setError] = useState("");
  const [pile, setPile] = useState<Card[]>([]);
  const [again, setAgain] = useState<Card[]>([]);
  const [known, setKnown] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [round, setRound] = useState(1);

  const all = useMemo<Card[]>(() => (set ? set.items.map((i) => ({ front: i.prompt, back: i.answer, note: i.explain })) : []), [set]);
  useEffect(() => {
    if (!setId) { setSet(null); return; }
    let alive = true;
    setError(""); setSet(null);
    api.set(setId).then((d) => { if (alive) setSet(d.set); }).catch((e) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [setId, api]);
  useEffect(() => { setPile(shuffled(all)); setAgain([]); setKnown(0); setFlipped(false); setRound(1); }, [all]);

  const card = pile[0];
  const next = (knew: boolean) => {
    if (!card) return;
    if (knew) setKnown((n) => n + 1); else setAgain((list) => [...list, card]);
    setPile((p) => p.slice(1)); setFlipped(false);
  };
  const goAgain = (cards: Card[]) => { setPile(shuffled(cards)); setAgain([]); setKnown(0); setFlipped(false); setRound((r) => r + 1); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      // a focused button already answers to Space and Enter by itself
      if (!card || (el && (el.tagName === "BUTTON" || el.tagName === "INPUT" || el.tagName === "TEXTAREA"))) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped((f) => !f); }
      else if (flipped && e.key === "ArrowRight") next(true);
      else if (flipped && e.key === "ArrowLeft") next(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const total = pile.length + again.length + known;
  return (
    <section className="sq-sheet" role="dialog" aria-label="Flashcards">
      <div className="sq-slate sq-slate-narrow sq-flash">
        <header className="sq-slate-head">
          <h2>{set ? set.title : "Flashcards"}</h2>
          <button type="button" className="sq-round sq-round-sm" onClick={onClose} aria-label="Close"><IconClose /></button>
        </header>

        {!setId ? (
          <>
            <p className="sq-note">Pick a set to flip through on your own. No timer, no score.</p>
            <ul className="sq-sets compact">
              {sets.map((s) => (
                <li key={s.id}><button type="button" className="sq-card sq-set" onClick={() => setSetId(s.id)}>
                  <span className="sq-set-text"><b>{s.title}</b><span>{s.subject}, {s.count} cards</span></span>
                </button></li>
              ))}
            </ul>
          </>
        ) : error ? (
          <><p className="sq-note">{error}</p><button type="button" className="sq-btn" onClick={() => setSetId(null)}>Pick another set</button></>
        ) : !set ? (
          <p className="sq-note">Getting the cards…</p>
        ) : card ? (
          <>
            <p className="sq-progress">{round > 1 ? "Round " + round + ": " : ""}Card {total - pile.length + 1} of {total}</p>
            <button type="button" className={"sq-flashcard" + (flipped ? " flipped" : "")} onClick={() => setFlipped((f) => !f)} aria-live="polite">
              <small>{flipped ? "Answer" : "Question"}</small>
              <b className={(flipped ? card.back : card.front).length > 70 ? "long" : ""}>{flipped ? card.back : card.front}</b>
              {flipped && card.note && <span>{card.note}</span>}
              <i>{flipped ? "Tap to see the question again" : "Think of the answer, then tap to flip"}</i>
            </button>
            <div className="sq-flash-btns">
              <button type="button" className="sq-btn sq-btn-pink" disabled={!flipped} onClick={() => next(false)}>Still learning</button>
              <button type="button" className="sq-btn sq-btn-mint" disabled={!flipped} onClick={() => next(true)}>Got it</button>
            </div>
          </>
        ) : (
          <div className="sq-flash-done">
            <h3>{again.length === 0 ? "You knew every card!" : `You knew ${known} of ${total}.`}</h3>
            {again.length > 0 && <p>{again.length === 1 ? "One card is" : `${again.length} cards are`} still tricky. Go through just those again?</p>}
            <div className="sq-flash-btns">
              {again.length > 0 && <button type="button" className="sq-btn sq-btn-main" onClick={() => goAgain(again)}>Practice the ones I missed</button>}
              <button type="button" className="sq-btn" onClick={() => goAgain(all)}>Start over</button>
              <button type="button" className="sq-btn" onClick={() => setSetId(null)}>Pick another set</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
