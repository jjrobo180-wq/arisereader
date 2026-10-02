import { type ArcadeEngine, type Outcome, type Seat, check, clone, intField, other, pick, rand, shuffle } from "../core";

// ─── Memory Match ────────────────────────────────────────────────────────────
const FACES = ["🐶", "🐱", "🦊", "🐼", "🐸", "🦁", "🐵", "🐧", "🦄", "🐙", "🦋", "🐢", "🍎", "🍕", "🍩", "🍓", "🚀", "⚽", "🎸", "🌈", "⭐", "🌵", "🎈", "🍉"];
export const MEMORY_CARDS = 24;

export type MemoryState = {
  cards: string[];
  matched: (0 | 1 | 2)[];
  faceUp: number[];
  peek: number[] | null; // last pair that did not match (shown briefly)
  seen: number[];
  turn: Seat;
  winner: Outcome;
  scores: [number, number];
  last: { seat: Seat; cards: number[]; match: boolean } | null;
};

export const memory: ArcadeEngine<MemoryState, { card: number }> = {
  id: "memory",
  init() {
    const faces = shuffle(FACES).slice(0, MEMORY_CARDS / 2);
    return { cards: shuffle([...faces, ...faces]), matched: Array(MEMORY_CARDS).fill(0), faceUp: [], peek: null, seen: [], turn: 1, winner: null, scores: [0, 0], last: null };
  },
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    check(state.turn === seat, "Wait for your turn.");
    const card = intField(move?.card, 0, MEMORY_CARDS - 1, "Pick a card.");
    check(!state.matched[card], "That pair is already found.");
    check(!state.faceUp.includes(card), "That card is already face up.");
    const s = clone(state);
    if (!s.faceUp.length) s.peek = null;
    s.faceUp.push(card);
    if (!s.seen.includes(card)) s.seen.push(card);
    if (s.faceUp.length < 2) return s;
    const [a, b] = s.faceUp;
    const match = s.cards[a] === s.cards[b];
    s.last = { seat, cards: [a, b], match };
    s.faceUp = [];
    if (match) {
      s.matched[a] = seat; s.matched[b] = seat;
      s.scores[seat - 1]++;
      if (s.matched.every(Boolean)) s.winner = s.scores[0] === s.scores[1] ? 0 : s.scores[0] > s.scores[1] ? 1 : 2;
    } else {
      s.peek = [a, b];
      s.turn = other(seat);
    }
    return s;
  },
  view(s) {
    const shown = new Set<number>([...s.faceUp, ...(s.peek || [])]);
    return {
      cards: s.cards.map((face, i) => (s.matched[i] || shown.has(i) || s.winner !== null ? face : null)),
      matched: s.matched, faceUp: s.faceUp, peek: s.peek, turn: s.turn, winner: s.winner, scores: s.scores, last: s.last,
    };
  },
  ai(s, _seat, level) {
    const recall = level === 1 ? 0.25 : level === 2 ? 0.6 : 0.95;
    const open = s.cards.map((_, i) => i).filter((i) => !s.matched[i] && !s.faceUp.includes(i));
    const remembered = s.seen.filter((i) => !s.matched[i] && !s.faceUp.includes(i) && Math.random() < recall);
    const unseen = open.filter((i) => !s.seen.includes(i));
    if (s.faceUp.length === 1) {
      const first = s.faceUp[0];
      const mate = remembered.find((i) => s.cards[i] === s.cards[first]);
      if (mate !== undefined) return { card: mate };
      const fresh = unseen.filter((i) => i !== first);
      return { card: pick(fresh.length ? fresh : open) };
    }
    for (const i of remembered) {
      const mate = remembered.find((j) => j !== i && s.cards[j] === s.cards[i]);
      if (mate !== undefined) return { card: i };
    }
    return { card: pick(unseen.length ? unseen : open) };
  },
};

// ─── Pig (dice) ──────────────────────────────────────────────────────────────
export const PIG_TARGET = 50;
export type PigState = {
  scores: [number, number];
  turnTotal: number;
  rolls: number[];
  turn: Seat;
  winner: Outcome;
  last: { seat: Seat; action: "roll" | "hold" | "bust"; roll?: number; banked?: number } | null;
};

export const pig: ArcadeEngine<PigState, { type: "roll" | "hold" }> = {
  id: "pig",
  init() {
    return { scores: [0, 0], turnTotal: 0, rolls: [], turn: 1, winner: null, last: null };
  },
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    check(state.turn === seat, "Wait for your turn.");
    const s = clone(state);
    if (move?.type === "hold") {
      check(s.turnTotal > 0, "Roll at least once before you hold.");
      s.scores[seat - 1] += s.turnTotal;
      s.last = { seat, action: "hold", banked: s.turnTotal };
      s.turnTotal = 0;
      s.rolls = [];
      s.turn = other(seat);
      return s;
    }
    check(move?.type === "roll", "Roll or hold.");
    const roll = 1 + rand(6);
    if (roll === 1) {
      s.last = { seat, action: "bust", roll };
      s.turnTotal = 0;
      s.rolls = [];
      s.turn = other(seat);
      return s;
    }
    s.turnTotal += roll;
    s.rolls = [...s.rolls, roll];
    s.last = { seat, action: "roll", roll };
    if (s.scores[seat - 1] + s.turnTotal >= PIG_TARGET) {
      s.scores[seat - 1] += s.turnTotal;
      s.turnTotal = 0;
      s.winner = seat;
    }
    return s;
  },
  view: (s) => s,
  ai(s, seat, level) {
    const mine = s.scores[seat - 1], theirs = s.scores[other(seat) - 1];
    if (s.turnTotal === 0) return { type: "roll" };
    let holdAt: number;
    if (level === 1) holdAt = 8 + rand(10);
    else if (level === 2) holdAt = 20;
    else {
      holdAt = Math.round(19 + (theirs - mine) / 6);
      if (theirs >= PIG_TARGET - 10) holdAt = PIG_TARGET; // they are close: go for the win
      holdAt = Math.max(10, Math.min(PIG_TARGET, holdAt));
    }
    return { type: s.turnTotal >= Math.min(holdAt, PIG_TARGET - mine) ? "hold" : "roll" };
  },
};

// ─── Rock Paper Scissors (first to 3) ────────────────────────────────────────
export type Hand = "rock" | "paper" | "scissors";
const HANDS: Hand[] = ["rock", "paper", "scissors"];
const BEATS: Record<Hand, Hand> = { rock: "scissors", paper: "rock", scissors: "paper" };
const COUNTER: Record<Hand, Hand> = { rock: "paper", paper: "scissors", scissors: "rock" };
export const RPS_TARGET = 3;
export type RpsState = {
  picks: [Hand | null, Hand | null];
  wins: [number, number];
  history: { picks: [Hand, Hand]; winner: 0 | 1 | 2 }[];
  winner: Outcome;
};

export const rps: ArcadeEngine<RpsState, { hand: Hand }> = {
  id: "rps",
  init() {
    return { picks: [null, null], wins: [0, 0], history: [], winner: null };
  },
  toAct: (s) => (s.winner !== null ? [] : ([1, 2] as Seat[]).filter((seat) => !s.picks[seat - 1])),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The match is over.");
    check(!state.picks[seat - 1], "You already picked. Waiting for your opponent.");
    const hand = move?.hand;
    check(HANDS.includes(hand as Hand), "Pick rock, paper, or scissors.");
    const s = clone(state);
    s.picks[seat - 1] = hand;
    if (s.picks[0] && s.picks[1]) {
      const [a, b] = s.picks as [Hand, Hand];
      const winner: 0 | 1 | 2 = a === b ? 0 : BEATS[a] === b ? 1 : 2;
      s.history = [...s.history, { picks: [a, b], winner }];
      if (winner) s.wins[winner - 1]++;
      s.picks = [null, null];
      if (s.wins[0] >= RPS_TARGET) s.winner = 1;
      else if (s.wins[1] >= RPS_TARGET) s.winner = 2;
    }
    return s;
  },
  view(s, seat) {
    return {
      myPick: s.picks[seat - 1],
      theyPicked: !!s.picks[other(seat) - 1],
      wins: s.wins,
      history: s.history,
      winner: s.winner,
    };
  },
  ai(s, seat, level) {
    // Uses only finished rounds: the computer never sees the current pick.
    const theirs = s.history.map((h) => h.picks[other(seat) - 1]);
    if (level === 1 || theirs.length < 2) return { hand: pick(HANDS) };
    if (level === 2) {
      if (Math.random() < 0.45) return { hand: pick(HANDS) };
      const counts = HANDS.map((h) => theirs.filter((x) => x === h).length);
      return { hand: COUNTER[HANDS[counts.indexOf(Math.max(...counts))]] };
    }
    if (Math.random() < 0.25) return { hand: pick(HANDS) };
    // Predict their next hand from what usually follows their last one.
    const lastHand = theirs[theirs.length - 1];
    const follow = HANDS.map((h) => theirs.slice(1).filter((x, i) => theirs[i] === lastHand && x === h).length);
    const predicted = Math.max(...follow) > 0 ? HANDS[follow.indexOf(Math.max(...follow))] : lastHand;
    return { hand: COUNTER[predicted] };
  },
};

