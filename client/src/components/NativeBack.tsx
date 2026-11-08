// Going back in the two A.R.I.S.E. Reader iPhone apps. An app has no browser back button, so every
// screen past the home screen gets one (top left, under the status bar), and a swipe in from the left
// edge goes back too, the way iPhone apps do. With nothing to go back to, it opens the home screen.
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { isReaderApp, nativeFlavor } from "@/lib/nativeApp";

/** Screens that are a home of their own (or sign-in): no back button there. */
const HOMES = ["/", "/library", "/reader", "/eye-gaze-home", "/eye-gaze-parent", "/signin", "/register", "/teacher-signup", "/parent-signup", "/reset-password"];
export const isHomeScreen = (path: string) => HOMES.includes(path.split("?")[0].replace(/\/+$/, "") || "/");

export default function NativeBack() {
  const [path, navigate] = useLocation();
  const trail = useRef<string[]>([]);
  const start = useRef<{ x: number; y: number } | null>(null);
  const flavor = nativeFlavor();
  const home = flavor === "educator" ? "/reader" : flavor === "eyegaze" ? "/eye-gaze-home" : "/library";
  const [ownBack, setOwnBack] = useState(false);
  // Arise Eye Gazer: every screen has its own big Home or Back, chosen by looking at it, so no floating
  // button goes over it (it used to sit on top of the screen's own one).
  const floating = flavor !== "eyegaze";
  const show = isReaderApp() && !isHomeScreen(path);

  // Many screens already have their own Back at the top (the book, the quiz): then this one stays
  // out of the way (the edge swipe still works).
  useEffect(() => {
    if (!show) return;
    const look = () => setOwnBack(hasOwnBack());
    look();
    const t = window.setInterval(look, 700);
    return () => window.clearInterval(t);
  }, [show, path]);

  // The screens visited since the last home screen, so Back goes to the one before and never leaves
  // the app (with nothing behind it, it opens the home screen). Coming back to a screen already on the
  // trail cuts the trail there, so going round in a circle never makes Back go round it again.
  useEffect(() => {
    if (isHomeScreen(path)) { trail.current = [path]; return; }
    const t = trail.current, at = t.indexOf(path);
    if (at >= 0) trail.current = t.slice(0, at + 1);
    else t.push(path);
  }, [path]);
  // Back goes to the screen before by name (replacing this one), never the browser's history, which
  // the screens' own Home buttons add to: that's what sent people back and forth in a loop.
  const back = () => {
    const t = trail.current;
    if (t.length > 1) { t.pop(); navigate(t[t.length - 1], { replace: true }); }
    else { trail.current = [home]; navigate(home, { replace: true }); }
  };

  // Swipe in from the left edge.
  useEffect(() => {
    if (!show) return;
    const down = (e: TouchEvent) => { const t = e.touches[0]; start.current = t && t.clientX < 24 ? { x: t.clientX, y: t.clientY } : null; };
    const up = (e: TouchEvent) => {
      const s = start.current; start.current = null;
      const t = e.changedTouches[0];
      if (s && t && t.clientX - s.x > 80 && Math.abs(t.clientY - s.y) < 60) back();
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchend", up, { passive: true });
    return () => { window.removeEventListener("touchstart", down); window.removeEventListener("touchend", up); };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show || ownBack || !floating) return null;
  return <button type="button" onClick={back} aria-label="Back" data-testid="native-back"
    className="fixed left-2 z-[600] inline-flex h-10 items-center gap-0.5 rounded-full bg-white/95 pl-2 pr-3.5 text-[15px] font-semibold text-[#5b4fe0] shadow-[0_4px_14px_rgba(20,15,60,.18)] ring-1 ring-black/[.06] backdrop-blur active:scale-95"
    style={{ top: "calc(env(safe-area-inset-top, 0px) + 6px)" }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
    Back
  </button>;
}

/** A Back the screen shows itself, near the top and visible (not this component's own button). */
function hasOwnBack(): boolean {
  const els = document.querySelectorAll<HTMLElement>('button, a, [role="button"]');
  for (const el of Array.from(els)) {
    if (el.dataset.testid === "native-back") continue;
    const label = `${el.getAttribute("aria-label") || ""} ${el.textContent || ""}`.trim();
    // "Back", "Back to games", or a screen's own "Home" at the top (where this button would go).
    if (!/^(back|go back|← ?back|back to\b|home\b)/i.test(label) && !/\b(back|home)\b/i.test(el.getAttribute("aria-label") || "")) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.top < 140 && r.bottom > 0 && getComputedStyle(el).visibility !== "hidden") return true;
  }
  return false;
}
