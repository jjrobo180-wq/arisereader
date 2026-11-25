// The red dots' counts for this device (shared/pluginDots.ts): DailyDoneSync works them out next to the hub, and the
// menus and Health & Fitness's tabs read them.
import { useSyncExternalStore } from "react";

let dots: Record<string, number> = {};
const listeners = new Set<() => void>();
export function setPluginDots(next: Record<string, number>) {
  const a = JSON.stringify(dots), b = JSON.stringify(next);
  if (a === b) return;
  dots = next;
  listeners.forEach((l) => l());
}
export function usePluginDots(): Record<string, number> {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => dots, () => dots);
}
