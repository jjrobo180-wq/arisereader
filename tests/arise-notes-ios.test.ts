// The Arise Notes iPhone app (com.arisereader.notes): built from the shared frontend with
// VITE_NATIVE_APP=notes, opens to the iPhone sign-in and then Arise Notes, asks for the microphone with
// a reason, sells nothing inside the app, and gets live updates like the other apps.
// Run with: npx tsx --test tests/arise-notes-ios.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const read = (p: string) => readFileSync(p, "utf8");

test("it's its own app: Arise Notes, com.arisereader.notes, opening to sign-in and then Notes", () => {
  const nat = read("client/src/lib/nativeApp.ts");
  assert.match(nat, /\| "notes";/);
  assert.match(nat, /\|\| f === "notes" \? f : "todo"/);
  assert.match(nat, /notes: \{ name: "Arise Notes", bundle: "com\.arisereader\.notes", api: "https:\/\/arisetodo\.com" \}/);
  assert.match(nat, /export const isNotesApp = \(\): boolean => isNativeApp\(\) && nativeFlavor\(\) === "notes";/);

  const app = read("client/src/App.tsx");
  assert.match(app, /const NotesApp = lazy\(\(\) => import\("@\/components\/arise-notes\/NotesApp"\)\);/);
  assert.match(app, /if \(isNotesApp\(\)\) return <Router hook=\{useHashPathLocation\}>.*\{user \? <NotesApp mode="standalone" \/> : <NativeSignIn \/>\}/);
  assert.ok(app.indexOf("if (isNotesApp())") < app.indexOf("if (isFitApp())"), "checked with the other one-app builds");

  const signIn = read("client/src/pages/NativeSignIn.tsx");
  assert.match(signIn, /notes: \{ icon: "\/app-icons\/notes-1024\.png", tagline: "Record it\. Get the notes\.", apple: true,/);
  assert.match(signIn, /flavor === "notes" \? "Free, for anyone, with 60 minutes a month\./);
});

test("Sign in with Apple accepts the Notes app", () => {
  assert.match(read("server/appleSignIn.ts"), /export const NOTES_APP = "com\.arisereader\.notes";/);
  const r = read("server/routes.ts");
  assert.equal(r.match(/\[ARISE_APP, EDUCATOR_APP, FIT_APP, EYEGAZER_APP, TRAINER_APP, NOTES_APP\]/g)?.length, 2, "signing in, and checking before deleting an account");
  assert.match(r, /claims\.aud === NOTES_APP \? NOTES_APP : ARISE_APP/);
  assert.match(r, /was === NOTES_APP \? was : ARISE_APP/);
});

test("no plans are sold inside the iPhone app (App Review 3.1.1)", () => {
  const s = read("client/src/components/arise-notes/SettingsScreen.tsx");
  assert.match(s, /import \{ NATIVE_NO_PURCHASE, isNativeApp \} from "@\/lib\/nativeApp";/);
  assert.match(s, /const native = isNativeApp\(\);/);
  assert.match(s, /if \(!native\) notesApi\.billing\(\)/, "billing isn't even loaded in the app");
  assert.match(s, /\{native \? <Notice>\{NATIVE_NO_PURCHASE\}<\/Notice> : !bill \? <Spinner \/> : <>/, "no prices, buy buttons or billing links");
});

test("the iOS project: light, the microphone with a reason, live updates from our own server", () => {
  const cap = JSON.parse(read("notes/ios-app/capacitor.config.json"));
  assert.equal(cap.appId, "com.arisereader.notes");
  assert.equal(cap.appName, "Arise Notes");
  assert.equal(cap.plugins.CapacitorUpdater.updateUrl, "https://arisetodo.com/api/ota/notes");
  assert.equal(cap.plugins.CapacitorUpdater.statsUrl, "");
  const pkg = JSON.parse(read("notes/ios-app/package.json"));
  for (const dep of ["@capacitor/ios", "@capacitor-community/apple-sign-in", "@capgo/capacitor-updater", "@capacitor/status-bar", "@capacitor/push-notifications", "@ebarooni/capacitor-calendar"]) assert.ok(pkg.dependencies[dep], dep);
  assert.equal(pkg.dependencies["@capgo/capacitor-health"], undefined, "no Apple Health");

  // The Info.plist the build writes.
  const dir = mkdtempSync(join(tmpdir(), "notes-plist-"));
  const plist = join(dir, "Info.plist");
  writeFileSync(plist, '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>UIUserInterfaceStyle</key><string>Dark</string></dict></plist>');
  execFileSync("python3", [".github/scripts/configure_fit_app.py", plist, "notes"]);
  const out = read(plist);
  for (const key of ["NSMicrophoneUsageDescription", "NSCameraUsageDescription", "NSPhotoLibraryUsageDescription", "NSRemindersFullAccessUsageDescription", "NSRemindersUsageDescription", "NSCalendarsWriteOnlyAccessUsageDescription", "NSCalendarsFullAccessUsageDescription", "NSCalendarsUsageDescription"]) assert.match(out, new RegExp(`<key>${key}</key>\\s*<string>Arise Notes [^<]{20,}</string>`), key);
  assert.match(out, /<key>CFBundleDisplayName<\/key>\s*<string>Arise Notes<\/string>/);
  assert.match(out, /<key>UIUserInterfaceStyle<\/key>\s*<string>Light<\/string>/, "Notes has only a light look");
  assert.match(out, /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/);

  // Fit still follows the phone's look.
  const fit = join(dir, "Fit.plist");
  writeFileSync(fit, '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>UIUserInterfaceStyle</key><string>Dark</string></dict></plist>');
  execFileSync("python3", [".github/scripts/configure_fit_app.py", fit, "fit"]);
  assert.doesNotMatch(read(fit), /UIUserInterfaceStyle/);
  assert.doesNotMatch(read(fit), /NSMicrophoneUsageDescription/);

  // The icon is a 1024×1024 PNG with no transparency (color type 2), as App Store Connect requires.
  const png = readFileSync("client/public/app-icons/notes-1024.png");
  assert.equal(png.toString("latin1", 1, 4), "PNG");
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20), png[25]], [1024, 1024, 2]);
});

test("the TestFlight build signs and uploads Arise Notes like the other apps", () => {
  const wf = read(".github/workflows/notes-ios.yml");
  assert.match(wf, /branches: \[feat\/notes-testflight\]/);
  assert.match(wf, /VITE_NATIVE_APP=notes npx vite build/);
  assert.match(wf, /ota_setup\.py notes\n\s+npx cap add ios/);
  assert.match(wf, /configure_fit_app\.py ios\/App\/App\/Info\.plist notes/);
  assert.match(wf, /app-icons\/notes-1024\.png/);
  assert.match(wf, /find-existing-profile\.py com\.arisereader\.notes .* --create-missing-profile --register-bundle-id "--app-name=Arise Notes"/);
  assert.match(wf, /apple_signing\.py com\.arisereader\.notes "\$RUNNER_TEMP\/profile\.mobileprovision" APPLE_ID_AUTH PUSH_NOTIFICATIONS/);
  assert.match(wf, /PRODUCT_BUNDLE_IDENTIFIER=com\.arisereader\.notes/);
  assert.match(wf, /contains\(github\.event\.head_commit\.message, '\[approved-testflight\]'\)/, "uploads only when approved");
  assert.doesNotMatch(wf, /healthkit|HEALTHKIT|com\.arisereader\.fit|fit\/ios-app/i);

  assert.match(read("server/ota.ts"), /"trainer", "notes"\] as const;/);
  assert.match(read(".github/workflows/ota-publish.yml"), /app: \[[^\]]*\bnotes\]/);
  assert.match(read(".github/scripts/ota_setup.py"), /"trainer", "notes"\), APP/);
});

test("sign out, notifications, and Apple Reminders and Calendar in the Notes iPhone app", () => {
  const settings = read("client/src/components/arise-notes/SettingsScreen.tsx");
  assert.match(settings, /\{ctx\.mode === "standalone" && <SignOut ctx=\{ctx\} \/>\}/, "the Notes app and /notes/ can sign out (To Duo has its own)");
  assert.match(settings, /onClick=\{\(\) => \{ logout\(\); window\.location\.hash = "#\/"; \}\}/);
  assert.match(read("client/src/context/AuthContext.tsx"), /forgetThisDevice\(/, "signing out stops this phone's notifications");

  const push = read("client/src/lib/applePush.ts");
  assert.match(push, /\|\| f === "notes" \? f : undefined/, "the server sends to the Notes app's bundle");
  assert.match(push, /nativeFlavor\(\) === "notes"\) \{ window\.location\.hash = notes\[1\]/, "a tapped /notes/# link opens inside the app");
  assert.match(read("server/applePush.ts"), /notes: "com\.arisereader\.notes"/);
  assert.match(read("client/src/components/arise-notes/NotesApp.tsx"), /if \(isNotesApp\(\) && user\) void startApplePush\(true\);/);

  const apple = read("client/src/lib/notesApple.ts");
  assert.match(apple, /call\("requestFullRemindersAccess"\)/);
  assert.match(apple, /call\("createReminder", \{ title:/);
  assert.match(apple, /call\("requestWriteOnlyCalendarAccess"\)/);
  assert.match(apple, /call\("createEvent", \{ title:/);
  const sheet = read("client/src/components/arise-notes/noteSheets.tsx");
  assert.match(sheet, /label="Add to-dos to Apple Reminders"/);
  assert.match(sheet, /label="Add events to the iPhone Calendar"/);
  assert.ok(sheet.indexOf("await notesApi.send(") < sheet.indexOf("await addToAppleReminders("), "Arise To Duo first, then the iPhone");
  const memo = read("client/src/components/arise-notes/MemoScreen.tsx");
  assert.match(memo, /label="Also add to Apple Reminders"/);
  assert.match(memo, /label="Also add to the iPhone Calendar"/);
});
