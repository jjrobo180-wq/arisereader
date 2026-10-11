// Arise WorkHub: Home, arranged on the screen itself, the way an iPhone home screen is.
// Press and hold any part of Home (or tap "Edit Home") and the parts wiggle: drag one to move it, tap ✕ to take it
// off Home, and add taken-off parts back from the tray below. Done (or Escape) finishes. The order and what is hidden
// are the same ones Customize sets (shared/hubLayout.ts), saved with the workspace.
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Check, GripVertical, Plus, X } from "lucide-react";
import { HOME_SECTIONS, homeShown, type HomeSection, type HubLayout } from "@shared/hubLayout";

const HOLD_MS = 550;
const label = (id: HomeSection) => HOME_SECTIONS.find((s) => s.id === id)?.label ?? id;
const isTyping = (el: EventTarget | null) => el instanceof HTMLElement && !!el.closest("input, textarea, select, [contenteditable='true']");

export function HomeParts({ parts, layout, onChange }: { parts: Record<HomeSection, ReactNode>; layout: HubLayout; onChange: (next: HubLayout) => void }) {
  const [editing, setEditing] = useState(false);
  /** The order while editing; saved when a drag ends or a part is taken off. */
  const [order, setOrder] = useState<HomeSection[]>(layout.home);
  const [dragging, setDragging] = useState<HomeSection | null>(null);
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null);
  useEffect(() => { if (!dragging) setOrder(layout.home); }, [layout.home.join(","), dragging]);
  useEffect(() => {
    if (!editing) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setEditing(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [editing]);

  const hidden = layout.homeHidden;
  const save = (next: Partial<HubLayout>) => onChange({ ...layout, home: order, ...next });

  // ─── Press and hold to start ───────────────────────────────────────────────
  const cancelHold = () => { if (hold.current) { clearTimeout(hold.current.timer); hold.current = null; } };
  const holdProps = {
    onPointerDown: (e: ReactPointerEvent) => {
      if (editing || isTyping(e.target) || (e.pointerType === "mouse" && e.button !== 0)) return;
      cancelHold();
      hold.current = { x: e.clientX, y: e.clientY, timer: window.setTimeout(() => { hold.current = null; setEditing(true); try { navigator.vibrate?.(15); } catch { /* no buzz */ } }, HOLD_MS) };
    },
    // Scrolling or moving the finger is not a hold.
    onPointerMove: (e: ReactPointerEvent) => { if (hold.current && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > 10) cancelHold(); },
    onPointerUp: cancelHold, onPointerCancel: cancelHold, onPointerLeave: cancelHold,
  };

  // ─── Dragging a part ───────────────────────────────────────────────────────
  function startDrag(e: ReactPointerEvent, id: HomeSection) {
    if ((e.target as HTMLElement).closest("[data-home-remove]")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(id);
  }
  function moveDrag(e: ReactPointerEvent) {
    if (!dragging) return;
    const under = document.elementsFromPoint(e.clientX, e.clientY).map((el) => (el as HTMLElement).closest?.("[data-home-edit]") as HTMLElement | null).find((el) => el && el.dataset.homeEdit !== dragging);
    const target = under?.dataset.homeEdit as HomeSection | undefined;
    if (target) {
      setOrder((now) => {
        const from = now.indexOf(dragging), to = now.indexOf(target);
        if (from < 0 || to < 0 || from === to) return now;
        const next = now.filter((x) => x !== dragging);
        next.splice(to, 0, dragging);
        return next;
      });
    }
    // Near the top or bottom of the screen, the page scrolls along.
    const edge = 80;
    if (e.clientY < edge) window.scrollBy(0, -12); else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 12);
  }
  function endDrag() { if (!dragging) return; setDragging(null); save({}); }

  // ─── Not editing: Home as usual ────────────────────────────────────────────
  if (!editing) {
    const shown = homeShown(layout);
    const out: ReactNode[] = [];
    for (let i = 0; i < shown.length; i++) {
      const id = shown[i], next = shown[i + 1];
      const pair = (id === "meetings" && next === "todo") || (id === "todo" && next === "meetings");
      if (pair) { out.push(<div key={`${id}-${next}`} {...holdProps} className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 [-webkit-touch-callout:none] xl:grid-cols-2">{parts[id]}{parts[next]}</div>); i++; }
      else out.push(<div key={id} {...holdProps} className="[-webkit-touch-callout:none]">{parts[id]}</div>);
    }
    return (
      <>
        {out.length ? out : <p className="py-4 text-sm text-slate-500">Everything on Home is hidden.</p>}
        <div className="flex justify-center">
          <button type="button" onClick={() => setEditing(true)} className="min-h-11 rounded-xl px-3 text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800" data-testid="home-edit">Edit Home</button>
        </div>
      </>
    );
  }

  // ─── Editing: parts wiggle, drag to move, ✕ to take off ────────────────────
  const shownNow = order.filter((id) => !hidden.includes(id));
  const off = order.filter((id) => hidden.includes(id));
  return (
    <div className="space-y-5" data-testid="home-editing">
      <style>{`@keyframes hub-jiggle{0%{transform:rotate(-.35deg)}50%{transform:rotate(.35deg)}100%{transform:rotate(-.35deg)}}@media (prefers-reduced-motion:reduce){.hub-jiggle{animation:none!important}}`}</style>
      <div className="sticky top-[72px] z-20 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-2 shadow-md backdrop-blur">
        <p className="text-sm text-slate-600">Drag to move · tap <X className="inline h-3.5 w-3.5" /> to remove</p>
        <button type="button" onClick={() => setEditing(false)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white" data-testid="home-edit-done"><Check className="h-4 w-4" /> Done</button>
      </div>

      {shownNow.map((id, i) => (
        <div key={id} data-home-edit={id}
          className={`hub-jiggle relative select-none rounded-3xl transition-shadow [-webkit-touch-callout:none] ${dragging === id ? "z-10 scale-[1.02] shadow-2xl ring-2 ring-slate-900" : "ring-1 ring-slate-300"}`}
          style={{ animation: dragging === id ? "none" : `hub-jiggle 0.32s ease-in-out ${i % 2 ? "-0.16s" : "0s"} infinite` }}>
          {/* A small view of the part: what it is, without being usable while you arrange. */}
          <div className="pointer-events-none max-h-44 overflow-hidden rounded-3xl opacity-90 [mask-image:linear-gradient(to_bottom,black_70%,transparent)]" aria-hidden>{parts[id]}</div>
          <div role="button" tabIndex={0} aria-label={`Move ${label(id)}`} onPointerDown={(e) => startDrag(e, id)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
            onKeyDown={(e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); const at = order.indexOf(id), to = at + (e.key === "ArrowUp" ? -1 : 1); if (to < 0 || to >= order.length) return; const next = [...order]; [next[at], next[to]] = [next[to], next[at]]; setOrder(next); onChange({ ...layout, home: next }); } }}
            className="absolute inset-0 flex cursor-grab touch-none items-end justify-center rounded-3xl pb-2 active:cursor-grabbing" data-testid={`home-drag-${id}`}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/85 px-3 py-1.5 text-xs font-semibold text-white"><GripVertical className="h-3.5 w-3.5" />{label(id)}</span>
          </div>
          <button type="button" data-home-remove onClick={() => save({ homeHidden: [...new Set([...hidden, id])] })} aria-label={`Remove ${label(id)} from Home`}
            className="absolute -left-2 -top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-700 text-white shadow-md" data-testid={`home-remove-${id}`}><X className="h-4 w-4" /></button>
        </div>
      ))}
      {!shownNow.length && <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Home is empty. Add parts back below.</p>}

      {off.length > 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-4" data-testid="home-tray">
          <p className="mb-2 text-sm font-semibold text-slate-900">Add to Home</p>
          <div className="flex flex-wrap gap-2">
            {off.map((id) => (
              <button key={id} type="button" onClick={() => save({ homeHidden: hidden.filter((x) => x !== id) })} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50" data-testid={`home-add-${id}`}>
                <Plus className="h-4 w-4" /> {label(id)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
