// Loads one of the LifeHub Plugin Store feeds from the server (server/lifehubPlugins.ts).
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";

export function useLifeFeed<T>(path: string | null, round = 0) {
  const { token } = useAuth();
  const [state, setState] = useState<{ data: T | null; busy: boolean; error: string }>({ data: null, busy: !!path, error: "" });
  useEffect(() => {
    if (!path) { setState({ data: null, busy: false, error: "" }); return; }
    const ctrl = new AbortController();
    setState((s) => ({ ...s, busy: true, error: "" }));
    fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: ctrl.signal })
      .then(async (r) => { const b = await r.json().catch(() => null); if (!r.ok) throw new Error(b?.message || "That can't be reached right now. Try again in a minute."); return b as T; })
      .then((data) => setState({ data, busy: false, error: "" }))
      .catch((e: Error) => { if (!ctrl.signal.aborted) setState({ data: null, busy: false, error: e.message }); });
    return () => ctrl.abort();
  }, [path, round, token]);
  return state;
}
