import { type BoardProps, other } from "./types";

export function QuizBoard({ view, seat, canAct, act, theirName }: BoardProps) {
  const q = view.question;
  const prev = view.results[view.results.length - 1];
  const me = seat - 1, them = other(seat) - 1;
  const streak = view.streaks?.[me] || 0;
  const tiles = view.kind === "word_tiles";
  const recap = prev ? (
    <div className="ax-round-result" aria-live="polite">
      The answer was <b>{prev.correct}</b>. {prev.picks[me] === prev.correct ? `You got it (+${prev.points[me]}).` : "You missed it."}{" "}
      {prev.picks[them] === prev.correct ? `${theirName} got it too.` : `${theirName} missed it.`}
      {streak >= 2 ? ` 🔥 ${streak} in a row!` : ""}
    </div>
  ) : null;
  if (!q) return <div className="ax-quiz">{recap}</div>;
  return (
    <div className="ax-quiz">
      {recap}
      <div className="ax-q" key={view.round}>
        <small>Question {view.round + 1} of {view.total}</small>
        <h3>{q.q}</h3>
      </div>
      <div className={"ax-options" + (tiles ? " tiles" : "")}>
        {q.options.map((o: string) => (
          <button key={o} type="button" className="ax-option" aria-pressed={view.myPick === o} disabled={!canAct} onClick={() => act({ choice: o })}>{o}</button>
        ))}
      </div>
      <p className="ax-hint">{view.myPick ? `Locked in! Waiting for ${theirName}…` : view.theyAnswered ? `${theirName} has answered. Your turn!` : "Both players answer at the same time."}</p>
    </div>
  );
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export function WordRescueBoard({ view, seat, canAct, act, theirName }: BoardProps) {
  const shown = new Set<string>((view.pattern || []).filter(Boolean));
  const word: string | null = view.word;
  const inWord = (l: string) => (word ? word.includes(l) : shown.has(l));
  const last = view.last;
  const log = !last ? "Read the clue and pick a letter." : `${last.seat === seat ? "You" : theirName} ${last.hit ? `found ${last.letter}!` : `missed with ${last.letter}.`}${last.hit && last.seat === seat && view.winner === null ? " Go again!" : ""}`;
  return (
    <div className="ax-rescue">
      <div className="ax-clue">Clue: {view.hint}</div>
      <div className="ax-slots" aria-label="The word">
        {(view.pattern as (string | null)[]).map((ch, i) => <span key={i} className={ch ? "ax-pop" : ""}>{ch || ""}</span>)}
      </div>
      <div className="ax-lives" aria-label={`${view.maxMisses - view.misses} misses left`}>
        {Array.from({ length: view.maxMisses }, (_, i) => <i key={i} className={i < view.misses ? "lost" : ""} />)}
      </div>
      <p className="ax-log" aria-live="polite">{log}</p>
      <div className="ax-keys">
        {LETTERS.map((l) => {
          const used = view.guessed.includes(l);
          return (
            <button key={l} type="button" className={"ax-key" + (used ? (inWord(l) ? " hit" : " miss") : "")} disabled={!canAct || used} onClick={() => act({ letter: l })} aria-label={`Guess ${l}`}>{l}</button>
          );
        })}
      </div>
      <p className="ax-hint">A right letter earns another turn. Whoever makes the 8th miss loses!</p>
    </div>
  );
}
