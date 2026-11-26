// One order for a hub's whole side menu: built-in apps, Plugin Gallery apps and the other plugins (Notes,
// Sheets and Office apps, Drive...) all in one list, so any item moves up or down past any other.
// Before (Nov 26, 2026) each kind had its own list and an item stopped at the edge of its list.
// Keys are the menu's own ids. An item in a folder moves within its folder; one outside steps past a whole folder.

/** The keys in the saved order. A key not saved yet goes right after the key before it in `natural` order
 *  (so a newly added app lands where it used to appear), or first if nothing before it is in the list. */
export function orderMenu(natural: readonly string[], saved: unknown): string[] {
  const savedKeys = Array.isArray(saved) ? saved.filter((k): k is string => typeof k === "string") : [];
  const present = new Set(natural);
  const out = [...new Set(savedKeys.filter((k) => present.has(k)))];
  natural.forEach((k, i) => {
    if (out.includes(k)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) { const p = out.indexOf(natural[j]); if (p >= 0) { at = p + 1; break; } }
    out.splice(at, 0, k);
  });
  return out;
}

/** The menu as rows: a key on its own, or a folder's keys together (where its first key is). */
function units(order: readonly string[], folderOf: (key: string) => string | undefined): string[][] {
  const out: string[][] = [], byFolder = new Map<string, string[]>();
  for (const k of order) {
    const f = folderOf(k);
    if (!f) { out.push([k]); continue; }
    const u = byFolder.get(f);
    if (u) u.push(k); else { const n = [k]; byFolder.set(f, n); out.push(n); }
  }
  return out;
}

/** The order after moving `key` one place up (-1) or down (1), or null when it is already at that end. */
export function moveInMenu(order: readonly string[], key: string, dir: -1 | 1, folderOf: (key: string) => string | undefined = () => undefined): string[] | null {
  const rows = units(order, folderOf);
  const f = folderOf(key);
  if (f) {
    const u = rows.find((r) => r.includes(key))!;
    const at = u.indexOf(key), to = at + dir;
    if (at < 0 || to < 0 || to >= u.length) return null;
    [u[at], u[to]] = [u[to], u[at]];
  } else {
    const at = rows.findIndex((r) => r.length === 1 && r[0] === key && !folderOf(r[0])), to = at + dir;
    if (at < 0 || to < 0 || to >= rows.length) return null;
    [rows[at], rows[to]] = [rows[to], rows[at]];
  }
  return rows.flat();
}

/** The order after dragging `key` to just before `before` (or to the end). */
export function dropInMenu(order: readonly string[], key: string, before: string | null): string[] {
  const rest = order.filter((k) => k !== key);
  const at = before ? rest.indexOf(before) : -1;
  rest.splice(at < 0 ? rest.length : at, 0, key);
  return rest;
}

/** What to save: the new order, then any saved key not in the menu now (hidden apps keep their place at the end). */
export function saveMenuOrder(order: readonly string[], saved: unknown): string[] {
  const old = Array.isArray(saved) ? saved.filter((k): k is string => typeof k === "string") : [];
  return [...order, ...old.filter((k) => !order.includes(k))];
}
