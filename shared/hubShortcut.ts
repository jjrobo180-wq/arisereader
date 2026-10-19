// The header shortcut: one small ⚡ button in the hub's header that opens whatever the person chose —
// any part of their menu (a section, a tab, an installed app) or a web address of their own.
// Kept in the hub's layout (shared/hubLayout.ts), so it follows the person to every device.

export type HubShortcut =
  /** Something in this hub's menu, by its menu id ("calendar", "notes-app-life-notes", "tab:lessons"...). */
  | { kind: "open"; id: string; label: string }
  /** A web address of their own. */
  | { kind: "url"; url: string; label: string };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "");

/** Adds https:// to a bare address ("example.com"); anything that isn't http(s) is refused. */
export function shortcutUrl(raw: unknown): string {
  const t = text(raw, 1000);
  if (!t) return "";
  const withScheme = /^https?:\/\//i.test(t) ? t : /^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(t) ? `https://${t}` : "";
  if (!withScheme) return "";
  try {
    const u = new URL(withScheme);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".") ? u.href : "";
  } catch {
    return "";
  }
}

/** A saved shortcut made safe, or undefined when there isn't a usable one. */
export function cleanShortcut(raw: unknown): HubShortcut | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  if (r.kind === "open") {
    const id = text(r.id, 80), label = text(r.label, 40);
    return id && /^[\w:.-]+$/.test(id) ? { kind: "open", id, label: label || id } : undefined;
  }
  if (r.kind === "url") {
    const url = shortcutUrl(r.url);
    if (!url) return undefined;
    const label = text(r.label, 40) || new URL(url).hostname.replace(/^www\./, "");
    return { kind: "url", url, label };
  }
  return undefined;
}

/** What the button opens right now: a menu item that still exists, a web address, or nothing (so the picker opens). */
export function shortcutTarget<T extends { id: string }>(shortcut: HubShortcut | undefined, items: readonly T[]): { item: T } | { url: string } | null {
  if (!shortcut) return null;
  if (shortcut.kind === "url") return { url: shortcut.url };
  const item = items.find((i) => i.id === shortcut.id);
  return item ? { item } : null;
}
