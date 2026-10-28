// Grok (xAI) for the site's AI chat. Every AI feature calls OpenAI's chat endpoint
// (https://api.openai.com/v1/chat/completions). xAI's API takes the same requests, so instead of
// changing each feature, this wraps fetch once at startup:
//
//   default                    → OpenAI is off for this site: every chat request goes to the backup
//                                (Groq on this site; Grok if that key is set instead).
//   USE_OPENAI=1               → OpenAI first; if it is out of credit, the key is wrong, or it is
//                                overloaded, the same request goes to the backup.
//
// Uses the site's Grok key (XAI_API_KEY, GROK_API_KEY or similar; see GROK_KEY_NAMES). XAI_MODEL or
// GROK_MODEL picks the Grok model (default "grok-latest").
// Only chat moves: voice (audio/speech), transcription and image generation stay on OpenAI.
const OPENAI_CHAT = "https://api.openai.com/v1/chat/completions";
const XAI_CHAT = "https://api.x.ai/v1/chat/completions";

type Fetch = typeof fetch;
export type AiProviderEnv = { XAI_API_KEY?: string; XAI_MODEL?: string; AI_PROVIDER?: string; OPENAI_API_KEY?: string; BACKUP_URL?: string; BACKUP_NAME?: string };

/** Backup AIs that take OpenAI-style chat requests: Grok (xAI) and Groq. */
export const BACKUPS = {
  grok: { name: "Grok", url: "https://api.x.ai/v1/chat/completions", model: "grok-latest", keys: ["XAI_API_KEY", "GROK_API_KEY", "XAI_KEY", "GROK_KEY", "X_AI_API_KEY", "GROK_API", "XAI_TOKEN"], prefix: /^xai-/ },
  groq: { name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", model: "openai/gpt-oss-120b", keys: ["GROQ_API_KEY", "GROQ_KEY", "GROQ_API", "GROQ_TOKEN"], prefix: /^gsk_/ },
} as const;

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

/** Strongest general chat models first; speech, safety and embedding models are never picked. */
const MODEL_PREFERENCE = [/grok-4/, /grok/, /gpt-oss-120b/, /llama-4-maverick/, /kimi-k2/, /llama-4/, /qwen3?-.*32b/, /70b/, /gpt-oss/, /llama/, /qwen/, /mixtral|gemma/];
export function pickModel(ids: string[]): string | null {
  const usable = ids.filter((id) => !/whisper|tts|guard|embed|speech|audio|vision-preview|playai|orpheus|distil/i.test(id));
  for (const re of MODEL_PREFERENCE) { const hit = usable.find((id) => re.test(id.toLowerCase())); if (hit) return hit; }
  return usable[0] || null;
}
const busyUntil = new Map<string, number>();
let modelList: { at: number; ids: string[] } | null = null;
async function bestModel(base: Fetch, env: AiProviderEnv, skip: (id: string) => boolean = () => false): Promise<string | null> {
  if (modelList && Date.now() - modelList.at < 30 * 60_000) return pickModel(modelList.ids.filter((id) => !skip(id)));
  const url = (env.BACKUP_URL || XAI_CHAT).replace(/\/chat\/completions$/, "/models");
  const res = await base(url, { headers: { Authorization: `Bearer ${env.XAI_API_KEY}` } });
  if (!res.ok) return null;
  const data: any = await res.json().catch(() => null);
  const ids: string[] = (Array.isArray(data?.data) ? data.data : []).filter((m: any) => m?.active !== false).map((m: any) => String(m.id || "")).filter(Boolean);
  modelList = { at: Date.now(), ids };
  return pickModel(ids.filter((id) => !skip(id)));
}

/** A fetch that routes OpenAI chat requests to Grok as described above; everything else is untouched. */
export function grokFetch(base: Fetch, env: AiProviderEnv): Fetch {
  // Grok first when asked, or when there is no OpenAI key at all.
  // OpenAI is off for this site (no more credit): the backup answers everything unless USE_OPENAI=1.
  const grokFirst = env.AI_PROVIDER !== "openai";
  return (async (input: Parameters<Fetch>[0], init?: RequestInit) => {
    if (!env.XAI_API_KEY || !urlOf(input).startsWith(OPENAI_CHAT)) return base(input, init);
    const askGrok = async () => {
      let res = await base(env.BACKUP_URL || XAI_CHAT, toGrok(init, env));
      if (!res.ok) {
        const why = await res.clone().text().catch(() => "");
        // Models get retired. Ask the service which ones this key can use, pick the best, and try once more.
        if (/model_not_found|does not exist|decommissioned|deprecated/i.test(why)) {
          const better = await bestModel(base, env).catch(() => null);
          if (better && better !== env.XAI_MODEL) {
            console.warn(`[ai] ${env.BACKUP_NAME || "Grok"} model ${env.XAI_MODEL} is gone; switching to ${better}`);
            env.XAI_MODEL = better;
            res = await base(env.BACKUP_URL || XAI_CHAT, toGrok(init, env));
          }
        }
        // Some models don't take JSON mode; the prompts already ask for JSON, so try without it.
        if (!res.ok && res.status === 400 && /response_format|json/i.test(await res.clone().text().catch(() => ""))) {
          const plain = toGrok(init, env);
          try { const j = JSON.parse(String(plain.body)); delete j.response_format; plain.body = JSON.stringify(j); } catch { /* keep */ }
          res = await base(env.BACKUP_URL || XAI_CHAT, plain);
        }
        // A model's free per-minute allowance is used up: try the next good model (each has its own).
        if (!res.ok && res.status === 429 && /rate limit|tokens per minute|requests per/i.test(await res.clone().text().catch(() => ""))) {
          busyUntil.set(String(env.XAI_MODEL), Date.now() + 60_000);
          const other = await bestModel(base, env, (id) => (busyUntil.get(id) ?? 0) > Date.now()).catch(() => null);
          if (other) res = await base(env.BACKUP_URL || XAI_CHAT, toGrok(init, { ...env, XAI_MODEL: other }));
        }
        if (!res.ok) console.error(`[ai] ${env.BACKUP_NAME || "Grok"} failed:`, res.status, (await res.clone().text().catch(() => "")).slice(0, 200));
      }
      return res;
    };
    if (grokFirst) return askGrok();
    const res = await base(input, init);
    if (res.ok) return res;
    const text = await res.clone().text().catch(() => "");
    if (!shouldFallBack(res.status, text)) return res;
    console.warn("[ai] OpenAI", res.status, `— using ${env.BACKUP_NAME || "Grok"} for this request`);
    return askGrok();
  }) as Fetch;
}

/** The backup AI's key, under whichever name it was saved in the host's settings: Grok first, then Groq. */
export const GROK_KEY_NAMES = [...BACKUPS.grok.keys, ...BACKUPS.groq.keys];
export function findBackup(env: Record<string, string | undefined>): { kind: keyof typeof BACKUPS; key: string } | undefined {
  for (const kind of ["grok", "groq"] as const) {
    const b = BACKUPS[kind];
    for (const name of b.keys) if (env[name]?.trim()) return { kind, key: env[name]!.trim() };
  }
  // Anything else that looks like one of their keys.
  for (const kind of ["grok", "groq"] as const) {
    const hit = Object.entries(env).find(([k, v]) => /grok|xai|groq/i.test(k) && BACKUPS[kind].prefix.test(v || ""));
    if (hit) return { kind, key: hit[1]! };
  }
  return undefined;
}
export const findGrokKey = (env: Record<string, string | undefined>) => findBackup(env)?.key;

/** Called once when the server starts. */
export function installGrok(source: Record<string, string | undefined> = process.env) {
  const found = findBackup(source);
  if (!found) { console.log("[ai] No backup AI key found (looked for " + GROK_KEY_NAMES.join(", ") + ")"); return false; }
  const b = BACKUPS[found.kind];
  const model = found.kind === "grok" ? source.XAI_MODEL || source.GROK_MODEL || b.model : source.GROQ_MODEL || b.model;
  const env: AiProviderEnv = { XAI_API_KEY: found.key, XAI_MODEL: model, AI_PROVIDER: /^(groq)$/i.test(source.AI_PROVIDER || "") ? "grok" : source.AI_PROVIDER, OPENAI_API_KEY: source.OPENAI_API_KEY, BACKUP_URL: b.url, BACKUP_NAME: b.name };
  const onlyBackup = source.USE_OPENAI !== "1";
  if (onlyBackup) env.AI_PROVIDER = "grok";
  globalThis.fetch = grokFetch(globalThis.fetch.bind(globalThis), { ...env });
  // Features check for an OpenAI key before offering AI; with only a backup key they should still work.
  if (onlyBackup) { process.env.USE_OPENAI_FOR_CHAT = "0"; process.env.OPENAI_API_KEY = "routed-to-grok"; }
  console.log(`[ai] ${b.name} ${onlyBackup ? "handles all AI chat (OpenAI is off)" : "is the backup when OpenAI fails"} (model ${model})`);
  return true;
}
