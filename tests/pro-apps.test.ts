// Arise premium apps: the app list, the QR maker and the money and fitness maths.
// Run with: npx tsx --test tests/pro-apps.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { PRO_APPS, PRO_GROUPS } from "../shared/pro/apps";
import { qrMatrix, wifiPayload } from "../shared/pro/qr";
import { readFileSync } from "node:fs";

test("about 100 apps, unique ids, every group known", () => {
  assert.ok(PRO_APPS.length >= 100);
  assert.equal(new Set(PRO_APPS.map((a) => a.id)).size, PRO_APPS.length);
  for (const a of PRO_APPS) { assert.ok(PRO_GROUPS[a.group], a.id); assert.ok(a.features.length >= 3, a.id); assert.match(a.id, /^[a-z0-9-]{2,40}$/); }
});

test("QR codes: right size, finder patterns, Wi-Fi payload", () => {
  const m = qrMatrix("Hello", "L");
  assert.equal(m.length, 21);
  for (const [x, y] of [[0, 0], [14, 0], [0, 14]]) { assert.equal(m[y][x], true); assert.equal(m[y + 1][x + 1], false); assert.equal(m[y + 3][x + 3], true); }
  assert.equal(qrMatrix("https://example.com/a-somewhat-longer-link", "M").length, 29);
  assert.equal(wifiPayload("My;Net", "p:w", "WPA"), String.raw`WIFI:T:WPA;S:My\;Net;P:p\:w;;`);
});

test("Office, the AI tools and the premium apps open for every hub account, not just teachers", () => {
  // They're added from both hubs' App Store. ProtectedRoute would send parents to the Reader and
  // teachers without a Reader plan to Billing, and a teacher/parent-only check shut out personal accounts.
  const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
  for (const [path, page] of [["/ai-apps", "PremiumStudio"], ["/office", "AriseOffice"], ["/pro", "ProApps"]]) {
    const route = new RegExp(`<Route path="${path}">\\s*\\{!user \\? <Redirect to="/signin" replace /> : isHubAccount\\(user\\) \\? <${page} /> : <Redirect to="/" replace />\\}\\s*</Route>`);
    assert.match(app, route, path);
  }
});
