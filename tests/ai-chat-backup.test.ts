// Perplexity ran out of credit (Nov 13, 2026) and Live quiz showed "AI generation failed (401) … exceeded your
// current quota". Features now use whichever AI works: server/aiChatBackup.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { answeredWithoutWeb, siteAiConfigured, siteFirst, webFirst } from "../server/aiChatBackup";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const QUOTA = JSON.stringify({ error: { message: "You exceeded your current quota, add credits at https://console.perplexity.ai/project/billing.", type: "insufficient_quota", code: 401 } });
const ok = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const req = { method: "POST", body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: "Make a quiz" }], response_format: { type: "json_object" } }) };

test("which AI the site has", () => {
  assert.equal(siteAiConfigured({}), false);
  assert.equal(siteAiConfigured({ GROQ_API_KEY: "gsk_0123456789abcdef" }), true);
  assert.equal(siteAiConfigured({ MY_GROQ_KEY: "gsk_0123456789abcdef" }), true);
  assert.equal(siteAiConfigured({ OPENAI_API_KEY: "routed-to-grok", USE_OPENAI: "1" }), false);
  assert.equal(siteAiConfigured({ OPENAI_API_KEY: "sk-real-123456", USE_OPENAI: "1" }), true);
});

test("live games and study sets: the site's AI first; Perplexity (out of credit) never shows its error", async () => {
  const env = { ...process.env }; process.env.GROQ_API_KEY = "gsk_test0123456789";
  try {
    const urls: string[] = [];
    const r = await siteFirst(req, { perplexityKey: "pplx-x", fetch: (async (url: string, init: any) => { urls.push(url); assert.equal(JSON.parse(init.body).model, "gpt-4.1-mini"); return ok('{"title":"Planets"}'); }) as any });
    assert.equal(r.status, 200); assert.deepEqual(urls, ["https://api.openai.com/v1/chat/completions"]);
    assert.equal(JSON.parse(await r.text()).choices[0].message.content, '{"title":"Planets"}');
    // Site AI down → Perplexity (without json_object, which it doesn't take) → both down → a plain "busy".
    const seen: any[] = [];
    const r2 = await siteFirst(req, { perplexityKey: "pplx-x", fetch: (async (url: string, init: any) => { seen.push({ url, body: JSON.parse(init.body) }); return url.includes("perplexity") ? new Response(QUOTA, { status: 401 }) : new Response("down", { status: 500 }); }) as any });
    assert.equal(r2.status, 503); assert.doesNotMatch(await r2.text(), /quota|perplexity/i);
    assert.equal(seen[1].body.response_format, undefined); assert.equal(seen[1].body.model, "sonar");
  } finally { process.env = env; }
});

test("book quizzes: Perplexity first for the web; when it's out of credit the site's AI answers and says so", async () => {
  const env = { ...process.env }; process.env.GROQ_API_KEY = "gsk_test0123456789";
  try {
    const order: string[] = [];
    const r = await webFirst(req, { perplexityKey: "pplx-x", fetch: (async (url: string) => { order.push(url.includes("perplexity") ? "pplx" : "site"); return url.includes("perplexity") ? new Response(QUOTA, { status: 401 }) : ok('{"questions":[]}'); }) as any });
    assert.deepEqual(order, ["pplx", "site"]); assert.equal(r.status, 200); assert.equal(answeredWithoutWeb(r), true);
    const r2 = await webFirst(req, { perplexityKey: "pplx-x", fetch: (async () => ok("{}")) as any });
    assert.equal(answeredWithoutWeb(r2), false);
    // No Perplexity key at all: straight to the site's AI.
    const r3 = await webFirst(req, { perplexityKey: "", fetch: (async (url: string) => { assert.ok(!url.includes("perplexity")); return ok("{}"); }) as any });
    assert.equal(r3.status, 200);
  } finally { process.env = env; }
});

test("nothing that made games or quizzes calls Perplexity directly any more, and no raw AI errors reach teachers", () => {
  const live = read("server/liveQuizzes.ts"), study = read("server/study.ts"), routes = read("server/routes.ts");
  assert.doesNotMatch(live, /fetch\("https:\/\/api\.perplexity\.ai/); assert.match(live, /await siteFirst\(/);
  assert.doesNotMatch(study, /doFetch\("https:\/\/api\.perplexity\.ai/); assert.match(study, /await siteFirst\(/);
  assert.doesNotMatch(routes, /await fetch\(PERPLEXITY_API_URL/); assert.equal((routes.match(/await webFirst\(/g) || []).length, 4);
  assert.doesNotMatch(live, /AI generation failed \(\$\{response\.status\}\)/);
  assert.doesNotMatch(routes, /AI API error \$\{res\.status\}/);
  assert.match(routes, /aiUnsure = parsed\.bookFound === false \|\| answeredWithoutWeb\(res\)/);
});
