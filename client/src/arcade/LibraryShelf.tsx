import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A titled, sideways-scrolling row of covers (used by the Game Room and the
 * Worlds page). The arrows only show when the row doesn't fit.
 */
export function Shelf({ id, title, note, children, refCb }: { id: string; title: string; note?: string; children: ReactNode; refCb?: (el: HTMLElement | null) => void }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [ends, setEnds] = useState({ start: true, end: false });
  const update = () => {
    const el = rowRef.current;
    if (!el) return;
    const start = el.scrollLeft < 8;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
    // Keep the same object when nothing changed so re-checking after a render is free.
    setEnds((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  };
  // Re-check after each render too, since the number of covers on a shelf can change.
  useEffect(() => { update(); });
  useEffect(() => { window.addEventListener("resize", update); return () => window.removeEventListener("resize", update); }, []);
  const scroll = (dir: number) => rowRef.current?.scrollBy({ left: dir * rowRef.current.clientWidth * 0.8, behavior: "smooth" });
  const fits = ends.start && ends.end;
  return (
    <section className="axl-shelf" ref={refCb} aria-labelledby={`axl-shelf-${id}`}>
      <div className="axl-shelf-head">
        <h2 id={`axl-shelf-${id}`} className="axl-h2">{title}</h2>
        {note && <p>{note}</p>}
        {!fits && (
          <div className="axl-shelf-nav">
            <button type="button" aria-label={`Scroll ${title} back`} disabled={ends.start} onClick={() => scroll(-1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg></button>
            <button type="button" aria-label={`Scroll ${title} forward`} disabled={ends.end} onClick={() => scroll(1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg></button>
          </div>
        )}
      </div>
      <div className="axl-row" ref={rowRef} onScroll={update}>{children}</div>
    </section>
  );
}
