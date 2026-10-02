import { type ArcadeEngine, type Outcome, type Seat, bestMove, check, clone, intField, other, pick, rand, WIN } from "../core";

export const ROWS = 6, COLS = 7;
export type FourState = {
  board: (0 | 1 | 2)[]; // row-major, row 0 is the top
  turn: Seat;
  winner: Outcome;
  line: number[] | null;
  last: number | null;
  moves: number;
};

const WINDOWS: number[][] = (() => {
  const out: number[][] = [];
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) for (const [dr, dc] of dirs) {
    const cells: number[] = [];
    for (let k = 0; k < 4; k++) {
      const rr = r + dr * k, cc = c + dc * k;
      if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) break;
      cells.push(rr * COLS + cc);
    }
    if (cells.length === 4) out.push(cells);
  }
  return out;
})();

export function dropRow(board: readonly number[], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (!board[r * COLS + col]) return r;
  return -1;
}
export function fourLine(board: readonly number[]): { winner: 1 | 2; line: number[] } | null {
  for (const w of WINDOWS) {
    const v = board[w[0]];
    if (v && v === board[w[1]] && v === board[w[2]] && v === board[w[3]]) return { winner: v as 1 | 2, line: w };
  }
  return null;
}

type Node = { b: number[]; turn: Seat; done: Outcome };
const ORDER = [3, 2, 4, 1, 5, 0, 6];
const spec = {
  moves: (n: Node) => ORDER.filter((c) => !n.b[c]),
  apply(n: Node, col: number): Node {
    const b = n.b.slice();
    const r = dropRow(b, col);
    b[r * COLS + col] = n.turn;
    const w = fourLine(b);
    const done: Outcome = w ? w.winner : b.every(Boolean) ? 0 : null;
    return { b, turn: other(n.turn), done };
  },
  mover: (n: Node) => (n.done === null ? n.turn : null),
  evaluate(n: Node, me: Seat) {
    if (n.done !== null) return n.done === 0 ? 0 : n.done === me ? WIN : -WIN;
    let score = 0;
    const them = other(me);
    for (let r = 0; r < ROWS; r++) {
      const v = n.b[r * COLS + 3];
      if (v === me) score += 4; else if (v === them) score -= 4;
    }
    for (const w of WINDOWS) {
      let mine = 0, theirs = 0;
      for (const i of w) { const v = n.b[i]; if (v === me) mine++; else if (v === them) theirs++; }
      if (mine && theirs) continue;
      if (mine === 3) score += 50; else if (mine === 2) score += 6;
      else if (theirs === 3) score -= 55; else if (theirs === 2) score -= 6;
    }
    return score;
  },
};

function friendlyMove(board: number[], seat: Seat): number {
  const open = ORDER.filter((c) => !board[c]);
  const wins = (who: Seat) => open.filter((c) => { const b = board.slice(); b[dropRow(b, c) * COLS + c] = who; return fourLine(b)?.winner === who; });
  const mine = wins(seat);
  if (mine.length) return mine[0];
  const theirs = wins(other(seat));
  if (theirs.length && Math.random() < 0.75) return theirs[0];
  if (Math.random() < 0.3) return pick(open);
  const weight = [1, 2, 3, 4, 3, 2, 1];
  let best = open[0], bestScore = -Infinity;
  for (const c of open) { const s = weight[c] * 2 + Math.random() * 3; if (s > bestScore) { bestScore = s; best = c; } }
  return best;
}

export const connectfour: ArcadeEngine<FourState, { col: number }> = {
  id: "four",
  init() {
    return { board: Array(ROWS * COLS).fill(0), turn: 1, winner: null, line: null, last: null, moves: 0 };
  },
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    check(state.turn === seat, "Wait for your turn.");
    const col = intField(move?.col, 0, COLS - 1, "Pick a column.");
    const r = dropRow(state.board, col);
    check(r >= 0, "That column is full.");
    const s = clone(state);
    s.board[r * COLS + col] = seat;
    s.last = r * COLS + col;
    s.moves++;
    const w = fourLine(s.board);
    if (w) { s.winner = w.winner; s.line = w.line; }
    else if (s.board.every(Boolean)) s.winner = 0;
    else s.turn = other(seat);
    return s;
  },
  view: (s) => s,
  ai(s, seat, level) {
    if (level === 1) return { col: friendlyMove(s.board, seat) };
    const node: Node = { b: s.board.slice(), turn: seat, done: null };
    const col = level === 2
      ? bestMove(spec, node, seat, 4, { noise: 18 })
      : bestMove(spec, node, seat, 8, { deadlineMs: 220, noise: 2 });
    return { col: col ?? ORDER.find((c) => !s.board[c]) ?? rand(COLS) };
  },
};
