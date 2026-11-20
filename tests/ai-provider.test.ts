import test from "node:test";
import assert from "node:assert/strict";
import { findBackup, findGrokKey, grokFetch, groqWaitMs, pickModel, planGroq, shouldFallBack } from "../server/aiProvider";

const OPENAI = "https://api.openai.com/v1/chat/completions";
function fakeBase(openai: { status: number; body: string }) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const base = (async (url: any, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith("https://api.x.ai") || String(url).startsWith("https://api.groq.com")) return new Response(JSON.stringify({ choices: [{ message: { content: "{\"from\":\"grok\"}" } }] }), { status: 200 });
    if (String(url) === OPENAI) return new Response(openai.body, { status: openai.status });
    return new Response("other", { status: 200 });
  }) as typeof fetch;
  return { base, calls };
}
const req = { method: "POST", headers: { Authorization: "Bearer sk-openai", "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-4.1", messages: [{ role: "user", content: "hi" }], response_format: { type: "json_object" } }) };

test("OpenAI out of credit: the same request goes to Grok with Grok's model and key", async () => {
  const { base, calls } = fakeBase({ status: 429, body: '{"error":{"code":"credit_balance_exhausted"}}' });
  const f = grokFetch(base, { XAI_API_KEY: "xai-key", OPENAI_API_KEY: "sk-openai", AI_PROVIDER: "openai" });
  const res = await f(OPENAI, req);
  assert.equal(res.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, "https://api.x.ai/v1/chat/completions");
  const sent = JSON.parse(String(calls[1].init!.body));
  assert.equal(sent.model, "grok-latest");
  assert.deepEqual(sent.messages, [{ role: "user", content: "hi" }]);
  assert.equal(new Headers(calls[1].init!.headers).get("Authorization"), "Bearer xai-key");
});

test("OpenAI working: Grok isn't used; AI_PROVIDER=grok sends everything to Grok; other endpoints untouched", async () => {
  let r = fakeBase({ status: 200, body: "{}" });
  await grokFetch(r.base, { XAI_API_KEY: "k", OPENAI_API_KEY: "sk", AI_PROVIDER: "openai" })(OPENAI, req);
  assert.deepEqual(r.calls.map((c) => c.url), [OPENAI]);
  r = fakeBase({ status: 200, body: "{}" });
  await grokFetch(r.base, { XAI_API_KEY: "k", OPENAI_API_KEY: "sk", AI_PROVIDER: "grok", XAI_MODEL: "grok-4.3" })(OPENAI, req);
  assert.equal(r.calls.length, 1);
  assert.equal(JSON.parse(String(r.calls[0].init!.body)).model, "grok-4.3");
  r = fakeBase({ status: 429, body: "credit_balance_exhausted" });
  await grokFetch(r.base, { XAI_API_KEY: "k", OPENAI_API_KEY: "sk" })("https://api.openai.com/v1/audio/speech", req);
  assert.equal(r.calls.length, 1, "voice stays on OpenAI");
  r = fakeBase({ status: 400, body: "bad request" });
  await grokFetch(r.base, { XAI_API_KEY: "k", OPENAI_API_KEY: "sk", AI_PROVIDER: "openai" })(OPENAI, req);
  assert.equal(r.calls.length, 1, "a real mistake in the request isn't retried");
  r = fakeBase({ status: 429, body: "x" });
  await grokFetch(r.base, { OPENAI_API_KEY: "sk" } as any)(OPENAI, req);
  assert.equal(r.calls.length, 1, "no Grok key: nothing changes");
  assert.equal(shouldFallBack(503, ""), true);
});

test("finds the Grok key under the names sites use", () => {
  assert.equal(findGrokKey({ GROK_API_KEY: "xai-1" }), "xai-1");
  assert.equal(findGrokKey({ XAI_API_KEY: "xai-2", GROK_API_KEY: "xai-1" }), "xai-2");
  assert.equal(findGrokKey({ MY_GROK_SECRET: "xai-abc" }), "xai-abc");
  assert.equal(findGrokKey({ OPENAI_API_KEY: "sk-x" }), undefined);
});

test("a Groq key (groq.com) works as the backup too, with Groq's address and model", async () => {
  assert.deepEqual(findBackup({ GROQ_API_KEY: "gsk_1" }), { kind: "groq", key: "gsk_1" });
  assert.deepEqual(findBackup({ MY_GROQ: "gsk_2" }), { kind: "groq", key: "gsk_2" });
  const { base, calls } = fakeBase({ status: 429, body: "credit_balance_exhausted" });
  const f = grokFetch(base, { XAI_API_KEY: "gsk_1", XAI_MODEL: "llama-3.3-70b-versatile", OPENAI_API_KEY: "sk", AI_PROVIDER: "openai", BACKUP_URL: "https://api.groq.com/openai/v1/chat/completions", BACKUP_NAME: "Groq" });
  await f(OPENAI, req);
  // (It may first ask Groq which models it has, so a retired one is never picked.)
  const chat = calls.slice(1).find((c) => !c.url.endsWith("/models"))!;
  assert.equal(chat.url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(JSON.parse(String(chat.init!.body)).model, "llama-3.3-70b-versatile");
});

test("a retired model: ask the service for its models, switch to the best one, and try again", async () => {
  assert.equal(pickModel(["whisper-large-v3", "llama-guard-4", "llama-3.1-8b-instant", "openai/gpt-oss-120b", "meta-llama/llama-4-maverick-17b"]), "openai/gpt-oss-120b");
  assert.equal(pickModel(["whisper-large-v3"]), null);
  const calls: string[] = [];
  let model = "";
  const base = (async (url: any, init?: RequestInit) => {
    calls.push(String(url));
    if (String(url) === OPENAI) return new Response("credit_balance_exhausted", { status: 429 });
    if (String(url).endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "whisper-large-v3" }, { id: "llama-3.1-8b-instant" }, { id: "openai/gpt-oss-120b" }] }), { status: 200 });
    model = JSON.parse(String(init!.body)).model;
    return model === "old-model" ? new Response('{"error":{"code":"model_not_found"}}', { status: 404 }) : new Response("{}", { status: 200 });
  }) as typeof fetch;
  const f = grokFetch(base, { XAI_API_KEY: "gsk_1", XAI_MODEL: "old-model", OPENAI_API_KEY: "sk", AI_PROVIDER: "openai", BACKUP_URL: "https://api.groq.com/openai/v1/chat/completions", BACKUP_NAME: "Groq" });
  const res = await f(OPENAI, req);
  assert.equal(res.status, 200);
  assert.equal(model, "openai/gpt-oss-120b");
  assert.ok(calls.includes("https://api.groq.com/openai/v1/models"));
  // The next request goes straight to the new model.
  calls.length = 0;
  await f(OPENAI, req);
  assert.ok(calls.filter((c) => c.endsWith("/models")).length <= 1, "the model list is kept, not asked for again and again");
});

test("OpenAI is off by default: chat goes straight to the backup without calling OpenAI", async () => {
  const r = fakeBase({ status: 200, body: "{}" });
  await grokFetch(r.base, { XAI_API_KEY: "gsk_1", OPENAI_API_KEY: "sk", BACKUP_URL: "https://api.groq.com/openai/v1/chat/completions", BACKUP_NAME: "Groq" })(OPENAI, req);
  assert.deepEqual(r.calls.map((c) => c.url), ["https://api.groq.com/openai/v1/chat/completions"]);
});

test("Podster questions go to Perplexity, and to the backup if Perplexity fails", async () => {
  const { perplexityJson } = await import("../server/perplexityAsk");
  let sent: any = null;
  const ok = perplexityJson(async () => "pplx-1", async () => "backup", (async (_u: any, init: any) => { sent = JSON.parse(init.body); return new Response(JSON.stringify({ choices: [{ message: { content: '{"answer":"Yes [1][2]."}' } }] }), { status: 200 }); }) as any);
  assert.equal(await ok("sys", "user"), '{"answer":"Yes ."}');
  assert.equal(sent.model, "sonar");
  const broken = perplexityJson(async () => "pplx-1", async () => "backup", (async () => new Response("no", { status: 500 })) as any);
  assert.equal(await broken("s", "u"), "backup");
  const noKey = perplexityJson(async () => "", async () => "backup");
  assert.equal(await noKey("s", "u"), "backup");
});

test("when Groq can't answer, the same chat goes to Perplexity and comes back in the usual shape", async () => {
  const { grokFetch, setPerplexityKey, toPerplexity } = await import("../server/aiProvider");
  setPerplexityKey(async () => "pplx-test");
  const calls: string[] = [];
  const base = (async (url: any, init: any) => {
    calls.push(String(url));
    if (String(url).includes("groq")) return new Response(JSON.stringify({ error: { message: "Rate limit reached ... tokens per day" } }), { status: 429 });
    const sent = JSON.parse(init.body);
    assert.equal(sent.model, "sonar");
    assert.ok(!("response_format" in sent));
    return new Response(JSON.stringify({ choices: [{ message: { content: "```json\n{\"answer\":\"Alice fell [1].\"}\n```" } }] }), { status: 200 });
  }) as any;
  const f = grokFetch(base, { XAI_API_KEY: "gsk_x", XAI_MODEL: "openai/gpt-oss-120b", AI_PROVIDER: "grok", BACKUP_URL: "https://api.groq.com/openai/v1/chat/completions", BACKUP_NAME: "Groq" });
  const res = await f("https://api.openai.com/v1/chat/completions", { method: "POST", body: JSON.stringify({ model: "gpt-4.1", response_format: { type: "json_object" }, messages: [{ role: "system", content: "Be brief." }, { role: "user", content: "Recap" }] }) });
  assert.equal(res.status, 200);
  const body: any = await res.json();
  assert.equal(JSON.parse(body.choices[0].message.content).answer, "Alice fell .");
  assert.ok(calls.some((c) => c.includes("perplexity")));
  // Turns that repeat a role are joined (Perplexity wants them to alternate).
  const j = JSON.parse(toPerplexity({ body: JSON.stringify({ messages: [{ role: "user", content: "a" }, { role: "user", content: "b" }] }) })!);
  assert.equal(j.messages.filter((m: any) => m.role === "user").length, 1);
  setPerplexityKey(async () => "");
});

// ---- Fitting requests to Groq's free allowance ----
const IDS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "meta-llama/llama-4-scout-17b-16e-instruct", "qwen/qwen3-32b", "whisper-large-v3"];
const ask = (chars: number, max?: number, image = false) => ({ max_tokens: max, messages: [{ role: "system", content: "x".repeat(chars) }, { role: "user", content: image ? [{ type: "text", text: "read this" }, { type: "image_url", image_url: { url: "data:image/png;base64,AA" } }] : "go" }] });

test("Groq: a small request stays on gpt-oss-120b, with the reply cut to what fits a minute", () => {
  assert.deepEqual(planGroq(ask(3200, 4000), "openai/gpt-oss-120b", IDS), { model: "openai/gpt-oss-120b", maxTokens: 4000 });
  // Asking for 16,000 tokens from a model allowed 8,000 a minute is refused every time; the ask is cut.
  const p = planGroq(ask(3200, 16000), "openai/gpt-oss-120b", IDS)!;
  assert.ok(p.maxTokens <= 8000 - 1000, `asked for ${p.maxTokens}`);
});

test("Groq: a request too big for gpt-oss-120b goes to the model with the most room (Llama 4 Scout)", () => {
  const p = planGroq(ask(24_000, 16000), "openai/gpt-oss-120b", IDS)!;
  assert.equal(p.model, "meta-llama/llama-4-scout-17b-16e-instruct");
  assert.ok(p.maxTokens <= 8192 && p.maxTokens > 6000);
});

test("Groq: pictures go to a model that can see them; a model that's out is skipped", () => {
  assert.equal(planGroq(ask(500, 2000, true), "openai/gpt-oss-120b", IDS)!.model, "meta-llama/llama-4-scout-17b-16e-instruct");
  assert.equal(planGroq(ask(500, 2000, true), "openai/gpt-oss-120b", IDS, (id) => /scout/.test(id))!.model, "openai/gpt-oss-120b");
  assert.equal(planGroq(ask(10, 100), "some-new-model", IDS), null);
});

test("Groq: how long a model is out: what Groq says, at least a minute, ten for a daily limit", () => {
  assert.equal(groqWaitMs("Rate limit reached ... on tokens per minute (TPM): Limit 8000. Please try again in 7.5s."), 60_000);
  assert.equal(groqWaitMs("Rate limit reached ... on tokens per day (TPD): Limit 200000. Please try again in 1h2m3s."), 3_723_000);
  assert.equal(groqWaitMs("Rate limit reached on requests per day (RPD). Please try again in 30s"), 600_000);
});

test("Groq: a big exemplar request is sent to Scout with a reply that fits, and a daily limit sends the next one elsewhere", async () => {
  const calls: { url: string; body: any }[] = [];
  let firstRefused = false;
  const base = (async (url: any, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ url: String(url), body });
    if (String(url).endsWith("/models")) return new Response(JSON.stringify({ data: IDS.map((id) => ({ id })) }), { status: 200 });
    if (!firstRefused && body?.model === "openai/gpt-oss-20b") { firstRefused = true; return new Response(JSON.stringify({ error: { message: "Rate limit reached for model `openai/gpt-oss-20b` on tokens per day (TPD): Limit 200000, Used 199990. Please try again in 3h." } }), { status: 429 }); }
    return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 });
  }) as typeof fetch;
  const f = grokFetch(base, { XAI_API_KEY: "gsk_fit", XAI_MODEL: "openai/gpt-oss-20b", AI_PROVIDER: "grok", BACKUP_URL: "https://api.groq.com/openai/v1/chat/completions", BACKUP_NAME: "Groq" });
  const big = { method: "POST", body: JSON.stringify({ model: "gpt-4.1", max_tokens: 16000, messages: [{ role: "user", content: "y".repeat(30_000) }] }) };
  const r1 = await f(OPENAI, big);
  assert.equal(r1.status, 200);
  const sent = calls.filter((c) => c.url.endsWith("/chat/completions"));
  assert.equal(sent[0].body.model, "meta-llama/llama-4-scout-17b-16e-instruct");
  assert.ok(sent[0].body.max_tokens <= 8192);
  // A small one tries gpt-oss-20b, which is out for the day; it goes to another model, and 20b is skipped after.
  const small = { method: "POST", body: JSON.stringify({ model: "gpt-4.1", max_tokens: 500, messages: [{ role: "user", content: "hi" }] }) };
  assert.equal((await f(OPENAI, small)).status, 200);
  calls.length = 0;
  assert.equal((await f(OPENAI, small)).status, 200);
  const next = calls.filter((c) => c.url.endsWith("/chat/completions"));
  assert.equal(next.length, 1);
  assert.notEqual(next[0].body.model, "openai/gpt-oss-20b");
});

test("a model picked for room that Groq retired (404) is skipped, and the request still gets an answer", async () => {
  const sent: string[] = [];
  const base = (async (url: any, init?: RequestInit) => {
    if (String(url).endsWith("/models")) return new Response(JSON.stringify({ data: [{ id: "openai/gpt-oss-120b" }, { id: "llama-3.3-70b-versatile" }, { id: "meta-llama/llama-4-scout-17b-16e-instruct" }] }), { status: 200 });
    if (String(url) === OPENAI) return new Response("credit_balance_exhausted", { status: 429 });
    const model = JSON.parse(String(init!.body)).model;
    sent.push(model);
    return /scout/.test(model) ? new Response('{"error":{"message":"The model does not exist","code":"model_not_found"}}', { status: 404 }) : new Response("{}", { status: 200 });
  }) as typeof fetch;
  const f = grokFetch(base, { XAI_API_KEY: "gsk_room", XAI_MODEL: "openai/gpt-oss-120b", OPENAI_API_KEY: "sk", AI_PROVIDER: "grok", BACKUP_URL: "https://api.groq.com/openai/v1/chat/completions", BACKUP_NAME: "Groq" });
  // A big request: too big for gpt-oss-120b's allowance, so the router first tries the model with the most room.
  const big = { method: "POST", body: JSON.stringify({ model: "gpt-4.1", max_tokens: 5000, messages: [{ role: "user", content: "x".repeat(30_000) }] }) };
  const res = await f(OPENAI, big);
  assert.equal(res.status, 200);
  assert.ok(sent.some((m) => /scout/.test(m)));
  assert.ok(!/scout/.test(sent[sent.length - 1]));
});
