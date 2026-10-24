// Arise To Duo Browser (a LifeHub App Store app). The rules shared by the page and the server.
//
// A website can only show another website inside an <iframe>, and many sites (Google, YouTube,
// Facebook, banks…) tell browsers not to allow that, with an X-Frame-Options header or a
// Content-Security-Policy frame-ancestors rule. The server reads those headers for a page
// (server/browserCheck.ts) and the Browser opens it inside the app only when it is allowed;
// otherwise it offers "Open in Safari". The Arise To Duo iPhone app (coming to the App Store)
// has a real built-in browser without that limit.

export type BrowserMark = { id: string; title: string; url: string };
export const BROWSER_LIMITS = { marks: 300, title: 120, url: 2000 } as const;

/** The places that may show a page inside the app (our own sites). */
export const OUR_ORIGINS = ["https://arisetodo.com", "https://www.arisetodo.com", "https://arisereader.com", "https://www.arisereader.com"];

export const SEARCH_URL = (q: string) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;

/** What was typed in the address bar: a web address to open, or words to search for. */
export function addressFor(input: string): { kind: "url"; url: string } | { kind: "search"; query: string; url: string } | null {
  const t = input.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) {
    try { const u = new URL(t); return { kind: "url", url: u.toString() }; } catch { /* fall through to search */ }
  }
  // Looks like a domain: "nytimes.com", "en.wikipedia.org/wiki/Fold", "localhost" is not offered.
  if (!/\s/.test(t) && /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/i.test(t)) {
    try { const u = new URL(`https://${t}`); return { kind: "url", url: u.toString() }; } catch { /* search */ }
  }
  return { kind: "search", query: t, url: SEARCH_URL(t) };
}

/** Whether a page's response headers allow our app to show it inside a frame. */
export function frameAllowed(headers: { xFrameOptions?: string | null; csp?: string | null }, ourOrigins: readonly string[] = OUR_ORIGINS): boolean {
  const xfo = (headers.xFrameOptions || "").trim().toLowerCase();
  if (xfo && (xfo.includes("deny") || xfo.includes("sameorigin") || xfo.startsWith("allow-from"))) {
    // A frame-ancestors rule overrides X-Frame-Options in today's browsers, so look at it first.
    if (!/frame-ancestors/i.test(headers.csp || "")) return false;
  }
  const csp = headers.csp || "";
  const m = /(?:^|;)\s*frame-ancestors\s+([^;]*)/i.exec(csp);
  if (!m) return true;
  const sources = m[1].trim().split(/\s+/).filter(Boolean).map((s) => s.toLowerCase());
  if (sources.includes("'none'")) return false;
  return sources.some((s) => s === "*" || s === "https:" || ourOrigins.some((o) => matchesSource(s, o)));
}

function matchesSource(source: string, origin: string): boolean {
  const src = source.replace(/\/$/, "");
  if (src === origin) return true;
  // "https://*.arisetodo.com" or "*.arisetodo.com"
  const host = new URL(origin).host;
  const wild = /^(?:https:\/\/)?\*\.(.+)$/.exec(src);
  if (wild) return host.endsWith(`.${wild[1]}`);
  // A bare host such as "arisetodo.com"
  return !src.includes("://") && src === host;
}

/** Addresses the server must never be asked to look at: this machine, the local network, etc. */
export function isPrivateAddress(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
  const four = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(v);
  if (four) {
    const [a, b] = [Number(four[1]), Number(four[2])];
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  if (v.includes(":")) {
    return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9")
      || v.startsWith("fea") || v.startsWith("feb") || v.startsWith("ff") || v.startsWith("64:ff9b") || v.startsWith("2001:db8");
  }
  return true; // not an address we understand: refuse
}

/** The <title> of a page, from the first part of its HTML. */
export function pageTitle(html: string): string {
  const m = /<title[^>]*>([^<]{1,300})<\/title>/i.exec(html);
  if (!m) return "";
  return m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, " ").trim().slice(0, BROWSER_LIMITS.title);
}

export const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };
