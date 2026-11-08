// The Tile theme in LifeHub (November 2026). Picked in WorkHub, the look carries over to LifeHub
// (lib/sharedLook.ts). LifeHub hid its menu for Tile's start screen, but its Home read only the hub's own
// saved look, so it drew the ordinary page without the app tiles: no menu and no tiles, nowhere to go.
// Run with: npx tsx --test tests/tile-lifehub.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("LifeHub's Home shows the look the whole hub is showing, the shared one included", () => {
  const home = read("client/src/components/family-hub/FamilyHome.tsx");
  assert.match(home, /const layout = withSharedLook\(cleanLifeLayout\(family\.layout, myNotesApps\.map\(\(p\) => p\.id\)\), "life"\);/);
  // The same as the hub around it.
  assert.match(read("client/src/pages/AriseTodo.tsx"), /const layout = withSharedLook\(cleanLifeLayout\(family\.layout, pinnableApps\.map\(\(p\) => p\.id\)\), "life"\);/);
});

test("on a computer the Tile theme keeps LifeHub's menu, as WorkHub does", () => {
  const hub = read("client/src/pages/AriseTodo.tsx");
  assert.match(hub, /const dsk = osOn \? "drawer" : shown === "tasks" \? "left" : layout\.deskSide;/);
  // The floating Start button is for phones and tablets: on a computer the menu has Home.
  assert.match(hub, /data-testid="life-start-back"\s+className="fixed [^"]*lg:hidden/);
});
