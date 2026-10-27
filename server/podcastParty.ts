// Listen together (Pod+): a group listens to the same episode at the same moment, chats, and up to
// six people can hop on the mic. Anyone in the group can play, pause, skip or pick the episode.
// This server only keeps the group's shared state (which episode, where, playing or not), carries
// the chat, and introduces mic users to the others (WebRTC); the podcast audio itself plays in each
// listener's browser straight from the podcast's host, and voices go browser to browser. Groups live
// in memory on this one server, are joined by link, and close 10 minutes after the last person leaves.
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { randomBytes } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";

export const PARTY_LIMITS = { members: 30, speakers: 6, chat: 280, name: 24, history: 80, rooms: 2000, emptyMs: 10 * 60_000, maxHours: 12 } as const;

export type PartyEp = { id: string; showId: string; title: string; show: string; art: string; audio: string; secs: number };
export type PartyState = { ep: PartyEp | null; pos: number; playing: boolean; at: number; by: string };
export type PartyMsg = { id: string; at: number; who: string; name: string; text: string; kind: "chat" | "note" };
export type PartyMember = { id: string; name: string; mic: boolean };

type Conn = { id: string; ws: WebSocket | null; name: string; device: string; mic: boolean; alive: boolean; lastChat: number; lastControl: number };
export type Party = { id: string; createdAt: number; members: Map<string, Conn>; state: PartyState; chat: PartyMsg[]; emptySince: number | null };

const rid = (n = 9) => randomBytes(n).toString("base64url");
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

/** An episode as a member sent it: only what's needed to play it, and only an https audio link. */
export function cleanEp(v: unknown): PartyEp | null {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  if (!o) return null;
  const audio = str(o.audio, 2000);
  if (!/^https:\/\/[^\s]+$/i.test(audio)) return null;
  const id = str(o.id, 40), showId = str(o.showId, 40);
  if (!/^\d{1,20}$/.test(id) || !/^\d{1,20}$/.test(showId)) return null;
  const art = str(o.art, 1000);
  return { id, showId, title: str(o.title, 300) || "Untitled episode", show: str(o.show, 200), art: /^https:\/\//i.test(art) ? art : "", audio, secs: Math.max(0, Math.min(86_400, Math.round(Number(o.secs) || 0))) };
}
export const cleanName = (v: unknown) => str(v, PARTY_LIMITS.name) || "Listener";

/** Where the episode is now, given the last change (seconds). */
export const posNow = (s: PartyState, now: number) => Math.max(0, s.playing ? s.pos + (now - s.at) / 1000 : s.pos);

export function newParty(id: string, now: number): Party {
  return { id, createdAt: now, members: new Map(), state: { ep: null, pos: 0, playing: false, at: now, by: "" }, chat: [], emptySince: now };
}

/** A member's play / pause / seek / new episode. Anyone may; returns the new state, or null if it changed nothing. */
export function control(p: Party, by: string, m: Record<string, unknown>, now: number): PartyState | null {
  const s = p.state;
  if (m.t === "pick") {
    const ep = cleanEp(m.ep);
    if (!ep) return null;
    p.state = { ep, pos: Math.max(0, Number(m.pos) || 0), playing: true, at: now, by };
    return p.state;
  }
  if (!s.ep) return null;
  if (m.t === "play") p.state = { ...s, pos: posNow(s, now), playing: true, at: now, by };
  else if (m.t === "pause") p.state = { ...s, pos: posNow(s, now), playing: false, at: now, by };
  else if (m.t === "seek") {
    const to = Number(m.pos);
    if (!Number.isFinite(to)) return null;
    const max = s.ep.secs > 0 ? s.ep.secs : 86_400;
    p.state = { ...s, pos: Math.max(0, Math.min(max, to)), at: now, by };
  } else return null;
  return p.state;
}

/** Turning a mic on or off. On only while fewer than six are talking. */
export function setMic(p: Party, memberId: string, on: boolean): { ok: boolean; reason?: string } {
  const c = p.members.get(memberId);
  if (!c) return { ok: false, reason: "You're not in this group." };
  if (!on) { c.mic = false; return { ok: true }; }
  if (c.mic) return { ok: true };
  const talking = Array.from(p.members.values()).filter((x) => x.mic).length;
  if (talking >= PARTY_LIMITS.speakers) return { ok: false, reason: `${PARTY_LIMITS.speakers} people are already on the mic. Try again when someone hops off.` };
  c.mic = true;
  return { ok: true };
}

export const membersOf = (p: Party): PartyMember[] => Array.from(p.members.values()).map((c) => ({ id: c.id, name: c.name, mic: c.mic }));

export function addChat(p: Party, who: Conn | { id: string; name: string } | null, text: string, now: number, kind: PartyMsg["kind"] = "chat"): PartyMsg | null {
  const t = str(text, PARTY_LIMITS.chat);
  if (!t) return null;
  const msg: PartyMsg = { id: rid(6), at: now, who: who?.id ?? "", name: who?.name ?? "", text: t, kind };
  p.chat.push(msg);
  if (p.chat.length > PARTY_LIMITS.history) p.chat.splice(0, p.chat.length - PARTY_LIMITS.history);
  return msg;
}

// ---------------------------------------------------------------------------
// The websocket: /api/party/ws?room=<id|new>&name=<nickname>&device=<pod+ device id>
// ---------------------------------------------------------------------------

const parties = new Map<string, Party>();
const made = new Map<string, number[]>();
const send = (c: Conn | undefined, m: unknown) => { if (c?.ws && c.ws.readyState === WebSocket.OPEN) { try { c.ws.send(JSON.stringify(m)); } catch { /* closed */ } } };
const everyone = (p: Party, m: unknown, except?: string) => p.members.forEach((c) => { if (c.id !== except) send(c, m); });
const stateMsg = (p: Party, now: number) => ({ t: "state", state: p.state, now });

/** Up to 20 new groups per address every 10 minutes. */
function mayCreate(ip: string, now: number) {
  const list = (made.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  if (list.length >= 20) { made.set(ip, list); return false; }
  list.push(now); made.set(ip, list); return true;
}

/** allowed: which sites may open groups (the Pod+ site and local development). */
export function attachListenParties(httpServer: Server, allowed: (origin: string) => boolean) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

  httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    let url: URL;
    try { url = new URL(req.url || "", "http://localhost"); } catch { return; }
    if (url.pathname !== "/api/party/ws") return;
    const reject = (status: number, text: string) => { try { socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); } catch { /* gone */ } socket.destroy(); };
    const origin = String(req.headers.origin || "");
    if (!allowed(origin)) return reject(403, "Forbidden");
    const device = String(url.searchParams.get("device") || "");
    if (!/^[A-Za-z0-9_-]{16,40}$/.test(device)) return reject(400, "Bad Request");
    const now = Date.now();
    let roomId = String(url.searchParams.get("room") || "");
    let p: Party | undefined;
    if (roomId === "new") {
      const f = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean);
      const ip = f[f.length - 1] || String(req.socket?.remoteAddress || "");
      if (parties.size >= PARTY_LIMITS.rooms || !mayCreate(ip, now)) return reject(429, "Too Many Requests");
      roomId = rid(8);
      p = newParty(roomId, now);
      parties.set(roomId, p);
    } else p = parties.get(roomId);
    if (!p) return reject(404, "Not Found");
    if (p.members.size >= PARTY_LIMITS.members && !Array.from(p.members.values()).some((c) => c.device === device)) return reject(409, "Conflict");
    const party = p;
    wss.handleUpgrade(req, socket, head, (ws) => join(party, ws, cleanName(url.searchParams.get("name")), device));
  });

  const sweep = setInterval(() => {
    const now = Date.now();
    parties.forEach((p, id) => {
      p.members.forEach((c) => { if (!c.alive) { try { c.ws?.terminate(); } catch { /* gone */ } return; } c.alive = false; try { c.ws?.ping(); } catch { /* gone */ } });
      if ((p.emptySince && now - p.emptySince > PARTY_LIMITS.emptyMs) || now - p.createdAt > PARTY_LIMITS.maxHours * 3600_000) {
        p.members.forEach((c) => { try { c.ws?.close(4000, "closed"); } catch { /* gone */ } });
        parties.delete(id);
      }
    });
    made.forEach((list, ip) => { if (!list.some((t) => now - t < 10 * 60_000)) made.delete(ip); });
  }, 25_000);
  sweep.unref?.();
}

function join(p: Party, ws: WebSocket, name: string, device: string) {
  // One connection per browser: a second tab takes over.
  p.members.forEach((x) => { if (x.device === device) { try { x.ws?.close(4001, "replaced"); } catch { /* gone */ } p.members.delete(x.id); } });
  const c: Conn = { id: rid(6), ws, name, device, mic: false, alive: true, lastChat: 0, lastControl: 0 };
  p.members.set(c.id, c);
  p.emptySince = null;
  const now = Date.now();
  ws.on("pong", () => { c.alive = true; });
  send(c, { t: "hello", you: c.id, room: p.id, members: membersOf(p), chat: p.chat.slice(-50), ...stateMsg(p, now) });
  const joined = addChat(p, c, `${name} joined`, now, "note");
  everyone(p, { t: "members", members: membersOf(p) }, c.id);
  if (joined) everyone(p, { t: "chat", msg: joined }, c.id);

  ws.on("message", (data) => {
    let m: Record<string, unknown>;
    try { m = JSON.parse(String(data)); } catch { return; }
    if (!m || typeof m !== "object") return;
    const now = Date.now();
    switch (m.t) {
      case "pick": case "play": case "pause": case "seek": {
        if (now - c.lastControl < 250) return;
        c.lastControl = now;
        const s = control(p, c.id, m, now);
        if (!s) return;
        everyone(p, stateMsg(p, now));
        const what = m.t === "pick" ? `put on “${s.ep?.title}”` : m.t === "play" ? "pressed play" : m.t === "pause" ? "paused" : "skipped";
        const n = addChat(p, c, `${c.name} ${what}`, now, "note");
        if (n) everyone(p, { t: "chat", msg: n });
        return;
      }
      case "chat": {
        if (now - c.lastChat < 700) return send(c, { t: "error", text: "Slow down a little." });
        c.lastChat = now;
        const msg = addChat(p, c, String(m.text ?? ""), now);
        if (msg) everyone(p, { t: "chat", msg });
        return;
      }
      case "mic": {
        const r = setMic(p, c.id, m.on === true);
        send(c, { t: "mic", ok: r.ok, on: c.mic, reason: r.reason });
        if (r.ok) everyone(p, { t: "members", members: membersOf(p) });
        return;
      }
      case "name": {
        const n = cleanName(m.name);
        if (n === c.name) return;
        c.name = n;
        everyone(p, { t: "members", members: membersOf(p) });
        return;
      }
      case "signal": {
        // WebRTC introductions between a mic user and a listener. Only within the group.
        const to = p.members.get(String(m.to || ""));
        if (!to || to.id === c.id) return;
        send(to, { t: "signal", from: c.id, key: str(m.key, 40), data: m.data });
        return;
      }
      case "sync": send(c, stateMsg(p, now)); return;
      case "ping": send(c, { t: "pong", now }); return;
    }
  });

  ws.on("close", () => {
    if (p.members.get(c.id) !== c) return;
    p.members.delete(c.id);
    const now = Date.now();
    if (!p.members.size) { p.emptySince = now; if (p.state.playing) p.state = { ...p.state, pos: posNow(p.state, now), playing: false, at: now }; return; }
    everyone(p, { t: "members", members: membersOf(p) });
    const left = addChat(p, null, `${c.name} left`, now, "note");
    if (left) everyone(p, { t: "chat", msg: left });
  });
}
