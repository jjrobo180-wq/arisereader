// Arise To Duo Browser: before a page opens inside the app, look at whether that site allows being
// shown inside another site (shared/browserApp.ts), and read its title for bookmarks and tasks.
//
// Safety: signed-in people only, rate limited, http(s) on the normal ports only, and every address
// is checked at the moment of connecting (including after redirects), so it can't be pointed at
// this server or anything on a private network. Only the headers and the first 64 KB are read,
// nothing is stored or logged except failures' kinds.
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import type { LookupFunction } from "node:net";
import type { Express, RequestHandler } from "express";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { BROWSER_LIMITS, frameAllowed, isPrivateAddress, pageTitle } from "../shared/browserApp";

const limits = createAttemptLimiter({ max: 240, windowMs: 10 * 60_000 });
const MAX_BYTES = 64 * 1024;
const MAX_REDIRECTS = 5;
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 AriseToDuo/1.0";

/** dns.lookup that refuses private addresses, used for the actual connection. */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...(options as object), all: true }, (err, addresses) => {
    if (err) return (callback as any)(err);
    const list = (addresses as unknown as dns.LookupAddress[]) || [];
    const bad = !list.length || list.some((a) => isPrivateAddress(a.address));
    if (bad) return (callback as any)(Object.assign(new Error("blocked address"), { code: "EBLOCKED" }));
    if ((options as any)?.all) return (callback as any)(null, list);
    (callback as any)(null, list[0].address, list[0].family);
  });
};

type Peek = { status: number; headers: http.IncomingHttpHeaders; body: string; url: string };

function peek(url: URL): Promise<Peek> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(url, { method: "GET", lookup: safeLookup, timeout: 8000, headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.8" } }, (res) => {
      const chunks: Buffer[] = []; let size = 0;
      const done = () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8"), url: url.toString() });
      if ((res.statusCode || 0) >= 300 && (res.statusCode || 0) < 400) { res.destroy(); return done(); }
      res.on("data", (c: Buffer) => { chunks.push(c); size += c.length; if (size >= MAX_BYTES) { res.destroy(); done(); } });
      res.on("end", done);
      res.on("error", () => done());
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

function allowedUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.port && u.port !== "80" && u.port !== "443") return null;
    if (u.username || u.password) return null;
    if (isPrivateAddress(u.hostname) && /^[\d.:[\]a-f]+$/i.test(u.hostname)) return null; // a raw private IP
    if (/^(localhost|.*\.local|.*\.internal)$/i.test(u.hostname)) return null;
    return u;
  } catch { return null; }
}

export async function checkPage(raw: string): Promise<{ url: string; frameable: boolean; title: string; reason?: string }> {
  let u = allowedUrl(raw);
  if (!u) return { url: raw, frameable: false, title: "", reason: "address" };
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let page: Peek;
    try { page = await peek(u); } catch (e: any) {
      return { url: u.toString(), frameable: false, title: "", reason: e?.code === "EBLOCKED" ? "address" : "unreachable" };
    }
    const loc = page.headers.location;
    if (page.status >= 300 && page.status < 400 && typeof loc === "string") {
      const next = allowedUrl(new URL(loc, u).toString());
      if (!next) return { url: u.toString(), frameable: false, title: "", reason: "address" };
      u = next; continue;
    }
    const insecure = u.protocol === "http:"; // an https page can't show an http one inside it
    const csp = ([] as string[]).concat(page.headers["content-security-policy"] || []).join(";");
    const xfo = ([] as string[]).concat(page.headers["x-frame-options"] || []).join(",");
    const frameable = !insecure && frameAllowed({ xFrameOptions: xfo, csp });
    return { url: u.toString(), frameable, title: pageTitle(page.body), ...(insecure ? { reason: "insecure" } : frameable ? {} : { reason: "blocked" }) };
  }
  return { url: u.toString(), frameable: false, title: "", reason: "redirects" };
}

export function registerBrowserRoutes(app: Express, authMiddleware: RequestHandler) {
  app.get("/api/arise-todo/browser/check", authMiddleware, async (req: any, res) => {
    const url = typeof req.query?.url === "string" ? req.query.url.trim().slice(0, BROWSER_LIMITS.url) : "";
    if (!url) return res.status(400).json({ message: "No web address." });
    const who = `u${req.user?.id}`;
    const wait = limits.retryAfter(who);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); return res.status(429).json({ message: `Too many pages. Try again in ${waitWords(wait)}.` }); }
    limits.fail(who);
    try {
      res.set("Cache-Control", "no-store");
      res.json(await checkPage(url));
    } catch (e: any) {
      console.error("[browser-check] failed:", e?.code || e?.message || "error");
      res.json({ url, frameable: false, title: "", reason: "unreachable" });
    }
  });
}
