// Arise LifeHub · Sleep: small hooks that connect the sound machine, the narrator and the
// screen to React.
import { useEffect, useState, useSyncExternalStore } from "react";
import { sleepSounds } from "./soundEngine";
import { narrator } from "./narrator";

export const useSounds = () => useSyncExternalStore(sleepSounds.subscribe, sleepSounds.getSnapshot, sleepSounds.getSnapshot);
export const useNarrator = () => useSyncExternalStore(narrator.subscribe, narrator.getSnapshot, narrator.getSnapshot);

/** Keeps the screen from locking while something is playing. iPhones stop web audio when the
 *  screen locks, so the app keeps the screen on (and dark, with Lights out) instead. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null, gone = false;
    const get = async () => {
      try { const next = await navigator.wakeLock.request("screen"); if (gone) void next.release(); else lock = next; } catch { /* not allowed right now */ }
    };
    void get();
    const back = () => { if (document.visibilityState === "visible" && !gone) void get(); };
    document.addEventListener("visibilitychange", back);
    return () => { gone = true; document.removeEventListener("visibilitychange", back); void lock?.release().catch(() => {}); };
  }, [active]);
}

/** Minutes left on the sleep timer, updated every 15 seconds. */
export function useMinutesLeft(endsAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [endsAt]);
  return endsAt ? Math.max(0, Math.ceil((endsAt - now) / 60000)) : null;
}

/** True after 10 p.m. and before 5 a.m.: the app turns itself down a notch. */
export function useLateNight() {
  const check = () => { const h = new Date().getHours(); return h >= 22 || h < 5; };
  const [late, setLate] = useState(check);
  useEffect(() => { const t = setInterval(() => setLate(check()), 60000); return () => clearInterval(t); }, []);
  return late;
}

/** The user asked the system to cut down on motion. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const m = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!m) return;
    const on = () => setReduced(m.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduced;
}
