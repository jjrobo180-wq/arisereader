// Support: the "Contact us" form on the Support pages of Arise To Duo (arisetodo.com/support) and
// Pod+ (podscroll.onrender.com/support), and inside both iPhone apps. App Review asks every app for
// a way to reach the developer (Support URL, Guideline 1.5) and apps with posts from people for
// published contact details (Guideline 1.2). Each message reaches the admin by email and in the bell.
import type { Express } from "express";
import { clientAddress, createAttemptLimiter, waitWords } from "./attemptLimiter";

export type SupportMessage = { app: "Arise To Duo" | "Pod+"; name: string; email: string; topic: string; message: string };
export const SUPPORT_TOPICS = ["Question", "Something isn't working", "Report a post or person", "Delete my account or data", "Privacy", "Other"] as const;

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, max) : "");
const EMAIL = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]{2,}$/;

/** The form's fields made safe, or why it can't be sent. */
export function cleanSupport(body: any, app: SupportMessage["app"]): SupportMessage | string {
  const email = text(body?.email, 254).toLowerCase();
  const message = text(body?.message, 4000);
  if (!EMAIL.test(email)) return "Enter your email so we can write back.";
  if (message.length < 5) return "Tell us a little more.";
  // A field people can't see: filled in only by bots.
  if (text(body?.website, 200)) return "That didn't send. Try again.";
  const topic = (SUPPORT_TOPICS as readonly string[]).includes(body?.topic) ? body.topic : "Other";
  return { app, name: text(body?.name, 80), email, topic, message };
}

export function registerSupportRoutes(app: Express, o: { deliver: (m: SupportMessage) => Promise<boolean> }) {
  const lim = createAttemptLimiter({ max: 6, windowMs: 60 * 60_000 });
  const handler = (which: SupportMessage["app"]) => async (req: any, res: any) => {
    const ip = clientAddress(req);
    const wait = lim.retryAfter(ip);
    if (wait > 0) return res.status(429).json({ message: `That's a lot of messages. Try again in ${waitWords(wait)}.` });
    const m = cleanSupport(req.body, which);
    if (typeof m === "string") return res.status(400).json({ message: m });
    lim.fail(ip);
    try {
      const sent = await o.deliver(m);
      if (!sent) return res.status(503).json({ message: "We couldn't send that just now. Try again in a few minutes." });
      res.json({ ok: true, message: "Thanks. We read every message and write back within 2 business days." });
    } catch {
      res.status(503).json({ message: "We couldn't send that just now. Try again in a few minutes." });
    }
  };
  app.post("/api/support/contact", handler("Arise To Duo"));
  // Under /api/podscroll so the Pod+ site and app can call it (that path has Pod+'s own CORS rules).
  app.post("/api/podscroll/support", handler("Pod+"));
}
