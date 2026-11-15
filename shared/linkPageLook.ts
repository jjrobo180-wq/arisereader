// How a Link page looks (November 2026): a calm, minimal profile page rather than a stack of loud
// buttons. Social profiles (Instagram, TikTok, YouTube...) become a row of small icons under the name;
// everything else is a quiet list (or grid) of rows showing the site each one goes to. Four themes.
// Used by the public page (client/src/pages/TodoShare.tsx), the editor's preview, the Home card and the
// iPhone widget's text.

export type LinkPageTheme = "light" | "dark" | "sand" | "mist";
export const LINK_THEMES: { id: LinkPageTheme; name: string; swatch: string }[] = [
  { id: "light", name: "Paper", swatch: "#ffffff" },
  { id: "dark", name: "Ink", swatch: "#111114" },
  { id: "sand", name: "Sand", swatch: "#f3eee6" },
  { id: "mist", name: "Mist", swatch: "#eef1f6" },
];
export const isLinkTheme = (v: unknown): v is LinkPageTheme => LINK_THEMES.some((t) => t.id === v);

/** Colours for each theme: page, text, quieter text, rows and their borders. */
export const THEME_COLORS: Record<LinkPageTheme, { page: string; text: string; sub: string; row: string; rowHover: string; line: string; mark: string; markText: string }> = {
  light: { page: "#ffffff", text: "#111114", sub: "#6b6b76", row: "#ffffff", rowHover: "#f7f7f9", line: "#e8e8ee", mark: "#111114", markText: "#ffffff" },
  dark: { page: "#0f0f12", text: "#f4f4f6", sub: "#9a9aa6", row: "#18181d", rowHover: "#202027", line: "#2a2a32", mark: "#f4f4f6", markText: "#0f0f12" },
  sand: { page: "#f3eee6", text: "#2a241c", sub: "#7a6f60", row: "#fbf8f3", rowHover: "#ffffff", line: "#e4dccf", mark: "#2a241c", markText: "#f3eee6" },
  mist: { page: "#eef1f6", text: "#141a26", sub: "#5f6b80", row: "#ffffff", rowHover: "#f8fafc", line: "#dde3ec", mark: "#1e2a44", markText: "#ffffff" },
};

export type LinkBrand = "instagram" | "tiktok" | "youtube" | "x" | "facebook" | "linkedin" | "github" | "twitch" | "spotify" | "snapchat" | "pinterest" | "threads" | "email" | "phone";
const BRANDS: [LinkBrand, string, RegExp][] = [
  ["instagram", "Instagram", /(^|\.)instagram\.com$/],
  ["tiktok", "TikTok", /(^|\.)tiktok\.com$/],
  ["youtube", "YouTube", /(^|\.)(youtube\.com|youtu\.be)$/],
  ["x", "X", /(^|\.)(x\.com|twitter\.com)$/],
  ["facebook", "Facebook", /(^|\.)(facebook\.com|fb\.com)$/],
  ["linkedin", "LinkedIn", /(^|\.)linkedin\.com$/],
  ["github", "GitHub", /(^|\.)github\.com$/],
  ["twitch", "Twitch", /(^|\.)twitch\.tv$/],
  ["spotify", "Spotify", /(^|\.)spotify\.com$/],
  ["snapchat", "Snapchat", /(^|\.)snapchat\.com$/],
  ["pinterest", "Pinterest", /(^|\.)pinterest\.[a-z.]+$/],
  ["threads", "Threads", /(^|\.)threads\.(net|com)$/],
];

/** The site a link goes to, without "www." ("instagram.com"), or the address for email and phone links. */
export function linkHost(url: string): string {
  if (/^mailto:/i.test(url)) return url.slice(7).split("?")[0];
  if (/^tel:/i.test(url)) return url.slice(4);
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

/** A social profile or a way to get in touch, shown as a small icon instead of a row. */
export function linkBrand(url: string): { id: LinkBrand; name: string } | null {
  if (/^mailto:/i.test(url)) return { id: "email", name: "Email" };
  if (/^tel:/i.test(url)) return { id: "phone", name: "Phone" };
  const host = linkHost(url);
  for (const [id, name, re] of BRANDS) if (re.test(host)) return { id, name };
  return null;
}

/** Splits a page's links: icons for social profiles (at most 8, in order), rows for the rest. */
export function splitLinks<T extends { url: string }>(links: readonly T[]): { icons: (T & { brand: { id: LinkBrand; name: string } })[]; rows: T[] } {
  const icons: (T & { brand: { id: LinkBrand; name: string } })[] = [];
  const rows: T[] = [];
  const seen = new Set<LinkBrand>();
  for (const l of links) {
    const brand = linkBrand(l.url);
    if (brand && !seen.has(brand.id) && icons.length < 8) { seen.add(brand.id); icons.push({ ...l, brand }); }
    else rows.push(l);
  }
  return { icons, rows };
}

/** One or two letters for the round mark at the top ("Jermaine Robinson" -> "JR"). */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (!words.length) return "?";
  const first = (w: string) => (w.match(/[\p{L}\p{N}]/u)?.[0] || "").toUpperCase();
  return words.length === 1 ? first(words[0]) : first(words[0]) + first(words[words.length - 1]);
}
