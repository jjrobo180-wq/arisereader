// Prism Paintball — authoritative room simulation, bot AI and shot validation.
import { randomInt } from "node:crypto";
import {
  PB, F, MAP, WEAPONS, clamp, wrapAngle, groundAt, stepBody, lineOfSight, raycastWorld, rayPlayer,
  pelletDirs, ballisticPos, projectileWorldHit, muzzlePos, aimDir, resolveHorizontal, round2, round3,
  type Team, type Phase, type BotLevel, type GameEvent, type PlayerMeta, type RoomMeta, type Snapshot,
  type ClientSync, type ClientEvent, type V3, type Body, type WeaponDef,
} from "../shared/paintball";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShotRecord { id: number; t: number; w: number; o: V3; dirs: V3[]; claimed: boolean[] }
interface HistSample { t: number; x: number; y: number; z: number; crouch: boolean }

interface BotBrain {
  level: BotLevel;
  targetId: number;
  reactAt: number;
  acquiredAt: number;
  path: { x: number; z: number }[];
  pathIdx: number;
  goal: { x: number; z: number } | null;
  repathAt: number;
  strafe: number;
  strafeUntil: number;
  nextShotAt: number;
  burstLeft: number;
  mag: number;
  reloadUntil: number;
  lastProgressAt: number;
  lastPos: { x: number; z: number };
  jumpAt: number;
  crouchUntil: number;
  aimYaw: number;
  aimPitch: number;
  errYaw: number;
  errPitch: number;
  lastKnown: { x: number; z: number; t: number } | null;
  retreating: boolean;
}

export interface SPlayer {
  id: number;
  name: string;
  team: Team;
  bot: BotBrain | null;
  look: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  yaw: number; pitch: number;
  flags: number; // client-reported pose bits (grounded/sprint/ads/crouch/reload/firing)
  weapon: number;
  hp: number;
  alive: boolean;
  life: number;
  respawnAt: number;
  protectedUntil: number;
  lastDamageAt: number;
  lastStateAt: number;
  needsFix: boolean;
  tags: number; downs: number; streak: number; best: number;
  lastSeen: number;
  connected: boolean;
  hist: HistSample[];
  shots: ShotRecord[];
  fireTokens: number;
  fireTokensAt: number;
  grounded: boolean;
  firingUntil: number;
  // websocket transport bookkeeping
  wsSentSeq: number;
  wsSentMv: number;
  wsEcho?: number;
  scope: string;
}

interface BotShot { by: number; team: Team; w: WeaponDef; o: V3; d: V3; t0: number; age: number }

export interface Room {
  code: string;
  hostId: number;
  phase: Phase;
  phaseEnds: number;
  scores: [number, number];
  players: SPlayer[];
  events: GameEvent[];
  seq: number;
  metaV: number;
  publicLobby: boolean;
  practice: boolean;
  quick: boolean;
  botLevel: BotLevel;
  botTarget: number;
  scope: string;
  createdAt: number;
  winner: Team | -1 | null;
  shots: BotShot[];
  tickCount: number;
}

// ---------------------------------------------------------------------------
// Navigation grid (ground level) for bots
// ---------------------------------------------------------------------------

const CELL = 1;
const GX = Math.round((PB.ARENA_X * 2) / CELL);
const GZ = Math.round((PB.ARENA_Z * 2) / CELL);
let navBlocked: Uint8Array | null = null;

function cellCenter(i: number, j: number) { return { x: -PB.ARENA_X + (i + 0.5) * CELL, z: -PB.ARENA_Z + (j + 0.5) * CELL }; }
function cellOf(x: number, z: number) {
  return { i: clamp(Math.floor((x + PB.ARENA_X) / CELL), 0, GX - 1), j: clamp(Math.floor((z + PB.ARENA_Z) / CELL), 0, GZ - 1) };
}
function nav(): Uint8Array {
  if (navBlocked) return navBlocked;
  const g = new Uint8Array(GX * GZ);
  for (let j = 0; j < GZ; j++) for (let i = 0; i < GX; i++) {
    const c = cellCenter(i, j);
    const p = { x: c.x, y: 0, z: c.z };
    if (resolveHorizontal(p, 0.62, PB.HEIGHT)) g[i + j * GX] = 1;
  }
  navBlocked = g;
  return g;
}
const walkable = (i: number, j: number) => i >= 0 && j >= 0 && i < GX && j < GZ && !nav()[i + j * GX];

function nearestWalkable(i: number, j: number) {
  if (walkable(i, j)) return { i, j };
  for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    if (walkable(i + di, j + dj)) return { i: i + di, j: j + dj };
  }
  return { i, j };
}

function gridLineClear(ax: number, az: number, bx: number, bz: number) {
  const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / 0.4);
  for (let k = 1; k < n; k++) {
    const t = k / n, c = cellOf(ax + (bx - ax) * t, az + (bz - az) * t);
    if (!walkable(c.i, c.j)) return false;
  }
  return true;
}

function findPath(sx: number, sz: number, tx: number, tz: number): { x: number; z: number }[] {
  const s0 = cellOf(sx, sz), t0 = cellOf(tx, tz);
  const s = nearestWalkable(s0.i, s0.j), t = nearestWalkable(t0.i, t0.j);
  const N = GX * GZ, start = s.i + s.j * GX, goal = t.i + t.j * GX;
  if (start === goal) return [{ x: tx, z: tz }];
  const gScore = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap: number[] = [], fOf = new Float32Array(N);
  const push = (n: number) => {
    heap.push(n); let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (fOf[heap[p]] <= fOf[heap[i]]) break; const tmp = heap[p]; heap[p] = heap[i]; heap[i] = tmp; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last; let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < heap.length && fOf[heap[l]] < fOf[heap[m]]) m = l;
        if (r < heap.length && fOf[heap[r]] < fOf[heap[m]]) m = r;
        if (m === i) break; const tmp = heap[m]; heap[m] = heap[i]; heap[i] = tmp; i = m;
      }
    }
    return top;
  };
  const h = (n: number) => { const dx = Math.abs((n % GX) - t.i), dz = Math.abs(Math.floor(n / GX) - t.j); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  gScore[start] = 0; fOf[start] = h(start); push(start);
  let found = false, iter = 0;
  while (heap.length && iter++ < 6000) {
    const cur = pop();
    if (cur === goal) { found = true; break; }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const ci = cur % GX, cj = Math.floor(cur / GX);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = ci + di, nj = cj + dj;
      if (!walkable(ni, nj)) continue;
      if (di && dj && (!walkable(ci + di, cj) || !walkable(ci, cj + dj))) continue;
      const n = ni + nj * GX, g = gScore[cur] + (di && dj ? 1.414 : 1);
      if (g < gScore[n]) { gScore[n] = g; came[n] = cur; fOf[n] = g + h(n); push(n); }
    }
  }
  if (!found) return [{ x: tx, z: tz }];
  const cells: { x: number; z: number }[] = [];
  for (let n = goal; n !== -1 && n !== start; n = came[n]) cells.push(cellCenter(n % GX, Math.floor(n / GX)));
  cells.reverse();
  cells[cells.length - 1] = { x: tx, z: tz };
  // string pulling
  const out: { x: number; z: number }[] = [];
  let ax = sx, az = sz, k = 0;
  while (k < cells.length) {
    let far = k;
    for (let m = cells.length - 1; m > k; m--) if (gridLineClear(ax, az, cells[m].x, cells[m].z)) { far = m; break; }
    out.push(cells[far]); ax = cells[far].x; az = cells[far].z; k = far + 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export const rooms = new Map<string, Room>();
const BOT_NAMES = ["Pixel", "Nova", "Bolt", "Rocket", "Comet", "Echo", "Flare", "Jinx", "Mango", "Orbit", "Rio", "Sprocket", "Turbo", "Zest", "Kiwi", "Blip", "Fizz", "Luna"];

function newEvent(room: Room, ev: any) {
  room.seq++;
  ev.s = room.seq;
  room.events.push(ev as GameEvent);
  if (room.events.length > 240) room.events.splice(0, room.events.length - 240);
}
export function bumpMeta(room: Room) { room.metaV++; }

export function roomMeta(room: Room): RoomMeta {
  return {
    v: room.metaV,
    code: room.code,
    hostId: room.hostId,
    publicLobby: room.publicLobby,
    practice: room.practice,
    quick: room.quick,
    botLevel: room.botLevel,
    winner: room.winner,
    players: room.players.map((p): PlayerMeta => ({
      id: p.id, name: p.name, team: p.team, bot: !!p.bot, look: p.look,
      tags: p.tags, downs: p.downs, streak: p.streak, best: p.best, connected: p.connected,
    })),
  };
}

function makePlayer(id: number, name: string, team: Team, bot: BotLevel | null, scope: string): SPlayer {
  const now = Date.now();
  return {
    id, name, team, look: randomInt(0, 1_000_000), scope,
    bot: bot ? makeBrain(bot) : null,
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: team === 0 ? Math.PI / 2 : -Math.PI / 2, pitch: 0,
    flags: F.GROUNDED, weapon: 0, hp: PB.MAX_HP, alive: false, life: 0, respawnAt: 0, protectedUntil: 0,
    lastDamageAt: 0, lastStateAt: now, needsFix: false,
    tags: 0, downs: 0, streak: 0, best: 0, lastSeen: now, connected: true,
    hist: [], shots: [], fireTokens: 4, fireTokensAt: now, grounded: true, firingUntil: 0,
    wsSentSeq: 0, wsSentMv: -1,
  };
}

function makeBrain(level: BotLevel): BotBrain {
  return {
    level, targetId: 0, reactAt: 0, acquiredAt: 0, path: [], pathIdx: 0, goal: null, repathAt: 0,
    strafe: 1, strafeUntil: 0, nextShotAt: 0, burstLeft: 0, mag: 0, reloadUntil: 0,
    lastProgressAt: 0, lastPos: { x: 0, z: 0 }, jumpAt: 0, crouchUntil: 0,
    aimYaw: 0, aimPitch: 0, errYaw: 0, errPitch: 0, lastKnown: null, retreating: false,
  };
}

function teamCount(room: Room, team: Team, humansOnly = false) {
  return room.players.filter((p) => p.team === team && (!humansOnly || !p.bot)).length;
}

function pickBotName(room: Room) {
  const used = new Set(room.players.map((p) => p.name));
  const free = BOT_NAMES.filter((n) => !used.has(n + " (CPU)"));
  const base = free.length ? free[randomInt(0, free.length)] : "Bot" + randomInt(10, 99);
  return base + " (CPU)";
}

function newBotId(room: Room) {
  let id = 0;
  do id = -randomInt(1000, 999_999); while (room.players.some((p) => p.id === id));
  return id;
}

/** Keep bot count matching the room's bot target and both teams balanced. */
export function syncBots(room: Room) {
  const now = Date.now();
  const humans: [number, number] = [teamCount(room, 0, true), teamCount(room, 1, true)];
  const target = room.botTarget;
  const desired: [number, number] = [humans[0], humans[1]];
  if (target > 0) {
    const perTeam = Math.ceil(target / 2);
    desired[0] = Math.max(humans[0], perTeam);
    desired[1] = Math.max(humans[1], perTeam);
    while (desired[0] + desired[1] > PB.MAX_PLAYERS) {
      if (desired[0] - humans[0] >= desired[1] - humans[1] && desired[0] > humans[0]) desired[0]--;
      else if (desired[1] > humans[1]) desired[1]--;
      else break;
    }
  }
  let changed = false;
  for (const team of [0, 1] as Team[]) {
    let bots = room.players.filter((p) => p.bot && p.team === team);
    let count = humans[team] + bots.length;
    while (count > desired[team] && bots.length) {
      const b = bots.pop()!;
      room.players = room.players.filter((p) => p !== b);
      count--; changed = true;
    }
    while (count < desired[team] && room.players.length < PB.MAX_PLAYERS) {
      const b = makePlayer(newBotId(room), pickBotName(room), team, room.botLevel, room.scope);
      b.weapon = pickBotWeapon();
      room.players.push(b);
      if (room.phase === "playing" || room.phase === "countdown") spawnPlayer(room, b, now, room.phase === "countdown");
      count++; changed = true;
    }
    bots = room.players.filter((p) => p.bot && p.team === team);
  }
  if (changed) bumpMeta(room);
}

function pickBotWeapon() { const r = Math.random(); return r < 0.6 ? 0 : r < 0.8 ? 1 : 2; }

export function createRoom(hostUser: { id: number; name: string }, opts: { publicLobby: boolean; practice: boolean; quick: boolean; botLevel: BotLevel; scope: string }): Room {
  let code = "";
  do code = String(randomInt(100000, 1000000)); while (rooms.has(code));
  const room: Room = {
    code, hostId: hostUser.id, phase: "lobby", phaseEnds: 0, scores: [0, 0], players: [], events: [], seq: 0, metaV: 1,
    publicLobby: opts.publicLobby, practice: opts.practice, quick: opts.quick, botLevel: opts.botLevel,
    botTarget: opts.practice || opts.quick ? PB.MAX_PLAYERS : 0, scope: opts.scope, createdAt: Date.now(), winner: null, shots: [], tickCount: 0,
  };
  room.players.push(makePlayer(hostUser.id, hostUser.name, 0, null, opts.scope));
  rooms.set(code, room);
  syncBots(room);
  if (opts.practice || opts.quick) startMatch(room);
  ensureTicker();
  return room;
}

export function addHuman(room: Room, user: { id: number; name: string }, scope: string): SPlayer {
  const existing = room.players.find((p) => p.id === user.id);
  if (existing) { existing.lastSeen = Date.now(); if (!existing.connected) { existing.connected = true; bumpMeta(room); } return existing; }
  if (room.players.filter((p) => !p.bot).length >= PB.MAX_PLAYERS) throw new Error("That room is full.");
  const h0 = teamCount(room, 0, true), h1 = teamCount(room, 1, true);
  let team: Team = h0 <= h1 ? 0 : 1;
  if (h0 === h1) team = teamCount(room, 0) <= teamCount(room, 1) ? 0 : 1;
  // make room by removing a bot from the chosen team if we are full
  if (room.players.length >= PB.MAX_PLAYERS) {
    const bot = room.players.find((p) => p.bot && p.team === team) || room.players.find((p) => p.bot);
    if (bot) { room.players = room.players.filter((p) => p !== bot); if (bot.team !== team) team = bot.team; }
  }
  const p = makePlayer(user.id, user.name, team, null, scope);
  room.players.push(p);
  if (room.phase === "playing" || room.phase === "countdown") spawnPlayer(room, p, Date.now(), room.phase === "countdown");
  syncBots(room);
  bumpMeta(room);
  newEvent(room, { k: "info", text: user.name + " joined " + (team === 0 ? "Cyan" : "Magenta") });
  return p;
}

export function removeHuman(room: Room, id: number) {
  const p = room.players.find((q) => q.id === id);
  if (!p) return;
  room.players = room.players.filter((q) => q.id !== id);
  newEvent(room, { k: "info", text: p.name + " left the match" });
  if (room.hostId === id) {
    const next = room.players.find((q) => !q.bot);
    if (next) room.hostId = next.id;
  }
  if (!room.players.some((q) => !q.bot)) { rooms.delete(room.code); return; }
  syncBots(room);
  bumpMeta(room);
}

export function switchTeam(room: Room, p: SPlayer) {
  if (room.phase === "playing" || room.phase === "countdown") throw new Error("Teams are locked during a match.");
  const other: Team = p.team === 0 ? 1 : 0;
  if (teamCount(room, other, true) >= PB.MAX_PLAYERS / 2) throw new Error("That team is full.");
  p.team = other;
  syncBots(room);
  bumpMeta(room);
}

function chooseSpawn(room: Room, p: SPlayer) {
  const spawns = MAP.spawns[p.team].filter((s, i) => !p.bot || (i < 7));
  let best = spawns[0], bestScore = -Infinity;
  for (const s of spawns) {
    let minEnemy = 999, crowd = 0;
    for (const q of room.players) {
      if (!q.alive || q === p) continue;
      const d = Math.hypot(q.x - s.x, q.z - s.z);
      if (q.team !== p.team) minEnemy = Math.min(minEnemy, d);
      else if (d < 1.6) crowd++;
    }
    const score = Math.min(minEnemy, 40) - crowd * 30 + Math.random() * 6;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}

export function spawnPlayer(room: Room, p: SPlayer, now: number, frozen = false) {
  const s = chooseSpawn(room, p);
  p.x = s.x; p.z = s.z; p.y = groundAt(s.x, s.z, 3);
  p.vx = p.vy = p.vz = 0; p.yaw = s.yaw; p.pitch = 0;
  p.hp = PB.MAX_HP; p.alive = true; p.respawnAt = 0; p.life++;
  p.protectedUntil = now + (frozen ? PB.COUNTDOWN_MS : 0) + PB.SPAWN_PROTECT_MS;
  p.lastStateAt = now; p.hist = []; p.grounded = true; p.flags = F.GROUNDED;
  if (p.bot) {
    const b = p.bot;
    b.path = []; b.goal = null; b.targetId = 0; b.repathAt = 0; b.mag = WEAPONS[p.weapon].mag; b.reloadUntil = 0;
    b.aimYaw = p.yaw; b.aimPitch = 0; b.lastProgressAt = now; b.lastPos = { x: p.x, z: p.z }; b.retreating = false; b.lastKnown = null;
    if (Math.random() < 0.25) p.weapon = pickBotWeapon(), b.mag = WEAPONS[p.weapon].mag;
  }
  newEvent(room, { k: "spawn", id: p.id });
}

export function startMatch(room: Room) {
  const now = Date.now();
  room.phase = "countdown";
  room.phaseEnds = now + PB.COUNTDOWN_MS;
  room.scores = [0, 0];
  room.winner = null;
  room.shots = [];
  for (const p of room.players) {
    p.tags = p.downs = p.streak = p.best = 0;
    p.alive = false;
  }
  for (const p of room.players) spawnPlayer(room, p, now, true);
  bumpMeta(room);
}

function finishMatch(room: Room, now: number) {
  room.phase = "finished";
  room.phaseEnds = now + PB.RESULTS_MS;
  room.winner = room.scores[0] === room.scores[1] ? -1 : room.scores[0] > room.scores[1] ? 0 : 1;
  room.shots = [];
  bumpMeta(room);
}

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------

function applyHit(room: Room, shooter: SPlayer, target: SPlayer, w: WeaponDef, head: boolean, p: V3, now: number) {
  if (!target.alive || target.team === shooter.team || room.phase !== "playing") return;
  if (target.protectedUntil > now) return;
  const dmg = head ? w.head : w.dmg;
  target.hp = Math.max(0, target.hp - dmg);
  target.lastDamageAt = now;
  if (target.bot) {
    target.bot.lastKnown = { x: shooter.x, z: shooter.z, t: now };
    if (!target.bot.targetId) target.bot.targetId = shooter.id;
  }
  newEvent(room, { k: "hit", by: shooter.id, tg: target.id, dmg, hp: target.hp, head: head ? 1 : 0, p: [round2(p[0]), round2(p[1]), round2(p[2])] });
  if (target.hp > 0) return;
  target.alive = false;
  target.respawnAt = now + PB.RESPAWN_MS;
  target.downs++;
  target.streak = 0;
  shooter.tags++;
  shooter.streak++;
  shooter.best = Math.max(shooter.best, shooter.streak);
  room.scores[shooter.team]++;
  newEvent(room, { k: "ko", by: shooter.id, tg: target.id, w: WEAPONS.indexOf(w), head: head ? 1 : 0, streak: shooter.streak });
  bumpMeta(room);
  if (room.scores[shooter.team] >= PB.SCORE_TO_WIN) finishMatch(room, now);
}

// ---------------------------------------------------------------------------
// Client sync handling (shared by HTTP and WebSocket transports)
// ---------------------------------------------------------------------------

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const v3 = (v: unknown): V3 | null => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n)) ? [v[0], v[1], v[2]] : null;

export function handleSync(room: Room, p: SPlayer, msg: ClientSync, now: number) {
  p.lastSeen = now;
  if (!p.connected) { p.connected = true; bumpMeta(room); }
  if (typeof msg.echo === "number") p.wsEcho = msg.echo;
  if (room.phase !== "playing" && room.phase !== "countdown") return;
  if (num(msg.life) === p.life && p.alive && Array.isArray(msg.st) && msg.st.length >= 10) handleState(room, p, msg.st, now);
  if (Array.isArray(msg.ev)) {
    for (const ev of msg.ev.slice(0, 40)) {
      if (!ev || typeof ev !== "object") continue;
      if (ev.k === "fire") handleFire(room, p, ev, now);
      else if (ev.k === "hit") handleHitClaim(room, p, ev, now);
    }
  }
}

function handleState(room: Room, p: SPlayer, st: number[], now: number) {
  const x = num(st[0], p.x), y = num(st[1], p.y), z = num(st[2], p.z);
  const elapsed = Math.max(0.03, (now - p.lastStateAt) / 1000);
  const maxMove = PB.SPRINT_SPEED * 1.25 * elapsed + 1.2;
  const dist = Math.hypot(x - p.x, z - p.z);
  const frozen = room.phase === "countdown";
  if (frozen || dist > maxMove || Math.abs(x) > PB.ARENA_X + 1 || Math.abs(z) > PB.ARENA_Z + 1 || y < -1 || y > 12) {
    if (dist > 0.6) p.needsFix = true;
  } else {
    p.x = x; p.y = y; p.z = z;
    p.vx = clamp(num(st[7]), -12, 12); p.vy = clamp(num(st[8]), -45, 15); p.vz = clamp(num(st[9]), -12, 12);
  }
  p.yaw = wrapAngle(num(st[3], p.yaw));
  p.pitch = clamp(num(st[4], p.pitch), -1.45, 1.45);
  p.flags = (num(st[5]) | 0) & (F.GROUNDED | F.SPRINT | F.ADS | F.CROUCH | F.RELOAD);
  const w = num(st[6]) | 0;
  if (w >= 0 && w < WEAPONS.length) p.weapon = w;
  p.lastStateAt = now;
  pushHist(p, now);
}

function pushHist(p: SPlayer, now: number) {
  p.hist.push({ t: now, x: p.x, y: p.y, z: p.z, crouch: !!(p.flags & F.CROUCH) });
  while (p.hist.length > 40 || (p.hist.length > 2 && now - p.hist[0].t > 2000)) p.hist.shift();
}

function handleFire(room: Room, p: SPlayer, ev: Extract<ClientEvent, { k: "fire" }>, now: number) {
  if (!p.alive || room.phase !== "playing") return;
  const wi = num(ev.w) | 0, w = WEAPONS[wi];
  const o = v3(ev.o), d = v3(ev.d);
  if (!w || !o || !d) return;
  if (p.shots.some((sh) => sh.id === (num(ev.id) | 0))) return;
  const dl = Math.hypot(d[0], d[1], d[2]);
  if (dl < 0.5 || dl > 1.5) return;
  const dn: V3 = [d[0] / dl, d[1] / dl, d[2] / dl];
  if (Math.hypot(o[0] - p.x, o[1] - (p.y + 1.3), o[2] - p.z) > 4) return;
  // token bucket rate limit (tolerates bunching from network jitter)
  const cap = 4;
  p.fireTokens = Math.min(cap, p.fireTokens + (now - p.fireTokensAt) / (w.interval * 0.85));
  p.fireTokensAt = now;
  if (p.fireTokens < 1) return;
  p.fireTokens -= 1;
  const sp = clamp(num(ev.sp), 0, (w.spread + w.moveSpread) * 1.6);
  const seed = (num(ev.seed) >>> 0) || 1;
  const dirs = pelletDirs(dn, sp, w.pellets, seed);
  const id = num(ev.id) | 0;
  if (p.shots.some((sh) => sh.id === id)) return; // duplicate (retried request)
  p.shots.push({ id, t: now, w: wi, o, dirs, claimed: dirs.map(() => false) });
  if (p.shots.length > 40) p.shots.shift();
  p.protectedUntil = Math.min(p.protectedUntil, now);
  p.firingUntil = now + 250;
  p.weapon = wi;
  newEvent(room, { k: "shot", by: p.id, w: wi, o: [round3(o[0]), round3(o[1]), round3(o[2])], d: [round3(dn[0]), round3(dn[1]), round3(dn[2])], sp: round3(sp), seed });
}

function handleHitClaim(room: Room, p: SPlayer, ev: Extract<ClientEvent, { k: "hit" }>, now: number) {
  if (room.phase !== "playing") return;
  const shot = p.shots.find((s) => s.id === (num(ev.id) | 0));
  if (!shot || now - shot.t > 3500) return;
  const i = num(ev.i) | 0;
  if (i < 0 || i >= shot.dirs.length || shot.claimed[i]) return;
  const target = room.players.find((q) => q.id === num(ev.tg));
  const hp = v3(ev.p);
  if (!target || !hp || !target.alive || target.team === p.team) return;
  const w = WEAPONS[shot.w], dir = shot.dirs[i];
  // 1. the claimed impact point must lie on the projectile's flight path before it hits the world
  const worldHit = projectileWorldHit(shot.o, dir, w);
  const tEnd = worldHit ? worldHit.t : w.life;
  let bestT = -1, bestD = Infinity;
  for (let t = 0; t <= tEnd + 1e-6; t += 1 / 120) {
    const q = ballisticPos(shot.o, dir, w.speed, w.grav, t);
    const dd = Math.hypot(q[0] - hp[0], q[1] - hp[1], q[2] - hp[2]);
    if (dd < bestD) { bestD = dd; bestT = t; }
  }
  if (bestD > 0.9 || bestT < 0) return;
  // 2. the target must have been near that point recently (lag tolerant)
  const samples = target.hist.length ? target.hist : [{ t: now, x: target.x, y: target.y, z: target.z, crouch: false }];
  let near = false;
  for (const s of samples) {
    if (s.t < shot.t - 900 || s.t > now + 50) continue;
    const dx = hp[0] - s.x, dz = hp[2] - s.z, dy = hp[1] - s.y;
    if (Math.hypot(dx, dz) < 1.9 && dy > -0.6 && dy < 2.6) { near = true; break; }
  }
  if (!near && target.bot) {
    const dx = hp[0] - target.x, dz = hp[2] - target.z;
    near = Math.hypot(dx, dz) < 1.9;
  }
  if (!near) return;
  shot.claimed[i] = true;
  const rel = hp[1] - target.y;
  const head = !!ev.head && rel > ((target.flags & F.CROUCH) ? 0.85 : 1.3);
  applyHit(room, p, target, w, head, hp, now);
}

// ---------------------------------------------------------------------------
// Snapshot building
// ---------------------------------------------------------------------------

export function playerFlags(p: SPlayer, now: number) {
  let f = p.flags & (F.GROUNDED | F.SPRINT | F.ADS | F.CROUCH | F.RELOAD);
  if (p.alive) f |= F.ALIVE;
  if (p.protectedUntil > now) f |= F.PROTECTED;
  if (p.firingUntil > now) f |= F.FIRING;
  return f;
}

export function buildSnapshot(room: Room, me: SPlayer | undefined, ack: number, mv: number, now: number): Snapshot {
  const snap: Snapshot = {
    t: "snap", now, seq: room.seq, phase: room.phase, phaseEnds: room.phaseEnds, scores: [room.scores[0], room.scores[1]],
    ps: room.players.map((p) => [p.id, round2(p.x), round2(p.y), round2(p.z), round3(p.yaw), round3(p.pitch), playerFlags(p, now), p.weapon, Math.round(p.hp), round2(p.vx), round2(p.vy), round2(p.vz)]),
  };
  if (ack >= 0 && ack < room.seq) {
    const evs = room.events.filter((e) => e.s > ack);
    if (evs.length) snap.ev = evs.slice(-120);
  }
  if (mv !== room.metaV) snap.meta = roomMeta(room);
  if (me) {
    snap.you = { life: me.life, x: round2(me.x), y: round2(me.y), z: round2(me.z), yaw: round3(me.yaw) };
    if (me.needsFix) { snap.you.fix = 1; me.needsFix = false; }
    if (typeof me.wsEcho === "number") snap.echo = me.wsEcho;
  }
  return snap;
}

// ---------------------------------------------------------------------------
// Bots
// ---------------------------------------------------------------------------

const LEVEL = {
  easy: { react: 820, turn: 3, errMax: 0.14, errMin: 0.065, burst: [2, 4], pause: [750, 1300], spreadMul: 1.4, jump: 0.1 },
  normal: { react: 540, turn: 5.5, errMax: 0.095, errMin: 0.036, burst: [3, 5], pause: [480, 950], spreadMul: 1.15, jump: 0.25 },
  hard: { react: 320, turn: 8.5, errMax: 0.06, errMin: 0.018, burst: [4, 7], pause: [260, 520], spreadMul: 1.0, jump: 0.45 },
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function preferredRange(w: number): [number, number] { return w === 1 ? [4, 9] : w === 2 ? [22, 42] : [10, 24]; }

function visible(a: SPlayer, b: SPlayer) {
  const ay = a.y + ((a.flags & F.CROUCH) ? 1.05 : 1.55);
  return lineOfSight(a.x, ay, a.z, b.x, b.y + 1.25, b.z) || lineOfSight(a.x, ay, a.z, b.x, b.y + 1.6, b.z);
}

function coverFrom(p: SPlayer, threat: { x: number; z: number }) {
  let best: { x: number; z: number } | null = null, bestScore = Infinity;
  for (const c of MAP.cover) {
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d > 22) continue;
    if (lineOfSight(threat.x, 1.4, threat.z, c.x, 1.2, c.z)) continue;
    const score = d - Math.hypot(c.x - threat.x, c.z - threat.z) * 0.3;
    if (score < bestScore) { bestScore = score; best = c; }
  }
  return best;
}

function botGoal(room: Room, p: SPlayer) {
  const b = p.bot!;
  if (b.lastKnown && Date.now() - b.lastKnown.t < 6000) return { x: b.lastKnown.x + rnd(-2, 2), z: b.lastKnown.z + rnd(-2, 2) };
  // push towards the enemy half, favouring cover spots and the middle
  const dir = p.team === 0 ? 1 : -1;
  const options = MAP.cover.filter((c) => c.x * dir > -14 && c.x * dir < 30);
  const c = options[Math.floor(Math.random() * options.length)] || { x: 0, z: 0 };
  return { x: c.x + rnd(-1.5, 1.5), z: c.z + rnd(-1.5, 1.5) };
}

function botThink(room: Room, p: SPlayer, now: number, dt: number) {
  const b = p.bot!;
  const L = LEVEL[b.level];
  const w = WEAPONS[p.weapon];
  if (!b.mag && now >= b.reloadUntil) b.mag = w.mag;

  // --- perception --------------------------------------------------------
  let target = room.players.find((q) => q.id === b.targetId && q.alive && q.team !== p.team && q.connected);
  const checkVis = (room.tickCount + (Math.abs(p.id) % 3)) % 3 === 0;
  let targetVisible = !!target && (checkVis ? visible(p, target!) : b.reactAt > 0);
  if (checkVis) {
    if (!target || !targetVisible) {
      let best: SPlayer | undefined, bestD = Infinity;
      for (const q of room.players) {
        if (!q.alive || q.team === p.team || !q.connected) continue;
        const d = Math.hypot(q.x - p.x, q.z - p.z);
        if (d > 62 || d >= bestD) continue;
        // field of view (bots notice things behind them only when very close or when shot)
        const ang = Math.abs(wrapAngle(Math.atan2(q.x - p.x, q.z - p.z) - p.yaw));
        if (ang > 1.75 && d > 7) continue;
        if (!visible(p, q)) continue;
        best = q; bestD = d;
      }
      if (best && best.id !== b.targetId) {
        b.targetId = best.id; b.acquiredAt = now; b.reactAt = now + L.react * rnd(0.8, 1.25);
        b.errYaw = rnd(-1, 1) * L.errMax; b.errPitch = rnd(-1, 1) * L.errMax * 0.6;
      }
      target = best; targetVisible = !!best;
    }
    if (!targetVisible) b.reactAt = 0; else if (!b.reactAt) b.reactAt = now + L.react;
  }
  if (target && targetVisible) b.lastKnown = { x: target.x, z: target.z, t: now };

  // --- movement ----------------------------------------------------------
  let wishX = 0, wishZ = 0, speed: number = PB.WALK_SPEED, jump = false;
  const crouching = b.crouchUntil > now;
  if (target && targetVisible) {
    const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz) || 1;
    const [minR, maxR] = preferredRange(p.weapon);
    b.retreating = p.hp < 45 && now - p.lastDamageAt < 2500;
    if (b.retreating) {
      const cover = coverFrom(p, target);
      if (cover && (!b.goal || Math.hypot(b.goal.x - cover.x, b.goal.z - cover.z) > 1)) { b.goal = cover; b.path = findPath(p.x, p.z, cover.x, cover.z); b.pathIdx = 0; }
    } else {
      if (now > b.strafeUntil) { b.strafe = Math.random() < 0.5 ? -1 : 1; b.strafeUntil = now + rnd(500, 1500); if (b.level !== "easy" && Math.random() < 0.18) b.crouchUntil = now + rnd(600, 1400); }
      const toward = d > maxR ? 1 : d < minR ? -1 : 0;
      wishX = (dx / d) * toward + (dz / d) * b.strafe * 0.85;
      wishZ = (dz / d) * toward - (dx / d) * b.strafe * 0.85;
      b.path = []; b.goal = null;
      if (p.grounded && now > b.jumpAt && Math.random() < L.jump * dt) { jump = true; b.jumpAt = now + 1500; }
    }
  }
  if (!wishX && !wishZ) {
    if (!b.goal || now > b.repathAt || b.pathIdx >= b.path.length) {
      if (!b.retreating || !b.goal || b.pathIdx >= b.path.length) {
        if (b.retreating && b.pathIdx >= b.path.length && b.goal) {
          // wait in cover to regenerate
          if (p.hp >= 85 || now - p.lastDamageAt > 7000) { b.retreating = false; b.goal = null; }
        } else {
          b.goal = botGoal(room, p);
          b.path = findPath(p.x, p.z, b.goal.x, b.goal.z); b.pathIdx = 0;
          b.repathAt = now + rnd(3500, 7000);
        }
      }
    }
    const wp = b.path[b.pathIdx];
    if (wp) {
      const dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz);
      if (d < 0.7) b.pathIdx++;
      else { wishX = dx / d; wishZ = dz / d; speed = b.retreating || d > 8 ? PB.SPRINT_SPEED : PB.WALK_SPEED; }
    }
  }
  if (crouching && targetVisible) speed = PB.CROUCH_SPEED;
  const wl = Math.hypot(wishX, wishZ);
  if (wl > 1) { wishX /= wl; wishZ /= wl; }
  // stuck detection
  if (Math.hypot(p.x - b.lastPos.x, p.z - b.lastPos.z) > 0.6) { b.lastPos = { x: p.x, z: p.z }; b.lastProgressAt = now; }
  else if (wl > 0.1 && now - b.lastProgressAt > 1100) {
    jump = p.grounded; b.lastProgressAt = now;
    b.goal = botGoal(room, p); b.path = findPath(p.x, p.z, b.goal.x, b.goal.z); b.pathIdx = 0;
  }

  const body: Body = { x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz, grounded: p.grounded, crouch: crouching && !!targetVisible };
  const sub = 2;
  for (let k = 0; k < sub; k++) stepBody(body, { wx: wishX, wz: wishZ, speed, jump: jump && k === 0 }, dt / sub);
  p.x = body.x; p.y = body.y; p.z = body.z; p.vx = body.vx; p.vy = body.vy; p.vz = body.vz; p.grounded = body.grounded;
  let flags = 0;
  if (body.grounded) flags |= F.GROUNDED;
  if (body.crouch) flags |= F.CROUCH;
  if (speed >= PB.SPRINT_SPEED && wl > 0.1) flags |= F.SPRINT;
  if (now < b.reloadUntil) flags |= F.RELOAD;
  if (targetVisible && p.weapon === 2) flags |= F.ADS;

  // --- aiming ------------------------------------------------------------
  let desiredYaw: number, desiredPitch = 0;
  if (target && targetVisible) {
    const m = muzzlePos(p.x, p.y, p.z, b.aimYaw, b.aimPitch, body.crouch);
    const tc = (target.flags & F.CROUCH) ? 0.9 : 1.2;
    let tx = target.x, ty = target.y + tc, tz = target.z;
    const dist = Math.hypot(tx - m[0], ty - m[1], tz - m[2]);
    const tFlight = dist / w.speed;
    if (b.level !== "easy") { tx += target.vx * tFlight * 0.85; tz += target.vz * tFlight * 0.85; }
    ty += 0.5 * w.grav * tFlight * tFlight;
    desiredYaw = Math.atan2(tx - m[0], tz - m[2]);
    desiredPitch = Math.atan2(ty - m[1], Math.hypot(tx - m[0], tz - m[2]));
    const settle = clamp((now - b.acquiredAt) / 1600, 0, 1);
    const err = L.errMax + (L.errMin - L.errMax) * settle;
    b.errYaw += (rnd(-1, 1) * err - b.errYaw) * clamp(dt * 2.2, 0, 1);
    b.errPitch += (rnd(-1, 1) * err * 0.6 - b.errPitch) * clamp(dt * 2.2, 0, 1);
    desiredYaw += b.errYaw; desiredPitch += b.errPitch;
  } else if (wl > 0.1) {
    desiredYaw = Math.atan2(wishX, wishZ);
  } else {
    desiredYaw = b.aimYaw + Math.sin(now / 1300 + p.id) * 0.3 * dt;
  }
  const dyaw = wrapAngle(desiredYaw - b.aimYaw);
  const maxTurn = L.turn * dt * (target && targetVisible ? 1 : 0.7);
  b.aimYaw = wrapAngle(b.aimYaw + clamp(dyaw, -maxTurn, maxTurn));
  b.aimPitch += clamp(desiredPitch - b.aimPitch, -maxTurn, maxTurn);
  p.yaw = b.aimYaw; p.pitch = b.aimPitch;

  // --- shooting ----------------------------------------------------------
  if (now < b.reloadUntil) { p.flags = flags; return; }
  if (b.mag <= 0) { b.reloadUntil = now + w.reload; b.mag = w.mag; p.flags = flags | F.RELOAD; return; }
  if (target && targetVisible && now >= b.reactAt && now >= b.nextShotAt && Math.abs(dyaw) < 0.14 && room.phase === "playing") {
    const dist = Math.hypot(target.x - p.x, target.z - p.z);
    const [, maxR] = preferredRange(p.weapon);
    if (dist < maxR * 1.6 + 6) {
      botFire(room, p, w, body.crouch, L.spreadMul, now);
      b.mag--;
      if (b.burstLeft <= 0) b.burstLeft = Math.round(rnd(L.burst[0], L.burst[1]));
      b.burstLeft--;
      b.nextShotAt = now + w.interval * (p.weapon === 0 ? 1.05 : 1.2) + (b.burstLeft <= 0 && p.weapon === 0 ? rnd(L.pause[0], L.pause[1]) : 0);
      if (p.weapon !== 0) b.nextShotAt += rnd(150, 500);
    }
  }
  p.flags = flags;
}

function botFire(room: Room, p: SPlayer, w: WeaponDef, crouch: boolean, spreadMul: number, now: number) {
  const o = muzzlePos(p.x, p.y, p.z, p.yaw, p.pitch, crouch);
  const d = aimDir(p.yaw, p.pitch);
  const moving = Math.hypot(p.vx, p.vz) > 1;
  const sp = ((p.weapon === 2 ? w.adsSpread + 0.004 : w.spread) + (moving ? w.moveSpread * 0.5 : 0)) * spreadMul;
  const seed = randomInt(1, 2 ** 31);
  const dirs = pelletDirs(d, sp, w.pellets, seed);
  for (const dir of dirs) room.shots.push({ by: p.id, team: p.team, w, o, d: dir, t0: now, age: 0 });
  p.firingUntil = now + 250;
  p.protectedUntil = Math.min(p.protectedUntil, now);
  newEvent(room, { k: "shot", by: p.id, w: WEAPONS.indexOf(w), o: [round3(o[0]), round3(o[1]), round3(o[2])], d: [round3(d[0]), round3(d[1]), round3(d[2])], sp: round3(sp), seed });
}

function stepBotShots(room: Room, now: number, dt: number) {
  const keep: BotShot[] = [];
  for (const s of room.shots) {
    const shooter = room.players.find((q) => q.id === s.by);
    const t0 = s.age, t1 = Math.min(s.age + dt, s.w.life);
    let done = t1 >= s.w.life;
    const steps = Math.max(1, Math.ceil(((t1 - t0) * s.w.speed) / 1.2));
    for (let k = 0; k < steps && !done; k++) {
      const ta = t0 + ((t1 - t0) * k) / steps, tb = t0 + ((t1 - t0) * (k + 1)) / steps;
      const a = ballisticPos(s.o, s.d, s.w.speed, s.w.grav, ta), bp = ballisticPos(s.o, s.d, s.w.speed, s.w.grav, tb);
      const dx = bp[0] - a[0], dy = bp[1] - a[1], dz = bp[2] - a[2];
      const wh = raycastWorld(a[0], a[1], a[2], dx, dy, dz, 1);
      let bestT = wh ? wh.t : 1, victim: SPlayer | null = null, head = false;
      for (const q of room.players) {
        if (!q.alive || q.team === s.team || q.protectedUntil > now) continue;
        const h = rayPlayer(a[0], a[1], a[2], dx, dy, dz, bestT, q.x, q.y, q.z, !!(q.flags & F.CROUCH));
        if (h && h.t <= bestT) { bestT = h.t; victim = q; head = h.head; }
      }
      if (victim && shooter) {
        applyHit(room, shooter, victim, s.w, head, [a[0] + dx * bestT, a[1] + dy * bestT, a[2] + dz * bestT], now);
        done = true;
      } else if (wh) done = true;
    }
    s.age = t1;
    if (!done && room.phase === "playing") keep.push(s);
  }
  room.shots = keep;
}

// ---------------------------------------------------------------------------
// Tick
// ---------------------------------------------------------------------------

export function tickRoom(room: Room, now: number, dt: number) {
  room.tickCount++;
  if (room.phase === "countdown" && now >= room.phaseEnds) {
    room.phase = "playing";
    room.phaseEnds = now + PB.MATCH_MS;
    bumpMeta(room);
  } else if (room.phase === "playing" && now >= room.phaseEnds) {
    finishMatch(room, now);
  } else if (room.phase === "finished" && now >= room.phaseEnds) {
    if (room.quick || room.practice) startMatch(room);
    else { room.phase = "lobby"; room.phaseEnds = 0; bumpMeta(room); }
  }
  for (const p of room.players) {
    if (!p.bot) {
      const wasConnected = p.connected;
      p.connected = now - p.lastSeen < 12000;
      if (wasConnected !== p.connected) bumpMeta(room);
    }
  }
  if (room.phase !== "playing" && room.phase !== "countdown") return;
  for (const p of room.players) {
    if (!p.alive) {
      if (room.phase === "playing" && p.respawnAt && now >= p.respawnAt && p.connected) spawnPlayer(room, p, now);
      continue;
    }
    if (!p.connected && !p.bot) { p.alive = false; p.respawnAt = now + PB.RESPAWN_MS; continue; }
    if (p.hp < PB.MAX_HP && now - p.lastDamageAt > PB.REGEN_DELAY_MS) p.hp = Math.min(PB.MAX_HP, p.hp + PB.REGEN_PER_S * dt);
    if (p.bot) {
      if (room.phase === "playing") botThink(room, p, now, dt);
      pushHist(p, now);
    }
  }
  stepBotShots(room, now, dt);
}

// ---------------------------------------------------------------------------
// Global ticker
// ---------------------------------------------------------------------------

let ticker: ReturnType<typeof setInterval> | null = null;
let lastTick = 0;
let tickHook: ((room: Room, now: number) => void) | null = null;
export function setTickHook(fn: (room: Room, now: number) => void) { tickHook = fn; }

function cleanupRoom(room: Room, now: number) {
  const before = room.players.length;
  const gone = room.players.filter((p) => !p.bot && now - p.lastSeen > 45_000);
  for (const p of gone) removeHuman(room, p.id);
  if (!rooms.has(room.code)) return;
  if (now - room.createdAt > 4 * 60 * 60 * 1000) { rooms.delete(room.code); return; }
  if (room.players.length !== before) bumpMeta(room);
}

export function ensureTicker() {
  if (ticker) return;
  lastTick = Date.now();
  ticker = setInterval(() => {
    const now = Date.now();
    const dt = Math.min(0.1, Math.max(0.01, (now - lastTick) / 1000));
    lastTick = now;
    const list = Array.from(rooms.values());
    for (const room of list) {
      try {
        if (room.tickCount % PB.TICK_HZ === 0) cleanupRoom(room, now);
        if (!rooms.has(room.code)) continue;
        tickRoom(room, now, dt);
        if (tickHook) tickHook(room, now);
      } catch (err) {
        console.error("[paintball] tick error", err);
      }
    }
    if (!rooms.size && ticker) { clearInterval(ticker); ticker = null; }
  }, 1000 / PB.TICK_HZ);
  if (typeof ticker === "object" && ticker && "unref" in ticker) ticker.unref();
}
