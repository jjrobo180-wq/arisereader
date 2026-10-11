// Arise LifeHub: food search that forgives spelling. "chiken", "bananna", "brocoli" and a half-typed
// "yog" all find what was meant. Used for the foods in the app, and to fix a search before it goes to
// the food databases (USDA and Open Food Facts), which only find words spelled right.
import { COMMON_FOODS } from "./familyHealth";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const words = (s: string) => norm(s).split(" ").filter(Boolean);

/** How many letters to add, drop, change or swap to turn one word into the other (Damerau–Levenshtein), stopping early past `max`. */
export function editDistance(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let best = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      best = Math.min(best, d[i][j]);
    }
    if (best > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** Mistakes allowed in a word this long: none in short words, one in medium ones, two in long ones. */
const allowed = (len: number) => (len <= 3 ? 0 : len <= 6 ? 1 : 2);

/** How well one typed word fits one word of a food's name (0 when it doesn't). */
function wordFit(typed: string, word: string): number {
  if (word === typed) return 4;
  if (typed.length >= 2 && word.startsWith(typed)) return 3; // still typing
  if (typed.length >= 4 && editDistance(typed, word, 2) <= allowed(Math.max(typed.length, word.length))) return 2; // misspelled
  // Misspelled while still typing: "chik" for chicken.
  if (typed.length >= 4 && word.length > typed.length && editDistance(typed, word.slice(0, typed.length), 1) <= 1) return 1.5;
  return 0;
}

/**
 * How well a food's name fits what was typed: 0 for no fit, more for a better one. The name holding the words as
 * typed comes first, then names that start with them, then misspellings. Every typed word must fit some word.
 */
export function foodScore(name: string, typed: string): number {
  const q = norm(typed), n = norm(name);
  if (!q) return 1;
  if (n.includes(q)) return 100 - Math.min(50, n.indexOf(q));
  const nameWords = words(name);
  let total = 0;
  for (const t of words(typed)) {
    const fit = Math.max(0, ...nameWords.map((w) => wordFit(t, w)));
    if (!fit) return 0;
    total += fit;
  }
  return total;
}

/** The foods that fit what was typed, best first. */
export function searchByName<T extends { name: string }>(list: T[], typed: string, limit: number): T[] {
  if (!norm(typed)) return list.slice(0, limit);
  return list.map((item, i) => ({ item, i, s: foodScore(item.name, typed) })).filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i).slice(0, limit).map((x) => x.item);
}

/** Food words the databases know, to fix a search with: the names of the common foods plus everyday groceries and dishes. */
const EXTRA = `apple apples applesauce avocado bacon bagel banana bananas beans beef berries biscuit blueberries bread breakfast broccoli brownie burger burrito butter cabbage cake candy cantaloupe carrot carrots cashews casserole cereal cheddar cheese cheeseburger cheesecake cherries chicken chili chips chocolate cinnamon coffee cookie cookies corn cottage crackers cream croissant cucumber cupcake curry donut doughnut dumplings eggs egg enchilada fajita fries frosting fruit garlic granola grapes gravy guacamole ham hamburger hummus icecream jelly juice kale ketchup lasagna lemon lemonade lettuce lobster macaroni mango mayonnaise meatballs melon milk muffin mushrooms mustard nachos noodles nuts oatmeal oats olive omelet onion orange pancakes pasta peach peanut peanuts pear peas pepperoni pepper pickles pie pineapple pizza popcorn pork potato potatoes pretzel protein pudding quesadilla quinoa raisins ramen raspberries rice salad salami salmon salsa sandwich sausage shrimp smoothie soda soup spaghetti spinach squash steak strawberries strawberry sushi syrup taco tacos tea toast tofu tomato tomatoes tortilla tuna turkey vanilla vegetables waffle waffles walnuts water watermelon wrap yogurt zucchini grilled fried baked roasted scrambled boiled whole wheat white brown sweet sour skim chobani cheerios oreo doritos cheetos starbucks mcdonalds chipotle subway wendys tacobell`;
const VOCAB = [...new Set([...COMMON_FOODS.flatMap((f) => words(f.name)), ...EXTRA.split(/\s+/)])].filter((w) => w.length >= 3);

/**
 * A search with its misspelled words fixed ("chiken nugets" is chicken nuggets), or null when nothing needed
 * fixing. Only words that are not food words and are close to exactly one best food word are changed.
 */
export function fixFoodSpelling(typed: string, vocab: string[] = VOCAB): string | null {
  const ws = words(typed);
  let changed = false;
  const out = ws.map((w) => {
    if (w.length < 4 || /\d/.test(w) || vocab.includes(w)) return w;
    let best = "", bestD = 99, tie = false;
    for (const v of vocab) {
      const d = editDistance(w, v, 2);
      if (d < bestD) { best = v; bestD = d; tie = false; } else if (d === bestD && v !== best) tie = true;
    }
    if (bestD <= allowed(Math.max(w.length, best.length)) && !tie) { changed = true; return best; }
    return w;
  });
  return changed ? out.join(" ") : null;
}
