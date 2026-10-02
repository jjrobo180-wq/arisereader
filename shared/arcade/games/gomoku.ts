import { type ArcadeEngine, type Level, type Outcome, type Seat, check, clone, intField, other, pick, scaledBudget } from "../core";

// Five in a Row on an 11×11 board. Five or more in a line wins.
export const SIZE = 11;
export type GomokuState = {
  board: (0 | 1 | 2)[];
  turn: Seat;
  winner: Outcome;
  line: number[] | null;
  last: number | null;
  moves: number;
};

const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
const at = (r: number, c: number) => (r >= 0 && r < SIZE && c >= 0 && c < SIZE ? r * SIZE + c : -1);

export function fiveLine(board: readonly number[], cell: number): number[] | null {
  const seat = board[cell];
  if (!seat) return null;
  const r0 = Math.floor(cell / SIZE), c0 = cell % SIZE;
  for (const [dr, dc] of DIRS) {
    const line = [cell];
    for (const sign of [1, -1]) {
      let r = r0 + dr * sign, c = c0 + dc * sign;
      while (at(r, c) >= 0 && board[at(r, c)] === seat) { line.push(at(r, c)); r += dr * sign; c += dc * sign; }
    }
    if (line.length >= 5) return line.sort((a, b) => a - b);
  }
  return null;
}

/**
 * How strong a stone at `cell` would be for `seat`: every five-cell window through it
 * that the other player has not blocked, weighted by how full it would be. Windows
 * catch split shapes like X_XX as well as solid ones.
 */
const WINDOW_VALUE = [0, 1, 10, 100, 1_200, 1_000_000];
function cellScore(board: readonly number[], cell: number, seat: Seat): number {
  const r0 = Math.floor(cell / SIZE), c0 = cell % SIZE;
  let total = 0;
  const line = new Array<number>(9);
  for (const [dr, dc] of DIRS) {
    for (let k = -4; k <= 4; k++) {
      if (k === 0) { line[4] = 1; continue; }
      const j = at(r0 + dr * k, c0 + dc * k);
      line[k + 4] = j < 0 ? -1 : board[j] === seat ? 1 : board[j] ? -1 : 0;
    }
    for (let start = 0; start <= 4; start++) {
      let n = 0, open = true;
      for (let i = start; i < start + 5; i++) { if (line[i] < 0) { open = false; break; } n += line[i]; }
      if (open) total += WINDOW_VALUE[n];
    }
  }
  return total;
}

function candidates(board: readonly number[]): number[] {
  const out: number[] = [];
  let any = false;
  for (let i = 0; i < board.length; i++) {
    if (board[i]) { any = true; continue; }
    const r = Math.floor(i / SIZE), c = i % SIZE;
    let near = false;
    for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2 && !near; dc++) {
      const j = at(r + dr, c + dc);
      if (j >= 0 && board[j]) near = true;
    }
    if (near) out.push(i);
  }
  if (!any) return [at(Math.floor(SIZE / 2), Math.floor(SIZE / 2))];
  return out;
}

/** Empty cells where `seat` would complete five, looking only along the lines through `cell`. */
function fivesThrough(board: number[], cell: number, seat: Seat): number[] {
  const out: number[] = [];
  const r0 = Math.floor(cell / SIZE), c0 = cell % SIZE;
  for (const [dr, dc] of DIRS) {
    for (let k = -4; k <= 4; k++) {
      if (!k) continue;
      const j = at(r0 + dr * k, c0 + dc * k);
      if (j < 0 || board[j] || out.includes(j)) continue;
      board[j] = seat;
      if (fiveLine(board, j)) out.push(j);
      board[j] = 0;
    }
  }
  return out;
}

/** Every empty cell where `seat` would complete five right now. */
function fivesAnywhere(board: number[], seat: Seat): number[] {
  const out: number[] = [];
  for (const cell of candidates(board)) {
    board[cell] = seat;
    if (fiveLine(board, cell)) out.push(cell);
    board[cell] = 0;
  }
  return out;
}

/**
 * Victory by continuous fours: a chain of moves that each threaten five, so the
 * other player must block every time, ending in a five or a double threat.
 * Returns the first move of such a chain, or -1.
 */
function findFourChain(board: number[], seat: Seat, depth: number, deadline: number): number {
  if (depth <= 0 || Date.now() > deadline) return -1;
  const them = other(seat);
  for (const cell of candidates(board)) {
    board[cell] = seat;
    let found = false;
    if (fiveLine(board, cell)) found = true;
    else {
      const threats = fivesThrough(board, cell, seat);
      if (threats.length >= 2) found = true;
      else if (threats.length === 1) {
        const block = threats[0];
        board[block] = them;
        // A block that makes their own five-threat breaks the chain.
        if (!fivesThrough(board, block, them).length) found = findFourChain(board, seat, depth - 1, deadline) >= 0;
        board[block] = 0;
      }
    }
    board[cell] = 0;
    if (found) return cell;
    if (Date.now() > deadline) break;
  }
  return -1;
}

function heuristicScores(board: readonly number[], seat: Seat, level: Level): { cell: number; score: number }[] {
  const them = other(seat);
  const defenseWeight = level === 1 ? 0.45 : level === 2 ? 0.8 : 0.9;
  const noise = level === 1 ? 900 : level === 2 ? 40 : 3;
  return candidates(board).map((cell) => ({
    cell,
    score: cellScore(board, cell, seat) + cellScore(board, cell, them) * defenseWeight + Math.random() * noise,
  })).sort((a, b) => b.score - a.score);
}

/** Cells where `seat` would make an open four (two ways to make five), so the other side cannot stop it. */
function openFourCells(board: number[], seat: Seat, among: number[] = candidates(board)): number[] {
  const out: number[] = [];
  for (const cell of among) {
    board[cell] = seat;
    if (fivesThrough(board, cell, seat).length >= 2) out.push(cell);
    board[cell] = 0;
  }
  return out;
}

export function gomokuChoose(input: readonly number[], seat: Seat, level: Level): number {
  const board = input.slice() as number[];
  const them = other(seat);
  const mine = fivesAnywhere(board, seat);
  if (mine.length) return mine[0]; // win now
  const theirs = fivesAnywhere(board, them);
  if (level === 1) {
    if (theirs.length && Math.random() < 0.6) return theirs[0];
    if (Math.random() < 0.12) return pick(candidates(board));
    return heuristicScores(board, seat, 1)[0].cell;
  }
  if (theirs.length) return theirs[0]; // block five
  const hard = level === 3;
  // A chain of fours wins by force, whatever else is on the board.
  const chain = findFourChain(board, seat, hard ? 7 : 3, Date.now() + scaledBudget(hard ? 110 : 35));
  if (chain >= 0) return chain;
  const ranked = heuristicScores(board, seat, level);
  // They threaten an open four next move: block it (Medium sometimes misses this).
  const danger = openFourCells(board, them);
  if (danger.length && (hard || Math.random() < 0.75)) {
    const blocks = ranked.filter((r) => danger.includes(r.cell));
    if (blocks.length) return blocks[0].cell;
  }
  if (hard) {
    // A move that sets up two open fours at once wins next turn.
    for (const { cell } of ranked.slice(0, 12)) {
      board[cell] = seat;
      const follow = openFourCells(board, seat);
      board[cell] = 0;
      if (follow.length >= 2) return cell;
    }
    const theirChain = findFourChain(board, them, 5, Date.now() + scaledBudget(35));
    if (theirChain >= 0) {
      // Prefer a strong move that leaves them without a winning chain.
      for (const { cell } of ranked.slice(0, 10)) {
        board[cell] = seat;
        const still = findFourChain(board, them, 5, Date.now() + scaledBudget(12)) >= 0;
        board[cell] = 0;
        if (!still) return cell;
      }
      return theirChain;
    }
  }
  return ranked[0].cell;
}

export const gomoku: ArcadeEngine<GomokuState, { cell: number }> = {
  id: "gomoku",
  init() {
    return { board: Array(SIZE * SIZE).fill(0), turn: 1, winner: null, line: null, last: null, moves: 0 };
  },
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    check(state.turn === seat, "Wait for your turn.");
    const cell = intField(move?.cell, 0, SIZE * SIZE - 1, "Pick a spot.");
    check(!state.board[cell], "That spot is taken.");
    const s = clone(state);
    s.board[cell] = seat;
    s.last = cell;
    s.moves++;
    const line = fiveLine(s.board, cell);
    if (line) { s.winner = seat; s.line = line; }
    else if (s.board.every(Boolean)) s.winner = 0;
    else s.turn = other(seat);
    return s;
  },
  view: (s) => s,
  ai(s, seat, level) {
    return { cell: gomokuChoose(s.board, seat, level) };
  },
};
