// When the app was last put away at night and first opened in the morning, for Health & Fitness's
// sleep check-in (pages/fit/FitSleep.tsx, shared/fitSleep.ts morningGuess). Installed once for the
// whole app (main.tsx), so using any part of Arise To Do counts, not only when Sleep is open.
// Stays on this phone; nothing is sent anywhere.
import { phoneNight } from "@shared/fitSleep";

const KEY = "arise-fit-phone";
export type PhoneLog = {
  /** Last time the app went to the background. */ down?: number;
  /** Last night worked out from a long overnight gap. */ guess?: { bed: number; wake: number };
  /** The first time the app was used after 4 AM, by day ("2026-11-26"). */ firstUp?: { day: string; at: number };
};
const pad = (n: number) => String(n).padStart(2, "0");
const dayOf = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export const readPhone = (): PhoneLog => { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { return {}; } };
const writePhone = (p: PhoneLog) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* not kept */ } };

/** The first time the app was used this morning (after 4 AM today), or null. */
export const firstUpToday = (now = Date.now()): number | null => { const f = readPhone().firstUp; return f && f.day === dayOf(now) ? f.at : null; };

/** Notes the app going away ("down") or coming back ("up"). A long overnight gap becomes last night's guess. */
export function notePhone(state: "down" | "up", now = Date.now()) {
  const p = readPhone();
  if (state === "down") { writePhone({ ...p, down: now }); return; }
  const day = dayOf(now), h = new Date(now).getHours();
  const firstUp = h >= 4 && (!p.firstUp || p.firstUp.day !== day) ? { day, at: now } : p.firstUp;
  const g = p.down ? phoneNight(p.down, now) : null;
  writePhone({ ...p, down: undefined, guess: g ?? p.guess, firstUp });
}

let installed = false;
export function installPhoneUse() {
  if (installed || typeof document === "undefined") return;
  installed = true;
  notePhone("up");
  document.addEventListener("visibilitychange", () => notePhone(document.visibilityState === "hidden" ? "down" : "up"));
  window.addEventListener("pagehide", () => notePhone("down"));
}
