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

/** "Let the games begin!": whether this account still needs the Advisory Challenge introduction.
 *  Shown once per account; the server remembers it across devices, and this device does too, so a
 *  slow or failed save never shows it twice here. `show` is undefined while checking. */
export function useGamesBegin(token: string | null | undefined, userId: number | string | undefined, enabled = true): { show: boolean | undefined; done: () => void } {
  const local = `games_begin_seen:${userId ?? ""}`;
  const seenHere = () => { try { return !!localStorage.getItem(local); } catch { return false; } };
  // The answer is kept with the account it was for, so it is "still checking" (undefined) until the
  // server has answered for this account, never a stale "no" that would flash the wrong pop-up.
  const [answer, setAnswer] = useState<{ for: string; show: boolean } | null>(null);
  const active = enabled && userId != null && !seenHere();
  useEffect(() => {
    if (!active) return;
    const t = token || sessionToken();
    if (!t) { setAnswer({ for: local, show: false }); return; }
    let alive = true;
    fetch(`${API_BASE}/api/intro/games-begin`, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { seen: true }))
      .then((d) => { if (alive) setAnswer({ for: local, show: !d?.seen }); })
      .catch(() => { if (alive) setAnswer({ for: local, show: false }); });
    return () => { alive = false; };
  }, [token, local, active]);
  const done = () => {
    setAnswer({ for: local, show: false });
    try { localStorage.setItem(local, "1"); } catch { /* the server still remembers */ }
    const t = token || sessionToken();
    if (t) void fetch(`${API_BASE}/api/intro/games-begin`, { method: "POST", headers: { Authorization: `Bearer ${t}` } }).catch(() => {});
  };
  const show = !active ? false : answer?.for === local ? answer.show : undefined;
  return { show, done };
}
