// Arise Fit (shared/fit.ts, client/src/pages/fit/): each person's training and nutrition, kept on the
// server so it's on every phone they sign in on, and the exercise library.
//   GET/PUT /api/fit/data      their data (cleaned and size-capped; table public.fit_data)
//   GET     /api/fit/exercises the library: Arise Fit's own catalog plus wger's open exercise database
//                              (wger.de, photos under Creative Commons, each credited in the app)
//   GET     /api/fit/trails    trails near a point, from OpenStreetMap through Overpass (?lat&lng&km)
//   GET     /api/fit/trail     one trail's line (?type&id)
//   GET     /api/fit/places    a town, park or zip code → a point, from Nominatim (?q)
//   POST    /api/fit/identify  a photo of a machine, or of a home or apartment gym → the equipment in it
//                              (shared/fitGym.ts names the only answers allowed). Photos aren't kept.
//   GET     /api/fit/nearby    gyms or healthy food near a point, from OpenStreetMap (?kind=gyms|food&lat&lng),
//                              with how busy people say each gym is right now (shared/fitNearby.ts)
//   POST    /api/fit/busy      {place, level} "it's packed": shown to everyone for 90 minutes
//   POST    /api/fit/recipe    {have, goal, left} the AI makes a recipe from what's in your kitchen
//   POST    /api/fit/menu      {place, cuisine, goal, diet, mode, left, wants} the AI suggests what to order at a restaurant
//   POST    /api/fit/ask       {question, history} the AI answers questions about their own past and future
//                              workouts, food, sleep and body, from their saved data (shared/fitInsights.ts digestForAi)
//   /api/fit/circle…           workout circles (server/fitCircle.ts)
//   /api/fit/buddy…            workout buddies matched with a stranger (server/fitBuddy.ts)
//   /api/fit/plus, /pass…      Arise Fit+ and guest passes (server/fitPass.ts)
// Photo scanning, AI recipes, gyms near me and eat out (identify, recipe, nearby, busy) need Fit+.
//   The phone can't call Overpass and Nominatim itself: they refuse requests that don't identify the
//   app, and Overpass's main server is often too busy. The server asks with Arise Fit's name, tries
//   the other public Overpass servers when one fails, and remembers answers for an hour.
import type { Express, RequestHandler } from "express";
import { CATALOG, LIMITS, cleanFit, type CatalogExercise } from "../shared/fit";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { TRAIL_KM, trailCell, trailGeometryQuery, trailsQuery } from "../shared/fitRun";
import { GEAR_PROMPT_LIST, cleanGearIds } from "../shared/fitGym";
import { NEARBY, REPORT_MS, crowdNow, foodQuery, gymsQuery, nearbyCell, type BusyLevel } from "../shared/fitNearby";
import { digestForAi } from "../shared/fitInsights";
import { cleanRecipe, type Recipe } from "../shared/fitRecipes";
import { MENU_PROMPT, cleanMenuPicks, menuUserText, type MenuAsk, type MenuPick } from "../shared/fitMenuAi";
import { registerCircleRoutes, type CircleDeps } from "./fitCircle";
import { registerBuddyRoutes } from "./fitBuddy";
import { createSupabaseKv, type FitKv } from "./fitKv";
import { needsPlus, registerPassRoutes, type PassDeps } from "./fitPass";

export type RecipeAsk = { have: string; goal: string; left: { kcal: number; p: number } };
export const RECIPE_PROMPT = `You are a nutrition coach writing one healthy, simple recipe for a fitness app.
Use mainly the ingredients the person has (pantry basics like oil, salt, spices are fine). Aim for a real meal that fits their goal and what's left of their day, with plenty of protein.
Reply as JSON: {"name": "...", "mins": <total minutes>, "serves": <servings>, "kcal": <per serving>, "p": <protein g per serving>, "c": <carbs g>, "f": <fat g>, "tags": [any of "breakfast","lunch","dinner","snack","post-workout","high-protein","low-cal","quick","vegetarian","meal-prep"], "ingredients": ["amount + ingredient", ...], "steps": ["short step", ...]}.
Make the numbers realistic for the amounts (USDA values). If the ingredients can't make a sensible meal, use the best of them and say what to add in an ingredient line starting "Add:".`;

async function askAiForRecipe(ask: RecipeAsk): Promise<Recipe | null> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1-mini", temperature: 0.6, max_tokens: 900, response_format: { type: "json_object" },
      messages: [{ role: "system", content: RECIPE_PROMPT }, { role: "user", content: `I have: ${ask.have}\nGoal: ${ask.goal}\nLeft today: about ${ask.left.kcal} calories and ${ask.left.p} g protein.` }] }),
    signal: AbortSignal.timeout(40_000),
  });
  if (res.status === 429) throw new Error("busy");
  if (!res.ok) throw new Error(`status ${res.status}`);
  const body: any = await res.json();
  try { return cleanRecipe(JSON.parse(body?.choices?.[0]?.message?.content || "{}")); } catch { return null; }
}


export type AskTurn = { role: "user" | "assistant"; text: string };
export const ASK_PROMPT = `You are Ask Fit, the data assistant inside the Arise Fit app. You answer one person's questions about THEIR OWN training, food, water, sleep and body, using only the numbers given below. You are not a doctor and not a trainer.
Rules: use only the data given; never invent workouts, weights or dates. If the data doesn't show it, say so and say what to log. For questions about the future, use the trends and forecast lines, call them estimates from the recent trend, and never promise a result. Use the person's units. Be warm, plain and short (under 120 words unless they ask for more); bullets only for lists. Give a concrete next step when it helps. For pain, injury, medical or eating-disorder worries, suggest a doctor or a qualified trainer. Never give a diet below 1,200 calories a day.`;
async function askAiAboutData(digest: string, question: string, history: AskTurn[]): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1-mini", temperature: 0.3, max_tokens: 500,
      messages: [{ role: "system", content: `${ASK_PROMPT}\n\nTHEIR DATA:\n${digest}` }, ...history.map((h) => ({ role: h.role, content: h.text })), { role: "user", content: question }] }),
    signal: AbortSignal.timeout(40_000),
  });
  if (res.status === 429) throw new Error("busy");
  if (!res.ok) throw new Error(`status ${res.status}`);
  const body: any = await res.json();
  return String(body?.choices?.[0]?.message?.content ?? "").trim().slice(0, 2000);
}

async function askAiForMenu(ask: MenuAsk): Promise<MenuPick[]> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4.1-mini", temperature: 0.4, max_tokens: 1400, response_format: { type: "json_object" },
      messages: [{ role: "system", content: MENU_PROMPT }, { role: "user", content: menuUserText(ask) }] }),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 429) throw new Error("busy");
  if (!res.ok) throw new Error(`status ${res.status}`);
  const body: any = await res.json();
  const text = String(body?.choices?.[0]?.message?.content || "");
  try { return cleanMenuPicks(JSON.parse(text)); } catch { console.error("[fit] menu: unreadable AI answer", text.slice(0, 200)); return []; }
}

export type GearAnswer = { gear: string[]; name: string; note: string };
/** What the AI sees: the photo, and the machines it may name. */
export const IDENTIFY_PROMPT = (mode: "machine" | "gym") => `You identify gym equipment in photos for a workout app.
${mode === "machine" ? "The photo shows ONE machine or piece of equipment someone wants to use. Name it." : "The photo shows part of a gym, home gym or apartment gym. List every piece of equipment you can see."}
Answer only with ids from this list:
${GEAR_PROMPT_LIST}
Reply as JSON: {"gear": ["<id>", ...], "name": "<what the equipment is called, in plain words, or \"\" if unsure>", "note": "<one short sentence, or \"\">"}.
${mode === "machine" ? "Put the single best match first. If it isn't gym equipment or you can't tell, reply with an empty gear list and say why in note." : "List each id once. If you can't see any equipment, reply with an empty gear list."}`;

/** Detect a model claiming it never received the attached photo. Never present that as a valid scan. */
export function visionMissedImage(note: string): boolean {
  return /(?:no|without|missing|didn['’]t receive|couldn['’]t access|cannot (?:see|view|access)|can['’]t (?:see|view|access)|wasn['’]t sent|was not sent)[^.!?]{0,90}(?:image|photo|picture)|(?:image|photo|picture)[^.!?]{0,65}(?:not (?:provided|attached|received|available|visible)|wasn['’]t (?:provided|attached|received)|was not (?:provided|attached|received))/i.test(note);
}

function cleanVisionAnswer(text: string): GearAnswer {
  let parsed: any = {};
  try { parsed = JSON.parse(text); } catch { parsed = {}; }
  return { gear: cleanGearIds(parsed.gear), name: String(parsed.name || "").slice(0, 80), note: String(parsed.note || "").slice(0, 200) };
}

async function askAiForGear(image: string, mode: "machine" | "gym"): Promise<GearAnswer> {
  const instruction = IDENTIFY_PROMPT(mode);
  const question = mode === "machine" ? "Identify the equipment shown in the attached photo." : "List the gym equipment visible in the attached photo.";
  const headers = { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" };
  // The high-detail image matters for machines whose identifying features are small.
  const chat = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers,
    body: JSON.stringify({
      model: "gpt-4.1-mini", temperature: 0.1, max_tokens: 500, response_format: { type: "json_object" },
      messages: [
        { role: "system", content: instruction },
        { role: "user", content: [
          { type: "text", text: question },
          { type: "image_url", image_url: { url: image, detail: "high" } },
        ] },
      ],
    }),
    signal: AbortSignal.timeout(40_000),
  });
  if (chat.status === 429) throw new Error("busy");
  if (!chat.ok) throw new Error(`status ${chat.status}`);
  const body: any = await chat.json();
  const first = cleanVisionAnswer(String(body?.choices?.[0]?.message?.content || "{}"));
  if (first.gear.length || !visionMissedImage(first.note)) return first;

  // Some vision replies falsely claim that no image was sent despite receiving
  // a valid data URL. Retry once through the independent Responses image-input
  // format, rather than showing that bogus explanation to the person.
  const retry = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers,
    body: JSON.stringify({
      model: "gpt-4.1-mini", max_output_tokens: 500,
      instructions: instruction,
      input: [{ role: "user", content: [
        { type: "input_text", text: question + " Use the image attached to this message." },
        { type: "input_image", image_url: image, detail: "high" },
      ] }],
      text: { format: { type: "json_object" } },
    }),
    signal: AbortSignal.timeout(40_000),
  });
  if (retry.status === 429) throw new Error("busy");
  if (!retry.ok) throw new Error(`vision status ${retry.status}`);
  const recovered: any = await retry.json();
  const responseText = typeof recovered.output_text === "string" ? recovered.output_text
    : (Array.isArray(recovered.output) ? recovered.output.flatMap((item: any) => item.content || [])
      .filter((item: any) => item.type === "output_text").map((item: any) => item.text || "").join("\n") : "");
  const second = cleanVisionAnswer(responseText);
  if (visionMissedImage(second.note)) throw new Error("vision_missing");
  return second;
}

export type FitStore = { get(userId: number): Promise<unknown | null>; set(userId: number, data: unknown): Promise<void> };

export function createSupabaseFitStore(): FitStore {
  const db = async () => (await import("./supabase")).supabase;
  return {
    async get(userId) {
      const r = await (await db()).from("fit_data").select("data").eq("user_id", userId).maybeSingle();
      if (r.error) throw r.error;
      return r.data?.data ?? null;
    },
    async set(userId, data) {
      const r = await (await db()).from("fit_data").upsert({ user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (r.error) throw r.error;
    },
  };
}

export function createMemoryFitStore(): FitStore {
  const all = new Map<number, unknown>();
  return { async get(id) { return all.has(id) ? structuredClone(all.get(id)) : null; }, async set(id, d) { all.set(id, structuredClone(d)); } };
}

/** An exercise from wger, shaped like the app's own (photos credited to their authors). */
export type LibraryExercise = Omit<CatalogExercise, "cues"> & { cues: string[]; images: { url: string; credit: string; license: string }[]; source: "arise" | "wger" };

const MUSCLE: Record<string, CatalogExercise["muscle"]> = {
  "pectoralis major": "chest", chest: "chest", "anterior deltoid": "shoulders", shoulders: "shoulders", "deltoid": "shoulders",
  "biceps brachii": "biceps", biceps: "biceps", brachialis: "biceps", "triceps brachii": "triceps", triceps: "triceps",
  "latissimus dorsi": "back", lats: "back", trapezius: "back", "serratus anterior": "abs", "rectus abdominis": "abs", abs: "abs", "obliquus externus abdominis": "abs",
  "quadriceps femoris": "quads", quads: "quads", "biceps femoris": "hamstrings", hamstrings: "hamstrings", "gluteus maximus": "glutes", glutes: "glutes",
  gastrocnemius: "calves", soleus: "calves", calves: "calves",
};
const CATEGORY: Record<string, CatalogExercise["muscle"]> = { Abs: "abs", Arms: "biceps", Back: "back", Calves: "calves", Cardio: "cardio", Chest: "chest", Legs: "quads", Shoulders: "shoulders" };
const EQUIP: Record<string, CatalogExercise["equipment"]> = {
  Barbell: "barbell", "SZ-Bar": "barbell", Dumbbell: "dumbbell", Kettlebell: "kettlebell", "Gym mat": "bodyweight", "none (bodyweight exercise)": "bodyweight",
  "Pull-up bar": "pull-up bar", Bench: "bench", "Incline bench": "bench", "Swiss Ball": "other", "Resistance band": "band", Cable: "cable", Machine: "machine",
};
const LICENSES: Record<number, string> = { 1: "CC BY-SA 3.0", 2: "CC BY-SA 4.0", 3: "CC0", 4: "CC BY 4.0", 5: "CC BY-SA 3.0" };
const strip = (html: string) => String(html || "").replace(/<li[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/[ \t]+/g, " ");
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/** One wger "exerciseinfo" result → a library exercise (null without an English name). */
export function fromWger(r: any): LibraryExercise | null {
  const tr = (Array.isArray(r?.translations) ? r.translations : Array.isArray(r?.exercises) ? r.exercises : []).find((t: any) => t?.language === 2 || t?.language?.id === 2);
  const name = String(tr?.name || "").trim();
  if (!name || name.length > 80) return null;
  const muscles = (Array.isArray(r?.muscles) ? r.muscles : []).map((m: any) => MUSCLE[String(m?.name_en || m?.name || "").toLowerCase()]).filter(Boolean);
  const also = (Array.isArray(r?.muscles_secondary) ? r.muscles_secondary : []).map((m: any) => MUSCLE[String(m?.name_en || m?.name || "").toLowerCase()]).filter(Boolean);
  const muscle = muscles[0] || CATEGORY[String(r?.category?.name || "")] || "full body";
  const equipment = (Array.isArray(r?.equipment) ? r.equipment : []).map((e: any) => EQUIP[String(e?.name || "")]).find(Boolean) || "bodyweight";
  const text = strip(tr?.description || "").split(/\n|(?<=\.)\s+/).map((s) => s.trim()).filter((s) => s.length > 3).slice(0, 6);
  const images = (Array.isArray(r?.images) ? r.images : []).filter((i: any) => /^https:\/\//.test(String(i?.image || "")))
    .sort((a: any, b: any) => Number(!!b?.is_main) - Number(!!a?.is_main))
    .slice(0, 4).map((i: any) => ({ url: String(i.image), credit: String(i.license_author || i.author_history?.[0] || "wger contributors").slice(0, 120), license: LICENSES[Number(i.license?.id ?? i.license)] || "Creative Commons" }));
  return { id: `wger-${r?.id ?? slug(name)}`, name, muscle, also: [...new Set(also.filter((m: string) => m !== muscle))] as LibraryExercise["also"], equipment, level: 1, cues: text, images, source: "wger",
    ...(["quads", "hamstrings", "glutes", "calves"].includes(muscle) ? { lower: true } : {}) };
}

/** Arise Fit's own catalog first; wger fills in the rest (its photos are added to ours with the same name). */
export function mergeLibrary(wger: LibraryExercise[]): LibraryExercise[] {
  const ours: LibraryExercise[] = CATALOG.map((e) => ({ ...e, images: [], source: "arise" as const }));
  const byName = new Map(ours.map((e) => [e.name.toLowerCase(), e]));
  const out = [...ours]; const seen = new Set(byName.keys());
  for (const w of wger) {
    const k = w.name.toLowerCase();
    const mine = byName.get(k);
    if (mine) { if (!mine.images.length) mine.images = w.images; continue; }
    if (seen.has(k)) continue;
    seen.add(k); out.push(w);
  }
  return out;
}

export function registerFitRoutes(app: Express, authMiddleware: RequestHandler, opts: { store?: FitStore; fetchJson?: (url: string) => Promise<any>; overpass?: (query: string) => Promise<any>; identify?: (image: string, mode: "machine" | "gym") => Promise<GearAnswer>; recipe?: (ask: RecipeAsk) => Promise<Recipe | null>; menu?: (ask: MenuAsk) => Promise<MenuPick[]>; ask?: (digest: string, question: string, history: AskTurn[]) => Promise<string>; kv?: FitKv; nameOf?: CircleDeps["nameOf"]; notify?: CircleDeps["notify"]; ownPlus?: PassDeps["ownPlus"]; payment?: PassDeps["payment"] } = {}) {
  const store = opts.store ?? createSupabaseFitStore();
  const kv = opts.kv ?? createSupabaseKv();
  const circles = registerCircleRoutes(app, authMiddleware, { kv, getData: (id) => store.get(id), nameOf: opts.nameOf, notify: opts.notify });
  const buddies = registerBuddyRoutes(app, authMiddleware, { kv, getData: (id) => store.get(id), notify: opts.notify });
  // Without a plan check (a test that doesn't pass one), nobody has Fit+.
  const passes = registerPassRoutes(app, authMiddleware, { kv, ownPlus: opts.ownPlus ?? (async () => ({ live: false })), payment: opts.payment, nameOf: opts.nameOf, notify: opts.notify });
  const plus = (what: string) => needsPlus(passes.plusOf, what);
  const recipe = opts.recipe ?? (process.env.OPENAI_API_KEY ? askAiForRecipe : null);
  const cooks = createAttemptLimiter({ max: 20, windowMs: 60 * 60_000 });
  app.post("/api/fit/recipe", authMiddleware, plus("Making a recipe from what you have"), async (req: any, res) => {
    res.set?.("Cache-Control", "no-store");
    if (!recipe) return res.status(503).json({ message: "Recipe ideas aren't set up on this site yet. Try one from the list." });
    const have = String(req.body?.have ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
    if (have.length < 3) return res.status(400).json({ message: "List a few things you have, like \"chicken, rice, broccoli\"." });
    const key = String(req.user?.id);
    const wait = cooks.retryAfter(key);
    if (wait) return res.status(429).json({ message: `That's a lot of recipes for one hour. Try again in ${waitWords(wait)}.` });
    cooks.fail(key);
    const n = (v: unknown, hi: number) => Math.max(0, Math.min(hi, Math.round(Number(v) || 0)));
    const goal = ["lose", "maintain", "gain"].includes(req.body?.goal) ? ({ lose: "lose fat", maintain: "stay fit", gain: "build muscle" } as any)[req.body.goal] : "stay fit";
    try {
      const r = await recipe({ have, goal, left: { kcal: n(req.body?.left?.kcal, 5000), p: n(req.body?.left?.p, 400) } });
      return r ? res.json({ recipe: r }) : res.status(422).json({ message: "Couldn't make a recipe from that. Try listing a protein, a carb and a vegetable." });
    } catch (e: any) { return res.status(503).json({ message: e?.message === "busy" ? "The AI is busy. Try again in a minute." : "Couldn't make a recipe right now. Try again in a minute." }); }
  });
  const menu = opts.menu ?? (process.env.OPENAI_API_KEY ? askAiForMenu : null);
  const orders = createAttemptLimiter({ max: 40, windowMs: 60 * 60_000 });
  app.post("/api/fit/menu", authMiddleware, plus("Ordering help at restaurants"), async (req: any, res) => {
    res.set?.("Cache-Control", "no-store");
    if (!menu) return res.status(503).json({ message: "Ordering help isn't set up on this site yet. Try \"Match goals\" instead." });
    const clean = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
    const place = clean(req.body?.place, 80);
    if (place.length < 2) return res.status(400).json({ message: "Type a restaurant's name." });
    const key = String(req.user?.id);
    const wait = orders.retryAfter(key);
    if (wait) return res.status(429).json({ message: `That's a lot of lookups for one hour. Try again in ${waitWords(wait)}.` });
    orders.fail(key);
    const n = (v: unknown, hi: number) => Math.max(0, Math.min(hi, Math.round(Number(v) || 0)));
    const goal = ({ lose: "lose fat", maintain: "stay fit", gain: "build muscle" } as any)[req.body?.goal] ?? "stay fit";
    const left = req.body?.left ?? {};
    try {
      const askFor = { place, cuisine: clean(req.body?.cuisine, 40), goal, diet: clean(req.body?.diet, 40) || "balanced", mode: (req.body?.mode === "points" ? "points" : "calories") as "points" | "calories", wants: clean(req.body?.wants, 160),
        left: { kcal: n(left.kcal, 6000), p: n(left.p, 400), c: n(left.c, 800), f: n(left.f, 400) } };
      let picks = await menu(askFor);
      // A small local place the AI doesn't know: ask again for the typical dishes of its kind of food.
      if (!picks.length) picks = await menu({ ...askFor, place: `a typical ${askFor.cuisine || "American"} restaurant (the person is at "${place}")` });
      return picks.length ? res.json({ picks }) : res.status(422).json({ message: "Couldn't come up with picks for that place. Try the chain's name or a cuisine." });
    } catch (e: any) { return res.status(503).json({ message: e?.message === "busy" ? "The AI is busy. Try again in a minute." : "Couldn't look that up right now. Try again in a minute." }); }
  });
  const askData = opts.ask ?? (process.env.OPENAI_API_KEY ? askAiAboutData : null);
  const asks = createAttemptLimiter({ max: 60, windowMs: 60 * 60_000 });
  app.post("/api/fit/ask", authMiddleware, plus("Asking about your workouts"), async (req: any, res) => {
    res.set?.("Cache-Control", "no-store");
    if (!askData) return res.status(503).json({ message: "Ask Fit isn't set up on this site yet." });
    const question = String(req.body?.question ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
    if (question.length < 2) return res.status(400).json({ message: "Type a question, like \"How was my month?\"" });
    const key = String(req.user?.id);
    const wait = asks.retryAfter(key);
    if (wait) return res.status(429).json({ message: `That's a lot of questions for one hour. Try again in ${waitWords(wait)}.` });
    asks.fail(key);
    const history: AskTurn[] = (Array.isArray(req.body?.history) ? req.body.history : []).slice(-6)
      .map((h: any) => ({ role: h?.role === "assistant" ? "assistant" : "user", text: String(h?.text ?? "").slice(0, 1200) } as AskTurn)).filter((h: AskTurn) => h.text);
    try {
      // Their numbers come from what's saved on the server, never from the request.
      const data = cleanFit(await store.get(req.user.id));
      const answer = await askData(digestForAi(data), question, history);
      return answer ? res.json({ answer }) : res.status(422).json({ message: "I couldn't come up with an answer. Try asking it another way." });
    } catch (e: any) { return res.status(503).json({ message: e?.message === "busy" ? "The AI is busy. Try again in a minute." : "Couldn't answer right now. Try again in a minute." }); }
  });
  const identify = opts.identify ?? (process.env.OPENAI_API_KEY ? askAiForGear : null);
  const looks = createAttemptLimiter({ max: 40, windowMs: 60 * 60_000 });
  app.post("/api/fit/identify", authMiddleware, plus("Photo scanning"), async (req: any, res) => {
    res.set?.("Cache-Control", "no-store");
    if (!identify) return res.status(503).json({ message: "Photo scanning isn't set up on this site yet. Pick the machine from the list instead." });
    const mode = req.body?.mode === "gym" ? "gym" : "machine";
    const image = typeof req.body?.image === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(req.body.image) && req.body.image.length < 3_000_000 ? req.body.image : null;
    if (!image) return res.status(400).json({ message: "Take or choose a photo first." });
    const key = String(req.user?.id);
    const wait = looks.retryAfter(key);
    if (wait > 0) return res.status(429).json({ message: `That's a lot of photos for one hour. Try again in ${waitWords(wait)}.` });
    looks.fail(key);
    try {
      const result = await identify(image, mode);
      if (visionMissedImage(result.note)) return res.status(502).json({ message: "The scanner could not read that photo. Retake it with the whole machine in view, or pick from the list." });
      return res.json(result);
    }
    catch (error: any) { return res.status(503).json({ message: error?.message === "busy" ? "The AI is busy. Try again in a minute." : "The photo couldn't be read. Retake it or pick the machine from the list." }); }
  });
  const saves = createAttemptLimiter({ max: 600, windowMs: 10 * 60_000 });
  const fetchJson = opts.fetchJson ?? (async (url: string) => {
    const r = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "AriseFit/1.0 (+https://arisetodo.com)", Referer: "https://arisetodo.com/" }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) throw new Error(`status ${r.status}`);
    return r.json();
  });

  app.get("/api/fit/data", authMiddleware, async (req: any, res) => {
    try { res.set("Cache-Control", "no-store"); res.json({ data: cleanFit(await store.get(Number(req.user.id))) }); }
    catch { res.status(503).json({ message: "Arise Fit couldn't load your data. Try again in a moment." }); }
  });

  app.put("/api/fit/data", authMiddleware, async (req: any, res) => {
    const wait = saves.retryAfter(String(req.user.id));
    if (wait) return res.status(429).json({ message: `Saving too often. Try again in ${waitWords(wait)}.` });
    saves.fail(String(req.user.id));
    const data = cleanFit(req.body?.data);
    if (JSON.stringify(data).length > LIMITS.bytes) return res.status(413).json({ message: "That's more than Arise Fit can keep. Delete some old workouts or foods first." });
    const me = Number(req.user.id);
    try {
      // Someone who just finished a workout: their circle hears about it (only when they're in one).
      const group = await circles.groupOf(me).catch(() => null);
      const buddy = await buddies.pairOf(me).catch(() => null);
      const before = group || buddy ? cleanFit(await store.get(me).catch(() => null)) : null;
      await store.set(me, data);
      res.json({ ok: true });
      if (group) void circles.tell(me, before, data).catch(() => {});
      if (buddy) void buddies.tell(me, before, data).catch(() => {});
    }
    catch { res.status(503).json({ message: "Arise Fit couldn't save. Your changes are kept on this phone and will save when you're back online." }); }
  });

  // ——— Trails and places (OpenStreetMap) ———————————————————————————————————————————————————————
  const UA = "AriseFit/1.0 (+https://arisetodo.com; trails for Arise Fit runners)";
  const OVERPASS_SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter"];
  // All the public Overpass servers at once: the first good answer wins and the others are stopped.
  const overpassFetch = opts.overpass ?? (async (q: string): Promise<any> => {
    const stop = new AbortController();
    const ask = async (url: string) => {
      const r = await fetch(url, { method: "POST", headers: { "User-Agent": UA, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ data: q }).toString(), signal: stop.signal });
      if (!r.ok) throw new Error(`${url} ${r.status}`);
      const j = await r.json();
      if (!Array.isArray(j?.elements)) throw new Error(`${url} bad answer`);
      return j;
    };
    const timer = setTimeout(() => stop.abort(), 22_000);
    try { return await Promise.any(OVERPASS_SERVERS.map(ask)); }
    catch (e: any) { throw new Error((e?.errors ?? []).map((x: any) => x?.message).join("; ") || "unreachable"); }
    finally { clearTimeout(timer); stop.abort(); }
  });
  const cache = new Map<string, { at: number; body: any }>();
  // Trails barely change: answers are kept a day, and two people asking at once share one fetch.
  const inflight = new Map<string, Promise<any>>();
  // Stale-while-revalidate: an answer under a day old is served as is; an older one (up to two weeks) is
  // served at once and refreshed in the background, so places, gyms and trails open instantly.
  const FRESH_MS = 24 * 3600_000, STALE_MS = 14 * 24 * 3600_000;
  const cached = async (key: string, make: () => Promise<any>) => {
    const hit = cache.get(key);
    const age = hit ? Date.now() - hit.at : Infinity;
    if (hit && age < FRESH_MS) return hit.body;
    const run = () => {
      let q = inflight.get(key);
      if (!q) { q = make().then((b) => { cache.set(key, { at: Date.now(), body: b }); return b; }).finally(() => inflight.delete(key)); inflight.set(key, q); }
      return q;
    };
    if (hit && age < STALE_MS) { void run().catch(() => { /* keep the older answer */ }); return hit.body; }
    let p = inflight.get(key);
    if (!p) { p = make().finally(() => inflight.delete(key)); inflight.set(key, p); }
    const body = await p;
    cache.set(key, { at: Date.now(), body });
    if (cache.size > 3000) for (const k of Array.from(cache.keys()).slice(0, 500)) cache.delete(k);
    return body;
  };
  const lookups = createAttemptLimiter({ max: 120, windowMs: 10 * 60_000 });
  const tooMany = (req: any, res: any) => { const k = `trail:${req.user?.id}`; if (lookups.retryAfter(k)) { res.status(429).json({ message: "Too many searches. Try again in a few minutes." }); return true; } lookups.fail(k); return false; };
  const num = (v: unknown, lo: number, hi: number) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };

  app.get("/api/fit/trails", authMiddleware, async (req: any, res) => {
    const lat = num(req.query.lat, -90, 90), lng = num(req.query.lng, -180, 180), km = num(req.query.km, 1, 60);
    if (lat === null || lng === null || km === null) return res.status(400).json({ message: "That place couldn't be read." });
    if (tooMany(req, res)) return;
    // One answer per ~11 km grid cell, always the widest radius, so nearby people and every radius
    // choice share it (the phone filters by distance).
    const [cLat, cLng] = trailCell(lat, lng);
    res.set("Cache-Control", "public, max-age=86400");
    // A quick look (up to 20 km) is much cheaper for the map server than the full 50 km, so the first list
    // shows in seconds; the wide one fills in behind it. Each is kept a day per cell.
    const wide = km > 20;
    try { res.json(await cached(`${wide ? "t" : "t20"}:${cLat},${cLng}`, () => overpassFetch(trailsQuery(cLat, cLng, wide ? TRAIL_KM : 20)))); }
    catch (e: any) { console.error("[fit] trails", e?.message); res.status(503).json({ message: "The trail map is busy right now. Try again in a minute." }); }
  });
  app.get("/api/fit/trail", authMiddleware, async (req: any, res) => {
    const type = req.query.type === "relation" ? "relation" : req.query.type === "way" ? "way" : null;
    const id = num(req.query.id, 1, 1e12);
    if (!type || id === null || !Number.isInteger(id)) return res.status(400).json({ message: "That trail couldn't be read." });
    if (tooMany(req, res)) return;
    res.set("Cache-Control", "public, max-age=86400");
    try { res.json(await cached(`g:${type}${id}`, () => overpassFetch(trailGeometryQuery({ type, id })))); }
    catch (e: any) { console.error("[fit] trail", e?.message); res.status(503).json({ message: "That trail's map couldn't load. Try again in a minute." }); }
  });
  app.get("/api/fit/places", authMiddleware, async (req: any, res) => {
    const q = String(req.query.q ?? "").trim().slice(0, 120);
    if (q.length < 2) return res.status(400).json({ message: "Type a town, park or zip code." });
    if (tooMany(req, res)) return;
    try {
      const list = await cached(`p:${q.toLowerCase()}`, () => fetchJson(`https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q, format: "json", limit: "1", countrycodes: "us" })}`));
      const hit = Array.isArray(list) ? list[0] : null;
      res.json(hit ? { place: { lat: Number(hit.lat), lng: Number(hit.lon), label: String(hit.display_name || q).split(",").slice(0, 2).join(",").trim() } } : { place: null });
    } catch (e: any) { console.error("[fit] places", e?.message); res.status(503).json({ message: "Place search isn't reachable right now." }); }
  });

  // ——— Follow-along videos: embeddable YouTube results for a class (needs YOUTUBE_API_KEY) ———————
  app.get("/api/fit/videos", authMiddleware, async (req: any, res) => {
    const q = String(req.query.q ?? "").trim().slice(0, 100);
    if (q.length < 3) return res.status(400).json({ message: "What class?" });
    // The key comes from the server's environment, or from the settings table (key "fit:youtube-key"),
    // so it can be added without touching the hosting dashboard.
    const key = process.env.YOUTUBE_API_KEY || (await kv.get("fit:youtube-key").catch(() => null) as string | null) || "";
    if (!key) return res.status(503).json({ code: "videos_off", message: "Videos are coming soon." });
    try {
      const data: any = await cached(`yt:${q.toLowerCase()}`, () => fetchJson(`https://www.googleapis.com/youtube/v3/search?${new URLSearchParams({ part: "snippet", type: "video", videoEmbeddable: "true", videoSyndicated: "true", safeSearch: "strict", maxResults: "8", q, key })}`));
      const videos = (Array.isArray(data?.items) ? data.items : []).map((it: any) => ({ id: String(it?.id?.videoId || ""), title: String(it?.snippet?.title || "").slice(0, 120), channel: String(it?.snippet?.channelTitle || "").slice(0, 60), thumb: String(it?.snippet?.thumbnails?.medium?.url || "") })).filter((v: any) => /^[\w-]{11}$/.test(v.id));
      res.json({ videos });
    } catch (e: any) { console.error("[fit] videos", e?.message); res.status(503).json({ message: "Videos aren't reachable right now." }); }
  });

  // ——— Near me: gyms and healthy food —————————————————————————————————————————————————————————————
  // Kept for a day per grid cell. How busy a gym is right now comes from people's own reports.
  const reports = new Map<string, { level: BusyLevel; at: number; by: string }[]>();
  const LEVELS: BusyLevel[] = ["quiet", "some", "busy", "packed"];
  app.get("/api/fit/nearby", authMiddleware, plus("Finding places near you"), async (req: any, res) => {
    const kind = req.query.kind === "food" ? "food" : req.query.kind === "gyms" ? "gyms" : null;
    const lat = num(req.query.lat, -90, 90), lng = num(req.query.lng, -180, 180);
    if (!kind || lat === null || lng === null) return res.status(400).json({ message: "That place couldn't be read." });
    if (tooMany(req, res)) return;
    const [cLat, cLng] = nearbyCell(kind, lat, lng);
    // A quick look (food only): just the closest ~2.5 km, centred on the person, which the map server answers in a
    // second or two. The app asks for it alongside the full search and shows it first.
    const quick = kind === "food" && req.query.quick === "1";
    try {
      const json = quick
        ? await cached(`nq:${Math.round(lat * 100) / 100},${Math.round(lng * 100) / 100}`, () => overpassFetch(foodQuery(Math.round(lat * 100) / 100, Math.round(lng * 100) / 100, 2.5)))
        : await cached(`n:${kind}:${cLat},${cLng}`, () => overpassFetch(kind === "gyms" ? gymsQuery(cLat, cLng, NEARBY.gyms.km) : foodQuery(cLat, cLng, NEARBY.food.km)));
      const now = Date.now();
      const crowd: Record<string, ReturnType<typeof crowdNow>> = {};
      if (kind === "gyms") for (const el of json?.elements ?? []) { const id = `${String(el?.type || "n")[0]}${el?.id}`; const c = crowdNow(reports.get(id) ?? [], now); if (c) crowd[id] = c; }
      res.set("Cache-Control", "no-store");
      res.json({ cell: [cLat, cLng], elements: json?.elements ?? [], crowd, ...(quick ? { quick: true } : {}) });
    } catch (e: any) { console.error("[fit] nearby", e?.message); res.status(503).json({ message: "The map is busy right now. Try again in a minute." }); }
  });
  app.post("/api/fit/busy", authMiddleware, plus("Crowd reports"), async (req: any, res) => {
    const place = String(req.body?.place ?? "");
    const level = LEVELS.includes(req.body?.level) ? req.body.level as BusyLevel : null;
    if (!/^[nwr]\d{1,14}$/.test(place) || !level) return res.status(400).json({ message: "That report couldn't be read." });
    if (tooMany(req, res)) return;
    const now = Date.now();
    const by = String(req.user?.id);
    // One report per person per gym counts; old ones fall off.
    const list = (reports.get(place) ?? []).filter((r) => now - r.at < REPORT_MS && r.by !== by);
    list.push({ level, at: now, by });
    reports.set(place, list.slice(-20));
    if (reports.size > 5000) for (const k of Array.from(reports.keys()).slice(0, 1000)) reports.delete(k);
    res.json({ crowd: crowdNow(list, now) });
  });

  // The library: built once a day from wger (about 800 exercises in English), kept in memory.
  let lib: { at: number; list: LibraryExercise[] } | null = null;
  let building: Promise<LibraryExercise[]> | null = null;
  const build = async (): Promise<LibraryExercise[]> => {
    const all: LibraryExercise[] = [];
    let url: string | null = "https://wger.de/api/v2/exerciseinfo/?language=2&limit=200";
    for (let page = 0; url && page < 12; page++) {
      const body: any = await fetchJson(url);
      for (const r of Array.isArray(body?.results) ? body.results : []) { const e = fromWger(r); if (e) all.push(e); }
      url = typeof body?.next === "string" && body.next.startsWith("https://wger.de/") ? body.next : null;
    }
    return mergeLibrary(all);
  };
  app.get("/api/fit/exercises", authMiddleware, async (_req, res) => {
    res.set("Cache-Control", "private, max-age=3600");
    if (lib && Date.now() - lib.at < 24 * 3600_000) return res.json({ exercises: lib.list });
    try {
      building ??= build().finally(() => { building = null; });
      const list = await building;
      lib = { at: Date.now(), list };
      res.json({ exercises: list });
    } catch {
      // wger unreachable: Arise Fit's own catalog still works.
      res.json({ exercises: lib?.list ?? mergeLibrary([]), partial: true });
    }
  });
}
