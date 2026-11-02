// The To-Do iPhone app (capacitor://localhost) must be allowed to call /api, sign-in included.
// Run with: npx tsx --test tests/native-app-cors.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { nativeAppCors } from "../server/nativeAppCors";

async function withServer(fn: (base: string) => Promise<void>) {
  const app = express();
  app.use(nativeAppCors);
  app.use(express.json());
  app.post("/api/login", (_req, res) => res.json({ ok: true }));
  app.use("/api/podscroll", (req, res) => res.status(req.method === "OPTIONS" ? 299 : 200).end());
  const server = app.listen(0);
  try { await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
  finally { server.close(); }
}

test("preflight from the iOS app is allowed with credentials", () => withServer(async (base) => {
  const res = await fetch(`${base}/api/login`, { method: "OPTIONS", headers: {
    Origin: "capacitor://localhost", "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type,authorization",
  } });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("access-control-allow-origin"), "capacitor://localhost");
  assert.equal(res.headers.get("access-control-allow-credentials"), "true");
  assert.match(res.headers.get("access-control-allow-headers") || "", /authorization/);
}));

test("sign-in response carries the CORS header for the iOS app", () => withServer(async (base) => {
  const res = await fetch(`${base}/api/login`, { method: "POST", headers: { Origin: "capacitor://localhost", "Content-Type": "application/json" }, body: "{}" });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "capacitor://localhost");
}));

test("other websites get no CORS access", () => withServer(async (base) => {
  const res = await fetch(`${base}/api/login`, { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" }, body: "{}" });
  assert.equal(res.headers.get("access-control-allow-origin"), null);
}));

test("Pod+ routes keep their own CORS handling", () => withServer(async (base) => {
  const res = await fetch(`${base}/api/podscroll/feed`, { method: "OPTIONS", headers: { Origin: "capacitor://localhost" } });
  assert.equal(res.status, 299);
}));
