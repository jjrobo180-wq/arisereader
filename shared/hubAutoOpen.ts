// Arise To Do: open a chosen hub by time or place (Nov 25, 2026). "Weekday mornings, open LifeHub", "From 8 to 4 on
// school days, open WorkHub", "At work, open WorkHub". When To Do opens (or comes back after a while), the first rule
// that fits picks the hub; a place rule wins over a time rule. Switching hubs by hand stays put until the next open.
// Saved with LifeHub (Family.hubOpen), so the rules follow the account; the client keeps a copy for the other hubs.

export type DuoHub = "life" | "work" | "family";
export type HubPlace = { name: string; lat: number; lng: number; radius: number };
export type HubOpenRule = {
  id: string; hub: DuoHub; on: boolean;
  /** "time": between `from` and `to` on `days`; "place": within `place.radius` metres of a saved place (any time on `days`). */
  kind: "time" | "place";
  from: string; to: string; days: number[];
  place?: HubPlace;
};
export const HUB_NAMES: Record<DuoHub, string> = { life: "LifeHub", work: "WorkHub", family: "FamilyHub" };
export const HUB_ROUTE: Record<DuoHub, string> = { life: "/lifehub", work: "/workhub", family: "/familyhub" };
export const PLACE_RADIUS = 150;
/** Away this long counts as opening To Do again. */
export const REOPEN_AFTER_MS = 10 * 60_000;

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));

export function cleanHubOpen(raw: unknown): HubOpenRule[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: HubOpenRule[] = [];
  for (const r of raw.slice(0, 20)) {
    if (!r || typeof r !== "object") continue;
    const hub = (["life", "work", "family"] as const).find((h) => h === (r as any).hub);
    const kind = (r as any).kind === "place" ? "place" : "time";
    if (!hub) continue;
    const days = [...new Set((Array.isArray((r as any).days) ? (r as any).days : []).map(Number).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() as number[];
    const p = (r as any).place;
    const place = p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
      ? { name: String(p.name || "This place").slice(0, 40), lat: Number(p.lat), lng: Number(p.lng), radius: Math.min(2000, Math.max(50, Number(p.radius) || PLACE_RADIUS)) } : undefined;
    if (kind === "place" && !place) continue;
    out.push({
      id: String((r as any).id || Math.random().toString(36).slice(2, 9)).slice(0, 20), hub, on: (r as any).on !== false, kind,
      from: HM.test(String((r as any).from)) ? String((r as any).from) : "06:00", to: HM.test(String((r as any).to)) ? String((r as any).to) : "11:00",
      days: days.length ? days : [0, 1, 2, 3, 4, 5, 6], ...(place ? { place } : {}),
    });
  }
  return out;
}

/** Metres between two points. */
export function distance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Whether a time rule covers this moment (a window past midnight, like 22:00–06:00, works too). */
export function inWindow(r: Pick<HubOpenRule, "from" | "to" | "days">, day: number, minute: number): boolean {
  const a = mins(r.from), b = mins(r.to);
  if (a === b) return r.days.includes(day);
  if (a < b) return r.days.includes(day) && minute >= a && minute < b;
  // Past midnight: the evening part on the day itself, the morning part on the next day.
  return (r.days.includes(day) && minute >= a) || (r.days.includes((day + 6) % 7) && minute < b);
}

/** The hub to open now, or null. `where` is the device's position if it's known. */
export function pickHub(rules: HubOpenRule[] | undefined, now: Date, where?: { lat: number; lng: number } | null): HubOpenRule | null {
  const on = (rules ?? []).filter((r) => r.on);
  const day = now.getDay(), minute = now.getHours() * 60 + now.getMinutes();
  if (where) {
    const place = on.find((r) => r.kind === "place" && r.place && r.days.includes(day) && distance(where, r.place) <= r.place.radius);
    if (place) return place;
  }
  return on.find((r) => r.kind === "time" && inWindow(r, day, minute)) ?? null;
}

/** Words for a rule, like "Weekdays 6:00 AM – 11:00 AM" or "At Work". */
export function ruleWords(r: HubOpenRule): string {
  const days = r.days.length === 7 ? "Every day" : r.days.join() === "1,2,3,4,5" ? "Weekdays" : r.days.join() === "0,6" ? "Weekends"
    : r.days.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ");
  if (r.kind === "place") return `At ${r.place?.name ?? "a place"}${r.days.length === 7 ? "" : ` · ${days}`}`;
  const t = (hm: string) => { const h = Number(hm.slice(0, 2)), m = hm.slice(3); return `${h % 12 || 12}:${m} ${h < 12 ? "AM" : "PM"}`; };
  return `${days} ${t(r.from)} – ${t(r.to)}`;
}
