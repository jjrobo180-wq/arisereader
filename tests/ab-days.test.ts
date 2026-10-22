import test from "node:test";
import assert from "node:assert/strict";
import { AB_DAYS, AB_NOTE, abLetterOn, abOnCalendar, addAbDays, removeAbDays, upcomingAb } from "../shared/abDays";

test("letters come from the sheet and nothing is guessed", () => {
  assert.equal(Object.keys(AB_DAYS).length, 164);
  assert.equal(abLetterOn("2026-08-13"), "A");
  assert.equal(abLetterOn("2026-08-14"), "B");
  assert.equal(abLetterOn("2026-08-15"), null); // a Saturday
  for (const d of Object.keys(AB_DAYS)) assert.ok(![0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay()), `${d} is a weekend`);
});

test("upcoming days skip days with no letter", () => {
  const next = upcomingAb("2026-08-14", 3);
  assert.deepEqual(next.map((n) => n.date), ["2026-08-14", "2026-08-17", "2026-08-18"]);
  assert.deepEqual(next.map((n) => n.letter), ["B", "A", "B"]);
  assert.deepEqual(upcomingAb("2030-01-01", 3), []);
});

test("adding puts one all-day event per lettered day, once, and removing leaves other events alone", () => {
  let n = 0;
  const mine = { id: "x", title: "Dentist", date: "2026-08-13", start: "15:00", end: "16:00", location: "", notes: "" };
  const ws = { events: [mine] };
  const a = addAbDays(ws, () => `id${n++}`);
  assert.equal(a.events.length, 1 + 164);
  assert.ok(abOnCalendar(a));
  const day = a.events.find((e) => e.date === "2026-08-13" && e.notes === AB_NOTE)!;
  assert.deepEqual([day.title, day.start, day.end], ["A Day", "", ""]);
  assert.equal(addAbDays(a, () => `id${n++}`), a); // twice does nothing
  const gone = removeAbDays(a);
  assert.deepEqual(gone.events, [mine]);
  assert.equal(removeAbDays(gone), gone);
});

test("from leaves out earlier days", () => {
  const a = addAbDays({ events: [] }, () => Math.random().toString(), "2027-05-01");
  assert.ok(a.events.every((e) => e.date >= "2027-05-01"));
  assert.ok(a.events.length > 0);
});

import fs from "node:fs";
import path from "node:path";
import { abWidgetScript } from "../shared/abWidgetScript";

const root = process.cwd();

test("the widget page and the json file carry the same days as the app", () => {
  const json = JSON.parse(fs.readFileSync(path.join(root, "client/public/ab-days.json"), "utf8"));
  assert.deepEqual(json, AB_DAYS);
  const html = fs.readFileSync(path.join(root, "client/public/ab-day.html"), "utf8");
  const m = html.match(/var DAYS = (\{.*?\});/);
  assert.ok(m);
  assert.deepEqual(JSON.parse(m![1]), AB_DAYS);
});

test("the iPhone widget script points at the site's json and is valid code", () => {
  const code = abWidgetScript("https://arisetodo.com/");
  assert.ok(code.includes('"https://arisetodo.com/ab-days.json"'));
  // Scriptable allows top-level await, so wrap it to check the syntax.
  new Function(`return (async () => {\n${code.replace(/^\/\/.*\n/, "")}\n})`);
});
