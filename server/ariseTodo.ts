// A.R.I.S.E. To-Do: private cloud workspace for every signed-in account.
// Uses the site's own session tokens, not Supabase Auth identities.
import type { Express, RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { createAttemptLimiter, clientAddress, waitWords } from "./attemptLimiter";
import { storage } from "./storage";
import { getAdminSupabase } from "./supabase";
import { HUB_CONFLICT } from "../shared/hubSave";

const TABLE = "arise_todo_workspaces";
const MAX_BYTES = 2_000_000;
const signupLimits = createAttemptLimiter({ max: 8, windowMs: 60 * 60_000 });

function validDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateWorkspace(input: unknown): input is Record<string, any> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const data = input as Record<string, any>;
  if (data.version !== 1 || !Array.isArray(data.lists) || !Array.isArray(data.tasks)) return false;
  if (!data.lists.length || data.lists.length > 100 || data.tasks.length > 5000) return false;
  const listIds = new Set<string>();
  for (const row of data.lists) {
    if (!row || typeof row !== "object"
      || typeof row.id !== "string" || !row.id || row.id.length > 100
      || typeof row.name !== "string" || !row.name.trim() || row.name.length > 60
      || typeof row.color !== "string" || !/^#[a-f0-9]{6}$/i.test(row.color)
      || listIds.has(row.id)) return false;
    listIds.add(row.id);
  }
  const taskIds = new Set<string>();
  for (const row of data.tasks) {
    if (!row || typeof row !== "object"
      || typeof row.id !== "string" || !row.id || row.id.length > 100 || taskIds.has(row.id)
      || typeof row.title !== "string" || !row.title.trim() || row.title.length > 200
      || typeof row.notes !== "string" || row.notes.length > 2000
      || typeof row.listId !== "string" || !listIds.has(row.listId)
      || typeof row.assignee !== "string" || row.assignee.length > 100
      || typeof row.due !== "string" || (row.due !== "" && !validDate(row.due))
      || typeof row.time !== "string" || (row.time !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time))
      || !["low", "normal", "high"].includes(row.priority)
      || !["none", "daily", "weekly", "monthly"].includes(row.repeat)
      || typeof row.done !== "boolean"
      || typeof row.createdAt !== "string" || row.createdAt.length > 40
      || (row.completedAt !== undefined && (typeof row.completedAt !== "string" || row.completedAt.length > 40))) return false;
    taskIds.add(row.id);
  }
  return true;
}

async function readWorkspace(userId: number) {
  const { data, error } = await getAdminSupabase().from(TABLE).select("workspace, updated_at")
    .eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? { workspace: data.workspace, updatedAt: String(data.updated_at) } : null;
}

function rejectPreview(req: any, res: any): boolean {
  // An admin preview account is not a real person's private to-do workspace.
  if (!Number.isSafeInteger(Number(req.user?.id)) || !req.user || req.adminPreview) {
    res.status(403).json({ message: "Sign in to a regular account to use A.R.I.S.E. To-Do." });
    return true;
  }
  return false;
}

export function registerAriseTodoRoutes(app: Express, authMiddleware: RequestHandler) {
  // Separate signup for adults / workers / individuals: no student or teacher fields.
  app.post("/api/arise-todo/register", async (req: any, res) => {
    const address = clientAddress(req);
    const wait = signupLimits.retryAfter(address);
    if (wait > 0) {
      res.set("Retry-After", String(Math.ceil(wait / 1000)));
      return res.status(429).json({ message: "Too many sign-up attempts. " + waitWords(wait) + " remaining." });
    }
    signupLimits.fail(address);
    const username = typeof req.body?.username === "string" ? req.body.username.trim().toLowerCase() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
    if (!/^[a-z0-9_-]{3,30}$/.test(username)) {
      return res.status(400).json({ message: "Use 3–30 letters, numbers, underscores, or dashes for your username." });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: "Choose a password with at least 8 characters." });
    }
    if (displayName.length < 2 || displayName.length > 80) {
      return res.status(400).json({ message: "Enter your name (2–80 characters)." });
    }
    try {
      if (await storage.getUserByUsername(username)) return res.status(409).json({ message: "Username already taken." });
      await storage.createUser({
        username, password: await bcrypt.hash(password, 10), displayName,
        role: "todo", approvedByTeacher: true, accountApproved: true,
      });
      return res.status(201).json({ success: true });
    } catch (error: any) {
      if (error?.code === "23505" || /duplicate key|unique constraint/i.test(String(error?.message || ""))) {
        return res.status(409).json({ message: "Username already taken." });
      }
      console.error("[arise-todo] registration:", error?.message);
      return res.status(500).json({ message: "Could not create your account. Please try again." });
    }
  });

  app.get("/api/arise-todo/workspace", authMiddleware, async (req: any, res) => {
    if (rejectPreview(req, res)) return;
    try {
      const row = await readWorkspace(Number(req.user.id));
      res.set("Cache-Control", "no-store");
      if (row && typeof req.query?.since === "string" && row.updatedAt === req.query.since) {
        return res.json({ unchanged: true, updatedAt: row.updatedAt });
      }
      return res.json(row || { workspace: null, updatedAt: null });
    } catch (error: any) {
      console.error("[arise-todo] read:", error?.message);
      return res.status(503).json({ message: "Your cloud tasks are temporarily unavailable. Nothing has been replaced." });
    }
  });

  app.put("/api/arise-todo/workspace", authMiddleware, async (req: any, res) => {
    if (rejectPreview(req, res)) return;
    res.set("Cache-Control", "no-store");
    const { workspace, baseUpdatedAt, overwrite } = req.body || {};
    if (!validateWorkspace(workspace)) return res.status(400).json({ message: "This To-Do workspace has invalid task or list data." });
    const bytes = Buffer.byteLength(JSON.stringify(workspace), "utf8");
    if (bytes > MAX_BYTES) return res.status(413).json({ message: "Your To-Do workspace has reached its space limit. Export a backup before removing old items." });
    if (baseUpdatedAt !== null && (typeof baseUpdatedAt !== "string" || !Number.isFinite(Date.parse(baseUpdatedAt)))) {
      return res.status(400).json({ message: "Missing saved version. Refresh your To-Do list first." });
    }
    if (overwrite !== undefined && overwrite !== true && overwrite !== false) return res.status(400).json({ message: "Invalid overwrite option." });
    const userId = Number(req.user.id);
    try {
      const previous = await readWorkspace(userId);
      const conflict = () => res.status(409).json({
        code: HUB_CONFLICT,
        message: "Your to-dos changed on another device. Choose which copy to keep.",
        updatedAt: previous?.updatedAt || null,
      });
      if (previous && !overwrite && previous.updatedAt !== baseUpdatedAt) return conflict();
      if (!previous && baseUpdatedAt !== null) return conflict();

      // The database protects concurrent writes with the same revision timestamp.
      const now = new Date(Math.max(Date.now(), Date.parse(previous?.updatedAt || "") + 1 || 0)).toISOString();
      if (!previous) {
        const { data, error } = await getAdminSupabase().from(TABLE)
          .insert({ user_id: userId, workspace, updated_at: now })
          .select("updated_at").maybeSingle();
        if (error?.code === "23505") return conflict();
        if (error) throw error;
        return res.json({ success: true, updatedAt: String(data?.updated_at || now) });
      }
      let update = getAdminSupabase().from(TABLE).update({ workspace, updated_at: now }).eq("user_id", userId);
      if (!overwrite) update = update.eq("updated_at", previous.updatedAt);
      const { data, error } = await update.select("updated_at").maybeSingle();
      if (error) throw error;
      if (!data) return res.status(409).json({ code: HUB_CONFLICT, message: "Your to-dos changed on another device.", updatedAt: previous.updatedAt });
      return res.json({ success: true, updatedAt: String(data.updated_at) });
    } catch (error: any) {
      console.error("[arise-todo] write:", error?.message);
      return res.status(503).json({ message: "Your tasks could not be saved to your account. They have not been replaced." });
    }
  });
}
