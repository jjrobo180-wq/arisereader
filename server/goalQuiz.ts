// Arise WorkHub: a short quiz made from one student's goals, for the teacher.
//
// AI writes the questions; they are saved in the teacher's WorkHub with the goals
// (shared/hubLinks.ts) and never shown to students on their own: the teacher gives the quiz from
// WorkHub (or on paper and types the score in), and the score goes on the student's profile and,
// for goals measured in percent, into the goal's progress
// (client/src/components/teacher-hub/HubGoalQuiz.tsx).
import type { Express, RequestHandler } from "express";


type Goal = { area?: string; text?: string; baseline?: number; target?: number; unit?: string };
export type GoalQuizDeps = {
  askAI?: (system: string, user: string) => Promise<string>;
};

const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** The AI's questions, made safe: 4 choices each, one right answer, plain text. */
export function cleanGoalQuestions(raw: unknown): { prompt: string; option_a_text: string; option_b_text: string; option_c_text: string; option_d_text: string; correct_answer: "A" | "B" | "C" | "D" }[] {
  const list = Array.isArray((raw as any)?.questions) ? (raw as any).questions : Array.isArray(raw) ? raw : [];
  const out = [];
  for (const q of list) {
    const options = Array.isArray(q?.options) ? q.options.map((o: unknown) => clip(o, 200)).filter(Boolean) : [];
    const prompt = clip(q?.question ?? q?.prompt, 400);
    const correct = String(q?.correct ?? q?.answer ?? "").trim().toUpperCase().slice(0, 1);
    if (!prompt || options.length !== 4 || !["A", "B", "C", "D"].includes(correct)) continue;
    out.push({ prompt, option_a_text: options[0], option_b_text: options[1], option_c_text: options[2], option_d_text: options[3], correct_answer: correct as "A" | "B" | "C" | "D" });
    if (out.length >= 15) break;
  }
  return out;
}

export function goalQuizPrompt(grade: string, count: number): string {
  return `You write a short check-in quiz a teacher gives one student, to see how they are doing on their IEP goals. The teacher gives you the goals.
Write ${count} multiple-choice questions a student${grade ? ` in grade ${grade}` : ""} can read and answer on their own, each one practising a skill a goal names (for a reading fluency or comprehension goal, a short passage question; for a math goal, a problem at the goal's level; for a writing goal, a grammar or sentence question).
Keep the language simple and kind. Never mention IEPs, goals, disabilities or the student's name. Each question has exactly 4 answer choices and one correct answer.
Reply with JSON only: {"title": "a short friendly title", "questions": [{"question": "...", "options": ["...", "...", "...", "..."], "correct": "A"}]}`;
}

async function askOpenAI(system: string, user: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1", temperature: 0.4, max_tokens: 4000, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(response.status === 429 ? "The AI is busy right now. Try again in a minute." : "The AI could not write the quiz. Try again.");
  const payload: any = await response.json().catch(() => null);
  return String(payload?.choices?.[0]?.message?.content || "");
}

export function registerGoalQuizRoutes(app: Express, authMiddleware: RequestHandler, deps: GoalQuizDeps = {}): void {
  const askAI = deps.askAI ?? askOpenAI;
  const teacherOnly = (req: any) => req.user && (req.user.role === "teacher" || req.user.isAdmin) && !req.adminPreview;

  app.post("/api/teacher-hub/goal-quiz", authMiddleware, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    if (!teacherOnly(req)) return res.status(403).json({ message: "Only teachers can make goal quizzes." });
    try {
      const goals: Goal[] = (Array.isArray(req.body?.goals) ? req.body.goals : []).slice(0, 12);
      const count = Math.max(3, Math.min(12, Number(req.body?.count) || 6));
      if (!goals.length) return res.status(400).json({ message: "Pick at least one goal." });
      if (!process.env.OPENAI_API_KEY && !deps.askAI) return res.status(503).json({ message: "AI is not set up on this site yet." });
      const goalLines = goals.map((g, i) => `${i + 1}. ${clip(g.area, 40) || "Goal"}: ${clip(g.text, 500)} (starts at ${Number(g.baseline) || 0}${g.unit ? ` ${clip(g.unit, 30)}` : ""}, target ${Number(g.target) || 0}${g.unit ? ` ${clip(g.unit, 30)}` : ""})`).join("\n");
      let parsed: any = null;
      try { parsed = JSON.parse(await askAI(goalQuizPrompt(clip(req.body?.grade, 10), count), `The goals:\n${goalLines}`)); } catch (e: any) { return res.status(502).json({ message: e?.message || "The AI could not write the quiz. Try again." }); }
      const questions = cleanGoalQuestions(parsed).map((q) => ({ prompt: q.prompt, options: [q.option_a_text, q.option_b_text, q.option_c_text, q.option_d_text], correct: "ABCD".indexOf(q.correct_answer) }));
      if (questions.length < 2) return res.status(502).json({ message: "The AI's quiz didn't come out right. Try again." });
      return res.json({ title: clip(parsed?.title, 80) || "Skill check", questions });
    } catch (error: any) {
      console.error("[goal-quiz] failed:", error?.message || error);
      return res.status(500).json({ message: "The quiz couldn't be made right now. Try again in a moment." });
    }
  });
}
