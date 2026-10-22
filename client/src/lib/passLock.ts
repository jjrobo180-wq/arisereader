// Passcode lock in the browser (shared/passLock.ts has the saved part). Whether a hub is unlocked
// lives only in this page's memory: reloading the page, or leaving it unused for the chosen
// minutes, locks everything again. Nothing about being unlocked is saved anywhere.
import { useCallback, useEffect, useMemo, useState } from "react";
import { checkPasscode, isLocked, type PassLock } from "@shared/passLock";

type Hub = "life" | "work";
const lastUsed: Record<Hub, number> = { life: 0, work: 0 };
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((f) => f());

let watching = false;
function watch() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  const used = () => { const now = Date.now(); (Object.keys(lastUsed) as Hub[]).forEach((h) => { if (lastUsed[h]) lastUsed[h] = now; }); };
  window.addEventListener("pointerdown", used, true);
  window.addEventListener("keydown", used, true);
}

export type PassGate = {
  /** A passcode has been set. */
  has: boolean;
  lock: PassLock | undefined;
  /** Is this thing locked at all (whether or not it is open right now)? */
  locked: (id: string) => boolean;
  /** Locked and not unlocked right now: show the passcode screen instead. */
  needs: (id: string) => boolean;
  unlocked: boolean;
  unlock: (code: string) => Promise<boolean>;
  lockNow: () => void;
};

export function usePassLock(hub: Hub, lock: PassLock | undefined): PassGate {
  const [, setTick] = useState(0);
  useEffect(() => {
    watch();
    const f = () => setTick((t) => t + 1);
    listeners.add(f);
    const timer = window.setInterval(() => {
      if (lastUsed[hub] && lock && Date.now() - lastUsed[hub] > lock.minutes * 60_000) { lastUsed[hub] = 0; tell(); }
    }, 10_000);
    return () => { listeners.delete(f); window.clearInterval(timer); };
  }, [hub, lock]);
  const unlocked = !!lastUsed[hub] && !!lock && Date.now() - lastUsed[hub] <= lock.minutes * 60_000;
  const unlock = useCallback(async (code: string) => {
    if (!lock) return true;
    const ok = await checkPasscode(lock, code);
    if (ok) { lastUsed[hub] = Date.now(); tell(); }
    return ok;
  }, [hub, lock]);
  const lockNow = useCallback(() => { lastUsed[hub] = 0; tell(); }, [hub]);
  return useMemo(() => ({
    has: !!lock, lock, unlocked,
    locked: (id: string) => isLocked(lock, id),
    needs: (id: string) => isLocked(lock, id) && !unlocked,
    unlock, lockNow,
  }), [lock, unlocked, unlock, lockNow]);
}

/** Right after setting a new passcode the person who set it is let in. */
export function markUnlocked(hub: Hub) { lastUsed[hub] = Date.now(); tell(); }
