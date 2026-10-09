// Food & fitness for the A.R.I.S.E. To-Do Family Hub: a starter food list, activities,
// goals and the daily math (calories remaining = goal − food + exercise).
import type { DayEntry, FoodEntry, Health, HealthGoals, Member, SavedFood } from "./familyHub";

/** Common foods with approximate nutrition per serving (rounded USDA-style values). */
export const COMMON_FOODS: Omit<SavedFood, "id">[] = [
  { name: "Egg, large", serving: "1 egg", calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
  { name: "Scrambled eggs", serving: "2 eggs", calories: 182, protein: 12, carbs: 2, fat: 14 },
  { name: "Bacon", serving: "2 slices", calories: 86, protein: 6, carbs: 0.2, fat: 6.7 },
  { name: "Oatmeal, cooked", serving: "1 cup", calories: 166, protein: 5.9, carbs: 28, fat: 3.6 },
  { name: "Cheerios", serving: "1 cup", calories: 100, protein: 3, carbs: 20, fat: 2 },
  { name: "Pancakes", serving: "2 (4 in)", calories: 175, protein: 5, carbs: 22, fat: 7 },
  { name: "Bagel, plain", serving: "1 bagel", calories: 270, protein: 10.5, carbs: 53, fat: 1.7 },
  { name: "Whole wheat bread", serving: "1 slice", calories: 81, protein: 4, carbs: 13.8, fat: 1.1 },
  { name: "White bread", serving: "1 slice", calories: 75, protein: 2.6, carbs: 14, fat: 1 },
  { name: "Flour tortilla", serving: "1 (8 in)", calories: 146, protein: 3.9, carbs: 25, fat: 3.6 },
  { name: "Corn tortilla", serving: "1 tortilla", calories: 52, protein: 1.4, carbs: 10.7, fat: 0.7 },
  { name: "White rice, cooked", serving: "1 cup", calories: 205, protein: 4.3, carbs: 45, fat: 0.4 },
  { name: "Brown rice, cooked", serving: "1 cup", calories: 216, protein: 5, carbs: 45, fat: 1.8 },
  { name: "Pasta, cooked", serving: "1 cup", calories: 220, protein: 8, carbs: 43, fat: 1.3 },
  { name: "Baked potato", serving: "1 medium", calories: 161, protein: 4.3, carbs: 37, fat: 0.2 },
  { name: "Sweet potato, baked", serving: "1 medium", calories: 103, protein: 2.3, carbs: 24, fat: 0.2 },
  { name: "Milk, 2%", serving: "1 cup", calories: 122, protein: 8, carbs: 12, fat: 4.8 },
  { name: "Milk, whole", serving: "1 cup", calories: 149, protein: 7.7, carbs: 11.7, fat: 7.9 },
  { name: "Greek yogurt, plain nonfat", serving: "170 g cup", calories: 100, protein: 17, carbs: 6, fat: 0.7 },
  { name: "Cottage cheese, 2%", serving: "1/2 cup", calories: 92, protein: 12, carbs: 5, fat: 2.5 },
  { name: "Cheddar cheese", serving: "1 oz", calories: 114, protein: 7, carbs: 0.4, fat: 9.4 },
  { name: "String cheese", serving: "1 stick", calories: 80, protein: 7, carbs: 1, fat: 6 },
  { name: "Chicken breast, cooked", serving: "4 oz", calories: 187, protein: 35, carbs: 0, fat: 4 },
  { name: "Ground beef 85%, cooked", serving: "4 oz", calories: 284, protein: 28, carbs: 0, fat: 18 },
  { name: "Salmon, cooked", serving: "4 oz", calories: 233, protein: 25, carbs: 0, fat: 14 },
  { name: "Tuna, canned in water", serving: "3 oz", calories: 100, protein: 22, carbs: 0, fat: 0.8 },
  { name: "Turkey deli meat", serving: "2 oz", calories: 60, protein: 10, carbs: 2, fat: 1 },
  { name: "Tofu, firm", serving: "1/2 cup", calories: 181, protein: 22, carbs: 3.5, fat: 11 },
  { name: "Black beans", serving: "1/2 cup", calories: 114, protein: 7.6, carbs: 20, fat: 0.5 },
  { name: "Hummus", serving: "2 tbsp", calories: 70, protein: 2, carbs: 4, fat: 5 },
  { name: "Peanut butter", serving: "2 tbsp", calories: 190, protein: 7, carbs: 7, fat: 16 },
  { name: "Almonds", serving: "1 oz", calories: 164, protein: 6, carbs: 6, fat: 14 },
  { name: "Apple", serving: "1 medium", calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { name: "Banana", serving: "1 medium", calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { name: "Orange", serving: "1 medium", calories: 62, protein: 1.2, carbs: 15.4, fat: 0.2 },
  { name: "Strawberries", serving: "1 cup", calories: 49, protein: 1, carbs: 11.7, fat: 0.5 },
  { name: "Blueberries", serving: "1 cup", calories: 84, protein: 1.1, carbs: 21, fat: 0.5 },
  { name: "Grapes", serving: "1 cup", calories: 104, protein: 1.1, carbs: 27, fat: 0.2 },
  { name: "Watermelon", serving: "1 cup", calories: 46, protein: 0.9, carbs: 11.5, fat: 0.2 },
  { name: "Avocado", serving: "1/2 avocado", calories: 120, protein: 1.5, carbs: 6.4, fat: 11 },
  { name: "Broccoli, cooked", serving: "1 cup", calories: 55, protein: 3.7, carbs: 11, fat: 0.6 },
  { name: "Carrots, raw", serving: "1 cup", calories: 52, protein: 1.2, carbs: 12, fat: 0.3 },
  { name: "Green beans, cooked", serving: "1 cup", calories: 44, protein: 2.4, carbs: 10, fat: 0.4 },
  { name: "Corn on the cob", serving: "1 medium ear", calories: 88, protein: 3.3, carbs: 19, fat: 1.4 },
  { name: "Salad greens", serving: "2 cups", calories: 15, protein: 1.2, carbs: 2.8, fat: 0.2 },
  { name: "Cucumber", serving: "1 cup", calories: 16, protein: 0.7, carbs: 3.8, fat: 0.1 },
  { name: "Ranch dressing", serving: "2 tbsp", calories: 130, protein: 0.4, carbs: 1.8, fat: 13.4 },
  { name: "Olive oil", serving: "1 tbsp", calories: 119, protein: 0, carbs: 0, fat: 13.5 },
  { name: "Butter", serving: "1 tbsp", calories: 102, protein: 0.1, carbs: 0, fat: 11.5 },
  { name: "PB&J sandwich", serving: "1 sandwich", calories: 390, protein: 13, carbs: 50, fat: 17 },
  { name: "Turkey sandwich", serving: "1 sandwich", calories: 320, protein: 21, carbs: 31, fat: 12 },
  { name: "Cheese pizza", serving: "1 large slice", calories: 285, protein: 12, carbs: 36, fat: 10 },
  { name: "Cheeseburger", serving: "1 burger", calories: 300, protein: 15, carbs: 33, fat: 12 },
  { name: "French fries", serving: "medium", calories: 320, protein: 4, carbs: 43, fat: 15 },
  { name: "Chicken nuggets", serving: "6 pieces", calories: 250, protein: 13, carbs: 15, fat: 15 },
  { name: "Beef taco, crunchy", serving: "1 taco", calories: 170, protein: 8, carbs: 13, fat: 10 },
  { name: "Mac & cheese", serving: "1 cup", calories: 350, protein: 10, carbs: 47, fat: 13 },
  { name: "Chicken noodle soup", serving: "1 cup", calories: 62, protein: 3, carbs: 7, fat: 2.4 },
  { name: "Granola bar", serving: "1 bar", calories: 120, protein: 2, carbs: 19, fat: 4 },
  { name: "Potato chips", serving: "1 oz", calories: 152, protein: 2, carbs: 15, fat: 10 },
  { name: "Chocolate chip cookie", serving: "1 cookie", calories: 78, protein: 0.9, carbs: 10, fat: 3.9 },
  { name: "Vanilla ice cream", serving: "1/2 cup", calories: 137, protein: 2.3, carbs: 16, fat: 7.3 },
  { name: "Protein shake (whey)", serving: "1 scoop", calories: 120, protein: 24, carbs: 3, fat: 1.5 },
  { name: "Orange juice", serving: "1 cup", calories: 112, protein: 1.7, carbs: 26, fat: 0.5 },
  { name: "Cola", serving: "12 oz can", calories: 140, protein: 0, carbs: 39, fat: 0 },
  { name: "Coffee, black", serving: "1 cup", calories: 2, protein: 0.3, carbs: 0, fat: 0 },
  { name: "Latte, 2% milk", serving: "16 oz", calories: 190, protein: 13, carbs: 19, fat: 7 },
  { name: "Beer", serving: "12 oz", calories: 153, protein: 1.6, carbs: 12.6, fat: 0 },
  { name: "Wine", serving: "5 oz glass", calories: 125, protein: 0.1, carbs: 3.8, fat: 0 },
];

/** Activities with their MET value (effort compared with sitting still). */
export const ACTIVITIES: { name: string; met: number }[] = [
  { name: "Walking (brisk)", met: 4.3 }, { name: "Running (6 mph)", met: 9.8 }, { name: "Cycling (moderate)", met: 8 },
  { name: "Swimming laps", met: 7 }, { name: "Strength training", met: 3.5 }, { name: "HIIT / circuit", met: 8 },
  { name: "Hiking", met: 6 }, { name: "Yoga", met: 2.5 }, { name: "Dancing", met: 5 }, { name: "Elliptical", met: 5 },
  { name: "Basketball", met: 6.5 }, { name: "Soccer", met: 7 }, { name: "Yard work", met: 4 }, { name: "Playing with kids", met: 4 },
];

export const DEFAULT_WEIGHT_LB = 160;
/** Calories burned: MET × 3.5 × kg ÷ 200 per minute. */
export const exerciseCalories = (met: number, minutes: number, pounds: number) =>
  Math.max(0, Math.round((met * 3.5 * (pounds / 2.2046)) / 200 * minutes));

export function goalsFor(health: Health, member: Member): HealthGoals {
  const saved = health.goals[member.id];
  const base: HealthGoals = { calories: 2000, proteinPct: 20, carbsPct: 50, fatPct: 30, water: member.kind === "kid" ? 6 : 8, steps: 8000, goalWeight: 0, activeMinutes: 60, fruitVeg: 5 };
  return saved ? { ...base, ...saved } : base;
}
/** Grams per day for each macro: protein and carbs have 4 calories a gram, fat 9. */
export const macroGrams = (g: HealthGoals) => ({
  protein: Math.round((g.calories * g.proteinPct) / 100 / 4),
  carbs: Math.round((g.calories * g.carbsPct) / 100 / 4),
  fat: Math.round((g.calories * g.fatPct) / 100 / 9),
});

const round1 = (n: number) => Math.round(n * 10) / 10;
export const entryTotals = (e: FoodEntry) => ({
  calories: Math.round(e.calories * e.servings), protein: round1(e.protein * e.servings), carbs: round1(e.carbs * e.servings), fat: round1(e.fat * e.servings),
});
export function dayTotals(health: Health, memberId: string, date: string) {
  const food = health.food.filter((f) => f.memberId === memberId && f.date === date);
  const sum = food.map(entryTotals).reduce((a, t) => ({ calories: a.calories + t.calories, protein: a.protein + t.protein, carbs: a.carbs + t.carbs, fat: a.fat + t.fat }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const moves = health.exercise.filter((x) => x.memberId === memberId && x.date === date);
  const day = health.days.find((d) => d.memberId === memberId && d.date === date);
  return {
    food: { calories: sum.calories, protein: round1(sum.protein), carbs: round1(sum.carbs), fat: round1(sum.fat) },
    exercise: moves.reduce((s, x) => s + x.calories, 0),
    minutes: moves.reduce((s, x) => s + x.minutes, 0),
    water: day?.water || 0, steps: day?.steps || 0, fruitVeg: day?.fruitVeg || 0, items: food.length,
  };
}
export const caloriesLeft = (goal: number, t: ReturnType<typeof dayTotals>) => goal - t.food.calories + t.exercise;

export const dayKey = (memberId: string, date: string) => `${memberId}:${date}`;
/** Changes one number of a person's day (water, steps, fruit & veggies), creating the day if needed. */
export function setDay(health: Health, memberId: string, date: string, patch: Partial<Pick<DayEntry, "water" | "steps" | "fruitVeg">>): Health {
  const key = dayKey(memberId, date);
  const existing = health.days.find((d) => d.id === key);
  const next: DayEntry = { id: key, memberId, date, water: 0, steps: 0, fruitVeg: 0, ...existing, ...patch };
  next.water = Math.max(0, Math.min(40, Math.round(next.water)));
  next.steps = Math.max(0, Math.min(200000, Math.round(next.steps)));
  next.fruitVeg = Math.max(0, Math.min(30, Math.round(next.fruitVeg)));
  return { ...health, days: existing ? health.days.map((d) => (d.id === key ? next : d)) : [...health.days, next].slice(-8000) };
}
export function latestWeight(health: Health, memberId: string) {
  const list = health.weights.filter((w) => w.memberId === memberId).sort((a, b) => a.date.localeCompare(b.date));
  return { list, latest: list[list.length - 1], first: list[0] };
}
/** The person's most recent distinct foods, newest first, for one-tap re-adding. */
export function recentFoods(health: Health, memberId: string, limit = 12) {
  const seen = new Set<string>();
  const out: FoodEntry[] = [];
  for (let i = health.food.length - 1; i >= 0 && out.length < limit; i--) {
    const f = health.food[i];
    const key = f.name.toLowerCase();
    if (f.memberId !== memberId || seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/** The signed-in person's own diary, used when no family members have been added
 *  (and kept afterwards if it has anything in it, so nothing logged is lost). */
export const ME_ID = "me";
export function healthPeople(family: { members: Member[]; health: Health }, myName: string): Member[] {
  const me: Member = { id: ME_ID, name: myName.trim() || "Me", emoji: "🙂", color: "#6e5ae0", kind: "adult" };
  const h = family.health;
  const used = !!h.goals[ME_ID] || [h.food, h.exercise, h.days, h.weights].some((list) => list.some((x) => x.memberId === ME_ID));
  return !family.members.length || used ? [me, ...family.members] : family.members;
}
