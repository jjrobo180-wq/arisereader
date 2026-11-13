import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Arise Notes opens in the light look until the person picks another", () => {
  const src = readFileSync("client/src/components/arise-notes/appearance.ts", "utf8");
  assert.match(src, /: "light"; \} catch \{ return "light"; \}/);
  assert.doesNotMatch(src, /catch \{ return "auto"; \}/);
});
