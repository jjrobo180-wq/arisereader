// Arise Fit (shared/fit.ts, client/src/pages/fit/): each person's training and nutrition, kept on the
// server so it's on every phone they sign in on, and the exercise library.
//   GET/PUT /api/fit/data      their data (cleaned and size-capped; table public.fit_data)
//   GET     /api/fit/exercises the library: Arise Fit's own catalog plus wger's open exercise database
//                              (wger.de, photos under Creative Commons, each credited in the app)
//   GET     /api/fit/trails    trails near a point, from OpenStreetMap through Overpass (?lat&lng&km)
//   GET     /api/fit/trail     one trail's line (?type&id)
//   GET     /api/fit/places    a town, park or zip code → a point, from Nominatim (?q)
//   The phone can't call Overpass and Nominatim itself: they refuse requests that don't identify the
//   app, and Overpass's main server is often too busy. The server asks with Arise Fit's name, tries
//   the other public Overpass servers when one fails, and remembers answers for an hour.
import type { Express, RequestHandler } from "express";
import { CATALOG, LIMITS, cleanFit, type CatalogExercise } from "../shared/fit";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { TRAIL_KM, trailCell, trailGeometryQuery, trailsQuery } from "../shared/fitRun";

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

export function registerFitRoutes(app: Express, authMiddleware: RequestHandler, opts: { store?: FitStore; fetchJson?: (url: string) => Promise<any>; overpass?: (query: string) => Promise<any> } = {}) {
  const store = opts.store ?? createSupabaseFitStore();
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
    try { await store.set(Number(req.user.id), data); res.json({ ok: true }); }
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
  const cached = async (key: string, make: () => Promise<any>) => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 24 * 3600_000) return hit.body;
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
    try { res.json(await cached(`t:${cLat},${cLng}`, () => overpassFetch(trailsQuery(cLat, cLng, TRAIL_KM)))); }
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
