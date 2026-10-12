// A.R.I.S.E. Math "Snap a problem" (see shared/ariseMathPhoto.ts for what it does).
//
// - Signed-in A.R.I.S.E. accounts only, and only with Arise Math access (the add-on gate on
//   /api/math covers these routes too). Each person can send PHOTO_LIMITS.perDay a day.
// - Photos and typed problems go to the AI service to be read and are not kept or logged here.
// - The final answer of the student's problem stays in this server's memory for a few hours so
//   their answer can be checked. The page never gets it, and the number of checks is limited.
import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { SKILLS } from "../shared/ariseMath";
import { PHOTO_LIMITS, answerMatches, cleanTutorReply, tutorPrompt, type TutorReply } from "../shared/ariseMathPhoto";

export type PhotoAsk = { system: string; text: string; image: string | null };
export type MathPhotoDeps = {
  /** Asks the AI and returns its reply, which should be JSON. */
  askAI?: (ask: PhotoAsk) => Promise<string>;
  aiConfigured?: () => boolean;
  /** The grade a student gave at sign-up, if any. */
  gradeOf?: (userId: number) => Promise<string | null>;
  now?: () => number;
};

class PhotoAiError extends Error {}
const MODEL = () => process.env.MATH_TUTOR_MODEL || "gpt-4.1";
const IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE_CHARS = 6_000_000;

async function askOpenAI(ask: PhotoAsk): Promise<string> {
  const content: any[] = [{ type: "text", text: ask.text }];
  if (ask.image) content.push({ type: "image_url", image_url: { url: ask.image, detail: "high" } });
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL(), temperature: 0.1, max_tokens: 4000, response_format: { type: "json_object" },
        messages: [{ role: "system", content: ask.system }, { role: "user", content }],
      }),
      signal: AbortSignal.timeout(75_000),
    });
  } catch (error: any) {
    throw new PhotoAiError(error?.name === "TimeoutError" ? "That took too long. Try again, or type the problem in." : "The math helper can’t be reached right now. Try again in a moment.");
  }
  if (!response.ok) {
    console.error("[arise-math-photo] AI request failed:", response.status);
    throw new PhotoAiError(response.status === 429 ? "The math helper is busy. Try again in a minute." : "The math helper couldn’t read that. Try a clearer photo, or type the problem in.");
  }
  const payload: any = await response.json().catch(() => null);
  return String(payload?.choices?.[0]?.message?.content || "");
}

type Saved = { userId: number; accept: string[]; checks: number; at: number; solved: boolean };

export function registerMathPhotoRoutes(app: Express, auth: RequestHandler, deps: MathPhotoDeps = {}) {
  const now = deps.now ?? Date.now;
  const askAI = deps.askAI ?? askOpenAI;
  const aiConfigured = deps.aiConfigured ?? (() => !!process.env.OPENAI_API_KEY);
  const perDay = createAttemptLimiter({ max: PHOTO_LIMITS.perDay, windowMs: 24 * 3600_000, now });
  const saved = new Map<string, Saved>();
  const skillList = Object.entries(SKILLS).map(([id, s]) => ({ id, name: s.name }));
  const skillIds = skillList.map((s) => s.id);
  const prune = () => {
    const cutoff = now() - PHOTO_LIMITS.keepMs;
    for (const [id, s] of saved) if (s.at < cutoff) saved.delete(id);
    if (saved.size > 20_000) for (const id of Array.from(saved.keys()).slice(0, 5_000)) saved.delete(id);
  };

  app.post("/api/math/photo-help", auth, async (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const userId = Number(req.user?.id);
    if (!userId) return res.status(401).json({ message: "Log in to use Snap a problem." });
    if (!aiConfigured()) return res.status(503).json({ message: "Snap a problem isn’t turned on for this site yet." });
    const body = req.body || {};
    const image = typeof body.image === "string" && body.image ? body.image : null;
    const typed = String(body.text ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, PHOTO_LIMITS.text);
    if (!image && !typed) return res.status(400).json({ message: "Add a photo or screenshot of the problem, or type it in." });
    if (image && (image.length > MAX_IMAGE_CHARS || !IMAGE_RE.test(image))) return res.status(400).json({ message: "That picture couldn’t be read. Try a JPG or PNG photo or screenshot." });
    const wait = perDay.retryAfter(String(userId));
    if (wait) return res.status(429).json({ message: `That’s a lot of problems today! You can snap another in ${waitWords(wait)}.` });
    perDay.fail(String(userId));

    const grade = req.user?.role === "student" ? await deps.gradeOf?.(userId).catch(() => null) ?? null : null;
    let raw = "";
    try {
      raw = await askAI({
        system: tutorPrompt(skillList, grade),
        text: image ? (typed ? `The student added this note: ${typed}` : "Here is the problem.") : `The student typed this problem: ${typed}`,
        image,
      });
    } catch (error: any) {
      return res.status(502).json({ message: error instanceof PhotoAiError ? error.message : "The math helper couldn’t read that. Try again." });
    }
    let parsed: unknown = null;
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
    const result = cleanTutorReply(parsed, skillIds);
    if ("notMath" in result) return res.json({ notMath: result.notMath });
    prune();
    const id = randomUUID();
    saved.set(id, { userId, accept: result.accept, checks: 0, at: now(), solved: false });
    const reply: TutorReply & { id: string; checksLeft: number } = { ...result.reply, id, checksLeft: PHOTO_LIMITS.checksPerProblem };
    res.json(reply);
  });

  app.post("/api/math/photo-help/:id/check", auth, (req: any, res: any) => {
    res.set?.("Cache-Control", "no-store");
    const s = saved.get(String(req.params.id));
    if (!s || s.userId !== Number(req.user?.id) || s.at < now() - PHOTO_LIMITS.keepMs) return res.status(404).json({ message: "That problem has expired. Snap it again to keep going." });
    const value = String(req.body?.answer ?? "").trim().slice(0, 80);
    if (!value) return res.status(400).json({ message: "Type your answer first." });
    if (s.solved) return res.json({ right: true, checksLeft: PHOTO_LIMITS.checksPerProblem - s.checks });
    if (s.checks >= PHOTO_LIMITS.checksPerProblem) return res.status(429).json({ message: "You’ve checked this one a lot. Work through the practice problems below, then ask your teacher to look at it with you." });
    s.checks++;
    const right = answerMatches(value, s.accept);
    if (right) s.solved = true;
    res.json({ right, checksLeft: PHOTO_LIMITS.checksPerProblem - s.checks });
  });
}
