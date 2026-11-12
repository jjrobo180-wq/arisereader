// "Did you mean …?" for food typed by hand: each word that isn't a word we know is matched to the closest food word
// (one or two letters off, letters swapped), so "tortila chps" offers "tortilla chips". Nothing is changed by itself.
import { GROUPS, PRODUCTS } from "./kitchenProducts";
import { K_DISHES } from "./kitchenDishes";

const EXTRA = "apple apples banana bananas orange oranges grape grapes lemon lime strawberries blueberries raspberries watermelon peach pear pineapple mango avocado tomato tomatoes potato potatoes onion onions garlic lettuce spinach kale carrot carrots celery cucumber pepper peppers broccoli cauliflower corn peas beans mushroom mushrooms zucchini squash cabbage chicken beef pork turkey ham bacon sausage steak fish salmon tuna shrimp eggs egg milk butter cheese yogurt cream sour bread bagel bagels tortilla tortillas chips crackers cookies cereal oatmeal oats rice pasta spaghetti noodles ramen flour sugar salt honey syrup ketchup mustard mayo mayonnaise ranch dressing sauce salsa coffee tea juice soda water snacks popcorn pretzels peanut almond nuts candy chocolate ice frozen pizza soup broth vanilla cinnamon paper towels toilet tissue soap detergent dish dishwasher trash bags foil wrap diapers wipes shampoo toothpaste deodorant lotion napkins plates cups batteries goldfish cheerios spaghettios helper hamburger teriyaki rolls dinner raisin nutrigrain granola bars waffles pancakes hot dogs buns lunch meat deli";

let VOCAB: Set<string> | null = null;
const words = (t: string) => t.toLowerCase().match(/[a-z]+/g) ?? [];
function vocab(): Set<string> {
  if (VOCAB) return VOCAB;
  const v = new Set<string>(words(EXTRA));
  for (const g of GROUPS) for (const w of words(`${g.name} ${g.id}`)) v.add(w);
  for (const d of K_DISHES) for (const w of words(d.name)) v.add(w);
  for (const p of PRODUCTS) for (const w of words(`${p.brand} ${p.name}`)) v.add(w);
  return (VOCAB = v);
}

/** Letters apart: insert, delete, change, or two next to each other swapped. Stops early past max. */
export function distance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let best = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      best = Math.min(best, d[i][j]);
    }
    if (best > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** The closest known word, or null when the word is fine or nothing is close enough to be sure. */
export function closestWord(w: string, extra: Iterable<string> = []): string | null {
  const lower = w.toLowerCase();
  if (lower.length < 3) return null;
  const v = vocab();
  const more = new Set([...extra].flatMap(words));
  if (v.has(lower) || more.has(lower)) return null;
  const max = lower.length <= 4 ? 1 : 2;
  const common = new Set(words(EXTRA));
  const sub = (a: string, b: string) => { let i = 0; for (const ch of b) if (ch === a[i]) i++; return i === a.length; };
  // Lower is better: letters apart first, then a left-out letter (most typos) over a wrong one, the same first
  // and last letter, a common food word, and a length close to what was typed.
  const score = (c: string, dd: number) => dd * 100 + (sub(lower, c) ? 0 : 20) + (c[0] === lower[0] ? 0 : 10) + (c.at(-1) === lower.at(-1) ? 0 : 5) + (common.has(c) ? 0 : 3) + Math.abs(c.length - lower.length);
  let best: string | null = null, bestS = Infinity;
  for (const cand of new Set([...more, ...v])) {
    if (cand[0] !== lower[0] && lower.length <= 4) continue;
    const dd = distance(lower, cand, max);
    if (dd > max) continue;
    const sc = score(cand, dd);
    if (sc < bestS) { best = cand; bestS = sc; }
  }
  return best;
}

/** "tortila chps" → "tortilla chips"; null when every word looks right. Capitals and spacing are kept. */
export function didYouMean(text: string, extra: Iterable<string> = []): string | null {
  const list = [...extra];
  let changed = false;
  const out = text.replace(/[A-Za-z]+/g, (w) => {
    const c = closestWord(w, list); if (!c) return w;
    changed = true;
    return w[0] === w[0].toUpperCase() ? c[0].toUpperCase() + c.slice(1) : c;
  });
  return changed && out.trim() ? out : null;
}
