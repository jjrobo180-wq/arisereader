// A.R.I.S.E. Math "Test Prep": a student has a test coming up. They (or their teacher or parent)
// add what the test covers: photos of practice sheets, worksheets or sample problems, and/or the
// standard or name of the lesson. The AI reads it and builds a prep set: each topic on the test with
// how to do it (steps and a worked example, common mistakes), then practice questions with a hint and
// every step of the solution. A teacher can send a set to their class, a parent to their child.
//
// Shared by the server (server/ariseMathPrep.ts, which asks the AI and cleans its reply), the page
// (client/public/math/index.html) and the tests. This is practice, so answers do reach the page.

export const PREP_LIMITS = {
  /** Photos or screenshots in one request (shrunk to 1600 px on the device first). */
  images: 6,
  imageChars: 4_000_000,
  text: 2000,
  title: 80,
  topics: 6,
  questionsPerTopic: 12,
  steps: 8,
  /** Prep sets one person keeps (made by them or sent to them); the oldest drop off. */
  sets: 40,
  /** New prep sets one person can make a day, and "more questions" requests. */
  perDay: 12,
  morePerDay: 40,
  moreAtOnce: 5,
} as const;

export type PrepStep = { title: string; work: string };
export type PrepQuestion = {
  id: string;
  q: string;
  /** 2–4 choices for a multiple-choice question; empty when the answer is typed. */
  choices: string[];
  answer: string;
  /** Every correct way to write the answer (typed questions). */
  accept: string[];
  hint: string;
  steps: PrepStep[];
};
export type PrepTopic = {
  id: string;
  name: string;
  /** The standard it matches, like "6.EE.A.2", when there is one. */
  standard: string;
  summary: string;
  /** How to do this kind of problem, in general steps. */
  howTo: PrepStep[];
  example: { problem: string; steps: PrepStep[]; answer: string } | null;
  /** Mistakes students often make, and how to avoid them. */
  watchOut: string[];
  questions: PrepQuestion[];
};
export type PrepSet = {
  id: string;
  title: string;
  testDate: string;
  grade: string;
  overview: string;
  topics: PrepTopic[];
  ownerId: number;
  ownerName: string;
  ownerRole: string;
  /** Students it was sent to. */
  sharedWith: number[];
  createdAt: string;
};
export type PrepResult = { set: Omit<PrepSet, "id" | "ownerId" | "ownerName" | "ownerRole" | "sharedWith" | "createdAt"> } | { notMath: string };

const clip = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[ \t]+/g, " ").trim().slice(0, n);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
let seq = 0;
const newId = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** What the person typed about the test, made safe. */
export function cleanPrepAsk(body: any): { title: string; testDate: string; grade: string; text: string } {
  const testDate = typeof body?.testDate === "string" && DAY.test(body.testDate) ? body.testDate : "";
  const grade = /^(K|[1-9]|1[0-2])$/.test(String(body?.grade ?? "").trim()) ? String(body.grade).trim() : "";
  return { title: clip(body?.title, PREP_LIMITS.title), testDate, grade, text: clip(body?.text, PREP_LIMITS.text) };
}

function cleanSteps(v: unknown): PrepStep[] {
  return (Array.isArray(v) ? v : []).slice(0, PREP_LIMITS.steps)
    .map((s: any) => (typeof s === "string" ? { title: "", work: clip(s, 500) } : { title: clip(s?.title, 80), work: clip(s?.work ?? s?.explain, 500) }))
    .filter((s) => s.work);
}

/** One practice question from the AI, or null if it can't be used. */
export function cleanQuestion(v: any): PrepQuestion | null {
  const q = clip(v?.q ?? v?.question ?? v?.problem, 600);
  const answer = clip(v?.answer, 120);
  if (!q || !answer) return null;
  let choices = (Array.isArray(v?.choices) ? v.choices : []).map((c: unknown) => clip(c, 160)).filter(Boolean).slice(0, 4);
  choices = [...new Set(choices)];
  // A multiple-choice question must have its answer among the choices; otherwise it's typed.
  if (choices.length < 2 || !choices.includes(answer)) choices = [];
  const accept = [...new Set([answer, ...(Array.isArray(v?.accept) ? v.accept : []).map((a: unknown) => clip(a, 120))].filter(Boolean))].slice(0, 8);
  return { id: newId("q"), q, choices, answer, accept, hint: clip(v?.hint, 300), steps: cleanSteps(v?.steps) };
}

export function cleanTopic(v: any): PrepTopic | null {
  const name = clip(v?.name ?? v?.topic, 100);
  if (!name) return null;
  const questions = (Array.isArray(v?.questions) ? v.questions : []).map(cleanQuestion).filter(Boolean).slice(0, PREP_LIMITS.questionsPerTopic) as PrepQuestion[];
  if (!questions.length) return null;
  const ex = v?.example;
  const example = ex && clip(ex.problem, 600) && clip(ex.answer, 120) && cleanSteps(ex.steps).length
    ? { problem: clip(ex.problem, 600), steps: cleanSteps(ex.steps), answer: clip(ex.answer, 120) } : null;
  return {
    id: newId("t"), name, standard: clip(v?.standard, 40), summary: clip(v?.summary, 500),
    howTo: cleanSteps(v?.howTo ?? v?.how_to), example,
    watchOut: (Array.isArray(v?.watchOut ?? v?.watch_out) ? (v.watchOut ?? v.watch_out) : []).map((w: unknown) => clip(w, 240)).filter(Boolean).slice(0, 4),
    questions,
  };
}

/** Turns the AI's JSON into a prep set, or says why it couldn't make one. */
export function cleanPrepReply(raw: unknown, ask: { title: string; testDate: string; grade: string }): PrepResult {
  const r: any = raw && typeof raw === "object" ? raw : {};
  if (r.notMath || r.not_math) return { notMath: NO_MATH_FOUND };
  const topics = (Array.isArray(r.topics) ? r.topics : []).slice(0, PREP_LIMITS.topics).map(cleanTopic).filter(Boolean) as PrepTopic[];
  if (!topics.length) return { notMath: NO_MATH_FOUND };
  return {
    set: {
      title: ask.title || clip(r.title, PREP_LIMITS.title) || topics.map((t) => t.name).slice(0, 2).join(" & "),
      testDate: ask.testDate, grade: ask.grade || clip(r.grade, 4),
      overview: clip(r.overview, 500), topics,
    },
  };
}

/** "More questions" for one topic: the new ones only, none repeating a question it already has. */
export function cleanMore(raw: unknown, have: PrepQuestion[]): PrepQuestion[] {
  const r: any = raw && typeof raw === "object" ? raw : {};
  const seen = new Set(have.map((q) => q.q.toLowerCase()));
  return (Array.isArray(r.questions) ? r.questions : []).map(cleanQuestion).filter((q: PrepQuestion | null): q is PrepQuestion => !!q && !seen.has(q.q.toLowerCase())).slice(0, PREP_LIMITS.moreAtOnce);
}

const QUESTION_SHAPE = `{ "q": "the question, written out in full", "choices": ["A", "B", "C", "D"] or [] for a typed answer, "answer": "the correct answer (for multiple choice, exactly one of the choices)", "accept": ["every correct way to write a typed answer, e.g. '3/4', '0.75'"], "hint": "a nudge that doesn't give the answer away", "steps": [ { "title": "2–5 words", "work": "the full worked step with the math shown" } ] }`;

const RULES = `Rules:
- Work every problem out carefully yourself and check each answer (substitute it back, or estimate). Accuracy matters more than anything.
- Write math in plain text a student can read: × ÷ − ² ³ √ π ≤ ≥, fractions as 3/4, mixed numbers as 1 1/2. No LaTeX, no markdown.
- Short, warm, clear sentences for the student's grade. Never shame mistakes.
- Typed answers must be short (a number, an expression, or a few words) so they can be checked.`;

/** What the AI is asked to do to build a prep set. */
export function prepPrompt(ask: { title: string; testDate: string; grade: string }): string {
  return `You are an expert, patient K–12 math teacher using A.R.I.S.E. Math. A student has a math test coming up${ask.title ? ` ("${ask.title}")` : ""}.${ask.grade ? ` The student is in grade ${ask.grade}.` : ""}
You are given what the test covers: photos or screenshots of practice sheets, worksheets, study guides or sample problems, and/or typed text such as the lesson name, unit, or standard (like "6.EE.A.2" or "solving two-step equations"). Build practice that gets the student ready for THIS test.

Reply with one JSON object and nothing else.

A picture is all you need. Work out for yourself what type of problems these are; never ask for the lesson name or the standard.
Read every picture closely, even if it is rotated, sideways, tilted, shadowed, cropped, handwritten, a screenshot, a page of a textbook or a test, or only partly legible. If ANY numbers, equations, shapes, graphs, tables, measurements or word problems are visible, it IS math: build the practice from what you can read and make your best call on the rest. Directions in another language still count.
Reply {"notMath":true} ONLY when you are certain there is no math anywhere in the pictures and no topic was typed (a selfie, a pet, a landscape). Never describe people in a picture.

Otherwise reply:
{
  "title": "a short name for the test if none was given, like 'Fractions unit test'",
  "grade": "the grade this looks like, K or 1–12",
  "overview": "one or two sentences on what the test covers, for the student",
  "topics": [
    {
      "name": "the skill, like 'Adding fractions with unlike denominators'",
      "standard": "the Common Core (or state) standard code if you can tell, else ''",
      "summary": "one or two sentences on what this skill is and why it matters",
      "howTo": [ { "title": "2–5 words", "work": "one general step for solving this kind of problem" } ],
      "example": { "problem": "a problem like the ones on the sheet", "steps": [ { "title": "2–5 words", "work": "the full worked step" } ], "answer": "its answer" },
      "watchOut": ["a mistake students often make on this, and how to avoid it"],
      "questions": [ ${QUESTION_SHAPE} ]
    }
  ]
}

How to build it:
- Find every distinct skill the test covers (1 to ${PREP_LIMITS.topics} topics). Use the sheets' own kinds of problems, wording and difficulty, but NEW numbers: don't just copy the sheet's problems.
- If only a standard or lesson name is given, use what that standard or lesson teaches at that grade.
- Each topic: 3–5 howTo steps, one fully worked example, 1–3 watchOut tips, and 6 practice questions from easier to test-level, about half multiple choice and half typed. Word problems where the test would have them.
- Every question has every solution step and its answer.
${RULES}`;
}

/** A second, closer look at pictures the first try couldn't use: only read them, nothing else to get wrong. */
export function readPrompt(): string {
  return `You read math schoolwork from pictures. Reply with one JSON object and nothing else:
{ "hasMath": true or false, "types": ["each type of problem, like 'solving two-step equations'"], "gradeGuess": "K or 1–12, or ''", "problems": ["each problem as written, in plain text"] }
The pictures may be rotated, sideways, tilted, shadowed, cropped, handwritten or partly legible: turn them in your mind and read everything you can. Copy what you can read and make your best guess at the rest. Numbers, equations, shapes, graphs, tables, measurements or word problems all count as math. "hasMath" is false only when there is certainly no math in any picture. Never describe people.`;
}

export type PrepReading = { found: boolean; types: string[]; problems: string[]; grade: string };
/** What the closer look found. Anything that reads like math counts, whatever "hasMath" says. */
export function cleanReading(raw: unknown): PrepReading {
  const r: any = raw && typeof raw === "object" ? raw : {};
  const list = (v: unknown, n: number, each: number) => (Array.isArray(v) ? v : []).map((x) => clip(x, each)).filter(Boolean).slice(0, n);
  const types = list(r.types, PREP_LIMITS.topics, 120), problems = list(r.problems, 40, 300);
  const grade = /^(K|[1-9]|1[0-2])$/.test(String(r.gradeGuess ?? "").trim()) ? String(r.gradeGuess).trim() : "";
  return { found: r.hasMath === true || problems.some((p) => /\d/.test(p)), types, problems, grade };
}

/** The request built from a closer look, smaller so a long sheet can't run out of room. */
export function readingText(reading: PrepReading): string {
  return `The student's sheet has been read for you.
Types of problems: ${reading.types.join("; ") || "work these out from the problems"}
Problems on the sheet:
${reading.problems.map((p) => `- ${p}`).join("\n")}
Build the practice now. Keep it to at most 3 topics with 4 questions each.`;
}

/** Said only after two looks found no math. */
export const NO_MATH_FOUND = "I looked closely twice and couldn’t find any math in that picture. Try another picture of the page.";
/** Said when the math was read but the practice couldn't be built. Never blames the picture. */
export const COULD_NOT_BUILD = "I can read your sheet, but building the practice didn’t finish. Tap Build again.";

/** What the AI is asked to do for "more questions" on one topic. */
export function morePrompt(topic: Pick<PrepTopic, "name" | "standard" | "summary">, have: string[], grade: string): string {
  return `You are an expert K–12 math teacher using A.R.I.S.E. Math.${grade ? ` The student is in grade ${grade}.` : ""}
Write ${PREP_LIMITS.moreAtOnce} NEW practice questions for a test on: ${topic.name}${topic.standard ? ` (${topic.standard})` : ""}. ${topic.summary}
They must not repeat these questions the student already has:
${have.slice(-20).map((q) => `- ${q}`).join("\n")}

Reply with one JSON object and nothing else: { "questions": [ ${QUESTION_SHAPE} ] }
Mix easier and test-level questions, about half multiple choice and half typed, each with every solution step.
${RULES}`;
}

/** Days until the test ("today", "tomorrow", "in 3 days"), or "" when there's no date or it passed. */
export function daysUntil(testDate: string, today: string): string {
  if (!DAY.test(testDate) || !DAY.test(today)) return "";
  const n = Math.round((Date.parse(`${testDate}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  return n < 0 ? "" : n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
}
