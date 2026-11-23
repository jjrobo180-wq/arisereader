import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("App Review 5.6: To Duo has no live updates and Ask is a plain AI chat in the iPhone apps", () => {
  assert.doesNotMatch(readFileSync("arisetodo/ios-app/package.json", "utf8"), /capacitor-updater/);
  assert.doesNotMatch(readFileSync(".github/workflows/arisetodo-signed-release.yml", "utf8"), /ota_setup\.py todo/);
  assert.doesNotMatch(readFileSync(".github/workflows/ota-publish.yml", "utf8"), /app: \[todo,/);
  const native = readFileSync("client/src/lib/nativeApp.ts", "utf8");
  assert.match(native, /export const plainAsk = \(\): boolean => isNativeApp\(\) && nativeFlavor\(\) !== "undercover";/);
  const notes = readFileSync("client/src/components/arise-notes/NotesApp.tsx", "utf8");
  assert.match(notes, /case "ask": case "undercover": return plainAsk\(\) \? <AskScreen ctx=\{ctx\} \/>/);
  const ask = readFileSync("client/src/components/arise-notes/AskScreen.tsx", "utf8");
  assert.match(ask, /const look: Look = plainAsk\(\) \? "chat" : view\.look;/);
  assert.match(ask, /\{!plainAsk\(\) && <Toggle label="Look"/);
  assert.match(readFileSync("client/src/components/arise-notes/notesAppsCatalog.tsx", "utf8"), /plainAsk\(\) \? ALL_NOTES_APPS\.filter\(\(a\) => a\.id !== "undercover"\)/);
});

test("App Review 5.6: the To Duo app opens only To Duo's own pages", async () => {
  const { todoNativeAllows } = await import("../shared/todoNativeRoutes.ts");
  for (const p of ["/", "/lifehub", "/familyhub?go=x", "/workhub", "/arise-notes", "/fit", "/signin", "/plans/abc", "/pro"]) assert.ok(todoNativeAllows(p), p);
  for (const p of ["/admin", "/games", "/paintball-arena", "/eye-gaze-home", "/fyp", "/rewards", "/quiz/5", "/leaderboard", "/reader", "/todo-admin"]) assert.ok(!todoNativeAllows(p), p);
  const app = readFileSync("client/src/App.tsx", "utf8");
  assert.match(app, /isNativeApp\(\) && nativeFlavor\(\) === "todo" && !todoNativeAllows\(routePath\)/);
});

test("App Review: no TestFlight wording, no locale-guessed purchase link, no update button without an updater", () => {
  for (const f of ["client/src/components/teacher-hub/HubTaskFocus.tsx", "client/src/components/family-hub/Focus.tsx", "client/src/lib/duoFocus.ts", "client/src/lib/nativeHealth.ts", "client/src/pages/fit/fitNative.ts"])
    assert.doesNotMatch(readFileSync(f, "utf8"), /TestFlight\b(?![^\n]*\/\/)/, f);
  assert.match(readFileSync("client/src/components/AllAccessOffer.tsx", "utf8"), /useState\(\(\) => \(apple \|\| isNativeApp\(\) \? false : usRegion\(\)\)\)/);
  assert.match(readFileSync("client/src/components/arise-notes/SettingsScreen.tsx", "utf8"), /\{canSelfUpdate\(\) && <Row label="Check for updates"/);
});
