// Cooked: healthy recipes that fit your goal and what's left of today's calories and protein.
// Each has its numbers per serving (worked out from USDA values for the ingredients, rounded) so
// "Log it" adds it to Food in one tap. The AI can also make one from what's in your kitchen
// (POST /api/fit/recipe in server/fit.ts), shaped the same way.
export type RecipeTag = "breakfast" | "lunch" | "dinner" | "snack" | "post-workout" | "high-protein" | "low-cal" | "quick" | "vegetarian" | "meal-prep";
export type Recipe = { id: string; name: string; e: string; mins: number; serves: number; tags: RecipeTag[];
  /** Per serving. */ kcal: number; p: number; c: number; f: number; ingredients: string[]; steps: string[] };

export const TAG_NAME: Record<RecipeTag, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack", "post-workout": "After a workout", "high-protein": "High protein", "low-cal": "Low calorie", quick: "15 min or less", vegetarian: "Vegetarian", "meal-prep": "Meal prep" };

export const RECIPES: Recipe[] = [
  { id: "protein-oats", name: "Protein overnight oats", e: "", mins: 5, serves: 1, tags: ["breakfast", "high-protein", "quick", "vegetarian", "meal-prep"], kcal: 420, p: 33, c: 52, f: 9,
    ingredients: ["½ cup rolled oats", "¾ cup nonfat Greek yogurt", "½ cup milk (any)", "½ cup berries", "1 tsp honey", "1 tbsp chia seeds"],
    steps: ["Stir everything except the berries in a jar.", "Cover and refrigerate overnight (or at least 4 hours).", "Top with berries in the morning."] },
  { id: "egg-white-scramble", name: "Veggie egg white scramble", e: "", mins: 10, serves: 1, tags: ["breakfast", "high-protein", "low-cal", "quick", "vegetarian"], kcal: 260, p: 30, c: 18, f: 7,
    ingredients: ["1 cup liquid egg whites", "1 whole egg", "1 cup spinach", "½ bell pepper, diced", "¼ cup salsa", "1 slice whole-wheat toast"],
    steps: ["Cook the pepper in a nonstick pan for 2 minutes.", "Add the spinach until it wilts.", "Pour in the egg whites and egg; stir gently until set.", "Top with salsa; serve with the toast."] },
  { id: "greek-yogurt-bowl", name: "Greek yogurt power bowl", e: "", mins: 3, serves: 1, tags: ["breakfast", "snack", "post-workout", "high-protein", "quick", "vegetarian"], kcal: 330, p: 28, c: 40, f: 7,
    ingredients: ["1 cup nonfat Greek yogurt", "1 banana, sliced", "¼ cup granola", "1 tsp honey"],
    steps: ["Spoon the yogurt into a bowl.", "Top with banana, granola and honey."] },
  { id: "chicken-rice-bowl", name: "Chicken, rice & broccoli bowl", e: "", mins: 25, serves: 4, tags: ["lunch", "dinner", "post-workout", "high-protein", "meal-prep"], kcal: 480, p: 45, c: 52, f: 9,
    ingredients: ["1½ lb chicken breast", "1½ cups dry jasmine rice", "4 cups broccoli florets", "2 tbsp low-sodium soy sauce", "1 tbsp honey", "1 tsp garlic powder", "1 tbsp olive oil"],
    steps: ["Cook the rice.", "Season the chicken with garlic powder, salt and pepper; cook in the oil over medium-high, 6–7 minutes a side, until 165 °F inside.", "Steam the broccoli 4–5 minutes.", "Slice the chicken, mix soy sauce and honey, and drizzle over 4 bowls of rice, chicken and broccoli."] },
  { id: "turkey-taco-bowl", name: "Turkey taco bowl", e: "", mins: 20, serves: 4, tags: ["lunch", "dinner", "high-protein", "meal-prep"], kcal: 470, p: 38, c: 45, f: 15,
    ingredients: ["1 lb 93% lean ground turkey", "1 packet taco seasoning (or 2 tbsp homemade)", "1 can black beans, rinsed", "2 cups cooked brown rice", "1 cup corn", "1 cup salsa", "Lettuce, lime"],
    steps: ["Brown the turkey, breaking it up, about 8 minutes.", "Add the seasoning and ¼ cup water; simmer 3 minutes.", "Warm the beans and corn.", "Build bowls: lettuce, rice, beans, corn, turkey, salsa and a squeeze of lime."] },
  { id: "salmon-sheet-pan", name: "Sheet-pan salmon & potatoes", e: "", mins: 30, serves: 2, tags: ["dinner", "high-protein"], kcal: 520, p: 38, c: 40, f: 22,
    ingredients: ["2 salmon fillets (5 oz each)", "1 lb baby potatoes, halved", "2 cups green beans", "1 tbsp olive oil", "1 lemon", "Garlic powder, salt, pepper"],
    steps: ["Heat the oven to 425 °F.", "Toss the potatoes with half the oil; roast 15 minutes.", "Add the green beans and salmon, drizzle the rest of the oil, season, and add lemon slices.", "Roast 12 more minutes, until the salmon flakes."] },
  { id: "shrimp-stir-fry", name: "Garlic shrimp stir-fry", e: "", mins: 15, serves: 2, tags: ["dinner", "high-protein", "low-cal", "quick"], kcal: 360, p: 34, c: 38, f: 8,
    ingredients: ["10 oz shrimp, peeled", "4 cups stir-fry vegetables", "2 tbsp low-sodium soy sauce", "1 tbsp honey", "3 cloves garlic", "1 tsp sesame oil", "1 cup cooked rice"],
    steps: ["Cook the garlic in the sesame oil for 30 seconds.", "Add the vegetables; stir-fry 4 minutes.", "Add the shrimp; cook 3 minutes until pink.", "Stir in soy sauce and honey; serve over rice."] },
  { id: "tuna-wrap", name: "Tuna salad wrap", e: "", mins: 5, serves: 1, tags: ["lunch", "high-protein", "quick"], kcal: 380, p: 38, c: 30, f: 12,
    ingredients: ["1 can tuna in water, drained", "2 tbsp nonfat Greek yogurt", "1 tbsp light mayo", "Celery, mustard, pepper", "1 large whole-wheat tortilla", "Lettuce, tomato"],
    steps: ["Mix the tuna, yogurt, mayo, celery and mustard.", "Fill the tortilla with lettuce, tomato and the tuna; roll it up."] },
  { id: "lentil-soup", name: "Hearty lentil soup", e: "", mins: 40, serves: 6, tags: ["lunch", "dinner", "vegetarian", "meal-prep", "low-cal"], kcal: 290, p: 17, c: 45, f: 5,
    ingredients: ["1½ cups dry lentils", "1 onion, 2 carrots, 2 celery stalks, diced", "1 can diced tomatoes", "6 cups vegetable broth", "2 tsp cumin", "1 tbsp olive oil", "2 cups spinach"],
    steps: ["Cook the onion, carrot and celery in the oil for 5 minutes.", "Add lentils, tomatoes, broth and cumin; simmer 25–30 minutes.", "Stir in the spinach; season to taste."] },
  { id: "chicken-chili", name: "White chicken chili", e: "", mins: 35, serves: 6, tags: ["dinner", "high-protein", "meal-prep"], kcal: 360, p: 36, c: 32, f: 9,
    ingredients: ["1½ lb chicken breast", "2 cans white beans, rinsed", "1 can green chiles", "1 onion, diced", "4 cups chicken broth", "2 tsp cumin, 1 tsp oregano", "½ cup nonfat Greek yogurt"],
    steps: ["Simmer the chicken, onion, chiles, spices and broth for 20 minutes.", "Take out the chicken, shred it, and return it.", "Add the beans; simmer 10 minutes.", "Take off the heat and stir in the yogurt."] },
  { id: "cottage-cheese-toast", name: "Cottage cheese toast", e: "", mins: 5, serves: 1, tags: ["breakfast", "snack", "high-protein", "quick", "vegetarian"], kcal: 290, p: 22, c: 30, f: 8,
    ingredients: ["2 slices whole-grain bread", "¾ cup low-fat cottage cheese", "Cherry tomatoes or sliced peaches", "Salt and pepper, or a drizzle of honey"],
    steps: ["Toast the bread.", "Spread with cottage cheese.", "Top with tomatoes and pepper (savory) or peaches and honey (sweet)."] },
  { id: "protein-smoothie", name: "Peanut butter banana shake", e: "", mins: 3, serves: 1, tags: ["breakfast", "post-workout", "high-protein", "quick", "vegetarian"], kcal: 430, p: 35, c: 47, f: 13,
    ingredients: ["1 scoop whey or plant protein", "1 frozen banana", "1 tbsp peanut butter", "1 cup milk (any)", "Ice"],
    steps: ["Blend until smooth."] },
  { id: "beef-sweet-potato", name: "Lean beef & sweet potato skillet", e: "", mins: 25, serves: 4, tags: ["dinner", "post-workout", "high-protein", "meal-prep"], kcal: 450, p: 32, c: 38, f: 18,
    ingredients: ["1 lb 90% lean ground beef", "2 medium sweet potatoes, diced small", "1 bell pepper, 1 onion, diced", "2 cups spinach", "1 tsp paprika, 1 tsp garlic powder", "1 tbsp olive oil"],
    steps: ["Cook the sweet potato in the oil, covered, 10 minutes, stirring now and then.", "Add the beef, onion and pepper; cook until browned, 8 minutes.", "Season, then stir in the spinach until it wilts."] },
  { id: "tofu-bowl", name: "Crispy tofu peanut bowl", e: "", mins: 25, serves: 2, tags: ["dinner", "vegetarian", "high-protein"], kcal: 520, p: 28, c: 55, f: 21,
    ingredients: ["14 oz extra-firm tofu, pressed and cubed", "1 tbsp cornstarch", "2 cups cooked brown rice", "2 cups edamame and shredded carrot", "2 tbsp peanut butter, 1 tbsp soy sauce, 1 tsp sriracha, lime"],
    steps: ["Toss the tofu in cornstarch; air-fry or bake at 400 °F for 20 minutes.", "Whisk the peanut butter, soy sauce, sriracha, lime and 2 tbsp warm water.", "Build bowls and drizzle with the sauce."] },
  { id: "turkey-meatballs", name: "Turkey meatballs & zucchini pasta", e: "", mins: 30, serves: 4, tags: ["dinner", "high-protein", "low-cal", "meal-prep"], kcal: 340, p: 33, c: 20, f: 14,
    ingredients: ["1 lb 93% lean ground turkey", "1 egg, ¼ cup breadcrumbs", "1 tsp Italian seasoning", "2 cups marinara", "4 zucchini, spiralized (or 4 oz whole-wheat pasta)"],
    steps: ["Mix turkey, egg, breadcrumbs and seasoning; roll into 16 balls.", "Bake at 400 °F for 18 minutes.", "Warm the marinara, add the meatballs.", "Cook the zucchini noodles 2 minutes and top with meatballs and sauce."] },
  { id: "hummus-plate", name: "Hummus snack plate", e: "", mins: 5, serves: 1, tags: ["snack", "vegetarian", "quick", "low-cal"], kcal: 240, p: 11, c: 26, f: 11,
    ingredients: ["¼ cup hummus", "Carrots, cucumber, bell pepper", "1 hard-boiled egg", "A few whole-grain crackers"],
    steps: ["Arrange and dip."] },
  { id: "jerky-snack", name: "Grab-and-go protein snack", e: "", mins: 1, serves: 1, tags: ["snack", "high-protein", "quick", "post-workout"], kcal: 250, p: 25, c: 22, f: 6,
    ingredients: ["1 oz beef or turkey jerky", "1 string cheese", "1 apple"],
    steps: ["Pack it and go."] },
];
export const RECIPE_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

/**
 * Recipes ranked for right now: ones that fit what's left of today's calories, with more protein per
 * calorie first when protein is behind, and the meal that fits the time of day.
 */
export function pickRecipes(left: { kcal: number; p: number }, opts: { tag?: RecipeTag | "all"; hour?: number; goal?: "lose" | "maintain" | "gain" } = {}): Recipe[] {
  const hour = opts.hour ?? 12;
  const meal: RecipeTag = hour < 10 ? "breakfast" : hour < 15 ? "lunch" : hour < 21 ? "dinner" : "snack";
  const list = opts.tag && opts.tag !== "all" ? RECIPES.filter((r) => r.tags.includes(opts.tag as RecipeTag)) : RECIPES;
  const score = (r: Recipe) => {
    let s = 0;
    if (r.tags.includes(meal)) s += 3;
    if (left.kcal > 0 && r.kcal <= left.kcal) s += 2; else if (left.kcal > 0) s -= 3;
    if (left.p > 20) s += (r.p / r.kcal) * 40; // protein per calorie
    if (opts.goal === "lose" && r.tags.includes("low-cal")) s += 1.5;
    if (opts.goal === "gain" && r.kcal >= 450) s += 1;
    return s;
  };
  return [...list].sort((a, b) => score(b) - score(a) || a.mins - b.mins);
}

/** An AI recipe (or anything else), made safe to show and log. null when it isn't usable. */
export function cleanRecipe(raw: any): Recipe | null {
  if (!raw || typeof raw !== "object") return null;
  const n = (v: unknown, hi: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x >= 0 && x <= hi ? x : null; };
  const strs = (v: unknown, max: number) => (Array.isArray(v) ? v : []).map((s) => String(s ?? "").trim().slice(0, 200)).filter(Boolean).slice(0, max);
  const name = String(raw.name ?? "").trim().slice(0, 80);
  const kcal = n(raw.kcal, 3000), p = n(raw.p, 300), c = n(raw.c, 400), f = n(raw.f, 200);
  const ingredients = strs(raw.ingredients, 20), steps = strs(raw.steps, 12);
  if (!name || kcal === null || p === null || c === null || f === null || !ingredients.length || !steps.length) return null;
  const tags = strs(raw.tags, 6).filter((t): t is RecipeTag => t in TAG_NAME);
  return { id: `ai-${Date.now().toString(36)}`, name, e: "", mins: n(raw.mins, 240) ?? 20, serves: Math.max(1, n(raw.serves, 12) ?? 1), tags, kcal, p, c, f, ingredients, steps };
}
