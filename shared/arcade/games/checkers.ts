import { type ArcadeEngine, type Outcome, type Seat, bestMove, check, clone, other, WIN } from "../core";

// American checkers on an 8×8 board. Seat 1 starts at the bottom and moves up.
// Cells: 0 empty, 1/2 = man of seat 1/2, 3/4 = king of seat 1/2.
export type CheckersState = {
  board: number[];
  turn: Seat;
  winner: Outcome;
  last: number[] | null; // path of the last move
  quiet: number; // plies without a capture or a man moving
  plies: number;
  captured: [number, number]; // pieces each seat has captured
};

export const ownerOf = (v: number): 0 | Seat => (v === 1 || v === 3 ? 1 : v === 2 || v === 4 ? 2 : 0);
export const isKing = (v: number) => v >= 3;
const kingOf = (seat: Seat) => (seat === 1 ? 3 : 4);
const crownRow = (seat: Seat) => (seat === 1 ? 0 : 7);
const DIAGS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const dirsFor = (v: number) => (isKing(v) ? DIAGS : ownerOf(v) === 1 ? DIAGS.slice(0, 2) : DIAGS.slice(2));
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

export function initialBoard(): number[] {
  const b = Array(64).fill(0);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if ((r + c) % 2 !== 1) continue;
    if (r <= 2) b[r * 8 + c] = 2;
    else if (r >= 5) b[r * 8 + c] = 1;
  }
  return b;
}

/** Every legal move for `seat` as a path of squares. Captures are compulsory and must be finished. */
export function legalPaths(board: readonly number[], seat: Seat): number[][] {
  const jumps: number[][] = [];
  const steps: number[][] = [];
  for (let i = 0; i < 64; i++) {
    const v = board[i];
    if (ownerOf(v) !== seat) continue;
    // Jump sequences (depth-first, only complete sequences are legal).
    const b = board.slice();
    b[i] = 0;
    const walk = (at: number, piece: number, path: number[], taken: Set<number>) => {
      const r = Math.floor(at / 8), c = at % 8;
      let extended = false;
      // A man that just reached the crown row stops there.
      if (!(path.length > 1 && !isKing(piece) && r === crownRow(seat))) {
        for (const [dr, dc] of dirsFor(piece)) {
          const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
          if (!inside(lr, lc)) continue;
          const mid = mr * 8 + mc, land = lr * 8 + lc;
          if (taken.has(mid) || ownerOf(b[mid]) !== other(seat) || b[land] !== 0) continue;
          extended = true;
          taken.add(mid);
          walk(land, piece, [...path, land], taken);
          taken.delete(mid);
        }
      }
      if (!extended && path.length > 1) jumps.push(path);
    };
    walk(i, v, [i], new Set());
    if (jumps.length) continue;
    const r = Math.floor(i / 8), c = i % 8;
    for (const [dr, dc] of dirsFor(v)) {
      const rr = r + dr, cc = c + dc;
      if (inside(rr, cc) && board[rr * 8 + cc] === 0) steps.push([i, rr * 8 + cc]);
    }
  }
  return jumps.length ? jumps : steps;
}

/** Applies a path that is known to be legal. */
export function applyPath(board: readonly number[], path: readonly number[]): { board: number[]; captures: number; manMoved: boolean } {
  const b = board.slice();
  let piece = b[path[0]];
  const manMoved = !isKing(piece);
  b[path[0]] = 0;
  let captures = 0;
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1], z = path[k];
    if (Math.abs(Math.floor(a / 8) - Math.floor(z / 8)) === 2) {
      b[(a + z) / 2] = 0;
      captures++;
    }
  }
  const end = path[path.length - 1];
  const seat = ownerOf(piece) as Seat;
  if (!isKing(piece) && Math.floor(end / 8) === crownRow(seat)) piece = kingOf(seat);
  b[end] = piece;
  return { board: b, captures, manMoved };
}

type Node = { b: number[]; turn: Seat; done: Outcome; quiet: number };
const searchSpec = {
  moves: (n: Node) => legalPaths(n.b, n.turn),
  apply(n: Node, path: number[]): Node {
    const { board, captures, manMoved } = applyPath(n.b, path);
    const next = other(n.turn);
    const quiet = captures || manMoved ? 0 : n.quiet + 1;
    let done: Outcome = null;
    if (!legalPaths(board, next).length) done = n.turn;
    else if (quiet >= 60) done = 0;
    return { b: board, turn: next, done, quiet };
  },
  mover: (n: Node) => (n.done === null ? n.turn : null),
  evaluate(n: Node, me: Seat) {
    if (n.done !== null) return n.done === 0 ? 0 : n.done === me ? WIN : -WIN;
    let score = 0;
    for (let i = 0; i < 64; i++) {
      const v = n.b[i];
      if (!v) continue;
      const seat = ownerOf(v) as Seat;
      const r = Math.floor(i / 8), c = i % 8;
      let value = isKing(v) ? 175 : 100;
      if (!isKing(v)) {
        value += (seat === 1 ? 7 - r : r) * 4; // advancement
        if (r === (seat === 1 ? 7 : 0)) value += 6; // back-row guard
      }
      if (r >= 2 && r <= 5 && c >= 2 && c <= 5) value += 4; // center control
      if (c === 0 || c === 7) value -= 2;
      score += seat === me ? value : -value;
    }
    return score;
  },
};

export const checkers: ArcadeEngine<CheckersState, { path: number[] }> = {
  id: "checkers",
  init() {
    return { board: initialBoard(), turn: 1, winner: null, last: null, quiet: 0, plies: 0, captured: [0, 0] };
  },
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    check(state.turn === seat, "Wait for your turn.");
    const path = Array.isArray(move?.path) ? move.path.map(Number) : [];
    const legal = legalPaths(state.board, seat);
    const match = legal.find((p) => p.length === path.length && p.every((x, i) => x === path[i]));
    if (!match) {
      const mustJump = legal.some((p) => Math.abs(Math.floor(p[0] / 8) - Math.floor(p[1] / 8)) === 2);
      check(false, mustJump ? "You must jump when you can." : "That move is not allowed.");
    }
    const s = clone(state);
    const { board, captures, manMoved } = applyPath(s.board, match!);
    s.board = board;
    s.last = match!.slice();
    s.captured[seat - 1] += captures;
    s.quiet = captures || manMoved ? 0 : s.quiet + 1;
    s.plies++;
    const next = other(seat);
    if (!legalPaths(board, next).length) s.winner = seat;
    else if (s.quiet >= 60 || s.plies >= 400) s.winner = 0;
    else s.turn = next;
    return s;
  },
  view(s) {
    return { ...s, moves: s.winner === null ? legalPaths(s.board, s.turn) : [] };
  },
  ai(s, seat, level) {
    const node: Node = { b: s.board.slice(), turn: seat, done: null, quiet: s.quiet };
    const path = level === 1
      ? bestMove(searchSpec, node, seat, 1, { noise: 70 })
      : level === 2
        ? bestMove(searchSpec, node, seat, 4, { deadlineMs: 150, noise: 18 })
        : bestMove(searchSpec, node, seat, 8, { deadlineMs: 280, noise: 3 });
    return { path: path ?? legalPaths(s.board, seat)[0] };
  },
};
