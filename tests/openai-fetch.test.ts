import test from "node:test";
import assert from "node:assert/strict";
import { OpenAIBusyError, OpenAIQuotaError, postChat, waitMs } from "../server/openaiFetch";

const reply = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });

test("a rate limit is waited out (as long as OpenAI asks) and tried again", async () => {
  const waits: number[] = [];
  const answers = [reply(429, { error: { type: "requests", code: "rate_limit_exceeded", message: "Rate limit reached for gpt-4.1 on tokens per min" } }, { "x-ratelimit-reset-tokens": "6s" }), reply(200, { choices: [{ message: { content: "{}" } }] })];
  const r = await postChat({}, { label: "t", timeoutMs: 1000, fetchImpl: (async () => answers.shift()!) as any, sleepImpl: async (ms) => { waits.push(ms); } });
  assert.equal(r.status, 200);
  assert.equal(waits.length, 1);
  assert.ok(waits[0] >= 6000 && waits[0] < 7000, String(waits[0]));
});

test("out of credit is said plainly and never retried; a long rate limit gives up as busy", async () => {
  let calls = 0;
  await assert.rejects(postChat({}, { label: "t", timeoutMs: 1000, fetchImpl: (async () => { calls++; return reply(429, { error: { type: "insufficient_quota", code: "insufficient_quota", message: "You exceeded your current quota, please check your plan and billing details." } }); }) as any, sleepImpl: async () => {} }), OpenAIQuotaError);
  assert.equal(calls, 1);
  await assert.rejects(postChat({}, { label: "t", timeoutMs: 1000, maxWaitMs: 10_000, fetchImpl: (async () => reply(429, { error: { code: "rate_limit_exceeded" } }, { "retry-after": "20" })) as any, sleepImpl: async () => {} }), OpenAIBusyError);
  assert.equal(waitMs("1m2.5s"), 62_500);
  assert.equal(waitMs("20"), 20_000);
});
