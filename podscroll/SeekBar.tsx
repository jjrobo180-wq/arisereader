// A seek bar that behaves the way Apple's players do: a roomy touch target, the bar swells under the
// finger, the time follows along, and the audio only jumps when the finger lifts (not on every pixel).
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const clock = (s: number) => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}` : `${m}:${String(x).padStart(2, "0")}`; };

export function SeekBar({ time, dur, onSeek, color = "#ff6a1f", label = "Seek" }: { time: number; dur: number; onSeek: (t: number) => void; color?: string; label?: string }) {
  const box = useRef<HTMLDivElement | null>(null);
  const drag = useRef<number | null>(null);
  const [at, setAt] = useState<number | null>(null);
  const live = at !== null;
  const shown = live ? at : time;
  const pct = dur > 0 ? Math.min(100, Math.max(0, (shown / dur) * 100)) : 0;
  const timeAtX = (x: number) => { const r = box.current!.getBoundingClientRect(); return Math.min(Math.max(0, dur - 1), Math.max(0, ((x - r.left) / r.width) * dur)); };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => { if (!dur || drag.current !== null) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = e.pointerId; setAt(timeAtX(e.clientX)); };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => { if (drag.current === e.pointerId) setAt(timeAtX(e.clientX)); };
  const end = (e: ReactPointerEvent<HTMLDivElement>, commit: boolean) => { if (drag.current !== e.pointerId) return; drag.current = null; const t = timeAtX(e.clientX); setAt(null); if (commit) onSeek(t); };
  return <div ref={box} role="slider" aria-label={label} aria-valuemin={0} aria-valuemax={Math.floor(dur)} aria-valuenow={Math.floor(shown)} aria-valuetext={`${clock(shown)} of ${clock(dur)}`} tabIndex={0}
    onPointerDown={down} onPointerMove={move} onPointerUp={(e) => end(e, true)} onPointerCancel={(e) => end(e, false)}
    onKeyDown={(e) => { const d = e.key === "ArrowRight" ? 10 : e.key === "ArrowLeft" ? -10 : 0; if (d && dur) { e.preventDefault(); onSeek(Math.min(Math.max(0, dur - 1), time + d)); } }}
    className="absolute inset-x-0 -top-3 z-10 h-7 cursor-pointer touch-none select-none focus:outline-none">
    <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-hidden bg-black/10 transition-[height] duration-150 ${live ? "h-[10px]" : "h-[3px]"}`}>
      <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, background: color }} />
    </div>
    {live && <div className="pointer-events-none absolute bottom-[calc(100%+4px)] -translate-x-1/2 rounded-full bg-[#0f0f0f] px-2.5 py-1 text-[12px] font-bold tabular-nums text-white shadow-lg" style={{ left: `clamp(2rem, ${pct}%, calc(100% - 2rem))` }}>{clock(shown)} <span className="font-medium text-white/60">-{clock(Math.max(0, dur - shown))}</span></div>}
  </div>;
}
