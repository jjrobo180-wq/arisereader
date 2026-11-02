// A.R.I.S.E. Reader: Haven City's pets and the student library.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("pet Halloread gear: the name helper is imported where it's used (Haven City said it couldn't find it)", () => {
  const src = readFileSync("client/src/lib/halloread.ts", "utf8");
  assert.match(src, /^import \{ HALLOREAD_ACTIVE, halloreadPetGearName \} from "@\/lib\/halloreadInfo";$/m);
  assert.match(src, /const name=halloreadPetGearName\(petId\)/);
});

test("the student library has no Learning Bundle banner", () => {
  const lib = readFileSync("client/src/pages/Library.tsx", "utf8");
  assert.doesNotMatch(lib, /AddonsCard/);
});
