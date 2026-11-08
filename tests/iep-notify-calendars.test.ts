// November 2026: Caseload and Minutes live inside the IEP tab; accountability pushes also reach the
// in-app bell; WorkHub's calendar switches stay off when turned off.
// Run with: npx tsx --test tests/iep-notify-calendars.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HUB_GROUPS, groupOf, groupLabel } from "../shared/hubTabGroups";
import { describeStoredType, ACCOUNTABILITY_BELL_TYPE } from "../shared/notifications";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the menu has one IEP item that holds Caseload and Minutes", () => {
  assert.equal(HUB_GROUPS.some((g) => g.id === ("minutes" as string) || g.id === ("caseload" as string)), false);
  assert.equal(groupOf("caseload").id, "iep");
  assert.equal(groupOf("minutes").id, "iep");
  assert.equal(groupLabel("iep", { iep: true, caseload: true, minutes: true }), "IEP");
});

test("an accountability alert shows in the bell and opens LifeHub's Accountability", () => {
  assert.equal(describeStoredType(ACCOUNTABILITY_BELL_TYPE)?.target?.type, "life:accountability");
  assert.match(read("server/routes.ts"), /ACCOUNTABILITY_BELL_TYPE/);
  assert.match(read("client/src/pages/TeacherHub.tsx"), /type\.startsWith\("life:"\)/);
});

test("the iPhone app asks for notifications whenever the app starts", () => {
  assert.match(read("client/src/lib/nativeReminders.ts"), /void startApplePush\(false\);/);
});

test("WorkHub remembers which calendars are switched off", () => {
  assert.match(read("shared/hubSwap.ts"), /hiddenCalendars/);
  assert.match(read("shared/hubHidden.ts"), /hiddenCalendars/);
});
