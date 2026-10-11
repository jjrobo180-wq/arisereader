// Arise WorkHub: Home, arranged on the screen itself.
// Tap "Edit Home" (or press and hold an empty spot of Home) and Home turns into a simple list of its parts, like
// an iPhone's widget list: drag a part by its handle (≡) to move it, pick S, M or L to resize it, tap ✕ to take it off,
// and add parts and plugins back from the tray. The page still scrolls anywhere but the handle. Dragging is done by
// framer-motion's Reorder, which handles touch, scrolling and the gliding. The order, sizes and what is hidden are
// kept in the workspace layout (shared/hubLayout.ts), the same one Customize sets.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Check, GripVertical, Plus, Puzzle, X } from "lucide-react";
import { HOME_SECTIONS, HOME_SIZES, homeShown, resizeSection, sizeOf, type HomeSection, type HomeSize, type HubLayout } from "@shared/hubLayout";
import type { Plugin } from "@shared/pluginStore";
import { ICONS } from "@/components/plugin-store/PluginStore";

const HOLD_MS = 600;
const label = (id: HomeSection) => HOME_SECTIONS.find((s) => s.id === id)?.label ?? id;
/** A press on something you can use (a button, a link, a box to type in) is never a hold to edit. */
const isControl = (el: EventTarget | null) => el instanceof HTMLElement && !!el.closest("a, button, input, textarea, select, label, [role='button'], [contenteditable='true']");
/** Where a part sits in the grid, and how tall it may be. */
const SPAN: Record<HomeSize, string> = { small: "col-span-2 sm:col-span-1", medium: "col-span-2", large: "col-span-2" };
const CAP: Record<HomeSize, string> = { small: "max-h-[26rem] overflow-y-auto overscroll-contain rounded-3xl", medium: "max-h-[22rem] overflow-y-auto overscroll-contain rounded-3xl", large: "" };
const SIZE_WORDS: Record<HomeSize, string> = { small: "Half width", medium: "Full width, short", large: "Full size" };

export type QuickPlugin = { plugin: Plugin; onAdd: () => void };

export function HomeParts({ parts, layout, onChange, plugins = [], onOpenStore }: {
  parts: Record<HomeSection, ReactNode>; layout: HubLayout; onChange: (next: HubLayout) => void;
  /** Plugins not added yet, to add with one tap from the tray. */
  plugins?: QuickPlugin[];
  onOpenStore?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const hidden = layout.homeHidden;
  /** The parts on Home in order, while editing. Saved when a drag ends. */
  const [order, setOrder] = useState<HomeSection[]>(() => homeShown(layout));
  const latest = useRef(order);
  latest.current = order;
  const dragging = useRef(false);
  useEffect(() => { if (!dragging.current) setOrder(homeShown(layout)); }, [layout.home.join(","), hidden.join(",")]);
  useEffect(() => {
    if (!editing) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setEditing(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [editing]);

  /** The full order: the parts on Home as arranged, then the hidden ones. */
  const full = (shown: HomeSection[]) => [...shown, ...layout.home.filter((id) => !shown.includes(id))];
  const commit = () => { dragging.current = false; onChange({ ...layout, home: full(latest.current) }); };

  // ─── Press and hold an empty spot of Home to start editing ─────────────────
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null);
  const cancelHold = () => { if (hold.current) { clearTimeout(hold.current.timer); hold.current = null; } };
  const holdProps = {
    onPointerDown: (e: ReactPointerEvent) => {
      if (isControl(e.target) || (e.pointerType === "mouse" && e.button !== 0)) return;
      cancelHold();
      hold.current = { x: e.clientX, y: e.clientY, timer: window.setTimeout(() => { hold.current = null; setEditing(true); try { navigator.vibrate?.(12); } catch { /* no buzz */ } }, HOLD_MS) };
    },
    onPointerMove: (e: ReactPointerEvent) => { if (hold.current && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > 8) cancelHold(); },
    onPointerUp: cancelHold, onPointerCancel: cancelHold, onPointerLeave: cancelHold,
  };

  // ─── Not editing: Home as usual, each part at its size ─────────────────────
  if (!editing) {
    const shown = homeShown(layout);
    return (
      <>
        <div className="grid grid-cols-2 gap-4 sm:gap-6" data-testid="home-grid">
          {shown.map((id) => (
            <div key={id} {...holdProps} className={`${SPAN[sizeOf(layout, id)]} min-w-0`} data-home-part={id}>
              <div className={CAP[sizeOf(layout, id)]}>{parts[id]}</div>
            </div>
          ))}
          {!shown.length && <p className="col-span-2 py-4 text-sm text-slate-500">Everything on Home is hidden.</p>}
        </div>
        <div className="flex justify-center">
          <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95" data-testid="home-edit">Edit Home</button>
        </div>
      </>
    );
  }

  // ─── Editing: a list to drag by the handle ─────────────────────────────────
  const off = layout.home.filter((id) => hidden.includes(id));
  return (
    <div className="space-y-4" data-testid="home-editing">
      <div className="sticky top-[72px] z-30 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur">
        <p className="min-w-0 text-sm font-semibold text-slate-900">Edit Home</p>
        <button type="button" onClick={() => setEditing(false)} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition active:scale-95" data-testid="home-edit-done"><Check className="h-4 w-4" /> Done</button>
      </div>

      <Reorder.Group axis="y" values={order} onReorder={(next) => { dragging.current = true; setOrder(next); }} className="space-y-2" as="ul">
        {order.map((id) => (
          <EditRow key={id} id={id} size={sizeOf(layout, id)} onDragEnd={commit}
            onSize={(to) => onChange(resizeSection({ ...layout, home: full(order) }, id, to))}
            onRemove={() => onChange({ ...layout, home: full(order), homeHidden: [...new Set([...hidden, id])] })} />
        ))}
      </Reorder.Group>
      {!order.length && <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Home is empty. Add parts back below.</p>}

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

/** One part of Home in the edit list: drag it by the handle, resize it, or take it off. */
function EditRow({ id, size, onDragEnd, onSize, onRemove }: { id: HomeSection; size: HomeSize; onDragEnd: () => void; onSize: (to: HomeSize) => void; onRemove: () => void }) {
  const controls = useDragControls();
  return (
    <Reorder.Item value={id} as="li" dragListener={false} dragControls={controls} onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.03, boxShadow: "0 16px 40px rgba(15,23,42,0.18)", zIndex: 20 }}
      className="relative flex min-h-16 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 shadow-sm" data-testid={`home-row-${id}`}>
      <button type="button" onClick={onRemove} aria-label={`Remove ${label(id)} from Home`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-red-50 hover:text-red-700 active:scale-90" data-testid={`home-remove-${id}`}>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-white"><X className="h-3.5 w-3.5" /></span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{label(id)}</p>
        <p className="truncate text-xs text-slate-500">{SIZE_WORDS[size]}</p>
      </div>
      <div className="flex shrink-0 rounded-full bg-slate-100 p-0.5" role="radiogroup" aria-label={`Size of ${label(id)}`}>
        {HOME_SIZES.map((z) => <button key={z.id} type="button" role="radio" aria-checked={size === z.id} aria-label={z.label} onClick={() => onSize(z.id)}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition ${size === z.id ? "bg-slate-950 text-white shadow" : "text-slate-600"}`} data-testid={`home-size-${id}-${z.id}`}>{z.short}</button>)}
      </div>
      <span onPointerDown={(e) => { e.preventDefault(); controls.start(e); }} role="button" tabIndex={-1} aria-label={`Drag ${label(id)}`}
        className="inline-flex h-12 w-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 active:cursor-grabbing" data-testid={`home-drag-${id}`}>
        <GripVertical className="h-5 w-5" />
      </span>
    </Reorder.Item>
  );
}
