// Teacher Hub saving, one step at a time.
//
// The page hands every change to this. It waits a moment for typing to stop, sends one save at
// a time, remembers which saved copy each save started from (so another phone or computer can't
// be written over), tries again by itself when the network drops, and says plainly what state
// things are in. It knows nothing about React, so it can be tested on its own.
import { HUB_CONFLICT, HUB_SEATS_FULL, retryDelay, type SaveBlock } from "@shared/hubSave";

export type SaveView =
  /** Everything is on the server. */
  | { kind: "saved" }
  /** Changes were made and are about to be sent. */
  | { kind: "waiting" }
  | { kind: "saving" }
  /** Something went wrong that should pass (no signal, the server is busy). It tries again by itself. */
  | { kind: "retrying"; attempt: number; reason: string }
  /** The teacher has to do something before saving can go on. */
  | { kind: "blocked"; block: SaveBlock; message: string; serverUpdatedAt?: string };

export type SaveRequest<W> = { workspace: W; baseUpdatedAt: string | null; overwrite?: boolean };
export type SaveResponse = { status: number; body: any };

export type SaverDeps<W> = {
  /** Sends one save. Rejects when the network fails. */
  put(request: SaveRequest<W>, options: { keepalive: boolean }): Promise<SaveResponse>;
  onView(view: SaveView): void;
  /** After each save that went through. */
  onSaved?(info: { updatedAt: string; bytes: number }): void;
  setTimer(run: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  /** How long typing has to stop before a save goes out. */
  debounceMs?: number;
};

function byteLength(text: string): number {
  return typeof TextEncoder !== "undefined" ? new TextEncoder().encode(text).length : text.length;
}

export class HubSaver<W> {
  private latest: W;
  private savedJson: string;
  private base: string | null;
  private timer: unknown = null;
  private inFlight: Promise<void> | null = null;
  private attempt = 0;
  private blocked: Extract<SaveView, { kind: "blocked" }> | null = null;
  private overwriteNext = false;
  private disposed = false;

  constructor(private deps: SaverDeps<W>, start: { workspace: W; updatedAt: string | null }) {
    this.latest = start.workspace;
    this.savedJson = JSON.stringify(start.workspace);
    this.base = start.updatedAt;
  }

  /** The moment of the copy this page started from, which the next save names. */
  get baseUpdatedAt(): string | null {
    return this.base;
  }

  /** Is there anything that has not reached the server? */
  hasUnsaved(): boolean {
    return this.timer !== null || this.inFlight !== null || this.blocked !== null || JSON.stringify(this.latest) !== this.savedJson;
  }

  /** The newest copy of the workspace on this page. */
  current(): W {
    return this.latest;
  }

  /** Called with the workspace every time it changes. */
  change(workspace: W): void {
    if (this.disposed || workspace === this.latest) return;
    this.latest = workspace;
    if (this.blocked) {
      // A conflict, an ended plan or a sign-out waits for the teacher. A full Hub or a refused
      // change may be fixed by this very edit, so try again.
      if (this.blocked.block === "conflict" || this.blocked.block === "plan" || this.blocked.block === "signed_out") return;
      this.blocked = null;
    }
    this.view({ kind: "waiting" });
    this.schedule(this.deps.debounceMs ?? 700);
  }

  /** Saves right now (when the page is hidden, closed or signed out of). Resolves when it has been tried. */
  async flush(): Promise<void> {
    if (this.disposed) return;
    this.cancelTimer();
    if (this.inFlight) await this.inFlight.catch(() => {});
    await this.run(true);
  }

  /** Tries a save that failed again now. */
  retryNow(): void {
    if (this.disposed || this.inFlight) return;
    if (this.blocked && (this.blocked.block === "conflict" || this.blocked.block === "plan" || this.blocked.block === "signed_out")) return;
    this.blocked = null;
    this.cancelTimer();
    void this.run(false);
  }

  /** The teacher chose to keep this page's version over the newer one saved elsewhere. */
  keepMine(): void {
    if (this.disposed) return;
    this.overwriteNext = true;
    this.blocked = null;
    this.cancelTimer();
    void this.run(false);
  }

  /** Takes a newer copy from the server in place of this page's (nothing here is lost: it had no changes, or the teacher chose it). */
  rebase(workspace: W, updatedAt: string | null): void {
    if (this.disposed) return;
    this.cancelTimer();
    this.latest = workspace;
    this.savedJson = JSON.stringify(workspace);
    this.base = updatedAt;
    this.blocked = null;
    this.overwriteNext = false;
    this.attempt = 0;
    this.view({ kind: "saved" });
  }

  /** Saves what is waiting, then stops. */
  async finish(): Promise<void> {
    try {
      await this.flush();
    } finally {
      this.dispose();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.cancelTimer();
  }

  private view(view: SaveView) {
    if (!this.disposed) this.deps.onView(view);
  }

  private schedule(ms: number) {
    this.cancelTimer();
    this.timer = this.deps.setTimer(() => {
      this.timer = null;
      void this.run(false);
    }, ms);
  }

  private cancelTimer() {
    if (this.timer !== null) this.deps.clearTimer(this.timer);
    this.timer = null;
  }

  private async run(keepalive: boolean): Promise<void> {
    if (this.disposed) return;
    if (this.inFlight) return; // the save that is out will look again when it lands
    if (this.blocked && this.blocked.block === "conflict") return;
    // This save covers anything that was waiting for a timer.
    this.cancelTimer();
    const sending = this.latest;
    const json = JSON.stringify(sending);
    if (json === this.savedJson && !this.overwriteNext) {
      if (!this.blocked) this.view({ kind: "saved" });
      return;
    }
    this.view({ kind: "saving" });
    const overwrite = this.overwriteNext;
    this.inFlight = this.send(sending, json, overwrite, keepalive).finally(() => { this.inFlight = null; });
    await this.inFlight;
  }

  private async send(workspace: W, json: string, overwrite: boolean, keepalive: boolean): Promise<void> {
    let reply: SaveResponse;
    try {
      reply = await this.deps.put({ workspace, baseUpdatedAt: this.base, ...(overwrite ? { overwrite: true } : {}) }, { keepalive });
    } catch {
      return this.tryAgain("There is no connection right now.");
    }
    if (this.disposed) return;
    const { status, body } = reply;
    if (status >= 200 && status < 300 && body && body.success === true && typeof body.updatedAt === "string") {
      this.base = body.updatedAt;
      this.savedJson = json;
      this.attempt = 0;
      this.blocked = null;
      this.overwriteNext = false;
      this.deps.onSaved?.({ updatedAt: body.updatedAt, bytes: byteLength(json) });
      // More was typed while this one was on its way.
      if (JSON.stringify(this.latest) !== this.savedJson) {
        this.view({ kind: "waiting" });
        this.schedule(this.deps.debounceMs ?? 700);
      } else {
        this.view({ kind: "saved" });
      }
      return;
    }
    if (status === 409 && body?.code === HUB_CONFLICT) return this.stop("conflict", body?.message, typeof body?.updatedAt === "string" ? body.updatedAt : undefined);
    if (status === 409 && body?.code === HUB_SEATS_FULL) return this.stop("seats_full", body?.message);
    if (status === 413) return this.stop("too_large", body?.message);
    if (status === 402) return this.stop("plan", body?.message);
    if (status === 401 || status === 403) return this.stop("signed_out", body?.message);
    if (status === 400) return this.stop("rejected", body?.message);
    return this.tryAgain(status >= 500 ? "The server had a problem." : "The server sent back something unexpected.");
  }

  private stop(block: SaveBlock, serverMessage?: string, serverUpdatedAt?: string) {
    this.blocked = { kind: "blocked", block, message: typeof serverMessage === "string" ? serverMessage : "", ...(serverUpdatedAt ? { serverUpdatedAt } : {}) };
    this.overwriteNext = false;
    this.view(this.blocked);
  }

  private tryAgain(reason: string) {
    this.attempt += 1;
    this.view({ kind: "retrying", attempt: this.attempt, reason });
    this.schedule(retryDelay(this.attempt));
  }
}
