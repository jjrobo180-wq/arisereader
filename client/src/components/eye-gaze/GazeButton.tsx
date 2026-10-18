// A button an eye-gaze player can press by looking at it (dwell), and anyone can tap or click.
// A glowing bar fills along the bottom while the gaze rests on it. The timer only arms on real
// pointer movement, so a resting cursor doesn't press a button that slides in underneath it.
import { useEffect, useRef, useState, type ReactNode } from "react";

export const GAZE_DWELL_MS = 1200;

export default function GazeButton({ onSelect, children, className = "", disabled, dwell = true, ms = GAZE_DWELL_MS, label, onHover, pressed }: {
  onSelect: () => void; children: ReactNode; className?: string; disabled?: boolean; dwell?: boolean; ms?: number; label?: string; onHover?: () => void; pressed?: boolean;
}) {
  const [on, setOn] = useState(false); const timer = useRef(0);
  const stop = () => { window.clearTimeout(timer.current); setOn(false); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => { if (disabled) stop(); }, [disabled]);
  return (
    <button type="button" aria-label={label} aria-pressed={pressed} disabled={disabled}
      onPointerMove={e => { if (on || disabled || !dwell || e.pointerType === "touch") return; onHover?.(); setOn(true); timer.current = window.setTimeout(() => { setOn(false); onSelect(); }, ms); }}
      onPointerLeave={stop} onClick={() => { stop(); onSelect(); }}
      className={"relative overflow-hidden transition-[transform,filter] duration-150 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-px active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40 " + className}>
      {children}
      {dwell && !disabled && <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-1.5 rounded-full"
        style={{ width: on ? "100%" : "0%", transition: on ? `width ${ms}ms linear` : "none", background: "linear-gradient(90deg,#fff7ae,#ffd23f)", boxShadow: "0 0 12px rgba(255,210,63,.9)" }} />}
    </button>
  );
}
