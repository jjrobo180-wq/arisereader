// Skybound Sprint — save data and reward rules shared by the browser and the server.
import { LEVEL_IDS } from "./levels";

export type LevelProgress = { done: boolean; best: number | null; gems: number; shards: number; plays: number };
export type SkySave = { v: 1; levels: Record<string, LevelProgress>; coins: number };

/** Reader Coins: one-time rewards so they can't be farmed. */
export const SKY_REWARDS = { firstClear: 25, bossClear: 75, shard: 10 };
/** Fastest believable clear for any level (seconds). The real fastest runs are 20s+. */
export const MIN_CLEAR_SECONDS = 12;

export function emptySave(): SkySave { return { v: 1, levels: {}, coins: 0 }; }

export function sanitizeSave(raw: any): SkySave {
  const s = emptySave();
  if (!raw || typeof raw !== "object") return s;
  s.coins = Math.max(0, Math.min(100000, Math.floor(Number(raw.coins) || 0)));
  const lv = raw.levels && typeof raw.levels === "object" ? raw.levels : {};
  for (const id of LEVEL_IDS) {
    const l = lv[id]; if (!l || typeof l !== "object") continue;
    const best = Number(l.best);
    s.levels[id] = {
      done: !!l.done,
      best: Number.isFinite(best) && best > 0 ? Math.round(best * 100) / 100 : null,
      gems: Math.max(0, Math.min(999, Math.floor(Number(l.gems) || 0))),
      shards: Math.max(0, Math.min(7, Math.floor(Number(l.shards) || 0))),
      plays: Math.max(0, Math.min(1e6, Math.floor(Number(l.plays) || 0))),
    };
  }
  return s;
}

export function isUnlocked(save: SkySave, index: number) {
  if (index <= 0) return true;
  return !!save.levels[LEVEL_IDS[index - 1]]?.done;
}
export const countBits = (n: number) => (n & 1) + ((n >> 1) & 1) + ((n >> 2) & 1);
export function totalShards(save: SkySave) { let n = 0; for (const id of LEVEL_IDS) n += countBits(save.levels[id]?.shards || 0); return n; }

export type ClearReport = { levelId: string; time: number; gems: number; shards: number };

/** Merge a finished run into the save. Returns the new save plus the coins earned (first clear + new shards). */
export function applyClear(save: SkySave, r: ClearReport) {
  const next = sanitizeSave(JSON.parse(JSON.stringify(save)));
  const prev = next.levels[r.levelId] || { done: false, best: null, gems: 0, shards: 0, plays: 0 };
  let coins = 0;
  const firstClear = !prev.done;
  if (firstClear) coins += r.levelId === "storm" ? SKY_REWARDS.bossClear : SKY_REWARDS.firstClear;
  const newShards = (r.shards & 7) & ~prev.shards;
  coins += countBits(newShards) * SKY_REWARDS.shard;
  next.levels[r.levelId] = {
    done: true,
    best: prev.best === null ? r.time : Math.min(prev.best, r.time),
    gems: Math.max(prev.gems, r.gems),
    shards: prev.shards | (r.shards & 7),
    plays: prev.plays + 1,
  };
  next.coins += coins;
  return { save: next, coins, firstClear, newShards: countBits(newShards), newBest: prev.best === null || r.time < prev.best };
}
