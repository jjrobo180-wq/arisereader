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
