// iPhone widgets: what each one shows, and that every widget in the app's list has something to show.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyFit } from "../shared/fit";
import { emptyFamily } from "../shared/familyHub";
import { applyFitTaps, fitWidgetSlots } from "../client/src/lib/fitWidgets";
import { duoWidgetSlots } from "../client/src/lib/duoWidgets";
import { cleanSlots } from "../client/src/lib/widgets";

const list = (p: string): [string, string][] => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));

test("Fit: every widget in widgets.json has a slot, with short text", () => {
  const slots = fitWidgetSlots(emptyFit(), 80);
  const ids = list("../fit/ios-app/widgets.json").map((w) => w[0]);
  assert.deepEqual(slots.map((s) => s.id).sort(), [...ids].sort());
  for (const s of cleanSlots(slots)) assert.ok(s.title && s.value, s.id);
});

test("To Duo: the iPhone widgets are the 40 task designs (one board), the focus timer's Live Activity and Health & Fitness", () => {
  const all = list("../arisetodo/ios-app/widgets.json").map((w) => w[0]);
  assert.deepEqual(all, ["duo.tasks.designs", "duo.focus.live", "duo.fit.today"]);
  const page = readFileSync(new URL("../client/src/pages/AriseTodo.tsx", import.meta.url), "utf8");
  assert.ok(page.includes("publishDuoBoard(duoBoard("), "the app sends the board the designs draw");
});

test("To Duo: agenda, to-dos, bills and countdowns show what's coming", () => {
  const f = emptyFamily();
  f.sections.money = true;
  f.bills = [{ id: "b", name: "Rent", amount: 1200, dueDay: 5, category: "Home", autopay: false, paid: [] }];
  f.countdowns = [{ id: "c", title: "Trip", date: "2026-11-12", emoji: "x", color: "#fff" }];
  const s = Object.fromEntries(duoWidgetSlots(f, [{ id: "t", title: "Call vet", due: "2026-11-02", time: "09:00", done: false }, { id: "e", title: "Fwd: receipt", due: "", time: "", done: false, listName: "Email" }], "2026-11-02", null).map((x) => [x.id, x]));
  assert.equal(s["duo.todos"].value, "1");
  assert.equal(s["duo.email"].value, "1");
  assert.equal(s["duo.countdown"].value, "10 days");
  assert.match(s["duo.bills"].value, /1,200/);
});

test("a tap on the water widget adds water to the day it was tapped", () => {
  const d = applyFitTaps(emptyFit(), [{ id: "fit.water", action: "water-oz", amount: 8, at: Date.parse("2026-11-02T15:00:00") }, { id: "fit.water", action: "water-ml", amount: 250, at: Date.parse("2026-11-02T16:00:00") }, { id: "x", action: "other", amount: 1, at: 0 }]);
  assert.equal(d.water["2026-11-02"], Math.round(8 * 29.5735 + 250));
});

test("slot text is trimmed and bad data dropped", () => {
  const c = cleanSlots([{ id: "a b", title: "x", value: "y" }, { id: "ok", title: "T".repeat(80), value: "V".repeat(80), tint: "red", progress: 4, lines: Array(20).fill("l") }]);
  assert.equal(c.length, 1);
  assert.equal(c[0].title.length, 28); assert.equal(c[0].progress, 1); assert.equal(c[0].tint, undefined); assert.equal(c[0].lines?.length, 8);
});

test("the widget extension, plugin and workflows are in place", () => {
  const ext = readFileSync(new URL("../native/widget-extension/AriseWidgets.swift", import.meta.url), "utf8");
  for (const word of ["StaticConfiguration", "__WIDGETS__", "__BUNDLE__", "systemLarge", ".detail", "Image(systemName:", "GlowRing", "timerInterval", "contentTransition"]) assert.ok(ext.includes(word), word);
  // The checklists' circles are App Intent buttons; the intent stays out of Shortcuts and Siri.
  for (const word of ["struct CheckOffIntent: AppIntent", "static var isDiscoverable: Bool = false", "Button(intent: CheckOffIntent", "ActivityConfiguration(for: DuoFocusAttributes.self)"]) assert.ok(ext.includes(word), word);
  // Only plain StaticConfiguration gallery widgets: no configurable (intent) widgets.
  assert.ok(!ext.includes("AppIntentConfiguration") && !ext.includes("WidgetConfigurationIntent"));
  // An interpolated display name ("\\(name) +") made the extension crash on load (seen on the iOS simulator), so iOS listed none.
  assert.ok(!/configurationDisplayName\("[^"]*\\\(/.test(ext), "no interpolated configurationDisplayName");
  assert.ok(readFileSync(new URL("../native/arise-widgets/ios/Sources/AriseWidgetsPlugin/AriseWidgetsPlugin.swift", import.meta.url), "utf8").includes("takeActions"));
});
