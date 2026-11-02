// Pod+ widgets: what each slot shows, and that the app, build and plugin are wired up.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyEarshot } from "../shared/earshot";
import { cleanSlots } from "../client/src/lib/widgets";
import { podWidgetSlots } from "../client/src/lib/podWidgets";

test("every Pod+ widget in widgets.json has a slot, and the slots are clean", () => {
  const ids = (JSON.parse(readFileSync("podscroll/ios-app/widgets.json", "utf8")) as string[][]).map((w) => w[0]);
  const es = emptyEarshot();
  es.saved = [{ id: "e1", showId: "s", title: "A long episode", show: "The Show", art: "", secs: 60, at: "" }];
  es.follows = [{ id: "s", name: "The Show", author: "", art: "", genre: "culture", at: "" }];
  const slots = podWidgetSlots(es, { title: "Ep 4", show: "The Show", playing: true }, { title: "Moon", playing: false });
  assert.deepEqual(slots.map((s) => s.id).sort(), [...ids].sort());
  assert.equal(cleanSlots(slots).length, slots.length);
  const by = (id: string) => slots.find((s) => s.id === id)!;
  assert.equal(by("pod.now").value, "Playing"); assert.match(by("pod.now").detail!, /Ep 4/);
  assert.equal(by("pod.later").value, "1"); assert.match(by("pod.later").detail!, /A long episode/);
  assert.equal(by("pod.shows").value, "1"); assert.equal(by("pod.wiki").value, "Paused");
  const idle = podWidgetSlots(emptyEarshot(), null, null);
  assert.equal(idle.find((s) => s.id === "pod.now")!.value, "Nothing yet"); assert.equal(idle.find((s) => s.id === "pod.wiki")!.value, "Listen");
});

test("Pod+ publishes its widgets and builds the extension with its own App Group", () => {
  assert.match(readFileSync("podscroll/main.tsx", "utf8"), /publishWidgets\(podWidgetSlots\(/);
  assert.match(readFileSync("podscroll/ios-app/package.json", "utf8"), /"arise-widgets": "file:\.\.\/\.\.\/native\/arise-widgets"/);
  const wf = readFileSync(".github/workflows/podplus-testflight.yml", "utf8");
  assert.match(wf, /APPLE_ID_AUTH PUSH_NOTIFICATIONS APP_GROUPS/); assert.match(wf, /group\.com\.arisereader\.podplus/); assert.match(wf, /add_widget\.rb ios\/App\/App\.xcodeproj com\.arisereader\.podplus/);
  assert.match(wf, /com\.arisereader\.podplus\.widgets/); assert.match(wf, /AriseWidgets\.appex/);
});
