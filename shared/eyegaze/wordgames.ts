// Eye-gazer word games — content and rules for Match Pairs, Word Pop and Sentence Train.
// Pure TypeScript (no DOM / three.js) so the games and the tests share it.

export type Pic = { word: string; emoji: string };
const P = (word: string, emoji: string): Pic => ({ word, emoji });

// ── Match Pairs ──
export type MatchSet = { id: string; name: string; emoji: string; pairs: Pic[] };
export const MATCH_SETS: MatchSet[] = [
  { id: "pets", name: "Pets", emoji: "🐶", pairs: [P("cat", "🐱"), P("dog", "🐶"), P("fish", "🐟"), P("bird", "🐦"), P("bunny", "🐰"), P("turtle", "🐢")] },
  { id: "farm", name: "Farm", emoji: "🐮", pairs: [P("cow", "🐮"), P("pig", "🐷"), P("hen", "🐔"), P("horse", "🐴"), P("sheep", "🐑"), P("duck", "🦆")] },
  { id: "food", name: "Yummy Food", emoji: "🍎", pairs: [P("apple", "🍎"), P("cake", "🎂"), P("milk", "🥛"), P("egg", "🥚"), P("pizza", "🍕"), P("corn", "🌽")] },
  { id: "toys", name: "Toys", emoji: "🧸", pairs: [P("ball", "⚽"), P("bear", "🧸"), P("kite", "🪁"), P("drum", "🥁"), P("car", "🚗"), P("robot", "🤖")] },
  { id: "nature", name: "Outside", emoji: "🌳", pairs: [P("sun", "☀️"), P("moon", "🌙"), P("tree", "🌳"), P("star", "⭐"), P("rain", "🌧️"), P("flower", "🌸")] },
  { id: "go", name: "Things That Go", emoji: "🚌", pairs: [P("bus", "🚌"), P("boat", "⛵"), P("train", "🚂"), P("plane", "✈️"), P("bike", "🚲"), P("truck", "🚚")] },
  { id: "school", name: "School", emoji: "📘", pairs: [P("book", "📘"), P("pen", "🖊️"), P("bag", "🎒"), P("bus", "🚌"), P("paint", "🎨"), P("clock", "⏰")] },
  { id: "home", name: "At Home", emoji: "🏠", pairs: [P("bed", "🛏️"), P("cup", "☕"), P("key", "🔑"), P("door", "🚪"), P("lamp", "💡"), P("chair", "🪑")] },
];
export type MatchCard = { id: string; pair: string; kind: "word" | "picture"; pic: Pic; faceUp: boolean; matched: boolean };
export type MatchEvent = { t: "flip" | "match" | "nomatch" | "hide" | "win"; a?: string; b?: string; pair?: string };

function rng(seed: number) { let s = (seed >>> 0) || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function shuffle<T>(a: T[], r: () => number) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Word ↔ picture matching. "look" mode: every card face up — pick a word, then its picture (or the other way).
 *  "memory" mode: cards face down; flip two at a time. */
export class MatchGame {
  cards: MatchCard[]; first: string | null = null; moves = 0; misses = 0; locked = false;
  constructor(public set: MatchSet, public pairs: number, public mode: "look" | "memory", seed = Date.now()) {
    const r = rng(seed);
    const pics = shuffle([...set.pairs], r).slice(0, Math.min(pairs, set.pairs.length));
    this.cards = shuffle(pics.flatMap(p => [
      { id: p.word + "-w", pair: p.word, kind: "word" as const, pic: p, faceUp: mode === "look", matched: false },
      { id: p.word + "-p", pair: p.word, kind: "picture" as const, pic: p, faceUp: mode === "look", matched: false },
    ]), r);
  }
  get done() { return this.cards.every(c => c.matched); }
  card(id: string) { return this.cards.find(c => c.id === id)!; }
  canSelect(id: string) { const c = this.card(id); return !this.locked && !!c && !c.matched && id !== this.first; }
  /** Pick a card. Returns what happened; after a "nomatch" in memory mode call hideMismatch() once the player has seen it. */
  select(id: string): MatchEvent[] {
    if (!this.canSelect(id)) return [];
    const c = this.card(id); const ev: MatchEvent[] = [];
    if (!c.faceUp) { c.faceUp = true; ev.push({ t: "flip", a: id }); }
    if (!this.first) { this.first = id; return ev; }
    const a = this.card(this.first); this.moves++;
    if (a.pair === c.pair && a.kind !== c.kind) {
      a.matched = c.matched = true; ev.push({ t: "match", a: a.id, b: c.id, pair: c.pair }); this.first = null;
      if (this.done) ev.push({ t: "win" });
    } else {
      this.misses++; ev.push({ t: "nomatch", a: a.id, b: c.id });
      if (this.mode === "memory") this.locked = true; else this.first = null;
    }
    return ev;
  }
  hideMismatch(): MatchEvent[] {
    if (!this.locked) return [];
    const ev: MatchEvent[] = [];
    for (const c of this.cards) if (c.faceUp && !c.matched) { c.faceUp = false; ev.push({ t: "hide", a: c.id }); }
    this.first = null; this.locked = false; return ev;
  }
  stars() { const extra = this.misses; return extra <= Math.ceil(this.pairs * 0.25) ? 3 : extra <= this.pairs ? 2 : 1; }
}

// ── Word Pop ──
export type PopRound = { target: string; emoji: string; choices: string[] };
const R = (target: string, emoji: string, ...others: string[]): PopRound => ({ target, emoji, choices: [target, ...others] });
export const POP_LEVELS: { name: string; emoji: string; rounds: PopRound[] }[] = [
  { name: "First Words", emoji: "🐱", rounds: [R("cat", "🐱", "cap", "can", "car"), R("dog", "🐶", "dot", "dig", "log"), R("sun", "☀️", "run", "fun", "bun"), R("bed", "🛏️", "red", "bad", "bud"), R("pig", "🐷", "big", "dig", "peg"), R("hat", "🎩", "hot", "cat", "hit")] },
  { name: "Look Closely", emoji: "🔎", rounds: [R("book", "📘", "look", "cook", "hook"), R("ball", "⚽", "bell", "bull", "tall"), R("fish", "🐟", "dish", "wish", "fist"), R("frog", "🐸", "from", "flag", "fog"), R("cake", "🎂", "make", "lake", "cape"), R("moon", "🌙", "moan", "noon", "mood")] },
  { name: "Sight Words", emoji: "⭐", rounds: [R("the", "👉", "then", "she", "they"), R("and", "➕", "an", "end", "hand"), R("you", "🫵", "your", "yes", "one"), R("see", "👀", "sea", "she", "bee"), R("can", "💪", "con", "fan", "cane"), R("go", "🏃", "to", "no", "got")] },
  { name: "Big Words", emoji: "🦒", rounds: [R("apple", "🍎", "apply", "ample", "maple"), R("train", "🚂", "rain", "trail", "brain"), R("house", "🏠", "horse", "mouse", "hose"), R("plane", "✈️", "plant", "plan", "lane"), R("happy", "😊", "hippo", "puppy", "hope"), R("water", "💧", "waiter", "later", "winter")] },
];
export function popBubbles(round: PopRound, seed = Date.now()) { return shuffle([...round.choices], rng(seed)); }

// ── Sentence Train ──
export type Sentence = { picture: string; words: string[]; extra: string[] };
const S = (picture: string, sentence: string, ...extra: string[]): Sentence => ({ picture, words: sentence.toUpperCase().split(" "), extra: extra.map(e => e.toUpperCase()) });
export const SENTENCES: Sentence[] = [
  S("🐶", "the dog runs", "blue", "eats"), S("🐱", "the cat sleeps", "jumps", "green"), S("👧📘", "she reads a book", "dog", "fast"),
  S("🐦🌳", "the bird is in the tree", "car", "sad"), S("🐟💧", "the fish can swim", "fly", "red"), S("☀️", "the sun is hot", "cold", "dog"),
  S("🐸", "a frog can jump", "sing", "bed"), S("🍎", "i like red apples", "blue", "run"), S("🚌", "the bus is big", "small", "hat"),
  S("🌧️", "it is raining", "sunny", "cake"), S("🐮🥛", "the cow gives milk", "eggs", "sky"), S("👦⚽", "he kicks the ball", "she", "eats"),
  S("🌙⭐", "the moon is up", "down", "fish"), S("🐝🌸", "the bee likes flowers", "cars", "swims"), S("🎂🎉", "we eat the cake", "drink", "tree"),
  S("🐻💤", "the bear is sleeping", "dancing", "car"), S("🚀", "the rocket goes up", "down", "pig"), S("🦆💧", "ducks swim in water", "fly", "sand"),
];
/** The word tiles for a sentence: every word (duplicates kept) plus the extra words, shuffled. */
export function sentenceTiles(s: Sentence, seed = Date.now()) {
  return shuffle([...s.words, ...s.extra].map((w, i) => ({ id: `${w}-${i}`, word: w })), rng(seed));
}
/** Is this word the next one in the sentence? */
export const isNextWord = (s: Sentence, placed: number, word: string) => placed < s.words.length && s.words[placed] === word;
