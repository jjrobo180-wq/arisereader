// GET /api/version: which commit the live site is running and when this server started, so a push can be
// checked against what's deployed (Render sets RENDER_GIT_COMMIT; elsewhere the checkout's own git is asked).
// Public and never cached. Nothing private: a commit id and a start time.
import { execSync } from "node:child_process";
import type { Express } from "express";

const startedAt = new Date().toISOString();
let commit = process.env.RENDER_GIT_COMMIT || process.env.SOURCE_VERSION || process.env.GIT_COMMIT || "";
if (!commit) { try { commit = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"], timeout: 2000 }).toString().trim(); } catch { commit = ""; } }

export function versionInfo() {
  return { commit: commit || "unknown", short: commit ? commit.slice(0, 8) : "unknown", branch: process.env.RENDER_GIT_BRANCH || "", startedAt, service: process.env.RENDER_SERVICE_NAME || "" };
}

export function registerVersionRoute(app: Express) {
  app.get("/api/version", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json(versionInfo());
  });
}
