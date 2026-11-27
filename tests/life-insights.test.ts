// Life Score, in depth (shared/lifeInsights.ts): what's left to track today and its red count, what each rating
// needs, how to improve, the summaries, each area side by side, and the data the home-screen widgets get.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyLifeScore, lifeInputFrom, lifeScore, plusDays, type LifeInput } from "../shared/lifeScore";
import { lifeInsights, lifeWidgetData } from "../shared/lifeInsights";

const today = "2026-11-26"; // a Thursday
const base = (tasks: { due: string; done: boolean }[] = []): LifeInput => lifeInputFrom({ lifeScore: emptyLifeScore() }, tasks);
const full = { happy: 8, stress: 3, energy: 7, connect: 8, screen: 2, outdoors: 30, exercise: 30, produce: 5, alcohol: 0, together: true, faith: true };

test("nothing logged: the check-in is what's left, and no rating is reached", () => {
  const input = base();
  const ins = lifeInsights(input, lifeScore(input, today), today);
  assert.ok(ins.left.some((l) => l.id === "checkin"));
  assert.ok(ins.leftCount >= 1);
  assert.ok(ins.ladder.every((r) => !r.reached));
  assert.match(ins.summary.today, /No Life Score yet today/);
});

test("what's left today: unfinished check-in parts, sleep, steps, exercise, food and to-dos", () => {
  const input = base([{ due: today, done: false }, { due: today, done: false }, { due: today, done: true }]);
  input.data.health[today] = { steps: 5600 };
  input.data.days[today] = { happy: 7, exercise: 10 };
  const ins = lifeInsights(input, lifeScore(input, today), today);
  const by = Object.fromEntries(ins.left.map((l) => [l.id, l]));
  assert.match(by.checkin.what, /^Add stress, energy, how connected and \d+ more$/);
  assert.equal(by.sleep.what, "Log last night's sleep");
  assert.equal(by.steps.what, "2,400 more steps");
  assert.equal(by.exercise.what, "20 more minutes of exercise");
  assert.equal(by.food.what, "Log what you've eaten today");
  assert.equal(by.checklist.what, "2 to-dos left today");
  assert.equal(by.checklist.count, 2);
  assert.equal(ins.leftCount, ins.left.reduce((a, l) => a + l.count, 0));
  assert.ok(ins.left.every((l) => l.gain >= 1));
  // Biggest lift first.
  for (let i = 1; i < ins.left.length; i++) assert.ok(ins.left[i - 1].gain >= ins.left[i].gain);
});

test("each rating says what it needs, and reached ones say so", () => {
  const input = base();
  for (let i = 0; i < 14; i++) {
    const d = plusDays(today, -i);
    input.data.health[d] = { steps: 4000, sleep: 6, rhr: 70 };
    input.data.days[d] = { ...full, happy: 4, screen: 6 };
  }
  const r = lifeScore(input, today);
  const ins = lifeInsights(input, r, today);
  const [excellent, good, fair] = ins.ladder;
  assert.equal(excellent.label, "Excellent");
  assert.equal(excellent.min, 85);
  for (const rung of ins.ladder) {
    if (r.score! >= rung.min) { assert.equal(rung.reached, true); assert.equal(rung.need, 0); }
    else { assert.equal(rung.need, rung.min - r.score!); assert.match(rung.how, /^Raise |^More than one day/); }
  }
  assert.ok(good && fair);
});

test("summaries, the areas side by side and the week's movers", () => {
  const input = base();
  for (let i = 0; i < 14; i++) {
    const d = plusDays(today, -i);
    input.data.health[d] = { steps: i < 7 ? 9000 : 3000, sleep: 7.5 };
    input.data.days[d] = full;
  }
  const r = lifeScore(input, today);
  const ins = lifeInsights(input, r, today);
  assert.match(ins.summary.today, /^\d+ \((Excellent|Good|Fair|Needs care)\)/);
  assert.match(ins.summary.week, /^Averaging \d+ \(.+\), (up \d+ from|down \d+ from|the same as) last week\./);
  assert.match(ins.summary.week, /Best day \w+day \(\d+\), toughest \w+day \(\d+\)\./);
  assert.match(ins.summary.month, /^30-day average \d+/);
  const body = ins.areas.find((a) => a.id === "body")!;
  assert.ok(body.week !== null && body.lastWeek !== null && body.week > body.lastWeek);
  assert.ok(ins.risers.some((m) => m.id === "steps"));
  assert.ok(ins.improve.length >= 1);
});

test("the widgets get today, the week by day, the year by month and what's left", () => {
  const input = base([{ due: today, done: false }]);
  for (let i = 0; i < 40; i++) input.data.days[plusDays(today, -i)] = full;
  const r = lifeScore(input, today);
  const year = lifeScore(input, today, 330);
  const w = lifeWidgetData(r, year, lifeInsights(input, r, today), today);
  assert.equal(w.todayIndex, 3);
  assert.equal(w.monthIndex, 10);
  assert.equal(w.weekDays.length, 7);
  assert.ok(w.weekDays.slice(0, 4).every((v) => v >= 0));
  assert.deepEqual(w.weekDays.slice(4), [-1, -1, -1]);
  assert.equal(w.months.length, 12);
  assert.equal(w.months[11], -1);
  assert.ok(w.months[10] > 0 && w.months[9] > 0);
  assert.ok(w.today > 0);
  assert.ok(w.leftCount >= 1);
  assert.ok(w.left.length >= 1 && w.left.length <= 4);
  assert.ok(w.categories.length >= 1);
});

test("once you're measuring blood pressure, today's reading is on the list; weekdays and the calendar", () => {
  const input = base();
  input.data.vitals = [{ id: "a", at: `${plusDays(today, -3)}T08:00`, kind: "bp", value: 125, dia: 80 }];
  for (let i = 0; i < 30; i++) input.data.days[plusDays(today, -i)] = { ...full, happy: new Date(`${plusDays(today, -i)}T12:00:00`).getDay() === 6 ? 10 : 3 };
  const r = lifeScore(input, today);
  const ins = lifeInsights(input, r, today);
  assert.ok(ins.left.some((l) => l.id === "bp" && /blood pressure/.test(l.what)));
  assert.equal(ins.weekdays.length, 7);
  assert.ok(ins.weekdays.every((v) => v !== null && v > 0));
  assert.equal(ins.calendar.length, 30);
  assert.equal(ins.calendar[29].date, today);
  input.data.vitals.push({ id: "b", at: `${today}T08:00`, kind: "bp", value: 120, dia: 78 });
  assert.ok(!lifeInsights(input, lifeScore(input, today), today).left.some((l) => l.id === "bp"));
});
