// The native Tasks screen in the iPhone app (November 2026): a SwiftUI screen over the web app, which stays the source of truth.
// Run with: npx tsx --test tests/native-tasks.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the payload carries only what the native screen shows", async () => {
  const { tasksPayload } = await import("../client/src/lib/nativeTasks");
  const out = tasksPayload({
    tasks: [
      { id: "a", title: "Milk", due: "2026-11-08", time: "09:00", done: false, priority: "high", listId: "l1", repeat: "weekly" },
      { id: "b", title: "Old", due: "", time: "", done: true, priority: "normal", listId: "", repeat: "none", archived: true },
      { id: "apple-1", title: "From Reminders", due: "", time: "", done: false, priority: "normal", listId: "", repeat: "none" },
    ],
    lists: [{ id: "l1", name: "Home" }],
  });
  assert.deepEqual(out.tasks, [{ id: "a", title: "Milk", due: "2026-11-08", time: "09:00", done: false, high: true, listId: "l1", repeats: true }]);
  assert.deepEqual(out.lists, [{ id: "l1", name: "Home" }]);
});

test("the plugin is in the To Duo app and its Swift is whole", () => {
  assert.equal(JSON.parse(read("arisetodo/ios-app/package.json")).dependencies["arise-native"], "file:../../native/arise-native");
  for (const f of ["AriseNativePlugin.swift", "TasksView.swift"]) {
    const src = read(`native/arise-native/ios/Sources/AriseNativePlugin/${f}`);
    for (const [o, c] of [["{", "}"], ["(", ")"], ["[", "]"]]) assert.equal(src.split(o).length, src.split(c).length, `${f}: ${o}${c} balanced`);
  }
  const plugin = read("native/arise-native/ios/Sources/AriseNativePlugin/AriseNativePlugin.swift");
  for (const m of ["openTasks", "updateTasks", "takeActions", "closeTasks"]) assert.match(plugin, new RegExp(`CAPPluginMethod\\(name: "${m}"`));
  assert.match(plugin, /jsName = "AriseNative"/);
});

test("the hub opens the native screen only when the plugin is there, and falls back to the web screen", () => {
  const hub = read("client/src/pages/AriseTodo.tsx");
  assert.match(hub, /shown !== "tasks" \|\| nativeTasksOpen\.current \|\| !nativeTasksAvailable\(\)/);
  assert.match(hub, /if \(!ok\) \{ nativeTasksOpen\.current = false; return; \}/);
  assert.match(hub, /a\.type === "closed"\) \{[^}]*goSection\("home"\)/);
  assert.match(read("client/src/lib/nativeTasks.ts"), /NATIVE_TASKS_ON && nativeFlavor\(\) === "todo" && hasNativePlugin\(PLUGIN\)/);
  assert.match(read("client/src/lib/nativeTasks.ts"), /export const NATIVE_TASKS_ON = false;/);
});
