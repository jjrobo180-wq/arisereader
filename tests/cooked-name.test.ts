import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";

const FULL = "Cooked Fitness by Arise: Premium All in one Health & Fitness App";
const read = (p: string) => readFileSync(p, "utf8");

test("subscription pages show the full Cooked Fitness by Arise name", () => {
  for (const f of ["shared/allAccess.ts", "client/src/pages/AllAccess.tsx", "client/src/components/arise-notes/SettingsScreen.tsx", "client/src/components/hub-pieces/TodoPlan.tsx", "client/src/pages/fit/FitPlus.tsx", "server/plans.ts"]) {
    assert.ok(read(f).includes(FULL), `${f} shows the full name`);
  }
  assert.ok(read("shared/cookedName.ts").includes(FULL));
});

test("no website page still says Cooked+", () => {
  const pages = readdirSync("client/public").filter((f) => f.endsWith(".html")).map((f) => `client/public/${f}`)
    .concat(readdirSync("client/public", { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `client/public/${d.name}/index.html`).filter((p) => existsSync(p)));
  for (const p of pages) assert.ok(!/Cooked\+/.test(read(p)), `${p} has no Cooked+`);
  assert.ok(read("client/public/educator.html").includes("Cooked Fitness by Arise: Premium All in one Health &amp; Fitness App"));
});

test("the in-app upgrade sheet and popup use the new name", () => {
  const plus = read("client/src/pages/fit/FitPlus.tsx");
  assert.ok(!/<Sheet title="Cooked\+"/.test(plus));
  assert.match(plus, /part of Cooked\(\\\+\| Fitness\)/);
  assert.ok(read("client/src/pages/fit/FitApp.tsx").includes('intro="Cooked Fitness by Arise is free to use.'));
});
