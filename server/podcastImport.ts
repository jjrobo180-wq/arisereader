// Pod+ "Bring your shows": finds, in Apple's podcast directory (the catalog Pod+ plays from), each show
// someone follows in another app, so Pod+ can follow it too. The list comes from an OPML file (the
// standard export of Overcast, Pocket Casts, Castro, Podcast Addict and most podcast apps), or from
// pasted show names and links (Apple Podcasts, Spotify and YouTube Music have no export).
//
// Apple's directory takes one request every few seconds for the whole server, so the app sends one
// show at a time and follows each as it's found (a progress bar, nothing lost if they leave halfway).
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { appleSearchUrl, parseShow, type PodShow } from "../shared/earshot";
import { importItem, sameFeed, showMatch, type ImportItem } from "../shared/podImport";

export type ImportDeps = {
  apple: (url: string) => Promise<any>;
  /** Kept answers, so a show imported by many people is looked up once. */
  cached: (key: string, make: () => Promise<any>) => Promise<any>;
  web?: typeof fetch;
};

/** A day's memory of directory answers (up to 3,000). */
export function importCache() {
  const m = new Map<string, { v: any; at: number }>();
  return async (key: string, make: () => Promise<any>) => {
    const hit = m.get(key);
    if (hit && Date.now() - hit.at < 24 * 3600_000) return hit.v;
    const v = await make();
    m.set(key, { v, at: Date.now() });
    if (m.size > 3000) m.delete(m.keys().next().value as string);
    return v;
  };
}

const lookupUrl = (id: string) => `https://itunes.apple.com/lookup?${new URLSearchParams({ id, media: "podcast", country: "US" })}`;

/** A show's name from its RSS feed (when the OPML or link gave only an address). */
async function feedTitle(url: string, web: typeof fetch): Promise<string> {
  try {
    const r = await web(url, { signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "PodPlus/1.0 (+https://podscroll.onrender.com)" } });
    if (!r.ok) return "";
    const text = (await r.text()).slice(0, 60_000);
    const m = text.match(/<channel[\s\S]*?<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 200) : "";
  } catch { return ""; }
}

/** A Spotify show's name from its public page (Spotify has no export, but its links can be pasted). */
async function spotifyTitle(url: string, web: typeof fetch): Promise<string> {
  try {
    const r = await web(url, { signal: AbortSignal.timeout(8_000), headers: { "User-Agent": "Mozilla/5.0 (compatible; PodPlus/1.0)" } });
    if (!r.ok) return "";
    const html = (await r.text()).slice(0, 200_000);
    const m = html.match(/<meta property="og:title" content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
    return m ? m[1].replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s*\|\s*Podcast on Spotify\s*$/i, "").trim().slice(0, 200) : "";
  } catch { return ""; }
}

/** Finds one show in Apple's directory. Null when it isn't there (some shows are Spotify or YouTube only). */
export async function findShow(item: ImportItem, d: ImportDeps): Promise<PodShow | null> {
  const web = d.web ?? fetch;
  if (item.appleId) {
    const body = await d.cached(`import:id:${item.appleId}`, () => d.apple(lookupUrl(item.appleId!)));
    return (Array.isArray(body?.results) ? body.results : []).map((r: unknown) => parseShow(r)).find((s: PodShow | null) => s && s.id === item.appleId) ?? null;
  }
  let title = item.title;
  if (!title && item.feed) title = await feedTitle(item.feed, web);
  if (!title && item.spotify) title = await spotifyTitle(item.spotify, web);
  if (!title) return null;
  const body = await d.cached(`import:q:${title.toLowerCase()}`, () => d.apple(appleSearchUrl(title!, "podcast", 15, true)));
  const shows = (Array.isArray(body?.results) ? body.results : []).map((r: unknown) => parseShow(r)).filter(Boolean) as PodShow[];
  if (item.feed) { const byFeed = shows.find((s) => s.feed && sameFeed(s.feed, item.feed!)); if (byFeed) return byFeed; }
  return showMatch(title, shows);
}

export function registerImportRoutes(app: Express, gate: RequestHandler, prefix: string, d: ImportDeps) {
  const limit = createAttemptLimiter({ max: 600, windowMs: 60 * 60_000 });
  app.post(`${prefix}/import/match`, gate, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    const item = importItem(req.body);
    if (!item) return res.status(400).json({ message: "Nothing to look for." });
    const key = String(req.user?.id || "");
    const wait = limit.retryAfter(key);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); return res.status(429).json({ message: `That's a lot of shows for one hour. Try the rest in ${waitWords(wait)}.`, busy: false }); }
    limit.fail(key);
    try {
      const show = await findShow(item, d);
      res.json({ show });
    } catch (e: any) {
      // Apple's directory is busy (one request every few seconds for everyone): the app waits and asks again.
      res.status(503).json({ message: "Busy, trying again…", busy: true, retry: true });
    }
  });
}
