// Features that called Perplexity directly broke completely when its credit ran out ("You exceeded your current
// quota", November 2026). These helpers send the same chat to whichever AI is working:
//
//  - siteFirst: the site's own AI first (requests to OpenAI's address go on to Groq/Grok: server/aiProvider.ts),
//    Perplexity only if that fails. For things that don't need the web: live classroom games, study sets.
//  - webFirst: Perplexity first (it searches the web, which book quizzes rely on), the site's AI if Perplexity
//    refuses (no credit, bad key, busy) or is down. The reply says which one answered (x-ai-backup: site), so a
//    book quiz written without the web can be flagged for a teacher to check.
//
// Both return a normal fetch Response in OpenAI's chat shape, so the code around them doesn't change.
import { findBackup } from "./aiProvider";
const PPLX = "https://api.perplexity.ai/chat/completions";
const SITE = "https://api.openai.com/v1/chat/completions";
type Fetch = typeof fetch;

function bodyFor(init: RequestInit | undefined, model: string, forPerplexity = false): string {
  let j: any = {};
  try { j = JSON.parse(String(init?.body ?? "{}")); } catch { /* sent as is */ }
  // Perplexity only takes a JSON schema, not "json_object": it's asked for JSON in the prompt instead.
  if (forPerplexity && j.response_format?.type === "json_object") delete j.response_format;
  return JSON.stringify({ ...j, model });
}
const sanitize = (s: string) => s.replace(/(pplx|gsk|sk|xai)-?_?[A-Za-z0-9]{8,}/g, "[key]").slice(0, 300);

/** The reply's body as text (works for real Responses and the simple stand-ins tests use). */
const textOf = async (res: any): Promise<string> => (typeof res?.text === "function" ? res.text() : JSON.stringify(await res?.json?.()));
/** Whether the site has an AI of its own (Groq or Grok, or OpenAI when turned on), with or without Perplexity. */
export function siteAiConfigured(env: Record<string, string | undefined> = process.env): boolean {
  if (env.OPENAI_API_KEY && env.OPENAI_API_KEY !== "routed-to-grok" && env.USE_OPENAI === "1") return true;
  if (findBackup(env)) return true; // the same search server/aiProvider.ts uses to route the site's AI
  return Object.entries(env).some(([k, v]) => /groq|grok|xai/i.test(k) && typeof v === "string" && v.trim().length > 10);
}

async function trySite(f: Fetch, init: RequestInit | undefined): Promise<Response | null> {
  try {
    const res = await f(SITE, { ...init, headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY || "routed"}`, "Content-Type": "application/json" }, body: bodyFor(init, process.env.SITE_CHAT_MODEL || "gpt-4.1-mini") });
    if (res.ok) {
      const text = await textOf(res);
      return new Response(text, { status: 200, headers: { "Content-Type": "application/json", "x-ai-backup": "site" } });
    }
    console.error("[ai-backup] site AI failed:", res.status, sanitize(await textOf(res).catch(() => "")));
  } catch (e: any) { console.error("[ai-backup] site AI failed:", e?.message); }
  return null;
}
async function tryPerplexity(f: Fetch, key: string, init: RequestInit | undefined, model: string): Promise<Response | null> {
  if (!key) return null;
  try {
    const res = await f(PPLX, { ...init, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: bodyFor(init, model, true) });
    if (res.ok) return res;
    console.error("[ai-backup] Perplexity failed:", res.status, sanitize(await textOf(res).catch(() => "")));
  } catch (e: any) { console.error("[ai-backup] Perplexity failed:", e?.message); }
  return null;
}
const failed = () => new Response(JSON.stringify({ error: { message: "The AI is busy right now. Try again in a minute." } }), { status: 503, headers: { "Content-Type": "application/json" } });

/** The site's AI first, then Perplexity. `init` is the chat request as it would have gone to Perplexity. */
export async function siteFirst(init: RequestInit, opts: { perplexityKey?: string; model?: string; fetch?: Fetch } = {}): Promise<Response> {
  const f = opts.fetch ?? ((...a) => fetch(...a));
  return (siteAiConfigured() ? await trySite(f, init) : null) ?? (await tryPerplexity(f, opts.perplexityKey || "", init, opts.model || "sonar")) ?? failed();
}
/** Perplexity first (web search), then the site's AI. */
export async function webFirst(init: RequestInit, opts: { perplexityKey?: string; model?: string; fetch?: Fetch } = {}): Promise<Response> {
  const f = opts.fetch ?? ((...a) => fetch(...a));
  return (await tryPerplexity(f, opts.perplexityKey || "", init, opts.model || "sonar")) ?? (siteAiConfigured() ? await trySite(f, init) : null) ?? failed();
}
/** True when the site's AI answered instead of Perplexity (so no web lookup happened). */
export const answeredWithoutWeb = (res: Response) => res.headers.get("x-ai-backup") === "site";
