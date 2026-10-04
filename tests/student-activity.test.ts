import test from "node:test";
import assert from "node:assert/strict";
import { deviceFrom, completedAtFor } from "../shared/activity";

test("device names read like people say them", () => {
  assert.equal(deviceFrom("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"), "Chromebook · Chrome");
  assert.equal(deviceFrom("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"), "iPad · Safari");
  assert.equal(deviceFrom("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0"), "Windows · Edge");
  assert.equal(deviceFrom(""), "");
});

test("a recorded quiz is dated on the day it was earned, never in the future", () => {
  const now = new Date("2026-10-03T22:00:00Z");
  assert.equal(completedAtFor("2026-10-03", now), now.toISOString());
  assert.equal(completedAtFor("2026-12-01", now), now.toISOString());
  assert.equal(completedAtFor("2026-09-28", now), "2026-09-28T18:00:00.000Z");
});
