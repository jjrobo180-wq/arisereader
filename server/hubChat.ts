// Arise hubs: the AI assistant plugin. A chat for WorkHub (teachers) and LifeHub (families), answered by the
// site's AI. Only what the person types is sent, with the hub's name and today's date; nothing is stored here.
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";

export type ChatTurn = { role: "user" | "assistant"; content: string };

const LIMITS = { turns: 24, chars: 4000, reply: 900 } as const;
const chatLimits = createAttemptLimiter({ max: 60, windowMs: 10 * 60_000 });

const PROMPTS = {
  work: `You are the AI assistant inside Arise WorkHub, a planner for teachers and special education staff.
Help with lesson ideas, IEP goal and accommodation wording, parent and staff emails, behavior plans, data collection, schedules, and quick explanations of teaching topics.
Be warm, practical and brief. Use short paragraphs or short lists. Draft text the teacher can copy when they ask for an email, goal or note.
Do not invent facts about a specific student; ask for what you need. Remind them to follow their district's policies for student privacy and legal IEP decisions when it matters.`,
  life: `You are the AI assistant inside Arise LifeHub, a family organizer.
Help with meal ideas and grocery lists, weekly plans, chores and routines, budgeting basics, trip packing, kids' homework explanations, kind messages, and everyday questions.
Be warm, practical and brief. Use short paragraphs or short lists. For health, legal or money decisions, give general information and suggest checking with a professional.`,
} as const;

/** The conversation made safe to send: user and assistant turns only, trimmed, the latest ones, ending with the user's. */
export function cleanTurns(raw: unknown): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const t of Array.isArray(raw) ? raw : []) {
    if (!t || typeof t !== "object") continue;
    const role = (t as any).role === "assistant" ? "assistant" : (t as any).role === "user" ? "user" : null;
    const content = typeof (t as any).content === "string" ? (t as any).content.replace(/\u0000/g, "").trim().slice(0, LIMITS.chars) : "";
    if (role && content) turns.push({ role, content });
  }
  const recent = turns.slice(-LIMITS.turns);
  while (recent.length && recent[0].role !== "user") recent.shift();
  return recent.length && recent[recent.length - 1].role === "user" ? recent : [];
}

export type AskChat = (system: string, turns: ChatTurn[]) => Promise<string>;

/** The site's AI (OpenAI), the same one the food diary uses. */
export const openAiChat: AskChat = async (system, turns) => {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1", temperature: 0.5, max_tokens: LIMITS.reply, messages: [{ role: "system", content: system }, ...turns] }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) { console.error("[hub-chat] AI failed:", res.status); throw new Error(res.status === 429 ? "busy" : "failed"); }
  const payload: any = await res.json().catch(() => null);
  return String(payload?.choices?.[0]?.message?.content || "").trim();
};

export function registerHubChatRoutes(app: Express, authMiddleware: RequestHandler, ask: AskChat = openAiChat, configured = () => !!process.env.OPENAI_API_KEY) {
  app.post("/api/hub-chat", authMiddleware, async (req: any, res) => {
    if (!configured()) return res.status(503).json({ message: "The AI assistant isn't set up on this site yet." });
    const hub = req.body?.hub === "work" ? "work" : "life";
    const turns = cleanTurns(req.body?.messages);
    if (!turns.length) return res.status(400).json({ message: "Type a message first." });
    const who = `u${req.user?.id}`;
    const wait = chatLimits.retryAfter(who);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); return res.status(429).json({ message: `You've sent a lot of messages. Try again in ${waitWords(wait)}.` }); }
    chatLimits.fail(who);
    const today = typeof req.body?.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.body.today) ? req.body.today : new Date().toISOString().slice(0, 10);
    try {
      const reply = await ask(`${PROMPTS[hub]}\nToday is ${today}.`, turns);
      if (!reply) return res.status(503).json({ message: "No answer came back. Try again." });
      return res.json({ reply });
    } catch (error: any) {
      return res.status(503).json({ message: error?.message === "busy" ? "The AI is busy. Try again in a minute." : "The AI couldn't answer right now. Try again." });
    }
  });
}
