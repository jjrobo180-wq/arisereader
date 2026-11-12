// Cooked's data on this phone and on the server (server/fit.ts). The app opens from the copy on the
// phone at once, then the server's copy; every change is saved a moment later, and kept on the phone
// if the server can't be reached (it goes up next time). Two phones never overwrite each other: before
// each save the server's copy is checked, and if another device changed it, both sets of changes are
// merged (shared/mergeJson.ts). Coming back to the app picks up what other devices saved.
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import { cleanFit, emptyFit, type FitData } from "@shared/fit";
import { merge3 } from "@shared/mergeJson";
import type { LibraryExercise } from "../../../../server/fit";

const KEY = "arise-fit-data";
const DIRTY = "arise-fit-dirty";
/** The copy last agreed with the server: what both devices started from, for merging. */
const BASE = "arise-fit-base";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage full or off */ } };

export async function fitApi<T>(token: string | null, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/fit${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || "Cooked can't reach the server right now.");
  return body as T;
}

export type Update = (fn: (d: FitData) => FitData) => void;

export function useFitData(token: string | null) {
  const [data, setData] = useState<FitData>(() => { try { return cleanFit(JSON.parse(read(KEY) || "null")); } catch { return emptyFit(); } });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "offline">("idle");
  const ref = useRef(data); ref.current = data;
  const timer = useRef<number | null>(null);

  const pushing = useRef(false);
  const push = useCallback(async () => {
    if (pushing.current) { timer.current = window.setTimeout(() => void push(), 800); return; }
    pushing.current = true; setSaving("saving");
    try {
      // What's on the server now: if another device saved since our last agreed copy, merge first.
      const server = cleanFit((await fitApi<{ data: FitData }>(token, "/data")).data);
      let base: FitData | undefined; try { const b = read(BASE); base = b ? cleanFit(JSON.parse(b)) : undefined; } catch { base = undefined; }
      const mine = ref.current;
      let send = mine;
      if (!same(server, mine) && (!base || !same(server, base))) {
        send = cleanFit(merge3(base, mine, server));
        ref.current = send; setData(send); write(KEY, JSON.stringify(send));
      }
      if (!same(send, server)) await fitApi(token, "/data", { method: "PUT", body: JSON.stringify({ data: send }) });
      write(BASE, JSON.stringify(send));
      // Anything typed while this save was out goes in the next one.
      if (same(ref.current, send)) write(DIRTY, null); else { if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => void push(), 600); }
      setSaving("idle");
    } catch { setSaving("offline"); }
    finally { pushing.current = false; }
  }, [token]);

  /** Picks up what other devices saved (when this one has nothing waiting to go up). */
  const pull = useCallback(async () => {
    if (read(DIRTY) === "1" || pushing.current) return;
    try {
      const server = cleanFit((await fitApi<{ data: FitData }>(token, "/data")).data);
      if (read(DIRTY) === "1" || pushing.current) return;
      if (!same(server, ref.current)) { ref.current = server; setData(server); write(KEY, JSON.stringify(server)); }
      write(BASE, JSON.stringify(server));
    } catch { /* offline: try next time */ }
  }, [token]);

  useEffect(() => {
    let live = true;
    fitApi<{ data: FitData }>(token, "/data").then((b) => {
      if (!live) return;
      // Changes made offline on this phone win; otherwise the server's copy.
      if (read(DIRTY) === "1") void push();
      else { const d = cleanFit(b.data); setData(d); write(KEY, JSON.stringify(d)); write(BASE, JSON.stringify(d)); }
      setLoaded(true);
    }).catch(() => { if (live) { setLoaded(true); setSaving("offline"); } });
    return () => { live = false; };
  }, [token, push]);

  const update: Update = useCallback((fn) => {
    setData((d) => { const n = fn(d); write(KEY, JSON.stringify(n)); write(DIRTY, "1"); return n; });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void push(), 1200);
  }, [push]);

  // Saved before the app goes to the background.
  useEffect(() => {
    const away = () => { if (document.visibilityState === "hidden") { if (read(DIRTY) === "1") void push(); } else if (read(DIRTY) === "1") void push(); else void pull(); };
    const online = () => { if (read(DIRTY) === "1") void push(); else void pull(); };
    document.addEventListener("visibilitychange", away);
    window.addEventListener("online", online);
    const every = window.setInterval(() => { if (document.visibilityState === "visible") void pull(); }, 30_000);
    return () => { document.removeEventListener("visibilitychange", away); window.removeEventListener("online", online); window.clearInterval(every); };
  }, [push, pull]);

  return { data, update, loaded, saving };
}

let libraryCache: LibraryExercise[] | null = null;
export function useLibrary(token: string | null) {
  const [list, setList] = useState<LibraryExercise[] | null>(libraryCache);
  useEffect(() => {
    if (libraryCache) return;
    fitApi<{ exercises: LibraryExercise[] }>(token, "/exercises").then((b) => { libraryCache = b.exercises || []; setList(libraryCache); }).catch(() => setList([]));
  }, [token]);
  return list;
}
export type { LibraryExercise };
