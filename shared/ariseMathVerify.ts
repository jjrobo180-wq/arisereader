// A.R.I.S.E. Math: nothing the AI writes reaches a student unchecked. Three checks, in order:
//  1. Code redoes the arithmetic in every step ("61/8 × 2 = 122/8 = 15 1/4"), which an AI can't talk its way past.
//  2. A second AI solves each question from scratch, seeing only what the student will see. If it can't,
//     the question is missing something; if it gets a different answer, one of them is wrong.
//  3. Anything that fails is rewritten once and checked again. If it still fails, it is dropped.
import { cleanQuestion, type PrepQuestion, type PrepStep, type PrepTopic } from "./ariseMathPrep";

// ─── 1. The arithmetic ───

type Tok = { t: "n"; v: number; dec: boolean } | { t: "op"; v: string };
function tokens(s: string): Tok[] | null {
  const out: Tok[] = [];
  const re = /\s*(?:(\d[\d,]*\.\d+|\.\d+)|(\d[\d,]*)\s+(\d+)\s*\/\s*(\d+)|(\d[\d,]*)\s*\/\s*(\d+)|(\d[\d,]*)|([×x*÷+\-−–()/]))/gy;
  let at = 0;
  const num = (x: string) => Number(x.replace(/,/g, ""));
  while (at < s.length) {
    if (!s.slice(at).trim()) break;
    re.lastIndex = at;
    const m = re.exec(s);
    if (!m) return null;
    at = re.lastIndex;
    if (m[1]) out.push({ t: "n", v: num(m[1]), dec: true });
    else if (m[2]) { if (!num(m[4])) return null; out.push({ t: "n", v: num(m[2]) + num(m[3]) / num(m[4]), dec: false }); }
    else if (m[5]) { if (!num(m[6])) return null; out.push({ t: "n", v: num(m[5]) / num(m[6]), dec: false }); }
    else if (m[7]) out.push({ t: "n", v: num(m[7]), dec: false });
    else out.push({ t: "op", v: m[8] === "x" || m[8] === "*" ? "×" : m[8] === "/" ? "÷" : m[8] === "−" || m[8] === "–" ? "-" : m[8] });
  }
  return out.length ? out : null;
}
/** The value of plain arithmetic, or null if it's anything else (variables, units, a stray sign). */
function evaluate(s: string): { value: number; dec: boolean } | null {
  const toks = tokens(s);
  if (!toks) return null;
  let i = 0, dec = false, bad = false;
  const atom = (): number => {
    const t = toks[i];
    if (!t) { bad = true; return 0; }
    if (t.t === "n") { i++; if (t.dec) dec = true; return t.v; }
    if (t.v === "-") { i++; return -atom(); }
    if (t.v === "(") { i++; const v = sum(); if ((toks[i] as any)?.v !== ")") bad = true; i++; return v; }
    bad = true; return 0;
  };
  const product = (): number => {
    let v = atom();
    while (toks[i]?.t === "op" && (toks[i].v === "×" || toks[i].v === "÷")) { const op = toks[i].v; i++; const r = atom(); if (op === "÷" && !r) bad = true; v = op === "×" ? v * r : v / r; }
    return v;
  };
  const sum = (): number => {
    let v = product();
    while (toks[i]?.t === "op" && (toks[i].v === "+" || toks[i].v === "-")) { const op = toks[i].v; i++; const r = product(); v = op === "+" ? v + r : v - r; }
    return v;
  };
  const value = sum();
  return bad || i < toks.length ? null : { value, dec };
}
/**
 * Number sentences in the text that are false. Careful on purpose: "x + 3 = 5", "3x = 6" and "2 ft = 24 in"
 * are skipped, because numbers touching a variable or a loose sign aren't a whole sentence.
 */
export function wrongArithmetic(text: string): string[] {
  const wrong: string[] = [];
  for (const clause of text.split(/[.;:,!?]\s+|\n/)) {
    for (const m of clause.matchAll(/[\d(][\d\s.,/×x*÷+\-−–()]*(?:=[\s\d.,/×x*÷+\-−–()]+)+/g)) {
      const run = m[0].replace(/[\s.,]+$/, "");
      const before = clause.slice(0, m.index).trimEnd(), rest = clause.slice(m.index + run.length);
      if (/[×*÷+\-−–/=)^²³√%$]$|(?:^|[^A-Za-z])[A-Za-z]$/.test(before)) continue;
      if (/^[A-Za-z²³^%]/.test(rest) || /^\s*[×*÷+\-−–/=(^]/.test(rest) || /^\s*[A-Za-z](?![A-Za-z])/.test(rest)) continue;
      const parts = run.split("=").map((p) => p.trim()).filter(Boolean);
      if (parts.length < 2) continue;
      // "Block 2 = 30 min" and "20% of 50 = 10": a lone number after a word may belong to that word.
      if (/\bof$/i.test(before) || (/[A-Za-z]$/.test(before) && evaluate(parts[0]) && !/[×x*÷+\-−–/]/.test(parts[0]))) continue;
      const vals = parts.map(evaluate);
      if (vals.some((v) => !v)) continue;
      const room = vals.some((v) => v!.dec) ? 0.051 : 1e-9;
      if (vals.some((v) => Math.abs(v!.value - vals[0]!.value) > room)) wrong.push(run);
    }
  }
  return wrong;
}
/** A false number sentence in any of a question's solution steps or its hint. */
export function wrongInSteps(steps: PrepStep[], hint = ""): string[] {
  return [...steps.map((s) => s.work), hint].flatMap(wrongArithmetic);
}

// ─── 2. Do two answers agree? ───

const numbersIn = (s: string): number[] => [...s.replace(/,(?=\d{3})/g, "").matchAll(/(\d+)\s+(\d+)\s*\/\s*(\d+)|(\d+)\s*\/\s*(\d+)|\d*\.?\d+/g)]
  .map((m) => (m[1] ? Number(m[1]) + Number(m[2]) / Number(m[3]) : m[4] ? Number(m[4]) / Number(m[5]) : Number(m[0])));
const squash = (s: string) => s.toLowerCase().replace(/[−–]/g, "-").replace(/[\s.,$]/g, "").replace(/^[a-z]=/, "");
/** Whether two ways of writing an answer are the same: 3/4 and 0.75, "15 1/4 ft by 10 3/4 ft" and "15.25 by 10.75". */
export function sameAnswer(a: string, b: string): boolean {
  if (squash(a) === squash(b)) return true;
  const expression = (s: string) => /\d\s*[a-z]\b|[a-z]\s*[+\-−–=]|[+\-−–]\s*[a-z]/i.test(s.replace(/\b(ft|in|cm|mm|km|mi|yd|m|kg|lb|oz|g|l)\b/gi, ""));
  if (expression(a) || expression(b)) return false;
  const x = numbersIn(a).sort((p, q) => p - q), y = numbersIn(b).sort((p, q) => p - q);
  if (!x.length || x.length !== y.length) return false;
  if (/-\s*\d/.test(a.replace(/\d\s*-\s*\d/g, "")) !== /-\s*\d/.test(b.replace(/\d\s*-\s*\d/g, ""))) return false;
  return x.every((v, i) => Math.abs(v - y[i]) < 0.0051);
}

// ─── The AI's two jobs ───

export type SolveItem = { id: string; q: string; choices: string[] };
/** Solves questions cold. It never sees the answers it is checking. */
export const SOLVE_PROMPT = `You are checking math practice questions for students. You see each question exactly as a student will. Solve each one from scratch, carefully, using ONLY what is written in it.
Reply with one JSON object and nothing else: { "results": [ { "id": "the question's id", "solvable": true or false, "answer": "your answer (for multiple choice, the exact text of the choice)", "why": "if not solvable, what is missing" } ] }
"solvable" is false if it needs a number, table, picture, graph or earlier question that isn't in it, or if none of the choices is right. Never assume a missing number.`;
export const solveText = (items: SolveItem[]) => JSON.stringify(items);

export type Flagged = { id: string; why: string };
/** Which questions failed, from the code's check and the second AI's answers. */
export function judge(items: { id: string; question: Pick<PrepQuestion, "q" | "choices" | "answer" | "accept" | "steps" | "hint"> }[], solved: unknown): Flagged[] {
  const results: any[] = Array.isArray((solved as any)?.results) ? (solved as any).results : [];
  const byId = new Map(results.map((r) => [String(r?.id), r]));
  const flagged: Flagged[] = [];
  for (const { id, question: q } of items) {
    const wrong = wrongInSteps(q.steps, q.hint);
    const r = byId.get(id);
    if (wrong.length) flagged.push({ id, why: `This arithmetic is false: ${wrong.join("; ")}` });
    else if (!r) flagged.push({ id, why: "A second solver couldn't check it." });
    else if (r.solvable === false) flagged.push({ id, why: `A student can't solve it as written: ${String(r.why || "something is missing")}` });
    else if (![q.answer, ...q.accept].some((a) => sameAnswer(String(r.answer ?? ""), a))) flagged.push({ id, why: `A second solver got "${String(r.answer ?? "")}", not "${q.answer}".` });
  }
  return flagged;
}

export const REPAIR_PROMPT = `You are fixing math practice questions that failed a check. For each, write a corrected version of the same skill and level. Every number, table or description a student needs must be IN the question: never refer to a sheet, chart or picture they can't see. Work it out carefully and show every step correctly. To change a mixed number to a fraction, multiply and add: 7 5/8 = (7 × 8 + 5)/8 = 61/8, never 75/8.
Reply with one JSON object and nothing else: { "questions": [ { "id": "the same id", "q": "the full question", "choices": ["A", "B", "C", "D"] or [], "answer": "the answer (exactly one of the choices if multiple choice)", "accept": ["every correct way to write a typed answer"], "hint": "a nudge", "steps": [ { "title": "2–5 words", "work": "the step" } ] } ] }
Plain text math only: × ÷ − ² ³ √ π, fractions as 3/4. No LaTeX.`;

export type AskJson = (system: string, text: string) => Promise<unknown>;
export class CheckUnavailable extends Error {}

type Item = { id: string; question: PrepQuestion };
async function solveAndJudge(items: Item[], ask: AskJson): Promise<Flagged[]> {
  if (!items.length) return [];
  let solved: unknown;
  try { solved = await ask(SOLVE_PROMPT, solveText(items.map(({ id, question: q }) => ({ id, q: q.q, choices: q.choices })))); }
  catch (e: any) { throw new CheckUnavailable(e?.message || "the check failed"); }
  return judge(items, solved);
}

/** Checks questions and keeps their places: each is the question that passed, or null if it couldn't be fixed. */
export async function checkInPlace(questions: PrepQuestion[], ask: AskJson): Promise<(PrepQuestion | null)[]> {
  const items: Item[] = questions.map((question, i) => ({ id: String(i + 1), question }));
  const first = await solveAndJudge(items, ask);
  if (!first.length) return questions;
  const failed = new Set(first.map((f) => f.id));
  let fixed: Item[] = [];
  try {
    const raw: any = await ask(REPAIR_PROMPT, JSON.stringify(first.map((f) => { const q = questions[Number(f.id) - 1]; return { id: f.id, problem: f.why, q: q.q, choices: q.choices, answer: q.answer, steps: q.steps }; })));
    fixed = (Array.isArray(raw?.questions) ? raw.questions : []).flatMap((r: any): Item[] => { const q = failed.has(String(r?.id)) ? cleanQuestion(r) : null; return q ? [{ id: String(r.id), question: q }] : []; });
  } catch { fixed = []; }
  const still = new Set((await solveAndJudge(fixed, ask)).map((f) => f.id));
  const good = new Map(fixed.filter((f) => !still.has(f.id)).map((f) => [f.id, f.question]));
  return items.map((x) => (failed.has(x.id) ? good.get(x.id) ?? null : x.question));
}

/** The questions that passed. */
export const checkQuestions = async (questions: PrepQuestion[], ask: AskJson): Promise<PrepQuestion[]> => (await checkInPlace(questions, ask)).filter((q): q is PrepQuestion => !!q);

/** Checks every topic's questions and worked example. A topic with no questions left is dropped; a bad example just goes. */
export async function checkTopics(topics: PrepTopic[], ask: AskJson): Promise<PrepTopic[]> {
  const all: PrepQuestion[] = [];
  topics.forEach((t) => {
    all.push(...t.questions);
    if (t.example) all.push({ id: "example", q: t.example.problem, choices: [], answer: t.example.answer, accept: [t.example.answer], hint: "", steps: t.example.steps });
  });
  const passed = await checkInPlace(all, ask);
  let at = 0;
  return topics.flatMap((t): PrepTopic[] => {
    const questions = passed.slice(at, at + t.questions.length).filter((q): q is PrepQuestion => !!q);
    at += t.questions.length;
    let example = t.example;
    if (t.example) { const e = passed[at++]; example = e ? { problem: e.q, steps: e.steps, answer: e.answer } : null; }
    return questions.length ? [{ ...t, questions, example }] : [];
  });
}
