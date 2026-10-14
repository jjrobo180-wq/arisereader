// Arise LifeHub Plugin Store add-ons that read from the web: Today in history and What's trending
// (Wikipedia and Google Trends) and Bible passages (bible-api.com, King James Version). Each answer
// is cached, so a busy morning costs one request per feed, and an old copy is served if a feed is down.
import type { Express, RequestHandler } from "express";
import { cleanPlace, cleanReference, cleanWord, parseBiblePassage, parseDefinition, parseForecast, parseMostRead, parseOnThisDay, parseTrendsRss } from "../shared/lifePlugins";

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

  /** A dictionary entry: ?word=serendipity (dictionaryapi.dev, English). */
  app.get("/api/lifehub/define", authMiddleware, async (req: any, res) => {
    const word = cleanWord(req.query?.word);
    if (!word) return res.status(400).json({ message: "Type one word (letters only)." });
    try {
      const got = await cached(`define:${word}`, 30 * 86_400_000, async () => {
        const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`dictionaryapi answered ${r.status}`);
        return parseDefinition(await r.json());
      });
      if (!got.value) return res.status(404).json({ message: `We couldn't find “${word}”. Check the spelling?` });
      res.set("Cache-Control", "private, max-age=86400");
      return res.json(got.value);
    } catch (error: any) {
      console.error("[lifehub] define:", error?.message);
      return res.status(503).json({ message: "The dictionary can't be reached right now. Try again in a minute." });
    }
  });

  /** The weather for a town: ?place=Denver&unit=F (Open-Meteo, no key needed). */
  app.get("/api/lifehub/weather", authMiddleware, async (req: any, res) => {
    const place = cleanPlace(req.query?.place);
    const unit = req.query?.unit === "C" ? "C" : "F";
    // "Use my location" sends coordinates, so it works even when no town name could be found for them.
    const lat = Number(req.query?.lat), lon = Number(req.query?.lon);
    const coords = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && req.query?.lat !== "" ? { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 } : null;
    if (!place && !coords) return res.status(400).json({ message: "Type your town or city." });
    try {
      const where = coords ? { value: { ...coords, name: place || "Your location" } } : await cached(`geo:${place.toLowerCase()}`, 30 * 86_400_000, async () => {
        const json: any = await (await get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place.split(",")[0])}&count=10&language=en&format=json`)).json();
        const results: any[] = Array.isArray(json?.results) ? json.results : [];
        // "Denver, CO" or "Paris, France": prefer the result whose state or country matches the part after the comma.
        const hint = place.includes(",") ? place.split(",").slice(1).join(",").trim().toLowerCase() : "";
        const best = results.find((r) => hint && [r.admin1, r.country, r.country_code].some((x: unknown) => typeof x === "string" && (x.toLowerCase() === hint || x.toLowerCase().startsWith(hint)))) ?? results[0];
        return best ? { lat: Number(best.latitude), lon: Number(best.longitude), name: [best.name, best.admin1, best.country_code].filter(Boolean).join(", ") } : null;
      });
      if (!where.value) return res.status(404).json({ message: `We couldn't find “${place}”. Try adding the state, like Denver, CO.` });
      const { lat, lon, name } = where.value;
      const got = await cached(`weather:${lat.toFixed(2)},${lon.toFixed(2)}:${unit}`, 15 * 60_000, async () => {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7${unit === "F" ? "&temperature_unit=fahrenheit&wind_speed_unit=mph" : ""}`;
        const forecast = parseForecast(await (await get(url)).json(), name, unit);
        if (!forecast) throw new Error("weather answer was not readable");
        return forecast;
      });
      res.set("Cache-Control", "private, max-age=600");
      return res.json(got.value);
    } catch (error: any) {
      console.error("[lifehub] weather:", error?.message);
      return res.status(503).json({ message: "The weather can't be reached right now. Try again in a minute." });
    }
  });
}
