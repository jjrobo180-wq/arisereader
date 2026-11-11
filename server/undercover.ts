// Arise Undercover's server: one chat route. The app sends the recent messages and which look it's
// in (shared/undercover.ts); the answer is written to blend into that look. Chats are kept on the
// phone only; nothing is stored here.
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { cleanHistory, isUndercoverTheme, undercoverSystemPrompt, type UndercoverMsg, type UndercoverTheme } from "../shared/undercover";

export type UndercoverAsk = (system: string, messages: UndercoverMsg[]) => Promise<string>;

/** The site's chat AI (server/aiProvider.ts routes OpenAI-style requests to whichever service is set up). */
export const askUndercoverAi: UndercoverAsk = async (system, messages) => {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.UNDERCOVER_AI_MODEL || "gpt-4.1-mini", temperature: 0.4, max_tokens: 400, messages: [{ role: "system", content: system }, ...messages] }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) { lastErr = new Error(`ai ${res.status}`); if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 1500)); continue; } break; }
      const body: any = await res.json().catch(() => null);
      const text = String(body?.choices?.[0]?.message?.content || "").trim();
      if (text) return text;
      lastErr = new Error("empty answer");
    } catch (e) { lastErr = e; }
  }
  throw lastErr instanceof Error ? lastErr : new Error("AI failed");
};

export function registerUndercoverRoutes(app: Express, auth: RequestHandler, deps: { ask?: UndercoverAsk; now?: () => number } = {}) {
  const ask = deps.ask ?? askUndercoverAi;
  const perHour = createAttemptLimiter({ max: 120, windowMs: 3600_000, now: deps.now });

  app.post("/api/undercover/chat", auth, async (req: any, res) => {
    const u = req.user;
    if (!u || !Number.isSafeInteger(Number(u.id))) return res.status(401).json({ message: "Sign in to use Arise Undercover." });
    const key = `u${u.id}`;
    const wait = perHour.retryAfter(key);
    if (wait > 0) return res.status(429).json({ message: `That's a lot of questions. Try again in ${waitWords(wait)}.` });
    const theme: UndercoverTheme = isUndercoverTheme(req.body?.theme) ? req.body.theme : "text";
    const messages = cleanHistory(req.body?.messages);
    if (!messages.length) return res.status(400).json({ message: "Type a question first." });
    perHour.fail(key);
    try {
      const reply = await ask(undercoverSystemPrompt(theme), messages);
      res.json({ reply: reply.slice(0, 2000) });
    } catch (e: any) {
      console.error("[undercover] chat:", e?.message || e);
      res.status(502).json({ message: "Couldn't get an answer just now. Try again." });
    }
  });
}
