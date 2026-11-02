// Sends a recording's pieces to be written down: a few at a time, each tried again when the
// connection drops, and kept in memory until the server has it, so nothing recorded is lost.
import { segmentIdx, type Segment } from "@shared/ariseNotes";
import { transcribeOnDevice } from "@/lib/onDevice";
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

/** A piece written down on this iPhone: its lines, timed from the start of the recording. */
export async function piecePhoneLines(p: OutPiece, hints: string[]): Promise<{ lines: { start: number; end: number; text: string }[]; segments: Segment[] }> {
  const heard = await transcribeOnDevice(p.blob, p.ext, hints);
  const segments = heard.lines.map((l, i) => ({ idx: segmentIdx(p.idx, i), start: Math.round((p.start + l.start) * 100) / 100, end: Math.round((p.start + Math.max(l.end, l.start)) * 100) / 100, speaker: null, text: l.text }));
  return { lines: heard.lines, segments };
}

/** `onPhone` (Private mode): each piece is written down on this iPhone first, and only its text is sent. */
export function createSender(noteId: string, o: { concurrency?: number; onReply: (p: OutPiece, r: PieceReply) => void; onFatal?: (message: string) => void; onProgress?: (done: number, total: number) => void; onPhone?: { hints: string[] } }): Sender {
  const written = new Map<OutPiece, { start: number; end: number; text: string }[]>();
  const queue: OutPiece[] = [];
  const lost: OutPiece[] = [];
  let active = 0, total = 0, done = 0, stopped = false;
  let waiters: (() => void)[] = [];
  const settle = () => { if (!active && !queue.length) { const w = waiters; waiters = []; w.forEach((f) => f()); } };
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const send = async (p: OutPiece) => {
    if (o.onPhone && !written.has(p)) {
      // Written down on the phone once; only sending the text is tried again.
      try { written.set(p, (await piecePhoneLines(p, o.onPhone.hints)).lines); }
      catch (e: any) { o.onFatal?.(e?.message || "This part couldn't be written down on the iPhone."); lost.push(p); return; }
    }
    for (let attempt = 0; attempt < 5 && !stopped; attempt++) {
      try {
        const r = o.onPhone ? await notesApi.pieceText(noteId, { idx: p.idx, start: p.start, secs: p.secs, lines: written.get(p)! }) : await notesApi.piece(noteId, p);
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

/** Strict mode: pieces are written down on this iPhone and kept here. Nothing is sent anywhere. */
export function createPhoneSender(o: { hints: string[]; onReply: (p: OutPiece, r: PieceReply) => void; onFatal?: (message: string) => void; onProgress?: (done: number, total: number) => void }): Sender {
  const queue: OutPiece[] = [];
  const lost: OutPiece[] = [];
  let busy = false, total = 0, done = 0, stopped = false;
  let waiters: (() => void)[] = [];
  const settle = () => { if (!busy && !queue.length) { const w = waiters; waiters = []; w.forEach((f) => f()); } };
  const pump = async () => {
    if (busy) return;
    busy = true;
    while (!stopped && queue.length) {
      const p = queue.shift()!;
      try { o.onReply(p, { ok: true, segments: (await piecePhoneLines(p, o.hints)).segments }); }
      catch (e: any) { lost.push(p); o.onFatal?.(e?.message || "This part couldn't be written down on the iPhone."); }
      done++; o.onProgress?.(done, total);
    }
    busy = false;
    settle();
  };
  return {
    add: (p) => { if (stopped) { lost.push(p); return; } total++; queue.push(p); o.onProgress?.(done, total); void pump(); },
    drained: () => new Promise<void>((r) => { waiters.push(r); settle(); }),
    failed: () => [...lost],
    retryFailed: () => { const again = lost.splice(0); stopped = false; for (const p of again) { done--; queue.push(p); } void pump(); },
    stop: () => { stopped = true; queue.splice(0); settle(); },
    pending: () => queue.length + (busy ? 1 : 0),
  };
}
