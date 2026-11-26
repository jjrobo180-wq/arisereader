import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("App Review 5.6: To Do has no live updates and Ask is a plain AI chat in the iPhone apps", () => {
  assert.doesNotMatch(readFileSync("arisetodo/ios-app/package.json", "utf8"), /capacitor-updater/);
  assert.doesNotMatch(readFileSync(".github/workflows/arisetodo-signed-release.yml", "utf8"), /ota_setup\.py todo/);
  assert.throws(() => readFileSync(".github/workflows/ota-publish.yml", "utf8"), "no live updates for any app");
  const native = readFileSync("client/src/lib/nativeApp.ts", "utf8");
  assert.match(native, /export const plainAsk = \(\): boolean => isNativeApp\(\) && nativeFlavor\(\) !== "undercover";/);
  const notes = readFileSync("client/src/components/arise-notes/NotesApp.tsx", "utf8");
  assert.match(notes, /case "ask": case "undercover": return plainAsk\(\) \? <AskScreen ctx=\{ctx\} \/>/);
  const ask = readFileSync("client/src/components/arise-notes/AskScreen.tsx", "utf8");
  assert.match(ask, /const look: Look = plainAsk\(\) \? "chat" : view\.look;/);
  assert.match(ask, /\{!plainAsk\(\) && <Toggle label="Look"/);
  assert.match(readFileSync("client/src/components/arise-notes/notesAppsCatalog.tsx", "utf8"), /plainAsk\(\) \? ALL_NOTES_APPS\.filter\(\(a\) => a\.id !== "undercover"\)/);
});

test("App Review 5.6: the To Do app opens only To Do's own pages", async () => {
  const { todoNativeAllows } = await import("../shared/todoNativeRoutes.ts");
  for (const p of ["/", "/lifehub", "/familyhub?go=x", "/workhub", "/arise-notes", "/fit", "/signin", "/plans/abc", "/pro"]) assert.ok(todoNativeAllows(p), p);
  for (const p of ["/admin", "/games", "/paintball-arena", "/eye-gaze-home", "/fyp", "/rewards", "/quiz/5", "/leaderboard", "/reader", "/todo-admin"]) assert.ok(!todoNativeAllows(p), p);
  const app = readFileSync("client/src/App.tsx", "utf8");
  assert.match(app, /isNativeApp\(\) && nativeFlavor\(\) === "todo" && !todoNativeAllows\(routePath\)/);
});

test("App Review: no TestFlight wording, no locale-guessed purchase link, no update button without an updater", () => {
  for (const f of ["client/src/components/teacher-hub/HubTaskFocus.tsx", "client/src/components/family-hub/Focus.tsx", "client/src/lib/duoFocus.ts", "client/src/lib/nativeHealth.ts", "client/src/pages/fit/fitNative.ts"])
    assert.doesNotMatch(readFileSync(f, "utf8"), /TestFlight\b(?![^\n]*\/\/)/, f);
  assert.match(readFileSync("client/src/components/AllAccessOffer.tsx", "utf8"), /useState\(\(\) => \(apple \|\| isNativeApp\(\) \? false : usRegion\(\)\)\)/);
  assert.doesNotMatch(readFileSync("client/src/components/arise-notes/SettingsScreen.tsx", "utf8"), /Check for updates/);
});

test("No more All Access: the one paid plan is Arise To Do Unlimited", () => {
  const s = readFileSync("shared/allAccess.ts", "utf8");
  assert.match(s, /name: "Arise To Do Unlimited"/);
  for (const f of ["client/src/components/AllAccessOffer.tsx", "client/src/components/hub-pieces/TodoPlan.tsx", "client/src/pages/AriseTodo.tsx", "client/src/pages/AllAccess.tsx", "server/aiMinutes.ts"])
    assert.doesNotMatch(readFileSync(f, "utf8").replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, ""), /"[^"\n]*All Access[^"\n]*"/, f);
});

test("App Review: one paid plan, no ad stripping or trainer online-coaching payments in the iPhone app, honest permission sentences", () => {
  const plans = readFileSync("server/plans.ts", "utf8");
  // A To Do Unlimited from before (monthly, yearly or an Admin trial) unlocks exactly what the subscription does.
  assert.match(plans, /for \(const kind of \["todo_unlimited", "todo_unlimited_year"\] as PlanKind\[\]\) \{\n\s+const g = await current\(kind, userId\);\n\s+if \(grantLive\(g, now\(\)\)\) return \{ live: true, admin: false, grant: g \};/);
  assert.doesNotMatch(plans, /Every Arise app's paid tier/);
  const offer = readFileSync("client/src/components/AllAccessOffer.tsx", "utf8");
  assert.match(offer, />Everything in Arise To Do\. Signing up is free\.</);
  assert.doesNotMatch(offer, /every Arise app/i);
  assert.match(offer, /ALL_ACCESS\.perks\.filter\(\(p\) => !\(isNativeApp\(\) && p\.app === "Arise Podcasts"\)\)/);
  // Podster plays episodes as published in the iPhone app: no ad skipping, no ad-free copies, nothing selling it.
  const pod = readFileSync("client/src/components/super-apps/PodsterInDuo.tsx", "utf8");
  assert.match(pod, /const adFreeHere = paid && !isNativeApp\(\);\n\s+useEffect\(\(\) => \{ setCleanEnabled\(adFreeHere\); \}, \[adFreeHere\]\);\n\s+const adMode = adFreeHere \?/);
  assert.match(readFileSync("client/src/components/family-hub/earshot/EarshotListen.tsx", "utf8"), /if \(isNativeApp\(\)\) return null;\n\s+if \(notMember\) return <CouldSaveCard/);
  // Paying a trainer in the iPhone app: real-time one-to-one only (3.1.3(d)).
  const pay = readFileSync("client/src/pages/coach/Pay.tsx", "utf8");
  assert.match(pay, /const prices = native \? data\.prices\.filter\(\(p\) => p\.mode === "inPerson" \|\| p\.mode === "virtual"\) : data\.prices;/);
  assert.match(pay, /const payUrl = native \? "" : data\.payUrl;/);
  // Permission sentences say what the app really does.
  const plist = readFileSync("arisetodo/ios-app/configure-ios.py", "utf8");
  assert.match(plist, /only while you use it: in the plugins that need it, like weather and mileage/);
  assert.doesNotMatch(plist, /apps in the App Store|speaking practice/);
  // The admin console isn't in the iPhone app.
  const work = readFileSync("client/src/pages/TeacherHub.tsx", "utf8");
  assert.match(work, /extra: user\.isAdmin && !isNativeApp\(\) \?/);
  assert.match(work, /\{user\.isAdmin && !isNativeApp\(\) && <a href="#\/todo-admin"/);
  const rules = readFileSync("CLAUDE.md", "utf8");
  assert.match(rules, /\*\*No live updates\.\*\*/);
  assert.match(rules, /\*\*To Do alone in the To Do app\.\*\*/);
});

test("no Browser plugin: not in the Plugin Gallery, the hubs, split screen or the team apps, and its screen is gone", async () => {
  const { PLUGINS } = await import("../shared/pluginStore");
  assert.ok(!PLUGINS.some((p: any) => p.id === "life-browser" || p.name === "Browser"), "not in the Plugin Gallery");
  const { FAMILY_SECTIONS, cleanFamily, emptyFamily } = await import("../shared/familyHub");
  assert.ok(!(FAMILY_SECTIONS as readonly string[]).includes("browser"));
  // Someone who had added it: it simply drops off their menu.
  const had: any = { ...emptyFamily(), sections: { ...emptyFamily().sections, browser: true }, sectionOrder: ["browser", "health"] };
  const clean: any = cleanFamily(had);
  assert.equal(clean.sections.browser, undefined);
  assert.ok(!clean.sectionOrder.includes("browser"));
  for (const f of ["client/src/pages/AriseTodo.tsx", "client/src/components/para-team/TeamApps.tsx", "client/src/lib/duoSplit.ts"]) {
    assert.doesNotMatch(readFileSync(f, "utf8"), /family-hub\/Browser|"browser"/, f);
  }
  assert.throws(() => readFileSync("client/src/components/family-hub/Browser.tsx", "utf8"), "the screen itself is gone");
  // App Store: no unrestricted web access to declare.
  const asc = readFileSync(".github/scripts/todo_review_fix.py", "utf8");
  assert.match(asc, /AGE_YES = \{"userGeneratedContent", "messagingAndChat", "healthOrWellnessTopics"\}/);
  assert.match(asc, /There is no web browser in the app\./);
});
