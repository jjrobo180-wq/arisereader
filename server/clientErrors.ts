// Crash reports from the browser: when a page throws (the "Something went wrong" screen),
// the app sends the error's name, a short message, the page's route and the account's role,
// so it shows up in the server log and can be fixed. No names, usernames or page content.
import type { Express, Request, Response } from "express";
import { createAttemptLimiter } from "./attemptLimiter";

const clip = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, n);

export type ClientError = { at: string; host: string; route: string; role: string; name: string; message: string; where: string };

/** Keeps the newest reports (most recent first) and saves them at most every `everyMs`, so a burst of crashes
 *  is one write. The admin reads them back (settings key client_error_log) to see what broke and where. */
export function crashKeeper(save: (list: ClientError[]) => Promise<void>, opts: { keep?: number; everyMs?: number; load?: () => Promise<ClientError[]> } = {}) {
  const keep = opts.keep ?? 300, everyMs = opts.everyMs ?? 15_000;
  let list: ClientError[] = [], timer: ReturnType<typeof setTimeout> | null = null, loaded = !opts.load;
  const ready = opts.load ? opts.load().then((l) => { list = [...list, ...(Array.isArray(l) ? l : [])].slice(0, keep); loaded = true; }).catch(() => { loaded = true; }) : Promise.resolve();
  const flush = async () => { timer = null; await ready; try { await save(list.slice(0, keep)); } catch { /* next time */ } };
  return {
    add(e: ClientError) { list = [e, ...list].slice(0, keep); if (!timer) timer = setTimeout(() => { void flush(); }, everyMs); },
    list: () => list.slice(), flush, isLoaded: () => loaded,
  };
}

export function registerClientErrorRoutes(app: Express, opts: { now?: () => number; log?: (line: string) => void; keep?: (e: ClientError) => void } = {}): void {
  const limiter = createAttemptLimiter({ max: 30, windowMs: 10 * 60_000, now: opts.now });
  const log = opts.log ?? ((line: string) => console.error(line));
  app.post("/api/client-error", (req: Request, res: Response) => {
    const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
    if (limiter.retryAfter(ip)) return res.status(204).end();
    limiter.fail(ip);
    const b: any = req.body || {};
    const route = clip(b.route, 80).replace(/[?&](code|token)=[^&]*/gi, "");
    log(`[client-error] ${clip(b.host, 40)}${route} role=${clip(b.role, 16) || "guest"} ${clip(b.name, 40)}: ${clip(b.message, 300)} @ ${clip(b.where, 200)}`);
    opts.keep?.({ at: new Date(opts.now ? opts.now() : Date.now()).toISOString(), host: clip(b.host, 40), route, role: clip(b.role, 16) || "guest", name: clip(b.name, 40), message: clip(b.message, 300), where: clip(b.where, 200) });
    res.status(204).end();
  });
}
