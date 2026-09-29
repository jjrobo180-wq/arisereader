import type { Express } from "express";
import { randomBytes } from "node:crypto";
import { getAdminSupabase } from "./supabase";
import { storage } from "./storage";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const code = () => Array.from(randomBytes(6), n => alphabet[n % alphabet.length]).join("");
const teacher = (user: any) => Boolean((user?.isAdmin || user?.role === "teacher") && user?.accountApproved !== false);
const student = (user: any) => user?.role === "student" && user?.accountApproved !== false;

const GAME_TYPES = ["quiz", "flash", "wheel", "jeopardy", "fifth", "millionaire", "party"] as const;
type GameType = typeof GAME_TYPES[number];
const normalizeGameType = (value: unknown): GameType =>
  GAME_TYPES.includes(String(value || "") as GameType) ? String(value) as GameType : "quiz";

type LiveQuestion = {
  prompt: string;
  options: string[];
  correct: string;
  gameType: GameType;
  category?: string;
  difficulty?: "easy" | "medium" | "hard";
  value?: number;
};

function parseQuestions(input: unknown, requestedGameType: unknown = "quiz"): LiveQuestion[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 30) throw new Error("Add 1 to 30 questions.");
  const gameType = normalizeGameType(requestedGameType);
  return input.map((item: any, index: number) => {
    const prompt = String(item?.prompt || item?.question || "").trim();
    const options = item?.options;
    const correct = String(item?.correct || "").toUpperCase();
    if (prompt.length < 3 || prompt.length > 240 || !Array.isArray(options) || options.length !== 4 ||
        options.some((option: unknown) => typeof option !== "string" || !option.trim() || option.trim().length > 120) ||
        !["A", "B", "C", "D"].includes(correct)) {
      throw new Error(`Check question ${index + 1}: add a question, four answers, and the correct choice.`);
    }
    const difficulty = ["easy", "medium", "hard"].includes(String(item?.difficulty || "").toLowerCase())
      ? String(item.difficulty).toLowerCase() as "easy" | "medium" | "hard"
      : index < Math.ceil(input.length * .35) ? "easy" : index >= Math.floor(input.length * .75) ? "hard" : "medium";
    const value = Number.isFinite(Number(item?.value)) ? Math.max(100, Math.min(2000, Math.round(Number(item.value) / 100) * 100)) : (index + 1) * 100;
    const category = String(item?.category || "General").trim().slice(0, 40) || "General";
    return {
      prompt,
      options: options.map((option: string) => option.trim()),
      correct,
      gameType,
      category,
      difficulty,
      value,
    };
  });
}

const PRESETS: Array<{
  id: string;
  title: string;
  description: string;
  grade: string;
  subject: string;
  gameType: GameType;
  questions: LiveQuestion[];
}> = [
  {
    id: "middle-school-mix",
    title: "Middle School Mix",
    description: "A fast mix of math, science, ELA, and social studies.",
    grade: "6–8",
    subject: "Mixed",
    gameType: "quiz",
    questions: parseQuestions([
      { prompt: "What is 25% of 80?", options: ["10", "20", "25", "40"], correct: "B", category: "Math" },
      { prompt: "Which organ pumps blood through the body?", options: ["Lungs", "Brain", "Heart", "Stomach"], correct: "C", category: "Science" },
      { prompt: "Which word is a synonym for enormous?", options: ["Tiny", "Huge", "Quiet", "Quick"], correct: "B", category: "ELA" },
      { prompt: "Which branch of U.S. government makes federal laws?", options: ["Legislative", "Executive", "Judicial", "Local"], correct: "A", category: "Social Studies" },
      { prompt: "What is 7 × 8?", options: ["48", "54", "56", "64"], correct: "C", category: "Math" },
      { prompt: "Water changing from liquid to gas is called what?", options: ["Freezing", "Condensation", "Evaporation", "Melting"], correct: "C", category: "Science" },
      { prompt: "What is the main idea of a text?", options: ["A random detail", "The central point", "The title only", "The final sentence"], correct: "B", category: "ELA" },
      { prompt: "Which ocean borders the west coast of the United States?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correct: "D", category: "Geography" },
    ], "quiz"),
  },
  {
    id: "vocab-flash",
    title: "Vocabulary Flash Match",
    description: "Quick word-and-definition matching for classroom warm-ups.",
    grade: "5–8",
    subject: "ELA",
    gameType: "flash",
    questions: parseQuestions([
      { prompt: "Infer", options: ["To make a conclusion using clues", "To copy exactly", "To erase", "To shout"], correct: "A", category: "Vocabulary" },
      { prompt: "Contrast", options: ["To show differences", "To count", "To agree", "To summarize"], correct: "A", category: "Vocabulary" },
      { prompt: "Evidence", options: ["Information that supports an idea", "A guess", "A title", "A joke"], correct: "A", category: "Vocabulary" },
      { prompt: "Analyze", options: ["To examine closely", "To ignore", "To memorize one word", "To skip"], correct: "A", category: "Vocabulary" },
      { prompt: "Summarize", options: ["Tell the most important ideas briefly", "Repeat every word", "Add new facts", "Ask a question"], correct: "A", category: "Vocabulary" },
      { prompt: "Theme", options: ["A message or lesson in a text", "The page number", "The author’s address", "A punctuation mark"], correct: "A", category: "Vocabulary" },
      { prompt: "Context", options: ["Words and details around something", "A chapter title", "A picture only", "A grade"], correct: "A", category: "Vocabulary" },
      { prompt: "Conclude", options: ["To decide after considering evidence", "To begin", "To divide", "To whisper"], correct: "A", category: "Vocabulary" },
    ], "flash"),
  },
  {
    id: "science-wheel",
    title: "Science Spin Wheel",
    description: "Spin across life, earth, physical, and space science.",
    grade: "5–8",
    subject: "Science",
    gameType: "wheel",
    questions: parseQuestions([
      { prompt: "What gas do plants take in during photosynthesis?", options: ["Oxygen", "Carbon dioxide", "Hydrogen", "Helium"], correct: "B", category: "Life Science" },
      { prompt: "What layer of Earth do we live on?", options: ["Inner core", "Outer core", "Mantle", "Crust"], correct: "D", category: "Earth Science" },
      { prompt: "What force pulls objects toward Earth?", options: ["Magnetism", "Friction", "Gravity", "Electricity"], correct: "C", category: "Physical Science" },
      { prompt: "Which planet is known for its rings?", options: ["Mars", "Saturn", "Mercury", "Venus"], correct: "B", category: "Space" },
      { prompt: "What is the smallest unit of an element?", options: ["Cell", "Atom", "Molecule", "Tissue"], correct: "B", category: "Physical Science" },
      { prompt: "Which body system helps us breathe?", options: ["Digestive", "Respiratory", "Skeletal", "Nervous"], correct: "B", category: "Life Science" },
      { prompt: "What causes day and night?", options: ["Earth rotates", "Earth stops", "The Sun circles Earth daily", "Clouds move"], correct: "A", category: "Space" },
      { prompt: "Rock broken into smaller pieces by wind or water is undergoing what?", options: ["Weathering", "Condensation", "Combustion", "Freezing"], correct: "A", category: "Earth Science" },
    ], "wheel"),
  },
  {
    id: "jeopardy-core",
    title: "Classroom Jeopardy: Core Skills",
    description: "Category-and-value review with a game-show board feel.",
    grade: "6–8",
    subject: "Mixed",
    gameType: "jeopardy",
    questions: parseQuestions([
      { prompt: "What is 3/4 written as a decimal?", options: ["0.25", "0.50", "0.75", "1.25"], correct: "C", category: "Math", value: 100 },
      { prompt: "Which sentence uses a simile?", options: ["The moon smiled.", "She ran like the wind.", "Bang!", "The room was silent."], correct: "B", category: "ELA", value: 100 },
      { prompt: "What is the process plants use to make food?", options: ["Respiration", "Photosynthesis", "Digestion", "Erosion"], correct: "B", category: "Science", value: 200 },
      { prompt: "What document begins with 'We the People'?", options: ["Declaration of Independence", "U.S. Constitution", "Bill of Rights only", "Emancipation Proclamation"], correct: "B", category: "History", value: 200 },
      { prompt: "Solve: 5(x + 2) = 35.", options: ["3", "5", "7", "9"], correct: "B", category: "Math", value: 300 },
      { prompt: "What is the author's purpose when a text tries to convince you?", options: ["Inform", "Entertain", "Persuade", "Describe only"], correct: "C", category: "ELA", value: 300 },
      { prompt: "Which particle has a negative charge?", options: ["Proton", "Neutron", "Electron", "Nucleus"], correct: "C", category: "Science", value: 400 },
      { prompt: "Which ancient civilization developed along the Nile River?", options: ["Egypt", "Rome", "Maya", "China"], correct: "A", category: "History", value: 400 },
      { prompt: "What is the slope between (0,0) and (4,8)?", options: ["1/2", "2", "4", "8"], correct: "B", category: "Math", value: 500 },
      { prompt: "Which statement is a strong theme?", options: ["The dog is brown.", "Friendship can help people face challenges.", "Chapter 3 is long.", "The setting is a town."], correct: "B", category: "ELA", value: 500 },
    ], "jeopardy"),
  },
  {
    id: "fifth-grade-challenge",
    title: "Are You Smarter? Grade 5 Challenge",
    description: "A grade-by-grade ladder of elementary knowledge.",
    grade: "3–5",
    subject: "Mixed",
    gameType: "fifth",
    questions: parseQuestions([
      { prompt: "What is 9 × 6?", options: ["45", "54", "56", "63"], correct: "B", category: "3rd Grade", difficulty: "easy" },
      { prompt: "Which is a mammal?", options: ["Frog", "Dolphin", "Shark", "Lizard"], correct: "B", category: "3rd Grade", difficulty: "easy" },
      { prompt: "What is the capital of the United States?", options: ["New York City", "Washington, D.C.", "Denver", "Philadelphia"], correct: "B", category: "4th Grade", difficulty: "medium" },
      { prompt: "Which fraction is equal to one half?", options: ["2/4", "2/3", "3/4", "1/3"], correct: "A", category: "4th Grade", difficulty: "medium" },
      { prompt: "What is the largest ocean on Earth?", options: ["Atlantic", "Pacific", "Indian", "Arctic"], correct: "B", category: "5th Grade", difficulty: "medium" },
      { prompt: "Which word is an adverb?", options: ["Quick", "Quickly", "Runner", "Blue"], correct: "B", category: "5th Grade", difficulty: "hard" },
      { prompt: "What is 2.5 + 1.75?", options: ["3.25", "4.00", "4.25", "4.75"], correct: "C", category: "5th Grade", difficulty: "hard" },
      { prompt: "Which amendment protects freedom of speech?", options: ["First", "Second", "Fifth", "Tenth"], correct: "A", category: "5th Grade", difficulty: "hard" },
    ], "fifth"),
  },
  {
    id: "millionaire-mix",
    title: "Millionaire Challenge: School Edition",
    description: "Questions get harder as the class climbs the prize ladder.",
    grade: "6–8",
    subject: "Mixed",
    gameType: "millionaire",
    questions: parseQuestions([
      { prompt: "How many sides does a triangle have?", options: ["2", "3", "4", "5"], correct: "B", category: "Level 1", value: 100, difficulty: "easy" },
      { prompt: "Which planet do we live on?", options: ["Mars", "Venus", "Earth", "Jupiter"], correct: "C", category: "Level 2", value: 200, difficulty: "easy" },
      { prompt: "What is 12 × 12?", options: ["124", "132", "144", "156"], correct: "C", category: "Level 3", value: 300, difficulty: "easy" },
      { prompt: "Which word means the opposite of scarce?", options: ["Rare", "Abundant", "Tiny", "Hidden"], correct: "B", category: "Level 4", value: 500, difficulty: "medium" },
      { prompt: "What is the chemical symbol for oxygen?", options: ["O", "Ox", "Og", "On"], correct: "A", category: "Level 5", value: 1000, difficulty: "medium" },
      { prompt: "Who wrote 'A Midsummer Night's Dream'?", options: ["Mark Twain", "William Shakespeare", "Maya Angelou", "Charles Dickens"], correct: "B", category: "Level 6", value: 2000, difficulty: "medium" },
      { prompt: "Which number is prime?", options: ["21", "27", "29", "33"], correct: "C", category: "Level 7", value: 5000, difficulty: "hard" },
      { prompt: "Which process changes a solid directly into a gas?", options: ["Melting", "Sublimation", "Condensation", "Freezing"], correct: "B", category: "Level 8", value: 10000, difficulty: "hard" },
    ], "millionaire"),
  },
  {
    id: "class-party",
    title: "Class Party: Brain Break",
    description: "Fast, colorful, school-safe questions with a party-game feel.",
    grade: "4–8",
    subject: "Fun",
    gameType: "party",
    questions: parseQuestions([
      { prompt: "Which animal is famous for changing color?", options: ["Chameleon", "Elephant", "Penguin", "Horse"], correct: "A", category: "Wild Card" },
      { prompt: "If you rearrange the letters in LISTEN, which word can you make?", options: ["SILENT", "TILES", "LINES", "STONE"], correct: "A", category: "Word Play" },
      { prompt: "Which weighs more: one pound of feathers or one pound of bricks?", options: ["Feathers", "Bricks", "They weigh the same", "It depends on color"], correct: "C", category: "Trick Question" },
      { prompt: "What number comes next: 2, 4, 8, 16, __?", options: ["18", "24", "30", "32"], correct: "D", category: "Pattern Pop" },
      { prompt: "Which food is technically a fruit?", options: ["Carrot", "Tomato", "Celery", "Potato"], correct: "B", category: "Food Fact" },
      { prompt: "What has keys but cannot open a door?", options: ["Piano", "Map", "Clock", "Book"], correct: "A", category: "Riddle Rush" },
      { prompt: "Which is fastest?", options: ["Sound", "Light", "A cheetah", "A race car"], correct: "B", category: "Quick Pick" },
      { prompt: "What is the only even prime number?", options: ["1", "2", "4", "6"], correct: "B", category: "Final Frenzy" },
    ], "party"),
  },
];

async function getPerplexityApiKey() {
  try {
    const dbKey = await storage.getSetting("perplexity_api_key");
    if (dbKey) return dbKey;
  } catch {}
  return process.env.CUSTOM_CRED_API_PERPLEXITY_AI_TOKEN || process.env.PERPLEXITY_API_KEY || "";
}

async function generateLiveQuizWithAI(input: {
  topic: string;
  grade: string;
  count: number;
  gameType: GameType;
  notes?: string;
}) {
  const apiKey = await getPerplexityApiKey();
  if (!apiKey) throw new Error("AI quiz generation is not configured yet.");
  const styleGuide: Record<GameType, string> = {
    quiz: "Fast classroom competition like a polished live multiple-choice quiz.",
    flash: "Quizlet-like vocabulary/definition matching. Keep prompts concise and answer choices easy to scan.",
    wheel: "Create a mix of 4 to 6 clear categories because a wheel will visually select categories.",
    jeopardy: "Jeopardy-style category review. Use 4 to 5 categories and increasing values from 100 to 500.",
    fifth: "An Are You Smarter than a 5th Grader-style school challenge. Use grade/subject categories and progressively harder questions.",
    millionaire: "Who Wants to Be a Millionaire-style progression. Start accessible and get steadily harder; values should rise.",
    party: "A school-safe Jackbox-like class party. Make it playful, surprising, funny when appropriate, and still factually answerable.",
  };
  const prompt = `Create a live classroom game for students.

TOPIC: ${input.topic}
GRADE / LEVEL: ${input.grade || "middle school"}
GAME STYLE: ${input.gameType}
NUMBER OF QUESTIONS: exactly ${input.count}
STYLE DIRECTION: ${styleGuide[input.gameType]}
TEACHER NOTES: ${input.notes || "None"}

Return ONLY valid JSON with this exact structure:
{"title":"Short classroom-friendly title","questions":[{"prompt":"Question?","options":["A text","B text","C text","D text"],"correct":"A","category":"Short category","difficulty":"easy","value":100}]}

Rules:
- Exactly four answer choices per question.
- correct must be A, B, C, or D.
- Keep questions age-appropriate, school-appropriate, and factually clear.
- Avoid politics, sexual content, drugs, weapons, graphic violence, or humiliating students.
- Avoid trick questions unless the game style is party; even then the answer must be unambiguous.
- Do not make every correct answer the same letter.
- Use concise language that works on a classroom projector and student phones.
- For jeopardy, wheel, fifth, millionaire, and party modes, category must be meaningful.
- difficulty must be easy, medium, or hard.
- value should be a classroom game value from 100 to 2000.
- No markdown and no commentary.`;

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: "You create safe, accurate K-12 classroom games and return only valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: .65,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`AI generation failed (${response.status}). ${detail.slice(0, 160)}`);
  }
  const data = await response.json() as any;
  const raw = String(data?.choices?.[0]?.message?.content || "").trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI did not return a usable quiz. Try again.");
  let parsed: any;
  try { parsed = JSON.parse(match[0]); } catch { throw new Error("AI returned an invalid quiz. Try again."); }
  const questions = parseQuestions(parsed?.questions, input.gameType);
  return {
    title: String(parsed?.title || input.topic || "AI Classroom Game").trim().slice(0, 100),
    gameType: input.gameType,
    questions,
  };
}

export function registerLiveQuizRoutes(app: Express, auth: any) {
  const db = () => getAdminSupabase();
  const error = (res: any, issue: any) => res.status(400).json({ message: issue?.message || "Please try again." });

  app.get("/api/live-quizzes/presets", auth, async (req: any, res) => {
    if (!teacher(req.user)) return res.status(403).json({ message: "Teacher access required" });
    res.json(PRESETS.map(set => ({
      id: set.id,
      title: set.title,
      description: set.description,
      grade: set.grade,
      subject: set.subject,
      gameType: set.gameType,
      questionCount: set.questions.length,
      questions: set.questions,
    })));
  });

  app.post("/api/live-quizzes/generate", auth, async (req: any, res) => {
    if (!teacher(req.user)) return res.status(403).json({ message: "Teacher access required" });
    try {
      const topic = String(req.body?.topic || "").trim();
      const grade = String(req.body?.grade || "6–8").trim().slice(0, 40);
      const count = Math.max(3, Math.min(20, Math.round(Number(req.body?.count) || 10)));
      const gameType = normalizeGameType(req.body?.gameType);
      const notes = String(req.body?.notes || "").trim().slice(0, 800);
      if (topic.length < 2 || topic.length > 180) throw new Error("Tell AI what you want the game to cover.");
      res.json(await generateLiveQuizWithAI({ topic, grade, count, gameType, notes }));
    } catch (issue) { error(res, issue); }
  });

  app.get("/api/live-quizzes", auth, async (req: any, res) => {
    if (!teacher(req.user)) return res.status(403).json({ message: "Teacher access required" });
    const { data, error: issue } = await db().from("live_quizzes").select("id,title,created_at,questions")
      .eq("teacher_id", req.user.id).order("created_at", { ascending: false }).limit(100);
    if (issue) return error(res, issue);
    res.json((data || []).map(q => ({
      id: q.id,
      title: q.title,
      questionCount: Array.isArray(q.questions) ? q.questions.length : 0,
      createdAt: q.created_at,
      gameType: normalizeGameType(q.questions?.[0]?.gameType),
    })));
  });

  app.post("/api/live-quizzes", auth, async (req: any, res) => {
    if (!teacher(req.user)) return res.status(403).json({ message: "Teacher access required" });
    try {
      const title = String(req.body?.title || "").trim();
      if (title.length < 3 || title.length > 100) throw new Error("Give your quiz a title of 3 to 100 characters.");
      const gameType = normalizeGameType(req.body?.gameType);
      const questions = parseQuestions(req.body?.questions, gameType);
      const { data, error: issue } = await db().from("live_quizzes")
        .insert({ teacher_id: req.user.id, title, questions }).select("id,title").single();
      if (issue) throw issue;
      res.status(201).json({ ...data, gameType, questionCount: questions.length });
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
      const gameType = normalizeGameType(quiz.questions?.[0]?.gameType);
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
      res.json({
        id,
        code: session.code,
        title: quiz.title,
        gameType,
        status: session.status,
        currentQuestion: index,
        questionCount: quiz.questions.length,
        deadline: session.question_deadline,
        serverTime: new Date().toISOString(),
        question: question ? {
          prompt: question.prompt,
          options: question.options,
          category: question.category || "General",
          difficulty: question.difficulty || "medium",
          value: question.value || (index + 1) * 100,
          ...(reveal || isHost ? { correct: question.correct } : {}),
        } : null,
        players: session.status === "question" && !isHost
          ? (players || []).map(p => ({ ...p, score: null })) : players || [],
        answerCount: (answers || []).length,
        myAnswer: own ? { choice: own.choice, ...(reveal ? { correct: own.correct, points: own.points } : {}) } : null,
        ...(isHost ? {
          answerCounts: ["A", "B", "C", "D"].map(letter => (answers || []).filter(a => a.choice === letter).length),
          board: quiz.questions.map((q: any, questionIndex: number) => ({
            index: questionIndex,
            category: String(q.category || "General"),
            value: Number(q.value || (questionIndex + 1) * 100),
            difficulty: String(q.difficulty || "medium"),
          })),
        } : {}),
      });
    } catch (issue) { error(res, issue); }
  });

  app.post("/api/live-sessions/:id/lifeline/5050", auth, async (req: any, res) => {
    if (!student(req.user)) return res.status(403).json({ message: "Student access required" });
    try {
      const client = db();
      const { data: session } = await client.from("live_sessions").select("quiz_id,status,current_question")
        .eq("id", req.params.id).maybeSingle();
      if (!session || session.status !== "question" || session.current_question < 0)
        return res.status(400).json({ message: "The 50:50 lifeline is only available during a question." });
      const { data: joined } = await client.from("live_players").select("user_id")
        .eq("session_id", req.params.id).eq("user_id", req.user.id).maybeSingle();
      if (!joined) return res.status(403).json({ message: "Join the game first." });
      const { data: quiz } = await client.from("live_quizzes").select("questions").eq("id", session.quiz_id).single();
      const question = quiz?.questions?.[session.current_question];
      if (!question || normalizeGameType(question.gameType) !== "millionaire")
        return res.status(400).json({ message: "50:50 is only available in Millionaire Challenge." });
      const correct = String(question.correct || "");
      const wrong = ["A", "B", "C", "D"].filter(letter => letter !== correct);
      const hide = wrong.slice(0, 2);
      res.json({ hide });
    } catch (issue) { error(res, issue); }
  });

  app.post("/api/live-sessions/:id/advance", auth, async (req: any, res) => {
    if (!teacher(req.user)) return res.status(403).json({ message: "Teacher access required" });
    const action = String(req.body?.action || "");
    if (!["start", "reveal", "next"].includes(action))
      return res.status(400).json({ message: "Choose a valid live quiz action." });
    const { data, error: issue } = await db().rpc("live_advance_action", {
      p_session: req.params.id,
      p_teacher: req.user.id,
      p_action: action,
    });
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
      p_session: req.params.id,
      p_user: req.user.id,
      p_index: index,
      p_choice: choice,
    });
    if (issue) return error(res, issue);
    res.json(data);
  });
}
