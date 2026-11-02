// The Reader iPhone app's Home Screen widget snapshot (client/src/lib/readerWidget.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { widgetJson } from "../client/src/lib/readerWidget";

test("widget snapshot: first name, whole numbers, nothing else", () => {
  const s = JSON.parse(widgetJson({ name: "Ava Marie Jones", points: 240.6, quizzes: -2, band: "3-5" }, 5));
  assert.deepEqual(s, { name: "Ava", points: 241, quizzes: 0, band: "3-5", at: 5 });
  assert.deepEqual(JSON.parse(widgetJson(null, 7)), { signedOut: true, at: 7 }, "signing out clears it");
  assert.equal(JSON.parse(widgetJson({ name: "", points: 0, quizzes: 0, band: "" })).name, "Reader");
});

test("widget: the app and the widget share the same keychain item", () => {
  const swift = readFileSync("reader/ios-app/widgets/ReaderWidgets.swift", "utf8");
  const bridge = readFileSync(".github/scripts/reader_widgets.py", "utf8");
  for (const s of ['"com.arisereader.reader.widget"', '"snapshot"', '"6TYWWNKX6P.com.arisereader.reader.shared"']) {
    assert.ok(swift.includes(s) && bridge.includes(s), s);
  }
  assert.match(readFileSync("client/src/lib/readerWidget.ts", "utf8"), /"ReaderWidget", "save"/);
  assert.match(bridge, /jsName = "ReaderWidget"/);
});
