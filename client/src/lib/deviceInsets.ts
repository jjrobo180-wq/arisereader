// The space above the page on an iPhone (the clock, the notch or the Dynamic Island), from the phone's
// screen size. In the edge-to-edge iPhone apps the web view can report no safe area at the top
// (env(safe-area-inset-top) reads 0), so the apps kept a flat 44px: right for older notched phones,
// but on Dynamic Island iPhones the island reaches about 51px down and covered the top row (the
// notification bell's badge sat under it). The values are Apple's own top safe areas, in points.

/** "width x height" in portrait points → the top safe area. */
const TOP: Record<string, number> = {
  "440x956": 62, // iPhone 16 Pro Max, 17 Pro Max
  "402x874": 62, // iPhone 16 Pro, 17, 17 Pro
  "420x912": 62, // iPhone Air
  "430x932": 59, // iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus
  "393x852": 59, // iPhone 14 Pro, 15, 15 Pro, 16
  "428x926": 47, // iPhone 12 Pro Max, 13 Pro Max, 14 Plus
  "390x844": 47, // iPhone 12, 12 Pro, 13, 13 Pro, 14
  "375x812": 50, // iPhone X, XS, 11 Pro, 12 mini, 13 mini (the minis are 50, the rest 44)
  "414x896": 48, // iPhone XR, 11, XS Max, 11 Pro Max
  "375x667": 20, "414x736": 20, "320x568": 20, // iPhone SE and the ones with a Home button
};

/** The phone's top safe area in points, or null on screens this doesn't know (iPads, computers). */
export function deviceTopInset(screenW: number, screenH: number): number | null {
  const w = Math.round(Math.min(screenW, screenH)), h = Math.round(Math.max(screenW, screenH));
  if (!w || !h) return null;
  const known = TOP[`${w}x${h}`];
  if (known !== undefined) return known;
  // A phone that came out after this list: the tall ones all have a Dynamic Island.
  if (w < 500 && h / w > 2.1) return w >= 393 ? 62 : 50;
  return null;
}

/** Sets --sat-device on the page for the iPhone apps' clock space (todo-app.css, index.css, reader-app.css). `scale` is the page's zoom
 *  when it isn't 1 (Cooked lays its page out at 0.9, so a CSS pixel is bigger than a point). */
export function applyDeviceTopInset(scale = 1): void {
  if (typeof window === "undefined") return;
  const top = deviceTopInset(window.screen.width, window.screen.height);
  if (top === null) return;
  // Turned sideways the clock is gone (the island is at the side), so the top needs no room.
  const set = () => document.documentElement.style.setProperty("--sat-device", `${window.innerWidth > window.innerHeight ? 0 : Math.round((top / scale) * 10) / 10}px`);
  set();
  window.addEventListener("resize", set);
  window.addEventListener("orientationchange", set);
}

/** The phone's bottom safe area (the home bar) in points: 34 on every iPhone with no Home button, none on the ones that have one. */
export function deviceBottomInset(screenW: number, screenH: number): number | null {
  const top = deviceTopInset(screenW, screenH);
  if (top === null) return null;
  return top > 20 ? 34 : 0;
}

/** Sets --sab-device, the home bar's space, the same way applyDeviceTopInset sets the clock's. */
export function applyDeviceBottomInset(): void {
  if (typeof window === "undefined") return;
  const bottom = deviceBottomInset(window.screen.width, window.screen.height);
  if (bottom === null) return;
  const set = () => document.documentElement.style.setProperty("--sab-device", `${window.innerWidth > window.innerHeight ? Math.min(bottom, 21) : bottom}px`);
  set();
  window.addEventListener("resize", set);
  window.addEventListener("orientationchange", set);
}

/** An iPad's clock row and Home bar, in points: about 24 above and 20 below, in every orientation (an iPad keeps
 *  both when turned sideways). Null on phones, which have their own sizes above, and on small screens. */
export function tabletInsets(screenW: number, screenH: number): { top: number; bottom: number } | null {
  if (Math.min(screenW, screenH) < 600 || deviceTopInset(screenW, screenH) !== null) return null;
  return { top: 24, bottom: 20 };
}

/** Sets --sat-device and --sab-device on an iPad (the phone ones above leave them alone there). */
export function applyTabletInsets(): void {
  if (typeof window === "undefined") return;
  const t = tabletInsets(window.screen.width, window.screen.height);
  if (!t) return;
  document.documentElement.style.setProperty("--sat-device", `${t.top}px`);
  document.documentElement.style.setProperty("--sab-device", `${t.bottom}px`);
}

/** True when the web view fills the whole screen (contentInset "never"). Apps still on an older build, where iOS
 *  insets the page itself, are shorter than the screen, so they keep drawing the way they always have. */
export function drawsEdgeToEdge(): boolean {
  if (typeof window === "undefined") return false;
  const sw = window.screen.width, sh = window.screen.height;
  if (!sw || !sh) return false;
  const portrait = window.innerHeight >= window.innerWidth;
  const full = portrait ? Math.max(sw, sh) : Math.min(sw, sh);
  return window.innerHeight >= full - 8;
}
