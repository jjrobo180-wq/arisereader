// Swipe a note in the list, like Apple Notes or Mail: swipe left for Delete (a long swipe deletes at
// once) and Pin, swipe right to pin or unpin. Only sideways drags count, so scrolling up and down is
// never caught. Taps still open the note. Buttons stay reachable for people who don't swipe (long-press
// or the note's own menu).
import { useRef, useState, type ReactNode } from "react";
import { Pin, PinOff, Trash2 } from "lucide-react";

const OPEN = 152, FULL = 0.62;

export function SwipeItem({ children, pinned, onDelete, onPin, disabled, radius = 0 }: { children: ReactNode; pinned: boolean; onDelete: () => void; onPin: () => void; disabled?: boolean; radius?: number }) {
  const [x, setX] = useState(0);
  const [anim, setAnim] = useState(false);
  const start = useRef<{ x: number; y: number; base: number; dir: "?" | "x" | "y"; w: number } | null>(null);
  const moved = useRef(false);
  const settle = (to: number) => { setAnim(true); setX(to); window.setTimeout(() => setAnim(false), 260); };
  const buzz = (ms = 10) => { try { navigator.vibrate?.(ms); } catch { /* fine */ } };

  const down = (e: React.PointerEvent) => {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    start.current = { x: e.clientX, y: e.clientY, base: x, dir: "?", w: (e.currentTarget as HTMLElement).offsetWidth };
    moved.current = false;
  };
  const move = (e: React.PointerEvent) => {
    const s = start.current; if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (s.dir === "?") { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; s.dir = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y"; if (s.dir === "x") (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); }
    if (s.dir !== "x") return;
    moved.current = true;
    let next = s.base + dx;
    if (next > 96) next = 96 + (next - 96) * 0.25; // pin side: a short pull
    if (next < -s.w) next = -s.w;
    setX(next);
  };
  const up = () => {
    const s = start.current; start.current = null; if (!s || s.dir !== "x") return;
    if (x <= -s.w * FULL) { buzz(18); settle(-s.w); window.setTimeout(onDelete, 180); return; }
    if (x >= 72) { buzz(); onPin(); settle(0); return; }
    settle(x < -OPEN / 2 ? -OPEN : 0);
  };
  const full = x < -OPEN - 40;

  return <div className="pp-swipe" style={{ borderRadius: radius }} onClickCapture={(e) => { if (moved.current) { e.preventDefault(); e.stopPropagation(); moved.current = false; } else if (x !== 0) { e.preventDefault(); e.stopPropagation(); settle(0); } }}>
    {/* Behind, on the right: Pin and Delete. On the left: Pin. */}
    <div className="pp-swipe-under" aria-hidden={x === 0} style={{ display: x === 0 && !anim ? "none" : "flex" }}>
      <button type="button" className="pp-swipe-pin-left" style={{ opacity: x > 8 ? 1 : 0 }} tabIndex={-1} onClick={() => { onPin(); settle(0); }}>{pinned ? <PinOff /> : <Pin />}<span>{pinned ? "Unpin" : "Pin"}</span></button>
      <span className="flex-1" />
      {!full && <button type="button" className="pp-swipe-pin" tabIndex={x < 0 ? 0 : -1} onClick={() => { onPin(); settle(0); }} aria-label={pinned ? "Unpin" : "Pin"}>{pinned ? <PinOff /> : <Pin />}<span>{pinned ? "Unpin" : "Pin"}</span></button>}
      <button type="button" className="pp-swipe-del" style={{ width: Math.max(76, -x - (full ? 0 : 76)) }} tabIndex={x < 0 ? 0 : -1} onClick={() => { buzz(18); onDelete(); }} aria-label="Delete"><Trash2 /><span>Delete</span></button>
    </div>
    <div className="pp-swipe-top" style={{ transform: `translate3d(${x}px,0,0)`, transition: anim ? "transform .26s cubic-bezier(.2,.9,.2,1)" : "none" }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>{children}</div>
  </div>;
}
