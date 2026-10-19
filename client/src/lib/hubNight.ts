// Night mode for the pages you reach from a hub but that sit outside it (the Pro apps like Workout
// Builder, Office, AI Apps). They follow the hub's own night switch: LifeHub's (or, until it's
// been chosen, the device's dark setting) or WorkHub's. The colours are the hub's (todoNight.css).
import "@/pages/todoNight.css";

export function hubNightOn(): boolean {
  try {
    const life = localStorage.getItem("arise-todo-night");
    if (life === "1" || localStorage.getItem("arise-hub-night") === "1") return true;
    if (life === "0") return false;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  } catch { return false; }
}

/** The class a page's root takes so it matches the hub's night mode. */
export const hubNightClass = (): string => (hubNightOn() ? "todo-night" : "");
