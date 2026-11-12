// Cooked: what's near you. Gyms (with what each chain usually costs and when gyms are usually
// busy), and restaurants and fast food with the healthier things to order at each chain.
// Places come from OpenStreetMap through Overpass (server/fit.ts asks; the phone can't). Prices and
// menu numbers are typical figures, not quotes: every location sets its own prices, and chains change
// their menus, so the app says "about" and "check with the gym".
import { GYM_BY_ID } from "./fitGym";

export type LatLng = [number, number];
export type NearbyKind = "gyms" | "food";
export type Place = { id: string; kind: NearbyKind; name: string; chain: string | null; lat: number; lng: number; km: number; address: string; hours: string; website: string; cuisine: string };

export function distanceKm(a: LatLng, b: LatLng): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Places are fetched for a grid cell (gyms ~11 km, food ~5.5 km), so people nearby share one answer. */
export const NEARBY = { gyms: { step: 0.1, km: 14 }, food: { step: 0.05, km: 7 } } as const;
export const nearbyCell = (kind: NearbyKind, lat: number, lng: number): LatLng => {
  const s = NEARBY[kind].step;
  return [Math.round(lat / s) * s, Math.round(lng / s) * s].map((n) => Math.round(n * 1000) / 1000) as LatLng;
};
const box = (lat: number, lng: number, km: number) => {
  const dLat = km / 111, dLng = km / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return [lat - dLat, lng - dLng, lat + dLat, lng + dLng].map((n) => n.toFixed(4)).join(",");
};

// ——— Gym chains: names, prices ————————————————————————————————————————————————————————————————————
export type Chain = { id: string; name: string; match: RegExp; gymType?: string; price?: { plans: [string, string][]; fees?: string } };
/** Typical US prices, checked October 2026 (gympricing.com, truemed.com, nerdwallet.com). */
export const PRICES_CHECKED = "October 2026";
export const GYM_CHAINS: Chain[] = [
  { id: "planet-fitness", name: "Planet Fitness", match: /planet\s*fitness/i, gymType: "planet-fitness", price: { plans: [["Classic", "$10–$19/mo"], ["PF Black Card", "$25–$38/mo"]], fees: "About $49 a year, and a start-up fee of $0–$29" } },
  { id: "la-fitness", name: "LA Fitness", match: /\bla\s*fitness|esporta|club\s*studio/i, gymType: "la-fitness", price: { plans: [["Membership", "$35–$55/mo"]], fees: "About $59–$69 a year, and a start-up fee of $0–$99" } },
  { id: "crunch", name: "Crunch Fitness", match: /\bcrunch\b/i, gymType: "crunch", price: { plans: [["Base", "$10–$22/mo"], ["Peak", "about $25/mo"], ["Peak Results", "about $30/mo"]], fees: "Up to $89 a year" } },
  { id: "24-hour", name: "24 Hour Fitness", match: /24\s*hour\s*fitness/i, gymType: "24-hour", price: { plans: [["Membership", "$21–$50/mo"]], fees: "Small start-up fee" } },
  { id: "anytime", name: "Anytime Fitness", match: /anytime\s*fitness/i, gymType: "anytime", price: { plans: [["Membership", "$40–$70/mo"]], fees: "Start-up fee of $50–$169" } },
  { id: "golds", name: "Gold's Gym", match: /gold'?s\s*gym/i, gymType: "golds", price: { plans: [["Membership", "$45–$60/mo"]], fees: "Start-up fee up to $59" } },
  { id: "ymca", name: "YMCA", match: /\bymca\b|^the\s+y\b|\by\s+(family|community)/i, gymType: "ymca", price: { plans: [["Adult", "$42–$77/mo"], ["Family", "$100–$138/mo"]], fees: "Joining fee of $0–$110. Many Ys lower the price by income." } },
  { id: "lifetime", name: "Life Time", match: /life\s*time(\s*fitness|\s*athletic)?/i, gymType: "lifetime", price: { plans: [["Membership", "$150–$350/mo"]] } },
  { id: "equinox", name: "Equinox", match: /equinox/i, price: { plans: [["Membership", "$230–$355/mo"]], fees: "Start-up fee of $100–$500" } },
  { id: "eos", name: "EoS Fitness", match: /\beos\s*fitness/i },
  { id: "chuze", name: "Chuze Fitness", match: /chuze/i },
  { id: "vasa", name: "VASA Fitness", match: /vasa\s*fitness/i },
  { id: "snap", name: "Snap Fitness", match: /snap\s*fitness/i },
  { id: "orangetheory", name: "Orangetheory", match: /orange\s*theory/i },
  { id: "f45", name: "F45 Training", match: /\bf45\b/i },
  { id: "workout-anytime", name: "Workout Anytime", match: /workout\s*anytime/i },
];
export const CHAIN_BY_ID = new Map(GYM_CHAINS.map((c) => [c.id, c]));
export const gymChainOf = (name: string, brand = ""): Chain | null => GYM_CHAINS.find((c) => c.match.test(brand) || c.match.test(name)) ?? null;
/** What "Set as my gym" saves for a place: the chain's gym type, or "Another gym" with its name. */
export const gymTypeFor = (p: Pick<Place, "chain" | "name">) => { const t = p.chain ? CHAIN_BY_ID.get(p.chain)?.gymType : undefined; return t && GYM_BY_ID.has(t) ? t : "other-gym"; };

// ——— When gyms are busy ————————————————————————————————————————————————————————————————————————————
// Gyms everywhere follow the same pattern: before work, lunch, and the after-work rush (5–7 pm) on
// weekdays, busiest Monday and quietest Friday; weekend mornings. These are typical levels (0–100),
// not live counts. People's own reports ("it's packed") show on top for the next 90 minutes.
const WEEKDAY = [4, 2, 2, 2, 6, 22, 42, 46, 36, 28, 26, 30, 38, 34, 28, 32, 52, 82, 92, 74, 50, 30, 14, 8];
const WEEKEND = [3, 2, 2, 2, 3, 6, 14, 28, 46, 62, 68, 62, 52, 44, 38, 36, 38, 40, 36, 28, 20, 12, 7, 4];
const DAY_SCALE = [0.8, 1, 0.96, 0.93, 0.88, 0.74, 0.86]; // Sun … Sat
/** How busy gyms usually are on a day (0 Sunday) at each hour, 0–100. */
export const busyCurve = (day: number): number[] => (day === 0 || day === 6 ? WEEKEND : WEEKDAY).map((v) => Math.round(v * DAY_SCALE[((day % 7) + 7) % 7]));
export type BusyLevel = "quiet" | "some" | "busy" | "packed";
export const busyLevel = (v: number): BusyLevel => (v < 30 ? "quiet" : v < 55 ? "some" : v < 78 ? "busy" : "packed");
export const BUSY_WORDS: Record<BusyLevel, string> = { quiet: "Usually quiet", some: "Usually a little busy", busy: "Usually busy", packed: "Usually packed" };
export const REPORT_WORDS: Record<BusyLevel, string> = { quiet: "Quiet", some: "A little busy", busy: "Busy", packed: "Packed" };
/** The quietest stretches between 6 am and 10 pm on a day (for "Best times today"). */
export function quietTimes(day: number, from = 6, to = 22): number[] {
  const c = busyCurve(day);
  return Array.from({ length: to - from }, (_, i) => from + i).sort((a, b) => c[a] - c[b] || a - b).slice(0, 3).sort((a, b) => a - b);
}
export const hourWords = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "am" : "pm"}`;
/** A report is kept 90 minutes; the newest few are averaged. */
export const REPORT_MS = 90 * 60_000;
export function crowdNow(reports: { level: BusyLevel; at: number }[], now = Date.now()): { level: BusyLevel; n: number; mins: number } | null {
  const fresh = reports.filter((r) => now - r.at < REPORT_MS && r.at <= now + 60_000).sort((a, b) => b.at - a.at).slice(0, 5);
  if (!fresh.length) return null;
  const order: BusyLevel[] = ["quiet", "some", "busy", "packed"];
  const avg = fresh.reduce((t, r) => t + order.indexOf(r.level), 0) / fresh.length;
  return { level: order[Math.round(avg)], n: fresh.length, mins: Math.max(1, Math.round((now - fresh[0].at) / 60_000)) };
}

// ——— Healthier picks at chains ———————————————————————————————————————————————————————————————————————
export type MenuPick = { name: string; kcal: number; p: number; c: number; f: number; tip?: string };
export type FoodChain = { id: string; name: string; match: RegExp; /** The chain's website, for its logo. */ domain: string; picks: MenuPick[]; tip: string };
/** About-right numbers from each chain's published nutrition (they change; the app says "about"). */
export const FOOD_CHAINS: FoodChain[] = [
  { id: "chipotle", name: "Chipotle", match: /chipotle/i, domain: "chipotle.com", tip: "A bowl beats a burrito (the tortilla is 320 calories). Ask for half rice and extra fajita veggies.",
    picks: [{ name: "Chicken bowl: half white rice, black beans, fajita veggies, salsa, lettuce", kcal: 465, p: 43, c: 52, f: 11 }, { name: "Chicken salad: black beans, fajita veggies, salsa (no dressing)", kcal: 360, p: 41, c: 33, f: 9 }, { name: "Double chicken bowl: fajita veggies, salsa, lettuce", kcal: 405, p: 65, c: 10, f: 14 }] },
  { id: "chick-fil-a", name: "Chick-fil-A", match: /chick-?fil-?a/i, domain: "chick-fil-a.com", tip: "Grilled, not breaded. Swap fries for a fruit cup.",
    picks: [{ name: "Grilled nuggets (8 count)", kcal: 130, p: 25, c: 1, f: 3 }, { name: "Grilled nuggets (12 count) and a fruit cup", kcal: 260, p: 39, c: 20, f: 4 }, { name: "Grilled chicken sandwich", kcal: 390, p: 28, c: 44, f: 12 }] },
  { id: "subway", name: "Subway", match: /\bsubway\b/i, domain: "subway.com", tip: "Pile on vegetables, skip mayo and creamy sauces (mustard or vinegar instead).",
    picks: [{ name: "6-inch turkey on wheat, all the veggies, mustard", kcal: 280, p: 20, c: 44, f: 4 }, { name: "Footlong rotisserie-style chicken, veggies, no mayo", kcal: 560, p: 48, c: 82, f: 10 }] },
  { id: "mcdonalds", name: "McDonald's", match: /mc\s*donald'?s/i, domain: "mcdonalds.com", tip: "Breakfast sandwiches and plain burgers are your best bets. Water or a diet soda instead of a regular one.",
    picks: [{ name: "Egg McMuffin", kcal: 310, p: 17, c: 30, f: 13 }, { name: "McDouble (no cheese) and apple slices", kcal: 355, p: 21, c: 36, f: 14 }, { name: "6 Chicken McNuggets", kcal: 250, p: 14, c: 15, f: 15 }] },
  { id: "taco-bell", name: "Taco Bell", match: /taco\s*bell/i, domain: "tacobell.com", tip: "Order it \"fresco style\" (pico instead of cheese and sauce) to cut calories.",
    picks: [{ name: "2 chicken soft tacos", kcal: 320, p: 24, c: 30, f: 10 }, { name: "Black bean soft taco, fresco style", kcal: 160, p: 6, c: 26, f: 4 }] },
  { id: "starbucks", name: "Starbucks", match: /starbucks/i, domain: "starbucks.com", tip: "Skip the syrups and whipped cream. Egg bites and wraps are good protein.",
    picks: [{ name: "Egg white & roasted red pepper egg bites", kcal: 170, p: 12, c: 11, f: 8 }, { name: "Spinach, feta & egg white wrap", kcal: 290, p: 20, c: 34, f: 8 }] },
  { id: "wendys", name: "Wendy's", match: /wendy'?s/i, domain: "wendys.com", tip: "Chili is one of the best fast-food meals there is: protein and fiber.",
    picks: [{ name: "Large chili", kcal: 370, p: 25, c: 36, f: 15 }, { name: "Small chili and a plain baked potato", kcal: 520, p: 24, c: 89, f: 10 }] },
  { id: "panda-express", name: "Panda Express", match: /panda\s*express/i, domain: "pandaexpress.com", tip: "Get Super Greens instead of rice or chow mein.",
    picks: [{ name: "Grilled teriyaki chicken with Super Greens", kcal: 365, p: 42, c: 18, f: 16 }, { name: "String bean chicken breast with Super Greens", kcal: 300, p: 18, c: 23, f: 15 }] },
  { id: "popeyes", name: "Popeyes", match: /popeyes/i, domain: "popeyes.com", tip: "Blackened (not breaded) tenders have most of the protein and little of the fat.",
    picks: [{ name: "Blackened chicken tenders (3)", kcal: 170, p: 26, c: 2, f: 2 }, { name: "Blackened tenders (5) and green beans", kcal: 340, p: 45, c: 10, f: 9 }] },
  { id: "cava", name: "CAVA", match: /\bcava\b/i, domain: "cava.com", tip: "Greens or half greens, half grains. Pick one dip, not three.",
    picks: [{ name: "Greens + grains bowl with grilled chicken, tomato & cucumber, tzatziki", kcal: 510, p: 38, c: 44, f: 20 }] },
  { id: "sweetgreen", name: "Sweetgreen", match: /sweetgreen/i, domain: "sweetgreen.com", tip: "Add a protein, and ask for the dressing on the side.",
    picks: [{ name: "Kale Caesar with blackened chicken", kcal: 430, p: 34, c: 18, f: 26 }] },
  { id: "panera", name: "Panera Bread", match: /panera/i, domain: "panerabread.com", tip: "Half a sandwich with a cup of soup keeps it reasonable.",
    picks: [{ name: "Half turkey sandwich and a cup of turkey chili", kcal: 520, p: 33, c: 58, f: 16 }] },
  { id: "jersey-mikes", name: "Jersey Mike's", match: /jersey\s*mike'?s/i, domain: "jerseymikes.com", tip: "Order it as a \"sub in a tub\" (a salad, no bread).",
    picks: [{ name: "Turkey & provolone sub in a tub", kcal: 390, p: 32, c: 10, f: 24 }] },
  { id: "dunkin", name: "Dunkin'", match: /dunkin/i, domain: "dunkindonuts.com", tip: "Wake-Up Wraps and egg-white sandwiches beat donuts and muffins.",
    picks: [{ name: "Turkey sausage, egg & cheese wake-up wrap", kcal: 240, p: 14, c: 15, f: 13 }] },
];
export const foodChainOf = (name: string, brand = ""): FoodChain | null => FOOD_CHAINS.find((c) => c.match.test(brand) || c.match.test(name)) ?? null;
/** Healthier styles of independent places worth listing (salads, poke, Mediterranean…). */
const HEALTHY_CUISINE = "salad|poke|mediterranean|greek|lebanese|middle_eastern|vegan|vegetarian|juice|smoothie|healthy|vietnamese|japanese|sushi";
const CUISINE_TIP: [RegExp, string][] = [
  [/salad|healthy/, "Add a protein and get the dressing on the side."],
  [/poke|sushi|japanese/, "Sashimi and poke are lean protein. Go easy on spicy mayo and tempura."],
  [/mediterranean|greek|lebanese|middle_eastern/, "A chicken or fish plate with salad. Hummus and pita add up fast."],
  [/vegan|vegetarian/, "Look for beans, lentils or tofu so there's protein."],
  [/juice|smoothie/, "Pick one with protein added, and a small size: big smoothies are a whole meal of sugar."],
  [/vietnamese/, "Pho with chicken or lean beef, or fresh (not fried) spring rolls."],
];
export const cuisineTip = (cuisine: string) => CUISINE_TIP.find(([r]) => r.test(cuisine))?.[1] ?? "";

// ——— Overpass queries and their answers ———————————————————————————————————————————————————————————
export function gymsQuery(lat: number, lng: number, km = NEARBY.gyms.km): string {
  return `[out:json][timeout:20][bbox:${box(lat, lng, km)}];(nwr["leisure"="fitness_centre"]["name"];nwr["leisure"="sports_centre"]["sport"~"fitness|weightlifting|crossfit"]["name"];nwr["amenity"="gym"]["name"];);out tags center 300;`;
}
/** Plain names for Overpass's regex (it has no \\b or \\s); answers are matched exactly afterwards. */
const CHAIN_NAMES = "Chipotle|Chick-fil-A|Subway|McDonald|Taco Bell|Starbucks|Wendy|Panda Express|Popeyes|CAVA|Sweetgreen|Panera|Jersey Mike|Dunkin";
export function foodQuery(lat: number, lng: number, km = NEARBY.food.km): string {
  return `[out:json][timeout:20][bbox:${box(lat, lng, km)}];(nwr["amenity"~"^(fast_food|restaurant|cafe)$"]["name"~"${CHAIN_NAMES}",i];nwr["amenity"~"^(fast_food|restaurant|cafe)$"]["brand"~"${CHAIN_NAMES}",i];nwr["amenity"~"^(fast_food|restaurant|cafe)$"]["cuisine"~"${HEALTHY_CUISINE}"]["name"];);out tags center 400;`;
}

/** Overpass's answer → places sorted by distance from `from` (chains matched; nameless and far ones dropped). */
export function parsePlaces(json: any, kind: NearbyKind, from: LatLng, maxKm = 25): Place[] {
  const seen = new Set<string>();
  const out: Place[] = [];
  for (const el of Array.isArray(json?.elements) ? json.elements : []) {
    const t = el?.tags || {};
    const lat = Number(el?.lat ?? el?.center?.lat), lng = Number(el?.lon ?? el?.center?.lon);
    const name = String(t.name || "").trim();
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const brand = String(t.brand || "");
    const chain = kind === "gyms" ? gymChainOf(name, brand)?.id ?? null : foodChainOf(name, brand)?.id ?? null;
    const cuisine = String(t.cuisine || "").toLowerCase();
    if (kind === "food" && !chain && !new RegExp(HEALTHY_CUISINE).test(cuisine)) continue;
    const km = distanceKm(from, [lat, lng]);
    if (km > maxKm) continue;
    // The same place drawn as both a point and a building.
    const dupe = `${name.toLowerCase()}|${lat.toFixed(3)}|${lng.toFixed(3)}`;
    if (seen.has(dupe)) continue;
    seen.add(dupe);
    const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
    out.push({ id: `${String(el.type || "n")[0]}${el.id}`, kind, name: name.slice(0, 80), chain, lat, lng, km: Math.round(km * 100) / 100,
      address: [street, t["addr:city"]].filter(Boolean).join(", ").slice(0, 120), hours: String(t.opening_hours || "").slice(0, 120),
      website: /^https?:\/\//.test(String(t.website || t["contact:website"] || "")) ? String(t.website || t["contact:website"]).slice(0, 200) : "", cuisine: cuisine.slice(0, 60) });
  }
  return out.sort((a, b) => a.km - b.km);
}

/** A map link that opens Apple Maps on an iPhone and Google Maps elsewhere. */
export const directionsUrl = (p: Pick<Place, "lat" | "lng" | "name">, apple: boolean) =>
  apple ? `https://maps.apple.com/?daddr=${p.lat},${p.lng}&q=${encodeURIComponent(p.name)}` : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
