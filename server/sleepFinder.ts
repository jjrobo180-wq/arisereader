// Sleep Finder's "Ask for anything": someone describes what they'd like to fall asleep to, and the AI
// suggests real things to search for. The AI never supplies links; the app turns each pick's search
// phrase into a YouTube, Spotify or Apple search (shared/sleepFinder.ts). When the AI isn't set up,
// is busy or answers badly, the app falls back to its own catalog search in the browser.
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { openAiPlan, type AskPlan } from "./lifePlan";
import { ASK_PROMPT, askUserMessage, cleanAskRequest, picksFromAi } from "../shared/sleepFinder";

const asks = createAttemptLimiter({ max: 20, windowMs: 60 * 60_000 });

export function registerSleepFinderRoutes(app: Express, authMiddleware: RequestHandler, ask: AskPlan = openAiPlan, configured = () => !!process.env.OPENAI_API_KEY) {
  /** Body: { text, prefs }. Answers { picks }. Metered by plans.aiMeter (server/routes.ts) like every AI call. */
  app.post("/api/sleep-finder/ask", authMiddleware, async (req: any, res) => {
    if (!configured()) return res.status(503).json({ code: "ai_off", message: "The AI isn't set up on this site yet." });
    const { text, prefs } = cleanAskRequest(req.body);
    if (text.length < 2) return res.status(400).json({ message: "Tell it a little about what you'd like to fall asleep to." });
    const who = `u${req.user?.id}`;
    const wait = asks.retryAfter(who);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); return res.status(429).json({ message: `You've asked a lot this hour. Try again in ${waitWords(wait)}.` }); }
    asks.fail(who);
    try {
      const picks = picksFromAi(await ask(ASK_PROMPT, askUserMessage(text, prefs)));
      if (picks.length) return res.json({ picks });
      console.error("[sleep-finder] the AI's answer could not be used");
      return res.status(502).json({ code: "ai_bad", message: "The AI's ideas didn't come out right." });
    } catch (error: any) {
      if (error?.message !== "busy") console.error("[sleep-finder] AI error:", error?.message);
      return res.status(503).json({ code: "ai_busy", message: error?.message === "busy" ? "The AI is busy right now." : "The AI couldn't answer right now." });
    }
  });
}
