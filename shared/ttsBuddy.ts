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
/** One step of the worksheet: directions or a passage to read ("read"), or a question. */
export type Item = { id: string; kind: ItemKind; number: string; text: string; say: string; choices: string[] };
export type Worksheet = { id: string; title: string; items: Item[]; createdAt: string; pages: number };
/** What a child's laptop shows, and what the teacher sees about it. */
export type Laptop = { id: string; name: string; worksheetId: string; answers: Record<string, string>; step: number; done: boolean; seen: string; linkedAt: string };

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
  return { id: clean(r.id, 40) || id, kind, number: clean(r.number, 8).replace(/[.)]+$/, ""), text, say: say && say !== text ? say : "", choices };
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

export const questionCount = (w: Worksheet) => w.items.filter((i) => i.kind !== "read").length;
export const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** The text the voice reads for one part of an item. "q" is the question (or passage); "c0".."c5" are choices. */
export function spokenFor(item: Item, part: string): string {
  if (part === "q") return item.say || item.text;
  const m = /^c([0-5])$/.exec(part);
  if (m && item.choices[Number(m[1])] != null) return `${LETTERS[Number(m[1])]}. ${item.choices[Number(m[1])]}`;
  return "";
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

Return exactly: {"title": string, "items": [{"kind": "read" | "choice" | "short" | "long", "number": string, "text": string, "say": string, "choices": string[]}]}

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
- If a question depends on a picture, add a short description in square brackets to "text", like "[picture of 3 apples]".
- Ignore handwriting, answers already filled in, page numbers, the name/date line, and copyright lines.
- "title" is the worksheet's title, or a short description of it.
- If the photo isn't a worksheet or can't be read, return {"title": "", "items": []}.`;
