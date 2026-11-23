// Ask AI in Arise Notes and Arise To Duo (server/undercover.ts, /api/ask/chat): a plain AI assistant that
// says what it is. Sends the time zone, and for a weather question with no city, the phone's location.
// (Arise Undercover's own app asks through client/src/undercover/askUndercover.ts instead.)
import { API_BASE, apiAuthToken } from "@/lib/queryClient";
import { wantsWeather, weatherPlaceFrom } from "@shared/askText";
export { answerLines } from "@shared/askText";

export type AskMsg = { role: "user" | "assistant"; content: string };

/** The phone's location, only for a weather question with no city named or saved (4 seconds at most). */
const here = (): Promise<{ lat: number; lon: number } | null> => new Promise((done) => {
  if (!navigator.geolocation) return done(null);
  const t = setTimeout(() => done(null), 4000);
  navigator.geolocation.getCurrentPosition((p) => { clearTimeout(t); done({ lat: p.coords.latitude, lon: p.coords.longitude }); }, () => { clearTimeout(t); done(null); }, { maximumAge: 30 * 60_000, timeout: 4000 });
});

/** Inside Arise Notes: looks the question up in the person's own notes (null outside Notes, or when it finds nothing). */
let notesLookup: ((question: string) => Promise<string | null>) | null = null;
export function setNotesLookup(fn: ((question: string) => Promise<string | null>) | null) { notesLookup = fn; }

/** The city and °F/°C saved for weather answers. */
export function askPrefs(): { city: string; unit: "F" | "C" } {
  try { const s = JSON.parse(localStorage.getItem("arise-undercover-v1") || "null"); return { city: String(s?.city || ""), unit: s?.unit === "C" ? "C" : "F" }; } catch { return { city: "", unit: "F" }; }
}

/** `look`: only on the website, where Ask can answer in a look (texting, notes, comments) through Arise
 *  Undercover's endpoint. Without one (always, in the iPhone apps) it's the plain Ask AI. */
export async function askAi(messages: AskMsg[], prefs: { city: string; unit: "F" | "C"; context?: string }, look?: string): Promise<string> {
  const token = apiAuthToken();
  const q = messages[messages.length - 1]?.content || "";
  const coords = wantsWeather(q) && !prefs.city && !weatherPlaceFrom(q) ? await here() : null;
  // The AI answers from the person's own notes and from the web together: what the notes say goes in with the question.
  const fromNotes = notesLookup && q.trim().length >= 3 ? await Promise.race([notesLookup(q).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 9000))]) : null;
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; } })();
  const res = await fetch(`${API_BASE}${look && !(typeof __TODO_APP__ !== "undefined" && __TODO_APP__) ? "/api/undercover/chat" : "/api/ask/chat"}`, {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ ...(look ? { theme: look } : {}), messages, tz, place: prefs.city, unit: prefs.unit, ...(prefs.context ? { context: prefs.context.slice(0, 8000) } : {}), ...(fromNotes ? { notes: fromNotes.slice(0, 3000) } : {}), ...(coords || {}) }),
  }).catch(() => null);
  if (!res) throw new Error("You seem to be offline.");
  const d = await res.json().catch(() => null);
  if (!res.ok) throw new Error(d?.message || "Couldn't get an answer. Try again.");
  return String(d?.reply || "");
}
