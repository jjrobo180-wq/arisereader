// The Arise Reader iPhone app as an iPhone app: notifications from the server, quick actions on the
// Home Screen icon, haptics, a slightly smaller layout. Run with: npx tsx --test tests/reader-native.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readerLinkRoute } from "../client/src/lib/readerNative";
import { APPLE_APPS, appleEndpoint } from "../server/applePush";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("quick actions and links go to real pages", () => {
  assert.deepEqual(readerLinkRoute("arisereader://go/library"), { route: "/library", inbox: false });
  assert.deepEqual(readerLinkRoute("arisereader://go/messages"), { route: "/library?inbox=1", inbox: true });
  assert.deepEqual(readerLinkRoute("arisereader://go/games"), { route: "/games", inbox: false });
  assert.equal(readerLinkRoute("arisereader://go/../admin"), null);
  assert.equal(readerLinkRoute("https://evil.example"), null);
  for (const t of ["library", "messages", "games", "profile"]) assert.match(read(".github/scripts/reader_native.py"), new RegExp(`arisereader://go/${t}`), t);
});

test("students' phones get the server's notifications", () => {
  assert.equal(APPLE_APPS.reader, "com.arisereader.reader");
  assert.equal(appleEndpoint("ab".repeat(32), "reader"), `apns:com.arisereader.reader:${"ab".repeat(32)}`);
  assert.match(read("client/src/lib/applePush.ts"), /f === "reader"/);
  assert.match(read("reader/ios-app/package.json"), /@capacitor\/push-notifications/);
  assert.match(read("server/storage.ts"), /onReaderMessage\?\.\(userId, senderType, text\)/);
  assert.match(read("server/routes.ts"), /setReaderMessageListener\(/);
  assert.match(read(".github/scripts/configure_reader_app.py"), /FLAVOR in \("reader", "educator", "eyegaze"\)/);
});

test("a little smaller, with taps you feel", () => {
  assert.match(read("client/src/reader-app.css"), /html\.reader-app\.reader-compact \{ font-size: 90%; \}/);
  assert.match(read("client/src/pages/Quiz.tsx"), /readerQuizFeel\(/);
  assert.match(read("reader/ios-app/capacitor.config.json"), /"allowsLinkPreview": false/);
  assert.match(read(".github/workflows/arisereader-ios.yml"), /reader_native\.py/);
});
