// Kitchen planner: the site's AI gives a typical grocery-store price for each ingredient on the week's list
// (brands and quantities included). Nothing sent here is stored. The screen falls back to its own estimates if this fails.
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";

const limits = createAttemptLimiter({ max: 30, windowMs: 60 * 60_000 });
const PROMPT = 'You price a weekly grocery list for a US household. For each item (name, quantity, optional brand) give a typical supermarket price in US dollars for exactly that quantity. Reply as JSON: {"prices": [{"key": the item key as given, "price": number}]}. No other text.';

export function registerMealCostRoutes(app: Express, authMiddleware: RequestHandler) {
  app.post("/api/arise-todo/meal/price", authMiddleware, async (req: any, res) => {
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ message: "Price checks aren't set up on this site yet." });
    const raw = Array.isArray(req.body?.items) ? req.body.items.slice(0, 120) : [];
    const items = raw.map((i: any) => ({ key: String(i?.key || "").slice(0, 80), name: String(i?.name || "").slice(0, 80), qty: String(i?.qty || "").slice(0, 40), brand: String(i?.brand || "").slice(0, 60) })).filter((i: any) => i.key && i.name);
    if (!items.length) return res.status(400).json({ message: "Nothing to price." });
    const who = `u${req.user?.id}`;
    const wait = limits.retryAfter(who);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); return res.status(429).json({ message: `Too many price checks. Try again in ${waitWords(wait)}.` }); }
    limits.fail(who);
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4.1-mini", temperature: 0.1, max_tokens: 2500, response_format: { type: "json_object" }, messages: [{ role: "system", content: PROMPT }, { role: "user", content: JSON.stringify(items) }] }),
        signal: AbortSignal.timeout(40_000),
      });
      if (!r.ok) throw new Error(String(r.status));
      const j: any = JSON.parse((await r.json())?.choices?.[0]?.message?.content || "{}");
      const known = new Set(items.map((i: any) => i.key));
      const prices = (Array.isArray(j?.prices) ? j.prices : []).filter((p: any) => known.has(String(p?.key)) && Number.isFinite(Number(p?.price)) && Number(p.price) >= 0 && Number(p.price) < 500).map((p: any) => ({ key: String(p.key), price: Math.round(Number(p.price) * 100) / 100 }));
      return res.json({ prices });
    } catch { return res.status(503).json({ message: "The price check is busy. Your estimates are still good; try again in a minute." }); }
  });
}
