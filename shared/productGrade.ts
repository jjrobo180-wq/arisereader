// Arise grades: an A–F grade for a food or a household product, worked out by fixed, published rules
// (never an AI's opinion), with every reason shown and where it comes from.
//   Food = nutrition (Nutri-Score, the 2023 algorithm used on packs in Europe, or Open Food Facts' own
//          Nutri-Score when it has one) + how processed it is (NOVA groups 1–4) + additives with a known
//          concern (IARC cancer classes, EU bans and limits, FDA actions, EFSA opinions).
//   Household and personal care = its ingredients checked against chemicals of concern (IARC, EU
//          restrictions, FDA, EPA, the EU fragrance-allergen list).
// A grade is a guide for comparing products, not medical advice. The AI only ever reads a label photo
// into text; it never sets the grade.

export type Level = "high" | "moderate" | "low";
export type Reason = { good: boolean; text: string; level?: Level; source?: string };
export type Grade = { kind: "food" | "product"; letter: "A" | "B" | "C" | "D" | "F" | "?"; score: number; reasons: Reason[]; summary: string;
  nutri?: "a" | "b" | "c" | "d" | "e"; nova?: 1 | 2 | 3 | 4; flagged: { name: string; level: Level; why: string; source: string }[] };

const letterOf = (n: number): Grade["letter"] => (n >= 80 ? "A" : n >= 65 ? "B" : n >= 50 ? "C" : n >= 35 ? "D" : "F");
export const GRADE_COLOR: Record<Grade["letter"], string> = { A: "#16a34a", B: "#65a30d", C: "#eab308", D: "#f97316", F: "#dc2626", "?": "#94a3b8" };

// ── Nutri-Score (2023 general-food algorithm), per 100 g ─────────────────────────────────────────────
const pts = (v: number, steps: number[]) => steps.filter((s) => v > s).length;
export type Per100 = { kcal?: number; sugars?: number; satFat?: number; salt?: number; protein?: number; fiber?: number; fruitVegPct?: number };
export function nutriScore(n: Per100): { points: number; letter: "a" | "b" | "c" | "d" | "e" } {
  const kj = (n.kcal ?? 0) * 4.184;
  const neg = pts(kj, [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350])
    + pts(n.sugars ?? 0, [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51])
    + pts(n.satFat ?? 0, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    + pts(n.salt ?? 0, [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6, 3.8, 4]);
  const fv = (n.fruitVegPct ?? 0) > 80 ? 5 : (n.fruitVegPct ?? 0) > 60 ? 2 : (n.fruitVegPct ?? 0) > 40 ? 1 : 0;
  const protein = pts(n.protein ?? 0, [2.4, 4.8, 7.2, 9.6, 12, 14, 17]);
  const fiber = pts(n.fiber ?? 0, [3.0, 4.1, 5.2, 6.3, 7.4]);
  const points = neg - (fv + fiber + (neg < 11 || fv === 5 ? protein : 0));
  return { points, letter: points <= 0 ? "a" : points <= 2 ? "b" : points <= 10 ? "c" : points <= 18 ? "d" : "e" };
}

// ── Food additives with a known concern ──────────────────────────────────────────────────────────────
type Flag = { name: string; level: Level; why: string; source: string };
export const ADDITIVES: Record<string, Flag> = {
  e171: { name: "Titanium dioxide (E171)", level: "high", why: "Banned as a food additive in the EU since 2022 because a risk of DNA damage couldn't be ruled out", source: "EFSA 2021" },
  e250: { name: "Sodium nitrite (E250)", level: "high", why: "Nitrites in processed meat form compounds linked to bowel cancer; processed meat is a Group 1 carcinogen", source: "IARC 2015" },
  e249: { name: "Potassium nitrite (E249)", level: "high", why: "Like sodium nitrite: linked to bowel cancer in processed meat", source: "IARC 2015" },
  e251: { name: "Sodium nitrate (E251)", level: "moderate", why: "Turns into nitrite; linked to bowel cancer in processed meat", source: "IARC 2015" },
  e252: { name: "Potassium nitrate (E252)", level: "moderate", why: "Turns into nitrite; linked to bowel cancer in processed meat", source: "IARC 2015" },
  e320: { name: "BHA (E320)", level: "high", why: "Possibly causes cancer in people (Group 2B) and may disrupt hormones", source: "IARC; US NTP" },
  e321: { name: "BHT (E321)", level: "moderate", why: "Mixed evidence on hormone and liver effects in animal studies", source: "EFSA 2012" },
  e319: { name: "TBHQ (E319)", level: "moderate", why: "Animal studies suggest effects on the immune system", source: "EWG/EFSA review" },
  e924: { name: "Potassium bromate (E924)", level: "high", why: "Possibly causes cancer (Group 2B); banned in the EU, UK and Canada", source: "IARC" },
  e951: { name: "Aspartame (E951)", level: "moderate", why: "Classed 'possibly carcinogenic' (Group 2B) in 2023; the daily limit was kept", source: "IARC/JECFA 2023" },
  e950: { name: "Acesulfame K (E950)", level: "low", why: "Approved, but long-term studies are limited", source: "EFSA 2025" },
  e955: { name: "Sucralose (E955)", level: "low", why: "Approved; some studies link it to gut-bacteria changes", source: "Research reviews" },
  e129: { name: "Allura Red / Red 40 (E129)", level: "moderate", why: "Linked to hyperactivity in some children; EU packs must carry a warning", source: "Southampton study; EU 1333/2008" },
  e102: { name: "Tartrazine / Yellow 5 (E102)", level: "moderate", why: "Linked to hyperactivity in some children; EU warning label", source: "Southampton study; EU 1333/2008" },
  e110: { name: "Sunset Yellow / Yellow 6 (E110)", level: "moderate", why: "Linked to hyperactivity in some children; EU warning label", source: "Southampton study; EU 1333/2008" },
  e104: { name: "Quinoline Yellow (E104)", level: "moderate", why: "Linked to hyperactivity in some children; EU warning label", source: "EU 1333/2008" },
  e122: { name: "Carmoisine (E122)", level: "moderate", why: "Linked to hyperactivity in some children; EU warning label", source: "EU 1333/2008" },
  e124: { name: "Ponceau 4R (E124)", level: "moderate", why: "Linked to hyperactivity in some children; EU warning label", source: "EU 1333/2008" },
  e127: { name: "Erythrosine / Red 3 (E127)", level: "high", why: "Caused thyroid tumors in rats; the FDA is removing it from US food", source: "FDA 2025" },
  e133: { name: "Brilliant Blue (E133)", level: "low", why: "Approved; a synthetic dye with limited long-term data", source: "EFSA" },
  e150d: { name: "Caramel color IV (E150d)", level: "moderate", why: "Can contain 4-MEI, possibly carcinogenic (Group 2B)", source: "IARC; California Prop 65" },
  e407: { name: "Carrageenan (E407)", level: "low", why: "Gut inflammation in some animal studies; EFSA asked for more data", source: "EFSA 2018" },
  e433: { name: "Polysorbate 80 (E433)", level: "low", why: "Emulsifiers changed gut bacteria in mouse studies", source: "Nature 2015" },
  e466: { name: "Carboxymethylcellulose (E466)", level: "low", why: "Emulsifiers changed gut bacteria in mouse and human studies", source: "Gastroenterology 2022" },
  e211: { name: "Sodium benzoate (E211)", level: "low", why: "With vitamin C it can form small amounts of benzene", source: "FDA" },
  e621: { name: "MSG (E621)", level: "low", why: "Safe for most people; some report headaches", source: "FDA; EFSA 2017" },
  e338: { name: "Phosphoric acid (E338)", level: "low", why: "High intakes linked to lower bone density in some studies", source: "AJCN 2006" },
  e339: { name: "Sodium phosphates (E339)", level: "low", why: "Added phosphates are a concern for kidney health at high intakes", source: "EFSA 2019" },
  e173: { name: "Aluminium (E173)", level: "moderate", why: "Aluminium intake from food can exceed safe weekly levels", source: "EFSA 2008" },
  e443: { name: "Brominated vegetable oil (E443)", level: "high", why: "No longer allowed in US food (2024) after thyroid effects in studies", source: "FDA 2024" },
  e954: { name: "Saccharin (E954)", level: "low", why: "Approved; its cancer listing was removed, limited newer data", source: "NTP; EFSA 2024" },
};
const ADDITIVE_WORDS: [RegExp, string][] = [
  [/titanium dioxide/i, "e171"], [/sodium nitrite/i, "e250"], [/potassium nitrite/i, "e249"], [/sodium nitrate/i, "e251"], [/\bBHA\b|butylated hydroxyanisole/i, "e320"], [/\bBHT\b|butylated hydroxytoluene/i, "e321"],
  [/\bTBHQ\b/i, "e319"], [/potassium bromate/i, "e924"], [/aspartame/i, "e951"], [/acesulfame/i, "e950"], [/sucralose/i, "e955"], [/red\s*(no\.?\s*)?40|allura red/i, "e129"], [/yellow\s*(no\.?\s*)?5|tartrazine/i, "e102"],
  [/yellow\s*(no\.?\s*)?6|sunset yellow/i, "e110"], [/red\s*(no\.?\s*)?3\b|erythrosine/i, "e127"], [/blue\s*(no\.?\s*)?1\b|brilliant blue/i, "e133"], [/caramel colou?r/i, "e150d"], [/carrageenan/i, "e407"], [/polysorbate 80/i, "e433"],
  [/carboxymethyl ?cellulose|cellulose gum/i, "e466"], [/sodium benzoate/i, "e211"], [/monosodium glutamate|\bMSG\b/i, "e621"], [/phosphoric acid/i, "e338"], [/sodium phosphate/i, "e339"], [/brominated vegetable oil/i, "e443"], [/saccharin/i, "e954"],
];
/** The additives of concern in an ingredients text and/or a list of additive tags (Open Food Facts "en:e250"). */
export function findAdditives(ingredients = "", tags: string[] = []): Flag[] {
  const ids = new Set<string>();
  for (const t of tags) { const id = String(t).toLowerCase().replace(/^en:/, "").replace(/[^a-z0-9]/g, ""); if (ADDITIVES[id]) ids.add(id); else { const base = id.replace(/[a-z]+$/, (m) => (m.length > 1 ? "" : m)); if (ADDITIVES[base]) ids.add(base); } }
  for (const m of ingredients.matchAll(/\bE\s?-?(\d{3}[a-d]?)\b/gi)) { const id = `e${m[1].toLowerCase()}`; if (ADDITIVES[id]) ids.add(id); }
  for (const [re, id] of ADDITIVE_WORDS) if (re.test(ingredients)) ids.add(id);
  return [...ids].map((id) => ADDITIVES[id]);
}

export type FoodFacts = { name?: string; per100?: Per100; nutriscore?: string; nova?: number; additiveTags?: string[]; ingredients?: string; organic?: boolean; beverage?: boolean; water?: boolean };
const PENALTY: Record<Level, number> = { high: 18, moderate: 8, low: 3 };

export function gradeFood(f: FoodFacts): Grade {
  const reasons: Reason[] = [];
  const official = /^[a-e]$/i.test(f.nutriscore ?? "") ? (f.nutriscore!.toLowerCase() as Grade["nutri"]) : undefined;
  const hasNutrition = !!f.per100 && (f.per100.kcal != null || f.per100.sugars != null);
  if (f.water) return { kind: "food", letter: "A", score: 100, nutri: "a", nova: 1, flagged: [], reasons: [{ good: true, text: "Plain water", source: "Nutri-Score" }], summary: "Plain water: the best drink there is." };
  const ns = official ?? (hasNutrition ? nutriScore(f.per100!).letter : undefined);
  if (!ns && !f.ingredients && !f.additiveTags?.length) return { kind: "food", letter: "?", score: 0, flagged: [], reasons: [], summary: "Not enough information to grade this. Scan the label or the ingredients." };
  let score = ns ? ({ a: 92, b: 77, c: 58, d: 40, e: 22 } as const)[ns] : 60;
  if (ns) reasons.push({ good: ns <= "b", text: `Nutrition: Nutri-Score ${ns.toUpperCase()}${official ? "" : " (worked out from the label)"}`, source: "Nutri-Score 2023" });
  const p = f.per100;
  if (p) {
    if ((p.sugars ?? 0) > (f.beverage ? 5 : 22.5)) reasons.push({ good: false, text: `High in sugar: ${Math.round(p.sugars!)} g per 100 ${f.beverage ? "ml" : "g"}`, level: "moderate", source: "UK FSA traffic lights" });
    if ((p.satFat ?? 0) > 5) reasons.push({ good: false, text: `High in saturated fat: ${Math.round(p.satFat! * 10) / 10} g per 100 g`, level: "moderate", source: "UK FSA traffic lights" });
    if ((p.salt ?? 0) > 1.5) reasons.push({ good: false, text: `High in salt: ${Math.round(p.salt! * 10) / 10} g per 100 g`, level: "moderate", source: "UK FSA traffic lights" });
    if ((p.fiber ?? 0) >= 6) reasons.push({ good: true, text: `High in fiber: ${Math.round(p.fiber!)} g per 100 g`, source: "EU 1924/2006" });
    if ((p.protein ?? 0) >= 12) reasons.push({ good: true, text: `Good protein: ${Math.round(p.protein!)} g per 100 g`, source: "EU 1924/2006" });
  }
  const nova = f.nova && f.nova >= 1 && f.nova <= 4 ? (f.nova as 1 | 2 | 3 | 4) : undefined;
  if (nova) {
    score += ({ 1: 6, 2: 0, 3: -4, 4: -12 } as const)[nova];
    reasons.push({ good: nova <= 2, text: ["", "Unprocessed or minimally processed", "A processed cooking ingredient", "Processed food", "Ultra-processed food: linked in large studies to higher risk of heart disease, type 2 diabetes and early death"][nova], level: nova === 4 ? "moderate" : undefined, source: "NOVA; BMJ 2024 umbrella review" });
  }
  const flagged = findAdditives(f.ingredients, f.additiveTags);
  let pen = 0;
  for (const a of flagged) { pen += PENALTY[a.level]; reasons.push({ good: false, text: `${a.name}: ${a.why}`, level: a.level, source: a.source }); }
  score -= Math.min(45, pen);
  if (!flagged.length && (f.ingredients || f.additiveTags)) reasons.push({ good: true, text: "No additives of concern", source: "IARC, EFSA, FDA lists" });
  if (f.organic) { score += 3; reasons.push({ good: true, text: "Organic", source: "USDA/EU organic" }); }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const letter = letterOf(score);
  const worst = reasons.filter((r) => !r.good).sort((a, b) => (a.level === "high" ? -1 : 0) - (b.level === "high" ? -1 : 0))[0];
  return { kind: "food", letter, score, nutri: ns, nova, flagged, reasons: [...reasons.filter((r) => !r.good), ...reasons.filter((r) => r.good)],
    summary: letter === "A" ? "A great choice." : letter === "B" ? "A good choice." : worst ? `Main concern: ${worst.text.split(":")[0].toLowerCase()}.` : "OK now and then." };
}

// ── Household and personal-care ingredients of concern ───────────────────────────────────────────────
export const CHEMICALS: { re: RegExp; flag: Flag }[] = [
  { re: /formaldehyde|formalin|methylene glycol/i, flag: { name: "Formaldehyde", level: "high", why: "Causes cancer in people (Group 1) and irritates skin and lungs", source: "IARC" } },
  { re: /dmdm hydantoin|quaternium-15|imidazolidinyl urea|diazolidinyl urea|bronopol|2-bromo-2-nitropropane/i, flag: { name: "Formaldehyde releaser", level: "high", why: "Slowly releases formaldehyde, a Group 1 carcinogen and common skin allergen", source: "IARC; EU Cosmetics Reg." } },
  { re: /triclosan|triclocarban/i, flag: { name: "Triclosan", level: "high", why: "Banned from US hand soaps; may affect hormones and drive antibiotic resistance", source: "FDA 2016" } },
  { re: /\b(butyl|propyl|isobutyl|isopropyl)paraben/i, flag: { name: "Long-chain parabens", level: "moderate", why: "Weak hormone-like effects; limited or banned in EU cosmetics", source: "EU SCCS" } },
  { re: /\b(diethyl|dibutyl|di\(2-ethylhexyl\)) ?phthalate|\bDEP\b|\bDBP\b|\bDEHP\b/i, flag: { name: "Phthalates", level: "high", why: "Linked to hormone disruption; several banned in EU cosmetics and toys", source: "EU REACH; CDC" } },
  { re: /methylisothiazolinone|methylchloroisothiazolinone|\bMIT\b|\bCMIT\b/i, flag: { name: "Isothiazolinones (MIT)", level: "moderate", why: "A top cause of skin allergy; banned in EU leave-on cosmetics", source: "EU SCCS 2016" } },
  { re: /benzalkonium chloride|alkyl dimethyl benzyl ammonium|quaternary ammonium|didecyl ?dimethyl ammonium/i, flag: { name: "Quats (quaternary ammonium)", level: "moderate", why: "Linked to asthma in cleaning workers; can irritate skin and lungs", source: "Occupational studies; EPA" } },
  { re: /sodium hypochlorite|chlorine bleach/i, flag: { name: "Chlorine bleach", level: "moderate", why: "Irritates eyes and lungs; never mix with ammonia or acids (toxic gas)", source: "CDC; EPA" } },
  { re: /\bammonia\b|ammonium hydroxide/i, flag: { name: "Ammonia", level: "moderate", why: "Irritates lungs; toxic gas if mixed with bleach", source: "CDC" } },
  { re: /2-butoxyethanol|ethylene glycol (mono)?butyl ether/i, flag: { name: "2-Butoxyethanol", level: "moderate", why: "Solvent that can irritate and harm blood cells at high exposure", source: "EPA; ATSDR" } },
  { re: /nonylphenol|\bNPE\b|octylphenol/i, flag: { name: "Nonylphenol ethoxylates", level: "high", why: "Hormone disruptors; restricted in the EU", source: "EU REACH; EPA" } },
  { re: /\bPTFE\b|perfluoro|polyfluoro|\bPFAS\b|\bPFOA\b|\bPFOS\b/i, flag: { name: "PFAS ('forever chemicals')", level: "high", why: "Build up in the body; linked to cancers and immune effects", source: "EPA 2024; IARC (PFOA Group 1)" } },
  { re: /\btalc\b/i, flag: { name: "Talc", level: "moderate", why: "Probably causes cancer (Group 2A, 2024); can carry asbestos", source: "IARC 2024" } },
  { re: /oxybenzone|benzophenone-3/i, flag: { name: "Oxybenzone", level: "moderate", why: "Absorbed through skin; possible hormone effects; harms coral reefs", source: "FDA 2019; Hawaii law" } },
  { re: /octinoxate|ethylhexyl methoxycinnamate/i, flag: { name: "Octinoxate", level: "low", why: "Possible hormone effects; harms coral reefs", source: "Hawaii law; studies" } },
  { re: /hydroquinone/i, flag: { name: "Hydroquinone", level: "high", why: "No longer sold over the counter in the US; skin damage risk", source: "FDA 2020" } },
  { re: /coal tar|\bp-phenylenediamine\b|\bPPD\b/i, flag: { name: "Coal-tar dyes (PPD)", level: "moderate", why: "Strong skin allergen; some coal-tar ingredients are carcinogens", source: "IARC; EU SCCS" } },
  { re: /toluene/i, flag: { name: "Toluene", level: "high", why: "Harms the nervous system; a risk in pregnancy", source: "EPA; ATSDR" } },
  { re: /\blead\b|lead acetate/i, flag: { name: "Lead", level: "high", why: "No safe level of lead exposure", source: "WHO; CDC" } },
  { re: /\bpeg-\d+|polyethylene glycol|sodium laureth sulfate|ammonium laureth sulfate|ceteareth|-eth-?\d/i, flag: { name: "Ethoxylated ingredients (PEG, laureth)", level: "low", why: "Can carry traces of 1,4-dioxane, a possible carcinogen", source: "IARC (1,4-dioxane 2B); FDA" } },
  { re: /\bfragrance\b|\bparfum\b|\bperfume\b/i, flag: { name: "Fragrance / parfum", level: "moderate", why: "Undisclosed mix; a top cause of skin allergy and can include phthalates", source: "EU fragrance-allergen list; AAD" } },
  { re: /\b(limonene|linalool|citral|eugenol|geraniol|coumarin|cinnamal|hydroxycitronellal)\b/i, flag: { name: "Fragrance allergens", level: "low", why: "On the EU list of common fragrance allergens", source: "EU Cosmetics Reg. Annex III" } },
  { re: /sodium lauryl sulfate|\bSLS\b/i, flag: { name: "Sodium lauryl sulfate", level: "low", why: "Can irritate skin and eyes", source: "CIR; studies" } },
  { re: /\bBHT\b|butylated hydroxytoluene|\bBHA\b|butylated hydroxyanisole/i, flag: { name: "BHA / BHT", level: "moderate", why: "BHA possibly causes cancer (Group 2B); both may affect hormones", source: "IARC; EU" } },
  { re: /\bdea\b|diethanolamine|cocamide dea|\btea\b|triethanolamine/i, flag: { name: "DEA / TEA", level: "moderate", why: "Cocamide DEA is possibly carcinogenic (Group 2B); can form nitrosamines", source: "IARC; Prop 65" } },
  { re: /\bphosphates?\b|sodium tripolyphosphate/i, flag: { name: "Phosphates", level: "low", why: "Pollute lakes and rivers (algae blooms); banned in many detergents", source: "EPA; EU 259/2012" } },
  { re: /hydrochloric acid|sodium hydroxide|lye|potassium hydroxide/i, flag: { name: "Strong acid or lye", level: "moderate", why: "Can burn skin and eyes; keep away from children", source: "CDC; Poison Control" } },
];
export function findChemicals(ingredients: string): Flag[] {
  const seen = new Set<string>(); const out: Flag[] = [];
  for (const { re, flag } of CHEMICALS) if (re.test(ingredients) && !seen.has(flag.name)) { seen.add(flag.name); out.push(flag); }
  return out;
}
export function gradeProduct(p: { name?: string; ingredients?: string; labels?: string[] }): Grade {
  const ing = (p.ingredients ?? "").trim();
  if (ing.length < 4) return { kind: "product", letter: "?", score: 0, flagged: [], reasons: [], summary: "No ingredient list found. Snap the ingredients on the back to grade it." };
  const flagged = findChemicals(ing);
  const P: Record<Level, number> = { high: 25, moderate: 12, low: 4 };
  let score = 100 - Math.min(80, flagged.reduce((a, f) => a + P[f.level], 0));
  const reasons: Reason[] = flagged.map((f) => ({ good: false, text: `${f.name}: ${f.why}`, level: f.level, source: f.source }));
  const labels = (p.labels ?? []).join(" ").toLowerCase();
  if (/fragrance[- ]free|unscented/.test(labels + " " + ing.toLowerCase()) && !flagged.some((f) => f.name.startsWith("Fragrance"))) { score += 3; reasons.push({ good: true, text: "Fragrance-free", source: "AAD" }); }
  if (/ecolabel|epa safer choice|safer choice|ewg verified|nordic swan/.test(labels)) { score += 5; reasons.push({ good: true, text: "Has an independent safety/eco label", source: "EPA Safer Choice; EU Ecolabel" }); }
  if (!flagged.length) reasons.push({ good: true, text: "No ingredients of concern found", source: "IARC, EU, FDA, EPA lists" });
  score = Math.max(0, Math.min(100, Math.round(score)));
  const letter = letterOf(score);
  const worst = flagged.find((f) => f.level === "high") ?? flagged[0];
  return { kind: "product", letter, score, flagged, reasons, summary: !worst ? "Clean ingredient list." : `Main concern: ${worst.name.toLowerCase()}.` };
}

/** Open Food Facts / Open Beauty Facts / Open Products Facts product → grade. */
export function gradeOff(p: any, db: "food" | "beauty" | "products"): Grade & { name: string; brand: string; image?: string } {
  const name = String(p?.product_name || p?.generic_name || "This product").slice(0, 120), brand = String(p?.brands || "").split(",")[0].trim().slice(0, 60);
  const ingredients = String(p?.ingredients_text_en || p?.ingredients_text || "");
  const image = typeof p?.image_front_small_url === "string" && p.image_front_small_url.startsWith("https://") ? p.image_front_small_url : undefined;
  if (db !== "food") return { ...gradeProduct({ name, ingredients, labels: p?.labels_tags ?? [] }), name, brand, image };
  const n = p?.nutriments ?? {};
  const num = (k: string) => { const v = Number(n[k]); return Number.isFinite(v) ? v : undefined; };
  const cats: string[] = Array.isArray(p?.categories_tags) ? p.categories_tags : [];
  const per100: Per100 = { kcal: num("energy-kcal_100g") ?? (num("energy_100g") != null ? num("energy_100g")! / 4.184 : undefined), sugars: num("sugars_100g"), satFat: num("saturated-fat_100g"),
    salt: num("salt_100g") ?? (num("sodium_100g") != null ? num("sodium_100g")! * 2.5 : undefined), protein: num("proteins_100g"), fiber: num("fiber_100g"), fruitVegPct: num("fruits-vegetables-nuts-estimate-from-ingredients_100g") ?? num("fruits-vegetables-legumes-estimate-from-ingredients_100g") };
  const g = gradeFood({ name, per100, nutriscore: typeof p?.nutriscore_grade === "string" ? p.nutriscore_grade : undefined, nova: Number(p?.nova_group) || undefined, additiveTags: p?.additives_tags ?? [], ingredients,
    organic: (p?.labels_tags ?? []).some((l: string) => /organic|bio\b/.test(l)), beverage: cats.includes("en:beverages"), water: cats.some((c) => /^en:(waters|mineral-waters|spring-waters)$/.test(c)) && !(per100.kcal && per100.kcal > 1) });
  return { ...g, name, brand, image };
}
