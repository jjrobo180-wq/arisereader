// Full screen in WorkHub, LifeHub and FamilyHub: only the plugin that's open, without the top bar, the menu,
// the tab bar or the Add button. A class on <html> hides everything marked data-duo-chrome (index.css), so it
// works the same on a phone and a computer. On a computer the browser also goes truly full screen;
// leaving that (Esc) leaves full screen here too.
import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/nativeApp";

export const FOCUS_CLASS = "duo-focus";
const EVENT = "arise:focus-mode";
let viaBrowser = false;

export const inFocusMode = () => typeof document !== "undefined" && document.documentElement.classList.contains(FOCUS_CLASS);

export function setFocusMode(on: boolean): void {
  const root = document.documentElement;
  if (on === root.classList.contains(FOCUS_CLASS)) return;
  root.classList.toggle(FOCUS_CLASS, on);
  window.dispatchEvent(new Event(EVENT));
  window.scrollTo({ top: 0 });
  try {
    // Phones can't put a page in full screen (and the iPhone app already is): hiding the hub's own bars is it.
    const wide = window.matchMedia?.("(min-width: 1024px)").matches;
    if (on && wide && !isNativeApp() && document.fullscreenEnabled && !document.fullscreenElement) {
      viaBrowser = true;
      void root.requestFullscreen?.().catch(() => { viaBrowser = false; });
    } else if (!on && viaBrowser && document.fullscreenElement) {
      viaBrowser = false;
      void document.exitFullscreen?.().catch(() => {});
    }
  } catch { /* the hub's own full screen still works */ }
}

export function useFocusMode(): boolean {
  const [on, setOn] = useState(inFocusMode);
  useEffect(() => {
    const update = () => setOn(inFocusMode());
    // Esc out of the browser's full screen: out of ours too.
    const browser = () => { if (!document.fullscreenElement && viaBrowser) { viaBrowser = false; setFocusMode(false); } };
    window.addEventListener(EVENT, update);
    document.addEventListener("fullscreenchange", browser);
    return () => { window.removeEventListener(EVENT, update); document.removeEventListener("fullscreenchange", browser); };
  }, []);
  return on;
}
