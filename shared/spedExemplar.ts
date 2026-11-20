// SPED Exemplar Maker (a button inside the Math Lessons app, #/math-lessons).
//
// A teacher gives it ONE math lesson (typed or pasted text, or photos of the page). It returns TWO separate
// documents, built the way the teacher asked for them:
//   1. the EXEMPLAR: a teacher guide for someone who has never taught the lesson (tiny ideas explained like
//      to an elementary student, a one-page recipe card, EVERY problem solved with hints / steps / why / check
//      / answer, common mistakes, simplified / modified / extension supports);
//   2. the PRACTICE PACK: a student practice sheet (no answers), the lesson's own practice solved, and an
//      answer key.
//
// This file holds everything that is the same every time, so the result is the same on the first try:
//   - SPED_REQUIREMENTS: the teacher's requirements, word for word in spirit. They are shown on the page AND
//     written into the AI's instructions, and tests make sure each one is in the prompt;
//   - the prompts (with one fully worked example so the AI copies the shape and the voice);
//   - cleaners that reject a reply that is missing hints, steps, whys, checks or answers (the server then
//     asks the AI to fix exactly what is missing);
//   - the two document renderers (printable HTML, every word of AI text escaped).
// The server (server/spedExemplar.ts) asks the AI, checks every answer, and stores the result.

// ─── The teacher's requirements ───────────────────────────────────────────────────────────────────
export const SPED_REQUIREMENTS: { id: string; text: string }[] = [
  { id: "audience", text: "It is for special education teachers: a teacher-facing lesson plan, how-to and exemplar, not a student worksheet." },
  { id: "zero", text: "Explain it to a teacher who has zero idea how to do the lesson. Assume no math background. Explain every idea the way you would to an elementary student." },
  { id: "correct", text: "Everything is explained correctly, with the correct answers placed, every step shown, and no mistakes. Every answer is double-checked." },
  { id: "simplest", text: "Make it in the simplest form, more in depth and easier: hints, examples, the whys, how you get each answer, how it is solved, and the steps." },
  { id: "ladder", text: "Every problem gets a hint ladder (Hint 1, Hint 2, Hint 3, given one at a time), numbered steps, why it works, a check, the answer, and what to say to the student." },
  { id: "recipe", text: "One reusable recipe card: the same few steps every time, to tape to the desk." },
  { id: "supports", text: "Include simplified, modified and extension supports for students who need them." },
  { id: "pictures", text: "Use a picture where it helps (a tape diagram or a 100-grid)." },
  { id: "two", text: "Two separate documents: the exemplar is one document, and the practice is a different document." },
  { id: "practice", text: "The practice document has a student practice sheet with no answers, the lesson's own practice problems solved, and an answer key with steps." },
];

// ─── Types ───────────────────────────────────────────────────────────────────────────────────────
export type XPicture =
  | { kind: "tape"; label: string; pieces: number; filled: number; extra: number; note: string }
  | { kind: "grid100"; label: string; shaded: number };
export type XProblem = {
  id: string; title: string;
  /** The problem exactly as a student sees it. */
  story: string;
  hints: string[];
  steps: string[];
  why: string; check: string;
  /** Shown in the document, in words: "$150" or "Equation 1.04x = 156. She paid $150." */
  answer: string;
  /** The short answer only ("150"), so a second solver's answer can be compared by code. */
  finalAnswer: string;
  /** Other correct ways to write the short answer ("150.00", "$150"). */
  accept: string[];
  say: string;
  picture: XPicture | null;
  /** Set by the server's check: true = a second solver and the arithmetic check agree. */
  verified: boolean;
};
export type XSection = { title: string; intro: string; problems: XProblem[] };
export type XIdea = { title: string; text: string[]; tryIt: string; say: string; picture: XPicture | null };
export type XRecipeStep = { head: string; text: string };
export type XExemplar = {
  title: string; kicker: string; grade: string; source: string;
  oneSentence: string;
  howToUse: string[];
  ideas: XIdea[];
  recipe: { name: string; steps: XRecipeStep[]; examples: { label: string; value: string }[] };
  sections: XSection[];
  mistakes: { wrong: string; fix: string }[];
  supports: { simplified: string[]; modified: string[]; extension: string[] };
};
export type XPracticeItem = { id: string; q: string; steps: string[]; answer: string; finalAnswer: string; accept: string[]; verified: boolean };
export type XPractice = {
  sheetTitle: string; instructions: string;
  sheet: XPracticeItem[];
  book: XSection[];
  quickRef: { label: string; text: string }[];
};
export type SpedPack = {
  id: string; title: string; grade: string; createdAt: string; ownerId: number;
  exemplar: XExemplar; practice: XPractice;
  /** How many answers were checked, and how many still need the teacher's own eyes. */
  check: { checked: number; flagged: number };
};

export const SPED_LIMITS = {
  title: 120, text: 24_000, images: 6, imageChars: 4_000_000,
  problemsMin: 3, problemsMax: 24, sheetMin: 4, sheetMax: 10, perDay: 8,
} as const;

// ─── Small helpers ───────────────────────────────────────────────────────────────────────────────
const clip = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[ \t]+/g, " ").trim().slice(0, n);
const list = (v: unknown, n: number, each: number) => (Array.isArray(v) ? v : typeof v === "string" && v.trim() ? [v] : []).map((x) => clip(typeof x === "object" && x ? (x as any).text ?? (x as any).work ?? "" : x, each)).filter(Boolean).slice(0, n);
const int = (v: unknown, lo: number, hi: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo; };

/** The AI's JSON, even if it wrapped it in a code fence or added a sentence around it. */
export function parseJsonLoose(raw: string): unknown {
  const text = String(raw ?? "").trim();
  try { return JSON.parse(text); } catch { /* try the next way */ }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)?.[1];
  if (fenced) { try { return JSON.parse(fenced); } catch { /* next */ } }
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch { /* give up */ } }
  return null;
}

/** Plain text the checks can read: the little markup (**bold**, `code`) taken out. */
export const plainText = (s: string) => String(s ?? "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]*)`/g, "$1");

function cleanPicture(v: any): XPicture | null {
  if (!v || typeof v !== "object") return null;
  if (v.kind === "tape") {
    const pieces = int(v.pieces, 1, 20);
    return { kind: "tape", label: clip(v.label, 90), pieces, filled: int(v.filled, 0, pieces), extra: int(v.extra, 0, 10), note: clip(v.note, 60) };
  }
  if (v.kind === "grid100") return { kind: "grid100", label: clip(v.label, 90), shaded: int(v.shaded, 0, 100) };
  return null;
}

export type Cleaned<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function cleanProblem(v: any, where: string, errors: string[]): XProblem | null {
  const id = clip(v?.id, 12), story = clip(v?.story ?? v?.q ?? v?.problem, 700);
  const here = `${where} ${id || "(no id)"}`;
  const hints = list(v?.hints, 3, 300), steps = list(v?.steps, 9, 400);
  const why = clip(v?.why, 500), check = clip(v?.check, 400), answer = clip(v?.answer, 300), finalAnswer = clip(v?.finalAnswer ?? v?.final_answer, 120);
  const bad: string[] = [];
  if (!id) bad.push("an id like 8.2a");
  if (!story) bad.push("the problem text (story)");
  if (hints.length < 2) bad.push("at least 2 hints (Hint 1, Hint 2, and Hint 3 when it helps)");
  if (steps.length < 2) bad.push("at least 2 numbered steps");
  if (!why) bad.push("why it works");
  if (!check) bad.push("a check");
  if (!answer) bad.push("the answer");
  if (!finalAnswer) bad.push("finalAnswer (the short answer only)");
  if (bad.length) { errors.push(`${here} is missing ${bad.join(", ")}.`); return null; }
  return {
    id, title: clip(v?.title, 90) || id, story, hints, steps, why, check, answer, finalAnswer,
    accept: [...new Set([finalAnswer, ...list(v?.accept, 8, 80)])],
    say: clip(v?.say ?? v?.sayToStudent, 400), picture: cleanPicture(v?.picture), verified: false,
  };
}

/** One rewritten problem from the repair step, or null if it is still missing parts. */
export const cleanProblemForRepair = (v: unknown, errors: string[] = []): XProblem | null => cleanProblem(v, "Repaired problem", errors);

function cleanSections(v: unknown, where: string, errors: string[]): XSection[] {
  const out: XSection[] = [];
  const seen = new Set<string>();
  for (const s of Array.isArray(v) ? v : []) {
    const problems: XProblem[] = [];
    for (const p of Array.isArray((s as any)?.problems) ? (s as any).problems : []) {
      const c = cleanProblem(p, where, errors);
      if (!c) continue;
      if (seen.has(c.id)) { errors.push(`${where} id ${c.id} is used twice. Every problem needs its own id.`); continue; }
      seen.add(c.id); problems.push(c);
    }
    if (problems.length) out.push({ title: clip((s as any)?.title, 120) || "Problems", intro: clip((s as any)?.intro, 500), problems });
  }
  return out;
}

const countProblems = (s: { problems: unknown[] }[]) => s.reduce((n, x) => n + x.problems.length, 0);

/** The exemplar reply, checked. A reply that is missing something comes back with exactly what is missing. */
export function cleanExemplar(raw: unknown): Cleaned<XExemplar> {
  return cleanExemplarCore(raw, (v, errors) => cleanSections(v, "Problem", errors), "fully solved problems");
}

// ─── Building it in small steps ──────────────────────────────────────────────────────────────────
// The free AI (Groq) allows only so many words a minute, far fewer than a whole guide with every problem
// worked out. So the guide is built in pieces: first an OUTLINE (the ideas, the recipe, the mistakes, the
// supports, and every problem copied out but not solved), then the problems are solved a few at a time,
// then it's put together and checked exactly like a guide written in one go. A problem the outline already
// solved fully is kept as it is.
export type XOutlineProblem = { id: string; title: string; story: string; solved: XProblem | null };
export type XOutlineSection = { title: string; intro: string; problems: XOutlineProblem[] };
export type XExemplarFrame = Omit<XExemplar, "sections"> & { sections: XOutlineSection[] };
export type XPracticeFrame = Omit<XPractice, "book"> & { book: XOutlineSection[] };
/** How many problems are solved in one ask. */
export const SOLVE_BATCH = 3;

function cleanOutline(v: unknown, where: string, errors: string[]): XOutlineSection[] {
  const out: XOutlineSection[] = [];
  const seen = new Set<string>();
  for (const s of Array.isArray(v) ? v : []) {
    const problems: XOutlineProblem[] = [];
    for (const p of Array.isArray((s as any)?.problems) ? (s as any).problems : []) {
      const id = clip(p?.id, 12), story = clip(p?.story ?? p?.q ?? p?.problem, 700);
      if (!id || !story) { errors.push(`${where} ${id || "(no id)"} needs an id and the problem text (story).`); continue; }
      if (seen.has(id)) { errors.push(`${where} id ${id} is used twice. Every problem needs its own id.`); continue; }
      seen.add(id);
      problems.push({ id, title: clip(p?.title, 90) || id, story, solved: cleanProblem(p, where, []) });
    }
    if (problems.length) out.push({ title: clip((s as any)?.title, 120) || "Problems", intro: clip((s as any)?.intro, 500), problems });
  }
  return out;
}
/** The outline reply, checked like the guide, except the problems only need an id and their text. */
export const cleanExemplarFrame = (raw: unknown): Cleaned<XExemplarFrame> => cleanExemplarCore(raw, (v, errors) => cleanOutline(v, "Problem", errors), "problems");
/** The practice outline: the sheet in full, the lesson's own practice problems only listed. */
export const cleanPracticeFrame = (raw: unknown): Cleaned<XPracticeFrame> => cleanPracticeCore(raw, (v, errors) => cleanOutline(v, "Book practice", errors));

/** Every problem in an outline that still needs solving, in order. */
export const unsolved = (sections: XOutlineSection[]): XOutlineProblem[] => sections.flatMap((s) => s.problems).filter((p) => !p.solved);

/** A reply of solved problems, checked: every problem asked for must come back, fully worked. */
export function cleanSolvedBatch(want: { id: string; title: string; story: string }[]): (raw: unknown) => Cleaned<XProblem[]> {
  return (raw) => {
    const r: any = raw && typeof raw === "object" ? raw : {};
    const got: any[] = Array.isArray(r.problems) ? r.problems : Array.isArray(raw) ? (raw as any[]) : [];
    const errors: string[] = [];
    const out: XProblem[] = [];
    want.forEach((w, i) => {
      const hit = got.find((g) => clip(g?.id, 12) === w.id) ?? (got.length === want.length ? got[i] : undefined);
      if (!hit) { errors.push(`Problem ${w.id} is missing. Send every problem you were given.`); return; }
      // The problem text and id stay as the outline had them (the AI may shorten them).
      const c = cleanProblem({ ...hit, id: w.id, title: hit?.title || w.title, story: w.story }, "Problem", errors);
      if (c) out.push(c);
    });
    return errors.length ? { ok: false, errors: errors.slice(0, 12) } : { ok: true, value: out };
  };
}

/** The outline's sections with the solved problems put in (the problem's own outline text kept). */
export function fillOutline(sections: XOutlineSection[], solved: Map<string, XProblem>): XSection[] {
  return sections.map((s) => ({ title: s.title, intro: s.intro, problems: s.problems.map((p) => p.solved ?? solved.get(p.id)).filter((x): x is XProblem => !!x) })).filter((s) => s.problems.length);
}

function cleanExemplarCore<S extends { problems: unknown[] }>(raw: unknown, cleanSecs: (v: unknown, errors: string[]) => S[], what: string): Cleaned<Omit<XExemplar, "sections"> & { sections: S[] }> {
  const r: any = raw && typeof raw === "object" ? raw : {};
  const errors: string[] = [];
  const title = clip(r.title, SPED_LIMITS.title);
  const oneSentence = clip(r.oneSentence ?? r.one_sentence, 500);
  if (!title) errors.push("title is missing.");
  if (!oneSentence) errors.push("oneSentence (the whole lesson in one sentence) is missing.");
  const howToUse = list(r.howToUse ?? r.how_to_use, 8, 300);
  if (howToUse.length < 3) errors.push("howToUse needs at least 3 steps telling the teacher how to use the guide.");
  const ideas: XIdea[] = [];
  for (const i of Array.isArray(r.ideas) ? r.ideas : []) {
    const text = list(i?.text, 5, 600), t = clip(i?.title, 100);
    if (t && text.length) ideas.push({ title: t, text, tryIt: clip(i?.tryIt ?? i?.try_it, 400), say: clip(i?.say, 400), picture: cleanPicture(i?.picture) });
  }
  if (ideas.length < 3) errors.push("ideas needs at least 3 tiny ideas (each with a title and text), explained like to an elementary student.");
  const rec = r.recipe && typeof r.recipe === "object" ? r.recipe : {};
  const rsteps: XRecipeStep[] = (Array.isArray(rec.steps) ? rec.steps : []).map((s: any) => ({ head: clip(s?.head ?? s?.title, 40), text: clip(s?.text ?? s?.work, 300) })).filter((s: XRecipeStep) => s.head && s.text).slice(0, 7);
  if (rsteps.length < 3) errors.push("recipe.steps needs 3 to 7 steps, each with a short head and a text.");
  const sections = cleanSecs(r.sections, errors);
  const n = countProblems(sections);
  if (n < SPED_LIMITS.problemsMin) errors.push(`sections needs at least ${SPED_LIMITS.problemsMin} ${what} (found ${n}).`);
  if (n > SPED_LIMITS.problemsMax) errors.push(`sections has ${n} problems; keep it to ${SPED_LIMITS.problemsMax} by merging look-alike problems.`);
  const mistakes = (Array.isArray(r.mistakes) ? r.mistakes : []).map((m: any) => ({ wrong: clip(m?.wrong, 300), fix: clip(m?.fix, 400) })).filter((m: { wrong: string; fix: string }) => m.wrong && m.fix).slice(0, 6);
  if (!mistakes.length) errors.push("mistakes needs at least 1 common mistake with how to fix it.");
  const sup = r.supports && typeof r.supports === "object" ? r.supports : {};
  const supports = { simplified: list(sup.simplified, 6, 300), modified: list(sup.modified, 6, 300), extension: list(sup.extension, 6, 300) };
  for (const k of ["simplified", "modified", "extension"] as const) if (supports[k].length < 2) errors.push(`supports.${k} needs at least 2 ideas.`);
  if (errors.length) return { ok: false, errors: errors.slice(0, 14) };
  return {
    ok: true,
    value: {
      title, kicker: clip(r.kicker, 120), grade: clip(r.grade, 4), source: clip(r.source, 300), oneSentence, howToUse, ideas,
      recipe: { name: clip(rec.name, 60) || "The recipe", steps: rsteps, examples: (Array.isArray(rec.examples) ? rec.examples : []).map((e: any) => ({ label: clip(e?.label, 60), value: clip(e?.value, 120) })).filter((e: { label: string; value: string }) => e.label && e.value).slice(0, 8) },
      sections, mistakes, supports,
    },
  };
}

/** The practice reply, checked the same way. */
export function cleanPractice(raw: unknown): Cleaned<XPractice> {
  return cleanPracticeCore(raw, (v, errors) => cleanSections(v, "Book practice", errors));
}
function cleanPracticeCore<S>(raw: unknown, cleanBook: (v: unknown, errors: string[]) => S[]): Cleaned<Omit<XPractice, "book"> & { book: S[] }> {
  const r: any = raw && typeof raw === "object" ? raw : {};
  const errors: string[] = [];
  const sheet: XPracticeItem[] = [];
  const seen = new Set<string>();
  for (const it of Array.isArray(r.sheet) ? r.sheet : []) {
    const id = clip(it?.id, 8), q = clip(it?.q ?? it?.story, 500), steps = list(it?.steps, 8, 400), answer = clip(it?.answer, 300), finalAnswer = clip(it?.finalAnswer ?? it?.final_answer, 120);
    if (!id || !q || steps.length < 2 || !answer || !finalAnswer) { errors.push(`sheet item ${id || "(no id)"} needs an id, the question q, at least 2 steps, an answer and a finalAnswer.`); continue; }
    if (seen.has(id)) { errors.push(`sheet id ${id} is used twice.`); continue; }
    seen.add(id); sheet.push({ id, q, steps, answer, finalAnswer, accept: [...new Set([finalAnswer, ...list(it?.accept, 8, 80)])], verified: false });
  }
  if (sheet.length < SPED_LIMITS.sheetMin) errors.push(`sheet needs at least ${SPED_LIMITS.sheetMin} practice questions (found ${sheet.length}).`);
  const book = cleanBook(r.book, errors);
  const quickRef = (Array.isArray(r.quickRef) ? r.quickRef : []).map((x: any) => ({ label: clip(x?.label, 40), text: clip(x?.text, 400) })).filter((x: { label: string; text: string }) => x.label && x.text).slice(0, 24);
  if (errors.length) return { ok: false, errors: errors.slice(0, 12) };
  return { ok: true, value: { sheetTitle: clip(r.sheetTitle, 80) || "Practice sheet", instructions: clip(r.instructions, 300) || "Use the recipe card. Show your steps.", sheet: sheet.slice(0, SPED_LIMITS.sheetMax), book, quickRef } };
}

/** Every solved problem, one list (for the checks). */
export const allProblems = (e: XExemplar, p: XPractice): XProblem[] => [...e.sections, ...p.book].flatMap((s) => s.problems);

// ─── The AI's instructions ───────────────────────────────────────────────────────────────────────
const VOICE = `Voice and math rules:
- Write to the TEACHER as "you", and give the words the teacher can say to the student in short sentences an elementary student understands. Words like "mystery number", "the start", "undo". Never shame a mistake.
- Define every word the first time (what "percent", "variable" or "equation" means) before using it.
- Plain-text math only: × ÷ − ² ³ √ π, fractions like 3/4, no LaTeX. You may use **bold** and \`code\` for numbers and equations. No other markdown, no HTML.
- Work every problem out yourself first. Every "=" you write must be exactly true. Check each answer by putting it back into the problem. Accuracy beats everything else.
- Every problem must stand on its own: copy every number, table or description a student needs INTO the problem text. If the lesson depends on a picture you can't see, give the method and say so in the step; never invent numbers.
- Use the lesson's own problems, numbers and wording ideas (it is licensed CC BY 4.0, so name the source). Do not invent a different lesson.`;

const WORKED = `{ "id": "8.4c", "title": "The T-shirt", "story": "After a 25% discount, a T-shirt costs $12. What was the price **before** the discount? Write the equation.",
  "hints": ["Do we know the price BEFORE or AFTER the discount?", "The discount is 25% off. How much is left?", "100% − 25% = 75%."],
  "steps": ["The start (the price before) is the mystery number **t**. The start is always 100%.", "It went **DOWN** 25%, so the percent now is 100% − 25% = **75%** = **0.75**.", "The $12 is the **end** amount.", "Equation: \`0.75 × t = 12\`.", "We know the END, so **divide**: \`t = 12 ÷ 0.75\`.", "Easy way: 0.75 is 3/4. \`12 ÷ 3/4 = 12 × 4 ÷ 3 = 48 ÷ 3 = 16\`."],
  "why": "We can't take 25% off $12 to get the start. The 25% came off the **old** price, not off $12.",
  "check": "\`0.75 × 16 = 12\` ✓ (3/4 of 16 is 12)",
  "answer": "Equation **0.75t = 12**. The old price was **$16**.", "finalAnswer": "16", "accept": ["$16", "16 dollars"],
  "say": "A discount takes some off the old price. The $12 is what is left, so we are working backward. Backward means divide.", "picture": null }`;

const OUTLINE_PROBLEM = `{ "id": "8.2a", "title": "short title", "story": "the problem exactly as a student sees it, with every number, table, choice or description it needs" }`;

/** Solving a few of the outline's problems, in the guide's voice and with its recipe. */
export function solveBatchPrompt(ask: { title: string; grade: string }, guide: { title: string; recipe: XExemplar["recipe"] }, problems: { id: string; title: string; story: string }[]): string {
  return `You are an expert special-education math coach solving problems for a teacher guide on "${guide.title || ask.title || "this lesson"}"${ask.grade ? ` (grade ${ask.grade})` : ""}. The reader is a special education teacher who has never taught this lesson and may have no math background.
Use the guide's recipe, the same steps every time: ${guide.recipe.steps.map((s) => `${s.head}: ${s.text}`).join(" | ")}

Solve each of these ${problems.length} problem${problems.length === 1 ? "" : "s"} fully:
${problems.map((p) => `- id ${p.id} (${p.title}): ${p.story}`).join("\n")}

Reply with one JSON object and nothing else: { "problems": [ <problem>, ... ] }, one for each problem above, same ids, same order.
<problem> is exactly this shape (this one is fully worked; copy its depth, order and voice):
${WORKED}
"picture" is null, or { "kind": "tape", "label": "text", "pieces": 4, "filled": 4, "extra": 1, "note": "" } or { "kind": "grid100", "label": "text", "shaded": 6 }.
- Every problem: 2 or 3 hints that go from a small nudge to nearly the answer, 3 to 7 numbered steps that show how you get the answer, why it works, a check that puts the answer back, the answer in words, finalAnswer (only the short answer, like "16"), and what to say.
${VOICE}`;
}

/** The instructions for the exemplar document. */
export function exemplarPrompt(ask: { title: string; grade: string }, mode: "whole" | "outline" = "whole"): string {
  const outline = mode === "outline";
  return `You are an expert special-education math coach writing a teacher guide called an EXEMPLAR. The reader is a special education teacher who has NEVER taught this lesson and may have no math background. You will be given one math lesson (typed text and/or photos of it${ask.title ? `: "${ask.title}"` : ""}${ask.grade ? `, grade ${ask.grade}` : ""}).

The teacher's requirements. Follow every one:
${SPED_REQUIREMENTS.map((r, i) => `${i + 1}. ${r.text}`).join("\n")}

Reply with one JSON object and nothing else, in exactly this shape:
{
  "title": "the lesson's name, like 'Percent Increase and Decrease'",
  "kicker": "grade, unit and lesson, like 'Grade 7 · Unit 4 · Lesson 8'",
  "grade": "K or 1–12",
  "source": "where the lesson comes from and its license, like 'Illustrative Mathematics Grade 7, Unit 4, Lesson 8 (Kendall Hunt), CC BY 4.0'. Say the guide is not endorsed by the publisher.",
  "oneSentence": "the whole lesson in one sentence a teacher can say out loud",
  "howToUse": ["3 to 6 short steps telling the teacher how to use this guide: read the ideas first, teach one box at a time, tape up the recipe card, give hints one at a time, then use the practice pack"],
  "ideas": [ { "title": "Idea 1. short title", "text": ["1 to 3 short paragraphs, as if explaining to a third grader"], "tryIt": "something to do with pennies, paper or the board", "say": "what to say to the student", "picture": null } ],
  "recipe": { "name": "The PERCENT recipe", "steps": [ { "head": "START", "text": "one short instruction" } ], "examples": [ { "label": "UP 6%", "value": "100% + 6% = 106% = 1.06" } ] },
  "sections": [ { "title": "8.2 Interest and depreciation", "intro": "one or two sentences", "problems": [ ${outline ? OUTLINE_PROBLEM : "<problem>"} ] } ],
  "mistakes": [ { "wrong": "the most common wrong answer or move", "fix": "the question to ask, and how to show it is wrong" } ],
  "supports": { "simplified": ["2 to 4 ideas: same goal, less load"], "modified": ["2 to 4 ideas: different way to show learning"], "extension": ["2 to 4 ideas for students who are ready for more"] }
}
${outline ? "" : `<problem> is exactly this shape (this one is fully worked; copy its depth, order and voice):
${WORKED}
`}"picture" is null, or { "kind": "tape", "label": "text", "pieces": 4, "filled": 4, "extra": 1, "note": "" } (a bar cut into equal pieces, "filled" shaded, "extra" dashed pieces added on the end) or { "kind": "grid100", "label": "text", "shaded": 6 }. Use pictures where a picture makes it easier.

How to build it:
- ideas: 4 to 6 tiny ideas, in the order a learner needs them (words and meaning first, then the skill, then why it works).
- recipe: 3 to 6 steps, the same every time, short enough for a desk card; include 3 to 6 examples.
- sections: put EVERY problem from the lesson (warm-up, activities, cool-down), ${outline ? "NOT solved yet (they are solved in the next step), each copied out completely so it stands on its own" : "solved"}, in the lesson's order. Number ids like the lesson does. Merge look-alike problems if there are more than ${SPED_LIMITS.problemsMax}. Do NOT include the lesson's separate practice set here (that goes in the practice pack).
${outline ? "" : `- Every problem: 2 or 3 hints that go from a small nudge to nearly the answer, 3 to 7 numbered steps that show how you get the answer, why it works, a check that puts the answer back, the answer in words, finalAnswer (only the short answer, like "16"), and what to say.
- If the lesson itself gives an answer, use it only if it agrees with your own work; if they disagree, trust your arithmetic and say so in the step.
`}${VOICE}`;
}

const SHEET_ITEM = `{ "id": "1", "q": "A $40 backpack goes up 10%. What is the new price?", "steps": ["UP 10%: 100% + 10% = 110% = 1.10.", "Equation: \`1.10 × 40 = new price\`.", "\`1.10 × 40 = 44\`."], "answer": "**$44**", "finalAnswer": "44", "accept": ["$44"] }`;

/** The instructions for the practice pack. It gets the finished exemplar's recipe so the practice matches. */
export function practicePrompt(ask: { title: string; grade: string }, ex: Pick<XExemplar, "title" | "recipe"> & { sections: { problems: { id: string; title: string }[] }[] }, mode: "whole" | "outline" = "whole"): string {
  const outline = mode === "outline";
  const skills = ex.sections.flatMap((s) => s.problems.map((p) => `${p.id} ${p.title}`)).slice(0, 30).join("; ");
  return `You are an expert special-education math coach writing the PRACTICE PACK that goes with a teacher guide for "${ex.title}"${ask.grade ? ` (grade ${ask.grade})` : ""}. The practice pack is a SEPARATE document from the guide.

The teacher's requirements for the practice pack:
- A student practice sheet with NO answers on it (4 to 8 new questions, easy to harder, using the same recipe as the guide: ${ex.recipe.steps.map((s) => s.head).join(" → ")}).
- The lesson's OWN practice problems, ${outline ? "listed but NOT solved yet (they are solved in the next step), each copied out completely so it stands on its own" : "solved with hints, steps, why, a check and the answer"} (the "book" part). If the lesson text you were given has no practice problems, use an empty list.
- An answer key with the steps for every sheet question, and a quick reference list of every answer in the lesson.
${SPED_REQUIREMENTS.filter((r) => ["zero", "correct", "simplest"].includes(r.id)).map((r) => `- ${r.text}`).join("\n")}

The guide already solves these problems: ${skills}. The sheet must use NEW numbers and stories that practice those skills, not repeat them.

Reply with one JSON object and nothing else:
{
  "sheetTitle": "Practice sheet",
  "instructions": "one short line for the student, like 'Use the recipe card. Show your steps.'",
  "sheet": [ ${SHEET_ITEM} ],
  "book": [ { "title": "The lesson's practice problems", "intro": "", "problems": [ ${outline ? OUTLINE_PROBLEM.replace('"8.2a"', '"P1"') : "<problem, same shape as in the guide, with ids like P1>"} ] } ],
  "quickRef": [ { "label": "8.2", "text": "$106 · $53 · $212 · $132.50 · 1.06x" } ]
}
${outline ? "" : `<problem> shape (fully worked; copy its depth and voice):
${WORKED}
`}For a multiple-choice or select-all problem, copy the choices into "story" so it stands alone. If a book problem needs a drawing, say what to draw in the steps ("picture": null or the tape/grid100 shapes are allowed).
${VOICE}`;
}

/** The text sent with the instructions: what the teacher gave us. */
export const lessonText = (ask: { title: string; grade: string; text: string }, images: number) =>
  [ask.title && `Lesson name: ${ask.title}`, ask.grade && `Grade: ${ask.grade}`, ask.text && `The lesson (typed or pasted):\n${ask.text}`, images ? `${images} attachment${images === 1 ? "" : "s"} (photos, or a PDF) of the lesson follow. Read every one closely, even if it is tilted or partly cut off.` : ""].filter(Boolean).join("\n\n");

/** What goes back to the AI when its reply was missing things: exactly what, nothing vague. */
export const fixText = (errors: string[]) => `Your last reply could not be used. Fix exactly these problems, keep everything that was already right, and send the WHOLE JSON object again (nothing else):\n- ${errors.join("\n- ")}`;

/** The AI's job when a problem failed the check: rewrite it, correctly. */
export const REPAIR_SYSTEM = `You are fixing teacher-guide math problems that failed a check. For each problem, work it out again from scratch, then send the corrected problem in the same shape. Every "=" must be exactly true. Keep the id, the problem text (unless it was missing a number a student needs) and the same voice: 2 or 3 hints, numbered steps, why, check, answer, finalAnswer, accept, say.
Reply with one JSON object and nothing else: { "problems": [ { "id": "...", "title": "...", "story": "...", "hints": ["..."], "steps": ["..."], "why": "...", "check": "...", "answer": "...", "finalAnswer": "...", "accept": ["..."], "say": "..." } ] }
Plain-text math only: × ÷ − ² ³ √ π, fractions like 3/4. You may use **bold** and \`code\`.`;

// ─── Documents (printable HTML; every word of AI text is escaped) ─────────────────────────────────
export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Escapes, then turns **bold** and `code` into tags. */
export const inline = (s: unknown) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

export function pictureSvg(p: XPicture | null): string {
  if (!p) return "";
  if (p.kind === "grid100") {
    let r = "";
    for (let i = 0; i < 100; i++) r += `<rect x="${(i % 10) * 18}" y="${Math.floor(i / 10) * 18}" width="17" height="17" rx="2" fill="${i < p.shaded ? "#0f766e" : "#fff"}" stroke="#9aa5b8"/>`;
    return `<figure><svg viewBox="0 0 180 180" width="150" height="150" role="img" aria-label="${esc(p.label || `${p.shaded} of 100 squares shaded`)}">${r}</svg><figcaption>${esc(p.label)}</figcaption></figure>`;
  }
  const w = 28, total = (p.pieces + p.extra) * w + 4;
  let r = "";
  for (let i = 0; i < p.pieces; i++) r += `<rect x="${i * w + 2}" y="22" width="${w}" height="30" fill="${i < p.filled ? "#bfe9e3" : "#fff"}" stroke="#0f766e" stroke-width="1.5"/>`;
  for (let j = 0; j < p.extra; j++) r += `<rect x="${(p.pieces + j) * w + 2}" y="22" width="${w}" height="30" fill="#ffd9a8" stroke="#b45309" stroke-width="1.5" stroke-dasharray="4 2"/>`;
  const width = Math.max(total, 330);
  return `<figure><svg viewBox="0 0 ${width} 84" width="${width * 1.2}" height="100" role="img" aria-label="${esc(p.label)}"><text x="2" y="14" font-size="11" font-weight="700" fill="#1d2433">${esc(p.label)}</text>${r}${p.note ? `<text x="${p.pieces * w + 2}" y="70" font-size="11" fill="#b45309">${esc(p.note)}</text>` : ""}</svg></figure>`;
}

export const DOC_CSS = `@page{size:Letter;margin:.7in .75in .8in}*{box-sizing:border-box}body{font:10.5pt/1.45 'DM Sans','Helvetica Neue',Arial,sans-serif;color:#1d2433;margin:0;padding:0 8px}
h1{font:700 28pt/1.1 Georgia,serif;margin:2pt 0 6pt}h2{font:700 18pt Georgia,serif;color:#0f766e;margin:0 0 6pt;break-after:avoid}h2+p{break-after:avoid}h3{font:700 13pt Georgia,serif;margin:0}h4{font:700 11.5pt Georgia,serif;margin:8pt 0 3pt}h5{font:700 8.5pt Arial,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#4a5468;margin:8pt 0 3pt;break-after:avoid}
.kicker{font:700 9pt Arial;letter-spacing:.08em;text-transform:uppercase;color:#0f766e;margin:0}.sub{color:#4a5468;font-size:12pt;margin:0 0 8pt}p{margin:0 0 6pt}
.part{break-before:page}.part:first-child{break-before:auto}
.box{border:1px solid #e0d9c8;border-radius:8pt;padding:8pt 11pt;margin:0 0 8pt;break-inside:avoid}.big{background:#d9f0ec;border-color:#0f766e;font-size:12.5pt}
ul,ol{margin:2pt 0 6pt;padding-left:18pt}li{margin:0 0 4pt}
ol.steps{list-style:none;counter-reset:s;padding:0}ol.steps li{counter-increment:s;position:relative;padding-left:24pt;margin:0 0 3pt;break-inside:avoid}ol.steps li::before{content:counter(s);position:absolute;left:0;top:0;width:18pt;height:18pt;border-radius:50%;background:#0f766e;color:#fff;font:700 10pt/18pt Arial;text-align:center}
.prob{border:1.5px solid #cfd8d6;border-radius:10pt;padding:9pt 12pt;margin:0 0 9pt;break-inside:avoid}.phead{display:flex;align-items:center;gap:8pt}.pid{background:#0f766e;color:#fff;border-radius:5pt;padding:1pt 7pt;font:700 10.5pt Arial}
.story{background:#faf7ef;border-radius:6pt;padding:4pt 8pt;margin:4pt 0;font-weight:600}
.hint{background:#fff6d6;border-left:5pt solid #e0a800;border-radius:6pt;padding:4pt 9pt;margin:4pt 0;break-inside:avoid}.hint ol{margin:2pt 0 0;padding-left:16pt}.hint li{margin:0 0 2pt}
.why{background:#e6eefb;border-left:5pt solid #3b6fd4;border-radius:6pt;padding:4pt 9pt;margin:4pt 0;break-inside:avoid}.check{background:#e4f5e8;border-left:5pt solid #2a8a47;border-radius:6pt;padding:4pt 9pt;margin:4pt 0;break-inside:avoid}
.answer{background:#0f766e;color:#fff;border-radius:6pt;padding:5pt 10pt;margin:4pt 0;font-size:11.5pt;break-inside:avoid}.kid{background:#d9f0ec;border-left:5pt solid #0f766e;border-radius:6pt;padding:4pt 9pt;margin:4pt 0;break-inside:avoid}
.warn{background:#fff0cf;border-left:5pt solid #b45309;border-radius:6pt;padding:4pt 9pt;margin:4pt 0;font-weight:600;break-inside:avoid}
.t{width:100%;border-collapse:collapse;font-size:10pt}.t th,.t td{text-align:left;padding:4pt 7pt;border-bottom:1px solid #e8e2d2;vertical-align:top}.t thead th{font:700 8pt Arial;text-transform:uppercase;letter-spacing:.05em;color:#4a5468}
figure{margin:4pt 0 6pt;text-align:center;break-inside:avoid}figcaption{font-size:9.5pt;color:#4a5468}
.recipe{border:3px solid #0f766e;border-radius:12pt;padding:12pt 16pt;background:#f2fbf9}.recipe h2{margin-bottom:8pt}.recipe .steps li{font-size:12.5pt;margin-bottom:8pt}
.blank{display:inline-block;border-bottom:1.5px solid #1d2433;min-width:90pt;height:12pt}.ws p{margin:0 0 16pt}.small{font-size:9pt;color:#4a5468}
code{font:600 10pt Menlo,Consolas,monospace;background:#f1ede2;padding:0 3pt;border-radius:3pt}`;

const shell = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${DOC_CSS}</style></head><body>${body}</body></html>`;
const ol = (a: string[]) => `<ol class="steps">${a.map((s) => `<li>${inline(s)}</li>`).join("")}</ol>`;

function problemHtml(p: XProblem): string {
  return `<section class="prob"><div class="phead"><span class="pid">${esc(p.id)}</span><h3>${esc(p.title)}</h3></div>
<p class="story">${inline(p.story)}</p>${pictureSvg(p.picture)}
<div class="hint"><b>Hints</b> (give one at a time, only if stuck)<ol>${p.hints.map((h, i) => `<li><b>Hint ${i + 1}:</b> ${inline(h)}</li>`).join("")}</ol></div>
<h5>How to solve it, step by step</h5>${ol(p.steps)}
<div class="why"><b>Why it works:</b> ${inline(p.why)}</div>
<div class="check"><b>Check it:</b> ${inline(p.check)}</div>
<div class="answer"><b>Answer:</b> ${inline(p.answer)}</div>
${p.say ? `<div class="kid"><b>Say it to the student:</b> ${inline(p.say)}</div>` : ""}
${p.verified ? "" : `<div class="warn">Double-check this one against your own copy before you teach it. Our automatic check could not confirm the answer.</div>`}</section>`;
}
const sectionsHtml = (secs: XSection[]) => secs.map((s) => `<h2>${esc(s.title)}</h2>${s.intro ? `<p>${inline(s.intro)}</p>` : ""}${s.problems.map(problemHtml).join("")}`).join("");

/** Document 1: the teacher's exemplar. Never contains the student practice sheet. */
export function exemplarHtml(e: XExemplar): string {
  const ladder = ["Ask: “What is the starting amount, or the first thing we know?”", "Ask: “What changed, and which way?”", "Draw the picture (the bar, the line or the grid).", "Give Hint 1, then Hint 2, then Hint 3.", "Only then show the steps, and have the student say each step back to you."];
  const cover = `<div class="part"><p class="kicker">${esc(e.kicker)}</p><h1>${esc(e.title)}</h1><p class="sub">Teach it from zero. Every problem has hints, the steps, why it works, and a check.</p>
<div class="box big"><b>The whole lesson in one sentence:</b> ${inline(e.oneSentence)}</div>
<h4>How to use this guide (you do not need to know any math first)</h4>${ol(e.howToUse)}
<div class="box"><h4>If a student gets stuck, do this, in this order</h4>${ol(ladder)}</div>
<p class="small">${esc(e.source)} Written for the Arise To Duo Math Lessons plugin. Not endorsed by the publisher. The student practice sheet and answer key are in the separate Practice Pack.</p></div>`;
  const ideas = `<div class="part"><p class="kicker">Part 1</p><h2>Tiny ideas, explained like you are talking to a 3rd grader</h2>${e.ideas.map((i) => `<div class="box"><h4>${esc(i.title)}</h4>${i.text.map((t) => `<p>${inline(t)}</p>`).join("")}${pictureSvg(i.picture)}${i.tryIt ? `<p><b>Try it:</b> ${inline(i.tryIt)}</p>` : ""}${i.say ? `<p><b>Say:</b> ${inline(i.say)}</p>` : ""}</div>`).join("")}</div>`;
  const recipe = `<div class="part"><p class="kicker">Part 2 · print and tape to the desk</p><div class="recipe"><h2>${esc(e.recipe.name)} (same steps every time)</h2>${ol(e.recipe.steps.map((s) => `**${s.head}.** ${s.text}`))}${e.recipe.examples.length ? `<table class="t"><tbody>${e.recipe.examples.map((x) => `<tr><td><b>${esc(x.label)}</b></td><td>${inline(x.value)}</td></tr>`).join("")}</tbody></table>` : ""}</div></div>`;
  const probs = `<div class="part"><p class="kicker">Part 3 · every problem in the lesson, solved</p>${sectionsHtml(e.sections)}</div>`;
  const wrap = `<div class="part"><h2>Common mistakes, and how to fix them</h2>${e.mistakes.map((m) => `<div class="box"><p><b>Wrong move:</b> ${inline(m.wrong)}</p><p><b>Fix:</b> ${inline(m.fix)}</p></div>`).join("")}
<h2>Supports for your students</h2>${(["simplified", "modified", "extension"] as const).map((k) => `<div class="box"><h4>${{ simplified: "Simplified (same goal, less load)", modified: "Modified (a different way to show learning; match the IEP)", extension: "Extension (ready for more)" }[k]}</h4><ul>${e.supports[k].map((s) => `<li>${inline(s)}</li>`).join("")}</ul></div>`).join("")}</div>`;
  return shell(`${e.title}: Exemplar`, cover + ideas + recipe + probs + wrap);
}

/** Document 2: the practice pack. Student sheet first (no answers), then the teacher copy. */
export function practiceHtml(e: Pick<XExemplar, "title" | "kicker" | "source" | "recipe">, p: XPractice): string {
  const cover = `<div class="part"><p class="kicker">${esc(e.kicker)}</p><h1>${esc(e.title)}</h1><p class="sub">Practice Pack: the student practice sheet, the lesson's practice solved, and the answer key.</p>
<div class="box big"><b>The recipe:</b> ${e.recipe.steps.map((s) => esc(s.head)).join(" → ")}</div>
<h4>What is in this pack</h4>${ol(["**Next page: the practice sheet** to give to the student (no answers on it).", "**Then: the lesson's own practice problems**, solved with hints, steps and checks (teacher copy).", "**Last pages: the answer key** for the practice sheet and a quick list of every answer in the lesson."])}
<p class="small">${esc(e.source)} This pack goes with the separate exemplar document.</p></div>`;
  const sheet = `<div class="part"><p class="kicker">Give this page to the student</p><h2>${esc(p.sheetTitle)}</h2><p>${inline(p.instructions)}</p><div class="ws">${p.sheet.map((s) => `<p><b>${esc(s.id)}.</b> ${inline(s.q)} <span class="blank"></span></p>`).join("")}</div></div>`;
  const book = p.book.length ? `<div class="part"><p class="kicker">Teacher copy</p>${sectionsHtml(p.book)}</div>` : "";
  const key = `<div class="part"><h2>Answer key for the practice sheet</h2><table class="t"><thead><tr><th>#</th><th>Steps</th><th>Answer</th></tr></thead><tbody>${p.sheet.map((s) => `<tr><td>${esc(s.id)}</td><td>${s.steps.map((x) => inline(x)).join(" ")}${s.verified ? "" : ` <b>(double-check this one)</b>`}</td><td><b>${inline(s.answer)}</b></td></tr>`).join("")}</tbody></table>
${p.quickRef.length ? `<div class="box" style="margin-top:10pt"><h4>Quick reference: every answer in the lesson</h4><table class="t"><tbody>${p.quickRef.map((q) => `<tr><td>${esc(q.label)}</td><td>${inline(q.text)}</td></tr>`).join("")}</tbody></table></div>` : ""}
<p class="small">${esc(e.source)}</p></div>`;
  return shell(`${e.title}: Practice Pack`, cover + sheet + book + key);
}
