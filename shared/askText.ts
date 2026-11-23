// Text helpers for Ask AI in Arise Notes and Arise To Duo (client/src/lib/askAi.ts, server/undercover.ts).

/** Splits an answer into lines (group chat messages, bullet points), without bullet marks. */
export function answerLines(text: string): string[] {
  return String(text || "").split(/\n+/).map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim()).filter(Boolean);
}

/** Does the question ask about the weather? */
export function wantsWeather(q: string): boolean {
  return /\b(weather|forecast|temperature|temp|rain(ing|y)?|snow(ing|y)?|sunny|humid(ity)?|windy|umbrella|jacket|degrees|how (hot|cold|warm))\b/i.test(q);
}

/** The place named in a weather question ("weather in Denver, CO tomorrow" → "Denver, CO"). */
export function weatherPlaceFrom(q: string): string {
  const m = /\b(?:in|for|at|near)\s+([A-Za-z][A-Za-z .'-]{1,40}(?:,\s*[A-Za-z .]{2,30})?)/i.exec(q);
  if (!m) return "";
  const place = m[1].replace(/\b(today|tonight|tomorrow|this|next|right now|now|on|the|weekend|week|morning|afternoon|evening)\b.*$/i, "").replace(/[\s,.'-]+$/, "").trim();
  return /^(the|my|here|there|it|a|an)$/i.test(place) || place.length < 2 ? "" : place;
}
