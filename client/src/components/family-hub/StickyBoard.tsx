// Sticky notes (a Plugin Store add-on): notes you can put anywhere on the LifeHub Home screen.
// Drag a note by its top strip. Where it sits is saved as a share of the width (so it stays put on
// a phone or a big screen) and a distance down the page.
import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { GripHorizontal, Palette, Plus, X } from "lucide-react";
import { NOTE_COLORS, type Family, type Sticky } from "@shared/familyHub";
import type { SetFamily } from "./ui";

const NOTE_W = 200;

export default function StickyBoard({ family, setFamily, makeId, children }: { family: Family; setFamily: SetFamily; makeId: () => string; children: ReactNode }) {
  const board = useRef<HTMLDivElement>(null);
  // While dragging, the note's spot lives here; it's saved once, when you let go.
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const start = useRef<{ px: number; py: number; x: number; y: number; w: number } | null>(null);

  const update = (id: string, patch: Partial<Sticky>) => setFamily((f) => ({ ...f, stickies: f.stickies.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const remove = (id: string) => setFamily((f) => ({ ...f, stickies: f.stickies.filter((s) => s.id !== id) }));
  const add = () => {
    const n = family.stickies.length;
    // Lands near the top of what you can see right now.
    const scrolled = Math.max(0, 120 - (board.current?.getBoundingClientRect().top ?? 0));
    setFamily((f) => ({ ...f, stickies: [...f.stickies, { id: makeId(), text: "", color: NOTE_COLORS[n % 5], x: 0.5 + ((n % 4) * 0.04), y: Math.round(scrolled + (n % 5) * 24) }] }));
  };

  const down = (e: ReactPointerEvent, s: Sticky) => {
    const w = board.current?.clientWidth ?? 1;
    start.current = { px: e.clientX, py: e.clientY, x: s.x, y: s.y, w };
    setDrag({ id: s.id, x: s.x, y: s.y });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent) => {
    if (!drag || !start.current) return;
    const { px, py, x, y, w } = start.current;
    const maxX = Math.max(0, 1 - NOTE_W / w);
    setDrag({ id: drag.id, x: Math.min(maxX, Math.max(0, x + (e.clientX - px) / w)), y: Math.max(0, Math.round(y + e.clientY - py)) });
  };
  const up = () => {
    if (drag) update(drag.id, { x: Math.round(drag.x * 1000) / 1000, y: drag.y });
    setDrag(null); start.current = null;
  };

  return <div ref={board} className="relative" data-testid="sticky-board">
    {children}
    <button type="button" onClick={add} className="fixed bottom-5 right-5 z-30 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#f5c542] px-4 text-sm font-black text-[#3b2f05] shadow-[0_10px_30px_#b4891f55] hover:bg-[#f0b928]" data-testid="sticky-add"><Plus size={18} />Sticky note</button>
    {family.stickies.map((s) => {
      const at = drag?.id === s.id ? drag : s;
      return <div key={s.id} className="absolute z-20 flex flex-col rounded-xl shadow-[0_10px_24px_#17152b26] ring-1 ring-black/5" style={{ left: `${at.x * 100}%`, top: at.y, width: NOTE_W, maxWidth: "calc(100% - 8px)", background: s.color, transform: drag?.id === s.id ? "rotate(-1.5deg) scale(1.02)" : "rotate(-0.5deg)" }} data-testid="sticky-note">
        <div className="flex items-center gap-1 px-1.5 pt-1">
          <span onPointerDown={(e) => down(e, s)} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="flex h-7 flex-1 cursor-grab touch-none items-center justify-center rounded-md text-black/30 hover:bg-black/5 active:cursor-grabbing" title="Drag to move" aria-label="Drag to move the note"><GripHorizontal size={16} /></span>
          <button type="button" onClick={() => update(s.id, { color: NOTE_COLORS[(NOTE_COLORS.indexOf(s.color) + 1) % NOTE_COLORS.length] })} className="flex h-7 w-7 items-center justify-center rounded-md text-black/40 hover:bg-black/5" aria-label="Change color"><Palette size={14} /></button>
          <button type="button" onClick={() => { if (!s.text.trim() || window.confirm("Delete this sticky note?")) remove(s.id); }} className="flex h-7 w-7 items-center justify-center rounded-md text-black/40 hover:bg-black/5" aria-label="Delete note"><X size={15} /></button>
        </div>
        <textarea value={s.text} onChange={(e) => update(s.id, { text: e.target.value })} maxLength={1000} rows={5} placeholder="Write something…" autoFocus={!s.text}
          className="w-full resize-none bg-transparent px-3 pb-3 pt-1 text-[15px] leading-6 text-[#2b2620] outline-none placeholder:text-black/30" style={{ fontFamily: "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', ui-rounded, system-ui" }} aria-label="Sticky note" />
      </div>;
    })}
  </div>;
}
