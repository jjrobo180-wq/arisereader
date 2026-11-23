// FamilyHub (shared/familySpace.ts): start a family, join one with its code, and read and save the one
// workspace everyone in it shares. Saving works exactly like LifeHub's (server/ariseTodo.ts): the copy is
// saved only over the version the phone last saw, or the phone is told to merge first (HUB_CONFLICT).
import type { Express, RequestHandler } from "express";
import { getAdminSupabase } from "./supabase";
import { HUB_CONFLICT } from "../shared/hubSave";
import { cleanFamily } from "../shared/familyHub";
import { FAMILY_MAX_MEMBERS, canLeave, cleanFamilyCode, cleanFamilyName, makeFamilyCode, type FamilyInfo } from "../shared/familySpace";
import { MAX_BYTES, validateWorkspace } from "./ariseTodo";

const SPACES = "family_spaces";
const MEMBERS = "family_space_members";

/** The family this person is in (its owner's id), or null. */
export async function familyOf(userId: number): Promise<number | null> {
  const { data, error } = await getAdminSupabase().from(MEMBERS).select("owner_id").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? Number(data.owner_id) : null;
}

async function info(ownerId: number, me: number): Promise<FamilyInfo | null> {
  const db = getAdminSupabase();
  const { data: space, error } = await db.from(SPACES).select("name, code").eq("owner_id", ownerId).maybeSingle();
  if (error) throw error;
  if (!space) return null;
  const { data: rows, error: e2 } = await db.from(MEMBERS).select("user_id, joined_at").eq("owner_id", ownerId).order("joined_at");
  if (e2) throw e2;
  const ids = (rows ?? []).map((r: any) => Number(r.user_id));
  const names = new Map<number, string>();
  if (ids.length) {
    const { data: people } = await db.from("users").select("id, display_name, username").in("id", ids);
    for (const p of people ?? []) names.set(Number((p as any).id), String((p as any).display_name || (p as any).username || "Family member"));
  }
  return {
    name: String(space.name), code: String(space.code), owner: ownerId === me,
    members: ids.map((id) => ({ id, name: names.get(id) || "Family member", owner: id === ownerId })),
  };
}

export function registerFamilySpaceRoutes(app: Express, authMiddleware: RequestHandler) {
  const me = (req: any, res: any): number | null => {
    const id = Number(req.user?.id);
    if (!req.user || req.adminPreview || !Number.isSafeInteger(id)) { res.status(403).json({ message: "Sign in to your own account to use FamilyHub." }); return null; }
    return id;
  };
  const fail = (res: any, where: string, error: any) => {
    console.error(`[family-space] ${where}:`, error?.message);
    return res.status(503).json({ message: "FamilyHub is unavailable for a moment. Nothing was changed. Please try again." });
  };

  app.get("/api/family-space", authMiddleware, async (req: any, res) => {
    const id = me(req, res); if (id === null) return;
    res.set("Cache-Control", "no-store");
    try {
      const owner = await familyOf(id);
      return res.json({ family: owner === null ? null : await info(owner, id) });
    } catch (e) { return fail(res, "read", e); }
  });

  app.post("/api/family-space", authMiddleware, async (req: any, res) => {
    const id = me(req, res); if (id === null) return;
    try {
      if ((await familyOf(id)) !== null) return res.status(409).json({ message: "You're already in a family. Leave it first to start a new one." });
      const db = getAdminSupabase();
      for (let attempt = 0; attempt < 5; attempt++) {
        const { error } = await db.from(SPACES).insert({ owner_id: id, name: cleanFamilyName(req.body?.name), code: makeFamilyCode() });
        if (error?.code === "23505" && /code/.test(String(error.message))) continue; // that code is taken: another
        if (error) throw error;
        const { error: e2 } = await db.from(MEMBERS).insert({ user_id: id, owner_id: id });
        if (e2) { await db.from(SPACES).delete().eq("owner_id", id); throw e2; }
        return res.json({ family: await info(id, id) });
      }
      throw new Error("no free code");
    } catch (e) { return fail(res, "start", e); }
  });

  app.post("/api/family-space/join", authMiddleware, async (req: any, res) => {
    const id = me(req, res); if (id === null) return;
    const code = cleanFamilyCode(req.body?.code);
    if (!code) return res.status(400).json({ message: "A family code is 6 letters and numbers." });
    try {
      if ((await familyOf(id)) !== null) return res.status(409).json({ message: "You're already in a family. Leave it first to join another." });
      const db = getAdminSupabase();
      const { data: space, error } = await db.from(SPACES).select("owner_id").eq("code", code).maybeSingle();
      if (error) throw error;
      if (!space) return res.status(404).json({ message: "No family has that code. Check it with the person who sent it." });
      const owner = Number(space.owner_id);
      const { count } = await db.from(MEMBERS).select("user_id", { count: "exact", head: true }).eq("owner_id", owner);
      if ((count ?? 0) >= FAMILY_MAX_MEMBERS) return res.status(409).json({ message: `A family can have up to ${FAMILY_MAX_MEMBERS} people.` });
      const { error: e2 } = await db.from(MEMBERS).insert({ user_id: id, owner_id: owner });
      if (e2?.code === "23505") return res.status(409).json({ message: "You're already in a family." });
      if (e2) throw e2;
      return res.json({ family: await info(owner, id) });
    } catch (e) { return fail(res, "join", e); }
  });

  app.post("/api/family-space/leave", authMiddleware, async (req: any, res) => {
    const id = me(req, res); if (id === null) return;
    try {
      const owner = await familyOf(id);
      if (owner === null) return res.json({ family: null });
      const db = getAdminSupabase();
      const { count } = await db.from(MEMBERS).select("user_id", { count: "exact", head: true }).eq("owner_id", owner);
      if (!canLeave({ owner: owner === id, memberCount: count ?? 0 })) return res.status(409).json({ message: "You started this family, so you can leave once everyone else has. Remove them first." });
      // The last one out: the family and its hub go with it (members cascade).
      if (owner === id) { const { error } = await db.from(SPACES).delete().eq("owner_id", id); if (error) throw error; }
      else { const { error } = await db.from(MEMBERS).delete().eq("user_id", id); if (error) throw error; }
      return res.json({ family: null });
    } catch (e) { return fail(res, "leave", e); }
  });

  app.post("/api/family-space/remove", authMiddleware, async (req: any, res) => {
    const id = me(req, res); if (id === null) return;
    const who = Number(req.body?.userId);
    if (!Number.isSafeInteger(who) || who === id) return res.status(400).json({ message: "Choose someone else in the family." });
    try {
      if ((await familyOf(id)) !== id) return res.status(403).json({ message: "Only the person who started the family can remove people." });
      const { error } = await getAdminSupabase().from(MEMBERS).delete().eq("user_id", who).eq("owner_id", id);
      if (error) throw error;
      return res.json({ family: await info(id, id) });
    } catch (e) { return fail(res, "remove", e); }
  });

  // The shared workspace: the same answers as /api/arise-todo/workspace, for the family's copy.
  app.get("/api/family-space/workspace", authMiddleware, async (req: any, res) => {
    const id = me(req, res); if (id === null) return;
    res.set("Cache-Control", "no-store");
    try {
      const owner = await familyOf(id);
      if (owner === null) return res.status(404).json({ code: "NO_FAMILY", message: "Start or join a family first." });
      const { data, error } = await getAdminSupabase().from(SPACES).select(req.query?.since ? "updated_at" : "workspace, updated_at").eq("owner_id", owner).maybeSingle();
      if (error) throw error;
      const updatedAt = (data as any)?.updated_at ? String((data as any).updated_at) : null;
      if (typeof req.query?.since === "string" && req.query.since) {
        if (updatedAt && updatedAt === req.query.since) return res.json({ unchanged: true, updatedAt });
        const { data: full, error: e2 } = await getAdminSupabase().from(SPACES).select("workspace, updated_at").eq("owner_id", owner).maybeSingle();
        if (e2) throw e2;
        return res.json({ workspace: (full as any)?.workspace ?? null, updatedAt: (full as any)?.updated_at ? String((full as any).updated_at) : null });
      }
      return res.json({ workspace: (data as any)?.workspace ?? null, updatedAt });
    } catch (e) { return fail(res, "workspace read", e); }
  });

  app.put("/api/family-space/workspace", authMiddleware, async (req: any, res) => {
    const id = me(req, res); if (id === null) return;
    res.set("Cache-Control", "no-store");
    const { workspace, baseUpdatedAt, overwrite } = req.body || {};
    if (!validateWorkspace(workspace)) return res.status(400).json({ message: "This FamilyHub has invalid task or list data." });
    if (workspace.version === 2) workspace.family = cleanFamily(workspace.family);
    if (Buffer.byteLength(JSON.stringify(workspace), "utf8") > MAX_BYTES) return res.status(413).json({ message: "FamilyHub has reached its space limit. Export a backup before removing old items." });
    if (baseUpdatedAt !== null && (typeof baseUpdatedAt !== "string" || !Number.isFinite(Date.parse(baseUpdatedAt)))) return res.status(400).json({ message: "Missing saved version. Refresh FamilyHub first." });
    if (overwrite !== undefined && typeof overwrite !== "boolean") return res.status(400).json({ message: "Invalid overwrite option." });
    try {
      const owner = await familyOf(id);
      if (owner === null) return res.status(404).json({ code: "NO_FAMILY", message: "Start or join a family first." });
      const db = getAdminSupabase();
      const { data: row, error } = await db.from(SPACES).select("updated_at").eq("owner_id", owner).maybeSingle();
      if (error) throw error;
      if (!row) return res.status(404).json({ code: "NO_FAMILY", message: "This family no longer exists." });
      const previous = row.updated_at ? String(row.updated_at) : null;
      const conflict = () => res.status(409).json({ code: HUB_CONFLICT, message: "Someone in your family changed FamilyHub. Choose which copy to keep.", updatedAt: previous });
      if (previous && !overwrite && previous !== baseUpdatedAt) return conflict();
      if (!previous && baseUpdatedAt !== null && !overwrite) return conflict();
      const now = new Date(Math.max(Date.now(), Date.parse(previous || "") + 1 || 0)).toISOString();
      let update = db.from(SPACES).update({ workspace, updated_at: now }).eq("owner_id", owner);
      if (!overwrite) update = previous ? update.eq("updated_at", previous) : update.is("updated_at", null);
      const { data, error: e2 } = await update.select("updated_at").maybeSingle();
      if (e2) throw e2;
      if (!data) return conflict();
      return res.json({ success: true, updatedAt: String(data.updated_at) });
    } catch (e) { return fail(res, "workspace save", e); }
  });
}
