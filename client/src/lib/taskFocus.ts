// A widget tap on one to-do: the Tasks list opens on it, scrolls it into the middle of the screen and lights it
// up for a moment (components/teacher-hub/HubTasks.tsx listens; both hubs use that list). If the list isn't on
// screen yet (the tap just switched to Tasks), it picks the request up when it appears.
let pending = "";
export const FOCUS_TASK_EVENT = "duo-focus-task";

/** Ask the Tasks list to show this to-do. */
export function focusTask(id: string): void {
  if (!id) return;
  pending = id;
  try { window.dispatchEvent(new CustomEvent(FOCUS_TASK_EVENT, { detail: id })); } catch { /* picked up on mount */ }
}
/** The to-do waiting to be shown (once). */
export function takePendingFocus(): string { const p = pending; pending = ""; return p; }

/** Scrolls to the to-do's row once it's drawn (waits up to about 5 seconds) and lights it up. */
export function scrollToTask(id: string): void {
  if (!id || typeof document === "undefined") return;
  let tries = 0;
  const sel = `[data-task-id="${typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id.replace(/"/g, "")}"]`;
  const tick = () => {
    const el = document.querySelector<HTMLElement>(sel);
    if (el && el.offsetParent !== null) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("duo-task-flash");
      window.setTimeout(() => el.classList.remove("duo-task-flash"), 2800);
      return;
    }
    if (++tries < 50) window.setTimeout(tick, 100);
  };
  window.setTimeout(tick, 120);
}
