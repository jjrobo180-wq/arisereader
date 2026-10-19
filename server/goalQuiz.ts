// Arise WorkHub → A.R.I.S.E. Reader: a short quiz made from one student's goals.
//
// The teacher picks goals on a student's profile and their Reader account; AI writes the questions;
// it becomes a custom quiz (the same kind the Library already runs, level "Goal check") that only
// that student can see and take. When the student finishes, the score shows on the profile and on
// each goal, and can become a progress data point (client/src/components/teacher-hub/HubGoalQuiz.tsx).
//
// Who a goal check is for is kept in settings (`goal_quiz_for_<quizId>`), since the quizzes table
// only knows the teacher. customQuizFor() is what the Library and the quiz page ask.
import type { Express, RequestHandler } from "express";

export const GOAL_QUIZ_LEVEL = "Goal check";
export const goalQuizKey = (quizId: number | string) => `goal_quiz_for_${quizId}`;

type Goal = { area?: string; text?: string; baseline?: number; target?: number; unit?: string };
export type GoalQuizDeps = {
  getTeacherStudents(teacherId: number): Promise<{ id: number }[]>;
  createQuiz(creatorId: number, title: string, description: string, level: string, questions: any[], visibility: string, targetTeacherId: number | null, quizType: string): Promise<{ id: number }>;
  setSetting(key: string, value: string): Promise<void>;
  getSetting(key: string): Promise<string>;
  /** Completed attempts at these quizzes. */
  attempts(quizIds: number[]): Promise<{ id: number; quiz_id: number; user_id: number; score: number | null; total: number | null; completed_at: string | null; status: string }[]>;
  /** The quizzes, to check they're this teacher's. */
  quizzes(quizIds: number[]): Promise<{ id: number; creator_user_id: number }[]>;
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
  return `You write a short check-in quiz for one student, to see how they are doing on their IEP goals. The teacher gives you the goals.
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

/** Whether a goal check may be seen and taken by this user: only by the student it was made for. */
export async function goalQuizAllowed(quiz: { id: number; level?: string } | null, userId: number, getSetting: (k: string) => Promise<string>): Promise<boolean> {
  if (!quiz || quiz.level !== GOAL_QUIZ_LEVEL) return true;
  const target = Number(await getSetting(goalQuizKey(quiz.id)).catch(() => ""));
  return Number.isInteger(target) && target > 0 && target === Number(userId);
}

export function registerGoalQuizRoutes(app: Express, authMiddleware: RequestHandler, deps: GoalQuizDeps): void {
  const askAI = deps.askAI ?? askOpenAI;
  const teacherOnly = (req: any) => req.user && (req.user.role === "teacher" || req.user.isAdmin) && !req.adminPreview;

  app.post("/api/teacher-hub/goal-quiz", authMiddleware, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    if (!teacherOnly(req)) return res.status(403).json({ message: "Only teachers can make goal quizzes." });
    try {
      const studentId = Number(req.body?.readerUserId);
      const goals: Goal[] = (Array.isArray(req.body?.goals) ? req.body.goals : []).slice(0, 12);
      const count = Math.max(3, Math.min(12, Number(req.body?.count) || 6));
      const name = clip(req.body?.student, 80);
      if (!Number.isInteger(studentId) || studentId < 1) return res.status(400).json({ message: "Pick the student's A.R.I.S.E. Reader account." });
      if (!goals.length) return res.status(400).json({ message: "Pick at least one goal." });
      if (!req.user.isAdmin) {
        const mine = await deps.getTeacherStudents(req.user.id);
        if (!mine.some((s) => Number(s.id) === studentId)) return res.status(403).json({ message: "That student isn't in your A.R.I.S.E. Reader class." });
      }
      if (!process.env.OPENAI_API_KEY && !deps.askAI) return res.status(503).json({ message: "AI is not set up on this site yet." });
      const goalLines = goals.map((g, i) => `${i + 1}. ${clip(g.area, 40) || "Goal"}: ${clip(g.text, 500)} (starts at ${Number(g.baseline) || 0}${g.unit ? ` ${clip(g.unit, 30)}` : ""}, target ${Number(g.target) || 0}${g.unit ? ` ${clip(g.unit, 30)}` : ""})`).join("\n");
      let parsed: any = null;
      try { parsed = JSON.parse(await askAI(goalQuizPrompt(clip(req.body?.grade, 10), count), `The goals:\n${goalLines}`)); } catch (e: any) { return res.status(502).json({ message: e?.message || "The AI could not write the quiz. Try again." }); }
      const questions = cleanGoalQuestions(parsed);
      if (questions.length < 2) return res.status(502).json({ message: "The AI's quiz didn't come out right. Try again." });
      const title = clip(parsed?.title, 80) || "Skill check";
      const quiz = await deps.createQuiz(req.user.id, `${title}${name ? ` · ${name.split(" ")[0]}` : ""}`, "A quick check-in from your teacher.", GOAL_QUIZ_LEVEL, questions, "teacher_students", req.user.id, "regular");
      await deps.setSetting(goalQuizKey(quiz.id), String(studentId));
      return res.json({ id: String(quiz.id), title: `${title}${name ? ` · ${name.split(" ")[0]}` : ""}`, questions: questions.length });
    } catch (error: any) {
      console.error("[goal-quiz] create failed:", error?.message || error);
      return res.status(500).json({ message: "The quiz couldn't be made right now. Try again in a moment." });
    }
  });

  app.get("/api/teacher-hub/goal-quiz-results", authMiddleware, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    if (!teacherOnly(req)) return res.status(403).json({ message: "Only teachers can see goal quiz results." });
    try {
      const ids = String(req.query?.ids || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
      if (!ids.length) return res.json({ results: [] });
      const own = new Set((await deps.quizzes(ids)).filter((q) => req.user.isAdmin || Number(q.creator_user_id) === Number(req.user.id)).map((q) => Number(q.id)));
      const rows = (await deps.attempts([...own])).filter((a) => a.status === "completed");
      return res.json({ results: rows.map((a) => ({ attemptId: String(a.id), quizId: String(a.quiz_id), userId: a.user_id, score: a.score ?? 0, total: a.total ?? 0, completedAt: a.completed_at })) });
    } catch (error: any) {
      console.error("[goal-quiz] results failed:", error?.message || error);
      return res.status(500).json({ message: "Results couldn't be loaded right now." });
    }
  });
}
