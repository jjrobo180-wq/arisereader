// One pop-up for the whole Hub, so every pop-up behaves the same way on a phone:
// it closes with Escape (and the backdrop, if the screen says so), the page behind it stops
// scrolling, focus stays inside and goes back where it was, and it fits above the keyboard.
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function HubModal({
  title, onClose, children, footer, size = "md", closeOnBackdrop = false, hideClose = false, label,
}: {
  title: string;
  /** Called by Escape, the close button and (if allowed) a tap on the backdrop. Leave out for a pop-up that has to be answered. */
  onClose?: () => void;
  children: ReactNode;
  /** Buttons kept at the bottom of the pop-up while the rest scrolls. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  closeOnBackdrop?: boolean;
  hideClose?: boolean;
  label?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // The page behind stops scrolling while this is open (iPhone included).
  useEffect(() => {
    const { overflow, paddingRight } = document.body.style;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, []);

  // Focus goes in, and back to where it was.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>("[data-autofocus]") || panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first || panel.current)?.focus({ preventScroll: true });
    return () => { if (before && document.contains(before)) before.focus({ preventScroll: true }); };
  }, []);

  function onKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "Escape" && closeRef.current) {
      event.stopPropagation();
      closeRef.current();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;
    const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!items.length) { event.preventDefault(); panel.current.focus(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  const width = size === "sm" ? "sm:max-w-md" : size === "lg" ? "sm:max-w-3xl" : "sm:max-w-xl";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4"
      onMouseDown={(event) => { if (closeOnBackdrop && closeRef.current && event.target === event.currentTarget) closeRef.current(); }}
      data-testid="hub-modal"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label || title}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none sm:max-h-[90dvh] sm:rounded-3xl ${width}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="min-w-0 break-words text-lg font-bold text-slate-950">{title}</h2>
          {onClose && !hideClose && (
            <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-950">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">{footer}</div>}
      </div>
    </div>
  );
}
