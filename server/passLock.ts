// Passcode lock (shared/passLock.ts): the one thing the server does is let someone who forgot their
// hub passcode turn the lock off by typing their account password. The passcode itself never
// reaches the server; this only says whether the password is right.
import type { Express, RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";

const misses = createAttemptLimiter({ max: 8, windowMs: 15 * 60_000 });

export function registerPassLockRoutes(app: Express, auth: RequestHandler, deps: { passwordHash: (userId: number) => Promise<string | null | undefined> }) {
  app.post("/api/pass-lock/check-password", auth, async (req: any, res) => {
    if (req.adminPreview) return res.status(403).json({ message: "Not in preview." });
    const id = Number(req.user?.id);
    const key = String(id);
    const wait = misses.retryAfter(key);
    if (wait > 0) { res.set("Retry-After", String(Math.ceil(wait / 1000))); return res.status(429).json({ message: `Too many tries. Try again in ${waitWords(wait)}.` }); }
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!password || password.length > 200) return res.status(400).json({ message: "Type your account password." });
    const hash = await deps.passwordHash(id);
    if (!hash || !(await bcrypt.compare(password, hash))) { misses.fail(key); return res.status(401).json({ message: "That isn't your account password." }); }
    misses.reset(key);
    res.json({ ok: true });
  });
}
