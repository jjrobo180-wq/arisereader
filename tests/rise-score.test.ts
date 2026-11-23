// The Rise Score (shared/riseScore.ts): the grade scale, each category's daily score, and the day, week and
// year roll-ups the score card and the Rise Score widgets show.
import test from "node:test";
import assert from "node:assert/strict";
import { riseGrade, riseInputFrom, riseScores, type RiseInput } from "../shared/riseScore";

const empty: RiseInput = { tasks: [], food: [], exercise: [], activeMinutes: 30, monthlyBudget: 0, expenses: [] };
const TODAY = "2026-11-22"; // a Sunday

test("grade scale", () => {
  assert.equal(riseGrade(95), "A");
  assert.equal(riseGrade(90), "A");
  assert.equal(riseGrade(88), "B+");
  assert.equal(riseGrade(84), "B");
  assert.equal(riseGrade(81), "B-");
  assert.equal(riseGrade(78), "C+");
  assert.equal(riseGrade(74), "C");
  assert.equal(riseGrade(71), "C-");
  assert.equal(riseGrade(40), "D");
});

test("nothing to score yet", () => {
  const s = riseScores(empty, TODAY);
  assert.equal(s.started, false);
  assert.equal(s.today, 0);
  assert.deepEqual(s.categories, []);
  assert.equal(s.tip, "Check off a task to start your score");
  assert.equal(s.weekDays.length, 7);
  assert.equal(s.months.length, 12);
  assert.equal(s.todayIndex, 6);
  assert.equal(s.monthIndex, 10);
});

test("checklist: share of today's to-dos done, and the next one", () => {
  const tasks = [
    { title: "A", due: TODAY, done: true }, { title: "B", due: TODAY, done: true }, { title: "C", due: TODAY, done: true },
    { title: "Call the dentist", due: TODAY, time: "15:00", done: false },
  ];
  const s = riseScores({ ...empty, tasks }, TODAY);
  assert.equal(s.today, 75);
  assert.deepEqual(s.categories.map((c) => [c.name, c.percent]), [["Checklist", 75]]);
  assert.equal(s.next, "Call the dentist");
  assert.equal(s.started, true);
});

test("food, move and money count from their first entry", () => {
  const s = riseScores({
    ...empty,
    food: [{ date: "2026-11-20", meal: "breakfast" }, { date: TODAY, meal: "breakfast" }, { date: TODAY, meal: "lunch" }, { date: TODAY, meal: "snacks" }],
    exercise: [{ date: TODAY, minutes: 15 }],
    monthlyBudget: 3000, expenses: [{ date: TODAY, amount: 50 }],
  }, TODAY);
  const by = Object.fromEntries(s.categories.map((c) => [c.id, c.percent]));
  assert.equal(by.food, 67);      // 2 of 3 meals
  assert.equal(by.move, 50);      // 15 of 30 minutes
  assert.equal(by.money, 100);    // $50 is under $100 a day
  assert.equal(s.weekDays[5], 0); // Saturday: food was being logged, nothing logged
  assert.equal(s.weekDays[4], 33); // Friday: breakfast only
  assert.equal(s.weekDays[3], -1); // Thursday: before anything was logged
});

test("over budget lowers money", () => {
  const s = riseScores({ ...empty, monthlyBudget: 3000, expenses: [{ date: TODAY, amount: 150 }] }, TODAY);
  assert.equal(s.categories[0].percent, 50);
});

test("week, year, overall and streak", () => {
  const tasks = [];
  for (let d = 1; d <= 22; d++) {
    const day = `2026-11-${String(d).padStart(2, "0")}`;
    tasks.push({ title: `t${d}`, due: day, done: true }, { title: `u${d}`, due: day, done: d % 2 === 0 });
  }
  tasks.push({ title: "jan", due: "2026-01-05", done: false });
  const s = riseScores({ ...empty, tasks }, TODAY);
  assert.equal(s.today, 100);
  assert.equal(s.weekDays.join(","), "100,50,100,50,100,50,100");
  assert.equal(s.week, 79);
  assert.equal(s.months[0], 0);
  assert.equal(s.months[1], -1);
  assert.equal(s.months[11], -1);
  assert.equal(s.streak, 1); // Saturday was 50
  assert.equal(s.tip, "Perfect day! Everything is done");
  assert.ok(s.overall > 0 && s.overall <= 100);
});

test("tip names the lowest category when finishing it reaches an A", () => {
  const s = riseScores({
    ...empty,
    tasks: [{ title: "a", due: TODAY, done: true }],
    exercise: [{ date: TODAY, minutes: 24 }],
  }, TODAY);
  assert.equal(s.today, 90);
  assert.equal(s.tip, "You're at an A today. Keep it!");
  const t = riseScores({ ...empty, tasks: [{ title: "a", due: TODAY, done: true }], exercise: [{ date: TODAY, minutes: 18 }] }, TODAY);
  assert.equal(t.today, 80);
  assert.equal(t.tip, "Finish Move to reach an A today");
});

test("input from LifeHub's data uses one person's food and workouts", () => {
  const input = riseInputFrom({
    health: { profiles: { m1: {} }, goals: { m1: { activeMinutes: 45 } }, food: [{ memberId: "m1", date: TODAY, meal: "lunch" }, { memberId: "m2", date: TODAY, meal: "dinner" }], exercise: [] },
    budget: [{ limit: 1000 }, { limit: 500 }], expenses: [],
  }, []);
  assert.equal(input.activeMinutes, 45);
  assert.equal(input.monthlyBudget, 1500);
  assert.equal(input.food.length, 1);
});
