// The iPhone app's strips above and below the page (behind the clock and the Home indicator) are drawn by
// the app itself, not the page (arise-widgets' setBackdrop). They must match whatever the hub looks like
// right now, in day, night and every theme, or the app shows a pale band on a dark hub. This reads the
// hub's real background color off the page and sends it, along with light or dark status bar text.
import { useEffect, type RefObject } from "react";
import { isNativeApp, nativeCall } from "@/lib/nativeApp";

export const BACKDROP_REFRESH = "arise-backdrop:refresh";

/** "rgb(20, 18, 31)" or "rgba(...)" → "#14121f", or null when it's see-through. */
export function cssColorToHex(css: string): string | null {
  const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(css || "");
  if (!m) return null;
  if (m[4] !== undefined && Number(m[4]) < 0.5) return null;
  return "#" + [m[1], m[2], m[3]].map((n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, "0")).join("");
}

/** True for a dark color (white status bar text reads on it). */
export function isDarkHex(hex: string): boolean {
  const v = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
}

let last = "";
/** Paints the strips (and sets the status bar text) to `hex`. Repeats are skipped. */
export function sendBackdrop(hex: string): void {
  if (!isNativeApp() || !/^#[0-9a-f]{6}$/i.test(hex) || hex === last) return;
  last = hex;
  void nativeCall(/arisewidgets/i, "AriseWidgets", "setBackdrop", { color: hex }).catch(() => { last = ""; });
  // "DARK" is Capacitor's name for the style made for dark backgrounds (white text).
  void nativeCall(/statusbar/i, "StatusBar", "setStyle", { style: isDarkHex(hex) ? "DARK" : "LIGHT" }).catch(() => {});
}

/** The first solid background going up from `el`, falling back to the page's. */
function solidBackground(el: Element | null): string | null {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const hex = cssColorToHex(getComputedStyle(node).backgroundColor);
    if (hex) return hex;
  }
  return cssColorToHex(getComputedStyle(document.body).backgroundColor) || cssColorToHex(getComputedStyle(document.documentElement).backgroundColor);
}

/** Keeps the strips matched to the hub root `ref`: on mount, whenever `deps` change (night, theme),
 *  when the root's classes or style change, and when something asks (BACKDROP_REFRESH). The page's own
 *  html/body take the same color too, so a bounce past the top or bottom never flashes white. */
export function useNativeBackdrop(ref: RefObject<HTMLElement | null>, deps: unknown[]): void {
  useEffect(() => {
    const html = document.documentElement, body = document.body;
    const before = [html.style.backgroundColor, body.style.backgroundColor];
    // No rubber-band past the page edge, so no strip of another colour shows when you scroll.
    const bounce = html.style.overscrollBehaviorY;
    // The viewport is never touched here. Arise To Duo's "a touch smaller" scale is set once at start, locked
    // (main.tsx): changing it each time the hub opened, while main.tsx put it back to 100% whenever the screen
    // changed size (the keyboard coming up counts), made the page jump in every time a text box was tapped.
    html.style.overscrollBehaviorY = "none";
    let watched: HTMLElement | null = null;
    const watch = new MutationObserver(() => apply());
    function apply() {
      const el = ref.current;
      if (!el) return; // still loading: the next tick tries again
      if (el !== watched) { watch.disconnect(); watch.observe(el, { attributes: true, attributeFilter: ["class", "style"] }); watched = el; }
      // A full-screen light page (the first-run setup) holds the strips itself.
      if (document.querySelector("[data-backdrop-hold]")) return;
      const hex = solidBackground(el);
      if (!hex) return;
      if (hex === shown) return;
      shown = hex;
      html.style.backgroundColor = hex;
      body.style.backgroundColor = hex;
      sendBackdrop(hex);
    }
    let shown = "";
    const raf = requestAnimationFrame(apply);
    // Catches the hub appearing after loading, and theme styles or fonts settling — only for the first
    // few seconds. Checking every second forever made the phone re-work the page's styles each second
    // (a small stutter while scrolling or typing); after that, a change of class or style on the hub
    // and BACKDROP_REFRESH are what bring it up to date.
    let ticks = 0;
    const tick = window.setInterval(() => { apply(); if (++ticks >= 6 && ref.current) window.clearInterval(tick); }, 1000);
    // Something else painted the strips (a full-screen setup page, a look): paint them again.
    const refresh = () => { shown = ""; apply(); };
    window.addEventListener(BACKDROP_REFRESH, refresh);
    return () => {
      cancelAnimationFrame(raf); window.clearInterval(tick); watch.disconnect();
      window.removeEventListener(BACKDROP_REFRESH, refresh);
      html.style.overscrollBehaviorY = bounce;
      html.style.backgroundColor = before[0]; body.style.backgroundColor = before[1];
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
