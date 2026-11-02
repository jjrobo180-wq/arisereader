// Pod+ downloads: a member's copy of a podcast episode, relayed from the podcast's own host for the
// many hosts that don't let a web page save their audio directly (no CORS). Members only, through
// the same 12-hour signed pass as Voice boost (GET /books/relay-pass, which needs membership).
//
// Safety: http(s) on the normal ports only; every address is checked at the moment of connecting,
// including after each redirect, so it can't be pointed at this server or a private network; only
// audio is passed on (by content type), at most 1 GB; rate limited by address. Nothing is stored.
import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import type { LookupFunction } from "node:net";
import type { Express } from "express";
import { createAttemptLimiter } from "./attemptLimiter";
import { isPrivateAddress } from "../shared/browserApp";

const MAX_BYTES = 1024 * 1024 * 1024;
const MAX_REDIRECTS = 6;
const UA = "Mozilla/5.0 (compatible; PodPlus/1.0; +https://podscroll.app)";

const safeLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...(options as object), all: true }, (err, addresses) => {
    if (err) return (callback as any)(err);
    const list = (addresses as unknown as dns.LookupAddress[]) || [];
    if (!list.length || list.some((a) => isPrivateAddress(a.address))) return (callback as any)(Object.assign(new Error("blocked address"), { code: "EBLOCKED" }));
    if ((options as any)?.all) return (callback as any)(null, list);
    (callback as any)(null, list[0].address, list[0].family);
  });
};

/** An address the relay may fetch: http(s), normal ports, no login in it, not a private or local name. */
export function downloadUrlAllowed(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.port && u.port !== "80" && u.port !== "443") return null;
    if (u.username || u.password) return null;
    const host = u.hostname.replace(/^\[|\]$/g, "");
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
    if (isIp && isPrivateAddress(host)) return null;
    if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) return null;
    return u;
  } catch { return null; }
}

/** Audio, or the generic types podcast hosts often send for it (some send none). Not playlists. */
export const isAudioType = (t: string) => {
  const v = t.trim().toLowerCase();
  return !/mpegurl/.test(v) && (v === "" || /^(audio\/|video\/mp4|application\/octet-stream|binary\/octet-stream)/.test(v));
};

function open(url: URL, range: string, hops = 0): Promise<{ res: http.IncomingMessage; req: http.ClientRequest }> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(url, { method: "GET", lookup: safeLookup, timeout: 20_000, headers: { "User-Agent": UA, Accept: "audio/*,*/*;q=0.5", ...(range ? { Range: range } : {}) } }, (res) => {
      const code = res.statusCode || 0;
      if (code >= 300 && code < 400 && res.headers.location) {
        res.resume();
        if (hops >= MAX_REDIRECTS) return reject(Object.assign(new Error("too many redirects"), { status: 508 }));
        let next: URL | null = null;
        try { next = downloadUrlAllowed(new URL(res.headers.location, url).toString()); } catch { next = null; }
        if (!next) return reject(Object.assign(new Error("redirect not allowed"), { status: 400 }));
        return resolve(open(next, range, hops + 1));
      }
      resolve({ res, req });
    });
    req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { status: 504 })));
    req.on("error", reject);
    req.end();
  });
}

export function registerPodDownloadRoute(app: Express, opts: { prefix: string; passOk: (pass: string) => boolean; clientIp: (req: any) => string }) {
  const perIp = createAttemptLimiter({ max: 400, windowMs: 60 * 60_000 });
  app.get(`${opts.prefix}/download`, async (req: any, res) => {
    if (!opts.passOk(String(req.query.k || ""))) return res.status(403).json({ message: "Downloads are part of Pod+ Membership. Sign in again." });
    const url = downloadUrlAllowed(String(req.query.u || ""));
    if (!url) return res.status(400).json({ message: "That episode can't be downloaded." });
    const ip = opts.clientIp(req);
    if (perIp.retryAfter(ip) > 0) return res.status(429).json({ message: "Too many downloads at once. Try again later." });
    perIp.fail(ip);
    let upstream: { res: http.IncomingMessage; req: http.ClientRequest } | null = null;
    try {
      upstream = await open(url, String(req.headers.range || ""));
      const r = upstream.res;
      const code = r.statusCode || 0;
      const type = String(r.headers["content-type"] || "");
      const size = Number(r.headers["content-length"] || 0);
      if (code !== 200 && code !== 206) { r.resume(); return res.status(code === 416 ? 416 : 502).json({ message: "The podcast's host didn't send the episode." }); }
      if (!isAudioType(type)) { r.resume(); return res.status(415).json({ message: "That link isn't an audio file." }); }
      if (size > MAX_BYTES) { r.resume(); return res.status(413).json({ message: "That episode is too large to download." }); }
      res.status(code);
      for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) { const v = r.headers[h]; if (v) res.setHeader(h, String(v)); }
      res.setHeader("Cache-Control", "private, no-store");
      let sent = 0;
      r.on("data", (c: Buffer) => { sent += c.length; if (sent > MAX_BYTES) { r.destroy(); res.end(); } });
      req.on("close", () => upstream?.req.destroy());
      r.on("error", () => res.end());
      r.pipe(res);
    } catch (e: any) {
      upstream?.req.destroy();
      if (!res.headersSent) res.status(e?.status || 502).json({ message: e?.code === "EBLOCKED" ? "That episode can't be downloaded." : "The podcast's host didn't answer. Try again later." });
      else res.end();
    }
  });
}
