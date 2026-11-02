// The Arise To Duo iPhone app's setup page (notifications, iPhone Calendar, Apple Reminders) in the
// first run and from ⋯ → iPhone connections; Apple Reminders read on the phone; no Shortcut in the app.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("first run and ⋯ → iPhone connections show notifications, Calendar and Reminders", () => {
  const w = read("client/src/components/AppWalkthrough.tsx");
  for (const id of ["notify", "calendar", "reminders"]) assert.match(w, new RegExp(`id: "${id}", show:`));
  assert.match(w, /await turnOnNativeReminders\(hub\)/);
  assert.match(w, /await connectAppleReminders\(\)/);
  assert.match(w, /const n = await onConnectCalendar!\(\)/);
  assert.match(w, /window\.addEventListener\(IPHONE_SETUP_EVENT, setup\)/);
  assert.match(read("client/src/components/HubMoreMenu.tsx"), /isNativeApp\(\) \? \[\{ id: "iphone-setup", label: "iPhone connections"/);
  assert.match(read("client/src/pages/AriseTodo.tsx"), /onConnectCalendar=\{async \(\) => \{ const list = await readIphoneEvents\(\); setFamily\(\(f\) => withPhoneEvents\(f, list, makeId\)\)/);
  assert.match(read("client/src/pages/TeacherHub.tsx"), /onConnectCalendar=\{async \(\) => \{/);
});

test("Apple Reminders in the app: read on the phone, into LifeHub tasks, check-offs both ways", () => {
  const r = read("client/src/lib/nativeAppleReminders.ts");
  assert.match(r, /"requestFullRemindersAccess"/);
  assert.match(r, /"getRemindersFromLists", \{ listIds: ids \}/);
  assert.match(r, /"modifyReminder", \{ id: key, isCompleted: done/);
  const life = read("client/src/pages/AriseTodo.tsx");
  assert.match(life, /id: `apple-\$\{r\.key\}`/);
  assert.match(life, /!seen\.has\(r\.key\)/, "a deleted one isn't brought back");
  assert.match(life, /if \(task\.id\.startsWith\("apple-"\)\) void setAppleReminderDone/);
  assert.match(read("arisetodo/ios-app/configure-ios.py"), /"NSRemindersFullAccessUsageDescription"/);
});

test("no Shortcut in the iPhone app", () => {
  assert.match(read("client/src/pages/AriseTodo.tsx"), /\{!isNativeApp\(\) && <HeaderShortcut/);
  assert.match(read("client/src/pages/TeacherHub.tsx"), /\{!isNativeApp\(\) && <HeaderShortcut/);
  assert.match(read("client/src/components/teacher-hub/HubApple.tsx"), /if \(appleRemindersAvailable\(\)\) return <NativeRemindersCard \/>;/);
  assert.match(read("client/src/components/plugin-store/PluginStore.tsx"), /\(\(isNativeApp\(\) && open\.appSteps\) \|\| open\.steps\)/);
  assert.doesNotMatch(read("shared/pluginStore.ts").match(/appSteps: \[[^\]]*\]/g)!.join(" "), /Shortcut/);
});
