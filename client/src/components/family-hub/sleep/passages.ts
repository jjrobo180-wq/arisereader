// Arise LifeHub · Sleep: Scripture text, read live from the LifeHub Bible lookup (the same
// King James Version source the Bible app uses), remembered for the rest of the visit. The app
// keeps its own copy of every passage too (shared/sleepScripts.ts), so nothing waits on the
// network and everything still works offline.
import { API_BASE } from "@/lib/queryClient";

export type Verse = [number, string];
const live = new Map<string, Verse[]>();

/** The live text of a passage, if it has been loaded this visit. */
export const liveVerses = (ref: string): Verse[] | null => live.get(ref) ?? null;

export async function loadPassage(ref: string, token: string | null): Promise<Verse[] | null> {
  const have = live.get(ref);
  if (have) return have;
  try {
    const r = await fetch(`${API_BASE}/api/lifehub/bible?ref=${encodeURIComponent(ref)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!r.ok) return null;
    const body = await r.json().catch(() => null);
    if (!body || !Array.isArray(body.verses) || !body.verses.length) return null;
    const verses: Verse[] = body.verses
      .map((v: { verse?: unknown; text?: unknown }): Verse => [Number(v.verse) || 0, String(v.text ?? "").replace(/\s+/g, " ").trim()])
      .filter(([, text]: Verse) => !!text);
    if (!verses.length) return null;
    live.set(ref, verses);
    return verses;
  } catch {
    return null;
  }
}
