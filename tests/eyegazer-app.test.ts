// The Arise Eye Gazer iPhone and iPad app (VITE_NATIVE_APP=eyegaze).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

test("its own app: bundle, sign-in screen, home, Apple sign-in and notifications", () => {
  assert.match(read("client/src/lib/nativeApp.ts"), /eyegaze: \{ name: "Arise Eye Gazer", bundle: "com\.arisereader\.eyegazer"/);
  assert.match(read("client/src/pages/NativeSignIn.tsx"), /eyegaze: \{ icon: "\/app-icons\/eyegazer-1024\.png"/);
  assert.match(read("client/src/App.tsx"), /isEyeGazerApp\(\) && user\.role === "parent" \? <Redirect key="home-to-eyegaze-parent" to="\/eye-gaze-parent"/);
  assert.match(read("server/appleSignIn.ts"), /EYEGAZER_APP = "com\.arisereader\.eyegazer"/);
  assert.match(read("server/applePush.ts"), /eyegaze: "com\.arisereader\.eyegazer"/);
  assert.match(read("client/src/lib/applePush.ts"), /nativeFlavor\(\) === "eyegaze" \? "eyegaze"/);
  assert.ok(existsSync("client/public/app-icons/eyegazer-1024.png"));
});

test("built and checked like the others, with live updates", () => {
  const wf = read(".github/workflows/eyegazer-ios.yml");
  assert.match(wf, /VITE_NATIVE_APP=eyegaze npx vite build/);
  assert.match(wf, /configure_reader_app\.py ios\/App\/App\/Info\.plist eyegaze/);
  assert.match(wf, /--register-bundle-id "--app-name=Arise Eye Gazer"/);
  assert.match(wf, /apple_signing\.py com\.arisereader\.eyegazer "\$RUNNER_TEMP\/profile\.mobileprovision" APPLE_ID_AUTH PUSH_NOTIFICATIONS/);
  assert.match(wf, /ota_setup\.py eyegaze/);
  assert.match(read(".github/workflows/reader-apps-ios-check.yml"), /\{ flavor: eyegaze, dir: eyegazer, bundle: com\.arisereader\.eyegazer \}/);
  assert.match(read(".github/workflows/ota-publish.yml"), /app: \[todo, podplus, reader, educator, fit, eyegaze\]/);
  assert.match(read("server/ota.ts"), /"fit", "eyegaze"\]/);
  assert.match(read("eyegazer/ios-app/package.json"), /@capacitor\/push-notifications/);
  assert.match(read("eyegazer/ios-app/package.json"), /@capgo\/capacitor-updater/);
});
