// To Duo's setup and walkthrough show once per account, on any device (server: /api/arise-todo/seen).
// This device also remembers it (the components' own localStorage keys), so it never waits on the
// network once it knows.
import { API_BASE, apiAuthToken } from "@/lib/queryClient";

export type Seen = { setup: boolean; walkthrough: boolean };
const auth = (): Record<string, string> => { const t = apiAuthToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

/** What this account has already been through, or null if it couldn't be checked (then nothing is hidden). */
export async function fetchSeen(): Promise<Seen | null> {
  try {
    const r = await fetch(`${API_BASE}/api/arise-todo/seen`, { cache: "no-store", headers: auth(), signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const d = await r.json();
    return { setup: !!d?.setup, walkthrough: !!d?.walkthrough };
  } catch { return null; }
}

/** Remembers on the account that this part has been seen. */
export function markSeen(part: keyof Seen): void {
  void fetch(`${API_BASE}/api/arise-todo/seen`, { method: "POST", headers: { "Content-Type": "application/json", ...auth() }, body: JSON.stringify({ [part]: true }), keepalive: true }).catch(() => {});
}
