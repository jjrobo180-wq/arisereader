import { useEffect, useState } from "react";

/**
 * Native-feeling navigation: the mobile app header slides away on deliberate
 * downward scrolling and returns when the user scrolls up. Scroll gestures
 * caused by the iOS keyboard must never hide navigation.
 *
 * The header stays in normal sticky layout (rather than position: fixed), so
 * pages do not jump when it animates.
 */
export function useAutoHideHeader(enabled = true): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
    if (!enabled || typeof window === "undefined") return;

    const phone = window.matchMedia("(max-width: 1023px)");
    let lastY = Math.max(0, window.scrollY);
    let travel = 0;

    const onScroll = () => {
      const y = Math.max(0, window.scrollY);
      const delta = y - lastY;
      lastY = y;

      // Input focus can scroll WKWebView without an actual user scroll.
      const editing = document.activeElement?.matches("input, textarea, select, [contenteditable], [role='textbox']");
      if (!phone.matches || y < 88 || editing) {
        travel = 0;
        setHidden(false);
        return;
      }
      if (Math.abs(delta) > window.innerHeight * 0.8) {
        // Programmatic navigation, browser restoration, or a large layout shift.
        travel = 0;
        setHidden(false);
        return;
      }
      travel = (Math.sign(travel) === Math.sign(delta) ? travel : 0) + delta;
      if (travel > 18) {
        setHidden(true);
        travel = 0;
      } else if (travel < -12) {
        setHidden(false);
        travel = 0;
      }
    };
    const onResize = () => {
      if (!phone.matches) setHidden(false);
      lastY = Math.max(0, window.scrollY);
      travel = 0;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, [enabled]);

  return hidden;
}
