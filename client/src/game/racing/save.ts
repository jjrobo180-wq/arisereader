// Aurora Racers — player progression saved in the browser (per account).
import { BODIES, type UpgradeId } from "./kart";

export interface SaveData {
  coins: number;
  owned: string[];
  body: string;
  paint: number;
  helmet: number;
  driver: number;
  upgrades: Record<string, Record<UpgradeId, number>>;
  bestRace: Record<string, number>; // ms
  bestLap: Record<string, number>; // ms
  cups: Record<string, number>; // best GP finish (1 = gold)
  wins: number;
  races: number;
}

export const freshSave = (): SaveData => ({
  coins: 150, owned: ["comet"], body: "comet", paint: 0xef4444, helmet: 0x3b82f6, driver: 1,
  upgrades: {}, bestRace: {}, bestLap: {}, cups: {}, wins: 0, races: 0,
});

const key = (userId: number | string) => "aurora-racers-save-" + userId;

export function loadSave(userId: number | string): SaveData {
  try {
    const raw = localStorage.getItem(key(userId));
    if (raw) {
      const d = { ...freshSave(), ...JSON.parse(raw) } as SaveData;
      if (!Array.isArray(d.owned) || !d.owned.length) d.owned = ["comet"];
      if (!BODIES.some((b) => b.id === d.body) || !d.owned.includes(d.body)) d.body = "comet";
      return d;
    }
  } catch { /* ignore */ }
  return freshSave();
}

export function writeSave(userId: number | string, d: SaveData) {
  try { localStorage.setItem(key(userId), JSON.stringify(d)); } catch { /* storage full or blocked */ }
}

export function upgradesFor(d: SaveData, body: string): Record<UpgradeId, number> {
  const u: Partial<Record<UpgradeId, number>> = d.upgrades[body] || {};
  return { engine: u.engine ?? 0, turbo: u.turbo ?? 0, tires: u.tires ?? 0 };
}
