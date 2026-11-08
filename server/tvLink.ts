/**
 * Signing in an Apple TV (Arise Duo for Apple TV, native/duo-tv) without typing a password with a remote:
 *   1. The TV asks for a code: POST /api/tv-link/start            -> { code: "K7QX2M", poll, expiresInSeconds }
 *   2. On a phone or computer, already signed in, the person opens arisetodo.com/tv and types the code:
 *      POST /api/tv-link/approve { code }  (signed in)            -> { ok, device }
 *   3. The TV has been asking all along: POST /api/tv-link/poll { poll } -> { status: "waiting" | "done", token, name }
 * The TV gets a session of its own (signing out elsewhere doesn't sign it out, and it can be signed out
 * by itself); the code is good for 10 minutes and once. The poll secret never leaves the TV, so a code
 * seen on screen can't be used to collect the session. Codes are kept in memory (one app instance).
 *
 * Also the TV's view of the family: GET /api/arise-todo/tv?day=YYYY-MM-DD (signed in), a small summary of
 * the hub (today's and upcoming tasks, the week's events, today's chores) so the TV never downloads the
 * whole workspace.
 */
import { randomBytes, randomInt } from "node:crypto";
import type { Express, Response } from "express";
import { choreDoneOn, choreDueOn, choreOwner, cleanFamily, eventsOn, type Family } from "../shared/familyHub";

type Auth = (req: any, res: Response, next: any) => unknown;
type Pending = { code: string; poll: string; app: string; expiresAt: number; userId?: number; token?: string; name?: string };
const TTL = 10 * 60_000;
const MOST = 500;
const LETTERS = "BCDFGHJKLMNPQRSTVWXZ23456789";

export function registerTvLinkRoutes(app: Express, auth: Auth, deps: {
  createSession: (userId: number) => Promise<{ token: string }>;
  readWorkspace: (userId: number) => Promise<{ workspace: any } | null>;
  now?: () => number;
}): void {
  const now = deps.now ?? Date.now;
  const byCode = new Map<string, Pending>();
  const byPoll = new Map<string, Pending>();
  const sweep = () => { const t = now(); for (const p of byCode.values()) if (p.expiresAt <= t) { byCode.delete(p.code); byPoll.delete(p.poll); } };
  const noCache = (res: Response) => { res.setHeader("Cache-Control", "no-store, private"); res.setHeader("Referrer-Policy", "no-referrer"); };

  app.post("/api/tv-link/start", (req: any, res) => {
    noCache(res);
    sweep();
    if (byCode.size >= MOST) return res.status(429).json({ message: "Please try again in a minute." });
    let code = "";
    do { code = Array.from({ length: 6 }, () => LETTERS[randomInt(LETTERS.length)]).join(""); } while (byCode.has(code));
    const p: Pending = { code, poll: randomBytes(24).toString("hex"), app: String(req.body?.app || "duo").slice(0, 20), expiresAt: now() + TTL };
    byCode.set(code, p); byPoll.set(p.poll, p);
    res.json({ code, poll: p.poll, expiresInSeconds: TTL / 1000 });
  });

  app.post("/api/tv-link/approve", auth, async (req: any, res) => {
    noCache(res);
    sweep();
    const code = String(req.body?.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const p = byCode.get(code);
    if (!p) return res.status(404).json({ message: "That code isn't right or has run out. Check the TV for the code showing now." });
    if (p.userId) return res.status(409).json({ message: "That TV is already signed in." });
    const user = req.realUser || req.user;
    try {
      const session = await deps.createSession(Number(user.id));
      p.userId = Number(user.id); p.token = session.token; p.name = String(user.displayName || user.username || "");
      byCode.delete(code);
      res.json({ ok: true, device: "Apple TV" });
    } catch {
      res.status(503).json({ message: "Couldn't sign the TV in just now. Please try again." });
    }
  });

  app.post("/api/tv-link/poll", (req, res) => {
    noCache(res);
    const p = byPoll.get(String(req.body?.poll || ""));
    if (!p || p.expiresAt <= now()) return res.status(410).json({ status: "expired" });
    if (!p.token) return res.json({ status: "waiting" });
    byPoll.delete(p.poll);
    res.json({ status: "done", token: p.token, name: p.name });
  });

  app.get("/api/arise-todo/tv", auth, async (req: any, res) => {
    noCache(res);
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query?.day)) ? String(req.query.day) : new Date().toISOString().slice(0, 10);
    try {
      const row = await deps.readWorkspace(Number(req.user.id));
      res.json(tvSummary(row?.workspace, day, String(req.user.displayName || "")));
    } catch {
      res.status(503).json({ message: "Your family hub isn't reachable right now." });
    }
  });
}

const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** What the TV shows. Pure, so it's tested. */
export function tvSummary(workspace: any, day: string, name = "") {
  const ws = workspace && typeof workspace === "object" ? workspace : {};
  const family: Family = cleanFamily(ws.family ?? {});
  const member = new Map(family.members.map((m) => [m.id, m]));
  const listName = new Map((Array.isArray(ws.lists) ? ws.lists : []).map((l: any) => [String(l?.id), String(l?.name || "")]));
  const week = addDays(day, 7);
  const tasks = (Array.isArray(ws.tasks) ? ws.tasks : []).filter((t: any) => t && !t.archived && !t.done && typeof t.title === "string")
    .filter((t: any) => !t.due || t.due <= week)
    .sort((a: any, b: any) => (a.due || "9999").localeCompare(b.due || "9999") || String(a.time || "99").localeCompare(String(b.time || "99")))
    .slice(0, 40)
    .map((t: any) => ({ id: String(t.id), title: t.title.slice(0, 120), due: String(t.due || ""), time: String(t.time || ""), list: listName.get(String(t.listId)) || "",
      who: member.get(String(t.assignee))?.name || "" }));
  const events = Array.from({ length: 7 }, (_, i) => addDays(day, i)).flatMap((d) => eventsOn(family, d).map((e) => ({
    date: d, title: e.title.slice(0, 120), time: e.time || "", endTime: e.endTime || "", location: (e.location || "").slice(0, 80),
    who: e.memberIds.map((id) => member.get(id)?.name).filter(Boolean),
  }))).slice(0, 60);
  const chores = family.chores.filter((c) => choreDueOn(c, day)).map((c) => {
    const who = member.get(choreOwner(c, day));
    return { id: c.id, title: c.title.slice(0, 80), who: who?.name || "", emoji: who?.emoji || "", color: who?.color || "", points: c.points, done: !!choreDoneOn(family, c.id, day) };
  });
  return { name, day, members: family.members.map((m) => ({ id: m.id, name: m.name, emoji: m.emoji, color: m.color })), tasks, events, chores };
}
