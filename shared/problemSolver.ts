// Arise WorkHub: Problem Solver (a Plugin Gallery plugin). A teacher snaps or uploads a worksheet problem in
// any subject; the AI reads it (the teacher sees and can fix exactly what was read), solves it twice on its
// own, and Arise checks the work before showing it:
//   • every arithmetic step the AI claims ("14 ÷ 4,320 ≈ 0.00324") is recomputed here, with no AI;
//   • the two solves' final answers must agree (by value for numbers, by letter or wording otherwise);
//   • when either check fails, a third pass sees both solutions and the failed checks and settles it.
// The answer is only marked "Checked" when it passed. Fractions are always shown as real stacked fractions.
// The screen is client/src/components/teacher-hub/HubProblemSolver.tsx; the AI route is server/problemSolver.ts.

export type SolveStep = { text: string };
/** An arithmetic claim in the work, rechecked here: `expr` must come out to `equals`. */
export type MathCheck = { expr: string; equals: string };
export type Solution = {
  subject: string;
  /** The question in one line, as understood. */
  question: string;
  steps: SolveStep[];
  /** The final answer as the student would write it (math in $…$). */
  answer: string;
  /** For a number answer: plain arithmetic for its value ("7/8", "0.32", "-3"). Else "". */
  value: string;
  /** For multiple choice: the letter. Else "". */
  choice: string;
  checks: MathCheck[];
};
export type Verdict = "checked" | "settled" | "unsure";
export type SolveResult = { read: string; solution: Solution; verdict: Verdict; note: string };

/** One solved problem kept in the teacher's history (no photo is kept, only what was read). */
export type SolvedProblem = SolveResult & { id: string; at: string };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : typeof v === "number" ? String(v) : "");

// ── Fractions: always real, stacked fractions ──────────────────────────────

/**
 * Plain-text fractions outside math made into real ones: "1/2" → $\frac{1}{2}$, "3 1/4" → $3\frac{1}{4}$,
 * "-5/8" → $-\frac{5}{8}$. Dates (11/19 or 11/19/2026), ratios with a colon, links and math already in $…$
 * are left alone. Inside $…$, "a/b" between plain numbers also becomes \frac.
 */
export function realFractions(text: string): string {
  return String(text || "").split(/(\$\$[^$]+\$\$|\$[^$\n]+\$)/g).map((part) => {
    if (part.startsWith("$")) {
      return part.replace(/(^|[^\\\w.}])(\d+)\s*\/\s*(\d+)(?![\w./])/g, (_m, pre, a, b) => `${pre}\\frac{${a}}{${b}}`);
    }
    if (/https?:\/\//.test(part)) return part;
    return part
      // a mixed number first: "3 1/4"
      .replace(/(^|[^\w/.:])(-?)(\d+) (\d+)\/(\d+)(?![\w/]|\.\d)/g, (_m, pre, neg, w, a, b) => `${pre}$${neg}${w}\\frac{${a}}{${b}}$`)
      // then a plain one: "1/2", "-5/8" — but not dates like 11/19 or 11/19/2026
      .replace(/(^|[^\w/.:$])(-?)(\d{1,6})\/(\d{1,6})(?![\w/]|\.\d)/g, (m, pre, neg, a, b, at: number, all: string) => (looksLikeDate(a, b, all.slice(Math.max(0, at - 14), at + m.length)) ? m : `${pre}$${neg}\\frac{${a}}{${b}}$`));
  }).join("");
}
/** "11/19" in a sentence is more likely a date than a fraction when it's a real month/day and not a math word problem. */
function looksLikeDate(a: string, b: string, whole: string): boolean {
  const m = Number(a), d = Number(b);
  return /\b(on|by|due|date|from|until)\b/i.test(whole) && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

// ── A calculator for checking the AI's arithmetic (no AI) ──────────────────

/**
 * The value of plain arithmetic: numbers (1,234.5 or 1/2 or 3.2e4), + − × ÷ * / ^, parentheses, %, √ / sqrt(),
 * pi, abs(). LaTeX the AI might use (\frac{a}{b}, \cdot, \times, \div) is read too. Returns NaN for anything else.
 */
export function evaluate(raw: string): number {
  let s = String(raw || "")
    .replace(/\$/g, "")
    .replace(/\\[dt]?frac\{([^{}]+)\}\{([^{}]+)\}/g, "(($1)/($2))")
    .replace(/\\sqrt\{([^{}]+)\}/g, "sqrt($1)")
    .replace(/\\left|\\right|\\,|\\!|\\;/g, "")
    .replace(/\\times|×|\\cdot|·|⋅/g, "*").replace(/\\div|÷/g, "/").replace(/−|–/g, "-").replace(/\\pi|π/g, "pi").replace(/√/g, "sqrt")
    .replace(/[{}]/g, (c) => (c === "{" ? "(" : ")"))
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/\s+/g, "")
    .toLowerCase();
  if (!s || s.length > 300 || /[^0-9a-z.+\-*/^()%]/.test(s)) return NaN;
  let i = 0;
  const peek = () => s[i];
  const word = () => { const m = /^[a-z]+/.exec(s.slice(i)); return m ? m[0] : ""; };
  function expr(): number { let v = term(); while (peek() === "+" || peek() === "-") { const op = s[i++]; const r = term(); v = op === "+" ? v + r : v - r; } return v; }
  function term(): number {
    let v = power();
    for (;;) {
      if (peek() === "*" || peek() === "/") { const op = s[i++]; const r = power(); v = op === "*" ? v * r : v / r; }
      else if (peek() === "(" || /[0-9a-z]/.test(peek() || "")) { v *= power(); } // 2(3) or 2pi
      else return v;
    }
  }
  function power(): number { const b = unary(); if (peek() === "^") { i++; return Math.pow(b, power()); } return b; }
  function unary(): number { if (peek() === "-") { i++; return -unary(); } if (peek() === "+") { i++; return unary(); } return postfix(); }
  function postfix(): number { let v = atom(); while (peek() === "%") { i++; v /= 100; } return v; }
  function atom(): number {
    if (peek() === "(") { i++; const v = expr(); if (s[i++] !== ")") return NaN; return v; }
    const w = word();
    if (w) {
      i += w.length;
      if (w === "pi") return Math.PI;
      if (w === "e" ) return Math.E;
      if (w === "sqrt" || w === "abs") { const v = peek() === "(" ? atom() : atom(); return w === "sqrt" ? Math.sqrt(v) : Math.abs(v); }
      return NaN;
    }
    const m = /^(\d+\.?\d*|\.\d+)(e-?\d+)?/.exec(s.slice(i));
    if (!m) return NaN;
    i += m[0].length;
    return Number(m[0]);
  }
  const v = expr();
  return i === s.length && Number.isFinite(v) ? v : NaN;
}

/** Two numbers the same, allowing for rounding in the last shown place ("0.00324" for 0.0032407…). */
export function sameNumber(a: number, b: number, shown = ""): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))) return true;
  const dec = /\.(\d+)/.exec(shown.replace(/[^0-9.]/g, ""))?.[1]?.length;
  const tol = dec !== undefined ? 0.5 * Math.pow(10, -dec) + 1e-12 : 1e-6 * Math.max(1, Math.abs(b));
  return Math.abs(a - b) <= tol;
}

/** The arithmetic claims that don't add up, recomputed here. Claims that can't be read as plain arithmetic are skipped. */
export function wrongChecks(checks: MathCheck[]): { expr: string; equals: string; actual: number }[] {
  const out: { expr: string; equals: string; actual: number }[] = [];
  for (const c of checks) {
    const actual = evaluate(c.expr), claimed = evaluate(c.equals);
    if (Number.isNaN(actual) || Number.isNaN(claimed)) continue;
    if (!sameNumber(actual, claimed, c.equals)) out.push({ ...c, actual });
  }
  return out;
}

const fold = (s: string) => s.toLowerCase().replace(/\$|\\[a-z]+|[{}]/g, " ").replace(/[^a-z0-9.\-/ ]+/g, " ").replace(/\s+/g, " ").trim();
/** Whether two solutions reach the same final answer: same value, same letter, or (for words) the same wording. */
export function sameAnswer(a: Solution, b: Solution): boolean {
  if (a.choice && b.choice) return a.choice.trim().toUpperCase() === b.choice.trim().toUpperCase();
  const va = evaluate(a.value), vb = evaluate(b.value);
  if (!Number.isNaN(va) && !Number.isNaN(vb)) return sameNumber(va, vb, a.value) || sameNumber(vb, va, b.value);
  const fa = fold(a.answer), fb = fold(b.answer);
  if (!fa || !fb) return false;
  if (fa === fb || fa.includes(fb) || fb.includes(fa)) return true;
  // Open-ended answers rarely match word for word: most of the key words in common counts as the same answer.
  const wa = new Set(fa.split(" ").filter((w) => w.length > 3)), wb = fb.split(" ").filter((w) => w.length > 3);
  if (!wa.size || !wb.length) return false;
  return wb.filter((w) => wa.has(w)).length / Math.max(wa.size, wb.length) >= 0.6;
}

/** A solution from the AI, made safe, with every fraction made real. */
export function cleanSolution(raw: any): Solution | null {
  const steps = (Array.isArray(raw?.steps) ? raw.steps : []).slice(0, 20)
    .map((x: any) => ({ text: realFractions(str(typeof x === "string" ? x : x?.text, 1200)) }))
    .filter((x: SolveStep) => x.text);
  const answer = realFractions(str(raw?.answer, 1200));
  if (!answer) return null;
  return {
    subject: str(raw?.subject, 40),
    question: realFractions(str(raw?.question, 800)),
    steps, answer,
    value: str(raw?.value, 80),
    choice: /^[A-Ja-j]$/.test(str(raw?.choice, 2)) ? str(raw?.choice, 2).toUpperCase() : "",
    checks: (Array.isArray(raw?.checks) ? raw.checks : []).slice(0, 30).map((c: any) => ({ expr: str(c?.expr, 200), equals: str(c?.equals, 80) })).filter((c: MathCheck) => c.expr && c.equals),
  };
}

export function cleanSolved(raw: unknown): SolvedProblem[] {
  if (!Array.isArray(raw)) return [];
  const out: SolvedProblem[] = [];
  for (const r of raw.slice(0, 60)) {
    const solution = cleanSolution((r as any)?.solution);
    const id = str((r as any)?.id, 60);
    if (!solution || !id) continue;
    const v = (r as any).verdict;
    out.push({ id, at: str((r as any).at, 40), read: str((r as any).read, 6000), solution, verdict: v === "checked" || v === "settled" ? v : "unsure", note: str((r as any).note, 400) });
  }
  return out;
}

/** The solution as plain text to paste anywhere (fractions as a/b, since plain text can't stack them). */
export function solutionText(r: Pick<SolveResult, "solution">): string {
  const plain = (t: string) => t.replace(/\$([^$]+)\$/g, (_m, tex: string) => tex
    .replace(/\\[dt]?frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1/$2").replace(/\\times/g, "×").replace(/\\div/g, "÷").replace(/\\cdot/g, "·")
    .replace(/\\sqrt\{([^{}]+)\}/g, "√($1)").replace(/\\(text|mathrm)\{([^{}]*)\}/g, "$2").replace(/\\approx/g, "≈").replace(/\\le/g, "≤").replace(/\\ge/g, "≥")
    .replace(/\\pi/g, "π").replace(/\\[a-z]+/g, "").replace(/[{}]/g, ""));
  const s = r.solution;
  return [s.question && `Problem: ${plain(s.question)}`, ...s.steps.map((x, i) => `${i + 1}. ${plain(x.text)}`), `Answer: ${plain(s.answer)}`].filter(Boolean).join("\n");
}
