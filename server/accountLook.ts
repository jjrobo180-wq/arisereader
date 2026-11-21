// Night mode (light or dark) kept on the account, so every device and both hubs follow the last choice:
// turn on light mode on the computer and the phone shows light mode too. Kept in the settings table as
// "look:<user id>" = {"night": boolean, "at": ISO time}. The newest choice wins (client/src/lib/sharedLook.ts).
import type { Express, RequestHandler } from "express";

type Settings = { getSetting(key: string): Promise<string | null | undefined>; upsertSetting(key: string, value: string): Promise<unknown> };

export function cleanLook(raw: any): { night: boolean; at: string } | null {
  if (!raw || typeof raw.night !== "boolean" || typeof raw.at !== "string" || raw.at.length > 40 || Number.isNaN(Date.parse(raw.at))) return null;
  return { night: raw.night, at: raw.at };
}

export function registerAccountLookRoutes(app: Express, authMiddleware: RequestHandler, settings: Settings) {
  const key = (req: any) => `look:${Number(req.user?.id)}`;
  app.get("/api/account/look", authMiddleware, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    try { return res.json(cleanLook(JSON.parse((await settings.getSetting(key(req))) || "null")) || {}); } catch { return res.json({}); }
  });
  app.put("/api/account/look", authMiddleware, async (req: any, res) => {
    const look = cleanLook(req.body);
    if (!look) return res.status(400).json({ message: "Pick light or dark." });
    try {
      const old = cleanLook(JSON.parse((await settings.getSetting(key(req))) || "null"));
      // An older choice arriving late (a phone that was offline) never overwrites a newer one.
      if (old && Date.parse(old.at) > Date.parse(look.at)) return res.json(old);
      await settings.upsertSetting(key(req), JSON.stringify(look));
      return res.json(look);
    } catch (e: any) {
      console.error("[account-look] save failed:", e?.message);
      return res.status(503).json({ message: "Couldn't save that right now." });
    }
  });
}
