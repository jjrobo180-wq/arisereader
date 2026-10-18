// Reading Runner — the deterministic game simulation (no three.js, no DOM).
// The runner moves forward along "s" (distance). Three lanes, trains to dodge or climb, barriers to jump,
// coins to grab and picture/word cards: run into the card that matches the mission, skip the others.
import type { Mission, Thing } from "./missions";

export type Difficulty = "easy" | "medium" | "hard";
export type Assists = { autoJump: boolean; autoDodge: boolean; guide: boolean };
export type SimOptions = { difficulty: Difficulty; assists: Assists; seed?: number; demo?: boolean };
export type SimInput = { moves: number[]; jump: boolean; lane: number | null };

export const LANE_X = [-2.6, 0, 2.6];
export const TRAIN_H = 3.3;
export const TRAIN_HALF_W = 1.05;
export const BARRIER_H = 1.15;
export const RAMP_LEN = 8;
export const CAR_LEN = 11;
export const CARD_Y = 1.35;
const PLAYER_HALF_W = 0.34;
const GRAVITY = 38;
const JUMP_V = 12.6;
const LANE_SPEED = 15;
const AHEAD = 150;

export const DIFF = {
  easy: { speed: 9.5, max: 11.5, gap: 1.8, distractors: 1, trainChance: 0.22, maxCars: 2, ramps: false, loseHearts: false, hearts: 3, mult: 1 },
  medium: { speed: 12.5, max: 15.5, gap: 1.35, distractors: 2, trainChance: 0.36, maxCars: 3, ramps: true, loseHearts: true, hearts: 3, mult: 1.5 },
  hard: { speed: 16, max: 20, gap: 1.0, distractors: 2, trainChance: 0.42, maxCars: 3, ramps: true, loseHearts: true, hearts: 3, mult: 2 },
} as const;

export const DEFAULT_ASSISTS: Record<Difficulty, Assists> = {
  easy: { autoJump: true, autoDodge: true, guide: true },
  medium: { autoJump: true, autoDodge: false, guide: false },
  hard: { autoJump: false, autoDodge: false, guide: false },
};

export type Obstacle = { id: number; k: "barrier" | "train" | "ramp"; lane: number; s0: number; s1: number; cars: number; hit: boolean };
export type Card = Thing & { target: boolean; row: number };
export type Pickup = { id: number; k: "coin" | "card" | "magnet" | "shield"; lane: number; s: number; y: number; alive: boolean; card?: Card };
export type SimEvent = { t: string; x: number; y: number; s: number; n?: number; label?: string; emoji?: string; lane?: number; magnet?: boolean };
export type SimState = "ready" | "run" | "finish" | "win" | "fail";

export type Player = {
  lane: number; prevLane: number; x: number; y: number; vy: number; grounded: boolean; s: number; speed: number;
  stumbleT: number; invulT: number; magnetT: number; shieldT: number; hearts: number; landT: number; airT: number;
  jumpBuf: number; leanDir: number; bumpT: number;
};

function rng(seed: number) { let s = (seed >>> 0) || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

export class Sim {
  readonly cfg: (typeof DIFF)[Difficulty];
  state: SimState = "ready";
  p: Player;
  obstacles: Obstacle[] = [];
  pickups: Pickup[] = [];
  events: SimEvent[] = [];
  caught = 0; wrong = 0; crashes = 0; coins = 0; misses = 0; time = 0;
  finishS = Infinity; winT = 0; failT = 0;
  readonly goal: number;
  private rnd: () => number;
  private nextId = 1; private cursor = 34; private row = 0; private sinceCard = 1; private lastTargetLane = -1; private rowsDone = new Set<number>();
  private gazeLast: number | null = null; private assistHold = 0; private userIdle = 9;

  constructor(public mission: Mission, public opts: SimOptions) {
    this.cfg = DIFF[opts.difficulty];
    this.rnd = rng(opts.seed ?? (Date.now() & 0xffffff));
    this.goal = opts.demo ? Infinity : mission.goal;
    this.p = { lane: 1, prevLane: 1, x: 0, y: 0, vy: 0, grounded: true, s: 0, speed: 0, stumbleT: 0, invulT: 0, magnetT: 0, shieldT: 0, hearts: this.cfg.hearts, landT: 0, airT: 0, jumpBuf: 0, leanDir: 0, bumpT: 0 };
    // a few welcome coins down the middle lane, then the course
    for (let i = 0; i < 6; i++) this.addPickup("coin", 1, 14 + i * 2.4, 0.9);
    this.generate();
  }

  start() { if (this.state === "ready") { this.state = "run"; this.p.speed = this.cfg.speed * 0.6; } }

  // ── course generation ──
  private addPickup(k: Pickup["k"], lane: number, s: number, y: number, card?: Card) { const it: Pickup = { id: this.nextId++, k, lane, s, y, alive: true, card }; this.pickups.push(it); return it; }
  private addObstacle(k: Obstacle["k"], lane: number, s0: number, s1: number, cars = 0) { const o: Obstacle = { id: this.nextId++, k, lane, s0, s1, cars, hit: false }; this.obstacles.push(o); return o; }
  private shuffle<T>(a: T[]) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  private gapDist() { return Math.max(9, this.cfg.max * this.cfg.gap); }

  private generate() {
    if (this.state === "finish" || this.state === "win" || this.state === "fail") return;
    while (this.cursor < this.p.s + AHEAD) {
      this.row++;
      const wantCard = this.sinceCard >= 2 || (this.sinceCard >= 1 && this.rnd() < 0.35);
      if (wantCard) { this.cardRow(); this.sinceCard = 0; continue; }
      this.sinceCard++;
      const r = this.rnd();
      if (r < this.cfg.trainChance) this.trainRow();
      else if (r < this.cfg.trainChance + 0.33) this.barrierRow();
      else this.coinRow();
    }
  }

  private cardRow() {
    const s = this.cursor, m = this.mission;
    let t = Math.floor(this.rnd() * 3);
    if (t === this.lastTargetLane && this.rnd() < 0.6) t = (t + 1 + Math.floor(this.rnd() * 2)) % 3;
    this.lastTargetLane = t;
    const others = this.shuffle([0, 1, 2].filter(l => l !== t)).slice(0, this.cfg.distractors);
    const pool = this.shuffle([...m.distractors]);
    this.addPickup("card", t, s, CARD_Y, { ...m.target, target: true, row: this.row });
    others.forEach((l, i) => this.addPickup("card", l, s, CARD_Y, { ...pool[i % pool.length], target: false, row: this.row }));
    this.cursor = s + this.gapDist() * 1.05;
  }

  private coinRow() {
    const s = this.cursor; let lane = Math.floor(this.rnd() * 3); const n = 6 + Math.floor(this.rnd() * 4);
    const zig = this.opts.difficulty !== "easy" && this.rnd() < 0.4;
    for (let i = 0; i < n; i++) {
      if (zig && i === Math.floor(n / 2)) lane = lane === 1 ? (this.rnd() < 0.5 ? 0 : 2) : 1;
      this.addPickup("coin", lane, s + i * 2.3, 0.9);
    }
    if (this.rnd() < 0.12) this.addPickup(this.rnd() < 0.5 ? "magnet" : "shield", (lane + 1 + Math.floor(this.rnd() * 2)) % 3, s + n * 1.2, 1.1);
    this.cursor = s + n * 2.3 + this.gapDist() * 0.55;
  }

  private barrierRow() {
    const s = this.cursor;
    const count = this.opts.difficulty === "easy" ? 1 : this.opts.difficulty === "medium" ? 1 + Math.floor(this.rnd() * 2) : 2 + Math.floor(this.rnd() * 2);
    const lanes = this.shuffle([0, 1, 2]).slice(0, count);
    for (const l of lanes) this.addObstacle("barrier", l, s, s + 0.5);
    // a coin arc over one of the barriers shows where to jump
    const arcLane = lanes[0];
    for (let i = 0; i < 5; i++) { const k = i / 4; this.addPickup("coin", arcLane, s - 4 + i * 2, 0.9 + Math.sin(k * Math.PI) * 1.9); }
    this.cursor = s + this.gapDist();
  }

  private trainRow() {
    const s = this.cursor, d = this.cfg;
    const trains = this.opts.difficulty === "easy" ? 1 : 1 + (this.rnd() < (this.opts.difficulty === "hard" ? 0.75 : 0.45) ? 1 : 0);
    const lanes = this.shuffle([0, 1, 2]);
    const trainLanes = lanes.slice(0, trains), free = lanes.slice(trains);
    let end = s;
    trainLanes.forEach((l, i) => {
      const cars = 1 + Math.floor(this.rnd() * d.maxCars);
      const len = cars * CAR_LEN + (cars - 1) * 0.6;
      let start = s + (i ? Math.floor(this.rnd() * 3) * 3 : 0);
      if (d.ramps && i === 0 && this.rnd() < 0.45) {
        this.addObstacle("ramp", l, start, start + RAMP_LEN);
        start += RAMP_LEN;
        for (let k = 0; k < Math.floor(len / 2.6); k++) this.addPickup("coin", l, start + 1.5 + k * 2.6, TRAIN_H + 0.9);
      }
      this.addObstacle("train", l, start, start + len, cars);
      end = Math.max(end, start + len);
    });
    for (const l of free) for (let k = 0; k < Math.floor((end - s) / 3); k++) if (this.rnd() < 0.7) this.addPickup("coin", l, s + 2 + k * 3, 0.9);
    this.cursor = end + this.gapDist() * 0.85;
  }

  // ── queries ──
  private trainCovers(lane: number, a: number, b: number) { return this.obstacles.some(o => o.k === "train" && o.lane === lane && o.s1 > a && o.s0 < b); }
  private blockedAhead(lane: number, from: number, to: number, barriersBlock: boolean) {
    return this.obstacles.some(o => o.lane === lane && o.s1 > from && o.s0 < to && (o.k === "train" || (barriersBlock && o.k === "barrier" && !o.hit)));
  }
  groundAt(x: number, s: number) {
    let g = 0;
    for (const o of this.obstacles) {
      if (o.k === "barrier" || s < o.s0 || s > o.s1 || Math.abs(x - LANE_X[o.lane]) > TRAIN_HALF_W + PLAYER_HALF_W - 0.1) continue;
      g = Math.max(g, o.k === "ramp" ? TRAIN_H * (s - o.s0) / (o.s1 - o.s0) : TRAIN_H);
    }
    return g;
  }
  nextTarget() { return this.pickups.find(c => c.k === "card" && c.alive && c.card!.target && c.s > this.p.s - 1 && !this.rowsDone.has(c.card!.row)); }

  private ev(t: string, extra: Partial<SimEvent> = {}) { this.events.push({ t, x: this.p.x, y: this.p.y, s: this.p.s, ...extra }); }
  private setLane(l: number, byUser: boolean) {
    l = Math.max(0, Math.min(2, l)); const p = this.p;
    if (l === p.lane) return;
    // with auto-dodge on, the player can't steer sideways into a train that's right there
    if (byUser && this.opts.assists.autoDodge && p.y < TRAIN_H - 0.3 && this.trainCovers(l, p.s - 1, p.s + p.speed * 0.45 + 1)) return;
    p.leanDir = Math.sign(l - p.lane); p.prevLane = p.lane; p.lane = l; this.ev("lane", { lane: l });
    if (byUser) this.userIdle = 0;
  }
  private jump() {
    const p = this.p;
    if (p.grounded || p.airT < 0.1) { p.vy = JUMP_V; p.grounded = false; p.airT = 1; p.jumpBuf = 0; this.ev("jump"); return true; }
    p.jumpBuf = 0.15; return false;
  }

  // ── main step ──
  step(dt: number, inp: SimInput) {
    this.events.length = 0;
    const p = this.p, d = this.cfg;
    if (this.state === "ready") { this.gazeLast = inp.lane; return; }
    const playing = this.state === "run" || this.state === "finish";
    if (playing) this.time += dt;

    // speed
    let target = d.speed + (d.max - d.speed) * Math.min(1, this.time / 100);
    if (p.stumbleT > 0) target *= 1 - 0.6 * (p.stumbleT / 1.1);
    if (this.state === "win" || this.state === "fail") target = 0;
    p.speed += (target - p.speed) * Math.min(1, dt * (this.state === "win" ? 1.6 : this.state === "fail" ? 6 : 2.2));

    // input (only while running)
    this.userIdle += dt; this.assistHold = Math.max(0, this.assistHold - dt);
    if (playing) {
      for (const m of inp.moves) this.setLane(p.lane + Math.sign(m), true);
      if (inp.lane != null) {
        const changed = inp.lane !== this.gazeLast;
        if (changed || (this.assistHold <= 0 && inp.lane !== p.lane)) this.setLane(inp.lane, true);
      }
      if (inp.jump) this.jump();
      this.assists();
    }
    this.gazeLast = inp.lane;

    // movement
    const prevS = p.s;
    p.s += p.speed * dt;
    const tx = LANE_X[p.lane], dx = tx - p.x;
    p.x += Math.sign(dx) * Math.min(Math.abs(dx), LANE_SPEED * dt);
    if (Math.abs(dx) < 0.05) p.leanDir = 0;
    p.vy -= GRAVITY * dt; p.y += p.vy * dt;
    const g = this.groundAt(p.x, p.s);
    if (p.y <= g) {
      if (!p.grounded) { p.landT = 0.14; this.ev(p.vy < -14 ? "landHard" : "land"); }
      p.y = g; p.vy = 0; p.grounded = true; p.airT = 0;
      if (p.jumpBuf > 0 && playing) this.jump();
    } else if (p.y > g + 0.05) { if (p.grounded) { p.grounded = false; p.airT = 0; } p.airT += dt; }
    p.jumpBuf = Math.max(0, p.jumpBuf - dt); p.landT = Math.max(0, p.landT - dt);
    p.stumbleT = Math.max(0, p.stumbleT - dt); p.invulT = Math.max(0, p.invulT - dt); p.bumpT = Math.max(0, p.bumpT - dt);
    if (p.magnetT > 0) { p.magnetT = Math.max(0, p.magnetT - dt); if (p.magnetT === 0) this.ev("powerEnd", { label: "magnet" }); }
    if (p.shieldT > 0) { p.shieldT = Math.max(0, p.shieldT - dt); if (p.shieldT === 0) this.ev("powerEnd", { label: "shield" }); }

    if (playing) { this.collide(prevS); this.collect(); }

    // finish & end states
    if (this.state === "run" && this.caught >= this.goal) this.beginFinish();
    if (this.state === "finish" && p.s >= this.finishS) { this.state = "win"; this.winT = 0; this.ev("win"); }
    if (this.state === "win") this.winT += dt;
    if (this.state === "fail") this.failT += dt;

    // housekeeping
    const behind = p.s - 25;
    if (this.obstacles.length && this.obstacles[0].s1 < behind) this.obstacles = this.obstacles.filter(o => o.s1 >= behind);
    if (this.pickups.length && this.pickups[0].s < behind) this.pickups = this.pickups.filter(c => c.s >= behind);
    this.generate();
  }

  private assists() {
    const p = this.p, a = this.opts.assists, onRoof = p.y > TRAIN_H - 0.3;
    // auto-jump over barriers
    if (a.autoJump && p.grounded) {
      const reach = p.speed * 0.2 + 0.9;
      if (this.obstacles.some(o => o.k === "barrier" && !o.hit && o.lane === p.lane && o.s0 - p.s > 0 && o.s0 - p.s < reach)) this.jump();
    }
    // steer around trains (and barriers when not auto-jumping)
    if (a.autoDodge && !onRoof) {
      const look = p.speed * 0.75 + 3;
      const hazard = this.obstacles.find(o => o.lane === p.lane && o.s0 > p.s && o.s0 - p.s < look && (o.k === "train" ? !this.obstacles.some(r => r.k === "ramp" && r.lane === o.lane && Math.abs(r.s1 - o.s0) < 0.1) : o.k === "barrier" && !a.autoJump && !o.hit));
      if (hazard) {
        const tgt = this.nextTarget();
        const pick = [p.lane - 1, p.lane + 1]
          .filter(l => l >= 0 && l <= 2 && !this.blockedAhead(l, p.s - 1, hazard.s0 + 8, !a.autoJump))
          .sort((l1, l2) => (tgt ? Math.abs(l1 - tgt.lane) - Math.abs(l2 - tgt.lane) : 0) || (this.rnd() < 0.5 ? -1 : 1))[0];
        if (pick != null) { this.setLane(pick, false); this.assistHold = Math.max(0.9, (hazard.s1 - p.s) / Math.max(1, p.speed)); }
      }
    }
    // gently guide toward the matching card
    if (a.guide && !onRoof) {
      const tgt = this.nextTarget();
      if (tgt && tgt.lane !== p.lane && tgt.s - p.s < p.speed * 1.25 + 3 && tgt.s - p.s > 0.5) {
        const step = p.lane + Math.sign(tgt.lane - p.lane);
        if (!this.blockedAhead(step, p.s - 1, tgt.s + 1, !a.autoJump)) { this.setLane(step, false); this.assistHold = Math.max(0.9, (tgt.s - p.s) / Math.max(1, p.speed) + 0.3); }
      }
    }
  }

  private collide(prevS: number) {
    const p = this.p;
    for (const o of this.obstacles) {
      const ox = LANE_X[o.lane], lat = Math.abs(p.x - ox);
      if (o.k === "barrier") {
        if (o.hit || lat > 1.15 || p.s < o.s0 - 0.35 || p.s > o.s1 + 0.2 || p.y > BARRIER_H - 0.05) continue;
        this.crash(o); continue;
      }
      if (o.k !== "train" || p.s < o.s0 - 0.3 || p.s > o.s1 || lat > TRAIN_HALF_W + PLAYER_HALF_W) continue;
      if (p.y >= TRAIN_H - 0.3 || p.invulT > 0) continue;
      const rampLed = this.obstacles.some(r => r.k === "ramp" && r.lane === o.lane && Math.abs(r.s1 - o.s0) < 0.1);
      if (prevS <= o.s0 - 0.05 && !rampLed) { this.crash(o); continue; }
      // came in from the side: bounce back to where we were
      if (p.bumpT <= 0) { this.ev("bump", { lane: o.lane }); p.bumpT = 0.4; p.stumbleT = Math.max(p.stumbleT, 0.4); }
      const back = p.prevLane !== o.lane && !this.trainCovers(p.prevLane, p.s - 1, p.s + 1) ? p.prevLane : this.safeLane(o.lane);
      p.lane = back; p.x = ox + Math.sign(LANE_X[back] - ox || 1) * (TRAIN_HALF_W + PLAYER_HALF_W + 0.02);
    }
  }
  private safeLane(avoid: number) {
    const p = this.p;
    const order = [p.lane, p.prevLane, 0, 1, 2].filter((l, i, a) => a.indexOf(l) === i && l !== avoid);
    return order.find(l => !this.trainCovers(l, p.s - 2, p.s + 14)) ?? order.find(l => !this.trainCovers(l, p.s - 1, p.s + 1)) ?? (avoid === 1 ? 0 : 1);
  }

  private crash(o: Obstacle) {
    const p = this.p;
    if (p.invulT > 0) return;
    if (o.k === "barrier") { o.hit = true; this.ev("smash", { lane: o.lane, s: o.s0 }); }
    if (p.shieldT > 0) {
      p.shieldT = 0; p.invulT = 1.2; this.ev("shieldPop");
    } else {
      this.crashes++; p.stumbleT = 1.1; p.invulT = 2.0;
      if (this.cfg.loseHearts && !this.opts.demo) p.hearts = Math.max(0, p.hearts - 1);
      this.ev("crash", { n: p.hearts, label: o.k });
      if (this.cfg.loseHearts && !this.opts.demo && p.hearts <= 0) { this.state = "fail"; this.failT = 0; this.ev("fail"); }
    }
    if (o.k === "train") { const l = this.safeLane(o.lane); p.prevLane = p.lane; p.lane = l; }
  }

  private collect() {
    const p = this.p;
    for (const c of this.pickups) {
      if (!c.alive) continue;
      const ds = c.s - p.s, lx = LANE_X[c.lane];
      if (c.k === "card") {
        if (this.rowsDone.has(c.card!.row)) { if (ds < -0.5) c.alive = false; continue; }
        if (ds < -1.4) { this.rowsDone.add(c.card!.row); if (c.card!.target) { this.misses++; this.ev("miss", { label: c.card!.label, emoji: c.card!.emoji }); } continue; }
        if (Math.abs(ds) < 1.0 && Math.abs(lx - p.x) < 1.15) {
          this.rowsDone.add(c.card!.row); c.alive = false;
          if (c.card!.target) { this.caught++; this.ev("card", { n: this.caught, label: c.card!.label, emoji: c.card!.emoji, x: lx, y: c.y, s: c.s }); }
          else {
            this.wrong++;
            const hurt = this.cfg.loseHearts && !this.opts.demo && p.invulT <= 0 && p.shieldT <= 0;
            if (hurt) { p.hearts = Math.max(0, p.hearts - 1); p.invulT = 1.0; }
            this.ev("wrong", { n: p.hearts, label: c.card!.label, emoji: c.card!.emoji, x: lx, y: c.y, s: c.s });
            if (hurt && p.hearts <= 0) { this.state = "fail"; this.failT = 0; this.ev("fail"); }
          }
          // the other cards in this row fade away
          for (const o of this.pickups) if (o !== c && o.k === "card" && o.card!.row === c.card!.row && o.alive) o.alive = false;
        }
        continue;
      }
      const near = Math.abs(ds) < 0.85 && Math.abs(lx - p.x) < 0.95 && Math.abs(c.y - (p.y + 0.9)) < 1.25;
      const pulled = c.k === "coin" && p.magnetT > 0 && ds > -0.5 && ds < 9 && Math.abs(c.y - p.y) < 4;
      if (!near && !pulled) continue;
      c.alive = false;
      if (c.k === "coin") { this.coins++; this.ev("coin", { n: this.coins, x: lx, y: c.y, s: c.s, magnet: pulled && !near }); }
      else if (c.k === "magnet") { p.magnetT = 10; this.ev("magnet", { x: lx, y: c.y, s: c.s }); }
      else { p.shieldT = 20; this.ev("shield", { x: lx, y: c.y, s: c.s }); }
    }
  }

  private beginFinish() {
    const p = this.p;
    this.state = "finish";
    this.finishS = p.s + Math.max(32, p.speed * 2.6);
    // clear the way to the finish gate (keep anything we're standing on)
    this.obstacles = this.obstacles.filter(o => o.s0 <= p.s + 2 && (o.k !== "barrier" || o.s0 < p.s));
    this.pickups = this.pickups.filter(c => c.s <= p.s + 1 || (c.k === "coin" && c.s < this.finishS - 4));
    for (const c of this.pickups) if (c.k === "coin" && c.s > p.s + 1) { c.lane = 1; c.y = c.y > 2 ? 0.9 : c.y; }
    for (let i = 0; i < 8; i++) this.addPickup("coin", 1, p.s + 8 + i * 2.6, 0.9);
    this.ev("goal");
  }

  score() { return Math.round((this.coins * 10 + this.caught * 100 + Math.floor(this.p.s)) * this.cfg.mult); }
  stars() { return this.wrong === 0 && this.crashes <= 1 ? 3 : this.wrong <= 2 && this.crashes <= 4 ? 2 : 1; }
  result() { return { caught: this.caught, goal: this.mission.goal, wrong: this.wrong, misses: this.misses, crashes: this.crashes, coins: this.coins, score: this.score(), time: this.time, distance: Math.floor(this.p.s), stars: this.stars(), won: this.state === "win" }; }
}

export type RunResult = ReturnType<Sim["result"]>;
