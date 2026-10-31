// The A.R.I.S.E. Reader iPhone apps (students and Educator), built from the shared frontend with
// VITE_NATIVE_APP (client/src/lib/nativeApp.ts), and the server pieces they need.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appleEndpoint, appleToken, appleTopic, isAppleDevice } from "../server/applePush";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const T = "ab".repeat(32);

test("Apple push devices remember which app they belong to", () => {
  assert.equal(appleEndpoint(T), "apns:" + T, "Arise To Duo keeps its old form");
  assert.equal(appleEndpoint(T, "educator"), "apns:com.arisereader.educator:" + T);
  assert.equal(appleEndpoint(T, "nope"), "apns:" + T);
  for (const e of [appleEndpoint(T), appleEndpoint(T, "educator")]) { assert.ok(isAppleDevice(e)); assert.equal(appleToken(e), T); }
  assert.equal(appleTopic(appleEndpoint(T)), undefined);
  assert.equal(appleTopic(appleEndpoint(T, "educator")), "com.arisereader.educator");
});

test("each Reader app has its own id, icon, workflow and first run", () => {
  const nat = read("client/src/lib/nativeApp.ts");
  assert.match(nat, /reader: \{ name: "A\.R\.I\.S\.E\. Reader", bundle: "com\.arisereader\.reader"/);
  assert.match(nat, /educator: \{ name: "A\.R\.I\.S\.E\. Reader Educator", bundle: "com\.arisereader\.educator"/);
  for (const [f, bundle] of [["reader", "com.arisereader.reader"], ["educator", "com.arisereader.educator"]]) {
    assert.equal(JSON.parse(read(`${f}/ios-app/capacitor.config.json`)).appId, bundle);
    const wf = read(`.github/workflows/${f === "reader" ? "arisereader" : "educator"}-ios.yml`);
    assert.match(wf, new RegExp(`VITE_NATIVE_APP=${f} npx vite build`));
    assert.match(wf, new RegExp(`app-icons/${f}-1024\\.png`));
    assert.match(wf, new RegExp(`PRODUCT_BUNDLE_IDENTIFIER=${bundle.replace(/\./g, "\\.")}`));
    assert.doesNotMatch(wf, /com\.arisereader\.arisetodo/);
  }
  assert.match(read("educator/ios-app/package.json"), /@capacitor\/push-notifications/);
  assert.match(read("reader/ios-app/package.json"), /@capacitor\/local-notifications/);
  assert.match(read(".github/workflows/educator-ios.yml"), /APPLE_ID_AUTH PUSH_NOTIFICATIONS/);
  assert.match(read("client/src/App.tsx"), /isReaderApp\(\) && user && !isAdminPreview && <ReaderFirstRun/);
});

test("the Reader apps stay inside the app and never link to purchases", () => {
  const hubs = read("client/src/lib/hubs.ts");
  assert.match(hubs, /if \(isReaderApp\(\)\) \{ window\.location\.hash = "#\/reader"; return; \}/);
  assert.match(hubs, /if \(isReaderApp\(\)\) \{ window\.location\.hash = "#\/signin"; return; \}/);
  const tr = read("client/src/pages/TeacherReader.tsx");
  assert.match(tr, /\{!isReaderApp\(\) && <section aria-label=\{`Open your \$\{hub\.name\}`\}/, "no hub / paid add-on banner in the app");
  assert.match(tr, /if \(isReaderApp\(\)\) goToSignIn\(\); else window\.location\.assign\(READER_SIGN_IN\)/);
});

test("Sign in with Apple works for the Educator app, which makes parent accounts", () => {
  const r = read("server/routes.ts");
  assert.match(r, /verifyAppleToken\(String\(req\.body\?\.identityToken \|\| ""\), \[ARISE_APP, EDUCATOR_APP\]\)/);
  assert.match(r, /role: fromApp === EDUCATOR_APP \? "parent" : "todo"/);
});
