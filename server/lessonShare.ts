// The no-login lesson plan link (shared/lessonShare.ts): a teacher turns it on, copies the link and gives it to
// their school. Anyone with the link sees the plans, read only, and opens the files (short-lived signed links).
// Nothing about students goes out. Turning it off, or making a new link, stops the old one at once.
import type { Express, RequestHandler } from "express";
import { randomBytes } from "node:crypto";
import { sharePlans, sharedFilePath } from "@shared/lessonShare";
import { clientAddress, createAttemptLimiter, waitWords } from "./attemptLimiter";

type Deps = {
  getSetting: (k: string) => Promise<string>;
  upsertSetting: (k: string, v: string) => Promise<void>;
  workHub: (userId: number) => Promise<unknown | null>;
  nameOf: (userId: number) => Promise<string>;
  /** A short-lived link to a stored file (the Drive bucket). */
  fileUrl: (path: string, name: string) => Promise<string | null>;
  now?: () => Date;
};
type Link = { userId: number; on: boolean; createdAt: string };

const tokenKey = (t: string) => `lesson_share:${t}`;
const userKey = (id: number) => `lesson_share_user:${id}`;
const okToken = (t: string) => /^[A-Za-z0-9_-]{20,40}$/.test(t);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const add = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return ymd(x); };

export function registerLessonShareRoutes(app: Express, auth: RequestHandler, deps: Deps) {
  const now = deps.now ?? (() => new Date());
  const bad = createAttemptLimiter({ max: 40, windowMs: 60 * 60_000 });
  const reads = createAttemptLimiter({ max: 600, windowMs: 10 * 60_000 });
  const readLink = async (t: string): Promise<Link | null> => {
    if (!okToken(t)) return null;
    try { const l = JSON.parse((await deps.getSetting(tokenKey(t))) || "null"); return l && typeof l.userId === "number" ? l : null; } catch { return null; }
  };
  const mine = async (userId: number) => {
    const t = (await deps.getSetting(userKey(userId)).catch(() => "")) || "";
    const l = t ? await readLink(t) : null;
    return l && l.userId === userId ? { token: t, on: l.on } : null;
  };

  app.get("/api/teacher-hub/lesson-share", auth, async (req: any, res) => {
    try { res.json(await mine(Number(req.user.id)) ?? { token: null, on: false }); } catch { res.status(500).json({ message: "Couldn't load the link. Try again." }); }
  });
  /** Turn the link on or off, or make a new one (the old one stops working). */
  app.post("/api/teacher-hub/lesson-share", auth, async (req: any, res) => {
    try {
      const userId = Number(req.user.id);
      const on = req.body?.on !== false, fresh = req.body?.fresh === true;
      const cur = await mine(userId);
      if (cur && (fresh || !on)) await deps.upsertSetting(tokenKey(cur.token), JSON.stringify({ userId, on: false, createdAt: now().toISOString() }));
      if (!on) return res.json({ token: cur?.token ?? null, on: false });
      const token = cur && !fresh ? cur.token : randomBytes(18).toString("base64url");
      await deps.upsertSetting(tokenKey(token), JSON.stringify({ userId, on: true, createdAt: now().toISOString() }));
      await deps.upsertSetting(userKey(userId), token);
      res.json({ token, on: true });
    } catch { res.status(500).json({ message: "Couldn't change the link. Try again." }); }
  });

  app.get("/api/public/lesson-plans/:token", async (req: any, res) => {
    const address = clientAddress(req);
    const wait = bad.retryAfter(address) || reads.retryAfter(address);
    if (wait) return res.status(429).json({ message: `Too many tries. Try again in ${waitWords(wait)}.` });
    reads.fail(address);
    try {
      const link = await readLink(String(req.params.token || ""));
      if (!link || !link.on) { bad.fail(address); return res.status(404).json({ message: "This lesson plan link isn't on. Ask the teacher for a new one." }); }
      const ws = await deps.workHub(link.userId);
      const today = ymd(now());
      const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from || "")) ? String(req.query.from) : add(today, -60);
      const to = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to || "")) ? String(req.query.to) : add(today, 120);
      res.set("Cache-Control", "no-store");
      res.json(sharePlans(ws, await deps.nameOf(link.userId), from, to));
    } catch { res.status(500).json({ message: "Couldn't load the lesson plans. Try again." }); }
  });

  /** Opens a file on a shared lesson (a premade worksheet, a PowerPoint): only files in the link's plans. */
  app.get("/api/public/lesson-plans/:token/file/:lesson/:material", async (req: any, res) => {
    const address = clientAddress(req);
    const wait = bad.retryAfter(address) || reads.retryAfter(address);
    if (wait) return res.status(429).send("Too many tries.");
    reads.fail(address);
    try {
      const link = await readLink(String(req.params.token || ""));
      if (!link || !link.on) { bad.fail(address); return res.status(404).send("This link isn't on."); }
      const f = sharedFilePath(await deps.workHub(link.userId), link.userId, String(req.params.lesson), String(req.params.material));
      if (!f) return res.status(404).send("That file isn't on these lesson plans.");
      const url = await deps.fileUrl(f.path, f.name);
      if (!url) return res.status(404).send("That file couldn't be opened.");
      res.redirect(302, url);
    } catch { res.status(500).send("That file couldn't be opened."); }
  });
}
