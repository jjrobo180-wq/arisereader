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

test("water, sleep, habits and Workouts count, from their first entry", () => {
  const s = riseScores({
    ...empty,
    water: [{ date: TODAY, amount: 4 }], waterGoal: 8,
    sleep: [{ date: TODAY, bed: "23:00", wake: "07:00" }, { date: "2026-11-21", bed: "01:00", wake: "05:00" }],
    habits: [{ days: [TODAY] }, { days: ["2026-11-21"] }],
    workouts: [{ date: TODAY }],
  }, TODAY);
  const by = Object.fromEntries(s.categories.map((c) => [c.id, c.percent]));
  assert.equal(by.water, 50);
  assert.equal(by.sleep, 100);   // 11 PM to 7 AM is 8 hours
  assert.equal(by.habits, 50);   // 1 of 2 habits
  assert.equal(by.move, 100);    // a workout makes it a full Move day
  assert.deepEqual(s.categories.map((c) => c.name), ["Move", "Water", "Sleep", "Habits"]);
});

test("a category switched off counts nowhere", () => {
  const input: RiseInput = { ...empty, tasks: [{ title: "a", due: TODAY, done: true }], exercise: [{ date: TODAY, minutes: 0 }] };
  assert.equal(riseScores(input, TODAY).today, 50);
  const s = riseScores({ ...input, off: ["move"] }, TODAY);
  assert.equal(s.today, 100);
  assert.deepEqual(s.categories.map((c) => c.id), ["checklist"]);
});

test("what's left today, biggest lift first, and the badge count", () => {
  const s = riseScores({
    ...empty,
    tasks: [{ title: "Call the dentist", due: TODAY, time: "15:00", done: false }, { title: "Laundry", due: TODAY, done: false }, { title: "Bed", due: TODAY, done: true }],
    food: [{ date: TODAY, meal: "breakfast" }],
    exercise: [{ date: TODAY, minutes: 24 }],
    habits: [{ name: "Read", days: [] }, { name: "Stretch", days: [TODAY] }],
  }, TODAY);
  assert.deepEqual(s.left.map((l) => [l.name, l.what, l.count]), [
    ["Checklist", "Call the dentist and Laundry", 2],
    ["Food", "Log lunch and dinner", 2],
    ["Habits", "Read", 1],
    ["Move", "6 more active minutes, or log a workout", 1],
  ]);
  assert.equal(s.leftCount, 6);
  assert.equal(s.left[0].gain, 17); // Checklist at 33%: (100-33)/4
});

test("what each grade takes today", () => {
  const s = riseScores({ ...empty, tasks: [{ title: "a", due: TODAY, done: true }], exercise: [{ date: TODAY, minutes: 15 }], food: [{ date: TODAY, meal: "lunch" }] }, TODAY);
  // Checklist 100, Move 50, Food 33: today 61.
  assert.equal(s.today, 61);
  const [a, b, c] = s.ladder;
  assert.equal(a.grade, "A");
  assert.equal(a.how, "Finish Food and Move");
  assert.equal(a.need, 29);
  assert.equal(c.how, "Finish Food");
  assert.equal(b.reached, false);
  assert.match(s.summary.today, /^61% \(D\) with 3 things left\. Finish Food and Move for an A\.$/);
});

test("a perfect day leaves nothing, and every rung is reached", () => {
  const s = riseScores({ ...empty, tasks: [{ title: "a", due: TODAY, done: true }] }, TODAY);
  assert.equal(s.leftCount, 0);
  assert.ok(s.ladder.every((r) => r.reached));
  assert.equal(s.summary.today, "A perfect day: everything is done.");
});

test("week analysis, summary and how to improve", () => {
  const food = [];
  // Last week every meal; this week only breakfast.
  for (let d = 9; d <= 15; d++) for (const meal of ["breakfast", "lunch", "dinner"]) food.push({ date: `2026-11-${String(d).padStart(2, "0")}`, meal });
  for (let d = 16; d <= 22; d++) food.push({ date: `2026-11-${d}`, meal: "breakfast" });
  const tasks = [];
  for (let d = 16; d <= 22; d++) tasks.push({ title: `t${d}`, due: `2026-11-${d}`, done: true });
  const s = riseScores({ ...empty, food, tasks }, TODAY);
  const f = s.analysis.find((a) => a.id === "food")!;
  assert.equal(f.week, 33);
  assert.equal(f.lastWeek, 100);
  assert.equal(f.goodDays, 0);
  assert.equal(f.trackedDays, 7);
  assert.match(s.improve.join(" "), /Food is your weakest this week at 33%/);
  assert.match(s.summary.week, /down 33 from last week/);
  assert.match(s.summary.week, /Strongest: Checklist 100%\. Needs work: Food 33%\./);
  assert.match(s.summary.year, /^\d+% \([A-D][+-]?\) across 14 tracked days\./);
});

test("switched-off categories leave the analysis and what's left", () => {
  const s = riseScores({ ...empty, tasks: [{ title: "a", due: TODAY, done: false }], food: [{ date: TODAY, meal: "lunch" }], off: ["food"] }, TODAY);
  assert.deepEqual(s.left.map((l) => l.id), ["checklist"]);
  assert.ok(!s.analysis.some((a) => a.id === "food"));
});
