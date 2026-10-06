// Teacher Hub: a teacher's private workspace, saved to their account.
//
// Teacher Hub is a paid add-on. Only a teacher with a Teacher Hub plan of their
// own or their school's (or the site admin) can open or save it, and the
// caseload can't grow past the students the plan covers.
import type { Express, RequestHandler } from "express";
import { supabase } from "./supabase";
import { HUB_REQUIRED, hubMessage, type HubAccess } from "../shared/plans";

type HubUser = { id?: number; role?: string; isAdmin?: boolean };

export type TeacherHubDeps = {
  /** Does this person have Teacher Hub? */
  hubAccess(user: HubUser): Promise<HubAccess>;
};

const MAX_WORKSPACE_BYTES = 800_000;

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
export async function countHubStudents(teacherId: number): Promise<number> {
  const { data, error } = await supabase
    .from("teacher_hub_workspaces")
    .select("workspace")
    .eq("teacher_id", Number(teacherId))
    .maybeSingle();
  if (error) throw error;
  return hubStudentCount(data?.workspace);
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

export function registerTeacherHubRoutes(app: Express, authMiddleware: RequestHandler, deps: TeacherHubDeps) {
  const access = createHubGate(deps);

  app.get("/api/teacher-hub/workspace", authMiddleware, async (req: any, res) => {
    const hub = await access(req, res);
    if (!hub) return;

    try {
      const { data, error } = await supabase
        .from("teacher_hub_workspaces")
        .select("workspace, updated_at")
        .eq("teacher_id", Number(req.user.id))
        .maybeSingle();

      if (error) throw error;

      res.set("Cache-Control", "no-store");
      return res.json({
        workspace: data?.workspace && typeof data.workspace === "object" ? data.workspace : {},
        updatedAt: data?.updated_at || null,
        seats: hub.seats,
      });
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
      return res.status(413).json({ message: "This Teacher Hub workspace is too large to save." });
    }

    try {
      // The caseload can't grow past the plan. A caseload that is already over
      // (after a plan was made smaller) can still be saved, as long as it doesn't grow.
      const count = hubStudentCount(workspace);
      if (hub.seats !== null && count > hub.seats && count > (await countHubStudents(Number(req.user.id)))) {
        return res.status(409).json({
          message: `Your Teacher Hub plan covers ${hub.seats.toLocaleString("en-US")} students. Add more on your plan page to grow your caseload.`,
          code: "hub_seats_full",
          seats: hub.seats,
        });
      }

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("teacher_hub_workspaces")
        .upsert(
          {
            teacher_id: Number(req.user.id),
            workspace,
            updated_at: now,
          },
          { onConflict: "teacher_id" },
        )
        .select("updated_at")
        .single();

      if (error) throw error;

      return res.json({ success: true, updatedAt: data?.updated_at || now });
    } catch (error: any) {
      console.error("[teacher-hub] failed to save workspace", error);
      return res.status(500).json({ message: "Could not save your Teacher Hub workspace." });
    }
  });
}
