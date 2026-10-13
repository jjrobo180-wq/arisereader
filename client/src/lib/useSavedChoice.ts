// A choice that stays put: a sort order, a view, a filter. Once picked it is remembered on this
// phone or computer and comes back every time the screen opens, until it is changed again.
import { useCallback, useState } from "react";

const PREFIX = "arise-choice:";

function read<T extends string>(key: string, fallback: T, allowed?: readonly T[]): T {
  try {
    const saved = localStorage.getItem(PREFIX + key);
    if (saved !== null && (!allowed || allowed.includes(saved as T))) return saved as T;
  } catch { /* storage blocked: use the default */ }
  return fallback;
}

/** Like useState for a string choice, but remembered. `allowed` keeps an old or mistyped value from coming back. */
export function useSavedChoice<T extends string>(key: string, fallback: T, allowed?: readonly T[]): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => read(key, fallback, allowed));
  const set = useCallback((next: T) => {
    setValue(next);
    try { localStorage.setItem(PREFIX + key, next); } catch { /* it just isn't remembered */ }
  }, [key]);
  return [value, set];
}
