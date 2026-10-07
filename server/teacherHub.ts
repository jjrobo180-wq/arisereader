// Teacher Hub: a teacher's private workspace, saved to their account.
//
// Teacher Hub is a paid add-on. Only a teacher with a Teacher Hub plan of their
// own or their school's (or the site admin) can open or save it, and the
// caseload can't grow past the students the plan covers.
//
// The whole workspace is one saved copy per teacher. Every save names the copy it
// started from, so a phone or computer that has been sitting open can't quietly
// save over newer work done somewhere else. Before the first change of each day a
// copy is also kept (the last 14 days), so a mistake can be taken back.
import type { Express, RequestHandler } from "express";
import { HUB_REQUIRED, hubMessage, type HubAccess } from "../shared/plans";
import { HUB_CONFLICT, HUB_SEATS_FULL, MAX_WORKSPACE_BYTES, sameInstant } from "../shared/hubSave";

type HubUser = { id?: number; role?: string; isAdmin?: boolean };

export type TeacherHubDeps = {
  /** Does this person have Teacher Hub? */
  hubAccess(user: HubUser): Promise<HubAccess>;
  /** Where workspaces are kept. Tests give their own. */
  store?: WorkspaceStore;
};

/** A saved workspace and the moment it was saved. */
export type WorkspaceRow = { workspace: Record<string, any>; updatedAt: string };

export type BackupKind = "daily" | "restore";
export type BackupInfo = { day: string; kind: BackupKind; students: number; savedAt: string };

export type WorkspaceStore = {
  get(teacherId: number): Promise<WorkspaceRow | null>;
  /**
   * Saves the workspace only if the saved copy is still the one that was read
   * (`expected`; null means there was none). Returns the new save time, or null
   * when somebody else saved in between.
   */
  save(teacherId: number, workspace: Record<string, any>, expected: string | null): Promise<string | null>;
  /** Keeps a copy for taking a mistake back. A store without the table does nothing. */
  backup(teacherId: number, kind: BackupKind, day: string, workspace: Record<string, any>, students: number): Promise<void>;
  /** The copies kept, newest first. null when backups are not set up. */
  backups(teacherId: number): Promise<BackupInfo[] | null>;
  getBackup(teacherId: number, day: string, kind: BackupKind): Promise<Record<string, any> | null>;
};

const TABLE = "teacher_hub_workspaces";
const BACKUPS = "teacher_hub_backups";
const KEEP_DAYS = 14;

const loadDb = async () => (await import("./supabase")).supabase;

/** A table or column the database does not have yet. */
export function isMissingSetup(error: any): boolean {
  const code = String(error?.code || "");
  return code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205";
}

export function createSupabaseWorkspaceStore(client?: any): WorkspaceStore {
  const db = async () => client ?? (await loadDb());
  return {
    async get(teacherId) {
      const { data, error } = await (await db()).from(TABLE).select("workspace, updated_at").eq("teacher_id", Number(teacherId)).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { workspace: data.workspace && typeof data.workspace === "object" ? data.workspace : {}, updatedAt: String(data.updated_at || "") };
    },

    async save(teacherId, workspace, expected) {
      let now = new Date().toISOString();
      // The new time has to differ from the old one, or the next save could not tell them apart.
      if (expected && Date.parse(now) <= Date.parse(expected)) now = new Date(Date.parse(expected) + 1).toISOString();
      const client = await db();
      if (expected === null) {
        const { data, error } = await client.from(TABLE).insert({ teacher_id: Number(teacherId), workspace, updated_at: now }).select("updated_at").maybeSingle();
        // Somebody else made the first copy a moment ago.
        if (error?.code === "23505") return null;
        if (error) throw error;
        return String(data?.updated_at || now);
      }
      const { data, error } = await client.from(TABLE).update({ workspace, updated_at: now }).eq("teacher_id", Number(teacherId)).eq("updated_at", expected).select("updated_at");
      if (error) throw error;
      if (!data || !data.length) return null;
      return String(data[0]?.updated_at || now);
    },

    async backup(teacherId, kind, day, workspace, students) {
      const client = await db();
      const { error } = await client
        .from(BACKUPS)
        .upsert({ teacher_id: Number(teacherId), day, kind, workspace, students, saved_at: new Date().toISOString() }, { onConflict: "teacher_id,day,kind", ignoreDuplicates: kind === "daily" });
      if (error) {
        if (isMissingSetup(error)) return;
        throw error;
      }
      if (kind === "daily") {
        const cutoff = new Date(Date.parse(`${day}T00:00:00Z`) - KEEP_DAYS * 86_400_000).toISOString().slice(0, 10);
        await client.from(BACKUPS).delete().eq("teacher_id", Number(teacherId)).lt("day", cutoff);
      }
    },

    async backups(teacherId) {
      const { data, error } = await (await db()).from(BACKUPS).select("day, kind, students, saved_at").eq("teacher_id", Number(teacherId)).order("day", { ascending: false }).limit(40);
      if (error) {
        if (isMissingSetup(error)) return null;
        throw error;
      }
      return (data || []).map((row: any) => ({ day: String(row.day), kind: row.kind === "restore" ? "restore" : "daily", students: Number(row.students) || 0, savedAt: String(row.saved_at || "") }));
    },

    async getBackup(teacherId, day, kind) {
      const { data, error } = await (await db()).from(BACKUPS).select("workspace").eq("teacher_id", Number(teacherId)).eq("day", day).eq("kind", kind).maybeSingle();
      if (error) {
        if (isMissingSetup(error)) return null;
        throw error;
      }
      return data?.workspace && typeof data.workspace === "object" ? data.workspace : null;
    },
  };
}

function teacherAccess(req: any) {
  // An admin previewing the site as someone else is not that teacher.
  return !!req.user && !req.adminPreview && (req.user.role === "teacher" || req.user.isAdmin === true);
}

/** How many students are in a saved workspace's caseload. */
export function hubStudentCount(workspace: unknown): number {
  const students = (workspace as any)?.students;
  return Array.isArray(students) ? students.length : 0;
}

/** Students in a teacher's saved Teacher Hub caseload. */
export async function countHubStudents(teacherId: number, store: WorkspaceStore = createSupabaseWorkspaceStore()): Promise<number> {
  const row = await store.get(teacherId);
  return hubStudentCount(row?.workspace);
}

/**
 * The check every Teacher Hub request starts with. It answers the request itself
 * (and returns null) when this person can't use Teacher Hub.
 */
export function createHubGate(deps: TeacherHubDeps) {
  return async (req: any, res: any): Promise<HubAccess | null> => {
    if (!teacherAccess(req)) {
      res.status(403).json({ message: "Teacher access required" });
      return null;
    }
    let hub: HubAccess;
    try {
      hub = await deps.hubAccess(req.user);
    } catch (error: any) {
      console.error("[teacher-hub] plan check failed", error?.message);
      res.status(500).json({ message: "Could not check your Teacher Hub plan. Try again in a moment." });
      return null;
    }
    if (!hub.access) {
      res.status(402).json({ message: hubMessage, code: HUB_REQUIRED });
      return null;
    }
    return hub;
  };
}

const today = () => new Date().toISOString().slice(0, 10);

function seatsMessage(seats: number) {
  return `Your Teacher Hub plan covers ${seats.toLocaleString("en-US")} students. Add more on your plan page to grow your caseload.`;
}

export function registerTeacherHubRoutes(app: Express, authMiddleware: RequestHandler, deps: TeacherHubDeps) {
  const access = createHubGate(deps);
  const store = deps.store ?? createSupabaseWorkspaceStore();
  // The day a teacher's copy was last kept, so a busy day costs one write, not one per save.
  const backedUp = new Map<number, string>();

  app.get("/api/teacher-hub/workspace", authMiddleware, async (req: any, res) => {
    const hub = await access(req, res);
    if (!hub) return;

    try {
      const row = await store.get(Number(req.user.id));
      res.set("Cache-Control", "no-store");
      // A page that was left open asks "has anything changed?" without downloading it all again.
      if (row && typeof req.query?.since === "string" && sameInstant(req.query.since, row.updatedAt)) {
        return res.json({ unchanged: true, updatedAt: row.updatedAt, seats: hub.seats });
      }
      return res.json({ workspace: row?.workspace ?? {}, updatedAt: row?.updatedAt || null, seats: hub.seats });
    } catch (error: any) {
      console.error("[teacher-hub] failed to load workspace", error);
      return res.status(500).json({ message: "Could not load your Teacher Hub workspace." });
    }
  });

  app.put("/api/teacher-hub/workspace", authMiddleware, async (req: any, res) => {
    const hub = await access(req, res);
    if (!hub) return;

    const workspace = req.body?.workspace;
    if (!workspace || typeof workspace !== "object" || Array.isArray(workspace)) {
      return res.status(400).json({ message: "Workspace must be an object." });
    }

    let serialized = "";
    try {
      serialized = JSON.stringify(workspace);
    } catch {
      return res.status(400).json({ message: "Workspace contains invalid data." });
    }

    if (Buffer.byteLength(serialized, "utf8") > MAX_WORKSPACE_BYTES) {
      return res.status(413).json({ message: "This Teacher Hub workspace is too large to save.", code: "hub_too_large" });
    }

    // Which saved copy this one started from. Left out by a page opened before this check existed.
    const base: unknown = req.body?.baseUpdatedAt;
    const overwrite = req.body?.overwrite === true;
    const teacherId = Number(req.user.id);

    try {
      const current = await store.get(teacherId);

      if (current && base !== undefined && !overwrite && !(typeof base === "string" && sameInstant(base, current.updatedAt))) {
        return res.status(409).json({ message: "Your Hub was changed on another phone or computer.", code: HUB_CONFLICT, updatedAt: current.updatedAt });
      }

      // The caseload can't grow past the plan. A caseload that is already over
      // (after a plan was made smaller) can still be saved, as long as it doesn't grow.
      const count = hubStudentCount(workspace);
      if (hub.seats !== null && count > hub.seats && count > hubStudentCount(current?.workspace)) {
        return res.status(409).json({ message: seatsMessage(hub.seats), code: HUB_SEATS_FULL, seats: hub.seats });
      }

      // Before the first change of the day, keep the copy as it stands now.
      const day = today();
      if (current && backedUp.get(teacherId) !== day) {
        try {
          await store.backup(teacherId, "daily", day, current.workspace, hubStudentCount(current.workspace));
          backedUp.set(teacherId, day);
        } catch (error: any) {
          // A copy that could not be kept never stops the save.
          console.warn("[teacher-hub] could not keep a daily copy:", error?.message);
        }
      }

      const savedAt = await store.save(teacherId, workspace, current ? current.updatedAt : null);
      if (savedAt === null) {
        const now = await store.get(teacherId);
        return res.status(409).json({ message: "Your Hub was changed on another phone or computer.", code: HUB_CONFLICT, updatedAt: now?.updatedAt ?? null });
      }

      return res.json({ success: true, updatedAt: savedAt });
    } catch (error: any) {
      console.error("[teacher-hub] failed to save workspace", error);
      return res.status(500).json({ message: "Could not save your Teacher Hub workspace." });
    }
  });

  // The copies kept for taking a mistake back.
  app.get("/api/teacher-hub/backups", authMiddleware, async (req: any, res) => {
    const hub = await access(req, res);
    if (!hub) return;
    try {
      const list = await store.backups(Number(req.user.id));
      res.set("Cache-Control", "no-store");
      return res.json({ available: list !== null, backups: list ?? [] });
    } catch (error: any) {
      console.error("[teacher-hub] failed to list copies", error);
      return res.status(500).json({ message: "Could not look up your saved copies." });
    }
  });

  app.post("/api/teacher-hub/backups/restore", authMiddleware, async (req: any, res) => {
    const hub = await access(req, res);
    if (!hub) return;
    const day = String(req.body?.day || "");
    const kind: BackupKind = req.body?.kind === "restore" ? "restore" : "daily";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ message: "Choose which copy to bring back." });
    const teacherId = Number(req.user.id);
    try {
      const copy = await store.getBackup(teacherId, day, kind);
      if (!copy) return res.status(404).json({ message: "That copy is no longer there." });
      const current = await store.get(teacherId);
      const count = hubStudentCount(copy);
      if (hub.seats !== null && count > hub.seats && count > hubStudentCount(current?.workspace)) {
        return res.status(409).json({ message: seatsMessage(hub.seats), code: HUB_SEATS_FULL, seats: hub.seats });
      }
      // What is there now is kept too, so bringing a copy back can be taken back as well.
      if (current) await store.backup(teacherId, "restore", today(), current.workspace, hubStudentCount(current.workspace));
      const savedAt = await store.save(teacherId, copy, current ? current.updatedAt : null);
      if (savedAt === null) return res.status(409).json({ message: "Your Hub was changed on another phone or computer. Try again.", code: HUB_CONFLICT });
      return res.json({ success: true, updatedAt: savedAt, workspace: copy });
    } catch (error: any) {
      console.error("[teacher-hub] failed to bring back a copy", error);
      return res.status(500).json({ message: "Could not bring that copy back." });
    }
  });
}
