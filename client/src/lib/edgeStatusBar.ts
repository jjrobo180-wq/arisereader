// Arise AAC draws edge to edge (index.css, html.eyegaze-edge), so the clock, signal and battery sit on top of
// whatever the page shows there. On a dark screen (Shorts, the games) they have to be white; on a light one,
// dark. This reads the colour at the top middle of the screen and sets the status bar to match
// (@capacitor/status-bar, eyegazer/ios-app/package.json). Copies of the app from before that plugin was
// added just ignore the call.
import { useEffect } from "react";
import { isNativeApp, nativeCall } from "@/lib/nativeApp";
import { cssColorToHex, isDarkHex } from "@/lib/nativeBackdrop";

const FIRST_COLOR = /rgba?\(\s*\d+[,\s]+\d+[,\s]+\d+(?:[,\s/]+[\d.]+)?\s*\)/;

/** The first solid colour of an element's own paint: its background colour, else the first colour of its gradient. */
function paintOf(el: Element): string | null {
  const style = getComputedStyle(el);
  return cssColorToHex(style.backgroundColor) || (style.backgroundImage !== "none" ? cssColorToHex(FIRST_COLOR.exec(style.backgroundImage)?.[0] || "") : null);
}

/** The colour showing at the top middle of the screen right now (white under the white strip that holds
 *  the clock on every page that is not an edge screen). */
export function topColorHex(): string {
  const html = document.documentElement;
  if (!html.classList.contains("edge-screen")) return "#ffffff";
  for (const el of document.elementsFromPoint(Math.round(window.innerWidth / 2), 3)) {
    const hex = paintOf(el);
    if (hex) return hex;
  }
  return paintOf(document.body) || "#ffffff";
}

let lastDark: boolean | null = null;

/** Sets the status bar text white on a dark top and dark on a light one. Repeats are skipped. */
export function syncEdgeStatusBar(): void {
  if (!isNativeApp() || !document.documentElement.classList.contains("eyegaze-edge")) return;
  const dark = isDarkHex(topColorHex());
  if (dark === lastDark) return;
  lastDark = dark;
  // "DARK" is Capacitor's name for the style made for dark backgrounds (white text).
  void nativeCall(/statusbar/i, "StatusBar", "setStyle", { style: dark ? "DARK" : "LIGHT" }).catch(() => { lastDark = null; });
}

/** Keeps the status bar matched as screens change: after every route change, and whenever the page's
 *  classes, styles or elements change (a game moving to its next screen), at most four times a second. */
export function useEdgeStatusBar(routeKey: string): void {
  useEffect(() => {
    if (!isNativeApp() || !document.documentElement.classList.contains("eyegaze-edge")) return;
    let timer = 0;
    const queue = () => { if (!timer) timer = window.setTimeout(() => { timer = 0; syncEdgeStatusBar(); }, 250); };
    const watch = new MutationObserver(queue);
    watch.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style"] });
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    queue();
    return () => { watch.disconnect(); window.clearTimeout(timer); };
  }, [routeKey]);
}
