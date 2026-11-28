import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TOPICS } from "../shared/wikiFeed";
import { CHORE_CATEGORIES, CHORE_PACKS } from "../shared/choreCatalog";

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}]/u;

test("Chores, the daily check-in and Arise Wiki show line icons, not emoji", () => {
  for (const f of ["client/src/components/family-hub/Chores.tsx", "client/src/components/daily/Rise.tsx", "client/src/components/family-hub/choreIcons.tsx"]) {
    const bad = readFileSync(f, "utf8").split("\n").map((l, i) => [i + 1, l] as const).filter(([, l]) => EMOJI.test(l));
    assert.deepEqual(bad.map(([n]) => n), [], `${f} still has emoji`);
  }
  assert.ok(TOPICS.every((t) => !EMOJI.test(JSON.stringify(t))));
  const icons = readFileSync("client/src/components/family-hub/choreIcons.tsx", "utf8");
  const rooms = icons.slice(icons.indexOf("ROOM_ICON"), icons.indexOf("PACK_ICON"));
  const packs = icons.slice(icons.indexOf("PACK_ICON"), icons.indexOf("BY_WORD"));
  for (const c of CHORE_CATEGORIES) assert.match(rooms, new RegExp(`\\b${c.id}: [A-Z]`), `an icon for ${c.id}`);
  for (const p of CHORE_PACKS) assert.match(packs, new RegExp(`\\b${p.id}: [A-Z]`), `an icon for the ${p.id} pack`);
});

test("the Tasks look menu stays on screen on a phone", () => {
  const src = readFileSync("client/src/components/teacher-hub/TaskLooks.tsx", "utf8");
  assert.match(src, /position: "fixed"/);
  assert.match(src, /Math\.max\(gap, Math\.min\(r\.right - width, vw - width - gap\)\)/, "never past either edge");
  assert.match(src, /maxHeight: pos\.maxH/, "scrolls instead of running under the tab bar");
});
