// Help tickets: someone who can't get into their account can message the admin from the sign-in
// screen. Nothing here looks up or changes an account, so a ticket can't reveal whether a student
// exists and can't be used to get in. Tickets are only readable by admins.
//
// Anyone can reach the form, so it is limited by network and overall, and nothing is ever emailed to
// the address someone types: that address can't be used to send mail to a stranger.
import type { Express, RequestHandler } from "express";
import { clientAddress, createAttemptLimiter, waitWords } from "./attemptLimiter";
import { helpTicketSentMessage, readHelpTicket, type HelpTicketFields } from "../shared/helpTicket";

export type HelpTicketRow = HelpTicketFields & { id: number; createdAt: string; doneAt: string | null };

export type HelpTicketDeps = {
  auth: RequestHandler;
  admin: RequestHandler;
  /** An open ticket with the same name, school and message, if there is one. */
  findOpenDuplicate(ticket: HelpTicketFields): Promise<boolean>;
  save(ticket: HelpTicketFields): Promise<void>;
  /** Tells the admin. Must not throw. */
  alert(ticket: HelpTicketFields): void;
  list(): Promise<HelpTicketRow[]>;
  markDone(id: number, byUserId: number): Promise<boolean>;
  now?: () => number;
};

export function registerHelpTicketRoutes(app: Express, d: HelpTicketDeps) {
  // A whole school can share one network, so this leaves room for a class having trouble at once.
  const byNetwork = createAttemptLimiter({ max: 30, windowMs: 60 * 60_000, now: d.now });
  const overall = createAttemptLimiter({ max: 300, windowMs: 24 * 60 * 60_000, now: d.now });

  app.post("/api/auth/help-ticket", async (req: any, res) => {
    const key = clientAddress(req);
    const wait = Math.max(byNetwork.retryAfter(key), overall.retryAfter("all"));
    if (wait > 0) return res.status(429).json({ message: `Too many messages right now. Wait ${waitWords(wait)}, or ask a teacher to help you.` });

    const read = readHelpTicket(req.body);
    // A field people can't see: only automated spam fills it in. It looks like it worked, and nothing is kept.
    if (typeof req.body?.website === "string" && req.body.website.trim()) {
      byNetwork.fail(key);
      return res.json({ ok: true, message: "Your message was sent." });
    }
    if ("message" in read) return res.status(400).json({ message: read.message });

    byNetwork.fail(key);
    overall.fail("all");
    try {
      if (!(await d.findOpenDuplicate(read.ticket))) {
        await d.save(read.ticket);
        d.alert(read.ticket);
      }
      res.json({ ok: true, message: helpTicketSentMessage(read.ticket) });
    } catch (e: any) {
      console.error("Help ticket error:", e?.message || e);
      res.status(500).json({ message: "Your message didn't send. Try again, or ask a teacher to help you." });
    }
  });

  app.get("/api/admin/help-tickets", d.auth, d.admin, async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try { res.json({ tickets: await d.list() }); }
    catch (e: any) {
      console.error("Help tickets error:", e?.message || e);
      res.status(500).json({ message: "Help tickets couldn't be loaded." });
    }
  });

  app.post("/api/admin/help-tickets/:id/done", d.auth, d.admin, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(404).json({ message: "That ticket is gone." });
    try {
      if (!(await d.markDone(id, Number(req.user?.id)))) return res.status(404).json({ message: "That ticket is gone." });
      res.json({ ok: true });
    } catch (e: any) {
      console.error("Help ticket update error:", e?.message || e);
      res.status(500).json({ message: "That didn't work. Try again." });
    }
  });
}
