// A tapped notification opens the exact place it's about (shared/notifyLinks.ts builds the links; AriseTodo.tsx
// and TeacherHub.tsx read them). Two parts:
//  - an intent for a section ("log dinner for Sam" in Food & fitness, "log today's mood"): the section picks it up
//    when it shows, even if the tap just started the app (useIntent);
//  - an item to show ("habit:abc", "bill:xyz"): scrolled to the middle of the screen and lit up once it's drawn
//    (any element with data-focus="habit:abc"; waits up to about 6 seconds for the screen to appear).
import { useEffect, useRef } from "react";

export type Intent = { section: string; log?: string; who?: string; date?: string; focus?: string };
export const INTENT_EVENT = "duo-intent";
let pending: Intent | null = null;

/** Hand an intent to its section (now, or when it next shows). */
export function setIntent(i: Intent): void {
  pending = i;
  try { window.dispatchEvent(new CustomEvent(INTENT_EVENT, { detail: i })); } catch { /* picked up on mount */ }
}

/** A section's way to hear intents for it: `handle` runs once for each (the one waiting when it mounts, and any
 *  that come while it's open). */
export function useIntent(section: string, handle: (i: Intent) => void): void {
  const fn = useRef(handle); fn.current = handle;
  useEffect(() => {
    const take = (i: Intent | null) => { if (!i || i.section !== section) return; pending = null; window.setTimeout(() => fn.current(i), 0); };
    take(pending);
    const on = (e: Event) => take((e as CustomEvent<Intent>).detail);
    window.addEventListener(INTENT_EVENT, on);
    return () => window.removeEventListener(INTENT_EVENT, on);
  }, [section]);
}

/** Scrolls to the element marked data-focus="<id>" once it's drawn, and lights it up for a moment. */
export function scrollToFocus(id: string): void {
  if (!id || typeof document === "undefined") return;
  const sel = `[data-focus="${typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id.replace(/"/g, "")}"]`;
  let tries = 0;
  const tick = () => {
    const el = document.querySelector<HTMLElement>(sel);
    if (el && el.offsetParent !== null) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("duo-task-flash");
      window.setTimeout(() => el.classList.remove("duo-task-flash"), 2800);
      // A row that opens on tap (a routine to start, a habit to tick) gets the keyboard's focus too.
      if (el.tabIndex >= 0 || /^(BUTTON|A|INPUT)$/.test(el.tagName)) el.focus({ preventScroll: true });
      return;
    }
    if (++tries < 60) window.setTimeout(tick, 100);
  };
  window.setTimeout(tick, 150);
}
