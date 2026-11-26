import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("the live site says which commit it's running", async () => {
  process.env.RENDER_GIT_COMMIT = "abcdef1234567890";
  const { versionInfo } = await import("../server/version.ts");
  const v = versionInfo();
  assert.equal(v.short, "abcdef12");
  assert.ok(Date.parse(v.startedAt) > 0);
  assert.match(readFileSync("server/routes.ts", "utf8"), /registerVersionRoute\(app\);/);
});
