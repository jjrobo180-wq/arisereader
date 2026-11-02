// The Arise To Duo iPhone app's own sign-in screens and first run (pages/NativeSignIn.tsx and the
// app version of components/AppWalkthrough.tsx). The website keeps pages/SignIn.tsx.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the iPhone app signs in on its own screen; the website keeps its page", () => {
  const app = read("client/src/App.tsx");
  assert.match(app, /isNativeApp\(\) \? <NativeSignIn \/> : <SignIn \/>/);
  const s = read("client/src/pages/NativeSignIn.tsx");
  assert.match(s, /askApple\(nativeAppInfo\(\)\.bundle\)/, "Sign in with Apple, for whichever app this is");
  assert.match(s, /\/api\/arise-todo\/register/, "free account");
  assert.match(s, /\/api\/arise-todo\/confirm-email/, "email code");
  assert.match(s, /<ForgotSignIn \/>/, "forgot username or password");
  assert.match(s, /LEGAL\.terms/); assert.match(s, /LEGAL\.privacy/);
  assert.doesNotMatch(s, /sample1234|trySample/, "no sample accounts in the app");
  // iPhone zooms the page when a field's text is under 16px.
  for (const m of s.matchAll(/<input[^>]*className="([^"]*)"/g)) assert.match(m[1], /text-\[(1[6-9]|[2-9]\d)px\]/, m[1]);
});

test("the app's first run asks for notifications, then shows the full-screen tour", () => {
  const w = read("client/src/components/AppWalkthrough.tsx");
  assert.match(w, /if \(isNativeApp\(\)\) return <NativeTour/);
  assert.match(w, /data-testid=\{`setup-\$\{r\.id\}-go`\}/, "each row has its own button");
  assert.match(w, /await turnOnNativeReminders\(hub\)/, "the notifications button raises iOS's permission prompt");
  assert.match(w, /data-testid="native-notify-later"/, "Not now is always there");
  assert.match(w, /steps\.filter\(\(s\) => s\.id !== "notify"\)/, "no second reminders page");
});
