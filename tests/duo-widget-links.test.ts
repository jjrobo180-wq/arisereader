// Arise To Duo's Home Screen widgets: a tap opens that widget's section, and a link on the Link page widget opens
// that link (in Safari), not just the app's home screen.
// Run with: npx tsx --test tests/duo-widget-links.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readDuoLink } from "../client/src/lib/duoLinks";
import { duoLink, duoOpen, duoWidgetSlots } from "../client/src/lib/duoWidgets";
import { cleanSlots, widgetLinkOk } from "../client/src/lib/widgets";
import { emptyFamily } from "../shared/familyHub";

test("widget links are read back to a section or a web address; anything else is ignored", () => {
  assert.deepEqual(readDuoLink(duoOpen("calendar")), { kind: "section", section: "calendar" });
  assert.deepEqual(readDuoLink(duoLink("https://docs.google.com/spreadsheets/d/1X/edit?gid=0#gid=0")), { kind: "web", url: "https://docs.google.com/spreadsheets/d/1X/edit?gid=0#gid=0" });
  assert.equal(readDuoLink(duoLink("javascript:alert(1)")), null);
  assert.equal(readDuoLink("arisetodo://open?s=../../x"), null);
  assert.equal(readDuoLink("arisetodo://focus/stop"), null, "focus links are the focus timer's");
  assert.equal(readDuoLink("https://example.com"), null);
});

test("slots keep a safe tap address and one per line", () => {
  const [s] = cleanSlots([{ id: "duo.linkpage", title: "My links", value: "JR", lines: ["Google", "Bad"], urls: [duoLink("https://google.com"), "javascript:alert(1)"], open: duoOpen("links") }]);
  assert.equal(s.open, "arisetodo://open?s=links");
  assert.deepEqual(s.urls, ["arisetodo://link?u=https%3A%2F%2Fgoogle.com", ""]);
  assert.equal(widgetLinkOk("data:text/html,x"), false);
  assert.deepEqual(cleanSlots([{ id: "x", title: "", value: "", open: "javascript:x" } as any])[0].open, undefined);
});

test("every To Duo widget opens its own section", () => {
  const f = emptyFamily();
  const slots = duoWidgetSlots(f, [], "2026-11-18", null);
  assert.ok(slots.length > 0);
  for (const s of slots) assert.match(s.open || "", /^arisetodo:\/\/open\?s=[a-z]+$/, s.id);
  const card = readFileSync(new URL("../client/src/components/family-hub/LinkPageCard.tsx", import.meta.url), "utf8");
  assert.ok(card.includes("urls: page.links.slice(0, 8).map((l) => (/^https?:\\/\\//i.test(l.url) ? duoLink(l.url) : duoOpen(\"links\")))"));
});

test("the widget extension uses the tap addresses, and the app listens for them", () => {
  const swift = readFileSync(new URL("../native/widget-extension/AriseWidgets.swift", import.meta.url), "utf8");
  assert.equal((swift.match(/\.widgetURL\(tapURL\(entry\.slot\)\)/g) || []).length, 4, "simple, detailed, link page and checklist widgets");
  assert.ok(swift.includes("if let url = lineURL(s, i) { Link(destination: url) { row } } else { row }"));
  assert.ok(swift.includes("var open: String?") && swift.includes("var urls: [String]?"));
  const app = readFileSync(new URL("../client/src/pages/AriseTodo.tsx", import.meta.url), "utf8");
  assert.ok(app.includes("listenForDuoLinks((section) => {"));
});
