// Plays a note's audio, which is kept as pieces: one player that moves from piece to piece, so
// tapping any line of the transcript jumps to that moment.
import { useCallback, useEffect, useRef, useState } from "react";

export type PlayPiece = { start: number; secs: number; url: string };
/** Audio recorded on this device in this visit (kept until the page closes), by note. */
export const sessionAudio = new Map<string, PlayPiece[]>();

export function usePiecePlayer(pieces: PlayPiece[]) {
  const el = useRef<HTMLAudioElement | null>(null);
  const cur = useRef(-1);
  const list = useRef<PlayPiece[]>([]);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  list.current = [...pieces].sort((a, b) => a.start - b.start);
  const total = list.current.reduce((m, p) => Math.max(m, p.start + p.secs), 0);

  useEffect(() => {
    const a = new Audio();
    a.preload = "metadata";
    el.current = a;
    const onTime = () => { const p = list.current[cur.current]; if (p) setTime(p.start + a.currentTime); };
    const onEnd = () => {
      const next = cur.current + 1;
      if (next < list.current.length) { load(next, 0, true); } else { setPlaying(false); }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => { a.pause(); a.removeAttribute("src"); a.load(); a.removeEventListener("timeupdate", onTime); a.removeEventListener("ended", onEnd); a.removeEventListener("play", onPlay); a.removeEventListener("pause", onPause); el.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (el.current) el.current.playbackRate = rate; }, [rate]);

  const load = useCallback((i: number, offset: number, play: boolean) => {
    const a = el.current, p = list.current[i];
    if (!a || !p) return;
    const go = () => { try { a.currentTime = Math.max(0, offset); } catch { /* not seekable yet */ } a.playbackRate = rate; if (play) void a.play().catch(() => setPlaying(false)); };
    if (cur.current === i && a.src) { go(); return; }
    cur.current = i;
    a.src = p.url;
    a.addEventListener("loadedmetadata", go, { once: true });
    a.load();
  }, [rate]);

  /** Plays from `t` seconds into the whole recording. */
  const seek = useCallback((t: number, play = true) => {
    const ps = list.current;
    if (!ps.length) return;
    let i = ps.findIndex((p) => t >= p.start && t < p.start + p.secs);
    if (i < 0) i = t < ps[0].start ? 0 : ps.length - 1;
    setTime(t);
    load(i, t - ps[i].start, play);
  }, [load]);
  const toggle = useCallback(() => {
    const a = el.current;
    if (!a) return;
    if (cur.current < 0) { seek(0, true); return; }
    if (a.paused) void a.play().catch(() => setPlaying(false)); else a.pause();
  }, [seek]);
  const stop = useCallback(() => { el.current?.pause(); }, []);
  return { time, playing, total, rate, setRate, seek, toggle, stop, ready: pieces.length > 0 };
}
