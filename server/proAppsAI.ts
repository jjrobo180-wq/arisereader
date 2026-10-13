// The premium apps' AI helper: POST /api/apps/ai { task, input }. The task picks one of the fixed
// instructions in shared/pro/aiTasks.ts; the person's words only fill it in. Answers are JSON.
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { AI_TASKS, cleanAiInput } from "@shared/pro/aiTasks";

export type ProAsk = (system: string, user: string, maxTokens: number) => Promise<string>;

const limits = createAttemptLimiter({ max: 60, windowMs: 10 * 60_000 });

const askOpenAI: ProAsk = async (system, user, maxTokens) => {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1", temperature: 0.7, max_tokens: maxTokens, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) { console.error("[pro-ai] failed:", res.status); throw new Error(res.status === 429 ? "The AI is busy right now. Try again in a minute." : "The AI couldn't help with that right now. Try again."); }
  const payload: any = await res.json().catch(() => null);
  return String(payload?.choices?.[0]?.message?.content || "");
};

export function registerProAppsAI(app: Express, authMiddleware: RequestHandler, ask: ProAsk = askOpenAI, configured = () => !!process.env.OPENAI_API_KEY) {
  app.post("/api/apps/ai", authMiddleware, async (req: any, res) => {
    if (!req.user?.id) return res.status(401).json({ message: "Sign in first." });
    if (!configured()) return res.status(503).json({ message: "The AI helper isn't set up on this site yet." });
    const task = AI_TASKS[String(req.body?.task || "")];
    if (!task) return res.status(400).json({ message: "Unknown AI task." });
    const input = cleanAiInput(req.body?.input);
    if (!Object.values(input).some((x) => x.trim())) return res.status(400).json({ message: "Type something first so the AI knows what to make." });
    const who = `u${req.user.id}`;
    const wait = limits.retryAfter(who);
    if (wait > 0) return res.status(429).json({ message: `That's a lot of AI help in a short time. Try again in ${waitWords(wait)}.` });
    limits.fail(who);
    try {
      const text = await ask(task.system, task.prompt(input), task.maxTokens);
      let out: unknown;
      try { out = JSON.parse(text); } catch { return res.status(502).json({ message: "The AI's answer couldn't be read. Try again." }); }
      if (!out || typeof out !== "object") return res.status(502).json({ message: "The AI didn't send anything usable. Try again." });
      res.json({ result: out });
    } catch (e: any) {
      res.status(502).json({ message: e?.message || "The AI couldn't help right now." });
    }
  });
}
