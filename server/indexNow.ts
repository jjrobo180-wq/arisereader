// IndexNow: tells Bing (and the other search engines that share IndexNow: Yandex, Naver, Seznam…)
// the moment a public page is new or changed, instead of waiting for them to crawl. Bing's index
// also feeds DuckDuckGo, Yahoo and ChatGPT search. Google doesn't use IndexNow; it reads the sitemaps.
//
// After each start in production the server compares the public pages (both sitemaps) with what it
// last sent, kept in the settings table, and sends only the pages that are new or whose lastmod
// changed — so the many deploys a day don't resend the same list. The key file that proves the
// sites are ours is client/public/<INDEXNOW_KEY>.txt, served on both domains.

export const INDEXNOW_KEY = "9cdb74bc86132db459cb5c8432f3214b";
export const INDEXNOW_SETTING = "indexnow_sent_v1";
const ENDPOINT = "https://api.indexnow.org/indexnow";

export type Page = { loc: string; lastmod: string };
export type Site = { host: string; pages: Page[] };
/** What was last sent: host → page address → its lastmod then. */
export type Sent = Record<string, Record<string, string>>;

export type IndexNowDeps = {
  getSetting(key: string): Promise<string>;
  upsertSetting(key: string, value: string): Promise<void>;
  /** Sends one IndexNow request; resolves with the HTTP status. */
  post(url: string, body: unknown): Promise<number>;
  log(line: string): void;
};

/** The <loc> and <lastmod> of each <url> in a sitemap. */
export function sitemapPages(xml: string): Page[] {
  const pages: Page[] = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>\s*([^<\s]+)\s*<\/loc>/.exec(m[1])?.[1];
    if (!loc) continue;
    const lastmod = /<lastmod>\s*([^<\s]+)\s*<\/lastmod>/.exec(m[1])?.[1] ?? "";
    pages.push({ loc, lastmod });
  }
  return pages;
}

function readSent(raw: string): Sent {
  try {
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Sent) : {};
  } catch { return {}; }
}

/** The pages of each site that are new, or whose lastmod changed, since the last send. */
export function pagesToSend(sites: Site[], sent: Sent): { host: string; urls: string[] }[] {
  return sites
    .map((s) => ({
      host: s.host,
      urls: s.pages.filter((p) => new URL(p.loc).host === s.host && sent[s.host]?.[p.loc] !== p.lastmod).map((p) => p.loc),
    }))
    .filter((s) => s.urls.length > 0);
}

/** Sends what changed (one request per site) and remembers what went through. */
export async function submitChanged(deps: IndexNowDeps, sites: Site[], key = INDEXNOW_KEY): Promise<{ sent: number; failed: number }> {
  const sent = readSent(await deps.getSetting(INDEXNOW_SETTING).catch(() => ""));
  const todo = pagesToSend(sites, sent);
  let ok = 0, failed = 0;
  for (const site of todo) {
    const body = { host: site.host, key, keyLocation: `https://${site.host}/${key}.txt`, urlList: site.urls.slice(0, 10_000) };
    let status = 0;
    try { status = await deps.post(ENDPOINT, body); } catch { status = 0; }
    if (status === 200 || status === 202) {
      ok += site.urls.length;
      const pages = sites.find((s) => s.host === site.host)?.pages ?? [];
      sent[site.host] = { ...(sent[site.host] ?? {}), ...Object.fromEntries(pages.filter((p) => site.urls.includes(p.loc)).map((p) => [p.loc, p.lastmod])) };
      deps.log(`[indexnow] ${site.host}: sent ${site.urls.length} page(s)`);
    } else {
      failed += site.urls.length;
      deps.log(`[indexnow] ${site.host}: not accepted (HTTP ${status || "no answer"}); will try again on the next start`);
    }
  }
  if (ok > 0) await deps.upsertSetting(INDEXNOW_SETTING, JSON.stringify(sent)).catch(() => {});
  return { sent: ok, failed };
}

/** The real thing: Node's fetch, with a time limit. */
export async function postJson(url: string, body: unknown): Promise<number> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  return res.status;
}
