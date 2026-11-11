// Asking Arise Undercover's AI (server/undercover.ts): used by the Undercover app and inside Arise Notes
// (a note's "Ask AI" bar, and Ask with "Anything"). Sends the time zone, and for weather questions with
// no city the phone's location.
import { API_BASE, apiAuthToken } from "@/lib/queryClient";
import { wantsWeather, weatherPlaceFrom, type UndercoverMsg, type UndercoverTheme } from "@shared/undercover";

/** The phone's location, only for a weather question with no city named or saved (4 seconds at most). */
const here = (): Promise<{ lat: number; lon: number } | null> => new Promise((done) => {
  if (!navigator.geolocation) return done(null);
  const t = setTimeout(() => done(null), 4000);
  navigator.geolocation.getCurrentPosition((p) => { clearTimeout(t); done({ lat: p.coords.latitude, lon: p.coords.longitude }); }, () => { clearTimeout(t); done(null); }, { maximumAge: 30 * 60_000, timeout: 4000 });
});

export async function askAi(theme: UndercoverTheme, messages: UndercoverMsg[], prefs: { city: string; unit: "F" | "C"; context?: string }): Promise<string> {
  const token = apiAuthToken();
  const q = messages[messages.length - 1]?.content || "";
  const coords = wantsWeather(q) && !prefs.city && !weatherPlaceFrom(q) ? await here() : null;
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; } })();
  const res = await fetch(`${API_BASE}/api/undercover/chat`, {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ theme, messages, tz, place: prefs.city, unit: prefs.unit, ...(prefs.context ? { context: prefs.context.slice(0, 8000) } : {}), ...(coords || {}) }),
  }).catch(() => null);
  if (!res) throw new Error("You seem to be offline.");
  const d = await res.json().catch(() => null);
  if (!res.ok) throw new Error(d?.message || "Couldn't get an answer. Try again.");
  return String(d?.reply || "");
}


/** The city and °F/°C saved in Undercover's settings, for asks made elsewhere (Arise Notes). */
export function undercoverPrefs(): { city: string; unit: "F" | "C" } {
  try { const s = JSON.parse(localStorage.getItem("arise-undercover-v1") || "null"); return { city: String(s?.city || ""), unit: s?.unit === "C" ? "C" : "F" }; } catch { return { city: "", unit: "F" }; }
}
