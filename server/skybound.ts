// Skybound Sprint — saves progress per student and pays one-time Reader Coin rewards.
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";
import { LEVEL_IDS, levelById } from "../shared/skybound/levels";
import { totalGems } from "../shared/skybound/sim";
import { applyClear, isUnlocked, MIN_CLEAR_SECONDS, sanitizeSave, type SkySave } from "../shared/skybound/progress";

const saveKey = (userId: number) => "skybound_save_" + userId;
const isStudent = (u: any) => !!u && !u.isAdmin && u.role === "student" && !u.is_eye_gaze_user;

async function readSave(userId: number): Promise<SkySave> {
  const raw = await storage.getSetting(saveKey(userId));
  if (!raw) return sanitizeSave(null);
  try { return sanitizeSave(JSON.parse(raw)); } catch { return sanitizeSave(null); }
}

export function registerSkyboundRoutes(app: Express, auth: RequestHandler) {
  const locks = new Set<number>();
  const lastClear = new Map<number, number>();

  app.get("/api/skybound/progress", auth, async (req: any, res) => {
    try {
      if (!isStudent(req.user)) return res.status(403).json({ message: "Skybound Sprint is for student accounts." });
      res.set("Cache-Control", "no-store");
      res.json({ save: await readSave(req.user.id) });
    } catch (e: any) {
      console.error("[skybound] progress", e?.message);
      res.status(500).json({ message: "Could not load your Skybound progress." });
    }
  });

  app.post("/api/skybound/clear", auth, async (req: any, res) => {
    if (!isStudent(req.user)) return res.status(403).json({ message: "Skybound Sprint is for student accounts." });
    const uid = Number(req.user.id);
    if (locks.has(uid)) return res.status(429).json({ message: "Saving your last run — one moment." });
    locks.add(uid);
    try {
      const levelId = String(req.body?.levelId || "");
      const index = (LEVEL_IDS as readonly string[]).indexOf(levelId);
      const level = levelById(levelId);
      if (index < 0 || !level) return res.status(400).json({ message: "Unknown level." });
      const time = Number(req.body?.time), gems = Math.floor(Number(req.body?.gems)), shards = Math.floor(Number(req.body?.shards));
      if (!Number.isFinite(time) || time < MIN_CLEAR_SECONDS || time > 3600) return res.status(400).json({ message: "That run time doesn't look right." });
      const maxGems = totalGems(level) + (level.boss ? 16 : 0);
      if (!Number.isFinite(gems) || gems < 0 || gems > maxGems) return res.status(400).json({ message: "That gem count doesn't look right." });
      if (!Number.isFinite(shards) || shards < 0 || shards > 7) return res.status(400).json({ message: "That star shard count doesn't look right." });
      const now = Date.now();
      if (now - (lastClear.get(uid) || 0) < (MIN_CLEAR_SECONDS - 2) * 1000) return res.status(429).json({ message: "Slow down, sky runner!" });
      const save = await readSave(uid);
      if (!isUnlocked(save, index)) return res.status(400).json({ message: "Finish the level before this one first." });
      const out = applyClear(save, { levelId, time, gems, shards });
      await storage.upsertSetting(saveKey(uid), JSON.stringify(out.save));
      if (out.coins > 0) {
        const bonusKey = "avatar_world_bonus_" + uid;
        const bonus = Math.max(0, Number(await storage.getSetting(bonusKey)) || 0);
        await storage.upsertSetting(bonusKey, String(bonus + out.coins));
      }
      lastClear.set(uid, now);
      res.json(out);
    } catch (e: any) {
      console.error("[skybound] clear", e?.message);
      res.status(500).json({ message: "Could not save your run." });
    } finally { locks.delete(uid); }
  });
}
