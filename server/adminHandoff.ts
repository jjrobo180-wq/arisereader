/**
 * Single-use, short-lived sign-in bridge from arisereader.com to arisetodo.com
 * (two independent cookie origins). Teachers, parents, LifeHub-only accounts and
 * administrators who sign in on A.R.I.S.E. Reader are carried into their hub on
 * arisetodo.com without typing their password again. Students never use it.
 * Never place the actual bearer token or password in the redirect URL.
 *
 * The deployed Render service currently has one application instance.
 * Failed/expired transfers simply show the normal sign-in option.
 * (The routes keep their original "admin-handoff" names so links already in
 * people's browsers keep working.)
 */
import { randomBytes } from "node:crypto";
import type { Express, Request, Response, NextFunction } from "express";

type Authentication = (req: any, res: Response, next: NextFunction) => unknown;
type SessionLookup = (token: string) => Promise<{ user?: any } | null | undefined>;
type Ticket = { sessionToken: string; userId: number; expiresAt: number };
const TTL_MS = 60_000;
const MAX_TICKETS = 500;
const readerHosts = new Set(["arisereader.com", "www.arisereader.com"]);
const todoHosts = new Set(["arisetodo.com", "www.arisetodo.com"]);

/** Accounts whose home is a hub on arisetodo.com. */
export function isHubAccount(user: any): boolean {
  return !!user && (user.isAdmin === true || user.role === "teacher" || user.role === "parent" || user.role === "todo");
}

function host(req: Request): string {
  return String(req.headers.host || "").split(":")[0].toLowerCase();
}

function noCache(res: Response): void {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Referrer-Policy", "no-referrer");
}

export function registerAdminHandoffRoutes(
  app: Express,
  requireAuth: Authentication,
  opts: { getSession?: SessionLookup; now?: () => number } = {},
): void {
  const now = opts.now ?? Date.now;
  const getSession: SessionLookup = opts.getSession ?? (async (token) => (await import("./storage")).storage.getSession(token));
  const tickets = new Map<string, Ticket>();
  const sweepExpired = () => {
    const t = now();
    for (const [code, ticket] of tickets) if (ticket.expiresAt <= t) tickets.delete(code);
  };

  // A signed-in Reader account with a hub requests a random one-use code using their existing bearer token.
  app.post("/api/auth/admin-handoff/start", requireAuth, (req: any, res: Response) => {
    noCache(res);
    if (!readerHosts.has(host(req))) return res.status(403).json({ message: "Open A.R.I.S.E. Reader to continue." });
    if (!isHubAccount(req.realUser) || !req.sessionToken) {
      return res.status(403).json({ message: "Only teacher, parent and LifeHub accounts open a hub." });
    }
    sweepExpired();
    if (tickets.size >= MAX_TICKETS) return res.status(429).json({ message: "Please retry in a moment." });

    const code = randomBytes(32).toString("hex");
    tickets.set(code, { sessionToken: String(req.sessionToken), userId: Number(req.realUser.id), expiresAt: now() + TTL_MS });
    res.json({ code, expiresInSeconds: TTL_MS / 1000 });
  });

  // Redeem on the To-Do origin only. Remove the code before any async work;
  // two requests can never redeem one ticket.
  app.post("/api/auth/admin-handoff/consume", async (req: Request, res: Response) => {
    noCache(res);
    if (!todoHosts.has(host(req))) return res.status(403).json({ message: "Open arisetodo.com to continue." });
    const code: unknown = req.body?.code;
    if (typeof code !== "string" || !/^[a-f0-9]{64}$/.test(code)) {
      return res.status(400).json({ message: "Invalid sign-in link." });
    }
    sweepExpired();
    const ticket = tickets.get(code);
    tickets.delete(code);
    if (!ticket || ticket.expiresAt <= now()) {
      return res.status(401).json({ message: "This sign-in link expired. Please sign in again." });
    }
    try {
      const session = await getSession(ticket.sessionToken);
      if (!isHubAccount(session?.user) || Number(session!.user.id) !== ticket.userId) {
        return res.status(401).json({ message: "Your session has changed. Please sign in again." });
      }
      return res.json({ user: session!.user, token: ticket.sessionToken });
    } catch {
      console.error("Unable to verify the sign-in handoff.");
      return res.status(503).json({ message: "Could not complete sign-in. Please try again." });
    }
  });
}
