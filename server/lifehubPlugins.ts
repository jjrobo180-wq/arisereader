// Arise LifeHub Plugin Store add-ons that read from the web: Today in history and What's trending
// (Wikipedia and Google Trends) and Bible passages (bible-api.com, King James Version). Each answer
// is cached, so a busy morning costs one request per feed, and an old copy is served if a feed is down.
import type { Express, RequestHandler } from "express";
import { cleanReference, parseBiblePassage, parseMostRead, parseOnThisDay, parseTrendsRss } from "../shared/lifePlugins";

const UA = "AriseLifeHub/1.0 (https://arisereader.onrender.com)";
const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<{ value: T; at: number; stale?: boolean }> {
  const hit = cache.get(key) as { at: number; value: T } | undefined;
  if (hit && Date.now() - hit.at < ttlMs) return hit;
  try {
    const fresh = { at: Date.now(), value: await load() };
    cache.set(key, fresh);
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
    return fresh;
  } catch (error) {
    if (hit) return { ...hit, stale: true };
    throw error;
  }
}

async function get(url: string, accept = "application/json") {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Api-User-Agent": UA, Accept: accept }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${new URL(url).hostname} answered ${r.status}`);
  return r;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function registerLifehubPluginRoutes(app: Express, authMiddleware: RequestHandler) {
  /** What happened on a day of the year: ?month=10&day=10 (defaults to today). */
  app.get("/api/lifehub/history", authMiddleware, async (req: any, res) => {
    const now = new Date();
    const month = Number(req.query?.month ?? now.getMonth() + 1), day = Number(req.query?.day ?? now.getDate());
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > 31) {
      return res.status(400).json({ message: "Pick a real day." });
    }
    try {
      const got = await cached(`history:${month}-${day}`, 6 * 3_600_000, async () => {
        const json: any = await (await get(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${pad(month)}/${pad(day)}`)).json();
        return { selected: parseOnThisDay(json?.selected, 30), events: parseOnThisDay(json?.events, 40), births: parseOnThisDay(json?.births, 30), holidays: parseOnThisDay(json?.holidays, 15) };
      });
      res.set("Cache-Control", "private, max-age=1800");
      return res.json({ ...got.value, month, day, ...(got.stale ? { stale: true } : {}) });
    } catch (error: any) {
      console.error("[lifehub] history:", error?.message);
      return res.status(503).json({ message: "Today in history can't be reached right now. Try again in a minute." });
    }
  });

  /** Top searches right now (Google Trends, US) and the most-read Wikipedia articles. */
  app.get("/api/lifehub/trending", authMiddleware, async (_req: any, res) => {
    const yesterday = new Date(Date.now() - 86_400_000);
    const [searches, mostRead] = await Promise.allSettled([
      cached("trending:searches", 15 * 60_000, async () => parseTrendsRss(await (await get("https://trends.google.com/trending/rss?geo=US", "application/rss+xml, application/xml")).text())),
      cached(`trending:mostread:${yesterday.toISOString().slice(0, 10)}`, 60 * 60_000, async () => {
        const d = yesterday;
        return parseMostRead(await (await get(`https://en.wikipedia.org/api/rest_v1/feed/featured/${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`)).json());
      }),
    ]);
    if (searches.status === "rejected" && mostRead.status === "rejected") {
      console.error("[lifehub] trending:", String(searches.reason?.message), String(mostRead.reason?.message));
      return res.status(503).json({ message: "Trending can't be reached right now. Try again in a minute." });
    }
    res.set("Cache-Control", "private, max-age=600");
    return res.json({
      searches: searches.status === "fulfilled" ? searches.value.value : [],
      mostRead: mostRead.status === "fulfilled" ? mostRead.value.value : [],
      updatedAt: new Date(searches.status === "fulfilled" ? searches.value.at : Date.now()).toISOString(),
    });
  });

  /** A Bible passage: ?ref=John 3:16 (King James Version). */
  app.get("/api/lifehub/bible", authMiddleware, async (req: any, res) => {
    const ref = cleanReference(req.query?.ref);
    if (!ref) return res.status(400).json({ message: "Type a passage like John 3:16, Psalm 23 or Romans 8:28-39." });
    try {
      const got = await cached(`bible:${ref.toLowerCase()}`, 7 * 86_400_000, async () => {
        const r = await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=kjv`, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`bible-api answered ${r.status}`);
        return parseBiblePassage(await r.json());
      });
      if (!got.value) return res.status(404).json({ message: `We couldn't find ${ref}. Check the book, chapter and verse.` });
      res.set("Cache-Control", "private, max-age=86400");
      return res.json(got.value);
    } catch (error: any) {
      console.error("[lifehub] bible:", error?.message);
      return res.status(503).json({ message: "The Bible lookup can't be reached right now. Try again in a minute." });
    }
  });
}
