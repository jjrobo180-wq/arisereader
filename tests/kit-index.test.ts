// shared/kitIndex.ts must list exactly the Plugin Kit apps (shared/pluginKit.ts), with their hubs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { KIT_DEFS } from "../shared/pluginKit";
import { KIT_LIFE_INDEX, KIT_WORK_INDEX, kitHub } from "../shared/kitIndex";

test("the kit index matches the kit apps", () => {
  assert.deepEqual([...KIT_LIFE_INDEX].sort(), KIT_DEFS.filter((d) => d.hub === "life").map((d) => d.id).sort(), "LifeHub kit apps: update shared/kitIndex.ts");
  assert.deepEqual([...KIT_WORK_INDEX].sort(), KIT_DEFS.filter((d) => d.hub === "work").map((d) => d.id).sort(), "WorkHub kit apps: update shared/kitIndex.ts");
  for (const d of KIT_DEFS) assert.equal(kitHub(d.id), d.hub);
  assert.equal(kitHub("not-a-kit"), undefined);
});
