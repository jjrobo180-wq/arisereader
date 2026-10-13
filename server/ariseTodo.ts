// Arise LifeHub: private cloud workspace for every signed-in account.
// Uses the site's own session tokens, not Supabase Auth identities.
import type { Express, RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { createAttemptLimiter, clientAddress, waitWords } from "./attemptLimiter";
import { storage } from "./storage";
import { getAdminSupabase } from "./supabase";
import { HUB_CONFLICT } from "../shared/hubSave";
import { cleanFamily } from "../shared/familyHub";

const TABLE = "arise_todo_workspaces";
// Room for the Family Hub, including about a year of food and fitness logs.
const MAX_BYTES = 5_000_000;
const signupLimits = createAttemptLimiter({ max: 8, windowMs: 60 * 60_000 });

function validDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T12:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateWorkspace(input: unknown): input is Record<string, any> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const data = input as Record<string, any>;
  // Version 2 adds the Family Hub (chores, calendar, polls, trips, money, notes...).
  if ((data.version !== 1 && data.version !== 2) || !Array.isArray(data.lists) || !Array.isArray(data.tasks)) return false;
  if (data.version === 2 && (!data.family || typeof data.family !== "object" || Array.isArray(data.family))) return false;
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
    res.status(403).json({ message: "Sign in to a regular account to use Arise LifeHub." });
    return true;
  }
  return false;
}

/** What the sign-up needs to confirm an email, handed in from routes.ts so the rules here can be
 *  tested on their own. The 6-digit code machinery is the teacher sign-up's, reused as it is. */
export type TodoSignupDeps = {
  codes: { issue(userId: number): Promise<{ ok: true; code: string } | { ok: false; why: "wait"; waitSeconds: number } | { ok: false; why: "limit" }>;
    check(userId: number, typed: unknown): Promise<"ok" | "wrong" | "expired" | "locked" | "none">;
    waiting(userId: number): Promise<boolean>;
    forget(userId: number): Promise<void> };
  /** Emails the code. False when it could not be sent. */
  sendCode(to: { email: string; displayName: string }, code: string): Promise<boolean>;
  turnOn(userId: number): Promise<void>;
};

/** An email address good enough to send to. Deliberately permissive: any real address should work,
 *  and the code that follows is what actually proves the address is theirs. */
const validEmail = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 160 && /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(value.trim());

export function registerAriseTodoRoutes(app: Express, authMiddleware: RequestHandler, signup: TodoSignupDeps) {
  // Separate signup for adults / workers / individuals: no student or teacher fields.
  // The account is made switched off and a 6-digit code goes to the email; typing it back turns the
  // account on. Without a confirmed address nobody could be told their account exists, reset a
  // password, or be reached about their own data.
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
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!validEmail(email)) {
      return res.status(400).json({ message: "Enter an email address we can send your code to." });
    }
    try {
      if (await storage.getUserByUsername(username)) return res.status(409).json({ message: "Username already taken." });
      const created: any = await storage.createUser({
        username, password: await bcrypt.hash(password, 10), displayName, email,
        role: "todo", approvedByTeacher: true, accountApproved: false,
      });
      const userId = Number(created?.id);
      if (!Number.isFinite(userId)) throw new Error("the new account has no id");
      const issued = await signup.codes.issue(userId);
      if (!issued.ok || !(await signup.sendCode({ email, displayName }, issued.code))) {
        // The account exists but nothing was sent, so turn it on rather than stranding someone
        // behind a code they never received. The address stays on the account, unconfirmed.
        if (issued.ok) await signup.codes.forget(userId).catch(() => {});
        await signup.turnOn(userId).catch(() => {});
        return res.status(201).json({ success: true, confirmEmail: false, message: "Your account is ready. We couldn't email a code just now, so we've let you straight in." });
      }
      return res.status(201).json({ success: true, confirmEmail: true, username, message: `We sent a 6-digit code to ${email}. Enter it to finish.` });
    } catch (error: any) {
      if (error?.code === "23505" || /duplicate key|unique constraint/i.test(String(error?.message || ""))) {
        return res.status(409).json({ message: "Username already taken." });
      }
      console.error("[arise-todo] registration:", error?.message);
      return res.status(500).json({ message: "Could not create your account. Please try again." });
    }
  });

  /** The account waiting on a code, by username. Only an unconfirmed personal account qualifies. */
  const pendingTodo = async (username: unknown) => {
    const name = String(username ?? "").trim().toLowerCase();
    if (!name || name.length > 80) return null;
    const user: any = await storage.getUserByUsername(name);
    return user && user.role === "todo" && !user.archivedAt ? user : null;
  };

  // Typing the code back turns the account on.
  app.post("/api/arise-todo/confirm-email", async (req: any, res) => {
    try {
      const user = await pendingTodo(req.body?.username);
      if (!user) return res.status(400).json({ message: "We couldn't find a sign-up with that username. Please check it and try again." });
      if (user.accountApproved !== false) return res.json({ success: true, alreadyOn: true, message: "Your account is ready. You can log in." });
      const result = await signup.codes.check(Number(user.id), req.body?.code);
      if (result === "wrong") return res.status(400).json({ message: "That code isn't right. Check the email and try again." });
      if (result === "expired") return res.status(400).json({ message: "That code has run out. Ask for a new one." });
      if (result === "locked") return res.status(429).json({ message: "Too many wrong tries. Ask for a new code." });
      if (result === "none") return res.status(400).json({ message: "There is no code waiting for this account. Ask for a new one." });
      await signup.turnOn(Number(user.id));
      return res.json({ success: true, message: "Your email is confirmed and your account is ready." });
    } catch (error: any) {
      console.error("[arise-todo] confirm:", error?.message);
      return res.status(500).json({ message: "Could not confirm that code. Please try again." });
    }
  });

  // Another code, for an email that never arrived.
  app.post("/api/arise-todo/resend-code", async (req: any, res) => {
    try {
      const user = await pendingTodo(req.body?.username);
      if (!user) return res.status(400).json({ message: "We couldn't find a sign-up with that username. Please check it and try again." });
      if (user.accountApproved !== false) return res.json({ success: true, alreadyOn: true, message: "Your account is ready. You can log in." });
      if (!user.email) return res.status(400).json({ message: "This account has no email address on it. Ask the site admin to turn it on." });
      const issued = await signup.codes.issue(Number(user.id));
      if (!issued.ok) {
        if (issued.why === "wait") return res.status(429).json({ message: `Please wait ${issued.waitSeconds} seconds before asking for another code.` });
        return res.status(429).json({ message: "That's the most codes we can send in one day. Please try again tomorrow." });
      }
      if (!(await signup.sendCode({ email: user.email, displayName: user.displayName || user.username }, issued.code))) {
        // nothing went out, so this try doesn't count against the wait or the day's limit
        await signup.codes.forget(Number(user.id)).catch(() => {});
        return res.status(503).json({ message: "We couldn't send the email just now. Please try again in a few minutes." });
      }
      return res.json({ success: true, message: "A new code is on its way." });
    } catch (error: any) {
      console.error("[arise-todo] resend:", error?.message);
      return res.status(500).json({ message: "Could not send a new code. Please try again." });
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
    if (!validateWorkspace(workspace)) return res.status(400).json({ message: "This LifeHub workspace has invalid task or list data." });
    // Family data is stored only in its cleaned, size-limited shape.
    if (workspace.version === 2) workspace.family = cleanFamily(workspace.family);
    const bytes = Buffer.byteLength(JSON.stringify(workspace), "utf8");
    if (bytes > MAX_BYTES) return res.status(413).json({ message: "Your LifeHub workspace has reached its space limit. Export a backup before removing old items." });
    if (baseUpdatedAt !== null && (typeof baseUpdatedAt !== "string" || !Number.isFinite(Date.parse(baseUpdatedAt)))) {
      return res.status(400).json({ message: "Missing saved version. Refresh your LifeHub list first." });
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
