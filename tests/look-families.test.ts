import test from "node:test";
import assert from "node:assert/strict";
import { LOOK_FAMILIES, familyOf } from "../shared/lookFamilies";
import { NOTES_THEMES } from "../shared/notesThemes";

test("color families point at real looks, once each", () => {
  const ids = LOOK_FAMILIES.flatMap((f) => f.variants.map((v) => v.id));
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(NOTES_THEMES.some((t) => t.id === id), id);
  assert.equal(familyOf("x-billboard-cobalt")?.name, "Billboard");
  assert.equal(familyOf("x-corkboard"), undefined);
});
