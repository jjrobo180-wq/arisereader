// Light / Dark / Auto for the Notes tab and the typing screen. New accounts start on Light; Auto follows the phone (or computer), so
// dark mode just works; the choice is kept on this device, like Apple Notes does.
import { useEffect, useState } from "react";

export type Appearance = "auto" | "light" | "dark";
const KEY = "arise-notes-appearance";
const EVENT = "arise-notes-appearance";

export function getAppearance(): Appearance {
  try { const v = localStorage.getItem(KEY); return v === "auto" || v === "dark" ? v : "light"; } catch { return "light"; }
}
/** Has this device ever been given a choice? (Until then it is Day, the light look, so new accounts never open dark.) */
export function hasAppearance(): boolean { try { return localStorage.getItem(KEY) !== null; } catch { return false; } }
export function setAppearance(v: Appearance) {
  try { localStorage.setItem(KEY, v); } catch { /* not kept */ }
  window.dispatchEvent(new Event(EVENT));
}
const systemDark = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;

/** The chosen setting and whether the screen should be dark right now. */
export function useAppearance(): { mode: Appearance; dark: boolean; set: (v: Appearance) => void } {
  const [mode, setMode] = useState<Appearance>(getAppearance);
  const [sys, setSys] = useState(systemDark);
  useEffect(() => {
    const on = () => setMode(getAppearance());
    window.addEventListener(EVENT, on);
    window.addEventListener("storage", on);
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSys = () => setSys(systemDark());
    mq?.addEventListener?.("change", onSys);
    // A phone that switches to Light at sunrise often doesn't tell an app that was asleep all night, so Auto
    // stayed dark in the morning. Look again whenever the app comes back, and once a minute while it is open.
    const onBack = () => { if (document.visibilityState !== "hidden") onSys(); };
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("focus", onBack);
    window.addEventListener("pageshow", onBack);
    const tick = window.setInterval(onBack, 60_000);
    onSys();
    return () => {
      window.removeEventListener(EVENT, on); window.removeEventListener("storage", on); mq?.removeEventListener?.("change", onSys);
      document.removeEventListener("visibilitychange", onBack); window.removeEventListener("focus", onBack); window.removeEventListener("pageshow", onBack); window.clearInterval(tick);
    };
  }, []);
  return { mode, dark: mode === "dark" || (mode === "auto" && sys), set: setAppearance };
}
