// Problem Solver's AI (shared/problemSolver.ts has the rules):
//   POST /api/teacher-hub/solver/read  — a photo or PDF page of a problem, read into words (nothing solved).
//   POST /api/teacher-hub/solver/solve — the words, solved twice on their own; Arise recomputes every arithmetic
//        step and compares the two answers; when anything is off, a third pass sees both and settles it.
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { LessonAiError, askOpenAI, seePhotoAnyAi, type LessonAsk } from "./lessonPlanner";
import { cleanSolution, sameAnswer, wrongChecks, type Solution, type SolveResult } from "../shared/problemSolver";

export type ProblemSolverDeps = { gate(req: any, res: any): Promise<unknown | null>; ask?: LessonAsk; seePhoto?: (dataUrl: string) => Promise<string> };

const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : "");
const limits = createAttemptLimiter({ max: 90, windowMs: 10 * 60_000 });

const SHAPE = `Return JSON only:
{"subject": string (Math, ELA, Science, Social Studies, Spanish…),
 "question": string (the problem in one line, as you understood it),
 "steps": [string] (short, numbered-in-order steps a student can follow; each step says what to do AND why; show the work),
 "answer": string (the final answer exactly as a student should write it),
 "value": string (ONLY when the answer is a number: plain arithmetic for it, like "7/8", "0.32", "-3", "14". Else ""),
 "choice": string (ONLY for multiple choice: the letter of the right choice. Else ""),
 "checks": [{"expr": string, "equals": string}] (EVERY arithmetic calculation in your steps, as plain arithmetic: {"expr": "120*3*12", "equals": "4320"}. Use only numbers, + - * / ^, parentheses, sqrt(). Empty for no arithmetic)}`;

const RULES = `Rules:
- Read the problem exactly as written. Never change a number, word or answer choice. If something is unreadable or missing, say so in "question" and answer only what can be answered.
- Get it RIGHT. Work carefully, one small step at a time. Double-check every calculation before you write it.
- Math: write all math in LaTeX between $ signs. Every fraction is $\\frac{a}{b}$ (a mixed number is $3\\frac{1}{4}$), never a/b. Simplify fractions fully. Keep exact answers as fractions unless the problem asks for a decimal; give units. Money goes inside math with an escaped dollar sign, like $\\$18.00$; never write a bare $ before a number outside math.
- Reading, writing, grammar, science, social studies, languages: base the answer only on the text, picture or facts given, and quote or point to the evidence in the steps. Use real, widely accepted facts; never invent a fact, a quote or a source. When the question is open-ended, give a model answer a strong student would write, at the grade level of the problem.
- Multiple choice: say why the right choice is right and, in one line each, why the others are wrong.
- If the problem is several questions, answer every one: label them in the steps and list each answer in "answer" (1. … 2. …).
- No guessing: if a fact needed is not given and not common knowledge, say what is missing.`;

const SOLVER_A = `You are an expert K-12 teacher in every subject. Solve the student problem below and explain how to get the answer, so a teacher can walk a student through it.\n${RULES}\n${SHAPE}`;
const SOLVER_B = `You are a careful K-12 answer-key writer. Solve the problem below completely on your own. Then CHECK your answer a second way (work backwards, substitute it in, estimate, or reread the text for the evidence) before you give it, and include that check as the last step.\n${RULES}\n${SHAPE}`;
const JUDGE = `You are the final checker for a K-12 answer key. Two solvers worked the same problem on their own. Their answers disagree, or a calculation in their work was wrong when it was recomputed exactly (listed below). Work the problem again yourself from the start, carefully, then give the one correct solution. Use the recomputed values: they are exact.\n${RULES}\n${SHAPE}`;

function json(text: string): any {
  const t = text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "").trim();
  try { return JSON.parse(t); } catch { const m = /\{[\s\S]*\}/.exec(t); if (m) try { return JSON.parse(m[0]); } catch { /* none */ } }
  return null;
}
const describe = (x: Solution) => JSON.stringify({ steps: x.steps.map((st) => st.text), answer: x.answer, value: x.value, choice: x.choice });
const wrongWords = (w: ReturnType<typeof wrongChecks>) => w.map((c) => `- ${c.expr} is ${+c.actual.toPrecision(10)}, not ${c.equals}`).join("\n");

/** Solves twice, checks the arithmetic and the agreement, and settles any difference with a third pass. */
export async function solveChecked(ask: LessonAsk, problem: string, extra: string): Promise<Omit<SolveResult, "read">> {
  const user = `${extra}PROBLEM:\n${problem}`;
  const [ra, rb] = await Promise.allSettled([ask(SOLVER_A, user, 3500), ask(SOLVER_B, user, 3500)]);
  const a = ra.status === "fulfilled" ? cleanSolution(json(ra.value)) : null;
  const b = rb.status === "fulfilled" ? cleanSolution(json(rb.value)) : null;
  if (!a && !b) {
    const err = ra.status === "rejected" ? ra.reason : rb.status === "rejected" ? rb.reason : null;
    throw err instanceof LessonAiError ? err : new LessonAiError("The AI didn't send a usable answer. Try again.");
  }
  const wa = a ? wrongChecks(a.checks) : [], wb = b ? wrongChecks(b.checks) : [];
  if (a && b && !wa.length && !wb.length && sameAnswer(a, b)) return { solution: a, verdict: "checked", note: "Solved twice on its own; both got the same answer, and every calculation was rechecked." };

  // Something is off: a third pass sees both solutions and the recomputed arithmetic.
  const why = [
    a && b && !sameAnswer(a, b) ? "The two answers DISAGREE." : !a || !b ? "Only one solver answered." : "",
    wa.length ? `Solver 1's calculations that were wrong when recomputed:\n${wrongWords(wa)}` : "",
    wb.length ? `Solver 2's calculations that were wrong when recomputed:\n${wrongWords(wb)}` : "",
  ].filter(Boolean).join("\n");
  const judgeRaw = await ask(JUDGE, `${user}\n\nSOLVER 1: ${a ? describe(a) : "(none)"}\nSOLVER 2: ${b ? describe(b) : "(none)"}\n\nWHAT WAS FOUND:\n${why}`, 3500).catch(() => "");
  const j = cleanSolution(json(judgeRaw));
  const fallback = (a && !wa.length ? a : b && !wb.length ? b : a || b)!;
  if (!j) return { solution: fallback, verdict: "unsure", note: "The answers didn't match and the final check didn't finish. Look this one over before using it." };
  const wj = wrongChecks(j.checks);
  if (wj.length) return { solution: j, verdict: "unsure", note: `A calculation still doesn't add up (${wj.map((c) => `${c.expr} = ${+c.actual.toPrecision(10)}`).join("; ")}). Check it before using it.` };
  const backs = [a, b].filter((x): x is Solution => !!x).some((x) => sameAnswer(x, j));
  return backs
    ? { solution: j, verdict: "settled", note: "The first two answers didn't match, so it was solved a third time; that answer agrees with one of them, and every calculation was rechecked." }
    : { solution: j, verdict: "unsure", note: "Three tries gave different answers. This is the most careful one, but check it before using it." };
}

export function registerProblemSolverRoutes(app: Express, authMiddleware: RequestHandler, deps: ProblemSolverDeps) {
  const ask = deps.ask ?? askOpenAI;
  const see = deps.seePhoto ?? seePhotoAnyAi;
  const limited = (req: any, res: any) => {
    const who = `u${req.user?.id}`;
    const wait = limits.retryAfter(who);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); res.status(429).json({ message: `That's a lot of problems in a short time. Try again in ${waitWords(wait)}.` }); return true; }
    limits.fail(who);
    return false;
  };
  const failed = (res: any, e: any) => {
    if (e instanceof LessonAiError) return res.status(502).json({ message: e.message });
    console.error("[problem-solver] failed:", e?.message || e);
    return res.status(500).json({ message: "Something went wrong. Try again." });
  };

  app.post("/api/teacher-hub/solver/read", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    const images: string[] = (Array.isArray(req.body?.images) ? req.body.images : []).filter((u: unknown) => typeof u === "string" && /^data:image\/(png|jpe?g|webp);base64,/.test(u) && u.length <= 6_000_000).slice(0, 4);
    if (!images.length) return res.status(400).json({ message: "Add a photo or screenshot of the problem." });
    if (limited(req, res)) return;
    try {
      const parts: string[] = [];
      for (const u of images) parts.push((await see(u)).trim());
      const read = parts.filter(Boolean).join("\n\n").slice(0, 6000);
      if (read.replace(/\s+/g, "").length < 3) return res.status(400).json({ message: "No problem could be read in that picture. Try a closer, straighter photo." });
      return res.json({ read });
    } catch (e: any) { return failed(res, e); }
  });

  app.post("/api/teacher-hub/solver/solve", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    const problem = s(req.body?.problem, 6000);
    if (problem.replace(/\s+/g, "").length < 2) return res.status(400).json({ message: "Type or snap the problem first." });
    if (limited(req, res)) return;
    const grade = s(req.body?.grade, 20), subject = s(req.body?.subject, 40);
    const extra = [subject && `Subject: ${subject}.`, grade && `Explain it for a grade ${grade} student.`].filter(Boolean).join(" ");
    try {
      const out = await solveChecked(ask, problem, extra ? `${extra}\n\n` : "");
      return res.json({ read: problem, ...out });
    } catch (e: any) { return failed(res, e); }
  });
}
