import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/** An on-screen joystick: x right, y forward, both -1…1, null when released. */
export default function TouchStick({ onChange, className = "", label = "Move" }: { onChange: (v: { x: number; y: number } | null) => void; className?: string; label?: string }) {
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);
  const id = useRef<number | null>(null);
  useEffect(() => () => onChange(null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect(), radius = r.width * 0.36;
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > radius) { dx *= radius / len; dy *= radius / len; }
    setKnob({ x: dx, y: dy });
    onChange({ x: dx / radius, y: -dy / radius });
  };
  const end = () => { id.current = null; setKnob(null); onChange(null); };
  return (
    <div
      className={"touch-stick " + className + (knob ? " down" : "")} role="application" aria-label={label}
      onPointerDown={(e) => { if (id.current !== null) return; id.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
      onPointerMove={(e) => { if (e.pointerId === id.current) move(e); }}
      onPointerUp={(e) => { if (e.pointerId === id.current) end(); }} onPointerCancel={end} onLostPointerCapture={end}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="touch-stick-knob" style={{ transform: `translate(${knob?.x ?? 0}px, ${knob?.y ?? 0}px)` }} />
    </div>
  );
}
