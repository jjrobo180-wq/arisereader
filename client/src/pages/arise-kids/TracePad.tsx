// Card Quest's tracing card: the child follows the dotted letter with a finger (or a mouse or stylus).
// It counts once most of the letter has been gone over and the drawing mostly stayed on it (traceScore in
// shared/ariseKids.ts, generous for small hands); then the dots turn solid.
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { TRACE_LETTERS, traceScore, type TracePoint } from "@shared/ariseKids";

export default function TracePad({ letter, size, onChange }: { letter: keyof typeof TRACE_LETTERS; size: number; onChange: (done: boolean) => void }) {
  const [strokes, setStrokes] = useState<TracePoint[][]>([]);
  const drawing = useRef(false);
  const pad = useRef<SVGSVGElement>(null);
  const segs = TRACE_LETTERS[letter];
  const { done } = traceScore(strokes.flat(), letter);
  useEffect(() => { onChange(done); }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  const at = (e: PointerEvent<SVGSVGElement>): TracePoint => {
    const r = pad.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 24, y: ((e.clientY - r.top) / r.height) * 24 };
  };
  const down = (e: PointerEvent<SVGSVGElement>) => {
    e.preventDefault();
    drawing.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* still draws */ }
    const p = at(e);
    setStrokes((s) => [...s, [p]]);
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return;
    const p = at(e);
    setStrokes((s) => {
      const last = s[s.length - 1] ?? [];
      const q = last[last.length - 1];
      if (q && Math.hypot(p.x - q.x, p.y - q.y) < 0.2) return s;
      return [...s.slice(0, -1), [...last, p].slice(-600)];
    });
  };
  const up = () => { drawing.current = false; };

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg ref={pad} width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={done ? `Letter ${letter}, traced` : `Trace the letter ${letter} here`}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
        style={{ display: "block", touchAction: "none", borderRadius: 24, background: "rgba(255,255,255,.12)", cursor: "crosshair" }} data-testid="trace-pad">
        {segs.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff" strokeWidth={done ? 2 : 1.3} strokeLinecap="round"
            strokeDasharray={done ? undefined : "0.01 1.7"} opacity={done ? 1 : 0.75} />
        ))}
        {!done && <circle cx={segs[0][0]} cy={segs[0][1]} r={1.15} fill="#ffd34d" />}
        {strokes.map((s, i) => s.length > 1
          ? <polyline key={i} points={s.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ")} fill="none" stroke="#ffd34d" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          : <circle key={i} cx={s[0].x} cy={s[0].y} r={0.75} fill="#ffd34d" />)}
      </svg>
      {strokes.length > 0 && (
        <button type="button" onClick={() => setStrokes([])} aria-label="Start over"
          style={{ position: "absolute", right: 8, top: 8, width: 40, height: 40, borderRadius: 20, border: 0, background: "rgba(0,0,0,.25)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>
        </button>
      )}
    </div>
  );
}
