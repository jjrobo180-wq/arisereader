// One way to call OpenAI's chat completions that copes with "429":
//   - a rate limit (too many tokens or requests this minute) is waited out and tried again, up to about a minute
//     and a half in all, using the wait OpenAI asks for;
//   - an account out of credit (insufficient_quota, also a 429) is never retried and says so plainly, so it
//     isn't mistaken for "busy".
// Every refusal logs OpenAI's own error code and message (never what was sent).
export class OpenAIQuotaError extends Error {
  constructor() { super("The site's AI account is out of credit, so AI features are paused. Add credit at platform.openai.com → Billing, then try again."); }
}
export class OpenAIBusyError extends Error {
  constructor() { super("The AI is busy right now. Try again in a minute."); }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** "20ms", "1.5s", "2m3s" → milliseconds. */
export function waitMs(v: string | null): number {
  if (!v) return 0;
  let ms = 0;
  for (const [, n, unit] of v.matchAll(/([\d.]+)(ms|s|m|h)/g)) ms += Number(n) * (unit === "ms" ? 1 : unit === "s" ? 1000 : unit === "m" ? 60_000 : 3_600_000);
  if (!ms && /^\d+(\.\d+)?$/.test(v)) ms = Number(v) * 1000;
  return ms;
}

export async function readOpenAIError(r: Response): Promise<{ code: string; type: string; msg: string }> {
  const b: any = await r.clone().json().catch(() => null);
  return { code: String(b?.error?.code || ""), type: String(b?.error?.type || ""), msg: String(b?.error?.message || "").slice(0, 240) };
}

/**
 * POSTs to chat completions. Returns the Response (ok, or a non-429 error for the caller to explain).
 * Throws OpenAIQuotaError (out of credit) or OpenAIBusyError (still rate limited after waiting).
 */
export async function postChat(body: unknown, opts: { label: string; timeoutMs: number; maxWaitMs?: number; fetchImpl?: typeof fetch; sleepImpl?: (ms: number) => Promise<void> }): Promise<Response> {
  const doFetch = opts.fetchImpl ?? fetch, wait = opts.sleepImpl ?? sleep;
  const budget = opts.maxWaitMs ?? 90_000;
  let waited = 0;
  for (let attempt = 0; ; attempt++) {
    const r = await doFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
    if (r.status !== 429) {
      if (!r.ok) { const e = await readOpenAIError(r); console.error(`[${opts.label}] AI refused:`, r.status, e.code || e.type, e.msg); }
      return r;
    }
    const e = await readOpenAIError(r);
    console.error(`[${opts.label}] AI 429:`, e.code || e.type, e.msg);
    if (e.code === "insufficient_quota" || e.type === "insufficient_quota" || /quota|billing|credit/i.test(e.msg)) throw new OpenAIQuotaError();
    const asked = Math.max(waitMs(r.headers.get("retry-after-ms") ? `${r.headers.get("retry-after-ms")}ms` : null), waitMs(r.headers.get("retry-after")), waitMs(r.headers.get("x-ratelimit-reset-tokens")), waitMs(r.headers.get("x-ratelimit-reset-requests")));
    const next = Math.min(30_000, Math.max(asked, 2000 * 2 ** attempt)) + Math.floor(Math.random() * 500);
    if (waited + next > budget) throw new OpenAIBusyError();
    await wait(next);
    waited += next;
  }
}
