// Live facts for "@arise" asks that need them (shared/ariseAsks.ts needsLookup): the weather from
// Open-Meteo (free, no key) for the place named in the ask or the phone's time zone, and anything else
// current (news, scores, prices, what's on) from the web through Perplexity. Arise's AI then writes the
// answer from these facts instead of saying it can't know (server/todoAsks.ts).
import { WEATHER_ASK } from "@shared/ariseAsks";

export type Lookup = { facts: string; source: string } | null;
type Fetch = typeof fetch;

/** WMO weather codes (what Open-Meteo reports) in words. */
const SKY: Record<number, string> = {
  0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "cloudy", 45: "foggy", 48: "foggy with frost",
  51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 56: "freezing drizzle", 57: "freezing drizzle",
  61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain",
  71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains", 80: "rain showers", 81: "rain showers", 82: "heavy rain showers",
  85: "snow showers", 86: "heavy snow showers", 95: "thunderstorms", 96: "thunderstorms with hail", 99: "thunderstorms with hail",
};

/** The place named in an ask ("weather in Chicago tomorrow", "will it snow at Vail"), or "". */
export function placeIn(ask: string): string {
  const m = /\b(?:in|for|at|near|around)\s+([A-Za-z][A-Za-z .'-]{1,60}?)(?=\s+(?:today|tonight|tomorrow|this|next|on|over|during|for|at|in)\b|[?.!,]|\s*$)/i.exec(ask);
  const place = (m?.[1] || "").trim();
  // "in the morning", "for tomorrow", "at night" aren't places.
  if (!place || /^(the|a|an|my|our|this|that|today|tonight|tomorrow|morning|afternoon|evening|night|weekend|week|school|work|home)\b/i.test(place)) return "";
  return place;
}

/** The city a time zone is named after ("America/Los_Angeles" -> "Los Angeles"). */
export const tzCity = (tz?: string) => (tz && /^[A-Za-z]+\/[A-Za-z_]+/.test(tz) ? tz.split("/").pop()!.replace(/_/g, " ") : "");

export async function weatherFacts(ask: string, tz: string | undefined, fetchImpl: Fetch = fetch): Promise<Lookup> {
  const named = placeIn(ask);
  const query = named || tzCity(tz);
  if (!query) return null;
  const geo: any = await fetchImpl(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(8000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const g = geo?.results?.[0];
  if (!g || !Number.isFinite(g.latitude) || !Number.isFinite(g.longitude)) return null;
  const us = g.country_code === "US";
  const unit = us ? "°F" : "°C", wind = us ? "mph" : "km/h";
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&timezone=auto&forecast_days=7`
    + "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation"
    + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,snowfall_sum,wind_speed_10m_max,sunrise,sunset"
    + (us ? "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch" : "");
  const w: any = await fetchImpl(url, { signal: AbortSignal.timeout(8000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!w?.daily?.time?.length) return null;
  const where = [g.name, g.admin1, g.country_code !== "US" ? g.country : ""].filter(Boolean).join(", ");
  const d = w.daily, c = w.current || {};
  const r = (n: unknown) => Math.round(Number(n));
  const day = (i: number) => {
    const date = new Date(`${d.time[i]}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    const snow = Number(d.snowfall_sum?.[i]) > 0 ? `, snow ${d.snowfall_sum[i]}${us ? " in" : " cm"}` : "";
    return `- ${date}: ${SKY[d.weather_code?.[i]] ?? "mixed"}, high ${r(d.temperature_2m_max[i])}${unit}, low ${r(d.temperature_2m_min[i])}${unit}, chance of rain or snow ${r(d.precipitation_probability_max?.[i] ?? 0)}%${snow}, wind up to ${r(d.wind_speed_10m_max?.[i])} ${wind}, sunrise ${String(d.sunrise?.[i] || "").slice(11)}, sunset ${String(d.sunset?.[i] || "").slice(11)}`;
  };
  const facts = [
    `Weather for ${where}${named ? "" : " (from the phone's time zone; the person can name another place)"} from Open-Meteo, fetched just now:`,
    Number.isFinite(c.temperature_2m) ? `- Right now: ${SKY[c.weather_code] ?? "mixed"}, ${r(c.temperature_2m)}${unit} (feels like ${r(c.apparent_temperature)}${unit}), wind ${r(c.wind_speed_10m)} ${wind}` : "",
    ...d.time.map((_: string, i: number) => day(i)),
  ].filter(Boolean).join("\n");
  return { facts, source: `Open-Meteo forecast for ${where}` };
}

/** Anything else current, looked up on the web (Perplexity). */
export async function webFacts(ask: string, today: string, search: (system: string, user: string) => Promise<string>): Promise<Lookup> {
  const text = await search(
    `You look up current facts on the web for a family planner's AI helper. Today is ${today}. Find what's needed to answer the request with up-to-date facts: dates, times, numbers, names, and where it's from. Keep it under 250 words. Reply with JSON only: {"facts": "the facts as short bullet lines", "sources": ["site names"]}.`,
    ask,
  ).catch(() => "");
  let j: any = null;
  try { j = JSON.parse(String(text).replace(/^```(?:json)?|```$/g, "").trim()); } catch { return null; }
  const facts = String(j?.facts || "").replace(/\[\d+\]/g, "").trim().slice(0, 3000);
  if (facts.length < 20) return null;
  const sources = (Array.isArray(j?.sources) ? j.sources : []).map((s: unknown) => String(s).slice(0, 60)).filter(Boolean).slice(0, 4);
  return { facts: `Looked up on the web just now:\n${facts}`, source: sources.length ? `Looked up on the web: ${sources.join(", ")}` : "Looked up on the web" };
}

/** Live facts for an ask: the weather, or a web look-up. Null when none could be found. */
export function makeLookup(deps: { search?: (system: string, user: string) => Promise<string>; fetchImpl?: Fetch }) {
  return async (ask: string, tz: string | undefined, today: string): Promise<Lookup> => {
    if (WEATHER_ASK.test(ask)) {
      const w = await weatherFacts(ask, tz, deps.fetchImpl).catch(() => null);
      if (w) return w;
    }
    return deps.search ? webFacts(ask, today, deps.search) : null;
  };
}
