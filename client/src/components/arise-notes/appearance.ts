// Light / Dark / Auto for the Notes tab and the typing screen. Auto follows the phone (or computer), so
// dark mode just works; the choice is kept on this device, like Apple Notes does.
import { useEffect, useState } from "react";

export type Appearance = "auto" | "light" | "dark";
const KEY = "arise-notes-appearance";
const EVENT = "arise-notes-appearance";

export function getAppearance(): Appearance {
  try { const v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : "auto"; } catch { return "auto"; }
}
/** Has this device ever been given a choice? (Until then it is Auto.) */
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
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener("storage", on); mq?.removeEventListener?.("change", onSys); };
  }, []);
  return { mode, dark: mode === "dark" || (mode === "auto" && sys), set: setAppearance };
}
