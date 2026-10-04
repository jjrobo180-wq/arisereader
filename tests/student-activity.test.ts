import test from "node:test";
import assert from "node:assert/strict";
import { describeDevice } from "../shared/deviceName";

test("sign-ins show a readable device", () => {
  assert.equal(describeDevice("Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"), "Chromebook · Chrome");
  assert.equal(describeDevice("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"), "iPad · Safari");
  assert.equal(describeDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0"), "Windows computer · Edge");
  assert.equal(describeDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36"), "Android phone · Chrome");
  assert.equal(describeDevice(""), "Unknown device");
});
