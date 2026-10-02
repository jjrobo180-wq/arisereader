// Prism Paintball — network client: WebSocket fast path with automatic HTTP fallback.
import type { ClientEvent, ClientSync, Snapshot } from "@shared/paintball";

export interface NetHandlers {
  onSnapshot: (s: Snapshot) => void;
  onRoomEnded: (message: string) => void;
  onConnection: (state: { mode: "ws" | "http" | "connecting"; ok: boolean; rtt: number }) => void;
}

export interface LocalStateProvider {
  (): { life: number; st?: number[] };
}

export class NetClient {
  mode: "ws" | "http" | "connecting" = "connecting";
  rtt = 120;
  /** last seen event sequence and meta version */
  ack = -1;
  mv = -1;
  private events: ClientEvent[] = [];
  private stopped = false;
  private ws: WebSocket | null = null;
  private wsTimer = 0;
  private httpTimer = 0;
  private failures = 0;
  private lastOk = Date.now();
  private inflight = false;
  // clock mapping
  private offsets: number[] = [];
  private lastServerNow = 0;
  private interval = 60;
  private jitter = 20;
  private dMin = 0;
  getState: LocalStateProvider = () => ({ life: -1 });

  constructor(private apiBase: string, private token: string, readonly code: string, private h: NetHandlers) {}

  start(preferWs = true) {
    if (preferWs && typeof WebSocket !== "undefined") this.tryWs();
    else this.startHttp();
  }

  stop() {
    this.stopped = true;
    window.clearInterval(this.wsTimer);
    window.clearTimeout(this.httpTimer);
    if (this.ws) { try { this.ws.close(); } catch { /* ignore */ } this.ws = null; }
  }

  send(ev: ClientEvent) {
    this.events.push(ev);
    if (this.events.length > 120) this.events.splice(0, this.events.length - 120);
  }

  /** Convert a server timestamp to the local Date.now() timeline. */
  serverToLocal(t: number) { return t + this.dMin; }
  localToServer(t: number) { return t - this.dMin; }
  /** How far behind real time remote players are rendered (ms). */
  get interpDelay() { return Math.max(70, Math.min(450, this.interval * 1.15 + this.jitter * 1.6 + 25)); }

  /** Feed a snapshot obtained elsewhere (e.g. the join response). */
  ingest(s: Snapshot) { this.noteSnapshot(s); }

  private noteSnapshot(s: Snapshot) {
    const now = Date.now();
    const d = now - s.now;
    this.offsets.push(d);
    if (this.offsets.length > 50) this.offsets.shift();
    let min = Infinity, sum = 0;
    for (const o of this.offsets) { if (o < min) min = o; }
    for (const o of this.offsets) sum += o - min;
    this.dMin = min;
    this.jitter = this.jitter * 0.85 + (sum / this.offsets.length) * 0.15;
    if (this.lastServerNow && s.now > this.lastServerNow) this.interval = this.interval * 0.9 + Math.min(600, s.now - this.lastServerNow) * 0.1;
    this.lastServerNow = s.now;
    if (typeof s.seq === "number" && s.seq > this.ack) this.ack = s.seq;
    if (s.meta) this.mv = s.meta.v;
    this.lastOk = now;
    this.failures = 0;
    this.h.onSnapshot(s);
  }

  private payload(): ClientSync {
    const st = this.getState();
    const msg: ClientSync = { ack: this.ack, mv: this.mv, life: st.life, echo: Date.now() };
    if (st.st) msg.st = st.st;
    if (this.events.length) msg.ev = this.events.splice(0, 40);
    return msg;
  }

  // ---------------- WebSocket ----------------
  private tryWs() {
    let url: URL;
    try {
      url = new URL(this.apiBase + "/api/paintball/ws", window.location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.searchParams.set("token", this.token);
      url.searchParams.set("code", this.code);
    } catch { this.startHttp(); return; }
    this.mode = "connecting";
    let opened = false, gotFrame = false;
    let ws: WebSocket;
    try { ws = new WebSocket(url.toString()); } catch { this.startHttp(); return; }
    this.ws = ws;
    // give up on the socket if it cannot open quickly (blocked by a proxy), or never delivers a frame
    let armedAt = performance.now(), armedFor = 4000, retries = 0;
    const arm = (ms: number) => { armedAt = performance.now(); armedFor = ms; fallback = window.setTimeout(() => giveUp(), ms); };
    let fallback = 0;
    arm(4000);
    const giveUp = () => {
      if (gotFrame || this.stopped) return;
      // the page was busy (e.g. compiling shaders) so the timer fired late: give the socket more time
      const late = performance.now() - armedAt - armedFor;
      if ((late > 800 || ws.readyState === WebSocket.OPEN) && retries < 3) { retries++; arm(3000); return; }
      if (opened && !extended) { extended = true; arm(8000); return; }
      try { ws.close(); } catch { /* ignore */ }
      if (this.ws === ws) this.ws = null;
      this.startHttp();
    };
    let extended = false;
    ws.onopen = () => { opened = true; };
    ws.onmessage = (e) => {
      if (this.stopped) return;
      let s: Snapshot;
      try { s = JSON.parse(String(e.data)); } catch { return; }
      if (!s || s.t !== "snap") return;
      if (!gotFrame) {
        gotFrame = true;
        window.clearTimeout(fallback);
        this.mode = "ws";
        this.h.onConnection({ mode: "ws", ok: true, rtt: this.rtt });
        this.wsTimer = window.setInterval(() => this.wsSend(), 33);
      }
      if (typeof s.echo === "number") this.rtt = this.rtt * 0.85 + Math.max(5, Date.now() - s.echo - 25) * 0.15;
      this.noteSnapshot(s);
    };
    ws.onclose = (e) => {
      window.clearTimeout(fallback);
      window.clearInterval(this.wsTimer);
      if (this.ws === ws) this.ws = null;
      if (this.stopped) return;
      if (e.code === 4001) { this.h.onRoomEnded("That match has ended."); return; }
      if (e.code === 4000) return; // replaced by another tab
      // fall back to HTTP for the rest of the session
      if (this.mode !== "http") this.startHttp();
      void opened;
    };
    ws.onerror = () => { /* onclose follows */ };
  }

  private wsSend() {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 64 * 1024) return;
    try { ws.send(JSON.stringify(this.payload())); } catch { /* closing */ }
  }

  // ---------------- HTTP polling ----------------
  private startHttp() {
    if (this.stopped) return;
    this.mode = "http";
    this.h.onConnection({ mode: "http", ok: true, rtt: this.rtt });
    window.clearTimeout(this.httpTimer);
    this.httpTimer = window.setTimeout(() => void this.httpLoop(), 0);
  }

  private async httpLoop() {
    if (this.stopped || this.inflight) return;
    this.inflight = true;
    const started = Date.now();
    const msg = this.payload();
    let next = 55;
    try {
      const res = await fetch(this.apiBase + "/api/paintball/rooms/" + this.code + "/sync", {
        method: "POST",
        headers: { Authorization: "Bearer " + this.token, "Content-Type": "application/json" },
        body: JSON.stringify(msg),
        cache: "no-store",
      });
      if (this.stopped) return;
      if (res.status === 409 || res.status === 404) {
        let text = "That match has ended.";
        try { text = (await res.json()).message || text; } catch { /* ignore */ }
        this.h.onRoomEnded(text);
        this.stop();
        return;
      }
      if (!res.ok) throw new Error("sync " + res.status);
      const snap = (await res.json()) as Snapshot;
      this.rtt = this.rtt * 0.8 + (Date.now() - started) * 0.2;
      this.noteSnapshot(snap);
      this.h.onConnection({ mode: "http", ok: true, rtt: this.rtt });
      next = Math.max(0, 60 - (Date.now() - started));
    } catch {
      // put events back so they are not lost
      if (msg.ev) this.events.unshift(...msg.ev);
      this.failures++;
      next = Math.min(2000, 150 * this.failures);
      this.h.onConnection({ mode: "http", ok: Date.now() - this.lastOk < 4000, rtt: this.rtt });
    } finally {
      this.inflight = false;
    }
    if (!this.stopped) this.httpTimer = window.setTimeout(() => void this.httpLoop(), next);
  }
}
