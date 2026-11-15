// In the iPhone apps: reads and books added since the app was built (shared/liveCatalog.ts).
// Imported first in main.tsx, so the ones kept from last time are in the lists before any screen
// builds from them. A check with the server runs a moment after the app starts; anything new is kept
// for next time and added straight away ("arise:catalog" tells open screens).
import { useEffect, useState } from "react";
import { addToCatalog, missingFrom, type CatalogItems } from "@shared/liveCatalog";

const KEY = "arise-live-catalog-v1";
const native = typeof window !== "undefined" && window.location.protocol === "capacitor:";

function kept(): CatalogItems | null {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

if (native) {
  const saved = kept();
  if (saved) addToCatalog(saved);
  // After main.tsx has pointed "/api/..." at the server.
  setTimeout(async () => {
    try {
      const index = await fetch("/api/content/catalog").then((r) => (r.ok ? r.json() : null));
      if (!index) return;
      const want = missingFrom(index);
      if (!want.reads.length && !want.books.length && !want.classics.length) return;
      const q = new URLSearchParams({ reads: want.reads.join(","), books: want.books.join(","), classics: want.classics.join(",") });
      const items = await fetch(`/api/content/catalog/items?${q}`).then((r) => (r.ok ? r.json() : null));
      if (!items) return;
      // Keep the new ones with any kept before (a read is only ever added, never changed here).
      const prev = kept() || { reads: [], books: [], classics: [] };
      const merged = { reads: [...(prev.reads || []), ...(items.reads || [])], books: [...(prev.books || []), ...(items.books || [])], classics: [...(prev.classics || []), ...(items.classics || [])] };
      try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch { /* full: they'll be fetched again next time */ }
      if (addToCatalog(items) > 0) window.dispatchEvent(new Event("arise:catalog"));
    } catch { /* offline: next time */ }
  }, 1500);
}

/** Re-renders when new reads or books arrive while the app is open. */
export function useCatalogTick(): number {
  const [n, setN] = useState(0);
  useEffect(() => { const on = () => setN((x) => x + 1); window.addEventListener("arise:catalog", on); return () => window.removeEventListener("arise:catalog", on); }, []);
  return n;
}
