import { type ArcadeEngine, type Outcome, type Seat, bestMove, check, clone, intField, other, WIN } from "../core";

// Kalah: 6 pits each with 4 seeds. Pits 0-5 + store 6 belong to seat 1; pits 7-12 + store 13 to seat 2.
export type MancalaState = {
  pits: number[];
  turn: Seat;
  winner: Outcome;
  last: { seat: Seat; pit: number; end: number; extra: boolean; captured: number } | null;
};

export const storeOf = (seat: Seat) => (seat === 1 ? 6 : 13);
export const pitIndex = (seat: Seat, pit: number) => (seat === 1 ? pit : 7 + pit);
const sideRange = (seat: Seat) => (seat === 1 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]);

function sow(pits: number[], seat: Seat, pit: number): { end: number; extra: boolean; captured: number } {
  let i = pitIndex(seat, pit);
  let seeds = pits[i];
  pits[i] = 0;
  const skip = storeOf(other(seat));
  while (seeds > 0) {
    i = (i + 1) % 14;
    if (i === skip) continue;
    pits[i]++;
    seeds--;
  }
  let captured = 0;
  const own = sideRange(seat);
  if (own.includes(i) && pits[i] === 1) {
    const opposite = 12 - i;
    if (pits[opposite] > 0) {
      captured = pits[opposite] + 1;
      pits[storeOf(seat)] += captured;
      pits[opposite] = 0;
      pits[i] = 0;
    }
  }
  return { end: i, extra: i === storeOf(seat), captured };
}

/** Ends the game if a side is empty: remaining seeds go to their owner's store. */
function settle(pits: number[]): Outcome {
  const empty1 = sideRange(1).every((i) => !pits[i]);
  const empty2 = sideRange(2).every((i) => !pits[i]);
  if (!empty1 && !empty2) return null;
  for (const seat of [1, 2] as Seat[]) for (const i of sideRange(seat)) { pits[storeOf(seat)] += pits[i]; pits[i] = 0; }
  return pits[6] === pits[13] ? 0 : pits[6] > pits[13] ? 1 : 2;
}

type Node = { p: number[]; turn: Seat; done: Outcome };
const spec = {
  moves: (n: Node) => [0, 1, 2, 3, 4, 5].filter((k) => n.p[pitIndex(n.turn, k)] > 0),
  apply(n: Node, pit: number): Node {
    const p = n.p.slice();
    const r = sow(p, n.turn, pit);
    const done = settle(p);
    return { p, turn: r.extra ? n.turn : other(n.turn), done };
  },
  mover: (n: Node) => (n.done === null ? n.turn : null),
  evaluate(n: Node, me: Seat) {
    if (n.done !== null) return n.done === 0 ? 0 : n.done === me ? WIN : -WIN;
    const them = other(me);
    const side = (seat: Seat) => sideRange(seat).reduce((a, i) => a + n.p[i], 0);
    return (n.p[storeOf(me)] - n.p[storeOf(them)]) * 4 + (side(me) - side(them));
  },
};

export const mancala: ArcadeEngine<MancalaState, { pit: number }> = {
  id: "mancala",
  init() {
    const pits = Array(14).fill(4);
    pits[6] = 0; pits[13] = 0;
    return { pits, turn: 1, winner: null, last: null };
  },
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    check(state.turn === seat, "Wait for your turn.");
    const pit = intField(move?.pit, 0, 5, "Pick one of your pits.");
    check(state.pits[pitIndex(seat, pit)] > 0, "That pit is empty.");
    const s = clone(state);
    const r = sow(s.pits, seat, pit);
    s.last = { seat, pit, ...r };
    const done = settle(s.pits);
    if (done !== null) s.winner = done;
    else if (!r.extra) s.turn = other(seat);
    return s;
  },
  view: (s) => s,
  ai(s, seat, level) {
    const node: Node = { p: s.pits.slice(), turn: seat, done: null };
    const pit = level === 1
      ? bestMove(spec, node, seat, 1, { noise: 8 })
      : level === 2
        ? bestMove(spec, node, seat, 4, { noise: 3 })
        : bestMove(spec, node, seat, 9, { deadlineMs: 200, noise: 0 });
    return { pit: pit ?? [0, 1, 2, 3, 4, 5].find((k) => s.pits[pitIndex(seat, k)] > 0)! };
  },
};
