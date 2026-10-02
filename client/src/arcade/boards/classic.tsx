import { useEffect, useMemo, useState } from "react";
import { type BoardProps, other } from "./types";
import { IconCrown } from "../icons";

const seatColor = (s: number) => (s === 1 ? "var(--ax-p1)" : "var(--ax-p2)");

// ─── Connect Four ────────────────────────────────────────────────────────────
export function ConnectFourBoard({ view, canAct, act }: BoardProps) {
  const win = new Set<number>(view.line || []);
  const full = (c: number) => !!view.board[c];
  return (
    <div className="ax-c4" role="grid" aria-label="Connect Four board">
      {Array.from({ length: 7 }, (_, c) => (
        <button key={c} type="button" className="ax-c4-col" disabled={!canAct || full(c)} onClick={() => act({ col: c })} aria-label={`Drop in column ${c + 1}`}>
          {Array.from({ length: 6 }, (_, r) => {
            const i = r * 7 + c, v = view.board[i];
            return (
              <span key={r} className="ax-c4-hole">
                {v ? <span className={"ax-c4-disc" + (view.last === i ? " drop" : "") + (win.has(i) ? " win" : "")}
                  style={{ background: seatColor(v), ["--from" as any]: `${-(r + 1) * 122}%` }} /> : null}
              </span>
            );
          })}
        </button>
      ))}
    </div>
  );
}

// ─── Checkers ────────────────────────────────────────────────────────────────
const ownerOf = (v: number) => (v === 1 || v === 3 ? 1 : v === 2 || v === 4 ? 2 : 0);

export function CheckersBoard({ view, seat, canAct, act }: BoardProps) {
  const [path, setPath] = useState<number[]>([]);
  useEffect(() => setPath([]), [view.last?.join?.(","), canAct]);
  const moves: number[][] = canAct ? view.moves || [] : [];
  const flipped = seat === 2;
  const order = useMemo(() => { const a = Array.from({ length: 64 }, (_, i) => i); return flipped ? a.reverse() : a; }, [flipped]);
  const starts = new Set(moves.map((m) => m[0]));
  const matching = moves.filter((m) => path.every((sq, i) => m[i] === sq));
  const targets = new Set(path.length ? matching.filter((m) => m.length > path.length).map((m) => m[path.length]) : []);
  const lastPath = new Set<number>(view.last || []);
  const mustJump = moves.some((m) => Math.abs(Math.floor(m[0] / 8) - Math.floor(m[1] / 8)) === 2);

  const tap = (sq: number) => {
    if (!canAct) return;
    if (targets.has(sq)) {
      const next = [...path, sq];
      const done = moves.find((m) => m.length === next.length && m.every((x, i) => x === next[i]));
      if (done && !moves.some((m) => m.length > next.length && next.every((x, i) => m[i] === x))) { act({ path: done }); setPath([]); }
      else setPath(next);
      return;
    }
    if (starts.has(sq)) setPath(path[0] === sq ? [] : [sq]);
    else setPath([]);
  };

  return (
    <div className="ax-col">
      <div className="ax-wood" role="grid" aria-label="Checkers board">
        {order.map((sq) => {
          const r = Math.floor(sq / 8), c = sq % 8, dark = (r + c) % 2 === 1, v = view.board[sq];
          const atNow = path.length > 1 && path[path.length - 1] === sq;
          return (
            <button key={sq} type="button" className={"ax-sq " + (dark ? "dark" : "light") + (lastPath.has(sq) ? " last" : "")}
              disabled={!canAct || !dark} onClick={() => tap(sq)}
              aria-label={`${"abcdefgh"[c]}${8 - r}: ${v ? (ownerOf(v) === seat ? "your " : "their ") + (v >= 3 ? "king" : "piece") : "empty"}`}>
              {v ? (
                <span className={`ax-ck p${ownerOf(v)}` + (starts.has(sq) && !path.length ? " can" : "") + (path[0] === sq ? " sel" : "")}
                  style={path.length > 1 && path[0] === sq ? { opacity: 0.35 } : undefined}>
                  {v >= 3 ? <IconCrown /> : null}
                </span>
              ) : null}
              {atNow && <span className={`ax-ck p${seat} sel`} style={{ position: "absolute" }}>{view.board[path[0]] >= 3 ? <IconCrown /> : null}</span>}
              {targets.has(sq) && <span className="dot" />}
            </button>
          );
        })}
      </div>
      <p className={"ax-hint" + (mustJump && canAct ? " warn" : "")}>
        {!canAct ? " " : mustJump ? (path.length > 1 ? "Keep jumping!" : "You must jump!") : path.length ? "Tap a glowing dot to move." : "Tap one of your glowing pieces."}
      </p>
    </div>
  );
}

// ─── Reversi ─────────────────────────────────────────────────────────────────
export function ReversiBoard({ view, seat, canAct, act, theirName }: BoardProps) {
  const legal = new Set<number>(canAct ? view.moves || [] : []);
  const flipped = new Set<number>(view.flipped || []);
  const passNote = view.passed === other(seat) && view.turn === seat && view.winner === null
    ? `${theirName} had no moves, so you go again.`
    : view.passed === seat && view.winner === null ? "You had no moves, so your turn was skipped." : "";
  return (
    <div className="ax-col">
      <div className="ax-felt" role="grid" aria-label="Reversi board">
        {view.board.map((v: number, i: number) => (
          <button key={i} type="button" className={"ax-felt-cell" + (view.last === i ? " last" : "")} disabled={!legal.has(i)} onClick={() => act({ cell: i })}
            aria-label={`Row ${Math.floor(i / 8) + 1}, column ${(i % 8) + 1}: ${v === 1 ? "black" : v === 2 ? "white" : legal.has(i) ? "you can play here" : "empty"}`}>
            {v ? <span key={`${i}-${v}`} className={`ax-disc p${v}` + (flipped.has(i) ? " flip" : "") + (view.last === i ? " ax-pop" : "")} /> : legal.has(i) ? <span className="hintdot" /> : null}
          </button>
        ))}
      </div>
      <p className="ax-hint">{passNote || (canAct ? "Tap a dot to trap and flip discs." : " ")}</p>
    </div>
  );
}

// ─── Dots & Boxes ────────────────────────────────────────────────────────────
const DOTS_N = 4;
const H_LINES = (DOTS_N + 1) * DOTS_N;
export function DotsBoard({ view, canAct, act }: BoardProps) {
  const pad = 8, step = (100 - pad * 2) / DOTS_N;
  const pt = (r: number, c: number) => [pad + c * step, pad + r * step];
  const lines: { id: number; a: number[]; b: number[] }[] = [];
  for (let r = 0; r <= DOTS_N; r++) for (let c = 0; c < DOTS_N; c++) lines.push({ id: r * DOTS_N + c, a: pt(r, c), b: pt(r, c + 1) });
  for (let r = 0; r < DOTS_N; r++) for (let c = 0; c <= DOTS_N; c++) lines.push({ id: H_LINES + r * (DOTS_N + 1) + c, a: pt(r, c), b: pt(r + 1, c) });
  const fresh = new Set<number>(view.lastBoxes || []);
  return (
    <div className="ax-col">
      <svg className="ax-dots-svg" viewBox="0 0 100 100" role="group" aria-label="Dots and boxes board">
        {view.boxes.map((owner: number, b: number) => {
          if (!owner) return null;
          const [x, y] = pt(Math.floor(b / DOTS_N), b % DOTS_N);
          return <rect key={b} x={x + 1.2} y={y + 1.2} width={step - 2.4} height={step - 2.4} rx="2.5" fill={seatColor(owner)} opacity={0.6} className={fresh.has(b) ? "ax-pop" : ""} style={{ transformOrigin: `${x + step / 2}px ${y + step / 2}px` }} />;
        })}
        {lines.map(({ id, a, b }) => {
          const drawn = view.lines[id];
          const open = !drawn && canAct;
          return (
            <g key={id}>
              {open && <line className="hit" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} strokeWidth={6} role="button" tabIndex={0} aria-label="Draw this line"
                onClick={() => act({ line: id })} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act({ line: id }); } }} />}
              <line className={"ln" + (drawn ? "" : " open")} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} pointerEvents="none"
                stroke={drawn ? seatColor(drawn) : undefined} strokeWidth={view.last === id ? 2.6 : 1.9}
                style={view.last === id ? { filter: "drop-shadow(0 0 2px #fff)" } : undefined} />
            </g>
          );
        })}
        {Array.from({ length: (DOTS_N + 1) ** 2 }, (_, i) => { const [x, y] = pt(Math.floor(i / (DOTS_N + 1)), i % (DOTS_N + 1)); return <circle key={i} cx={x} cy={y} r={1.7} fill="#f6f4ff" pointerEvents="none" />; })}
      </svg>
      <p className="ax-hint">{canAct ? (fresh.size && view.turn ? "Box claimed! Go again." : "Tap between two dots to draw a line.") : " "}</p>
    </div>
  );
}

// ─── Mancala ─────────────────────────────────────────────────────────────────
const STONE_COLORS = ["#7dd3fc", "#f9a8d4", "#fde68a", "#86efac", "#c4b5fd", "#fca5a5"];
function Stones({ n, seed }: { n: number; seed: number }) {
  const shown = Math.min(n, 12);
  return <span className="ax-stones" aria-hidden="true">{Array.from({ length: shown }, (_, i) => <i key={i} style={{ background: STONE_COLORS[(i * 7 + seed) % STONE_COLORS.length] }} />)}</span>;
}
/** True on portrait phones, where Mancala stands up so the pits can be bigger. */
function usePortraitPhone() {
  const query = "(max-width: 640px) and (orientation: portrait)";
  const [on, setOn] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const update = () => setOn(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return on;
}

export function MancalaBoard({ view, seat, canAct, act, myName, theirName }: BoardProps) {
  const tall = usePortraitPhone();
  const pits: number[] = view.pits;
  const myBase = seat === 1 ? 0 : 7, theirBase = seat === 1 ? 7 : 0;
  const myStore = seat === 1 ? 6 : 13, theirStore = seat === 1 ? 13 : 6;
  const lastEnd = view.last?.end;
  const extra = view.last?.extra && view.last.seat === seat && view.turn === seat && view.winner === null;
  const pit = (index: number, mine: boolean, k: number) => (
    <button key={index} type="button" className={"ax-pit" + (mine ? " mine" : "") + (lastEnd === index ? " last" : "")}
      disabled={!mine || !canAct || !pits[index]} onClick={() => act({ pit: k })}
      aria-label={`${mine ? "Your" : "Their"} pit with ${pits[index]} stones`}>
      <Stones n={pits[index]} seed={index} />
      <span className="ax-count">{pits[index]}</span>
    </button>
  );
  const store = (index: number, label: string, seed: number) => (
    <div className={"ax-store" + (lastEnd === index ? " last" : "")} aria-label={`${label}: ${pits[index]}`}>
      <Stones n={pits[index]} seed={seed} /><span className="ax-count">{pits[index]}</span>
    </div>
  );
  const theirStoreEl = store(theirStore, `${theirName}'s store`, 3);
  const myStoreEl = store(myStore, myName === "You" ? "Your store" : `${myName}'s store`, 5);
  // Stones always travel counter-clockwise: along your pits, into your store, then around the other side.
  return (
    <div className="ax-col">
      {tall ? (
        <div className="ax-mancala tall" role="group" aria-label="Mancala board">
          {theirStoreEl}
          <div className="ax-mancala-cols">
            <div className="ax-mancala-col">{[0, 1, 2, 3, 4, 5].map((k) => pit(myBase + k, true, k))}</div>
            <div className="ax-mancala-col">{[5, 4, 3, 2, 1, 0].map((k) => pit(theirBase + k, false, k))}</div>
          </div>
          {myStoreEl}
        </div>
      ) : (
        <div className="ax-mancala" role="group" aria-label="Mancala board">
          {theirStoreEl}
          <div className="ax-mancala-rows">
            <div className="ax-mancala-row">{[5, 4, 3, 2, 1, 0].map((k) => pit(theirBase + k, false, k))}</div>
            <div className="ax-mancala-row">{[0, 1, 2, 3, 4, 5].map((k) => pit(myBase + k, true, k))}</div>
          </div>
          {myStoreEl}
        </div>
      )}
      <p className={"ax-hint" + (extra ? " warn" : "")}>
        {extra ? "Landed in your store. Go again!" : view.last?.captured && view.last.seat === seat ? `Capture! +${view.last.captured} stones` : canAct ? (tall ? "Tap one of your pits on the left. Your store is at the bottom." : "Tap one of your pits on the bottom row. Your store is on the right.") : " "}
      </p>
    </div>
  );
}
