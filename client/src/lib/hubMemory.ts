// The last copy of each hub this page opened, kept in memory so switching between Arise WorkHub and
// Arise LifeHub is instant: the hub you come back to shows straight away from here while it quietly
// asks the server for anything newer, instead of a loading screen every time.
//
// Only in memory: a reload, a new tab or signing out starts clean (nothing extra is left on the
// device), and each signed-in person has their own entries. Once one hub has opened, the other is
// fetched in the background (prefetchHub), so the first switch is instant too.
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
/** Hubs showing on this page right now (their own copy is the live one, so nothing is fetched for them). */
const open = new Set<string>();
/** Goes up on sign-out, so a fetch that started before it never fills memory afterwards. */
let generation = 0;

export function markHubOpen(hub: "todo" | "work", userId: number | undefined, isOpen: boolean): void {
  if (!userId) return;
  if (isOpen) open.add(key(hub, userId)); else open.delete(key(hub, userId));
}

/** Fetch the other hub's copy ahead of time, so even the first switch to it shows at once.
 *  `load` asks the server; nothing is kept if the hub is already open or remembered, or if someone
 *  signed out meanwhile. */
export async function prefetchHub<W>(hub: "todo" | "work", userId: number | undefined, load: () => Promise<{ workspace: W; updatedAt: string | null; extra?: Record<string, unknown> } | null>): Promise<void> {
  if (!userId) return;
  const k = key(hub, userId);
  if (store.has(k) || open.has(k)) return;
  const gen = generation;
  try {
    const got = await load();
    if (!got || gen !== generation || store.has(k) || open.has(k)) return;
    store.set(k, { workspace: got.workspace, saved: got.workspace, updatedAt: got.updatedAt, extra: got.extra } as Entry<unknown>);
  } catch { /* the hub loads normally when it is opened */ }
}

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
  generation += 1;
}

if (typeof window !== "undefined") window.addEventListener("arise-logout", forgetHubs);
