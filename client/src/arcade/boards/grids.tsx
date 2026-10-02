import { useEffect, useState } from "react";
import { type BoardProps, type Seat, other } from "./types";

/** X for seat 1 (gold), O for seat 2 (pink). */
export function Mark({ seat, draw = false }: { seat: number; draw?: boolean }) {
  if (seat === 1) return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path className={"ax-mark-path" + (draw ? " draw" : "")} d="M11 11L29 29M29 11L11 29" stroke="var(--ax-p1)" strokeWidth="6.5" strokeLinecap="round" fill="none" />
    </svg>
  );
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle className={"ax-mark-path" + (draw ? " draw" : "")} cx="20" cy="20" r="10.5" stroke="var(--ax-p2)" strokeWidth="6.5" fill="none" />
    </svg>
  );
}
const markName = (v: number) => (v === 1 ? "X" : v === 2 ? "O" : "empty");

export function TicTacToeBoard({ view, canAct, act }: BoardProps) {
  const win = new Set<number>(view.line || []);
  return (
    <div className="ax-ttt" role="grid" aria-label="Tic-tac-toe board">
      {view.board.map((v: number, i: number) => (
        <button key={i} type="button" className={"ax-ttt-cell ax-cell-btn" + (win.has(i) ? " win" : "")}
          disabled={!canAct || !!v} onClick={() => act({ cell: i })}
          aria-label={`Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}: ${markName(v)}`}>
          {v ? <Mark seat={v} draw={view.last === i} /> : null}
        </button>
      ))}
    </div>
  );
}

export function FifteenBoard({ view, seat, canAct, act, myName, theirName }: BoardProps) {
  const owner: number[] = view.owner;
  const triple = new Set<number>(view.triple || []);
  const numbersOf = (s: Seat) => owner.map((o, i) => (o === s ? i + 1 : 0)).filter(Boolean);
  const hand = (s: Seat, name: string) => (
    <div className="ax-hand" style={{ ["--seat" as any]: s === 1 ? "var(--ax-p1)" : "var(--ax-p2)" }}>
      <b>{name}</b>
      <div className="tiles">{numbersOf(s).map((n) => <span key={n} className={triple.has(n) && view.winner === s ? "win" : ""}>{n}</span>)}</div>
    </div>
  );
  const mine = numbersOf(seat);
  const sumHint = mine.length >= 2 && view.winner === null
    ? "Your pairs need: " + Array.from(new Set(mine.flatMap((a, i) => mine.slice(i + 1).map((b) => 15 - a - b)).filter((n) => n >= 1 && n <= 9 && !owner[n - 1]))).sort((a, b) => a - b).join(", ")
    : "";
  return (
    <div className="ax-fifteen">
      <div className="ax-nums">
        {owner.map((o, i) => (
          <button key={i} type="button" className={"ax-num" + (o ? " taken" : "")} disabled={!canAct || !!o} onClick={() => act({ number: i + 1 })} aria-label={`Take ${i + 1}`}
            style={o ? { background: o === 1 ? "var(--ax-p1)" : "var(--ax-p2)", color: "#160b22", opacity: 0.85 } : undefined}>
            {i + 1}
          </button>
        ))}
      </div>
      <div className="ax-hands">{hand(seat, myName)}{hand(other(seat), theirName)}</div>
      <p className="ax-hint">{sumHint || "Collect three numbers that add up to exactly 15."}</p>
    </div>
  );
}

export function UltimateBoard({ view, canAct, act }: BoardProps) {
  const open = (b: number) => !view.small[b] && (view.next < 0 || view.next === b);
  return (
    <div className="ax-col">
      <div className="ax-ult" aria-label="Ultimate tic-tac-toe board">
        {Array.from({ length: 9 }, (_, b) => {
          const won = view.small[b] === 1 || view.small[b] === 2 ? view.small[b] : 0;
          const target = canAct && open(b);
          return (
            <div key={b} className={"ax-ult-board" + (target ? " target" : "") + (won ? " won" : "")}
              style={won ? { ["--seat" as any]: won === 1 ? "var(--ax-p1)" : "var(--ax-p2)" } : undefined}>
              {Array.from({ length: 9 }, (_, c) => {
                const v = view.cells[b * 9 + c];
                const last = view.last && view.last.board === b && view.last.cell === c;
                return (
                  <button key={c} type="button" className={"ax-ult-cell ax-cell-btn" + (last ? " last" : "")}
                    disabled={!target || !!v} onClick={() => act({ board: b, cell: c })}
                    aria-label={`Board ${b + 1}, square ${c + 1}: ${markName(v)}`}>
                    {v ? <Mark seat={v} draw={!!last} /> : null}
                  </button>
                );
              })}
              {won ? <div className="ax-ult-big"><Mark seat={won} /></div> : null}
            </div>
          );
        })}
      </div>
      {canAct && <p className="ax-hint">{view.next < 0 ? "Play in any open board." : "Play in the glowing board."}</p>}
    </div>
  );
}

export function GomokuBoard({ view, canAct, act }: BoardProps) {
  const size = Math.round(Math.sqrt(view.board.length));
  const win = new Set<number>(view.line || []);
  const lines = [];
  for (let i = 0; i < size; i++) {
    const p = ((i + 0.5) / size) * 100;
    lines.push(<line key={"h" + i} x1={(0.5 / size) * 100 + "%"} x2={(1 - 0.5 / size) * 100 + "%"} y1={p + "%"} y2={p + "%"} />);
    lines.push(<line key={"v" + i} y1={(0.5 / size) * 100 + "%"} y2={(1 - 0.5 / size) * 100 + "%"} x1={p + "%"} x2={p + "%"} />);
  }
  const mid = Math.floor(size / 2);
  return (
    <div className="ax-goban">
      <div className="ax-goban-grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, gridTemplateRows: `repeat(${size}, 1fr)` }}>
        <svg className="ax-goban-lines" aria-hidden="true">
          <g stroke="#6b4416" strokeWidth="1.3">{lines}</g>
          <circle cx={((mid + 0.5) / size) * 100 + "%"} cy={((mid + 0.5) / size) * 100 + "%"} r="3.5" fill="#6b4416" />
        </svg>
        {view.board.map((v: number, i: number) => (
          <button key={i} type="button" className="ax-pt" disabled={!canAct || !!v} onClick={() => act({ cell: i })}
            aria-label={`Row ${Math.floor(i / size) + 1}, column ${(i % size) + 1}: ${v === 1 ? "black" : v === 2 ? "white" : "empty"}`}>
            {v ? <span className={`ax-stone p${v}` + (view.last === i ? " last ax-pop" : "") + (win.has(i) ? " win" : "")} /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Gobble Tac Toe ──────────────────────────────────────────────────────────
const pieceSeat = (code: number): Seat => (code <= 3 ? 1 : 2);
const pieceSize = (code: number) => ((code - 1) % 3) + 1;
const SIZE_NAMES = ["", "small", "medium", "large"];

function GobPiece({ code }: { code: number }) {
  const seat = pieceSeat(code), size = pieceSize(code);
  return <span className={"ax-gob-piece s" + size} style={{ background: seat === 1 ? "var(--ax-p1)" : "var(--ax-p2)" }}>{size === 3 ? "L" : size === 2 ? "M" : "S"}</span>;
}

export function GobbleBoard({ view, seat, canAct, act, myName, theirName }: BoardProps) {
  // Selection: a reserve size (from = -1) or one of my top pieces on the board.
  const [pick, setPick] = useState<{ from: number; size: number } | null>(null);
  useEffect(() => { if (!canAct) setPick(null); }, [canAct]);
  const top = (cell: number) => { const st: number[] = view.stacks[cell]; return st.length ? st[st.length - 1] : 0; };
  const win = new Set<number>(view.line || []);
  const canLand = (cell: number) => !!pick && cell !== pick.from && (!top(cell) || pieceSize(top(cell)) < pick.size);
  const clickCell = (cell: number) => {
    if (!canAct) return;
    const t = top(cell);
    if (pick && canLand(cell)) {
      act(pick.from < 0 ? { from: -1, to: cell, size: pick.size } : { from: pick.from, to: cell });
      setPick(null);
      return;
    }
    if (t && pieceSeat(t) === seat) setPick(pick?.from === cell ? null : { from: cell, size: pieceSize(t) });
  };
  const reserve = (s: Seat, name: string, mine: boolean) => (
    <div className="ax-reserve" aria-label={`${name}'s pieces`}>
      <b>{name}</b>
      {[3, 2, 1].map((size) => {
        const left = view.reserve[s - 1][size - 1];
        return (
          <button key={size} type="button" className="ax-res-btn" disabled={!mine || !canAct || !left}
            aria-pressed={mine && pick?.from === -1 && pick.size === size}
            aria-label={`${SIZE_NAMES[size]} piece, ${left} left`}
            onClick={() => setPick(pick?.from === -1 && pick.size === size ? null : { from: -1, size })}
            style={{ opacity: left ? 1 : 0.25 }}>
            <GobPiece code={(s - 1) * 3 + size} />
            <sup>×{left}</sup>
          </button>
        );
      })}
    </div>
  );
  return (
    <div className="ax-gobble">
      {reserve(other(seat), theirName, false)}
      <div className="ax-gob-grid">
        {view.stacks.map((stack: number[], cell: number) => {
          const t = top(cell);
          const lastTo = view.last?.to === cell;
          return (
            <button key={cell} type="button"
              className={"ax-gob-cell ax-cell-btn" + (canLand(cell) ? " ok" : "") + (win.has(cell) ? " win" : "") + (pick?.from === cell ? " from" : "")}
              disabled={!canAct} onClick={() => clickCell(cell)}
              aria-label={`Square ${cell + 1}: ${t ? `${pieceSeat(t) === seat ? "your" : "their"} ${SIZE_NAMES[pieceSize(t)]} piece` : "empty"}`}>
              {t ? <span className={lastTo ? "ax-pop" : ""} style={{ display: "contents" }}><GobPiece code={t} /></span> : null}
              {stack.length > 1 && (
                <span className="ax-gob-under" aria-hidden="true">
                  {stack.slice(0, -1).map((c, i) => <i key={i} style={{ background: pieceSeat(c) === 1 ? "var(--ax-p1)" : "var(--ax-p2)" }} />)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {reserve(seat, myName, true)}
      <p className="ax-hint">{canAct ? (pick ? "Now tap a square. Bigger pieces can cover smaller ones." : "Pick a piece below, or tap one of your pieces on the board to move it.") : " "}</p>
    </div>
  );
}
