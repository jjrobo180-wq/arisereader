// Prism Paintball — HTTP + WebSocket transport for the authoritative simulation.
import type { Express, RequestHandler } from "express";
import type { Server, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";
import { PB, type BotLevel, type ClientSync } from "../shared/paintball";
import {
  rooms, createRoom, addHuman, removeHuman, switchTeam, syncBots, startMatch, bumpMeta, buildSnapshot,
  handleSync, setTickHook, ensureTicker, type Room, type SPlayer,
} from "./paintballSim";

type AnyUser = { id: number | string; displayName?: string; username?: string; role?: string; is_eye_gaze_user?: boolean; school_id?: unknown; teacherId?: unknown };

const scopeOf = (u: AnyUser) => (u.school_id ? "school:" + u.school_id : u.teacherId ? "teacher:" + u.teacherId : "readers");
const nameOf = (u: AnyUser) => String(u.displayName || u.username || "Reader").replace(/\s+/g, " ").trim().slice(0, 22) || "Reader";
const levelOf = (v: unknown): BotLevel => (v === "easy" || v === "hard" ? v : "normal");
const denied = (u: AnyUser) => u.role === "parent" || !!u.is_eye_gaze_user;

const sockets = new Map<WebSocket, { room: string; id: number }>();

function findMemberRoom(id: number): Room | undefined {
  return Array.from(rooms.values()).find((r) => r.players.some((p) => p.id === id && !p.bot));
}

function joinable(r: Room, scope: string) {
  return r.publicLobby && r.scope === scope && r.players.filter((p) => !p.bot).length < PB.MAX_PLAYERS;
}

/** Push snapshots to websocket clients after every tick. */
setTickHook((room, now) => {
  const lobbyRate = room.phase === "lobby" || room.phase === "finished";
  if (lobbyRate && room.tickCount % 4 !== 0) return;
  for (const p of room.players) {
    if (p.bot) continue;
    sockets.forEach((info, ws) => {
      if (info.room !== room.code || info.id !== p.id || ws.readyState !== WebSocket.OPEN) return;
      if (ws.bufferedAmount > 256 * 1024) return; // slow client: skip a frame rather than queueing
      const snap = buildSnapshot(room, p, p.wsSentSeq, p.wsSentMv, now);
      p.wsSentSeq = room.seq;
      p.wsSentMv = room.metaV;
      try { ws.send(JSON.stringify(snap)); } catch { /* socket closing */ }
    });
  }
});

export interface PaintballOptions {
  httpServer?: Server;
  /** Resolve a session token to a user for websocket auth. */
  resolveToken?: (token: string) => Promise<AnyUser | null>;
}

export function registerPaintballArenaRoutes(app: Express, auth: RequestHandler, options: PaintballOptions = {}) {
  const access: RequestHandler = (req: any, res, next) => {
    if (denied(req.user)) { res.status(403).json({ message: "Prism Paintball is for regular student accounts." }); return; }
    next();
  };
  const wrap = (fn: (req: any, res: any) => void): RequestHandler => (req, res) => {
    try { res.set("Cache-Control", "no-store"); fn(req, res); }
    catch (e) { res.status(409).json({ message: e instanceof Error ? e.message : "Could not update Prism Paintball." }); }
  };
  const userRef = (req: any) => ({ id: Number(req.user.id), name: nameOf(req.user) });
  const memberRoom = (req: any): { room: Room; me: SPlayer } => {
    const room = rooms.get(String(req.params.code || ""));
    if (!room) throw new Error("That paintball room has ended.");
    const me = room.players.find((p) => p.id === Number(req.user.id) && !p.bot);
    if (!me) throw new Error("You are not in this room any more.");
    me.lastSeen = Date.now();
    return { room, me };
  };
  /** Leave any other room before entering a new one. */
  const leaveOthers = (id: number, except?: string) => {
    Array.from(rooms.values()).forEach((r) => { if (r.code !== except && r.players.some((p) => p.id === id && !p.bot)) removeHuman(r, id); });
  };
  const fresh = (room: Room, me: SPlayer) => buildSnapshot(room, me, -1, -1, Date.now());

  app.get("/api/paintball/lobbies", auth, access, wrap((req, res) => {
    const scope = scopeOf(req.user);
    res.json(Array.from(rooms.values()).filter((r) => joinable(r, scope)).slice(0, 12).map((r) => ({
      code: r.code,
      hostName: r.players.find((p) => p.id === r.hostId)?.name || "Reader",
      humans: r.players.filter((p) => !p.bot).length,
      players: r.players.length,
      phase: r.phase,
      quick: r.quick,
    })));
  }));

  // Quick play: rejoin your match, or drop into a public match in your school, or start a new one with bots.
  app.post("/api/paintball/queue", auth, access, wrap((req, res) => {
    const user = userRef(req), scope = scopeOf(req.user);
    let room = findMemberRoom(user.id);
    if (!room) {
      const open = Array.from(rooms.values()).filter((r) => joinable(r, scope) && r.phase !== "finished");
      open.sort((a, b) => b.players.filter((p) => !p.bot).length - a.players.filter((p) => !p.bot).length);
      room = open[0];
    }
    if (!room) room = createRoom(user, { publicLobby: true, practice: false, quick: true, botLevel: "normal", scope });
    leaveOthers(user.id, room.code);
    const me = addHuman(room, user, scope);
    res.json(fresh(room, me));
  }));

  app.post("/api/paintball/rooms", auth, access, wrap((req, res) => {
    const user = userRef(req), scope = scopeOf(req.user);
    leaveOthers(user.id);
    const practice = req.body?.practice === true;
    const room = createRoom(user, { publicLobby: !practice && req.body?.publicLobby !== false, practice, quick: false, botLevel: levelOf(req.body?.botLevel), scope });
    res.json(fresh(room, room.players[0]));
  }));

  app.post("/api/paintball/rooms/:code/join", auth, access, wrap((req, res) => {
    const room = rooms.get(String(req.params.code || ""));
    if (!room) throw new Error("Room not found. Check the code and try again.");
    const user = userRef(req), scope = scopeOf(req.user);
    if (room.practice && room.hostId !== user.id) throw new Error("That is a private practice room.");
    leaveOthers(user.id, room.code);
    const me = addHuman(room, user, scope);
    res.json(fresh(room, me));
  }));

  app.get("/api/paintball/rooms/:code", auth, access, wrap((req, res) => {
    const { room, me } = memberRoom(req);
    res.json(fresh(room, me));
  }));

  app.post("/api/paintball/rooms/:code/leave", auth, access, wrap((req, res) => {
    const room = rooms.get(String(req.params.code || ""));
    if (room) removeHuman(room, Number(req.user.id));
    res.json({ ok: true });
  }));

  app.post("/api/paintball/rooms/:code/sync", auth, access, wrap((req, res) => {
    const { room, me } = memberRoom(req);
    const msg = (req.body || {}) as ClientSync;
    const now = Date.now();
    handleSync(room, me, msg, now);
    const ack = typeof msg.ack === "number" ? msg.ack : -1;
    const mv = typeof msg.mv === "number" ? msg.mv : -1;
    res.json(buildSnapshot(room, me, ack, mv, now));
  }));

  app.post("/api/paintball/rooms/:code/action", auth, access, wrap((req, res) => {
    const { room, me } = memberRoom(req);
    const type = String(req.body?.type || "");
    const isHost = room.hostId === me.id;
    const hostOnly = () => { if (!isHost) throw new Error("Only the room host can do that."); };
    if (type === "start") {
      hostOnly();
      if (room.phase === "playing" || room.phase === "countdown") throw new Error("The match is already running.");
      if (room.players.length < 2) throw new Error("Add another player or computer players first.");
      startMatch(room);
    } else if (type === "switch-team") {
      switchTeam(room, me);
    } else if (type === "add-bots") {
      hostOnly();
      room.botTarget = PB.MAX_PLAYERS;
      syncBots(room);
    } else if (type === "remove-bots") {
      hostOnly();
      room.botTarget = 0;
      syncBots(room);
    } else if (type === "bot-level") {
      hostOnly();
      room.botLevel = levelOf(req.body?.level);
      for (const p of room.players) if (p.bot) p.bot.level = room.botLevel;
      bumpMeta(room);
    } else if (type === "restart") {
      hostOnly();
      if (room.phase !== "finished") throw new Error("Finish the current match first.");
      startMatch(room);
    } else if (type === "lobby") {
      hostOnly();
      if (room.quick) throw new Error("Quick play rooms keep playing.");
      room.phase = "lobby"; room.phaseEnds = 0; room.shots = [];
      bumpMeta(room);
    } else {
      throw new Error("Unknown paintball action.");
    }
    res.json(buildSnapshot(room, me, -1, -1, Date.now()));
  }));

  // ---- WebSocket fast path (falls back to HTTP sync automatically on the client) ----
  const { httpServer, resolveToken } = options;
  if (!httpServer || !resolveToken) return;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    let url: URL;
    try { url = new URL(req.url || "", "http://localhost"); } catch { return; }
    if (!url.pathname.endsWith("/api/paintball/ws")) return; // not ours (e.g. Vite HMR)
    const token = url.searchParams.get("token") || "";
    const code = url.searchParams.get("code") || "";
    const reject = (status: number, text: string) => {
      try { socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); } catch { /* ignore */ }
      socket.destroy();
    };
    resolveToken(token).then((user) => {
      if (!user || denied(user)) return reject(401, "Unauthorized");
      const room = rooms.get(code);
      const id = Number(user.id);
      const me = room?.players.find((p) => p.id === id && !p.bot);
      if (!room || !me) return reject(404, "Not Found");
      wss.handleUpgrade(req, socket, head, (ws) => {
        // one socket per player
        sockets.forEach((info, other) => { if (info.id === id && other !== ws) { try { other.close(4000, "replaced"); } catch { /* ignore */ } } });
        sockets.set(ws, { room: room.code, id });
        me.wsSentSeq = room.seq;
        me.wsSentMv = -1;
        me.lastSeen = Date.now();
        ws.on("message", (data) => {
          const info = sockets.get(ws);
          if (!info) return;
          const r = rooms.get(info.room);
          const p = r?.players.find((q) => q.id === info.id && !q.bot);
          if (!r || !p) { try { ws.close(4001, "room ended"); } catch { /* ignore */ } return; }
          let msg: ClientSync;
          try { msg = JSON.parse(String(data)); } catch { return; }
          if (!msg || typeof msg !== "object") return;
          try { handleSync(r, p, msg, Date.now()); } catch (err) { console.error("[paintball] ws sync error", err); }
        });
        ws.on("close", () => { sockets.delete(ws); });
        ws.on("error", () => { sockets.delete(ws); });
        // first frame immediately so the client knows the socket works
        try { ws.send(JSON.stringify(buildSnapshot(room, me, -1, -1, Date.now()))); me.wsSentMv = room.metaV; } catch { /* ignore */ }
        ensureTicker();
      });
    }).catch(() => reject(500, "Internal Server Error"));
  });
}
