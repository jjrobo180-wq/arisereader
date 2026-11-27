// A full-screen feed you swipe up through, one card per screen (the way short-video apps work). Used by the
// Chores quick session and the self-help feed. Cards snap into place; arrow keys and the wheel move one card on
// a computer; `next()` moves on after a button tap.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export type SwipeFeedHandle = { next: () => void; goTo: (i: number) => void };

type Props = {
  pages: ReactNode[];
  onIndex?: (i: number) => void;
  onClose: () => void;
  /** Shown at the top over every card (a timer, a counter…). */
  top?: ReactNode;
  label: string;
  /** Called when the person nears the end, so more cards can be added. */
  onNearEnd?: () => void;
};

export const SwipeFeed = forwardRef<SwipeFeedHandle, Props>(function SwipeFeed({ pages, onIndex, onClose, top, label, onNearEnd }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const last = useRef(-1);
  const goTo = useCallback((i: number) => {
    const el = box.current;
    if (el) el.scrollTo({ top: Math.max(0, i) * el.clientHeight, behavior: "smooth" });
  }, []);
  const current = () => { const el = box.current; return el ? Math.round(el.scrollTop / Math.max(1, el.clientHeight)) : 0; };
  useImperativeHandle(ref, () => ({ next: () => goTo(current() + 1), goTo }), [goTo]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); goTo(current() + 1); }
      else if (e.key === "ArrowUp" || e.key === "PageUp") { e.preventDefault(); goTo(current() - 1); }
    };
    window.addEventListener("keydown", key);
    const html = document.documentElement, was = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); html.style.overflow = was; };
  }, [goTo, onClose]);

  const scrolled = () => {
    const i = current();
    if (i !== last.current) {
      last.current = i;
      onIndex?.(i);
      if (i >= pages.length - 3) onNearEnd?.();
    }
  };
  useEffect(() => { scrolled(); }); // the first card, and after cards are added

  return <div className="fixed inset-0 z-[450] bg-[#0d0b1a] text-white" role="dialog" aria-modal="true" aria-label={label}>
    <div ref={box} onScroll={scrolled} className="h-full w-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {pages.map((p, i) => <section key={i} className="relative h-[100dvh] w-full snap-start snap-always overflow-hidden">{p}</section>)}
    </div>
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <button type="button" onClick={onClose} aria-label="Close" className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur"><X size={22} /></button>
      <div className="pointer-events-auto min-w-0">{top}</div>
    </div>
  </div>;
});
