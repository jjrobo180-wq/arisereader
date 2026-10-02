// A.R.I.S.E. Arcade game framework.
// Every arcade game is a pure, JSON-serializable state machine. The server is
// authoritative: it stores the state, validates moves with `play`, hides secrets
// with `view`, and runs `ai` for computer opponents.

export type Seat = 1 | 2;
/** 0 = draw, 1/2 = winning seat, null = still playing. */
export type Outcome = 0 | 1 | 2 | null;
export type Level = 1 | 2 | 3;

export interface InitOptions {
  level: Level;
  vsComputer: boolean;
}

export interface ArcadeEngine<S = any, M = any> {
  id: string;
  init(opts: InitOptions): S;
  /** Seats allowed to act right now (two seats for simultaneous rounds). Empty once finished. */
  toAct(s: S): Seat[];
  /** Validates and applies a move. Never mutates `s`. Throws MoveError for illegal moves. */
  play(s: S, seat: Seat, move: M): S;
  outcome(s: S): Outcome;
  /** The part of the state `seat` is allowed to see. */
  view(s: S, seat: Seat): unknown;
  /** A move for the computer playing `seat`. Must only use information that seat may know. */
  ai(s: S, seat: Seat, level: Level): M;
}

export class MoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoveError";
  }
}

export const other = (seat: Seat): Seat => (seat === 1 ? 2 : 1);
export const rand = (n: number) => Math.floor(Math.random() * n);
export function pick<T>(list: readonly T[]): T {
  return list[rand(list.length)];
}
export function shuffle<T>(list: readonly T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new MoveError(message);
}
/** Reads an integer move field in [lo, hi] or throws a friendly MoveError. */
export function intField(value: unknown, lo: number, hi: number, message: string): number {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < lo || n > hi) throw new MoveError(message);
  return n;
}
export function isSeat(value: unknown): value is Seat {
  return value === 1 || value === 2;
}

// ─── Search helpers ──────────────────────────────────────────────────────────

export const WIN = 1_000_000;

export interface SearchSpec<S, M> {
  moves(s: S): M[];
  apply(s: S, m: M): S;
  /** Seat to move, or null when the position is over. */
  mover(s: S): Seat | null;
  /** Score from `me`'s point of view. Finished positions should return ±WIN (0 for draws). */
  evaluate(s: S, me: Seat): number;
}

class SearchTimeout extends Error {}

// The server scales thinking time down when many computer moves are being
// calculated at once, so one hard game never slows everyone else down.
let budgetScale = 1;
export function setSearchBudgetScale(scale: number) {
  budgetScale = Math.max(0.1, Math.min(1, Number(scale) || 1));
}
export const scaledBudget = (ms: number) => Math.max(15, Math.round(ms * budgetScale));

/**
 * Alpha-beta minimax from a fixed point of view, so games with extra turns
 * (Mancala, Dots & Boxes) work naturally. Uses iterative deepening when a
 * deadline is given and returns the best move of the deepest finished search.
 * `noise` adds random slack so the computer does not always play the same game.
 */
export function bestMove<S, M>(
  spec: SearchSpec<S, M>,
  root: S,
  me: Seat,
  maxDepth: number,
  opts: { deadlineMs?: number; noise?: number } = {},
): M | null {
  const rootMoves = spec.moves(root);
  if (!rootMoves.length) return null;
  if (rootMoves.length === 1) return rootMoves[0];
  const deadline = opts.deadlineMs ? Date.now() + scaledBudget(opts.deadlineMs) : 0;
  let nodes = 0;

  const search = (s: S, depth: number, alpha: number, beta: number): number => {
    if (deadline && ++nodes % 256 === 0 && Date.now() > deadline) throw new SearchTimeout();
    const mover = spec.mover(s);
    if (mover === null || depth === 0) {
      const v = spec.evaluate(s, me);
      // Prefer quicker wins and slower losses.
      if (v >= WIN / 2) return v + depth;
      if (v <= -WIN / 2) return v - depth;
      return v;
    }
    const moves = spec.moves(s);
    if (!moves.length) return spec.evaluate(s, me);
    if (mover === me) {
      let best = -Infinity;
      for (const m of moves) {
        best = Math.max(best, search(spec.apply(s, m), depth - 1, alpha, beta));
        alpha = Math.max(alpha, best);
        if (alpha >= beta) break;
      }
      return best;
    }
    let best = Infinity;
    for (const m of moves) {
      best = Math.min(best, search(spec.apply(s, m), depth - 1, alpha, beta));
      beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    return best;
  };

  let chosen: M = rootMoves[0];
  let ordered = rootMoves.slice();
  const startDepth = deadline ? 1 : maxDepth;
  for (let depth = startDepth; depth <= maxDepth; depth++) {
    try {
      const scored: { m: M; v: number }[] = [];
      const slackAtRoot = opts.noise || 0;
      let bestSoFar = -Infinity;
      for (const m of ordered) {
        // Moves that cannot come within `noise` of the best are cut early (fail-low).
        const alpha = bestSoFar === -Infinity ? -Infinity : bestSoFar - slackAtRoot - 1;
        const v = search(spec.apply(root, m), depth - 1, alpha, Infinity);
        scored.push({ m, v });
        if (v > bestSoFar) bestSoFar = v;
      }
      scored.sort((a, b) => b.v - a.v);
      const top = scored[0].v;
      const slack = Math.abs(top) >= WIN / 2 ? 0 : opts.noise || 0;
      const near = scored.filter((x) => x.v >= top - slack);
      chosen = near[rand(near.length)].m;
      ordered = scored.map((x) => x.m); // best-first ordering helps the next pass
      if (top >= WIN / 2) break; // forced win found
    } catch (error) {
      if (error instanceof SearchTimeout) break;
      throw error;
    }
  }
  return chosen;
}

/** Monte Carlo tree search (UCT) for games where a heuristic is hard to write. */
export interface MctsSpec<S, M> {
  moves(s: S): M[];
  apply(s: S, m: M): S;
  mover(s: S): Seat | null;
  outcome(s: S): Outcome;
  /** Fast random playout to the end; returns the outcome. May mutate its own copy. */
  playout(s: S): Outcome;
}

export function mctsMove<S, M>(spec: MctsSpec<S, M>, root: S, _me: Seat, budgetMs: number, maxIterations = 50_000): M | null {
  type Node = { s: S; move: M | null; parent: Node | null; children: Node[]; untried: M[]; visits: number; wins: number; mover: Seat | null };
  const make = (s: S, move: M | null, parent: Node | null): Node => ({
    s, move, parent, children: [], untried: spec.mover(s) === null ? [] : shuffle(spec.moves(s)), visits: 0, wins: 0, mover: spec.mover(s),
  });
  const rootNode = make(root, null, null);
  if (!rootNode.untried.length) return null;
  if (rootNode.untried.length === 1) return rootNode.untried[0];
  const deadline = Date.now() + scaledBudget(budgetMs);
  for (let i = 0; i < maxIterations; i++) {
    if ((i & 63) === 0 && Date.now() > deadline) break;
    let node = rootNode;
    // Selection
    while (!node.untried.length && node.children.length) {
      const logN = Math.log(node.visits);
      let best = node.children[0], bestScore = -Infinity;
      for (const child of node.children) {
        const score = child.wins / child.visits + 1.25 * Math.sqrt(logN / child.visits);
        if (score > bestScore) { bestScore = score; best = child; }
      }
      node = best;
    }
    // Expansion
    if (node.untried.length) {
      const m = node.untried.pop()!;
      const child = make(spec.apply(node.s, m), m, node);
      node.children.push(child);
      node = child;
    }
    // Simulation
    const result = node.mover === null ? spec.outcome(node.s) : spec.playout(node.s);
    // Backpropagation: each node scores the result for the seat that moved INTO it.
    for (let n: Node | null = node; n; n = n.parent) {
      n.visits++;
      const movedBy = n.parent ? n.parent.mover : null;
      if (movedBy) n.wins += result === movedBy ? 1 : result === 0 ? 0.5 : 0;
    }
  }
  let best = rootNode.children[0];
  for (const child of rootNode.children) if (child.visits > best.visits) best = child;
  return best ? best.move : rootNode.untried[0] ?? null;
}

/** Lines through a 3×3 grid (index = row*3+col). */
export const LINES_3X3: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
