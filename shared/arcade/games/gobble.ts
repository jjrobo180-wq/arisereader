import { type ArcadeEngine, type Outcome, type Seat, LINES_3X3, bestMove, check, clone, intField, other, WIN } from "../core";

// Gobble Tac Toe: tic-tac-toe with small, medium and large pieces (two of each).
// A bigger piece can cover a smaller one. You may also move one of your visible pieces.
// Piece code: (seat - 1) * 3 + size  → 1..3 for seat 1, 4..6 for seat 2.
export type GobbleState = {
  stacks: number[][]; // bottom → top, per cell
  reserve: [number[], number[]]; // reserve[seat-1][size-1] = pieces left
  turn: Seat;
  winner: Outcome;
  line: number[] | null;
  last: { from: number; to: number; size: number } | null; // from -1 = reserve
  plies: number;
};
export type GobbleMove = { from: number; to: number; size?: number };

export const pieceSeat = (code: number): Seat => (code <= 3 ? 1 : 2);
export const pieceSize = (code: number) => ((code - 1) % 3) + 1;
const code = (seat: Seat, size: number) => (seat - 1) * 3 + size;
const topOf = (stack: readonly number[]) => (stack.length ? stack[stack.length - 1] : 0);

function lineFor(stacks: readonly number[][], seat: Seat): number[] | null {
  for (const l of LINES_3X3) if (l.every((i) => { const t = topOf(stacks[i]); return t && pieceSeat(t) === seat; })) return [...l];
  return null;
}

type Node = { st: number[][]; res: [number[], number[]]; turn: Seat; done: Outcome; plies: number };

function movesFor(n: Node, seat: Seat): GobbleMove[] {
  const out: GobbleMove[] = [];
  const canLand = (cell: number, size: number) => { const t = topOf(n.st[cell]); return !t || pieceSize(t) < size; };
  for (let size = 3; size >= 1; size--) {
    if (!n.res[seat - 1][size - 1]) continue;
    for (let to = 0; to < 9; to++) if (canLand(to, size)) out.push({ from: -1, to, size });
  }
  for (let from = 0; from < 9; from++) {
    const t = topOf(n.st[from]);
    if (!t || pieceSeat(t) !== seat) continue;
    for (let to = 0; to < 9; to++) if (to !== from && canLand(to, pieceSize(t))) out.push({ from, to });
  }
  return out;
}

/** Applies a legal move in place and decides the result. */
function applyInPlace(n: Node, m: GobbleMove): void {
  const seat = n.turn;
  let piece: number;
  if (m.from < 0) { n.res[seat - 1][(m.size as number) - 1]--; piece = code(seat, m.size as number); }
  else piece = n.st[m.from].pop()!;
  n.st[m.to].push(piece);
  n.plies++;
  const theirs = lineFor(n.st, other(seat));
  const mine = lineFor(n.st, seat);
  if (theirs) n.done = other(seat); // uncovering an opponent line loses
  else if (mine) n.done = seat;
  else if (n.plies >= 60) n.done = 0;
  n.turn = other(seat);
  if (n.done === null && !movesFor(n, n.turn).length) n.done = seat;
}

const copyNode = (n: Node): Node => ({ st: n.st.map((s) => s.slice()), res: [n.res[0].slice(), n.res[1].slice()], turn: n.turn, done: n.done, plies: n.plies });
const spec = {
  moves: (n: Node) => movesFor(n, n.turn),
  apply(n: Node, m: GobbleMove): Node { const c = copyNode(n); applyInPlace(c, m); return c; },
  mover: (n: Node) => (n.done === null ? n.turn : null),
  evaluate(n: Node, me: Seat) {
    if (n.done !== null) return n.done === 0 ? 0 : n.done === me ? WIN : -WIN;
    const them = other(me);
    let score = 0;
    for (const l of LINES_3X3) {
      let mine = 0, theirs = 0, bigMine = 0, bigTheirs = 0;
      for (const i of l) {
        const t = topOf(n.st[i]);
        if (!t) continue;
        if (pieceSeat(t) === me) { mine++; if (pieceSize(t) === 3) bigMine++; }
        else { theirs++; if (pieceSize(t) === 3) bigTheirs++; }
      }
      if (!theirs && mine === 2) score += 10 + bigMine * 4;
      if (!mine && theirs === 2) score -= 12 + bigTheirs * 4;
    }
    const t4 = topOf(n.st[4]);
    if (t4) score += pieceSeat(t4) === me ? 3 : -3;
    score += (n.res[me - 1][2] - n.res[them - 1][2]) * 2;
    return score;
  },
};

export const gobble: ArcadeEngine<GobbleState, GobbleMove> = {
  id: "gobble",
  init() {
    return { stacks: Array.from({ length: 9 }, () => []), reserve: [[2, 2, 2], [2, 2, 2]], turn: 1, winner: null, line: null, last: null, plies: 0 };
  },
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    check(state.turn === seat, "Wait for your turn.");
    const from = intField(move?.from, -1, 8, "Choose a piece to play.");
    const to = intField(move?.to, 0, 8, "Choose a square.");
    let size: number;
    if (from < 0) {
      size = intField(move?.size, 1, 3, "Choose a piece size.");
      check(state.reserve[seat - 1][size - 1] > 0, "You have no pieces of that size left.");
    } else {
      check(from !== to, "Move the piece to a different square.");
      const t = topOf(state.stacks[from]);
      check(t && pieceSeat(t) === seat, "You can only move your own pieces that are on top.");
      size = pieceSize(t);
    }
    const target = topOf(state.stacks[to]);
    check(!target || pieceSize(target) < size, "Only a bigger piece can cover another piece.");
    const s = clone(state);
    const n: Node = { st: s.stacks, res: s.reserve, turn: seat, done: null, plies: s.plies };
    applyInPlace(n, { from, to, size });
    s.plies = n.plies;
    s.last = { from, to, size };
    if (n.done !== null) {
      s.winner = n.done;
      s.line = n.done ? lineFor(s.stacks, n.done) : null;
    } else s.turn = n.turn;
    return s;
  },
  view: (s) => s,
  ai(s, seat, level) {
    const node: Node = { st: s.stacks.map((x) => x.slice()), res: [s.reserve[0].slice(), s.reserve[1].slice()], turn: seat, done: null, plies: s.plies };
    const m = level === 1
      ? bestMove(spec, node, seat, 1, { noise: 22 })
      : level === 2
        ? bestMove(spec, node, seat, 2, { noise: 5 })
        : bestMove(spec, node, seat, 5, { deadlineMs: 240, noise: 1 });
    return m ?? movesFor(node, seat)[0];
  },
};
