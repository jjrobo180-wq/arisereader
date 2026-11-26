// When a screen crashes, the app reloads itself once before showing "Something went wrong": a reload fixes
// almost every crash (a page left open across an update, a dropped connection). Once per page per minute,
// so a page that really is broken shows the message instead of reloading forever. No imports, so the
// error screens, the plugin areas and main.tsx can all use it.
const AUTO_RELOAD_KEY = "arise_crash_reload";
/** True the first time a page crashes in a minute (and records it); false if it crashed again right after reloading. */
export function shouldAutoReload(route: string, now: number, store: Pick<Storage, "getItem" | "setItem"> | null = (() => { try { return sessionStorage; } catch { return null; } })()): boolean {
  if (!store) return false;
  try {
    const last = JSON.parse(store.getItem(AUTO_RELOAD_KEY) || "{}");
    if (last.route === route && now - Number(last.at || 0) < 60_000) return false;
    store.setItem(AUTO_RELOAD_KEY, JSON.stringify({ route, at: now }));
    return true;
  } catch { return false; }
}

