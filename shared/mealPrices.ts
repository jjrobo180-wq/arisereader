// LifeHub grocery meal planner: price estimates for common groceries and the math that turns what you buy
// into meals. Prices are rough U.S. store averages (2026) to plan with, not quotes; people can change any price.
import { searchByName } from "./foodSpelling";

export type PriceSlot = "breakfast" | "lunch" | "dinner";
export type PriceItem = {
  id: string; name: string; unit: string; price: number;
  /** Adult servings in one unit. */ serves: number;
  aisle: string; slot: PriceSlot; main: boolean;
};

const P = (id: string, name: string, unit: string, price: number, serves: number, aisle: string, slot: PriceSlot = "dinner", main = true): PriceItem => ({ id, name, unit, price, serves, aisle, slot, main });

export const PRICE_LIST: PriceItem[] = [
  // Meat and fish
  P("beef", "Burger (ground beef)", "1 lb", 5.49, 4, "Meat & fish"),
  P("patties", "Frozen burger patties", "4 pack", 7.99, 4, "Meat & fish"),
  P("chicken", "Chicken breast", "1 lb", 3.99, 3, "Meat & fish"),
  P("thighs", "Chicken thighs", "1 lb", 2.79, 3, "Meat & fish"),
  P("wholechicken", "Whole chicken", "1 chicken", 9.99, 6, "Meat & fish"),
  P("wings", "Chicken wings", "1 lb", 4.49, 2, "Meat & fish"),
  P("turkey", "Ground turkey", "1 lb", 4.99, 4, "Meat & fish"),
  P("steak", "Steak", "1 lb", 11.99, 2, "Meat & fish"),
  P("porkchops", "Pork chops", "1 lb", 4.29, 3, "Meat & fish"),
  P("sausage", "Sausage", "1 lb", 4.99, 4, "Meat & fish"),
  P("bacon", "Bacon", "12 oz", 6.49, 4, "Meat & fish", "breakfast"),
  P("ham", "Deli ham", "1 lb", 6.99, 6, "Meat & fish", "lunch"),
  P("turkeydeli", "Deli turkey", "1 lb", 7.49, 6, "Meat & fish", "lunch"),
  P("hotdogs", "Hot dogs", "8 pack", 4.49, 4, "Meat & fish"),
  P("salmon", "Salmon", "1 lb", 10.99, 3, "Meat & fish"),
  P("tilapia", "Tilapia", "1 lb", 6.49, 3, "Meat & fish"),
  P("shrimp", "Shrimp", "1 lb", 9.99, 3, "Frozen"),
  P("tuna", "Canned tuna", "1 can", 1.49, 2, "Pantry", "lunch"),
  P("roast", "Pot roast", "3 lb", 22.99, 8, "Meat & fish"),
  // Dairy and eggs
  P("eggs", "Eggs", "1 dozen", 3.49, 6, "Dairy & eggs", "breakfast"),
  P("milk", "Milk", "1 gallon", 3.99, 16, "Dairy & eggs", "breakfast", false),
  P("cheese", "Shredded cheese", "8 oz", 3.49, 8, "Dairy & eggs", "dinner", false),
  P("cheeseslices", "Cheese slices", "16 slices", 3.99, 16, "Dairy & eggs", "lunch", false),
  P("yogurt", "Yogurt", "32 oz", 4.49, 8, "Dairy & eggs", "breakfast"),
  P("butter", "Butter", "1 lb", 4.99, 32, "Dairy & eggs", "dinner", false),
  P("sourcream", "Sour cream", "16 oz", 2.49, 8, "Dairy & eggs", "dinner", false),
  // Bakery and grains
  P("bread", "Bread", "1 loaf", 3.29, 10, "Bakery", "lunch", false),
  P("buns", "Hamburger buns", "8 pack", 3.49, 8, "Bakery", "dinner", false),
  P("hotdogbuns", "Hot dog buns", "8 pack", 3.29, 8, "Bakery", "dinner", false),
  P("tortillas", "Tortillas", "10 pack", 3.29, 5, "Bakery", "dinner", false),
  P("bagels", "Bagels", "6 pack", 3.99, 6, "Bakery", "breakfast"),
  P("pasta", "Pasta", "1 lb", 1.69, 8, "Pantry", "dinner", false),
  P("spaghetti", "Spaghetti", "1 lb", 1.69, 8, "Pantry", "dinner", false),
  P("rice", "Rice", "2 lb", 3.29, 20, "Pantry", "dinner", false),
  P("macandcheese", "Boxed mac and cheese", "1 box", 1.29, 3, "Pantry", "lunch"),
  P("ramen", "Ramen noodles", "6 pack", 2.49, 6, "Pantry", "lunch"),
  P("oatmeal", "Oatmeal", "42 oz", 5.49, 30, "Pantry", "breakfast"),
  P("cereal", "Cereal", "1 box", 4.49, 10, "Pantry", "breakfast"),
  P("pancakemix", "Pancake mix", "32 oz", 3.49, 12, "Pantry", "breakfast"),
  // Pantry
  P("pastasauce", "Pasta sauce", "24 oz jar", 3.29, 6, "Pantry", "dinner", false),
  P("tacoseasoning", "Taco seasoning", "1 packet", 1.19, 4, "Pantry", "dinner", false),
  P("beans", "Canned beans", "1 can", 1.29, 3, "Pantry", "dinner", false),
  P("soup", "Canned soup", "1 can", 2.29, 2, "Pantry", "lunch"),
  P("chili", "Canned chili", "1 can", 2.99, 2, "Pantry", "lunch"),
  P("pb", "Peanut butter", "16 oz", 3.29, 14, "Pantry", "lunch", false),
  P("jelly", "Jelly", "18 oz", 2.99, 16, "Pantry", "lunch", false),
  P("syrup", "Syrup", "24 oz", 3.99, 12, "Pantry", "breakfast", false),
  P("broth", "Chicken broth", "32 oz", 2.49, 4, "Pantry", "dinner", false),
  // Produce
  P("potatoes", "Potatoes", "5 lb bag", 4.99, 10, "Produce", "dinner", false),
  P("onions", "Onions", "3 lb bag", 3.49, 12, "Produce", "dinner", false),
  P("lettuce", "Lettuce", "1 head", 1.99, 4, "Produce", "dinner", false),
  P("salad", "Bagged salad", "10 oz", 3.49, 4, "Produce", "dinner", false),
  P("tomatoes", "Tomatoes", "1 lb", 2.29, 4, "Produce", "dinner", false),
  P("broccoli", "Broccoli", "1 lb", 2.49, 4, "Produce", "dinner", false),
  P("carrots", "Carrots", "2 lb", 2.29, 8, "Produce", "dinner", false),
  P("corn", "Corn", "4 ears", 2.99, 4, "Produce", "dinner", false),
  P("greenbeans", "Green beans", "1 lb", 2.49, 4, "Produce", "dinner", false),
  P("peppers", "Bell peppers", "3 pack", 3.99, 6, "Produce", "dinner", false),
  P("bananas", "Bananas", "1 bunch", 1.69, 6, "Produce", "breakfast", false),
  P("apples", "Apples", "3 lb bag", 4.99, 9, "Produce", "lunch", false),
  P("strawberries", "Strawberries", "1 lb", 3.99, 4, "Produce", "breakfast", false),
  P("avocados", "Avocados", "4 pack", 4.99, 4, "Produce", "dinner", false),
  // Frozen and ready
  P("pizza", "Frozen pizza", "1 pizza", 6.99, 3, "Frozen"),
  P("nuggets", "Chicken nuggets", "2 lb bag", 9.99, 6, "Frozen"),
  P("fries", "Frozen fries", "2 lb bag", 3.99, 6, "Frozen", "dinner", false),
  P("frozenveg", "Frozen vegetables", "12 oz", 1.99, 4, "Frozen", "dinner", false),
  P("lasagna", "Frozen lasagna", "family size", 13.99, 6, "Frozen"),
  P("burritos", "Frozen burritos", "8 pack", 7.99, 4, "Frozen", "lunch"),
  P("waffles", "Frozen waffles", "10 pack", 3.49, 5, "Frozen", "breakfast"),
  P("rotisserie", "Rotisserie chicken", "1 chicken", 6.99, 5, "Meat & fish"),
  // Drinks and snacks
  P("juice", "Juice", "64 oz", 3.99, 8, "Drinks", "breakfast", false),
  P("chips", "Chips", "1 bag", 4.49, 8, "Snacks", "lunch", false),
];

export const priceItem = (id: string) => PRICE_LIST.find((p) => p.id === id);

/** Items that fit what was typed, best first; spelling doesn't have to be exact. */
export function searchPrices(typed: string, limit = 6): PriceItem[] {
  return typed.trim() ? searchByName(PRICE_LIST, typed, limit) : [];
}

/** Serving sizes a person can be given, in adult servings. */
export const SERVING_SIZES = [0, 0.5, 1, 1.5, 2] as const;
export const servingWord = (n: number) => (n === 0 ? "Not eating" : n === 0.5 ? "Small (½)" : n === 1 ? "Regular" : n === 1.5 ? "Big (1½)" : "Extra big (2)");
/** A person's usual serving: a regular one for adults, a small one for kids. */
export const defaultServing = (kind: "adult" | "kid") => (kind === "kid" ? 0.5 : 1);

/** Adult servings one meal takes for everyone eating. */
export const perMeal = (servings: number[]) => servings.reduce((a, b) => a + (Number.isFinite(b) && b > 0 ? b : 0), 0);

/**
 * How many meals an amount of food makes for this household, and what's left over or short.
 * 1 lb of burger serves 4; a family that eats 3 servings a meal gets 1 meal with 1 serving left over.
 */
export function mealsFrom(item: Pick<PriceItem, "serves">, qty: number, servingsPerMeal: number) {
  const total = Math.max(0, item.serves * qty);
  if (servingsPerMeal <= 0) return { meals: 0, total, left: total, short: 0 };
  const meals = Math.floor(total / servingsPerMeal + 1e-9);
  if (meals === 0) return { meals: 1, total, left: 0, short: round1(servingsPerMeal - total) };
  return { meals, total, left: round1(total - meals * servingsPerMeal), short: 0 };
}
/** Units to buy so it covers `meals` meals. */
export const unitsFor = (item: Pick<PriceItem, "serves">, meals: number, servingsPerMeal: number) => Math.max(1, Math.ceil((meals * servingsPerMeal) / item.serves - 1e-9));
const round1 = (n: number) => Math.round(n * 10) / 10;
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** The days, in order, that don't have a meal in this slot yet. */
export function emptyDays(days: string[], slot: string, meals: { date: string; slot: string }[]) {
  return days.filter((d) => !meals.some((m) => m.date === d && m.slot === slot));
}

/** Cheap dinners to fill empty days: what to buy for a family that eats `servingsPerMeal`. */
export type MealIdea = { title: string; items: string[] };
export const MEAL_IDEAS: MealIdea[] = [
  { title: "Tacos", items: ["beef", "tortillas", "tacoseasoning", "cheese", "lettuce"] },
  { title: "Spaghetti and meat sauce", items: ["beef", "spaghetti", "pastasauce", "salad"] },
  { title: "Burgers and fries", items: ["beef", "buns", "fries", "cheeseslices"] },
  { title: "Chicken, rice and broccoli", items: ["chicken", "rice", "broccoli"] },
  { title: "Breakfast for dinner", items: ["eggs", "pancakemix", "bacon", "bananas"] },
  { title: "Baked chicken thighs and potatoes", items: ["thighs", "potatoes", "greenbeans"] },
  { title: "Hot dogs and corn", items: ["hotdogs", "hotdogbuns", "corn"] },
  { title: "Pork chops and carrots", items: ["porkchops", "carrots", "potatoes"] },
  { title: "Turkey chili", items: ["turkey", "beans", "onions", "sourcream"] },
  { title: "Rotisserie chicken night", items: ["rotisserie", "salad", "bread"] },
  { title: "Frozen pizza night", items: ["pizza", "salad"] },
  { title: "Salmon, rice and green beans", items: ["salmon", "rice", "greenbeans"] },
];

/** Groceries and an estimated cost for one idea, sized for the household (main dish scaled, sides once). */
export function ideaCost(idea: MealIdea, servingsPerMeal: number) {
  const lines = idea.items.map((id) => priceItem(id)).filter((p): p is PriceItem => !!p).map((p) => {
    const qty = p.main ? unitsFor(p, 1, servingsPerMeal) : Math.max(1, Math.ceil(servingsPerMeal / p.serves - 1e-9));
    return { item: p, qty, cost: round2(qty * p.price) };
  });
  return { lines, cost: round2(lines.reduce((a, l) => a + l.cost, 0)) };
}

/** "$5.49" */
export const dollars = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;
