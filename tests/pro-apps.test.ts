// Arise premium apps: the app list, the QR maker and the money and fitness maths.
// Run with: npx tsx --test tests/pro-apps.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { PRO_APPS, PRO_GROUPS } from "../shared/pro/apps";
import { qrMatrix, wifiPayload } from "../shared/pro/qr";

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
