// Grok (xAI) for the site's AI chat. Every AI feature calls OpenAI's chat endpoint
// (https://api.openai.com/v1/chat/completions). xAI's API takes the same requests, so instead of
// changing each feature, this wraps fetch once at startup:
//
//   AI_PROVIDER=grok (or xai)  → every chat request goes to Grok.
//   otherwise                  → OpenAI first; if OpenAI says the account is out of credit, the key
//                                is wrong, or it is overloaded, the same request is sent to Grok.
//
// Uses the site's Grok key (XAI_API_KEY, GROK_API_KEY or similar; see GROK_KEY_NAMES). XAI_MODEL or
// GROK_MODEL picks the Grok model (default "grok-latest").
// Only chat moves: voice (audio/speech), transcription and image generation stay on OpenAI.
const OPENAI_CHAT = "https://api.openai.com/v1/chat/completions";
const XAI_CHAT = "https://api.x.ai/v1/chat/completions";

type Fetch = typeof fetch;
export type AiProviderEnv = { XAI_API_KEY?: string; XAI_MODEL?: string; AI_PROVIDER?: string; OPENAI_API_KEY?: string };

const urlOf = (input: Parameters<Fetch>[0]) => (typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url);

/** Should a failed OpenAI reply be tried again on Grok? Out of credit, bad key, rate limit or a server error. */
export function shouldFallBack(status: number, body: string): boolean {
  return status === 401 || status === 402 || status === 429 || status >= 500 || /credit_balance_exhausted|insufficient_quota|billing/i.test(body);
}

/** The same chat request, rewritten for Grok: its model, its key. */
export function toGrok(init: RequestInit | undefined, env: AiProviderEnv): RequestInit {
  let body = init?.body;
  if (typeof body === "string") {
    try {
      const json = JSON.parse(body);
      json.model = env.XAI_MODEL || "grok-latest";
      body = JSON.stringify(json);
    } catch { /* not JSON: send as is */ }
  }
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${env.XAI_API_KEY}`);
  headers.set("Content-Type", "application/json");
  return { ...init, headers, body };
}

/** A fetch that routes OpenAI chat requests to Grok as described above; everything else is untouched. */
export function grokFetch(base: Fetch, env: AiProviderEnv): Fetch {
  // Grok first when asked, or when there is no OpenAI key at all.
  const grokFirst = /^(grok|xai)$/i.test(env.AI_PROVIDER || "") || !env.OPENAI_API_KEY || env.OPENAI_API_KEY === "routed-to-grok";
  return (async (input: Parameters<Fetch>[0], init?: RequestInit) => {
    if (!env.XAI_API_KEY || !urlOf(input).startsWith(OPENAI_CHAT)) return base(input, init);
    const askGrok = async () => {
      const res = await base(XAI_CHAT, toGrok(init, env));
      if (!res.ok) console.error("[ai] Grok failed:", res.status, (await res.clone().text().catch(() => "")).slice(0, 200));
      return res;
    };
    if (grokFirst) return askGrok();
    const res = await base(input, init);
    if (res.ok) return res;
    const text = await res.clone().text().catch(() => "");
    if (!shouldFallBack(res.status, text)) return res;
    console.warn("[ai] OpenAI", res.status, "— using Grok for this request");
    return askGrok();
  }) as Fetch;
}

/** Called once when the server starts. */
/** The Grok key, under whichever name it was saved in the host's settings. */
export const GROK_KEY_NAMES = ["XAI_API_KEY", "GROK_API_KEY", "XAI_KEY", "GROK_KEY", "X_AI_API_KEY", "GROK_API", "XAI_TOKEN"];
export function findGrokKey(env: Record<string, string | undefined>): string | undefined {
  for (const name of GROK_KEY_NAMES) if (env[name]?.trim()) return env[name]!.trim();
  // Anything else that looks like an xAI key (they start with "xai-").
  return Object.entries(env).find(([k, v]) => /grok|xai/i.test(k) && /^xai-/.test(v || ""))?.[1];
}

export function installGrok(source: Record<string, string | undefined> = process.env) {
  const key = findGrokKey(source);
  if (!key) { console.log("[ai] No Grok key found (looked for " + GROK_KEY_NAMES.join(", ") + ")"); return false; }
  const env: AiProviderEnv = { XAI_API_KEY: key, XAI_MODEL: source.XAI_MODEL || source.GROK_MODEL, AI_PROVIDER: source.AI_PROVIDER, OPENAI_API_KEY: source.OPENAI_API_KEY };
  const onlyGrok = !env.OPENAI_API_KEY;
  globalThis.fetch = grokFetch(globalThis.fetch.bind(globalThis), { ...env });
  // Features check for an OpenAI key before offering AI; with only a Grok key they should still work.
  if (onlyGrok) process.env.OPENAI_API_KEY = "routed-to-grok";
  console.log(`[ai] Grok ${/^(grok|xai)$/i.test(env.AI_PROVIDER || "") || env.OPENAI_API_KEY === "routed-to-grok" ? "handles all AI chat" : "is the backup when OpenAI fails"} (model ${env.XAI_MODEL || "grok-latest"})`);
  return true;
}
