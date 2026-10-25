// What each side of the Arise To Duo split screen (/#/duo) shows, kept in one place so the split
// screen itself, Customize (on any phone, not only the Duo) and the Duo menu all read and change
// the same choice. Saved per device (localStorage); a change made in one place reaches the others
// at once — another frame or tab through the storage event, the same page through PICKS_EVENT.
import { useCallback, useEffect, useState } from "react";

export type PaneOption = { id: string; label: string; path: string; group: "LifeHub" | "WorkHub"; work?: boolean };
export type SplitPicks = { left: string; right: string };
export type SplitSide = "left" | "right";

const life = (id: string, label: string): PaneOption => ({ id, label, path: `/lifehub?pane=${id}`, group: "LifeHub" });

export const PANE_OPTIONS: PaneOption[] = [
  { id: "workhub", label: "WorkHub", path: "/workhub", group: "WorkHub", work: true },
  life("home", "LifeHub Home"),
  life("tasks", "To-Do list"),
  life("notes", "Notes"),
  life("calendar", "Calendar"),
  life("grocery", "Grocery list"),
  life("meals", "Meal planner"),
  life("chores", "Chores"),
  life("goals", "Goals"),
  life("habits", "Habits"),
  life("journal", "Journal"),
  life("money", "Money"),
  life("countdowns", "Countdowns"),
  life("lifeplan", "AI Reminders"),
  life("focus", "Focus timer"),
  life("browser", "Browser"),
];

export const SPLIT_KEY = "arise_duo_split_v1";
const PICKS_EVENT = "arise-duo-split-picks";

/** WorkHub can go in a pane for anyone who can open WorkHub. */
export const paneOptionsFor = (canWork: boolean) => PANE_OPTIONS.filter((o) => !o.work || canWork);

export function loadPicks(canWork: boolean): SplitPicks {
  const fallback = { left: "tasks", right: canWork ? "workhub" : "notes" };
  try {
    const saved = JSON.parse(localStorage.getItem(SPLIT_KEY) || "null");
    const ok = (id: unknown) => typeof id === "string" && paneOptionsFor(canWork).some((o) => o.id === id);
    if (saved && ok(saved.left) && ok(saved.right)) return { left: saved.left, right: saved.right };
  } catch { /* fresh start */ }
  return fallback;
}

export function savePicks(picks: SplitPicks): void {
  try { localStorage.setItem(SPLIT_KEY, JSON.stringify(picks)); } catch { /* not remembered */ }
  try { window.dispatchEvent(new CustomEvent(PICKS_EVENT, { detail: picks })); } catch { /* old browser */ }
}

/** The two picks, kept in step with every other place that shows or changes them. */
export function useSplitPicks(canWork: boolean): [SplitPicks, (next: SplitPicks | ((p: SplitPicks) => SplitPicks)) => void] {
  const [picks, setState] = useState<SplitPicks>(() => loadPicks(canWork));
  useEffect(() => {
    const reload = () => setState(loadPicks(canWork));
    const onStorage = (e: StorageEvent) => { if (e.key === SPLIT_KEY) reload(); };
    window.addEventListener(PICKS_EVENT, reload);
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(PICKS_EVENT, reload); window.removeEventListener("storage", onStorage); };
  }, [canWork]);
  const set = useCallback((next: SplitPicks | ((p: SplitPicks) => SplitPicks)) => {
    setState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      // Saved after this update settles, so the event's listeners (this hook included) read the new value.
      queueMicrotask(() => savePicks(value));
      return value;
    });
  }, []);
  return [picks, set];
}

export const paneLabel = (id: string) => PANE_OPTIONS.find((o) => o.id === id)?.label ?? id;
