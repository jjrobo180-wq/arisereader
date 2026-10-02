import { type ArcadeEngine, type Outcome, type Seat, LINES_3X3, check, clone, intField, mctsMove, other, pick, rand } from "../core";

// Ultimate Tic-Tac-Toe: nine small boards. The square you play sends your opponent to that board.
export type UltimateState = {
  cells: (0 | 1 | 2)[]; // board*9 + cell
  small: (0 | 1 | 2 | 3)[]; // 3 = full with no winner
  next: number; // board you must play in, or -1 for any open board
  turn: Seat;
  winner: Outcome;
  line: number[] | null; // winning line of small boards
  last: { board: number; cell: number } | null;
};

const lineOwner = (get: (i: number) => number): { seat: Seat; line: number[] } | null => {
  for (const l of LINES_3X3) {
    const v = get(l[0]);
    if ((v === 1 || v === 2) && v === get(l[1]) && v === get(l[2])) return { seat: v, line: [...l] };
  }
  return null;
};

type Node = { cells: number[]; small: number[]; next: number; turn: Seat; done: Outcome };

function legal(n: Node): number[] {
  const out: number[] = [];
  for (let b = 0; b < 9; b++) {
    if (n.small[b] || (n.next >= 0 && n.next !== b)) continue;
    for (let c = 0; c < 9; c++) if (!n.cells[b * 9 + c]) out.push(b * 9 + c);
  }
  return out;
}

/** Applies a move in place. */
function applyInPlace(n: Node, idx: number): void {
  const b = Math.floor(idx / 9), c = idx % 9, seat = n.turn;
  n.cells[idx] = seat;
  const w = lineOwner((i) => n.cells[b * 9 + i]);
  if (w) n.small[b] = seat;
  else if ([0, 1, 2, 3, 4, 5, 6, 7, 8].every((i) => n.cells[b * 9 + i])) n.small[b] = 3;
  const big = lineOwner((i) => n.small[i]);
  if (big) n.done = big.seat;
  else if (n.small.every(Boolean)) n.done = 0;
  n.next = n.small[c] ? -1 : c;
  n.turn = other(seat);
}

const mcts = {
  moves: legal,
  apply(n: Node, idx: number): Node {
    const copy: Node = { cells: n.cells.slice(), small: n.small.slice(), next: n.next, turn: n.turn, done: n.done };
    applyInPlace(copy, idx);
    return copy;
  },
  mover: (n: Node) => (n.done === null ? n.turn : null),
  outcome: (n: Node) => n.done,
  playout(n: Node): Outcome {
    const s: Node = { cells: n.cells.slice(), small: n.small.slice(), next: n.next, turn: n.turn, done: n.done };
    for (let guard = 0; guard < 90 && s.done === null; guard++) {
      const moves = legal(s);
      if (!moves.length) { s.done = 0; break; }
      applyInPlace(s, moves[rand(moves.length)]);
    }
    return s.done;
  },
};

function canWinSmall(cells: readonly number[], b: number, seat: Seat): boolean {
  for (let c = 0; c < 9; c++) {
    if (cells[b * 9 + c]) continue;
    const get = (i: number) => (i === c ? seat : cells[b * 9 + i]);
    if (lineOwner(get)?.seat === seat) return true;
  }
  return false;
}

function heuristic(n: Node, seat: Seat, noise: number): number {
  const moves = legal(n);
  let best = moves[0], bestScore = -Infinity;
  for (const idx of moves) {
    const b = Math.floor(idx / 9), c = idx % 9;
    const after = mcts.apply(n, idx);
    let score = Math.random() * noise;
    if (after.done === seat) score += 10_000;
    if (after.small[b] === seat) score += 40;
    // Block: would the opponent have won this small board here?
    const get = (i: number) => (i === c ? other(seat) : n.cells[b * 9 + i]);
    if (lineOwner(get)?.seat === other(seat)) score += 18;
    if (after.next === -1) score -= 25; // free choice for the opponent
    else if (canWinSmall(after.cells, after.next, other(seat))) score -= 30;
    if (c === 4) score += 3;
    if (b === 4) score += 2;
    if (score > bestScore) { bestScore = score; best = idx; }
  }
  return best;
}

export const ultimate: ArcadeEngine<UltimateState, { board: number; cell: number }> = {
  id: "ultimate",
  init() {
    return { cells: Array(81).fill(0), small: Array(9).fill(0), next: -1, turn: 1, winner: null, line: null, last: null };
  },
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    check(state.turn === seat, "Wait for your turn.");
    const board = intField(move?.board, 0, 8, "Pick a board.");
    const cell = intField(move?.cell, 0, 8, "Pick a square.");
    check(!state.small[board], "That board is already finished.");
    check(state.next < 0 || state.next === board, "You must play in the highlighted board.");
    check(!state.cells[board * 9 + cell], "That square is taken.");
    const s = clone(state);
    const n: Node = { cells: s.cells, small: s.small, next: s.next, turn: s.turn, done: null };
    applyInPlace(n, board * 9 + cell);
    s.next = n.next;
    s.last = { board, cell };
    if (n.done !== null) {
      s.winner = n.done;
      s.line = n.done ? lineOwner((i) => s.small[i])?.line ?? null : null;
    } else s.turn = n.turn;
    return s;
  },
  view: (s) => s,
  ai(s, seat, level) {
    const node: Node = { cells: s.cells.slice(), small: s.small.slice(), next: s.next, turn: seat, done: null };
    let idx: number | null;
    if (level === 1) {
      const moves = legal(node);
      idx = Math.random() < 0.5 ? heuristic(node, seat, 30) : pick(moves);
    } else if (level === 2) idx = heuristic(node, seat, 6);
    else idx = mctsMove(mcts, node, seat, 260);
    const chosen = idx ?? legal(node)[0];
    return { board: Math.floor(chosen / 9), cell: chosen % 9 };
  },
};
