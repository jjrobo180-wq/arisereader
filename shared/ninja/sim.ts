// Reading Ninja — the deterministic game simulation (no three.js, no DOM).
// Tokens (picture + word) are tossed up from below on a flat play plane. Slice the ones that match the
// mission: swipe through them, or (eye gaze) rest your gaze on one until it slices. Leave the others alone.
import type { Thing } from "../runner/missions";
import type { NinjaLevel } from "./missions";

export type Difficulty = "easy" | "medium" | "hard";
export type NinjaOptions = { difficulty: Difficulty; dwellMs: number; slowLook: boolean; seed?: number; demo?: boolean };
export type Segment = { x0: number; y0: number; x1: number; y1: number };
export type NinjaInput = { swipes: Segment[]; gaze: { x: number; y: number } | null; swipeId: number };

export const FLOOR = -3.6;
export const DIFF = {
  easy: { gravity: 5.2, apex: [6.2, 8.4], gap: 2.6, wave: [1, 2], share: 0.62, r: 1.25, hit: 1.4, slow: 0.22, hearts: false, mult: 1, max: 4 },
  medium: { gravity: 8.5, apex: [6.4, 9.0], gap: 1.7, wave: [1, 3], share: 0.5, r: 1.1, hit: 1.2, slow: 0.4, hearts: true, mult: 1.5, max: 6 },
  hard: { gravity: 12, apex: [6.0, 9.4], gap: 1.15, wave: [2, 4], share: 0.42, r: 1.0, hit: 1.05, slow: 0.6, hearts: true, mult: 2, max: 8 },
} as const;
export const DEFAULT_DWELL: Record<Difficulty, number> = { easy: 450, medium: 350, hard: 280 };

export type Token = {
  id: number; thing: Thing; target: boolean; x: number; y: number; vx: number; vy: number; rot: number; vrot: number; r: number;
  state: "fly" | "sliced" | "gone"; dwell: number; looked: boolean; angle: number;
};
export type NinjaEvent = { t: string; x: number; y: number; id?: number; n?: number; combo?: number; label?: string; emoji?: string; angle?: number; target?: boolean };

function rng(seed: number) { let s = (seed >>> 0) || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function segHitsCircle(s: Segment, cx: number, cy: number, r: number) {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0, l2 = dx * dx + dy * dy;
  const k = l2 > 0 ? Math.max(0, Math.min(1, ((cx - s.x0) * dx + (cy - s.y0) * dy) / l2)) : 0;
  const px = s.x0 + dx * k - cx, py = s.y0 + dy * k - cy;
  return px * px + py * py <= r * r;
}

export class NinjaSim {
  readonly cfg: (typeof DIFF)[Difficulty];
  state: "ready" | "play" | "win" | "fail" = "ready";
  tokens: Token[] = []; events: NinjaEvent[] = [];
  caught = 0; wrong = 0; misses = 0; hearts = 3; score = 0; bestCombo = 0; time = 0; endT = 0;
  halfW = 9; readonly goal: number;
  private rnd: () => number; private nextId = 1; private waveT = 1.0; private comboN = 0; private comboT = 0; private comboSwipe = -1;

  constructor(public level: NinjaLevel, public opts: NinjaOptions) {
    this.cfg = DIFF[opts.difficulty];
    this.rnd = rng(opts.seed ?? (Date.now() & 0xffffff));
    this.goal = opts.demo ? Infinity : level.goal;
  }
  start() { if (this.state === "ready") this.state = "play"; }
  setBounds(halfW: number) { this.halfW = Math.max(4.5, halfW); }

  private ev(t: string, tok: Token | null, extra: Partial<NinjaEvent> = {}) { this.events.push({ t, x: tok?.x ?? 0, y: tok?.y ?? 0, id: tok?.id, label: tok?.thing.label, emoji: tok?.thing.emoji, target: tok?.target, ...extra }); }

  private launchWave() {
    const c = this.cfg, live = this.tokens.filter(t => t.state === "fly").length;
    const size = Math.min(c.max - live, c.wave[0] + Math.floor(this.rnd() * (c.wave[1] - c.wave[0] + 1)));
    if (size <= 0) return;
    const needTarget = this.caught + this.tokens.filter(t => t.state === "fly" && t.target).length < this.goal;
    // mixed waves: always some to slice and some to leave alone; a single token is either, by the level's ratio
    const nTargets = !needTarget ? 0 : size === 1 ? (this.rnd() < c.share ? 1 : 0) : Math.max(1, Math.min(size - 1, Math.round(size * c.share + (this.rnd() - 0.5) * 0.9)));
    const order = Array.from({ length: size }, (_, i) => i < nTargets);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const lanes: number[] = [];
    for (let i = 0; i < size; i++) {
      const target = order[i];
      const pool = this.level.distractors;
      const thing = target ? this.level.target : pool[Math.floor(this.rnd() * pool.length)];
      // spread launch points so tokens don't overlap
      let x = 0; for (let k = 0; k < 8; k++) { x = (this.rnd() * 2 - 1) * (this.halfW - c.r - 0.6); if (lanes.every(l => Math.abs(l - x) > c.r * 2.4)) break; }
      lanes.push(x);
      const apex = c.apex[0] + this.rnd() * (c.apex[1] - c.apex[0]);
      const vy = Math.sqrt(2 * c.gravity * (apex - FLOOR));
      const flight = 2 * vy / c.gravity, land = (this.rnd() * 2 - 1) * this.halfW * 0.45;
      const vx = Math.max(-this.halfW, Math.min(this.halfW, (land - x) / flight));
      this.tokens.push({ id: this.nextId++, thing, target, x, y: FLOOR - this.rnd() * 0.6, vx, vy: vy * (0.97 + this.rnd() * 0.06), rot: (this.rnd() - 0.5) * 0.6, vrot: (this.rnd() - 0.5) * 1.6, r: c.r, state: "fly", dwell: 0, looked: false, angle: 0 });
    }
    this.ev("launch", null, { n: size });
  }

  private slice(tok: Token, angle: number, swipeId: number) {
    tok.state = "sliced"; tok.angle = angle;
    if (tok.target) {
      this.caught++;
      if (swipeId >= 0 && swipeId === this.comboSwipe && this.comboT > 0) this.comboN++; else this.comboN = 1;
      this.comboSwipe = swipeId; this.comboT = 0.35;
      this.bestCombo = Math.max(this.bestCombo, this.comboN);
      this.score += Math.round((100 + (this.comboN - 1) * 50) * this.cfg.mult);
      this.ev("slice", tok, { n: this.caught, combo: this.comboN, angle });
      if (this.caught >= this.goal) this.win();
    } else {
      this.wrong++;
      if (this.cfg.hearts && !this.opts.demo) this.hearts = Math.max(0, this.hearts - 1);
      this.ev("wrong", tok, { n: this.hearts, angle });
      if (this.cfg.hearts && !this.opts.demo && this.hearts <= 0) { this.state = "fail"; this.endT = 0; this.ev("fail", null); }
    }
  }
  private win() {
    this.state = "win"; this.endT = 0;
    for (const t of this.tokens) if (t.state === "fly") { t.state = "gone"; this.ev("clear", t); }
    this.ev("win", null);
  }

  step(dt: number, inp: NinjaInput) {
    this.events.length = 0;
    if (this.state === "ready") return;
    if (this.state === "win" || this.state === "fail") { this.endT += dt; return; }
    this.time += dt; this.comboT = Math.max(0, this.comboT - dt);
    const c = this.cfg;

    // launch waves
    this.waveT -= dt;
    if (this.waveT <= 0) { this.launchWave(); this.waveT = c.gap * (0.85 + this.rnd() * 0.3); }

    // gaze: the token under the gaze slows down and slices after resting on it long enough
    let looked: Token | null = null;
    if (inp.gaze) {
      let best = Infinity;
      for (const t of this.tokens) { if (t.state !== "fly") continue; const d = Math.hypot(t.x - inp.gaze.x, t.y - inp.gaze.y); if (d < t.r * c.hit * 1.1 && d < best) { best = d; looked = t; } }
    }
    for (const t of this.tokens) {
      if (t.state !== "fly") continue;
      t.looked = t === looked;
      if (t.looked) t.dwell += dt * 1000; else t.dwell = Math.max(0, t.dwell - dt * 2500);
      const ts = t.looked && this.opts.slowLook ? c.slow : 1;
      t.vy -= c.gravity * dt * ts; t.x += t.vx * dt * ts; t.y += t.vy * dt * ts; t.rot += t.vrot * dt * ts;
      if (t.x < -this.halfW + t.r * 0.6 && t.vx < 0) t.vx = -t.vx * 0.6;
      if (t.x > this.halfW - t.r * 0.6 && t.vx > 0) t.vx = -t.vx * 0.6;
    }
    if (looked && looked.dwell >= this.opts.dwellMs) this.slice(looked, 0.6 + (this.rnd() - 0.5) * 0.5, -1);

    // swipes slice everything they pass through
    for (const s of inp.swipes) {
      if (this.state !== "play") break;
      const ang = Math.atan2(s.y1 - s.y0, s.x1 - s.x0);
      for (const t of this.tokens) if (t.state === "fly" && segHitsCircle(s, t.x, t.y, t.r * c.hit)) { this.slice(t, ang, inp.swipeId); if (this.state !== "play") break; }
    }

    // demo: an invisible ninja slices the matching tokens near the top of their arc
    if (this.opts.demo) for (const t of this.tokens) if (t.state === "fly" && t.target && t.vy < 0.8 && t.y > 2) this.slice(t, (this.rnd() - 0.5) * 2, -1);

    // tokens that fall back down
    for (const t of this.tokens) if (t.state === "fly" && t.y < FLOOR - 1 && t.vy < 0) { t.state = "gone"; if (t.target) { this.misses++; this.ev("miss", t); } }
    if (this.tokens.length > 24) this.tokens = this.tokens.filter(t => t.state === "fly");
  }

  stars() { return this.wrong === 0 ? 3 : this.wrong <= 2 ? 2 : 1; }
  result() { return { caught: this.caught, goal: this.level.goal, wrong: this.wrong, misses: this.misses, score: this.score, bestCombo: this.bestCombo, time: this.time, stars: this.stars(), won: this.state === "win" }; }
}
export type NinjaResult = ReturnType<NinjaSim["result"]>;
