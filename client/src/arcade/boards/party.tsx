import { useEffect, useState } from "react";
import { type BoardProps, type Seat, other } from "./types";

const seatColor = (s: number) => (s === 1 ? "var(--ax-p1)" : "var(--ax-p2)");

// ─── Pig ─────────────────────────────────────────────────────────────────────
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export function Die({ value, bust = false, rollKey }: { value: number; bust?: boolean; rollKey?: string }) {
  return (
    <div key={rollKey} className={"ax-die roll" + (bust ? " bust" : "")} role="img" aria-label={`Die showing ${value}`}>
      {Array.from({ length: 9 }, (_, i) => <span key={i} style={{ display: "grid" }}>{PIPS[value]?.includes(i) ? <i /> : null}</span>)}
    </div>
  );
}
export function PigBoard({ view, seat, canAct, act, myName, theirName }: BoardProps) {
  const target = 50;
  const last = view.last;
  const value = last?.roll || view.rolls?.[view.rolls.length - 1] || 1;
  const who = (s: number) => (s === seat ? "You" : theirName);
  const log = !last ? "Roll the die. Roll a 1 and you lose this turn's points!"
    : last.action === "bust" ? `${who(last.seat)} rolled a 1. Turn total lost!`
    : last.action === "hold" ? `${who(last.seat)} banked ${last.banked} points.`
    : `${who(last.seat)} rolled a ${last.roll}.`;
  const row = (s: Seat, name: string) => {
    const score = view.scores[s - 1];
    const pending = view.turn === s ? view.turnTotal : 0;
    return (
      <div style={{ ["--seat" as any]: seatColor(s) }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
        <span className="bar">
          <i style={{ width: `${Math.min(100, (score / target) * 100)}%` }} />
          {pending > 0 && <em style={{ left: `${Math.min(100, (score / target) * 100)}%`, width: `${Math.min(100 - (score / target) * 100, (pending / target) * 100)}%` }} />}
        </span>
        <span>{score}</span>
      </div>
    );
  };
  return (
    <div className="ax-pig">
      <Die value={value} bust={last?.action === "bust"} rollKey={String(view.rolls?.length) + (last?.action || "") + (last?.seat || "")} />
      <div className="ax-turn-total" aria-live="polite">{view.turnTotal > 0 ? `+${view.turnTotal} this turn` : " "}</div>
      <p className="ax-log" aria-live="polite">{log}</p>
      <div className="ax-meter">{row(seat, myName)}{row(other(seat), theirName)}</div>
      <div className="ax-row">
        <button type="button" className="ax-btn ax-btn-primary" disabled={!canAct} onClick={() => act({ type: "roll" })}>Roll</button>
        <button type="button" className="ax-btn ax-btn-gold" disabled={!canAct || view.turnTotal <= 0} onClick={() => act({ type: "hold" })}>Hold {view.turnTotal > 0 && view.turn === seat ? `+${view.turnTotal}` : ""}</button>
      </div>
      <p className="ax-hint">First to {target} wins.</p>
    </div>
  );
}

// ─── Rock Paper Scissors ─────────────────────────────────────────────────────
const HANDS = [{ id: "rock", em: "✊", label: "Rock" }, { id: "paper", em: "✋", label: "Paper" }, { id: "scissors", em: "✌️", label: "Scissors" }];
const handEm = (id: string) => HANDS.find((h) => h.id === id)?.em || "❔";
export function RpsBoard({ view, seat, canAct, act, myName, theirName }: BoardProps) {
  const lastRound = view.history[view.history.length - 1];
  const pips = (s: Seat) => <span className="ax-pips" style={{ ["--seat" as any]: seatColor(s) }} aria-label={`${view.wins[s - 1]} of 3 wins`}>{[0, 1, 2].map((i) => <i key={i} className={i < view.wins[s - 1] ? "on" : ""} />)}</span>;
  const result = lastRound ? (lastRound.winner === 0 ? "Tie! Go again." : lastRound.winner === seat ? "You win the round!" : `${theirName} wins the round.`) : "";
  return (
    <div className="ax-rps">
      <div className="ax-row" style={{ gap: 20 }}>
        <div className="ax-row"><b>{myName}</b>{pips(seat)}</div>
        <div className="ax-row"><b>{theirName}</b>{pips(other(seat))}</div>
      </div>
      {lastRound && (
        <div className="ax-rps-clash" key={view.history.length} aria-live="polite">
          <span className="ax-pop">{handEm(lastRound.picks[seat - 1])}</span>
          <span className="vs">VS</span>
          <span className="ax-pop">{handEm(lastRound.picks[other(seat) - 1])}</span>
        </div>
      )}
      <p className="ax-log">{view.winner !== null ? " " : view.myPick ? `Locked in! Waiting for ${theirName}…` : result || "Pick your hand. First to 3 wins."}</p>
      <div className="ax-rps-hands">
        {HANDS.map((h) => (
          <button key={h.id} type="button" aria-pressed={view.myPick === h.id} disabled={!canAct} onClick={() => act({ hand: h.id })} aria-label={h.label}>
            <span>{h.em}<span>{h.label}</span></span>
          </button>
        ))}
      </div>
      {view.theyPicked && !view.myPick && view.winner === null && <p className="ax-hint">{theirName} has picked!</p>}
    </div>
  );
}

// ─── Last Stone ──────────────────────────────────────────────────────────────
export function NimBoard({ view, seat, canAct, act, theirName }: BoardProps) {
  const [sel, setSel] = useState<{ pile: number; take: number } | null>(null);
  useEffect(() => setSel(null), [canAct, (view.piles || []).join(",")]);
  const last = view.last;
  const total = view.piles.reduce((a: number, b: number) => a + b, 0);
  return (
    <div className="ax-nim">
      <p className="ax-log">{last ? `${last.seat === seat ? "You" : theirName} took ${last.take} from pile ${last.pile + 1}.` : "Take any number of stones from one pile."} {total ? `${total} stones left.` : ""}</p>
      {view.piles.map((count: number, p: number) => (
        <div key={p} className="ax-pile-line">
          <b>{p + 1}</b>
          <div className="ax-row" style={{ flexWrap: "wrap", gap: 8 }}>
            {Array.from({ length: count }, (_, j) => {
              const picked = sel?.pile === p && j >= count - sel.take;
              return <button key={j} type="button" className={"ax-stonebtn" + (picked ? " pick" : "")} disabled={!canAct}
                onClick={() => setSel({ pile: p, take: count - j })} aria-label={`Take ${count - j} from pile ${p + 1}`} />;
            })}
            {count === 0 && <span className="ax-hint" style={{ margin: 0 }}>empty</span>}
          </div>
        </div>
      ))}
      <div className="ax-row" style={{ justifyContent: "center" }}>
        <button type="button" className="ax-btn ax-btn-primary" disabled={!canAct || !sel} onClick={() => { if (sel) act(sel); }}>
          {sel ? `Take ${sel.take} stone${sel.take > 1 ? "s" : ""}` : "Tap stones to take"}
        </button>
      </div>
      <p className="ax-hint">Whoever takes the last stone wins.</p>
    </div>
  );
}

// ─── Code Breaker ────────────────────────────────────────────────────────────
export const PEG_COLORS = ["#ef4444", "#3b82f6", "#facc15", "#22c55e", "#a855f7", "#f97316"];
const PEG_NAMES = ["red", "blue", "yellow", "green", "purple", "orange"];
function Feedback({ exact, near }: { exact: number; near: number }) {
  const pegs = [...Array(exact).fill("x"), ...Array(near).fill("n")];
  while (pegs.length < 4) pegs.push("");
  return <span className="ax-fb" aria-label={`${exact} right spot, ${near} wrong spot`}>{pegs.map((p, i) => <i key={i} className={p} />)}</span>;
}
export function CodeBreakerBoard({ view, canAct, act, theirName }: BoardProps) {
  const [slots, setSlots] = useState<(number | null)[]>([null, null, null, null]);
  useEffect(() => setSlots([null, null, null, null]), [view.myGuesses.length]);
  const used = new Set(slots.filter((x) => x !== null));
  const add = (c: number) => {
    if (used.has(c)) return;
    const i = slots.indexOf(null);
    if (i < 0) return;
    const next = slots.slice(); next[i] = c; setSlots(next);
  };
  const full = slots.every((x) => x !== null);
  return (
    <div className="ax-code">
      <p className="ax-log">Round {Math.min(view.round + 1, view.maxRounds)} of {view.maxRounds}. Find the 4 secret colors. Each color is used once.</p>
      <div style={{ display: "grid", gap: 6 }}>
        {view.myGuesses.map((g: any, i: number) => (
          <div key={i} className="ax-guess-row">
            <span className="num">{i + 1}</span>
            {g.code.map((c: number, k: number) => <span key={k} className="ax-peg" style={{ background: PEG_COLORS[c] }} aria-label={PEG_NAMES[c]} />)}
            <Feedback exact={g.exact} near={g.near} />
          </div>
        ))}
        {view.winner === null && !view.waitingForThem && (
          <div className="ax-guess-row" style={{ outline: "2px solid var(--ax-cyan)" }}>
            <span className="num">{view.myGuesses.length + 1}</span>
            {slots.map((c, k) => (
              <button key={k} type="button" className={"ax-peg" + (c === null ? " empty" : "")} style={c !== null ? { background: PEG_COLORS[c] } : undefined}
                aria-label={c === null ? "Empty slot" : `Remove ${PEG_NAMES[c]}`} onClick={() => { const next = slots.slice(); next[k] = null; setSlots(next); }} />
            ))}
            <button type="button" className="ax-btn ax-btn-primary ax-btn-small" style={{ marginLeft: "auto" }} disabled={!canAct || !full} onClick={() => act({ code: slots })}>Guess</button>
          </div>
        )}
      </div>
      {view.winner === null && (view.waitingForThem
        ? <p className="ax-hint">Waiting for {theirName} to finish this round…</p>
        : <div className="ax-palette" aria-label="Colors">{PEG_COLORS.map((c, i) => <button key={i} type="button" className="ax-peg" style={{ background: c, opacity: used.has(i) ? 0.25 : 1 }} disabled={!canAct || used.has(i)} onClick={() => add(i)} aria-label={`Add ${PEG_NAMES[i]}`} />)}</div>)}
      <div className="ax-rival">
        <span>{theirName === "Computer" ? "Computer's guesses:" : `${theirName}'s guesses:`}</span>
        {view.theirResults.length ? view.theirResults.map((r: any, i: number) => <Feedback key={i} exact={r.exact} near={r.near} />) : <span>no guesses yet</span>}
      </div>
      {view.mySecret && (
        <div className="ax-row" style={{ justifyContent: "center" }}>
          <span className="ax-hint" style={{ margin: 0 }}>Your secret code was</span>
          {view.mySecret.map((c: number, k: number) => <span key={k} className="ax-peg" style={{ background: PEG_COLORS[c] }} aria-label={PEG_NAMES[c]} />)}
        </div>
      )}
      <p className="ax-hint">● means a right color in the right spot. ○ means a right color in the wrong spot.</p>
    </div>
  );
}

// ─── Sea Battle ──────────────────────────────────────────────────────────────
export function SeaBattleBoard({ view, seat, canAct, act, theirName }: BoardProps) {
  const myShips = new Set<number>(view.myFleet.flatMap((s: any) => s.cells));
  const mySunk = new Set<number>(view.myFleet.filter((s: any) => s.sunk).flatMap((s: any) => s.cells));
  const revealed = new Set<number>(view.revealedShips.flat());
  const last = view.last;
  if (view.phase === "setup") {
    const ready = view.ready[seat - 1];
    return (
      <div className="ax-col">
        <div className="ax-sea-panel">
          <h4>Your fleet</h4>
          <div className="ax-waters big" aria-label="Your fleet">
            {Array.from({ length: 64 }, (_, i) => <span key={i} className={"ax-water" + (myShips.has(i) ? " ship" : "")} />)}
          </div>
        </div>
        {ready ? <p className="ax-log">Ready! Waiting for {theirName} to place their fleet…</p> : (
          <div className="ax-row">
            <button type="button" className="ax-btn ax-btn-ghost" disabled={!canAct} onClick={() => act({ type: "shuffle" })}>Shuffle ships</button>
            <button type="button" className="ax-btn ax-btn-primary" disabled={!canAct} onClick={() => act({ type: "ready" })}>Ready!</button>
          </div>
        )}
      </div>
    );
  }
  const log = !last ? "Fire at their waters to find their ships." : last.seat === seat
    ? (last.sunk ? `You sank a ship of ${last.sunk}! 💥` : last.hit ? "Hit! 💥" : "Splash. Miss.")
    : (last.sunk ? `${theirName} sank your ship of ${last.sunk}!` : last.hit ? `${theirName} hit your ship!` : `${theirName} missed.`);
  return (
    <div className="ax-col">
      <p className="ax-log" aria-live="polite">{log}</p>
      <div className="ax-sea">
        <div className="ax-sea-panel">
          <h4>{theirName}'s waters <span className="ax-fleet-left">({view.theirShipsLeft} ships left)</span></h4>
          <div className="ax-waters big" role="grid" aria-label="Enemy waters">
            {view.myShots.map((mark: number, i: number) => {
              const cls = revealed.has(i) ? (mark === 2 ? " hit sunk" : " sunk") : mark === 2 ? " hit" : mark === 1 ? " miss" : "";
              const isLast = last && last.seat === seat && last.cell === i;
              return (
                <button key={i} type="button" className={"ax-water" + cls + (isLast ? " last" : "")} disabled={!canAct || !!mark} onClick={() => act({ type: "fire", cell: i })}
                  aria-label={`${"ABCDEFGH"[Math.floor(i / 8)]}${(i % 8) + 1}: ${mark === 2 ? "hit" : mark === 1 ? "miss" : "unknown"}`}>
                  {mark === 2 ? "💥" : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="ax-sea-panel">
          <h4>Your fleet <span className="ax-fleet-left">({view.myShipsLeft} left)</span></h4>
          <div className="ax-waters small" aria-label="Your fleet">
            {view.theirShots.map((mark: number, i: number) => {
              const cls = mySunk.has(i) ? " sunk" : mark === 2 ? " hit" : myShips.has(i) ? " ship" : mark === 1 ? " miss" : "";
              const isLast = last && last.seat !== seat && last.cell === i;
              return <span key={i} className={"ax-water" + cls + (isLast ? " last" : "")}>{mark === 2 ? "💥" : null}</span>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
