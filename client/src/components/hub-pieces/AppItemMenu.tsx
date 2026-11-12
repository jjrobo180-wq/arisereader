// The "⋯" on an app in the menu: hide it, remove it, and so on, right there. On a computer the button shows
// on hover (and to the keyboard); on a phone, press and hold the app (or right-click) to open the same menu.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

export type AppItemAction = { label: string; onPick: () => void; danger?: boolean; icon?: ReactNode };

/** Press-and-hold (half a second) and right-click handlers for the app's own button. */
export function useHoldToOpen(open: () => void) {
  const t = useRef<number | null>(null);
  const fired = useRef(false);
  const clear = () => { if (t.current) window.clearTimeout(t.current); t.current = null; };
  return {
    onContextMenu: (e: { preventDefault: () => void }) => { e.preventDefault(); open(); },
    onTouchStart: () => { fired.current = false; clear(); t.current = window.setTimeout(() => { fired.current = true; try { navigator.vibrate?.(10); } catch { /* fine */ } open(); }, 500); },
    onTouchEnd: (e: { preventDefault: () => void }) => { clear(); if (fired.current) e.preventDefault(); },
    onTouchMove: clear,
    /** True right after a hold opened the menu, so the tap that ends it doesn't also open the app. */
    held: () => { const h = fired.current; fired.current = false; return h; },
  };
}

export default function AppItemMenu({ name, actions, open, setOpen, className = "" }: { name: string; actions: AppItemAction[]; open: boolean; setOpen: (o: boolean) => void; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open, setOpen]);
  if (!actions.length) return null;
  return <div ref={box} className={`relative flex shrink-0 items-center ${className}`}>
    <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(!open); }} aria-label={`More for ${name}`} aria-haspopup="menu" aria-expanded={open} data-testid="app-item-more"
      className={`flex h-9 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:opacity-100 ${open ? "opacity-100" : "opacity-0 group-hover/navitem:opacity-100 max-md:hidden"}`}>
      <MoreHorizontal className="h-4 w-4" />
    </button>
    {open && <div role="menu" aria-label={name} className="absolute right-0 top-full z-[80] mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl" data-testid="app-item-menu">
      <p className="truncate px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{name}</p>
      {actions.map((a) => <button key={a.label} type="button" role="menuitem" onClick={(e) => { e.stopPropagation(); setOpen(false); a.onPick(); }}
        className={`flex min-h-11 w-full items-center gap-2 px-3 text-sm font-medium hover:bg-slate-50 ${a.danger ? "text-rose-700" : "text-slate-800"}`}>{a.icon}{a.label}</button>)}
    </div>}
  </div>;
}
