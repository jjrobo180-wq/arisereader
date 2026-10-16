import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { officeAppPlugin, pluginsFor, isAddable, setWorkSheetsApp, workInstalled } from "../shared/pluginStore";
import { countsAsApp } from "../shared/todoPlan";
import { emptyWorkspace } from "../shared/teacherHub";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("Class Goal Board is a WorkHub store app that opens its own page", () => {
  const p = officeAppPlugin("work", "work-class-goal")!;
  assert.ok(p, "listed in the WorkHub App Store");
  assert.equal(p.category, "Classroom");
  assert.ok(p.target.kind === "officeApp" && p.target.href === "#/class-goal");
  assert.ok(isAddable(p) && countsAsApp("work", p));
  assert.equal(pluginsFor("work", { teacher: true }).filter((x) => x.id === "work-class-goal").length, 1);
  assert.equal(pluginsFor("life", { teacher: true }).some((x) => x.id === "work-class-goal"), false, "not in LifeHub");
  const list = setWorkSheetsApp([], p, true);
  assert.equal(workInstalled(p, emptyWorkspace().visibleTabs, [], false, false, [], false, list), true);
  assert.deepEqual(setWorkSheetsApp(list, p, false), []);
});

test("the page is routed for adult accounts only, and the server routes are registered", () => {
  const app = read("client/src/App.tsx");
  assert.match(app, /const ClassGoalBoard = lazyPage\(\(\) => import\("\.\/pages\/ClassGoalBoard"\)\)/);
  assert.match(app, /<Route path="\/class-goal">\s*\{!user \? <Redirect to="\/signin" replace \/> : isHubAccount\(user\) \? <ClassGoalBoard \/> : <Redirect to="\/" replace \/>\}/);
  const routes = read("server/routes.ts");
  assert.match(routes, /import \{ registerClassGoalRoutes \} from "\.\/classGoals"/);
  assert.match(routes, /registerClassGoalRoutes\(app, authMiddleware,/);
  assert.match(routes, /readSetting: async \(key\) => \{\s*const \{ data, error \} = await supabase\.from\("settings"\)/, "reads straight from the database, never the cache");
  const server = read("server/classGoals.ts");
  assert.match(server, /app\.get\("\/api\/class-goals", auth,/);
  assert.match(server, /app\.post\("\/api\/class-goals\/ops", auth,/);
});

test("the store can draw its icon", () => {
  const store = read("client/src/components/plugin-store/PluginStore.tsx");
  assert.match(store, /Link2, Trophy, type LucideIcon/);
  assert.match(store, /Link2, Sun, Trophy,/);
});

test("the board never shows the teacher's controls without a hold, and keeps changes until saved", () => {
  const board = read("client/src/components/classGoal/BoardView.tsx");
  assert.match(board, /onPointerDown=/);
  assert.match(board, /window\.setTimeout\(\(\) => \{ setHolding\(false\); onOpen\(\); \}, 900\)/);
  const hook = read("client/src/components/classGoal/useClassGoals.ts");
  assert.match(hook, /localStorage\.setItem\(storeKey\(userId\)/);
  assert.match(hook, /document\.addEventListener\("visibilitychange", wake\)/);
  const css = read("client/src/pages/classGoal.css");
  assert.match(css, /prefers-reduced-motion: reduce/);
});
