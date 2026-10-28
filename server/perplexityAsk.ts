// Pod+ "Ask the episode" and "Catch me up" answered by Perplexity (its fast "sonar" model). Those send
// the whole transcript (often 20,000+ tokens), more than Groq's free plan takes in a minute, so on Groq
// they crawled; Perplexity takes it in one go and answers in a few seconds, and can look up the show
// on the web too. The key is the site's Perplexity key (admin settings, or PERPLEXITY_API_KEY), the
// same one book quizzes use. If Perplexity isn't set up or fails, `fallback` (Groq) answers instead.
import type { AskJson } from "./podcastDirectory";

const URL = "https://api.perplexity.ai/chat/completions";

export function perplexityJson(getKey: () => Promise<string>, fallback: AskJson, fetchImpl: typeof fetch = (...a) => fetch(...a)): AskJson {
  return async (system, user) => {
    const key = await getKey().catch(() => "");
    if (!key) return fallback(system, user);
    try {
      const res = await fetchImpl(URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.PERPLEXITY_ASK_MODEL || "sonar",
          temperature: 0.2,
          max_tokens: 1500,
          messages: [
            { role: "system", content: `${system} Reply with the JSON object only: no markdown, no citation numbers like [1].` },
            { role: "user", content: user },
          ],
        }),
        signal: AbortSignal.timeout(40_000),
      });
      if (!res.ok) throw new Error(`perplexity ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
      const body: any = await res.json().catch(() => null);
      const text = String(body?.choices?.[0]?.message?.content || "").trim();
      if (!text) throw new Error("perplexity empty");
      // Citation markers can slip into the text; the answer is shown as plain sentences.
      return text.replace(/\[\d+\](?:\[\d+\])*/g, "");
    } catch (e: any) {
      console.error("[podcast-listen] Perplexity failed, using the backup AI:", e?.message);
      return fallback(system, user);
    }
  };
}
