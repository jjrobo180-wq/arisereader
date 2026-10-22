// Crash reports from the browser: when a page throws (the "Something went wrong" screen),
// the app sends the error's name, a short message, the page's route and the account's role,
// so it shows up in the server log and can be fixed. No names, usernames or page content.
import type { Express, Request, Response } from "express";
import { createAttemptLimiter } from "./attemptLimiter";

const clip = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, n);

export function registerClientErrorRoutes(app: Express, opts: { now?: () => number; log?: (line: string) => void } = {}): void {
  const limiter = createAttemptLimiter({ max: 30, windowMs: 10 * 60_000, now: opts.now });
  const log = opts.log ?? ((line: string) => console.error(line));
  app.post("/api/client-error", (req: Request, res: Response) => {
    const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
    if (limiter.retryAfter(ip)) return res.status(204).end();
    limiter.fail(ip);
    const b: any = req.body || {};
    const route = clip(b.route, 80).replace(/[?&](code|token)=[^&]*/gi, "");
    log(`[client-error] ${clip(b.host, 40)}${route} role=${clip(b.role, 16) || "guest"} ${clip(b.name, 40)}: ${clip(b.message, 300)} @ ${clip(b.where, 200)}`);
    res.status(204).end();
  });
}
