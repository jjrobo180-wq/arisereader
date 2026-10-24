// The last copy of each hub this page opened, kept in memory so switching between Arise WorkHub and
// Arise LifeHub is instant: the hub you come back to shows straight away from here while it quietly
// asks the server for anything newer, instead of a loading screen every time.
//
// Only in memory: a reload, a new tab or signing out starts clean (nothing extra is left on the
// device), and each signed-in person has their own entries.
type Entry<W> = {
  /** The newest copy on this page (may hold changes still on their way to the server). */
  workspace: W;
  /** The copy the server last confirmed, and when — the base the next save names. */
  saved: W;
  updatedAt: string | null;
  /** Extra things the hub needs to show at once (WorkHub's seat count, say). */
  extra?: Record<string, unknown>;
  /** A save that was still going when the hub was left; the hub waits for it before saving again. */
  pending?: Promise<void>;
};

const store = new Map<string, Entry<unknown>>();
const key = (hub: "todo" | "work", userId: number) => `${hub}:${userId}`;

export function recallHub<W>(hub: "todo" | "work", userId: number | undefined): Entry<W> | null {
  if (!userId) return null;
  return (store.get(key(hub, userId)) as Entry<W> | undefined) ?? null;
}

export function rememberHub<W>(hub: "todo" | "work", userId: number | undefined, patch: Partial<Entry<W>> & { workspace?: W }): void {
  if (!userId) return;
  const k = key(hub, userId);
  const before = store.get(k) as Entry<W> | undefined;
  const next = { ...before, ...patch } as Entry<W>;
  if (next.workspace === undefined || next.saved === undefined) return; // never half an entry
  store.set(k, next as Entry<unknown>);
}

export function forgetHubs(): void {
  store.clear();
}

if (typeof window !== "undefined") window.addEventListener("arise-logout", forgetHubs);
