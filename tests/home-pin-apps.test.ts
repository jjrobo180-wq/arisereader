// Pinning an installed app to the Home Screen: any added Kit plugin (WorkHub) or Notes app (both
// hubs) can get its own tile on Home, the same way a built-in part can be shown, moved, resized or
// hidden there. See shared/hubLayout.ts's pinId/isPinId/unpinId and the `pinnable` parameter on
// cleanAnyLayout/cleanLayout/cleanLifeLayout.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanLayout, isPinId, moveSection, pinId, resizeSection, showSection, sizeOf, unpinId } from "../shared/hubLayout";
import { cleanLifeLayout } from "../shared/lifeLayout";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("pinId/isPinId/unpinId round-trip, and a pin id never collides with a built-in part id", () => {
  assert.equal(pinId("work-kit-foo"), "pin:work-kit-foo");
  assert.equal(unpinId(pinId("work-kit-foo")), "work-kit-foo");
  assert.ok(isPinId(pinId("anything")));
  assert.ok(!isPinId("day"), "a built-in part id (no colon) is never mistaken for a pin");
});

test("a newly installed app starts pinned in the order but hidden, same as a built-in part that starts hidden", () => {
  const layout = cleanLayout({}, ["work-kit-foo"]);
  assert.ok(layout.home.includes(pinId("work-kit-foo") as any), "it's in the order, ready to show");
  assert.ok(layout.homeHidden.includes(pinId("work-kit-foo") as any), "but starts hidden, like widgets/picture do");
});

test("showing a pin from the tray keeps it shown on reload, and resizing/moving it works like a built-in part", () => {
  const fresh = cleanLayout({}, ["work-kit-foo"]);
  const shown = showSection(fresh, pinId("work-kit-foo"), true);
  assert.ok(!shown.homeHidden.includes(pinId("work-kit-foo") as any));
  const reloaded = cleanLayout(shown, ["work-kit-foo"]);
  assert.ok(!reloaded.homeHidden.includes(pinId("work-kit-foo") as any), "stays shown after a save and load");
  const resized = resizeSection(reloaded, pinId("work-kit-foo"), "small");
  assert.equal(sizeOf(resized, pinId("work-kit-foo")), "small");
  const moved = moveSection(resized, pinId("work-kit-foo"), -1);
  assert.ok(moved.home.indexOf(pinId("work-kit-foo") as any) < resized.home.indexOf(pinId("work-kit-foo") as any));
});

test("uninstalling the app drops its pin entirely; reinstalling starts it hidden again, not auto-restored", () => {
  const shown = showSection(cleanLayout({}, ["work-kit-foo"]), pinId("work-kit-foo"), true);
  const uninstalled = cleanLayout(shown, []);
  assert.ok(!uninstalled.home.includes(pinId("work-kit-foo") as any), "dropped once the app isn't installed");
  assert.ok(!uninstalled.homeHidden.includes(pinId("work-kit-foo") as any));
  const reinstalled = cleanLayout(uninstalled, ["work-kit-foo"]);
  assert.ok(reinstalled.home.includes(pinId("work-kit-foo") as any));
  assert.ok(reinstalled.homeHidden.includes(pinId("work-kit-foo") as any), "starts hidden again, same as a fresh install");
});

test("a pin for an app that was never passed as pinnable never sneaks into the layout at all", () => {
  const layout = cleanLayout({ home: [pinId("not-really-installed")], homeHidden: [] }, ["work-kit-foo"]);
  assert.ok(!layout.home.includes(pinId("not-really-installed") as any), "not in the pinnable list, so it's dropped");
  assert.ok(layout.home.includes(pinId("work-kit-foo") as any), "the actually-pinnable one is still there");
});

test("LifeHub's cleanLifeLayout accepts pinnable ids the same way WorkHub's cleanLayout does", () => {
  const layout = cleanLifeLayout({}, ["life-work-notes"]);
  assert.ok(layout.home.includes(pinId("life-work-notes") as any));
  assert.ok(layout.homeHidden.includes(pinId("life-work-notes") as any));
  // Calling it with no pinnable list at all (every existing call site) behaves exactly as before.
  const plain = cleanLifeLayout({});
  assert.ok(!plain.home.some((id) => isPinId(id)));
});

test("cleanLayout with no pinnable argument at all behaves exactly as it always did (every existing call site)", () => {
  const layout = cleanLayout({});
  assert.ok(!layout.home.some((id) => isPinId(id)), "no pins appear unless a pinnable list is passed");
  assert.equal(layout.home.length, 11, "the usual 11 built-in WorkHub Home parts, nothing more");
});

test("WorkHub wires pinned Kit plugins and Notes apps into Home: catalog, tiles and the open actions they reuse", () => {
  const hub = read("client/src/pages/TeacherHub.tsx");
  assert.match(hub, /const pinnableApps = \[\.\.\.myKits\.map\(\(d\) => d\.id\), \.\.\.myNotesApps\.map\(\(p\) => p\.id\)\];/);
  assert.match(hub, /const layout = withSharedLook\(cleanLayout\(workspace\.layout, pinnableApps\)\);/);
  assert.match(hub, /for \(const d of myKits\) part\[pinId\(d\.id\)\] = pinTile\(kitIcon\(d\.icon\), d\.color, d\.name, d\.tagline, \(\) => openKit\(d\.id\)\);/);
  assert.match(hub, /for \(const p of myNotesApps\) part\[pinId\(p\.id\)\] = pinTile\(StickyNote, p\.color, p\.name, p\.tagline, \(\) => openNotesApp\(p\.id\)\);/);
  assert.match(hub, /catalog=\{\[\.\.\.WORK_PARTS, \.\.\.pinnedCatalog\]\}/);
});

test("LifeHub wires pinned Notes apps into Home the same way", () => {
  const life = read("client/src/pages/AriseTodo.tsx");
  assert.match(life, /openNotesApp=\{setNotesAppOpen\}/, "FamilyHome is given a way to open a pinned Notes app");
  const home = read("client/src/components/family-hub/FamilyHome.tsx");
  assert.match(home, /const layout = cleanLifeLayout\(family\.layout, myNotesApps\.map\(\(p\) => p\.id\)\);/);
  assert.match(home, /for \(const p of myNotesApps\) part\[pinId\(p\.id\)\] = \(/);
  assert.match(home, /onClick=\{\(\) => openNotesApp\(p\.id\)\}/);
  assert.match(home, /catalog=\{\[\.\.\.CATALOG, \.\.\.pinnedCatalog\]\}/);
});

test("WorkHub Home looks like LifeHub's: greeting, quick counts, soft cards, and keeps the picture box", () => {
  const hub = read("client/src/pages/TeacherHub.tsx");
  assert.match(hub, /data-testid="home-greeting"/);
  assert.match(hub, /Here's what's happening in your workspace today\./);
  assert.match(hub, /home-stat-tasks/);
  assert.match(hub, /picture: \(\s*<WorkspaceBanner/);
  assert.match(hub, /className="hub-home-life"/);
  assert.match(hub, /hub-paper hub-lifelook/);
  assert.ok(cleanLayout({}).home.includes("picture"), "the picture box is still a Home part");
  assert.ok(cleanLayout({}).home.includes("stats"));
});
