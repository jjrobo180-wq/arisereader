// Photos people post on Pod+ Social (posts, stories, profile pictures and covers) are checked before
// anyone else sees them: OpenAI's moderation model looks at each picture, and anything sexual,
// graphically violent or about self-harm is refused. Without a key (or if the check can't run),
// pictures go up and the report button (hidden after 3 reports) is the safety net.
type Verdict = { ok: true } | { ok: false; reason: string };
const BLOCK = ["sexual", "sexual/minors", "violence/graphic", "self-harm", "self-harm/intent", "self-harm/instructions"];

export async function moderateImages(urls: string[], text = "", fetcher: typeof fetch = fetch): Promise<Verdict> {
  const key = process.env.OPENAI_API_KEY;
  const pics = urls.filter((u) => /^https:\/\//.test(u) && !/\.(mp4|webm|mov)(\?|$)/i.test(u)).slice(0, 4);
  if (!key || key === "routed-to-grok" || (!pics.length && !text.trim())) return { ok: true };
  try {
    const input = [...(text.trim() ? [{ type: "text", text: text.slice(0, 2000) }] : []), ...pics.map((url) => ({ type: "image_url", image_url: { url } }))];
    const res = await fetcher("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { ok: true };
    const body = (await res.json()) as any;
    for (const r of Array.isArray(body?.results) ? body.results : []) {
      const hit = BLOCK.find((c) => r?.categories?.[c]);
      if (hit) return { ok: false, reason: hit.startsWith("self-harm") ? "self-harm" : hit.startsWith("violence") ? "graphic violence" : "sexual content" };
    }
    return { ok: true };
  } catch { return { ok: true }; }
}
