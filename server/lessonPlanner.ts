// Arise WorkHub's Lesson Planner: the AI helper (POST /api/teacher-hub/lessons/ai).
//
// One route, several jobs (shared/lessonPlanner.ts's AI_MODES):
//   ideas     — a handful of lesson ideas for a topic
//   build     — a full lesson plan (hook, I do / we do / you do, closure, differentiation…)
//   standards — state standards that match a topic, grade and subject
//   worksheet — a printable worksheet with its answers (the answer key is the same worksheet, answers shown)
//   slides    — a slide deck outline the page turns into a PowerPoint
//   unit      — a sequence of lessons to plan a unit ahead
//   reteach   — a reteach lesson for students who didn't get it the first time
//
// Student names are never sent: the page sends only how many students and the teacher's notes.
// Nothing is stored here; the page saves what the teacher keeps into their Hub.
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import {
  AI_MODES, PLAN_FIELDS, US_STATES, cleanFoundStandards, cleanIdeas, cleanPlanFields, cleanSlides, cleanUnit, cleanWorksheet, type AiMode,
} from "@shared/lessonPlanner";
import { supportWords } from "@shared/pushIn";

export type LessonAsk = (system: string, user: string, maxTokens: number) => Promise<string>;

export type LessonPlannerDeps = {
  /** Arise WorkHub's plan check (server/teacherHub.ts's createHubGate). */
  gate(req: any, res: any): Promise<unknown | null>;
  ask?: LessonAsk;
  aiConfigured?: () => boolean;
};

class LessonAiError extends Error {}

const limits = createAttemptLimiter({ max: 80, windowMs: 10 * 60_000 });

const askOpenAI: LessonAsk = async (system, user, maxTokens) => {
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1",
        temperature: 0.6,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error: any) {
    throw new LessonAiError(error?.name === "TimeoutError" ? "That took too long. Try asking for a bit less." : "The AI could not be reached. Try again in a moment.");
  }
  if (!res.ok) {
    console.error("[lesson-planner] AI failed:", res.status);
    throw new LessonAiError(res.status === 429 ? "The AI is busy right now. Try again in a minute." : "The AI could not help with that right now. Try again.");
  }
  const payload: any = await res.json().catch(() => null);
  if (payload?.choices?.[0]?.finish_reason === "length") throw new LessonAiError("That was too much to make at once. Ask for fewer questions or slides.");
  return String(payload?.choices?.[0]?.message?.content || "");
};

const s = (v: unknown, max: number) => (typeof v === "string" || typeof v === "number" ? String(v).replace(/\u0000/g, "").trim().slice(0, max) : "");
const list = (v: unknown, max: number, each: number) => (Array.isArray(v) ? v.map((x) => s(x, each)).filter(Boolean).slice(0, max) : []);
const num = (v: unknown, lo: number, hi: number, fallback: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback; };

/** The supports asked for, as the sentences the AI is told. Only the known ones, so nothing else can ride in. */
const cleanSupportsAsked = (v: unknown): string[] => supportWords(v);

/** What the teacher sent, made safe and short. */
export function cleanAsk(body: any) {
  const lesson = body?.lesson && typeof body.lesson === "object" ? body.lesson : {};
  const state = US_STATES.includes(body?.state) ? String(body.state) : "";
  return {
    mode: (AI_MODES as readonly string[]).includes(body?.mode) ? (body.mode as AiMode) : null,
    state,
    grade: s(body?.grade, 20),
    subject: s(body?.subject, 60),
    topic: s(body?.topic, 600),
    notes: s(body?.notes, 4000),
    minutes: num(body?.minutes, 10, 240, 45),
    count: num(body?.count, 1, 40, 10),
    kind: s(body?.kind, 40),
    level: s(body?.level, 40),
    students: num(body?.students, 0, 200, 0),
    /** The supports a scaffold must have (shared/pushIn.ts): the teacher's picks, as sentences. Never a student's name. */
    supports: cleanSupportsAsked(body?.supports),
    standards: list(body?.standards, 20, 400),
    lesson: Object.fromEntries(PLAN_FIELDS.map((k) => [k, s(lesson[k], 3000)]).filter(([, v]) => v)) as Record<string, string>,
  };
}
export type CleanAsk = ReturnType<typeof cleanAsk>;

const BASE = `You are the lesson-planning assistant inside Arise WorkHub, a planner for K-12 teachers and special education teachers.
Write practical, classroom-ready material a real teacher can use tomorrow: specific, concrete, age-appropriate, with clear teacher moves and student tasks.
Build in supports for students with IEPs and English learners where it helps (chunking, visuals, sentence frames, manipulatives, extended time).
Never invent facts about a specific student. Answer with one JSON object only, in exactly the shape asked for.`;

function context(a: CleanAsk): string {
  const parts = [
    a.grade && `Grade: ${a.grade}`,
    a.subject && `Subject: ${a.subject}`,
    a.state && `State: ${a.state}`,
    a.topic && `Topic or skill: ${a.topic}`,
    `Lesson length: ${a.minutes} minutes`,
    a.standards.length && `Standards to cover:\n${a.standards.map((x) => `- ${x}`).join("\n")}`,
    Object.keys(a.lesson).length && `What the teacher has so far:\n${Object.entries(a.lesson).map(([k, v]) => `${k}: ${v}`).join("\n")}`,
    a.notes && `Teacher's notes: ${a.notes}`,
  ];
  return parts.filter(Boolean).join("\n\n");
}

const standardsRule = (state: string) => state
  ? `Use the standards ${state} actually uses, with their real codes (for example, states that use the Common Core use codes like "RL.5.2" or "5.NF.A.1"; Texas uses TEKS like "5.3(A)"; Virginia uses SOL). Write each standard as "CODE — short description". Only give codes you are confident are real; if unsure of an exact code, give the closest real one.`
  : `If no state is given, use Common Core codes for ELA and math (like "RL.5.2") and NGSS for science. Write each standard as "CODE — short description".`;

const WORKSHEET_RULES = `Worksheet rules:
- Write ALL maths in LaTeX between single $ signs so it prints as real maths: fractions as $\\frac{3}{4}$ (never 3/4), mixed numbers as $2\\frac{1}{3}$, exponents $x^2$, roots $\\sqrt{49}$, times $\\times$, divide $\\div$, $\\le$ $\\ge$, decimals and money plainly ($4.25). Stacked problems: $\\begin{array}{r} 345 \\\\ +\\,128 \\\\ \\hline \\end{array}$.
- Use "visual" whenever a picture helps. Types (all numbers are plain JSON numbers):
  {"type":"coordinate-plane","xMin":-10,"xMax":10,"yMin":-10,"yMax":10,"points":[{"x":2,"y":3,"label":"A"}],"lines":["2x+1"],"segments":[{"x1":0,"y1":0,"x2":3,"y2":4}]}
  {"type":"number-line","min":0,"max":2,"step":0.25,"denominator":4,"points":[{"x":0.75,"label":"P"}],"blankLabels":false}
  {"type":"bar-graph" or "line-graph","title":"","labels":["Mon","Tue"],"values":[4,7],"yLabel":"","xLabel":"","blank":false}
  {"type":"pie-chart","labels":[],"values":[]}  {"type":"picture-graph","labels":[],"values":[],"key":2,"symbol":"★"}  {"type":"tally","labels":[],"values":[]}
  {"type":"fraction-bar" or "fraction-circle","parts":8,"shaded":3,"count":1}  {"type":"array","rows":3,"cols":5}  {"type":"ten-frame","filled":7}
  {"type":"base-ten","hundreds":1,"tens":4,"ones":2}  {"type":"clock","hour":3,"minute":45,"hands":true}  {"type":"angle","degrees":65,"protractor":true}
  {"type":"shape","shape":"rectangle|square|triangle|right-triangle|circle|trapezoid|parallelogram|rectangular-prism","labels":["8 cm","5 cm"]}
  {"type":"table","headers":["x","y"],"rows":[["1","3"],["2",""]]}  {"type":"grid-paper","rows":10,"cols":10}  {"type":"money","coins":[{"kind":"quarter","count":2}]}
- When students must draw or plot (plot points, draw the bars, shade the fraction, draw the hands), give the empty "visual" (no points, "blank": true, "shaded": 0, "hands": false) and put the finished picture in "keyVisual" for the answer key.
- "kind" is one of: "choice" (give 4 "choices"), "short" (give "lines"), "work" (room to show work, give "space": "small|medium|large"), "blank" (fill in the blank: put ____ in the prompt), "truefalse", "graph" (a visual to complete), "match" (give "matches", the right-hand column).
- Every question has a correct "answer" (with $maths$ when it is maths; for written answers a model answer).
- For computation practice set the section's "columns" to 2 or 3. For reading, put the passage in the section's "passage". A "wordBank" list is allowed.
- Age-appropriate wording, accurate maths, no trick questions.`;
const WORKSHEET_SHAPE = `{"title": string, "instructions": string, "large": boolean (true for grades K-2), "sections": [{"heading": string, "directions": string, "columns": number, "passage": string (optional), "wordBank": string[] (optional), "items": [{"kind": string, "prompt": string, "choices": string[] (optional), "answer": string, "lines": number (optional), "space": string (optional), "visual": object (optional), "keyVisual": object (optional), "matches": string[] (optional)}]}]}`;

const SCAFFOLD_RULES = `Scaffolding rules:
- A scaffold lowers the barriers, never the thinking. Keep the same skill and the same standard as the lesson; make the way in easier.
- Use the lesson text the teacher gave you for the vocabulary, the examples and the method, so the work matches what was taught in class.
- Put the supports where the student needs them: the word bank above the questions, the worked example before the first question, sentence frames inside the answer lines.
- Give every question an answer for the answer key. Fade the help as the worksheet goes on.
- Write for a student who is capable but needs a way in: respectful wording, never babyish.`;

/** The system and user messages for each job, and how long the answer may be. */
export function lessonPrompt(a: CleanAsk): { system: string; user: string; maxTokens: number } {
  const ctx = context(a);
  const planShape = `{"title": string, "objective": string (start "Students will be able to…"), "standards": string[], "minutes": number, "hook": string, "iDo": string, "weDo": string, "youDo": string, "closure": string, "vocabulary": string, "differentiation": string, "assessment": string, "homework": string, "materials": string}`;
  switch (a.mode) {
    case "ideas":
      return { maxTokens: 1800, system: BASE, user: `${ctx}\n\nGive ${Math.min(a.count, 8)} different, engaging lesson ideas for this. Mix approaches (hands-on, game, discussion, station rotation, real-world task, technology). Return {"ideas": [{"title": string, "summary": string (2 sentences), "activity": string (the main student activity, 1-2 sentences)}]}.` };
    case "build":
      return { maxTokens: 3500, system: `${BASE}\n${standardsRule(a.state)}`, user: `${ctx}\n\nWrite a complete, detailed lesson plan. Keep anything the teacher already wrote and build on it. Time each part (e.g. "Hook (5 min): …") so the parts add up to the lesson length. In iDo, weDo and youDo write the actual teacher script, examples and problems, not just labels. In differentiation give supports for struggling students/IEPs, ELLs, and an extension for advanced students. In closure include a 1-3 question exit ticket with answers.\nReturn ${planShape}.` };
    case "reteach":
      return { maxTokens: 3500, system: `${BASE}\n${standardsRule(a.state)}`, user: `${ctx}\n\n${a.students ? `${a.students} student(s)` : "Some students"} did not master this lesson and need a reteach in a small group. Write a reteach lesson that teaches the same objective a different way (new representation, more modeling, smaller steps, more guided practice, manipulatives or visuals), with a quick check at the end to see who has it now.\nReturn ${planShape}.` };
    case "standards":
      return { maxTokens: 1600, system: `${BASE}\n${standardsRule(a.state)}`, user: `${ctx}\n\nList up to 10 ${a.state || "Common Core / national"} standards that best match this${a.grade ? ` for grade ${a.grade}` : ""}${a.subject ? ` in ${a.subject}` : ""}, best match first. Return {"standards": [{"code": string, "text": string}]}.` };
    case "worksheet": {
      const kind = a.kind || "practice worksheet";
      return { maxTokens: 7000, system: `${BASE}\n${WORKSHEET_RULES}`, user: `${ctx}\n\nMake a printable ${kind} for this lesson with about ${Math.min(a.count, 30)} questions${a.level ? `, ${a.level} level` : ""}${a.grade ? `, for grade ${a.grade}` : ""}. Group the questions into 1-4 sections (for example: warm-up, practice, word problems, show your work, challenge). Make it look and work like a real worksheet a teacher would buy: varied question types, real numbers, pictures where they help.\nReturn ${WORKSHEET_SHAPE}.` };
    }
    case "scaffold": {
      const kind = a.kind || "practice worksheet";
      return { maxTokens: 7000, system: `${BASE}\n${WORKSHEET_RULES}\n${SCAFFOLD_RULES}`, user: `${ctx}\n\nMake a scaffolded ${kind} for students who need extra support with exactly this lesson, with about ${Math.min(a.count, 12)} questions${a.grade ? `, for grade ${a.grade}` : ""}.\nBuild in these supports:\n${(a.supports.length ? a.supports : ["a worked example first", "sentence frames", "a word bank"]).map((x) => `- ${x}`).join("\n")}\nGroup the questions into 2-4 sections that move from most help to least: watch it done, try it together with help, then a few on your own with a little help. Return ${WORKSHEET_SHAPE}.` };
    }
    case "slides":
      return { maxTokens: 4000, system: BASE, user: `${ctx}\n\nMake a slide deck the teacher can present for this lesson, about ${Math.min(a.count, 20)} slides: a title slide, the learning objective ("I can…"), warm-up, vocabulary, teaching slides with worked examples, guided practice, independent practice directions, and an exit ticket. Keep bullets short (under 15 words each, at most 6 per slide). Put what the teacher says in notes.\nReturn {"slides": [{"title": string, "bullets": string[], "notes": string}]}.` };
    case "unit":
      return { maxTokens: 4000, system: `${BASE}\n${standardsRule(a.state)}`, user: `${ctx}\n\nPlan a unit of ${Math.min(a.count, 30)} lessons, in teaching order, that builds the skill step by step: introduce, model, practice, apply, review, and end with an assessment lesson. Each lesson gets a short title, a "Students will be able to…" objective, 1-2 standards, and a 2-3 sentence summary of what happens.\nReturn {"unit": string (unit name), "lessons": [{"title": string, "objective": string, "standards": string[], "summary": string}]}.` };
    default:
      throw new LessonAiError("Pick something for the AI to do.");
  }
}

/** The AI's answer made safe to hand back to the page. */
export function readAnswer(mode: AiMode, rawText: string): any {
  let raw: any;
  try { raw = JSON.parse(rawText); } catch { throw new LessonAiError("The AI's answer could not be read. Try again."); }
  switch (mode) {
    case "ideas": { const ideas = cleanIdeas(raw); if (!ideas.length) break; return { ideas }; }
    case "build": case "reteach": { const plan = cleanPlanFields(raw); if (!Object.keys(plan).length) break; return { plan }; }
    case "standards": return { standards: cleanFoundStandards(raw) };
    case "worksheet": case "scaffold": { const worksheet = cleanWorksheet(raw); if (!worksheet) break; return { worksheet }; }
    case "slides": { const slides = cleanSlides(raw?.slides); if (!slides) break; return { slides }; }
    case "unit": { const unit = cleanUnit(raw); if (!unit.lessons.length) break; return unit; }
  }
  throw new LessonAiError("The AI didn't send anything usable. Try again with a little more detail.");
}

export function registerLessonPlannerRoutes(app: Express, authMiddleware: RequestHandler, deps: LessonPlannerDeps) {
  const ask = deps.ask ?? askOpenAI;
  const configured = deps.aiConfigured ?? (() => !!process.env.OPENAI_API_KEY);

  app.post("/api/teacher-hub/lessons/ai", authMiddleware, async (req: any, res) => {
    const hub = await deps.gate(req, res);
    if (!hub) return;
    if (!configured()) return res.status(503).json({ message: "The AI helper isn't set up on this site yet." });
    const a = cleanAsk(req.body);
    if (!a.mode) return res.status(400).json({ message: "Pick something for the AI to do." });
    if (!a.topic && !Object.keys(a.lesson).length && !a.standards.length) return res.status(400).json({ message: "Type a topic or skill first, so the AI knows what the lesson is about." });
    const who = `u${req.user?.id}`;
    const wait = limits.retryAfter(who);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); return res.status(429).json({ message: `That's a lot of AI help in a short time. Try again in ${waitWords(wait)}.` }); }
    limits.fail(who);
    try {
      const prompt = lessonPrompt(a);
      const text = await ask(prompt.system, prompt.user, prompt.maxTokens);
      res.json(readAnswer(a.mode, text));
    } catch (error: any) {
      if (error instanceof LessonAiError) return res.status(502).json({ message: error.message });
      console.error("[lesson-planner] failed:", error?.message || error);
      res.status(500).json({ message: "The AI helper ran into a problem. Try again." });
    }
  });
}
