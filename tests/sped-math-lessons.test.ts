import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LESSONS, UNIT1, EXTRA_LESSONS, answerCounts, lessonByNumber, lessonItems } from "../shared/spedMathLessons";
import { areaFactor, CM_PER_INCH, fmt, INCHES_PER_MILE, scaleFactorOf, toActual, toDrawing, unitlessScale, UNIT } from "../shared/spedMathUnit";
import { officeAppPlugin, isAddable, pluginsFor } from "../shared/pluginStore";
import { countsAsApp } from "../shared/todoPlan";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const all = LESSONS.flatMap(lessonItems);
const byId = (id: string) => { const it = all.find((i) => i.id === id); assert.ok(it, `item ${id} exists`); return it!; };
const has = (id: string, ...needles: string[]) => { const t = byId(id).a; for (const n of needles) assert.ok(t.includes(n), `${id} should contain "${n}", got: ${t}`); };

test("all 13 Unit 1 lessons, in order, then the extra lessons, each with the parts a teacher needs", () => {
  assert.deepEqual(UNIT1.map((l) => l.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.deepEqual(EXTRA_LESSONS.map((l) => l.n), [14]);
  assert.deepEqual(LESSONS.map((l) => l.n), [...UNIT1, ...EXTRA_LESSONS].map((l) => l.n));
  for (const l of EXTRA_LESSONS) assert.ok(l.extra && l.extra.chip && l.extra.teacherUrl.startsWith("https://im.kendallhunt.com/MS/teachers/") && l.extra.source.includes("CC BY 4.0"), `lesson ${l.n} names its source`);
  for (const l of LESSONS) {
    assert.ok(l.title && l.section && l.bigIdea, `lesson ${l.n} has a title, section and big idea`);
    assert.ok(l.primer.length >= 3, `lesson ${l.n} has a plain-English primer`);
    assert.ok(l.targets.length >= 1 && l.vocab.length >= 2 && l.materials.length >= 1, `lesson ${l.n} lists targets, words, materials`);
    assert.ok(l.activities.length >= 1 && l.mistakes.length >= 2 && l.summary.length >= 1, `lesson ${l.n} has activities, mistakes, summary`);
    for (const k of ["simplified", "modified", "extension"] as const) assert.ok(l.supports[k].length >= 2, `lesson ${l.n} has ${k} supports`);
    assert.ok(lessonByNumber(l.n) === l);
    for (const a of l.activities) {
      assert.ok(a.steps.length >= 2 && a.items.length >= 1 && a.minutes > 0, `${a.id} has steps, answers and minutes`);
      assert.ok(a.id.startsWith(l.extra?.idPrefix ?? `${l.n}.`), `${a.id} belongs to lesson ${l.n}`);
      for (const it of a.items) assert.ok(it.id.startsWith(a.id), `${it.id} belongs to ${a.id}`);
    }
  }
});

test("every answer has a real answer, a flag, and a unique id", () => {
  const ids = new Set<string>();
  for (const i of all) {
    assert.ok(i.q.trim() && i.a.trim(), `${i.id} has a question and an answer`);
    assert.ok(i.check === "ok" || i.check === "figure", `${i.id} is flagged`);
    assert.ok(!ids.has(i.id), `${i.id} is unique`); ids.add(i.id);
  }
  const c = answerCounts();
  assert.equal(c.ok + c.figure, c.total);
  assert.equal(c.total, all.length);
  assert.ok(c.ok > 100, "most answers are recomputed");
  // Anything that depends on a picture or card set must say how to check it.
  for (const i of all.filter((x) => x.check === "figure")) assert.ok(i.a.length > 40, `${i.id} explains the method`);
});

test("no answer is a guess: every figure-dependent one is flagged and none pretends to be checked", () => {
  for (const id of ["1.1a", "1.3a", "2.2d", "2.3g", "3.2a", "4.2a", "4.3b", "5.2a", "7.2b", "7.3a", "8.2b", "10.1a", "10.3e", "11.2c", "12.2c", "12.4b", "13.3b"]) assert.equal(byId(id).check, "figure", id);
});

// ── Recompute the numbers from the numbers written in the tasks ─────────────────────────────────
test("Lesson 1: the F drawings (original stem 4, top 2, bottom 1)", () => {
  const F = [4, 2, 1];
  assert.equal(scaleFactorOf(F, [6, 3, 1.5]), 1.5);
  assert.equal(scaleFactorOf(F, [8, 4, 2]), 2);
  assert.equal(scaleFactorOf(F, [4, 4, 3]), null);
  assert.equal(scaleFactorOf(F, [6, 3, 2]), null);
  assert.equal(scaleFactorOf(F, [12, 6, 3]), 3);
  assert.equal(scaleFactorOf(F, [2, 1, 1]), null);
  has("1.2a", "1½"); has("1.2b", "2 times"); has("1.2c", "No"); has("1.2d", "No"); has("1.2e", "3 times");
  assert.equal(scaleFactorOf([2, 3], [4, 9]), null); has("1.x", "No");
});

test("Lesson 2: number talk, the sign copies and the triangles", () => {
  assert.equal(32 / 4, 8); assert.ok(Math.abs(7.2 / 9 - 0.8) < 1e-12); assert.ok(Math.abs(5.6 / 4 - 1.4) < 1e-12);
  has("2.1a", "8"); has("2.1b", "0.8"); has("2.1c", "1.4");
  assert.equal(scaleFactorOf([18, 18], [14, 14]), 14 / 18); assert.ok(Math.abs(14 / 18 - 7 / 9) < 1e-12);
  assert.equal(scaleFactorOf([18, 18], [17, 26]), null);
  has("2.2a", "7/9"); has("2.2b", "No");
  const O = [3, 4, 5];
  assert.equal(scaleFactorOf(O, [6, 8, 10]), 2);
  assert.equal(scaleFactorOf(O, [1.5, 2, 2.5]), 0.5);
  assert.equal(scaleFactorOf(O, [3, 4, 5]), 1);
  assert.ok(Math.abs((scaleFactorOf(O, [2, 8 / 3, 10 / 3]) ?? 0) - 2 / 3) < 1e-12);
  assert.equal(scaleFactorOf(O, [6, 7, 8]), null);
  assert.equal(scaleFactorOf(O, [2, 5, 5.39].sort((a, b) => a - b)), null);
  assert.equal(scaleFactorOf(O, [2, 2, 2.38]), null);
  has("2.3a", "factor 2"); has("2.3b", "½"); has("2.3c", "1"); has("2.3d", "2/3"); has("2.3e", "Not a scaled copy");
  assert.equal(scaleFactorOf(O, [6, 8, 10]), 2); // the extension: (6, 7, 8) becomes (6, 8, 10) by changing 7 and 8
  assert.equal(scaleFactorOf([4, 6, 8], [6, 9, 12]), 1.5); has("2.x", "1½");
});

test("Lesson 3: Diego subtracted 10, Jada divided by 3, Andre doubles", () => {
  // Original: 30 high, 36 long, with a 12 by 15 corner removed from the bottom right. Going round: 36, 18, 15, 12, 21, 30.
  const original = [36, 30 - 12, 15, 12, 36 - 15, 30];
  assert.deepEqual(original, [36, 18, 15, 12, 21, 30]);
  assert.deepEqual(original.map((x) => x - 10), [26, 8, 5, 2, 11, 20], "Diego's sides are the originals minus 10");
  assert.deepEqual(original.map((x) => x / 3), [12, 6, 5, 4, 7, 10], "Jada's sides are the originals divided by 3");
  assert.equal(scaleFactorOf(original, original.map((x) => x - 10)), null);
  assert.equal(scaleFactorOf(original, original.map((x) => x / 3)), 1 / 3);
  has("3.3a", "subtracted 10"); has("3.3b", "divided every side by 3");
  const jada = [12, 6, 5, 4, 7, 10];
  assert.deepEqual(jada.map((x) => x * 2), [24, 12, 10, 8, 14, 20]); has("3.4b", "24, 12, 10, 8, 14, 20");
  assert.equal(scaleFactorOf(jada, jada.map((x) => x + 4)), null);
  assert.equal(8 / 4, 2);
  // Adding 5 to every side of a triangle only keeps it a copy when all sides are equal.
  assert.notEqual(scaleFactorOf([3, 4, 5], [8, 9, 10]), 1); assert.equal(scaleFactorOf([3, 4, 5], [8, 9, 10]), null);
  assert.equal(scaleFactorOf([4, 4, 4], [9, 9, 9]), 2.25);
  assert.ok(25 * 8.5 > 205); assert.ok(9.93 * 0.984 < 10); assert.ok(0.24 * 0.67 < 0.2);
  has("3.1a", "More"); has("3.1b", "Less"); has("3.1c", "Less"); has("3.1a", "212.5");
  assert.deepEqual([4, 6].map((x) => x * 3), [12, 18]); assert.ok(Math.abs(6 / 4 - 8 / 6) > 0.1); has("3.x", "12 by 18");
});

test("Lesson 4: the two W figures and the trapezoids", () => {
  const k = 15 / 6; assert.equal(k, 2.5);
  assert.equal(4 * k, 10); assert.equal(5 / k, 2);
  has("4.2b", "2.5"); has("4.2c", "10"); has("4.2d", "2");
  assert.equal(scaleFactorOf([2, 6, 4], [1, 4, 3]), null);
  assert.deepEqual([1 / 2, 4 / 6, 3 / 4].map((x) => Number(x.toFixed(2))), [0.5, 0.67, 0.75]);
  has("4.3a", "Lin", "0.67", "0.75");
  assert.equal(5 * 3, 15); has("4.x", "15 cm", "70°");
});

test("Lesson 5: missing factors and reversing", () => {
  assert.equal(176 / 16, 11); assert.equal(8 / 16, 0.5); assert.equal(1 / 16, 0.0625); assert.equal(1 / (1 / 5), 5); assert.equal(1 / (2 / 5), 2.5);
  has("5.1a", "11"); has("5.1b", "½"); has("5.1c", "1/16"); has("5.1d", "5"); has("5.1e", "5/2");
  assert.equal(1 / 5, 0.2); assert.equal(6 / (3 / 2), 4); assert.equal(2 / 3, 1 / (3 / 2));
  has("5.4a", "1/5"); has("5.4b", "4"); has("5.4c", "2/3");
  assert.deepEqual([8, 12].map((x) => x * 0.75), [6, 9]); has("5.x", "6 by 9", "4/3");
  assert.equal(0.5 * 0.5, 0.25); has("5.2c", "¼");
});

test("Lesson 6: area grows by the square of the scale factor", () => {
  for (const s of [2, 3, 4, 5, 6]) assert.equal(areaFactor(s), s * s);
  has("6.1a", "4, 9, 16"); has("6.1d", "25", "36");
  const originals = { rhombuses: 3, trapezoids: 2, triangles: 4 };
  const counts = (s: number) => [originals.rhombuses, originals.trapezoids, originals.triangles].map((n) => n * s * s);
  assert.deepEqual(counts(2), [12, 8, 16]); has("6.2a", "12", "8", "16");
  assert.deepEqual(counts(3), [27, 18, 36]); has("6.2b", "27", "18", "36");
  assert.deepEqual([4, 5, 6].map((s) => counts(s)[0]), [48, 75, 108]);
  assert.deepEqual([4, 5, 6].map((s) => counts(s)[1]), [32, 50, 72]);
  assert.deepEqual([4, 5, 6].map((s) => counts(s)[2]), [64, 100, 144]);
  has("6.2c", "48, 75, 108", "32, 50, 72", "64, 100, 144");
  assert.deepEqual([2, 3].map((s) => 6 * s * s), [24, 54]); has("6.2e", "24", "54");
  assert.equal(5 * 2, 10); assert.equal(0.5 * 4 * 5, 10); has("6.3a", "10");
  const scaled = [1, 2, 3, 1 / 2, 1 / 3, 5, 3 / 5].map((s) => 10 * s * s);
  assert.deepEqual(scaled.slice(0, 3), [10, 40, 90]); assert.equal(scaled[3], 2.5); assert.ok(Math.abs(scaled[4] - 10 / 9) < 1e-12);
  assert.equal(scaled[5], 250); assert.ok(Math.abs(scaled[6] - 3.6) < 1e-12);
  has("6.3b", "10, 40, 90, 2.5", "10/9"); has("6.3e", "250", "3.6");
  has("6.3c", "10 × 4", "15 × 6", "2.5 × 1", "5/3 × 2/3"); has("6.3d", "8 × 10", "12 × 15", "2 × 2.5", "4/3 × 5/3");
  assert.equal(3 * 4, 12); assert.equal(12 * 12, 144); assert.equal(144 / 9, 16); has("6.x", "12", "144", "16");
});

test("Lesson 7: the basketball court scale (1 cm represents 2 m)", () => {
  assert.equal(toActual(5, 2), 10); assert.equal(toDrawing(9, 2), 4.5); assert.equal(toDrawing(0.9, 2), 0.45);
  has("7.2c", "4.5"); has("7.2d", "0.45");
  assert.ok(Math.abs(6190 / 100 - 61.9) < 1e-12); has("7.3c", "61.9");
  assert.equal(toActual(6, 5), 30); assert.equal(toDrawing(45, 5), 9); has("7.x", "30 m", "9 cm");
});

test("Lesson 8: speed, distance and time", () => {
  assert.equal(243 / 4, 60.75); assert.ok(60.75 < 65); assert.equal(65 * 4, 260); assert.ok(260 > 243);
  has("8.1a", "60.75", "260");
  const mph = 8.5 / (8 / 60); assert.equal(mph, 63.75); assert.ok(mph > 55);
  assert.ok(Math.abs((55 * 8) / 60 - 22 / 3) < 1e-12);
  has("8.2a", "63.75", "7⅓");
  assert.equal(12.5 * 4, 50); assert.ok(Math.abs(50 / 15 - 10 / 3) < 1e-12);
  has("8.3a", "50 miles"); has("8.3b", "3⅓", "3 hours 20 minutes");
  assert.equal(130 / 2, 65); assert.equal(35 / 70, 0.5);
  assert.equal(7.5 * 2, 15); assert.equal(15 / 10, 1.5); has("8.x", "15 km", "1.5 hours");
});

test("Lesson 9: floor plan and the two Utah maps", () => {
  assert.ok(11 / 23 < 1 / 2 && 7 / 13 > 1 / 2); has("9.1a", "7 ÷ 13");
  assert.ok(0.63 / 2 > 0.55 / 3); has("9.1b", "0.63 ÷ 2");
  assert.equal(15 / (1 / 3), 45); assert.equal(15 / (1 / 4), 60); has("9.1c", "15 ÷ 1/4", "60", "45");
  const k = 16 / 4; assert.equal(k, 4); // cm per m
  assert.equal(2.5 * k, 10); assert.equal(3.75 * k, 15); assert.equal(2.75 * k, 11);
  has("9.2a", "4 cm to 1 m"); has("9.2c", "10 cm"); has("9.2d", "15 cm"); has("9.2e", "11 cm");
  assert.deepEqual([270, 350, 110, 70].map((x) => x / 50), [5.4, 7, 2.2, 1.4]);
  has("9.3a", "5.4 cm wide by 7 cm tall", "2.2 cm wide by 1.4 cm tall");
  const m75 = [270, 350, 110, 70].map((x) => x / 75);
  assert.equal(m75[0], 3.6); assert.ok(Math.abs(m75[1] - 4.6667) < 1e-3); assert.ok(Math.abs(m75[2] - 1.4667) < 1e-3); assert.ok(Math.abs(m75[3] - 0.9333) < 1e-3);
  has("9.3b", "3.6 cm", "4.67", "1.47", "0.93");
  assert.equal(75 / 50, 1.5); has("9.3c", "1.5", "2/3");
  assert.equal(6 / 1.5, 4); assert.equal(4.5 / 1.5, 3); has("9.x", "4 cm", "3 cm");
});

test("Lesson 10: the triangular plot, three scales, and the playground", () => {
  const real = 0.5 * 120 * 90; assert.equal(real, 5400); has("10.2a", "5,400");
  const draw = (mPerCm: number) => { const b = 120 / mPerCm, h = 90 / mPerCm; return { b, h, area: 0.5 * b * h, cmSq: mPerCm * mPerCm }; };
  const a5 = draw(5), a15 = draw(15), a50 = draw(50);
  assert.deepEqual([a5.b, a5.h, a5.area], [24, 18, 216]); assert.deepEqual([a15.b, a15.h, a15.area], [8, 6, 24]);
  assert.deepEqual([a50.b, a50.h], [2.4, 1.8]); assert.ok(Math.abs(a50.area - 2.16) < 1e-9);
  for (const a of [a5, a15, a50]) assert.ok(Math.abs(a.area * a.cmSq - 5400) < 1e-6, "scaled area times cm² value is the real area");
  has("10.2b", "24 cm", "18 cm", "216"); has("10.2c", "8 cm", "6 cm", "24 cm²"); has("10.2d", "2.4", "1.8", "2.16");
  assert.equal(a5.area / a15.area, 9); assert.ok(Math.abs(a5.area / a50.area - 100) < 1e-9); has("10.2e", "9 times"); has("10.2f", "100 times");
  assert.equal(30 / 20, 1.5); assert.equal(1.5 * 1.5, 2.25); assert.equal(30 * 30, 900); assert.equal(20 * 20, 400);
  has("10.3b", "1.5", "2.25"); has("10.3c", "900", "400"); has("10.3d", "120 m", "6 cm");
  assert.equal(4 * 30 / 20, 6);
  assert.equal(200 / 20, 10); assert.equal(20 * 20, 400); assert.equal(200 * 200, 40000);
  assert.equal(10 / 5, 2); assert.equal(2 * 2, 4); has("10.x", "6 cm", "4 times");
});

test("Lesson 11: scales without units", () => {
  assert.equal(12 * 100, 1200); has("11.1a", "1,200", "12 m");
  assert.equal(7 * 50, 350); has("11.2a", "350 cm");
  assert.equal(15 * 12, 180); assert.equal(unitlessScale(15, "in", "ft"), 180); has("11.3b", "180");
  assert.equal(20 * 12, 240); assert.equal(unitlessScale(20, "in", "ft"), 240); has("11.3c", "240");
  // Solar system sample: Neptune 2,795 million miles at 100 m (10,000 cm).
  const milesPerCm = 2795e6 / 10000; assert.equal(milesPerCm, 279500);
  assert.ok(Math.abs(8000 / milesPerCm - 0.0286) < 1e-4); has("11.5a", "279,500", "0.029 cm", "0.29 mm");
  assert.equal(18 * 25, 450); has("11.x", "450 cm", "4.5 m");
});

test("Lesson 12: units, the flag, and the pools", () => {
  assert.ok(Math.abs(5280 * 12 * CM_PER_INCH - 160934.4) < 1e-6); has("12.1a", "160,934.4".replace(",", ","));
  assert.equal(INCHES_PER_MILE, 63360); assert.equal(unitlessScale(1, "in", "mi"), 63360);
  assert.equal(unitlessScale(10, "in", "mi"), 633600); assert.equal(unitlessScale(1, "mm", "km"), 1000000);
  assert.equal(unitlessScale(5, "in", "mi"), 316800, "1 inch to 5 miles is NOT 1 to 63,360");
  assert.equal(unitlessScale(10, "cm", "m"), 1000 / 1); assert.equal(unitlessScale(1, "mm", "m"), 1000);
  assert.equal(unitlessScale(1, "cm", "m"), 100);
  assert.equal(500 * 100 / 0.5, 100000); has("12.2b", "1 to 1,000", "100,000"); has("12.2a", "1 to 1,000");
  // The flag: 396 m long at 1 to 2,000.
  const lenCm = 396 * 100; assert.equal(lenCm / 2000, 19.8);
  const heightM = (13.2 * 2000) / 100; assert.equal(heightM, 264);
  assert.ok(Math.abs((99 * 100) / 2000 - 4.95) < 1e-12);
  const largeM2 = 396 * 264; assert.equal(largeM2, 104544);
  const largeCm2 = largeM2 * 100 * 100; assert.equal(largeCm2, 1045440000);
  const small = 19.8 * 13.2; assert.ok(Math.abs(small - 261.36) < 1e-9);
  assert.ok(Math.abs(largeCm2 / small - 4000000) < 1e-3); assert.equal(2000 * 2000, 4000000);
  assert.notEqual(largeCm2, 1053360000, "the figure on the publisher's page is wrong");
  has("12.3a", "19.8"); has("12.3b", "264 m"); has("12.3c", "4.95"); has("12.3e", "104,544", "1,045,440,000", "261.36", "4,000,000"); assert.match(byId("12.3e").note ?? "", /1,053,360,000/, "the wrong figure is called out in the note");
  assert.equal(unitlessScale(20, "cm", "m"), 2000); assert.equal(unitlessScale(2, "mm", "m"), 2000); assert.equal(unitlessScale(2, "m", "km"), 2000); has("12.3d", "1 cm to 20 m", "5 cm to 100 m", "1 mm to 2 m", "1 m to 2 km");
  // Pools: a 15 m side drawn at 3 cm.
  assert.equal(15 / 3, 5); assert.equal(unitlessScale(5, "cm", "m"), 500);
  has("12.4a", "1 cm to 5 m", "1 to 500");
  assert.equal(3.2 * 25, 80); has("12.4c", "80 m²");
  assert.deepEqual([2, 3, 4].map((d) => 10 * 2 ** d).slice(0, 3), [40, 80, 160]); has("12.4d", "40, 80 and 160");
  assert.equal(unitlessScale(2, "in", "mi"), 126720); assert.equal(2 * 2 * 3, 12); has("12.x", "126,720", "12 square miles");
});

test("Lesson 13: choosing a scale that fits the paper", () => {
  const usableLong = 27.9 - 3, usableShort = 21.6 - 3;
  assert.ok(Math.abs(usableLong - 24.9) < 1e-9 && Math.abs(usableShort - 18.6) < 1e-9);
  assert.ok(Math.abs(900 / usableLong - 36.14) < 0.01 && Math.abs(700 / usableShort - 37.63) < 0.01);
  assert.deepEqual([900 / 40, 700 / 40], [22.5, 17.5]); assert.ok(22.5 <= usableLong && 17.5 <= usableShort);
  assert.ok(900 / 30 === 30 && 30 > usableLong, "1 cm to 30 cm is too big");
  has("13.3a", "24.9 by 18.6", "22.5 cm by 17.5 cm", "36.1", "37.6");
  assert.deepEqual([800 / 50, 600 / 50], [16, 12]); assert.ok(16 <= 28 && 12 <= 21);
  assert.deepEqual([800 / 25, 600 / 25], [32, 24]); assert.ok(32 > 28); has("13.x", "16 cm by 12 cm", "32 cm by 24 cm");
});

test("Unit 4 Lesson 8: percent increase and decrease, recomputed from the numbers in the lesson", () => {
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(100 * 1.06, 106); near(100 * 0.9, 90); near(90 / 0.9, 100); near(106 / 1.06, 100);
  has("U4L8.1a", "1.06"); has("U4L8.1b", "0.90"); has("U4L8.1c", "0.90"); has("U4L8.1d", "1.06");
  // 100% + 6% = 106%, 100% - 15% = 85%
  near(1 + 6 / 100, 1.06); near(1 - 15 / 100, 0.85);
  near(100 * 1.06, 106); near(50 * 1.06, 53); near(200 * 1.06, 212); near(125 * 1.06, 132.5); near(106 + 26.5, 132.5);
  near(6 / 100 * 50, 3); near(6 / 100 * 200, 12); near(53 / 2, 26.5);
  has("U4L8.2a", "$106"); has("U4L8.2b", "$53"); has("U4L8.2c", "$212"); has("U4L8.2d", "$132.50", "26.50");
  has("U4L8.2e", "1.06x", "x + 0.06x", "(1 + 0.06)x");
  near(1000 * 0.85, 850); near(5000 * 0.85, 4250); near(5020 * 0.85, 4267);
  has("U4L8.2f", "$850"); has("U4L8.2g", "$4,250"); has("U4L8.2h", "$4,267"); has("U4L8.2i", "0.85x", "x − 0.15x", "(1 − 0.15)x");
  // Matching: reservoir up 23%, snow down 77%
  near(1 + 0.23, 1.23); near(1 - 0.77, 0.23);
  assert.ok(Math.abs(52 / 1.23 - 42.2764) < 1e-3); assert.ok(Math.abs(52 / 0.23 - 226.087) < 1e-3);
  has("U4L8.3a", "1.23x = 52", "42.3"); has("U4L8.3b", "0.23x = 52", "226.1"); has("U4L8.3c", "0.77x", "23%");
  assert.deepEqual([1, 2, 3].map((n) => 10 * 2 ** n), [20, 40, 80]); has("U4L8.3d", "20, 40 and 80", "10 · 2ⁿ");
  // Goo: n hours of x2 undone by h hours of x1/4 needs 2^n * (1/4)^h = 1, so h = n/2
  for (const n of [2, 4, 6, 10]) near(2 ** n * (1 / 4) ** (n / 2), 1);
  near(40 * 0.25, 10); has("U4L8.3e", "n/2", "40 grams", "10");
  // Gas tanks and equations
  near(12 + 0.5 * 12, 18); near(1.5 * 12, 18); has("U4L8.4a", "18 gallons", "1.5 · 12 = t");
  near(0.8 * 15, 12); has("U4L8.4b", "0.8 · 15 = p", "12 cups");
  near(12 / 0.75, 16); near(0.75 * 16, 12); has("U4L8.4c", "0.75 · t = 12", "$16");
  near(6600 / 1.25, 5280); near(1.25 * 5280, 6600); has("U4L8.4d", "1.25 · p = 6,600", "5,280");
  near(1080 / 1200, 0.9); near(1.75 / 1.5, 1.1666666666666667); has("U4L8.4e", "0.9", "1.17", "16");
  near(61600 / 1.25, 49280); has("U4L8.4f", "49,280"); assert.match(byId("U4L8.4f").note ?? "", /6,600/);
  // Cool-down: 1.04x = 156
  near(156 / 1.04, 150); near(1.04 * 150, 156); has("U4L8.5a", "1.04x = 156", "$150");
  // Practice problems
  near(120 * 1.15, 138); has("U4L8.P1", "$138");
  near(150 * (1 + 1.05), 307.5); has("U4L8.P2", "$307.50", "205%");
  near(1 + 0.5, 1.5); has("U4L8.P3", "A, C and E");
  near(1 - 0.3, 7 / 10); near(1 + 0.25, 5 / 4); has("U4L8.P4a", "10 equal pieces", "7 pieces"); has("U4L8.P4b", "4 equal pieces", "5 pieces");
  near(29 / 40, 0.725); assert.ok(Math.abs(0.725 - 0.7) < Math.abs(0.725 - 0.8)); has("U4L8.P5", "C", "0.725");
  assert.ok(Math.abs(7.2 * Math.PI - 22.62) < 0.01); assert.ok(7.2 * Math.PI !== 28); has("U4L8.P6", "No", "22.6");
  // Our exit check
  near(40 * 1.1, 44); near(45 / 0.9, 50); has("U4L8.x", "$44", "$50");
  // The extension in the supports: 10% twice is 21%
  near(1.1 * 1.1, 1.21);
  const l = lessonByNumber(14)!;
  assert.ok(l.supports.extension.some((x) => x.includes("1.21")));
  assert.ok(l.activities.every((a) => a.say?.length || a.board?.length || a.id.endsWith(".P")), "each activity says what to say or shows a worked example");
  assert.ok(all.filter((i) => i.id.startsWith("U4L8.")).every((i) => i.check === "ok"), "every answer in this lesson comes from numbers in the lesson");
});

test("the scale factor helper only calls it a copy when every ratio matches", () => {
  assert.equal(scaleFactorOf([1, 2, 3], [2, 4, 6]), 2);
  assert.equal(scaleFactorOf([1, 2, 3], [2, 4, 7]), null);
  assert.equal(scaleFactorOf([], []), null); assert.equal(scaleFactorOf([1, 2], [1]), null); assert.equal(scaleFactorOf([0, 1], [0, 2]), null);
  assert.equal(fmt(1 / 3, 2), "0.33"); assert.equal(fmt(5), "5"); assert.equal(areaFactor(1.5), 2.25);
});

test("credit and honesty: the page names the source, the license, and what is login-only", () => {
  assert.match(UNIT.source, /Illustrative Mathematics/); assert.match(UNIT.licenseUrl, /creativecommons\.org\/licenses\/by\/4\.0/);
  assert.match(UNIT.gated, /sign-in/);
  assert.equal(UNIT.teacherUrl(7), "https://im.kendallhunt.com/MS/teachers/2/1/7/index.html");
  const page = read("client/src/pages/MathLessons.tsx");
  assert.match(page, /UNIT\.licenseUrl/); assert.match(page, /Check your copy/); assert.match(page, /Answer checked/);
});

// ── Wiring ──────────────────────────────────────────────────────────────────────────────────────
test("Math Lessons is a WorkHub store app for teachers that opens its own page", () => {
  const p = officeAppPlugin("work", "work-math-lessons")!;
  assert.ok(p, "listed in the WorkHub App Store");
  assert.equal(p.category, "Classroom");
  assert.ok(p.target.kind === "officeApp" && p.target.href === "#/math-lessons");
  assert.ok(isAddable(p) && countsAsApp("work", p));
  assert.equal(pluginsFor("work", { teacher: true }).filter((x) => x.id === "work-math-lessons").length, 1);
  assert.equal(pluginsFor("life", { teacher: true }).some((x) => x.id === "work-math-lessons"), false, "not in LifeHub");
  assert.ok(p.features.length >= 2 && /^#[0-9a-f]{6}$/i.test(p.color));
});

test("the page is routed for adult accounts only and the store can draw its icon", () => {
  const app = read("client/src/App.tsx");
  assert.match(app, /const MathLessons = lazyPage\(\(\) => import\("\.\/pages\/MathLessons"\)\)/);
  assert.match(app, /<Route path="\/math-lessons">\s*\{!user \? <Redirect to="\/signin" replace \/> : isHubAccount\(user\) \? <MathLessons \/> : <Redirect to="\/" replace \/>\}/);
  assert.match(read("client/src/components/plugin-store/PluginStore.tsx"), /BookOpenCheck/);
});
