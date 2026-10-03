// Watches a no-proctor quiz in the browser: counts every time the student
// leaves the quiz, takes a camera snapshot every 30 seconds (and when they
// leave or come back), and reports it all to the server.

export type MonitorEvent = { type: string; t: number; kind?: string; ms?: number };
export type MonitorOptions = {
  apiBase: string;
  token: string;
  /** When the session started (ms since epoch), so event times line up with the server. */
  startedAt: number;
  /** Leaves already counted (when picking up after a reload). */
  leaves: number;
  snapshotEveryMs: number;
  onLeave: (leaves: number) => void;
  onReturn: (leaves: number, awayMs: number) => void;
  onCamera: (on: boolean) => void;
};

/** The token the server hands out for admin preview and sample accounts. */
export const PREVIEW_TOKEN = "preview";
/** How long focus can sit outside the page (while it stays visible) before it counts as leaving. */
const BLUR_GRACE_MS = 2000;
const MIN_SNAPSHOT_GAP_MS = 1700;

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
  audio: false,
};

/** Friendly words for why the camera could not start. */
export function cameraErrorMessage(error: unknown): string {
  const name = (error as { name?: string })?.name || "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Your camera is blocked. Allow the camera for this site in your browser settings, or take the quiz with a proctor code.";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") return "We couldn't find a camera on this device. Use a proctor code, or switch to a device with a camera.";
  if (name === "NotReadableError" || name === "TrackStartError") return "Another app is using your camera. Close it and try again, or use a proctor code.";
  return "The camera didn't start. Try again, or take the quiz with a proctor code.";
}

export function canUseCamera(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && (typeof window === "undefined" || window.isSecureContext !== false);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] || "image/jpeg";
  const bytes = atob(body);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes.charCodeAt(i);
  return new Blob([out], { type: mime });
}

export class NoProctorMonitor {
  leaves: number;
  private video: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private queue: MonitorEvent[] = [];
  private awaySince: number | null = null;
  private running = false;
  private paused = false;
  private lastSnapAt = 0;
  private blurTimer = 0;
  private snapTimer = 0;
  private flushTimer = 0;
  private cameraTimer = 0;
  private lastCopyAt = 0;
  private cameraOn = true;
  private wakeLock: { release: () => Promise<void> } | null = null;

  constructor(private o: MonitorOptions) {
    this.leaves = o.leaves;
  }

  private now() { return Date.now() - this.o.startedAt; }
  private url(path: string) { return `${this.o.apiBase}/api/integrity/live/${this.o.token}${path}`; }
  /** Admin preview and sample accounts: everything works on screen, nothing is sent. */
  get preview() { return this.o.token === PREVIEW_TOKEN; }

  /** The visible preview element; snapshots are taken from it. */
  attachVideo(video: HTMLVideoElement | null) {
    this.video = video;
    if (video && this.stream && video.srcObject !== this.stream) {
      video.srcObject = this.stream;
      void video.play().catch(() => {});
    }
  }

  setStream(stream: MediaStream) {
    const restarting = !!this.stream && !this.cameraOn;
    if (this.stream && this.stream !== stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = stream;
    if (this.video) {
      this.video.srcObject = stream;
      void this.video.play().catch(() => {});
    }
    for (const track of stream.getVideoTracks()) track.addEventListener("ended", () => this.cameraLost());
    this.cameraOn = true;
    this.o.onCamera(true);
    if (restarting) {
      this.note("camera_on");
      window.setTimeout(() => this.snap("camera", true), 900);
    }
  }

  /** Starts watching. `firstPicture` is "resumed" when picking up after a reload. */
  start(firstPicture: "start" | "resumed" = "start") {
    if (this.running) return;
    this.running = true;
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("focus", this.onFocus);
    window.addEventListener("pagehide", this.onPageHide);
    this.snapTimer = window.setInterval(() => this.snap("interval"), this.o.snapshotEveryMs);
    this.flushTimer = window.setInterval(() => this.flush(), 5000);
    this.cameraTimer = window.setInterval(() => {
      if (this.cameraOn && this.stream && this.stream.getVideoTracks().every((t) => t.readyState === "ended")) this.cameraLost();
    }, 4000);
    void this.keepScreenOn();
    window.setTimeout(() => this.snap(firstPicture), 900);
  }

  /** Stops counting leaves (for example while the quiz is being turned in). */
  pause() { this.paused = true; }

  /** Counts leaves again (if turning the quiz in did not go through). */
  unpause() { if (this.running) this.paused = false; }

  /**
   * The student is leaving the quiz page inside the app (or stopping the quiz):
   * logs it as leaving, sends what is left and turns the camera off.
   */
  leaveForGood(kind: "page" | "stopped") {
    if (this.running && !this.paused && this.awaySince === null) {
      if (kind === "page") {
        this.leaves += 1;
        this.note("left", { kind });
      } else {
        this.note("stopped");
      }
    }
    this.flush(true);
    this.stop();
    return this.leaves;
  }

  /** Puts events back in the queue (if the request that carried them failed). */
  requeue(events: MonitorEvent[]) {
    this.queue.unshift(...events);
  }

  stop() {
    this.running = false;
    this.paused = true;
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("focus", this.onFocus);
    window.removeEventListener("pagehide", this.onPageHide);
    window.clearTimeout(this.blurTimer);
    window.clearInterval(this.snapTimer);
    window.clearInterval(this.flushTimer);
    window.clearInterval(this.cameraTimer);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    void this.wakeLock?.release().catch(() => {});
    this.wakeLock = null;
  }

  /** Events not sent yet, handed to the turn-in request so nothing is lost. */
  drain(): MonitorEvent[] {
    return this.queue.splice(0, this.queue.length).slice(-20);
  }

  note(type: string, extra: { kind?: string; ms?: number } = {}) {
    this.queue.push({ type, t: this.now(), ...extra });
  }

  /** Copy, cut, paste and the right-click menu are blocked; tries are logged (at most one a second). */
  copyAttempt() {
    const now = Date.now();
    if (now - this.lastCopyAt < 1000) return;
    this.lastCopyAt = now;
    this.note("copy");
  }

  /** Called after the student sees the leave warning. */
  warned() { this.note("warned"); }

  private onVisibility = () => {
    if (document.visibilityState === "hidden") this.leave("hidden");
    else { this.back(); void this.keepScreenOn(); }
  };
  private onBlur = () => {
    window.clearTimeout(this.blurTimer);
    this.blurTimer = window.setTimeout(() => {
      if (document.visibilityState === "visible" && !document.hasFocus()) this.leave("window");
    }, BLUR_GRACE_MS);
  };
  private onFocus = () => {
    window.clearTimeout(this.blurTimer);
    if (this.awaySince !== null && document.visibilityState === "visible") this.back();
  };
  private onPageHide = () => {
    this.leave("closed");
    this.flush(true);
  };

  private leave(kind: string) {
    if (!this.running || this.paused || this.awaySince !== null) return;
    this.awaySince = Date.now();
    this.leaves += 1;
    this.note("left", { kind });
    this.snap("left", true);
    // onLeave may turn the quiz in, which takes the queued events with it
    // (drain); whatever is still queued afterwards goes out right away.
    this.o.onLeave(this.leaves);
    this.flush(true);
  }

  private back() {
    if (this.awaySince === null) return;
    const ms = Date.now() - this.awaySince;
    this.awaySince = null;
    if (!this.running) return;
    // Phones can pause the preview while the page is hidden.
    void this.video?.play().catch(() => {});
    this.note("returned", { ms });
    window.setTimeout(() => this.snap("returned", true), 300);
    this.flush();
    if (!this.paused) this.o.onReturn(this.leaves, ms);
  }

  private cameraLost() {
    if (!this.cameraOn || !this.running) return;
    this.cameraOn = false;
    this.note("camera_off");
    this.flush();
    this.o.onCamera(false);
  }

  private async keepScreenOn() {
    // Keeps phones from locking the screen in the middle of a question (that would count as leaving).
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      if (wl && document.visibilityState === "visible") this.wakeLock = await wl.request("screen");
    } catch { /* not supported or not allowed */ }
  }

  /** Grabs the current camera frame and uploads it. */
  snap(reason: string, urgent = false) {
    const video = this.video;
    if (this.preview || !this.running || !video || !this.cameraOn || !video.videoWidth) return;
    const now = Date.now();
    if (now - this.lastSnapAt < MIN_SNAPSHOT_GAP_MS) {
      if (urgent) window.setTimeout(() => this.snap(reason), MIN_SNAPSHOT_GAP_MS - (now - this.lastSnapAt) + 50);
      return;
    }
    this.lastSnapAt = now;
    try {
      const canvas = this.canvas || (this.canvas = document.createElement("canvas"));
      const width = 320;
      canvas.width = width;
      canvas.height = Math.round((width * video.videoHeight) / video.videoWidth) || 240;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Synchronous on purpose: this also runs while the page is being hidden.
      const blob = dataUrlToBlob(canvas.toDataURL("image/jpeg", 0.6));
      void fetch(this.url(`/snapshot?reason=${encodeURIComponent(reason)}`), {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
        keepalive: blob.size < 60_000,
      }).catch(() => {});
    } catch { /* a missed picture is fine */ }
  }

  /** Sends queued events. While the page is closing, uses sendBeacon so they still arrive. */
  flush(closing = false) {
    if (this.preview) this.queue.length = 0;
    if (!this.queue.length) return;
    const events = this.queue.splice(0, 50);
    const body = JSON.stringify({ events });
    if (closing && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon(this.url("/events"), new Blob([body], { type: "text/plain" }))) return;
    }
    void fetch(this.url("/events"), { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
      .then((res) => { if (!res.ok && res.status >= 500) this.queue.unshift(...events); })
      .catch(() => { this.queue.unshift(...events); });
  }
}
