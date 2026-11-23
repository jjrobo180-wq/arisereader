// The Top Reader Challenge board, shared by the sign-in pop-up, the library banner and the leaderboards.
// One request serves them all for a minute, and passing a quiz refreshes it.
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import { sessionToken } from "@/lib/notifications";
import type { TopReaderView } from "@shared/topReader";

let last: { token: string; at: number; view: TopReaderView } | null = null;
let pending: { token: string; promise: Promise<TopReaderView | null> } | null = null;

export function loadTopReader(token: string | null | undefined, fresh = false): Promise<TopReaderView | null> {
  const t = token || sessionToken();
  if (!t) return Promise.resolve(null);
  if (!fresh && last && last.token === t && Date.now() - last.at < 60_000) return Promise.resolve(last.view);
  if (!fresh && pending && pending.token === t) return pending.promise;
  const promise = fetch(`${API_BASE}/api/top-reader`, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((view: TopReaderView | null) => {
      if (view) last = { token: t, at: Date.now(), view };
      return view;
    })
    .catch(() => null)
    .finally(() => { if (pending?.promise === promise) pending = null; });
  pending = { token: t, promise };
  return promise;
}

/** The board; undefined while loading, null when there's no challenge for this reader. */
export function useTopReader(token: string | null | undefined): TopReaderView | null | undefined {
  const [view, setView] = useState<TopReaderView | null | undefined>(() => (last && last.token === (token || sessionToken()) ? (last.view.challenge ? last.view : null) : undefined));
  useEffect(() => {
    let alive = true;
    const load = (fresh: boolean) => loadTopReader(token, fresh).then((v) => { if (alive) setView(v && v.challenge ? v : null); });
    load(false);
    const refresh = () => load(true);
    window.addEventListener("arise-points-updated", refresh);
    return () => { alive = false; window.removeEventListener("arise-points-updated", refresh); };
  }, [token]);
  return view;
}

/** Whether this account has seen the "New challenge!" introduction (kept on this device). */
export function introSeen(challengeId: string, userId: number | string | undefined): boolean {
  try { return !!localStorage.getItem(`top_reader_intro:${challengeId}:${userId ?? ""}`); } catch { return false; }
}
export function markIntroSeen(challengeId: string, userId: number | string | undefined): void {
  try { localStorage.setItem(`top_reader_intro:${challengeId}:${userId ?? ""}`, "1"); } catch { /* shown again next time: harmless */ }
}
