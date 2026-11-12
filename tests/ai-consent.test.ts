// The iPhone apps ask before the first AI request (client/src/lib/aiConsent.ts, wired in main.tsx and App.tsx).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isAiRequest } from "../client/src/lib/aiConsent";

test("every AI route the server meters is recognised as an AI request", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  const line = routes.split("\n").find((l) => l.includes("plans.aiMeter") && l.includes("/api/hub-chat"))!;
  const paths = [...line.matchAll(/"(\/api\/[^"]+)"/g)].map((m) => m[1].replace(":id", "12"));
  assert.ok(paths.length >= 9, "found the metered list");
  for (const p of paths) assert.ok(isAiRequest("POST", p), `${p} should ask first`);
  assert.ok(isAiRequest("POST", "https://arisetodo.com/api/apps/ai?x=1"));
});

test("reads and other routes never ask", () => {
  assert.equal(isAiRequest("GET", "/api/hub-chat"), false);
  assert.equal(isAiRequest("POST", "/api/login"), false);
  assert.equal(isAiRequest("POST", "/api/arise-todo/food/log"), false);
});

test("the question is mounted once and the fetch wrapper uses it", () => {
  assert.match(readFileSync("client/src/App.tsx", "utf8"), /<AiConsentSheet \/>/);
  assert.match(readFileSync("client/src/main.tsx", "utf8"), /askAiConsent\(\)/);
});
