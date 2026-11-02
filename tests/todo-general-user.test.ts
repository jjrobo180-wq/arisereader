import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GALLERY_MERGES, pluginsFor } from "../shared/pluginStore";
import { emptyWorkspace, isTabOn } from "../shared/teacherHub";

const read = (p: string) => readFileSync(p, "utf8");

test("general Arise To Duo accounts: no Arise learning apps, teacher apps grouped under For teachers", () => {
  const life = pluginsFor("life", { teacher: false, arise: false });
  assert.ok(!life.some((p) => p.category === "Arise apps"));
  const parent = pluginsFor("life", { teacher: false, arise: true });
  assert.ok(parent.some((p) => p.category === "Arise apps"));
  const work = pluginsFor("work", { teacher: false, arise: false });
  assert.ok(!work.some((p) => ["Students & IEPs", "Classroom", "Teaching tools", "Arise apps"].includes(p.category)));
  assert.ok(work.some((p) => p.category === "For teachers" && p.name === "Caseload"));
  const teacher = pluginsFor("work", { teacher: true });
  assert.ok(teacher.some((p) => p.category === "Students & IEPs"));
  // WorkHub starts with Home, Calendar, Tasks, Notes and Goals; nothing about students or meetings.
  const v = emptyWorkspace().visibleTabs;
  for (const t of ["overview", "calendar", "tasks", "notes", "goals"] as const) assert.equal(isTabOn(t, v), true, t);
  for (const t of ["caseload", "iep", "minutes", "start"] as const) assert.equal(isTabOn(t, v), false, t);
  // Para Team isn't pre-installed: it's in the App Gallery.
  assert.ok(work.some((p) => p.id === "work-para-team") && life.some((p) => p.id === "life-para-team"));
  const hub = read("client/src/pages/TeacherHub.tsx");
  assert.match(hub, /\(user\.role === "teacher" \|\| !!user\.isAdmin\) && LEARNING_APPS\.filter/);
  assert.match(hub, /isTabOn\("caseload", visible, !!user\.isAdmin\)\s*\? tile\("Students"/);
});

test("one app for one job in the App Gallery", () => {
  for (const hub of ["life", "work"] as const) {
    const all = pluginsFor(hub, { teacher: true, arise: true });
    const names = new Set(all.map((p) => p.name));
    for (const m of GALLERY_MERGES) for (const d of m.drop) assert.ok(!names.has(d), `${hub}: ${d} is merged`);
    assert.ok(!names.has("Apple Health") && !names.has("Getting started"));
  }
  const life = pluginsFor("life", { teacher: false });
  assert.ok(life.some((p) => p.name === "Calorie counter" && /Apple Health/.test(p.tagline)));
  assert.ok(life.some((p) => p.name === "Medications") && life.some((p) => p.name === "Mood tracker"));
  assert.match(read("client/src/components/family-hub/Members.tsx"), /health: \{ label: "Calorie counter"/);
});

test("notifications: one switch for both hubs, three days ahead, shown while the app is open, taps open the screen", () => {
  const r = read("client/src/lib/nativeReminders.ts");
  assert.match(r, /const BOTH_KEY = "arise_native_reminders"/);
  assert.match(r, /const AHEAD_MS = 72 \* 3600_000/);
  assert.match(r, /localNotificationActionPerformed/);
  const cfg = JSON.parse(read("arisetodo/ios-app/capacitor.config.json"));
  assert.deepEqual(cfg.plugins.LocalNotifications.presentationOptions, ["badge", "sound", "alert"]);
  for (const page of ["client/src/pages/AriseTodo.tsx", "client/src/pages/TeacherHub.tsx"]) {
    const src = read(page);
    assert.match(src, /window\.addEventListener\(REMINDERS_CHANGED, again\)/);
    assert.match(src, /<HubMoreMenu testId="(life|hub)-more"/);
    assert.match(src, /const moreGroups = hubMoreGroups\(/);
    assert.match(src, /withSharedLook\(clean(Life)?Layout\(/);
    assert.match(src, /<SameBothHubs testId=/);
  }
  const more = read("client/src/components/HubMoreMenu.tsx");
  assert.match(more, /title: "Notifications"[\s\S]*title: "Settings"[\s\S]*title: "Help & account"/);
});

test("connections are Apple's, with a calendar link and email forwarding as the fallbacks", () => {
  const cal = read("client/src/components/teacher-hub/HubCalendar.tsx");
  assert.match(cal, /Connect iPhone Calendar/);
  assert.doesNotMatch(cal, /Upload a calendar file<\/GhostButton>/);
  const work = pluginsFor("work", { teacher: false });
  assert.ok(work.some((p) => p.id === "work-calendar-feeds" && p.name === "Calendars"));
  assert.ok(work.some((p) => p.id === "work-email-forwarding"));
});
