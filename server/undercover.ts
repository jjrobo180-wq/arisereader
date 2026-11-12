// Arise Undercover's server: one chat route. The app sends the recent messages and which look it's
// in (shared/undercover.ts); the answer is written to blend into that look. Chats are kept on the
// phone only; nothing is stored here.
//
// Live info: every question gets today's date and time in the person's time zone. Weather questions
// get the real forecast (Open-Meteo, no key) for the place named, the city in Settings, or the
// phone's location. Answers come from Perplexity's "sonar" model, which searches the web, so news,
// scores, prices and "who is…" questions are current; if Perplexity isn't set up or fails, the
// site's usual AI answers (server/aiProvider.ts).
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { cleanPlace, parseForecast, weatherCode, type Forecast } from "../shared/lifePlugins";
import { cleanHistory, isUndercoverTheme, nowFacts, undercoverSystemPrompt, wantsWeather, weatherFacts, weatherPlaceFrom, type UndercoverMsg, type UndercoverTheme } from "../shared/undercover";

export type UndercoverAsk = (system: string, messages: UndercoverMsg[]) => Promise<string>;
export type WeatherLookup = (where: { place?: string; lat?: number; lon?: number }, unit: "F" | "C") => Promise<Forecast | null>;

async function perplexityKey(): Promise<string> {
  try { const { storage } = await import("./storage"); const k = await storage.getSetting("perplexity_api_key"); if (k) return k; } catch { /* no database (tests) */ }
  return process.env.PERPLEXITY_API_KEY || process.env.CUSTOM_CRED_API_PERPLEXITY_AI_TOKEN || "";
}

/** The site's chat AI (server/aiProvider.ts routes OpenAI-style requests to whichever service is set up). */
async function askSite(system: string, messages: UndercoverMsg[]): Promise<string> {
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
}

/** Perplexity first (it searches the web), the site's AI if that isn't set up or fails. */
export const askUndercoverAi: UndercoverAsk = async (system, messages) => {
  const key = await perplexityKey().catch(() => "");
  if (key) {
    try {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.UNDERCOVER_WEB_MODEL || "sonar", temperature: 0.3, max_tokens: 500, messages: [{ role: "system", content: `${system} Use the web for anything current (news, scores, prices, people, events). No citation numbers like [1], no links.` }, ...messages] }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`perplexity ${res.status}`);
      const body: any = await res.json().catch(() => null);
      const text = String(body?.choices?.[0]?.message?.content || "").replace(/\[\d+\](?:\[\d+\])*/g, "").replace(/\*\*/g, "").trim();
      if (text) return text;
    } catch (e: any) { console.error("[undercover] Perplexity failed, using the site AI:", e?.message || e); }
  }
  return askSite(system, messages);
};

/** The forecast from Open-Meteo for a place name or coordinates (kept 15 minutes). */
const weatherCache = new Map<string, { at: number; value: Forecast | null }>();
export const openMeteoWeather: WeatherLookup = async (where, unit) => {
  let lat = where.lat, lon = where.lon, name = where.place || "your location";
  if (where.place && !(Number.isFinite(lat) && Number.isFinite(lon))) {
    const g: any = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(where.place.split(",")[0])}&count=10&language=en&format=json`, { signal: AbortSignal.timeout(8000) })).json();
    const results: any[] = Array.isArray(g?.results) ? g.results : [];
    const hint = where.place.includes(",") ? where.place.split(",").slice(1).join(",").trim().toLowerCase() : "";
    const best = results.find((r) => hint && [r.admin1, r.country, r.country_code].some((x: unknown) => typeof x === "string" && (x.toLowerCase() === hint || x.toLowerCase().startsWith(hint)))) ?? results[0];
    if (!best) return null;
    lat = Number(best.latitude); lon = Number(best.longitude); name = [best.name, best.admin1, best.country_code].filter(Boolean).join(", ");
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const key = `${lat!.toFixed(2)},${lon!.toFixed(2)}:${unit}`;
  const hit = weatherCache.get(key);
  if (hit && Date.now() - hit.at < 15 * 60_000) return hit.value ? { ...hit.value, place: name } : null;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7${unit === "F" ? "&temperature_unit=fahrenheit&wind_speed_unit=mph" : ""}`;
  const value = parseForecast(await (await fetch(url, { signal: AbortSignal.timeout(8000) })).json(), name, unit);
  weatherCache.set(key, { at: Date.now(), value });
  if (weatherCache.size > 2000) weatherCache.clear();
  return value;
};

const num = (v: unknown, max: number) => { const n = Number(v); return v !== null && v !== "" && Number.isFinite(n) && Math.abs(n) <= max ? Math.round(n * 100) / 100 : undefined; };

export function registerUndercoverRoutes(app: Express, auth: RequestHandler, deps: { ask?: UndercoverAsk; weather?: WeatherLookup; now?: () => number } = {}) {
  const ask = deps.ask ?? askUndercoverAi;
  const weather = deps.weather ?? openMeteoWeather;
  const now = deps.now ?? Date.now;
  const perHour = createAttemptLimiter({ max: 120, windowMs: 3600_000, now });

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

    const tz = typeof req.body?.tz === "string" ? req.body.tz.slice(0, 60) : "UTC";
    const facts: string[] = [nowFacts(new Date(now()), tz)];
    const question = messages[messages.length - 1].content;
    if (wantsWeather(question)) {
      const unit: "F" | "C" = req.body?.unit === "C" ? "C" : "F";
      const named = cleanPlace(weatherPlaceFrom(question));
      const home = cleanPlace(req.body?.place);
      const lat = num(req.body?.lat, 90), lon = num(req.body?.lon, 180);
      const where = named ? { place: named } : lat !== undefined && lon !== undefined ? { lat, lon, place: home || undefined } : home ? { place: home } : null;
      if (!where) facts.push("No place is known for the weather. Ask which city in one short line.");
      else {
        const f = await weather(where, unit).catch((e) => { console.error("[undercover] weather:", e?.message || e); return null; });
        facts.push(f ? weatherFacts(f, (c) => weatherCode(c).text) : `The weather for ${named || home || "that place"} couldn't be found. Say so in one short line.`);
      }
    }
    // Asked from inside a note (Arise Notes): the note so far, so "summarize this" or "what's missing" works.
    const note = typeof req.body?.context === "string" ? req.body.context.trim().slice(0, 8000) : "";
    if (note) facts.push(`The person's note so far, use it when the question is about it: """${note}"""`);
    // Asked from Arise Notes: what the person's own notes say about it (found there beforehand), used with the web.
    const fromNotes = typeof req.body?.notes === "string" ? req.body.notes.trim().slice(0, 3000) : "";
    if (fromNotes) facts.push(`What the person's own recorded notes say about this, use it together with the web and say it comes from their notes: """${fromNotes}"""`);
    try {
      const reply = await ask(`${undercoverSystemPrompt(theme)}\n\nFacts to use: ${facts.join(" ")}`, messages);
      res.json({ reply: reply.slice(0, 2000) });
    } catch (e: any) {
      console.error("[undercover] chat:", e?.message || e);
      res.status(502).json({ message: "Couldn't get an answer just now. Try again." });
    }
  });
}
