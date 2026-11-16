// Reads a web page's words for the Exemplar Makers ("paste a link to the lesson"). Same protections as the Browser's
// page check (server/browserCheck.ts): http(s) on the normal ports only, no logins in the address, and every address
// is checked at the moment of connecting, including after redirects, so a link can't be pointed at this server or
// anything on a private network. Only the first 600 KB is read and nothing is kept: the words go to the AI and no further.
import http from "node:http";
import https from "node:https";
import { allowedUrl, safeLookup } from "./browserCheck";
import { htmlToText } from "../shared/hubInbox";

export type PageText = { url: string; title: string; text: string };
/** A problem reading a page, with words a teacher can act on. */
export class PageError extends Error {}

const MAX_BYTES = 600_000;
const MAX_REDIRECTS = 5;
const UA = "Mozilla/5.0 (compatible; AriseToDuo/1.0; +lesson reader)";
const INSTEAD = "Paste the lesson text, or add photos of it, instead.";

type Got = { status: number; type: string; location: string; body: string };

function get(url: URL): Promise<Got> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(url, { method: "GET", lookup: safeLookup, timeout: 10_000, headers: { "User-Agent": UA, Accept: "text/html,text/plain;q=0.9,*/*;q=0.5" } }, (res) => {
      const chunks: Buffer[] = []; let size = 0, ended = false;
      const done = () => { if (ended) return; ended = true; resolve({ status: res.statusCode || 0, type: String(res.headers["content-type"] || ""), location: String(res.headers.location || ""), body: Buffer.concat(chunks).toString("utf8") }); };
      if ((res.statusCode || 0) >= 300 && (res.statusCode || 0) < 400) { res.destroy(); return done(); }
      res.on("data", (c: Buffer) => { chunks.push(c); size += c.length; if (size >= MAX_BYTES) { res.destroy(); done(); } });
      res.on("end", done);
      res.on("error", done);
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

/** The words on a web page, or a PageError that says why not. */
export async function fetchPageText(raw: string): Promise<PageText> {
  let url = allowedUrl(String(raw || "").trim());
  if (!url) throw new PageError(`That link can't be opened from here. ${INSTEAD}`);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let page: Got;
    try { page = await get(url); } catch (e: any) {
      throw new PageError(e?.code === "EBLOCKED" ? `That link can't be opened from here. ${INSTEAD}` : `I couldn't open ${url.hostname}. Check the link, or ${INSTEAD.charAt(0).toLowerCase()}${INSTEAD.slice(1)}`);
    }
    if (page.status >= 300 && page.status < 400 && page.location) {
      const next = allowedUrl(new URL(page.location, url).toString());
      if (!next) throw new PageError(`That link sends me somewhere I can't open. ${INSTEAD}`);
      url = next; continue;
    }
    if (page.status === 401 || page.status === 403) throw new PageError(`${url.hostname} needs a sign-in to show that page. ${INSTEAD}`);
    if (page.status >= 400) throw new PageError(`${url.hostname} answered "${page.status}" for that link. Check the link, or ${INSTEAD.charAt(0).toLowerCase()}${INSTEAD.slice(1)}`);
    if (!/text\/(html|plain)|application\/xhtml/i.test(page.type) && page.type) throw new PageError(`That link isn't a web page (it may be a PDF or a file). ${INSTEAD}`);
    const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(page.body)?.[1] || "").replace(/\s+/g, " ").trim().slice(0, 160);
    const text = (/html|xml/i.test(page.type) || /<html|<body|<p[ >]/i.test(page.body.slice(0, 2000)) ? htmlToText(page.body) : page.body).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (text.length < 200) throw new PageError(`That page has no readable text for me (it may load its words with JavaScript, or need a sign-in). ${INSTEAD}`);
    return { url: url.toString(), title, text };
  }
  throw new PageError(`That link keeps redirecting. ${INSTEAD}`);
}

/** Web addresses from a box the teacher typed in: split on spaces, commas and new lines; up to `max`, no repeats. Anything that isn't an address is dropped. */
export function linksFrom(raw: unknown, max = 3): string[] {
  const parts = (Array.isArray(raw) ? raw : String(raw ?? "").split(/[\s,]+/)).map((x) => String(x).trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) { const u = /^https?:\/\//i.test(p) ? p : /^[\w-]+(\.[\w-]+)+(\/|$)/.test(p) ? `https://${p}` : ""; if (u && allowedUrl(u) && !out.includes(u)) out.push(u.slice(0, 500)); }
  return out.slice(0, max);
}

/** The pages' words as one block for the AI, each marked with where it came from. */
export function pagesText(pages: PageText[], limit: number): string {
  return pages.map((p) => `Lesson page${p.title ? `: ${p.title}` : ""} (${new URL(p.url).hostname})\n${p.text}`).join("\n\n").slice(0, limit);
}
