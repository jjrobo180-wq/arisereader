// Study Squad: study sets (the questions readers play with) and everything
// needed to check, clean up and import them. No server or browser code here,
// so the same rules run in both places and in tests.

/** The world's name. Change it here and it changes everywhere. */
export const STUDY_WORLD_TITLE = "Study Squad";
export const STUDY_WORLD_PATH = "/study";

export const STUDY_SUBJECTS = ["Reading", "Vocabulary", "Math", "Science", "Social Studies", "Other"] as const;
export type StudySubject = (typeof STUDY_SUBJECTS)[number];
export const STUDY_GRADES = ["K-2", "3-5", "6-8", "9-12", "Any"] as const;
export type StudyGrade = (typeof STUDY_GRADES)[number];

/**
 * One thing to study. Four formats:
 * - choice: a question with one right answer and 1 to 3 wrong ones
 * - truefalse: a statement that is true or false
 * - typed: a question answered by typing a short answer
 * - card: a flashcard (term on the front, meaning on the back). In games the
 *   wrong answers are borrowed from the other cards in the set.
 */
export type StudyItem =
  | { kind: "choice"; prompt: string; answer: string; wrong: string[]; explain?: string }
  | { kind: "truefalse"; prompt: string; answer: "True" | "False"; explain?: string }
  | { kind: "typed"; prompt: string; answer: string; accept: string[]; explain?: string }
  | { kind: "card"; prompt: string; answer: string; explain?: string };
export type StudyKind = StudyItem["kind"];

export type StudyOwnerRole = "starter" | "teacher" | "student";
export type StudySet = {
  id: string;
  title: string;
  subject: StudySubject;
  grade: StudyGrade;
  description: string;
  items: StudyItem[];
  ownerId: number;
  ownerName: string;
  ownerRole: StudyOwnerRole;
  /** How the set was made. */
  madeWith: "hand" | "ai" | "import";
  /** Teacher sets only: shown to the teacher's class. */
  shared: boolean;
  updatedAt: number;
};
/** What the set picker shows (no questions). */
export type StudySetSummary = Omit<StudySet, "items"> & { count: number; kinds: StudyKind[]; mine: boolean };

export const SET_LIMITS = {
  minItems: 4,
  maxItems: 40,
  title: [3, 80] as const,
  description: 200,
  prompt: 240,
  answer: 120,
  explain: 240,
  setsPerStudent: 20,
  setsPerTeacher: 60,
};

export const summarize = (set: StudySet, viewerId: number): StudySetSummary => {
  const { items, ...rest } = set;
  return { ...rest, count: items.length, kinds: Array.from(new Set(items.map((i) => i.kind))), mine: set.ownerId === viewerId && set.ownerRole !== "starter" };
};

// ─── Words we don't allow in reader-made sets ────────────────────────────────
// Reader-made text is shown to other readers at the same table, so titles,
// questions and answers are checked against this list (whole words only, with
// the usual letter swaps undone). Words that come up in real schoolwork (health
// class, history, classic books) are left off on purpose. Teachers can also
// see and remove their class's sets.
const BLOCKED = new Set([
  "ass", "asses", "asshole", "assholes", "bastard", "bitch", "bitches", "bitching", "blowjob", "boner", "boob", "boobs", "bullshit",
  "cocks", "crap", "cunt", "cunts", "damn", "dammit", "dick", "dicks", "dickhead", "dildo", "douche", "douchebag", "dumbass",
  "fag", "fags", "faggot", "faggots", "fuck", "fucked", "fucker", "fuckers", "fucking", "fucks", "goddamn", "handjob", "horny",
  "jackass", "jerkoff", "jizz", "kike", "kys", "milf", "motherfucker", "motherfuckers", "nigga", "niggas", "nigger", "niggers",
  "nudes", "orgasm", "pedo", "piss", "pissed", "porn", "porno", "pussy", "pussies", "retard", "retarded",
  "sexy", "shit", "shits", "shitty", "skank", "slut", "sluts", "spic", "stfu", "tits", "titties", "tranny", "twat", "wank", "wanker",
  "whore", "whores", "wtf",
]);
const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

/** Returns the first word that isn't allowed, or null when the text is fine. */
export function blockedWord(text: string): string | null {
  const raw = String(text || "").toLowerCase();
  // check the text as written, then again with number-for-letter swaps undone ("sh1t")
  for (const plain of [raw, raw.replace(/[013457@$!]/g, (c) => LEET[c] ?? c)]) {
    for (const w of plain.split(/[^a-z]+/)) {
      if (!w) continue;
      if (BLOCKED.has(w)) return w;
      // stretched-out spellings: "shiiit", "fuuuck"
      const squeezed = w.replace(/(.)\1+/g, "$1");
      if (squeezed !== w && BLOCKED.has(squeezed)) return w;
    }
    // letters spelled out with spaces or dots: "f u c k", "s.h.i.t"
    for (const run of plain.match(/\b(?:[a-z][\s._-]){2,}[a-z]\b/g) || []) {
      const joined = run.replace(/[^a-z]/g, "");
      if (BLOCKED.has(joined)) return joined;
    }
  }
  return null;
}

// ─── Cleaning up a set ───────────────────────────────────────────────────────
const clean = (value: unknown, max: number) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export class StudySetError extends Error {}

function tfAnswer(value: unknown): "True" | "False" | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (["true", "t", "yes", "y"].includes(v) || value === true) return "True";
  if (["false", "f", "no", "n"].includes(v) || value === false) return "False";
  return null;
}

/** Checks one item and returns a tidy copy. `n` is its number, for error messages. */
export function normalizeItem(raw: any, n: number): StudyItem {
  const where = `Question ${n}`;
  const prompt = clean(raw?.prompt ?? raw?.question ?? raw?.term, SET_LIMITS.prompt);
  if (prompt.length < 1) throw new StudySetError(`${where} needs a question.`);
  const explain = clean(raw?.explain ?? raw?.explanation, SET_LIMITS.explain) || undefined;
  const kind: StudyKind = ["choice", "truefalse", "typed", "card"].includes(raw?.kind) ? raw.kind : "choice";

  if (kind === "truefalse") {
    const answer = tfAnswer(raw?.answer);
    if (!answer) throw new StudySetError(`${where}: choose True or False.`);
    return { kind, prompt, answer, ...(explain ? { explain } : {}) };
  }
  const answer = clean(raw?.answer ?? raw?.definition, SET_LIMITS.answer);
  if (!answer) throw new StudySetError(`${where} needs an answer.`);
  if (kind === "card") return { kind, prompt, answer, ...(explain ? { explain } : {}) };
  if (kind === "typed") {
    const accept = (Array.isArray(raw?.accept) ? raw.accept : []).map((a: unknown) => clean(a, SET_LIMITS.answer)).filter((a: string) => a && !sameText(a, answer)).slice(0, 4);
    return { kind, prompt, answer, accept, ...(explain ? { explain } : {}) };
  }
  const wrong: string[] = [];
  for (const w of Array.isArray(raw?.wrong) ? raw.wrong : []) {
    const text = clean(w, SET_LIMITS.answer);
    if (text && !sameText(text, answer) && !wrong.some((x) => sameText(x, text))) wrong.push(text);
  }
  if (wrong.length < 1) throw new StudySetError(`${where} needs at least one wrong answer.`);
  return { kind: "choice", prompt, answer, wrong: wrong.slice(0, 3), ...(explain ? { explain } : {}) };
}

export type SetDraft = { title?: unknown; subject?: unknown; grade?: unknown; description?: unknown; items?: unknown; shared?: unknown; madeWith?: unknown };

/**
 * Checks a whole set. With `moderate` (used for reader-made sets and anything
 * the AI wrote) every piece of text must pass the word check.
 */
export function normalizeSetDraft(draft: SetDraft, opts: { moderate: boolean }) {
  const title = clean(draft.title, SET_LIMITS.title[1]);
  if (title.length < SET_LIMITS.title[0]) throw new StudySetError("Give your set a title (at least 3 letters).");
  const subject = (STUDY_SUBJECTS as readonly string[]).includes(String(draft.subject)) ? (draft.subject as StudySubject) : "Other";
  const grade = (STUDY_GRADES as readonly string[]).includes(String(draft.grade)) ? (draft.grade as StudyGrade) : "Any";
  const description = clean(draft.description, SET_LIMITS.description);
  if (!Array.isArray(draft.items)) throw new StudySetError("Add some questions first.");
  if (draft.items.length < SET_LIMITS.minItems) throw new StudySetError(`A set needs at least ${SET_LIMITS.minItems} questions.`);
  if (draft.items.length > SET_LIMITS.maxItems) throw new StudySetError(`A set can have up to ${SET_LIMITS.maxItems} questions.`);
  const items = draft.items.map((item, i) => normalizeItem(item, i + 1));
  const cards = items.filter((i) => i.kind === "card");
  if (cards.length && new Set(cards.map((c) => c.answer.toLowerCase())).size < 2) throw new StudySetError("Flashcards need at least two different answers.");
  if (opts.moderate) {
    const texts: [string, string][] = [["the title", title], ["the description", description]];
    items.forEach((item, i) => {
      texts.push([`question ${i + 1}`, item.prompt], [`question ${i + 1}`, item.answer]);
      if (item.kind === "choice") item.wrong.forEach((w) => texts.push([`question ${i + 1}`, w]));
      if (item.kind === "typed") item.accept.forEach((w) => texts.push([`question ${i + 1}`, w]));
      if (item.explain) texts.push([`question ${i + 1}`, item.explain]);
    });
    for (const [place, text] of texts) {
      if (blockedWord(text)) throw new StudySetError(`Please keep it school-friendly. Check ${place}.`);
    }
  }
  const madeWith = draft.madeWith === "ai" || draft.madeWith === "import" ? draft.madeWith : "hand";
  return { title, subject, grade, description, items, shared: draft.shared !== false, madeWith: madeWith as StudySet["madeWith"] };
}

// ─── Importing from pasted text or an uploaded file ──────────────────────────
/** Splits one CSV line, respecting "quoted, fields". */
function csvFields(line: string): string[] {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"' && cur.trim() === "") { quoted = true; cur = ""; }
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((f) => f.trim());
}

function splitLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((f) => f.trim());
  if (line.includes(" | ")) return line.split(" | ").map((f) => f.trim());
  if (line.includes("|")) return line.split("|").map((f) => f.trim());
  const csv = csvFields(line);
  // a comma inside an ordinary sentence shouldn't split it into a question and answers
  if (csv.length >= 2 && (line.includes('"') || csv.every((f) => f.length > 0))) {
    const dash = line.match(/^(.+?)\s+[-–—=]\s+(.+)$/);
    if (dash && csv.length === 2 && /\s[-–—=]\s/.test(csv[0])) return [dash[1].trim(), dash[2].trim()];
    return csv;
  }
  const dash = line.match(/^(.+?)\s+[-–—=]\s+(.+)$/) || line.match(/^(.+?):\s+(.+)$/);
  if (dash) return [dash[1].trim(), dash[2].trim()];
  return [line.trim()];
}

const HEADER = /^(question|term|word|prompt|front|q)$/i;

/**
 * Turns pasted or uploaded text into study items. One item per line:
 *   term - meaning                       → flashcard
 *   question, right, wrong, wrong, wrong → multiple choice
 *   statement, true                      → true or false
 * Tabs, commas, " | " and " - " all work as separators (so spreadsheets,
 * CSV files and copied vocabulary lists import as they are). Lines written as
 * "Q: …" then "A: …" become questions answered by typing.
 */
export function parseStudyImport(text: string): { items: StudyItem[]; skipped: number } {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  const items: StudyItem[] = [];
  let skipped = 0;
  const push = (raw: any) => {
    try { items.push(normalizeItem(raw, items.length + 1)); } catch { skipped++; }
  };
  for (let i = 0; i < lines.length && items.length < SET_LIMITS.maxItems; i++) {
    const line = lines[i].replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "");
    const q = line.match(/^Q(?:uestion)?\s*[:.)]\s*(.+)$/i);
    if (q) {
      const a = (lines[i + 1] || "").match(/^A(?:nswer)?\s*[:.)]\s*(.+)$/i);
      if (a) {
        i++;
        const tf = tfAnswer(a[1]);
        if (tf && /^(true|false)$/i.test(a[1].trim())) push({ kind: "truefalse", prompt: q[1], answer: tf });
        else push({ kind: a[1].trim().length <= 40 ? "typed" : "card", prompt: q[1], answer: a[1] });
      } else skipped++;
      continue;
    }
    const fields = splitLine(line).filter((f, idx) => idx < 2 || f.length > 0);
    if (i === 0 && fields.length >= 2 && HEADER.test(fields[0])) continue;
    if (fields.length < 2 || !fields[0] || !fields[1]) { skipped++; continue; }
    if (fields.length === 2) {
      if (/^(true|false)$/i.test(fields[1])) push({ kind: "truefalse", prompt: fields[0], answer: tfAnswer(fields[1]) });
      else push({ kind: "card", prompt: fields[0], answer: fields[1] });
    } else {
      push({ kind: "choice", prompt: fields[0], answer: fields[1], wrong: fields.slice(2, 5) });
    }
  }
  return { items, skipped };
}

// ─── Checking a typed answer ─────────────────────────────────────────────────
const NUMBER_WORDS: Record<string, string> = { zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12" };
export function normalizeAnswer(text: string): string {
  let t = String(text || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  t = t.replace(/(\d),(?=\d{3}\b)/g, "$1").replace(/[^a-z0-9.\-/% ]+/g, " ").replace(/\s+/g, " ").trim();
  t = t.replace(/^(the|a|an) /, "");
  t = t.replace(/\.+$/, "");
  return NUMBER_WORDS[t] ?? t;
}

function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Is a typed answer right? Capitals, punctuation and a leading "the" don't
 * matter. Longer words forgive a small spelling slip; numbers must match exactly.
 */
export function typedAnswerMatches(input: string, accepted: string[]): boolean {
  const given = normalizeAnswer(input);
  if (!given) return false;
  for (const answer of accepted) {
    const want = normalizeAnswer(answer);
    if (!want) continue;
    if (given === want) return true;
    if (/\d/.test(want) || /\d/.test(given)) continue;
    const slips = want.length >= 11 ? 2 : want.length >= 6 ? 1 : 0;
    if (slips && editDistance(given, want, slips) <= slips) return true;
  }
  return false;
}
