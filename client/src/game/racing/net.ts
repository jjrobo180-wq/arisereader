// Aurora Racers — online race connection (WebSocket fast path, automatic HTTP fallback).
import type { RaceClientEvent, RaceClientSync, RaceSnap, KartState } from "@shared/racing";

export interface RacingNetHandlers {
  onSnap: (s: RaceSnap) => void;
  onClosed: (message: string) => void;
}

export class RacingNet {
  mode: "ws" | "http" | "connecting" = "connecting";
  rtt = 100;
  ack = -1;
  mv = -1;
  raceNo = 0;
  private events: RaceClientEvent[] = [];
  private stopped = false;
  private ws: WebSocket | null = null;
  private wsTimer = 0;
  private httpTimer = 0;
  private failures = 0;
  private offsets: number[] = [];
  private lastServerNow = 0;
  private interval = 60;
  private jitter = 20;
  private dMin = 0;
  private handlers = new Set<(s: RaceSnap) => void>();
  getState: () => { st?: KartState; bots?: { id: string; st: KartState }[] } = () => ({});

  constructor(private apiBase: string, private token: string, readonly code: string, private h: RacingNetHandlers) {}

  listen(fn: (s: RaceSnap) => void) { this.handlers.add(fn); return () => { this.handlers.delete(fn); }; }
  send(ev: RaceClientEvent) { this.events.push(ev); if (this.events.length > 100) this.events.splice(0, this.events.length - 100); }
  serverToLocal(t: number) { return t + this.dMin; }
  get interpDelay() { return Math.max(70, Math.min(400, this.interval * 1.2 + this.jitter * 1.6 + 25)); }

  start() { if (typeof WebSocket !== "undefined") this.tryWs(); else this.startHttp(); }
  stop() {
    this.stopped = true;
    window.clearInterval(this.wsTimer); window.clearTimeout(this.httpTimer);
    if (this.ws) { try { this.ws.close(); } catch { /* ignore */ } this.ws = null; }
  }

  ingest(s: RaceSnap) {
    const now = Date.now();
    this.offsets.push(now - s.now);
    if (this.offsets.length > 50) this.offsets.shift();
    let min = Infinity, sum = 0;
    for (const o of this.offsets) if (o < min) min = o;
    for (const o of this.offsets) sum += o - min;
    this.dMin = min;
    this.jitter = this.jitter * 0.85 + (sum / this.offsets.length) * 0.15;
    if (this.lastServerNow && s.now > this.lastServerNow) this.interval = this.interval * 0.9 + Math.min(500, s.now - this.lastServerNow) * 0.1;
    this.lastServerNow = s.now;
    if (s.seq > this.ack) this.ack = s.seq;
    if (s.meta) { this.mv = s.meta.v; this.raceNo = s.meta.raceNo; }
    this.failures = 0;
    this.h.onSnap(s);
    this.handlers.forEach((f) => f(s));
  }

  private payload(): RaceClientSync {
    const st = this.getState();
    const msg: RaceClientSync = { ack: this.ack, mv: this.mv, raceNo: this.raceNo, echo: Date.now() };
    if (st.st) msg.st = st.st;
    if (st.bots && st.bots.length) msg.bots = st.bots;
    if (this.events.length) msg.ev = this.events.splice(0, 30);
    return msg;
  }

  private tryWs() {
    let url: URL;
    try {
      url = new URL(this.apiBase + "/api/racing/ws", window.location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.searchParams.set("token", this.token); url.searchParams.set("code", this.code);
    } catch { this.startHttp(); return; }
    let ws: WebSocket;
    try { ws = new WebSocket(url.toString()); } catch { this.startHttp(); return; }
    this.ws = ws;
    let gotFrame = false, retries = 0, armedAt = performance.now(), fallback = 0;
    const arm = (ms: number) => { armedAt = performance.now(); fallback = window.setTimeout(() => giveUp(ms), ms); };
    const giveUp = (ms: number) => {
      if (gotFrame || this.stopped) return;
      const late = performance.now() - armedAt - ms;
      if ((late > 800 || ws.readyState === WebSocket.OPEN) && retries < 3) { retries++; arm(3000); return; }
      try { ws.close(); } catch { /* ignore */ }
      if (this.ws === ws) this.ws = null;
      this.startHttp();
    };
    arm(4000);
    ws.onmessage = (e) => {
      if (this.stopped) return;
      let s: RaceSnap; try { s = JSON.parse(String(e.data)); } catch { return; }
      if (!s || s.t !== "race-snap") return;
      if (!gotFrame) { gotFrame = true; window.clearTimeout(fallback); this.mode = "ws"; this.wsTimer = window.setInterval(() => this.wsSend(), 40); }
      if (typeof s.echo === "number") this.rtt = this.rtt * 0.85 + Math.max(5, Date.now() - s.echo - 25) * 0.15;
      this.ingest(s);
    };
    ws.onclose = (e) => {
      window.clearTimeout(fallback); window.clearInterval(this.wsTimer);
      if (this.ws === ws) this.ws = null;
      if (this.stopped) return;
      if (e.code === 4001) { this.h.onClosed("The room closed."); return; }
      if (e.code === 4000) return;
      if (this.mode !== "http") this.startHttp();
    };
  }

  private wsSend() {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > 64 * 1024) return;
    try { ws.send(JSON.stringify(this.payload())); } catch { /* closing */ }
  }

  private startHttp() {
    if (this.stopped) return;
    this.mode = "http";
    window.clearTimeout(this.httpTimer);
    this.httpTimer = window.setTimeout(() => void this.httpLoop(), 0);
  }

  private async httpLoop() {
    if (this.stopped) return;
    const started = Date.now();
    const msg = this.payload();
    let next = 60;
    try {
      const res = await fetch(this.apiBase + "/api/racing/rooms/" + this.code + "/sync", {
        method: "POST", headers: { Authorization: "Bearer " + this.token, "Content-Type": "application/json" }, body: JSON.stringify(msg), cache: "no-store",
      });
      if (this.stopped) return;
      if (res.status === 409 || res.status === 404) {
        let text = "The room closed.";
        try { text = (await res.json()).message || text; } catch { /* ignore */ }
        this.h.onClosed(text); this.stop(); return;
      }
      if (!res.ok) throw new Error("sync " + res.status);
      const snap = (await res.json()) as RaceSnap;
      this.rtt = this.rtt * 0.8 + (Date.now() - started) * 0.2;
      this.ingest(snap);
      next = Math.max(0, 66 - (Date.now() - started));
    } catch {
      if (msg.ev) this.events.unshift(...msg.ev);
      this.failures++;
      next = Math.min(2000, 150 * this.failures);
    }
    if (!this.stopped) this.httpTimer = window.setTimeout(() => void this.httpLoop(), next);
  }
}
