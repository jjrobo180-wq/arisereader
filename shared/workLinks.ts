// The WorkHub's Link page (workspace.linkPage). It is its own page, kept apart from the LifeHub's
// (family.linkPage): the links you keep for work are not the links you keep for life, and neither shows up
// in the other hub, in its widgets or in anything shared.
//
// The first WorkHub version of this plugin was a plain list kept as Plugin Kit records (plugin "link-page",
// with a name, a web address and a folder). Until a teacher changes their page, those records are shown as the
// page's links, so nothing they saved goes missing; the first change saves them as the page.
import { cleanLinkPage, type LinkPage } from "./familyHub";
import type { KitRecord } from "./pluginKit";

const asUrl = (v: unknown): string => {
  const t = String(v ?? "").trim();
  if (!t) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(t)) return t;
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(t)) return `mailto:${t}`;
  return /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t) ? `https://${t}` : "";
};

/** The links the old list plugin saved, as a page's links. */
export function legacyLinks(records: readonly KitRecord[] | undefined): LinkPage["links"] {
  return (records ?? []).filter((r) => r.plugin === "link-page").map((r) => {
    const url = asUrl(r.data?.url), title = String(r.data?.title ?? "").trim().slice(0, 80) || url.replace(/^https?:\/\//, "").slice(0, 80);
    const group = String(r.data?.folder ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 30);
    return title && url ? { id: r.id, title, url, emoji: "🔗", ...(group ? { group } : {}) } : null;
  }).filter((x): x is LinkPage["links"][number] => !!x);
}

/** The WorkHub's page: what was saved, or (before anything was saved) the old list's links. Never the LifeHub's. */
export function workLinkPage(saved: unknown, records?: readonly KitRecord[]): LinkPage {
  if (saved && typeof saved === "object") return cleanLinkPage(saved);
  return cleanLinkPage({ title: "", bio: "", links: legacyLinks(records) });
}
