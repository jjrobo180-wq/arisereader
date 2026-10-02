import { useEffect, useState } from "react";
import { type BoardProps, other } from "./types";

export const SUITS = ["♠", "♥", "♦", "♣"];
const SUIT_NAMES = ["spades", "hearts", "diamonds", "clubs"];
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const RANK_WORDS = ["", "Aces", "2s", "3s", "4s", "5s", "6s", "7s", "8s", "9s", "10s", "Jacks", "Queens", "Kings"];
const suitOf = (c: number) => Math.floor(c / 13);
const rankOf = (c: number) => (c % 13) + 1;
export const cardName = (c: number) => `${RANKS[rankOf(c)]}${SUITS[suitOf(c)]}`;

export function Card({ id, big = false, className = "", onClick, disabled, label }: { id?: number | null; big?: boolean; className?: string; onClick?: () => void; disabled?: boolean; label?: string }) {
  if (id === undefined || id === null) {
    return <span className={"ax-card back" + (big ? " big" : "") + (className ? " " + className : "")} aria-hidden="true" />;
  }
  const red = suitOf(id) === 1 || suitOf(id) === 2;
  const body = (<><span className="corner">{RANKS[rankOf(id)]}<br />{SUITS[suitOf(id)]}</span><span className="pip">{SUITS[suitOf(id)]}</span></>);
  const cls = "ax-card" + (red ? " red" : "") + (big ? " big" : "") + (className ? " " + className : "");
  if (!onClick) return <span className={cls} role="img" aria-label={label || `${RANKS[rankOf(id)]} of ${SUIT_NAMES[suitOf(id)]}`}>{body}</span>;
  return <button type="button" className={cls} onClick={onClick} disabled={disabled} aria-label={label || `Play ${RANKS[rankOf(id)]} of ${SUIT_NAMES[suitOf(id)]}`}>{body}</button>;
}

function Backs({ count, max = 9 }: { count: number; max?: number }) {
  return (
    <div className="ax-handrow fan" aria-label={`${count} cards`}>
      {Array.from({ length: Math.min(count, max) }, (_, i) => <Card key={i} />)}
      {count > max && <span className="ax-hint" style={{ margin: "0 0 0 8px", alignSelf: "center" }}>+{count - max}</span>}
    </div>
  );
}

// ─── Crazy Eights ────────────────────────────────────────────────────────────
export function CrazyEightsBoard({ view, seat, canAct, act, theirName }: BoardProps) {
  const [eight, setEight] = useState<number | null>(null);
  useEffect(() => { if (!canAct) setEight(null); }, [canAct]);
  const playable = new Set<number>(view.playable || []);
  const top: number = view.top;
  const suitChanged = rankOf(top) === 8 || suitOf(top) !== view.suit;
  const last = view.last;
  const log = !last ? "" : last.seat === seat
    ? (last.action === "play" ? `You played ${cardName(last.card)}${rankOf(last.card) === 8 ? ` and picked ${SUITS[last.suit]}` : ""}.` : last.action === "draw" ? "You drew a card." : "You kept your card.")
    : (last.action === "play" ? `${theirName} played ${cardName(last.card)}${rankOf(last.card) === 8 ? ` and picked ${SUITS[last.suit]}` : ""}.` : last.action === "draw" ? `${theirName} drew a card.` : `${theirName} passed.`);
  const play = (card: number) => {
    if (rankOf(card) === 8) setEight(card);
    else act({ type: "play", card });
  };
  const canDraw = canAct && !view.drew && playable.size === 0;
  return (
    <div className="ax-table">
      {view.theirHand ? (
        <div className="ax-handrow">{view.theirHand.map((c: number) => <Card key={c} id={c} />)}</div>
      ) : <Backs count={view.theirCount} />}
      <div className="ax-pile-row">
        <div className="ax-pile"><Card big /><span>{view.stock} left</span></div>
        <div className="ax-pile"><Card id={top} big className="ax-pop" key={top} /><span>Top card</span></div>
        {suitChanged && <div className="ax-pile"><span className={"ax-suit-badge" + (view.suit === 1 || view.suit === 2 ? " red" : "")}>{SUITS[view.suit]}</span><span>Suit to match</span></div>}
      </div>
      <p className="ax-log" aria-live="polite">{log}</p>
      <div className="ax-handrow" aria-label="Your hand">
        {view.hand.map((c: number) => (
          <Card key={c} id={c} className={playable.has(c) ? "playable" : canAct ? "dim" : ""} disabled={!canAct || !playable.has(c)} onClick={() => play(c)} />
        ))}
      </div>
      {canAct && (
        <div className="ax-row" style={{ justifyContent: "center" }}>
          {view.drew ? (
            <>
              <span className="ax-hint" style={{ margin: 0 }}>You can play the card you drew.</span>
              <button type="button" className="ax-btn ax-btn-ghost ax-btn-small" onClick={() => act({ type: "pass" })}>Keep it</button>
            </>
          ) : canDraw ? (
            <button type="button" className="ax-btn ax-btn-primary" onClick={() => act({ type: "draw" })}>No match. Draw a card</button>
          ) : <span className="ax-hint" style={{ margin: 0 }}>Play a glowing card. 8s are wild!</span>}
        </div>
      )}
      {eight !== null && (
        <div className="ax-help" role="dialog" aria-label="Pick a suit">
          <div>
            <h3>Pick the new suit</h3>
            <div className="ax-suits">
              {SUITS.map((s, i) => (
                <button key={s} type="button" className={i === 1 || i === 2 ? "red" : ""} aria-label={SUIT_NAMES[i]} onClick={() => { act({ type: "play", card: eight, suit: i }); setEight(null); }}>{s}</button>
              ))}
            </div>
            <button type="button" className="ax-btn ax-btn-ghost ax-wide" style={{ marginTop: 12 }} onClick={() => setEight(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Go Fish ─────────────────────────────────────────────────────────────────
export function GoFishBoard({ view, seat, canAct, act, myName, theirName }: BoardProps) {
  const groups = new Map<number, number[]>();
  for (const c of view.hand as number[]) { const r = rankOf(c); groups.set(r, [...(groups.get(r) || []), c]); }
  const events: any[] = view.history || [];
  const e = events[events.length - 1];
  const describe = (ev: any) => {
    if (!ev) return "Ask for a rank you have. Tap one of your card stacks.";
    const mine = ev.seat === seat, who = mine ? "You" : theirName;
    let text = `${who} asked for ${RANK_WORDS[ev.rank]}. `;
    if (ev.got) text += mine ? `${theirName} handed over ${ev.got}!` : `You handed over ${ev.got}.`;
    else if (ev.fished === "match") text += `Go fish! ${who} drew the one ${mine ? "you" : "they"} wanted.`;
    else if (ev.fished === "miss") text += "Go fish!";
    else text += `No ${RANK_WORDS[ev.rank]}, and the pond is empty.`;
    if (ev.book) text += ` ${mine ? "You" : theirName} made a book of ${RANK_WORDS[ev.book]}!`;
    return text;
  };
  const booksFor = (s: number, name: string) => (
    <div style={{ textAlign: "center", ["--seat" as any]: s === 1 ? "var(--ax-p1)" : "var(--ax-p2)" }}>
      <div className="ax-hint" style={{ margin: "0 0 4px" }}>{s === seat ? "Your books" : `${name}'s books`}: {view.books[s - 1].length}</div>
      <div className="ax-books">{view.books[s - 1].map((r: number) => <span key={r}>{RANKS[r]}</span>)}</div>
    </div>
  );
  return (
    <div className="ax-table">
      <Backs count={view.theirCount} />
      {booksFor(other(seat), theirName)}
      <div className="ax-pile-row">
        <div className="ax-pile"><span style={{ fontSize: 44 }} aria-hidden="true">🌊</span><span>{view.stock} cards in the pond</span></div>
      </div>
      <p className="ax-log" aria-live="polite">{describe(e)}</p>
      <div className="ax-handrow" aria-label="Your cards">
        {Array.from(groups.entries()).map(([rank, cards]) => (
          <button key={rank} type="button" className="ax-rankbtn" disabled={!canAct} onClick={() => act({ rank })} aria-label={`Ask for ${RANK_WORDS[rank]} (you have ${cards.length})`}>
            <span className="stack">{cards.map((c) => <Card key={c} id={c} />)}</span>
            {canAct && <small>Ask</small>}
          </button>
        ))}
        {!groups.size && <span className="ax-hint">No cards in your hand.</span>}
      </div>
      {booksFor(seat, myName)}
    </div>
  );
}

// ─── Memory Match ────────────────────────────────────────────────────────────
export function MemoryBoard({ view, canAct, act }: BoardProps) {
  const peekKey = (view.peek || []).join(",");
  const [showPeek, setShowPeek] = useState(true);
  useEffect(() => {
    setShowPeek(true);
    if (!peekKey) return;
    const t = window.setTimeout(() => setShowPeek(false), 1800);
    return () => window.clearTimeout(t);
  }, [peekKey]);
  const faceUp = new Set<number>(view.faceUp || []);
  const peek = new Set<number>(showPeek ? view.peek || [] : []);
  return (
    <div className="ax-memory" role="grid" aria-label="Memory cards">
      {view.cards.map((face: string | null, i: number) => {
        const owner = view.matched[i];
        const up = !!owner || faceUp.has(i) || peek.has(i) || (view.winner !== null && !!face);
        return (
          <button key={i} type="button" className={"ax-mem" + (up ? " up" : "") + (owner ? " got" : "")}
            style={owner ? { ["--seat" as any]: owner === 1 ? "var(--ax-p1)" : "var(--ax-p2)" } : undefined}
            disabled={!canAct || !!owner || faceUp.has(i)} onClick={() => act({ card: i })}
            aria-label={up && face ? `Card ${i + 1}: ${face}` : `Card ${i + 1}, face down`}>
            <span className="ax-mem-inner">
              <span className="ax-mem-face back" />
              <span className="ax-mem-face front">{face || ""}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
