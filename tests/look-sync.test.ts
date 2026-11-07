import test from "node:test";
import assert from "node:assert/strict";
const store = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
(globalThis as any).window = { dispatchEvent() {}, addEventListener() {} };
(globalThis as any).Event = class { constructor(public type: string) {} };

test("the newest look wins across devices: the account beats a stale copy on this device", async () => {
  const { withSharedLook, stampLook, readNight, withNight } = await import("../client/src/lib/sharedLook");
  const { cleanLayout } = await import("../shared/hubLayout");
  // This device picked Classic long ago.
  store.set("arise-shared-look", JSON.stringify({ theme: "classic", at: "2026-11-01T00:00:00Z" }));
  // The phone picked Corkboard later: the account's layout says so.
  const account = cleanLayout({ theme: "x-corkboard", lookAt: "2026-11-06T00:00:00Z", night: true });
  assert.equal(account.lookAt, "2026-11-06T00:00:00Z");
  const shown = withSharedLook(account, "work");
  assert.equal(shown.theme, "x-corkboard");
  assert.equal(readNight("work"), true, "night mode follows the account");
  // The other hub on this device now uses it too.
  const other = withSharedLook(cleanLayout({ theme: "classic" }), "life");
  assert.equal(other.theme, "x-corkboard");
  // Picking here stamps it, so it wins on the other device.
  const picked = stampLook(shown, { ...shown, theme: "x-billboard" });
  assert.ok(Date.parse(picked.lookAt!) > Date.parse("2026-11-06T00:00:00Z"));
  assert.equal(withSharedLook(cleanLayout({ theme: "x-corkboard", lookAt: "2026-11-06T00:00:00Z" }), "life").theme, "x-billboard");
  assert.equal(withNight(picked, false).night, false);
});

test("night mode is a real change on every look, dark ones included", async () => {
  const { NOTES_THEMES, nightLook } = await import("../shared/notesThemes");
  for (const t of NOTES_THEMES) assert.notEqual(nightLook(t), t, t.id);
});
