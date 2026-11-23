// The Arise To Duo iPhone app is built with To Duo alone inside (vite.todo.config.ts, App Review 2.5.19:
// no hidden or dormant features): other products' pages become stand-ins, the Undercover looks are dropped,
// other products' files are taken out, and the build fails if a forbidden word is left.
// Run with: npx tsx --test tests/todo-bundle.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-ignore: plain JavaScript, shared with vite.todo.config.ts
import { TODO_FORBIDDEN, TODO_STAND_IN, todoLeavesOut } from "../script/todoBundle.mjs";

const read = (p: string) => readFileSync(p, "utf8");

test("the To Duo build: its own config, one page, the stand-ins, and __TODO_APP__ on", () => {
  const cfg = read("vite.todo.config.ts");
  assert.match(cfg, /import base from "\.\/vite\.config";/);
  assert.match(cfg, /plugins: \[leaveOutOtherProducts\(\)\]/);
  assert.match(cfg, /define: \{ __TODO_APP__: "true" \}/);
  assert.match(cfg, /config\.build\.rollupOptions\.input = \{ main: path\.resolve\(ROOT, "client", "index\.html"\) \};/);
  assert.match(cfg, /const PREFIX = "\\0todo-left-out-";/, "stand-ins get plain names, so no file is named after a left-out page");
  assert.match(read("vite.config.ts"), /define: \{ __TODO_APP__: "false" \}/, "the website and the other apps keep everything");
  for (const wf of ["arisetodo-signed-release", "arisetodo-ios"]) {
    assert.match(read(`.github/workflows/${wf}.yml`), /npx vite build --config vite\.todo\.config\.ts\n\s+bash \.github\/scripts\/prune_todo_bundle\.sh dist\/public/, wf);
  }
  assert.match(read(".github/workflows/duo-tasks-check.yml"), /build: \[website, todo-app\]/, "the browser check runs on the app's build too");
  assert.match(TODO_STAND_IN, /export default function LeftOutOfToDuo/);
});

test("what's left out, and what To Duo keeps", () => {
  for (const f of ["client/src/undercover/UndercoverApp.tsx", "client/src/undercover/askUndercover.ts", "client/src/pages/talk/TalkApp.tsx",
    "client/src/pages/arise-kids/KidsApp.tsx", "client/src/pages/EyeGazeTalker.tsx", "client/src/pages/Library.tsx", "client/src/pages/FypPage.tsx",
    "client/src/pages/PaintballArena.tsx", "client/src/pages/TodoAdmin.tsx", "client/src/pages/reads/ReadHub.tsx", "client/src/components/AdvisoryChallenge.tsx"]) {
    assert.equal(todoLeavesOut(f), true, f);
  }
  for (const f of ["client/src/pages/AriseTodo.tsx", "client/src/pages/TeacherHub.tsx", "client/src/pages/FamilyHub.tsx", "client/src/pages/fit/FitApp.tsx",
    "client/src/components/arise-notes/NotesApp.tsx", "client/src/lib/askAi.ts", "client/src/pages/reads/useReads.ts",
    // WorkHub's Reader tools for teachers open these from inside WorkHub.
    "client/src/pages/LiveQuiz.tsx", "client/src/pages/TeacherScenes.tsx", "client/src/pages/StudentProfileView.tsx", "client/src/components/ClassTeachersPopup.tsx"]) {
    assert.equal(todoLeavesOut(f), false, f);
  }
  assert.equal(todoLeavesOut("/repo/client/src/undercover/main.tsx", "/repo"), true, "absolute paths too");
});

test("the Undercover looks and words are dropped from the app's build", () => {
  const T = '(typeof __TODO_APP__ !== "undefined" && __TODO_APP__)';
  assert.ok(read("client/src/pages/NativeSignIn.tsx").includes(`undercover: ${T} ? (undefined as never) : {`));
  assert.ok(read("client/src/components/arise-notes/notesAppsCatalog.tsx").includes(`...(${T} ? [] : [`));
  assert.ok(read("client/src/lib/aiConsent.ts").includes(`...(${T} ? [] : [/\\/api\\/undercover\\/chat$/]),`));
  assert.ok(read("client/src/lib/nativeApp.ts").includes(`undercover: ${T} ? (undefined as never) : {`));
  assert.match(read("client/src/buildFlags.d.ts"), /declare const __TODO_APP__: boolean \| undefined;/);
  for (const w of ["decoy chat", "Quick hide", "looks like texting", "CapacitorUpdater", "/api/ota/", "notifyAppReady"]) assert.ok(TODO_FORBIDDEN.includes(w), w);
});

test("Ask AI in Notes is a plain assistant: its own module and endpoint, open about being an AI", () => {
  const ask = read("client/src/lib/askAi.ts");
  assert.match(ask, /"\/api\/ask\/chat"/);
  for (const f of ["client/src/components/arise-notes/AskScreen.tsx", "client/src/components/arise-notes/pages/PageScreen.tsx", "client/src/components/arise-notes/NotesApp.tsx"]) {
    const s = read(f);
    assert.doesNotMatch(s, /@\/undercover\/|@shared\/undercover/, f);
    assert.match(s, /from "@\/lib\/askAi"/, f);
  }
  assert.match(read("client/src/components/arise-notes/AskScreen.tsx"), /const theme = plainAsk\(\) \? undefined :/);
  const server = read("server/undercover.ts");
  assert.match(server, /app\.post\("\/api\/ask\/chat", auth, chat\(true\)\);/);
  assert.match(server, /If asked, say you are an AI assistant\./);
  assert.doesNotMatch(server.slice(server.indexOf("PLAIN_ASK_PROMPT ="), server.indexOf("PLAIN_ASK_PROMPT =") + 400), /Never mention being an AI/);
  assert.match(read("client/src/lib/aiConsent.ts"), /\/\\\/api\\\/ask\\\/chat\$\//, "Ask AI asks permission first, like every AI feature");
});

test("the prune step takes other products' files out and fails on a forbidden word", () => {
  const dir = mkdtempSync(join(tmpdir(), "todo-bundle-"));
  const out = join(dir, "public");
  for (const d of ["eyegaze/wren", "eyegaze/pictures", "reads/book", "classics/x", "avatar", "assets"]) mkdirSync(join(out, d), { recursive: true });
  writeFileSync(join(out, "index.html"), "<!doctype html><title>Arise To Duo</title>");
  writeFileSync(join(out, "reader-landing.html"), "Arise Reader");
  writeFileSync(join(out, "prize-wheel.html"), "spin");
  writeFileSync(join(out, "eyegaze/pictures/apple.svg"), "<svg/>");
  writeFileSync(join(out, "assets/index.js"), "console.log('To Duo')");
  execFileSync("bash", [".github/scripts/prune_todo_bundle.sh", out]);
  for (const gone of ["eyegaze/wren", "reads", "classics", "avatar", "reader-landing.html", "prize-wheel.html"]) assert.equal(existsSync(join(out, gone)), false, gone);
  for (const kept of ["index.html", "eyegaze/pictures/apple.svg", "assets/index.js"]) assert.equal(existsSync(join(out, kept)), true, kept);
  writeFileSync(join(out, "assets/left.js"), "const t = 'One tap swaps to a decoy chat or hides answers.'");
  assert.throws(() => execFileSync("bash", [".github/scripts/prune_todo_bundle.sh", out], { stdio: "pipe" }), "a forbidden word fails the build");
});
