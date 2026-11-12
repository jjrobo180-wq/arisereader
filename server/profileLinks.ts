// Linked profiles: the routes behind shared/profileLinks.ts.
//
//   GET    /api/profile-links                       what I share (mine) and what's shared with me (withMe)
//   POST   /api/profile-links                       invite { email, nickname?, grants }
//   PUT    /api/profile-links/:id                   change what I share with them { grants?, nickname? }
//   DELETE /api/profile-links/:id                   stop sharing with them
//   POST   /api/profile-links/link                  make a one-use join link { nickname, grants? } (full access by default)
//   POST   /api/profile-links/join/:token            open a join link while signed in: link my account to the owner
//   GET    /api/profile-links/join/:token            who is sharing, before joining
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
import { JOIN_LINK_EMAIL, LINK_LIMITS, LIFE_SHARES, fullGrants, accessFor, allows, appIdFromKey, appShareId, cleanGrants, cleanLinks, isHealthShareId, normalEmail, type Access, type ProfileLink } from "../shared/profileLinks";
import { parseTarget, sharedView } from "../shared/todoShare";
import { applyParts, pickParts, sharedAppById, sharedAppFor, sharedAppLabel } from "../shared/sharedApps";
import { merge3 } from "../shared/mergeJson";
import { cleanFamily, emptyFamily } from "../shared/familyHub";

export type ProfileLinkDeps = {
  getSetting: (key: string) => Promise<string | null | undefined>;
  upsertSetting: (key: string, value: string) => Promise<void>;
  getUser: (id: number) => Promise<{ id: number; displayName?: string; email?: string | null } | null | undefined>;
  /** The owner's saved LifeHub workspace, for shared LifeHub pages. */
  lifeHub: (ownerId: number) => Promise<unknown | null>;
  /** A link is in use (accepted, joined, approved, or changed while in use): things done together, like
   *  Accountability, are set up for the two of them. Never blocks the answer; failures are only logged. */
  onActive?: (link: ProfileLink) => Promise<void>;
  /** Whether two people already know each other here (they share an Accountability space): then one can start
   *  sharing with the other straight from the Sharing page, without typing an email. */
  knows?: (a: number, b: number) => Promise<boolean>;
  /** The owner's whole LifeHub, to read one shared app out of it and write that app back (only that app). */
  lifeWorkspace?: {
    read: (ownerId: number) => Promise<{ workspace: any; updatedAt: string } | null>;
    /** Saves if nobody else saved since `base`; null when someone did (then it's read again and retried). */
    write: (ownerId: number, workspace: any, base: string) => Promise<string | null>;
  };
  /** Tells someone with an account about sharing: a notification on their devices. Never blocks the answer. */
  notify?: (userId: number, msg: { title: string; body: string; url: string }) => Promise<unknown>;
  /** An invite to an email address: a notification when that email has an account, otherwise an email that
   *  asks them to download the app and sign up with it. Never blocks the answer. */
  inviteEmail?: (email: string, ownerName: string) => Promise<unknown>;
  now?: () => number;
};

const ownerKey = (id: number) => `profile_links_owner_${id}`;
const emailKey = (email: string) => `profile_links_email_${createHash("sha256").update(email).digest("hex").slice(0, 40)}`;
const viewerKey = (id: number) => `profile_links_viewer_${id}`;
/** Requests "may I see yours?", kept under the email they were sent to (hashed), until that person answers. */
const askKey = (email: string) => `profile_links_ask_${createHash("sha256").update(email).digest("hex").slice(0, 40)}`;
const asks = createAttemptLimiter({ max: 15, windowMs: 24 * 3600_000 });
type Ask = { id: string; fromId: number; nickname: string; grants: Record<string, "view" | "edit">; createdAt: string };
const invites = createAttemptLimiter({ max: 15, windowMs: 24 * 3600_000 });
const joins = createAttemptLimiter({ max: 20, windowMs: 3600_000 });
/** A join link works once, within two weeks. It is kept under the hash of the token, so a leaked database doesn't leak working links. */
const joinKey = (token: string) => `profile_links_join_${createHash("sha256").update(token).digest("hex").slice(0, 40)}`;
const JOIN_DAYS = 14;

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
  const activated = (link: ProfileLink | null | undefined) => {
    if (!link || link.status !== "active" || !link.viewerId || !deps.onActive) return Promise.resolve();
    return deps.onActive(link).catch((e: any) => console.error("[profile-links] together:", e?.message || e));
  };
  const now = deps.now ?? Date.now;
  const iso = () => new Date(now()).toISOString();
  const readJson = async (key: string): Promise<unknown> => { const raw = await deps.getSetting(key); if (!raw) return null; try { return JSON.parse(raw); } catch { return null; } };
  const ownerLinks = async (ownerId: number) => cleanLinks(await readJson(ownerKey(ownerId)), ownerId);
  const saveOwnerLinks = (ownerId: number, links: ProfileLink[]) => deps.upsertSetting(ownerKey(ownerId), JSON.stringify(links));
  const readIds = async (key: string): Promise<number[]> => { const v = await readJson(key); return Array.isArray(v) ? [...new Set(v.filter((x): x is number => Number.isInteger(x) && x > 0))].slice(0, 200) : []; };
  const editIds = (key: string, fn: (ids: number[]) => number[]) => withLock(key, async () => { await deps.upsertSetting(key, JSON.stringify(fn(await readIds(key)))); });
  const me = (req: any): { id: number; email: string } | null => { const u = req.adminPreview && req.realUser ? req.realUser : req.user; return u?.id ? { id: Number(u.id), email: normalEmail(u.email) } : null; };
  const nameOf = async (id: number) => { const u = await deps.getUser(id).catch(() => null); return String(u?.displayName || "").trim() || "Someone"; };

  const tell = (userId: number, title: string, body: string) => { void Promise.resolve(deps.notify?.(userId, { title, body, url: "/#/pro?hub=life" })).catch((e: any) => console.error("[profile-links] notify:", e?.message)); };
  const tellOwnerAccepted = async (link: ProfileLink | null | undefined, who: { id: number }) => { if (link) tell(link.ownerId, "Sharing accepted", `${await nameOf(who.id)} accepted your invite. They can open what you shared now.`); };

  /** What a change of access newly opens to them ("Kitchen", "Kitchen and Calendar"), or "" when nothing new. */
  const newlyShared = (before: Record<string, string> | undefined, after: Record<string, string>) => {
    const names = Object.keys(after).filter((id) => !before?.[id] || (before[id] === "view" && after[id] === "edit"))
      .map((id) => sharedAppLabel(id)).filter((x): x is string => !!x);
    const uniq = [...new Set(names)];
    return uniq.length <= 2 ? uniq.join(" and ") : `${uniq.slice(0, 2).join(", ")} and ${uniq.length - 2} more`;
  };
  const tellShared = async (ownerId: number, link: ProfileLink, what: string) => {
    if (!what) return;
    const owner = await nameOf(ownerId);
    if (link.viewerId) tell(link.viewerId, `${owner} shared ${what} with you`, "Tap to open it.");
    else if (link.email && !link.email.endsWith(".invalid")) void Promise.resolve(deps.inviteEmail?.(link.email, owner)).catch(() => {});
  };

  const readAsks = async (email: string): Promise<Ask[]> => {
    const v = await readJson(askKey(email));
    return (Array.isArray(v) ? v : []).flatMap((r: any): Ask[] => {
      const id = typeof r?.id === "string" && /^[\w-]{6,40}$/.test(r.id) ? r.id : "";
      const fromId = Number.isInteger(r?.fromId) && r.fromId > 0 ? r.fromId : 0;
      if (!id || !fromId) return [];
      return [{ id, fromId, nickname: typeof r.nickname === "string" ? r.nickname.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, LINK_LIMITS.nickname) : "", grants: cleanGrants(r.grants) as Ask["grants"], createdAt: typeof r.createdAt === "string" ? r.createdAt.slice(0, 40) : "" }];
    }).slice(0, 50);
  };
  const saveAsks = (email: string, list: Ask[]) => deps.upsertSetting(askKey(email), JSON.stringify(list));

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
      const mineOut = await Promise.all(mine.map(async (l) => ({ id: l.id, email: l.email, nickname: l.nickname, status: l.status, grants: l.grants, viewerId: l.viewerId ?? null, viewerName: l.viewerId ? await nameOf(l.viewerId) : "", createdAt: l.createdAt })));
      const withMe = await Promise.all(theirs.map(async (l) => ({ id: l.id, ownerId: l.ownerId, ownerName: await nameOf(l.ownerId), status: l.status, grants: l.grants })));
      const requests = await Promise.all((u.email ? await readAsks(u.email) : []).filter((r) => r.fromId !== u.id).map(async (r) => ({ id: r.id, fromId: r.fromId, fromName: await nameOf(r.fromId), nickname: r.nickname, grants: r.grants, createdAt: r.createdAt })));
      res.set("Cache-Control", "no-store");
      res.json({ mine: mineOut, withMe, myEmail: u.email, requests });
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
      void nameOf(u.id).then((n) => deps.inviteEmail?.(email, n)).catch((e: any) => console.error("[profile-links] invite notice:", e?.message));
      res.json({ link: { id: link.id, email: link.email, nickname: link.nickname, status: link.status, grants: link.grants, viewerName: "", createdAt: link.createdAt } });
    } catch (error: any) {
      res.status(error?.status || 500).json({ message: error?.status ? error.message : "The invite couldn't be sent. Try again." });
    }
  });

  /** A link to send to someone (a wife, a husband, a grandparent): opening it while signed in links their account to
   *  yours with the access you chose. Full access by default: every app (to edit) and every LifeHub page (to view). */
  app.post("/api/profile-links/link", authMiddleware, async (req: any, res) => {
    const u = me(req);
    if (!u) return res.status(401).json({ message: "Sign in first." });
    const wait = invites.retryAfter(`u${u.id}`);
    if (wait > 0) return res.status(429).json({ message: `You've made a lot of links today. Try again in ${waitWords(wait)}.` });
    try {
      const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 12);
      const grants = req.body?.grants && typeof req.body.grants === "object" ? cleanGrants(req.body.grants) : fullGrants();
      const link = await withLock(ownerKey(u.id), async () => {
        const links = await ownerLinks(u.id);
        if (links.length >= LINK_LIMITS.perOwner) throw Object.assign(new Error(`You can link up to ${LINK_LIMITS.perOwner} people. Remove one first.`), { status: 409 });
        const id = randomUUID().replace(/-/g, "").slice(0, 20);
        const fresh: ProfileLink = { id, ownerId: u.id, email: `join-${id}${JOIN_LINK_EMAIL}`, nickname: String(req.body?.nickname || "").trim().replace(/[\u0000-\u001f]/g, " ").slice(0, LINK_LIMITS.nickname), status: "pending", grants, createdAt: iso(), updatedAt: iso() };
        await saveOwnerLinks(u.id, [...links, fresh]);
        return fresh;
      });
      await deps.upsertSetting(joinKey(token), JSON.stringify({ ownerId: u.id, linkId: link.id, createdAt: iso() }));
      invites.fail(`u${u.id}`);
      res.json({ token, link: { id: link.id, email: link.email, nickname: link.nickname, status: link.status, grants: link.grants, viewerName: "", createdAt: link.createdAt } });
    } catch (error: any) {
      res.status(error?.status || 500).json({ message: error?.status ? error.message : "The link couldn't be made. Try again." });
    }
  });

  const findJoin = async (token: string) => {
    if (!/^[a-f0-9]{44}$/.test(token)) return null;
    const rec: any = await readJson(joinKey(token));
    if (!rec || !Number.isInteger(rec.ownerId) || typeof rec.linkId !== "string") return null;
    if (now() - Date.parse(rec.createdAt || "") > JOIN_DAYS * 86400_000) return null;
    const link = (await ownerLinks(rec.ownerId)).find((l) => l.id === rec.linkId && l.status === "pending");
    return link ? { ownerId: rec.ownerId as number, link } : null;
  };

  app.get("/api/profile-links/join/:token", authMiddleware, async (req: any, res) => {
    const u = me(req);
    if (!u) return res.status(401).json({ message: "Sign in first." });
    const wait = joins.retryAfter(`u${u.id}`);
    if (wait > 0) return res.status(429).json({ message: `Too many tries. Try again in ${waitWords(wait)}.` });
    const found = await findJoin(String(req.params.token || "")).catch(() => null);
    if (!found) { joins.fail(`u${u.id}`); return res.status(404).json({ message: "This link has already been used or turned off. Ask them to send a new one." }); }
    res.json({ ownerName: await nameOf(found.ownerId), you: found.ownerId === u.id });
  });

  app.post("/api/profile-links/join/:token", authMiddleware, async (req: any, res) => {
    const u = me(req);
    if (!u) return res.status(401).json({ message: "Sign in first." });
    const token = String(req.params.token || "");
    const wait = joins.retryAfter(`u${u.id}`);
    if (wait > 0) return res.status(429).json({ message: `Too many tries. Try again in ${waitWords(wait)}.` });
    try {
      const found = await findJoin(token);
      if (!found) { joins.fail(`u${u.id}`); return res.status(404).json({ message: "This link has already been used or turned off. Ask them to send a new one." }); }
      if (found.ownerId === u.id) return res.status(400).json({ message: "That's your own link. Send it to the other person." });
      const ok = await withLock(ownerKey(found.ownerId), async () => {
        const links = await ownerLinks(found.ownerId);
        const at = links.findIndex((l) => l.id === found.link.id && l.status === "pending");
        if (at < 0) return false;
        // One link per person: an older link this person already had is replaced by the new one.
        const kept = links.filter((l, i) => i === at || l.viewerId !== u.id);
        const idx = kept.findIndex((l) => l.id === found.link.id);
        kept[idx] = { ...kept[idx], viewerId: u.id, status: "active", updatedAt: iso() };
        await saveOwnerLinks(found.ownerId, kept);
        return kept[idx];
      });
      if (!ok) return res.status(404).json({ message: "This link has already been used or turned off. Ask them to send a new one." });
      await deps.upsertSetting(joinKey(token), "");
      await editIds(viewerKey(u.id), (ids) => [...ids, found.ownerId]);
      await activated(ok);
      void tellOwnerAccepted(ok, u);
      res.json({ ok: true, ownerId: found.ownerId, ownerName: await nameOf(found.ownerId) });
    } catch {
      res.status(500).json({ message: "Couldn't join. Try again." });
    }
  });

  /** The address people get: a bare page that moves on to the app (chat apps read it for a preview). */
  app.get("/join/:token", (req, res) => {
    const token = String(req.params.token || "");
    const to = /^[a-f0-9]{44}$/.test(token) ? `/#/join/${token}` : "/";
    res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" });
    res.type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Join on Arise To Duo</title><meta property="og:title" content="Join on Arise To Duo"><meta property="og:description" content="Someone is sharing their family apps with you."><script>location.replace(${JSON.stringify(to)});</script></head><body><p>Opening Arise To Duo…</p><p><a href="${to}">Tap here if it doesn't open</a></p></body></html>`);
  });

  app.put("/api/profile-links/:id", authMiddleware, async (req: any, res) => {
    const u = me(req);
    if (!u) return res.status(401).json({ message: "Sign in first." });
    let before: Record<string, string> | undefined;
    try {
      const updated = await withLock(ownerKey(u.id), async () => {
        const links = await ownerLinks(u.id);
        const at = links.findIndex((l) => l.id === req.params.id);
        if (at < 0) return null;
        const l = links[at];
        before = l.grants as Record<string, string>;
        links[at] = { ...l, ...(req.body?.grants !== undefined ? { grants: cleanGrants(req.body.grants) } : {}), ...(typeof req.body?.nickname === "string" ? { nickname: req.body.nickname.trim().slice(0, LINK_LIMITS.nickname) } : {}), updatedAt: iso() };
        await saveOwnerLinks(u.id, links);
        return links[at];
      });
      if (!updated) return res.status(404).json({ message: "That link isn't there any more." });
      await activated(updated);
      void tellShared(u.id, updated, newlyShared(before, updated.grants as Record<string, string>)).catch(() => {});
      res.json({ link: { id: updated.id, email: updated.email, nickname: updated.nickname, status: updated.status, grants: updated.grants } });
    } catch {
      res.status(500).json({ message: "Couldn't save. Try again." });
    }
  });

  /** Share with someone you're already together with (an Accountability space): by their account, no invite to
   *  accept, since you're already connected. Body { userId, nickname?, grants }. Changes the link if there is one. */
  app.post("/api/profile-links/person", authMiddleware, async (req: any, res) => {
    const u = me(req);
    if (!u) return res.status(401).json({ message: "Sign in first." });
    const other = Number(req.body?.userId);
    if (!Number.isInteger(other) || other <= 0 || other === u.id) return res.status(400).json({ message: "Who is this for?" });
    try {
      if (!deps.knows || !(await deps.knows(u.id, other))) return res.status(403).json({ message: "Invite them by email or with a link first." });
      const them = await deps.getUser(other).catch(() => null);
      if (!them) return res.status(404).json({ message: "That account isn't there any more." });
      const grants = cleanGrants(req.body?.grants);
      let personBefore: Record<string, string> | undefined;
      const link = await withLock(ownerKey(u.id), async () => {
        const links = await ownerLinks(u.id);
        const at = links.findIndex((l) => l.viewerId === other);
        personBefore = at >= 0 ? (links[at].grants as Record<string, string>) : undefined;
        const nickname = typeof req.body?.nickname === "string" ? req.body.nickname.trim().slice(0, LINK_LIMITS.nickname) : "";
        if (at >= 0) links[at] = { ...links[at], grants, status: "active", ...(nickname ? { nickname } : {}), updatedAt: iso() };
        else if (links.length >= LINK_LIMITS.perOwner) throw Object.assign(new Error(`You can link up to ${LINK_LIMITS.perOwner} people. Remove one first.`), { status: 409 });
        else links.push({ id: randomUUID().replace(/-/g, "").slice(0, 20), ownerId: u.id, email: normalEmail(them.email) || `user${other}@linked.invalid`, viewerId: other, nickname, status: "active", grants, createdAt: iso(), updatedAt: iso() });
        await saveOwnerLinks(u.id, links);
        return links.find((l) => l.viewerId === other)!;
      });
      await editIds(viewerKey(other), (ids) => [...ids, u.id]);
      await activated(link);
      void tellShared(u.id, link, newlyShared(personBefore, link.grants as Record<string, string>)).catch(() => {});
      res.json({ link: { id: link.id, email: link.email, nickname: link.nickname, status: link.status, grants: link.grants, viewerName: String(them.displayName || "").trim().split(/\s+/)[0] || "", createdAt: link.createdAt } });
    } catch (error: any) {
      res.status(error?.status || 500).json({ message: error?.status ? error.message : "Couldn't save. Try again." });
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

  // "Ask to see theirs": the other person (who already keeps the data, say a daughter logging potty trips on her
  // own phone) gets a request and chooses whether to share. Nothing is shared until she approves, and the
  // reply never says whether that email has an account.
  app.post("/api/profile-links/ask", authMiddleware, async (req: any, res) => {
    const u = me(req);
    if (!u) return res.status(401).json({ message: "Sign in first." });
    const email = normalEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: "Type their email address." });
    if (email === u.email) return res.status(400).json({ message: "That's your own email." });
    const wait = asks.retryAfter(`u${u.id}`);
    if (wait > 0) return res.status(429).json({ message: `You've sent a lot of requests today. Try again in ${waitWords(wait)}.` });
    const grants = cleanGrants(req.body?.grants);
    if (!Object.keys(grants).length) return res.status(400).json({ message: "Pick at least one thing to ask for." });
    try {
      await withLock(askKey(email), async () => {
        const list = (await readAsks(email)).filter((r) => r.fromId !== u.id);
        list.push({ id: randomUUID().replace(/-/g, "").slice(0, 20), fromId: u.id, nickname: String(req.body?.nickname || "").trim().slice(0, LINK_LIMITS.nickname), grants: grants as Ask["grants"], createdAt: iso() });
        await saveAsks(email, list.slice(-50));
      });
      asks.fail(`u${u.id}`);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "The request couldn't be sent. Try again." });
    }
  });

  const answerAsk = (how: "approve" | "decline"): RequestHandler => async (req: any, res) => {
    const u = me(req);
    if (!u) return res.status(401).json({ message: "Sign in first." });
    if (!u.email) return res.status(400).json({ message: "Add an email to your account first." });
    try {
      const ask = await withLock(askKey(u.email), async () => {
        const list = await readAsks(u.email);
        const found = list.find((r) => r.id === req.params.id);
        if (found) await saveAsks(u.email, list.filter((r) => r !== found));
        return found;
      });
      if (!ask) return res.status(404).json({ message: "That request isn't there any more." });
      if (how === "approve") {
        const asker = await deps.getUser(ask.fromId).catch(() => null);
        const askerEmail = normalEmail(asker?.email);
        // What is shared is what was asked for, or less: the approver may narrow it, never widen it.
        const chosen = req.body?.grants !== undefined ? cleanGrants(req.body.grants) : ask.grants;
        const grants: Record<string, Access> = {};
        for (const [id, v] of Object.entries(chosen)) { const asked = ask.grants[id]; if (asked) grants[id] = asked === "view" || v === "view" ? "view" : "edit"; }
        if (!Object.keys(grants).length) return res.status(400).json({ message: "Pick at least one thing to share." });
        const made = await withLock(ownerKey(u.id), async () => {
          const links = await ownerLinks(u.id);
          const at = links.findIndex((l) => l.viewerId === ask.fromId || (!!askerEmail && l.email === askerEmail));
          if (at >= 0) links[at] = { ...links[at], viewerId: ask.fromId, status: "active", grants: { ...links[at].grants, ...grants }, updatedAt: iso() };
          else if (links.length >= LINK_LIMITS.perOwner) throw Object.assign(new Error(`You can link up to ${LINK_LIMITS.perOwner} people.`), { status: 409 });
          else links.push({ id: randomUUID().replace(/-/g, "").slice(0, 20), ownerId: u.id, email: askerEmail || `user${ask.fromId}@linked.invalid`, viewerId: ask.fromId, nickname: ask.nickname, status: "active", grants, createdAt: iso(), updatedAt: iso() });
          await saveOwnerLinks(u.id, links);
          return links.find((l) => l.viewerId === ask.fromId);
        });
        await activated(made);
        await editIds(viewerKey(ask.fromId), (ids) => [...ids, u.id]);
      }
      res.json({ ok: true });
    } catch (error: any) {
      res.status(error?.status || 500).json({ message: error?.status ? error.message : "Couldn't save. Try again." });
    }
  };
  app.post("/api/profile-links/requests/:id/approve", authMiddleware, answerAsk("approve"));
  app.post("/api/profile-links/requests/:id/decline", authMiddleware, answerAsk("decline"));

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
          return kept[idx];
        } else {
          await saveOwnerLinks(ownerId, links.filter((_, i) => i !== at));
        }
        return true;
      });
      if (!ok) return res.status(404).json({ message: "That invite isn't there any more." });
      if (how === "accept") { await editIds(viewerKey(u.id), (ids) => [...ids, ownerId]); if (ok !== true) { await activated(ok); void tellOwnerAccepted(ok, u); } }
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

  // ─── A shared LifeHub app: the partner opens the owner's copy, and with Edit changes it ───
  const appAccess = async (req: any, res: any) => {
    const u = me(req);
    const ownerId = Number(req.params.owner);
    const shared = sharedAppFor(String(req.params.section || ""));
    if (!u) { res.status(401).json({ message: "Sign in first." }); return null; }
    if (!shared || !Number.isInteger(ownerId) || ownerId <= 0) { res.status(400).json({ message: "Unknown app." }); return null; }
    if (!deps.lifeWorkspace) { res.status(503).json({ message: "Shared apps aren't available right now." }); return null; }
    const access = accessFor(await ownerLinks(ownerId), u.id, shared.id);
    if (!allows(access, "view")) { res.status(403).json({ message: "This isn't shared with you (any more)." }); return null; }
    return { u, ownerId, shared, access: access! };
  };
  app.get("/api/profile-links/from/:owner/app/:section", authMiddleware, async (req: any, res) => {
    const a = await appAccess(req, res); if (!a) return;
    try {
      const row = await deps.lifeWorkspace!.read(a.ownerId);
      const family = cleanFamily(row?.workspace?.family ?? emptyFamily());
      res.set("Cache-Control", "no-store").json({ access: a.access, owner: await nameOf(a.ownerId), members: family.members, slice: pickParts(family, a.shared.parts), updatedAt: row?.updatedAt || null });
    } catch (e: any) { console.error("[profile-links] app read:", e?.message); res.status(500).json({ message: "This app couldn't be opened. Try again." }); }
  });
  /** Body { slice }: the app's data as the partner left it. Only that app's parts are written. */
  app.put("/api/profile-links/from/:owner/app/:section", authMiddleware, async (req: any, res) => {
    const a = await appAccess(req, res); if (!a) return;
    if (!allows(a.access, "edit")) return res.status(403).json({ message: "You can look at this, but not change it." });
    const slice = req.body?.slice;
    if (!slice || typeof slice !== "object" || Array.isArray(slice)) return res.status(400).json({ message: "Nothing to save." });
    if (Buffer.byteLength(JSON.stringify(req.body), "utf8") > 4_000_000) return res.status(413).json({ message: "That's too much to save at once." });
    try {
      for (let tries = 0; tries < 4; tries++) {
        const row = await deps.lifeWorkspace!.read(a.ownerId);
        if (!row?.workspace) return res.status(404).json({ message: "Their LifeHub isn't set up yet." });
        const current = cleanFamily(row.workspace.family ?? emptyFamily());
        // With the copy they started from (base), only what they changed is put in: whatever the owner (or anyone
        // else) added meanwhile stays. Without it (an older app), their copy replaces this app's data as before.
        const base = req.body?.base && typeof req.body.base === "object" && !Array.isArray(req.body.base) ? req.body.base : null;
        const incoming = base ? merge3(base, slice, pickParts(current, a.shared.parts)) : slice;
        const family = cleanFamily(applyParts(current, a.shared.parts, incoming as Record<string, unknown>));
        const saved = await deps.lifeWorkspace!.write(a.ownerId, { ...row.workspace, family }, row.updatedAt);
        if (saved) return res.json({ ok: true, updatedAt: saved, slice: pickParts(family, a.shared.parts) });
      }
      res.status(409).json({ message: "They're changing it right now. Try again in a moment." });
    } catch (e: any) { console.error("[profile-links] app write:", e?.message); res.status(500).json({ message: "Couldn't save. Try again." }); }
  });

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
