// Arise To Duo: Arise To Duo laid out for the iPhone Duo's folding inner screen.
//
// The Duo's inner screen is 7.6" (1878 x 2670 px, about 626 x 890 points). Opened flat like a book
// it is 890 wide x 626 tall with the fold straight down the middle, so To-Do splits into two panes
// that meet at the fold ("book"). Turned the other way (626 x 890, fold across the middle) it gets
// one roomy column ("stack"). The 5.4" outer screen is an ordinary phone and keeps the phone layout.
//
// How we tell: the CSS viewport-segments media queries when the browser reports the fold, otherwise
// the screen's size and shape (a touch screen whose short side is 560-780 points and long side
// 780-1000, so no iPad). Customize > "Arise To Duo" can force it on or off, and ?duo=1 / ?duo=0 does the same
// for testing on a computer.
//
// The mode is written to <html data-duo="book|stack">, which the duo-book: / duo-stack: / duo:
// Tailwind variants (tailwind.config.ts) key off, and the page is named "Arise To Duo".
import { useEffect, useState } from "react";

export type DuoMode = "book" | "stack" | null;
export type DuoChoice = "auto" | "on" | "off";
export const DUO_KEY = "arise_to_duo_choice";

const mq = (q: string) => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(q).matches;

function readChoice(): DuoChoice {
  try {
    const params = new URLSearchParams(window.location.search || window.location.hash.split("?")[1] || "");
    const fromUrl = params.get("duo");
    if (fromUrl === "1" || fromUrl === "on") { localStorage.setItem(DUO_KEY, "on"); return "on"; }
    if (fromUrl === "0" || fromUrl === "off") { localStorage.setItem(DUO_KEY, "off"); return "off"; }
    const saved = localStorage.getItem(DUO_KEY);
    if (saved === "on" || saved === "off") return saved;
  } catch { /* private window or blocked storage */ }
  return "auto";
}

/** True inside one of the two panes of the split screen (/duo). A pane is phone-size, so it keeps
 *  the ordinary phone layout, and it remembers its own place apart from the other pane. */
export function inDuoPane(): boolean {
  try { return window.self !== window.top && window.name.startsWith("duo-pane-"); } catch { return false; }
}

/** Which way the split screen divides right now: side by side ("book") or one above the other. */
export function splitDirection(): "book" | "stack" {
  if (mq("(horizontal-viewport-segments: 2)")) return "book";
  if (mq("(vertical-viewport-segments: 2)")) return "stack";
  return window.innerWidth >= window.innerHeight ? "book" : "stack";
}

/** Is this the Duo's inner screen (or another book-size foldable opened up)? */
export function looksLikeDuoInner(): boolean {
  if (typeof window === "undefined") return false;
  if (mq("(horizontal-viewport-segments: 2)") || mq("(vertical-viewport-segments: 2)")) return true;
  const sw = window.screen?.width || 0, sh = window.screen?.height || 0;
  const short = Math.min(sw, sh), long = Math.max(sw, sh);
  const touch = mq("(pointer: coarse)") || (navigator.maxTouchPoints || 0) > 0;
  // Book-size and book-shaped, but smaller than any iPad (iPad mini is 744 x 1133, a 9th-gen iPad 810 x 1080).
  const ratio = short ? long / short : 0;
  return touch && short >= 560 && short <= 780 && long >= 780 && long <= 1000 && ratio >= 1.05 && ratio <= 1.5;
}

function modeFor(choice: DuoChoice): DuoMode {
  if (choice === "off" || inDuoPane()) return null;
  if (choice === "auto" && !looksLikeDuoInner()) return null;
  // Side by side when the fold runs top to bottom (the usual open-book way); stacked otherwise.
  if (mq("(horizontal-viewport-segments: 2)")) return "book";
  if (mq("(vertical-viewport-segments: 2)")) return "stack";
  // Too narrow for two panes (e.g. "on" in a small window) falls back to the single roomy column.
  return window.innerWidth > window.innerHeight && window.innerWidth >= 720 ? "book" : "stack";
}

export function useAriseDuo() {
  const [choice, setChoiceState] = useState<DuoChoice>(() => (typeof window === "undefined" ? "auto" : readChoice()));
  const [mode, setMode] = useState<DuoMode>(() => (typeof window === "undefined" ? null : modeFor(choice)));

  useEffect(() => {
    const update = () => setMode(modeFor(choice));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const queries = ["(horizontal-viewport-segments: 2)", "(vertical-viewport-segments: 2)"].map((q) => window.matchMedia?.(q)).filter(Boolean) as MediaQueryList[];
    queries.forEach((q) => q.addEventListener?.("change", update));
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      queries.forEach((q) => q.removeEventListener?.("change", update));
    };
  }, [choice]);

  useEffect(() => {
    const root = document.documentElement;
    if (mode) root.dataset.duo = mode; else delete root.dataset.duo;
    return () => { delete root.dataset.duo; };
  }, [mode]);

  const setChoice = (next: DuoChoice) => {
    try { if (next === "auto") localStorage.removeItem(DUO_KEY); else localStorage.setItem(DUO_KEY, next); } catch { /* ignore */ }
    setChoiceState(next);
  };

  return { mode, choice, setChoice, isDuo: !!mode };
}
