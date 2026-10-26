// LivePod: a creator goes live with their podcast; listeners hear them, chat, send Cheers and likes,
// and share. Audio goes straight from the host's browser to each listener's (WebRTC), so this server
// only introduces them and carries the chat; that keeps it light on the current plan. Rooms live in
// memory on this one server; when a LivePod ends its numbers are saved for the creator's Studio.
import type { Server } from "node:http";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { randomBytes } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { BIG_CHEER, CHEER_BUDGET, LIVE_AUDIO_CAP, LIVE_CHAT_MAX, LIVE_TITLE_MAX, LIVE_TOPICS, cheerOf, cleanLiveText } from "../shared/earshotCreators";

export type LiveProfile = { handle: string; name: string; bio: string; avatar: string };
type Person = { voter: string; profile: LiveProfile | null };
export type LiveMsg = { id: string; at: number; kind: "chat" | "cheer" | "join" | "note"; who: { handle: string; name: string } | null; text: string; cheer?: string; points?: number };
type Conn = { id: string; ws: WebSocket; person: Person; role: "host" | "listener"; audio: boolean; lastChat: number; lastCheer: number; alive: boolean };
type Room = {
  id: string; host: Person & { profile: LiveProfile }; title: string; topic: string; startedAt: number;
  hostConn: Conn | null; hostGoneAt: number | null; conns: Map<string, Conn>; chat: LiveMsg[]; pinned: LiveMsg | null;
  spent: Map<string, number>; muted: Set<string>; ended: boolean; endedAt: number;
  stats: { peak: number; listeners: Set<string>; comments: number; cheers: number; cheerPoints: number; likes: number; shares: number };
  likeBurst: number; dirty: boolean;
};
export type LiveSummary = { id: string; title: string; topic: string; host: LiveProfile; listeners: number; likes: number; startedAt: number };

const rooms = new Map<string, Room>();
const tickets = new Map<string, { person: Person; room: string; role: "host" | "listener"; exp: number }>();
const id = (n = 9) => randomBytes(n).toString("base64url");
const send = (c: Conn | null | undefined, m: unknown) => { if (c && c.ws.readyState === WebSocket.OPEN) { try { c.ws.send(JSON.stringify(m)); } catch { /* closed */ } } };
const everyone = (r: Room, m: unknown, except?: string) => r.conns.forEach((c) => { if (c.id !== except) send(c, m); });
const listenerCount = (r: Room) => Array.from(r.conns.values()).filter((c) => c.role === "listener").length;
const summary = (r: Room): LiveSummary => ({ id: r.id, title: r.title, topic: r.topic, host: r.host.profile, listeners: listenerCount(r), likes: r.stats.likes, startedAt: r.startedAt });

/** LivePods on now, busiest first. */
export function liveNow(): LiveSummary[] { return Array.from(rooms.values()).filter((r) => !r.ended && r.hostConn).map(summary).sort((a, b) => b.listeners - a.listeners || b.startedAt - a.startedAt); }
export const liveOf = (roomId: string) => { const r = rooms.get(roomId); return r && !r.ended ? summary(r) : null; };
export const liveByHost = (voter: string) => Array.from(rooms.values()).find((r) => !r.ended && r.host.voter === voter) ?? null;

/** Starts a LivePod (or returns the one this host already has going). */
export function startLive(host: Person & { profile: LiveProfile }, title: string, topic: string): { id: string } {
  const open = liveByHost(host.voter);
  if (open) return { id: open.id };
  const r: Room = {
    id: id(), host, title: cleanLiveText(title, LIVE_TITLE_MAX) || `${host.profile.name} is live`, topic: (LIVE_TOPICS as readonly string[]).includes(topic) ? topic : "Talk",
    startedAt: Date.now(), hostConn: null, hostGoneAt: Date.now(), conns: new Map(), chat: [], pinned: null, spent: new Map(), muted: new Set(), ended: false, endedAt: 0,
    stats: { peak: 0, listeners: new Set(), comments: 0, cheers: 0, cheerPoints: 0, likes: 0, shares: 0 }, likeBurst: 0, dirty: true,
  };
  rooms.set(r.id, r);
  return { id: r.id };
}

/** A one-minute pass to open the LivePod's connection (the app asks for it over its usual sign-in). */
export function liveTicket(person: Person, roomId: string, role: "host" | "listener"): string | null {
  const r = rooms.get(roomId);
  if (!r || r.ended) return null;
  if (role === "host" && r.host.voter !== person.voter) return null;
  const t = id(24);
  tickets.set(t, { person, room: roomId, role, exp: Date.now() + 60_000 });
  return t;
}

function note(r: Room, m: Omit<LiveMsg, "id" | "at">) {
  const msg: LiveMsg = { id: id(6), at: Date.now(), ...m };
  if (m.kind !== "join") { r.chat.push(msg); if (r.chat.length > 80) r.chat.splice(0, r.chat.length - 80); }
  everyone(r, { t: "msg", msg });
  return msg;
}

let save: ((r: Room) => Promise<void>) | null = null;
function end(r: Room, why: string) {
  if (r.ended) return;
  r.ended = true; r.endedAt = Date.now();
  const s = { title: r.title, minutes: Math.round((r.endedAt - r.startedAt) / 60000), peak: r.stats.peak, listeners: r.stats.listeners.size, comments: r.stats.comments, cheers: r.stats.cheers, cheerPoints: r.stats.cheerPoints, likes: r.stats.likes, shares: r.stats.shares };
  everyone(r, { t: "ended", why, summary: s });
  setTimeout(() => r.conns.forEach((c) => { try { c.ws.close(4000, "ended"); } catch { /* gone */ } }), 400);
  if (save) save(r).catch((e) => console.error("[livepod] save:", e?.message || e));
  // unref: a pending cleanup never keeps the process alive on its own (tests, shutdown)
  setTimeout(() => rooms.delete(r.id), 10 * 60_000).unref?.();
}

/** Puts LivePod on the server's websocket at /api/live/ws, and saves ended LivePods to the database. */
export function attachLivePods(httpServer: Server, getDb?: () => any) {
  if (getDb) save = async (r) => {
    if (r.endedAt - r.startedAt < 30_000 && r.stats.listeners.size === 0) return; // a false start
    const { error } = await getDb().from("podcast_live_sessions").insert({
      voter: r.host.voter, title: r.title, started_at: new Date(r.startedAt).toISOString(), ended_at: new Date(r.endedAt).toISOString(),
      peak: r.stats.peak, listeners: r.stats.listeners.size, comments: r.stats.comments, cheers: r.stats.cheers, cheer_points: r.stats.cheerPoints, likes: r.stats.likes, shares: r.stats.shares,
    });
    if (error) throw error;
  };
  const wss = new WebSocketServer({ noServer: true, maxPayload: 32 * 1024 });

  httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    let url: URL;
    try { url = new URL(req.url || "", "http://localhost"); } catch { return; }
    if (url.pathname !== "/api/live/ws") return;
    const t = tickets.get(url.searchParams.get("ticket") || "");
    const reject = (status: number, text: string) => { try { socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); } catch { /* gone */ } socket.destroy(); };
    if (!t || t.exp < Date.now()) return reject(401, "Unauthorized");
    tickets.delete(url.searchParams.get("ticket") || "");
    const r = rooms.get(t.room);
    if (!r || r.ended) return reject(404, "Not Found");
    wss.handleUpgrade(req, socket, head, (ws) => join(r, ws, t.person, t.role));
  });

  // Keep connections honest, close LivePods whose host left, and send the room's numbers.
  // (unref: these never keep the process alive on their own; the web server does that. Without it
  // the test run never finishes.)
  const keepHonest = setInterval(() => {
    const now = Date.now();
    for (const t of Array.from(tickets.entries())) if (t[1].exp < now) tickets.delete(t[0]);
    rooms.forEach((r) => {
      if (r.ended) return;
      if (!r.hostConn && r.hostGoneAt && now - r.hostGoneAt > 90_000) return end(r, "The host left.");
      if (now - r.startedAt > 6 * 3600_000) return end(r, "LivePods can run up to 6 hours.");
      r.conns.forEach((c) => { if (!c.alive) { try { c.ws.terminate(); } catch { /* gone */ } return; } c.alive = false; try { c.ws.ping(); } catch { /* gone */ } });
    });
  }, 25_000);
  keepHonest.unref?.();
  const numbers = setInterval(() => rooms.forEach((r) => {
    if (r.ended || (!r.dirty && !r.likeBurst)) return;
    everyone(r, { t: "room", listeners: listenerCount(r), peak: r.stats.peak, likes: r.stats.likes, burst: r.likeBurst, cheerPoints: r.stats.cheerPoints });
    r.likeBurst = 0; r.dirty = false;
  }), 1000);
  numbers.unref?.();
}

function join(r: Room, ws: WebSocket, person: Person, role: "host" | "listener") {
  const c: Conn = { id: id(6), ws, person, role, audio: false, lastChat: 0, lastCheer: 0, alive: true };
  ws.on("pong", () => { c.alive = true; });
  if (role === "host") {
    if (r.hostConn) { try { r.hostConn.ws.close(4001, "replaced"); } catch { /* gone */ } r.conns.delete(r.hostConn.id); }
    r.hostConn = c; r.hostGoneAt = null;
  } else {
    // One connection per listener; a second tab takes over.
    r.conns.forEach((x) => { if (x.role === "listener" && x.person.voter === person.voter) { try { x.ws.close(4001, "replaced"); } catch { /* gone */ } } });
    c.audio = Array.from(r.conns.values()).filter((x) => x.audio).length < LIVE_AUDIO_CAP;
    r.stats.listeners.add(person.voter);
  }
  r.conns.set(c.id, c);
  r.stats.peak = Math.max(r.stats.peak, listenerCount(r));
  r.dirty = true;
  send(c, {
    t: "hello", you: { id: c.id, role, audio: c.audio, canChat: !!person.profile, spent: r.spent.get(person.voter) ?? 0, handle: person.profile?.handle ?? null },
    room: { ...summary(r), live: !!r.hostConn }, chat: r.chat.slice(-40), pinned: r.pinned, stats: { peak: r.stats.peak, likes: r.stats.likes, cheerPoints: r.stats.cheerPoints },
  });
  if (role === "host") r.conns.forEach((x) => { if (x.audio) send(c, { t: "peer", id: x.id }); });
  else {
    if (c.audio) send(r.hostConn, { t: "peer", id: c.id });
    if (person.profile) note(r, { kind: "join", who: { handle: person.profile.handle, name: person.profile.name }, text: "joined" });
  }

  ws.on("message", (data) => {
    let m: any; try { m = JSON.parse(String(data)); } catch { return; }
    if (!m || typeof m !== "object" || r.ended) return;
    const isHost = c.role === "host";
    switch (m.t) {
      case "signal": { // the audio handshake between host and a listener
        if (!m.data || typeof m.data !== "object") return;
        if (isHost) send(r.conns.get(String(m.to)), { t: "signal", from: c.id, data: m.data });
        else if (c.audio) send(r.hostConn, { t: "signal", from: c.id, data: m.data });
        return;
      }
      case "chat": {
        const text = cleanLiveText(m.text, LIVE_CHAT_MAX);
        if (!text || !c.person.profile) return;
        if (r.muted.has(c.person.voter)) return send(c, { t: "error", text: "The host has turned off your comments in this LivePod." });
        if (!isHost && Date.now() - c.lastChat < 1200) return;
        c.lastChat = Date.now(); r.stats.comments++;
        note(r, { kind: "chat", who: { handle: c.person.profile.handle, name: c.person.profile.name }, text });
        return;
      }
      case "cheer": {
        const cheer = cheerOf(m.id);
        if (!cheer || isHost || !c.person.profile) return;
        const spent = r.spent.get(c.person.voter) ?? 0;
        if (spent + cheer.points > CHEER_BUDGET) return send(c, { t: "error", text: "You've used your Cheers for this LivePod. Thanks for the love!" });
        if (Date.now() - c.lastCheer < 700) return send(c, { t: "error", text: "One Cheer at a time." });
        c.lastCheer = Date.now();
        r.spent.set(c.person.voter, spent + cheer.points);
        r.stats.cheers++; r.stats.cheerPoints += cheer.points; r.dirty = true;
        note(r, { kind: "cheer", who: { handle: c.person.profile.handle, name: c.person.profile.name }, text: `sent ${cheer.name}`, cheer: cheer.id, points: cheer.points });
        send(c, { t: "spent", spent: spent + cheer.points });
        if (cheer.points >= BIG_CHEER) r.dirty = true;
        return;
      }
      case "like": {
        const n = Math.max(1, Math.min(15, Math.floor(Number(m.n) || 1)));
        r.stats.likes += n; r.likeBurst += n;
        return;
      }
      case "share": { r.stats.shares++; return; }
      case "pin": {
        if (!isHost) return;
        r.pinned = m.id ? r.chat.find((x) => x.id === m.id && x.kind === "chat") ?? null : null;
        everyone(r, { t: "pinned", msg: r.pinned });
        return;
      }
      case "remove": {
        if (!isHost) return;
        r.chat = r.chat.filter((x) => x.id !== m.id);
        if (r.pinned?.id === m.id) { r.pinned = null; everyone(r, { t: "pinned", msg: null }); }
        everyone(r, { t: "removed", id: m.id });
        return;
      }
      case "mute": {
        if (!isHost) return;
        const who = Array.from(r.conns.values()).find((x) => x.person.profile?.handle === m.handle);
        if (who && who.person.voter !== r.host.voter) { r.muted.add(who.person.voter); r.chat = r.chat.filter((x) => x.who?.handle !== m.handle); everyone(r, { t: "muted", handle: m.handle }); }
        return;
      }
      case "end": { if (isHost) end(r, "The host ended the LivePod."); return; }
    }
  });
  ws.on("close", () => {
    if (r.conns.get(c.id) !== c) return;
    r.conns.delete(c.id); r.dirty = true;
    if (c.role === "host") { if (r.hostConn === c) { r.hostConn = null; r.hostGoneAt = Date.now(); everyone(r, { t: "host", here: false }); } }
    else {
      send(r.hostConn, { t: "leave", id: c.id });
      // A listener who was hearing audio frees a place: the next one waiting gets it.
      if (c.audio) { const next = Array.from(r.conns.values()).find((x) => x.role === "listener" && !x.audio); if (next) { next.audio = true; send(next, { t: "audio", on: true }); send(r.hostConn, { t: "peer", id: next.id }); } }
    }
  });
  if (role === "host") everyone(r, { t: "host", here: true }, c.id);
}

/** For tests. */
export const _rooms = rooms;
