// Problem Solver's AI (shared/problemSolver.ts has the rules):
//   POST /api/teacher-hub/solver/read  — a photo or PDF page of a problem, read into words (nothing solved).
//   POST /api/teacher-hub/solver/solve — the words, solved twice on their own; Arise recomputes every arithmetic
//        step and compares the two answers; when anything is off, a third pass sees both and settles it.
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { LessonAiError, askOpenAI, seePhotoAnyAi, type LessonAsk } from "./lessonPlanner";
import { cleanSolution, engineAgrees, engineNumber, sameAnswer, wrongChecks, type EngineCheck, type Solution, type SolveResult } from "../shared/problemSolver";

/** Asks a math engine for one short answer; "" when it has none. */
export type MathEngine = (query: string) => Promise<string>;

/**
 * Wolfram|Alpha's Short Answers API, when WOLFRAM_APP_ID is set (developer.wolframalpha.com). It computes;
 * it doesn't predict. "" for no answer, no key, or no reply within 12 seconds.
 */
export function wolframEngine(appId = process.env.WOLFRAM_APP_ID?.trim()): MathEngine | undefined {
  if (!appId) return undefined;
  return async (query) => {
    try {
      const r = await fetch(`https://api.wolframalpha.com/v1/result?appid=${encodeURIComponent(appId)}&units=nonmetric&i=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(12_000) });
      if (!r.ok) { if (r.status !== 501) console.error("[problem-solver] Wolfram|Alpha answered", r.status); return ""; }
      return (await r.text()).trim().slice(0, 300);
    } catch { return ""; }
  };
}

export type ProblemSolverDeps = { gate(req: any, res: any): Promise<unknown | null>; ask?: LessonAsk; seePhoto?: (dataUrl: string) => Promise<string>; engine?: MathEngine | null };

const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : "");
const limits = createAttemptLimiter({ max: 90, windowMs: 10 * 60_000 });

const SHAPE = `Return JSON only:
{"subject": string (Math, ELA, Science, Social Studies, Spanish…),
 "question": string (the problem in one line, as you understood it),
 "steps": [string] (short, numbered-in-order steps a student can follow; each step says what to do AND why; show the work),
 "answer": string (the final answer exactly as a student should write it),
 "value": string (ONLY when the answer is a number: plain arithmetic for it, like "7/8", "0.32", "-3", "14". Else ""),
 "choice": string (ONLY for multiple choice: the letter of the right choice. Else ""),
 "checks": [{"expr": string, "equals": string}] (EVERY arithmetic calculation in your steps, as plain arithmetic: {"expr": "120*3*12", "equals": "4320"}. Use only numbers, + - * / ^, parentheses, sqrt(). Empty for no arithmetic),
 "engineQuery": string (ONLY when "value" is filled: ONE Wolfram|Alpha input that computes the final answer straight from the problem's own numbers and units, without using your work, e.g. "(360 ft - (358 ft + 10 in)) / 360 ft as a percent", "solve 3x + 5 = 20 for x", "3/4 + 1/8". Else "")}`;

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

/**
 * Solves twice, checks the arithmetic and the agreement, settles any difference with a third pass, and,
 * for a number answer with a math engine on hand, has the engine compute it on its own: an answer the engine
 * disagrees with is solved again with the engine's result in hand, and never shown as checked unless they agree.
 */
export async function solveChecked(ask: LessonAsk, problem: string, extra: string, engine?: MathEngine | null): Promise<Omit<SolveResult, "read">> {
  const r = await solveByAi(ask, problem, extra);
  const q = r.solution.value && (r.solution.engineQuery || "");
  if (!engine || !q) return r;
  const said = await engine(q);
  const n = engineNumber(said);
  if (Number.isNaN(n)) return { ...r, engine: { result: "none" } };
  if (engineAgrees(r.solution.value, n)) {
    const check: EngineCheck = { result: "agrees", said };
    return r.verdict === "unsure"
      ? { solution: r.solution, verdict: "settled", note: `Wolfram|Alpha computed the same answer (${said}), so this one is confirmed.`, engine: check }
      : { ...r, note: `${r.note} Wolfram|Alpha computed the same answer (${said}).`, engine: check };
  }
  // The engine disagrees: solve again knowing what it computed (its input could have misread the problem too).
  const user = `${extra}PROBLEM:\n${problem}\n\nA solution gave ${r.solution.value}. The math engine Wolfram|Alpha, asked "${q}", computed: ${said}. Work the problem again from the start. If the engine's input matches the problem, its number is exact. If the engine's input misread the problem, explain that in a step and give the right answer.`;
  const j = cleanSolution(json(await ask(JUDGE, user, 3500).catch(() => "")));
  if (j && !wrongChecks(j.checks).length && engineAgrees(j.value, n))
    return { solution: j, verdict: "settled", note: `The first answer didn't match Wolfram|Alpha (${said}), so it was solved again; the new answer matches it, and every calculation was rechecked.`, engine: { result: "agrees", said } };
  return { solution: j || r.solution, verdict: "unsure", note: `Wolfram|Alpha computed ${said} for "${q}", which doesn't match this answer. Check which is right before using it.`, engine: { result: "disagrees", said } };
}

async function solveByAi(ask: LessonAsk, problem: string, extra: string): Promise<Omit<SolveResult, "read">> {
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
  const engine = deps.engine === undefined ? wolframEngine() : deps.engine;
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
      const out = await solveChecked(ask, problem, extra ? `${extra}\n\n` : "", engine);
      return res.json({ read: problem, ...out });
    } catch (e: any) { return failed(res, e); }
  });
}
