// AI Reminders: builds a life plan (a schedule of reminders and an overview) from what someone says they
// want. The AI is asked for strict JSON; whatever comes back is cleaned exactly like saved data
// (shared/lifePlan.ts). When the AI isn't set up, is busy, answers badly or the person has no AI left, the
// app uses the built-in planner instead, so they always get a plan. Only their answers are sent.
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { PLAN_PROMPT, cleanPlanRequest, planFromAi, planUserMessage } from "../shared/lifePlan";

export type AskPlan = (system: string, user: string) => Promise<string>;

/** The site's AI (OpenAI), asked for a JSON object. */
export const openAiPlan: AskPlan = async (system, user) => {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.1", temperature: 0.6, max_tokens: 3000, response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) { console.error("[life-plan] AI failed:", res.status); throw new Error(res.status === 429 ? "busy" : "failed"); }
  const payload: any = await res.json().catch(() => null);
  return String(payload?.choices?.[0]?.message?.content || "").trim();
};

const builds = createAttemptLimiter({ max: 8, windowMs: 60 * 60_000 });

export function registerLifePlanRoutes(app: Express, authMiddleware: RequestHandler, ask: AskPlan = openAiPlan, configured = () => !!process.env.OPENAI_API_KEY) {
  /** Body: { vision, focuses, wake, bed, workDays }. Answers { plan } (made by the AI), or an error the app
   *  answers by using the built-in planner in the browser (shared/lifePlan.ts's builtinPlan), which never
   *  touches this route or the AI allowance. Metered by plans.aiMeter (server/routes.ts) like every AI call. */
  app.post("/api/life-plan/build", authMiddleware, async (req: any, res) => {
    if (!configured()) return res.status(503).json({ code: "ai_off", message: "The AI isn't set up on this site yet." });
    const request = cleanPlanRequest(req.body);
    if (!request.vision && !request.focuses.length) return res.status(400).json({ message: "Tell it a little about the life you want, or pick what matters most." });
    const who = `u${req.user?.id}`;
    const wait = builds.retryAfter(who);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); return res.status(429).json({ message: `You've built a lot of plans. Try again in ${waitWords(wait)}.` }); }
    builds.fail(who);
    try {
      const plan = planFromAi(await ask(PLAN_PROMPT, planUserMessage(request)), request);
      if (plan) return res.json({ plan });
      console.error("[life-plan] the AI's answer could not be used");
      return res.status(502).json({ code: "ai_bad", message: "The AI's plan didn't come out right." });
    } catch (error: any) {
      if (error?.message !== "busy") console.error("[life-plan] AI error:", error?.message);
      return res.status(503).json({ code: "ai_busy", message: error?.message === "busy" ? "The AI is busy right now." : "The AI couldn't answer right now." });
    }
  });
}
