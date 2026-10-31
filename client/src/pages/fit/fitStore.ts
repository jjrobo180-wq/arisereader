// Arise Fit's data on this phone and on the server (server/fit.ts). The app opens from the copy on the
// phone at once, then the server's copy; every change is saved a moment later, and kept on the phone
// if the server can't be reached (it goes up next time).
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import { cleanFit, emptyFit, type FitData } from "@shared/fit";
import type { LibraryExercise } from "../../../../server/fit";

const KEY = "arise-fit-data";
const DIRTY = "arise-fit-dirty";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string | null) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage full or off */ } };

export async function fitApi<T>(token: string | null, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/fit${path}`, {
    ...init,
    headers: { ...(init?.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || "Arise Fit can't reach the server right now.");
  return body as T;
}

export type Update = (fn: (d: FitData) => FitData) => void;

export function useFitData(token: string | null) {
  const [data, setData] = useState<FitData>(() => { try { return cleanFit(JSON.parse(read(KEY) || "null")); } catch { return emptyFit(); } });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "offline">("idle");
  const ref = useRef(data); ref.current = data;
  const timer = useRef<number | null>(null);

  const push = useCallback(async () => {
    setSaving("saving");
    try { await fitApi(token, "/data", { method: "PUT", body: JSON.stringify({ data: ref.current }) }); write(DIRTY, null); setSaving("idle"); }
    catch { setSaving("offline"); }
  }, [token]);

  useEffect(() => {
    let live = true;
    fitApi<{ data: FitData }>(token, "/data").then((b) => {
      if (!live) return;
      // Changes made offline on this phone win; otherwise the server's copy.
      if (read(DIRTY) === "1") void push();
      else { const d = cleanFit(b.data); setData(d); write(KEY, JSON.stringify(d)); }
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
    const away = () => { if (document.visibilityState === "hidden" && read(DIRTY) === "1") void push(); };
    document.addEventListener("visibilitychange", away);
    return () => document.removeEventListener("visibilitychange", away);
  }, [push]);

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
