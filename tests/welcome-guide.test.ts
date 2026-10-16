// The first-sign-in welcome and staying signed in. Run with: npx tsx --test tests/welcome-guide.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BAR_MS, BAR_TEXT, FRESH, HOME_STEPS, barLeftMs, closeBar, closePopup, deviceOf, parseWelcome, showPopup } from "../shared/welcomeGuide";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/125.0 Mobile Safari/537.36";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15";

test("the device is told apart so each person sees their own steps", () => {
  assert.equal(deviceOf(IPHONE), "ios");
  assert.equal(deviceOf(MAC, "MacIntel", 5), "ios", "an iPad that asks for the desktop site");
  assert.equal(deviceOf(MAC, "MacIntel", 0), "desktop");
  assert.equal(deviceOf(ANDROID), "android");
  assert.equal(deviceOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125"), "desktop");
  for (const d of ["ios", "android", "desktop"] as const) {
    assert.ok(HOME_STEPS[d].length >= 2 && BAR_TEXT[d].length > 20, d);
  }
  assert.match(HOME_STEPS.ios.join(" "), /Share[\s\S]*Add to Home Screen/);
  assert.match(HOME_STEPS.android.join(" "), /Install app|Add to Home screen/);
});

test("the pop-up shows once; closing it starts the bar; the bar goes away on its own for good", () => {
  let state = parseWelcome(null);
  assert.deepEqual(state, FRESH);
  assert.equal(showPopup(state), true);
  assert.equal(barLeftMs(state, 1000), 0, "no bar before the pop-up has been closed");

  const t0 = 1_000_000;
  state = closePopup(state, t0);
  assert.equal(showPopup(state), false, "never again");
  assert.equal(barLeftMs(state, t0), BAR_MS, "the bar shows for its full time");
  assert.equal(barLeftMs(state, t0 + 5000), BAR_MS - 5000, "and keeps counting down, even after a reload");
  assert.equal(barLeftMs(state, t0 + BAR_MS), 0, "gone when the time is up");
  assert.equal(barLeftMs(state, t0 + BAR_MS + 3_600_000), 0, "and an hour later");
  assert.equal(barLeftMs(state, t0 + 400 * 86_400_000), 0, "and a year later: forever");

  // Re-opening the pop-up from the bar and closing it does not restart the clock.
  const again = closePopup(state, t0 + 9000);
  assert.equal(again.barAt, t0);
  assert.equal(barLeftMs(again, t0 + BAR_MS + 1), 0);

  // Closing the bar by hand ends it at once.
  assert.equal(barLeftMs(closeBar(state), t0 + 1), 0);
  assert.equal(barLeftMs(closeBar(state), t0 + 1), 0);
});

test("saved text is read safely", () => {
  const saved = JSON.stringify(closePopup(FRESH, 5));
  assert.deepEqual(parseWelcome(saved), { seen: true, barAt: 5, barClosed: false });
  for (const junk of ["", "nope", "[]", "null", "42", '{"seen":"yes","barAt":"x"}', undefined, {}]) {
    assert.deepEqual(parseWelcome(junk as any), FRESH, String(junk));
  }
  assert.equal(parseWelcome('{"seen":true,"barAt":-4}').barAt, 0, "a nonsense time is dropped, so the bar can't linger");
});

test("the welcome is mounted for signed-in people and stays out of the way of the older prompt", () => {
  const app = read("client/src/App.tsx");
  assert.match(app, /<WelcomeGuide \/>/);
  assert.match(app, /overlays && !isAdminPreview && !isDemoStudent && !isEyeGazeStudent && <WelcomeGuide \/>/, "not in games, admin previews, samples or eye-gaze accounts");
  const guide = read("client/src/components/WelcomeGuide.tsx");
  assert.match(guide, /arise-install-prompt/, "holds the desktop install pop-up back");
  assert.match(guide, /keyFor\(userId\)|arise-welcome:/, "remembered per account");
  assert.match(guide, /Notification\.requestPermission/);
  assert.match(guide, /\/api\/push\/subscribe/);
  assert.match(guide, /needsApp/, "iPhone is told notifications need the Home Screen app");
  assert.match(guide, /role="dialog"[\s\S]*aria-modal="true"/);
  assert.match(guide, /Escape/);
});

test("the sign-in is kept in two places and put back when the phone drops the cookie", () => {
  const auth = read("client/src/context/AuthContext.tsx");
  assert.match(auth, /const SESSION_DAYS = 180/);
  assert.match(auth, /max-age=/);
  assert.match(auth, /saveSessionBackup\(data\)/, "every save writes the backup too");
  assert.match(auth, /if \(!raw\) \{ raw = readSessionBackup\(\)/, "no cookie: use the backup");
  assert.match(auth, /if \(fromBackup\) setCookie\(COOKIE_NAME, raw, SESSION_DAYS\)/, "and put the cookie back for the rest of the app");
  assert.match(auth, /deleteCookie\(COOKIE_NAME\);\s*clearSessionBackup\(\)/, "signing out clears both");
  assert.match(auth, /keepStorage\(\)/);
  const backup = read("client/src/lib/sessionBackup.ts");
  assert.match(backup, /localStorage/);
  // Only the server saying the sign-in is no good ends it (unchanged).
  assert.match(auth, /res\.status === 401 \|\| res\.status === 403/);
});
