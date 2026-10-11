// Arise WorkHub: Home, arranged on the screen itself, the way an iPhone home screen is.
// Press and hold any part of Home (or tap "Edit Home") and the parts wiggle. Drag one and it follows your finger
// while the others glide out of its way; tap ✕ to take it off Home; pick S, M or L (or drag the corner) to resize
// it; add taken-off parts and plugins back from the tray below. Done (or Escape) finishes. The order, sizes and
// what is hidden are kept in the workspace layout (shared/hubLayout.ts), the same one Customize sets.
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Check, Plus, Puzzle, X } from "lucide-react";
import { HOME_SECTIONS, HOME_SIZES, homeShown, resizeSection, sizeOf, type HomeSection, type HomeSize, type HubLayout } from "@shared/hubLayout";
import type { Plugin } from "@shared/pluginStore";
import { ICONS } from "@/components/plugin-store/PluginStore";

const HOLD_MS = 450;
const EASE = "cubic-bezier(.2,.8,.2,1)";
const label = (id: HomeSection) => HOME_SECTIONS.find((s) => s.id === id)?.label ?? id;
const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && !!el.closest("input, textarea, select, [contenteditable='true']");
/** Where a part sits in the grid, and how tall it may be. */
const SPAN: Record<HomeSize, string> = { small: "col-span-1", medium: "col-span-2", large: "col-span-2" };
const CAP: Record<HomeSize, string> = { small: "max-h-[24rem] overflow-y-auto overscroll-contain", medium: "max-h-[24rem] overflow-y-auto overscroll-contain", large: "" };
const PREVIEW: Record<HomeSize, string> = { small: "h-40", medium: "h-40", large: "h-64" };

export type QuickPlugin = { plugin: Plugin; onAdd: () => void };

export function HomeParts({ parts, layout, onChange, plugins = [], onOpenStore }: {
  parts: Record<HomeSection, ReactNode>; layout: HubLayout; onChange: (next: HubLayout) => void;
  /** Plugins not added yet, to add with one tap from the tray. */
  plugins?: QuickPlugin[];
  onOpenStore?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  /** The order while editing; saved when a drag ends. */
  const [order, setOrder] = useState<HomeSection[]>(layout.home);
  const [dragging, setDragging] = useState<HomeSection | null>(null);
  /** The part being pressed, so it sinks a little before editing starts. */
  const [pressing, setPressing] = useState<HTMLElement | null>(null);
  /** A size being chosen by dragging a corner, shown live. */
  const [resizing, setResizing] = useState<{ id: HomeSection; size: HomeSize } | null>(null);
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<HomeSection, HTMLDivElement>());
  /** Where each part was just before the order changed, to glide it from there (FLIP). */
  const before = useRef<Map<HomeSection, DOMRect> | null>(null);
  const drag = useRef<{ grabX: number; grabY: number; x: number; y: number } | null>(null);

  useEffect(() => { if (!dragging) setOrder(layout.home); }, [layout.home.join(","), dragging]);
  useEffect(() => {
    if (!editing) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setEditing(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [editing]);

  const hidden = layout.homeHidden;
  const save = (next: Partial<HubLayout>) => onChange({ ...layout, home: order, ...next });
  const size = (id: HomeSection): HomeSize => (resizing?.id === id ? resizing.size : sizeOf(layout, id));

  /** Remembers where every part is now, so the next layout change glides instead of jumping. */
  const measure = () => { const m = new Map<HomeSection, DOMRect>(); els.current.forEach((el, id) => m.set(id, el.getBoundingClientRect())); before.current = m; };

  // FLIP: after a reorder or resize, every part starts where it was and glides to where it is now.
  useLayoutEffect(() => {
    const was = before.current;
    before.current = null;
    if (!was) return;
    els.current.forEach((el, id) => {
      if (id === dragging) return placeDragged();
      const a = was.get(id), b = el.getBoundingClientRect();
      if (!a) return;
      const dx = a.left - b.left, dy = a.top - b.top;
      if (!dx && !dy) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      void el.offsetWidth;
      el.style.transition = `transform 260ms ${EASE}`;
      el.style.transform = "";
    });
  });

  // ─── Press and hold to start ───────────────────────────────────────────────
  const cancelHold = () => { if (hold.current) { clearTimeout(hold.current.timer); hold.current = null; } setPressing(null); };
  const holdProps = {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (editing || isTyping(e.target) || (e.pointerType === "mouse" && e.button !== 0)) return;
      cancelHold();
      const el = e.currentTarget;
      setPressing(el);
      hold.current = { x: e.clientX, y: e.clientY, timer: window.setTimeout(() => { hold.current = null; setPressing(null); setEditing(true); try { navigator.vibrate?.(12); } catch { /* no buzz */ } }, HOLD_MS) };
    },
    // Scrolling or moving the finger is not a hold.
    onPointerMove: (e: ReactPointerEvent) => { if (hold.current && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > 10) cancelHold(); },
    onPointerUp: cancelHold, onPointerCancel: cancelHold, onPointerLeave: cancelHold,
    onContextMenu: (e: ReactMouseEvent) => { if (hold.current) e.preventDefault(); },
  };
  const pressStyle = (el: HTMLElement | null) => (el && el === pressing ? { transform: "scale(0.97)", transition: `transform ${HOLD_MS}ms ${EASE}` } : { transition: `transform 200ms ${EASE}` });

  // ─── Dragging a part: it follows the finger, the others glide aside ────────
  /** Puts the dragged part under the finger, wherever its place in the grid is now. */
  function placeDragged() {
    const d = drag.current, id = dragging, el = id && els.current.get(id), box = grid.current?.getBoundingClientRect();
    if (!d || !el || !box) return;
    el.style.transition = "none";
    el.style.transform = `translate(${d.x - d.grabX - box.left - el.offsetLeft}px, ${d.y - d.grabY - box.top - el.offsetTop}px) scale(1.03)`;
  }
  function startDrag(e: ReactPointerEvent<HTMLDivElement>, id: HomeSection) {
    const el = els.current.get(id);
    if (!el) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const r = el.getBoundingClientRect();
    drag.current = { grabX: e.clientX - r.left, grabY: e.clientY - r.top, x: e.clientX, y: e.clientY };
    setDragging(id);
    try { navigator.vibrate?.(8); } catch { /* no buzz */ }
  }
  function moveDrag(e: ReactPointerEvent) {
    if (!dragging || !drag.current) return;
    drag.current.x = e.clientX; drag.current.y = e.clientY;
    placeDragged();
    const under = document.elementsFromPoint(e.clientX, e.clientY)
      .map((el) => (el as HTMLElement).closest?.("[data-home-edit]") as HTMLElement | null)
      .find((el) => el && el.dataset.homeEdit !== dragging);
    const target = under?.dataset.homeEdit as HomeSection | undefined;
    if (target) {
      const from = order.indexOf(dragging), to = order.indexOf(target);
      if (from >= 0 && to >= 0 && from !== to) {
        measure();
        const next = order.filter((x) => x !== dragging);
        next.splice(to, 0, dragging);
        setOrder(next);
      }
    }
    // Near the top or bottom of the screen, the page scrolls along.
    const edge = 90;
    if (e.clientY < edge) window.scrollBy(0, -14); else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 14);
  }
  function endDrag() {
    const id = dragging, el = id && els.current.get(id);
    if (!id) return;
    drag.current = null;
    if (el) { el.style.transition = `transform 240ms ${EASE}`; el.style.transform = ""; }
    setDragging(null);
    save({});
  }

  // ─── Resizing: S, M, L, or drag the corner and it snaps as you go ──────────
  function setSize(id: HomeSection, to: HomeSize) { measure(); onChange(resizeSection({ ...layout, home: order }, id, to)); }
  function startResize(e: ReactPointerEvent<HTMLButtonElement>, id: HomeSection) {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setResizing({ id, size: sizeOf(layout, id) });
  }
  function moveResize(e: ReactPointerEvent) {
    const el = resizing && els.current.get(resizing.id), box = grid.current?.getBoundingClientRect();
    if (!resizing || !el || !box) return;
    const r = el.getBoundingClientRect();
    const wide = e.clientX - box.left > box.width * 0.62;
    const tall = e.clientY - r.top > 300;
    const next: HomeSize = !wide ? "small" : tall ? "large" : "medium";
    if (next !== resizing.size) { measure(); setResizing({ id: resizing.id, size: next }); }
  }
  function endResize() { if (!resizing) return; const { id, size: to } = resizing; setResizing(null); onChange(resizeSection({ ...layout, home: order }, id, to)); }

  const ref = (id: HomeSection) => (el: HTMLDivElement | null) => { if (el) els.current.set(id, el); else els.current.delete(id); };

  // ─── Not editing: Home as usual, in a grid that keeps each part's size ─────
  if (!editing) {
    const shown = homeShown(layout);
    return (
      <>
        <div ref={grid} className="grid grid-cols-2 gap-4 sm:gap-6" data-testid="home-grid">
          {shown.map((id) => (
            <div key={id} ref={ref(id)} {...holdProps} style={pressStyle(els.current.get(id) ?? null)} className={`${SPAN[size(id)]} min-w-0 [-webkit-touch-callout:none]`} data-home-part={id}>
              <div className={`${CAP[size(id)]} rounded-3xl`}>{parts[id]}</div>
            </div>
          ))}
          {!shown.length && <p className="col-span-2 py-4 text-sm text-slate-500">Everything on Home is hidden.</p>}
        </div>
        <div className="flex justify-center">
          <button type="button" onClick={() => setEditing(true)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800" data-testid="home-edit">Edit Home</button>
        </div>
      </>
    );
  }

  // ─── Editing ───────────────────────────────────────────────────────────────
  const shownNow = order.filter((id) => !hidden.includes(id));
  const off = order.filter((id) => hidden.includes(id));
  return (
    <div className="space-y-5 animate-in fade-in duration-200" data-testid="home-editing">
      <style>{`@keyframes hub-jiggle{0%{transform:rotate(-.3deg)}50%{transform:rotate(.3deg)}100%{transform:rotate(-.3deg)}}@media (prefers-reduced-motion:reduce){.hub-jiggle{animation:none!important}}`}</style>
      <div className="sticky top-[72px] z-30 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-4 py-2 shadow-lg backdrop-blur">
        <p className="min-w-0 text-sm text-slate-600">Drag to move · <X className="inline h-3.5 w-3.5" /> to remove · S M L to resize</p>
        <button type="button" onClick={() => setEditing(false)} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition active:scale-95" data-testid="home-edit-done"><Check className="h-4 w-4" /> Done</button>
      </div>

      <div ref={grid} className="grid grid-cols-2 gap-4 sm:gap-6">
        {shownNow.map((id, i) => {
          const sz = size(id), lifted = dragging === id;
          return (
            <div key={id} ref={ref(id)} data-home-edit={id} className={`${SPAN[sz]} relative min-w-0 select-none [-webkit-touch-callout:none] ${lifted ? "z-20" : "z-0"}`} style={{ willChange: lifted ? "transform" : undefined }}>
              <div className={`hub-jiggle rounded-3xl transition-shadow duration-200 ${lifted ? "shadow-2xl ring-2 ring-slate-900" : "shadow-sm ring-1 ring-slate-300"}`}
                style={{ animation: lifted || resizing ? "none" : `hub-jiggle .34s ease-in-out ${i % 2 ? "-.17s" : "0s"} infinite` }}>
                {/* A small view of the part, the size it will be, not usable while you arrange. */}
                <div className={`pointer-events-none ${PREVIEW[sz]} overflow-hidden rounded-3xl transition-[height] duration-300 [mask-image:linear-gradient(to_bottom,black_72%,transparent)]`} aria-hidden>{parts[id]}</div>
                <div role="button" tabIndex={0} aria-label={`Move ${label(id)}`}
                  onPointerDown={(e) => startDrag(e, id)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
                  onKeyDown={(e) => { if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return; e.preventDefault(); const at = order.indexOf(id), to = at + (e.key === "ArrowUp" ? -1 : 1); if (to < 0 || to >= order.length) return; const next = [...order]; [next[at], next[to]] = [next[to], next[at]]; measure(); setOrder(next); onChange({ ...layout, home: next }); }}
                  className="absolute inset-0 flex cursor-grab touch-none items-end justify-center rounded-3xl pb-3 active:cursor-grabbing" data-testid={`home-drag-${id}`}>
                  <span className="rounded-full bg-slate-950/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur">{label(id)}</span>
                </div>
                <button type="button" onClick={() => save({ homeHidden: [...new Set([...hidden, id])] })} aria-label={`Remove ${label(id)} from Home`}
                  className="absolute -left-2 -top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-700 text-white shadow-md transition active:scale-90" data-testid={`home-remove-${id}`}><X className="h-4 w-4" /></button>
                <div className="absolute right-2 top-2 z-10 flex rounded-full bg-white/95 p-0.5 shadow-md ring-1 ring-slate-200" role="radiogroup" aria-label={`Size of ${label(id)}`}>
                  {HOME_SIZES.map((z) => <button key={z.id} type="button" role="radio" aria-checked={sz === z.id} aria-label={z.label} onClick={() => setSize(id, z.id)}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition ${sz === z.id ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"}`} data-testid={`home-size-${id}-${z.id}`}>{z.short}</button>)}
                </div>
                <button type="button" aria-label={`Resize ${label(id)}: drag`} onPointerDown={(e) => startResize(e, id)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize}
                  className="absolute -bottom-1.5 -right-1.5 z-10 inline-flex h-9 w-9 touch-none cursor-nwse-resize items-center justify-center rounded-full border-2 border-white bg-slate-950 text-white shadow-md" data-testid={`home-resize-${id}`}>
                  <svg viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden><path d="M11 5v6H5M11 11 6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
            </div>
          );
        })}
        {!shownNow.length && <p className="col-span-2 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Home is empty. Add parts back below.</p>}
      </div>

      {(off.length > 0 || plugins.length > 0 || onOpenStore) && (
        <div className="space-y-4 rounded-3xl border border-dashed border-slate-300 bg-white p-4" data-testid="home-tray">
          {off.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">Add to Home</p>
              <div className="flex flex-wrap gap-2">
                {off.map((id) => (
                  <button key={id} type="button" onClick={() => save({ homeHidden: hidden.filter((x) => x !== id) })} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95" data-testid={`home-add-${id}`}>
                    <Plus className="h-4 w-4" /> {label(id)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(plugins.length > 0 || onOpenStore) && (
            <div data-testid="home-plugins">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Plugins</p>
                {onOpenStore && <button type="button" onClick={onOpenStore} className="min-h-11 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4">See all in the Plugin Store</button>}
              </div>
              {plugins.length ? (
                <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {plugins.map(({ plugin: p, onAdd }) => {
                    const Icon = ICONS[p.icon] ?? Puzzle;
                    return (
                      <div key={p.id} className="flex w-36 shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-slate-200 p-3 text-center">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm" style={{ backgroundColor: p.color }} aria-hidden><Icon className="h-6 w-6" /></span>
                        <span className="line-clamp-1 text-sm font-semibold text-slate-900">{p.name}</span>
                        <span className="line-clamp-2 min-h-[2rem] text-[11px] leading-tight text-slate-500">{p.tagline}</span>
                        <button type="button" onClick={onAdd} className="mt-1 inline-flex min-h-9 w-full items-center justify-center gap-1 rounded-full bg-slate-950 text-xs font-semibold text-white transition active:scale-95" data-testid={`home-plugin-${p.id}`}><Plus className="h-3.5 w-3.5" /> Add</button>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm text-slate-500">Every plugin is added.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
