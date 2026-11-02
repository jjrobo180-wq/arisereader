// iOS 27 SDK (Xcode 27, for iPhone Duo): an app without the UIScene life cycle is stopped at launch.
// Every iPhone app's builds add it (.github/scripts/adopt_uiscene.py), and the PR builds open the app
// on an iOS 27 simulator and fail if it quits.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("every iPhone app build adds the UIScene life cycle", () => {
  for (const w of ["arisetodo-signed-release", "podplus-testflight", "arisereader-ios", "educator-ios", "arisetodo-ios", "podplus-ios"]) {
    assert.match(read(`.github/workflows/${w}.yml`), /adopt_uiscene\.py ios\/App\/App\/Info\.plist/, w);
  }
  const s = read(".github/scripts/adopt_uiscene.py");
  assert.match(s, /UIApplicationSceneManifest/);
  assert.match(s, /\$\(PRODUCT_MODULE_NAME\)\.SceneDelegate/);
  assert.match(s, /configurationForConnecting/);
  assert.match(s, /class SceneDelegate: UIResponder, UIWindowSceneDelegate/);
  assert.match(s, /openURLContexts/, "links still reach Capacitor");
});

test("the PR builds check the app stays open on an iOS 27 simulator", () => {
  for (const w of ["arisetodo-ios", "podplus-ios"]) {
    const y = read(`.github/workflows/${w}.yml`);
    assert.match(y, /runs-on: xcode-27/, w);
    assert.match(y, /launchctl list \| grep -q "UIKitApplication:/, w);
  }
});
