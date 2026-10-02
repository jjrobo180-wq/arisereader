// Aurora Racers — local (browser) copy of a player's progression, used when the server save is unavailable.
import { freshRacingSave, sanitizeSave, upgradesFor, type RacingSave } from "@shared/racing";

export type SaveData = RacingSave;
export const freshSave = freshRacingSave;
export { upgradesFor };

const key = (userId: number | string) => "aurora-racers-save-" + userId;

export function loadSave(userId: number | string): SaveData {
  try {
    const raw = localStorage.getItem(key(userId));
    if (raw) return sanitizeSave(JSON.parse(raw));
  } catch { /* ignore */ }
  return freshSave();
}

export function hasLocalSave(userId: number | string) {
  try { return !!localStorage.getItem(key(userId)); } catch { return false; }
}

export function writeSave(userId: number | string, d: SaveData) {
  try { localStorage.setItem(key(userId), JSON.stringify(d)); } catch { /* storage full or blocked */ }
}
