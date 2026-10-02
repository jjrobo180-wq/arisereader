import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/queryClient";

export type Seat = 1 | 2;
export type ArcadePlayer = { seat: Seat; userId: number | null; name: string; computer: boolean };
export type ArcadeMatch = {
  id: string;
  gameId: string;
  status: "waiting" | "active" | "finished" | "cancelled";
  seat: Seat;
  computer: boolean;
  level: 1 | 2 | 3;
  v: number;
  players: ArcadePlayer[];
  toAct: Seat[];
  yourTurn: boolean;
  winner: 0 | 1 | 2 | null;
  result: "forfeit" | null;
  view: any;
  invitee: { userId: number; name: string } | null;
  declined: boolean;
  opponentAway: boolean;
  canClaim: boolean;
  reward: { coins: boolean; points: boolean } | null;
  interim?: any;
  legacy?: boolean;
};
export type LobbyTable = { matchId: string; gameId: string; gameName: string; hostId: number; hostName: string; createdAt: string };
export type Lobby = { tables: LobbyTable[]; invites: LobbyTable[] };
export type StartOptions = { computer?: boolean; level?: number; matchId?: string; inviteUserId?: number };

async function request<T>(token: string | null, path: string, body?: unknown, keepalive = false): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    keepalive,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Something went wrong. Try again.");
  return data as T;
}

export const arcadeApi = {
  join: (token: string | null, gameId: string, opts: StartOptions) => request<ArcadeMatch>(token, "/api/club-arise/matches/join", { gameType: gameId, ...opts }),
  get: (token: string | null, id: string) => request<ArcadeMatch>(token, "/api/club-arise/matches/" + id),
  act: (token: string | null, id: string, move: unknown) => request<ArcadeMatch>(token, "/api/club-arise/matches/" + id + "/action", { move }),
  leave: (token: string | null, id: string) => request<{ ok: true }>(token, "/api/club-arise/matches/" + id + "/leave", {}, true),
  claim: (token: string | null, id: string) => request<ArcadeMatch>(token, "/api/club-arise/matches/" + id + "/claim", {}),
  decline: (token: string | null, id: string) => request<{ ok: true }>(token, "/api/club-arise/matches/" + id + "/decline", {}),
  lobby: (token: string | null) => request<Lobby>(token, "/api/club-arise/lobby"),
};

/** One live match: start, poll (reader matches), act, leave. */
export function useArcadeMatch(token: string | null) {
  const [match, setMatch] = useState<ArcadeMatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const matchRef = useRef<ArcadeMatch | null>(null);
  const reveal = useRef<number | null>(null);
  matchRef.current = match;

  const accept = useCallback((next: ArcadeMatch) => {
    const current = matchRef.current;
    // Ignore an older poll that arrives after a newer move.
    if (current && current.id === next.id && next.v < current.v && next.status === current.status) return;
    setMatch(next);
  }, []);

  const start = useCallback(async (gameId: string, opts: StartOptions) => {
    setBusy(true); setError("");
    try {
      const m = await arcadeApi.join(token, gameId, opts);
      setMatch(m);
      return m;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally { setBusy(false); }
  }, [token]);

  const act = useCallback(async (move: unknown) => {
    const current = matchRef.current;
    if (!current || busy) return;
    setBusy(true); setError("");
    try {
      const next = await arcadeApi.act(token, current.id, move);
      if (next.interim !== undefined) {
        // Show my move first, then the computer's reply a moment later.
        setMatch({ ...next, view: next.interim, toAct: [], yourTurn: false, status: "active", winner: null });
        setThinking(true);
        if (reveal.current) window.clearTimeout(reveal.current);
        reveal.current = window.setTimeout(() => { setThinking(false); setMatch(next); }, 750);
      } else accept(next);
    } catch (e: any) {
      setError(e.message);
    } finally { setBusy(false); }
  }, [token, busy, accept]);

  const leave = useCallback(async () => {
    const current = matchRef.current;
    setMatch(null); setThinking(false); setError("");
    if (reveal.current) window.clearTimeout(reveal.current);
    if (current && (current.status === "waiting" || current.status === "active")) {
      try { await arcadeApi.leave(token, current.id); } catch { /* best effort */ }
    }
  }, [token]);

  const claim = useCallback(async () => {
    const current = matchRef.current;
    if (!current) return;
    try { accept(await arcadeApi.claim(token, current.id)); } catch (e: any) { setError(e.message); }
  }, [token, accept]);

  // Reader matches: poll for the other player's moves.
  useEffect(() => {
    if (!match || match.computer || !(match.status === "waiting" || match.status === "active")) return;
    let live = true;
    const id = window.setInterval(async () => {
      try {
        const next = await arcadeApi.get(token, match.id);
        if (live) accept(next);
      } catch { /* keep polling */ }
    }, 900);
    return () => { live = false; window.clearInterval(id); };
  }, [match?.id, match?.status, match?.computer, token, accept]);

  // Leaving the page forfeits/cancels so the other reader is not stuck waiting.
  useEffect(() => {
    if (!match || !(match.status === "waiting" || match.status === "active")) return;
    const onHide = () => { void arcadeApi.leave(token, match.id).catch(() => {}); };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [match?.id, match?.status, token]);

  useEffect(() => () => { if (reveal.current) window.clearTimeout(reveal.current); }, []);

  return { match, setMatch, busy, thinking, error, setError, start, act, leave, claim };
}

/** Open tables and challenges, refreshed while `enabled`. */
export function useArcadeLobby(token: string | null, enabled: boolean, everyMs = 4000) {
  const [lobby, setLobby] = useState<Lobby>({ tables: [], invites: [] });
  const refresh = useCallback(async () => {
    try { setLobby(await arcadeApi.lobby(token)); } catch { /* quiet */ }
  }, [token]);
  useEffect(() => {
    if (!enabled || !token) return;
    void refresh();
    const id = window.setInterval(refresh, everyMs);
    return () => window.clearInterval(id);
  }, [enabled, token, everyMs, refresh]);
  return { lobby, refresh };
}
