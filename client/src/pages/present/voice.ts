// The show's AI voice on the page: each line of the script is fetched once from /api/student-show/voice/<line>
// (made by the server the first time, then saved) and kept for the visit. If the AI voice is not set up or a
// line cannot load, the caller falls back to the computer's own voice.
import { API_BASE } from "@/lib/queryClient";

const clips = new Map<number, Promise<string | null>>();
let status: Promise<boolean> | null = null;

/** Whether the server has the AI voice set up. */
export function aiVoiceReady(): Promise<boolean> {
  status ??= fetch(`${API_BASE}/api/student-show/voice/status`, { cache: "no-store" })
    .then(async (r) => (r.ok ? !!(await r.json()).ai : false))
    .catch(() => false);
  return status;
}

/** The playable address of line `i`, or null when it could not be loaded. */
export function clipFor(i: number): Promise<string | null> {
  let p = clips.get(i);
  if (!p) {
    p = fetch(`${API_BASE}/api/student-show/voice/${i}`)
      .then(async (r) => (r.ok ? URL.createObjectURL(await r.blob()) : null))
      .catch(() => null);
    p.then((url) => { if (!url) clips.delete(i); });
    clips.set(i, p);
  }
  return p;
}

let warming = 0;
/** Loads every line from `from` on, a couple at a time, so each is ready before it is needed. Starting again restarts from the new place. */
export function warmFrom(from: number, total: number) {
  const mine = ++warming;
  let next = from;
  const worker = async () => {
    while (warming === mine && next < total) { const i = next++; await clipFor(i); }
  };
  void worker(); void worker();
}
export function stopWarming() { warming++; }

/** Waits for line `i`, but no longer than `ms`: a slow first line must not hold the show up. */
export function clipWithin(i: number, ms: number): Promise<string | null> {
  return Promise.race([clipFor(i), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}
