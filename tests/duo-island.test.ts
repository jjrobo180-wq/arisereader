// Arise To Duo on the iPhone: checklist widgets you tap to check off, and the focus timer on the Lock Screen
// and in the Dynamic Island (a Live Activity). Swift is checked here by its text; the iOS builds compile it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyFamily } from "../shared/familyHub";
import { applyDuoWidgetTaps, duoWidgetSlots } from "../client/src/lib/duoWidgets";
import { cleanSlots } from "../client/src/lib/widgets";
import { readFocusLink, FOCUS_MINUTES } from "../client/src/lib/duoFocus";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const DAY = "2026-11-16";
let n = 0;
const makeId = () => `id${++n}`;

function familyWithChores() {
  const f = emptyFamily();
  f.sections.chores = true;
  f.chores = [
    { id: "dishes", title: "Dishes", memberId: "", rotation: [], days: [0, 1, 2, 3, 4, 5, 6], points: 2 },
    { id: "trash", title: "Take out trash", memberId: "", rotation: [], days: [0, 1, 2, 3, 4, 5, 6], points: 1 },
  ];
  return f;
}

test("the to-do and chore slots carry the items the checklist widgets show", () => {
  const tasks = [
    { id: "t1", title: "Call vet", due: DAY, time: "09:00", done: false },
    { id: "t2", title: "Pay rent", due: "2026-11-10", time: "", done: false },
    { id: "t3", title: "Later thing", due: "2026-12-01", time: "", done: false },
    { id: "t4", title: "Done thing", due: DAY, time: "", done: true },
  ];
  const s = Object.fromEntries(duoWidgetSlots(familyWithChores(), tasks, DAY, null).map((x) => [x.id, x]));
  assert.deepEqual(s["duo.todos"].items, [{ id: "t2", text: "Late · Pay rent" }, { id: "t1", text: "9:00 AM · Call vet" }]);
  const chores = s["duo.chores"].items!;
  assert.ok(chores.some((c) => c.id === "dishes" && c.text === "Dishes"), JSON.stringify(chores));
});

test("checklist items are cleaned before they go to the widget", () => {
  const [slot] = cleanSlots([{ id: "duo.todos", title: "To-dos", value: "3", items: [{ id: "ok-1", text: "x".repeat(90) }, { id: "bad id with spaces", text: "no" }, ...Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, text: "t" }))] }]);
  assert.equal(slot.items!.length, 12);
  assert.equal(slot.items![0].text.length, 60);
  assert.ok(!slot.items!.some((i) => i.id.includes(" ")));
});

test("a tap on a to-do circle checks it off once, and never reopens a finished one", () => {
  const tasks = [
    { id: "a", title: "A", due: DAY, time: "", done: false },
    { id: "b", title: "B", due: DAY, time: "", done: true },
  ];
  const taps = [
    { id: "duo.todos", action: "check", item: "a", amount: 0, at: 1 },
    { id: "duo.todos", action: "check", item: "a", amount: 0, at: 2 },
    { id: "duo.todos", action: "check", item: "b", amount: 0, at: 3 },
    { id: "duo.todos", action: "check", item: "gone", amount: 0, at: 4 },
    { id: "fit.water", action: "water-oz", amount: 8, at: 5 },
  ];
  assert.deepEqual(applyDuoWidgetTaps(taps, tasks, emptyFamily(), DAY, makeId).done, ["a"]);
});

test("a tap on a chore circle marks it done today, once", () => {
  const f = familyWithChores();
  const taps = [
    { id: "duo.chores", action: "check", item: "dishes", amount: 0, at: 1 },
    { id: "duo.chores", action: "check", item: "dishes", amount: 0, at: 2 },
  ];
  const { family } = applyDuoWidgetTaps(taps, [], f, DAY, makeId);
  assert.equal(family.choreDone.filter((d) => d.choreId === "dishes" && d.date === DAY).length, 1);
  assert.equal(family.choreDone.filter((d) => d.choreId === "trash").length, 0);
});

test("the focus timer's Done and Stop links are read right", () => {
  assert.deepEqual(readFocusLink("arisetodo://focus/done?id=abc-123"), { kind: "done", id: "abc-123" });
  assert.deepEqual(readFocusLink("arisetodo://focus/done?id=apple-AB%2FCD"), { kind: "done", id: "apple-AB/CD" });
  assert.deepEqual(readFocusLink("arisetodo://focus/stop"), { kind: "stop" });
  assert.deepEqual(readFocusLink("arisetodo://focus/open"), { kind: "open" });
  assert.deepEqual(readFocusLink("arisetodo://focus/done"), { kind: "stop" });
  assert.equal(readFocusLink("https://evil.example/focus/done?id=a"), null);
  assert.equal(readFocusLink("arisetodo://other"), null);
  assert.deepEqual([...FOCUS_MINUTES], [15, 25, 45, 60]);
});

test("the widget extension and the plugin describe the focus timer the same way (iOS matches them by name)", () => {
  const ext = read("native/widget-extension/AriseWidgets.swift");
  const plugin = read("native/arise-widgets/ios/Sources/AriseWidgetsPlugin/AriseWidgetsPlugin.swift");
  const shape = (src: string) => /struct DuoFocusAttributes: ActivityAttributes \{([\s\S]*?)\n\}/.exec(src)?.[1].replace(/\s+/g, " ").trim();
  assert.ok(shape(ext), "extension has the attributes");
  assert.equal(shape(plugin), shape(ext));
  for (const m of ["startFocus", "stopFocus", "focusState"]) assert.ok(plugin.includes(`CAPPluginMethod(name: "${m}"`), m);
  assert.match(plugin, /Activity\.request\(attributes: DuoFocusAttributes/);
  assert.match(plugin, /staleDate: end/);
  // The island: compact, minimal and expanded, with a self-ticking clock and Done/Stop links into the app.
  for (const w of ["compactLeading:", "compactTrailing:", "minimal:", "DynamicIslandExpandedRegion(.bottom)", "Text(timerInterval: range, countsDown: true)", "focusDoneLink(", "focusLink(\"stop\")", "context.isStale"]) assert.ok(ext.includes(w), w);
  // Each tap is left for the app ("pending") in the same shape takeActions hands to the web side.
  assert.match(ext, /pending\.append\(\["id": slot, "action": "check", "item": item/);
});

test("add_widget.rb builds .check widgets as checklists and .live as the Live Activity", () => {
  const rb = read(".github/scripts/add_widget.rb");
  assert.match(rb, /end_with\?\("\.check"\)/);
  assert.match(rb, /ChecklistWidget\(id: /);
  assert.match(rb, /end_with\?\("\.live"\)/);
  assert.match(rb, /FocusLiveActivity\(\)\.config/);
  const list: string[][] = JSON.parse(read("arisetodo/ios-app/widgets.json"));
  assert.deepEqual(list.filter((w) => /\.(check|live)$/.test(w[0])), [["duo.todos.check", "To-do checklist"], ["duo.chores.check", "Chore checklist"], ["duo.focus.live", "Focus timer"]]);
});

test("the To Duo app turns Live Activities on and answers arisetodo:// links", () => {
  const dir = mkdtempSync(join(tmpdir(), "duo-plist-"));
  const plist = join(dir, "Info.plist");
  writeFileSync(plist, `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleURLTypes</key><array><dict><key>CFBundleURLSchemes</key><array><string>other</string></array></dict></array></dict></plist>`);
  execFileSync("python3", [new URL("../arisetodo/ios-app/configure-ios.py", import.meta.url).pathname, plist]);
  execFileSync("python3", [new URL("../arisetodo/ios-app/configure-ios.py", import.meta.url).pathname, plist]);
  const out = readFileSync(plist, "utf8");
  assert.match(out, /<key>NSSupportsLiveActivities<\/key>\s*<true\/>/);
  assert.equal(out.match(/<string>arisetodo<\/string>/g)?.length, 1, "added once, even when run twice");
  assert.match(out, /<string>other<\/string>/, "keeps other link types");
});

test("the app applies widget taps and focus links, and offers the timer in the task editor", () => {
  const app = read("client/src/pages/AriseTodo.tsx");
  assert.match(app, /watchWidgetActions\(\(taps\) =>/);
  assert.match(app, /applyDuoWidgetTaps\(taps/);
  assert.match(app, /listenForFocusLinks\(/);
  assert.match(app, /if \(!task\.done && focus\?\.id === task\.id\) endFocus\(\)/, "checking the task off ends its timer");
  assert.match(app, /focusSupported\(\) && !editing\.done/);
  assert.match(app, /data-testid=\{`life-task-focus-\$\{m\}`\}/);
});

test("WorkHub's to-dos have the focus timer too, and its Done checks the to-do off", () => {
  const edit = read("client/src/components/teacher-hub/HubTaskEdit.tsx");
  assert.match(edit, /\{task && <TaskFocus task=\{task\} \/>\}/);
  const box = read("client/src/components/teacher-hub/HubTaskFocus.tsx");
  assert.match(box, /if \(task\.done\) return null;/);
  assert.match(box, /data-testid="work-task-focus-update"/);
  assert.match(box, /startFocus\(task, m\)/);
  const hub = read("client/src/pages/TeacherHub.tsx");
  assert.match(hub, /listenForFocusLinks\(\(link\) => \{/);
  assert.match(hub, /if \(t && !t\.done\) focusRef\.current\.checkTask\(t\);/);
});

test("Focus is a WorkHub plugin, and the Focus timer (both hubs) runs on the Dynamic Island", async () => {
  const { PLUGINS } = await import("../shared/pluginStore");
  const { HUB_GROUPS } = await import("../shared/hubTabGroups");
  const p = PLUGINS.find((x) => x.id === "work-focus");
  assert.ok(p && p.target.kind === "tab" && p.target.tab === "focus");
  assert.ok(HUB_GROUPS.some((g) => g.id === "focus" && g.tabs.includes("focus" as any)));
  const timer = read("client/src/components/family-hub/Focus.tsx");
  assert.match(timer, /startFocus\(\{ id: FOCUS_BLOCK_ID/);
  assert.match(timer, /if \(!running\) \{ void stopFocus\(\); return; \}/);
  assert.match(read("client/src/pages/TeacherHub.tsx"), /\{tab === "focus" && <FocusTimer /);
});
