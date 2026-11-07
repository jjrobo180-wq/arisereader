// Backing out of full-screen views in the iPhone apps (November 2026). In the Arise To Duo build the
// phone reports no safe area at the top, so html.todo-edge sets --sat (at least 44px) and every header
// and Back button that has to clear the clock goes through it. The Plugin Gallery's top row, with its
// close button, sat under the clock and could not be tapped: there was no way out of the gallery.
// Run with: npx tsx --test tests/back-out.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const store = () => read("client/src/components/plugin-store/PluginStore.tsx");

/** A raw top inset that skips --sat (the To Duo app's clock space), with its own --sat fallback stripped first. */
const rawTop = (src: string) => src
  .replace(/var\(--sat,\s*env\(safe-area-inset-top,\s*0px\)\)/g, "")
  .match(/env\(safe-area-inset-top[^)]*\)/g) ?? [];

test("the Plugin Gallery's top row clears the clock in the iPhone app", () => {
  const s = store();
  assert.deepEqual(rawTop(s), [], "every top inset in the gallery goes through --sat");
  assert.match(s, /<header className="[^"]*pt-\[var\(--sat,env\(safe-area-inset-top,0px\)\)\]/);
});

test("the Plugin Gallery has a Back to the hub at the top left", () => {
  const s = store();
  assert.match(s, /aria-label=\{`Back to \$\{HUB_NAME\[hub\]\}`\}/);
  assert.match(s, /data-testid="plugin-store-close">\s*<ChevronLeft/);
  // The hub switch (teachers) sits on the right now, so Back is always the first thing in the row.
  assert.ok(s.indexOf('data-testid="plugin-store-close"') < s.indexOf('aria-label="Which hub"'));
  assert.match(s, /onClick=\{close\} aria-label=\{`Back to/);
});

test("Back, Escape and the iPhone edge swipe close the gallery's top layer, then the gallery", () => {
  const s = store();
  // One step in the browser's history while it's open: the browser's or Android's Back closes it, not the hub.
  assert.match(s, /window\.history\.pushState\(\{ \.\.\.\(window\.history\.state \?\? \{\}\), ariseStore: id \}, ""\)/);
  assert.match(s, /window\.addEventListener\("popstate", onPop\)/);
  // Closing with the button takes that step back off, so Back afterwards doesn't land on a dead step.
  assert.match(s, /const close = \(\) => \{ if \(ownStepOnTop\(\)\) inAppBack\(\); else onCloseRef\.current\(\); \};/);
  // A running app, then a detail, then a template, then the gallery itself.
  assert.match(s, /const goBack = \(\) => \{ if \(runningRef\.current\) setRunning\(null\); else if \(openIdRef\.current\) setOpenId\(null\); else if \(openTemplateIdRef\.current\) setOpenTemplateId\(null\); else close\(\); \};/);
  assert.match(s, /if \(e\.key !== "Escape"\) return; e\.stopPropagation\(\); goBackRef\.current\(\);/);
  // The iPhone app has no Back button: a swipe in from the left edge goes back.
  assert.match(s, /if \(!isNativeApp\(\)\) return;\s*let start/);
  assert.match(s, /t\.clientX < 28/);
});

test("the app taking its own step back off never signs a sample account out", () => {
  const auth = read("client/src/context/AuthContext.tsx");
  assert.match(auth, /const browserBack = \(\) => \{[\s\S]{0,200}if \(wasInAppBack\(\)\) return;/);
  assert.match(read("client/src/lib/useBackToStart.ts"), /if \(pushed\.current\) inAppBack\(\);/);
});

test("full-screen views the hubs open never put their Back or Close under the clock", () => {
  const files = [
    "client/src/components/plugin-store/PluginStore.tsx",
    "client/src/components/arise-notes/NotesApp.tsx",
    "client/src/components/arise-notes/PrivacyPage.tsx",
    "client/src/components/arise-notes/pages/InkToolbar.tsx",
    "client/src/components/arise-notes/pages/PageScreen.tsx",
    "client/src/components/arise-notes/pages/PagesView.tsx",
    "client/src/components/DailyBrief.tsx",
    "client/src/components/AccountPrivacy.tsx",
    "client/src/components/DuoSetup.tsx",
    "client/src/components/HubChat.tsx",
    "client/src/components/HubSearch.tsx",
    "client/src/components/AppWalkthrough.tsx",
    "client/src/components/PassLock.tsx",
    "client/src/components/lock/PrivacyLock.tsx",
    "client/src/components/notes/FullNoteEditor.tsx",
    "client/src/components/teacher-hub/HubModal.tsx",
    "client/src/components/teacher-hub/HubGoalQuiz.tsx",
    "client/src/components/family-hub/DriveApp.tsx",
    "client/src/components/family-hub/Browser.tsx",
    "client/src/components/family-hub/Accountability.tsx",
    "client/src/components/family-hub/PhoneMenu.tsx",
    "client/src/components/family-hub/earshot/EarshotCreators.tsx",
    "client/src/components/family-hub/earshot/EarshotExtras.tsx",
    "client/src/components/family-hub/earshot/EarshotPreviews.tsx",
    "client/src/components/family-hub/earshot/EarshotProfilePage.tsx",
    "client/src/components/family-hub/earshot/EarshotSocial.tsx",
    "client/src/components/family-hub/earshot/social/Composer.tsx",
    "client/src/components/family-hub/earshot/social/PostCard.tsx",
    "client/src/components/family-hub/earshot/social/Stories.tsx",
    "client/src/components/family-hub/sleep/sleep.css",
    "client/src/components/pro/bookstore/bookstore.css",
  ];
  for (const f of files) assert.deepEqual(rawTop(read(f)), [], `${f} uses the raw safe area at the top`);
  // The Podscroll player measures the raw value on purpose (its screen report): that one probe is the only raw use.
  assert.deepEqual(rawTop(read("client/src/components/family-hub/earshot/EarshotPlayer.tsx")), ["env(safe-area-inset-top)"]);
});

test("Arise Notes inside a hub: the top bar with Back clears the clock and the look's hero doesn't add it again", () => {
  const app = read("client/src/components/arise-notes/NotesApp.tsx");
  assert.match(app, /export function TopBar[\s\S]{0,400}pt-\[var\(--sat,env\(safe-area-inset-top,0px\)\)\]/);
  assert.match(app, /\$\{look && exit \? "an-under-bar" : ""\}/);
  assert.match(read("client/src/components/arise-notes/notes-themes.css"), /\.an-root \.an-under-bar \.an-l-hero \{ padding-top: 1rem !important; \}/);
});

test("the clock's space is this iPhone's own: 59-62px with a Dynamic Island, where 44px put the island over the bell", async () => {
  const { deviceTopInset } = await import("../client/src/lib/deviceInsets");
  assert.equal(deviceTopInset(402, 874), 62); // iPhone 16 Pro
  assert.equal(deviceTopInset(874, 402), 62); // turned sideways, same phone
  assert.equal(deviceTopInset(393, 852), 59); // iPhone 15
  assert.equal(deviceTopInset(390, 844), 47); // iPhone 13
  assert.equal(deviceTopInset(375, 667), 20); // iPhone SE
  assert.equal(deviceTopInset(410, 900), 62); // a tall phone that isn't on the list yet
  assert.equal(deviceTopInset(1024, 1366), null); // an iPad keeps the safe area it reports
  const main = read("client/src/main.tsx");
  // To Duo's page rests at 93% on a phone, so its clock space is measured at that scale (main.tsx).
  assert.match(main, /if \(isNativeApp\(\) && nativeFlavor\(\) === "todo"\) applyDeviceTopInset\(todoCompact \? TODO_SCALE : 1\);/);
  assert.match(main, /if \(isNotesApp\(\)\) applyDeviceTopInset\(\);/);
});

test("no look's top bar is shorter than its bell (the Desktop look's slim bar pushed the bell up under the clock)", () => {
  const bell = /\.los-topright \[data-testid="notification-bell"\] \{ width: [\d.]+rem; height: ([\d.]+)rem;/.exec(read("client/src/components/look-os/lookOS.css"))?.[1];
  assert.ok(bell, "the bell's height");
  const dir = "client/src/components/look-os/";
  for (const f of ["lookOS.css", "systems.css", "play.css", "premium.css", "suite.css", "toys.css"]) {
    for (const m of read(dir + f).matchAll(/\.los-topbar \{[^}]*?\bheight: ([\d.]+)rem/g)) {
      assert.ok(Number(m[1]) >= Number(bell), `${f}: a top bar of ${m[1]}rem holds a ${bell}rem bell`);
    }
  }
  assert.match(read(dir + "systems.css"), /\.los-desktop \.los-topbar \{ height: 2\.75rem;/);
});

test("the Arise Notes iPhone app keeps the clock's space like Arise To Duo", () => {
  assert.match(read("client/src/index.css"), /html\.notes-app \{ --sat: max\(env\(safe-area-inset-top, 0px\), var\(--sat-device, 44px\)\); \}/);
  assert.match(read("client/src/todo-app.css"), /html\.todo-edge \{ --sat: max\(env\(safe-area-inset-top, 0px\), var\(--sat-device, 44px\)\);/);
});

test("the Plugin Gallery keeps one design in every look (the body carries the look's classes for pop-ups)", () => {
  assert.match(store(), /import "\.\/pluginStore\.css";/);
  assert.match(store(), /data-plugin-store>/);
  const css = read("client/src/components/plugin-store/pluginStore.css");
  for (const rule of [
    /\.hub-look \[data-plugin-store\] input \{ background-color: var\(--s-raised\) !important; color: var\(--s-text\) !important;/,
    /\.hub-look \[data-plugin-store\] input::placeholder \{ color: var\(--s-faint\) !important;/,
    /\.hub-look \[data-plugin-store\] \.bg-white \{ background-color: #ffffff !important; \}/,
    /\.hub-look \[data-plugin-store\] h1, \.hub-look \[data-plugin-store\] h2, \.hub-look \[data-plugin-store\] h3 \{ font-family: inherit !important; \}/,
    /\.hub-look \[data-plugin-store\] \.rounded-2xl \{ border-radius: 1rem !important; \}/,
    /\.hub-look \[data-plugin-store\] \.rounded-xl:not\(\.border\)/,
  ]) assert.match(css, rule);
  // Every corner size the gallery uses is held, so no look squares off (or rounds off) part of it.
  for (const r of new Set(store().match(/(?<![:\w-])rounded-(?:xl|2xl|3xl|\[[\d.]+rem\])/g) ?? [])) {
    const cls = r.replace(/\[/g, "\\[").replace(/\]/g, "\\]").replace(/\./g, "\\.");
    assert.ok(css.includes(`.hub-look [data-plugin-store] .${cls} {`), `${r} is held in pluginStore.css`);
  }
});
