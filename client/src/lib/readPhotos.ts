// Real photos for the A.R.I.S.E. Originals (5-Minute Reads), found by the browser itself.
//
// The server also looks these photos up (server/newsPhotos.ts), but if it can't reach Wikipedia a
// drawing shows instead. So the browser asks Wikipedia too: one request for every story at once,
// asking only for free-to-reuse photos (pilicense=free), remembered for a week. Any cover image
// still pointing at the server's /api/news/cover/ address is switched to the photo as soon as it's
// found, wherever it is on the page (shelf, library card, quiz page).
import { NEWS_ARTICLES, readPhotoFound, type NewsArticle } from "@shared/ariseNews";

const STORE = "arise_read_photos_v3";
const WEEK = 7 * 24 * 60 * 60 * 1000;
const COVER_PATH = "/api/news/cover/";

function load(): void {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (saved && Date.now() - Number(saved.at) < WEEK && saved.photos) Object.assign(readPhotoFound, saved.photos);
  } catch { /* storage blocked: look them up again */ }
}
function save(): void {
  try { localStorage.setItem(STORE, JSON.stringify({ at: Date.now(), photos: readPhotoFound })); } catch { /* ignore */ }
}

const isPhoto = (url: unknown) => typeof url === "string" && url.startsWith("https://upload.wikimedia.org/");

/** Page title → free photo thumbnail, for up to 50 titles per request. */
async function pageThumbs(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const q = new URLSearchParams({
      action: "query", format: "json", origin: "*", redirects: "1", prop: "pageimages",
      piprop: "thumbnail", pithumbsize: "640", pilicense: "free", pilimit: "50", titles: batch.join("|"),
    });
    try {
      const r = await fetch(`https://en.wikipedia.org/w/api.php?${q}`);
      if (!r.ok) continue;
      const d = await r.json();
      // Wikipedia tidies titles ("Octopus" stays, "Lunar_phase" → "Lunar phase") and follows redirects.
      const alias = new Map<string, string>();
      for (const n of d?.query?.normalized || []) alias.set(n.to, n.from);
      for (const n of d?.query?.redirects || []) alias.set(n.to, alias.get(n.from) || n.from);
      for (const p of Object.values(d?.query?.pages || {}) as any[]) {
        const src = p?.thumbnail?.source;
        if (!src || !/\.(jpe?g|png|webp)$/i.test(String(p?.pageimage || ""))) continue; // no logos or drawings (.svg)
        out.set(alias.get(p.title) || p.title, src);
        out.set(p.title, src);
      }
    } catch { /* offline or blocked: keep the drawing */ }
  }
  return out;
}

/** A free photo from a Wikimedia Commons search whose file name mentions the subject. */
async function commonsSearch(term: string, mustMention: string): Promise<string | null> {
  const q = new URLSearchParams({
    action: "query", format: "json", origin: "*", generator: "search", gsrnamespace: "6", gsrlimit: "15",
    gsrsearch: `${term} filetype:bitmap`, prop: "imageinfo", iiprop: "url|extmetadata|size", iiurlwidth: "640",
  });
  try {
    const r = await fetch(`https://commons.wikimedia.org/w/api.php?${q}`);
    if (!r.ok) return null;
    const d = await r.json();
    const need = mustMention.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const pages = (Object.values(d?.query?.pages || {}) as any[]).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
    for (const p of pages) {
      const name = String(p?.title || "").replace(/^File:/, "");
      const info = p?.imageinfo?.[0];
      const license = String(info?.extmetadata?.LicenseShortName?.value || "");
      if (need && !name.toLowerCase().replace(/[^a-z0-9]+/g, "").includes(need)) continue;
      if (!/\.(jpe?g|png|webp)$/i.test(name) || Number(info?.width) < 400) continue;
      if (!/^(CC0|CC BY(?:-SA)?(?: |-|$)|Public domain|PD\b)/i.test(license)) continue;
      if (info?.thumburl) return String(info.thumburl);
    }
  } catch { /* ignore */ }
  return null;
}

let started: Promise<void> | null = null;

/** Finds a photo for every story that doesn't have one yet. Safe to call more than once. */
export function findReadPhotos(articles: NewsArticle[] = NEWS_ARTICLES): Promise<void> {
  if (started) return started;
  started = (async () => {
    load();
    const todo = articles.filter((a) => !a.photo?.file && a.photo?.wikipediaTitle && !readPhotoFound[a.slug]);
    if (todo.length) {
      const titles = [...new Set(todo.flatMap((a) => [a.photo!.wikipediaTitle!, ...(a.photo!.alsoTry || [])]))];
      const thumbs = await pageThumbs(titles);
      for (const a of todo) {
        for (const t of [a.photo!.wikipediaTitle!, ...(a.photo!.alsoTry || [])]) {
          const src = thumbs.get(t);
          if (src) { readPhotoFound[a.slug] = src; break; }
        }
      }
      for (const a of todo) {
        if (readPhotoFound[a.slug] || !a.photo?.search) continue;
        const src = await commonsSearch(a.photo.search, a.photo.mustMention || "");
        if (src) readPhotoFound[a.slug] = src;
      }
      save();
    }
    swapAll(document);
  })();
  return started;
}

/** Points any cover still using the server address at the photo the browser found. */
function swapImg(img: HTMLImageElement): void {
  const src = img.getAttribute("src") || "";
  const at = src.indexOf(COVER_PATH);
  if (at < 0) return;
  const slug = decodeURIComponent(src.slice(at + COVER_PATH.length).split(/[?#]/)[0]);
  const photo = readPhotoFound[slug];
  if (photo && isPhoto(photo)) img.setAttribute("src", photo);
}
function swapAll(root: ParentNode): void {
  root.querySelectorAll?.(`img[src*="${COVER_PATH}"]`).forEach((n) => swapImg(n as HTMLImageElement));
}

/** Starts the lookup and keeps every cover on the page switched to its photo. Call once at startup. */
export function installReadPhotos(): void {
  if (typeof window === "undefined" || typeof MutationObserver === "undefined") return;
  load();
  const watch = new MutationObserver((changes) => {
    for (const c of changes) {
      if (c.type === "attributes" && c.target instanceof HTMLImageElement) swapImg(c.target);
      c.addedNodes.forEach((n) => {
        if (n instanceof HTMLImageElement) swapImg(n);
        else if (n instanceof Element) swapAll(n);
      });
    }
  });
  watch.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["src"] });
  swapAll(document);
  // After the page has settled, so it never slows down the first screen.
  setTimeout(() => { void findReadPhotos(); }, 1500);
}
