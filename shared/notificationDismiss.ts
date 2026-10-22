// Dismissing the bell's "this device" items (LifeHub and WorkHub: tasks, bills, events, meetings, poll answers).
//
// Their keys start with "life:" or "work:". They are built from the person's own data, so the server never lists
// them, but it does remember which ones were cleared, so a cleared item stays cleared when the bell is opened
// again, after a refresh, and on the person's other devices. The bell keeps the same list in the browser so it
// is hidden at once, even offline. Both sides use these functions.

export type Dismissal = { k: string; at: number };

/** What a "this device" key looks like. Anything else is refused, so the list can't be filled with junk. */
export const LOCAL_KEY = /^(life|work):[^\s\u0000-\u001f\u007f]{1,200}$/;
export const isLocalKey = (key: string) => key.startsWith("life:") || key.startsWith("work:");

const MAX_KEPT = 400;                      // newest 400 are kept
const KEEP_MS = 120 * 24 * 3600 * 1000;    // and nothing older than about four months
export const MAX_PER_REQUEST = 100;

/** Valid, unique keys from whatever a page or the server sent. */
export function cleanKeys(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out = new Set<string>();
  for (const key of input) if (typeof key === "string" && LOCAL_KEY.test(key)) out.add(key);
  return Array.from(out).slice(0, MAX_PER_REQUEST);
}

/** Reads a stored list (JSON text or an array) and drops anything invalid or too old. */
export function parseDismissals(raw: unknown, now = Date.now()): Dismissal[] {
  let value: unknown = raw;
  if (typeof raw === "string") { try { value = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(value)) return [];
  const seen = new Map<string, number>();
  for (const entry of value) {
    const key = typeof entry === "string" ? entry : (entry as any)?.k;
    const at = typeof entry === "string" ? now : Number((entry as any)?.at);
    if (typeof key !== "string" || !LOCAL_KEY.test(key) || !Number.isFinite(at) || now - at >= KEEP_MS) continue;
    seen.set(key, Math.max(seen.get(key) ?? 0, Math.min(at, now)));
  }
  return trim(Array.from(seen, ([k, at]) => ({ k, at })));
}

/** The list with these keys added (or refreshed). */
export function addDismissals(list: Dismissal[], keys: string[], now = Date.now()): Dismissal[] {
  const fresh = cleanKeys(keys);
  if (!fresh.length) return list;
  const next = new Map(list.map((d) => [d.k, d.at] as const));
  for (const key of fresh) next.set(key, now);
  return trim(Array.from(next, ([k, at]) => ({ k, at })));
}

function trim(list: Dismissal[]): Dismissal[] {
  return list.sort((a, b) => a.at - b.at || a.k.localeCompare(b.k)).slice(-MAX_KEPT);
}

export const dismissedKeys = (list: Dismissal[]): string[] => list.map((d) => d.k);
