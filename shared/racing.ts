// Aurora Racers — data shared by the browser game and the server (progression rules + online protocol).

export interface Stats { speed: number; accel: number; handling: number; weight: number }
export interface BodyDef { id: string; name: string; blurb: string; base: Stats; price: number }

export const BODIES: BodyDef[] = [
  { id: "comet", name: "Comet", blurb: "Balanced all-rounder", base: { speed: 5, accel: 5, handling: 5, weight: 5 }, price: 0 },
  { id: "swirl", name: "Swirl", blurb: "Drift master, quick off the line", base: { speed: 4, accel: 7, handling: 8, weight: 3 }, price: 250 },
  { id: "bolt", name: "Bolt", blurb: "Huge top speed, harder to turn", base: { speed: 8, accel: 3, handling: 4, weight: 6 }, price: 400 },
  { id: "rhino", name: "Rhino", blurb: "Heavy bumper — shoves others aside", base: { speed: 6, accel: 4, handling: 4, weight: 9 }, price: 500 },
];

export type UpgradeId = "engine" | "turbo" | "tires";
export const UPGRADE_IDS: UpgradeId[] = ["engine", "turbo", "tires"];
export const UPGRADES: { id: UpgradeId; name: string; blurb: string }[] = [
  { id: "engine", name: "Engine", blurb: "+ top speed" },
  { id: "turbo", name: "Turbo", blurb: "+ acceleration & longer boosts" },
  { id: "tires", name: "Tires", blurb: "+ handling & grip" },
];
export const UPGRADE_COST = [120, 220, 360, 540, 780];
export const MAX_UPGRADE = 5;
export const PAINTS = [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x06b6d4, 0x3b82f6, 0x8b5cf6, 0xec4899, 0xf8fafc, 0x111827];
export const PLACE_COINS = [100, 80, 65, 50, 40, 30, 20, 10];
export const TRACK_IDS = ["shores", "books", "neon", "frost"];
export const CC_MUL: Record<number, number> = { 50: 0.84, 100: 1.0, 150: 1.16 };
export const MAX_COINS_PICKED = 40; // coins on track a racer can plausibly collect in one race

export interface RacingSave {
  coins: number;
  owned: string[];
  body: string;
  paint: number;
  helmet: number;
  driver: number;
  upgrades: Record<string, Record<UpgradeId, number>>;
  bestRace: Record<string, number>; // ms
  bestLap: Record<string, number>; // ms
  cups: Record<string, number>; // best Grand Prix finish (1 = gold)
  wins: number;
  races: number;
}

export const freshRacingSave = (): RacingSave => ({
  coins: 150, owned: ["comet"], body: "comet", paint: 0xef4444, helmet: 0x3b82f6, driver: 1,
  upgrades: {}, bestRace: {}, bestLap: {}, cups: {}, wins: 0, races: 0,
});

const int = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);

/** Clean up any save object (from storage or the network) so it only holds valid values. */
export function sanitizeSave(raw: unknown, maxCoins = 1_000_000): RacingSave {
  const d = freshRacingSave();
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  d.coins = int(r.coins, 0, maxCoins, d.coins);
  const owned = Array.isArray(r.owned) ? r.owned.filter((x): x is string => typeof x === "string" && BODIES.some((b) => b.id === x)) : [];
  d.owned = Array.from(new Set(["comet", ...owned]));
  d.body = typeof r.body === "string" && d.owned.includes(r.body) ? r.body : "comet";
  d.paint = PAINTS.includes(r.paint as number) ? (r.paint as number) : d.paint;
  d.helmet = PAINTS.includes(r.helmet as number) ? (r.helmet as number) : d.helmet;
  d.driver = int(r.driver, 0, 4, d.driver);
  const ups = (r.upgrades && typeof r.upgrades === "object" ? r.upgrades : {}) as Record<string, Record<string, unknown>>;
  for (const b of d.owned) {
    const u = ups[b];
    if (!u || typeof u !== "object") continue;
    d.upgrades[b] = { engine: int(u.engine, 0, MAX_UPGRADE, 0), turbo: int(u.turbo, 0, MAX_UPGRADE, 0), tires: int(u.tires, 0, MAX_UPGRADE, 0) };
  }
  for (const key of ["bestRace", "bestLap"] as const) {
    const src = (r[key] && typeof r[key] === "object" ? r[key] : {}) as Record<string, unknown>;
    for (const t of TRACK_IDS) { const v = int(src[t], 0, 3_600_000, 0); if (v > 5000) d[key][t] = v; }
  }
  const cups = (r.cups && typeof r.cups === "object" ? r.cups : {}) as Record<string, unknown>;
  for (const k of Object.keys(cups)) if (/^aurora-(50|100|150)$/.test(k)) d.cups[k] = int(cups[k], 1, 8, 8);
  d.wins = int(r.wins, 0, 1_000_000, 0);
  d.races = int(r.races, 0, 1_000_000, 0);
  return d;
}

export function upgradesFor(d: RacingSave, body: string): Record<UpgradeId, number> {
  const u: Partial<Record<UpgradeId, number>> = d.upgrades[body] || {};
  return { engine: u.engine ?? 0, turbo: u.turbo ?? 0, tires: u.tires ?? 0 };
}

/** Coins awarded for a race result (shared so the server can recompute it). */
export function raceReward(mode: "race" | "gp" | "tt" | "online", place: number, coinsPicked: number, cc: number) {
  const picked = Math.max(0, Math.min(MAX_COINS_PICKED, Math.round(coinsPicked)));
  if (mode === "tt") return picked;
  const mul = CC_MUL[cc] ?? 1;
  const p = Math.max(1, Math.min(8, Math.round(place)));
  return picked + Math.round(PLACE_COINS[p - 1] * (0.7 + mul * 0.3) * (mode === "online" ? 1.25 : 1));
}
export function cupReward(place: number) { return place === 1 ? 300 : place === 2 ? 200 : place === 3 ? 120 : 40; }

// ---------------------------------------------------------------------------
// Online protocol
// ---------------------------------------------------------------------------

export const RACE_MAX = 8;

/** Kart state flags */
export const KF = { GROUNDED: 1, BOOST: 2, SHIELD: 4, RUSH: 8, FINISHED: 16, SPIN: 32, OFFROAD: 64 } as const;

/** [x, y, z, yaw, speed, flags, lap, s, pitch, roll, steer, driftDir, driftLevel, spinYaw, coins] */
export type KartState = number[];

export interface RaceLook { body: string; paint: number; helmet: number; driver: number }
export interface RacePlayerMeta {
  id: string; // user id as a string, or "bot-…"
  name: string;
  bot: boolean;
  look: RaceLook;
  upgrades: Record<UpgradeId, number>;
  ready: boolean;
  connected: boolean;
}

export type RacePhase = "lobby" | "countdown" | "racing" | "results";

export interface RaceRoomMeta {
  v: number;
  code: string;
  hostId: string;
  publicRoom: boolean;
  trackId: string;
  cc: number;
  laps: number;
  bots: boolean;
  players: RacePlayerMeta[];
  raceNo: number;
}

export interface RaceStandingRow { id: string; name: string; place: number; time: number; finished: boolean; coins: number; paint: number; bot: boolean }

export type RaceEvent =
  | { s: number; k: "item"; by: string; kind: "slick" | "bomb" | "orb"; hid: string; at: number; lat: number; target: string | null }
  | { s: number; k: "gone"; hid: string }
  | { s: number; k: "finish"; id: string; time: number }
  | { s: number; k: "info"; text: string };

export interface RaceSnap {
  t: "race-snap";
  now: number;
  phase: RacePhase;
  startAt: number; // server time of "GO"
  seq: number;
  meta?: RaceRoomMeta;
  ps: { id: string; st: KartState }[];
  ev?: RaceEvent[];
  results?: RaceStandingRow[];
  echo?: number;
}

export type RaceClientEvent =
  | { k: "item"; kind: "slick" | "bomb" | "orb"; hid: string; at: number; lat: number; target: string | null; by?: string }
  | { k: "gone"; hid: string }
  | { k: "finish"; time: number; id?: string };

export interface RaceClientSync {
  ack: number;
  mv: number;
  raceNo: number;
  st?: KartState;
  bots?: { id: string; st: KartState }[];
  ev?: RaceClientEvent[];
  echo?: number;
}
