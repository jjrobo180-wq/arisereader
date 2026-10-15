// The Windows start screen's "back": while an app is open on top of Home, the phone's back button or
// edge swipe (and the on-screen Start button) return to Home instead of leaving the whole site.
import { useCallback, useEffect, useRef } from "react";

/** `away` is true while something other than Home is showing. `goHome` shows Home. Returns the function the Start button calls. */
export function useBackToStart(away: boolean, goHome: () => void): () => void {
  const home = useRef(goHome); home.current = goHome;
  const pushed = useRef(false);
  useEffect(() => {
    if (!away) return;
    // One history step stands for "the app on top of Home"; going back pops it and we land on Home.
    if (!pushed.current) { try { window.history.pushState(window.history.state, ""); pushed.current = true; } catch { /* no history: the Start button still works */ } }
    const onPop = () => { if (!pushed.current) return; pushed.current = false; home.current(); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [away]);
  // Home reached some other way (the drawer, a tile): forget the step so the next app pushes a fresh one.
  useEffect(() => { if (!away) pushed.current = false; }, [away]);
  return useCallback(() => {
    if (pushed.current) window.history.back(); // popstate then calls goHome
    else home.current();
  }, []);
}
