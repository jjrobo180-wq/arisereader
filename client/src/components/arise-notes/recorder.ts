// Live recording for Arise Notes: the microphone, a pause button, and a new piece every few minutes
// (each a complete audio file) so the recording is written down while it goes on and a long meeting
// never has to be sent in one go. The screen is kept awake while recording, where the phone allows it.

export type RecordedPiece = { idx: number; blob: Blob; ext: "webm" | "ogg" | "m4a"; start: number; secs: number };
export type RecorderHooks = {
  onPiece: (p: RecordedPiece) => void;
  onLevel?: (level: number) => void;
  onTick?: (secs: number) => void;
  /** The recording stopped by itself (the time limit, or the microphone went away). */
  onAutoStop?: (why: "limit" | "lost") => void;
};

const TYPES: { mime: string; ext: RecordedPiece["ext"] }[] = [
  { mime: "audio/webm;codecs=opus", ext: "webm" },
  { mime: "audio/webm", ext: "webm" },
  { mime: "audio/mp4", ext: "m4a" },
  { mime: "audio/ogg;codecs=opus", ext: "ogg" },
];

export const canRecord = () => typeof window !== "undefined" && typeof (window as any).MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

export class NotesRecorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private type = TYPES[0];
  private piece = { idx: 0, start: 0 };
  private activeMs = 0;
  private resumedAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private wake: any = null;
  private audio: AudioContext | null = null;
  private meter: ReturnType<typeof setInterval> | null = null;
  private stopping: Promise<void> | null = null;
  private warnedOnLimit = false;
  state: "idle" | "recording" | "paused" | "stopped" = "idle";

  constructor(private hooks: RecorderHooks, private o: { pieceSecs: number; maxSecs: number }) {}

  /** Seconds recorded so far (pauses don't count). */
  get elapsed(): number { return (this.activeMs + (this.state === "recording" ? performance.now() - this.resumedAt : 0)) / 1000; }

  async start() {
    if (!canRecord()) throw new Error("Recording doesn't work in this browser. Try Chrome or Safari, or upload a file instead.");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e: any) {
      throw new Error(e?.name === "NotAllowedError" ? "Arise Notes needs your microphone. Allow it in your browser's settings (the lock or ⓘ next to the address), then try again." : "The microphone couldn't be opened. Check that nothing else is using it.");
    }
    this.type = TYPES.find((t) => (window as any).MediaRecorder.isTypeSupported?.(t.mime)) ?? { mime: "", ext: "webm" };
    for (const t of this.stream.getAudioTracks()) t.addEventListener("ended", () => { if (this.state === "recording" || this.state === "paused") { void this.stop(); this.hooks.onAutoStop?.("lost"); } });
    this.state = "recording";
    this.resumedAt = performance.now();
    this.newPiece(0);
    this.timer = setInterval(() => this.tick(), 500);
    this.startMeter();
    void this.keepAwake();
    document.addEventListener("visibilitychange", this.onVisible);
  }

  private onVisible = () => { if (document.visibilityState === "visible" && this.state === "recording") void this.keepAwake(); };
  private async keepAwake() {
    try { if (!this.wake && (navigator as any).wakeLock) { this.wake = await (navigator as any).wakeLock.request("screen"); this.wake.addEventListener?.("release", () => { this.wake = null; }); } } catch { /* not allowed here */ }
  }

  private newPiece(start: number) {
    const MR = (window as any).MediaRecorder;
    const rec: MediaRecorder = new MR(this.stream!, { ...(this.type.mime ? { mimeType: this.type.mime } : {}), audioBitsPerSecond: 48_000 });
    const chunks: Blob[] = [];
    const idx = this.piece.idx;
    rec.ondataavailable = (e: BlobEvent) => { if (e.data?.size) chunks.push(e.data); };
    rec.onstop = () => {
      const secs = Math.max(0, this.elapsed - start);
      const mime = (rec.mimeType || this.type.mime || "audio/webm").split(";")[0];
      const ext: RecordedPiece["ext"] = /mp4|aac|m4a/.test(mime) ? "m4a" : /ogg/.test(mime) ? "ogg" : "webm";
      if (chunks.length) this.hooks.onPiece({ idx, blob: new Blob(chunks, { type: mime }), ext, start: Math.round(start * 1000) / 1000, secs: Math.round(secs * 1000) / 1000 });
    };
    rec.start();
    this.rec = rec;
    this.piece = { idx: idx, start };
  }

  /** Ends this piece and starts the next one straight away (the new one starts before the old stops, so nothing is missed). */
  private cut() {
    const old = this.rec;
    const at = this.elapsed;
    this.piece.idx++;
    const next = this.piece.idx;
    // newPiece reads this.piece.idx for the new piece's number.
    this.newPiece(at);
    this.piece.idx = next;
    try { old?.stop(); } catch { /* already stopped */ }
  }

  private tick() {
    if (this.state !== "recording") return;
    const now = this.elapsed;
    this.hooks.onTick?.(now);
    if (now >= this.o.maxSecs) { void this.stop(); this.hooks.onAutoStop?.("limit"); return; }
    if (now - this.piece.start >= this.o.pieceSecs) this.cut();
    if (!this.warnedOnLimit && this.o.maxSecs - now <= 60) this.warnedOnLimit = true;
  }

  private startMeter() {
    try {
      const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC || !this.stream) return;
      this.audio = new AC();
      const src = this.audio!.createMediaStreamSource(this.stream);
      const an = this.audio!.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const data = new Uint8Array(an.fftSize);
      this.meter = setInterval(() => {
        an.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        this.hooks.onLevel?.(this.state === "recording" ? Math.min(1, Math.sqrt(sum / data.length) * 3) : 0);
      }, 90);
    } catch { /* no meter */ }
  }

  pause() {
    if (this.state !== "recording" || !this.rec) return;
    this.activeMs += performance.now() - this.resumedAt;
    try { this.rec.pause(); } catch { /* old browser */ }
    this.state = "paused";
  }
  resume() {
    if (this.state !== "paused" || !this.rec) return;
    this.resumedAt = performance.now();
    try { this.rec.resume(); } catch { /* old browser */ }
    this.state = "recording";
    void this.keepAwake();
  }

  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.stopping = new Promise((resolve) => {
      if (this.state === "recording") this.activeMs += performance.now() - this.resumedAt;
      this.state = "stopped";
      if (this.timer) clearInterval(this.timer);
      if (this.meter) clearInterval(this.meter);
      document.removeEventListener("visibilitychange", this.onVisible);
      const rec = this.rec;
      const done = () => {
        this.stream?.getTracks().forEach((t) => t.stop());
        try { void this.audio?.close(); } catch { /* closed */ }
        try { void this.wake?.release?.(); } catch { /* released */ }
        this.wake = null;
        resolve();
      };
      if (!rec || rec.state === "inactive") return done();
      rec.addEventListener("stop", () => setTimeout(done, 0), { once: true });
      try { rec.stop(); } catch { done(); }
    });
    return this.stopping;
  }
}

/** A short recording (a voice memo): one file. */
export async function recordMemo(maxSecs: number, onLevel?: (v: number) => void): Promise<{ stop: () => Promise<RecordedPiece | null>; elapsed: () => number }> {
  let got: RecordedPiece | null = null;
  const r = new NotesRecorder({ onPiece: (p) => { got = p; }, onLevel }, { pieceSecs: maxSecs + 60, maxSecs });
  await r.start();
  return { stop: async () => { await r.stop(); return got; }, elapsed: () => r.elapsed };
}
