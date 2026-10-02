import { type ArcadeEngine, type Outcome, type Seat, check, clone, intField, other, pick } from "../core";

// Dots & Boxes on a 4×4 box grid (5×5 dots). Finishing a box scores it and earns another turn.
export const N = 4;
export const H_LINES = (N + 1) * N; // horizontal lines
export const LINE_COUNT = H_LINES + N * (N + 1);

export type DotsState = {
  lines: (0 | 1 | 2)[];
  boxes: (0 | 1 | 2)[];
  turn: Seat;
  winner: Outcome;
  last: number | null;
  lastBoxes: number[];
  scores: [number, number];
};

export const hLine = (r: number, c: number) => r * N + c;
export const vLine = (r: number, c: number) => H_LINES + r * (N + 1) + c;
export const boxSides = (b: number): number[] => {
  const r = Math.floor(b / N), c = b % N;
  return [hLine(r, c), hLine(r + 1, c), vLine(r, c), vLine(r, c + 1)];
};
/** Boxes that touch a line. */
export function boxesOf(line: number): number[] {
  const out: number[] = [];
  if (line < H_LINES) {
    const r = Math.floor(line / N), c = line % N;
    if (r > 0) out.push((r - 1) * N + c);
    if (r < N) out.push(r * N + c);
  } else {
    const k = line - H_LINES, r = Math.floor(k / (N + 1)), c = k % (N + 1);
    if (c > 0) out.push(r * N + c - 1);
    if (c < N) out.push(r * N + c);
  }
  return out;
}
const sidesDrawn = (lines: readonly number[], b: number) => boxSides(b).filter((l) => lines[l]).length;

/** Draws a line on plain arrays; returns boxes completed. */
function drawLine(lines: number[], boxes: number[], line: number, seat: Seat): number[] {
  lines[line] = seat;
  const done: number[] = [];
  for (const b of boxesOf(line)) if (!boxes[b] && sidesDrawn(lines, b) === 4) { boxes[b] = seat; done.push(b); }
  return done;
}

/** How many boxes the next player could grab in a row after `line` is drawn. */
function giveaway(lines: readonly number[], line: number): number {
  const l = lines.slice() as number[];
  const boxes = Array(N * N).fill(0);
  for (let b = 0; b < N * N; b++) if (sidesDrawn(l, b) === 4) boxes[b] = 1;
  drawLine(l, boxes, line, 1);
  let taken = 0;
  for (let guard = 0; guard < 40; guard++) {
    let found = -1;
    for (let b = 0; b < N * N && found < 0; b++) {
      if (boxes[b] || sidesDrawn(l, b) !== 3) continue;
      found = boxSides(b).find((x) => !l[x])!;
    }
    if (found < 0) break;
    taken += drawLine(l, boxes, found, 2).length;
  }
  return taken;
}

export const dots: ArcadeEngine<DotsState, { line: number }> = {
  id: "dots",
  init() {
    return { lines: Array(LINE_COUNT).fill(0), boxes: Array(N * N).fill(0), turn: 1, winner: null, last: null, lastBoxes: [], scores: [0, 0] };
  },
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    check(state.turn === seat, "Wait for your turn.");
    const line = intField(move?.line, 0, LINE_COUNT - 1, "Pick a line.");
    check(!state.lines[line], "That line is already drawn.");
    const s = clone(state);
    const done = drawLine(s.lines as number[], s.boxes as number[], line, seat);
    s.last = line;
    s.lastBoxes = done;
    s.scores[seat - 1] += done.length;
    if (s.lines.every(Boolean)) {
      s.winner = s.scores[0] === s.scores[1] ? 0 : s.scores[0] > s.scores[1] ? 1 : 2;
    } else if (!done.length) s.turn = other(seat);
    return s;
  },
  view: (s) => s,
  ai(s, _seat, level) {
    const open = s.lines.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    const completes = open.filter((l) => boxesOf(l).some((b) => !s.boxes[b] && sidesDrawn(s.lines, b) === 3));
    const safe = open.filter((l) => !completes.includes(l) && boxesOf(l).every((b) => sidesDrawn(s.lines, b) < 2));
    if (level === 1) {
      if (completes.length && Math.random() < 0.6) return { line: pick(completes) };
      return { line: pick(open) };
    }
    if (completes.length) return { line: pick(completes) };
    if (safe.length) return { line: pick(safe) };
    if (level === 2) return { line: pick(open) };
    // Forced to give something away: give the smallest chain.
    let best = open[0], bestCost = Infinity;
    for (const l of open) {
      const cost = giveaway(s.lines, l) + Math.random() * 0.1;
      if (cost < bestCost) { bestCost = cost; best = l; }
    }
    return { line: best };
  },
};
