// Automatic calories for the Family Hub food diary: turns answers from the USDA food database,
// Open Food Facts and the AI estimate into one food shape. Pure functions, so they can be tested offline.

export type FoundFood = { name: string; brand: string; serving: string; calories: number; protein: number; carbs: number; fat: number; source: "usda" | "off" | "ai" };

const n = (v: unknown) => { const x = typeof v === "string" ? Number(v) : v; return typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : NaN; };
const r1 = (x: number) => Math.round(x * 10) / 10;
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
/** "BLUEBERRIES, RAW" → "Blueberries, raw" */
const tidy = (s: string) => (s && s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s);
const ok = (f: FoundFood) => f.name && Number.isFinite(f.calories) && f.calories <= 20000;
const fin = (x: number) => (Number.isFinite(x) ? r1(Math.min(x, 2000)) : 0);

/** One Open Food Facts product. Per serving when the label gives it, otherwise per 100 g. */
export function parseOffProduct(p: any): FoundFood | null {
  if (!p || typeof p !== "object") return null;
  const nm = p.nutriments || {};
  const name = text(p.product_name || p.generic_name, 100);
  const perServing = Number.isFinite(n(nm["energy-kcal_serving"]));
  const pick = (key: string) => n(nm[`${key}_${perServing ? "serving" : "100g"}`]);
  let calories = pick("energy-kcal");
  if (!Number.isFinite(calories)) { const kj = n(nm[`energy-kj_${perServing ? "serving" : "100g"}`]); if (Number.isFinite(kj)) calories = kj / 4.184; }
  const food: FoundFood = {
    name: tidy(name), brand: text(String(p.brands || "").split(",")[0], 60),
    serving: perServing ? text(p.serving_size, 60) || "1 serving" : "100 g",
    calories: Math.round(calories), protein: fin(pick("proteins")), carbs: fin(pick("carbohydrates")), fat: fin(pick("fat")), source: "off",
  };
  return ok(food) ? food : null;
}

const FDC = { calories: ["208", "957", "958"], protein: ["203"], carbs: ["205"], fat: ["204"] } as const;
/** One USDA FoodData Central search result. Values come per 100 g; a household measure is used when given. */
export function parseFdcFood(f: any): FoundFood | null {
  if (!f || typeof f !== "object") return null;
  const values: Record<string, number> = {};
  for (const x of Array.isArray(f.foodNutrients) ? f.foodNutrients : []) {
    const num = String(x?.nutrientNumber ?? "");
    const unit = String(x?.unitName ?? "").toUpperCase();
    if (FDC.calories.includes(num as never) && unit && unit !== "KCAL") continue;
    if (!(num in values) && Number.isFinite(n(x?.value))) values[num] = n(x.value);
  }
  const per100 = (keys: readonly string[]) => keys.map((k) => values[k]).find((v) => Number.isFinite(v)) ?? NaN;
  let grams = 100;
  let serving = "100 g";
  const measure = (Array.isArray(f.foodMeasures) ? f.foodMeasures : []).find((m: any) => Number.isFinite(n(m?.gramWeight)) && n(m.gramWeight) > 0 && text(m?.disseminationText, 40) && !/quantity not specified/i.test(m.disseminationText));
  const size = n(f.servingSize);
  const unit = String(f.servingSizeUnit || "").toLowerCase();
  if (Number.isFinite(size) && size > 0 && (unit === "g" || unit === "ml" || unit === "grm" || unit === "mlt")) {
    grams = size;
    serving = text(f.householdServingFullText, 40) || `${r1(size)} ${unit.startsWith("m") ? "ml" : "g"}`;
  } else if (measure) {
    grams = n(measure.gramWeight);
    serving = `${text(measure.disseminationText, 40)} (${Math.round(grams)} g)`;
  }
  const scale = grams / 100;
  const food: FoundFood = {
    name: tidy(text(f.description, 100)), brand: text(f.brandName || f.brandOwner, 60), serving,
    calories: Math.round(per100(FDC.calories) * scale), protein: fin(per100(FDC.protein) * scale), carbs: fin(per100(FDC.carbs) * scale), fat: fin(per100(FDC.fat) * scale), source: "usda",
  };
  return ok(food) ? food : null;
}

/** Joins both databases, generic foods first, without repeating the same name and brand. */
export function mergeFound(lists: FoundFood[][], limit = 25): FoundFood[] {
  const seen = new Set<string>();
  const out: FoundFood[] = [];
  const rounds = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < rounds && out.length < limit; i++) {
    for (const list of lists) {
      const f = list[i];
      if (!f) continue;
      const key = `${f.name}|${f.brand}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** What the AI sends back for "describe or snap a meal", checked and kept to sane sizes. */
export function cleanAiFoods(raw: unknown): FoundFood[] {
  const items = (raw && typeof raw === "object" && Array.isArray((raw as any).items)) ? (raw as any).items : [];
  return items.slice(0, 15).map((x: any) => ({
    name: text(x?.name, 100), brand: "", serving: text(x?.serving, 60) || "1 serving",
    calories: Math.round(Math.min(n(x?.calories), 5000)), protein: fin(n(x?.protein)), carbs: fin(n(x?.carbs)), fat: fin(n(x?.fat)), source: "ai" as const,
  })).filter(ok);
}

export const FOOD_AI_PROMPT = `You estimate nutrition for a family food diary, like a dietitian would from a description or a photo of a meal.
Split the meal into separate foods and drinks. For each, estimate the amount shown or described and give the nutrition for that whole amount.
Use typical restaurant or home portions when the amount is not given. If a brand or restaurant is named, use its published values when you know them.
Reply with JSON only: {"items":[{"name":"Pepperoni pizza","serving":"2 large slices","calories":620,"protein":26,"carbs":68,"fat":26}]}
Calories are kcal; protein, carbs and fat are grams. Names are short and plain. If there is no food, reply {"items":[]}.`;

export const isBarcode = (code: unknown): code is string => typeof code === "string" && /^\d{8,14}$/.test(code);
