import { type ArcadeEngine, type Outcome, type Seat, bestMove, check, clone, intField, other, pick, WIN } from "../core";

export type ReversiState = {
  board: (0 | 1 | 2)[];
  turn: Seat;
  winner: Outcome;
  last: number | null;
  flipped: number[];
  passed: Seat | null; // seat that had to pass on the latest turn
  counts: [number, number];
};

const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

export function flipsFor(board: readonly number[], cell: number, seat: Seat): number[] {
  if (board[cell]) return [];
  const r0 = Math.floor(cell / 8), c0 = cell % 8, them = other(seat);
  const out: number[] = [];
  for (const [dr, dc] of DIRS) {
    const line: number[] = [];
    let r = r0 + dr, c = c0 + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === them) { line.push(r * 8 + c); r += dr; c += dc; }
    if (line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === seat) out.push(...line);
  }
  return out;
}
export function legalCells(board: readonly number[], seat: Seat): number[] {
  const out: number[] = [];
  for (let i = 0; i < 64; i++) if (!board[i] && flipsFor(board, i, seat).length) out.push(i);
  return out;
}
const count = (board: readonly number[]): [number, number] => {
  let a = 0, b = 0;
  for (const v of board) { if (v === 1) a++; else if (v === 2) b++; }
  return [a, b];
};

const WEIGHTS = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
];

type Node = { b: number[]; turn: Seat; done: Outcome };
function advance(b: number[], mover: Seat): Node {
  const next = other(mover);
  if (legalCells(b, next).length) return { b, turn: next, done: null };
  if (legalCells(b, mover).length) return { b, turn: mover, done: null };
  const [x, y] = count(b);
  return { b, turn: next, done: x === y ? 0 : x > y ? 1 : 2 };
}
const spec = {
  moves: (n: Node) => legalCells(n.b, n.turn),
  apply(n: Node, cell: number): Node {
    const b = n.b.slice();
    for (const f of flipsFor(b, cell, n.turn)) b[f] = n.turn;
    b[cell] = n.turn;
    return advance(b, n.turn);
  },
  mover: (n: Node) => (n.done === null ? n.turn : null),
  evaluate(n: Node, me: Seat) {
    if (n.done !== null) return n.done === 0 ? 0 : n.done === me ? WIN : -WIN;
    const them = other(me);
    let score = 0, discs = 0;
    for (let i = 0; i < 64; i++) {
      const v = n.b[i];
      if (!v) continue;
      discs++;
      score += v === me ? WEIGHTS[i] : -WEIGHTS[i];
    }
    score += (legalCells(n.b, me).length - legalCells(n.b, them).length) * 6;
    if (discs > 52) { const [a, b] = count(n.b); score += (me === 1 ? a - b : b - a) * 8; }
    return score;
  },
};

export const reversi: ArcadeEngine<ReversiState, { cell: number }> = {
  id: "reversi",
  init() {
    const board = Array(64).fill(0) as (0 | 1 | 2)[];
    board[27] = 2; board[28] = 1; board[35] = 1; board[36] = 2;
    return { board, turn: 1, winner: null, last: null, flipped: [], passed: null, counts: [2, 2] };
  },
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    check(state.turn === seat, "Wait for your turn.");
    const cell = intField(move?.cell, 0, 63, "Pick a square.");
    const flips = flipsFor(state.board, cell, seat);
    check(flips.length > 0, "That square does not flip any discs.");
    const s = clone(state);
    for (const f of flips) s.board[f] = seat;
    s.board[cell] = seat;
    s.last = cell;
    s.flipped = flips;
    s.counts = count(s.board);
    const n = advance(s.board, seat);
    s.passed = n.done === null && n.turn === seat ? other(seat) : null;
    if (n.done !== null) s.winner = n.done;
    else s.turn = n.turn;
    return s;
  },
  view(s) {
    return { ...s, moves: s.winner === null ? legalCells(s.board, s.turn) : [] };
  },
  ai(s, seat, level) {
    const moves = legalCells(s.board, seat);
    if (level === 1) {
      const scored = moves.map((c) => ({ c, v: flipsFor(s.board, c, seat).length + (WEIGHTS[c] > 50 ? 4 : 0) + Math.random() * 3 }));
      scored.sort((a, b) => b.v - a.v);
      return { cell: Math.random() < 0.35 ? pick(moves) : scored[0].c };
    }
    const node: Node = { b: s.board.slice(), turn: seat, done: null };
    const cell = level === 2
      ? bestMove(spec, node, seat, 2, { noise: 14 })
      : bestMove(spec, node, seat, 6, { deadlineMs: 260, noise: 2 });
    return { cell: cell ?? moves[0] };
  },
};
