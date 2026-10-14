// Widgets: the catalog, saved widgets, and the time math behind the clocks, calendars and countdowns.
// Run with: npx tsx --test tests/widgets.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  WIDGET_DEFS, WIDGET_GROUPS, WIDGET_THEMES, binaryDigits, cleanWidgets, countdownTo, dayOfYear, daysBetween, handAngles, isoWeek, monthGrid,
  moonPhase, newWidget, nextBell, nextDate, parseBells, pickForDay, progressOf, seasonOf, timeIn, timeInWords, workdayState, MAX_WIDGETS,
} from "../shared/widgets";

const at = (h: number, m: number, s = 0) => new Date(2026, 9, 11, h, m, s);

test("the catalog: 34 widgets in five groups, all with real themes", () => {
  assert.equal(WIDGET_DEFS.length, 34);
  assert.equal(new Set(WIDGET_DEFS.map((d) => d.id)).size, 34);
  assert.equal(WIDGET_THEMES.length, 11);
  for (const g of WIDGET_GROUPS) assert.ok(WIDGET_DEFS.some((d) => d.group === g), g);
  for (const d of WIDGET_DEFS) assert.ok(WIDGET_THEMES.some((t) => t.id === d.theme), d.id);
  assert.ok(WIDGET_DEFS.some((d) => d.mood === "fun") && WIDGET_DEFS.some((d) => d.mood === "serious"));
});

test("saved widgets are cleaned: known types only, options kept only where they belong, capped", () => {
  const rows = cleanWidgets([
    { id: "a", type: "countdown", theme: "neon", size: "wide", label: "Trip", date: "2026-12-20", tz: "Europe/Paris" },
    { id: "b", type: "nope" },
    { id: "a", type: "analog" },
    { id: "c", type: "world3", theme: "bad", size: "huge", tzs: ["Asia/Tokyo", "Mars/Base", "Europe/London", "America/Denver", "Pacific/Auckland"] },
    { id: "d", type: "timer", minutes: 9999 },
    { id: "e", type: "workday", start: "25:00", end: "15:30" },
    { id: "f", type: "note", text: "x".repeat(500) },
  ]);
  assert.deepEqual(rows.map((r) => r.id), ["a", "c", "d", "e", "f"]);
  assert.deepEqual(rows[0], { id: "a", type: "countdown", theme: "neon", size: "wide", label: "Trip", date: "2026-12-20" });
  assert.deepEqual([rows[1].theme, rows[1].size, rows[1].tzs], ["classic", "wide", ["Asia/Tokyo", "Europe/London", "America/Denver"]]);
  assert.equal(rows[2].minutes, 600);
  assert.deepEqual([rows[3].start, rows[3].end], [undefined, "15:30"]);
  assert.equal(rows[4].text!.length, 280);
  assert.equal(cleanWidgets(Array.from({ length: 40 }, (_, i) => ({ id: `w${i}`, type: "dice" }))).length, MAX_WIDGETS);
  assert.deepEqual(cleanWidgets("nope"), []);
});

test("a new widget starts with sensible settings", () => {
  for (const d of WIDGET_DEFS) assert.ok(newWidget(d.id, `x-${d.id}`, "2026-10-11"), d.id);
  assert.deepEqual(newWidget("countdown", "x", "2026-10-11"), { id: "x", type: "countdown", theme: "arise", size: "small", label: "Summer break", date: "2027-06-01" });
  assert.equal(newWidget("nope", "x", "2026-10-11"), null);
  assert.equal(nextDate("2026-05-01", 6, 1), "2026-06-01");
});

test("clock hands and the time in words", () => {
  assert.deepEqual(handAngles(at(3, 0)), { hour: 90, minute: 0, second: 0 });
  assert.equal(handAngles(at(9, 30)).hour, 285);
  assert.equal(timeInWords(at(16, 15)), "It's quarter past four.");
  assert.equal(timeInWords(at(16, 43)), "It's quarter to five.");
  assert.equal(timeInWords(at(11, 58)), "It's noon.");
  assert.equal(timeInWords(at(23, 59)), "It's midnight.");
  assert.equal(timeInWords(at(7, 2)), "It's seven o'clock.");
  assert.equal(timeInWords(at(12, 35)), "It's twenty-five to one.");
});

test("the binary clock lights each digit's bits", () => {
  const d = binaryDigits(at(13, 7, 59));
  assert.deepEqual(d.map((bits) => bits.map((b) => (b ? 1 : 0)).join("")), ["0001", "0011", "0000", "0111", "0101", "1001"]);
});

test("world clock time and day or night", () => {
  const t = timeIn("Asia/Tokyo", new Date(Date.UTC(2026, 9, 11, 3, 5)));
  assert.equal(t.time, "12:05 PM");
  assert.equal(t.night, false);
  assert.equal(timeIn("Europe/London", new Date(Date.UTC(2026, 9, 11, 23, 0))).night, true);
});

test("calendar math: month grids, day of year, ISO weeks", () => {
  const oct = monthGrid(2026, 9);
  assert.deepEqual(oct[0], [null, null, null, null, 1, 2, 3]);
  assert.equal(oct.flat().filter(Boolean).length, 31);
  assert.equal(dayOfYear("2026-10-11"), 284);
  assert.equal(dayOfYear("2024-12-31"), 366);
  assert.deepEqual(["2026-10-11", "2027-01-01", "2026-01-01", "2024-12-30"].map(isoWeek), [41, 53, 1, 1]);
  assert.equal(daysBetween("2026-10-11", "2026-12-25"), 75);
});

test("progress through the day, week, month and year", () => {
  const p = progressOf(at(12, 0));
  assert.equal(p.day, 0.5);
  assert.ok(Math.abs(p.week - 6.5 / 7) < 1e-9, "Sunday noon is near the end of a Monday-first week");
  assert.ok(Math.abs(p.month - 10.5 / 31) < 1e-9);
  assert.ok(Math.abs(p.year - 283.5 / 365) < 1e-9);
});

test("work or school day progress", () => {
  assert.deepEqual(workdayState(at(7, 30), "08:00", "15:00"), { state: "before", frac: 0, left: 420, until: 30 });
  const mid = workdayState(at(11, 30), "08:00", "15:00");
  assert.equal(mid.state, "during");
  assert.equal(mid.frac, 0.5);
  assert.equal(mid.left, 210);
  assert.equal(workdayState(at(16, 0), "08:00", "15:00").state, "after");
  assert.equal(workdayState(at(9, 0), "15:00", "08:00").state, "off");
});

test("bells: school-style times and the next one", () => {
  assert.deepEqual(parseBells("8:00, 8:50 9:40, 12:10 1:05 2:30pm 7:15am 8:00"), [480, 530, 580, 730, 785, 870, 435].sort((a, b) => a - b));
  const n = nextBell(parseBells("8:00 8:50 9:40"), at(8, 41, 30))!;
  assert.deepEqual([n.label, n.minutes, n.index, n.total], ["8:50 AM", 9, 2, 3]);
  assert.equal(nextBell(parseBells("8:00"), at(9, 0)), null);
  assert.deepEqual(parseBells(""), []);
});

test("seasons", () => {
  assert.deepEqual(seasonOf("2026-10-11"), { name: "Fall", emoji: "🍂", next: "Winter", nextEmoji: "❄️", daysToNext: 71 });
  assert.equal(seasonOf("2026-01-15").name, "Winter");
  assert.equal(seasonOf("2026-01-15").next, "Spring");
  assert.equal(seasonOf("2026-12-25").name, "Winter");
  assert.equal(seasonOf("2026-12-25").next, "Spring");
  assert.equal(seasonOf("2026-07-04").name, "Summer");
});

test("moon phases match known new and full moons", () => {
  const eclipse = moonPhase(new Date(Date.UTC(2024, 3, 8, 18, 21)));
  assert.equal(eclipse.name, "New moon");
  assert.ok(eclipse.lit < 0.01);
  const full = moonPhase(new Date(Date.UTC(2024, 3, 23, 23, 49)));
  assert.equal(full.name, "Full moon");
  assert.ok(full.lit > 0.99);
  assert.equal(moonPhase(new Date(Date.UTC(2024, 3, 15, 19, 13))).name, "First quarter");
});

test("countdowns and steady daily picks", () => {
  const c = countdownTo("2026-12-25", at(9, 0))!;
  assert.deepEqual([c.past, c.days], [false, 75]);
  assert.equal(countdownTo("2026-10-11", at(9, 0))!.today, true);
  assert.deepEqual([countdownTo("2026-10-01", at(9, 0))!.past, countdownTo("2026-10-01", at(9, 0))!.days], [true, 10]);
  assert.equal(countdownTo("bad", at(9, 0)), null);
  assert.equal(pickForDay(["a", "b", "c", "d"], "2026-10-11"), pickForDay(["a", "b", "c", "d"], "2026-10-11"));
  const picks = new Set(Array.from({ length: 30 }, (_, i) => pickForDay(["a", "b", "c", "d", "e"], `2026-10-${String(i + 1).padStart(2, "0")}`)));
  assert.ok(picks.size >= 4, "different days give different picks");
});

// ── The Widgets plugin in the store and on Home ─────────────────────────────
import { PLUGINS, lifeInstalled, setLifePlugin, workInstalled, isAddable } from "../shared/pluginStore";
import { DEFAULT_LAYOUT, cleanLayout, homeShown, showSection } from "../shared/hubLayout";
import { cleanLifeLayout } from "../shared/lifeLayout";
import { cleanFamily, emptyFamily } from "../shared/familyHub";
import { readFileSync } from "node:fs";

test("a Widgets plugin in each hub, added like any other", () => {
  const work = PLUGINS.find((p) => p.id === "work-widgets")!, life = PLUGINS.find((p) => p.id === "life-widgets")!;
  assert.ok(work && life && isAddable(work) && isAddable(life));
  assert.equal(workInstalled(work, {}, [], false, false), false);
  assert.equal(workInstalled(work, {}, [], false, true), true);
  const fam = emptyFamily();
  assert.equal(lifeInstalled(life, fam), false);
  const on = setLifePlugin(fam, life, true);
  assert.equal(lifeInstalled(life, on), true);
  assert.equal(on.widgets.stickies, false, "sticky notes are left alone");
  assert.equal(lifeInstalled(life, setLifePlugin(on, life, false)), false);
});

test("Home has a Widgets part, hidden until the plugin is added", () => {
  assert.ok(DEFAULT_LAYOUT.homeHidden.includes("widgets"));
  assert.ok(!homeShown(cleanLayout(undefined)).includes("widgets"));
  // A layout saved before widgets existed: Widgets slots in after the greeting, hidden, then the
  // Quick counts (LifeHub's, added later) after it, shown; everything else as saved.
  const old = cleanLayout({ menuSide: "left", menuClose: "button", home: ["day", "picture", "agenda", "todo"], homeHidden: [], homeSize: { agenda: "small" } });
  assert.deepEqual(old.home.slice(0, 4), ["day", "widgets", "stats", "picture"]);
  assert.deepEqual(old.homeHidden, ["widgets"]);
  assert.equal(old.homeSize.agenda, "small");
  // Once someone has seen it and chosen to show it, it stays shown.
  const shown = cleanLayout(showSection(old, "widgets", true));
  assert.ok(homeShown(shown).includes("widgets"));
  const life = cleanLifeLayout({ menuSide: "top", menuClose: "button", home: ["greeting", "stats"], homeHidden: [], homeSize: {} });
  assert.deepEqual(life.home.slice(0, 2), ["greeting", "widgets"]);
  assert.deepEqual(life.homeHidden, ["widgets"]);
  assert.ok(!homeShown(cleanLifeLayout(undefined)).includes("widgets"));
});

test("LifeHub keeps the board's flag and widgets, cleaned", () => {
  const f = cleanFamily({ ...emptyFamily(), widgets: { stickies: true, board: true }, widgetBoard: [{ id: "a", type: "moon" }, { id: "b", type: "nope" }] });
  assert.equal(f.widgets.board, true);
  assert.deepEqual(f.widgetBoard, [{ id: "a", type: "moon", theme: "midnight", size: "small" }]);
  assert.equal(cleanFamily({ ...emptyFamily() }).widgetBoard, undefined, "no board until something is saved");
});

test("both hubs put the board on Home", () => {
  const work = readFileSync(new URL("../client/src/pages/TeacherHub.tsx", import.meta.url), "utf8");
  assert.match(work, /widgets: \(workspace as any\)\.widgetsOn \?/);
  assert.match(work, /<WidgetBoard /);
  const life = readFileSync(new URL("../client/src/components/family-hub/FamilyHome.tsx", import.meta.url), "utf8");
  assert.match(life, /widgets: family\.widgets\.board \? <WidgetBoard /);
});

test("adding the Widgets plugin in LifeHub shows the Widgets part of Home, removing it hides it", () => {
  const life = PLUGINS.find((p) => p.id === "life-widgets")!;
  const on = setLifePlugin(emptyFamily(), life, true);
  assert.ok(homeShown(cleanLifeLayout(on.layout)).includes("widgets"));
  const off = setLifePlugin(on, life, false);
  assert.ok(!homeShown(cleanLifeLayout(off.layout)).includes("widgets"));
});
