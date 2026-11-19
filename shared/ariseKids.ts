// Arise Kids: the Arise AAC app's home, apps and sticker screens (client/src/pages/arise-kids/KidsApp.tsx),
// drawn exactly like the prototype the owner chose (Nov 18, 2026): a bento Home, TV-style Apps shelves,
// a Sticker Album, and two games: Card Quest (one card at a time) and Pick It! (two big boxes and a moving
// highlight, so one tap or one switch press picks). The data and rules live here so they can be tested.

export type KidsSticker = { name: string; bg: string; d: string };
export type KidsCard = { kicker: string; title: string; hint: string; d: string;
  /** A letter to trace with a finger on the card (TRACE_LETTERS). */ trace?: keyof typeof TRACE_LETTERS;
  /** What the sound button says, when it isn't the title and hint. */ say?: string };
export type KidsDeck = { id: string; name: string; bg: string; cards: KidsCard[] };
export type KidsOption = { label: string; fill: string; d: string };
export type KidsQuestion = { q: string; right: number; opts: [KidsOption, KidsOption] };

export const STICKERS: KidsSticker[] = [
  { name: "Cat", bg: "#ffd2c4", d: "M5 9 7 3l4 4h2l4-4 2 6v5a7 7 0 0 1-14 0zM9.5 12h.01M14.5 12h.01M11 15h2" },
  { name: "Fish", bg: "#c6e8fa", d: "M3 12c3-5 10-6 14-2l4-3v10l-4-3c-4 4-11 3-14-2zM8 11h.01" },
  { name: "Bird", bg: "#fff0a8", d: "M4 14c0-5 4-8 9-8 2 0 4 1 5 3l3 1-3 1c0 5-4 8-9 8l-5 1 2-3c-1-1-2-2-2-3zM14 9h.01" },
  { name: "Frog", bg: "#c9f0c4", d: "M4 15c0-4 3-6 8-6s8 2 8 6-3 5-8 5-8-1-8-5zM7 9a2 2 0 1 1 4 0M13 9a2 2 0 1 1 4 0" },
  { name: "Bug", bg: "#ffd6ec", d: "M12 6a6 7 0 1 1 0 14 6 7 0 0 1 0-14zM12 6v14M9 3l1.5 3M15 3l-1.5 3" },
  { name: "Bear", bg: "#f1dcc4", d: "M6 7a2 2 0 1 1 3-1M18 7a2 2 0 1 0-3-1M5 13a7 7 0 1 0 14 0 7 7 0 0 0-14 0zM10 12h.01M14 12h.01M11 15h2" },
  { name: "Star", bg: "#fff0a8", d: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" },
  { name: "Rocket", bg: "#d9cfff", d: "M12 2c3 2 5 6 5 10l-2 4H9l-2-4c0-4 2-8 5-10zM12 9h.01M9 16l-2 4M15 16l2 4" },
  { name: "Sun", bg: "#ffe3a1", d: "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM12 2v3M12 19v3M2 12h3M19 12h3" },
  { name: "Heart", bg: "#ffc9de", d: "M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" },
  { name: "Rainbow", bg: "#c6e8fa", d: "M3 18a9 9 0 0 1 18 0M6.5 18a5.5 5.5 0 0 1 11 0M10 18a2 2 0 0 1 4 0" },
  { name: "Crown", bg: "#ffe08a", d: "M3 8l4 4 5-7 5 7 4-4-2 11H5z" },
];

/** Letters to trace: their strokes as lines on a 24 by 24 grid (the same grid as the card's pictures). */
export const TRACE_LETTERS = {
  A: [[5, 21, 12, 3], [12, 3, 19, 21], [8, 14, 16, 14]] as [number, number, number, number][],
};
export type TracePoint = { x: number; y: number };

const segDist = (p: TracePoint, [x1, y1, x2, y2]: [number, number, number, number]) => {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((p.x - x1) * dx + (p.y - y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (x1 + t * dx), p.y - (y1 + t * dy));
};

/** How well a finger followed a letter: how much of the letter it went over (coverage), how much of the
 *  drawing stayed on the letter (accuracy), and whether that's enough to count. Generous, for small hands
 *  and children who find fine movement hard: within about 2.5 squares of the line counts. */
export function traceScore(points: TracePoint[], letter: keyof typeof TRACE_LETTERS): { coverage: number; accuracy: number; done: boolean } {
  const segs = TRACE_LETTERS[letter];
  if (!points.length) return { coverage: 0, accuracy: 0, done: false };
  const near = (a: TracePoint, b: TracePoint, r: number) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= r * r;
  // Every stroke has to be traced (a short one like A's bar too), so each is checked on its own.
  let samples = 0, covered = 0, everyStroke = true;
  for (const [x1, y1, x2, y2] of segs) {
    const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 0.75));
    let hit = 0;
    for (let i = 0; i <= n; i++) {
      const s = { x: x1 + (x2 - x1) * i / n, y: y1 + (y2 - y1) * i / n };
      if (points.some((p) => near(s, p, 2.5))) hit++;
    }
    samples += n + 1; covered += hit;
    if (hit / (n + 1) < 0.7) everyStroke = false;
  }
  const onLetter = points.filter((p) => segs.some((seg) => segDist(p, seg) <= 3)).length;
  const coverage = covered / samples, accuracy = onLetter / points.length;
  return { coverage, accuracy, done: everyStroke && coverage >= 0.8 && accuracy >= 0.65 };
}

export const DECKS: Record<"letters" | "numbers" | "moves", KidsDeck> = {
  letters: { id: "letters", name: "Letters", bg: "#6e5ce1", cards: [
    { kicker: "WRITE", title: "Trace the letter A", hint: "Start at the yellow dot and follow the dots", d: "M5 21 12 3l7 18M8 14h8", trace: "A" },
    { kicker: "SAY", title: "Say “b… b… ball”", hint: "Tap the sound button to hear it", say: "b… b… ball. Now you say it: ball!", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c-4 3-4 15 0 18" },
    { kicker: "FIND", title: "Find something red", hint: "Show a grown-up", d: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" },
  ] },
  numbers: { id: "numbers", name: "Numbers", bg: "#e0663a", cards: [
    { kicker: "COUNT", title: "Count 5 things", hint: "Touch each one as you count", d: "M5 12h14M12 5v14" },
    { kicker: "SHOW", title: "Hold up 3 fingers", hint: "One, two, three!", d: "M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-12 0v-2" },
    { kicker: "CLAP", title: "Clap 4 times", hint: "Count out loud", d: "M9 11 5 7M12 9 9 5M15 9l1-4M7 21l-3-6 6-2 6 4 2 4" },
  ] },
  moves: { id: "moves", name: "Moves", bg: "#1f9e7a", cards: [
    { kicker: "MOVE", title: "Do 5 star jumps", hint: "Arms up high!", d: "M12 4.5a2 2 0 1 0 0-.01M12 7v7M12 9l-6-3M12 9l6-3M12 14l-4 7M12 14l4 7" },
    { kicker: "STRETCH", title: "Touch your toes", hint: "Slow and gentle", d: "M12 4.5a2 2 0 1 0 0-.01M12 7l-2 6 4 7M10 13l-4 7" },
    { kicker: "BREATHE", title: "Smell the flower, blow the candle", hint: "Breathe in… and out", d: "M12 21v-8M12 13a4 4 0 1 1 0-8 4 4 0 0 1 0 8zM8 21h8" },
  ] },
};
export type DeckId = keyof typeof DECKS;

export const QUESTIONS: KidsQuestion[] = [
  { q: "Which one says “meow”?", right: 0, opts: [
    { label: "Cat", fill: "none", d: "M5 9 7 3l4 4h2l4-4 2 6v5a7 7 0 0 1-14 0zM9.5 12h.01M14.5 12h.01M11 15h2" },
    { label: "Dog", fill: "none", d: "M5 8 3 4l5 1M19 8l2-4-5 1M6 9a6 6 0 0 1 12 0v4a6 6 0 0 1-12 0zM10 11h.01M14 11h.01M11 15h2" }] },
  { q: "Which one is red?", right: 1, opts: [
    { label: "Leaf", fill: "#2fa84f", d: "M5 19C5 10 11 4 20 4c0 9-6 15-15 15zM5 19 13 11" },
    { label: "Apple", fill: "#e8352b", d: "M12 7c-4-2-8 1-8 6s3 9 5 9c1 0 2-.5 3-.5s2 .5 3 .5c2 0 5-4 5-9s-4-8-8-6zM12 7c0-2 1-4 3-5" }] },
  { q: "Which one is big?", right: 0, opts: [
    { label: "Big", fill: "#2f6fe0", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" },
    { label: "Small", fill: "#2f6fe0", d: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" }] },
];

export const MOODS = [
  { name: "Happy", bg: "#ffe066", d: "M8 14s1.5 2 4 2 4-2 4-2M9 9.5h.01M15 9.5h.01" },
  { name: "Sad", bg: "#9fd3ff", d: "M8 16s1.5-2 4-2 4 2 4 2M9 9.5h.01M15 9.5h.01" },
  { name: "Angry", bg: "#ff9f9f", d: "M8 16h8M8 9l2 1M16 9l-2 1" },
  { name: "Tired", bg: "#d6ccff", d: "M9 15h6M8 10h2M14 10h2" },
] as const;
export const moodReply = (mood: string) => mood === "Happy" ? "Yay! Thanks for telling me." : "Thanks for telling me. Want to try Calm Moves?";

export const WORDS = ["jump", "happy", "big", "run", "red", "help", "more", "play", "sun", "eat", "go", "friend", "sleep", "water"];
/** The word of the day: the same all day, a new one each day. */
export function wordOfDay(date: string): string {
  const n = Math.floor(Date.parse(date + "T12:00:00Z") / 86_400_000);
  return WORDS[((n % WORDS.length) + WORDS.length) % WORDS.length];
}

/** The next sticker to win (the first one not won yet); when all are won, the last one again. */
export function nextSticker(won: number[]): number {
  for (let i = 0; i < STICKERS.length; i++) if (!won.includes(i)) return i;
  return STICKERS.length - 1;
}
export function winSticker(won: number[]): { won: number[]; sticker: number } {
  const sticker = nextSticker(won);
  return { won: won.includes(sticker) ? won : [...won, sticker], sticker };
}

const dayBefore = (d: string) => new Date(Date.parse(d + "T12:00:00Z") - 86_400_000).toISOString().slice(0, 10);
/** Days in a row the child opened the app, ending today (or yesterday, so the morning doesn't read 0). */
export function streak(days: string[], today: string): number {
  const set = new Set(days);
  let d = set.has(today) ? today : dayBefore(today);
  let n = 0;
  while (set.has(d)) { n++; d = dayBefore(d); }
  return n;
}
/** The four marks under the streak: they fill one by one and start again every four days. */
export const streakMarks = (n: number) => (n <= 0 ? 0 : ((n - 1) % 4) + 1);

/** The Pick It! highlight: a pick picks the box that's lit; after a right answer the next tap goes on
 *  (and the last right answer wins a sticker); after a wrong one the next tap tries again. */
export function pickStep(state: { q: number; on: number; picked: number | null }): { q: number; on: number; picked: number | null; win: boolean } {
  const question = QUESTIONS[state.q % QUESTIONS.length];
  if (state.picked === null) return { ...state, picked: state.on, win: false };
  if (state.picked !== question.right) return { ...state, picked: null, win: false };
  const last = state.q % QUESTIONS.length === QUESTIONS.length - 1;
  return { q: last ? 0 : state.q + 1, on: 0, picked: null, win: last };
}

/** Card Quest: "I did it" on the last card wins a sticker and starts the deck again; "Later" skips ahead. */
export function cardStep(deck: DeckId, index: number, done: boolean): { index: number; win: boolean } {
  const n = DECKS[deck].cards.length;
  const i = index % n;
  if (done && i === n - 1) return { index: 0, win: true };
  return { index: (i + 1) % n, win: false };
}

/** Everything that was in Arise AAC before, as tiles on the Apps shelves (each still opens its own page,
 *  and a grown-up's choices still decide which ones show). */
export type KidsTile = { name: string; bg: string; d: string; path?: string; game?: "cards" | "pick" | "stickers"; deck?: DeckId; allow?: string };
export type KidsShelf = { name: string; tiles: KidsTile[] };
export const SHELVES: KidsShelf[] = [
  { name: "Games", tiles: [
    { name: "Card Quest", bg: "#ffd34d", d: "M4 6h12v14H4zM8 2h12v14", game: "cards", deck: "letters" },
    { name: "Pick It!", bg: "#9de0f5", d: "M4 4h16v7H4zM4 13h16v7H4z", game: "pick" },
    { name: "Sticker Album", bg: "#c7f09a", d: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z", game: "stickers" },
    { name: "Eye-gaze games", bg: "#ffb3a1", d: "M4 9h16v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM8 13h3M9.5 11.5v3M15 13h.01M17 15h.01", path: "/eye-gaze-games" },
    { name: "Fidget Lab", bg: "#d9cfff", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", path: "/eye-gaze-fidgets", allow: "/eye-gaze-games" },
    { name: "Farm World", bg: "#c7f09a", d: "M3 21V10l9-6 9 6v11zM9 21v-6h6v6", path: "/eye-gaze-farm", allow: "/eye-gaze-games" },
    { name: "Reading Level Up", bg: "#ffe3a1", d: "M4 19.5V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2.5zM12 7v6M9 10l3-3 3 3", path: "/reading-level-up", allow: "/eye-gaze-games" },
  ] },
  { name: "Card decks", tiles: [
    { name: "Letters", bg: "#d9cfff", d: "M5 21 12 3l7 18M8 14h8", game: "cards", deck: "letters" },
    { name: "Numbers", bg: "#ffb3a1", d: "M5 12h14M12 5v14", game: "cards", deck: "numbers" },
    { name: "Calm Moves", bg: "#b8ecd8", d: "M3 12h4l3-8 4 16 3-8h4", game: "cards", deck: "moves" },
  ] },
  { name: "Talk", tiles: [
    { name: "My Talker", bg: "#d9cfff", d: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z", path: "/eye-gaze-talker" },
    { name: "Wren", bg: "#ffc9de", d: "M4 14c0-5 4-8 9-8 2 0 4 1 5 3l3 1-3 1c0 5-4 8-9 8l-5 1 2-3c-1-1-2-2-2-3zM14 9h.01", path: "/eye-gaze-wren", allow: "/eye-gaze-talker" },
    { name: "My Buddy", bg: "#ffe3a1", d: "M5 8 3 4l5 1M19 8l2-4-5 1M6 9a6 6 0 0 1 12 0v4a6 6 0 0 1-12 0zM10 11h.01M14 11h.01M11 15h2", path: "/eye-gaze-buddy" },
  ] },
  { name: "Watch", tiles: [
    { name: "Shorts", bg: "#9de0f5", d: "M3 6h18v12H3zM10 9.5v5l4.5-2.5z", path: "/eye-gaze-tv" },
  ] },
  { name: "Learn", tiles: [
    { name: "Lessons & books", bg: "#9de0f5", d: "M4 19.5V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2.5z", path: "/eye-gaze-lessons", allow: "/library" },
    { name: "Flash Cards", bg: "#ffd34d", d: "M3 7h14v12H3zM7 3h14v12", path: "/eye-gaze-flashcards" },
    { name: "Life Skills", bg: "#c7f09a", d: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9", path: "/eye-gaze-life-skills" },
    { name: "Potty Coach", bg: "#b8ecd8", d: "M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z", path: "/eye-gaze-potty", allow: "/eye-gaze-life-skills" },
    { name: "My World", bg: "#ffb3a1", d: "M3 11 12 4l9 7v9H3z", path: "/my-world" },
  ] },
  { name: "Me", tiles: [
    { name: "My Stars", bg: "#ffe3a1", d: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z", path: "/leaderboard" },
    { name: "My Profile", bg: "#d9cfff", d: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0", path: "/profile" },
  ] },
];

/** The shelves a child sees: a tile that opens a page shows only when a grown-up allows that page. */
export function visibleShelves(allowed: (path: string) => boolean): KidsShelf[] {
  return SHELVES.map((s) => ({ ...s, tiles: s.tiles.filter((t) => !t.path || allowed(t.allow ?? t.path)) })).filter((s) => s.tiles.length);
}
