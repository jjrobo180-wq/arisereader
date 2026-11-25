// WorkHub vacation mode (Nov 25, 2026): no WorkHub notifications while it's on, through the chosen day.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanHubNotify, defaultHubNotify, onVacation } from "../shared/hubNotify";
import { dueHubReminders } from "../shared/hubReminders";
import { emptyWorkspace } from "../shared/teacherHub";
import { emptyDaily } from "../shared/dailySettings";

test("vacation is off to start, kept when saved, and ends after its last day", () => {
  assert.deepEqual(defaultHubNotify().vacation, { on: false, until: "" });
  assert.deepEqual(cleanHubNotify({ vacation: { on: true, until: "2026-11-30" } }).vacation, { on: true, until: "2026-11-30" });
  assert.deepEqual(cleanHubNotify({ vacation: { on: true, until: "soon" } }).vacation, { on: true, until: "" });
  const n = cleanHubNotify({ vacation: { on: true, until: "2026-11-30" } });
  assert.ok(onVacation(n, "2026-11-25") && onVacation(n, "2026-11-30"));
  assert.ok(!onVacation(n, "2026-12-01"));
  assert.ok(onVacation(cleanHubNotify({ vacation: { on: true, until: "" } }), "2027-01-01"));
});

test("WorkHub sends nothing while on vacation, and picks up again after", () => {
  const ws = { ...emptyWorkspace(), daily: { ...emptyDaily(), custom: [{ id: "a", title: "Grade papers", time: "09:00", days: [0, 1, 2, 3, 4, 5, 6], by: "" }] } } as any;
  const at = Date.parse("2026-11-26T09:00:00Z");
  assert.ok(dueHubReminders(ws, at, "UTC").length > 0);
  const away = { ...ws, notify: { ...defaultHubNotify(), vacation: { on: true, until: "2026-11-30" } } };
  assert.equal(dueHubReminders(away, at, "UTC").length, 0);
  assert.ok(dueHubReminders(away, Date.parse("2026-12-01T09:00:00Z"), "UTC").length > 0);
});

test("anything else meant for WorkHub is held too, and the hub shows it's on vacation", () => {
  assert.match(readFileSync("server/pushNotifications.ts", "utf8"), /if \(space\?\.workspace && onVacation\(cleanHubNotify\(\(space\.workspace as any\)\.notify\), localParts\(Date\.now\(\), tz\)\.date\)\) return 0;/);
  assert.match(readFileSync("client/src/components/teacher-hub/HubNotifySettings.tsx", "utf8"), /<HubVacationCard workspace=\{workspace\} setWorkspace=\{setWorkspace\} \/>/);
  assert.match(readFileSync("client/src/pages/TeacherHub.tsx", "utf8"), /data-testid="hub-vacation-banner"/);
});
