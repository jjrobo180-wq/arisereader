// Linked profiles: the routes behind shared/profileLinks.ts.
//
//   GET    /api/profile-links                       what I share (mine) and what's shared with me (withMe)
//   POST   /api/profile-links                       invite { email, nickname?, grants }
//   PUT    /api/profile-links/:id                   change what I share with them { grants?, nickname? }
//   DELETE /api/profile-links/:id                   stop sharing with them
//   POST   /api/profile-links/from/:owner/:id/accept   accept an invite sent to my email
//   POST   /api/profile-links/from/:owner/:id/leave    decline an invite, or stop seeing what they share
//   GET    /api/profile-links/from/:owner/life/:item   one shared LifeHub page (view only)
//
// Links live in settings: `profile_links_owner_<id>` holds an owner's links, and two small indexes
// (by the invited email's hash, and by the viewer's id once accepted) find the links shared with
// someone. Invites never say whether an email has an account, so this can't be used to look people up.
import type { Express, RequestHandler } from "express";
import { createHash, randomUUID } from "node:crypto";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { LINK_LIMITS, LIFE_SHARES, accessFor, allows, appIdFromKey, appShareId, cleanGrants, cleanLinks, isHealthShareId, normalEmail, type Access, type ProfileLink } from "../shared/profileLinks";
import { parseTarget, sharedView } from "../shared/todoShare";

export type ProfileLinkDeps = {
  getSetting: (key: string) => Promise<string | null | undefined>;
  upsertSetting: (key: string, value: string) => Promise<void>;
  getUser: (id: number) => Promise<{ id: number; displayName?: string; email?: string | null } | null | undefined>;
  /** The owner's saved LifeHub workspace, for shared LifeHub pages. */
  lifeHub: (ownerId: number) => Promise<unknown | null>;
  now?: () => number;
};

const ownerKey = (id: number) => `profile_links_owner_${id}`;
const emailKey = (email: string) => `profile_links_email_${createHash("sha256").update(email).digest("hex").slice(0, 40)}`;
const viewerKey = (id: number) => `profile_links_viewer_${id}`;
const invites = createAttemptLimiter({ max: 15, windowMs: 24 * 3600_000 });

/** One lock per settings key, so two changes at once can't both rewrite the same list from the same old copy. */
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  locks.set(key, next);
  next.finally(() => { if (locks.get(key) === next) locks.delete(key); }).catch(() => {});
  return next;
}

export function registerProfileLinkRoutes(app: Express, authMiddleware: RequestHandler, deps: ProfileLinkDeps) {
  const now = deps.now ?? Date.now;
  const iso = () => new Date(now()).toISOString();
  const readJson = async (key: string): Promise<unknown> => { const raw = await deps.getSetting(key); if (!raw) return null; try { return JSON.parse(raw); } catch { return null; } };
  const ownerLinks = async (ownerId: number) => cleanLinks(await readJson(ownerKey(ownerId)), ownerId);
  const saveOwnerLinks = (ownerId: number, links: ProfileLink[]) => deps.upsertSetting(ownerKey(ownerId), JSON.stringify(links));
  const readIds = async (key: string): Promise<number[]> => { const v = await readJson(key); return Array.isArray(v) ? [...new Set(v.filter((x): x is number => Number.isInteger(x) && x > 0))].slice(0, 200) : []; };
  const editIds = (key: string, fn: (ids: number[]) => number[]) => withLock(key, async () => { await deps.upsertSetting(key, JSON.stringify(fn(await readIds(key)))); });
  const me = (req: any): { id: number; email: string } | null => { const u = req.adminPreview && req.realUser ? req.realUser : req.user; return u?.id ? { id: Number(u.id), email: normalEmail(u.email) } : null; };
  const nameOf = async (id: number) => { const u = await deps.getUser(id).catch(() => null); return String(u?.displayName || "").trim() || "Someone"; };

  /** Every owner who has shared (or invited) this person, and the one link each. */
  async function sharedWith(viewer: { id: number; email: string }): Promise<ProfileLink[]> {
    const owners = new Set([...(await readIds(viewerKey(viewer.id))), ...(viewer.email ? await readIds(emailKey(viewer.email)) : [])]);
    owners.delete(viewer.id);
    const out: ProfileLink[] = [];
    for (const ownerId of owners) {
      const link = (await ownerLinks(ownerId)).find((l) => l.viewerId === viewer.id || (l.status === "pending" && !!viewer.email && l.email === viewer.email));
      if (link) out.push(link);
    }
    return out;
  }

  /** May this signed-in person read (or change) this owner's premium app? Used by /api/app-data. */
  async function canUseApp(req: any, ownerId: number, appKey: string, need: Access): Promise<boolean> {
    const viewer = me(req);
    const appId = appIdFromKey(appKey);
    if (!viewer || !appId || !Number.isInteger(ownerId) || ownerId <= 0 || ownerId === viewer.id) return false;
    return allows(accessFor(await ownerLinks(ownerId), viewer.id, appShareId(appId)), need);
  }

  app.get("/api/profile-links", authMiddleware, async (req: any, res) => {
    const u = me(req);
    if (!u) return res.status(401).json({ message: "Sign in first." });
    try {
      const [mine, theirs] = await Promise.all([ownerLinks(u.id), sharedWith(u)]);
      const mineOut = await Promise.all(mine.map(async (l) => ({ id: l.id, email: l.email, nickname: l.nickname, status: l.status, grants: l.grants, viewerName: l.viewerId ? await nameOf(l.viewerId) : "", createdAt: l.createdAt })));
      const withMe = await Promise.all(theirs.map(async (l) => ({ id: l.id, ownerId: l.ownerId, ownerName: await nameOf(l.ownerId), status: l.status, grants: l.grants })));
      res.set("Cache-Control", "no-store");
      res.json({ mine: mineOut, withMe, myEmail: u.email });
    } catch (error: any) {
      console.error("[profile-links] list:", error?.message);
      res.status(500).json({ message: "Linked profiles couldn't be loaded. Try again." });
    }
  });

  app.post("/api/profile-links", authMiddleware, async (req: any, res) => {
    const u = me(req);
    if (!u) return res.status(401).json({ message: "Sign in first." });
    const email = normalEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: "Type their email address." });
    if (email === u.email) return res.status(400).json({ message: "That's your own email. Invite the other person's." });
    const wait = invites.retryAfter(`u${u.id}`);
    if (wait > 0) return res.status(429).json({ message: `You've sent a lot of invites today. Try again in ${waitWords(wait)}.` });
    try {
      const link = await withLock(ownerKey(u.id), async () => {
        const links = await ownerLinks(u.id);
        if (links.some((l) => l.email === email)) throw Object.assign(new Error("You already share with that email. Change what you share from the list."), { status: 409 });
        if (links.length >= LINK_LIMITS.perOwner) throw Object.assign(new Error(`You can link up to ${LINK_LIMITS.perOwner} people.`), { status: 409 });
        const fresh: ProfileLink = { id: randomUUID().replace(/-/g, "").slice(0, 20), ownerId: u.id, email, nickname: String(req.body?.nickname || "").trim().slice(0, LINK_LIMITS.nickname), status: "pending", grants: cleanGrants(req.body?.grants), createdAt: iso(), updatedAt: iso() };
        await saveOwnerLinks(u.id, [...links, fresh]);
        return fresh;
      });
      invites.fail(`u${u.id}`);
      await editIds(emailKey(email), (ids) => [...ids, u.id]);
      res.json({ link: { id: link.id, email: link.email, nickname: link.nickname, status: link.status, grants: link.grants, viewerName: "", createdAt: link.createdAt } });
    } catch (error: any) {
      res.status(error?.status || 500).json({ message: error?.status ? error.message : "The invite couldn't be sent. Try again." });
    }
  });

  app.put("/api/profile-links/:id", authMiddleware, async (req: any, res) => {
    const u = me(req);
    if (!u) return res.status(401).json({ message: "Sign in first." });
    try {
      const updated = await withLock(ownerKey(u.id), async () => {
        const links = await ownerLinks(u.id);
        const at = links.findIndex((l) => l.id === req.params.id);
        if (at < 0) return null;
        const l = links[at];
        links[at] = { ...l, ...(req.body?.grants !== undefined ? { grants: cleanGrants(req.body.grants) } : {}), ...(typeof req.body?.nickname === "string" ? { nickname: req.body.nickname.trim().slice(0, LINK_LIMITS.nickname) } : {}), updatedAt: iso() };
        await saveOwnerLinks(u.id, links);
        return links[at];
      });
      if (!updated) return res.status(404).json({ message: "That link isn't there any more." });
      res.json({ link: { id: updated.id, email: updated.email, nickname: updated.nickname, status: updated.status, grants: updated.grants } });
    } catch {
      res.status(500).json({ message: "Couldn't save. Try again." });
    }
  });

  app.delete("/api/profile-links/:id", authMiddleware, async (req: any, res) => {
    const u = me(req);
    if (!u) return res.status(401).json({ message: "Sign in first." });
    try {
      const gone = await withLock(ownerKey(u.id), async () => {
        const links = await ownerLinks(u.id);
        const l = links.find((x) => x.id === req.params.id);
        if (l) await saveOwnerLinks(u.id, links.filter((x) => x !== l));
        return l;
      });
      if (gone) {
        await editIds(emailKey(gone.email), (ids) => ids.filter((x) => x !== u.id)).catch(() => {});
        if (gone.viewerId) await editIds(viewerKey(gone.viewerId), (ids) => ids.filter((x) => x !== u.id)).catch(() => {});
      }
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "Couldn't stop sharing. Try again." });
    }
  });

  const respond = (how: "accept" | "leave"): RequestHandler => async (req: any, res) => {
    const u = me(req);
    const ownerId = Number(req.params.owner);
    if (!u) return res.status(401).json({ message: "Sign in first." });
    if (!Number.isInteger(ownerId) || ownerId <= 0 || ownerId === u.id) return res.status(400).json({ message: "That invite isn't valid." });
    try {
      const ok = await withLock(ownerKey(ownerId), async () => {
        const links = await ownerLinks(ownerId);
        const at = links.findIndex((l) => l.id === req.params.id && (l.viewerId === u.id || (l.status === "pending" && !!u.email && l.email === u.email)));
        if (at < 0) return false;
        if (how === "accept") {
          // One link per person per owner: an older link already accepted by this person is merged away.
          const kept = links.filter((l, i) => i === at || l.viewerId !== u.id);
          const idx = kept.findIndex((l) => l.id === req.params.id);
          kept[idx] = { ...kept[idx], viewerId: u.id, status: "active", updatedAt: iso() };
          await saveOwnerLinks(ownerId, kept);
        } else {
          await saveOwnerLinks(ownerId, links.filter((_, i) => i !== at));
        }
        return true;
      });
      if (!ok) return res.status(404).json({ message: "That invite isn't there any more." });
      if (how === "accept") await editIds(viewerKey(u.id), (ids) => [...ids, ownerId]);
      else {
        await editIds(viewerKey(u.id), (ids) => ids.filter((x) => x !== ownerId)).catch(() => {});
        if (u.email) await editIds(emailKey(u.email), (ids) => ids.filter((x) => x !== ownerId)).catch(() => {});
      }
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "Couldn't save. Try again." });
    }
  };
  app.post("/api/profile-links/from/:owner/:id/accept", authMiddleware, respond("accept"));
  app.post("/api/profile-links/from/:owner/:id/leave", authMiddleware, respond("leave"));

  app.get("/api/profile-links/from/:owner/life/:item", authMiddleware, async (req: any, res) => {
    const u = me(req);
    const ownerId = Number(req.params.owner);
    const item = String(req.params.item || "");
    if (!u) return res.status(401).json({ message: "Sign in first." });
    const life = LIFE_SHARES.find((s) => s.id === `life:${item}`);
    const healthId = item.startsWith("health:") ? item.slice(7) : "";
    const shareId = life ? life.id : healthId ? `life:health:${healthId}` : "";
    if (!shareId || (healthId && !isHealthShareId(shareId)) || !Number.isInteger(ownerId) || ownerId <= 0) return res.status(400).json({ message: "Unknown page." });
    try {
      if (!allows(accessFor(await ownerLinks(ownerId), u.id, shareId), "view")) return res.status(403).json({ message: "This isn't shared with you." });
      const target = parseTarget(life ? life.target : `health:${healthId}`);
      const today = typeof req.query.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.today) ? req.query.today : new Date(now()).toISOString().slice(0, 10);
      const ownerName = await nameOf(ownerId);
      const view = target ? sharedView(await deps.lifeHub(ownerId), target, today, { ownerName }) : null;
      if (!view) return res.status(404).json({ message: "There's nothing on this page yet." });
      res.set("Cache-Control", "no-store");
      res.json({ view, today, owner: ownerName });
    } catch (error: any) {
      console.error("[profile-links] life view:", error?.message);
      res.status(500).json({ message: "This page couldn't be loaded. Try again." });
    }
  });

  return { canUseApp };
}
