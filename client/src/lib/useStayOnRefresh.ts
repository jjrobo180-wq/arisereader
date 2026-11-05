// Refreshing a hub keeps you exactly where you were: the open app, admin page, student, to-do or
// note. Kept in sessionStorage, so it lasts through a refresh of this tab but a new tab or a fresh
// sign-in starts clean. Works like useState.
import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

// Each pane of the split screen (/duo) is a frame named "duo-pane-left" / "duo-pane-right" and
// remembers its own place, so the two panes don't open each other's apps after a refresh.
const PREFIX = "arise-stay:" + (typeof window !== "undefined" && /^duo-pane-/.test(window.name || "") ? `${window.name}:` : "");

// In the iPhone apps iOS closes an app in the background and clears session storage with it, so there the
// place is kept on the phone for 12 hours instead (and a stale one is dropped).
const NATIVE = typeof window !== "undefined" && window.location.protocol === "capacitor:";
const KEEP_MS = 12 * 3600_000;
const store = (): Storage => (NATIVE ? localStorage : sessionStorage);
function readRaw(key: string): string | null {
  const raw = store().getItem(PREFIX + key);
  if (!NATIVE || raw === null) return raw;
  try { const w = JSON.parse(raw) as { t?: number; v?: unknown }; return w && typeof w.t === "number" && Date.now() - w.t < KEEP_MS ? JSON.stringify(w.v) : null; } catch { return null; }
}

function readStay<T>(key: string, initial: T): T {
  try {
    const raw = readRaw(key);
    if (raw === null) return initial;
    const v = JSON.parse(raw) as unknown;
    return v === null || typeof v === typeof initial || initial === null ? (v as T) : initial;
  } catch { return initial; }
}

export function useStayOnRefresh<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readStay(key, initial));
  const set = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    setValue((prev) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try {
        if (v === initial || v === null || v === undefined) store().removeItem(PREFIX + key);
        else store().setItem(PREFIX + key, NATIVE ? JSON.stringify({ t: Date.now(), v }) : JSON.stringify(v));
      } catch { /* just not remembered */ }
      return v;
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return [value, set];
}

/** Forgets every remembered place (on sign-out, so the next person starts on Home). */
export function forgetStay(): void {
  try { for (const k of Object.keys(store())) if (k.startsWith(PREFIX)) store().removeItem(k); localStorage.removeItem("arise-last-hash"); } catch { /* fine */ }
}
