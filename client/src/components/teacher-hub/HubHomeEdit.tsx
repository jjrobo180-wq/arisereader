// Arise WorkHub: Home, arranged on the screen itself, the way iPhone apps are.
// Tap "Edit Home" (or press and hold an empty spot of Home) and the parts wiggle. Then:
// - hold a part for a moment and drag it: it follows your finger and the others glide out of its way
//   (a quick swipe still scrolls the page);
// - tap ✕ to take a part off Home, or S, M, L to resize it;
// - add parts and plugins back from the tray. Done (or Escape) finishes.
// The gliding is framer-motion's layout animation. The order, sizes and what is hidden are kept in the workspace
// layout (shared/hubLayout.ts), the same one Customize sets.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Bell, CalendarDays, Check, CheckSquare, Image as ImageIcon, ListChecks, Plus, Puzzle, School, Sun, Users, WandSparkles, X, type LucideIcon } from "lucide-react";
import { HubModal } from "./HubModal";
import { HOME_SECTIONS, HOME_SIZES, homeShown, resizeSection, sizeOf, type HomeSection, type HomeSize, type HubLayout } from "@shared/hubLayout";
import type { Plugin } from "@shared/pluginStore";
import { ICONS } from "@/components/plugin-store/PluginStore";

/** Holding this long on Home starts editing; holding this long on a part while editing picks it up. */
const HOLD_EDIT_MS = 600;
const HOLD_DRAG_MS = 220;
const label = (id: HomeSection) => HOME_SECTIONS.find((s) => s.id === id)?.label ?? id;
/** A press on something you can use (a button, a link, a box to type in) is never a hold. */
const isControl = (el: EventTarget | null) => el instanceof HTMLElement && !!el.closest("a, button, input, textarea, select, label, [role='button'], [role='radio'], [contenteditable='true']");
/** Where a part sits in the grid, and how tall it may be. Small is half width from tablet size up. */
// The grid has 3 columns on a phone and more on wider screens. Small is one square, like an app icon but bigger.
const GRID = "grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-5 md:grid-cols-5 xl:grid-cols-6";
const SPAN: Record<HomeSize, string> = { small: "col-span-1", medium: "col-span-full", large: "col-span-full" };
/** The picture on each part's small tile. */
const PART_ICON: Record<HomeSection, LucideIcon> = { day: Sun, picture: ImageIcon, agenda: ListChecks, add: WandSparkles, calendar: CalendarDays, meetings: Users, todo: CheckSquare, notifications: Bell, profile: School };
const CAP: Record<HomeSize, string> = { small: "max-h-[26rem] overflow-y-auto overscroll-contain rounded-3xl", medium: "max-h-[22rem] overflow-y-auto overscroll-contain rounded-3xl", large: "" };
/** How tall a part's picture is while arranging. */
const PREVIEW: Record<HomeSize, string> = { small: "aspect-square", medium: "h-36", large: "h-52" };
const GLIDE = { type: "spring", stiffness: 520, damping: 42, mass: 0.8 } as const;

export type QuickPlugin = { plugin: Plugin; onAdd: () => void };

type Drag = {
  id: HomeSection;
  /** Where the finger took hold, inside the part. */
  grabX: number; grabY: number;
  /** The finger now, on the screen. */
  x: number; y: number;
  /** The part just swapped with: it is not swapped back until the finger leaves it, so parts never flip back and forth. */
  last: HomeSection | null;
};

export function HomeParts({ parts, layout, onChange, plugins = [], onOpenStore }: {
  parts: Record<HomeSection, ReactNode>; layout: HubLayout; onChange: (next: HubLayout) => void;
  /** Plugins not added yet, to add with one tap from the tray. */
  plugins?: QuickPlugin[];
  onOpenStore?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  /** A small tile tapped open: its whole part in a pop-up. */
  const [opened, setOpened] = useState<HomeSection | null>(null);
  const hidden = layout.homeHidden;
  /** The parts on Home in order, while editing. */
  const [order, setOrder] = useState<HomeSection[]>(() => homeShown(layout));
  const orderRef = useRef(order);
  orderRef.current = order;
  const [dragId, setDragId] = useState<HomeSection | null>(null);
  const drag = useRef<Drag | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<HomeSection, HTMLDivElement>());
  const press = useRef<{ timer: number; x: number; y: number; id: HomeSection | null } | null>(null);
  const scrollLoop = useRef(0);

  useEffect(() => { if (!drag.current) setOrder(homeShown(layout)); }, [layout.home.join(","), hidden.join(",")]);
  useEffect(() => {
    if (!editing) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setEditing(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [editing]);

  /** The full order: the parts on Home as arranged, then the hidden ones. */
  const full = (shown: HomeSection[]) => [...shown, ...layout.home.filter((id) => !shown.includes(id))];

  // ─── While a part is held, the page does not scroll under the finger ───────
  // The listener is there the whole time Home is being edited, so it is ready the moment a part is picked up.
  useEffect(() => {
    if (!editing) return;
    const stop = (e: TouchEvent) => { if (drag.current) e.preventDefault(); };
    document.addEventListener("touchmove", stop, { passive: false });
    return () => document.removeEventListener("touchmove", stop);
  }, [editing]);

  /** Puts the held part under the finger, wherever its place in the grid is now. */
  function place() {
    const d = drag.current, el = d && els.current.get(d.id), box = grid.current?.getBoundingClientRect();
    if (!d || !el || !box) return;
    el.style.transform = `translate3d(${d.x - d.grabX - box.left - el.offsetLeft}px, ${d.y - d.grabY - box.top - el.offsetTop}px, 0) scale(1.04)`;
  }

  /** Moves the held part to the place of the part under the finger. Places are read from the layout, not the screen, so gliding parts don't confuse it. */
  function reorder() {
    const d = drag.current, box = grid.current?.getBoundingClientRect();
    if (!d || !box) return;
    const px = d.x - box.left, py = d.y - box.top;
    const inside = (id: HomeSection) => { const el = els.current.get(id); return !!el && px >= el.offsetLeft && px <= el.offsetLeft + el.offsetWidth && py >= el.offsetTop && py <= el.offsetTop + el.offsetHeight; };
    if (d.last && !inside(d.last)) d.last = null;
    const target = orderRef.current.find((id) => id !== d.id && id !== d.last && inside(id));
    if (!target) return;
    const now = orderRef.current, to = now.indexOf(target);
    const next = now.filter((x) => x !== d.id);
    next.splice(to, 0, d.id);
    d.last = target;
    orderRef.current = next;
    setOrder(next);
    requestAnimationFrame(place);
  }

  function pickUp(id: HomeSection, x: number, y: number) {
    const el = els.current.get(id);
    if (!el) return;
    const r = el.getBoundingClientRect();
    drag.current = { id, grabX: x - r.left, grabY: y - r.top, x, y, last: null };
    setDragId(id);
    try { navigator.vibrate?.(10); } catch { /* no buzz */ }
    place();
    // Near the top or bottom of the screen, the page scrolls along.
    const tick = () => {
      const d = drag.current;
      if (!d) return;
      const edge = 90, speed = d.y < edge ? -(edge - d.y) / 6 : d.y > window.innerHeight - edge ? (d.y - (window.innerHeight - edge)) / 6 : 0;
      if (speed) { window.scrollBy(0, speed); place(); reorder(); }
      scrollLoop.current = requestAnimationFrame(tick);
    };
    scrollLoop.current = requestAnimationFrame(tick);
  }

  function drop() {
    const d = drag.current;
    cancelAnimationFrame(scrollLoop.current);
    if (!d) return;
    drag.current = null;
    const el = els.current.get(d.id);
    if (el) { el.style.transition = "transform 220ms cubic-bezier(.2,.8,.2,1)"; el.style.transform = ""; setTimeout(() => { el.style.transition = ""; }, 240); }
    setDragId(null);
    onChange({ ...layout, home: full(orderRef.current) });
  }

  // ─── Pointer handling for a part while editing ─────────────────────────────
  const cancelPress = () => { if (press.current) { clearTimeout(press.current.timer); press.current = null; } };
  const partHandlers = (id: HomeSection) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isControl(e.target) || (e.pointerType === "mouse" && e.button !== 0)) return;
      cancelPress();
      const { clientX: x, clientY: y } = e;
      if (e.pointerType === "mouse") { press.current = { timer: 0, x, y, id }; return; }
      // On a touch screen a part is picked up after a short hold, so a quick swipe still scrolls.
      press.current = { x, y, id, timer: window.setTimeout(() => { if (press.current) { const p = press.current; press.current = null; pickUp(id, p.x, p.y); } }, HOLD_DRAG_MS) };
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (drag.current) return; // the window follows a held part (below)
      const p = press.current;
      if (!p) return;
      const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      // With a mouse, moving a few pixels with the button down picks the part up. With a finger, moving first means scrolling.
      if (e.pointerType === "mouse" && moved > 4) { press.current = null; e.currentTarget.setPointerCapture?.(e.pointerId); pickUp(id, p.x, p.y); }
      else if (e.pointerType !== "mouse" && moved > 8) cancelPress();
    },
    onPointerUp: () => { cancelPress(); drop(); },
    onPointerCancel: () => { cancelPress(); drop(); },
  });
  // Once a part is picked up, it follows the pointer anywhere on the screen until it is let go.
  useEffect(() => {
    if (!dragId) return;
    const move = (e: PointerEvent) => { const d = drag.current; if (!d) return; d.x = e.clientX; d.y = e.clientY; place(); reorder(); };
    const up = () => drop();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
  }, [dragId]);

  // ─── Press and hold an empty spot of Home to start editing ─────────────────
  const holdProps = {
    onPointerDown: (e: ReactPointerEvent) => {
      if (isControl(e.target) || (e.pointerType === "mouse" && e.button !== 0)) return;
      cancelPress();
      press.current = { x: e.clientX, y: e.clientY, id: null, timer: window.setTimeout(() => { press.current = null; setEditing(true); try { navigator.vibrate?.(12); } catch { /* no buzz */ } }, HOLD_EDIT_MS) };
    },
    onPointerMove: (e: ReactPointerEvent) => { const p = press.current; if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) cancelPress(); },
    onPointerUp: cancelPress, onPointerCancel: cancelPress, onPointerLeave: cancelPress,
  };

  const ref = (id: HomeSection) => (el: HTMLDivElement | null) => { if (el) els.current.set(id, el); else els.current.delete(id); };

  // ─── Not editing: Home as usual, each part at its size ─────────────────────
  if (!editing) {
    const shown = homeShown(layout);
    return (
      <>
        <div className={GRID} data-testid="home-grid">
          {shown.map((id) => (
            <div key={id} {...holdProps} className={`${SPAN[sizeOf(layout, id)]} min-w-0`} data-home-part={id}>
              {sizeOf(layout, id) === "small"
                ? <button type="button" onClick={() => setOpened(id)} className="w-full transition active:scale-95" aria-label={`Open ${label(id)}`} data-testid={`home-tile-${id}`}><Tile id={id} /></button>
                : <div className={CAP[sizeOf(layout, id)]}>{parts[id]}</div>}
            </div>
          ))}
          {!shown.length && <p className="col-span-full py-4 text-sm text-slate-500">Everything on Home is hidden.</p>}
        </div>
        <div className="flex justify-center">
          <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95" data-testid="home-edit">Edit Home</button>
        </div>
        {opened && <HubModal title={label(opened)} size="lg" onClose={() => setOpened(null)}>{parts[opened]}</HubModal>}
      </>
    );
  }

  // ─── Editing: the parts wiggle; hold one and drag it ───────────────────────
  const off = layout.home.filter((id) => hidden.includes(id));
  return (
    <div className="space-y-5" data-testid="home-editing">
      <style>{`@keyframes hub-jiggle{0%{transform:rotate(-.4deg)}50%{transform:rotate(.4deg)}100%{transform:rotate(-.4deg)}}@media (prefers-reduced-motion:reduce){.hub-jiggle{animation:none!important}}`}</style>
      <div className="sticky top-[72px] z-30 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur">
        <p className="min-w-0 text-sm text-slate-600">Hold a part and drag it · <X className="inline h-3.5 w-3.5" /> removes · S M L resizes</p>
        <button type="button" onClick={() => setEditing(false)} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition active:scale-95" data-testid="home-edit-done"><Check className="h-4 w-4" /> Done</button>
      </div>

      <div ref={grid} className={`relative ${GRID}`}>
        {order.map((id, i) => {
          const sz = sizeOf(layout, id), held = dragId === id;
          return (
            <motion.div key={id} ref={ref(id)} layout={held ? false : "position"} transition={GLIDE} data-home-edit={id}
              {...partHandlers(id)}
              className={`${SPAN[sz]} relative min-w-0 select-none [-webkit-touch-callout:none] ${held ? "z-40 cursor-grabbing" : "z-0 cursor-grab"}`}
              style={held ? { willChange: "transform" } : undefined}>
              <div className={`hub-jiggle relative rounded-3xl bg-white transition-shadow duration-150 ${held ? "shadow-2xl ring-2 ring-slate-900" : "shadow-sm ring-1 ring-slate-300"}`}
                style={{ animation: held ? "none" : `hub-jiggle .3s ease-in-out ${i % 2 ? "-.15s" : "0s"} infinite` }}>
                {sz === "small"
                  ? <div className="pointer-events-none" aria-hidden><Tile id={id} /></div>
                  : <div className={`pointer-events-none ${PREVIEW[sz]} overflow-hidden rounded-3xl [mask-image:linear-gradient(to_bottom,black_70%,transparent)]`} aria-hidden>{parts[id]}</div>}
                {sz !== "small" && <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/80 px-3 py-1 text-xs font-semibold text-white">{label(id)}</span>}
                <button type="button" onClick={() => onChange({ ...layout, home: full(order), homeHidden: [...new Set([...hidden, id])] })} aria-label={`Remove ${label(id)} from Home`}
                  className="absolute -left-2 -top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-700 text-white shadow-md transition active:scale-90" data-testid={`home-remove-${id}`}><X className="h-4 w-4" /></button>
                <div className={`absolute z-10 flex rounded-full bg-white/95 p-0.5 shadow-md ring-1 ring-slate-200 ${sz === "small" ? "-bottom-3 left-1/2 -translate-x-1/2" : "right-2 top-2"}`} role="radiogroup" aria-label={`Size of ${label(id)}`}>
                  {HOME_SIZES.map((z) => <button key={z.id} type="button" role="radio" aria-checked={sz === z.id} aria-label={z.label} onClick={() => onChange(resizeSection({ ...layout, home: full(order) }, id, z.id))}
                    className={`inline-flex ${sz === "small" ? "h-7 w-7" : "h-8 w-8"} items-center justify-center rounded-full text-xs font-bold transition ${sz === z.id ? "bg-slate-950 text-white" : "text-slate-600"}`} data-testid={`home-size-${id}-${z.id}`}>{z.short}</button>)}
                </div>
              </div>
            </motion.div>
          );
        })}
        {!order.length && <p className="col-span-full rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Home is empty. Add parts back below.</p>}
      </div>

      {(off.length > 0 || plugins.length > 0 || onOpenStore) && (
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4" data-testid="home-tray">
          {off.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">Add to Home</p>
              <div className="flex flex-wrap gap-2">
                {off.map((id) => (
                  <button key={id} type="button" onClick={() => onChange({ ...layout, homeHidden: hidden.filter((x) => x !== id) })} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95" data-testid={`home-add-${id}`}>
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
                {onOpenStore && <button type="button" onClick={onOpenStore} className="min-h-11 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4">See all</button>}
              </div>
              {plugins.length ? (
                <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {plugins.map(({ plugin: p, onAdd }) => {
                    const Icon = ICONS[p.icon] ?? Puzzle;
                    return (
                      <div key={p.id} className="flex w-32 shrink-0 flex-col items-center gap-1.5 rounded-2xl border border-slate-200 p-3 text-center">
                        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: p.color }} aria-hidden><Icon className="h-5 w-5" /></span>
                        <span className="line-clamp-1 text-sm font-semibold text-slate-900">{p.name}</span>
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

/** A part as a small square tile, like an app icon: its picture and its name. */
function Tile({ id }: { id: HomeSection }) {
  const Icon = PART_ICON[id] ?? Puzzle;
  return (
    <span className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-[1.6rem] border border-slate-200 bg-white p-2 text-center shadow-sm">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm sm:h-14 sm:w-14"><Icon className="h-6 w-6 sm:h-7 sm:w-7" /></span>
      <span className="line-clamp-2 text-xs font-semibold leading-tight text-slate-800 sm:text-sm">{label(id)}</span>
    </span>
  );
}
