// The Arise AAC iPhone and iPad app (VITE_NATIVE_APP=eyegaze).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

test("its own app: bundle, sign-in screen, home, Apple sign-in and notifications", () => {
  assert.match(read("client/src/lib/nativeApp.ts"), /eyegaze: \{ name: "Arise AAC", bundle: "com\.arisereader\.eyegazer"/);
  assert.match(read("client/src/pages/NativeSignIn.tsx"), /eyegaze: \{ icon: "\/app-icons\/eyegazer-1024\.png"/);
  const app = read("client/src/App.tsx");
  // Opening the app goes straight to Arise AAC (parents: parent mode), never a hub.
  assert.match(app, /eyeGazerApp \? <Redirect key="home-to-eyegaze" to=\{user\.role === "parent" \? "\/eye-gaze-parent" : "\/eye-gaze-home"\}/);
  // Signing in inside the app never hands off to LifeHub or WorkHub on arisetodo.com.
  assert.match(app, /if \(isEyeGazerApp\(\)\) return <Redirect to=\{user\.role === "parent" \? "\/eye-gaze-parent" : "\/eye-gaze-home"\}/);
  // Its own simple account: name, username and password, no school or teacher.
  const signIn = read("client/src/pages/NativeSignIn.tsx");
  assert.match(signIn, /create: "Create an Arise AAC account"/);
  assert.match(signIn, /independent: true, isEyeGazeUser: true/);
  // An old "#/reader" address in the Arise AAC app opens Arise AAC, not the Reader.
  assert.match(app, /if \(isEyeGazerApp\(\)\) \{ window\.location\.hash = user \?/);
  assert.match(read("server/appleSignIn.ts"), /EYEGAZER_APP = "com\.arisereader\.eyegazer"/);
  assert.match(read("server/applePush.ts"), /eyegaze: "com\.arisereader\.eyegazer"/);
  assert.match(read("client/src/lib/applePush.ts"), /f === "eyegaze"/);
  assert.ok(existsSync("client/public/app-icons/eyegazer-1024.png"));
});

test("built and checked like the others, with live updates", () => {
  const wf = read(".github/workflows/eyegazer-ios.yml");
  assert.match(wf, /VITE_NATIVE_APP=eyegaze npx vite build/);
  assert.match(wf, /configure_reader_app\.py ios\/App\/App\/Info\.plist eyegaze/);
  assert.match(wf, /--register-bundle-id "--app-name=Arise AAC"/);
  assert.match(wf, /apple_signing\.py com\.arisereader\.eyegazer "\$RUNNER_TEMP\/profile\.mobileprovision" APPLE_ID_AUTH PUSH_NOTIFICATIONS/);
  assert.match(wf, /ota_setup\.py eyegaze/);
  assert.match(read(".github/workflows/reader-apps-ios-check.yml"), /\{ flavor: eyegaze, dir: eyegazer, bundle: com\.arisereader\.eyegazer \}/);
  assert.match(read(".github/workflows/ota-publish.yml"), /app: \[todo, podplus, reader, educator, fit, eyegaze(, trainer)?(, notes)?(, talk)?\]/);
  assert.match(read("server/ota.ts"), /"fit", "eyegaze"(, "trainer")?(, "notes")?(, "talk")?\]/);
  assert.match(read("eyegazer/ios-app/package.json"), /@capacitor\/push-notifications/);
  assert.match(read("eyegazer/ios-app/package.json"), /@capgo\/capacitor-updater/);
});

test("every permission a game asks for has its sentence, or iOS closes the app", () => {
  const plist = readFileSync(".github/scripts/configure_reader_app.py", "utf8");
  // Animal Splash uses speech recognition (it listens for the animal's name).
  assert.match(readFileSync("client/src/pages/AnimalSplashGame.tsx", "utf8"), /SpeechRecognition/);
  for (const k of ["NSSpeechRecognitionUsageDescription", "NSMicrophoneUsageDescription", "NSCameraUsageDescription"]) assert.match(plist, new RegExp(`"${k}"`), k);
});

test("in the apps, games asking for full screen don't crash the iPad (WebKit full screen is never asked for)", async () => {
  const { installNoFullscreen } = await import("../client/src/lib/noFullscreen");
  let asked = 0;
  class El { requestFullscreen() { asked++; return Promise.resolve(); } }
  class Doc { exitFullscreen() { asked++; return Promise.resolve(); } }
  installNoFullscreen({ Element: El as any, Document: Doc as any });
  await (new El() as any).requestFullscreen();
  await (new El() as any).webkitRequestFullscreen();
  await (new Doc() as any).exitFullscreen();
  assert.equal(asked, 0);
  const main = readFileSync(new URL("../client/src/main.tsx", import.meta.url), "utf8");
  assert.match(main, /if \(isNativeApp\(\)\) installNoFullscreen\(\);/);
});

test("the apps turn WebKit's element full screen off natively (games asking for it crashed Arise AAC)", () => {
  const src = readFileSync(new URL("../.github/scripts/adopt_uiscene.py", import.meta.url), "utf8");
  assert.match(src, /isElementFullscreenEnabled = false/);
  assert.match(src, /import WebKit/);
  assert.match(src, /func sceneDidBecomeActive\(_ scene: UIScene\) \{ NoElementFullscreen\.apply\(in: window\) \}/);
  const stage = readFileSync(new URL("../client/src/components/eye-gaze/StageShell.tsx", import.meta.url), "utf8");
  assert.match(stage, /useEffect\(\(\) => \{ if \(isNativeApp\(\)\) return; try \{ const el = document\.documentElement/);
});

test("Arise AAC Home: five big one-word choices in a fixed order, and signing out asks a grown-up", () => {
  const home = readFileSync(new URL("../client/src/pages/EyeGazeHome.tsx", import.meta.url), "utf8");
  const titles = [...home.matchAll(/\{ title: "([^"]+)"[^}]*primary: true \}/g)].map((m) => m[1]);
  assert.deepEqual(titles, ["Talk", "Play", "Learn", "Life Skills", "My World", "Wren"]);
  const shell = readFileSync(new URL("../client/src/components/EyeGazeSiteShell.tsx", import.meta.url), "utf8");
  assert.match(shell, /window\.confirm\("Grown-ups: sign out of Arise AAC\?"\)/);
  assert.match(shell, /prefers-reduced-motion/);
});
