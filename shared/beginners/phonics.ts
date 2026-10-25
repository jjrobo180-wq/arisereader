// A.R.I.S.E. Beginners: the phonics core. How a word is split into spellings (graphemes), what sound each
// spelling makes, how many sounds a word has, the mouth shape (viseme) for each sound so Ari, the guide,
// can say a word with the right mouth, and the key word for every spelling (the "Sound Blast" cards).
//
// A word in the word bank is written as its spelling parts joined by "|": "sh|i|p", "c|a|k|e", "r|ai|n".
// Units 17 and 18 split words into meaningful parts or syllables instead: "jump|ed", "rab|bit".

export type Sound = string;
/** One word in the word bank. */
export type Entry = {
  /** The word, lower case (names keep their capital in `show`). */
  w: string;
  show: string;
  parts: string[];
  /** The unit that teaches it. */
  unit: number;
  /** A picture (emoji), or "". */
  e: string;
  name: boolean;
  /** Parts are syllables or word parts, not single spellings. */
  syll: boolean;
  /** Sounds written out by hand, for the few words the rules can't work out. */
  snd?: Sound[];
};

export const VOWEL_LETTERS = new Set(["a", "e", "i", "o", "u"]);
const SHORT: Record<string, Sound> = { a: "ă", e: "ĕ", i: "ĭ", o: "ŏ", u: "ŭ" };
const LONG: Record<string, Sound> = { a: "ā", e: "ē", i: "ī", o: "ō", u: "ū" };
const CONS: Record<string, Sound> = {
  b: "b", c: "k", d: "d", f: "f", g: "g", h: "h", j: "j", k: "k", l: "l", m: "m", n: "n", p: "p", r: "r", s: "s", t: "t", v: "v", w: "w", y: "y", z: "z",
  ff: "f", ll: "l", ss: "s", zz: "z", ck: "k", sh: "sh", ch: "ch", th: "th", wh: "w", ng: "ng", ph: "f", tch: "ch", dge: "j",
};
/** Vowel teams, bossy r and the other one-sound spellings. `ow` and `oo` have two sounds; see soundOfTeam. */
const TEAMS: Record<string, Sound> = {
  ai: "ā", ay: "ā", ee: "ē", ea: "ē", oa: "ō", oe: "ō", ow: "ō", igh: "ī", ie: "ī", oo: "oo", ew: "oo", ue: "oo",
  ar: "ar", or: "or", er: "er", ir: "er", ur: "er", ou: "ou", oi: "oi", oy: "oi", aw: "aw", au: "aw",
};
export const isVowelPart = (p: string) => VOWEL_LETTERS.has(p) || p in TEAMS || p === "y";

/** The sound of a vowel team in this unit (ow says /ō/ in unit 14, /ou/ from unit 16 on). */
function soundOfTeam(part: string, unit: number): Sound {
  if (part === "ow" && unit >= 16) return "ou";
  return TEAMS[part];
}

/**
 * The sounds in a word, in order. Silent e makes no sound; x and qu make two.
 * Only meaningful for spelling-part words (units 1–16); syllable words return [].
 */
export function soundsOf(entry: Pick<Entry, "parts" | "unit" | "syll" | "snd">): Sound[] {
  if (entry.snd) return entry.snd;
  if (entry.syll) return [];
  const parts = entry.parts.map((p) => p.toLowerCase());
  const out: Sound[] = [];
  const vowelAt = parts.map((p, i) => isVowelPart(p) && !(p === "y" && i === 0));
  parts.forEach((p, i) => {
    const last = i === parts.length - 1;
    if (p in TEAMS) { out.push(soundOfTeam(p, entry.unit)); return; }
    if (p === "x") { out.push("k", "s"); return; }
    if (p === "qu") { out.push("k", "w"); return; }
    if (p === "y") {
      // y at the start is a consonant; at the end of a one-vowel word it says /ī/ (my, fly), else /ē/.
      if (i === 0) { out.push("y"); return; }
      const otherVowel = parts.some((q, j) => j !== i && vowelAt[j] && q !== "y");
      out.push(otherVowel ? "ē" : "ī");
      return;
    }
    if (VOWEL_LETTERS.has(p)) {
      const otherVowelBefore = parts.slice(0, i).some((q, j) => vowelAt[j]);
      // A final e after a consonant is silent when the word has another vowel (cake, house, purse).
      if (p === "e" && last && i > 0 && otherVowelBefore && !VOWEL_LETTERS.has(parts[i - 1])) return;
      // Vowel, one consonant spelling, then a final e: the vowel says its name (cake, these, cube).
      const vce = i + 2 === parts.length - 1 && parts[parts.length - 1] === "e" && !isVowelPart(parts[i + 1]);
      if (vce) { out.push(LONG[p]); return; }
      // A vowel at the very end of the word (he, go, hi, she): open syllable, long.
      if (last) { out.push(p === "a" ? "ə" : LONG[p]); return; }
      out.push(SHORT[p]);
      return;
    }
    out.push(CONS[p] ?? p);
  });
  return out;
}

/* ------------------------------------------------------------------ mouth shapes */

/**
 * The mouth shapes Ari makes. rest: closed smile. mbp: lips pressed. ai: open wide. e: wide with teeth.
 * o: round open. u: small round (oo, w). fv: top teeth on the bottom lip. th: tongue between the teeth.
 * l: open, tongue tip up. s: teeth together. sh: lips pushed out with teeth showing. r: slightly round.
 * k: open, tongue back.
 */
export type Viseme = "rest" | "mbp" | "ai" | "e" | "o" | "u" | "fv" | "th" | "l" | "s" | "sh" | "r" | "k";
const VIS: Record<string, Viseme> = {
  b: "mbp", p: "mbp", m: "mbp", f: "fv", v: "fv", th: "th", l: "l", r: "r", w: "u", y: "e", sh: "sh", ch: "sh", j: "sh",
  s: "s", z: "s", t: "s", d: "s", n: "s", k: "k", g: "k", ng: "k", h: "ai",
  "ă": "ai", "ĕ": "e", "ĭ": "e", "ŏ": "o", "ŭ": "ai", "ā": "e", "ē": "e", "ī": "ai", "ō": "o", "ū": "u", oo: "u", "ŏŏ": "u",
  ou: "o", oi: "o", aw: "o", ar: "ai", or: "o", er: "r", "ə": "ai",
};
export const visemeOf = (s: Sound): Viseme => VIS[s] ?? "s";
/** Is this sound a vowel (it holds the mouth open longer)? */
export const isVowelSound = (s: Sound) => /[ăĕĭŏŭāēīōūə]|^(oo|ŏŏ|ou|oi|aw|ar|or|er)$/.test(s);

/** Rough sounds for any written word, from its letters, for words not in the word bank. */
export function letterSounds(word: string): Sound[] {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  const out: Sound[] = [];
  const pairs: Record<string, Sound> = { sh: "sh", ch: "ch", th: "th", wh: "w", ck: "k", ng: "ng", ph: "f", ee: "ē", ea: "ē", ai: "ā", ay: "ā", oa: "ō", oo: "oo", ou: "ou", ow: "ou", oi: "oi", oy: "oi", aw: "aw", au: "aw", ar: "ar", or: "or", er: "er", ir: "er", ur: "er", ew: "oo", ie: "ī", igh: "ī" };
  for (let i = 0; i < w.length;) {
    const three = w.slice(i, i + 3), two = w.slice(i, i + 2);
    if (three === "igh") { out.push("ī"); i += 3; continue; }
    if (pairs[two]) { out.push(pairs[two]); i += 2; continue; }
    const c = w[i];
    if (c === "e" && i === w.length - 1 && i > 0) { i++; continue; }
    if (VOWEL_LETTERS.has(c)) out.push(SHORT[c]);
    else if (c === "x") out.push("k", "s");
    else if (c === "y") out.push(i === 0 ? "y" : "ē");
    else out.push(CONS[c] ?? c);
    i++;
  }
  return out;
}

/* ------------------------------------------------------------------ Sound Blast key words */

export type Key = { word: string; e: string; at: "start" | "vowel" | "end" };
/** The key word for each spelling. A spelling with a unit after "@" uses that key from that unit on. */
export const KEYS: Record<string, Key> = {
  a: { word: "apple", e: "🍎", at: "start" }, m: { word: "moon", e: "🌙", at: "start" }, s: { word: "sun", e: "☀️", at: "start" },
  t: { word: "tiger", e: "🐯", at: "start" }, p: { word: "pig", e: "🐷", at: "start" }, i: { word: "insect", e: "🐞", at: "start" },
  n: { word: "nose", e: "👃", at: "start" }, f: { word: "fish", e: "🐟", at: "start" }, d: { word: "dog", e: "🐶", at: "start" },
  o: { word: "octopus", e: "🐙", at: "start" }, c: { word: "cat", e: "🐱", at: "start" }, g: { word: "goat", e: "🐐", at: "start" },
  h: { word: "hat", e: "🎩", at: "start" }, e: { word: "egg", e: "🥚", at: "start" }, b: { word: "bus", e: "🚌", at: "start" },
  r: { word: "rabbit", e: "🐰", at: "start" }, l: { word: "lion", e: "🦁", at: "start" }, u: { word: "umbrella", e: "☂️", at: "start" },
  j: { word: "juice", e: "🧃", at: "start" }, k: { word: "kite", e: "🪁", at: "start" }, w: { word: "web", e: "🕸️", at: "start" },
  v: { word: "van", e: "🚐", at: "start" }, x: { word: "box", e: "📦", at: "end" }, y: { word: "yo-yo", e: "🪀", at: "start" },
  z: { word: "zebra", e: "🦓", at: "start" }, qu: { word: "queen", e: "👸", at: "start" },
  ff: { word: "puff", e: "💨", at: "end" }, ll: { word: "bell", e: "🔔", at: "end" }, ss: { word: "kiss", e: "💋", at: "end" },
  zz: { word: "buzz", e: "🐝", at: "end" }, ck: { word: "duck", e: "🦆", at: "end" },
  sh: { word: "ship", e: "🚢", at: "start" }, ch: { word: "chick", e: "🐥", at: "start" }, th: { word: "thumb", e: "👍", at: "start" },
  wh: { word: "whale", e: "🐳", at: "start" }, ng: { word: "ring", e: "💍", at: "end" },
  a_e: { word: "cake", e: "🎂", at: "vowel" }, i_e: { word: "kite", e: "🪁", at: "vowel" }, o_e: { word: "bone", e: "🦴", at: "vowel" },
  u_e: { word: "cube", e: "🧊", at: "vowel" }, e_e: { word: "these", e: "", at: "vowel" },
  ai: { word: "rain", e: "🌧️", at: "vowel" }, ay: { word: "hay", e: "🌾", at: "vowel" }, ee: { word: "bee", e: "🐝", at: "vowel" },
  ea: { word: "leaf", e: "🍃", at: "vowel" }, oa: { word: "boat", e: "⛵", at: "vowel" }, ow: { word: "snow", e: "❄️", at: "vowel" },
  igh: { word: "light", e: "💡", at: "vowel" }, ie: { word: "pie", e: "🥧", at: "vowel" }, oo: { word: "moon", e: "🌙", at: "vowel" },
  ar: { word: "car", e: "🚗", at: "vowel" }, or: { word: "corn", e: "🌽", at: "vowel" }, er: { word: "fern", e: "🌿", at: "vowel" },
  ir: { word: "bird", e: "🐦", at: "vowel" }, ur: { word: "surf", e: "🏄", at: "vowel" },
  ou: { word: "house", e: "🏠", at: "vowel" }, "ow@16": { word: "cow", e: "🐄", at: "vowel" }, oi: { word: "coin", e: "🪙", at: "vowel" },
  oy: { word: "boy", e: "👦", at: "vowel" }, aw: { word: "saw", e: "🪚", at: "vowel" }, au: { word: "launch", e: "🚀", at: "vowel" },
  ew: { word: "stew", e: "🍲", at: "vowel" },
};
export function keyFor(grapheme: string, unit: number): Key | null {
  return (unit >= 16 && KEYS[`${grapheme}@16`]) || KEYS[grapheme] || null;
}
/** How a spelling is shown on a card: "a_e" is shown "a–e". */
export const showGrapheme = (g: string) => g.replace("_", "–");

/** Spellings children mix up, used as the wrong answers on Sound Blast cards. */
export const CONFUSABLE: Record<string, string[]> = {
  b: ["d", "p"], d: ["b", "p"], p: ["b", "q"], m: ["n", "w"], n: ["m", "h"], e: ["i", "a"], i: ["e", "u"], a: ["u", "o"], o: ["u", "a"], u: ["o", "a"],
  sh: ["ch", "s"], ch: ["sh", "th"], th: ["f", "sh"], wh: ["w", "th"], ck: ["k", "c"], ll: ["l", "ss"], ss: ["zz", "s"], ff: ["f", "ss"], zz: ["ss", "z"],
  ai: ["ay", "ee"], ay: ["ai", "oy"], ee: ["ea", "ie"], ea: ["ee", "ai"], oa: ["ow", "oi"], ow: ["oa", "ou"], igh: ["ie", "i_e"], ie: ["igh", "ee"],
  oo: ["ou", "oa"], ar: ["or", "er"], or: ["ar", "ur"], er: ["ir", "ar"], ir: ["ur", "er"], ur: ["ir", "or"], ou: ["ow", "oo"], oi: ["oy", "oa"],
  oy: ["oi", "ay"], aw: ["au", "ow"], au: ["aw", "ou"], ew: ["oo", "ow"], a_e: ["ai", "a"], i_e: ["igh", "i"], o_e: ["oa", "o"], u_e: ["oo", "u"],
  x: ["ks", "z"], qu: ["k", "w"], v: ["f", "w"], f: ["v", "th"], g: ["j", "k"], j: ["g", "y"], k: ["c", "g"], c: ["k", "s"], r: ["w", "l"], l: ["r", "w"],
  w: ["r", "y"], y: ["w", "j"], z: ["s", "x"], s: ["z", "c"], t: ["d", "k"], h: ["n", "w"], ng: ["nk", "n"],
};

/* ------------------------------------------------------------------ words as people say them */

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
/** Lower case, letters only (inner apostrophes kept), digits written as words. */
export function normWord(raw: string): string {
  const t = raw.toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9']/g, "").replace(/^'+|'+$/g, "");
  if (/^\d+$/.test(t)) return NUMBER_WORDS[Number(t)] ?? t;
  return t;
}
/** The words of a text, normalized, hyphenated words joined ("zig-zag" → "zigzag"). */
export function wordsOf(text: string): string[] {
  return text.replace(/(\w)-(\w)/g, "$1$2").split(/\s+/).map(normWord).filter(Boolean);
}
/** Words that sound the same; speech-to-text picks one spelling, so either counts as right. */
const SAME_SOUND: string[][] = [
  ["to", "too", "two"], ["there", "their", "theyre"], ["see", "sea"], ["tail", "tale"], ["mail", "male"], ["meet", "meat"], ["no", "know"],
  ["by", "bye", "buy"], ["i", "eye"], ["right", "write"], ["be", "bee"], ["hi", "high"], ["new", "knew"], ["one", "won"], ["so", "sew"],
  ["for", "four"], ["red", "read"], ["pail", "pale"], ["plain", "plane"], ["main", "mane"], ["week", "weak"], ["sail", "sale"], ["road", "rode"],
  ["hole", "whole"], ["not", "knot"], ["night", "knight"], ["flew", "flu"], ["blew", "blue"], ["mom", "mum", "mam"], ["ok", "okay"],
  ["hey", "hay"], ["dear", "deer"], ["its", "it's"], ["were", "we're"], ["your", "you're"], ["whole", "hole"], ["be", "b"], ["tea", "tee", "t"],
  ["oh", "o", "owe"], ["ate", "eight"], ["sun", "son"], ["fur", "fir"], ["herd", "heard"], ["pause", "paws"], ["chews", "choose"],
];
const SAME = new Map<string, number>();
SAME_SOUND.forEach((group, i) => group.forEach((w) => SAME.set(w, i)));
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const ga = SAME.get(a), gb = SAME.get(b);
  return ga !== undefined && ga === gb;
}
/** Letters that differ between two words (Levenshtein distance). */
export function distance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[n];
}
