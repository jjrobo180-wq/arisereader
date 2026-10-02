// Prism Paintball — HUD state shared between the game engine and React UI.
import type { Phase, RoomMeta, Team } from "@shared/paintball";

export interface FeedItem { id: number; killer: string; kTeam: Team; victim: string; vTeam: Team; weapon: number; head: boolean; mine: boolean; t: number }
export interface Toast { id: number; text: string; kind: "splat" | "streak" | "info" | "warn"; t: number }
export interface DamageArc { id: number; angle: number; t: number }

export interface HudState {
  ready: boolean;
  phase: Phase;
  phaseEndsLocal: number;
  scores: [number, number];
  myTeam: Team;
  hp: number;
  alive: boolean;
  protectedUntilLocal: number;
  respawnAtLocal: number;
  killedBy: { name: string; team: Team; weapon: number } | null;
  weapon: number;
  ammo: number[];
  reload: number; // -1 when not reloading, else 0..1
  ads: boolean;
  scoped: boolean;
  crouch: boolean;
  sprint: boolean;
  connection: { mode: "ws" | "http" | "connecting"; ok: boolean; rtt: number };
  fps: number;
  locked: boolean;
  meta: RoomMeta | null;
  feed: FeedItem[];
  toasts: Toast[];
  damage: DamageArc[];
  streak: number;
  hitFlash: number;
  error: string | null;
  quality: string;
}

export const initialHud: HudState = {
  ready: false, phase: "lobby", phaseEndsLocal: 0, scores: [0, 0], myTeam: 0, hp: 100, alive: false,
  protectedUntilLocal: 0, respawnAtLocal: 0, killedBy: null, weapon: 0, ammo: [0, 0, 0], reload: -1,
  ads: false, scoped: false, crouch: false, sprint: false, connection: { mode: "connecting", ok: true, rtt: 0 },
  fps: 0, locked: false, meta: null, feed: [], toasts: [], damage: [], streak: 0, hitFlash: 0, error: null, quality: "",
};

export class HudStore {
  private state: HudState = initialHud;
  private listeners = new Set<() => void>();
  get = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  set(patch: Partial<HudState>) {
    let changed = false;
    for (const k of Object.keys(patch) as (keyof HudState)[]) if (this.state[k] !== patch[k]) { changed = true; break; }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }
}

export interface GameSettings {
  sensitivity: number; // 0.2 .. 3
  volume: number; // 0 .. 1
  quality: "auto" | "low" | "medium" | "high";
  showFps: boolean;
  invertY: boolean;
}

export const defaultSettings: GameSettings = { sensitivity: 1, volume: 0.8, quality: "auto", showFps: false, invertY: false };
