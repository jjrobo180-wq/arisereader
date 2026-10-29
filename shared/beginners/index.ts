// A.R.I.S.E. Beginners, inside A.R.I.S.E. Reader: the whole program as data that the page and the server share.
//
// Beginners is Reader for younger readers (about K–3): the same account, the same leaderboard, the same points and
// the same prizes. It mixes three kinds of practice:
// - phonics and decoding like HD Word: Sound Blast cards, word chains in sound boxes, spelling, heart words,
//   word sorts and decodable stories (curriculum.ts and curriculum2.ts, 18 units);
// - a reading coach like Microsoft Reading Coach: the child reads the story out loud, it's scored word by word
//   (reading.ts), and the missed words become practice;
// - speech practice like Speech Blubs: Ari, the guide, says each word with a moving mouth, and the child says it
//   back while a voice bar fills (sayit.ts has the first-words library).
//
// The server (server/ariseBeginners.ts) keeps the answer key for the story questions, scores every reading
// itself from the recording, and writes points to manual_point_awards, the table every Reader leaderboard reads.
import { UNITS_A, type LessonDef, type UnitDef } from "./curriculum";
import { UNITS_B } from "./curriculum2";
import { CONFUSABLE, KEYS, keyFor, soundsByPart, type Entry } from "./phonics";
import { bareWord, sentencesOf, storyTokens } from "./reading";
import { SAYIT_CATEGORIES } from "./sayit";

export type { Entry } from "./phonics";

/** A word with a part we learn by heart ("said": the ai is the tricky part). */
export type HeartWord = { w: string; show: string; parts: string[]; tricky: number[]; unit: number; lesson: string };
export type Question = { q: string; right: string; wrong: [string, string] };
export type SortDef = { left: string; right: string; leftWords: string[]; rightWords: string[] };
export type Lesson = {
  id: string;
  unit: number;
  /** Position in the whole program, from 0. */
  order: number;
  /** Lesson number inside its unit, from 1. */
  num: number;
  title: string;
  pic: string;
  focus: string[];
  heart: HeartWord[];
  chain: Entry[];
  spell: Entry[];
  sort: SortDef;
  text: string;
  questions: Question[];
  /** Reader points for passing it the first time. */
  points: number;
  /** Parts are syllables or word parts (units 17–18), not single spellings. */
  syll: boolean;
};
export type Unit = Omit<UnitDef, "words" | "hearts" | "lessons"> & { words: Entry[]; hearts: HeartWord[]; lessons: Lesson[] };

/* ------------------------------------------------------------------ parsing the curriculum */

const SYLLABLE_UNIT = 17;

/** "m|a|p:🗺️" → an Entry. A capital letter makes it a name; "=s-o-u-n-d-s" writes the sounds out. */
export function parseEntry(token: string, unit: number): Entry {
  let t = token.trim();
  let snd: string[] | undefined;
  const eq = t.indexOf("=");
  if (eq >= 0) { snd = t.slice(eq + 1).split("-").filter(Boolean); t = t.slice(0, eq); }
  let e = "";
  const colon = t.indexOf(":");
  if (colon >= 0) { e = t.slice(colon + 1); t = t.slice(0, colon); }
  const parts = t.split("|").filter(Boolean);
  const show = parts.join("");
  return { w: show.toLowerCase(), show, parts, unit, e, name: /^[A-Z]/.test(show), syll: unit >= SYLLABLE_UNIT, ...(snd ? { snd } : {}) };
}
const tokensOf = (s: string | undefined) => (s || "").split(/\s+/).filter(Boolean);

function parseHeart(token: string, unit: number): Omit<HeartWord, "lesson"> {
  const [left, marks = ""] = token.split("!");
  const parts = left.split("|").filter(Boolean);
  const show = parts.join("");
  const tricky = marks.split(",").filter((x) => x !== "").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < parts.length);
  return { w: show.toLowerCase(), show, parts, tricky, unit };
}

const RAW_UNITS: UnitDef[] = [...UNITS_A, ...UNITS_B];

/** Every word in every unit's word bank, by lower-case spelling. The first unit that has a word owns it. */
export const WORDS = new Map<string, Entry>();
for (const u of RAW_UNITS) for (const tok of tokensOf(u.words)) {
  const entry = parseEntry(tok, u.n);
  if (!WORDS.has(entry.w)) WORDS.set(entry.w, entry);
}

let order = 0;
export const UNITS: Unit[] = RAW_UNITS.map((u) => {
  const hearts0 = tokensOf(u.hearts).map((t) => parseHeart(t, u.n));
  const lessonOfHeart = (w: string) => u.lessons.find((l) => (l.heart || []).some((h) => h.toLowerCase() === w))?.id || u.lessons[0].id;
  const hearts: HeartWord[] = hearts0.map((h) => ({ ...h, lesson: lessonOfHeart(h.w) }));
  const words = tokensOf(u.words).map((t) => WORDS.get(parseEntry(t, u.n).w)!).filter(Boolean);
  const lessons: Lesson[] = u.lessons.map((l: LessonDef, i: number) => {
    const withPic = (tok: string) => { const e = parseEntry(tok, u.n); const bank = WORDS.get(e.w); return bank ? { ...e, e: e.e || bank.e } : e; };
    return {
      id: l.id, unit: u.n, order: order++, num: i + 1, title: l.title, pic: l.pic, focus: l.focus,
      heart: (l.heart || []).map((w) => hearts.find((h) => h.w === w.toLowerCase())).filter((h): h is HeartWord => !!h),
      chain: tokensOf(l.chain).map(withPic),
      spell: tokensOf(l.spell).map(withPic),
      sort: { left: l.sort[0], right: l.sort[1], leftWords: tokensOf(l.sort[2]), rightWords: tokensOf(l.sort[3]) },
      text: l.text,
      questions: l.q.map(([q, right, w1, w2]) => ({ q, right, wrong: [w1, w2] as [string, string] })),
      points: lessonPoints(u.n),
      syll: u.n >= SYLLABLE_UNIT,
    };
  });
  return { n: u.n, title: u.title, kid: u.kid, skill: u.skill, grade: u.grade, color: u.color, icon: u.icon, graphemes: u.graphemes, words, hearts, lessons };
});
export const LESSONS: Lesson[] = UNITS.flatMap((u) => u.lessons);
const LESSON_BY_ID = new Map(LESSONS.map((l) => [l.id, l]));
export const lessonById = (id: string) => LESSON_BY_ID.get(id) || null;
export const unitOf = (n: number) => UNITS.find((u) => u.n === n) || null;
export const HEARTS: HeartWord[] = UNITS.flatMap((u) => u.hearts);
const HEART_BY_WORD = new Map(HEARTS.map((h) => [h.w, h]));
export const heartWord = (w: string) => HEART_BY_WORD.get(w.toLowerCase()) || null;
/** Every name in the stories (speech-to-text may spell a name its own way). */
export const NAMES = [...WORDS.values()].filter((e) => e.name).map((e) => e.show);

/* ------------------------------------------------------------------ points and stars */

/** Reader points for a lesson's first pass: like a K–2 library book (5), and 10 once words get longer. */
export function lessonPoints(unit: number): number { return unit <= 9 ? 5 : 10; }
export const POINTS = {
  /** Reading the story out loud at 90% or better on the first pass. */
  readBonus: 2,
  /** Passing a lesson again (practice), at most `replaysPerDay` a day. */
  replay: 1,
  replaysPerDay: 5,
  /** Say It Studio: a point for every `sayItWords` words said right, at most `sayItMax` a day. */
  sayItWords: 5,
  sayItMax: 4,
  /** Most Beginners points in one day (Denver time). */
  dailyCap: 40,
};
/** Passing: 2 of the 3 story questions right. */
export const passed = (right: number, total: number) => total > 0 && right / total >= 2 / 3;
/** 1 star for passing, 1 for every question right, 1 for reading the story out loud at 90% or better. */
export function starsFor(o: { right: number; total: number; readAccuracy: number | null }): number {
  if (!passed(o.right, o.total)) return 0;
  return 1 + (o.right === o.total ? 1 : 0) + (o.readAccuracy !== null && o.readAccuracy >= 90 ? 1 : 0);
}

/* ------------------------------------------------------------------ what the child knows at each lesson */

export type Knowledge = { parts: Set<string>; words: Set<string>; hearts: Set<string>; unit: number };

/** The spellings, words and heart words taught up to and including a lesson. */
export function knowledgeAt(lessonId: string): Knowledge {
  const lesson = lessonById(lessonId);
  if (!lesson) throw new Error(`No lesson ${lessonId}`);
  const parts = new Set<string>(), words = new Set<string>(), hearts = new Set<string>();
  const addPart = (g: string) => parts.add(g.replace(/^-/, "").toLowerCase());
  for (const u of UNITS) {
    if (u.n > lesson.unit) break;
    for (const w of u.words) words.add(w.w);
    if (u.n < lesson.unit) {
      u.graphemes.forEach(addPart);
      u.hearts.forEach((h) => hearts.add(h.w));
      continue;
    }
    for (const l of u.lessons) {
      if (l.order > lesson.order) break;
      l.focus.forEach(addPart);
      u.hearts.filter((h) => h.lesson === l.id).forEach((h) => hearts.add(h.w));
    }
  }
  // From the blends unit on, every single letter has been taught.
  if (lesson.unit >= 9) "abcdefghijklmnopqrstuvwxyz".split("").forEach((c) => parts.add(c));
  return { parts, words, hearts, unit: lesson.unit };
}

/** Is a bank word readable with what's been taught (all of its spellings taught)? */
function bankWordOk(w: string, k: Knowledge): boolean {
  const e = WORDS.get(w);
  if (!e || !k.words.has(w)) return false;
  if (e.syll || e.unit < k.unit) return true;
  return e.parts.every((p) => k.parts.has(p.toLowerCase()));
}

/** Can a child at this point read this word (as written in a story, any case, no punctuation)? */
export function canDecode(word: string, k: Knowledge): boolean {
  const w = word.toLowerCase().replace(/[’‘]/g, "'");
  if (!w) return true;
  if (k.hearts.has(w) || bankWordOk(w, k)) return true;
  const base = (b: string) => !!b && (k.hearts.has(b) || bankWordOk(b, k));
  // -s from unit 2 (sits, naps, Dad's).
  if (k.unit >= 2) {
    if (w.endsWith("'s") && base(w.slice(0, -2))) return true;
    if (w.endsWith("s") && base(w.slice(0, -1))) return true;
  }
  // -es, -ed, -ing (doubling the last letter, or dropping a silent e) from unit 17.
  if (k.unit >= SYLLABLE_UNIT) {
    for (const end of ["es", "ed", "ing"]) {
      if (!w.endsWith(end)) continue;
      const stem = w.slice(0, -end.length);
      if (base(stem)) return true;
      if (stem.length > 2 && stem[stem.length - 1] === stem[stem.length - 2] && base(stem.slice(0, -1))) return true;
      if (base(stem + "e")) return true;
    }
  }
  return false;
}

/** The words of a lesson's story a child couldn't read yet (should always be empty). */
export function undecodable(lessonId: string): string[] {
  const lesson = lessonById(lessonId)!;
  const k = knowledgeAt(lessonId);
  const out = new Set<string>();
  for (const tok of storyTokens(lesson.text)) {
    for (const piece of bareWord(tok).split("-")) {
      const w = piece.replace(/^'+|'+$/g, "");
      if (w && !canDecode(w, k)) out.add(w);
    }
  }
  return [...out];
}

/* ------------------------------------------------------------------ word work helpers */

/** A small, repeatable shuffle (the same word always gets the same tile order). */
export function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
export function shuffled<T>(list: T[], seed: string): T[] {
  const rnd = seeded(seed), out = list.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/**
 * The tiles to build these words with: every part they need, plus a few look-alike or sound-alike spellings
 * so the child has to listen. Syllable words get extra syllables from their unit.
 */
export function tilesFor(words: Entry[], seed: string, extra = 3): string[] {
  const need = new Set<string>();
  for (const w of words) for (const p of w.parts) need.add(p);
  const distract: string[] = [];
  if (words[0]?.syll) {
    const unit = unitOf(words[0].unit);
    for (const w of shuffled(unit?.words || [], seed)) for (const p of w.parts) if (!need.has(p) && !distract.includes(p) && distract.length < extra) distract.push(p);
  } else {
    for (const p of need) for (const c of CONFUSABLE[p.toLowerCase()] || []) {
      if (distract.length >= extra) break;
      if (![...need].some((n) => n.toLowerCase() === c) && !distract.includes(c) && !c.includes("_")) distract.push(c);
    }
  }
  return shuffled([...need, ...distract], seed);
}

/** Which part changed from one chain word to the next ("first", "middle", "last", "added", or null). */
export function chainChange(a: Entry, b: Entry): { at: number; kind: "swap" | "add" | "drop" } | null {
  const x = a.parts.map((p) => p.toLowerCase()), y = b.parts.map((p) => p.toLowerCase());
  if (x.length === y.length) {
    const diff = x.map((p, i) => (p === y[i] ? -1 : i)).filter((i) => i >= 0);
    return diff.length === 1 ? { at: diff[0], kind: "swap" } : null;
  }
  const [short, long] = x.length < y.length ? [x, y] : [y, x];
  if (long.length - short.length !== 1) return null;
  for (let i = 0; i < long.length; i++) {
    if ([...long.slice(0, i), ...long.slice(i + 1)].join("|") === short.join("|")) return { at: i, kind: x.length < y.length ? "add" : "drop" };
  }
  return null;
}

/** The dots under the sound boxes: how many sounds each part makes. */
export const dotsOf = (e: Entry) => soundsByPart(e).map((s) => s.length);

/** A word for display and speech: the bank entry when there is one, else a plain entry built from its letters. */
export function entryFor(word: string, unit = 1): Entry {
  const w = word.toLowerCase().replace(/[^a-z']/g, "");
  return WORDS.get(w) || (heartWord(w) ? { w, show: heartWord(w)!.show, parts: heartWord(w)!.parts, unit, e: "", name: false, syll: false } : { w, show: word, parts: w.split(""), unit, e: "", name: false, syll: false });
}

/** Sound Blast cards for a lesson: its new spellings, then a few from before, each with its key word. */
export type BlastCard = { g: string; word: string; e: string; at: "start" | "vowel" | "end"; wrong: [string, string] };
export function blastCards(lesson: Lesson): BlastCard[] {
  const ok = (g: string) => !!keyFor(g, lesson.unit) && !!CONFUSABLE[g] && CONFUSABLE[g].length >= 2;
  const fresh = lesson.focus.map((g) => g.replace(/^-/, "")).filter(ok);
  const earlier: string[] = [];
  for (const u of UNITS) {
    if (u.n > lesson.unit) break;
    for (const g of u.graphemes) {
      const gg = g.replace(/^-/, "");
      if (ok(gg) && !fresh.includes(gg) && !earlier.includes(gg)) earlier.push(gg);
    }
  }
  const review = shuffled(earlier, lesson.id).slice(0, Math.max(2, 5 - fresh.length));
  return [...fresh, ...review].map((g) => {
    const key = keyFor(g, lesson.unit)!;
    const wrong = CONFUSABLE[g].slice(0, 2) as [string, string];
    return { g, word: key.word, e: key.e, at: key.at, wrong };
  });
}

/* ------------------------------------------------------------------ what Ari says */

/** Ari's fixed lines. Only these, the program's words and its stories can be spoken by the AI voice. */
export const ARI = {
  hello: "Hi! I'm Ari. Let's read together!",
  blast: "Sound Blast! Listen to the word, then tap the spelling for its first sound.",
  blastVowel: "Listen to the word. Tap the spelling that makes its vowel sound.",
  blastEnd: "Listen to the word. Tap the spelling for its last sound.",
  sayIt: "Your turn! Watch my mouth, then say the word.",
  listening: "I'm listening!",
  saidIt: "You said it!",
  niceTry: "Nice try! Listen and say it again.",
  build: "Let's build words! Listen to the word, then put the tiles in the boxes.",
  next: "Now change one tile to make the next word.",
  spell: "Spelling time! Listen to the word, then spell it.",
  heart: "This is a heart word. Most of it sounds out, but one part is tricky, so we learn it by heart.",
  sort: "Sort the words! Tap a word, then tap the side it goes on.",
  story: "Story time! Tap Listen to hear it, or tap Read to me and read it out loud.",
  readToMe: "Read the story to me. Tap I'm done when you finish.",
  greatReading: "Wow, great reading!",
  practice: "Let's practice the tricky words.",
  questions: "Question time! Tap the best answer.",
  done: "You did it! Lesson complete!",
  tryAgain: "Almost! Try again.",
  great: "Great job!",
  awesome: "Awesome!",
  yes: "Yes!",
  tapWord: "Tap any word to hear it.",
  studio: "Welcome to Say It Studio! Pick a set of words, watch my mouth, and say them with me.",
  keepGoing: "Keep going! You're doing great.",
  readyRead: "Ready? Read the words out loud.",
} as const;

/** Every text the AI voice may say for Beginners, lower case. Anything else is refused. */
export function voiceTexts(): Set<string> {
  const out = new Set<string>();
  const add = (t: string | undefined | null) => { const s = (t || "").trim(); if (s && s.length <= 400) out.add(s.toLowerCase()); };
  Object.values(ARI).forEach(add);
  for (const e of WORDS.values()) add(e.show);
  for (const h of HEARTS) add(h.show);
  for (const k of Object.values(KEYS)) add(k.word);
  for (const u of UNITS) {
    add(u.title); add(u.kid);
    for (const l of u.lessons) {
      add(l.title);
      sentencesOf(l.text).forEach(add);
      storyTokens(l.text).forEach((t) => { const b = bareWord(t); add(b); b.split("-").forEach(add); });
      [...l.chain, ...l.spell].forEach((e) => add(e.show));
      [...l.sort.leftWords, ...l.sort.rightWords, l.sort.left, l.sort.right].forEach(add);
      for (const q of l.questions) { add(q.q); add(q.right); q.wrong.forEach(add); }
    }
  }
  for (const c of SAYIT_CATEGORIES) { add(c.title); for (const w of c.words) { add(w.w); add(w.line); } }
  return out;
}

/** The first lesson a child hasn't passed, in order, starting at their start unit. */
export function nextLesson(passedIds: Set<string>, startUnit = 1): Lesson | null {
  return LESSONS.find((l) => l.unit >= startUnit && !passedIds.has(l.id)) || LESSONS.find((l) => !passedIds.has(l.id)) || null;
}
/** A unit is open from the start unit down, and after every lesson of the unit before it is passed. */
export function unitOpen(n: number, passedIds: Set<string>, startUnit = 1): boolean {
  if (n <= startUnit) return true;
  const before = unitOf(n - 1);
  return !!before && before.lessons.every((l) => passedIds.has(l.id)) && unitOpen(n - 1, passedIds, startUnit);
}
/** The grade band a Reader grade belongs in: Beginners is meant for K–3. */
export const isBeginnerGrade = (grade: string | null | undefined) => /^(k|kg|kindergarten|pre-?k|tk|0|1|2|3)(st|nd|rd|th)?( grade)?$/i.test(String(grade || "").trim());
