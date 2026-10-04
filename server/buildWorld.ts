// Saves each reader's Build Zone world (a compact string, see shared/build/world.ts).
import type { Express, RequestHandler } from "express";
import { storage, clearCache } from "./storage";
import { SAVE_PREFIX, decodeWorld } from "../shared/build/world";

const key = (userId: number) => `build_world_${userId}`;
const MAX = 400_000;

export function registerBuildWorldRoutes(app: Express, auth: RequestHandler) {
  app.get("/api/city/build", auth, async (req: any, res) => {
    try { res.set("Cache-Control", "no-store"); res.json({ world: (await storage.getSetting(key(req.user.id))) || null }); }
    catch { res.status(500).json({ message: "Couldn't load your world." }); }
  });
  app.put("/api/city/build", auth, async (req: any, res) => {
    const world = req.body?.world;
    if (typeof world !== "string" || !world.startsWith(SAVE_PREFIX) || world.length > MAX || !/^[A-Za-z0-9+/=:]+$/.test(world)) return res.status(400).json({ message: "That world couldn't be saved." });
    if (!decodeWorld(world)) return res.status(400).json({ message: "That world couldn't be saved." });
    try {
      await storage.upsertSetting(key(req.user.id), world);
      clearCache("setting_" + key(req.user.id));
      res.json({ ok: true });
    } catch { res.status(500).json({ message: "Couldn't save your world. Try again." }); }
  });
}
