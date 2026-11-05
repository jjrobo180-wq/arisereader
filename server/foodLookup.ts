// Family Hub food diary: automatic calories.
// - search: USDA FoodData Central + Open Food Facts (brands and restaurant items)
// - barcode: Open Food Facts
// - estimate: the site's AI estimates a described meal or a photo of one
// Nothing sent here is stored or logged; only failures' status codes are.
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { fixFoodSpelling } from "../shared/foodSpelling";
import { gradeFood, gradeOff, gradeProduct } from "../shared/productGrade";
import { FOOD_AI_PROMPT, barcodeCandidates, cleanAiFoods, isBarcode, mergeFound, parseFdcFood, parseOffProduct, type FoundFood } from "../shared/foodLookup";

const OFF_FIELDS = "product_name,generic_name,brands,serving_size,nutriments,code";
const USER_AGENT = "ARISE-Reader-FamilyHub/1.0 (arisereader.com)";
const searchLimits = createAttemptLimiter({ max: 120, windowMs: 10 * 60_000 });
const aiLimits = createAttemptLimiter({ max: 30, windowMs: 60 * 60_000 });

async function getJson(url: string, ms = 8000, missingOk = false): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(ms) });
  // Open Food Facts answers 404 for a product it doesn't have: that's "not found", not "can't be reached".
  if (missingOk && res.status === 404) return null;
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.json();
}

async function searchUsda(q: string): Promise<FoundFood[]> {
  const key = process.env.USDA_API_KEY || "DEMO_KEY";
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(q)}&pageSize=15&dataType=${encodeURIComponent("Survey (FNDDS),Foundation,SR Legacy,Branded")}`;
  const body = await getJson(url);
  return (Array.isArray(body?.foods) ? body.foods : []).map(parseFdcFood).filter(Boolean) as FoundFood[];
}

async function searchOff(q: string): Promise<FoundFood[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=15&fields=${OFF_FIELDS}`;
  const body = await getJson(url);
  return (Array.isArray(body?.products) ? body.products : []).map(parseOffProduct).filter(Boolean) as FoundFood[];
}

async function askAi(text: string, image: string | null): Promise<FoundFood[]> {
  const content: any[] = [{ type: "text", text: text || "Estimate the food in this photo." }];
  if (image) content.push({ type: "image_url", image_url: { url: image, detail: "low" } });
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1", temperature: 0.2, max_tokens: 1500, response_format: { type: "json_object" }, messages: [{ role: "system", content: FOOD_AI_PROMPT }, { role: "user", content }] }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) { console.error("[food-lookup] AI failed:", res.status); throw new Error(res.status === 429 ? "busy" : "failed"); }
  const payload: any = await res.json().catch(() => null);
  try { return cleanAiFoods(JSON.parse(String(payload?.choices?.[0]?.message?.content || "{}"))); } catch { return []; }
}

export function registerFoodLookupRoutes(app: Express, authMiddleware: RequestHandler) {
  const who = (req: any) => `u${req.user?.id}`;
  const limited = (limiter: ReturnType<typeof createAttemptLimiter>, req: any, res: any) => {
    const wait = limiter.retryAfter(who(req));
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); res.status(429).json({ message: `Too many lookups. Try again in ${waitWords(wait)}.` }); return true; }
    limiter.fail(who(req));
    return false;
  };

  app.get("/api/arise-todo/food/search", authMiddleware, async (req: any, res) => {
    const q = typeof req.query?.q === "string" ? req.query.q.trim().slice(0, 80) : "";
    if (q.length < 2) return res.json({ foods: [] });
    if (limited(searchLimits, req, res)) return;
    const run = async (term: string) => {
      const [usda, off] = await Promise.allSettled([searchUsda(term), searchOff(term)]);
      if (usda.status === "rejected" && off.status === "rejected") {
        console.error("[food-lookup] search failed:", String(usda.reason?.message), String(off.reason?.message));
        return null;
      }
      return mergeFound([usda, off].map((r) => (r.status === "fulfilled" ? r.value : [])));
    };
    // The databases only find words spelled right, so a misspelled search is fixed first ("chiken" is chicken)
    // and the fixed one is used when it finds more.
    const fixed = fixFoodSpelling(q);
    const [asTyped, asFixed] = await Promise.all([run(q), fixed ? run(fixed) : Promise.resolve(null)]);
    if (!asTyped && !asFixed) return res.status(503).json({ message: "The food database can't be reached right now. Try again, or type it in." });
    res.set("Cache-Control", "private, max-age=3600");
    if (fixed && asFixed && asFixed.length > (asTyped?.length ?? 0) + 2) return res.json({ foods: asFixed, corrected: fixed });
    return res.json({ foods: asTyped ?? asFixed ?? [] });
  });

  app.get("/api/arise-todo/food/barcode/:code", authMiddleware, async (req: any, res) => {
    const code = req.params.code;
    if (!isBarcode(code)) return res.status(400).json({ message: "That doesn't look like a barcode number." });
    if (limited(searchLimits, req, res)) return;
    try {
      // A UPC-E (cans, candy) is also tried as the full UPC-A it stands for, and a UPC-A with a leading 0.
      for (const candidate of barcodeCandidates(code)) {
        const body = await getJson(`https://world.openfoodfacts.org/api/v2/product/${candidate}.json?fields=${OFF_FIELDS}`, 8000, true);
        const food = body?.status === 1 ? parseOffProduct(body.product) : null;
        if (!food) continue;
        res.set("Cache-Control", "private, max-age=86400");
        return res.json({ food });
      }
      return res.status(404).json({ message: "That product isn't in the food database yet. Search for it or type it in." });
    } catch (error: any) {
      console.error("[food-lookup] barcode failed:", String(error?.message));
      return res.status(503).json({ message: "The food database can't be reached right now. Try again in a moment." });
    }
  });

  // Arise grades (shared/productGrade.ts): a barcode is looked up in Open Food Facts, then Open Beauty
  // Facts, then Open Products Facts (cleaning and household), and graded by fixed rules.
  const GRADE_FIELDS = "product_name,generic_name,brands,nutriscore_grade,nova_group,additives_tags,ingredients_text,ingredients_text_en,nutriments,categories_tags,labels_tags,image_front_small_url,code";
  app.get("/api/arise-todo/grade/:code", authMiddleware, async (req: any, res) => {
    const code = req.params.code;
    if (!isBarcode(code)) return res.status(400).json({ message: "That doesn't look like a barcode number." });
    if (limited(searchLimits, req, res)) return;
    const dbs: [string, "food" | "beauty" | "products"][] = [["world.openfoodfacts.org", "food"], ["world.openbeautyfacts.org", "beauty"], ["world.openproductsfacts.org", "products"]];
    let reached = false;
    for (const candidate of barcodeCandidates(code)) for (const [host, db] of dbs) {
      try {
        const body = await getJson(`https://${host}/api/v2/product/${candidate}.json?fields=${GRADE_FIELDS}`, 8000, true);
        reached = true;
        if (body?.status !== 1 || !body.product) continue;
        res.set("Cache-Control", "private, max-age=86400");
        return res.json({ grade: gradeOff(body.product, db), code: candidate });
      } catch (error: any) { console.error("[grade] lookup failed:", host, String(error?.message)); }
    }
    if (!reached) return res.status(503).json({ message: "The product databases can't be reached right now. Try again in a moment." });
    return res.status(404).json({ message: "That product isn't in the databases yet. Snap a photo of its ingredients instead." });
  });

  // A photo of a label (or typed ingredients): the AI only reads the words on it; the grade is worked
  // out by the same fixed rules.
  app.post("/api/arise-todo/grade/label", authMiddleware, async (req: any, res) => {
    const typed = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, 4000) : "";
    const image = typeof req.body?.image === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(req.body.image) && req.body.image.length < 3_000_000 ? req.body.image : null;
    const kind = req.body?.kind === "product" ? "product" : "food";
    if (!typed && !image) return res.status(400).json({ message: "Snap the ingredients or type them in." });
    let read = { name: "", ingredients: typed, per100: undefined as any };
    if (image) {
      if (!process.env.OPENAI_API_KEY) return res.status(503).json({ message: "Reading labels isn't set up on this site yet. Type the ingredients instead." });
      if (limited(aiLimits, req, res)) return;
      try {
        const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "gpt-4.1-mini", temperature: 0, max_tokens: 1200, response_format: { type: "json_object" }, messages: [
            { role: "system", content: 'Copy the text from this product label exactly; do not judge it. Reply as JSON: {"name": product name or "", "ingredients": the full ingredients list as printed or "", "per100": null or {"kcal","sugars","satFat","salt","protein","fiber"} per 100 g/ml if a nutrition panel is shown (convert from per-serving using the serving size; salt = sodium g x 2.5)}.' },
            { role: "user", content: [{ type: "text", text: "Read this label." }, { type: "image_url", image_url: { url: image, detail: "high" } }] }] }),
          signal: AbortSignal.timeout(45_000) });
        if (!r.ok) throw new Error(String(r.status));
        const j: any = JSON.parse((await r.json())?.choices?.[0]?.message?.content || "{}");
        const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
        read = { name: String(j?.name || "").slice(0, 120), ingredients: String(j?.ingredients || typed).slice(0, 4000), per100: j?.per100 && typeof j.per100 === "object" ? { kcal: num(j.per100.kcal), sugars: num(j.per100.sugars), satFat: num(j.per100.satFat), salt: num(j.per100.salt), protein: num(j.per100.protein), fiber: num(j.per100.fiber) } : undefined };
      } catch { return res.status(503).json({ message: "Couldn't read that photo. Try a closer, sharper photo of the ingredients." }); }
    }
    const grade = kind === "product" ? gradeProduct({ name: read.name, ingredients: read.ingredients }) : gradeFood({ name: read.name, ingredients: read.ingredients, per100: read.per100 });
    return res.json({ grade: { ...grade, name: read.name || (kind === "product" ? "This product" : "This food"), brand: "" } });
  });

  app.post("/api/arise-todo/food/estimate", authMiddleware, async (req: any, res) => {
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ message: "Meal estimates aren't set up on this site yet." });
    const text = typeof req.body?.text === "string" ? req.body.text.trim().slice(0, 600) : "";
    const image = typeof req.body?.image === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(req.body.image) && req.body.image.length < 3_000_000 ? req.body.image : null;
    if (!text && !image) return res.status(400).json({ message: "Describe the meal or add a photo." });
    if (limited(aiLimits, req, res)) return;
    try {
      const foods = await askAi(text, image);
      return res.json({ foods });
    } catch (error: any) {
      return res.status(503).json({ message: error?.message === "busy" ? "The AI is busy. Try again in a minute." : "The meal couldn't be estimated. Try again, or search for each food." });
    }
  });
}
