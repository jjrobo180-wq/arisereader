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

const PHOTO_FILE = /\.(jpe?g|png|webp)$/i;
const FREE_LICENSE = /^(CC0|CC BY(?:-SA)?(?: |-|$)|Public domain|PD\b)/i;
const squash = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");

/** A Commons file's details, or null when it isn't a photo anyone may reuse. */
function verified(image: any, name: string, alt: string): VerifiedPhoto | null {
  const license = String(image?.extmetadata?.LicenseShortName?.value || "");
  const url = String(image?.thumburl || image?.url || "");
  if (!PHOTO_FILE.test(name) || !FREE_LICENSE.test(license) || !url.startsWith("https://upload.wikimedia.org/")) return null;
  const artist = plain(String(image?.extmetadata?.Artist?.value || "Wikimedia Commons contributor"));
  return { url, page: String(image?.descriptionurl || "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(name)), author: artist, license, alt };
}

/** The main photo of a Wikipedia page, if it's a free one. */
async function fromWikipediaPage(title: string, alt: string): Promise<VerifiedPhoto | null> {
  const wiki = new URL("https://en.wikipedia.org/w/api.php");
  wiki.search = new URLSearchParams({ action: "query", format: "json", redirects: "1", prop: "pageimages", piprop: "name", titles: title }).toString();
  const response = await jsonFrom(wiki);
  const page = Object.values(response?.query?.pages || {})[0] as any;
  const name = String(page?.pageimage || "");
  if (!name || !PHOTO_FILE.test(name)) return null;
  const commons = new URL("https://commons.wikimedia.org/w/api.php");
  commons.search = new URLSearchParams({ action: "query", format: "json", prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "1280", titles: "File:" + name }).toString();
  const meta = await jsonFrom(commons);
  const file = Object.values(meta?.query?.pages || {})[0] as any;
  return verified(file?.imageinfo?.[0], name, alt);
}

/** A free photo found by searching Wikimedia Commons; its file name must mention `mustMention`. */
async function fromCommonsSearch(term: string, mustMention: string, alt: string): Promise<VerifiedPhoto | null> {
  const commons = new URL("https://commons.wikimedia.org/w/api.php");
  commons.search = new URLSearchParams({
    action: "query", format: "json", generator: "search", gsrnamespace: "6", gsrlimit: "15",
    gsrsearch: `${term} filetype:bitmap`, prop: "imageinfo", iiprop: "url|extmetadata|size", iiurlwidth: "1280",
  }).toString();
  const meta = await jsonFrom(commons);
  const pages = (Object.values(meta?.query?.pages || {}) as any[]).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  const need = squash(mustMention);
  for (const p of pages) {
    const name = String(p?.title || "").replace(/^File:/, "");
    const info = p?.imageinfo?.[0];
    if (need && !squash(name).includes(need)) continue;
    if (Number(info?.width) < 400 || Number(info?.height) < 300) continue; // tiny icons and crops look bad on a cover
    const ok = verified(info, name, alt);
    if (ok) return ok;
  }
  return null;
}

export async function resolveLicensedPhoto(article: (typeof NEWS_ARTICLES)[number]): Promise<VerifiedPhoto | null> {
  const photo = article.photo;
  const title = photo?.wikipediaTitle;
  if (!title) return null;
  const cacheKey = article.slug;
  const old = cache.get(cacheKey);
  // A found photo is kept a day; a miss is tried again after an hour (Wikipedia may have been slow).
  if (old && Date.now() - old.at < (old.value ? MAX_AGE : 60 * 60 * 1000)) return old.value;
  const pending = inflight.get(cacheKey);
  if (pending) return pending;
  const alt = photo?.alt || title;
  const work = (async () => {
    // The story's own page first, then the other pages it lists, then a Commons search.
    for (const page of [title, ...(photo?.alsoTry || [])]) {
      try { const found = await fromWikipediaPage(page, alt); if (found) return found; } catch { /* try the next one */ }
    }
    if (photo?.search) {
      try { const found = await fromCommonsSearch(photo.search, photo.mustMention || "", alt); if (found) return found; } catch { /* nothing more to try */ }
    }
    return null;
  })();
  inflight.set(cacheKey, work);
  try {
    const value = await work;
    cache.set(cacheKey, { at: Date.now(), value });
    return value;
  } finally { inflight.delete(cacheKey); }
}

export function registerNewsPhotoRoutes(app: Express) {
  // Look every story's photo up once in the background, so the shelf's first visitor doesn't wait.
  if (process.env.NODE_ENV !== "test") setTimeout(async () => {
    for (const a of NEWS_ARTICLES) if (a.photo?.wikipediaTitle) await resolveLicensedPhoto(a).catch(() => null);
  }, 20_000).unref?.();
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
