import { type ArcadeEngine, type Level, type Outcome, type Seat, LINES_3X3, check, clone, intField, other, pick } from "../core";

export type TttState = {
  board: (0 | 1 | 2)[];
  turn: Seat;
  winner: Outcome;
  line: number[] | null;
  last: number | null;
};

export function lineWinner(board: readonly number[]): { winner: 1 | 2; line: number[] } | null {
  for (const line of LINES_3X3) {
    const v = board[line[0]];
    if (v && v === board[line[1]] && v === board[line[2]]) return { winner: v as 1 | 2, line: [...line] };
  }
  return null;
}

/** Perfect-play value for `me` (1 win, 0 draw, -1 loss) with `toMove` to play. */
function solve(board: number[], toMove: Seat, me: Seat): number {
  const w = lineWinner(board);
  if (w) return w.winner === me ? 1 : -1;
  if (board.every(Boolean)) return 0;
  let best = toMove === me ? -2 : 2;
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    board[i] = toMove;
    const v = solve(board, other(toMove), me);
    board[i] = 0;
    best = toMove === me ? Math.max(best, v) : Math.min(best, v);
    if ((toMove === me && best === 1) || (toMove !== me && best === -1)) break;
  }
  return best;
}

/** Chooses a cell on a tic-tac-toe board. Shared with Fifteen (which is tic-tac-toe in disguise). */
export function tttChoose(board: (0 | 1 | 2)[], seat: Seat, level: Level): number {
  const open = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (!open.length) return -1;
  const winsFor = (who: Seat) => open.filter((i) => { const b = board.slice(); b[i] = who; return !!lineWinner(b); });
  const myWins = winsFor(seat);
  if (level === 1) {
    if (myWins.length && Math.random() < 0.6) return myWins[0];
    const blocks = winsFor(other(seat));
    if (blocks.length && Math.random() < 0.45) return blocks[0];
    return pick(open);
  }
  if (myWins.length) return myWins[0];
  const blocks = winsFor(other(seat));
  if (blocks.length) return blocks[0];
  if (level === 2 && Math.random() < 0.3) {
    // A friendly slip now and then so medium is beatable.
    return pick(open);
  }
  // Perfect play, picking randomly among equally good cells for variety.
  const scored = open.map((i) => { const b = board.slice() as number[]; b[i] = seat; return { i, v: solve(b, other(seat), seat) }; });
  const top = Math.max(...scored.map((x) => x.v));
  const best = scored.filter((x) => x.v === top);
  // Prefer center/corners among equals (feels natural).
  const pref = best.filter((x) => x.i === 4 || [0, 2, 6, 8].includes(x.i));
  return (pref.length && Math.random() < 0.7 ? pick(pref) : pick(best)).i;
}

export const tictactoe: ArcadeEngine<TttState, { cell: number }> = {
  id: "tictactoe",
  init() {
    return { board: Array(9).fill(0), turn: 1, winner: null, line: null, last: null };
  },
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    check(state.turn === seat, "Wait for your turn.");
    const cell = intField(move?.cell, 0, 8, "Pick a square.");
    check(!state.board[cell], "That square is taken.");
    const s = clone(state);
    s.board[cell] = seat;
    s.last = cell;
    const w = lineWinner(s.board);
    if (w) { s.winner = w.winner; s.line = w.line; }
    else if (s.board.every(Boolean)) s.winner = 0;
    else s.turn = other(seat);
    return s;
  },
  view: (s) => s,
  ai(s, seat, level) {
    return { cell: tttChoose(s.board, seat, level) };
  },
};

// ─── Fifteen: take numbers 1–9; first to hold three that add to 15 wins. ─────
// It is tic-tac-toe on the magic square, so the computer reuses the solver.
const MAGIC = [2, 7, 6, 9, 5, 1, 4, 3, 8]; // cell index -> number
const CELL_OF = (n: number) => MAGIC.indexOf(n);

export type FifteenState = {
  owner: (0 | 1 | 2)[]; // owner[n-1] for numbers 1..9
  turn: Seat;
  winner: Outcome;
  triple: number[] | null; // winning numbers
  last: number | null;
};

function fifteenWinner(owner: readonly number[], seat: Seat): number[] | null {
  const mine: number[] = [];
  owner.forEach((o, i) => { if (o === seat) mine.push(i + 1); });
  for (let a = 0; a < mine.length; a++)
    for (let b = a + 1; b < mine.length; b++)
      for (let c = b + 1; c < mine.length; c++)
        if (mine[a] + mine[b] + mine[c] === 15) return [mine[a], mine[b], mine[c]];
  return null;
}

export const fifteen: ArcadeEngine<FifteenState, { number: number }> = {
  id: "fifteen",
  init() {
    return { owner: Array(9).fill(0), turn: 1, winner: null, triple: null, last: null };
  },
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    check(state.turn === seat, "Wait for your turn.");
    const n = intField(move?.number, 1, 9, "Pick a number from 1 to 9.");
    check(!state.owner[n - 1], "That number is already taken.");
    const s = clone(state);
    s.owner[n - 1] = seat;
    s.last = n;
    const triple = fifteenWinner(s.owner, seat);
    if (triple) { s.winner = seat; s.triple = triple; }
    else if (s.owner.every(Boolean)) s.winner = 0;
    else s.turn = other(seat);
    return s;
  },
  view: (s) => s,
  ai(s, seat, level) {
    const board = Array(9).fill(0) as (0 | 1 | 2)[];
    s.owner.forEach((o, i) => { if (o) board[CELL_OF(i + 1)] = o; });
    const cell = tttChoose(board, seat, level);
    return { number: cell >= 0 ? MAGIC[cell] : s.owner.findIndex((o) => !o) + 1 };
  },
};

// Exported for tests.
export const __test = { solve, fifteenWinner, MAGIC };
