// Teacher Hub: reminders from the Apple Reminders app, one way into the Hub.
//
// An iPhone Shortcut sends the teacher's reminders to a private link (no sign-in, so the link is the key).
// They wait in an inbox until the Hub is open, which turns them into to-dos through its normal save, so
// nothing here ever writes over the teacher's workspace.
import crypto from "node:crypto";
import type { Express, RequestHandler } from "express";
import { clientAddress, createAttemptLimiter } from "./attemptLimiter";
import { APPLE_LIMITS, cleanReminders, type AppleReminder } from "../shared/appleReminders";

export type AppleDeps = {
  gate(req: any, res: any): Promise<unknown | null>;
  getSetting(key: string): Promise<string>;
  upsertSetting(key: string, value: string): Promise<void>;
  /** Secret the links are signed with. */
  key(): Buffer;
  /** Reads a plain-text body (express.text). */
  textBody: RequestHandler;
  appUrl: string;
  now?: () => number;
};

const sign = (key: Buffer, userId: number, version: number) => crypto.createHmac("sha256", key).update(`apple-reminders:${userId}:${version}`).digest("base64url").slice(0, 32);
export const appleToken = (key: Buffer, userId: number, version: number) => `${userId}.${version}.${sign(key, userId, version)}`;

export function checkAppleToken(key: Buffer, token: string): { userId: number; version: number } | null {
  const m = /^(\d{1,12})\.(\d{1,6})\.([A-Za-z0-9_-]{32})$/.exec(token || "");
  if (!m) return null;
  const expected = Buffer.from(sign(key, +m[1], +m[2])), given = Buffer.from(m[3]);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given) ? { userId: +m[1], version: +m[2] } : null;
}

export function registerAppleReminderRoutes(app: Express, authMiddleware: RequestHandler, deps: AppleDeps) {
  const now = deps.now ?? Date.now;
  const base = deps.appUrl.replace(/\/+$/, "");
  const badLinks = createAttemptLimiter({ max: 30, windowMs: 3600_000, now });
  const sends = createAttemptLimiter({ max: 120, windowMs: 3600_000, now });
  const versionKey = (id: number) => `hub_apple_v_${id}`;
  const inboxKey = (id: number) => `hub_apple_inbox_${id}`;
  const readVersion = async (id: number) => Math.max(1, Number(await deps.getSetting(versionKey(id)).catch(() => "")) || 1);
  const readInbox = async (id: number): Promise<AppleReminder[]> => { try { const v = JSON.parse((await deps.getSetting(inboxKey(id))) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
  const linkFor = (token: string) => `${base}/api/apple-reminders/${token}`;

  app.get("/api/teacher-hub/apple-reminders", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    res.set("Cache-Control", "no-store");
    try {
      const id = Number(req.user.id);
      res.json({ url: linkFor(appleToken(deps.key(), id, await readVersion(id))), waiting: (await readInbox(id)).length });
    } catch (error: any) { console.error("[apple-reminders] status failed", error?.message); res.status(500).json({ message: "Could not load this right now." }); }
  });

  /** A new private link. The old one stops working. */
  app.post("/api/teacher-hub/apple-reminders/reset", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    try {
      const id = Number(req.user.id);
      const version = (await readVersion(id)) + 1;
      await deps.upsertSetting(versionKey(id), String(version));
      res.json({ url: linkFor(appleToken(deps.key(), id, version)) });
    } catch (error: any) { console.error("[apple-reminders] reset failed", error?.message); res.status(500).json({ message: "Could not make a new link right now." }); }
  });

  app.get("/api/teacher-hub/apple-reminders/inbox", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    res.set("Cache-Control", "no-store");
    try { res.json({ items: await readInbox(Number(req.user.id)) }); }
    catch { res.status(500).json({ message: "Could not load this right now." }); }
  });

  /** The Hub took these in; they leave the inbox. */
  app.post("/api/teacher-hub/apple-reminders/ack", authMiddleware, async (req: any, res) => {
    if (!(await deps.gate(req, res))) return;
    try {
      const id = Number(req.user.id);
      const keys = new Set((Array.isArray(req.body?.keys) ? req.body.keys : []).map(String));
      await deps.upsertSetting(inboxKey(id), JSON.stringify((await readInbox(id)).filter((r) => !keys.has(r.key))));
      res.json({ ok: true });
    } catch { res.status(500).json({ message: "Could not save that right now." }); }
  });

  // The Shortcut's link. JSON, or plain text with one reminder per line.
  app.post("/api/apple-reminders/:token", deps.textBody, async (req: any, res) => {
    const who = clientAddress(req);
    if (badLinks.retryAfter(who)) return res.status(429).json({ message: "Too many tries. Please wait and try again." });
    const found = checkAppleToken(deps.key(), String(req.params.token || ""));
    if (!found) { badLinks.fail(who); return res.status(404).json({ message: "That link is not valid. Copy a fresh one from your Teacher Hub." }); }
    if (found.version !== (await readVersion(found.userId))) return res.status(410).json({ message: "That link was replaced. Copy the new one from your Teacher Hub." });
    if (sends.retryAfter(String(found.userId))) return res.status(429).json({ message: "Too many sends this hour. Try again later." });
    const items = cleanReminders(req.body);
    if (!items.length) return res.status(400).json({ message: "No reminders came through. Each one needs a title." });
    try {
      sends.fail(String(found.userId));
      const waiting = await readInbox(found.userId);
      const merged = [...waiting.filter((w) => !items.some((i) => i.key === w.key)), ...items].slice(-APPLE_LIMITS.inbox);
      await deps.upsertSetting(inboxKey(found.userId), JSON.stringify(merged));
      res.json({ ok: true, received: items.length });
    } catch (error: any) { console.error("[apple-reminders] receive failed", error?.message); res.status(500).json({ message: "Could not save those right now. Try again." }); }
  });
}
