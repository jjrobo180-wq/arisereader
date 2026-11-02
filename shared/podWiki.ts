// Pod+ Wiki podcasts: any Wikipedia article read aloud by an AI voice. Wikipedia's text is licensed
// CC BY-SA 4.0, which allows reuse and adaptation (a spoken reading included) as long as the article
// and its authors are credited with a link and the reading is shared under the same license. Every
// episode says so at the start and end and shows the credit on screen.

const API = "https://en.wikipedia.org/w/api.php";
export const wikiSearchUrl = (q: string) => `${API}?${new URLSearchParams({ action: "query", list: "search", srsearch: q, srlimit: "15", srprop: "snippet|wordcount", format: "json", origin: "*" })}`;
export const wikiArticleUrl = (title: string) => `${API}?${new URLSearchParams({ action: "query", prop: "extracts|pageimages|info", explaintext: "1", exsectionformat: "wiki", inprop: "url", piprop: "thumbnail", pithumbsize: "800", redirects: "1", titles: title, format: "json", origin: "*" })}`;
export const wikiFeaturedUrl = (d = new Date()) => `https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
export const wikiPageUrl = (title: string) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
export const WIKI_LICENSE = { name: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" };

export type WikiHit = { title: string; snippet: string; words: number };
export type WikiSection = { title: string; text: string };
export type WikiArticle = { title: string; url: string; image?: string; sections: WikiSection[]; words: number };

const strip = (html: string) => String(html || "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export function parseSearch(json: any): WikiHit[] {
  return (json?.query?.search ?? []).map((h: any) => ({ title: String(h.title), snippet: strip(h.snippet), words: Number(h.wordcount) || 0 })).filter((h: WikiHit) => h.title);
}

/** Sections that are lists of links or sources, not something to listen to. */
const SKIP = /^(see also|references|external links|notes|further reading|bibliography|sources|citations|footnotes|works cited|gallery|explanatory notes|notes and references)$/i;

/** A plain-text extract ("== Heading ==" lines) → readable sections, the introduction first. */
export function parseSections(text: string): WikiSection[] {
  const out: WikiSection[] = []; let cur: WikiSection = { title: "Introduction", text: "" }; const stack: string[] = [];
  for (const line of String(text || "").split("\n")) {
    const m = /^(={2,6})\s*(.+?)\s*\1\s*$/.exec(line.trim());
    if (m) {
      if (cur.text.trim()) out.push({ ...cur, text: cur.text.trim() });
      const level = m[1].length - 2; stack.length = level; stack[level] = m[2];
      cur = { title: stack.filter(Boolean).join(" · "), text: "" };
    } else if (line.trim()) cur.text += (cur.text ? "\n" : "") + line.trim();
  }
  if (cur.text.trim()) out.push({ ...cur, text: cur.text.trim() });
  return out.filter((s) => !SKIP.test(s.title.split(" · ")[0].trim()) && s.text.length > 40);
}

export function parseArticle(json: any): WikiArticle | null {
  const page = Object.values(json?.query?.pages ?? {})[0] as any;
  if (!page || page.missing !== undefined || !page.extract) return null;
  const sections = parseSections(page.extract);
  if (!sections.length) return null;
  return { title: String(page.title), url: String(page.fullurl || wikiPageUrl(page.title)), ...(page.thumbnail?.source ? { image: String(page.thumbnail.source) } : {}), sections, words: sections.reduce((t, s) => t + s.text.split(/\s+/).length, 0) };
}

/** Minutes to read words aloud (about 150 a minute at normal speed). */
export const listenMinutes = (words: number, rate = 1) => Math.max(1, Math.round(words / (150 * rate)));

/** What's said before and after an episode: the credit the license asks for. */
export const wikiIntro = (title: string) => `${title}. From Wikipedia, the free encyclopedia, read by an AI voice.`;
export const wikiOutro = (title: string) => `That was the Wikipedia article ${title}, written by Wikipedia's contributors and shared under the Creative Commons Attribution Share-Alike license.`;

export type FeaturedWiki = { title: string; extract: string; image?: string };
export function parseFeatured(json: any): { today?: FeaturedWiki; popular: FeaturedWiki[] } {
  const f = (a: any): FeaturedWiki | null => a?.titles?.normalized ? { title: String(a.titles.normalized), extract: String(a.extract || ""), ...(a.thumbnail?.source ? { image: String(a.thumbnail.source) } : {}) } : null;
  const today = f(json?.tfa) ?? undefined;
  const popular = (json?.mostread?.articles ?? []).map(f).filter((x: FeaturedWiki | null): x is FeaturedWiki => !!x && !/^(Main Page|Special:|Wikipedia:)/.test(x.title)).slice(0, 12);
  return { today, popular };
}
