// The five class-records plugins (Behavior, Hall passes, Attendance, Gradebook, Student wall) are each their
// own WorkHub screen and Plugin Gallery app, and the family page has its own route.
// Run: npx tsx --test tests/class-records-plugins.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HUB_TABS, WORK_ADD_ON_TABS } from "../shared/teacherHub";
import { HUB_GROUPS, SUB_LABELS, groupOf } from "../shared/hubTabGroups";
import { PLUGINS } from "../shared/pluginStore";
import { RECORD_PLUGINS, defaultShare } from "../shared/classRecords";

const TABS = { behavior: "behavior", passes: "passes", attendance: "attendance", grades: "gradebook", wall: "wall" } as const;

test("each plugin is its own App Store screen with its own place in the menu", () => {
  for (const p of RECORD_PLUGINS) {
    const tab = TABS[p];
    assert.ok((HUB_TABS as readonly string[]).includes(tab), tab);
    assert.ok(WORK_ADD_ON_TABS.includes(tab), `${tab} is added from the App Store`);
    assert.deepEqual(groupOf(tab).tabs, [tab], `${tab} stands alone`);
    assert.ok(SUB_LABELS[tab], `${tab} has a label`);
  }
  assert.equal(HUB_GROUPS.find((g) => g.id === "passes")?.label, "Hall passes");
  assert.equal(HUB_GROUPS.find((g) => g.id === "wall")?.label, "Student wall");
});

test("each plugin has a Plugin Gallery app that opens its screen, with no emoji", () => {
  const ids = { behavior: "work-behavior", passes: "work-passes", attendance: "work-attendance", grades: "work-gradebook", wall: "work-wall" } as const;
  for (const p of RECORD_PLUGINS) {
    const app = PLUGINS.find((x) => x.id === ids[p]);
    assert.ok(app, ids[p]);
    assert.deepEqual(app!.target, { kind: "tab", tab: TABS[p] });
    for (const s of [app!.name, app!.tagline, app!.description, ...app!.features]) assert.doesNotMatch(s, /\p{Extended_Pictographic}/u, s);
  }
});

test("nothing is shared with families until the teacher turns it on", () => {
  const s = defaultShare();
  for (const p of RECORD_PLUGINS) assert.equal(s.parents[p], false, p);
});

test("the family page opens with no sign-in, and WorkHub shows each new plugin", () => {
  const app = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /<Route path="\/family">\s*<FamilyPortal \/>/);
  const hub = readFileSync(new URL("../client/src/pages/TeacherHub.tsx", import.meta.url), "utf8");
  for (const c of ["HubBehavior", "HubHallPasses", "HubClassAttendance", "HubClassGradebook", "HubStudentWall"]) assert.match(hub, new RegExp(`<${c}\\b`), c);
  const server = readFileSync(new URL("../server/classRecords.ts", import.meta.url), "utf8");
  assert.match(server, /url: "\/#\/workhub\?go=wall"/);
  assert.match(hub, /go === "wall"/);
});
