// TTS Buddy (November 2026): a teacher snaps a worksheet with their phone, the AI splits it into one question at a
// time, and a child on a school laptop hears each question (and every answer choice) read aloud in a natural voice
// while the words light up as they're spoken.
//
// How the laptop gets the worksheet: the child opens arisetodo.com/buddy, the laptop shows a big 4-digit code, and
// the teacher types that code on their phone (or the child types the teacher's class code). No accounts for
// children, no names needed (the teacher can add a first name or a seat number).
//
// Server: server/ttsBuddy.ts. Pages: client/src/pages/buddy/*.

export type ItemKind = "read" | "choice" | "short" | "long";
/** Where a picture sits on its page photo, as fractions of 1000 ([left, top, right, bottom]), and its saved crop. */
export type Figure = { page: number; box: [number, number, number, number]; alt: string; img: string };
/** Accommodations the AI drafts for an item (the teacher can edit them). Nothing here gives the answer away, except
 *  the word bank and fewer choices, which by design include the right answer among fewer options. */
export type Supports = {
  simple: string;            // the question in plainer, shorter words (a passage: a short, simple summary)
  steps: string[];           // hints, one step at a time, that guide thinking without giving the answer
  starter: string;           // a sentence starter for a written answer
  bank: string[];            // a word bank for a short answer (includes the answer)
  vocab: { w: string; m: string }[]; // hard words with kid-friendly meanings
  keep: number[];            // for multiple choice: which choices to keep when "fewer choices" is on
};
/** One step of the worksheet: directions or a passage to read ("read"), or a question. */
export type Item = { id: string; kind: ItemKind; number: string; text: string; say: string; choices: string[]; figure: Figure | null; supports: Supports | null };
export type Worksheet = { id: string; title: string; items: Item[]; createdAt: string; pages: number };
/** Accommodations switched on for one student (the teacher sets them; a class default applies to new laptops). */
export type Acc = { simple: boolean; steps: boolean; starter: boolean; bank: boolean; vocab: boolean; fewer: boolean; big: boolean; mic: boolean };
export const ACC_KEYS: (keyof Acc)[] = ["simple", "steps", "bank", "starter", "vocab", "fewer", "big", "mic"];
export const ACC_LABEL: Record<keyof Acc, [string, string]> = {
  simple: ["Simpler words", "Questions in plainer words; passages shortened to a simple summary (the original is one tap away)"],
  steps: ["Step-by-step hints", "A Help button that gives one hint at a time"],
  bank: ["Word bank", "Tap a word to answer short questions"],
  starter: ["Sentence starters", "Written answers start with a few words to build on"],
  vocab: ["Word meanings", "Hard words are underlined; tap to hear what they mean"],
  fewer: ["Fewer choices", "Multiple choice shows 2 choices instead of 4"],
  big: ["Bigger text", "Larger letters and more space between lines"],
  mic: ["Say the answer", "A microphone button types what they say"],
};
export const noAcc = (): Acc => ({ simple: false, steps: false, starter: false, bank: false, vocab: false, fewer: false, big: false, mic: false });
export const cleanAcc = (raw: any): Acc => { const a = noAcc(); for (const k of ACC_KEYS) a[k] = raw?.[k] === true; return a; };
/** What a child's laptop shows, and what the teacher sees about it. */
export type Laptop = { id: string; name: string; worksheetId: string; answers: Record<string, string>; step: number; done: boolean; seen: string; linkedAt: string; acc: Acc };

export const LIMITS = { items: 60, text: 1200, choices: 6, choice: 200, title: 80, pages: 4, worksheets: 60, laptops: 60, readsPerDay: 40, name: 24 };
export const PAIR_MINUTES = 30;
/** How long a linked laptop stays linked (a school day, give or take). */
export const LAPTOP_HOURS = 10;

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[ \t]+/g, " ").trim().slice(0, max) : "");
const KINDS: ItemKind[] = ["read", "choice", "short", "long"];
/** Answer letters the AI or the worksheet put in front of choices ("A.", "b)", "(c)") come off; the app shows its own. */
const stripLetter = (s: string) => s.replace(/^\(?[A-Fa-f][.)]\s+/, "").replace(/^\(?[1-6][.)]\s+/, "").trim();

export function cleanItem(raw: any, id: string): Item | null {
  const r = raw && typeof raw === "object" ? raw : {};
  let kind: ItemKind = KINDS.includes(r.kind) ? r.kind : "short";
  const text = clean(r.text, LIMITS.text);
  if (!text) return null;
  let choices = Array.isArray(r.choices) ? r.choices.map((c: unknown) => stripLetter(clean(c, LIMITS.choice))).filter(Boolean).slice(0, LIMITS.choices) : [];
  if (kind === "choice" && choices.length < 2) kind = "short";
  if (kind !== "choice") choices = [];
  const say = clean(r.say, LIMITS.text);
  return { id: clean(r.id, 40) || id, kind, number: clean(r.number, 8).replace(/[.)]+$/, ""), text, say: say && say !== text ? say : "", choices, figure: cleanFigure(r.figure), supports: cleanSupports(r.supports, choices.length) };
}

const num = (v: unknown) => Math.max(0, Math.min(1000, Math.round(Number(v) || 0)));
export function cleanFigure(raw: any): Figure | null {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.box) || raw.box.length !== 4) return null;
  let [x0, y0, x1, y1] = raw.box.map(num);
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (y1 < y0) [y0, y1] = [y1, y0];
  if (x1 - x0 < 15 || y1 - y0 < 15) return null; // too small to be a real picture
  return { page: Math.max(1, Math.min(LIMITS.pages, Math.round(Number(raw.page) || 1))), box: [x0, y0, x1, y1], alt: clean(raw.alt, 200), img: typeof raw.img === "string" && /^[a-z0-9]{6,24}$/.test(raw.img) ? raw.img : "" };
}
export function cleanSupports(raw: any, choiceCount: number): Supports | null {
  if (!raw || typeof raw !== "object") return null;
  const list = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.map((x) => clean(x, max)).filter(Boolean).slice(0, n) : []);
  const keep = Array.isArray(raw.keep) ? Array.from(new Set(raw.keep.map((x: unknown) => Math.round(Number(x))).filter((x: number) => x >= 0 && x < choiceCount))).slice(0, 3) as number[] : [];
  const out: Supports = {
    simple: clean(raw.simple, LIMITS.text), steps: list(raw.steps, 4, 240), starter: clean(raw.starter, 120), bank: list(raw.bank, 8, 40),
    vocab: (Array.isArray(raw.vocab) ? raw.vocab : []).map((v: any) => ({ w: clean(v?.w ?? v?.word, 30), m: clean(v?.m ?? v?.meaning, 200) })).filter((v: any) => v.w && v.m).slice(0, 4),
    keep: keep.length >= 2 ? keep.sort((a, b) => a - b) : [],
  };
  return out.simple || out.steps.length || out.starter || out.bank.length || out.vocab.length || out.keep.length ? out : null;
}

export function cleanWorksheet(raw: any, id: string, now: string): Worksheet {
  const r = raw && typeof raw === "object" ? raw : {};
  const items: Item[] = [];
  const list = Array.isArray(r.items) ? r.items.slice(0, LIMITS.items) : [];
  list.forEach((it: any, i: number) => { const c = cleanItem(it, `q${i + 1}`); if (c) items.push(c); });
  const seen = new Set<string>();
  for (const [i, it] of items.entries()) { if (seen.has(it.id)) it.id = `q${i + 1}x`; seen.add(it.id); }
  return { id, title: clean(r.title, LIMITS.title) || "Worksheet", items, createdAt: clean(r.createdAt, 40) || now, pages: Math.max(1, Math.min(LIMITS.pages, Number(r.pages) || 1)) };
}

/** The picture a step should show: its own, or else the one shared from the steps just above it (a number line or
 *  chart several questions use), stopping at a reading step that has no picture (a new section). */
export function pictureFor(items: Item[], index: number): Item | null {
  for (let i = index; i >= 0; i--) {
    const it = items[i];
    if (it.figure?.img) return it;
    if (it.kind === "read") return null;
  }
  return null;
}
/** A real answer: not empty, and not just the sentence starter the app put in the box. */
export const isAnswered = (item: Item, answer: string | undefined) => { const a = (answer || "").trim(); return !!a && a !== (item.supports?.starter || "").trim(); };
export const questionCount = (w: Worksheet) => w.items.filter((i) => i.kind !== "read").length;
export const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** The text the voice reads for one part of an item. "q" is the question (or passage); "c0".."c5" are choices;
 *  "s" is the simpler wording; "h0".. are hints; "v0".. are word meanings; "st" the sentence starter; "p" the picture. */
export function spokenFor(item: Item, part: string): string {
  if (part === "q") return item.say || item.text;
  const sp = item.supports;
  if (part === "s") return sp?.simple || "";
  if (part === "st") return sp?.starter || "";
  if (part === "p") return item.figure?.alt ? `Picture: ${item.figure.alt}` : "";
  const m = /^([chv])([0-9])$/.exec(part);
  if (!m) return "";
  const i = Number(m[2]);
  if (m[1] === "c") return item.choices[i] != null && i < 6 ? `${LETTERS[i]}. ${item.choices[i]}` : "";
  if (m[1] === "h") return sp?.steps[i] || "";
  const v = sp?.vocab[i]; return v ? `${v.w}. ${v.m}` : "";
}
/** What the screen shows for the same part (the words that light up). */
export const shownFor = (item: Item, part: string) => (part === "q" ? item.text : spokenFor(item, part));

// ---------- Codes ----------
/** A laptop's code: 4 digits, easy to read across a room and type on a phone. */
export const pairCode = (rand: () => number) => String(1000 + Math.floor(rand() * 9000));
/** A teacher's class code: 4 letters a child can type. No vowels (no accidental words), no I/O/L look-alikes. */
const CLASS_LETTERS = "BCDFGHJKMNPQRSTVWXZ";
export const classCode = (rand: () => number) => Array.from({ length: 4 }, () => CLASS_LETTERS[Math.floor(rand() * CLASS_LETTERS.length)]).join("");
export const normPair = (s: unknown) => String(s ?? "").replace(/\D/g, "").slice(0, 4);
export const normClass = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
export const cleanName = (s: unknown) => clean(s, LIMITS.name);

// ---------- Follow-along word timing ----------
/** The words on screen, in order, each with where it sits in the text (so the page can light it up in place). */
export type Token = { w: string; i: number };
export function tokens(text: string): Token[] {
  const out: Token[] = [];
  const re = /\S+/g; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ w: m[0], i: m.index });
  return out;
}
export type Timed = { word: string; start: number; end: number };
export type WordTime = { s: number; e: number };
const norm = (w: string) => w.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

/** Lines up the words the voice actually said (with times, from a transcription of the audio) with the words on
 *  screen. Words that don't match (numbers read out, symbols, a blank) take their time from their neighbors. */
export function alignWords(shown: string[], said: Timed[], duration: number): WordTime[] {
  const out: (WordTime | null)[] = shown.map(() => null);
  let j = 0;
  for (let i = 0; i < shown.length; i++) {
    const a = norm(shown[i]);
    if (!a) continue;
    for (let k = j; k < Math.min(said.length, j + 4); k++) {
      const b = norm(said[k].word);
      if (b && (a === b || (a.length > 3 && (a.startsWith(b) || b.startsWith(a))))) { out[i] = { s: said[k].start, e: said[k].end }; j = k + 1; break; }
    }
  }
  // Fill the gaps: spread unmatched words evenly between the matched words around them.
  const total = Math.max(duration, said.length ? said[said.length - 1].end : 0, 0.1);
  let i = 0;
  while (i < out.length) {
    if (out[i]) { i++; continue; }
    let k = i; while (k < out.length && !out[k]) k++;
    const from = i > 0 ? out[i - 1]!.e : 0;
    const to = k < out.length ? out[k]!.s : total;
    const step = Math.max(0, to - from) / (k - i);
    for (let x = i; x < k; x++) out[x] = { s: from + step * (x - i), e: from + step * (x - i + 1) };
    i = k;
  }
  return out.map((t) => ({ s: Math.round(t!.s * 1000) / 1000, e: Math.round(Math.max(t!.e, t!.s) * 1000) / 1000 }));
}
/** When there are no timings at all: each word gets time in proportion to its length. */
export function estimateTimes(shown: string[], duration: number): WordTime[] {
  const weight = shown.map((w) => Math.max(2, norm(w).length) + (/[.,!?;:]$/.test(w) ? 3 : 0));
  const sum = weight.reduce((a, b) => a + b, 0) || 1;
  let t = 0;
  return weight.map((w) => { const s = t; t += (duration * w) / sum; return { s: Math.round(s * 1000) / 1000, e: Math.round(t * 1000) / 1000 }; });
}
/** The word being spoken at a moment in the audio (-1 before the first word). */
export function wordAt(times: WordTime[], t: number): number {
  let found = -1;
  for (let i = 0; i < times.length; i++) { if (times[i].s <= t + 0.03) found = i; else break; }
  return found;
}

// ---------- Reading the worksheet photo ----------
export const READ_PROMPT = `You turn photos of a printed classroom worksheet into JSON so a child can hear it read aloud one question at a time.

Return exactly: {"title": string, "items": [{"kind": "read" | "choice" | "short" | "long", "number": string, "text": string, "say": string, "choices": string[], "figure"?: {"box": [number, number, number, number], "alt": string}}]}

Rules:
- Go in the order a reader would: top to bottom, left column before right column, page 1 before page 2.
- Copy the worksheet's own words exactly. Fix only obvious photo misreads. Never answer anything, never add questions, never reword.
- "read": directions, a heading that tells the child what to do, a word bank, or a reading passage the questions are about. Put a whole passage in one item.
- "choice": a question with answer options. Put each option in "choices" without its letter or number. True/false questions are "choice" with ["True", "False"]. Yes/no likewise.
- "short": a question answered with a word, a number or one line (including fill in the blank, math problems and matching).
- "long": a question answered with sentences.
- "number": the question's own number or letter as printed ("1", "2a"), or "" if none.
- In "text", write a blank line to fill in as "____".
- "say" is how to read the text aloud, only when it differs from "text": math and symbols in words ("3/4" → "three fourths", "5 × 6 = ____" → "five times six equals blank", "<" → "is less than"), "____" → "blank", abbreviations spelled out. Otherwise "".
- Pictures: if an item has a picture, diagram, number line, graph, table or chart the child needs to see, do NOT describe it in "text". Instead add "figure": {"box": [left, top, right, bottom], "alt": "a short description"} — the box around the whole picture, as numbers from 0 to 1000 measured across the photo's width (left, right) and down its height (top, bottom). Make the box a little generous so nothing is cut off. A picture shared by several questions goes on the first of them (or on the "read" item before them).
- Ignore handwriting, answers already filled in, page numbers, the name/date line, and copyright lines.
- "title" is the worksheet's title, or a short description of it.
- If the photo isn't a worksheet or can't be read, return {"title": "", "items": []}.`;

// ---------- Accommodations, drafted by the AI ----------
export const SUPPORTS_PROMPT = `You help a special education teacher make accommodations for a worksheet a child will hear read aloud.
For EACH item you're given, write:
- "simple": the same question in plainer, shorter words (about a 2nd-grade reading level), keeping its meaning and anything the child needs to answer. For a "read" item (directions or a passage), a short, simple summary in 1 to 3 short sentences. Never give the answer.
- "steps": 2 to 4 hints, each one short sentence, that walk the child toward the answer one step at a time without saying it. For "read" items, [].
- "starter": for "short" and "long" items, a sentence starter of 3 to 8 words that begins a good answer without giving it away (for math, ""). Otherwise "".
- "bank": for "short" items, 3 to 5 single words or short phrases, one of them the correct answer, the others believable but wrong, in random order. Otherwise [].
- "vocab": up to 3 words from the item a young reader may not know, each {"w": word, "m": a meaning a 7-year-old understands, one short sentence}. [] if none.
- "keep": for "choice" items, the indexes (0 = first choice) of exactly 2 choices: the correct one and the most reasonable wrong one. For true/false, [0, 1]. Otherwise [].
Reply with JSON only: {"items": [{"id": string, "simple": string, "steps": string[], "starter": string, "bank": string[], "vocab": [{"w": string, "m": string}], "keep": number[]}]}`;
/** The worksheet as the AI sees it when drafting accommodations (passages give context for the questions). */
export const supportsInput = (w: Worksheet, ids?: string[]) => JSON.stringify({ title: w.title, items: w.items.filter((i) => !ids || ids.includes(i.id)).map((i) => ({ id: i.id, kind: i.kind, number: i.number, text: i.text, choices: i.choices, picture: i.figure?.alt || undefined })), context: ids ? w.items.filter((i) => i.kind === "read").map((i) => i.text).join("\n\n").slice(0, 4000) : undefined });
