import type { Express } from "express";
import { randomBytes } from "node:crypto";
import { getAdminSupabase } from "./supabase";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () => Array.from(randomBytes(6), n => alphabet[n % alphabet.length]).join("");
const teacher = (user: any) => Boolean((user?.isAdmin || user?.role === "teacher") && user?.accountApproved !== false);
const student = (user: any) => user?.role === "student" && user?.accountApproved !== false;

function parseQuestions(input: unknown) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 30) throw new Error("Add 1 to 30 questions.");
  return input.map((item: any, index: number) => {
    const prompt = String(item?.prompt || "").trim();
    const options = item?.options;
    const correct = String(item?.correct || "").toUpperCase();
    if (prompt.length < 3 || prompt.length > 240 || !Array.isArray(options) || options.length !== 4 ||
        options.some((option: unknown) => typeof option !== "string" || !option.trim() || option.trim().length > 120) ||
        !["A", "B", "C", "D"].includes(correct)) {
      throw new Error(`Check question ${index + 1}: add a question, four answers, and the correct choice.`);
    }
    return { prompt, options: options.map((option: string) => option.trim()), correct };
  });
}

export function registerLiveQuizRoutes(app: Express, auth: any) {
  const db = () => getAdminSupabase();
  const error = (res: any, issue: any) => res.status(400).json({ message: issue?.message || "Please try again." });

  app.get("/api/live-quizzes", auth, async (req: any, res) => {
    if (!teacher(req.user)) return res.status(403).json({ message: "Teacher access required" });
    const { data, error: issue } = await db().from("live_quizzes").select("id,title,created_at,questions")
      .eq("teacher_id", req.user.id).order("created_at", { ascending: false }).limit(100);
    if (issue) return error(res, issue);
    res.json((data || []).map(q => ({ id: q.id, title: q.title, questionCount: q.questions.length, createdAt: q.created_at })));
  });

  app.post("/api/live-quizzes", auth, async (req: any, res) => {
    if (!teacher(req.user)) return res.status(403).json({ message: "Teacher access required" });
    try {
      const title = String(req.body?.title || "").trim();
      if (title.length < 3 || title.length > 100) throw new Error("Give your quiz a title of 3 to 100 characters.");
      const questions = parseQuestions(req.body?.questions);
      const { data, error: issue } = await db().from("live_quizzes")
        .insert({ teacher_id: req.user.id, title, questions }).select("id,title").single();
      if (issue) throw issue;
      res.status(201).json(data);
    } catch (issue) { error(res, issue); }
  });

  app.post("/api/live-quizzes/:id/host", auth, async (req: any, res) => {
    if (!teacher(req.user)) return res.status(403).json({ message: "Teacher access required" });
    try {
      const client = db();
      const { data: quiz } = await client.from("live_quizzes").select("id")
        .eq("id", Number(req.params.id)).eq("teacher_id", req.user.id).maybeSingle();
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });
      for (let i = 0; i < 5; i++) {
        const { data, error: issue } = await client.from("live_sessions")
          .insert({ quiz_id: quiz.id, teacher_id: req.user.id, code: code() })
          .select("id,code").single();
        if (!issue) return res.status(201).json(data);
        if (issue.code !== "23505") throw issue;
      }
      throw new Error("Could not create a room code. Please try again.");
    } catch (issue) { error(res, issue); }
  });

  app.post("/api/live-sessions/join", auth, async (req: any, res) => {
    if (!student(req.user)) return res.status(403).json({ message: "Sign in with a student account to join." });
    const joinCode = String(req.body?.code || "").trim().toUpperCase();
    if (!/^[A-Z2-9]{6}$/.test(joinCode)) return res.status(400).json({ message: "Enter the six-character game code." });
    try {
      const client = db();
      const { data: session, error: issue } = await client.from("live_sessions").select("id,status")
        .eq("code", joinCode).maybeSingle();
      if (issue) throw issue;
      if (!session || session.status === "finished") return res.status(404).json({ message: "This game is not open. Check the code with your teacher." });
      const name = String(req.user.displayName || req.user.username || "Student").slice(0, 60);
      const { error: joinIssue } = await client.from("live_players")
        .upsert({ session_id: session.id, user_id: req.user.id, display_name: name },
          { onConflict: "session_id,user_id", ignoreDuplicates: true });
      if (joinIssue) throw joinIssue;
      res.json({ id: session.id });
    } catch (issue) { error(res, issue); }
  });

  app.get("/api/live-sessions/:id", auth, async (req: any, res) => {
    try {
      const client = db();
      const id = req.params.id;
      const { data: session, error: issue } = await client.from("live_sessions").select("*").eq("id", id).maybeSingle();
      if (issue) throw issue;
      if (!session) return res.status(404).json({ message: "Game not found" });
      const isHost = teacher(req.user) && session.teacher_id === req.user.id;
      if (!isHost) {
        const { data: joined } = await client.from("live_players").select("user_id")
          .eq("session_id", id).eq("user_id", req.user.id).maybeSingle();
        if (!joined) return res.status(403).json({ message: "Join with the game code first." });
      }
      const [{ data: quiz, error: quizIssue }, { data: players, error: playersIssue }] = await Promise.all([
        client.from("live_quizzes").select("title,questions").eq("id", session.quiz_id).single(),
        client.from("live_players").select("user_id,display_name,score")
          .eq("session_id", id).order("score", { ascending: false }).order("joined_at", { ascending: true }),
      ]);
      if (quizIssue || playersIssue || !quiz) throw quizIssue || playersIssue || new Error("Quiz not found");
      const index = session.current_question;
      const question = index >= 0 ? quiz.questions[index] : null;
      const reveal = session.status === "results" || session.status === "finished";
      const { data: answers, error: answersIssue } = index >= 0
        ? await client.from("live_answers").select("user_id,choice,correct,points")
            .eq("session_id", id).eq("question_index", index)
        : { data: [], error: null };
      if (answersIssue) throw answersIssue;
      const own = (answers || []).find(a => a.user_id === req.user.id);
      res.setHeader("Cache-Control", "no-store");
      res.json({ id, code: session.code, title: quiz.title, status: session.status,
        currentQuestion: index, questionCount: quiz.questions.length,
        deadline: session.question_deadline, serverTime: new Date().toISOString(),
        question: question ? { prompt: question.prompt, options: question.options,
          ...(reveal || isHost ? { correct: question.correct } : {}) } : null,
        players: session.status === "question" && !isHost
          ? (players || []).map(p => ({ ...p, score: null })) : players || [],
        answerCount: (answers || []).length,
        myAnswer: own ? { choice: own.choice, ...(reveal ? { correct: own.correct, points: own.points } : {}) } : null,
        ...(isHost ? { answerCounts: ["A", "B", "C", "D"].map(letter => (answers || []).filter(a => a.choice === letter).length) } : {}) });
    } catch (issue) { error(res, issue); }
  });

  app.post("/api/live-sessions/:id/advance", auth, async (req: any, res) => {
    if (!teacher(req.user)) return res.status(403).json({ message: "Teacher access required" });
    const { data, error: issue } = await db().rpc("live_advance", { p_session: req.params.id, p_teacher: req.user.id });
    if (issue) return error(res, issue);
    res.json(data);
  });

  app.post("/api/live-sessions/:id/answer", auth, async (req: any, res) => {
    if (!student(req.user)) return res.status(403).json({ message: "Student access required" });
    const choice = String(req.body?.choice || "").toUpperCase();
    const index = Number(req.body?.questionIndex);
    if (!Number.isInteger(index) || index < 0 || !["A", "B", "C", "D"].includes(choice))
      return res.status(400).json({ message: "Choose one answer." });
    const { data, error: issue } = await db().rpc("live_submit_answer", {
      p_session: req.params.id, p_user: req.user.id, p_index: index, p_choice: choice,
    });
    if (issue) return error(res, issue);
    res.json(data);
  });
}
