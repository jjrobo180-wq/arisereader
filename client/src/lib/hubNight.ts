// Night mode for the pages you reach from a hub but that sit outside it (the Pro apps like Workout
// Builder, Office, AI Apps). They follow the hub's own night switch, LifeHub's or WorkHub's, and
// start in day mode until someone switches night mode on. The colours are the hub's (todoNight.css).
import "@/pages/todoNight.css";

export function hubNightOn(): boolean {
  try {
    return localStorage.getItem("arise-todo-night") === "1" || localStorage.getItem("arise-hub-night") === "1";
  } catch { return false; }
}

/** The class a page's root takes so it matches the hub's night mode. */
export const hubNightClass = (): string => (hubNightOn() ? "todo-night" : "");
