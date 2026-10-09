// Apple Health → Family Hub food diary.
// Websites can't read Apple Health, so an iPhone Shortcut posts the day's numbers here with a private key.
// The key is shown once; only its SHA-256 hash is stored (arise_health_links). Synced days are kept in
// arise_health_sync and pulled into the diary by the page.
import type { Express, RequestHandler } from "express";
import { createHash, randomBytes } from "crypto";
import { getAdminSupabase } from "./supabase";
import { createAttemptLimiter, waitWords } from "./attemptLimiter";
import { cleanSyncBody } from "../shared/appleHealth";

const LINKS = "arise_health_links";
const SYNC = "arise_health_sync";
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const syncLimits = createAttemptLimiter({ max: 60, windowMs: 60 * 60_000 });
const validMember = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 100;
const realUser = (req: any) => Number.isSafeInteger(Number(req.user?.id)) && !req.adminPreview;

export function registerAppleHealthRoutes(app: Express, authMiddleware: RequestHandler) {
  // Make (or replace) the private key for one person's diary.
  app.post("/api/arise-todo/apple-health/link", authMiddleware, async (req: any, res) => {
    if (!realUser(req)) return res.status(403).json({ message: "Sign in to your own account to connect Apple Health." });
    const memberId = req.body?.memberId;
    if (!validMember(memberId)) return res.status(400).json({ message: "Choose whose diary to connect." });
    const token = randomBytes(24).toString("base64url");
    const db = getAdminSupabase();
    const userId = Number(req.user.id);
    const del = await db.from(LINKS).delete().eq("user_id", userId).eq("member_id", memberId);
    if (del.error) { console.error("[apple-health] link:", del.error.message); return res.status(503).json({ message: "Couldn't make a key right now. Try again." }); }
    const { error } = await db.from(LINKS).insert({ token_hash: hash(token), user_id: userId, member_id: memberId });
    if (error) { console.error("[apple-health] link:", error.message); return res.status(503).json({ message: "Couldn't make a key right now. Try again." }); }
    res.set("Cache-Control", "no-store");
    return res.json({ token });
  });

  app.delete("/api/arise-todo/apple-health/link", authMiddleware, async (req: any, res) => {
    if (!realUser(req)) return res.status(403).json({ message: "Not allowed." });
    const memberId = req.query?.memberId;
    if (!validMember(memberId)) return res.status(400).json({ message: "Choose whose diary to disconnect." });
    const { error } = await getAdminSupabase().from(LINKS).delete().eq("user_id", Number(req.user.id)).eq("member_id", memberId);
    if (error) { console.error("[apple-health] unlink:", error.message); return res.status(503).json({ message: "Couldn't disconnect right now. Try again." }); }
    return res.json({ success: true });
  });

  // What is connected, and the synced days of the last 60 days.
  app.get("/api/arise-todo/apple-health/status", authMiddleware, async (req: any, res) => {
    if (!realUser(req)) return res.json({ links: [], days: [] });
    const userId = Number(req.user.id);
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
    const db = getAdminSupabase();
    const [links, days] = await Promise.all([
      db.from(LINKS).select("member_id, created_at, last_sync_at").eq("user_id", userId),
      db.from(SYNC).select("member_id, day, steps, active_calories, weight_lb").eq("user_id", userId).gte("day", since).order("day"),
    ]);
    if (links.error || days.error) { console.error("[apple-health] status:", links.error?.message || days.error?.message); return res.status(503).json({ message: "Apple Health status is unavailable right now." }); }
    res.set("Cache-Control", "no-store");
    return res.json({
      links: (links.data || []).map((l: any) => ({ memberId: l.member_id, createdAt: l.created_at, lastSyncAt: l.last_sync_at })),
      days: (days.data || []).map((d: any) => ({ memberId: d.member_id, date: String(d.day).slice(0, 10), steps: d.steps, activeCalories: d.active_calories, weight: d.weight_lb === null ? null : Number(d.weight_lb) })),
    });
  });

  // Called by the iPhone Shortcut. Uses the private key, not a sign-in.
  app.post("/api/arise-todo/apple-health/sync", async (req: any, res) => {
    const header = String(req.headers.authorization || "");
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : typeof req.body?.key === "string" ? req.body.key.trim() : "";
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return res.status(401).json({ message: "Missing or invalid key. Make a new key in Food & fitness → Apple Health." });
    const key = hash(token);
    const wait = syncLimits.retryAfter(key);
    if (wait > 0) return res.status(429).json({ message: `Too many syncs. Try again in ${waitWords(wait)}.` });
    syncLimits.fail(key);
    const db = getAdminSupabase();
    const link = await db.from(LINKS).select("user_id, member_id").eq("token_hash", key).maybeSingle();
    if (link.error) { console.error("[apple-health] sync:", link.error.message); return res.status(503).json({ message: "Couldn't sync right now. Try again later." }); }
    if (!link.data) return res.status(401).json({ message: "This key isn't connected anymore. Make a new key in Food & fitness → Apple Health." });
    const fallback = new Date().toLocaleDateString("en-CA", { timeZone: "America/Denver" });
    const day = cleanSyncBody(req.body, fallback);
    if (!day) return res.status(400).json({ message: "Nothing to sync. Send steps, activeCalories or weight." });
    const row: Record<string, unknown> = { user_id: link.data.user_id, member_id: link.data.member_id, day: day.date, updated_at: new Date().toISOString() };
    if (day.steps !== null) row.steps = day.steps;
    if (day.activeCalories !== null) row.active_calories = day.activeCalories;
    if (day.weight !== null) row.weight_lb = day.weight;
    const up = await db.from(SYNC).upsert(row, { onConflict: "user_id,member_id,day" });
    if (up.error) { console.error("[apple-health] sync:", up.error.message); return res.status(503).json({ message: "Couldn't sync right now. Try again later." }); }
    await db.from(LINKS).update({ last_sync_at: new Date().toISOString() }).eq("token_hash", key);
    const parts = [day.steps !== null && `${day.steps.toLocaleString()} steps`, day.activeCalories !== null && `${day.activeCalories} active calories`, day.weight !== null && `${day.weight} lb`].filter(Boolean);
    return res.json({ success: true, message: `Synced ${parts.join(", ")} for ${day.date}.` });
  });
}
