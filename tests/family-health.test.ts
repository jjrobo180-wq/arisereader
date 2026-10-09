import test from "node:test";
import assert from "node:assert/strict";
import { cleanFamily, cleanHealth, emptyFamily, type Member } from "../shared/familyHub";
import { caloriesLeft, dayTotals, exerciseCalories, goalsFor, latestWeight, macroGrams, recentFoods, setDay } from "../shared/familyHealth";

const adult: Member = { id: "a", name: "Jess", emoji: "", color: "#7566e8", kind: "adult" };
const kid: Member = { id: "k", name: "Leo", emoji: "", color: "#36b6a5", kind: "kid" };
const D = "2026-10-09";

test("older family data gets an empty food & fitness diary", () => {
  const f = cleanFamily({ members: [adult] });
  assert.deepEqual(f.health, { profiles: {}, goals: {}, food: [], exercise: [], days: [], weights: [], foods: [] });
  assert.deepEqual(emptyFamily().health, f.health);
});

test("calories remaining = goal − food + exercise, with macros from servings", () => {
  const h = cleanHealth({
    goals: { a: { calories: 1800, proteinPct: 30, carbsPct: 40, fatPct: 30 } },
    food: [
      { id: "1", memberId: "a", date: D, meal: "breakfast", name: "Egg", servings: 2, calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
      { id: "2", memberId: "a", date: D, meal: "lunch", name: "Pizza", servings: 1.5, calories: 285, protein: 12, carbs: 36, fat: 10 },
      { id: "3", memberId: "a", date: "2026-10-08", meal: "lunch", name: "Yesterday", servings: 1, calories: 999, protein: 0, carbs: 0, fat: 0 },
    ],
    exercise: [{ id: "x", memberId: "a", date: D, name: "Run", minutes: 30, calories: 300 }],
  });
  const t = dayTotals(h, "a", D);
  assert.equal(t.food.calories, 144 + 428);
  assert.equal(t.food.protein, 30.6);
  assert.equal(t.exercise, 300);
  assert.equal(caloriesLeft(1800, t), 1800 - 572 + 300);
  assert.deepEqual(macroGrams(goalsFor(h, adult)), { protein: 135, carbs: 180, fat: 60 });
});

test("kids get habit goals; bad values are cleaned", () => {
  const h = cleanHealth({ goals: { k: { water: 99, fruitVeg: -3 } }, food: [{ id: "f", memberId: "k", date: D, meal: "brunch", name: "Apple", servings: 0, calories: -5 }] });
  const g = goalsFor(h, kid);
  assert.equal(g.water, 40);
  assert.equal(g.fruitVeg, 0);
  assert.equal(goalsFor(cleanHealth({}), kid).water, 6);
  assert.equal(h.food[0].meal, "snacks");
  assert.equal(h.food[0].servings, 0.01);
  assert.equal(h.food[0].calories, 0);
});

test("water, steps and fruit & veggies are stored once per person per day", () => {
  let h = setDay(cleanHealth({}), "k", D, { water: 2 });
  h = setDay(h, "k", D, { fruitVeg: 3 });
  h = setDay(h, "k", D, { water: -4 });
  assert.equal(h.days.length, 1);
  assert.deepEqual(dayTotals(h, "k", D), { food: { calories: 0, protein: 0, carbs: 0, fat: 0 }, exercise: 0, minutes: 0, water: 0, steps: 0, fruitVeg: 3, items: 0 });
});

test("exercise estimate, latest weight and recent foods", () => {
  assert.equal(exerciseCalories(9.8, 30, 160), 373);
  const h = cleanHealth({
    weights: [{ id: "w2", memberId: "a", date: "2026-10-05", weight: 181 }, { id: "w1", memberId: "a", date: "2026-09-01", weight: 186.4 }],
    food: [{ id: "1", memberId: "a", date: D, meal: "lunch", name: "Taco", servings: 1, calories: 170, protein: 8, carbs: 13, fat: 10 },
      { id: "2", memberId: "a", date: D, meal: "dinner", name: "taco", servings: 2, calories: 170, protein: 8, carbs: 13, fat: 10 },
      { id: "3", memberId: "a", date: D, meal: "dinner", name: "Rice", servings: 1, calories: 205, protein: 4, carbs: 45, fat: 0 }],
  });
  const w = latestWeight(h, "a");
  assert.equal(w.first?.weight, 186.4);
  assert.equal(w.latest?.weight, 181);
  assert.deepEqual(recentFoods(h, "a").map((f) => f.name), ["Rice", "taco"]);
});

test("logs keep their newest entries when over the limit", () => {
  const food = Array.from({ length: 12005 }, (_, i) => ({ id: `f${i}`, memberId: "a", date: D, meal: "snacks", name: "x", servings: 1, calories: 1, protein: 0, carbs: 0, fat: 0 }));
  const h = cleanHealth({ food });
  assert.equal(h.food.length, 12000);
  assert.equal(h.food[h.food.length - 1].id, "f12004");
  assert.equal(h.food[0].id, "f5");
});

test("the food tracker works without adding family members", async () => {
  const { healthPeople, ME_ID } = await import("../shared/familyHealth");
  const empty = { members: [], health: cleanHealth({}) };
  assert.deepEqual(healthPeople(empty, "Jess").map((m) => [m.id, m.name, m.kind]), [[ME_ID, "Jess", "adult"]]);
  assert.equal(healthPeople(empty, "").at(0)?.name, "Me");
  const family = { members: [adult, kid], health: cleanHealth({}) };
  assert.deepEqual(healthPeople(family, "Jess").map((m) => m.id), ["a", "k"]);
  const logged = { members: [adult], health: cleanHealth({ food: [{ id: "1", memberId: ME_ID, date: D, meal: "lunch", name: "Soup", servings: 1, calories: 90 }] }) };
  assert.deepEqual(healthPeople(logged, "Jess").map((m) => m.id), [ME_ID, "a"]);
});

test("intake plan: Mifflin-St Jeor, pace, floors and goal date", async () => {
  const { makePlan, checkIntake, maxLoseRate, minGoalWeight } = await import("../shared/familyHealth");
  const base = { sex: "female" as const, birthYear: 1990, heightIn: 65, weight: 180, goal: "lose" as const, goalWeight: 150, rate: 1, activity: "light" as const, diet: "balanced" as const, createdAt: "" };
  const plan = makePlan(base, "2026-10-09");
  // 10*81.65 + 6.25*165.1 - 5*36 - 161 = 1507.4; ×1.375 = 2072.7; −500 = 1572.7 → 1570
  assert.equal(plan.bmr, 1507);
  assert.equal(plan.tdee, 2073);
  assert.equal(plan.calories, 1570);
  assert.equal(plan.floored, false);
  assert.equal(plan.weeks, 30);
  assert.equal(plan.goalDate, "2027-05-07");
  assert.deepEqual([plan.protein, plan.carbs, plan.fat], [79, 196, 52]);
  // 2 lb/week for a smaller person is capped at 1% of body weight and the 1,200 floor
  const small = makePlan({ ...base, weight: 130, goalWeight: 120, heightIn: 62, rate: 2, activity: "sedentary" }, "2026-10-09");
  assert.equal(maxLoseRate(130), 1.25);
  assert.equal(small.calories, 1200);
  assert.equal(small.floored, true);
  assert.equal(makePlan({ ...base, goal: "maintain" }, "2026-10-09").calories, 2070);
  assert.equal(makePlan({ ...base, sex: "male", goal: "gain", goalWeight: 190, rate: 2 }, "2026-10-09").rate, 0.5);
  // safety checks
  assert.equal(minGoalWeight(65), 112);
  assert.match(checkIntake({ ...base, goalWeight: 100 }, "2026-10-09")!.message, /won't aim below 112 lb/);
  assert.equal(checkIntake({ ...base, birthYear: 2012 }, "2026-10-09")?.field, "birthYear");
  assert.equal(checkIntake({ ...base, goalWeight: 190 }, "2026-10-09")?.field, "goalWeight");
  assert.equal(checkIntake(base, "2026-10-09"), null);
});
