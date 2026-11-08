// A safety net for every look: finds text (and icon buttons) whose color can't be seen on the color
// behind it (white on white, navy on black…) and switches that text to whichever of the look's ink,
// black or white reads best there. It only steps in when text is really unreadable (under 3:1), so
// a look's own muted greys and accents are left alone. Used by Arise Notes, To Duo and WorkHub.
import { useEffect } from "react";

type RGBA = [number, number, number, number];

const parse = (c: string): RGBA | null => {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map((x) => (x.endsWith("%") ? (parseFloat(x) / 100) * 255 : parseFloat(x)));
    return [p[0], p[1], p[2], p.length > 3 ? (m[1].includes("%") && p[3] > 1 ? p[3] / 255 : p[3]) : 1];
  }
  const h = c.match(/#([0-9a-f]{6})/i);
  if (h) return [parseInt(h[1].slice(0, 2), 16), parseInt(h[1].slice(2, 4), 16), parseInt(h[1].slice(4, 6), 16), 1];
  // color(srgb r g b / a), which browsers give for color-mix()
  const s = c.match(/color\(srgb ([^)]+)\)/);
  if (s) { const p = s[1].split(/[\s/]+/).filter(Boolean).map(parseFloat); return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1]; }
  return paint(c);
};
// Anything else (oklch, lab, named colors): let the browser paint one pixel and read it back.
let pen: CanvasRenderingContext2D | null | undefined;
const painted = new Map<string, RGBA | null>();
function paint(c: string): RGBA | null {
  if (!c || c === "transparent") return [0, 0, 0, 0];
  if (painted.has(c)) return painted.get(c)!;
  let out: RGBA | null = null;
  try {
    if (pen === undefined) { const cv = document.createElement("canvas"); cv.width = cv.height = 1; pen = cv.getContext("2d", { willReadFrequently: true }); }
    if (pen) { pen.clearRect(0, 0, 1, 1); pen.fillStyle = "#000"; pen.fillStyle = c; pen.fillRect(0, 0, 1, 1); const d = pen.getImageData(0, 0, 1, 1).data; out = [d[0], d[1], d[2], d[3] / 255]; }
  } catch { out = null; }
  painted.set(c, out);
  return out;
}
/** Every color named in a background image (gradients), so the worst one can be checked. */
const colorsIn = (img: string): RGBA[] => (img.match(/(?:rgba?|oklch|oklab|lab|lch|hsla?|color)\([^)]+\)|#[0-9a-f]{6}/gi) ?? []).map(parse).filter((x): x is RGBA => !!x);
const over = (top: RGBA, under: RGBA): RGBA => {
  const a = top[3] + under[3] * (1 - top[3]);
  if (a === 0) return [0, 0, 0, 0];
  return [0, 1, 2].map((i) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a).concat(a) as RGBA;
};
const lum = (c: RGBA) => { const v = c.slice(0, 3).map((x) => x / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
export const ratio = (a: RGBA, b: RGBA) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const css = (c: RGBA) => `rgb(${c.slice(0, 3).map(Math.round).join(",")})`;

/** The colors behind an element: one, or several when it sits on a gradient. Null when it sits on a picture. */
export function backdropOf(el: Element, cache = new Map<Element, RGBA[] | null>(), page: RGBA = [255, 255, 255, 1]): RGBA[] | null {
  if (cache.has(el)) return cache.get(el)!;
  const s = getComputedStyle(el);
  const color = parse(s.backgroundColor) ?? [0, 0, 0, 0];
  const img = s.backgroundImage;
  let out: RGBA[] | null;
  if (img !== "none" && !/gradient/.test(img)) out = null;
  else {
    const base = color[3] >= 0.99 && img === "none" ? [color] : el.parentElement ? backdropOf(el.parentElement, cache, page) : [page];
    if (!base) out = null;
    else {
      const under = base.map((l) => over(color, l));
      const g = img === "none" ? [] : colorsIn(img);
      out = g.length ? g.flatMap((c) => under.map((l) => over(c, l))) : under;
      if (out.length > 8) out = out.filter((_, i) => i % Math.ceil(out!.length / 8) === 0);
      out = out.map((l) => (l[3] < 1 ? over(l, page) : l));
    }
  }
  cache.set(el, out);
  return out;
}

export type Finding = { el: HTMLElement; text: string; fg: string; bg: string; ratio: number };

let onScreenOnly = false;
const visible = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  // While the page is live, only what's on screen (and a screen either side) is checked: the rest is checked
  // when it scrolls in. Checking every element of a long hub with its styles stalled the phone.
  if (onScreenOnly && (r.bottom < -window.innerHeight || r.top > window.innerHeight * 2)) return false;
  const s = getComputedStyle(el);
  return s.visibility !== "hidden" && s.display !== "none" && parseFloat(s.opacity) > 0.05;
};
const blendCache = new WeakMap<Element, boolean>();
const blended = (el: Element): boolean => {
  if (blendCache.has(el)) return blendCache.get(el)!;
  const own = getComputedStyle(el).mixBlendMode !== "normal";
  const out = own || (el.parentElement ? blended(el.parentElement) : false);
  blendCache.set(el, out);
  return out;
};
/** Elements that show words or an icon on their own. */
function targets(root: Element): HTMLElement[] {
  const out = new Set<HTMLElement>();
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let t = walk.nextNode(); t; t = walk.nextNode()) {
    const p = t.parentElement;
    if (p && t.nodeValue && t.nodeValue.trim() && !p.closest("svg,script,style,[data-cg-skip]")) out.add(p);
  }
  root.querySelectorAll<HTMLElement>("button,a,[role=button]").forEach((b) => { if (!b.textContent?.trim() && b.querySelector("svg") && !b.closest("[data-cg-skip]")) out.add(b); });
  root.querySelectorAll<HTMLElement>("input:not([type=checkbox]):not([type=radio]):not([type=range]),textarea").forEach((i) => out.add(i));
  return [...out];
}

/** Text that can't be read (below `min`), with what it was on. */
export function findUnreadable(root: Element = document.body, min = 3, page?: RGBA): Finding[] {
  const cache = new Map<Element, RGBA[] | null>();
  const found: Finding[] = [];
  for (const el of targets(root)) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    // Words painted with a picture or blended with what is behind them can't be judged by their color.
    if (/text/.test(s.backgroundClip || (s as unknown as Record<string, string>).webkitBackgroundClip || "") || blended(el)) continue;
    const fill = (s as unknown as Record<string, string>).webkitTextFillColor;
    const fg0 = parse(fill && fill !== s.color && !/currentcolor/i.test(fill) ? fill : s.color); if (!fg0) continue;
    if (fg0[3] < 0.05) continue;
    const bgs = backdropOf(el, cache, page); if (!bgs) continue;
    let worst = Infinity, wbg = bgs[0];
    for (const b of bgs) { const fg = fg0[3] < 1 ? over(fg0, b) : fg0; const r = ratio(fg, b); if (r < worst) { worst = r; wbg = b; } }
    if (worst < min) found.push({ el, text: (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 40), fg: css(fg0), bg: css(wbg), ratio: Math.round(worst * 100) / 100 });
  }
  return found;
}

/** Switches unreadable text to the first of `inks` (then black, then white) that reads well on what is behind it. */
export function repair(root: Element = document.body, inks: string[] = []): number {
  const choices = [...inks, "#111111", "#ffffff"].map(parse).filter((x): x is RGBA => !!x);
  const cache = new Map<Element, RGBA[] | null>();
  let n = 0;
  for (const f of findUnreadable(root)) {
    const bgs = backdropOf(f.el, cache) ?? [];
    if (!bgs.length) continue;
    const scored = choices.map((c) => ({ c, r: Math.min(...bgs.map((b) => ratio(c, b))) }));
    const pick = scored.find((x) => x.r >= 4.5) ?? scored.reduce((m, x) => (x.r > m.r ? x : m));
    f.el.style.setProperty("color", css(pick.c), "important");
    f.el.setAttribute("data-cg", "1");
    n++;
  }
  return n;
}
/** Takes back every color this guard set (before a look changes). */
export function clearRepairs(root: Element = document.body) {
  root.querySelectorAll<HTMLElement>("[data-cg]").forEach((el) => { el.style.removeProperty("color"); el.removeAttribute("data-cg"); });
}

/** Keeps the page readable while it is on screen: checks after changes, but never while the page is scrolling,
 *  at most every couple of seconds, in the phone's idle time, and only what's on screen. (It used to check the
 *  whole page 180ms after any change, including the header hiding as you scroll, so scrolling froze.) */
export function useContrastGuard(enabled: boolean, key: string, inks: string[] = []) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined" || typeof MutationObserver === "undefined") return;
    let timer = 0, busy = false, lastRun = 0, lastScroll = 0, idle = 0;
    const ric = (window as any).requestIdleCallback as ((f: () => void, o?: { timeout: number }) => number) | undefined;
    const run = () => {
      timer = 0;
      const now = Date.now();
      // Still scrolling, or ran a moment ago: come back later.
      if (now - lastScroll < 450 || now - lastRun < 2000) { timer = window.setTimeout(run, Math.max(450 - (now - lastScroll), 2000 - (now - lastRun), 100)); return; }
      const go = () => {
        idle = 0; busy = true; lastRun = Date.now();
        onScreenOnly = true;
        try { repair(document.body, inks); } catch { /* never break the page over a color */ }
        onScreenOnly = false;
        // Our own style changes would wake the observer again; let them pass first.
        setTimeout(() => { busy = false; }, 0);
      };
      if (ric) idle = ric(go, { timeout: 1500 }); else go();
    };
    const soon = () => { if (!busy && !timer) timer = window.setTimeout(run, 400); };
    const scrolled = () => { lastScroll = Date.now(); soon(); };
    clearRepairs();
    const mo = new MutationObserver(soon);
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class", "aria-pressed", "aria-current", "aria-selected", "data-on", "open"] });
    window.addEventListener("scroll", scrolled, { passive: true, capture: true });
    soon();
    // Fonts and pictures can arrive late; one more look after things settle.
    const late = window.setTimeout(soon, 2500);
    return () => {
      mo.disconnect(); window.removeEventListener("scroll", scrolled, { capture: true } as EventListenerOptions);
      if (timer) clearTimeout(timer); clearTimeout(late);
      if (idle && (window as any).cancelIdleCallback) (window as any).cancelIdleCallback(idle);
      clearRepairs();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, key]);
}
