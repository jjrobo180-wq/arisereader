// Arise Fit outdoor runs and trails: GPS distance and pace, splits, keeping a route small enough to
// save, and finding trails from OpenStreetMap (every mapped trail in the US and beyond) through the
// Overpass API, with place search through Nominatim. Shared by the app and the tests.

export type LatLng = [number, number];
export type RunKind = "run" | "walk" | "hike";
export type Run = { id: string; date: string; kind: RunKind; secs: number; meters: number; path: LatLng[]; trail?: string; climb?: number };

export const MILE = 1609.344;
const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distance in meters between two points. */
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
export const pathMeters = (p: LatLng[]) => p.reduce((t, x, i) => (i ? t + haversine(p[i - 1], x) : 0), 0);

/** A GPS fix is used only when it's accurate enough and actually moved (not standing-still jitter). */
export function acceptFix(last: LatLng | undefined, next: LatLng, accuracy: number, secsSinceLast: number): boolean {
  if (accuracy > 35) return false;
  if (!last) return true;
  const d = haversine(last, next);
  if (d < Math.max(3, accuracy * 0.35)) return false;
  return secsSinceLast <= 0 || d / secsSinceLast < 12; // faster than 12 m/s (27 mph) is a GPS jump
}

/** Pace as "m:ss" per mile or km. */
export function pace(secs: number, meters: number, unit: "mi" | "km"): string {
  if (meters < 10 || secs <= 0) return "--:--";
  const per = secs / (meters / (unit === "mi" ? MILE : 1000));
  if (per > 60 * 60) return "--:--";
  return `${Math.floor(per / 60)}:${String(Math.round(per % 60)).padStart(2, "0")}`;
}
export const distLabel = (meters: number, unit: "mi" | "km") => (meters / (unit === "mi" ? MILE : 1000)).toFixed(2);

/** Seconds for each full mile (or km), from timestamped points. */
export function splits(points: { at: number; ll: LatLng }[], unit: "mi" | "km"): number[] {
  const step = unit === "mi" ? MILE : 1000;
  const out: number[] = []; let dist = 0, mark = step, lastAt = points[0]?.at ?? 0;
  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1].ll, points[i].ll);
    if (dist + d >= mark) {
      const frac = d ? (mark - dist) / d : 0;
      const at = points[i - 1].at + frac * (points[i].at - points[i - 1].at);
      out.push(Math.round((at - lastAt) / 1000)); lastAt = at; mark += step;
    }
    dist += d;
  }
  return out;
}

/** A route made small enough to keep: points at least 8 m apart, at most `max` of them, 5 decimals. */
export function shrinkPath(p: LatLng[], max = 600): LatLng[] {
  const kept: LatLng[] = [];
  for (const x of p) if (!kept.length || haversine(kept[kept.length - 1], x) >= 8) kept.push(x);
  if (p.length && kept[kept.length - 1] !== p[p.length - 1]) kept.push(p[p.length - 1]);
  const stride = Math.ceil(kept.length / max);
  const out = stride > 1 ? kept.filter((_, i) => i % stride === 0 || i === kept.length - 1) : kept;
  return out.map(([a, b]) => [Math.round(a * 1e5) / 1e5, Math.round(b * 1e5) / 1e5]);
}

/** Calories for a run or walk: about 1 kcal per kg per km running, 0.5 walking, 0.7 hiking. */
export const runCalories = (kind: RunKind, meters: number, kg = 80) => Math.round(kg * (meters / 1000) * (kind === "run" ? 1 : kind === "hike" ? 0.7 : 0.5));

export function cleanRuns(raw: unknown): Run[] {
  const ok = (n: unknown, lo: number, hi: number) => Number.isFinite(Number(n)) && Number(n) >= lo && Number(n) <= hi;
  return (Array.isArray(raw) ? raw : []).slice(-300).flatMap((r: any): Run[] => {
    if (!r || typeof r.id !== "string" || typeof r.date !== "string" || Number.isNaN(Date.parse(r.date))) return [];
    const path = (Array.isArray(r.path) ? r.path : []).slice(0, 600).filter((x: any) => Array.isArray(x) && ok(x[0], -90, 90) && ok(x[1], -180, 180)).map((x: any) => [Number(x[0]), Number(x[1])] as LatLng);
    return [{ id: r.id.slice(0, 40), date: r.date.slice(0, 30), kind: r.kind === "walk" || r.kind === "hike" ? r.kind : "run", secs: ok(r.secs, 0, 172800) ? Math.round(r.secs) : 0,
      meters: ok(r.meters, 0, 500000) ? Math.round(r.meters) : 0, path, ...(typeof r.trail === "string" && r.trail ? { trail: r.trail.slice(0, 120) } : {}), ...(ok(r.climb, 0, 20000) ? { climb: Math.round(r.climb) } : {}) }];
  });
}

// ——— Trails (OpenStreetMap) —————————————————————————————————————————————————————————————————————

export const OVERPASS = "https://overpass-api.de/api/interpreter";
export const NOMINATIM = "https://nominatim.openstreetmap.org/search";

export type Trail = { id: number; type: "relation" | "way"; name: string; km?: number; kind: string; difficulty?: string; surface?: string; lat: number; lng: number; away: number };

/** The widest search the app offers (30 miles), plus a little: one fetch covers every radius choice. */
export const TRAIL_KM = 50;
/** Trails are fetched for a grid cell about 11 km across (0.1°), so nearby searches share one answer
 *  and changing the radius never fetches again (the list is just filtered by distance). */
export const trailCell = (lat: number, lng: number): [number, number] => [Math.round(lat * 10) / 10, Math.round(lng * 10) / 10];

/** Named hiking routes and trails within `km` of a point. A box (not a circle) is much faster for
 *  Overpass to search; the app measures each trail's real distance afterwards. */
export function trailsQuery(lat: number, lng: number, km = 25): string {
  const k = Math.min(60, Math.max(2, km));
  const dLat = k / 111, dLng = k / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const box = [lat - dLat, lng - dLng, lat + dLat, lng + dLng].map((n) => n.toFixed(4)).join(",");
  return `[out:json][timeout:20][bbox:${box}];(relation["route"~"^(hiking|foot|running|mtb)$"]["name"];way["highway"~"^(path|footway|track|bridleway)$"]["name"]["sac_scale"];way["highway"="path"]["name"]["trail_visibility"];);out tags center 300;`;
}
/** One trail's full line. */
export const trailGeometryQuery = (t: Pick<Trail, "id" | "type">) => `[out:json][timeout:25];${t.type}(${t.id});out geom;`;

const DIFF: Record<string, string> = { hiking: "Easy", mountain_hiking: "Moderate", demanding_mountain_hiking: "Hard", alpine_hiking: "Expert", demanding_alpine_hiking: "Expert", difficult_alpine_hiking: "Expert" };

/** Overpass results → a de-duplicated list of trails, nearest first. */
export function parseTrails(json: any, from: LatLng): Trail[] {
  const seen = new Set<string>(); const out: Trail[] = [];
  for (const e of Array.isArray(json?.elements) ? json.elements : []) {
    const name = String(e?.tags?.name || "").trim();
    const c = e?.center ?? (e?.lat != null ? { lat: e.lat, lon: e.lon } : null);
    if (!name || !c || (e.type !== "relation" && e.type !== "way")) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue; seen.add(key);
    const distTag = parseFloat(String(e.tags.distance || "").replace(",", "."));
    out.push({ id: Number(e.id), type: e.type, name, kind: e.tags.route || e.tags.highway || "trail",
      ...(Number.isFinite(distTag) && distTag > 0 ? { km: /mi/.test(String(e.tags.distance)) ? distTag * 1.609 : distTag } : {}),
      ...(DIFF[e.tags.sac_scale] ? { difficulty: DIFF[e.tags.sac_scale] } : {}), ...(e.tags.surface ? { surface: String(e.tags.surface) } : {}),
      lat: c.lat, lng: c.lon, away: haversine(from, [c.lat, c.lon]) });
  }
  return out.sort((a, b) => a.away - b.away);
}

/** A trail's geometry from Overpass "out geom" → lines of points. */
export function parseGeometry(json: any): LatLng[][] {
  const lines: LatLng[][] = [];
  for (const e of Array.isArray(json?.elements) ? json.elements : []) {
    if (Array.isArray(e?.geometry)) lines.push(e.geometry.map((g: any) => [g.lat, g.lon] as LatLng));
    for (const m of Array.isArray(e?.members) ? e.members : []) if (Array.isArray(m?.geometry)) lines.push(m.geometry.map((g: any) => [g.lat, g.lon] as LatLng));
  }
  return lines.filter((l) => l.length > 1);
}
