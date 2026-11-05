// Meal prep and the grocery list.
// Meal prep: plan the week's food ahead, day by day and meal by meal, in the same shape as the diary.
// Each day's calories and macros are added up against your goals as you go; a planned day can be copied
// into the diary in one tap.
// Grocery list: built from the meal prep when there is one (every planned food, added up, by aisle),
// otherwise from your nutrition plan (shared/fitNutrition.ts): staples that fit it, in amounts for a week
// sized to your calorie goal.
import type { FitData, FoodEntry } from "./fit";

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The 7 dates of the week starting on `start` (YYYY-MM-DD). */
export function weekDays(start: string): string[] {
  const d = new Date(`${start}T12:00:00`);
  return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return dayKey(x); });
}
/** This week's Monday (or today, if `fromToday`). */
export function prepStart(now = new Date(), fromToday = true): string {
  const d = new Date(now); d.setHours(12, 0, 0, 0);
  if (!fromToday) d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
}
export const sumFoods = (foods: Pick<FoodEntry, "kcal" | "p" | "c" | "f" | "servings">[]) =>
  foods.reduce((t, f) => ({ kcal: t.kcal + f.kcal * f.servings, p: t.p + f.p * f.servings, c: t.c + f.c * f.servings, f: t.f + f.f * f.servings }), { kcal: 0, p: 0, c: 0, f: 0 });

export type PrepDay = { date: string; totals: { kcal: number; p: number; c: number; f: number }; count: number };
/** Each planned day's totals and the week's average over the days that have food. */
export function prepSummary(prep: NonNullable<FitData["prep"]>): { days: PrepDay[]; avg: PrepDay["totals"]; planned: number } {
  const days = weekDays(prep.start).map((date) => { const list = prep.foods.filter((f) => f.date === date); return { date, totals: sumFoods(list), count: list.length }; });
  const withFood = days.filter((d) => d.count);
  const avg = withFood.length ? { kcal: withFood.reduce((a, d) => a + d.totals.kcal, 0) / withFood.length, p: withFood.reduce((a, d) => a + d.totals.p, 0) / withFood.length, c: withFood.reduce((a, d) => a + d.totals.c, 0) / withFood.length, f: withFood.reduce((a, d) => a + d.totals.f, 0) / withFood.length } : { kcal: 0, p: 0, c: 0, f: 0 };
  return { days, avg, planned: withFood.length };
}

// ── Grocery list ─────────────────────────────────────────────────────────────────────────────────
export type GroceryItem = { id: string; name: string; qty: string; aisle: string; done: boolean };
const AISLES: [RegExp, string][] = [
  [/chicken|beef|steak|turkey|pork|salmon|tuna|fish|shrimp|bacon|ham|sausage|ground|lamb|cod|tilapia|jerky/i, "Meat & fish"],
  [/milk|yogurt|cheese|butter|cream|egg|cottage|kefir/i, "Dairy & eggs"],
  [/apple|banana|berr|orange|grape|melon|lemon|lime|avocado|spinach|lettuce|kale|broccoli|carrot|pepper|onion|garlic|tomato|potato|zucchini|cucumber|mushroom|salad|vegetable|fruit|greens|asparagus|cauliflower|sweet potato|peach|pear|mango|pineapple|cherr|celery|green bean/i, "Produce"],
  [/rice|oat|pasta|bread|tortilla|quinoa|cereal|bagel|wrap|granola|noodle|flour|couscous/i, "Grains & bread"],
  [/bean|lentil|chickpea|tofu|tempeh|seitan|edamame|hummus/i, "Beans & plant protein"],
  [/nut|almond|peanut|cashew|walnut|seed|chia|flax/i, "Nuts & seeds"],
  [/oil|vinegar|sauce|salsa|spice|salt|honey|syrup|mustard|ketchup|mayo|dressing|broth|stock/i, "Pantry"],
  [/protein powder|whey|shake|bar\b|creatine/i, "Supplements"],
  [/frozen/i, "Frozen"],
  [/water|coffee|tea|juice|soda|drink/i, "Drinks"],
];
export const aisleOf = (name: string) => AISLES.find(([re]) => re.test(name))?.[1] ?? "Other";

/** Staples for each nutrition plan: [name, how much a day per 2,000 calories, unit]. */
const STAPLES: Record<string, [string, number, string][]> = {
  balanced: [["Chicken breast", 0.35, "lb"], ["Eggs", 2, ""], ["Greek yogurt", 0.5, "cup"], ["Oats", 0.5, "cup"], ["Brown rice", 0.5, "cup dry"], ["Sweet potatoes", 0.5, ""], ["Broccoli", 1, "cup"], ["Spinach", 1, "cup"], ["Bananas", 1, ""], ["Berries", 0.5, "cup"], ["Olive oil", 1, "tbsp"], ["Almonds", 1, "oz"], ["Whole-grain bread", 1, "slice"]],
  "high-protein": [["Chicken breast", 0.5, "lb"], ["Lean ground turkey", 0.25, "lb"], ["Eggs", 3, ""], ["Egg whites", 0.5, "cup"], ["Greek yogurt", 1, "cup"], ["Cottage cheese", 0.5, "cup"], ["Whey protein powder", 1, "scoop"], ["Oats", 0.5, "cup"], ["Rice", 0.5, "cup dry"], ["Broccoli", 1, "cup"], ["Bananas", 1, ""], ["Berries", 0.5, "cup"]],
  shred: [["Chicken breast", 0.5, "lb"], ["White fish (cod or tilapia)", 0.25, "lb"], ["Egg whites", 0.75, "cup"], ["Eggs", 2, ""], ["Greek yogurt (nonfat)", 1, "cup"], ["Whey protein powder", 1, "scoop"], ["Spinach", 2, "cup"], ["Broccoli", 1.5, "cup"], ["Zucchini", 0.5, ""], ["Berries", 0.5, "cup"], ["Oats", 0.33, "cup"], ["Avocado", 0.25, ""]],
  mass: [["Ground beef (90% lean)", 0.4, "lb"], ["Chicken thighs", 0.3, "lb"], ["Eggs", 4, ""], ["Whole milk", 2, "cup"], ["Oats", 1, "cup"], ["Rice", 1, "cup dry"], ["Pasta", 0.5, "cup dry"], ["Bagels", 1, ""], ["Peanut butter", 2, "tbsp"], ["Bananas", 2, ""], ["Potatoes", 1, ""], ["Olive oil", 2, "tbsp"]],
  "low-carb": [["Chicken thighs", 0.4, "lb"], ["Salmon", 0.25, "lb"], ["Eggs", 3, ""], ["Cheese", 1.5, "oz"], ["Avocado", 0.5, ""], ["Spinach", 2, "cup"], ["Broccoli", 1.5, "cup"], ["Cauliflower", 1, "cup"], ["Almonds", 1, "oz"], ["Olive oil", 2, "tbsp"], ["Berries", 0.33, "cup"], ["Greek yogurt", 0.5, "cup"]],
  keto: [["Ground beef (80% lean)", 0.4, "lb"], ["Salmon", 0.25, "lb"], ["Bacon", 2, "slice"], ["Eggs", 4, ""], ["Butter", 1.5, "tbsp"], ["Cheese", 2, "oz"], ["Avocado", 1, ""], ["Spinach", 2, "cup"], ["Cauliflower", 1, "cup"], ["Macadamia nuts or pecans", 1, "oz"], ["Olive oil", 2, "tbsp"], ["Heavy cream", 2, "tbsp"]],
  carnivore: [["Ribeye or chuck steak", 0.6, "lb"], ["Ground beef (80% lean)", 0.4, "lb"], ["Eggs", 4, ""], ["Salmon", 0.2, "lb"], ["Butter", 2, "tbsp"], ["Bacon", 2, "slice"], ["Beef liver", 0.05, "lb"], ["Salt", 0.5, "tsp"]],
  paleo: [["Chicken breast", 0.4, "lb"], ["Grass-fed ground beef", 0.25, "lb"], ["Salmon", 0.2, "lb"], ["Eggs", 3, ""], ["Sweet potatoes", 1, ""], ["Spinach", 2, "cup"], ["Broccoli", 1, "cup"], ["Bell peppers", 1, ""], ["Bananas", 1, ""], ["Berries", 0.5, "cup"], ["Almonds", 1, "oz"], ["Olive oil", 2, "tbsp"]],
  mediterranean: [["Salmon", 0.25, "lb"], ["Chicken breast", 0.25, "lb"], ["Chickpeas", 0.5, "cup"], ["Lentils", 0.25, "cup dry"], ["Greek yogurt", 0.5, "cup"], ["Feta cheese", 1, "oz"], ["Whole-grain bread", 2, "slice"], ["Quinoa", 0.33, "cup dry"], ["Tomatoes", 1, ""], ["Cucumbers", 0.5, ""], ["Spinach", 1, "cup"], ["Olive oil", 2, "tbsp"], ["Walnuts", 1, "oz"], ["Lemons", 0.5, ""]],
  plant: [["Firm tofu", 0.5, "block"], ["Tempeh", 0.25, "block"], ["Lentils", 0.5, "cup dry"], ["Black beans", 0.5, "cup"], ["Edamame", 0.5, "cup"], ["Pea protein powder", 1, "scoop"], ["Quinoa", 0.5, "cup dry"], ["Oats", 0.5, "cup"], ["Spinach", 2, "cup"], ["Broccoli", 1, "cup"], ["Bananas", 1, ""], ["Peanut butter", 2, "tbsp"], ["Chia seeds", 1, "tbsp"]],
};
const nice = (n: number) => (n >= 10 ? String(Math.round(n)) : String(Math.round(n * 4) / 4).replace(/\.25$/, "¼").replace(/\.5$/, "½").replace(/\.75$/, "¾").replace(/^0(?=[¼½¾])/, ""));
const plural = (u: string, n: number) => (!u || n <= 1 || /s$|dry|oz|lb|tbsp|tsp/.test(u) ? u : `${u}s`);
let seq = 0;
const gid = () => `g${Date.now().toString(36)}${(seq++).toString(36)}`;

/** A week of staples for a nutrition plan, scaled to the calorie goal. */
export function groceryForPlan(planId: string, kcal: number, days = 7): GroceryItem[] {
  const list = STAPLES[planId] ?? STAPLES.balanced;
  const k = Math.max(0.6, Math.min(2, kcal / 2000)) * days;
  return list.map(([name, perDay, unit]) => {
    let n = perDay * k;
    let u = unit;
    if (unit === "tbsp" && n >= 16) { n /= 16; u = "cup"; }
    if (unit === "" ) n = Math.ceil(n);
    const qty = u === "lb" ? `${nice(Math.ceil(n * 4) / 4)} lb` : `${nice(n)}${u ? ` ${plural(u, n)}` : ""}`;
    return { id: gid(), name, qty, aisle: aisleOf(name), done: false };
  }).sort((a, b) => a.aisle.localeCompare(b.aisle));
}

/** Everything planned in a meal prep, added up (same food, same serving = one line). */
export function groceryFromPrep(foods: FoodEntry[]): GroceryItem[] {
  const by = new Map<string, { name: string; n: number; serving?: string }>();
  for (const f of foods) {
    const key = `${f.name.toLowerCase()}|${f.serving ?? ""}`;
    const cur = by.get(key) ?? { name: f.name, n: 0, serving: f.serving };
    cur.n += f.servings; by.set(key, cur);
  }
  return [...by.values()].map((x) => ({ id: gid(), name: x.name, qty: `${nice(x.n)} × ${x.serving || "serving"}`, aisle: aisleOf(x.name), done: false }))
    .sort((a, b) => a.aisle.localeCompare(b.aisle) || a.name.localeCompare(b.name));
}

/** The list as plain text to share or paste. */
export const groceryText = (items: GroceryItem[]) => {
  const out: string[] = []; let aisle = "";
  for (const i of items) { if (i.aisle !== aisle) { aisle = i.aisle; out.push(`\n${aisle}`); } out.push(`${i.done ? "☑" : "☐"} ${i.name}${i.qty ? ` (${i.qty})` : ""}`); }
  return `Grocery list${out.join("\n")}`.trim();
};
