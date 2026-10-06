import type { Express, RequestHandler } from "express";
import { supabase } from "./supabase";

type AuthenticatedRequest = {
  user?: {
    id?: number;
    role?: string;
    isAdmin?: boolean;
  };
};

const MAX_WORKSPACE_BYTES = 800_000;

function teacherAccess(req: AuthenticatedRequest) {
  return !!req.user && (req.user.role === "teacher" || req.user.isAdmin === true);
}

export function registerTeacherHubRoutes(app: Express, authMiddleware: RequestHandler) {
  app.get("/api/teacher-hub/workspace", authMiddleware, async (req: any, res) => {
    if (!teacherAccess(req)) {
      return res.status(403).json({ message: "Teacher access required" });
    }

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
      });
    } catch (error: any) {
      console.error("[teacher-hub] failed to load workspace", error);
      return res.status(500).json({ message: "Could not load your Teacher Hub workspace." });
    }
  });

  app.put("/api/teacher-hub/workspace", authMiddleware, async (req: any, res) => {
    if (!teacherAccess(req)) {
      return res.status(403).json({ message: "Teacher access required" });
    }

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
