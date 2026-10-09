// Arise WorkHub (was Teacher Hub) and Arise LifeHub (was To-Do): names, the A.R.I.S.E. Reader tabs,
// and what stays once a trial ends.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HUB_GROUPS, groupTabs, visibleGroups } from "../shared/hubTabGroups";
import { emptyWorkspace } from "../shared/teacherHub";
import { FAMILY_SECTIONS, TOGGLEABLE } from "../shared/familyHub";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("WorkHub: the Reader group comes right after Home, its teacher tools always show, the admin console only for admins", () => {
  assert.equal(HUB_GROUPS[1].id, "arise");
  assert.equal(HUB_GROUPS[1].label, "A.R.I.S.E. Reader");
  const visible = emptyWorkspace().visibleTabs;
  assert.deepEqual(groupTabs("arise", { ...visible, admin: false }), ["reader", "arise"]);
  assert.deepEqual(groupTabs("arise", { ...visible, admin: true }), ["reader", "arise", "admin"]);
  assert.deepEqual(groupTabs("arise", { ...visible, reader: false, arise: false, admin: false }), ["reader"], "the Reader tools can't be hidden");
  assert.ok(visibleGroups({ ...visible, arise: false }).some((g) => g.id === "arise"));
});

test("LifeHub: a Reader tab (the parent portal) that can't be switched off", () => {
  assert.ok(FAMILY_SECTIONS.includes("reader"));
  assert.ok(!TOGGLEABLE.includes("reader"));
});

test("new names across the site, with the old addresses still working", () => {
  const app = read("client/src/App.tsx");
  for (const path of ["/workhub", "/lifehub", "/teacher-hub", "/to-do"]) assert.ok(app.includes(`<Route path="${path}">`), path);
  assert.match(app, /user\.role === 'teacher' \? <Redirect to="\/workhub"/);
  assert.match(app, /user\.role === 'parent' \? <Redirect to="\/lifehub"/);
  assert.match(app, /<Route path="\/teacher-dashboard">\s*<OpenHubTab to="\/workhub"/);
  const files = ["client/src/pages/TeacherHub.tsx", "client/src/pages/AriseTodo.tsx", "client/src/components/HubSwitch.tsx", "client/src/components/AddonsCard.tsx", "client/src/pages/Pricing.tsx", "client/src/pages/Billing.tsx"];
  for (const f of files) {
    const text = read(f);
    assert.ok(!/Teacher Hub|A\.R\.I\.S\.E\. To-Do|\bTo-Do\b/.test(text), `${f} still uses an old name`);
  }
});

test("after a trial: WorkHub and LifeHub keep only the A.R.I.S.E. Reader tools, and every tab notes a trial", () => {
  const hub = read("client/src/pages/TeacherHub.tsx");
  assert.match(hub, /if \(needsPlan\) return <ReaderOnly/);
  assert.match(hub, /<HubTrialNote trial=\{trial\} which="work"/);
  const gate = read("client/src/components/TodoGate.tsx");
  assert.match(gate, /<ParentDashboard embedded \/>/);
  const life = read("client/src/pages/AriseTodo.tsx");
  assert.match(life, /<HubTrialNote trial=\{trial\} which="life"/);
});
