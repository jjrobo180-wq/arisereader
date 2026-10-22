// A.R.I.S.E. Math "Snap a problem": a student photographs or screenshots a math problem (or types
// it), and gets walked through it one step at a time without being handed the answer. They type
// their own final answer and the server says whether it's right. Then they get similar practice
// problems that DO come with every step and the answer.
//
// This file is shared by the server (which asks the AI and cleans its reply) and the tests. The
// final answer of the student's own problem stays on the server; the page never receives it.

export const PHOTO_LIMITS = {
  /** Photos (or typed problems) one person can send in a day. */
  perDay: 40,
  /** Final-answer checks on one problem, so the answer can't be found by guessing. */
  checksPerProblem: 12,
  /** How long a problem stays checkable. */
  keepMs: 6 * 3600_000,
  steps: 8,
  examples: 3,
  text: 600,
} as const;

export type TutorStep = {
  title: string;
  /** What to do in this step, and why. */
  explain: string;
  /** A small question the student answers to do the step themselves. */
  ask: string;
  /** The answer to `ask` (never the final answer to the whole problem). */
  check: string;
  /** A nudge if they get the check wrong. */
  hint: string;
};
export type ExampleStep = { title: string; work: string };
export type TutorExample = { problem: string; steps: ExampleStep[]; answer: string };
/** What the page gets. No final answer for the student's own problem. */
export type TutorReply = {
  problem: string;
  topic: string;
  skill: string | null;
  bigIdea: string;
  steps: TutorStep[];
  /** The last thing to do, described but not done. */
  finish: string;
  /** What their answer should look like ("a number", "x = ?", "a fraction in simplest form"). */
  answerForm: string;
  examples: TutorExample[];
  videoSearch: string;
};
export type TutorResult = { reply: TutorReply; accept: string[] } | { notMath: string };

const MINUS = /[−–—]/g;
const clip = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, n);

/** "x = 3/4", "0.75 ", "−2" → a comparable form. */
export function normalizeAnswer(raw: unknown): string {
  let s = String(raw ?? "").toLowerCase().replace(MINUS, "-").replace(/\$/g, "").replace(/,(?=\d{3}\b)/g, "");
  s = s.replace(/\s+/g, "").replace(/^[a-z]=/, "").replace(/\.$/, "").replace(/\*\*/g, "^");
  return s.slice(0, 80);
}

/** The number an answer stands for, or NaN: "3/4", "-2", ".5", "1 1/2", "40%". */
export function answerNumber(raw: unknown): number {
  const s = normalizeAnswer(raw);
  let m = s.match(/^(-?\d+)\s*(\d+)\/(\d+)$/);
  if (m && String(raw).trim().includes(" ")) { const w = Number(m[1]), f = Number(m[2]) / Number(m[3]); return w < 0 ? w - f : w + f; }
  const t = s.replace(/%$/, "").replace(/(cm|mm|m|km|in|ft|yd|mi|g|kg|lb|oz|l|ml|units?|sq\.?units?|degrees?|°|cents?|¢)\^?\d?$/, "");
  m = t.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  let v = NaN;
  if (m) v = Number(m[2]) ? Number(m[1]) / Number(m[2]) : NaN;
  else if (/^-?(\d+\.?\d*|\.\d+)$/.test(t)) v = Number(t);
  return v;
}

/** Drops any sentence that announces the final answer ("so the answer is 12", "x = 4"). */
function withoutAnswer(text: string, accept: string[]): string {
  const announces = (sentence: string) => accept.some((a) => {
    const n = answerNumber(a);
    const tokens = sentence.replace(/[−–—]/g, "-").match(/-?\d+(?:\.\d+)?(?:\/\d+)?/g) || [];
    const hasIt = tokens.some((t) => normalizeAnswer(t) === normalizeAnswer(a) || (!Number.isNaN(n) && Math.abs(answerNumber(t) - n) < 1e-9));
    return hasIt && /\banswer\b|\bfinal\b|\bsolution\b|^so\b|\btherefore\b/i.test(sentence);
  });
  return text.split(/(?<=[.!?])\s+/).filter((s) => !announces(s)).join(" ").trim();
}

/** Does what the student typed match one of the accepted answers? */
export function answerMatches(given: unknown, accept: string[]): boolean {
  const g = normalizeAnswer(given);
  if (!g) return false;
  const gn = answerNumber(given);
  for (const a of accept) {
    const an = normalizeAnswer(a);
    if (an && an === g) return true;
    const n = answerNumber(a);
    if (!Number.isNaN(gn) && !Number.isNaN(n) && Math.abs(gn - n) <= 1e-6 * Math.max(1, Math.abs(n))) return true;
    // Several answers ("2, 3" or "x = 2 or x = 3") in any order.
    const parts = (s: string) => s.split(/,|;|\bor\b|\band\b/i).map((p) => normalizeAnswer(p)).filter(Boolean).sort();
    const ap = parts(String(a)), gp = parts(String(given));
    if (ap.length > 1 && ap.length === gp.length && ap.every((p, i) => p === gp[i] || (!Number.isNaN(answerNumber(p)) && answerNumber(p) === answerNumber(gp[i])))) return true;
  }
  return false;
}

/** Turns the AI's JSON into a safe reply, or explains why it can't help. */
export function cleanTutorReply(raw: unknown, skillIds: readonly string[]): TutorResult {
  const r: any = raw && typeof raw === "object" ? raw : {};
  if (r.notMath || r.not_math) return { notMath: clip(r.notMath || r.not_math || "That doesn't look like a math problem.", 240) || "That doesn't look like a math problem." };
  const accept = (Array.isArray(r.accept) ? r.accept : [r.answer]).map((a: unknown) => clip(a, 60)).filter(Boolean).slice(0, 8);
  if (r.answer != null && !accept.includes(clip(r.answer, 60))) accept.unshift(clip(r.answer, 60));
  const problem = clip(r.problem, PHOTO_LIMITS.text);
  if (!problem || !accept.length) return { notMath: "I couldn't read a math problem there. Try a clearer photo of just one problem, or type it in." };

  const isFinal = (v: string) => answerMatches(v, accept);
  const steps: TutorStep[] = (Array.isArray(r.steps) ? r.steps : []).slice(0, PHOTO_LIMITS.steps).map((s: any) => {
    let ask = clip(s?.ask, 200), check = clip(s?.check, 60);
    // A step must never give away the whole answer.
    if (check && isFinal(check)) { ask = ""; check = ""; }
    const explain = withoutAnswer(clip(s?.explain, 500), accept);
    return { title: clip(s?.title, 80) || "Next step", explain, ask: check ? ask : "", check, hint: withoutAnswer(clip(s?.hint, 240), accept) };
  }).filter((s: TutorStep) => s.explain || s.ask);

  const examples: TutorExample[] = (Array.isArray(r.examples) ? r.examples : []).slice(0, PHOTO_LIMITS.examples).map((e: any) => ({
    problem: clip(e?.problem, 400),
    steps: (Array.isArray(e?.steps) ? e.steps : []).slice(0, PHOTO_LIMITS.steps).map((s: any) => ({ title: clip(s?.title, 80) || "Step", work: clip(s?.work ?? s?.explain, 400) })).filter((s: ExampleStep) => s.work),
    answer: clip(e?.answer, 80),
  })).filter((e: TutorExample) => e.problem && e.answer && e.steps.length);

  const skill = typeof r.skill === "string" && skillIds.includes(r.skill) ? r.skill : null;
  return {
    accept,
    reply: {
      problem, topic: clip(r.topic, 80) || "Math problem", skill,
      bigIdea: clip(r.bigIdea ?? r.big_idea, 400),
      steps: steps.length ? steps : [{ title: "Start here", explain: "Read the problem and write down what you know and what you need to find.", ask: "", check: "", hint: "" }],
      finish: clip(r.finish, 400) || "Use what you found to finish the problem, then type your answer.",
      answerForm: clip(r.answerForm ?? r.answer_form, 80) || "your answer",
      examples,
      videoSearch: clip(r.videoSearch ?? r.video_search, 80) || clip(r.topic, 80),
    },
  };
}

/** What the AI is asked to do. */
export function tutorPrompt(skills: { id: string; name: string }[], grade: string | null): string {
  return `You are a patient math tutor for K–12 students using A.R.I.S.E. Math.${grade ? ` The student is in grade ${grade}.` : ""}
A student sent a photo, a screenshot, or typed text of ONE math problem they are stuck on. Teach them how to solve it WITHOUT telling them the final answer.

Reply with one JSON object and nothing else.

If there is no math problem (a selfie, a random picture, an unreadable image, or something that is not schoolwork), reply {"notMath":"<one friendly sentence asking for a clear photo or the typed problem>"}. Never describe people in a picture. If there are several problems, use the first complete one, or the one that is circled or marked.

Otherwise reply:
{
  "problem": "the problem exactly as written, in plain text",
  "topic": "short topic name, like 'Two-step equations' or 'Adding fractions with unlike denominators'",
  "skill": "the id from the skill list below that matches best, or null",
  "bigIdea": "one or two sentences on the idea behind this kind of problem, in kid-friendly words",
  "steps": [
    { "title": "2–5 words", "explain": "what to do in this step and why, using the student's own numbers", "ask": "a small question so the student does this step themselves", "check": "the answer to ask (a number or short expression)", "hint": "a nudge if they get ask wrong" }
  ],
  "finish": "the last thing they need to do to get the answer, described but NOT done",
  "answerForm": "what the answer should look like, e.g. 'a whole number', 'x = ?', 'a fraction in simplest form', 'in square feet'",
  "answer": "the correct final answer (kept secret from the student, used only to check them)",
  "accept": ["every correct way to write the final answer, e.g. '3/4', '0.75', 'x=0.75'"],
  "examples": [
    { "problem": "a NEW problem of the same kind with different numbers", "steps": [ { "title": "2–5 words", "explain": "", "work": "the full worked step with the math shown" } ], "answer": "its answer" }
  ],
  "videoSearch": "3–6 word YouTube search for a lesson on this topic"
}

Rules:
- Work the problem out carefully yourself first, and check your final answer (substitute it back, or estimate). Accuracy matters more than anything.
- 2 to 6 steps. Each step moves one small piece forward. Use the student's numbers in "explain".
- No step's "check" may be the final answer, and "explain" must not state the final answer. Stop one step short: "finish" tells them what to do last.
- "examples": exactly 2 similar problems with different numbers, each fully worked with every step and its answer.
- Write math in plain text with symbols a student can read: × ÷ − ² ³ √ π ≤ ≥, fractions as 3/4, mixed numbers as 1 1/2. No LaTeX, no markdown.
- Short, warm, clear sentences for the student's grade. Never shame mistakes.

Skill list (id: name):
${skills.map((s) => `${s.id}: ${s.name}`).join("\n")}`;
}
