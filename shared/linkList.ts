// Links (LifeHub and WorkHub): the small rules of the simple link list (client/src/components/family-hub/LinkPage.tsx).
import type { LinkPage } from "./familyHub";
import { linkHost } from "./linkPageLook";

/** Adds https:// when someone types a bare address like example.com; an email becomes mailto:. "" if it isn't one. */
export const fixUrl = (u: string) => { const t = u.trim(); if (!t) return ""; if (/^(https?:\/\/|mailto:|tel:)/i.test(t)) return t; if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(t)) return `mailto:${t}`; return /^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(t) ? `https://${t}` : ""; };

/** A name for a link from its address, when none was typed: "docs.google.com" → "Docs Google". */
export function nameFromUrl(url: string): string {
  const host = linkHost(url).replace(/^www\./, "");
  if (!host) return url.replace(/^mailto:/, "").slice(0, 80);
  const parts = host.split(".").slice(0, -1).filter((p) => !["com", "co", "org", "net"].includes(p));
  return (parts.length ? parts : [host]).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ").slice(0, 80);
}

/** The folders of a page in order: the saved list, then any a link names that the list lacks. */
export function foldersOf(page: LinkPage): string[] {
  return [...new Set([...(page.folders ?? []), ...page.links.map((l) => (l.group || "").trim()).filter(Boolean)])];
}
