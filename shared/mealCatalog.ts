// The Kitchen planner's dish library (November 2026): tap the dishes you want, match them to days, get one
// shopping list with a price. Prices are everyday US estimates for a household of 4; the AI price check
// (server/mealCost.ts) can sharpen them, and every ingredient can be renamed, branded or re-priced.
export type DishSlot = "breakfast" | "lunch" | "dinner" | "snack" | "dessert";
export type Dish = { id: string; slot: DishSlot; name: string; emoji: string; kcal: number; minutes: number; tags: string[]; pop: number; items: [name: string, qty: string, price: number][] };
export const SLOTS: { id: DishSlot; label: string; emoji: string }[] = [
  { id: "breakfast", label: "Breakfast", emoji: "🥣" }, { id: "lunch", label: "Lunch", emoji: "🥪" }, { id: "dinner", label: "Dinner", emoji: "🍽️" },
  { id: "snack", label: "Snacks", emoji: "🍎" }, { id: "dessert", label: "Desserts", emoji: "🍪" },
];
const D = (slot: DishSlot, id: string, name: string, emoji: string, kcal: number, minutes: number, tags: string, pop: number, items: [string, string, number][]): Dish => ({ id, slot, name, emoji, kcal, minutes, tags: tags.split(" ").filter(Boolean), pop, items });

export const DISHES: Dish[] = [
  D("breakfast", "b-oats", "Oatmeal with fruit", "🥣", 320, 10, "healthy lowcal quick veg", 7, [["Rolled oats", "1 canister", 1.2], ["Bananas", "1 bunch", 1.1], ["Honey", "1 squeeze", 0.4]]),
  D("breakfast", "b-eggs", "Scrambled eggs & toast", "🍳", 380, 10, "quick popular veg", 9, [["Eggs", "1 dozen", 3.2], ["Bread", "1 loaf", 0.9], ["Butter", "1 stick", 0.6]]),
  D("breakfast", "b-yogurt", "Yogurt parfait", "🍓", 290, 5, "healthy lowcal quick veg", 8, [["Plain yogurt", "32 oz", 3.5], ["Granola", "1 bag", 1.2], ["Berries", "1 pint", 2.5]]),
  D("breakfast", "b-pancake", "Pancakes", "🥞", 450, 20, "popular veg", 9, [["Pancake mix", "1 box", 2.5], ["Eggs", "2", 0.6], ["Syrup", "1 bottle", 1.0]]),
  D("breakfast", "b-burrito", "Breakfast burritos", "🌯", 480, 20, "popular", 8, [["Tortillas", "1 pack", 2.5], ["Eggs", "6", 1.6], ["Sausage", "1 roll", 3.0], ["Shredded cheese", "1 bag", 1.2]]),
  D("breakfast", "b-avotoast", "Avocado toast", "🥑", 340, 10, "healthy quick veg", 7, [["Avocados", "3", 3.0], ["Bread", "1 loaf", 0.9], ["Lemon", "1", 0.5]]),
  D("breakfast", "b-cereal", "Cereal & milk", "🥛", 260, 3, "quick lowcal budget veg", 8, [["Cereal", "1 box", 3.0], ["Milk", "1 gallon", 1.5]]),
  D("breakfast", "b-smoothie", "Fruit smoothie", "🥤", 240, 5, "healthy lowcal quick veg", 7, [["Frozen fruit", "1 bag", 3.5], ["Bananas", "1 bunch", 1.1], ["Milk", "1/2 gallon", 1.0]]),
  D("lunch", "l-pbj", "PB&J sandwiches", "🥪", 420, 5, "quick budget veg popular", 8, [["Peanut butter", "1 jar", 2.2], ["Jelly", "1 jar", 1.8], ["Bread", "1 loaf", 0.9]]),
  D("lunch", "l-grilled", "Grilled cheese & tomato soup", "🧀", 520, 15, "quick popular veg", 9, [["Bread", "1 loaf", 0.9], ["Cheese slices", "1 pack", 2.5], ["Tomato soup", "2 cans", 2.0]]),
  D("lunch", "l-wrap", "Chicken salad wraps", "🌯", 410, 15, "healthy quick", 7, [["Chicken breast", "1 lb", 3.5], ["Tortillas", "1 pack", 2.5], ["Lettuce", "1 head", 1.5], ["Mayo", "1 jar", 0.8]]),
  D("lunch", "l-quesa", "Quesadillas", "🧀", 460, 15, "quick popular veg", 8, [["Tortillas", "1 pack", 2.5], ["Shredded cheese", "1 bag", 2.4], ["Salsa", "1 jar", 2.0]]),
  D("lunch", "l-pasta", "Pasta salad", "🍝", 380, 20, "budget veg", 6, [["Rotini pasta", "1 box", 1.3], ["Italian dressing", "1 bottle", 1.8], ["Cucumber", "1", 0.8], ["Cherry tomatoes", "1 pint", 2.5]]),
  D("lunch", "l-tuna", "Tuna sandwiches", "🐟", 400, 10, "quick budget healthy", 6, [["Canned tuna", "3 cans", 3.0], ["Bread", "1 loaf", 0.9], ["Mayo", "1 jar", 0.8]]),
  D("lunch", "l-bowl", "Rice & bean bowls", "🍚", 430, 20, "healthy budget veg", 7, [["Rice", "1 bag", 1.5], ["Black beans", "2 cans", 1.6], ["Salsa", "1 jar", 2.0], ["Corn", "1 can", 0.8]]),
  D("lunch", "l-hotdog", "Hot dogs & fruit", "🌭", 440, 10, "quick budget popular", 7, [["Hot dogs", "1 pack", 2.8], ["Buns", "1 pack", 1.8], ["Apples", "4", 2.0]]),
  D("dinner", "d-tacos", "Tacos", "🌮", 560, 25, "popular", 10, [["Ground beef", "1 lb", 5.5], ["Taco shells", "1 box", 2.2], ["Taco seasoning", "1 packet", 0.8], ["Shredded cheese", "1 bag", 2.4], ["Lettuce", "1 head", 1.5]]),
  D("dinner", "d-spag", "Spaghetti & meat sauce", "🍝", 640, 30, "popular", 10, [["Spaghetti", "1 box", 1.4], ["Ground beef", "1 lb", 5.5], ["Pasta sauce", "1 jar", 2.4]]),
  D("dinner", "d-chickrice", "Chicken, rice & broccoli", "🍗", 520, 30, "healthy popular", 9, [["Chicken breast", "1.5 lb", 5.2], ["Rice", "1 bag", 1.5], ["Broccoli", "1 bag", 2.2]]),
  D("dinner", "d-stirfry", "Veggie stir-fry", "🥦", 380, 20, "healthy lowcal quick veg", 7, [["Stir-fry vegetables", "2 bags", 5.0], ["Rice", "1 bag", 1.5], ["Soy sauce", "1 bottle", 1.5]]),
  D("dinner", "d-salmon", "Salmon, rice & green beans", "🐟", 560, 25, "healthy", 7, [["Salmon fillets", "1.5 lb", 11.0], ["Rice", "1 bag", 1.5], ["Green beans", "1 bag", 2.0]]),
  D("dinner", "d-pizza", "Pizza night", "🍕", 620, 20, "quick popular budget", 10, [["Frozen pizzas", "2", 9.0], ["Salad kit", "1 bag", 3.0]]),
  D("dinner", "d-chili", "Turkey chili", "🌶️", 430, 35, "healthy budget", 6, [["Ground turkey", "1 lb", 4.5], ["Kidney beans", "2 cans", 1.8], ["Diced tomatoes", "2 cans", 2.0], ["Chili seasoning", "1 packet", 0.8]]),
  D("dinner", "d-burger", "Burgers & fries", "🍔", 720, 25, "popular", 9, [["Ground beef", "1.5 lb", 8.0], ["Buns", "1 pack", 1.8], ["Frozen fries", "1 bag", 2.8], ["Cheese slices", "1 pack", 2.5]]),
  D("snack", "s-apple", "Apples & peanut butter", "🍎", 200, 3, "healthy lowcal quick veg", 8, [["Apples", "6", 3.0], ["Peanut butter", "1 jar", 2.2]]),
  D("snack", "s-veggie", "Veggies & hummus", "🥕", 150, 5, "healthy lowcal quick veg", 7, [["Baby carrots", "1 bag", 1.8], ["Hummus", "1 tub", 3.0], ["Cucumber", "1", 0.8]]),
  D("snack", "s-popcorn", "Popcorn", "🍿", 160, 5, "lowcal budget quick veg", 8, [["Popcorn kernels", "1 bag", 2.5]]),
  D("snack", "s-cheese", "Cheese & crackers", "🧀", 230, 3, "quick popular veg", 8, [["Cheese sticks", "1 bag", 3.5], ["Crackers", "1 box", 2.5]]),
  D("snack", "s-yog", "Yogurt cups", "🥣", 120, 1, "healthy lowcal quick veg", 7, [["Yogurt cups", "1 pack", 4.0]]),
  D("snack", "s-trail", "Trail mix", "🥜", 280, 1, "healthy quick veg", 6, [["Trail mix", "1 bag", 5.0]]),
  D("snack", "s-banana", "Bananas", "🍌", 105, 1, "healthy lowcal budget quick veg", 8, [["Bananas", "1 bunch", 1.1]]),
  D("snack", "s-chips", "Chips & salsa", "🌮", 250, 2, "popular quick budget veg", 8, [["Tortilla chips", "1 bag", 3.0], ["Salsa", "1 jar", 2.0]]),
  D("dessert", "x-cookies", "Chocolate chip cookies", "🍪", 210, 30, "popular veg", 10, [["Cookie dough or mix", "1 pack", 3.0], ["Eggs", "2", 0.6], ["Butter", "1 stick", 0.6]]),
  D("dessert", "x-icecream", "Ice cream", "🍨", 270, 1, "popular quick veg", 10, [["Ice cream", "1 tub", 4.5]]),
  D("dessert", "x-fruit", "Fruit salad", "🍓", 90, 10, "healthy lowcal veg", 6, [["Berries", "1 pint", 2.5], ["Grapes", "1 bag", 3.0], ["Melon", "1", 3.0]]),
  D("dessert", "x-brownie", "Brownies", "🍫", 240, 35, "popular veg", 9, [["Brownie mix", "1 box", 2.5], ["Eggs", "2", 0.6], ["Oil", "1 bottle", 0.8]]),
  D("dessert", "x-pudding", "Pudding cups", "🍮", 150, 1, "quick budget veg", 6, [["Pudding cups", "1 pack", 3.0]]),
  D("dessert", "x-yogfrozen", "Frozen yogurt bark", "🍫", 130, 10, "healthy lowcal veg", 5, [["Greek yogurt", "1 tub", 4.0], ["Berries", "1 pint", 2.5], ["Dark chocolate", "1 bar", 2.0]]),
  D("dessert", "x-apple", "Baked cinnamon apples", "🍎", 140, 30, "healthy lowcal veg", 5, [["Apples", "4", 2.0], ["Cinnamon", "1 jar", 0.5], ["Brown sugar", "1 bag", 0.8]]),
  D("dessert", "x-popsicle", "Popsicles", "🍧", 60, 1, "lowcal budget quick veg", 7, [["Popsicles", "1 box", 3.5]]),
];

export type SortKey = "popular" | "healthy" | "calories" | "quick" | "cheap";
export const SORTS: { id: SortKey; label: string }[] = [
  { id: "popular", label: "Popular" }, { id: "healthy", label: "Healthiest" }, { id: "calories", label: "Fewest calories" }, { id: "quick", label: "20 minutes or less" }, { id: "cheap", label: "Cheapest" },
];

/** What one dish costs at the catalog's prices. */
export const dishCost = (d: Dish) => round2(d.items.reduce((a, [, , p]) => a + p, 0));
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const dishById = (id: string) => DISHES.find((d) => d.id === id);

export function dishesFor(slot: DishSlot, sort: SortKey, search = ""): Dish[] {
  const q = search.trim().toLowerCase();
  let list = DISHES.filter((d) => d.slot === slot && (!q || d.name.toLowerCase().includes(q)));
  if (sort === "quick") list = list.filter((d) => d.minutes <= 20);
  const score = (d: Dish) => sort === "healthy" ? (d.tags.includes("healthy") ? 0 : 1) * 10000 + d.kcal : sort === "calories" ? d.kcal : sort === "cheap" ? dishCost(d) : sort === "quick" ? d.minutes : -d.pop;
  return list.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
}

/** The week: a dish for a day and a meal. Keys look like "mon:dinner". */
export const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const DAY_NAME: Record<(typeof WEEK_DAYS)[number], string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
export type Week = Record<string, string>;
export const cellKey = (day: string, slot: DishSlot) => `${day}:${slot}`;

/** Spread the picked dishes over the week, one meal at a time (the first pick on Monday, and around again). */
export function autoFill(picks: Record<DishSlot, string[]>): Week {
  const week: Week = {};
  for (const s of SLOTS) { const ids = picks[s.id] ?? []; if (!ids.length) continue; WEEK_DAYS.forEach((d, i) => { week[cellKey(d, s.id)] = ids[i % ids.length]; }); }
  return week;
}

export type ShopLine = { key: string; name: string; qty: string; price: number; meals: number; brand: string };
/** One shopping list from the week. Same ingredient in two meals is one line (bought once, but sized up). */
export function shoppingFrom(week: Week, people: number): ShopLine[] {
  const scale = Math.max(0.5, people / 4);
  const by = new Map<string, ShopLine>();
  for (const id of Object.values(week)) {
    const dish = dishById(id); if (!dish) continue;
    for (const [name, qty, price] of dish.items) {
      const key = name.toLowerCase();
      const cur = by.get(key);
      if (cur) { cur.meals += 1; cur.price = round2(cur.price + price * scale * 0.85); }
      else by.set(key, { key, name, qty, price: round2(price * scale), meals: 1, brand: "" });
    }
  }
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export const totalOf = (lines: ShopLine[]) => round2(lines.reduce((a, l) => a + (Number.isFinite(l.price) ? l.price : 0), 0));

/** Work backwards from a weekly budget: start every chosen meal on its cheapest dish, then upgrade to better-liked dishes while the total fits. */
export function planForBudget(budget: number, slots: DishSlot[], people: number, sort: SortKey = "popular"): Week {
  const week: Week = {};
  const pool = (s: DishSlot) => dishesFor(s, "cheap");
  for (const s of slots) { const cheapest = pool(s); WEEK_DAYS.forEach((d, i) => { week[cellKey(d, s)] = cheapest[i % Math.min(3, cheapest.length)].id; }); }
  const cost = () => totalOf(shoppingFrom(week, people));
  if (cost() > budget) return week; // can't fit: the cheapest week is the answer, and the screen says so
  const rank = (slot: DishSlot) => { const r = dishesFor(slot, sort === "cheap" ? "popular" : sort).map((d) => d.id); return (id: string) => { const at = r.indexOf(id); return at < 0 ? 999 : at; }; };
  const uses = (id: string) => Object.values(week).filter((x) => x === id).length;
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (const k of Object.keys(week)) {
      const slot = k.split(":")[1] as DishSlot, rk = rank(slot), cur = week[k];
      const better = dishesFor(slot, sort === "cheap" ? "popular" : sort).find((d) => rk(d.id) < rk(cur) && uses(d.id) < 2);
      if (!better) continue;
      week[k] = better.id;
      if (cost() <= budget) changed = true; else week[k] = cur;
    }
    if (!changed) break;
  }
  return week;
}
