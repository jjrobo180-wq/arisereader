// The Advisory Challenge standings, shared by the pop-up, the library banner and the leaderboards.
// One request serves them all for a minute, and passing a quiz refreshes them.
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/queryClient";
import { sessionToken } from "@/lib/notifications";
import type { ChallengeView } from "@shared/advisoryChallenge";

let last: { token: string; at: number; view: ChallengeView } | null = null;
let pending: { token: string; promise: Promise<ChallengeView | null> } | null = null;

export function loadAdvisoryChallenge(token: string | null | undefined, fresh = false): Promise<ChallengeView | null> {
  const t = token || sessionToken();
  if (!t) return Promise.resolve(null);
  if (!fresh && last && last.token === t && Date.now() - last.at < 60_000) return Promise.resolve(last.view);
  if (!fresh && pending && pending.token === t) return pending.promise;
  const promise = fetch(`${API_BASE}/api/advisory-challenge`, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((view: ChallengeView | null) => {
      if (view) last = { token: t, at: Date.now(), view };
      return view;
    })
    .catch(() => null)
    .finally(() => { if (pending?.promise === promise) pending = null; });
  pending = { token: t, promise };
  return promise;
}

/** The standings; undefined while loading, null when there's no challenge for this reader. */
export function useAdvisoryChallenge(token: string | null | undefined): ChallengeView | null | undefined {
  const [view, setView] = useState<ChallengeView | null | undefined>(() => (last && last.token === (token || sessionToken()) ? last.view : undefined));
  useEffect(() => {
    let alive = true;
    const load = (fresh: boolean) => loadAdvisoryChallenge(token, fresh).then((v) => { if (alive) setView(v && v.challenge ? v : null); });
    load(false);
    const refresh = () => load(true);
    window.addEventListener("arise-points-updated", refresh);
    return () => { alive = false; window.removeEventListener("arise-points-updated", refresh); };
  }, [token]);
  return view;
}
