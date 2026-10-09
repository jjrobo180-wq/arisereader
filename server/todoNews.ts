// A.R.I.S.E. To-Do: current news headlines (see shared/todoNews.ts). Cached for 10 minutes per feed.
import type { Express, RequestHandler } from "express";
import { newsFeedUrl, parseNewsRss, type Headline } from "../shared/todoNews";

const cache = new Map<string, { at: number; items: Headline[] }>();
const TTL = 10 * 60_000;

/** Headlines for a topic (or a town, for Local), from the 10-minute cache when it's fresh.
 *  Also used by the phone-notification pass to fill in news reminders. */
export async function fetchHeadlines(topic: string, q = ""): Promise<{ items: Headline[]; at: number; stale?: boolean } | null> {
  const url = newsFeedUrl(topic, q);
  if (!url) return null;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (ARISE To-Do news)", Accept: "application/rss+xml, application/xml" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const fresh = { at: Date.now(), items: parseNewsRss(await r.text()) };
    cache.set(url, fresh);
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
    return fresh;
  } catch (error: any) {
    console.error("[todo-news] failed:", String(error?.message));
    if (hit) return { ...hit, stale: true };
    throw error;
  }
}

export function registerTodoNewsRoutes(app: Express, authMiddleware: RequestHandler) {
  app.get("/api/arise-todo/news", authMiddleware, async (req: any, res) => {
    const topic = typeof req.query?.topic === "string" ? req.query.topic : "top";
    const q = typeof req.query?.q === "string" ? req.query.q : "";
    if (!newsFeedUrl(topic, q)) return res.status(400).json({ message: topic === "local" ? "Type your town or city to see local news." : "Unknown news topic." });
    try {
      const got = (await fetchHeadlines(topic, q))!;
      res.set("Cache-Control", "private, max-age=300");
      return res.json({ items: got.items, updatedAt: new Date(got.at).toISOString(), ...(got.stale ? { stale: true } : {}) });
    } catch {
      return res.status(503).json({ message: "The news can't be reached right now. Try again in a minute." });
    }
  });
}
