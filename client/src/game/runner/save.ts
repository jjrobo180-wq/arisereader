// Reading Runner — settings and per-world progress, saved on this device for each reader.
import { DEFAULT_ASSISTS, type Assists, type Difficulty, type RunResult } from "@shared/runner/sim";
import type { Steer } from "./input";
import type { CardStyle } from "./textures";
import type { Quality } from "./world";
import { lookByDefault, restoreLook } from "@/lib/gazeDefaults";

export type RunnerSettings = {
  difficulty: Difficulty; steer: Steer; laneDelay: number; assists: Record<Difficulty, Assists>; cardStyle: CardStyle;
  quality: Quality; music: number; sfx: number; voice: boolean; dwellMenus: boolean;
};
export type WorldProgress = { stars: number; best: number; plays: number; clears: number };
export type RunnerProgress = { worlds: Record<number, WorldProgress>; coins: number; last: number };

// Look to steer and look-to-press start on for eye-gaze readers on any device, a tablet included (lib/gazeDefaults.ts).
export const defaultSettings = (): RunnerSettings => ({
  difficulty: "easy", steer: lookByDefault() ? "look" : "touch", laneDelay: 300, assists: structuredClone(DEFAULT_ASSISTS), cardStyle: "both",
  quality: "medium", music: 0.45, sfx: 0.85, voice: true, dwellMenus: lookByDefault(),
});

const key = (uid: number | string | undefined, what: string) => `arise-reading-runner-v2:${what}:${uid ?? "guest"}`;
function read<T>(k: string): Partial<T> | null { try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) as Partial<T> : null; } catch { return null; } }
function write(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage can be unavailable (private mode) */ } }

export function loadSettings(uid?: number | string): RunnerSettings {
  const d = defaultSettings(), s = read<RunnerSettings>(key(uid, "settings"));
  if (!s) return d;
  return restoreLook("runner", uid, { ...d, ...s, assists: { ...d.assists, ...(s.assists || {}) } } as RunnerSettings, { steer: "look", dwellMenus: true });
}
export function saveSettings(uid: number | string | undefined, s: RunnerSettings) { write(key(uid, "settings"), s); }

export function loadProgress(uid?: number | string): RunnerProgress {
  const p = read<RunnerProgress>(key(uid, "progress"));
  return { worlds: {}, coins: 0, last: 0, ...(p || {}) } as RunnerProgress;
}
export function recordRun(uid: number | string | undefined, world: number, r: RunResult) {
  const p = loadProgress(uid);
  const w = p.worlds[world] || { stars: 0, best: 0, plays: 0, clears: 0 };
  const newBest = r.won && r.score > w.best;
  p.worlds[world] = { stars: r.won ? Math.max(w.stars, r.stars) : w.stars, best: r.won ? Math.max(w.best, r.score) : w.best, plays: w.plays + 1, clears: w.clears + (r.won ? 1 : 0) };
  p.coins += r.coins; p.last = world;
  write(key(uid, "progress"), p);
  return { progress: p, newBest, firstClear: r.won && w.clears === 0 };
}
