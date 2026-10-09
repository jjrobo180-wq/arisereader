// Arise WorkHub (was Teacher Hub) and Arise LifeHub (was To-Do): names, the A.R.I.S.E. Reader tabs,
// and what stays once a trial ends.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HUB_GROUPS, groupTabs, visibleGroups } from "../shared/hubTabGroups";
import { emptyWorkspace } from "../shared/teacherHub";
import { FAMILY_SECTIONS, TOGGLEABLE } from "../shared/familyHub";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("WorkHub: the Reader group comes right after Home with its own WorkHub tabs; admin console only for admins", () => {
  assert.equal(HUB_GROUPS[1].id, "arise");
  assert.equal(HUB_GROUPS[1].label, "A.R.I.S.E. Reader");
  const reader = ["reader", "readerStudents", "readerApprovals", "readerParents", "readerQuizzes", "readerGames", "readerPrizes"];
  const visible = emptyWorkspace().visibleTabs;
  assert.deepEqual(groupTabs("arise", { ...visible, admin: false }), [...reader, "arise"]);
  assert.deepEqual(groupTabs("arise", { ...visible, admin: true }), [...reader, "arise", "admin"]);
  const hidden = Object.fromEntries(reader.map((t) => [t, false]));
  assert.deepEqual(groupTabs("arise", { ...visible, ...hidden, arise: false, admin: false }), reader, "the Reader tabs can't be hidden");
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
  assert.match(gate, /<Reader say=/);
  const life = read("client/src/pages/AriseTodo.tsx");
  assert.match(life, /<HubTrialNote trial=\{trial\} which="life"/);
});

test("the teacher's Reader account is rebuilt from WorkHub parts, with every old dashboard feature", () => {
  const tools = read("client/src/components/teacher-hub/HubReaderTools.tsx");
  assert.match(tools, /from "\.\/ui"/);
  assert.match(tools, /HubModal/);
  for (const api of ["/api/teacher/students", "/api/teacher/pending-students", "/api/teacher-admin/all-students", "/api/teacher-admin/pending-quizzes", "/api/teacher-admin/book-requests",
    "/api/grade-change-requests", "/api/teacher/parent-connections", "/api/teacher/club-arise/controls", "/api/teacher/club-closing-hours", "/api/proctor-password",
    "/api/teacher/growth-check/overview", "/reset-password", "/rewards", "/reassign"]) assert.ok(tools.includes(api), api);
  for (const piece of ["ComprehensionReview", "NoProctorReview", "PrizeManager", "PlayTimeManager", "FamilyEmailInvite", "ParentEmailInvite", "AddonsCard"]) assert.ok(tools.includes(`<${piece}`), piece);
  assert.doesNotMatch(read("client/src/pages/TeacherHub.tsx"), /<TeacherDashboard/);
  assert.match(read("client/src/pages/AriseTodo.tsx"), /<Reader say=\{setMessage\} night=\{night\} \/>/);
  const parent = read("client/src/components/family-hub/Reader.tsx");
  assert.match(parent, /from "\.\/ui"/);
  for (const api of ["/api/parent/students", "/api/parent/student-profile", "/api/parent/student-controls/", "/api/parent/link-code", "/api/parent/proctor-password", "/api/family/growth-check/student/"]) assert.ok(parent.includes(api), api);
  for (const piece of ["NoProctorReview", "PlayTimeManager", "PrizeManager", "PrizeBoard", "AddonsCard", "generateCertificate", "saveFamilySettings"]) assert.ok(parent.includes(piece), piece);
});
