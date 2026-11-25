// Reading challenges made in the admin (Nov 25, 2026): saved in settings ("reader_challenges") and run by the Top
// Reader board (server/topReader.ts) with the same counting and ranking. Until the admin saves a list, the built-in
// Conservatory Green challenge (shared/topReader.ts) is what runs, and the admin's list starts from it.
import type { Express } from "express";
import { storage } from "./storage";
import { CGMS_TOP_READER_NOV_2026, DEFAULT_LOOK, cleanChallenges, topReaderForSchool, topReaderPhase, type TopReaderChallenge } from "../shared/topReader";

export const READER_CHALLENGES_KEY = "reader_challenges";

/** The saved challenges, or null when none have been saved yet. */
export async function readReaderChallenges(): Promise<TopReaderChallenge[] | null> {
  const raw = await storage.getSetting(READER_CHALLENGES_KEY).catch(() => "");
  if (!raw) return null;
  try { return cleanChallenges(JSON.parse(raw)); } catch { return null; }
}

type Deps = {
  auth: (req: any, res: any, next: any) => void;
  admin: (req: any, res: any, next: any) => void;
  read: () => Promise<TopReaderChallenge[] | null>;
  save: (list: TopReaderChallenge[]) => Promise<void>;
  allSchools: () => Promise<Array<{ id: number; name: string }>>;
};

export function registerReaderChallengeAdmin(app: Express, deps: Deps) {
  // The list to edit: the saved one, or the built-in challenge at the schools that run it.
  app.get("/api/admin/reader-challenges", deps.auth, deps.admin, async (_req, res) => {
    try {
      const saved = await deps.read();
      const schools = await deps.allSchools();
      const list = saved ?? [{ ...CGMS_TOP_READER_NOV_2026, schoolIds: schools.filter((s) => topReaderForSchool(s.name)).map((s) => s.id), on: true, look: DEFAULT_LOOK }];
      res.json({ challenges: list.map((c) => ({ ...c, phase: topReaderPhase(c) })), schools: schools.map((s) => ({ id: s.id, name: s.name })), saved: !!saved });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Couldn't load the challenges." });
    }
  });
  app.put("/api/admin/reader-challenges", deps.auth, deps.admin, async (req: any, res) => {
    try {
      const list = cleanChallenges(req.body?.challenges);
      await deps.save(list);
      res.json({ challenges: list.map((c) => ({ ...c, phase: topReaderPhase(c) })) });
    } catch (e: any) {
      res.status(500).json({ message: e?.message || "Couldn't save the challenges." });
    }
  });
}
