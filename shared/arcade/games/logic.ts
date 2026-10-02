import { type ArcadeEngine, type Outcome, type Seat, check, clone, intField, other, pick, rand, shuffle } from "../core";

// ─── Last Stone (Nim): take any number from one pile; whoever takes the last stone wins. ─
export type NimState = {
  piles: number[];
  turn: Seat;
  winner: Outcome;
  last: { seat: Seat; pile: number; take: number } | null;
};

function nimRandomPiles(): number[] {
  for (;;) {
    const count = 3 + rand(2);
    const piles = Array.from({ length: count }, () => 1 + rand(7));
    const total = piles.reduce((a, b) => a + b, 0);
    if (total >= 10 && total <= 22) return piles;
  }
}

export const nim: ArcadeEngine<NimState, { pile: number; take: number }> = {
  id: "nim",
  init() {
    return { piles: nimRandomPiles(), turn: 1, winner: null, last: null };
  },
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    check(state.turn === seat, "Wait for your turn.");
    const pile = intField(move?.pile, 0, state.piles.length - 1, "Pick a pile.");
    check(state.piles[pile] > 0, "That pile is empty.");
    const take = intField(move?.take, 1, state.piles[pile], "Take at least one stone from that pile.");
    const s = clone(state);
    s.piles[pile] -= take;
    s.last = { seat, pile, take };
    if (s.piles.every((p) => p === 0)) s.winner = seat;
    else s.turn = other(seat);
    return s;
  },
  view: (s) => s,
  ai(s, _seat, level) {
    const moves: { pile: number; take: number }[] = [];
    s.piles.forEach((p, pile) => { for (let take = 1; take <= p; take++) moves.push({ pile, take }); });
    const xor = s.piles.reduce((a, b) => a ^ b, 0);
    const winning = moves.filter((m) => s.piles.reduce((a, p, i) => a ^ (i === m.pile ? p - m.take : p), 0) === 0);
    const smart = level === 3 ? 1 : level === 2 ? 0.55 : 0.15;
    if (xor !== 0 && winning.length && Math.random() < smart) return pick(winning);
    // Losing position (or playing loosely): take a small bite and hope for a mistake.
    const small = moves.filter((m) => m.take <= 2);
    return pick(level === 3 && small.length ? small : moves);
  },
};

// ─── Code Breaker: crack your own secret 4-color code before your rival cracks theirs. ─
export const CODE_COLORS = 6;
export const CODE_LENGTH = 4;
export const CODE_ROUNDS = 8;
export type Guess = { code: number[]; exact: number; near: number };
export type CodeState = {
  secrets: [number[], number[]];
  guesses: [Guess[], Guess[]];
  round: number;
  winner: Outcome;
};

export function feedback(secret: readonly number[], code: readonly number[]): { exact: number; near: number } {
  let exact = 0, near = 0;
  for (let i = 0; i < code.length; i++) {
    if (code[i] === secret[i]) exact++;
    else if (secret.includes(code[i])) near++;
  }
  return { exact, near };
}
const ALL_CODES: number[][] = (() => {
  const out: number[][] = [];
  const walk = (prefix: number[]) => {
    if (prefix.length === CODE_LENGTH) { out.push(prefix); return; }
    for (let c = 0; c < CODE_COLORS; c++) if (!prefix.includes(c)) walk([...prefix, c]);
  };
  walk([]);
  return out;
})();
const randomCode = () => shuffle([0, 1, 2, 3, 4, 5]).slice(0, CODE_LENGTH);
const solved = (g: Guess[]) => g.some((x) => x.exact === CODE_LENGTH);

export const codebreaker: ArcadeEngine<CodeState, { code: number[] }> = {
  id: "codebreaker",
  init() {
    return { secrets: [randomCode(), randomCode()], guesses: [[], []], round: 0, winner: null };
  },
  toAct: (s) => (s.winner !== null ? [] : ([1, 2] as Seat[]).filter((seat) => s.guesses[seat - 1].length === s.round)),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    check(state.guesses[seat - 1].length === state.round, "Waiting for your rival to finish this round.");
    const code = Array.isArray(move?.code) ? move.code.map(Number) : [];
    check(code.length === CODE_LENGTH && code.every((c) => Number.isInteger(c) && c >= 0 && c < CODE_COLORS), "Pick 4 colors.");
    check(new Set(code).size === CODE_LENGTH, "Each color can only be used once.");
    const s = clone(state);
    s.guesses[seat - 1].push({ code, ...feedback(s.secrets[seat - 1], code) });
    if (s.guesses[0].length > s.round && s.guesses[1].length > s.round) {
      s.round++;
      const a = solved(s.guesses[0]), b = solved(s.guesses[1]);
      if (a || b) s.winner = a && b ? 0 : a ? 1 : 2;
      else if (s.round >= CODE_ROUNDS) {
        // Nobody cracked it: closest final guess wins.
        const score = (g: Guess[]) => { const x = g[g.length - 1]; return x.exact * 2 + x.near; };
        const [x, y] = [score(s.guesses[0]), score(s.guesses[1])];
        s.winner = x === y ? 0 : x > y ? 1 : 2;
      }
    }
    return s;
  },
  view(s, seat) {
    const them = other(seat);
    const mine = s.guesses[seat - 1];
    // During a round, hide the rival's newest guess until both have played it.
    const theirs = s.guesses[them - 1].slice(0, s.round);
    return {
      round: s.round,
      maxRounds: CODE_ROUNDS,
      winner: s.winner,
      myGuesses: mine,
      theirResults: theirs.map((g) => ({ exact: g.exact, near: g.near })),
      waitingForThem: s.winner === null && mine.length > s.round,
      mySecret: s.winner !== null ? s.secrets[seat - 1] : null,
      theirSecret: s.winner !== null ? s.secrets[them - 1] : null,
    };
  },
  ai(s, seat, level) {
    const history = s.guesses[seat - 1];
    const consistent = ALL_CODES.filter((code) => history.every((g) => { const f = feedback(code, g.code); return f.exact === g.exact && f.near === g.near; }));
    if (!consistent.length) return { code: randomCode() };
    if (level === 1) return { code: Math.random() < 0.55 ? pick(consistent) : randomCode() };
    if (level === 2 || consistent.length > 120) return { code: pick(consistent) };
    // Level 3: choose the guess that splits the remaining possibilities best.
    let best = consistent[0], bestWorst = Infinity;
    for (const guess of consistent) {
      const buckets = new Map<string, number>();
      for (const code of consistent) { const f = feedback(code, guess); const key = f.exact + ":" + f.near; buckets.set(key, (buckets.get(key) || 0) + 1); }
      const worst = Math.max(...buckets.values());
      if (worst < bestWorst || (worst === bestWorst && Math.random() < 0.3)) { bestWorst = worst; best = guess; }
    }
    return { code: best };
  },
};
