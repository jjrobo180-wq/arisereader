/** Licensed real-person photos for the Five-Minute Reads shelf and library.
 * Resolve Wikipedia's page image, then verify the actual FILE and its license on Wikimedia Commons.
 * Never redirect to an unknown artist image or an unlicensed non-free thumbnail.
 */
import type { Express } from "express";
import { NEWS_ARTICLES } from "../shared/ariseNews";
import { newsCoverSvg } from "../shared/newsArt";

type VerifiedPhoto = { url: string; page: string; author: string; license: string; alt: string };
type CacheEntry = { at: number; value: VerifiedPhoto | null };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<VerifiedPhoto | null>>();
const MAX_AGE = 24 * 60 * 60 * 1000;

function plain(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim().slice(0, 160);
}
async function jsonFrom(url: URL): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "AriseReaderEducationalLibrary/1.0 (Wikimedia attribution and license verification)" } });
    if (!r.ok) throw new Error("Photo metadata returned " + r.status);
    return await r.json();
  } finally { clearTimeout(timeout); }
}

export async function resolveLicensedPhoto(article: (typeof NEWS_ARTICLES)[number]): Promise<VerifiedPhoto | null> {
  const title = article.photo?.wikipediaTitle;
  if (!title) return null;
  const old = cache.get(title);
  if (old && Date.now() - old.at < MAX_AGE) return old.value;
  const pending = inflight.get(title);
  if (pending) return pending;
  const work = (async () => {
    try {
      const wiki = new URL("https://en.wikipedia.org/w/api.php");
      wiki.search = new URLSearchParams({ action: "query", format: "json", prop: "pageimages", piprop: "name", titles: title }).toString();
      const response = await jsonFrom(wiki);
      const page = Object.values(response?.query?.pages || {})[0] as any;
      const name = String(page?.pageimage || "");
      if (!name || !/\.(jpg|jpeg|png|webp)$/i.test(name)) return null;
      const commons = new URL("https://commons.wikimedia.org/w/api.php");
      commons.search = new URLSearchParams({ action: "query", format: "json", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "1280", titles: "File:" + name }).toString();
      const meta = await jsonFrom(commons);
      const file = Object.values(meta?.query?.pages || {})[0] as any;
      const image = file?.imageinfo?.[0];
      const license = String(image?.extmetadata?.LicenseShortName?.value || "");
      const artist = plain(String(image?.extmetadata?.Artist?.value || "Wikimedia Commons contributor"));
      const allowed = /^(CC0|CC BY(?:-SA)?(?: |-|$)|Public domain|PD\b)/i.test(license);
      const url = String(image?.thumburl || image?.url || "");
      if (!allowed || !url.startsWith("https://upload.wikimedia.org/")) return null;
      return { url, page: String(image?.descriptionurl || "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(name)), author: artist, license, alt: article.photo?.alt || title };
    } catch { return null; }
  })();
  inflight.set(title, work);
  try {
    const value = await work;
    cache.set(title, { at: Date.now(), value });
    return value;
  } finally { inflight.delete(title); }
}

export function registerNewsPhotoRoutes(app: Express) {
  app.get("/api/news/cover/:slug", async (req, res) => {
    const article = NEWS_ARTICLES.find(a => a.slug === req.params.slug);
    if (!article) { res.status(404).end(); return; }
    const photo = article.photo?.wikipediaTitle ? await resolveLicensedPhoto(article) : null;
    if (photo) {
      res.set("Cache-Control", "public, max-age=21600");
      res.redirect(302, photo.url);
      return;
    }
    // No silently invented photos: an unmistakable original SVG fallback if a real,
    // reusable image could not be verified.
    res.type("image/svg+xml").set("Cache-Control", "public, max-age=3600").send(newsCoverSvg(article));
  });
  app.get("/api/news/photo-credit/:slug", async (req, res) => {
    const article = NEWS_ARTICLES.find(a => a.slug === req.params.slug && !!a.photo?.wikipediaTitle);
    if (!article) { res.status(404).json({ message: "Not found" }); return; }
    const photo = await resolveLicensedPhoto(article);
    res.set("Cache-Control", "public, max-age=21600").json(photo ? { page: photo.page, author: photo.author, license: photo.license } : { unavailable: true });
  });
}
