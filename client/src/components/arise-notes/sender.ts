// Sends a recording's pieces to be written down: a few at a time, each tried again when the
// connection drops, and kept in memory until the server has it, so nothing recorded is lost.
import { notesApi, NotesError, type PieceReply } from "./api";

export type OutPiece = { idx: number; blob: Blob; ext: string; start: number; secs: number };
export type Sender = {
  add: (p: OutPiece) => void;
  /** Resolves once every piece added so far has an answer (or failed for good). */
  drained: () => Promise<void>;
  /** Pieces that couldn't be sent after every retry (still in memory). */
  failed: () => OutPiece[];
  retryFailed: () => void;
  stop: () => void;
  /** Pieces waiting or being sent right now. */
  pending: () => number;
};

export function createSender(noteId: string, o: { concurrency?: number; onReply: (p: OutPiece, r: PieceReply) => void; onFatal?: (message: string) => void; onProgress?: (done: number, total: number) => void }): Sender {
  const queue: OutPiece[] = [];
  const lost: OutPiece[] = [];
  let active = 0, total = 0, done = 0, stopped = false;
  let waiters: (() => void)[] = [];
  const settle = () => { if (!active && !queue.length) { const w = waiters; waiters = []; w.forEach((f) => f()); } };
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const send = async (p: OutPiece) => {
    for (let attempt = 0; attempt < 5 && !stopped; attempt++) {
      try {
        const r = await notesApi.piece(noteId, p);
        o.onReply(p, r);
        return;
      } catch (e: any) {
        // The server kept the piece (out of minutes, or the speech service was busy): that's an answer.
        if (e instanceof NotesError && (e.status === 402 || e.status === 502) && e.body && e.body.ok === false) { o.onReply(p, e.body as PieceReply); return; }
        if (e instanceof NotesError && (e.status === 413 || e.status === 400 || e.status === 403 || e.status === 404)) { stopped = e.status === 413 || e.status === 404; o.onFatal?.(e.message); if (!stopped) lost.push(p); return; }
        await wait([1500, 4000, 9000, 20000, 30000][attempt]);
      }
    }
    lost.push(p);
  };
  const pump = () => {
    while (!stopped && active < (o.concurrency ?? 2) && queue.length) {
      const p = queue.shift()!;
      active++;
      void send(p).finally(() => { active--; done++; o.onProgress?.(done, total); pump(); settle(); });
    }
    settle();
  };
  return {
    add: (p) => { if (stopped) { lost.push(p); return; } total++; queue.push(p); o.onProgress?.(done, total); pump(); },
    drained: () => new Promise<void>((r) => { waiters.push(r); settle(); }),
    failed: () => [...lost],
    retryFailed: () => { const again = lost.splice(0); stopped = false; for (const p of again) { done--; queue.push(p); } pump(); },
    stop: () => { stopped = true; queue.splice(0); settle(); },
    pending: () => queue.length + active,
  };
}
