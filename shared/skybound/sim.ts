// Skybound Sprint — the game simulation. Pure TypeScript (no three.js, no DOM) so it runs
// the same in the browser and in Node tests. Units are tiles; y points up; time is seconds.

export const T = {
  EMPTY: 0, GROUND: 1, STONE: 2, BRICK: 3, GIFT: 4, USED: 5, ONEWAY: 6, BOUNCE: 7,
  ICE: 8, SPIKE: 9, CRUMBLE: 10, METAL: 11,
} as const;
const SOLID_TILES = [false, true, true, true, true, true, false, false, true, false, true, true];
export const isSolidTile = (t: number) => !!SOLID_TILES[t];
export const isTopOnly = (t: number) => t === T.ONEWAY || t === T.BOUNCE;

export type ThemeId = "meadow" | "bluffs" | "caverns" | "clouds" | "frost" | "sunset" | "fortress" | "storm";
export type GiftContent = "gem" | "gems" | "feather" | "star" | "heart";

export type Ent =
  | { k: "gem"; x: number; y: number }
  | { k: "shard"; x: number; y: number; i: number }
  | { k: "check"; x: number; y: number }
  | { k: "goal"; x: number; y: number }
  | { k: "puff" | "spiky"; x: number; y: number }
  | { k: "buzzer"; x: number; y: number; range: number; amp?: number }
  | { k: "spring"; x: number; y: number }
  | { k: "updraft"; x: number; y: number; w: number; h: number }
  | { k: "mover"; x: number; y: number; w: number; dx: number; dy: number; period: number; phase?: number }
  | { k: "sign"; x: number; y: number; text: string }
  | { k: "feather" | "heart"; x: number; y: number }
  | { k: "boss"; x: number; y: number };

export type LevelDef = {
  id: string; num: string; name: string; theme: ThemeId; blurb: string;
  w: number; h: number; tiles: Uint8Array; gifts: Record<number, GiftContent>;
  ents: Ent[]; start: { x: number; y: number }; parTime: number; boss?: boolean;
};

export type Input = { left: boolean; right: boolean; jump: boolean; down: boolean };
export type SimEvent = { t: string; x: number; y: number; n?: number; s?: string };

// ── tuning ──
export const PHYS = {
  run: 8.5, starRun: 10.5, glideRun: 7.5,
  accG: 55, decG: 45, accAir: 32, iceAcc: 14, iceDec: 3.2,
  jumpV: 19.5, gUpHold: 45, gUpRel: 110, gDown: 55, maxFall: 22,
  glideFall: 4, featherGlideFall: 2.6, coyote: 0.1, jumpBuffer: 0.13,
  poundV: 30, poundStall: 0.13, wallSlide: 3.2, wallJumpVx: 9, wallJumpVy: 17.5,
  stomp: 13, stompHold: 17.5, spring: 27, springPound: 32, bounce: 21, bounceHold: 24,
  doubleJumpV: 16,
};
const PW = 0.75, PH = 1.5, EPS = 1e-4;

export type Player = {
  x: number; y: number; vx: number; vy: number; face: 1 | -1;
  grounded: boolean; groundTile: number; coyote: number; jumpBuf: number; jumpHeld: boolean;
  gliding: boolean; glideReady: boolean; airJumps: number;
  pound: 0 | 1 | 2; poundT: number; wallDir: 0 | 1 | -1; wallSliding: boolean; wallCoyote: number; lockT: number;
  invT: number; starT: number; power: 0 | 1; hearts: number; respawnT: number; mover: number;
  inUpdraft: boolean; landT: number; jumpT: number;
};

export type Enemy = {
  id: number; k: "puff" | "spiky" | "buzzer"; x: number; y: number; vx: number; vy: number; w: number; h: number;
  alive: boolean; deadT: number; dir: 1 | -1; baseX: number; baseY: number; range: number; amp: number; t: number; active: boolean;
  squash: boolean;
};
export type Item = { id: number; k: "feather" | "star" | "heart"; x: number; y: number; vx: number; vy: number; popT: number; alive: boolean; baseY: number };
export type Mover = { x: number; y: number; w: number; x0: number; y0: number; dx: number; dy: number; period: number; phase: number; vx: number; vy: number };
export type Bolt = { x: number; warn: number; strike: number };
export type Boss = {
  x: number; y: number; vx: number; hp: number; state: "intro" | "hover" | "windup" | "slam" | "dazed" | "hurt" | "rise" | "defeated" | "gone";
  t: number; boltT: number; inv: number; w: number; h: number;
};

const r2 = (x: number) => Math.round(x * 100) / 100;
function mulberry(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function moverPos(m: { x0: number; y0: number; dx: number; dy: number; period: number; phase: number }, time: number) {
  const s = 0.5 - 0.5 * Math.cos(((time / m.period) + m.phase) * Math.PI * 2);
  return { x: m.x0 + m.dx * s, y: m.y0 + m.dy * s };
}

export function totalGems(level: LevelDef) {
  let n = 0;
  for (const e of level.ents) if (e.k === "gem") n++;
  for (const k in level.gifts) { const g = level.gifts[k]; n += g === "gem" ? 1 : g === "gems" ? 5 : 0; }
  return n;
}

export class Sim {
  level: LevelDef; w: number; h: number; tiles: Uint8Array; gifts: Record<number, GiftContent>; giftHits: Record<number, number> = {};
  time = 0; p: Player; events: SimEvent[] = [];
  gems = 0; gemsTotal: number; shards = 0; retries = 0; stomps = 0;
  gemList: { x: number; y: number; alive: boolean }[] = [];
  shardList: { x: number; y: number; i: number; alive: boolean }[] = [];
  checks: { x: number; y: number; lit: boolean }[] = [];
  goal: { x: number; y: number } | null = null;
  enemies: Enemy[] = []; items: Item[] = []; movers: Mover[] = []; springs: { x: number; y: number; t: number }[] = [];
  updrafts: { x: number; y: number; w: number; h: number }[] = [];
  crumbles: { idx: number; t: number; fallen: boolean; back: number }[] = [];
  bumps: { c: number; r: number; t: number }[] = [];
  bolts: Bolt[] = []; boss: Boss | null = null;
  spawn: { x: number; y: number };
  state: "play" | "win" = "play"; winT = 0;
  private nextId = 1; private rng: () => number; private gemHearts = 0;

  constructor(level: LevelDef) {
    this.level = level; this.w = level.w; this.h = level.h; this.tiles = level.tiles.slice(); this.gifts = { ...level.gifts };
    this.rng = mulberry(level.id.length * 7919 + level.w);
    this.gemsTotal = totalGems(level);
    this.spawn = { ...level.start };
    this.p = {
      x: level.start.x, y: level.start.y, vx: 0, vy: 0, face: 1, grounded: false, groundTile: 0, coyote: 0, jumpBuf: 0, jumpHeld: false,
      gliding: false, glideReady: false, airJumps: 0, pound: 0, poundT: 0, wallDir: 0, wallSliding: false, wallCoyote: 0, lockT: 0,
      invT: 0, starT: 0, power: 0, hearts: 3, respawnT: 0, mover: -1, inUpdraft: false, landT: 0, jumpT: 0,
    };
    for (const e of level.ents) {
      if (e.k === "gem") this.gemList.push({ x: e.x, y: e.y, alive: true });
      else if (e.k === "shard") this.shardList.push({ x: e.x, y: e.y, i: e.i, alive: true });
      else if (e.k === "check") this.checks.push({ x: e.x, y: e.y, lit: false });
      else if (e.k === "goal") this.goal = { x: e.x, y: e.y };
      else if (e.k === "puff" || e.k === "spiky") this.enemies.push(this.makeEnemy(e.k, e.x, e.y, 0, 0));
      else if (e.k === "buzzer") this.enemies.push(this.makeEnemy("buzzer", e.x, e.y, e.range, e.amp ?? 1));
      else if (e.k === "spring") this.springs.push({ x: e.x, y: e.y, t: 0 });
      else if (e.k === "updraft") this.updrafts.push({ x: e.x, y: e.y, w: e.w, h: e.h });
      else if (e.k === "mover") { const m: Mover = { x: e.x, y: e.y, w: e.w, x0: e.x, y0: e.y, dx: e.dx, dy: e.dy, period: e.period, phase: e.phase ?? 0, vx: 0, vy: 0 }; const pos = moverPos(m, 0); m.x = pos.x; m.y = pos.y; this.movers.push(m); }
      else if (e.k === "feather" || e.k === "heart") this.items.push({ id: this.nextId++, k: e.k, x: e.x, y: e.y, vx: 0, vy: 0, popT: 0, alive: true, baseY: e.y });
      else if (e.k === "boss") this.boss = { x: e.x, y: e.y, vx: 0, hp: 3, state: "intro", t: 0, boltT: 2, inv: 0, w: 3, h: 2.4 };
    }
  }

  private makeEnemy(k: Enemy["k"], x: number, y: number, range: number, amp: number): Enemy {
    return { id: this.nextId++, k, x, y, vx: 0, vy: 0, w: k === "buzzer" ? 0.9 : 0.95, h: k === "buzzer" ? 0.75 : 0.85, alive: true, deadT: 0, dir: -1, baseX: x, baseY: y, range, amp, t: this.rng() * 6, active: false, squash: false };
  }
  private ev(t: string, x: number, y: number, n?: number, s?: string) { this.events.push({ t, x: r2(x), y: r2(y), n, s }); }

  tile(c: number, r: number) {
    if (c < 0 || c >= this.w) return T.METAL;
    if (r < 0 || r >= this.h) return T.EMPTY;
    return this.tiles[r * this.w + c];
  }
  private setTile(c: number, r: number, t: number) { if (c >= 0 && c < this.w && r >= 0 && r < this.h) this.tiles[r * this.w + c] = t; }
  solid(c: number, r: number) { return isSolidTile(this.tile(c, r)); }

  // ── main step ──
  step(dt: number, input: Input) {
    this.events.length = 0;
    this.time += dt;
    this.updateMovers(dt);
    this.updateCrumbles(dt);
    for (let i = this.bumps.length - 1; i >= 0; i--) { this.bumps[i].t += dt; if (this.bumps[i].t > 0.25) this.bumps.splice(i, 1); }
    for (const s of this.springs) s.t = Math.max(0, s.t - dt);
    if (this.state === "win") { this.winT += dt; this.stepWin(dt); return; }
    const p = this.p;
    if (p.respawnT > 0) { p.respawnT -= dt; if (p.respawnT <= 0) this.respawn(); return; }
    this.stepPlayer(dt, input);
    this.updateEnemies(dt);
    this.updateItems(dt);
    if (this.boss) this.updateBoss(dt);
    this.collisions();
    if (p.y < -4) this.fellOut();
  }

  private updateMovers(dt: number) {
    for (const m of this.movers) {
      const pos = moverPos(m, this.time);
      m.vx = (pos.x - m.x) / dt; m.vy = (pos.y - m.y) / dt; m.x = pos.x; m.y = pos.y;
    }
  }
  private updateCrumbles(dt: number) {
    for (let i = this.crumbles.length - 1; i >= 0; i--) {
      const c = this.crumbles[i]; c.t += dt;
      if (!c.fallen && c.t > 0.5) { c.fallen = true; c.t = 0; this.tiles[c.idx] = T.EMPTY; this.ev("crumble", c.idx % this.w + 0.5, Math.floor(c.idx / this.w) + 0.5); }
      else if (c.fallen && c.t > 4) {
        const col = c.idx % this.w, row = Math.floor(c.idx / this.w), p = this.p;
        const overlap = p.x + PW / 2 > col && p.x - PW / 2 < col + 1 && p.y < row + 1 && p.y + PH > row;
        if (!overlap) { this.tiles[c.idx] = T.CRUMBLE; this.crumbles.splice(i, 1); }
      }
    }
  }
  private touchCrumble(c: number, r: number) {
    const idx = r * this.w + c;
    if (this.tiles[idx] !== T.CRUMBLE) return;
    if (!this.crumbles.some(x => x.idx === idx)) { this.crumbles.push({ idx, t: 0, fallen: false, back: 0 }); this.ev("shake", c + 0.5, r + 0.5); }
  }

  private stepPlayer(dt: number, input: Input) {
    const p = this.p;
    const pressed = input.jump && !p.jumpHeld;
    p.jumpHeld = input.jump;
    p.invT = Math.max(0, p.invT - dt); p.lockT = Math.max(0, p.lockT - dt); p.landT = Math.max(0, p.landT - dt); p.jumpT += dt;
    if (p.starT > 0) { p.starT -= dt; if (p.starT <= 0) this.ev("starEnd", p.x, p.y); }
    if (pressed) p.jumpBuf = PHYS.jumpBuffer; else p.jumpBuf = Math.max(0, p.jumpBuf - dt);
    if (p.grounded) { p.coyote = PHYS.coyote; p.airJumps = p.power ? 1 : 0; p.glideReady = false; } else p.coyote = Math.max(0, p.coyote - dt);
    p.wallCoyote = Math.max(0, p.wallCoyote - dt);

    // ground pound
    if (p.pound === 0 && input.down && !p.grounded && p.respawnT <= 0) { p.pound = 1; p.poundT = PHYS.poundStall; p.vx = 0; p.vy = 0; p.gliding = false; this.ev("poundStart", p.x, p.y); }
    if (p.pound === 1) { p.poundT -= dt; if (p.poundT <= 0) { p.pound = 2; p.vy = -PHYS.poundV; } else { this.moveY(0); return; } }

    // horizontal
    const dir = p.lockT > 0 || p.pound ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir) p.face = dir as 1 | -1;
    const ice = p.grounded && p.groundTile === T.ICE;
    const max = p.starT > 0 ? PHYS.starRun : p.gliding ? PHYS.glideRun : PHYS.run;
    const acc = p.grounded ? (ice ? PHYS.iceAcc : PHYS.accG) : PHYS.accAir;
    const dec = p.grounded ? (ice ? PHYS.iceDec : PHYS.decG) : PHYS.accAir * 0.35;
    if (dir) {
      const target = dir * max;
      const a = Math.sign(target - p.vx) === Math.sign(p.vx) || p.vx === 0 ? acc : acc * 1.6; // turning is snappier
      p.vx += Math.sign(target - p.vx) * Math.min(Math.abs(target - p.vx), a * dt);
    } else if (p.lockT <= 0) {
      p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx), dec * dt);
    }

    // jumping
    if (p.jumpBuf > 0 && p.pound === 0) {
      if (p.grounded || p.coyote > 0) {
        p.vy = PHYS.jumpV; p.grounded = false; p.coyote = 0; p.jumpBuf = 0; p.mover = -1; p.jumpT = 0; p.glideReady = false;
        this.ev("jump", p.x, p.y);
      } else if (p.wallSliding || p.wallCoyote > 0) {
        const wd = p.wallDir || 1;
        p.vx = -wd * PHYS.wallJumpVx; p.vy = PHYS.wallJumpVy; p.face = (-wd) as 1 | -1; p.lockT = 0.17; p.jumpBuf = 0; p.wallSliding = false; p.wallCoyote = 0; p.jumpT = 0; p.glideReady = false;
        this.ev("walljump", p.x, p.y);
      } else if (p.airJumps > 0 && !p.gliding) {
        p.airJumps--; p.vy = PHYS.doubleJumpV; p.jumpBuf = 0; p.jumpT = 0; p.glideReady = false;
        this.ev("flutter", p.x, p.y);
      } else if (!p.gliding && p.glideReady) {
        p.gliding = true; p.jumpBuf = 0; this.ev("glide", p.x, p.y);
      }
    }
    if (!p.grounded && !input.jump) p.glideReady = true; // a fresh press in the air opens the glider
    if (p.gliding && (!input.jump || p.grounded || p.pound)) p.gliding = false;

    // updrafts
    p.inUpdraft = false;
    for (const u of this.updrafts) if (p.x > u.x && p.x < u.x + u.w && p.y + PH * 0.5 > u.y && p.y < u.y + u.h) { p.inUpdraft = true; break; }

    // gravity
    if (p.pound === 2) { p.vy = -PHYS.poundV; }
    else if (p.inUpdraft && p.gliding) { p.vy = Math.min(11, p.vy + 75 * dt); }
    else {
      const g = p.vy > 0 ? (input.jump || p.jumpT > 0.6 ? PHYS.gUpHold : PHYS.gUpRel) : PHYS.gDown;
      p.vy -= (p.inUpdraft ? g * 0.35 : g) * dt;
      if (p.gliding) p.vy = Math.max(p.vy, -(p.power ? PHYS.featherGlideFall : PHYS.glideFall));
      p.vy = Math.max(p.vy, -PHYS.maxFall);
    }

    // ride movers
    if (p.mover >= 0) { const m = this.movers[p.mover]; this.moveX(m.vx * dt, true); p.y += m.vy * dt; }

    this.moveX(p.vx * dt, false);

    // wall slide
    p.wallSliding = false;
    if (!p.grounded && p.pound === 0 && p.vy < 0 && dir !== 0 && this.wallAt(dir)) {
      p.wallSliding = true; p.wallDir = dir as 1 | -1; p.wallCoyote = 0.12; p.gliding = false;
      p.vy = Math.max(p.vy, -PHYS.wallSlide);
    }

    this.moveY(p.vy * dt);
  }

  private wallAt(dir: number) {
    const p = this.p; const x = dir > 0 ? p.x + PW / 2 + 0.06 : p.x - PW / 2 - 0.06;
    const c = Math.floor(x);
    for (let r = Math.floor(p.y + 0.3); r <= Math.floor(p.y + PH - 0.3); r++) if (this.solid(c, r) && this.tile(c, r) !== T.CRUMBLE) return true;
    return false;
  }

  private moveX(dx: number, carried: boolean) {
    const p = this.p;
    if (dx === 0) return;
    let nx = p.x + dx;
    const edge = dx > 0 ? nx + PW / 2 : nx - PW / 2;
    const c = Math.floor(edge);
    const r0 = Math.floor(p.y + EPS), r1 = Math.floor(p.y + PH - EPS);
    for (let r = r0; r <= r1; r++) {
      if (this.solid(c, r)) {
        nx = dx > 0 ? c - PW / 2 - EPS : c + 1 + PW / 2 + EPS;
        if (!carried) p.vx = 0;
        break;
      }
    }
    p.x = nx;
  }

  private moveY(dy: number) {
    const p = this.p;
    const oldY = p.y;
    let ny = p.y + dy;
    const c0 = Math.floor(p.x - PW / 2 + EPS), c1 = Math.floor(p.x + PW / 2 - EPS);
    const wasGrounded = p.grounded;
    p.grounded = false;
    if (dy <= 0) {
      // land on tiles
      const rTop = Math.floor(oldY - EPS), rBot = Math.floor(ny);
      for (let r = rTop; r >= rBot; r--) {
        let hitTile = -1, hitCol = -1, topOnly = false;
        for (let c = c0; c <= c1; c++) {
          const t = this.tile(c, r);
          if (isSolidTile(t) || (isTopOnly(t) && oldY >= r + 1 - 0.05)) {
            if (p.pound === 2 && t === T.BRICK) { this.breakBrick(c, r); continue; }
            if (p.pound === 2 && t === T.CRUMBLE) { this.touchCrumble(c, r); }
            if (hitTile < 0 || Math.abs(c + 0.5 - p.x) < Math.abs(hitCol + 0.5 - p.x)) { hitTile = t; hitCol = c; topOnly = isTopOnly(t); }
          }
        }
        if (hitTile >= 0) { ny = r + 1; void topOnly; this.land(hitTile, hitCol, r, wasGrounded); p.y = ny; this.checkMoversLanding(oldY); return; }
      }
      p.y = ny;
      this.checkMoversLanding(oldY);
      if (!p.grounded) p.groundTile = 0;
    } else {
      const rHead = Math.floor(ny + PH);
      for (let c = c0; c <= c1; c++) {
        if (this.solid(c, rHead)) {
          // bump the block closest to the head center
          let best = c; for (let k = c0; k <= c1; k++) if (this.solid(k, rHead) && Math.abs(k + 0.5 - p.x) < Math.abs(best + 0.5 - p.x)) best = k;
          ny = rHead - PH - EPS; p.vy = Math.min(0, p.vy) - 1;
          this.bumpBlock(best, rHead, false);
          break;
        }
      }
      p.y = ny; p.mover = -1;
    }
  }

  private checkMoversLanding(oldY: number) {
    const p = this.p;
    if (p.grounded) { p.mover = -1; return; }
    p.mover = -1;
    for (let i = 0; i < this.movers.length; i++) {
      const m = this.movers[i]; const top = m.y + 1;
      if (p.vy <= 0 && oldY >= top - 0.12 + Math.min(0, m.vy) / 120 && p.y <= top && p.x + PW / 2 > m.x && p.x - PW / 2 < m.x + m.w) {
        const was = p.grounded; p.y = top; this.land(T.ONEWAY, -1, -1, was); p.mover = i; return;
      }
    }
  }

  private land(t: number, c: number, r: number, wasGrounded: boolean) {
    const p = this.p;
    if (t === T.BOUNCE) { p.vy = p.jumpHeld ? PHYS.bounceHold : PHYS.bounce; p.grounded = false; p.pound = 0; p.gliding = false; p.glideReady = false; p.jumpT = 10; this.ev("bounce", p.x, p.y); return; }
    const hard = p.vy < -14;
    if (p.pound === 2) {
      p.pound = 0; this.ev("pound", p.x, p.y);
      this.shockwave(p.x, p.y);
      if (c >= 0) { const tt = this.tile(c, r); if (tt === T.GIFT) this.bumpBlock(c, r, true); }
    } else if (!wasGrounded) { this.ev(hard ? "landHard" : "land", p.x, p.y); p.landT = hard ? 0.16 : 0.1; }
    p.vy = 0; p.grounded = true; p.groundTile = t; p.gliding = false;
    if (c >= 0 && t === T.CRUMBLE) this.touchCrumble(c, r);
  }

  private breakBrick(c: number, r: number) {
    this.setTile(c, r, T.EMPTY); this.ev("break", c + 0.5, r + 0.5);
    this.killOnBlock(c, r);
  }
  private bumpBlock(c: number, r: number, fromAbove: boolean) {
    const t = this.tile(c, r);
    const p = this.p;
    if (t === T.BRICK) {
      if (p.power || fromAbove) { this.breakBrick(c, r); return; }
      this.bumps.push({ c, r, t: 0 }); this.ev("bump", c + 0.5, r + 0.5); this.killOnBlock(c, r);
    } else if (t === T.GIFT) {
      const idx = r * this.w + c; const g = this.gifts[idx] || "gem";
      this.bumps.push({ c, r, t: 0 });
      this.killOnBlock(c, r);
      if (g === "gems") {
        this.giftHits[idx] = (this.giftHits[idx] || 0) + 1;
        this.addGem(c + 0.5, r + 1.3, true);
        if (this.giftHits[idx] >= 5) this.setTile(c, r, T.USED);
      } else {
        this.setTile(c, r, T.USED);
        if (g === "gem") this.addGem(c + 0.5, r + 1.3, true);
        else { this.items.push({ id: this.nextId++, k: g, x: c + 0.5, y: r + 1, vx: 0, vy: 0, popT: 0.45, alive: true, baseY: r + 1 }); this.ev("sprout", c + 0.5, r + 1, 0, g); }
      }
    } else if (isSolidTile(t)) this.ev("thud", c + 0.5, r + 0.5);
  }
  private killOnBlock(c: number, r: number) {
    for (const e of this.enemies) if (e.alive && e.k !== "buzzer" && Math.abs(e.x - (c + 0.5)) < 0.9 && Math.abs(e.y - (r + 1)) < 0.3) this.killEnemy(e, "flip");
  }

  private addGem(x: number, y: number, pop: boolean) {
    this.gems++;
    this.ev(pop ? "gemPop" : "gem", x, y, this.gems);
    this.gemHearts++;
    if (this.gemHearts >= 50) { this.gemHearts = 0; if (this.p.hearts < 5) { this.p.hearts++; this.ev("heartUp", this.p.x, this.p.y + 1.5); } }
  }

  private shockwave(x: number, y: number) {
    for (const e of this.enemies) if (e.alive && Math.abs(e.x - x) < 2.4 && Math.abs(e.y - y) < 1.2) this.killEnemy(e, "flip");
    if (this.boss && this.boss.state === "dazed" && Math.abs(this.boss.x - x) < 3.2 && Math.abs(this.boss.y - y) < 1) this.hitBoss();
  }

  private killEnemy(e: Enemy, how: "stomp" | "flip") {
    if (!e.alive) return;
    e.alive = false; e.deadT = 0; e.squash = how === "stomp"; e.vy = how === "flip" ? 9 : 0; this.stomps++;
    this.ev(how === "stomp" ? "stomp" : "kick", e.x, e.y + e.h / 2, 0, e.k);
  }

  hurt(fromX: number) {
    const p = this.p;
    if (p.invT > 0 || p.starT > 0 || p.respawnT > 0 || this.state !== "play") return;
    if (p.power) { p.power = 0; p.airJumps = 0; this.ev("powerDown", p.x, p.y); }
    else { p.hearts--; this.ev("hurt", p.x, p.y, p.hearts); }
    p.invT = 1.6; p.vx = Math.sign(p.x - fromX || -p.face) * 7; p.vy = 10; p.pound = 0; p.gliding = false; p.lockT = 0.25;
    if (p.hearts <= 0) this.faint();
  }
  private faint() { const p = this.p; p.respawnT = 1.3; this.retries++; this.ev("faint", p.x, p.y); }
  private fellOut() {
    const p = this.p; if (p.respawnT > 0) return;
    p.hearts--; this.ev("fall", p.x, 0, p.hearts);
    if (p.hearts <= 0) this.retries++;
    p.respawnT = 0.9;
  }
  private respawn() {
    const p = this.p;
    if (p.hearts <= 0) p.hearts = 3;
    p.x = this.spawn.x; p.y = this.spawn.y; p.vx = 0; p.vy = 0; p.invT = 1.5; p.pound = 0; p.gliding = false; p.grounded = false; p.mover = -1; p.starT = 0;
    this.bolts.length = 0;
    this.ev("respawn", p.x, p.y);
  }

  private updateEnemies(dt: number) {
    const p = this.p;
    for (const e of this.enemies) {
      if (!e.alive) { e.deadT += dt; if (!e.squash) { e.vy -= 40 * dt; e.y += e.vy * dt; } continue; }
      if (!e.active) { if (Math.abs(e.x - p.x) < 22) e.active = true; else continue; }
      e.t += dt;
      if (e.k === "buzzer") {
        const s = Math.sin(e.t * (2.4 / Math.max(1, e.range)) * 1.2);
        const nx = e.baseX + s * e.range; e.dir = nx > e.x ? 1 : -1; e.x = nx; e.y = e.baseY + Math.sin(e.t * 3.1) * e.amp * 0.6;
        continue;
      }
      const speed = e.k === "spiky" ? 1.4 : 2;
      e.vx = e.dir * speed; e.vy = Math.max(e.vy - 50 * dt, -20);
      // horizontal with wall + ledge turning
      let nx = e.x + e.vx * dt;
      const front = e.dir > 0 ? nx + e.w / 2 : nx - e.w / 2;
      const fc = Math.floor(front), rr = Math.floor(e.y + 0.2);
      const onGround = this.enemyOnGround(e);
      if (this.solid(fc, rr) || (onGround && !this.supportAt(front + e.dir * 0.05, e.y))) { e.dir = (-e.dir) as 1 | -1; nx = e.x; }
      e.x = nx;
      // vertical
      let ny = e.y + e.vy * dt;
      if (e.vy <= 0) {
        const r = Math.floor(ny);
        for (let c = Math.floor(e.x - e.w / 2 + 0.05); c <= Math.floor(e.x + e.w / 2 - 0.05); c++) {
          const t = this.tile(c, r);
          if (isSolidTile(t) || (isTopOnly(t) && e.y >= r + 1 - 0.05)) { ny = r + 1; e.vy = 0; break; }
        }
        for (const m of this.movers) if (e.y >= m.y + 1 - 0.1 && ny <= m.y + 1 && e.x > m.x && e.x < m.x + m.w) { ny = m.y + 1; e.vy = 0; e.x += m.vx * dt; }
      }
      e.y = ny;
      if (e.y < -6) e.alive = false;
    }
  }
  private enemyOnGround(e: Enemy) { return this.supportAt(e.x, e.y); }
  private supportAt(x: number, y: number) {
    const c = Math.floor(x), r = Math.floor(y - 0.05);
    const t = this.tile(c, r);
    if (isSolidTile(t) || isTopOnly(t)) return Math.abs(y - (r + 1)) < 0.1;
    for (const m of this.movers) if (x > m.x && x < m.x + m.w && Math.abs(y - (m.y + 1)) < 0.12) return true;
    return false;
  }

  private updateItems(dt: number) {
    for (const it of this.items) {
      if (!it.alive) continue;
      if (it.popT > 0) { it.popT -= dt; it.y += dt * 2.4; it.baseY = it.y; if (it.popT <= 0 && it.k === "star") { it.vx = 3; it.vy = 8; } continue; }
      if (it.k === "star") {
        it.vy -= 30 * dt; let nx = it.x + it.vx * dt;
        if (this.solid(Math.floor(nx + Math.sign(it.vx) * 0.35), Math.floor(it.y + 0.3))) { it.vx = -it.vx; nx = it.x; }
        it.x = nx; let ny = it.y + it.vy * dt;
        if (it.vy < 0) { const r = Math.floor(ny); const t = this.tile(Math.floor(it.x), r); if (isSolidTile(t) || isTopOnly(t)) { ny = r + 1; it.vy = 10; } }
        else if (this.solid(Math.floor(it.x), Math.floor(ny + 0.7))) it.vy = 0;
        it.y = ny; if (it.y < -6) it.alive = false;
      } else it.y = it.baseY + Math.sin(this.time * 2.6 + it.id) * 0.15;
    }
  }

  // ── boss: the Storm King ──
  private updateBoss(dt: number) {
    const b = this.boss!; const p = this.p;
    b.t += dt; b.inv = Math.max(0, b.inv - dt);
    const arenaMid = this.w / 2;
    const speedUp = (3 - b.hp) * 0.25;
    switch (b.state) {
      case "intro": b.y = 12 + Math.sin(b.t * 2) * 0.3; if (b.t > 2.2) { b.state = "hover"; b.t = 0; this.ev("bossRoar", b.x, b.y); } break;
      case "hover": {
        const target = clamp(p.x, 4, this.w - 4);
        b.vx += Math.sign(target - b.x) * 9 * dt; b.vx = clamp(b.vx, -(3 + speedUp * 4), 3 + speedUp * 4); b.x += b.vx * dt;
        b.y = 11.5 + Math.sin(b.t * 2.2) * 0.5;
        b.boltT -= dt;
        if (b.boltT <= 0) { b.boltT = 1.25 - speedUp; this.bolts.push({ x: clamp(p.x + (this.rng() - 0.5) * 2, 2, this.w - 2), warn: 0.85, strike: 0.35 }); this.ev("boltWarn", p.x, 3); }
        if (b.t > 4.2 - speedUp * 2) { b.state = "windup"; b.t = 0; b.vx = 0; this.ev("bossWindup", b.x, b.y); }
        break;
      }
      case "windup": b.x += (clamp(p.x, 4, this.w - 4) - b.x) * Math.min(1, dt * 3); b.y = 12 + Math.sin(b.t * 40) * 0.12; if (b.t > 0.7) { b.state = "slam"; b.t = 0; } break;
      case "slam": b.y -= 26 * dt; if (b.y <= 3) { b.y = 3; b.state = "dazed"; b.t = 0; this.ev("bossSlam", b.x, 3); if (p.grounded && Math.abs(p.x - b.x) < 4.5 && Math.abs(p.y - 3) < 0.5) this.hurt(b.x); } break;
      case "dazed": if (b.t > 2.6 - speedUp) { b.state = "rise"; b.t = 0; } break;
      case "hurt": if (b.t > 0.9) { b.state = "rise"; b.t = 0; if (b.hp > 0) { this.enemies.push(this.makeEnemy("puff", 3, 3, 0, 0)); this.enemies.push(this.makeEnemy("puff", this.w - 3, 3, 0, 0)); this.ev("bossSummon", arenaMid, 3); } } break;
      case "rise": b.y += 9 * dt; if (b.y >= 11.5) { b.y = 11.5; b.state = b.hp <= 0 ? "defeated" : "hover"; b.t = 0; } break;
      case "defeated":
        if (b.t > 2.4) {
          b.state = "gone";
          this.goal = { x: arenaMid, y: 3 };
          for (let i = 0; i < 16; i++) this.gemList.push({ x: arenaMid - 7.5 + i, y: 5 + Math.sin(i) * 0.6, alive: true });
          this.gemsTotal += 16;
          this.ev("bossGone", b.x, b.y);
        }
        break;
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const bo = this.bolts[i];
      if (bo.warn > 0) { bo.warn -= dt; if (bo.warn <= 0) this.ev("bolt", bo.x, 3); continue; }
      bo.strike -= dt;
      if (Math.abs(p.x - bo.x) < 0.85) this.hurt(bo.x);
      if (bo.strike <= 0) this.bolts.splice(i, 1);
    }
    if (b.state === "defeated" || b.state === "gone") this.bolts.length = 0;
  }
  private hitBoss() {
    const b = this.boss!;
    if (b.inv > 0 || b.state !== "dazed") return;
    b.hp--; b.inv = 1.2; b.t = 0; b.state = b.hp <= 0 ? "rise" : "hurt";
    this.ev(b.hp <= 0 ? "bossDefeat" : "bossHit", b.x, b.y + 1.5, b.hp);
    for (const e of this.enemies) if (e.alive) this.killEnemy(e, "flip");
  }

  private collisions() {
    const p = this.p;
    if (p.respawnT > 0) return;
    const pl = p.x - PW / 2, pr = p.x + PW / 2, pb = p.y, pt = p.y + PH;
    // gems & shards
    for (const g of this.gemList) if (g.alive && Math.abs(g.x - p.x) < 0.75 && g.y > pb - 0.45 && g.y < pt + 0.4) { g.alive = false; this.addGem(g.x, g.y, false); }
    for (const s of this.shardList) if (s.alive && Math.abs(s.x - p.x) < 0.9 && s.y > pb - 0.6 && s.y < pt + 0.6) { s.alive = false; this.shards |= 1 << s.i; this.ev("shard", s.x, s.y, s.i); }
    // checkpoints
    for (let i = 0; i < this.checks.length; i++) {
      const c = this.checks[i];
      if (!c.lit && p.x > c.x - 0.6 && Math.abs(p.y - c.y) < 4) {
        for (let j = 0; j <= i; j++) this.checks[j].lit = true;
        this.spawn = { x: c.x, y: c.y };
        if (p.hearts < 3) p.hearts = 3;
        this.ev("check", c.x, c.y + 1);
      }
    }
    // springs
    for (const s of this.springs) {
      if (p.vy <= 0 && pr > s.x + 0.05 && pl < s.x + 0.95 && pb <= s.y + 0.75 && pb >= s.y + 0.1 - (p.pound ? 1 : 0.35)) {
        const pound = p.pound === 2;
        p.vy = pound ? PHYS.springPound : PHYS.spring; p.y = s.y + 0.75; p.pound = 0; p.grounded = false; p.gliding = false; p.glideReady = false; p.jumpT = 10; s.t = 0.3; p.mover = -1;
        this.ev("spring", s.x + 0.5, s.y + 0.7);
      }
    }
    // spikes (hazard tiles)
    for (let c = Math.floor(pl); c <= Math.floor(pr - EPS); c++) for (let r = Math.floor(pb); r <= Math.floor(pt); r++) {
      if (this.tile(c, r) === T.SPIKE && pb < r + 0.55 && pr > c + 0.12 && pl < c + 0.88) { this.hurt(c + 0.5); if (p.vy < 8) p.vy = 13; }
    }
    // items
    for (const it of this.items) {
      if (!it.alive || it.popT > 0) continue;
      if (Math.abs(it.x - p.x) < 0.85 && it.y + 0.8 > pb && it.y < pt) {
        it.alive = false;
        if (it.k === "feather") { p.power = 1; p.airJumps = 1; this.ev("powerUp", p.x, p.y + 1); }
        else if (it.k === "star") { p.starT = 9; this.ev("star", p.x, p.y + 1); }
        else { p.hearts = Math.min(5, p.hearts + 1); this.ev("heartUp", p.x, p.y + 1.5); }
      }
    }
    // enemies
    for (const e of this.enemies) {
      if (!e.alive || !e.active) continue;
      const el = e.x - e.w / 2, er = e.x + e.w / 2, eb = e.y, et = e.y + e.h;
      if (pr < el || pl > er || pt < eb || pb > et) continue;
      if (p.starT > 0) { this.killEnemy(e, "flip"); continue; }
      const fromAbove = p.vy < 0 && pb > eb + e.h * 0.4;
      if (fromAbove && e.k !== "spiky") {
        this.killEnemy(e, "stomp");
        if (p.pound !== 2) { p.vy = p.jumpHeld ? PHYS.stompHold : PHYS.stomp; p.glideReady = false; p.gliding = false; p.jumpT = 0; }
        if (p.power) p.airJumps = 1;
      } else if (p.invT <= 0) this.hurt(e.x);
    }
    // boss body
    const b = this.boss;
    if (b && b.state !== "gone" && b.state !== "defeated" && b.state !== "intro") {
      const bl = b.x - b.w / 2, br = b.x + b.w / 2, bb = b.y, bt = b.y + b.h;
      if (!(pr < bl || pl > br || pt < bb || pb > bt)) {
        if (b.state === "dazed" && p.vy < 0 && pb > bb + b.h * 0.5) { this.hitBoss(); p.vy = PHYS.stompHold; p.pound = 0; }
        else if (b.state === "dazed" || b.state === "hurt") { p.vx = Math.sign(p.x - b.x || 1) * 9; }
        else this.hurt(b.x);
      }
    }
    // goal
    if (this.goal && this.state === "play" && Math.abs(p.x - this.goal.x) < 0.9 && p.y < this.goal.y + 4 && p.y + PH > this.goal.y) {
      this.state = "win"; this.winT = 0; p.vx = 0; p.gliding = false; p.pound = 0; this.ev("win", this.goal.x, this.goal.y);
    }
  }

  private stepWin(dt: number) {
    const p = this.p, g = this.goal!;
    p.x += (g.x - p.x) * Math.min(1, dt * 4);
    p.vy = 0; p.y += ((g.y + 1) - p.y) * Math.min(1, dt * 2);
  }

  result() {
    return { levelId: this.level.id, time: Math.round(this.time * 100) / 100, gems: this.gems, gemsTotal: this.gemsTotal, shards: this.shards, retries: this.retries, stomps: this.stomps };
  }
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
export const PLAYER_SIZE = { w: PW, h: PH };
