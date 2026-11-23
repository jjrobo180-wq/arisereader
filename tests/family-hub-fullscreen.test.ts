// FamilyHub (a third hub beside WorkHub and LifeHub, shared by the family) and full screen in every hub.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CODE_LETTERS, canLeave, cleanFamilyCode, cleanFamilyName, makeFamilyCode } from "../shared/familySpace";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("family codes: 6 clear letters, typed any way", () => {
  const code = makeFamilyCode();
  assert.equal(code.length, 6);
  for (const ch of code) assert.ok(CODE_LETTERS.includes(ch));
  assert.equal(cleanFamilyCode(" abc-234 "), "ABC234");
  assert.equal(cleanFamilyCode("ABC23"), null);
  assert.equal(cleanFamilyCode("ABC0O1"), null, "0, O and 1 are never in a code");
  assert.equal(cleanFamilyName("  "), "Family");
  assert.equal(canLeave({ owner: true, memberCount: 2 }), false);
  assert.equal(canLeave({ owner: true, memberCount: 1 }), true);
  assert.equal(canLeave({ owner: false, memberCount: 5 }), true);
});

test("FamilyHub: its own route, the Family switch, its own shared copy, and no LifeHub reminders or plan count", () => {
  assert.match(read("client/src/components/HubSwitch.tsx"), /href="#\/familyhub"/);
  const app = read("client/src/App.tsx");
  assert.match(app, /<Route path="\/familyhub">/);
  assert.match(app, /<AriseTodo key="life" \/>/);
  const todo = read("client/src/pages/AriseTodo.tsx");
  assert.match(todo, /useTodoCloud<Data>\(\{ userId: user\?\.id, token: user \? token : null, blank: fresh, isValid: isValidTodo, space \}\)/);
  assert.match(todo, /if \(!user \|\| !isNativeApp\(\) \|\| familySpace\) return;/);
  assert.match(read("client/src/lib/useTodoCloud.ts"), /\/api\/family-space\/workspace/);
  const server = read("server/familySpace.ts");
  for (const route of ['"/api/family-space"', '"/api/family-space/join"', '"/api/family-space/leave"', '"/api/family-space/remove"', '"/api/family-space/workspace"']) assert.ok(server.includes(route), route);
  assert.match(server, /code: HUB_CONFLICT/);
  assert.match(read("server/routes.ts"), /registerFamilySpaceRoutes\(app, authMiddleware\);/);
});

test("full screen: in the ⋯ menu and the top bar; the hub's bars hide and an Exit button shows", () => {
  assert.match(read("client/src/components/HubMoreMenu.tsx"), /id: "fullscreen", label: "Full screen"/);
  assert.match(read("client/src/index.css"), /html\.duo-focus \[data-duo-chrome\] \{ display: none !important; \}/);
  for (const f of ["client/src/pages/AriseTodo.tsx", "client/src/pages/TeacherHub.tsx"]) {
    const s = read(f);
    assert.match(s, /<FocusExit \/>/, f);
    assert.ok((s.match(/data-duo-chrome=""/g) ?? []).length >= 4, f);
  }
});
