// A sheet that behaves like an iPhone app's, not a web pop-up: it slides up from the bottom and fills the
// phone (a centred card on a computer), with Cancel on the left, the title in the middle and Done on the right,
// a grey page of grouped white rows like iOS Settings, and a grab bar that pulls it down to close.
// It closes with Escape, keeps focus inside, stops the page behind from scrolling and sits above the keyboard.
// Used by a to-do's details (teacher-hub/HubTaskEdit.tsx) and the daily check-in settings.
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";
import { lockPageScroll } from "@/lib/scrollLock";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function NativeSheet({ title, onClose, onDone, doneLabel = "Done", doneDisabled = false, cancelLabel = "Cancel", children, testId, label }: {
  title: string;
  /** Cancel, Escape and pulling the sheet down. */
  onClose: () => void;
  /** Done (left out: the sheet has only a Done that closes it). */
  onDone?: () => void;
  doneLabel?: string;
  doneDisabled?: boolean;
  /** Left out (""): no Cancel, only Done. */
  cancelLabel?: string;
  children: ReactNode;
  testId?: string;
  label?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => lockPageScroll(), []);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>("[data-autofocus]");
    (first || panel.current)?.focus({ preventScroll: true });
    return () => { if (before && document.contains(before)) before.focus({ preventScroll: true }); };
  }, []);

  function onKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "Escape") { event.stopPropagation(); closeRef.current(); return; }
    if (event.key !== "Tab" || !panel.current) return;
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  // Pulling the grab bar or the top bar down: past 120 px closes, less springs back.
  const down = (y: number) => { start.current = y; };
  const move = (y: number) => { if (start.current !== null) setDrag(Math.max(0, y - start.current)); };
  const up = () => { if (start.current === null) return; start.current = null; if (drag > 120) closeRef.current(); else setDrag(0); };
  const done = () => { if (!doneDisabled) (onDone ?? onClose)(); };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 kb-sheet z-[75] flex items-end justify-center sm:items-center sm:p-6" data-testid={testId}>
      <div className="arise-sheet-shade absolute inset-0 bg-black/40" onMouseDown={() => closeRef.current()} aria-hidden="true" />
      <div ref={panel} role="dialog" aria-modal="true" aria-label={label || title} tabIndex={-1} onKeyDown={onKeyDown}
        className="arise-sheet relative flex h-[calc(100dvh-max(0.75rem,var(--sat,env(safe-area-inset-top,0px))))] w-full flex-col overflow-hidden rounded-t-[14px] bg-[#f2f2f7] text-slate-900 shadow-2xl outline-none dark:bg-[#1c1c1e] dark:text-white sm:h-auto sm:max-h-[88dvh] sm:max-w-lg sm:rounded-[18px]"
        style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : { transition: "transform .2s ease" }}>
        <div className="shrink-0 touch-none select-none" onPointerDown={(e) => down(e.clientY)} onPointerMove={(e) => move(e.clientY)} onPointerUp={up} onPointerCancel={up}>
          <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true"><span className="h-[5px] w-9 rounded-full bg-black/20 dark:bg-white/25" /></div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center px-2 pb-2 pt-1.5 sm:pt-3">
            <span>{cancelLabel && <button type="button" onClick={onClose} className="min-h-11 rounded-lg px-2.5 text-[17px] text-[#6e5ae0] active:opacity-50" data-testid="sheet-cancel">{cancelLabel}</button>}</span>
            <h2 className="max-w-[55vw] truncate text-center text-[17px] font-semibold">{title}</h2>
            <span className="text-right"><button type="button" onClick={done} disabled={doneDisabled} className="min-h-11 rounded-lg px-2.5 text-[17px] font-semibold text-[#6e5ae0] active:opacity-50 disabled:text-slate-400" data-testid="sheet-done">{doneLabel}</button></span>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** A white rounded group of rows with thin lines between them, with an optional small caption above and note below. */
export function SheetGroup({ caption, note, children, className = "" }: { caption?: string; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-6 first:mt-3 ${className}`}>
      {caption && <h3 className="mb-1.5 px-4 text-[13px] uppercase tracking-wide text-slate-500 dark:text-white/50">{caption}</h3>}
      <div className="divide-y divide-black/[.07] overflow-hidden rounded-[12px] bg-white dark:divide-white/10 dark:bg-[#2c2c2e]">{children}</div>
      {note && <p className="mt-1.5 px-4 text-[13px] leading-snug text-slate-500 dark:text-white/50">{note}</p>}
    </section>
  );
}

/** One row: a coloured icon tile, the label (and a smaller line under it), and what sits on the right. */
export function SheetRow({ icon, color = "#8e8e93", label, sub, right, onClick, testId, children }: {
  icon?: ReactNode; color?: string; label: ReactNode; sub?: ReactNode; right?: ReactNode; onClick?: () => void; testId?: string;
  /** More under the row, inside the same cell (a date picker, chips). */
  children?: ReactNode;
}) {
  const body = (
    <span className="flex min-h-[44px] w-full items-center gap-3 py-1.5 pl-4 pr-3">
      {icon && <span className="grid h-[29px] w-[29px] shrink-0 place-items-center rounded-[7px] text-white [&>svg]:h-[17px] [&>svg]:w-[17px]" style={{ background: color }}>{icon}</span>}
      <span className="min-w-0 flex-1 text-left"><span className="block text-[17px] leading-snug">{label}</span>{sub && <span className="block text-[13px] leading-snug text-[#6e5ae0]">{sub}</span>}</span>
      {right}
      {onClick && !right && <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 dark:text-white/30" />}
    </span>
  );
  return (
    <div data-testid={testId}>
      {onClick ? <button type="button" onClick={onClick} className="block w-full active:bg-black/5">{body}</button> : body}
      {children && <div className="pb-3 pl-4 pr-3">{children}</div>}
    </div>
  );
}

/** An iPhone-style on/off switch (a real checkbox underneath, for keyboards and screen readers). */
export function SheetSwitch({ on, onChange, label, disabled = false, testId }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean; testId?: string }) {
  return (
    <label className={`relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer items-center rounded-full transition-colors ${on ? "bg-[#34c759]" : "bg-[#e9e9eb] dark:bg-[#39393d]"} ${disabled ? "opacity-40" : ""}`}>
      <input type="checkbox" role="switch" className="absolute inset-0 cursor-pointer opacity-0" checked={on} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      <span className={`pointer-events-none absolute left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,.15),0_1px_1px_rgba(0,0,0,.16)] transition-transform ${on ? "translate-x-[20px]" : ""}`} />
    </label>
  );
}
