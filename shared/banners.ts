// The site's banners (login page, students, teachers): a line of text the admin posts.
// A banner can carry a link to a page on this site, so tapping it opens that page.

export type SiteBanner = { text: string; bgColor: string; textColor: string; active: boolean; /** A page on this site to open when the banner is tapped, like "/fall-break". */ link?: string };

export const BANNER_LINK_MAX = 120;

/**
 * A banner's link, tidied: a page on this site, written as its path ("/fall-break").
 * The whole address can be pasted ("https://www.arisereader.com/#/fall-break") and is cut down to the path.
 * Anything that is not a page on this site (another website, a script) gives "", so the banner is not a link.
 */
export function cleanBannerLink(value: unknown): string {
  let path = String(value ?? "").trim().replace(/^https?:\/\/(www\.)?arisereader\.com\/?/i, "").replace(/^\/?#/, "");
  if (!path) return "";
  if (!path.startsWith("/")) path = `/${path}`;
  return path.length <= BANNER_LINK_MAX && /^\/[A-Za-z0-9][A-Za-z0-9\-_/]*(\?[A-Za-z0-9\-_=&%.]*)?$/.test(path) && !path.includes("//") ? path : "";
}

/** What the banner's link points the browser at ("#/fall-break"), or "" when it has no link. */
export function bannerHref(link: unknown): string {
  const path = cleanBannerLink(link);
  return path ? `#${path}` : "";
}

/** A banner as it is saved: its link is kept only when it is a page on this site. */
export function withBannerLink<T extends object>(banner: T, link: unknown): T & { link?: string } {
  const path = cleanBannerLink(link);
  return path ? { ...banner, link: path } : banner;
}
