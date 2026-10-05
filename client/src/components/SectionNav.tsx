// The list of sections on the admin, teacher and parent pages. Each page shows
// one section at a time; this is how you move between them. On a wide screen
// the admin's list sits down the side. On a phone it is one row that slides.
import { Fragment, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import "./section-nav.css";

export type NavSection<Id extends string = string> = {
  id: Id;
  label: string;
  icon?: ReactNode;
  /** How many things here are waiting on the person. Shown as a number when above zero. */
  waiting?: number;
  /** A small heading above this entry in the side list. Starts a new group. */
  group?: string;
};

/** This many sections or fewer all fit across a phone, so none of them is hidden off the side. */
const FEW = 4;

export function SectionNav<Id extends string>({ sections, current, onChange, label, layout = "top" }: {
  sections: Array<NavSection<Id>>;
  current: Id;
  onChange: (id: Id) => void;
  /** What this list is, for screen readers: "Admin sections". */
  label: string;
  /** "side" is a list down the left on wide screens. "top" is a row above the page. */
  layout?: "side" | "top";
}) {
  const list = useRef<HTMLDivElement>(null);

  // When the row slides sideways, keep the open section where it can be seen.
  useEffect(() => {
    const box = list.current;
    const open = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!box || !open || box.scrollWidth <= box.clientWidth + 1) return;
    box.scrollLeft = open.offsetLeft - (box.clientWidth - open.offsetWidth) / 2;
  }, [current, sections.length]);

  return (
    <nav className={`sn sn-${layout}${sections.length <= FEW ? " sn-few" : ""}`} aria-label={label}>
      <div className="sn-list" ref={list} style={{ "--sn-n": sections.length } as CSSProperties}>
        {sections.map((s) => (
          <Fragment key={s.id}>
            {s.group && <p className="sn-group">{s.group}</p>}
            <button
              type="button"
              className="sn-item"
              aria-current={s.id === current ? "page" : undefined}
              onClick={() => onChange(s.id)}
              data-testid={`section-${s.id}`}
            >
              {s.icon && <span className="sn-icon" aria-hidden="true">{s.icon}</span>}
              <span className="sn-label">{s.label}</span>
              {!!s.waiting && s.waiting > 0 && (
                <span className="sn-count">
                  <span aria-hidden="true">{s.waiting > 99 ? "99+" : s.waiting}</span>
                  <span className="sn-sr">, {s.waiting} waiting</span>
                </span>
              )}
            </button>
          </Fragment>
        ))}
      </div>
    </nav>
  );
}

/** The name of the open section and one line on what is in it. */
export function SectionTitle({ title, about, children }: { title: string; about?: string; children?: ReactNode }) {
  return (
    <div className="sn-title">
      <div>
        <h2>{title}</h2>
        {about && <p>{about}</p>}
      </div>
      {children && <div className="sn-title-side">{children}</div>}
    </div>
  );
}

/**
 * Show a part of the page once it has been drawn. Used after switching
 * sections, when the part being jumped to is not on the page yet.
 */
export function scrollToPart(name: string, tries = 12) {
  const el = document.querySelector<HTMLElement>(`[data-section="${name}"]`);
  if (el && el.offsetParent !== null) {
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    return;
  }
  if (tries > 0) window.setTimeout(() => scrollToPart(name, tries - 1), 60);
}
