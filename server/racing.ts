// Aurora Racers — server: saved progression (coins, karts, upgrades) and online race rooms.
import type { Express, RequestHandler } from "express";
import type { Server, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { randomInt } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import {
  BODIES, UPGRADE_COST, MAX_UPGRADE, PAINTS, TRACK_IDS, RACE_MAX, KF, freshRacingSave, sanitizeSave, upgradesFor, raceReward, cupReward,
  type RacingSave, type UpgradeId, type RacePlayerMeta, type RaceRoomMeta, type RacePhase, type RaceEvent, type RaceSnap,
  type RaceClientSync, type KartState, type RaceStandingRow, type RaceLook,
} from "../shared/racing";

type AnyUser = { id: number | string; displayName?: string; username?: string; role?: string; is_eye_gaze_user?: boolean; school_id?: unknown; teacherId?: unknown };

// ---------------------------------------------------------------------------
// Save storage
// ---------------------------------------------------------------------------

export class StoreUnavailable extends Error {}

export interface SaveStore {
  get(userId: string): Promise<RacingSave | null>;
  put(userId: string, save: RacingSave): Promise<void>;
}

/** Supabase-backed store (table created by migrations/racing_saves.sql). */
export function supabaseSaveStore(getDb: () => any): SaveStore {
  const missing = (e: any) => e && (e.code === "42P01" || e.code === "PGRST205" || /racing_saves/.test(String(e.message || "")) && /not find|does not exist/i.test(String(e.message || "")));
  return {
    async get(userId) {
      const { data, error } = await getDb().from("racing_saves").select("data").eq("user_id", Number(userId)).maybeSingle();
      if (error) { if (missing(error)) throw new StoreUnavailable("racing_saves table missing"); throw error; }
      return data ? sanitizeSave(data.data) : null;
    },
    async put(userId, save) {
      const { error } = await getDb().from("racing_saves").upsert({ user_id: Number(userId), data: save, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) { if (missing(error)) throw new StoreUnavailable("racing_saves table missing"); throw error; }
    },
  };
}

export function memorySaveStore(): SaveStore {
  const m = new Map<string, RacingSave>();
  return { async get(id) { return m.get(id) || null; }, async put(id, s) { m.set(id, s); } };
}

// one change at a time per player so concurrent requests can't double-spend
const locks = new Map<string, Promise<unknown>>();
function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(id) || Promise.resolve();
  const next = prev.then(fn, fn);
  locks.set(id, next.catch(() => undefined));
  return next;
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

interface RPlayer extends RacePlayerMeta {
  st: KartState | null;
  lastSeen: number;
  finishTime: number;
  scope: string;
  wsSentSeq: number;
  wsSentMv: number;
  echo?: number;
}

interface RRoom {
  code: string;
  hostId: string;
  publicRoom: boolean;
  scope: string;
  trackId: string;
  cc: number;
  laps: number;
  bots: boolean;
  players: RPlayer[];
  phase: RacePhase;
  phaseEnds: number;
  startAt: number;
  firstFinish: number;
  raceNo: number;
  metaV: number;
  seq: number;
  events: RaceEvent[];
  results: RaceStandingRow[] | null;
  createdAt: number;
}

const rooms = new Map<string, RRoom>();
const BOT_NAMES = ["Nova", "Pixel", "Rocket", "Luna", "Zest", "Echo", "Turbo", "Comet", "Blitz", "Kiwi"];
const BOT_PAINTS = [0x8b5cf6, 0x22c55e, 0xf97316, 0xec4899, 0xfacc15, 0x06b6d4, 0x3b82f6, 0xef4444];

const scopeOf = (u: AnyUser) => (u.school_id ? "school:" + u.school_id : u.teacherId ? "teacher:" + u.teacherId : "readers");
const nameOf = (u: AnyUser) => String(u.displayName || u.username || "Racer").replace(/\s+/g, " ").trim().slice(0, 16) || "Racer";
const denied = (u: AnyUser) => u.role === "parent" || !!u.is_eye_gaze_user;

function bump(room: RRoom) { room.metaV++; }
function pushEvent(room: RRoom, ev: any) { room.seq++; ev.s = room.seq; room.events.push(ev); if (room.events.length > 300) room.events.splice(0, room.events.length - 300); }

function roomMeta(room: RRoom): RaceRoomMeta {
  return {
    v: room.metaV, code: room.code, hostId: room.hostId, publicRoom: room.publicRoom, trackId: room.trackId, cc: room.cc, laps: room.laps,
    bots: room.bots, raceNo: room.raceNo,
    players: room.players.map((p) => ({ id: p.id, name: p.name, bot: p.bot, look: p.look, upgrades: p.upgrades, ready: p.ready, connected: p.connected })),
  };
}

function syncBots(room: RRoom) {
  const humans = room.players.filter((p) => !p.bot).length;
  const want = room.bots ? Math.max(0, RACE_MAX - humans) : 0;
  let bots = room.players.filter((p) => p.bot);
  if (bots.length > want) {
    const drop = new Set(bots.slice(want).map((b) => b.id));
    room.players = room.players.filter((p) => !drop.has(p.id));
  }
  bots = room.players.filter((p) => p.bot);
  let i = 0;
  while (bots.length < want) {
    const id = "bot-" + randomInt(100000, 999999);
    const used = new Set(room.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) || BOT_NAMES[(room.players.length + i++) % BOT_NAMES.length];
    const lvl = room.cc === 150 ? 4 : room.cc === 100 ? 2 : 0;
    const b: RPlayer = {
      id, name, bot: true, look: { body: BODIES[(bots.length * 3 + 1) % BODIES.length].id, paint: BOT_PAINTS[bots.length % BOT_PAINTS.length], helmet: 0xf8fafc, driver: bots.length % 5 },
      upgrades: { engine: lvl, turbo: lvl, tires: lvl }, ready: true, connected: true, st: null, lastSeen: Date.now(), finishTime: 0, scope: room.scope, wsSentSeq: 0, wsSentMv: -1,
    };
    room.players.push(b);
    bots.push(b);
  }
  bump(room);
}

function standings(room: RRoom): RaceStandingRow[] {
  const prog = (p: RPlayer) => (p.st ? (p.st[6] - 1) * 100000 + p.st[7] : -1e9);
  const rows = room.players.slice().sort((a, b) => {
    if (a.finishTime && b.finishTime) return a.finishTime - b.finishTime;
    if (a.finishTime) return -1;
    if (b.finishTime) return 1;
    return prog(b) - prog(a);
  });
  return rows.map((p, i) => ({ id: p.id, name: p.name, place: i + 1, time: p.finishTime, finished: !!p.finishTime, coins: 0, paint: p.look.paint, bot: p.bot }));
}

function snapshot(room: RRoom, me: RPlayer | undefined, ack: number, mv: number, now: number): RaceSnap {
  const snap: RaceSnap = {
    t: "race-snap", now, phase: room.phase, startAt: room.startAt, seq: room.seq,
    ps: room.players.filter((p) => p.st).map((p) => ({ id: p.id, st: p.st as KartState })),
  };
  if (ack >= 0 && ack < room.seq) { const ev = room.events.filter((e) => e.s > ack); if (ev.length) snap.ev = ev.slice(-150); }
  if (mv !== room.metaV) snap.meta = roomMeta(room);
  if (room.results) snap.results = room.results;
  if (me && typeof me.echo === "number") snap.echo = me.echo;
  return snap;
}

function validState(st: unknown): st is KartState {
  return Array.isArray(st) && st.length === 15 && st.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 1e6);
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export interface RacingOptions {
  httpServer?: Server;
  resolveToken?: (token: string) => Promise<AnyUser | null>;
  store: SaveStore;
}

export function registerRacingRoutes(app: Express, auth: RequestHandler, options: RacingOptions) {
  const store = options.store;
  const lastResult = new Map<string, number>();
  const lastCup = new Map<string, number>();

  const access: RequestHandler = (req: any, res, next) => {
    if (denied(req.user)) { res.status(403).json({ message: "Aurora Racers is for regular student accounts." }); return; }
    next();
  };
  const fail = (res: any, e: unknown) => {
    if (e instanceof StoreUnavailable) { res.status(503).json({ message: "Racing saves are not set up yet.", storage: "unavailable" }); return; }
    const msg = e instanceof Error ? e.message : "Something went wrong.";
    if (!(e instanceof Error) || !/^(Not enough|Already|Unknown|Max|That|Only|Room|You|Pick|Wait)/.test(msg)) console.error("[racing]", e);
    res.status(409).json({ message: msg });
  };
  const uid = (req: any) => String(req.user.id);

  /** Load (or create) a player's save; run a mutation and persist it. */
  const mutate = (id: string, fn: (s: RacingSave) => RacingSave | void) => withLock(id, async () => {
    const cur = (await store.get(id)) || freshRacingSave();
    const next = fn(cur) || cur;
    await store.put(id, sanitizeSave(next));
    return sanitizeSave(next);
  });

  // ---------------- progression ----------------
  app.get("/api/racing/profile", auth, access, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    try {
      const s = await store.get(uid(req));
      res.json({ storage: "db", save: s, exists: !!s });
    } catch (e) { fail(res, e); }
  });

  // one-time import of a save that was kept in the browser before saves moved to the server
  app.post("/api/racing/import", auth, access, async (req: any, res) => {
    try {
      const id = uid(req);
      const save = await withLock(id, async () => {
        const existing = await store.get(id);
        if (existing) return existing;
        const imported = sanitizeSave(req.body?.save, 3000);
        await store.put(id, imported);
        return imported;
      });
      res.json({ save });
    } catch (e) { fail(res, e); }
  });

  app.post("/api/racing/buy-kart", auth, access, async (req: any, res) => {
    try {
      const body = BODIES.find((b) => b.id === req.body?.body);
      if (!body) throw new Error("Unknown kart.");
      const save = await mutate(uid(req), (s) => {
        if (s.owned.includes(body.id)) throw new Error("Already owned.");
        if (s.coins < body.price) throw new Error("Not enough coins.");
        s.coins -= body.price; s.owned.push(body.id); s.body = body.id;
      });
      res.json({ save });
    } catch (e) { fail(res, e); }
  });

  app.post("/api/racing/upgrade", auth, access, async (req: any, res) => {
    try {
      const bodyId = String(req.body?.body || ""), up = String(req.body?.upgrade || "") as UpgradeId;
      if (!["engine", "turbo", "tires"].includes(up)) throw new Error("Unknown upgrade.");
      const save = await mutate(uid(req), (s) => {
        if (!s.owned.includes(bodyId)) throw new Error("You don't own that kart.");
        const cur = upgradesFor(s, bodyId), lvl = cur[up];
        if (lvl >= MAX_UPGRADE) throw new Error("Max level reached.");
        if (s.coins < UPGRADE_COST[lvl]) throw new Error("Not enough coins.");
        s.coins -= UPGRADE_COST[lvl];
        s.upgrades[bodyId] = { ...cur, [up]: lvl + 1 };
      });
      res.json({ save });
    } catch (e) { fail(res, e); }
  });

  app.post("/api/racing/customize", auth, access, async (req: any, res) => {
    try {
      const b = req.body || {};
      const save = await mutate(uid(req), (s) => {
        if (typeof b.body === "string" && s.owned.includes(b.body)) s.body = b.body;
        if (PAINTS.includes(b.paint)) s.paint = b.paint;
        if (PAINTS.includes(b.helmet)) s.helmet = b.helmet;
        if (Number.isInteger(b.driver) && b.driver >= 0 && b.driver <= 4) s.driver = b.driver;
      });
      res.json({ save });
    } catch (e) { fail(res, e); }
  });

  // single-player result: reward is recomputed and capped on the server
  app.post("/api/racing/result", auth, access, async (req: any, res) => {
    try {
      const id = uid(req), now = Date.now();
      const b = req.body || {};
      const mode = b.mode === "tt" ? "tt" : b.mode === "gp" ? "gp" : "race";
      const trackId = TRACK_IDS.includes(b.trackId) ? b.trackId : null;
      const time = Number(b.time), bestLap = Number(b.bestLap), place = Math.round(Number(b.place)), cc = [50, 100, 150].includes(b.cc) ? b.cc : 100;
      if (!trackId || !Number.isFinite(time) || time < 25 || time > 3600) throw new Error("That race result doesn't look right.");
      if (now - (lastResult.get(id) || 0) < 20_000) throw new Error("Wait a moment before claiming another race.");
      lastResult.set(id, now);
      const reward = raceReward(mode, mode === "tt" ? 1 : Math.max(1, Math.min(8, place || 8)), Number(b.coins) || 0, cc);
      const save = await mutate(id, (s) => {
        s.coins += reward; s.races += 1; if (mode !== "tt" && place === 1) s.wins += 1;
        const ms = Math.round(time * 1000), lapMs = Math.round(bestLap * 1000);
        if (!s.bestRace[trackId] || ms < s.bestRace[trackId]) s.bestRace[trackId] = ms;
        if (Number.isFinite(lapMs) && lapMs > 5000 && (!s.bestLap[trackId] || lapMs < s.bestLap[trackId])) s.bestLap[trackId] = lapMs;
      });
      res.json({ save, reward });
    } catch (e) { fail(res, e); }
  });

  app.post("/api/racing/cup", auth, access, async (req: any, res) => {
    try {
      const id = uid(req), now = Date.now();
      const place = Math.max(1, Math.min(8, Math.round(Number(req.body?.place) || 8)));
      const cc = [50, 100, 150].includes(req.body?.cc) ? req.body.cc : 100;
      if (now - (lastCup.get(id) || 0) < 150_000) throw new Error("Wait a moment before claiming another cup.");
      lastCup.set(id, now);
      const reward = cupReward(place);
      const save = await mutate(id, (s) => {
        s.coins += reward;
        const k = "aurora-" + cc;
        s.cups[k] = Math.min(s.cups[k] || 99, place);
      });
      res.json({ save, reward });
    } catch (e) { fail(res, e); }
  });

  // ---------------- online rooms ----------------
  const lookFor = async (req: any): Promise<{ look: RaceLook; upgrades: Record<UpgradeId, number> }> => {
    let save: RacingSave | null = null;
    try { save = await store.get(uid(req)); } catch { save = null; }
    if (!save) save = sanitizeSave(req.body?.profile); // no server save: trust the (sanitised) local profile
    return { look: { body: save.body, paint: save.paint, helmet: save.helmet, driver: save.driver }, upgrades: upgradesFor(save, save.body) };
  };
  const makeHuman = (req: any, prof: { look: RaceLook; upgrades: Record<UpgradeId, number> }): RPlayer => ({
    id: uid(req), name: nameOf(req.user), bot: false, look: prof.look, upgrades: prof.upgrades, ready: false, connected: true,
    st: null, lastSeen: Date.now(), finishTime: 0, scope: scopeOf(req.user), wsSentSeq: 0, wsSentMv: -1,
  });
  const leaveAll = (id: string, except?: string) => { Array.from(rooms.values()).forEach((r) => { if (r.code !== except && r.players.some((p) => p.id === id)) removePlayer(r, id); }); };
  const createRoom = (req: any, publicRoom: boolean, host: RPlayer): RRoom => {
    let code = "";
    do code = String(randomInt(100000, 1000000)); while (rooms.has(code));
    const room: RRoom = {
      code, hostId: host.id, publicRoom, scope: scopeOf(req.user), trackId: TRACK_IDS[randomInt(0, TRACK_IDS.length)], cc: 100, laps: 3, bots: true,
      players: [host], phase: "lobby", phaseEnds: 0, startAt: 0, firstFinish: 0, raceNo: 0, metaV: 1, seq: 0, events: [], results: null, createdAt: Date.now(),
    };
    rooms.set(code, room);
    syncBots(room);
    ensureTicker();
    return room;
  };
  const joinRoom = (room: RRoom, p: RPlayer) => {
    const existing = room.players.find((q) => q.id === p.id);
    if (existing) { existing.lastSeen = Date.now(); existing.connected = true; existing.look = p.look; existing.upgrades = p.upgrades; bump(room); return existing; }
    if (room.players.filter((q) => !q.bot).length >= RACE_MAX) throw new Error("That room is full.");
    if (room.phase !== "lobby" && room.phase !== "results") throw new Error("That race already started — try again in a moment.");
    room.players.push(p);
    syncBots(room);
    pushEvent(room, { k: "info", text: p.name + " joined" });
    return p;
  };
  const member = (req: any) => {
    const room = rooms.get(String(req.params.code || ""));
    if (!room) throw new Error("Room not found — it may have closed.");
    const me = room.players.find((p) => p.id === uid(req) && !p.bot);
    if (!me) throw new Error("You are not in this room any more.");
    me.lastSeen = Date.now();
    if (!me.connected) { me.connected = true; bump(room); }
    return { room, me };
  };
  const wrap = (fn: (req: any, res: any) => Promise<void> | void): RequestHandler => async (req, res) => {
    res.set("Cache-Control", "no-store");
    try { await fn(req, res); } catch (e) { fail(res, e); }
  };

  app.get("/api/racing/rooms", auth, access, wrap((req, res) => {
    const scope = scopeOf(req.user);
    res.json(Array.from(rooms.values()).filter((r) => r.publicRoom && r.scope === scope && r.players.filter((p) => !p.bot).length < RACE_MAX).slice(0, 12).map((r) => ({
      code: r.code, host: r.players.find((p) => p.id === r.hostId)?.name || "Racer", humans: r.players.filter((p) => !p.bot).length, phase: r.phase, trackId: r.trackId,
    })));
  }));
  app.post("/api/racing/quick", auth, access, wrap(async (req, res) => {
    const prof = await lookFor(req);
    const me = makeHuman(req, prof), scope = scopeOf(req.user);
    let room = Array.from(rooms.values()).find((r) => r.players.some((p) => p.id === me.id && !p.bot));
    if (!room) {
      const open = Array.from(rooms.values()).filter((r) => r.publicRoom && r.scope === scope && (r.phase === "lobby" || r.phase === "results") && r.players.filter((p) => !p.bot).length < RACE_MAX);
      open.sort((a, b) => b.players.filter((p) => !p.bot).length - a.players.filter((p) => !p.bot).length);
      room = open[0];
    }
    leaveAll(me.id, room?.code);
    if (!room) room = createRoom(req, true, me); else joinRoom(room, me);
    res.json(snapshot(room, me, -1, -1, Date.now()));
  }));
  app.post("/api/racing/rooms", auth, access, wrap(async (req, res) => {
    const me = makeHuman(req, await lookFor(req));
    leaveAll(me.id);
    const room = createRoom(req, req.body?.publicRoom === true, me);
    res.json(snapshot(room, me, -1, -1, Date.now()));
  }));
  app.post("/api/racing/rooms/:code/join", auth, access, wrap(async (req, res) => {
    const room = rooms.get(String(req.params.code || ""));
    if (!room) throw new Error("Room not found. Check the code and try again.");
    const me = makeHuman(req, await lookFor(req));
    leaveAll(me.id, room.code);
    joinRoom(room, me);
    res.json(snapshot(room, me, -1, -1, Date.now()));
  }));
  app.get("/api/racing/rooms/:code", auth, access, wrap((req, res) => { const { room, me } = member(req); res.json(snapshot(room, me, -1, -1, Date.now())); }));
  app.post("/api/racing/rooms/:code/leave", auth, access, wrap((req, res) => {
    const room = rooms.get(String(req.params.code || ""));
    if (room) removePlayer(room, uid(req));
    res.json({ ok: true });
  }));
  app.post("/api/racing/rooms/:code/action", auth, access, wrap((req, res) => {
    const { room, me } = member(req);
    const type = String(req.body?.type || "");
    const host = room.hostId === me.id;
    if (type === "ready") { me.ready = !!req.body?.ready; bump(room); }
    else if (type === "settings") {
      if (!host) throw new Error("Only the host can change race settings.");
      if (room.phase !== "lobby" && room.phase !== "results") throw new Error("Wait for the race to finish.");
      if (TRACK_IDS.includes(req.body?.trackId)) room.trackId = req.body.trackId;
      if ([50, 100, 150].includes(req.body?.cc)) room.cc = req.body.cc;
      if ([1, 2, 3, 5].includes(req.body?.laps)) room.laps = req.body.laps;
      if (typeof req.body?.bots === "boolean") { room.bots = req.body.bots; syncBots(room); }
      bump(room);
    } else if (type === "start") {
      if (!host) throw new Error("Only the host can start the race.");
      if (room.phase !== "lobby" && room.phase !== "results") throw new Error("The race is already running.");
      if (room.players.length < 2) throw new Error("Turn on bots or wait for another racer.");
      startRace(room);
    } else throw new Error("Unknown action.");
    res.json(snapshot(room, me, -1, -1, Date.now()));
  }));
  app.post("/api/racing/rooms/:code/sync", auth, access, wrap((req, res) => {
    const { room, me } = member(req);
    const msg = (req.body || {}) as RaceClientSync;
    handleSync(room, me, msg);
    res.json(snapshot(room, me, typeof msg.ack === "number" ? msg.ack : -1, typeof msg.mv === "number" ? msg.mv : -1, Date.now()));
  }));

  // ---------------- race logic ----------------
  function startRace(room: RRoom) {
    const now = Date.now();
    room.raceNo++;
    room.phase = "countdown";
    room.startAt = now + 7000; // 3 s fly-by + 3 s lights + a little slack
    room.firstFinish = 0;
    room.results = null;
    room.events = [];
    for (const p of room.players) { p.st = null; p.finishTime = 0; }
    // humans and bots get shuffled onto the grid, humans further back for fairness
    const humans = room.players.filter((p) => !p.bot), bots = room.players.filter((p) => p.bot);
    room.players = [...bots, ...humans.sort(() => Math.random() - 0.5)];
    bump(room);
  }

  function handleSync(room: RRoom, me: RPlayer, msg: RaceClientSync) {
    me.lastSeen = Date.now();
    if (typeof msg.echo === "number") me.echo = msg.echo;
    if (msg.raceNo !== room.raceNo || (room.phase !== "racing" && room.phase !== "countdown")) return;
    if (validState(msg.st) && !me.finishTime) me.st = msg.st;
    else if (validState(msg.st) && me.finishTime) me.st = msg.st;
    const host = room.hostId === me.id;
    if (host && Array.isArray(msg.bots)) {
      for (const b of msg.bots.slice(0, RACE_MAX)) {
        const bot = room.players.find((p) => p.bot && p.id === b?.id);
        if (bot && validState(b.st)) bot.st = b.st;
      }
    }
    if (!Array.isArray(msg.ev)) return;
    const elapsed = (Date.now() - room.startAt) / 1000;
    for (const ev of msg.ev.slice(0, 30)) {
      if (!ev || typeof ev !== "object") continue;
      const actorId = (ev as { by?: string; id?: string }).by || (ev as { id?: string }).id || me.id;
      const actor = room.players.find((p) => p.id === actorId);
      if (!actor || (actor.id !== me.id && !(host && actor.bot))) continue;
      if (ev.k === "item" && ["slick", "bomb", "orb"].includes(ev.kind) && typeof ev.hid === "string" && ev.hid.length < 40) {
        pushEvent(room, { k: "item", by: actor.id, kind: ev.kind, hid: ev.hid, at: Number(ev.at) || 0, lat: Number(ev.lat) || 0, target: typeof ev.target === "string" ? ev.target : null });
      } else if (ev.k === "gone" && typeof ev.hid === "string") {
        pushEvent(room, { k: "gone", hid: ev.hid });
      } else if (ev.k === "finish" && !actor.finishTime) {
        const t = Number(ev.time);
        // plausibility: at least ~13 s per lap and not longer than the race has been running
        if (!Number.isFinite(t) || t < room.laps * 13 || t > elapsed + 3) continue;
        actor.finishTime = t;
        if (!room.firstFinish) room.firstFinish = Date.now();
        pushEvent(room, { k: "finish", id: actor.id, time: t });
      }
    }
  }

  async function finishRace(room: RRoom) {
    room.phase = "results";
    room.phaseEnds = Date.now() + 20000;
    const rows = standings(room);
    const valid = Date.now() - room.startAt > 25_000;
    for (const row of rows) {
      const p = room.players.find((q) => q.id === row.id);
      if (!p || p.bot) continue;
      const picked = p.st ? p.st[14] : 0;
      row.coins = valid ? raceReward("online", row.place, picked, room.cc) : 0;
      if (row.coins > 0) {
        const place = row.place, coins = row.coins;
        void withLock(p.id, async () => {
          const cur = (await store.get(p.id)) || freshRacingSave();
          cur.coins += coins; cur.races += 1; if (place === 1) cur.wins += 1;
          await store.put(p.id, sanitizeSave(cur));
        }).catch((e) => { if (!(e instanceof StoreUnavailable)) console.error("[racing] reward", e); });
      }
    }
    room.results = rows;
    bump(room);
  }

  function removePlayer(room: RRoom, id: string) {
    const p = room.players.find((q) => q.id === id);
    if (!p) return;
    room.players = room.players.filter((q) => q.id !== id);
    if (!room.players.some((q) => !q.bot)) { rooms.delete(room.code); return; }
    if (room.hostId === id) {
      room.hostId = room.players.find((q) => !q.bot)!.id;
      // bots are driven by the host's browser, so they leave with the old host mid-race
      if (room.phase === "racing" || room.phase === "countdown") room.players = room.players.filter((q) => !q.bot);
    }
    pushEvent(room, { k: "info", text: p.name + " left" });
    if (room.phase === "lobby" || room.phase === "results") syncBots(room);
    bump(room);
  }

  // ---------------- ticker ----------------
  let ticker: ReturnType<typeof setInterval> | null = null;
  let tickN = 0;
  function ensureTicker() {
    if (ticker) return;
    ticker = setInterval(() => {
      const now = Date.now();
      tickN++;
      Array.from(rooms.values()).forEach((room) => {
        try {
          // connection housekeeping
          for (const p of room.players.slice()) {
            if (p.bot) continue;
            const was = p.connected;
            p.connected = now - p.lastSeen < 10_000;
            if (was !== p.connected) bump(room);
            if (now - p.lastSeen > 45_000) removePlayer(room, p.id);
          }
          if (!rooms.has(room.code)) return;
          if (now - room.createdAt > 4 * 3600_000) { rooms.delete(room.code); return; }
          if (room.phase === "countdown" && now >= room.startAt) { room.phase = "racing"; bump(room); }
          if (room.phase === "racing") {
            const humans = room.players.filter((p) => !p.bot && p.connected);
            const allDone = humans.length > 0 && humans.every((p) => p.finishTime);
            const timeout = now - room.startAt > 8 * 60_000;
            const grace = room.firstFinish && now - room.firstFinish > 30_000;
            if (allDone || timeout || grace) void finishRace(room);
          }
          if (room.phase === "results" && now >= room.phaseEnds) { room.phase = "lobby"; room.results = null; for (const p of room.players) { p.st = null; p.finishTime = 0; } syncBots(room); }
          pushWs(room, now);
        } catch (err) { console.error("[racing] tick", err); }
      });
      if (!rooms.size && ticker) { clearInterval(ticker); ticker = null; }
    }, 50);
    if (ticker && typeof ticker === "object" && "unref" in ticker) ticker.unref();
  }

  // ---------------- websocket fast path ----------------
  const sockets = new Map<WebSocket, { room: string; id: string }>();
  function pushWs(room: RRoom, now: number) {
    const slow = room.phase === "lobby" || room.phase === "results";
    if (slow && tickN % 6 !== 0) return;
    sockets.forEach((info, ws) => {
      if (info.room !== room.code || ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > 256 * 1024) return;
      const me = room.players.find((p) => p.id === info.id);
      if (!me) return;
      const snap = snapshot(room, me, me.wsSentSeq, me.wsSentMv, now);
      me.wsSentSeq = room.seq; me.wsSentMv = room.metaV;
      try { ws.send(JSON.stringify(snap)); } catch { /* closing */ }
    });
  }

  const { httpServer, resolveToken } = options;
  if (!httpServer || !resolveToken) return;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    let url: URL;
    try { url = new URL(req.url || "", "http://localhost"); } catch { return; }
    if (!url.pathname.endsWith("/api/racing/ws")) return;
    const reject = (status: number, text: string) => { try { socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); } catch { /* ignore */ } socket.destroy(); };
    resolveToken(url.searchParams.get("token") || "").then((user) => {
      if (!user || denied(user)) return reject(401, "Unauthorized");
      const room = rooms.get(url.searchParams.get("code") || "");
      const id = String(user.id);
      const me = room?.players.find((p) => p.id === id && !p.bot);
      if (!room || !me) return reject(404, "Not Found");
      wss.handleUpgrade(req, socket, head, (ws) => {
        sockets.forEach((info, other) => { if (info.id === id && other !== ws) { try { other.close(4000, "replaced"); } catch { /* ignore */ } } });
        sockets.set(ws, { room: room.code, id });
        me.wsSentSeq = room.seq; me.wsSentMv = -1; me.lastSeen = Date.now();
        ws.on("message", (data) => {
          const info = sockets.get(ws); if (!info) return;
          const r = rooms.get(info.room); const p = r?.players.find((q) => q.id === info.id && !q.bot);
          if (!r || !p) { try { ws.close(4001, "room closed"); } catch { /* ignore */ } return; }
          let msg: RaceClientSync; try { msg = JSON.parse(String(data)); } catch { return; }
          if (msg && typeof msg === "object") { try { handleSync(r, p, msg); } catch (err) { console.error("[racing] ws sync", err); } }
        });
        ws.on("close", () => sockets.delete(ws));
        ws.on("error", () => sockets.delete(ws));
        try { ws.send(JSON.stringify(snapshot(room, me, -1, -1, Date.now()))); me.wsSentMv = room.metaV; } catch { /* ignore */ }
        ensureTicker();
      });
    }).catch(() => reject(500, "Internal Server Error"));
  });
}

export { KF };
