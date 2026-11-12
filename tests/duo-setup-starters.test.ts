// The setup's "Choose your first plugins" step lists plugins by id. Every id must still be in the
// Plugin Gallery, or the step shows up empty (it did, after plugins were renamed).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pluginsFor } from "../shared/pluginStore";

test("every first-plugin pick in the setup is a real LifeHub plugin", () => {
  const src = readFileSync("client/src/components/DuoSetup.tsx", "utf8");
  const block = src.slice(src.indexOf("const STARTER_APPS"), src.indexOf("];", src.indexOf("const STARTER_APPS")));
  const ids = [...block.matchAll(/id: "([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 4, "the setup suggests a handful of plugins");
  const life = new Set(pluginsFor("life", { teacher: false, arise: false }).map((p) => p.id));
  for (const id of ids) assert.ok(life.has(id), `${id} is in the Plugin Gallery`);
});
