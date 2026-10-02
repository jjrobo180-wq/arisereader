import { type ArcadeEngine, type Outcome, type Seat, check, clone, intField, other, pick, shuffle } from "../core";

// Cards are numbers 0..51: suit = floor(id / 13) (♠ ♥ ♦ ♣), rank = id % 13 + 1 (A=1 … K=13).
export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANK_LABELS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const suitOf = (card: number) => Math.floor(card / 13);
export const rankOf = (card: number) => (card % 13) + 1;
export const freshDeck = () => shuffle(Array.from({ length: 52 }, (_, i) => i));

// ─── Crazy Eights ────────────────────────────────────────────────────────────
export type EightsState = {
  stock: number[];
  discard: number[];
  hands: [number[], number[]];
  turn: Seat;
  winner: Outcome;
  suit: number; // suit that must be matched (an 8 can change it)
  drew: boolean; // current player already drew this turn
  drawnCard: number | null;
  stuck: number; // turns in a row nobody could play or draw
  last: { seat: Seat; action: "play" | "draw" | "pass"; card?: number; suit?: number } | null;
};
export type EightsMove = { type: "play"; card: number; suit?: number } | { type: "draw" } | { type: "pass" };

const topCard = (s: EightsState) => s.discard[s.discard.length - 1];
export function canPlay(s: Pick<EightsState, "discard" | "suit">, card: number): boolean {
  const t = s.discard[s.discard.length - 1];
  return rankOf(card) === 8 || suitOf(card) === s.suit || rankOf(card) === rankOf(t);
}
function drawCard(s: EightsState): number | null {
  if (!s.stock.length && s.discard.length > 1) {
    const keep = s.discard.pop()!;
    s.stock = shuffle(s.discard);
    s.discard = [keep];
  }
  return s.stock.length ? s.stock.pop()! : null;
}
function finishByCount(s: EightsState) {
  const [a, b] = [s.hands[0].length, s.hands[1].length];
  s.winner = a === b ? 0 : a < b ? 1 : 2;
}
function endTurn(s: EightsState, seat: Seat) {
  s.turn = other(seat);
  s.drew = false;
  s.drawnCard = null;
}
const bestSuit = (hand: readonly number[]) => {
  const counts = [0, 0, 0, 0];
  for (const c of hand) if (rankOf(c) !== 8) counts[suitOf(c)]++;
  return counts.indexOf(Math.max(...counts));
};

export const crazyeights: ArcadeEngine<EightsState, EightsMove> = {
  id: "eights",
  init() {
    const deck = freshDeck();
    const hands: [number[], number[]] = [deck.splice(0, 7), deck.splice(0, 7)];
    let first = deck.pop()!;
    while (rankOf(first) === 8) { deck.unshift(first); first = deck.pop()!; }
    return { stock: deck, discard: [first], hands, turn: 1, winner: null, suit: suitOf(first), drew: false, drawnCard: null, stuck: 0, last: null };
  },
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    check(state.turn === seat, "Wait for your turn.");
    const s = clone(state);
    const hand = s.hands[seat - 1];
    if (move?.type === "play") {
      const card = intField((move as any).card, 0, 51, "Choose a card.");
      check(hand.includes(card), "That card is not in your hand.");
      check(!s.drew || card === s.drawnCard, "Play the card you just drew, or pass.");
      check(canPlay(s, card), "That card does not match the suit or number.");
      let suit = suitOf(card);
      if (rankOf(card) === 8) suit = intField((move as any).suit, 0, 3, "Pick a suit for your 8.");
      hand.splice(hand.indexOf(card), 1);
      s.discard.push(card);
      s.suit = suit;
      s.stuck = 0;
      s.last = { seat, action: "play", card, suit };
      if (!hand.length) { s.winner = seat; return s; }
      endTurn(s, seat);
      return s;
    }
    if (move?.type === "draw") {
      check(!s.drew, "You already drew a card.");
      check(!hand.some((c) => canPlay(s, c)), "You have a card you can play.");
      const card = drawCard(s);
      s.last = { seat, action: "draw" };
      if (card === null) {
        // Nothing left to draw: pass. If both players are stuck, fewest cards wins.
        s.stuck++;
        if (s.stuck >= 2) finishByCount(s);
        else endTurn(s, seat);
        return s;
      }
      hand.push(card);
      if (canPlay(s, card)) { s.drew = true; s.drawnCard = card; }
      else endTurn(s, seat);
      return s;
    }
    check(move?.type === "pass", "Play a card or draw.");
    check(s.drew, "Draw a card first.");
    s.last = { seat, action: "pass" };
    endTurn(s, seat);
    return s;
  },
  view(s, seat) {
    const mine = s.hands[seat - 1];
    const myTurn = s.winner === null && s.turn === seat;
    return {
      hand: mine.slice().sort((a, b) => suitOf(a) - suitOf(b) || rankOf(a) - rankOf(b)),
      theirCount: s.hands[other(seat) - 1].length,
      top: topCard(s),
      suit: s.suit,
      stock: s.stock.length,
      turn: s.turn,
      winner: s.winner,
      drew: myTurn ? s.drew : false,
      drawnCard: myTurn ? s.drawnCard : null,
      playable: myTurn ? mine.filter((c) => (!s.drew || c === s.drawnCard) && canPlay(s, c)) : [],
      last: s.last,
      theirHand: s.winner !== null ? s.hands[other(seat) - 1] : undefined,
    };
  },
  ai(s, seat, level) {
    const hand = s.hands[seat - 1];
    if (s.drew) {
      const card = s.drawnCard!;
      if (rankOf(card) === 8) return { type: "play", card, suit: bestSuit(hand.filter((c) => c !== card)) };
      return { type: "play", card };
    }
    const playable = hand.filter((c) => canPlay(s, c));
    if (!playable.length) return { type: "draw" };
    if (level === 1) {
      const card = pick(playable);
      return rankOf(card) === 8 ? { type: "play", card, suit: pick([0, 1, 2, 3]) } : { type: "play", card };
    }
    const nonEights = playable.filter((c) => rankOf(c) !== 8);
    const counts = [0, 0, 0, 0];
    for (const c of hand) if (rankOf(c) !== 8) counts[suitOf(c)]++;
    const opponentCards = s.hands[other(seat) - 1].length;
    if (nonEights.length) {
      // Play into the suit we hold most of; level 3 also dumps high cards first.
      nonEights.sort((a, b) => counts[suitOf(b)] - counts[suitOf(a)] || (level === 3 ? rankOf(b) - rankOf(a) : 0));
      // Level 3 keeps an 8 for later unless the opponent is about to go out.
      if (!(level === 3 && opponentCards <= 2 && playable.length > nonEights.length)) return { type: "play", card: nonEights[0] };
    }
    const eight = playable.find((c) => rankOf(c) === 8)!;
    return { type: "play", card: eight, suit: bestSuit(hand.filter((c) => c !== eight)) };
  },
};

// ─── Go Fish ─────────────────────────────────────────────────────────────────
export type FishEvent = { seat: Seat; rank: number; got: number; fished: "match" | "miss" | "none" | null; book: number | null };
export type FishState = {
  stock: number[];
  hands: [number[], number[]];
  books: [number[], number[]];
  turn: Seat;
  winner: Outcome;
  history: FishEvent[];
};

/** Lays down any complete set of four. Returns the last rank booked, if any. */
function takeBooks(s: FishState, seat: Seat): number | null {
  let made: number | null = null;
  for (let rank = 1; rank <= 13; rank++) {
    const hand = s.hands[seat - 1];
    if (hand.filter((c) => rankOf(c) === rank).length === 4) {
      s.hands[seat - 1] = hand.filter((c) => rankOf(c) !== rank);
      s.books[seat - 1].push(rank);
      made = rank;
    }
  }
  return made;
}
/** Handles empty hands: draw if possible, otherwise pass; ends the game when nothing is left. */
function settleFish(s: FishState): void {
  for (let guard = 0; guard < 6; guard++) {
    if (s.books[0].length + s.books[1].length === 13 || (!s.stock.length && !s.hands[0].length && !s.hands[1].length)) {
      const [a, b] = [s.books[0].length, s.books[1].length];
      s.winner = a === b ? 0 : a > b ? 1 : 2;
      return;
    }
    const hand = s.hands[s.turn - 1];
    if (hand.length) return;
    if (s.stock.length) { hand.push(s.stock.pop()!); takeBooks(s, s.turn); continue; }
    s.turn = other(s.turn);
  }
}

export const gofish: ArcadeEngine<FishState, { rank: number }> = {
  id: "gofish",
  init() {
    const deck = freshDeck();
    const s: FishState = { stock: deck, hands: [deck.splice(0, 7), deck.splice(0, 7)], books: [[], []], turn: 1, winner: null, history: [] };
    takeBooks(s, 1); takeBooks(s, 2);
    settleFish(s);
    return s;
  },
  toAct: (s) => (s.winner === null ? [s.turn] : []),
  outcome: (s) => s.winner,
  play(state, seat, move) {
    check(state.winner === null, "The game is over.");
    check(state.turn === seat, "Wait for your turn.");
    const rank = intField(move?.rank, 1, 13, "Pick a card rank to ask for.");
    check(state.hands[seat - 1].some((c) => rankOf(c) === rank), "You can only ask for a rank you hold.");
    const s = clone(state);
    const them = other(seat);
    const given = s.hands[them - 1].filter((c) => rankOf(c) === rank);
    const event: FishEvent = { seat, rank, got: given.length, fished: null, book: null };
    if (given.length) {
      s.hands[them - 1] = s.hands[them - 1].filter((c) => rankOf(c) !== rank);
      s.hands[seat - 1].push(...given);
      event.book = takeBooks(s, seat);
    } else if (s.stock.length) {
      const card = s.stock.pop()!;
      s.hands[seat - 1].push(card);
      event.fished = rankOf(card) === rank ? "match" : "miss";
      event.book = takeBooks(s, seat);
      if (event.fished === "miss") s.turn = them;
    } else {
      event.fished = "none";
      s.turn = them;
    }
    s.history = [...s.history, event].slice(-60);
    settleFish(s);
    return s;
  },
  view(s, seat) {
    return {
      hand: s.hands[seat - 1].slice().sort((a, b) => rankOf(a) - rankOf(b) || suitOf(a) - suitOf(b)),
      theirCount: s.hands[other(seat) - 1].length,
      books: s.books,
      stock: s.stock.length,
      turn: s.turn,
      winner: s.winner,
      history: s.history.slice(-6),
    };
  },
  ai(s, seat, level) {
    const hand = s.hands[seat - 1];
    const ranks = Array.from(new Set(hand.map(rankOf)));
    if (level === 1) return { rank: pick(ranks) };
    const them = other(seat);
    // Public memory: ranks the opponent asked for and has not handed over or booked since.
    const likely = new Set<number>();
    for (const e of s.history) {
      if (e.seat === them) likely.add(e.rank);
      if (e.seat === seat && e.got > 0) likely.delete(e.rank);
      if (e.book) likely.delete(e.book);
    }
    if (level === 2 && Math.random() < 0.4) likely.clear();
    const known = ranks.filter((r) => likely.has(r));
    if (known.length) return { rank: pick(known) };
    // Otherwise ask for what we hold most of (level 3 avoids repeating a failed ask).
    const failed = new Set(level === 3 ? s.history.filter((e) => e.seat === seat && e.got === 0).slice(-3).map((e) => e.rank) : []);
    const count = (r: number) => hand.filter((c) => rankOf(c) === r).length;
    const options = ranks.filter((r) => !failed.has(r));
    const pool = options.length ? options : ranks;
    pool.sort((a, b) => count(b) - count(a) + (Math.random() - 0.5) * (level === 3 ? 0.2 : 1.2));
    return { rank: pool[0] };
  },
};

