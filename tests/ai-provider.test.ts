import test from "node:test";
import assert from "node:assert/strict";
import { findBackup, findGrokKey, grokFetch, shouldFallBack } from "../server/aiProvider";

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
  const f = grokFetch(base, { XAI_API_KEY: "xai-key", OPENAI_API_KEY: "sk-openai" });
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
  await grokFetch(r.base, { XAI_API_KEY: "k", OPENAI_API_KEY: "sk" })(OPENAI, req);
  assert.deepEqual(r.calls.map((c) => c.url), [OPENAI]);
  r = fakeBase({ status: 200, body: "{}" });
  await grokFetch(r.base, { XAI_API_KEY: "k", OPENAI_API_KEY: "sk", AI_PROVIDER: "grok", XAI_MODEL: "grok-4.3" })(OPENAI, req);
  assert.equal(r.calls.length, 1);
  assert.equal(JSON.parse(String(r.calls[0].init!.body)).model, "grok-4.3");
  r = fakeBase({ status: 429, body: "credit_balance_exhausted" });
  await grokFetch(r.base, { XAI_API_KEY: "k", OPENAI_API_KEY: "sk" })("https://api.openai.com/v1/audio/speech", req);
  assert.equal(r.calls.length, 1, "voice stays on OpenAI");
  r = fakeBase({ status: 400, body: "bad request" });
  await grokFetch(r.base, { XAI_API_KEY: "k", OPENAI_API_KEY: "sk" })(OPENAI, req);
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
  const f = grokFetch(base, { XAI_API_KEY: "gsk_1", XAI_MODEL: "llama-3.3-70b-versatile", OPENAI_API_KEY: "sk", BACKUP_URL: "https://api.groq.com/openai/v1/chat/completions", BACKUP_NAME: "Groq" });
  await f(OPENAI, req);
  assert.equal(calls[1].url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(JSON.parse(String(calls[1].init!.body)).model, "llama-3.3-70b-versatile");
});
